import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/rbac';

const router = Router();

const DASHBOARD_ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'MANAGER',
  'LEAD_TECHNICIAN',
  'TECHNICIAN',
  'RECEPTIONIST',
];

const ACTIVE_REPAIR_STATUSES = new Set([
  'PENDING',
  'IN_PROGRESS',
  'ASSIGNED',
  'WAITING_FOR_PARTS',
  'WAITING_FOR_CUSTOMER',
  'UNDER_DIAGNOSIS',
  'REPAIR_IN_PROGRESS',
]);

function normalizeValue(value: unknown): string {
  return String(value || '').toUpperCase().replace(/\s+/g, '_').trim();
}

function scopedRepairsQuery(req: AuthRequest) {
  let query = supabaseAdmin
    .from('Repair')
    .select('id, status, priority, totalPaid, advancePaid, createdAt, technicianId, branchId');

  const role = normalizeValue(req.user?.role);

  if (req.user?.branchId && role !== 'SUPER_ADMIN') {
    query = query.eq('branchId', req.user.branchId);
  }

  if (role === 'TECHNICIAN') {
    query = query.eq('technicianId', req.user.id);
  }

  return query;
}

router.get(
  '/',
  authenticate,
  authorize(DASHBOARD_ROLES),
  async (req: AuthRequest, res) => {
    try {
      const repairsResult = await scopedRepairsQuery(req);
      if (repairsResult.error) {
        throw new Error(`Failed to load repairs: ${repairsResult.error.message}`);
      }

      const repairs = repairsResult.data || [];
      const repairIds = repairs.map((repair) => repair.id);

      const [customersResult, staffResult, paymentsResult] = await Promise.all([
        supabaseAdmin.from('Customer').select('id').eq('archived', false),
        supabaseAdmin.from('User').select('id').is('deletedAt', null).eq('isActive', true),
        repairIds.length
          ? supabaseAdmin.from('Payment').select('amount, createdAt, repairId').in('repairId', repairIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (customersResult.error) throw new Error(`Failed to load customers: ${customersResult.error.message}`);
      if (staffResult.error) throw new Error(`Failed to load staff: ${staffResult.error.message}`);
      if (paymentsResult.error) throw new Error(`Failed to load payments: ${paymentsResult.error.message}`);

      const customers = customersResult.data || [];
      const staff = staffResult.data || [];
      const payments = paymentsResult.data || [];

      const activeRepairs = repairs.filter((repair) => ACTIVE_REPAIR_STATUSES.has(normalizeValue(repair.status))).length;
      const completedRepairs = repairs.filter((repair) => normalizeValue(repair.status) === 'COMPLETED').length;
      const pendingRepairs = repairs.filter((repair) => normalizeValue(repair.status) === 'PENDING').length;
      const urgentRepairs = repairs.filter((repair) => normalizeValue(repair.priority) === 'URGENT').length;
      const totalRevenue = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      const repairCollected = repairs.reduce(
        (sum, repair) => sum + Number(repair.totalPaid ?? repair.advancePaid ?? 0),
        0,
      );

      const now = Date.now();
      const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
      const previousSevenDaysStart = new Date(now - 14 * 24 * 60 * 60 * 1000);
      const recentRevenue = payments
        .filter((payment) => payment.createdAt && new Date(payment.createdAt) >= sevenDaysAgo)
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      const previousRevenue = payments
        .filter((payment) => {
          if (!payment.createdAt) return false;
          const date = new Date(payment.createdAt);
          return date >= previousSevenDaysStart && date < sevenDaysAgo;
        })
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

      const revenueGrowth = previousRevenue === 0
        ? (recentRevenue > 0 ? 100 : 0)
        : ((recentRevenue - previousRevenue) / previousRevenue) * 100;

      return res.json({
        success: true,
        data: {
          activeRepairs,
          completedRepairs,
          pendingRepairs,
          urgentRepairs,
          totalCustomers: customers.length,
          totalStaff: staff.length,
          totalRevenue,
          repairCollected,
          recentRevenue,
          previousRevenue,
          revenueGrowth: Number(revenueGrowth.toFixed(2)),
          generatedAt: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      console.error('[DASHBOARD STATS ERROR]', error);
      return res.status(500).json({
        success: false,
        message: 'Unable to load dashboard statistics.',
      });
    }
  },
);

export default router;
