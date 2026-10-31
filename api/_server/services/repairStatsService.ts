// api/_server/services/repairStatsService.ts
import { supabaseAdmin } from '../config/supabase';
import { normalizeRole } from '../middleware/rbac';

export const NEPAL_TIMEZONE = 'Asia/Kathmandu';
export const NPT_OFFSET_MINUTES = 5 * 60 + 45; // +345 mins
export const NPT_OFFSET_MS = NPT_OFFSET_MINUTES * 60 * 1000;

export type DateFilterPreset = 'ALL' | 'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'CUSTOM';

export function getNepalCalendarInfo(refDate: Date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: NEPAL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(refDate);
  const y = parseInt(parts.find(p => p.type === 'year')?.value || '2026', 10);
  const m = parseInt(parts.find(p => p.type === 'month')?.value || '01', 10);
  const d = parseInt(parts.find(p => p.type === 'day')?.value || '01', 10);

  const pad = (n: number) => String(n).padStart(2, '0');
  const todayNpt = `${y}-${pad(m)}-${pad(d)}`;

  const todayMidnightUtc = Date.UTC(y, m - 1, d) - NPT_OFFSET_MS;

  const yesterdayDate = new Date(todayMidnightUtc - 24 * 60 * 60 * 1000 + NPT_OFFSET_MS);
  const yesterdayNpt = `${yesterdayDate.getUTCFullYear()}-${pad(yesterdayDate.getUTCMonth() + 1)}-${pad(yesterdayDate.getUTCDate())}`;

  const dow = new Date(todayMidnightUtc + NPT_OFFSET_MS).getUTCDay();
  const weekStartDate = new Date(todayMidnightUtc - dow * 24 * 60 * 60 * 1000 + NPT_OFFSET_MS);
  const weekEndDate = new Date(todayMidnightUtc + (6 - dow) * 24 * 60 * 60 * 1000 + NPT_OFFSET_MS);
  const weekStartNpt = `${weekStartDate.getUTCFullYear()}-${pad(weekStartDate.getUTCMonth() + 1)}-${pad(weekStartDate.getUTCDate())}`;
  const weekEndNpt = `${weekEndDate.getUTCFullYear()}-${pad(weekEndDate.getUTCMonth() + 1)}-${pad(weekEndDate.getUTCDate())}`;

  const monthStartNpt = `${y}-${pad(m)}-01`;
  const lastDayDate = new Date(Date.UTC(y, m, 0));
  const monthEndNpt = `${y}-${pad(m)}-${pad(lastDayDate.getUTCDate())}`;

  return {
    todayNpt,
    yesterdayNpt,
    weekStartNpt,
    weekEndNpt,
    monthStartNpt,
    monthEndNpt
  };
}

export function getNptIsoBoundsForPreset(
  preset: DateFilterPreset,
  customStart?: string,
  customEnd?: string,
  refDate: Date = new Date()
): { startIso: string | null; endIso: string | null } {
  if (preset === 'ALL') {
    return { startIso: null, endIso: null };
  }

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: NEPAL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(refDate);
  const y = parseInt(parts.find(p => p.type === 'year')?.value || '2026', 10);
  const m = parseInt(parts.find(p => p.type === 'month')?.value || '01', 10);
  const d = parseInt(parts.find(p => p.type === 'day')?.value || '01', 10);

  const nptMidnightToUtc = (year: number, month: number, day: number) => {
    return Date.UTC(year, month - 1, day) - NPT_OFFSET_MS;
  };

  const todayMidnightUtc = nptMidnightToUtc(y, m, d);
  const todayEndUtc = todayMidnightUtc + 24 * 60 * 60 * 1000 - 1;

  if (preset === 'TODAY') {
    return {
      startIso: new Date(todayMidnightUtc).toISOString(),
      endIso: new Date(todayEndUtc).toISOString()
    };
  }

  if (preset === 'YESTERDAY') {
    const yesterdayMidnightUtc = todayMidnightUtc - 24 * 60 * 60 * 1000;
    const yesterdayEndUtc = yesterdayMidnightUtc + 24 * 60 * 60 * 1000 - 1;
    return {
      startIso: new Date(yesterdayMidnightUtc).toISOString(),
      endIso: new Date(yesterdayEndUtc).toISOString()
    };
  }

  if (preset === 'THIS_WEEK') {
    const dow = new Date(todayMidnightUtc + NPT_OFFSET_MS).getUTCDay();
    const weekStartUtc = todayMidnightUtc - dow * 24 * 60 * 60 * 1000;
    const weekEndUtc = weekStartUtc + 7 * 24 * 60 * 60 * 1000 - 1;
    return {
      startIso: new Date(weekStartUtc).toISOString(),
      endIso: new Date(weekEndUtc).toISOString()
    };
  }

  if (preset === 'THIS_MONTH') {
    const monthStartUtc = nptMidnightToUtc(y, m, 1);
    const nextMonthStartUtc = nptMidnightToUtc(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1, 1);
    const monthEndUtc = nextMonthStartUtc - 1;
    return {
      startIso: new Date(monthStartUtc).toISOString(),
      endIso: new Date(monthEndUtc).toISOString()
    };
  }

  if (preset === 'CUSTOM') {
    if (!customStart && !customEnd) return { startIso: null, endIso: null };
    let startIso: string | null = null;
    let endIso: string | null = null;

    if (customStart) {
      const [sy, sm, sd] = customStart.split('-').map(Number);
      if (!isNaN(sy) && !isNaN(sm) && !isNaN(sd)) {
        startIso = new Date(nptMidnightToUtc(sy, sm, sd)).toISOString();
      }
    }
    if (customEnd) {
      const [ey, em, ed] = customEnd.split('-').map(Number);
      if (!isNaN(ey) && !isNaN(em) && !isNaN(ed)) {
        endIso = new Date(nptMidnightToUtc(ey, em, ed) + 24 * 60 * 60 * 1000 - 1).toISOString();
      }
    }
    return { startIso, endIso };
  }

  return { startIso: null, endIso: null };
}

