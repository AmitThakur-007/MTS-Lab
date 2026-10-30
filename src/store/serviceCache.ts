import { create } from 'zustand';

export interface RepairPriceItem {
  id: string;
  brand: string;
  model: string;
  variant?: string | null;
  category: string;
  problem: string;
  serviceName: string;
  description?: string | null;
  price: number;
  priceType: 'FIXED' | 'STARTING_FROM' | 'ON_INSPECTION' | 'CONTACT_FOR_PRICE';
  status: 'ACTIVE' | 'INACTIVE';
  notes?: string | null;
  estimatedTime?: string | null;
  originalPrice?: number | null;
  rating?: number | null;
  ratingCount?: number | null;
  deviceType?: string | null;
  icon?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type DeviceTypeId = 'all' | 'smartphone' | 'laptop' | 'tablet' | 'tv';

export interface ServiceFiltersState {
  searchInput: string;
  activeQuery: string;
  selectedBrand: string;
  selectedCategory: string;
  selectedDeviceType: DeviceTypeId;
  sortBy: 'recommended' | 'priceLow' | 'priceHigh' | 'deviceAsc';
  currentPage: number;
  isFiltersExpanded: boolean;
}

export interface ServiceCacheState {
  services: RepairPriceItem[];
  lastFetched: number;
  filters: ServiceFiltersState;
  scrollY: number;
  
  setServices: (services: RepairPriceItem[]) => void;
  setFilters: (partial: Partial<ServiceFiltersState>) => void;
  setScrollY: (y: number) => void;
  isStale: (maxAgeMs?: number) => boolean;
  invalidate: () => void;
  resetFilters: () => void;
}

const DEFAULT_FILTERS: ServiceFiltersState = {
  searchInput: '',
  activeQuery: '',
  selectedBrand: 'All Brands',
  selectedCategory: 'all',
  selectedDeviceType: 'all',
  sortBy: 'recommended',
  currentPage: 1,
  isFiltersExpanded: false,
};

// 5-minute client-side SWR stale window
const DEFAULT_TTL_MS = 5 * 60 * 1000;

export const useServiceCache = create<ServiceCacheState>((set, get) => ({
  services: [],
  lastFetched: 0,
  filters: { ...DEFAULT_FILTERS },
  scrollY: 0,

  setServices: (services: RepairPriceItem[]) =>
    set({ services, lastFetched: Date.now() }),

  setFilters: (partial: Partial<ServiceFiltersState>) =>
    set((state) => ({
      filters: { ...state.filters, ...partial },
    })),

  setScrollY: (y: number) => set({ scrollY: Math.max(0, y) }),

  isStale: (maxAgeMs = DEFAULT_TTL_MS) => {
    const { lastFetched, services } = get();
    if (!services || services.length === 0) return true;
    return Date.now() - lastFetched > maxAgeMs;
  },

  invalidate: () => set({ lastFetched: 0 }),

  resetFilters: () =>
    set({
      filters: { ...DEFAULT_FILTERS },
      scrollY: 0,
    }),
}));
