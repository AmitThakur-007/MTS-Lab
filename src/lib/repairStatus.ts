// src/lib/repairStatus.ts
/**
 * Centralized Repair Status categorization and metrics computation.
 * Aligns frontend dashboards and backend status representations.
 */

export type RepairStatusCategory = 
  | 'PENDING'
  | 'RECEIVED'
  | 'IN_PROGRESS'
  | 'REPAIRED'
  | 'DELIVERED'
  | 'RE_PROBLEM'
  | 'CANCELLED'
  | 'OTHER';

export const PENDING_STATUSES = ['PENDING'];
export const RECEIVED_STATUSES = ['RECEIVED'];
export const IN_PROGRESS_STATUSES = [
  'IN_PROCESS',
  'IN_PROGRESS',
  'DIAGNOSING',
  'WAITING_FOR_PARTS',
  'TESTING',
  'REPAIRING'
];
export const REPAIRED_READY_STATUSES = [
  'REPAIRED',
  'READY_FOR_PICKUP',
  'READY',
  'READY_FOR_DELIVERY'
];
export const DELIVERED_STATUSES = ['DELIVERED', 'COMPLETED'];
export const RE_PROBLEM_STATUSES = ['RE_PROBLEM', 'REPROBLEM'];
export const CANCELLED_STATUSES = ['CANCELLED', 'CANNOT_REPAIR'];

export function isPendingStatus(status?: string | null): boolean {
  if (!status) return false;
  return PENDING_STATUSES.includes(status.toUpperCase().trim());
}

export function isReceivedStatus(status?: string | null): boolean {
  if (!status) return false;
  return RECEIVED_STATUSES.includes(status.toUpperCase().trim());
}

export function isInProgressStatus(status?: string | null): boolean {
  if (!status) return false;
  return IN_PROGRESS_STATUSES.includes(status.toUpperCase().trim());
}

export function isRepairedOrReadyStatus(status?: string | null): boolean {
  if (!status) return false;
  return REPAIRED_READY_STATUSES.includes(status.toUpperCase().trim());
}

export function isDeliveredStatus(status?: string | null): boolean {
  if (!status) return false;
  return DELIVERED_STATUSES.includes(status.toUpperCase().trim());
}

export function isReProblemStatus(status?: string | null): boolean {
  if (!status) return false;
  return RE_PROBLEM_STATUSES.includes(status.toUpperCase().trim());
}

export function isCancelledStatus(status?: string | null): boolean {
  if (!status) return false;
  return CANCELLED_STATUSES.includes(status.toUpperCase().trim());
}

export function getCanonicalCategory(status?: string | null): RepairStatusCategory {
  if (!status) return 'OTHER';
  const s = status.toUpperCase().trim();
  if (isPendingStatus(s)) return 'PENDING';
  if (isReceivedStatus(s)) return 'RECEIVED';
  if (isInProgressStatus(s)) return 'IN_PROGRESS';
  if (isRepairedOrReadyStatus(s)) return 'REPAIRED';
  if (isDeliveredStatus(s)) return 'DELIVERED';
  if (isReProblemStatus(s)) return 'RE_PROBLEM';
  if (isCancelledStatus(s)) return 'CANCELLED';
  return 'OTHER';
}

export interface RepairDashboardMetrics {
  total: number; // Historical all repair records (totalRepairs)
  totalRepairs: number;
  totalRecords: number;
  activeTotal: number; // Active repairs (excluding cancelled & cannot repair)
  activeRepairs: number;
  pending: number;
  received: number;
  inProgress: number;
  repaired: number; // Repaired / Ready
  ready: number;
  readyForPickup: number;
  delivered: number;
  completed: number;
  reProblem: number;
  reproblem: number;
  cannotRepair: number;
  cancelled: number;
  unassigned: number;
  assigned: number;
  urgentCount: number;
  highCount: number;
  estimatedTotalSum: number;
  totalPaidSum: number;
  totalRevenue: number;
  pendingReceivables: number;
}

/**
 * Calculates complete repair statistics from any array of repair records.
 * Uses consistent centralized category definitions.
 */
export function calculateRepairMetrics(repairs: any[]): RepairDashboardMetrics {
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
  let urgentCount = 0;
  let highCount = 0;
  let estimatedTotalSum = 0;
  let totalPaidSum = 0;
  let pendingReceivables = 0;

  if (Array.isArray(repairs)) {
    for (const r of repairs) {
      if (!r) continue;
      totalRecords++;
      const s = (r.status || '').toUpperCase().trim();
      const p = (r.priority || 'NORMAL').toUpperCase().trim();

      const isDelivered = isDeliveredStatus(s);
      const isCancelled = s === 'CANCELLED';
      const isCannotRepair = s === 'CANNOT_REPAIR';
      const isActive = !isDelivered && !isCancelled && !isCannotRepair;

      if (isActive) {
        activeRepairs++;
        if (!r.technicianId && !r.technician) {
          unassigned++;
        } else {
          assigned++;
        }
        if (p === 'URGENT') urgentCount++;
        if (p === 'HIGH') highCount++;
      }

      if (isPendingStatus(s)) {
        pending++;
      } else if (isReceivedStatus(s)) {
        received++;
      } else if (isInProgressStatus(s)) {
        inProgress++;
      } else if (s === 'REPAIRED' || s === 'REPROBLEM_FIXED') {
        repaired++;
      } else if (['READY_FOR_PICKUP', 'READY', 'READY_FOR_DELIVERY'].includes(s)) {
        ready++;
      } else if (isDelivered) {
        delivered++;
      } else if (isReProblemStatus(s)) {
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
    }
  }

  return {
    total: totalRecords,
    totalRepairs: totalRecords,
    totalRecords,
    activeTotal: activeRepairs,
    activeRepairs,
    pending,
    received,
    inProgress,
    repaired: repaired + ready, // Both repaired and ready for pickup for legacy consumers
    ready,
    readyForPickup: ready,
    delivered,
    completed: delivered,
    reProblem,
    reproblem: reProblem,
    cannotRepair,
    cancelled,
    unassigned,
    assigned,
    urgentCount,
    highCount,
    estimatedTotalSum,
    totalPaidSum,
    totalRevenue: totalPaidSum,
    pendingReceivables
  };
}
