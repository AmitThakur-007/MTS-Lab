import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/rbac';

const router = Router();

// 1. GET /api/track (Public Live Repair Tracking)
router.get('/track', async (req: Request, res: Response) => {
  try {
    const { repairNumber, phone } = req.query;

    if (!repairNumber && !phone) {
      return res.status(400).json({ error: 'Please provide a repair ticket number or registered phone number.' });
    }

    let query = supabaseAdmin
      .from('Repair')
      .select('repairNumber, customerName, deviceBrand, deviceModel, problemDescription, status, priority, expectedCompletionDate, estimatedCost, advancePaid, totalPaid, paymentStatus, isCourierIn, isCourierOut, courierStatus, courierCompany, returnCourierCompany, returnCourierTrackingNumber, createdAt, updatedAt, logs:RepairLog(action, status, notes, createdAt)');

    if (repairNumber) {
      query = query.eq('repairNumber', String(repairNumber).trim());
    } else if (phone) {
      query = query.eq('customerPhone', String(phone).trim());
    }

    const { data: repairs, error } = await query.order('createdAt', { ascending: false }).limit(5);

    if (error || !repairs || repairs.length === 0) {
      return res.status(404).json({ error: 'No repair records found matching your tracking information.' });
    }

    // Mask sensitive phone & customer address for public lookup
    const sanitized = repairs.map((r: any) => ({
      ...r,
      customerName: r.customerName ? `${r.customerName.charAt(0)}*** ${r.customerName.split(' ').slice(-1)[0] || ''}` : 'Customer',
    }));

    return res.json(sanitized.length === 1 ? sanitized[0] : sanitized);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve tracking details.' });
  }
});

// 2. GET /api/manager/stats
router.get('/manager/stats', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER']), async (req: AuthRequest, res: Response) => {
  try {
    const { data: repairs } = await supabaseAdmin.from('Repair').select('status, priority, estimatedCost, advancePaid, totalPaid');

    let totalRepairs = 0;
    let pendingRepairs = 0;
    let inProgressRepairs = 0;
    let completedRepairs = 0;
    let urgentRepairs = 0;
    let totalRevenue = 0;

    (repairs || []).forEach((r: any) => {
      totalRepairs++;
      totalRevenue += Number(r.totalPaid || r.advancePaid || 0);

      if (r.priority === 'URGENT') urgentRepairs++;
      if (['RECEIVED', 'DIAGNOSING', 'PENDING_PARTS'].includes(r.status)) pendingRepairs++;
      if (['IN_PROGRESS', 'REPAIRING'].includes(r.status)) inProgressRepairs++;
      if (['COMPLETED', 'DELIVERED', 'READY_FOR_DELIVERY'].includes(r.status)) completedRepairs++;
    });

    return res.json({
      totalRepairs,
      pendingRepairs,
      inProgressRepairs,
      completedRepairs,
      urgentRepairs,
      totalRevenue,
    });
  } catch (err: any) {
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
      .select('technicianId, status')
      .not('status', 'in', '("COMPLETED","DELIVERED","CANCELLED")');

    const workloadMap: Record<string, number> = {};
    (repairs || []).forEach((r: any) => {
      if (r.technicianId) {
        workloadMap[r.technicianId] = (workloadMap[r.technicianId] || 0) + 1;
      }
    });

    const workload = (staff || []).map((s: any) => ({
      technicianId: s.id,
      name: s.name,
      role: s.role,
      department: s.department,
      activeRepairs: workloadMap[s.id] || 0,
    }));

    return res.json(workload);
  } catch (err: any) {
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
      if (['COMPLETED', 'DELIVERED'].includes(r.status)) {
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
    return res.status(500).json({ error: 'Failed to retrieve dashboard overview.' });
  }
});

export default router;
