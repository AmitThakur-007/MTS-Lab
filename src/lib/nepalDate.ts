// src/lib/nepalDate.ts
/**
 * Authoritative Nepal Standard Time (Asia/Kathmandu, UTC+05:45) calendar date and time utilities.
 * Ensures deterministic date boundary calculations across all filters, regardless of user browser timezone.
 */

export const NEPAL_TIMEZONE = 'Asia/Kathmandu';
export const NPT_OFFSET_MINUTES = 5 * 60 + 45; // 345 minutes ahead of UTC
export const NPT_OFFSET_MS = NPT_OFFSET_MINUTES * 60 * 1000;

export type DateFilterPreset = 'ALL' | 'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'CUSTOM';

/**
 * Formats any Date, ISO string, or timestamp into Nepal date string "YYYY-MM-DD"
 */
export function toNepalDateString(val?: string | Date | number | null): string {
  if (!val) return '';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: NEPAL_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch {
    return '';
  }
}

export interface NepalCalendarInfo {
  todayNpt: string;       // YYYY-MM-DD
  yesterdayNpt: string;   // YYYY-MM-DD
  weekStartNpt: string;   // YYYY-MM-DD (Sunday)
  weekEndNpt: string;     // YYYY-MM-DD (Saturday)
  monthStartNpt: string;  // YYYY-MM-DD (1st of month)
  monthEndNpt: string;    // YYYY-MM-DD (Last day of month)
  formattedTodayNpt: string; // e.g. "Thu, Sep 3, 2026"
}

/**
 * Calculates calendar boundaries in Nepal timezone (Asia/Kathmandu)
 */
export function getNepalCalendarInfo(refDate: Date = new Date()): NepalCalendarInfo {
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

  // Midnight NPT in UTC milliseconds
  const todayMidnightUtc = Date.UTC(y, m - 1, d) - NPT_OFFSET_MS;

  // Yesterday
  const yesterdayDate = new Date(todayMidnightUtc - 24 * 60 * 60 * 1000 + NPT_OFFSET_MS);
  const yesterdayNpt = `${yesterdayDate.getUTCFullYear()}-${pad(yesterdayDate.getUTCMonth() + 1)}-${pad(yesterdayDate.getUTCDate())}`;

  // Week: Sunday (0) to Saturday (6) in Nepal
  const dow = new Date(todayMidnightUtc + NPT_OFFSET_MS).getUTCDay();
  const weekStartDate = new Date(todayMidnightUtc - dow * 24 * 60 * 60 * 1000 + NPT_OFFSET_MS);
  const weekEndDate = new Date(todayMidnightUtc + (6 - dow) * 24 * 60 * 60 * 1000 + NPT_OFFSET_MS);
  const weekStartNpt = `${weekStartDate.getUTCFullYear()}-${pad(weekStartDate.getUTCMonth() + 1)}-${pad(weekStartDate.getUTCDate())}`;
  const weekEndNpt = `${weekEndDate.getUTCFullYear()}-${pad(weekEndDate.getUTCMonth() + 1)}-${pad(weekEndDate.getUTCDate())}`;

  // Month: 1st to last day of current month in Nepal
  const monthStartNpt = `${y}-${pad(m)}-01`;
  const lastDayDate = new Date(Date.UTC(y, m, 0));
  const monthEndNpt = `${y}-${pad(m)}-${pad(lastDayDate.getUTCDate())}`;

  const formattedTodayNpt = new Intl.DateTimeFormat('en-US', {
    timeZone: NEPAL_TIMEZONE,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(refDate);

  return {
    todayNpt,
    yesterdayNpt,
    weekStartNpt,
    weekEndNpt,
    monthStartNpt,
    monthEndNpt,
    formattedTodayNpt
  };
}

/**
 * Returns UTC ISO boundaries for a given preset in Nepal Standard Time
 */
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

/**
 * Returns whether a record's createdAt timestamp belongs to the selected preset in Nepal Standard Time.
 */
export function matchesDatePreset(
  createdAt: string | Date | null | undefined,
  preset: DateFilterPreset,
  customStartDate?: string,
  customEndDate?: string,
  calInfo?: NepalCalendarInfo
): boolean {
  if (preset === 'ALL') return true;
  if (!createdAt) return false;

  const nepalDate = toNepalDateString(createdAt);
  if (!nepalDate) return false;

  const info = calInfo || getNepalCalendarInfo();

  switch (preset) {
    case 'TODAY':
      return nepalDate === info.todayNpt;
    case 'YESTERDAY':
      return nepalDate === info.yesterdayNpt;
    case 'THIS_WEEK':
      return nepalDate >= info.weekStartNpt && nepalDate <= info.weekEndNpt;
    case 'THIS_MONTH':
      return nepalDate >= info.monthStartNpt && nepalDate <= info.monthEndNpt;
    case 'CUSTOM':
      if (!customStartDate && !customEndDate) return true;
      if (customStartDate && customEndDate && customStartDate > customEndDate) return false;
      if (customStartDate && nepalDate < customStartDate) return false;
      if (customEndDate && nepalDate > customEndDate) return false;
      return true;
    default:
      return true;
  }
}