export interface ComputeRepairStatsParams {
  preset?: DateFilterPreset;
  startDate?: string;
  endDate?: string;
  technicianId?: string;
  branchId?: string;
  userRole?: string;
  userId?: string;
}

export async function computeRepairDashboardStats(params: ComputeRepairStatsParams) {
  const {
    preset = 'ALL',
    startDate,
    endDate,
    technicianId,
    branchId,
    userRole = 'SUPER_ADMIN',
    userId
  } = params;

  const calInfo = getNepalCalendarInfo();
  const { startIso, endIso } = getNptIsoBoundsForPreset(preset, startDate, endDate);

  // System-wide query across all valid registered repairs
  let query = supabaseAdmin
    .from('Repair')
    .select('id, status, priority, estimatedCost, totalCost, advancePaid, totalPaid, createdAt, updatedAt, technicianId, branchId');

  // Filter by branch if specified
  if (branchId && branchId !== 'ALL') {
    query = query.eq('branchId', String(branchId));
  }

  // Filter by date range bounds if specified
  if (startIso) {
    query = query.gte('createdAt', startIso);
  }
  if (endIso) {
    query = query.lte('createdAt', endIso);
  }

  const { data: records, error } = await query;
  if (error) {
    throw error;
  }

  const allRecords = Array.isArray(records) ? records : [];

  // Canonical Status Sets
  const PENDING_LIST = ['PENDING'];
  const RECEIVED_LIST = ['RECEIVED'];
  const IN_PROGRESS_LIST = ['IN_PROCESS', 'IN_PROGRESS', 'DIAGNOSING', 'WAITING_FOR_PARTS', 'TESTING', 'REPAIRING'];
  const REPAIRED_LIST = ['REPAIRED', 'REPROBLEM_FIXED'];
  const READY_LIST = ['READY_FOR_PICKUP', 'READY', 'READY_FOR_DELIVERY'];
  const REPAIRED_OR_READY_LIST = ['REPAIRED', 'READY_FOR_PICKUP', 'READY', 'READY_FOR_DELIVERY', 'REPROBLEM_FIXED'];
  const DELIVERED_LIST = ['DELIVERED', 'COMPLETED'];
  const RE_PROBLEM_LIST = ['RE_PROBLEM', 'REPROBLEM'];
  const CANNOT_REPAIR_LIST = ['CANNOT_REPAIR'];
  const CANCELLED_LIST = ['CANCELLED'];

  // 1. Authoritative System-Wide Accumulators
  let totalRecords = 0;
  let activeRepairs = 0;
  let pending = 0;
  let received = 0;
  let inProgress = 0;
  let repaired = 0;
  let ready = 0;
  let delivered = 0;
  let reProblem = 0;
  let cannotRepair = 0;
  let cancelled = 0;
  let unassigned = 0;
  let assigned = 0;
  let urgentPriorityCount = 0;
  let highPriorityCount = 0;
  let estimatedTotalSum = 0;
  let totalPaidSum = 0;
  let pendingReceivables = 0;

  // 2. Personal / User-Assigned Accumulators (for the authenticated user or requested technician)
  const targetUserId = userId || (technicianId && technicianId !== 'ALL' && technicianId !== 'unassigned' ? technicianId : null);
  let myAssignedTotal = 0;
  let myActiveTotal = 0;
  let myInProgress = 0;
  let myWaitingParts = 0;
  let myPending = 0;
  let myRepaired = 0;
  let myDelivered = 0;
  let myUrgent = 0;
  let myHigh = 0;
  let myReProblem = 0;

  for (const r of allRecords) {
    totalRecords++;
    const s = (r.status || '').toUpperCase().trim();
    const p = (r.priority || 'NORMAL').toUpperCase().trim();

    const isDelivered = DELIVERED_LIST.includes(s);
    const isCancelled = CANCELLED_LIST.includes(s);
    const isCannotRepair = CANNOT_REPAIR_LIST.includes(s);
    const isActive = !isDelivered && !isCancelled && !isCannotRepair;

    if (isActive) {
      activeRepairs++;
      if (!r.technicianId) {
        unassigned++;
      } else {
        assigned++;
      }
      if (p === 'URGENT') urgentPriorityCount++;
      if (p === 'HIGH') highPriorityCount++;
    }

    if (PENDING_LIST.includes(s)) {
      pending++;
    } else if (RECEIVED_LIST.includes(s)) {
      received++;
    } else if (IN_PROGRESS_LIST.includes(s)) {
      inProgress++;
    } else if (REPAIRED_LIST.includes(s)) {
      repaired++;
    } else if (READY_LIST.includes(s)) {
      ready++;
    } else if (isDelivered) {
      delivered++;
    } else if (RE_PROBLEM_LIST.includes(s)) {
      reProblem++;
    } else if (isCannotRepair) {
      cannotRepair++;
    } else if (isCancelled) {
      cancelled++;
    }

    const paid = Number(r.totalPaid) || Number(r.advancePaid) || 0;
    const est = Number(r.estimatedCost) || Number(r.totalCost) || 0;
    totalPaidSum += isNaN(paid) ? 0 : paid;
    estimatedTotalSum += isNaN(est) ? 0 : est;

    if (isActive && paid < est) {
      pendingReceivables += (est - paid);
    }

    // Accumulate target user personal workbench statistics if matching
    if (targetUserId && String(r.technicianId) === String(targetUserId)) {
      myAssignedTotal++;
      if (isActive) {
        myActiveTotal++;
        if (IN_PROGRESS_LIST.includes(s)) myInProgress++;
        if (s === 'WAITING_FOR_PARTS') myWaitingParts++;
        if (PENDING_LIST.includes(s) || RECEIVED_LIST.includes(s)) myPending++;
        if (p === 'URGENT') myUrgent++;
        if (p === 'HIGH') myHigh++;
        if (RE_PROBLEM_LIST.includes(s)) myReProblem++;
      }
      if (REPAIRED_OR_READY_LIST.includes(s)) myRepaired++;
      if (isDelivered) myDelivered++;
    }
  }

  const systemMetrics = {
    total: totalRecords,
    totalRecords,
    totalRepairs: totalRecords,
    activeTotal: activeRepairs,
    activeRepairs,
    pending,
    received,
    pendingRepairs: pending + received,
    inProgress,
    inProgressRepairs: inProgress,
    repaired,
    ready,
    readyForPickup: ready,
    readyForPickupRepairs: ready,
    repairedOrReady: repaired + ready,
    delivered,
    completed: delivered,
    completedRepairs: delivered,
    reProblem,
    reproblem: reProblem,
    cannotRepair,
    cannotRepairCount: cannotRepair,
    cancelled,
    cancelledCount: cancelled,
    unassigned,
    unassignedRepairs: unassigned,
    assigned,
    urgentPriorityCount,
    highPriorityCount,
    estimatedTotalSum,
    totalPaidSum,
    totalRevenue: totalPaidSum,
    pendingReceivables
  };

  const userAssignedMetrics = {
    assignedTotal: myAssignedTotal,
    activeTotal: myActiveTotal,
    inProgress: myInProgress,
    waitingParts: myWaitingParts,
    pending: myPending,
    repaired: myRepaired,
    delivered: myDelivered,
    urgent: myUrgent,
    high: myHigh,
    reProblem: myReProblem
  };

  return {
    preset,
    startIso,
    endIso,
    calendar: calInfo,
    metrics: systemMetrics,
    system: systemMetrics,
    userAssigned: userAssignedMetrics,
    myBench: userAssignedMetrics,
    ...systemMetrics
  };
}
