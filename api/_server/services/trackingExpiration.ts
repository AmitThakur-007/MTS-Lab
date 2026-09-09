/**
 * MTS Lab - Track Repair Expiration Service
 *
 * BUSINESS RULE:
 * Once a repair is marked as DELIVERED, the customer can track the repair
 * only until the end of that delivery day in Nepal Time (Asia/Kathmandu).
 * Starting from the next calendar day, that repair must no longer be trackable
 * from the public Track Repair interface (API and UI).
 *
 * Internal dashboards and staff views remain completely unaffected.
 */

export const NEPAL_TIMEZONE = 'Asia/Kathmandu';

/**
 * Converts a Date, timestamp, or ISO string into Nepal calendar date "YYYY-MM-DD"
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

/**
 * Determines the authoritative delivery timestamp for a repair.
 * Checks:
 * 1. explicit deliveredAt field if present
 * 2. courierOutDeliveredDate if courier delivery
 * 3. Status history logs from RepairLog (most recent DELIVERED or COMPLETED log)
 * 4. Fallback to updatedAt/createdAt if status is DELIVERED
 */
export function getAuthoritativeDeliveryDate(repair: any, logsForRepair?: any[]): string | null {
  if (!repair) return null;

  // 1. Explicit delivery field
  if (repair.deliveredAt) {
    return repair.deliveredAt;
  }

  // 2. Logistics courier delivery timestamp
  if (repair.courierOutDeliveredDate) {
    return repair.courierOutDeliveredDate;
  }

  // 3. Status history event from RepairLog
  if (logsForRepair && logsForRepair.length > 0) {
    const deliveredLog = logsForRepair.find((l) => {
      const s = String(l.status || '').toUpperCase().trim();
      return s === 'DELIVERED' || s === 'COMPLETED';
    });
    if (deliveredLog && deliveredLog.createdAt) {
      return deliveredLog.createdAt;
    }
  }

  // 4. Fallback if currently in DELIVERED/COMPLETED status
  const st = String(repair.status || '').toUpperCase().trim();
  if (st === 'DELIVERED' || st === 'COMPLETED') {
    return repair.updatedAt || repair.createdAt || null;
  }

  return null;
}

/**
 * Determines whether a repair is trackable by a public customer.
 * - Non-delivered repairs are ALWAYS trackable.
 * - Delivered repairs are trackable ONLY on the same calendar day in Nepal (Asia/Kathmandu).
 * - From the next calendar day onward, it is expired from public tracking.
 */
export function isRepairPubliclyTrackable(
  repair: any,
  logsForRepair?: any[],
  referenceDate: Date = new Date()
): boolean {
  if (!repair) return false;

  const st = String(repair.status || '').toUpperCase().trim();
  const isDelivered = st === 'DELIVERED' || st === 'COMPLETED';

  // Non-delivered repairs (PENDING, DIAGNOSING, IN_PROCESS, REPAIRED, READY_FOR_PICKUP, etc.) are always trackable
  if (!isDelivered) {
    return true;
  }

  // For delivered repairs, check authoritative delivery date against current server Nepal calendar date
  const deliveryIso = getAuthoritativeDeliveryDate(repair, logsForRepair);
  if (!deliveryIso) {
    // If no delivery timestamp can be determined, safely allow tracking
    return true;
  }

  const deliveryNepalDate = toNepalDateString(deliveryIso);
  const currentNepalDate = toNepalDateString(referenceDate);

  if (!deliveryNepalDate || !currentNepalDate) {
    return true;
  }

  // Same day: currentNepalDate === deliveryNepalDate -> Trackable
  // Next day or later: currentNepalDate > deliveryNepalDate -> Expired
  return currentNepalDate <= deliveryNepalDate;
}

/**
 * Filters an array of repairs and returns only those that are publicly trackable.
 * Also attaches authoritative deliveredAt to delivered repairs.
 */
export function filterPubliclyTrackableRepairs(
  repairs: any[],
  allLogs: any[] = [],
  referenceDate: Date = new Date()
): any[] {
  if (!repairs || !Array.isArray(repairs)) return [];

  // Group logs by repairId for O(1) lookup
  const logsByRepairId: Record<string, any[]> = {};
  for (const log of allLogs) {
    if (log && log.repairId) {
      if (!logsByRepairId[log.repairId]) {
        logsByRepairId[log.repairId] = [];
      }
      logsByRepairId[log.repairId].push(log);
    }
  }

  return repairs
    .filter((rep) => {
      const logs = logsByRepairId[rep.id] || [];
      return isRepairPubliclyTrackable(rep, logs, referenceDate);
    })
    .map((rep) => {
      const logs = logsByRepairId[rep.id] || [];
      const delDate = getAuthoritativeDeliveryDate(rep, logs);
      if (delDate) {
        return {
          ...rep,
          deliveredAt: delDate,
        };
      }
      return rep;
    });
}
