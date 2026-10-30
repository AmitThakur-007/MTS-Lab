import { create } from 'zustand';

export interface RepairFiltersState {
  search: string;
  activeStatusTab: string;
  dateFilterPreset: string;
  customStartDate: string;
  customEndDate: string;
  selectedTechnicianFilter: string;
  sortBy: 'newest' | 'oldest' | 'updated' | 'repairNumber' | 'customerName' | 'status';
  currentPage: number;
}

export interface RepairCacheState {
  userId: string | null;
  repairs: any[];
  staffList: any[];
  lastFetched: number;
  filters: RepairFiltersState;
  scrollY: number;

  setRepairs: (repairs: any[], userId?: string | null) => void;
  setStaffList: (staffList: any[]) => void;
  updateRepair: (idOrNum: string, updater: ((prev: any) => any) | Record<string, any>) => void;
  setFilters: (partial: Partial<RepairFiltersState>) => void;
  setScrollY: (y: number) => void;
  isStale: (userId?: string | null, maxAgeMs?: number) => boolean;
  invalidate: () => void;
  clear: () => void;
}

const DEFAULT_FILTERS: RepairFiltersState = {
  search: '',
  activeStatusTab: 'ALL',
  dateFilterPreset: 'ALL',
  customStartDate: '',
  customEndDate: '',
  selectedTechnicianFilter: 'ALL',
  sortBy: 'newest',
  currentPage: 1,
};

// 3-minute client-side SWR stale window for dashboard
const DEFAULT_TTL_MS = 3 * 60 * 1000;

export const useRepairCache = create<RepairCacheState>((set, get) => ({
  userId: null,
  repairs: [],
  staffList: [],
  lastFetched: 0,
  filters: { ...DEFAULT_FILTERS },
  scrollY: 0,

  setRepairs: (repairs: any[], userId?: string | null) =>
    set((state) => ({
      repairs,
      lastFetched: Date.now(),
      userId: userId !== undefined ? userId : state.userId,
    })),

  setStaffList: (staffList: any[]) => set({ staffList }),

  updateRepair: (idOrNum: string, updater: ((prev: any) => any) | Record<string, any>) =>
    set((state) => ({
      repairs: state.repairs.map((r) => {
        if (r.id === idOrNum || String(r.repairNumber) === String(idOrNum)) {
          return typeof updater === 'function' ? updater(r) : { ...r, ...updater };
        }
        return r;
      }),
    })),

  setFilters: (partial: Partial<RepairFiltersState>) =>
    set((state) => ({
      filters: { ...state.filters, ...partial },
    })),

  setScrollY: (y: number) => set({ scrollY: Math.max(0, y) }),

  isStale: (currentUserId?: string | null, maxAgeMs = DEFAULT_TTL_MS) => {
    const { lastFetched, repairs, userId } = get();
    // Cache invalid if switching users or empty
    if (currentUserId && userId && currentUserId !== userId) return true;
    if (!repairs || repairs.length === 0) return true;
    return Date.now() - lastFetched > maxAgeMs;
  },

  invalidate: () => set({ lastFetched: 0 }),

  clear: () =>
    set({
      userId: null,
      repairs: [],
      staffList: [],
      lastFetched: 0,
      filters: { ...DEFAULT_FILTERS },
      scrollY: 0,
    }),
}));
