import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { getSlides } from '../services/slidesStorage';

const router = Router();

// 0. Public Slides Endpoints (GET /api/public/slides, /api/public/home-slides)
const handlePublicSlides = async (req: Request, res: Response) => {
  try {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const slides = await getSlides(true);
    return res.json(slides || []);
  } catch (err: any) {
    console.error('[PUBLIC SLIDES EXCEPTION]', err);
    return res.status(500).json({ error: 'Failed to retrieve public slides.' });
  }
};

router.get('/slides', handlePublicSlides);
router.get('/home-slides', handlePublicSlides);

// Helper functions for phone verification & IDOR prevention
function normalizePhoneDigits(phone?: string | null): string {
  if (!phone) return '';
  return String(phone).replace(/\D/g, '');
}

function isPhoneMatching(providedPhoneDigits: string, recordPhone?: string | null): boolean {
  if (!providedPhoneDigits || !recordPhone) return false;
  const dbDigits = normalizePhoneDigits(recordPhone);
  if (!dbDigits) return false;

  // Exact digits match
  if (providedPhoneDigits === dbDigits) return true;

  // Last 10 digits match (Nepal standard 10-digit mobile, ignoring +977 or leading 0)
  const p10 = providedPhoneDigits.length >= 10 ? providedPhoneDigits.slice(-10) : providedPhoneDigits;
  const db10 = dbDigits.length >= 10 ? dbDigits.slice(-10) : dbDigits;
  if (p10 === db10) return true;

  // Last 7 digits match for landlines
  if (providedPhoneDigits.length >= 7 && dbDigits.length >= 7) {
    if (providedPhoneDigits.slice(-7) === dbDigits.slice(-7)) return true;
  }

  return false;
}

