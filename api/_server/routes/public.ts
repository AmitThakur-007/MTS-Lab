import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/rbac';

const router = Router();

// 1. GET & POST /api/public/track (or /api/track) - Resilient Public Tracking
const handlePublicTrack = async (req: Request, res: Response) => {
  try {
    const rawRepairNumber = req.body?.repairNumber || req.query?.repairNumber || req.body?.ticketNumber || req.query?.ticketNumber || '';
    const rawPhone = req.body?.phone || req.query?.phone || req.body?.customerPhone || req.query?.customerPhone || '';

    // Strip leading '#', trim whitespace, and clean digits
    const cleanRepairNumber = String(rawRepairNumber).trim().replace(/^#+/, '').trim();
    const cleanPhone = String(rawPhone).trim().replace(/\D/g, '');

    if (!cleanRepairNumber && !cleanPhone) {
      return res.status(400).json({ error: 'Please enter a Repair Job Number or Registered Phone Number.' });
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
      status,
      priority,
      expectedCompletionDate,
      estimatedCost,
      advancePaid,
      totalPaid,
      paymentStatus,
      isCourierIn,
      isCourierOut,
      courierStatus,
      courierCompany,
      returnCourierCompany,
      returnCourierTrackingNumber,
      hasBatteryWarranty,
      batteryWarrantyPeriod,
      batteryType,
      createdAt,
      updatedAt,
      completedAt,
      deliveredAt
    `;

    let repairRecord: any = null;

    // 1. Find by repairNumber if supplied
    if (cleanRepairNumber) {
      const { data } = await supabaseAdmin
        .from('Repair')
        .select(selectFields)
        .or(`repairNumber.eq.${cleanRepairNumber},repairNumber.ilike.%${cleanRepairNumber}%`)
        .order('createdAt', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        repairRecord = data;
      }
    }

    // 2. If not found by repair number, find by phone number (on Repair or linked Customer)
    if (!repairRecord && cleanPhone) {
      // Check direct phone on Repair table
      const { data: directMatch } = await supabaseAdmin
        .from('Repair')
        .select(selectFields)
        .ilike('customerPhone', `%${cleanPhone}%`)
        .order('createdAt', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (directMatch) {
        repairRecord = directMatch;
      } else {
        // Check linked Customer profile
        const { data: customerData } = await supabaseAdmin
          .from('Customer')
          .select('id')
          .ilike('phone', `%${cleanPhone}%`)
          .limit(1)
          .maybeSingle();

        if (customerData) {
          const { data: customerRepair } = await supabaseAdmin
            .from('Repair')
            .select(selectFields)
            .eq('customerId', customerData.id)
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

    // ROBUST BULLETPROOF FALLBACK: Query RepairLog, and if empty, synthesize a base log using the repair's status and creation date
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
          notes: `Device checked in and status currently registered as ${repairRecord.status || 'RECEIVED'}.`,
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

    // Mask sensitive name and phone for privacy in public portal
    const sanitizedName = repairRecord.customerName
      ? `${repairRecord.customerName.charAt(0)}*** ${repairRecord.customerName.split(' ').slice(-1)[0] || ''}`.trim()
      : 'Customer';

    const sanitizedRecord = {
      ...repairRecord,
      customerName: sanitizedName,
      customerPhone: cleanPhone ? `${cleanPhone.slice(0, 3)}****${cleanPhone.slice(-3)}` : undefined,
    };

    return res.json({
      success: true,
      repair: sanitizedRecord,
      ...sanitizedRecord
    });
  } catch (err: any) {
    console.error('[PUBLIC TRACK EXCEPTION]', err);
    return res.status(500).json({ error: 'Failed to retrieve tracking details.' });
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