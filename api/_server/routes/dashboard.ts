import { Router, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { normalizeRole } from '../middleware/rbac';
import {
  getNepalBusinessTime,
  getAllAttendanceRecords,
  getAuthorizedStaffList,
  AttendanceRecord
} from '../services/attendanceStorage';
import { computeRepairDashboardStats } from '../services/repairStatsService';

const router = Router();

/**
 * Calculates authoritative Nepal (NPT / UTC+05:45) calendar dates & 7-day sliding window.
 */
function getNepalDates() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kathmandu',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const y = parts.find((p) => p.type === 'year')?.value || '2026';
  const m = parts.find((p) => p.type === 'month')?.value || '01';
  const d = parts.find((p) => p.type === 'day')?.value || '01';
  const todayStr = `${y}-${m}-${d}`;
  const monthStr = `${y}-${m}`;

  // Past 7 calendar days in NPT
  const past7Days: { dateStr: string; dayLabel: string; shortDate: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const pastDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const pParts = formatter.formatToParts(pastDate);
    const py = pParts.find((p) => p.type === 'year')?.value || '2026';
    const pm = pParts.find((p) => p.type === 'month')?.value || '01';
    const pd = pParts.find((p) => p.type === 'day')?.value || '01';
    const pStr = `${py}-${pm}-${pd}`;
    const dayName = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kathmandu', weekday: 'short' }).format(pastDate);
    const shortDate = `${pm}/${pd}`;
    past7Days.push({ dateStr: pStr, dayLabel: dayName, shortDate, count: 0 });
  }

  // Yesterday string in NPT
  const yDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yParts = formatter.formatToParts(yDate);
  const yy = yParts.find((p) => p.type === 'year')?.value || '2026';
  const ym = yParts.find((p) => p.type === 'month')?.value || '01';
  const yd = yParts.find((p) => p.type === 'day')?.value || '01';
  const yesterdayStr = `${yy}-${ym}-${yd}`;

  return { todayStr, yesterdayStr, monthStr, past7Days, now };
}

/**
 * Format any ISO date to Nepal YYYY-MM-DD string.
 */
function toNepalDateString(isoDateString?: string | null): string {
  if (!isoDateString) return '';
  try {
    const d = new Date(isoDateString);
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kathmandu',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch {
    return '';
  }
}