// 1. GET & POST /api/public/track (or /api/track) - Secure Resilient Public Tracking
const handlePublicTrack = async (req: Request, res: Response) => {
  // Prevent any browser or intermediary caching of tracking responses
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  try {
    const rawRepairNumber = req.body?.repairNumber || req.query?.repairNumber || req.body?.ticketNumber || req.query?.ticketNumber || '';
    const rawPhone = req.body?.phone || req.query?.phone || req.body?.customerPhone || req.query?.customerPhone || '';

    // Strip leading '#', trim whitespace, and clean digits
    const cleanRepairNumber = String(rawRepairNumber).trim().replace(/^#+/, '').trim();
    const cleanPhone = normalizePhoneDigits(String(rawPhone));
    const phone10 = cleanPhone.length >= 10 ? cleanPhone.slice(-10) : cleanPhone;

    if (!cleanRepairNumber && !cleanPhone) {
      return res.status(400).json({ error: 'Please enter your Repair Number or Registered Phone Number.' });
    }

    const selectFields = `
      id,
      repairNumber,
      customerId,
      customerName,
      customerPhone,
      customerEmail,
      customerAddress,
      deviceBrand,
      deviceModel,
      problemDescription,
      deviceCondition,
      conditionNotes,
      accessoriesReceived,
      status,
      priority,
      expectedCompletionDate,
      estimatedCost,
      advancePaid,
      totalPaid,
      paymentStatus,
      receivingMethod,
      isCourierIn,
      isCourierOut,
      courierStatus,
      courierCompany,
      courierTrackingNumber,
      returnCourierCompany,
      returnCourierTrackingNumber,
      returnCourierDispatchDate,
      courierOutDeliveredDate,
      hasBatteryWarranty,
      batteryWarrantyPeriod,
      batteryType,
      batteryHealth,
      batterySerial,
      batteryWarrantyExpiry,
      warrantyTerms,
      remarks,
      createdAt,
      updatedAt
    `;

    let allMatchingRepairs: any[] = [];

    // Case 1: Customer provided BOTH Repair Number AND Phone Number
    if (cleanRepairNumber && cleanPhone) {
      const { data: candidates, error: cErr } = await supabaseAdmin
        .from('Repair')
        .select(selectFields)
        .or(`repairNumber.eq.${cleanRepairNumber},repairNumber.ilike.%${cleanRepairNumber}%`)
        .order('createdAt', { ascending: false })
        .limit(10);

      if (cErr) {
        console.error('[PUBLIC TRACK CANDIDATE ERROR]', cErr);
      }

      if (candidates && candidates.length > 0) {
        for (const cand of candidates) {
          if (isPhoneMatching(cleanPhone, cand.customerPhone)) {
            allMatchingRepairs.push(cand);
          } else if (cand.customerId) {
            const { data: linkedCustomer } = await supabaseAdmin
              .from('Customer')
              .select('phone, alternativePhone')
              .eq('id', cand.customerId)
              .maybeSingle();

            if (
              linkedCustomer &&
              (isPhoneMatching(cleanPhone, linkedCustomer.phone) || isPhoneMatching(cleanPhone, linkedCustomer.alternativePhone))
            ) {
              allMatchingRepairs.push(cand);
            }
          }
        }
      }
    }
    // Case 2: Customer provided ONLY Repair Number
    else if (cleanRepairNumber) {
      const { data: singleRepair } = await supabaseAdmin
        .from('Repair')
        .select(selectFields)
        .or(`repairNumber.eq.${cleanRepairNumber},repairNumber.ilike.%${cleanRepairNumber}%`)
        .order('createdAt', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (singleRepair) {
        allMatchingRepairs.push(singleRepair);
      }
    }
    // Case 3: Customer provided ONLY Phone Number
    else if (cleanPhone) {
      const { data: directMatches } = await supabaseAdmin
        .from('Repair')
        .select(selectFields)
        .or(`customerPhone.eq.${cleanPhone},customerPhone.ilike.%${phone10}%`)
        .order('createdAt', { ascending: false })
        .limit(20);

      if (directMatches && directMatches.length > 0) {
        for (const r of directMatches) {
          if (isPhoneMatching(cleanPhone, r.customerPhone)) {
            allMatchingRepairs.push(r);
          }
        }
      }

      // Also search linked Customer accounts
      const { data: cusList } = await supabaseAdmin
        .from('Customer')
        .select('id, phone, alternativePhone')
        .or(`phone.eq.${cleanPhone},phone.ilike.%${phone10}%,alternativePhone.ilike.%${phone10}%`)
        .limit(10);

      if (cusList && cusList.length > 0) {
        for (const cus of cusList) {
          if (isPhoneMatching(cleanPhone, cus.phone) || isPhoneMatching(cleanPhone, cus.alternativePhone)) {
            const { data: customerRepairs } = await supabaseAdmin
              .from('Repair')
              .select(selectFields)
              .eq('customerId', cus.id)
              .order('createdAt', { ascending: false })
              .limit(10);

            if (customerRepairs) {
              for (const cr of customerRepairs) {
                if (!allMatchingRepairs.some((existing) => existing.id === cr.id)) {
                  allMatchingRepairs.push(cr);
                }
              }
            }
          }
        }
      }
    }

    if (!allMatchingRepairs || allMatchingRepairs.length === 0) {
      return res.status(404).json({ error: 'No repair records found matching your tracking information.' });
    }

    const primaryRepair = allMatchingRepairs[0];

    // Query RepairLog for all matching repairs to display customer-facing diagnostic trace (without timestamps or staff identity)
    const allRepairIds = allMatchingRepairs.map((r) => r.id);
    const { data: allExplicitLogs } = await supabaseAdmin
      .from('RepairLog')
      .select('id, repairId, status, message, createdAt')
      .in('repairId', allRepairIds)
      .order('createdAt', { ascending: false });

    const getCustomerLogDesc = (logStatus?: string, currentOverallStatus?: string) => {
      const st = (logStatus || currentOverallStatus || 'RECEIVED').toUpperCase().trim();
      const currentSt = (currentOverallStatus || 'RECEIVED').toUpperCase().trim();

      const isDeliveredOverall = currentSt === 'DELIVERED' || currentSt === 'COMPLETED';
      const isRepairedOrBeyond =
        isDeliveredOverall ||
        currentSt === 'REPAIRED' ||
        currentSt === 'READY_FOR_PICKUP' ||
        currentSt === 'READY_FOR_DELIVERY' ||
        currentSt === 'COURIER_DISPATCHED' ||
        currentSt === 'DISPATCHED_VIA_COURIER' ||
        currentSt === 'REPROBLEM_FIXED' ||
        currentSt === 'WARRANTY_FIXED';

      // 1. REPAIRED stage
      if (st === 'REPAIRED' || st.includes('WARRANTY_FIXED') || st.includes('REPROBLEM_FIXED')) {
        return 'The technical repair was successfully completed and the device passed the required quality verification.';
      }

      // 2. READY FOR PICKUP / DELIVERY
      if (st.includes('READY') || st.includes('PICKUP')) {
        return 'The repaired device is sanitized, packaged, and ready for customer pickup.';
      }

      // 3. COURIER LOGISTICS
      if (st.includes('COURIER') || st.includes('DISPATCH')) {
        return 'The repaired device was safely packed and dispatched via courier logistics.';
      }

      // 4. DELIVERED
      if (st.includes('DELIVERED') || st.includes('COMPLETED')) {
        return 'The device was handed over to the customer when the actual status reaches Delivered.';
      }

      // 5. TESTING / QA
      if (st.includes('TEST') || st.includes('QA')) {
        if (isRepairedOrBeyond) {
          return 'The repaired device underwent quality verification/testing.';
        }
        return 'The repaired device is undergoing comprehensive quality verification and calibration.';
      }

      // 6. RESTORATION / IN_PROCESS / WAITING_FOR_PARTS
      if (
        st.includes('PROCESS') ||
        st.includes('RESTORATION') ||
        st.includes('WAITING_FOR_PARTS') ||
        st === 'REPAIRING'
      ) {
        if (isRepairedOrBeyond) {
          return 'The required repair/restoration work was carried out.';
        }
        return 'The required repair/restoration work is currently being carried out by certified engineers.';
      }

      // 7. DIAGNOSING
      if (st.includes('DIAGNOSING')) {
        return 'The device was inspected/diagnosed to identify the reported issue.';
      }

      // 8. RECEIVED / INTAKE
      if (st.includes('RECEIVED') || st.includes('CREATED')) {
        return 'The device was received by MTS Lab for repair.';
      }

      // 9. PENDING
      if (st.includes('PENDING')) {
        return 'Your device is cataloged in the service queue awaiting laboratory intake and diagnosis.';
      }

      // 10. RE-PROBLEM
      if (st.includes('RE_PROBLEM') || st.includes('REPROBLEM')) {
        return 'Device received for priority diagnostic re-evaluation.';
      }

      // 11. CANCELLED / CANNOT REPAIR
      if (st.includes('CANCEL')) {
        return 'Repair service request closed.';
      }
      if (st.includes('CANNOT')) {
        return 'Catastrophic hardware damage exceeds viable safe restoration standards.';
      }

      return 'Device status updated to reflect laboratory progress.';
    };

    const extractPublicNote = (msg?: string): string | null => {
      if (!msg) return null;
      const match = msg.match(/Note:\s*([^.\n]+)/i) || msg.match(/Note:\s*(.+)$/i);
      if (match && match[1]) {
        const note = match[1].trim();
        // Discard if it only contained staff name
        if (note && !note.toLowerCase().startsWith('by ')) return note;
      }
      return null;
    };

    const buildLogsForRepair = (rep: any) => {
      const repLogs = (allExplicitLogs || []).filter((l: any) => l.repairId === rep.id);
      const currentSt = (rep.status || 'RECEIVED').toUpperCase().trim();

      // Find any custom technician notes attached to explicit logs
      const notesByStatus: Record<string, string> = {};
      repLogs.forEach((l: any) => {
        const key = (l.status || '').toUpperCase().trim();
        const note = extractPublicNote(l.message);
        if (note && !notesByStatus[key]) {
          notesByStatus[key] = note;
        }
      });

      const isDelivered = currentSt === 'DELIVERED' || currentSt === 'COMPLETED';
      const isRepaired = [
        'REPAIRED',
        'READY_FOR_PICKUP',
        'READY_FOR_DELIVERY',
        'READY',
        'COURIER_DISPATCHED',
        'DISPATCHED_VIA_COURIER',
        'REPROBLEM_FIXED',
        'WARRANTY_FIXED',
      ].includes(currentSt);

      const isTesting = ['TESTING', 'QA_TESTING', 'QA'].includes(currentSt);
      const isRestoration = [
        'IN_PROCESS',
        'IN_PROGRESS',
        'WAITING_FOR_PARTS',
        'RESTORATION',
        'REPAIRING',
        'RE_PROBLEM',
        'REPROBLEM',
      ].includes(currentSt);
      const isDiagnosing = currentSt === 'DIAGNOSING';
      const isCancelled = currentSt.includes('CANCEL');
      const isCannotRepair = currentSt.includes('CANNOT');

      // Build ordered trace stages in reverse-chronological order (latest first)
      const trace: any[] = [];

      // 1. Delivered Stage
      if (isDelivered) {
        trace.push({
          id: `trace-${rep.id}-delivered`,
          action: 'STATUS_UPDATED',
          status: 'DELIVERED',
          title: 'Delivered',
          notes: 'The device was safely delivered and handed over to the customer.',
          message: 'The device was safely delivered and handed over to the customer.',
          statusText: 'Completed',
        });
      }

      // 2. Repaired Stage
      if (isDelivered || isRepaired) {
        const customNote = notesByStatus['REPAIRED'] || notesByStatus['READY_FOR_PICKUP'] || '';
        const desc = customNote
          ? `The technical repair was successfully completed and quality verification passed. (${customNote})`
          : 'The technical repair was successfully completed and the device passed the required quality verification.';
        trace.push({
          id: `trace-${rep.id}-repaired`,
          action: 'STATUS_UPDATED',
          status: 'REPAIRED',
          title: 'Repaired',
          notes: desc,
          message: desc,
          statusText: 'Completed',
        });
      }

      // 3. QA Testing Stage
      if (isDelivered || isRepaired || isTesting) {
        const isPast = isDelivered || isRepaired;
        trace.push({
          id: `trace-${rep.id}-qa`,
          action: 'STATUS_UPDATED',
          status: 'QA_TESTING',
          title: 'QA Testing',
          notes: isPast
            ? 'The repaired device completed comprehensive quality verification, electrical diagnostic check, and functionality testing.'
            : 'The repaired device is undergoing comprehensive quality verification, electrical diagnostic check, and calibration.',
          message: isPast
            ? 'The repaired device completed comprehensive quality verification, electrical diagnostic check, and functionality testing.'
            : 'The repaired device is undergoing comprehensive quality verification, electrical diagnostic check, and calibration.',
          statusText: isPast ? 'Completed' : 'Active',
        });
      }

      // 4. Restoration Stage
      if (isDelivered || isRepaired || isTesting || isRestoration) {
        const isPast = isDelivered || isRepaired || isTesting;
        const customNote = notesByStatus['IN_PROCESS'] || notesByStatus['RESTORATION'] || '';
        const desc = isPast
          ? customNote
            ? `Component restoration and precision servicing successfully executed. (${customNote})`
            : 'Component restoration and precision servicing successfully executed by certified hardware engineers.'
          : 'Active hardware restoration and component servicing is currently in progress.';
        trace.push({
          id: `trace-${rep.id}-restoration`,
          action: 'STATUS_UPDATED',
          status: 'RESTORATION',
          title: 'Restoration',
          notes: desc,
          message: desc,
          statusText: isPast ? 'Completed' : 'Active',
        });
      }

      // 5. Diagnosing Stage
      if (isDelivered || isRepaired || isTesting || isRestoration || isDiagnosing) {
        const isPast = isDelivered || isRepaired || isTesting || isRestoration;
        trace.push({
          id: `trace-${rep.id}-diagnosing`,
          action: 'STATUS_UPDATED',
          status: 'DIAGNOSING',
          title: 'Diagnosing',
          notes: isPast
            ? 'Circuit and schematic diagnostic assessment completed to identify fault causes.'
            : 'Hardware diagnostic assessment and multi-point circuit inspection under way.',
          message: isPast
            ? 'Circuit and schematic diagnostic assessment completed to identify fault causes.'
            : 'Hardware diagnostic assessment and multi-point circuit inspection under way.',
          statusText: isPast ? 'Completed' : 'Active',
        });
      }

      // 6. Received / Cataloged Stage (Always completed once intake occurs)
      trace.push({
        id: `trace-${rep.id}-received`,
        action: 'STATUS_UPDATED',
        status: 'RECEIVED',
        title: 'Received',
        notes: 'Device received, securely cataloged in MTS Lab laboratory queue, and assigned initial tracking.',
        message: 'Device received, securely cataloged in MTS Lab laboratory queue, and assigned initial tracking.',
        statusText: 'Completed',
      });

      // Special terminal statuses
      if (isCancelled) {
        trace.unshift({
          id: `trace-${rep.id}-cancelled`,
          action: 'STATUS_UPDATED',
          status: 'CANCELLED',
          title: 'Service Cancelled',
          notes: 'Repair service ticket was closed or cancelled by customer request.',
          message: 'Repair service ticket was closed or cancelled by customer request.',
          statusText: 'Closed',
        });
      } else if (isCannotRepair) {
        trace.unshift({
          id: `trace-${rep.id}-cannot-repair`,
          action: 'STATUS_UPDATED',
          status: 'CANNOT_REPAIR',
          title: 'Cannot Repair',
          notes: 'Hardware damage exceeds safe restoration limits or replacement parts are permanently unavailable.',
          message: 'Hardware damage exceeds safe restoration limits or replacement parts are permanently unavailable.',
          statusText: 'Closed',
        });
      }

      return trace;
    };

    // Mask customer name and phone for public privacy
    const rawName = primaryRepair.customerName || '';
    const sanitizedName = rawName
      ? `${rawName.charAt(0)}*** ${rawName.split(' ').slice(-1)[0] || ''}`.trim()
      : 'Valued Customer';

    const pDigits = normalizePhoneDigits(primaryRepair.customerPhone || cleanPhone);
    const sanitizedPhone = pDigits && pDigits.length >= 6
      ? `${pDigits.slice(0, 3)}****${pDigits.slice(-3)}`
      : undefined;

    const sanitizePublicRepairObj = (rep: any) => {
      const {
        technicianId,
        technician,
        assignedTechnician,
        assignedTechnicianId,
        technicianName,
        createdById,
        receptionist,
        receptionistId,
        receptionistName,
        manager,
        managerId,
        managerName,
        admin,
        adminId,
        adminName,
        user,
        userId,
        staff,
        staffName,
        ...safe
      } = rep;

      return {
        ...safe,
        customerName: sanitizedName,
        customerPhone: sanitizedPhone,
        logs: buildLogsForRepair(rep),
      };
    };

    const sanitizedPrimary = sanitizePublicRepairObj(primaryRepair);
    const sanitizedAll = allMatchingRepairs.map((rep) => sanitizePublicRepairObj(rep));

    return res.json({
      success: true,
      repair: sanitizedPrimary,
      repairs: sanitizedAll,
      devices: sanitizedAll,
      ...sanitizedPrimary
    });
  } catch (err: any) {
    console.error('[PUBLIC TRACK EXCEPTION]', err);
    return res.status(500).json({ error: 'Failed to retrieve tracking details. Please try again later.' });
  }
};

router.get('/track', handlePublicTrack);
router.post('/track', handlePublicTrack);
router.get('/public/track', handlePublicTrack);
router.post('/public/track', handlePublicTrack);

// 2. GET /api/manager/stats
router.get('/manager/stats', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER']), async (req: AuthRequest, res: Response) => {
  try {
    const { data: repairs } = await supabaseAdmin.from('Repair').select('technicianId, status, priority, estimatedCost, advancePaid, totalPaid');

    let totalRepairs = 0;
    let pending = 0;
    let assigned = 0;
    let inProgress = 0;
    let repaired = 0;
    let ready = 0;
    let delivered = 0;
    let reproblem = 0;
    let unassigned = 0;
    let urgentCount = 0;
    let highCount = 0;
    let totalRevenue = 0;

    (repairs || []).forEach((r: any) => {
      totalRepairs++;
      totalRevenue += Number(r.totalPaid || r.advancePaid || 0);

      const s = (r.status || '').toUpperCase();
      if (!r.technicianId && s !== 'DELIVERED' && s !== 'CANCELLED') unassigned++;
      if (r.technicianId && s !== 'DELIVERED' && s !== 'CANCELLED') assigned++;

      if (['PENDING', 'RECEIVED'].includes(s)) pending++;
      if (['IN_PROCESS', 'DIAGNOSING', 'TESTING', 'WAITING_FOR_PARTS', 'IN_PROGRESS', 'REPAIRING'].includes(s)) inProgress++;
      if (['REPAIRED'].includes(s)) repaired++;
      if (['READY_FOR_PICKUP', 'READY_FOR_DELIVERY'].includes(s)) ready++;
      if (['DELIVERED', 'COMPLETED'].includes(s)) delivered++;
      if (['RE_PROBLEM', 'REPROBLEM'].includes(s)) reproblem++;

      if (r.priority === 'URGENT') urgentCount++;
      if (r.priority === 'HIGH') highCount++;
    });

    return res.json({
      totalRepairs,
      pending,
      assigned,
      inProgress,
      repaired,
      ready,
      delivered,
      reproblem,
      unassigned,
      urgentCount,
      highCount,
      totalRevenue,
    });
  } catch (err: any) {
    console.error('[MANAGER STATS ERROR]', err);
    return res.status(500).json({ error: 'Failed to compute manager stats.' });
  }
});

// 3. GET /api/manager/workload
router.get('/manager/workload', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER']), async (req: AuthRequest, res: Response) => {
  try {
    const { data: staff } = await supabaseAdmin
      .from('User')
      .select('id, name, role, department')
      .in('role', ['TECHNICIAN', 'LEAD_TECHNICIAN', 'HEAD_TECHNICIAN', 'TECHNICAL_ASSISTANT'])
      .is('deletedAt', null);

    const { data: repairs } = await supabaseAdmin
      .from('Repair')
      .select('technicianId, status, priority')
      .not('status', 'in', '("COMPLETED","DELIVERED","CANCELLED")');

    const workloadMap: Record<string, { pendingCount: number; inProgressCount: number; repairedCount: number; readyCount: number; urgentCount: number; totalActive: number }> = {};

    (staff || []).forEach((s: any) => {
      workloadMap[s.id] = {
        pendingCount: 0,
        inProgressCount: 0,
        repairedCount: 0,
        readyCount: 0,
        urgentCount: 0,
        totalActive: 0
      };
    });

    (repairs || []).forEach((r: any) => {
      if (r.technicianId && workloadMap[r.technicianId]) {
        const item = workloadMap[r.technicianId];
        const s = (r.status || '').toUpperCase();
        item.totalActive++;

        if (['PENDING', 'RECEIVED'].includes(s)) item.pendingCount++;
        if (['IN_PROCESS', 'DIAGNOSING', 'TESTING', 'WAITING_FOR_PARTS', 'IN_PROGRESS'].includes(s)) item.inProgressCount++;
        if (s === 'REPAIRED') item.repairedCount++;
        if (s === 'READY_FOR_PICKUP') item.readyCount++;
        if (r.priority === 'URGENT') item.urgentCount++;
      }
    });

    const workload = (staff || []).map((s: any) => ({
      technician: {
        id: s.id,
        name: s.name,
        role: s.role,
        department: s.department
      },
      ...workloadMap[s.id]
    }));

    return res.json(workload);
  } catch (err: any) {
    console.error('[MANAGER WORKLOAD ERROR]', err);
    return res.status(500).json({ error: 'Failed to calculate technician workloads.' });
  }
});

// 4. GET /api/dashboard/stats
router.get('/dashboard/stats', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { data: repairs } = await supabaseAdmin.from('Repair').select('status, priority, totalPaid, advancePaid, estimatedCost');
    const { count: totalCustomers } = await supabaseAdmin.from('Customer').select('*', { count: 'exact', head: true });
    const { count: totalStaff } = await supabaseAdmin.from('User').select('*', { count: 'exact', head: true }).is('deletedAt', null);

    let activeRepairs = 0;
    let completedRepairs = 0;
    let totalRevenue = 0;

    (repairs || []).forEach((r: any) => {
      totalRevenue += Number(r.totalPaid || r.advancePaid || 0);
      if (['COMPLETED', 'DELIVERED'].includes((r.status || '').toUpperCase())) {
        completedRepairs++;
      } else {
        activeRepairs++;
      }
    });

    return res.json({
      activeRepairs,
      completedRepairs,
      totalCustomers: totalCustomers || 0,
      totalStaff: totalStaff || 0,
      totalRevenue,
    });
  } catch (err: any) {
    console.error('[DASHBOARD STATS ERROR]', err);
    return res.status(500).json({ error: 'Failed to retrieve dashboard overview.' });
  }
});

export default router;