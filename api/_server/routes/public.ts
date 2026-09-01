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

    if (!cleanRepairNumber && !cleanPhone) {
      return res.status(400).json({ error: 'Please enter your Repair Number or Registered Phone Number.' });
    }

    const selectFields = `
      id,
      repairNumber,
      customerId,
      customerName,
      customerPhone,
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
      batteryWarrantyExpiry,
      remarks,
      createdAt,
      updatedAt,
      completedAt,
      deliveredAt
    `;

    let repairRecord: any = null;

    // Case 1: Customer provided BOTH Repair Number AND Phone Number
    // PREVENT IDOR: Both must match the same repair/customer.
    if (cleanRepairNumber && cleanPhone) {
      const { data: candidates, error: cErr } = await supabaseAdmin
        .from('Repair')
        .select(selectFields)
        .or(`repairNumber.eq.${cleanRepairNumber},repairNumber.ilike.%${cleanRepairNumber}%`)
        .order('createdAt', { ascending: false })
        .limit(5);

      if (cErr) {
        console.error('[PUBLIC TRACK CANDIDATE ERROR]', cErr);
      }

      if (candidates && candidates.length > 0) {
        // Verify phone against candidate repair records
        for (const cand of candidates) {
          if (isPhoneMatching(cleanPhone, cand.customerPhone)) {
            repairRecord = cand;
            break;
          }
          // If direct phone didn't match, check linked Customer profile
          if (cand.customerId) {
            const { data: linkedCustomer } = await supabaseAdmin
              .from('Customer')
              .select('phone, alternativePhone')
              .eq('id', cand.customerId)
              .maybeSingle();

            if (
              linkedCustomer &&
              (isPhoneMatching(cleanPhone, linkedCustomer.phone) || isPhoneMatching(cleanPhone, linkedCustomer.alternativePhone))
            ) {
              repairRecord = cand;
              break;
            }
          }
        }
      }

      if (!repairRecord) {
        // IDOR Prevention: If repair exists with wrong phone, or phone exists with wrong repair number, return 404
        return res.status(404).json({
          error: 'No repair records found matching the provided Repair Number and Phone Number.'
        });
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
        repairRecord = singleRepair;
      }
    }
    // Case 3: Customer provided ONLY Phone Number
    else if (cleanPhone) {
      const { data: directMatches } = await supabaseAdmin
        .from('Repair')
        .select(selectFields)
        .order('createdAt', { ascending: false })
        .limit(20);

      if (directMatches && directMatches.length > 0) {
        // Filter in-memory using robust phone normalizer
        const matched = directMatches.filter((r) => isPhoneMatching(cleanPhone, r.customerPhone));
        if (matched.length > 0) {
          repairRecord = matched[0];
        }
      }

      if (!repairRecord) {
        // Check linked Customer profile
        const { data: customers } = await supabaseAdmin
          .from('Customer')
          .select('id, phone, alternativePhone')
          .limit(50);

        const matchedCustomer = customers?.find(
          (c) => isPhoneMatching(cleanPhone, c.phone) || isPhoneMatching(cleanPhone, c.alternativePhone)
        );

        if (matchedCustomer) {
          const { data: customerRepair } = await supabaseAdmin
            .from('Repair')
            .select(selectFields)
            .eq('customerId', matchedCustomer.id)
            .order('createdAt', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (customerRepair) {
            repairRecord = customerRepair;
          }
        }
      }
    }

    if (!repairRecord) {
      return res.status(404).json({ error: 'No repair records found matching your tracking information.' });
    }

    // Query RepairLog to display public diagnostic trace
    const { data: explicitLogs } = await supabaseAdmin
      .from('RepairLog')
      .select('id, action, status, notes, message, createdAt')
      .eq('repairId', repairRecord.id)
      .order('createdAt', { ascending: false });

    let combinedLogs = explicitLogs || [];
    if (combinedLogs.length === 0) {
      combinedLogs = [
        {
          id: `synth-${repairRecord.id}`,
          action: 'STATUS_UPDATED',
          status: repairRecord.status || 'RECEIVED',
          notes: `Device registered and currently recorded as ${repairRecord.status || 'RECEIVED'}.`,
          message: `Device status: ${repairRecord.status || 'RECEIVED'}`,
          createdAt: repairRecord.createdAt || new Date().toISOString()
        }
      ];
    }

    repairRecord.logs = combinedLogs;

    // Ensure logs are sorted newest first
    if (repairRecord.logs && Array.isArray(repairRecord.logs)) {
      repairRecord.logs.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    // Mask customer name and phone for public privacy
    const rawName = repairRecord.customerName || '';
    const sanitizedName = rawName
      ? `${rawName.charAt(0)}*** ${rawName.split(' ').slice(-1)[0] || ''}`.trim()
      : 'Valued Customer';

    const pDigits = normalizePhoneDigits(repairRecord.customerPhone || cleanPhone);
    const sanitizedPhone = pDigits && pDigits.length >= 6
      ? `${pDigits.slice(0, 3)}****${pDigits.slice(-3)}`
      : undefined;

    const sanitizedRecord = {
      ...repairRecord,
      customerName: sanitizedName,
      customerPhone: sanitizedPhone,
    };

    return res.json({
      success: true,
      repair: sanitizedRecord,
      ...sanitizedRecord
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