// ============================================================================
// 1. GET /api/dashboard/overview — Comprehensive Role-Based Real Data Hub
// ============================================================================
router.get('/overview', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const currentUser = req.user;
    if (!currentUser) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const role = normalizeRole(currentUser.role || 'RECEPTIONIST');
    const { todayStr, yesterdayStr, monthStr, past7Days } = getNepalDates();
    const serverTimeInfo = getNepalBusinessTime();

    // Execute all independent database queries in parallel for high-performance dashboard loading
    const [
      repairsResult,
      customersResult,
      authorizedStaff,
      todayAttendanceList,
      monthAttendanceList,
      inventoryResult,
      totalWarrantiesResult,
      activeWarrantiesResult,
      transferRequestsResult,
      accessReqsResult,
      damageRecordsResult,
      unreadNotificationsResult,
    ] = await Promise.all([
      supabaseAdmin
        .from('Repair')
        .select(`
          id,
          repairNumber,
          customerId,
          customerName,
          customerPhone,
          customerEmail,
          deviceBrand,
          deviceModel,
          status,
          priority,
          estimatedCost,
          advancePaid,
          totalPaid,
          technicianId,
          isCourierIn,
          courierInStatus,
          isCourierOut,
          courierOutStatus,
          createdAt,
          updatedAt,
          courierOutDeliveredDate
        `)
        .order('createdAt', { ascending: false }),

      supabaseAdmin
        .from('Customer')
        .select('*', { count: 'exact', head: true })
        .eq('archived', false),

      getAuthorizedStaffList(),
      getAllAttendanceRecords({ date: todayStr }),
      getAllAttendanceRecords({ month: monthStr }),

      supabaseAdmin
        .from('InventoryItem')
        .select('id, name, brand, model, category, currentStock, minStockLevel, unit, status')
        .eq('status', 'ACTIVE')
        .limit(200),

      supabaseAdmin
        .from('BatteryWarranty')
        .select('*', { count: 'exact', head: true }),

      supabaseAdmin
        .from('BatteryWarranty')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'ACTIVE'),

      supabaseAdmin
        .from('RepairTransferRequest')
        .select('*')
        .order('createdAt', { ascending: false })
        .limit(20),

      (role === 'SUPER_ADMIN' || role === 'ADMIN')
        ? supabaseAdmin
            .from('AccessRequest')
            .select('*')
            .eq('status', 'PENDING')
            .order('createdAt', { ascending: false })
            .limit(20)
        : Promise.resolve({ data: [] as any[] }),

      supabaseAdmin
        .from('RepairRelatedDamage')
        .select('id, recordNumber, staffId, staffName, staffRole, repairNumber, damagedComponent, damageDate, estimatedCost, status')
        .eq('isArchived', false)
        .limit(100),

      supabaseAdmin
        .from('Notification')
        .select('*', { count: 'exact', head: true })
        .eq('userId', currentUser.id)
        .eq('isRead', false),
    ]);

    if (repairsResult?.error) {
      console.error('[OVERVIEW REPAIRS QUERY ERROR]', repairsResult.error);
    }

    const allRepairs = Array.isArray(repairsResult?.data) ? repairsResult.data : [];
    const totalCustomersCount = customersResult?.count ?? 0;

    // Process Attendance Map
    const attendanceMap = new Map<string, AttendanceRecord>();
    todayAttendanceList.forEach((r) => attendanceMap.set(r.userId, r));

    let staffPresentToday = 0;
    let staffLateToday = 0;
    let staffAbsentToday = 0;
    let staffNotMarkedToday = 0;
    let pendingAttendanceRequestsCount = 0;

    authorizedStaff.forEach((s) => {
      const rec = attendanceMap.get(s.id);
      if (!rec || rec.status === 'PENDING') {
        staffNotMarkedToday++;
      } else if (rec.status === 'PRESENT') {
        staffPresentToday++;
      } else if (rec.status === 'LATE' || rec.status === 'HALF_DAY') {
        staffLateToday++;
      } else if (rec.status === 'ABSENT') {
        staffAbsentToday++;
      }

      if (rec && rec.requestStatus === 'PENDING') {
        pendingAttendanceRequestsCount++;
      }
    });

    // Process Inventory Items
    const allInventory = Array.isArray(inventoryResult?.data) ? inventoryResult.data : [];
    const lowStockItems = allInventory.filter(
      (item) => (item.currentStock ?? 0) <= (item.minStockLevel ?? 5) && (item.currentStock ?? 0) > 0
    );
    const outOfStockItems = allInventory.filter((item) => (item.currentStock ?? 0) <= 0);

    const totalWarrantiesCount = totalWarrantiesResult?.count ?? 0;
    const activeWarrantiesCount = activeWarrantiesResult?.count ?? 0;

    const allTransfers = Array.isArray(transferRequestsResult?.data) ? transferRequestsResult.data : [];
    const pendingTransfers = allTransfers.filter((t) => t.status === 'PENDING');

    const pendingAccessRequests = Array.isArray(accessReqsResult?.data) ? accessReqsResult.data : [];

    const allDamages = Array.isArray(damageRecordsResult?.data) ? damageRecordsResult.data : [];
    const todayDamages = allDamages.filter((d) => d.damageDate === todayStr);
    const thisMonthDamages = allDamages.filter((d) => (d.damageDate || '').startsWith(monthStr));
    const totalDamageCost = allDamages.reduce((sum, d) => sum + (Number(d.estimatedCost) || 0), 0);

    const unreadNotificationsCount = unreadNotificationsResult?.count ?? 0;

    // ========================================================================
    // PROCESS REPAIRS METRICS & AGGREGATIONS
    // ========================================================================
    let totalRepairs = 0;
    let activeRepairs = 0;
    let completedRepairs = 0;
    let pendingRepairs = 0;
    let inProgressRepairs = 0;
    let repairedRepairs = 0;
    let readyForPickupRepairs = 0;
    let deliveredRepairs = 0;
    let reProblemRepairs = 0;
    let cannotRepairCount = 0;
    let cancelledCount = 0;
    let unassignedRepairs = 0;
    let urgentPriorityCount = 0;
    let highPriorityCount = 0;

    let todayNewRepairs = 0;
    let todayCompletedRepairs = 0;
    let todayDeliveredRepairs = 0;
    let todayPendingRepairs = 0;

    let totalRevenue = 0;
    let todayRevenue = 0;
    let weekRevenue = 0;
    let monthRevenue = 0;
    let pendingReceivables = 0;

    let courierInCount = 0;
    let courierOutCount = 0;
    let courierPendingCount = 0;

    // 7-day trend map
    const trendMap = new Map<string, number>();
    past7Days.forEach((d) => trendMap.set(d.dateStr, 0));

    // Brand frequency map
    const brandMap = new Map<string, number>();

    // Status breakdown map
    const statusMap: Record<string, number> = {
      PENDING: 0,
      RECEIVED: 0,
      DIAGNOSING: 0,
      IN_PROCESS: 0,
      WAITING_FOR_PARTS: 0,
      TESTING: 0,
      REPAIRED: 0,
      READY_FOR_PICKUP: 0,
      DELIVERED: 0,
      RE_PROBLEM: 0,
      CANNOT_REPAIR: 0,
      CANCELLED: 0,
    };

    // Technician Workload tracking
    const technicianWorkloadMap = new Map<
      string,
      {
        id: string;
        name: string;
        role: string;
        department: string;
        activeCount: number;
        inProgressCount: number;
        pendingCount: number;
        urgentCount: number;
        completedToday: number;
      }
    >();

    authorizedStaff
      .filter((s) =>
        ['TECHNICIAN', 'HEAD_TECHNICIAN', 'LEAD_TECHNICIAN', 'TECHNICAL_ASSISTANT'].includes(s.role)
      )
      .forEach((tech) => {
        technicianWorkloadMap.set(tech.id, {
          id: tech.id,
          name: tech.name,
          role: tech.role,
          department: tech.department || 'Hardware Lab',
          activeCount: 0,
          inProgressCount: 0,
          pendingCount: 0,
          urgentCount: 0,
          completedToday: 0,
        });
      });

    allRepairs.forEach((repair) => {
      totalRepairs++;
      const s = (repair.status || 'PENDING').toUpperCase();
      const p = (repair.priority || 'NORMAL').toUpperCase();
      const createdNepalDate = toNepalDateString(repair.createdAt);
      const isRepairedOrDelivered = ['REPAIRED', 'COMPLETED', 'DELIVERED', 'READY_FOR_PICKUP'].includes(s);
      const completedNepalDate = toNepalDateString(isRepairedOrDelivered ? repair.updatedAt : null);
      const deliveredNepalDate = toNepalDateString(repair.courierOutDeliveredDate || (s === 'DELIVERED' ? repair.updatedAt : null));

      // Financials
      const paid = Number(repair.totalPaid || repair.advancePaid || 0);
      const estimated = Number(repair.estimatedCost || 0);
      totalRevenue += paid;

      const isCompleted = ['COMPLETED', 'DELIVERED'].includes(s);
      const isActive = !['COMPLETED', 'DELIVERED', 'CANCELLED', 'CANNOT_REPAIR'].includes(s);

      if (isActive) {
        activeRepairs++;
        if (!repair.technicianId) unassignedRepairs++;
        if (p === 'URGENT') urgentPriorityCount++;
        if (p === 'HIGH') highPriorityCount++;

        // Pending balance
        if (paid < estimated) {
          pendingReceivables += (estimated - paid);
        }
      }

      if (isCompleted) {
        completedRepairs++;
      }

      // Status Categories
      if (['PENDING', 'RECEIVED'].includes(s)) pendingRepairs++;
      if (['IN_PROCESS', 'DIAGNOSING', 'TESTING', 'WAITING_FOR_PARTS', 'IN_PROGRESS', 'REPAIRING'].includes(s)) {
        inProgressRepairs++;
      }
      if (['REPAIRED', 'REPROBLEM_FIXED'].includes(s)) repairedRepairs++;
      if (['READY_FOR_PICKUP', 'READY', 'READY_FOR_DELIVERY'].includes(s)) readyForPickupRepairs++;
      if (['DELIVERED', 'COMPLETED'].includes(s)) deliveredRepairs++;
      if (['RE_PROBLEM', 'REPROBLEM'].includes(s)) reProblemRepairs++;
      if (s === 'CANNOT_REPAIR') cannotRepairCount++;
      if (s === 'CANCELLED') cancelledCount++;

      // Status Map
      if (statusMap[s] !== undefined) {
        statusMap[s]++;
      } else if (s === 'REPROBLEM') {
        statusMap['RE_PROBLEM']++;
      }

      // Today's Operations
      if (createdNepalDate === todayStr) {
        todayNewRepairs++;
        todayRevenue += paid;
      }
      if (createdNepalDate && createdNepalDate.startsWith(monthStr)) {
        monthRevenue += paid;
      }
      if (completedNepalDate === todayStr || (s === 'REPAIRED' && toNepalDateString(repair.updatedAt) === todayStr)) {
        todayCompletedRepairs++;
      }
      if (deliveredNepalDate === todayStr || (s === 'DELIVERED' && toNepalDateString(repair.updatedAt) === todayStr)) {
        todayDeliveredRepairs++;
      }
      if (['PENDING', 'RECEIVED'].includes(s) && createdNepalDate === todayStr) {
        todayPendingRepairs++;
      }

      // 7-day intake chart
      if (createdNepalDate && trendMap.has(createdNepalDate)) {
        trendMap.set(createdNepalDate, (trendMap.get(createdNepalDate) || 0) + 1);
        if (createdNepalDate >= past7Days[0].dateStr) {
          weekRevenue += paid;
        }
      }

      // Brand frequency
      const b = (repair.deviceBrand || 'Other').trim();
      if (b) {
        brandMap.set(b, (brandMap.get(b) || 0) + 1);
      }

      // Couriers
      if (repair.isCourierIn) {
        courierInCount++;
        if (['COURIER_REQUESTED', 'PICKUP_SCHEDULED', 'IN_TRANSIT'].includes(repair.courierInStatus)) {
          courierPendingCount++;
        }
      }
      if (repair.isCourierOut) {
        courierOutCount++;
        if (['READY_FOR_DISPATCH', 'COURIER_BOOKED', 'IN_TRANSIT'].includes(repair.courierOutStatus)) {
          courierPendingCount++;
        }
      }

      // Technician Workload
      if (repair.technicianId && technicianWorkloadMap.has(repair.technicianId)) {
        const item = technicianWorkloadMap.get(repair.technicianId)!;
        if (isActive) {
          item.activeCount++;
          if (['IN_PROCESS', 'DIAGNOSING', 'TESTING', 'WAITING_FOR_PARTS'].includes(s)) {
            item.inProgressCount++;
          }
          if (['PENDING', 'RECEIVED'].includes(s)) {
            item.pendingCount++;
          }
          if (p === 'URGENT') {
            item.urgentCount++;
          }
        }
        if (completedNepalDate === todayStr) {
          item.completedToday++;
        }
      }
    });

    // Populate chart trends
    const chartIntakeData = past7Days.map((d) => ({
      date: d.dateStr,
      day: d.dayLabel,
      shortDate: d.shortDate,
      count: trendMap.get(d.dateStr) || 0,
    }));

    // Populate top brands
    const topBrands = Array.from(brandMap.entries())
      .map(([brand, count]) => ({ brand, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    // Urgent Repairs Priority Queue (Active repairs with URGENT or HIGH priority)
    const urgentQueue = allRepairs
      .filter((r) => {
        const s = (r.status || '').toUpperCase();
        const p = (r.priority || '').toUpperCase();
        return !['COMPLETED', 'DELIVERED', 'CANCELLED'].includes(s) && (p === 'URGENT' || p === 'HIGH');
      })
      .slice(0, 8);

    // Unassigned Repairs Queue
    const unassignedQueue = allRepairs
      .filter((r) => {
        const s = (r.status || '').toUpperCase();
        return !r.technicianId && !['COMPLETED', 'DELIVERED', 'CANCELLED'].includes(s);
      })
      .slice(0, 8);

    // Ready for Pickup Queue (for Receptionist & Admin)
    const readyForPickupQueue = allRepairs
      .filter((r) => ['READY_FOR_PICKUP', 'READY_FOR_DELIVERY'].includes((r.status || '').toUpperCase()))
      .slice(0, 8);

    // Recent Repairs list
    const recentRepairs = allRepairs.slice(0, 8);

    // Technician Workload List
    const technicianWorkloadList = Array.from(technicianWorkloadMap.values());

    // ========================================================================
    // PERSONAL METRICS FOR TECHNICIAN ROLE
    // ========================================================================
    const myRepairs = allRepairs.filter((r) =>
      r.technicianId === currentUser.id &&
      !['CANCELLED', 'CANNOT_REPAIR'].includes((r.status || '').toUpperCase())
    );
    const myActiveRepairs = myRepairs.filter((r) =>
      !['COMPLETED', 'DELIVERED'].includes((r.status || '').toUpperCase())
    );
    const myInProgress = myActiveRepairs.filter((r) =>
      ['IN_PROCESS', 'DIAGNOSING', 'TESTING', 'WAITING_FOR_PARTS', 'IN_PROGRESS'].includes((r.status || '').toUpperCase())
    );
    const myWaitingParts = myActiveRepairs.filter((r) => (r.status || '').toUpperCase() === 'WAITING_FOR_PARTS');
    const myCompletedToday = myRepairs.filter((r) => {
      const s = (r.status || '').toUpperCase();
      const compDate = toNepalDateString(r.updatedAt);
      return ['REPAIRED', 'COMPLETED', 'DELIVERED', 'READY_FOR_PICKUP'].includes(s) && compDate === todayStr;
    });
    const myUrgentRepairs = myActiveRepairs.filter((r) => (r.priority || '').toUpperCase() === 'URGENT');
    const myHighRepairs = myActiveRepairs.filter((r) => (r.priority || '').toUpperCase() === 'HIGH');
    const myReProblemRepairs = myActiveRepairs.filter((r) => ['RE_PROBLEM', 'REPROBLEM'].includes((r.status || '').toUpperCase()));

    const myIncomingTransfers = allTransfers.filter(
      (t) => t.targetTechnicianId === currentUser.id && t.status === 'PENDING'
    );
    const myOutgoingTransfers = allTransfers.filter(
      (t) => t.senderTechnicianId === currentUser.id && t.status === 'PENDING'
    );

    const myTodayAttendance = attendanceMap.get(currentUser.id) || null;
    const myMonthRecords = monthAttendanceList.filter((r) => r.userId === currentUser.id);
    const myPresentCount = myMonthRecords.filter((r) => ['PRESENT', 'LATE', 'HALF_DAY'].includes(r.status)).length;
    const myAttendanceRate = myMonthRecords.length > 0 ? Math.round((myPresentCount / myMonthRecords.length) * 100) : 100;

    // ========================================================================
    // CUSTOMER PORTAL OVERVIEW (For CUSTOMER Role)
    // ========================================================================
    let customerRepairs: any[] = [];
    if (role === 'CUSTOMER') {
      customerRepairs = allRepairs.filter(
        (r) =>
          r.customerId === currentUser.id ||
          (currentUser.phoneNumber && r.customerPhone && r.customerPhone.includes(currentUser.phoneNumber)) ||
          (currentUser.email && r.customerEmail && r.customerEmail.toLowerCase() === currentUser.email.toLowerCase())
      );
    }

    // ========================================================================
    // STRUCTURE AUTHORITATIVE RESPONSE
    // ========================================================================
    const overviewPayload = {
      role,
      user: {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        role: currentUser.role,
        department: currentUser.department || 'MTS Lab Nepal',
      },
      serverTime: {
        ...serverTimeInfo,
        serverDateNPT: todayStr,
      },
      systemSummary: {
        totalRepairs,
        totalRecords: totalRepairs,
        activeRepairs,
        completedRepairs,
        pendingRepairs,
        inProgressRepairs,
        repairedRepairs,
        readyForPickupRepairs,
        ready: readyForPickupRepairs,
        deliveredRepairs,
        reProblemRepairs,
        cannotRepairCount,
        cancelledCount,
        unassignedRepairs,
        assignedRepairs: Math.max(0, activeRepairs - unassignedRepairs),
        urgentPriorityCount,
        highPriorityCount,
        totalCustomers: totalCustomersCount || 0,
        totalStaff: authorizedStaff.length,
        totalTechnicians: technicianWorkloadList.length,
        totalBranches: 1,
      },
      todayOperations: {
        todayNewRepairs,
        todayCompletedRepairs,
        todayDeliveredRepairs,
        todayPendingRepairs,
        todayRevenue,
        weekRevenue,
        monthRevenue,
        totalRevenue,
        pendingReceivables,
      },
      staffAttendance: {
        totalStaff: authorizedStaff.length,
        presentToday: staffPresentToday,
        lateToday: staffLateToday,
        absentToday: staffAbsentToday,
        notMarkedToday: staffNotMarkedToday,
        pendingRequestsCount: pendingAttendanceRequestsCount,
      },
      inventorySummary: {
        totalItems: allInventory.length,
        lowStockCount: lowStockItems.length,
        outOfStockCount: outOfStockItems.length,
        lowStockItems: lowStockItems.slice(0, 6),
      },
      warrantySummary: {
        totalWarranties: totalWarrantiesCount || 0,
        activeWarrantiesCount: activeWarrantiesCount || 0,
      },
      courierSummary: {
        courierInCount,
        courierOutCount,
        courierPendingCount,
      },
      damageSummary: {
        todayDamagesCount: todayDamages.length,
        thisMonthDamagesCount: thisMonthDamages.length,
        totalDamageCost,
      },
      alerts: {
        urgentRepairsCount: urgentPriorityCount,
        highPriorityCount,
        lowStockCount: lowStockItems.length,
        unassignedRepairsCount: unassignedRepairs,
        pendingTransfersCount: pendingTransfers.length,
        pendingAccessRequestsCount: pendingAccessRequests.length,
        unreadNotificationsCount: unreadNotificationsCount || 0,
      },
      technicianCockpit: {
        assignedToMeTotal: myActiveRepairs.length,
        myInProgressCount: myInProgress.length,
        myWaitingPartsCount: myWaitingParts.length,
        myCompletedTodayCount: myCompletedToday.length,
        myUrgentCount: myUrgentRepairs.length,
        myHighCount: myHighRepairs.length,
        myReProblemCount: myReProblemRepairs.length,
        myActiveRepairs: myActiveRepairs.slice(0, 10),
        incomingTransfers: myIncomingTransfers,
        outgoingTransfers: myOutgoingTransfers,
        todayAttendance: myTodayAttendance,
        attendanceRate: myAttendanceRate,
      },
      charts: {
        intakeTrends: chartIntakeData,
        topBrands,
        statusBreakdown: statusMap,
      },
      queues: {
        urgentQueue,
        unassignedQueue,
        readyForPickupQueue,
        recentRepairs,
        technicianWorkload: technicianWorkloadList,
        pendingAccessRequests: pendingAccessRequests.slice(0, 5),
        pendingTransfers: pendingTransfers.slice(0, 5),
        customerRepairs,
      },
    };

    res.setHeader('Cache-Control', 'private, max-age=5, stale-while-revalidate=15');
    return res.json(overviewPayload);
  } catch (err: any) {
    console.error('[OVERVIEW DASHBOARD CONTROLLER ERROR]', err);
    return res.status(500).json({
      error: 'Failed to retrieve overview data.',
      message: err?.message || 'Database query error.',
    });
  }
});

