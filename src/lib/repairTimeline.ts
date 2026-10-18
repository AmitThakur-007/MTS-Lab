/**
 * MTS LAB — REPAIR TIMELINE & ELAPSED-TIME TRACKING UTILITIES
 * 
 * Authoritative module for tracking laboratory device intake timestamps,
 * technician assignment timestamps, and continuously updating elapsed durations.
 * Timezone: Asia/Kathmandu (UTC+05:45)
 */

export const LAB_TIMEZONE = 'Asia/Kathmandu';

/**
 * Safely parses any date/timestamp representation into a valid JavaScript Date object.
 */
export function parseDateSafe(val: any): Date | null {
  if (!val) return null;
  try {
    if (val instanceof Date) {
      return isNaN(val.getTime()) ? null : val;
    }
    if (typeof val === 'number') {
      const ms = val < 10000000000 ? val * 1000 : val;
      const d = new Date(ms);
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (!trimmed) return null;
      if (/^\d+$/.test(trimmed)) {
        const num = parseInt(trimmed, 10);
        const ms = num < 10000000000 ? num * 1000 : num;
        const d = new Date(ms);
        return isNaN(d.getTime()) ? null : d;
      }
      const d = new Date(trimmed);
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof val === 'object' && typeof val.toDate === 'function') {
      const d = val.toDate();
      return isNaN(d.getTime()) ? null : d;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Extracts the authoritative timestamp when the device was received by the laboratory:
 * 1. Explicit `receivedAt` field if present
 * 2. If courier intake (`isCourierIn` or `receivingMethod === 'COURIER'`), `courierReceivedDate`
 * 3. Walk-in intake creation timestamp (`createdAt`)
 */
export function getRepairReceivedAt(repair: any): Date | null {
  if (!repair) return null;
  const isCourier = Boolean(repair.isCourierIn || repair.receivingMethod === 'COURIER');
  
  if (repair.receivedAt) {
    const d = parseDateSafe(repair.receivedAt);
    if (d) return d;
  }

  if (isCourier && repair.courierReceivedDate) {
    const d = parseDateSafe(repair.courierReceivedDate);
    if (d) return d;
  }

  return parseDateSafe(repair.createdAt);
}

/**
 * Extracts the authoritative timestamp when a technician was assigned to the repair:
 * - If unassigned (no technicianId), strictly returns null (never invents assignment time).
 * - If assigned, returns `assignedAt` or legacy fallback.
 */
export function getRepairAssignedAt(repair: any): Date | null {
  if (!repair || !repair.technicianId) return null;

  if (repair.assignedAt) {
    const d = parseDateSafe(repair.assignedAt);
    if (d) return d;
  }

  // Graceful fallback for legacy records assigned before assignedAt column was recorded
  return parseDateSafe(repair.updatedAt || repair.createdAt);
}

/**
 * Formats a Date/timestamp into authoritative laboratory format:
 * Example: "18 Oct 2026, 10:30 AM" in Asia/Kathmandu timezone.
 */
export function formatNepalDateTime(dateInput: Date | string | number | null): string {
  const d = parseDateSafe(dateInput);
  if (!d) return 'N/A';

  try {
    const dateFormatted = new Intl.DateTimeFormat('en-GB', {
      timeZone: LAB_TIMEZONE,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d);

    const timeFormatted = new Intl.DateTimeFormat('en-US', {
      timeZone: LAB_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);

    return `${dateFormatted}, ${timeFormatted}`;
  } catch {
    return d.toLocaleString('en-US', { timeZone: LAB_TIMEZONE });
  }
}

/**
 * Calculates and formats readable elapsed duration between two timestamps in days, hours, and minutes:
 * Examples:
 * - "25 minutes"
 * - "45 minutes"
 * - "3 hours, 20 minutes"
 * - "2 days, 4 hours"
 * - "1 day, 6 hours, 15 minutes"
 * - "< 1 minute" (for fresh intake)
 */
export function formatElapsedDuration(
  startDate: Date | string | number | null,
  endDate: Date | string | number | null = new Date()
): string {
  const start = parseDateSafe(startDate);
  const end = parseDateSafe(endDate) || new Date();

  if (!start) return 'N/A';

  const diffMs = Math.max(0, end.getTime() - start.getTime());
  const totalMins = Math.floor(diffMs / (60 * 1000));

  if (totalMins < 1) {
    return '< 1 minute';
  }

  const days = Math.floor(totalMins / (24 * 60));
  const hours = Math.floor((totalMins % (24 * 60)) / 60);
  const mins = totalMins % 60;

  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days} day${days > 1 ? 's' : ''}`);
  }
  if (hours > 0) {
    parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
  }
  if (mins > 0 || (days === 0 && hours === 0)) {
    parts.push(`${mins} minute${mins !== 1 ? 's' : ''}`);
  }

  return parts.join(', ');
}

/**
 * Formats a compact elapsed duration badge string (e.g. "45m", "2h 30m", "1d 4h")
 */
export function formatCompactDuration(
  startDate: Date | string | number | null,
  endDate: Date | string | number | null = new Date()
): string {
  const start = parseDateSafe(startDate);
  const end = parseDateSafe(endDate) || new Date();

  if (!start) return 'N/A';

  const diffMs = Math.max(0, end.getTime() - start.getTime());
  const totalMins = Math.floor(diffMs / (60 * 1000));

  if (totalMins < 1) {
    return '<1m';
  }

  const days = Math.floor(totalMins / (24 * 60));
  const hours = Math.floor((totalMins % (24 * 60)) / 60);
  const mins = totalMins % 60;

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  if (hours > 0) {
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  return `${mins}m`;
}

export interface LatencyStatus {
  level: 'normal' | 'moderate' | 'critical';
  label: string;
  badgeClass: string;
  textClass: string;
  borderClass: string;
  isProlonged: boolean;
  hoursWaiting: number;
}

/**
 * Evaluates assignment latency against operational thresholds:
 * - Unassigned:
 *   * < 2 hours: Prompt Queue (normal / emerald)
 *   * 2 - 24 hours: Moderate delay (amber)
 *   * > 24 hours: Prolonged unassigned critical alert (rose / red)
 * - Assigned:
 *   * Evaluates time taken from received to assigned.
 */
export function getAssignmentLatencyStatus(repair: any, now: Date = new Date()): LatencyStatus {
  const isAssigned = Boolean(repair.technicianId);
  const receivedAt = getRepairReceivedAt(repair);
  const assignedAt = getRepairAssignedAt(repair);

  const startMs = receivedAt ? receivedAt.getTime() : 0;
  const endMs = isAssigned && assignedAt ? assignedAt.getTime() : now.getTime();
  const diffMs = Math.max(0, endMs - startMs);
  const hours = diffMs / (3600 * 1000);

  if (!isAssigned) {
    if (hours >= 24) {
      return {
        level: 'critical',
        label: 'Critical Delay (>24h)',
        badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 font-black animate-pulse',
        textClass: 'text-rose-700',
        borderClass: 'border-rose-300 bg-rose-50/50',
        isProlonged: true,
        hoursWaiting: Math.round(hours * 10) / 10,
      };
    }
    if (hours >= 2) {
      return {
        level: 'moderate',
        label: 'Moderate Delay (>2h)',
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 font-bold',
        textClass: 'text-amber-700',
        borderClass: 'border-amber-200 bg-amber-50/40',
        isProlonged: true,
        hoursWaiting: Math.round(hours * 10) / 10,
      };
    }
    return {
      level: 'normal',
      label: 'Prompt Queue (<2h)',
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200 font-bold',
      textClass: 'text-emerald-700',
      borderClass: 'border-emerald-200 bg-emerald-50/30',
      isProlonged: false,
      hoursWaiting: Math.round(hours * 10) / 10,
    };
  }

  // Assigned repairs: evaluate speed of assignment
  if (hours >= 24) {
    return {
      level: 'critical',
      label: 'Delayed Assignment (>24h)',
      badgeClass: 'bg-rose-50 text-rose-800 border-rose-200 font-bold',
      textClass: 'text-rose-700',
      borderClass: 'border-rose-200',
      isProlonged: true,
      hoursWaiting: Math.round(hours * 10) / 10,
    };
  }
  if (hours >= 2) {
    return {
      level: 'moderate',
      label: 'Standard Assignment',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200 font-semibold',
      textClass: 'text-amber-700',
      borderClass: 'border-amber-200',
      isProlonged: false,
      hoursWaiting: Math.round(hours * 10) / 10,
    };
  }
  return {
    level: 'normal',
    label: 'Fast Assignment (<2h)',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold',
    textClass: 'text-emerald-700',
    borderClass: 'border-emerald-200',
    isProlonged: false,
    hoursWaiting: Math.round(hours * 10) / 10,
  };
}

export interface RepairTimelineMetrics {
  receivedAtDate: Date | null;
  receivedAtFormatted: string;
  assignedAtDate: Date | null;
  assignedAtFormatted: string;
  timeSinceReceived: string;
  timeSinceReceivedCompact: string;
  timeUntilAssignment: string;
  timeUntilAssignmentCompact: string;
  timeSinceAssignment: string;
  timeSinceAssignmentCompact: string;
  isAssigned: boolean;
  latency: LatencyStatus;
  rawElapsedSinceReceivedMs: number;
  rawTimeUntilAssignmentMs: number;
  rawElapsedSinceAssignedMs: number;
}

/**
 * Computes all authoritative repair timeline metrics for a given repair record.
 */
export function getRepairTimelineMetrics(repair: any, now: Date = new Date()): RepairTimelineMetrics {
  const receivedAtDate = getRepairReceivedAt(repair);
  const assignedAtDate = getRepairAssignedAt(repair);
  const isAssigned = Boolean(repair?.technicianId && (assignedAtDate || repair.technician));

  const receivedAtFormatted = receivedAtDate ? formatNepalDateTime(receivedAtDate) : 'N/A';
  const assignedAtFormatted = isAssigned && assignedAtDate ? formatNepalDateTime(assignedAtDate) : (isAssigned ? 'Assigned' : 'Pending Assignment');

  const nowMs = now.getTime();
  const receivedMs = receivedAtDate ? receivedAtDate.getTime() : nowMs;
  const assignedMs = assignedAtDate ? assignedAtDate.getTime() : 0;

  const rawElapsedSinceReceivedMs = Math.max(0, nowMs - receivedMs);
  const timeSinceReceived = receivedAtDate ? formatElapsedDuration(receivedAtDate, now) : 'N/A';
  const timeSinceReceivedCompact = receivedAtDate ? formatCompactDuration(receivedAtDate, now) : 'N/A';

  // Time until assignment:
  // - If assigned: time taken between receivedAt and assignedAt
  // - If unassigned: time spent waiting so far (between receivedAt and now)
  let rawTimeUntilAssignmentMs = 0;
  let timeUntilAssignment = 'N/A';
  let timeUntilAssignmentCompact = 'N/A';

  if (isAssigned && receivedAtDate && assignedAtDate) {
    rawTimeUntilAssignmentMs = Math.max(0, assignedAtDate.getTime() - receivedAtDate.getTime());
    timeUntilAssignment = formatElapsedDuration(receivedAtDate, assignedAtDate);
    timeUntilAssignmentCompact = formatCompactDuration(receivedAtDate, assignedAtDate);
  } else if (!isAssigned && receivedAtDate) {
    rawTimeUntilAssignmentMs = rawElapsedSinceReceivedMs;
    timeUntilAssignment = `Waiting: ${timeSinceReceived}`;
    timeUntilAssignmentCompact = `Wait: ${timeSinceReceivedCompact}`;
  }

  // Time since assignment:
  // - If assigned: time between assignedAt and now
  // - If unassigned: N/A
  let rawElapsedSinceAssignedMs = 0;
  let timeSinceAssignment = 'N/A';
  let timeSinceAssignmentCompact = 'N/A';

  if (isAssigned && assignedAtDate) {
    rawElapsedSinceAssignedMs = Math.max(0, nowMs - assignedMs);
    timeSinceAssignment = formatElapsedDuration(assignedAtDate, now);
    timeSinceAssignmentCompact = formatCompactDuration(assignedAtDate, now);
  }

  const latency = getAssignmentLatencyStatus(repair, now);

  return {
    receivedAtDate,
    receivedAtFormatted,
    assignedAtDate,
    assignedAtFormatted,
    timeSinceReceived,
    timeSinceReceivedCompact,
    timeUntilAssignment,
    timeUntilAssignmentCompact,
    timeSinceAssignment,
    timeSinceAssignmentCompact,
    isAssigned,
    latency,
    rawElapsedSinceReceivedMs,
    rawTimeUntilAssignmentMs,
    rawElapsedSinceAssignedMs,
  };
}
