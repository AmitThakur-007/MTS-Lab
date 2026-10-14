/**
 * Centralized Pagination Configuration for MTS Lab Repair Management System
 * Authoritative default: Exactly 40 repair records per page across all staff dashboards.
 */

export const REPAIRS_PER_PAGE = 40;

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Calculates deterministic pagination bounds for 1-indexed pages
 */
export function getPaginationBounds(page: number, limit: number = REPAIRS_PER_PAGE) {
  const safePage = Math.max(1, page || 1);
  const safeLimit = Math.max(1, limit || REPAIRS_PER_PAGE);
  const offset = (safePage - 1) * safeLimit;
  return {
    page: safePage,
    limit: safeLimit,
    offset,
    rangeStart: offset,
    rangeEnd: offset + safeLimit - 1,
  };
}

/**
 * In-memory slicer for paginating an authorized dataset while strictly preserving ordering
 */
export function paginateArray<T>(
  items: T[],
  page: number,
  limit: number = REPAIRS_PER_PAGE
): {
  data: T[];
  meta: PaginationMeta;
} {
  const safeItems = Array.isArray(items) ? items : [];
  const total = safeItems.length;
  const safeLimit = Math.max(1, limit || REPAIRS_PER_PAGE);
  const totalPages = Math.max(1, Math.ceil(total / safeLimit));
  const safePage = Math.min(Math.max(1, page || 1), totalPages);
  const start = (safePage - 1) * safeLimit;
  const data = safeItems.slice(start, start + safeLimit);

  return {
    data,
    meta: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages,
    },
  };
}
