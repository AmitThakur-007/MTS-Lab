import { create } from 'zustand';

export interface DashboardCacheState {
  // Overview Section
  overview: {
    data: any | null;
    userId: string | null;
    lastFetched: number;
  };

  // Customers Section
  customers: {
    list: any[];
    stats: any | null;
    total: number;
    totalPages: number;
    userId: string | null;
    lastFetched: number;
  };

  // Attendance Section
  attendance: {
    date: string | null;
    roster: any[];
    stats: any | null;
    monthlyReport: any[];
    historyRecords: any[];
    auditLogs: any[];
    userId: string | null;
    lastFetched: number;
  };

  // Inventory Section
  inventory: {
    items: any[];
    stats: any | null;
    categories: string[];
    folders: any[];
    suppliers: any[];
    locations: any[];
    userId: string | null;
    lastFetched: number;
  };

  // Technician Dashboard Section
  technician: {
    repairs: any[];
    stats: any | null;
    transfers: any | null;
    notifications: any[];
    userId: string | null;
    lastFetched: number;
  };

  // Actions
  setOverview: (data: any, userId?: string | null) => void;
  setCustomers: (payload: { list: any[]; stats?: any; total?: number; totalPages?: number }, userId?: string | null) => void;
  setAttendance: (payload: { date?: string; roster?: any[]; stats?: any; monthlyReport?: any[]; historyRecords?: any[]; auditLogs?: any[] }, userId?: string | null) => void;
  setInventory: (payload: { items: any[]; stats?: any; categories?: string[]; folders?: any[]; suppliers?: any[]; locations?: any[] }, userId?: string | null) => void;
  setTechnician: (payload: { repairs: any[]; stats?: any; transfers?: any; notifications?: any[] }, userId?: string | null) => void;

  isStale: (section: 'overview' | 'customers' | 'attendance' | 'inventory' | 'technician', currentUserId?: string | null, maxAgeMs?: number) => boolean;
  invalidate: (section?: 'overview' | 'customers' | 'attendance' | 'inventory' | 'technician' | 'all') => void;
  clearAll: () => void;
}

const DEFAULT_TTL_MS = 2 * 60 * 1000; // 2 minutes default client-side SWR window

export const useDashboardCache = create<DashboardCacheState>((set, get) => ({
  overview: {
    data: null,
    userId: null,
    lastFetched: 0,
  },
  customers: {
    list: [],
    stats: null,
    total: 0,
    totalPages: 1,
    userId: null,
    lastFetched: 0,
  },
  attendance: {
    date: null,
    roster: [],
    stats: null,
    monthlyReport: [],
    historyRecords: [],
    auditLogs: [],
    userId: null,
    lastFetched: 0,
  },
  inventory: {
    items: [],
    stats: null,
    categories: [],
    folders: [],
    suppliers: [],
    locations: [],
    userId: null,
    lastFetched: 0,
  },
  technician: {
    repairs: [],
    stats: null,
    transfers: null,
    notifications: [],
    userId: null,
    lastFetched: 0,
  },

  setOverview: (data, userId) =>
    set((state) => ({
      overview: {
        data,
        userId: userId !== undefined ? userId : state.overview.userId,
        lastFetched: Date.now(),
      },
    })),

  setCustomers: ({ list, stats, total, totalPages }, userId) =>
    set((state) => ({
      customers: {
        list,
        stats: stats !== undefined ? stats : state.customers.stats,
        total: total !== undefined ? total : state.customers.total,
        totalPages: totalPages !== undefined ? totalPages : state.customers.totalPages,
        userId: userId !== undefined ? userId : state.customers.userId,
        lastFetched: Date.now(),
      },
    })),

  setAttendance: (payload, userId) =>
    set((state) => ({
      attendance: {
        date: payload.date !== undefined ? payload.date : state.attendance.date,
        roster: payload.roster !== undefined ? payload.roster : state.attendance.roster,
        stats: payload.stats !== undefined ? payload.stats : state.attendance.stats,
        monthlyReport: payload.monthlyReport !== undefined ? payload.monthlyReport : state.attendance.monthlyReport,
        historyRecords: payload.historyRecords !== undefined ? payload.historyRecords : state.attendance.historyRecords,
        auditLogs: payload.auditLogs !== undefined ? payload.auditLogs : state.attendance.auditLogs,
        userId: userId !== undefined ? userId : state.attendance.userId,
        lastFetched: Date.now(),
      },
    })),

  setInventory: (payload, userId) =>
    set((state) => ({
      inventory: {
        items: payload.items,
        stats: payload.stats !== undefined ? payload.stats : state.inventory.stats,
        categories: payload.categories !== undefined ? payload.categories : state.inventory.categories,
        folders: payload.folders !== undefined ? payload.folders : state.inventory.folders,
        suppliers: payload.suppliers !== undefined ? payload.suppliers : state.inventory.suppliers,
        locations: payload.locations !== undefined ? payload.locations : state.inventory.locations,
        userId: userId !== undefined ? userId : state.inventory.userId,
        lastFetched: Date.now(),
      },
    })),

  setTechnician: (payload, userId) =>
    set((state) => ({
      technician: {
        repairs: payload.repairs,
        stats: payload.stats !== undefined ? payload.stats : state.technician.stats,
        transfers: payload.transfers !== undefined ? payload.transfers : state.technician.transfers,
        notifications: payload.notifications !== undefined ? payload.notifications : state.technician.notifications,
        userId: userId !== undefined ? userId : state.technician.userId,
        lastFetched: Date.now(),
      },
    })),

  isStale: (section, currentUserId, maxAgeMs = DEFAULT_TTL_MS) => {
    const s = get()[section];
    if (!s) return true;
    if (currentUserId && s.userId && currentUserId !== s.userId) return true;
    if (!s.lastFetched || s.lastFetched === 0) return true;
    return Date.now() - s.lastFetched > maxAgeMs;
  },

  invalidate: (section = 'all') => {
    if (section === 'all') {
      get().clearAll();
      return;
    }
    set((state) => ({
      [section]: {
        ...state[section],
        lastFetched: 0,
      },
    }));
  },

  clearAll: () =>
    set({
      overview: { data: null, userId: null, lastFetched: 0 },
      customers: { list: [], stats: null, total: 0, totalPages: 1, userId: null, lastFetched: 0 },
      attendance: { date: null, roster: [], stats: null, monthlyReport: [], historyRecords: [], auditLogs: [], userId: null, lastFetched: 0 },
      inventory: { items: [], stats: null, categories: [], folders: [], suppliers: [], locations: [], userId: null, lastFetched: 0 },
      technician: { repairs: [], stats: null, transfers: null, notifications: [], userId: null, lastFetched: 0 },
    }),
}));
