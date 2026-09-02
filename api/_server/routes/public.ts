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

    // Query RepairLog for primary repair to display customer-facing diagnostic trace (without timestamps or staff identity)
    const { data: explicitLogs } = await supabaseAdmin
      .from('RepairLog')
      .select('id, status, message')
      .eq('repairId', primaryRepair.id)
      .order('createdAt', { ascending: false });

    const getCustomerLogDesc = (status?: string, message?: string) => {
      const st = (status || primaryRepair.status || 'RECEIVED').toUpperCase();
      if (st.includes('RECEIVED') || st.includes('CREATED')) {
        return 'Device safely cataloged and checked into MTS Lab inventory.';
      }
      if (st.includes('DIAGNOSING')) {
        return 'Hardware inspection and diagnostic testing in progress.';
      }
      if (st.includes('PROCESS') || st.includes('REPAIR') || st.includes('RESTORATION')) {
        return 'Active hardware restoration and component replacement under way.';
      }
      if (st.includes('TEST') || st.includes('QA')) {
        return 'Performing comprehensive quality inspection and calibration.';
      }
      if (st.includes('READY') || st.includes('PICKUP') || st.includes('DELIVERY')) {
        return 'Device sanitized, packaged, and ready for collection.';
      }
      if (st.includes('COURIER') || st.includes('DISPATCH')) {
        return 'Device safely packaged and dispatched via courier logistics.';
      }
      if (st.includes('DELIVERED') || st.includes('COMPLETED')) {
        return 'Device handed over to customer with service warranty.';
      }
      if (st.includes('RE_PROBLEM') || st.includes('REPROBLEM')) {
        return 'Device scheduled for priority diagnostic re-evaluation.';
      }
      if (st.includes('CANCEL')) {
        return 'Repair service request closed.';
      }
      return 'Device status updated in laboratory queue.';
    };

    let combinedLogs = (explicitLogs || []).map((l: any) => {
      const desc = getCustomerLogDesc(l.status, l.message);
      return {
        id: l.id,
        action: 'STATUS_UPDATED',
        status: l.status || primaryRepair.status || 'RECEIVED',
        notes: desc,
        message: desc,
      };
    });

    if (combinedLogs.length === 0) {
      const desc = getCustomerLogDesc(primaryRepair.status);
      combinedLogs = [
        {
          id: `synth-${primaryRepair.id}`,
          action: 'STATUS_UPDATED',
          status: primaryRepair.status || 'RECEIVED',
          notes: desc,
          message: desc,
        }
      ];
    }

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
      };
    };

    const sanitizedPrimary = {
      ...sanitizePublicRepairObj(primaryRepair),
      logs: combinedLogs,
    };

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