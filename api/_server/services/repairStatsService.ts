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

  let query = supabaseAdmin
    .from('Repair')
    .select('id, status, priority, estimatedCost, totalCost, advancePaid, totalPaid, createdAt, technicianId, branchId');

  // Role-based filtering
  const role = normalizeRole(userRole);
  if (role === 'TECHNICIAN') {
    // Technicians strictly see only their own assigned repairs
    query = query.eq('technicianId', String(userId));
  } else if (technicianId && technicianId !== 'ALL') {
    query = query.eq('technicianId', String(technicianId));
  }

  if (branchId && branchId !== 'ALL') {
    query = query.eq('branchId', String(branchId));
  }

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

  let total = 0;
  let pending = 0;
  let received = 0;
  let inProgress = 0;
  let repaired = 0;
  let delivered = 0;
  let reProblem = 0;
  let cancelled = 0;
  let estimatedTotalSum = 0;
  let totalPaidSum = 0;

  const PENDING_LIST = ['PENDING'];
  const RECEIVED_LIST = ['RECEIVED'];
  const IN_PROGRESS_LIST = ['IN_PROCESS', 'IN_PROGRESS', 'DIAGNOSING', 'WAITING_FOR_PARTS', 'TESTING', 'REPAIRING'];
  const REPAIRED_LIST = ['REPAIRED', 'READY_FOR_PICKUP', 'READY', 'READY_FOR_DELIVERY'];
  const DELIVERED_LIST = ['DELIVERED', 'COMPLETED'];
  const RE_PROBLEM_LIST = ['RE_PROBLEM', 'REPROBLEM'];
  const CANCELLED_LIST = ['CANCELLED', 'CANNOT_REPAIR'];

  for (const r of (records || [])) {
    total++;
    const s = (r.status || '').toUpperCase().trim();

    if (PENDING_LIST.includes(s)) {
      pending++;
    } else if (RECEIVED_LIST.includes(s)) {
      received++;
    } else if (IN_PROGRESS_LIST.includes(s)) {
      inProgress++;
    } else if (REPAIRED_LIST.includes(s)) {
      repaired++;
    } else if (DELIVERED_LIST.includes(s)) {
      delivered++;
    } else if (RE_PROBLEM_LIST.includes(s)) {
      reProblem++;
    } else if (CANCELLED_LIST.includes(s)) {
      cancelled++;
    }

    const paid = Number(r.totalPaid) || Number(r.advancePaid) || 0;
    const est = Number(r.estimatedCost) || Number(r.totalCost) || 0;
    totalPaidSum += isNaN(paid) ? 0 : paid;
    estimatedTotalSum += isNaN(est) ? 0 : est;
  }

  return {
    preset,
    startIso,
    endIso,
    calendar: calInfo,
    metrics: {
      total,
      pending,
      received,
      inProgress,
      repaired,
      delivered,
      reProblem,
      cancelled,
      estimatedTotalSum,
      totalPaidSum
    }
  };
}