// ============================================================================
// 2. GET /api/dashboard/stats — Backward Compatibility Route
// ============================================================================
router.get('/stats', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const [stats, customersRes, staffRes] = await Promise.all([
      computeRepairDashboardStats({
        preset: (req.query.preset as any) || 'ALL',
        startDate: req.query.startDate ? String(req.query.startDate) : undefined,
        endDate: req.query.endDate ? String(req.query.endDate) : undefined,
        userRole: req.user?.role,
        userId: req.user?.id
      }),
      supabaseAdmin
        .from('Customer')
        .select('*', { count: 'exact', head: true })
        .eq('archived', false),
      supabaseAdmin
        .from('User')
        .select('*', { count: 'exact', head: true })
        .is('deletedAt', null),
    ]);

    res.setHeader('Cache-Control', 'private, max-age=10, stale-while-revalidate=30');
    return res.json({
      activeRepairs: stats.metrics.activeRepairs,
      completedRepairs: stats.metrics.delivered,
      totalRepairs: stats.metrics.totalRecords,
      totalCustomers: customersRes.count || 0,
      totalStaff: staffRes.count || 0,
      totalRevenue: stats.metrics.totalRevenue,
      metrics: stats.metrics,
      userAssigned: stats.userAssigned
    });
  } catch (err: any) {
    console.error('[DASHBOARD STATS ERROR]', err);
    return res.status(500).json({ error: 'Failed to retrieve dashboard stats.' });
  }
});

export default router;
