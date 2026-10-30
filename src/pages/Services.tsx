import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom';
import { buildSlugMap, STATIC_PAGES_SEO, getLocalBusinessJsonLd, SITE_URL } from '@/lib/seo';
import { PageSeo } from '@/components/Seo';
import { 
  Search, 
  Smartphone, 
  Tablet,
  Laptop,
  Tv,
  LayoutGrid,
  Wrench, 
  Clock, 
  ShieldCheck, 
  AlertCircle, 
  SlidersHorizontal, 
  Filter,
  PhoneCall, 
  MessageCircle, 
  RotateCcw, 
  ChevronRight, 
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Info, 
  CheckCircle2, 
  Zap, 
  Cpu, 
  Layers, 
  Battery, 
  Camera, 
  Volume2, 
  Mic,
  Wifi,
  Power,
  Flashlight,
  Fingerprint,
  Vibrate,
  X, 
  ScanLine, 
  Cable, 
  ArrowUpDown,
  Phone,
  Droplets,
  Share2,
  Check,
  MapPin,
  Flame,
  ArrowRight
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuthStore } from '@/store/authStore';
import { useServiceCache } from '@/store/serviceCache';
import { useRealtimeSync } from '@/services/realtime';
import { toast } from 'sonner';

// Official MTS Lab Kathmandu Hub Contact Configurations
const MTS_PHONE = '9869276668';
const MTS_PHONE_DISPLAY = '9869276668';
const MTS_LANDLINE = '015364307';
const MTS_WHATSAPP_NUMBER = '9779869276668';
const MTS_FACEBOOK_URL = 'https://www.facebook.com/mtslabnepal';

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

// Popular Search Suggestions with dedicated service icons for instant visual discovery
const POPULAR_SEARCH_KEYWORDS = [
  { text: 'iPhone Display', icon: Smartphone },
  { text: 'Battery Replacement', icon: Battery },
  { text: 'Front Glass OCA', icon: Layers },
  { text: 'Green / White Line', icon: ScanLine },
  { text: 'Charging Port', icon: Zap },
  { text: 'Camera Lens', icon: Camera },
  { text: 'Water Damage', icon: Droplets },
  { text: 'Flex Cable', icon: Cable },
  { text: 'IC Repair', icon: Cpu },
  { text: 'Samsung S23', icon: Smartphone }
];

// Popular Repair Categories with specialized icons & theme accents
const POPULAR_CATEGORIES = [
  { id: 'all', label: 'All Repairs', icon: Layers },
  { id: 'Display', label: 'Display Replacement', icon: Smartphone },
  { id: 'Front Glass', label: 'Front Glass (OCA)', icon: Layers },
  { id: 'Lining', label: 'Laser Line Removal', icon: ScanLine },
  { id: 'Flex Change', label: 'Flex Cable Bonding', icon: Cable },
  { id: 'Green / White Screen', label: 'WSOD Screen Recovery', icon: Tv },
  { id: 'Battery', label: 'Battery Replacement', icon: Battery },
  { id: 'Charging', label: 'Charging Port & Pin', icon: Zap },
  { id: 'Microphone', label: 'Microphone & Voice', icon: Mic },
  { id: 'Speaker', label: 'Speaker & Audio', icon: Volume2 },
  { id: 'Camera', label: 'Camera & Lens', icon: Camera },
  { id: 'Motherboard / IC', label: 'Motherboard & IC', icon: Cpu },
  { id: 'Back Glass', label: 'Back Glass & Panel', icon: Layers },
  { id: 'Water Damage', label: 'Water Damage Revival', icon: Droplets },
  { id: 'Software', label: 'Software & Flash', icon: Cpu },
  { id: 'Face ID / Fingerprint', label: 'Face ID & Biometrics', icon: Fingerprint },
  { id: 'Network', label: 'Network & Signal', icon: Wifi }
];

// Supported Device Forms
export type DeviceTypeId = 'all' | 'smartphone' | 'laptop' | 'tablet' | 'tv';

export const DEVICE_OPTIONS: { id: DeviceTypeId; label: string; icon: React.ElementType; description: string }[] = [
  { id: 'all', label: 'All Devices', icon: LayoutGrid, description: 'All eligible hardware repair services' },
  { id: 'smartphone', label: 'Smartphones & iPhones', icon: Smartphone, description: 'Smartphones, iPhones & cellular models' },
  { id: 'laptop', label: 'Laptops', icon: Laptop, description: 'MacBooks, Windows laptops & ultrabooks' },
  { id: 'tablet', label: 'Tablets & iPads', icon: Tablet, description: 'Apple iPads & Android tablets' },
  { id: 'tv', label: 'Smart TVs', icon: Tv, description: 'Smart TVs & digital display panels' },
];

// Curated brand compatibility dictionary per device form
export const DEVICE_BRAND_MAPPINGS: Record<DeviceTypeId, string[]> = {
  all: [
    'Apple', 'Samsung', 'Xiaomi', 'Redmi', 'OnePlus', 'Google',
    'Vivo', 'Oppo', 'Realme', 'Nothing', 'Dell', 'HP', 'Lenovo', 'ASUS', 'Acer', 'Sony', 'LG'
  ],
  smartphone: [
    'Apple', 'Samsung', 'Xiaomi', 'Redmi', 'OnePlus', 'Google',
    'Vivo', 'Oppo', 'Realme', 'Nothing'
  ],
  laptop: [
    'Apple', 'Dell', 'HP', 'Lenovo', 'ASUS', 'Acer', 'Samsung'
  ],
  tablet: [
    'Apple', 'Samsung', 'Xiaomi', 'Lenovo'
  ],
  tv: [
    'Samsung', 'Sony', 'LG', 'Xiaomi'
  ]
};

// Default fallback brands list
export const BRANDS_LIST = DEVICE_BRAND_MAPPINGS.all;

// Items displayed per catalog page (divides cleanly across 2, 3, 4, 6, and 8 column layouts)
const ITEMS_PER_PAGE = 48;

// Helper to normalize strings for robust fuzzy comparison
function normalizeText(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Smart Synonym & Alias mappings for common smartphone repair terms
const SYNONYMS: Record<string, string[]> = {
  screen: ['display', 'glass', 'panel', 'oled', 'amoled', 'lcd', 'green screen', 'white screen', 'lining', 'touch'],
  display: ['screen', 'glass', 'panel', 'oled', 'amoled', 'lcd', 'green screen', 'white screen', 'lining'],
  glass: ['screen', 'display', 'panel', 'touch', 'outer glass', 'front glass', 'back glass', 'oca'],
  front: ['front glass', 'outer glass', 'front screen', 'glass change'],
  outer: ['front glass', 'outer glass', 'glass change'],
  oca: ['oca', 'glass change', 'front glass', 'outer glass', 'glass lamination'],
  lining: ['line', 'lines', 'green line', 'pink line', 'white line', 'laser', 'laser line', 'line removal', 'screen line', 'vertical line'],
  line: ['lining', 'lines', 'green line', 'pink line', 'white line', 'laser', 'screen line'],
  lines: ['lining', 'line', 'green line', 'pink line', 'white line', 'laser'],
  laser: ['lining', 'laser machine', 'line removal', 'laser bonding'],
  flex: ['flex change', 'flex bonding', 'ribbon', 'fpc', 'display flex', 'charging flex', 'power flex'],
  cable: ['flex', 'flex change', 'ribbon', 'wire'],
  green: ['green screen', 'green / white screen', 'white screen', 'green line', 'green display', 'wsod', 'gsod'],
  white: ['white screen', 'green / white screen', 'green screen', 'white display', 'white line', 'wsod', 'gsod'],
  wsod: ['white screen', 'green screen', 'green / white screen', 'white screen of death'],
  gsod: ['green screen', 'white screen', 'green / white screen', 'green screen of death'],
  battery: ['drain', 'health', 'cell', 'backup', 'batt'],
  batt: ['battery', 'drain', 'cell'],
  charge: ['charging', 'port', 'type-c', 'lightning', 'usb', 'socket', 'plug', 'pin'],
  charging: ['charge', 'port', 'type-c', 'lightning', 'usb', 'socket', 'pin'],
  port: ['charging', 'charge', 'usb', 'type-c', 'lightning', 'socket'],
  camera: ['lens', 'photo', 'sensor', 'cam', 'focus'],
  cam: ['camera', 'lens', 'sensor'],
  back: ['rear', 'housing', 'body', 'back glass', 'back cover', 'door', 'back panel'],
  rear: ['back', 'back glass', 'back cover', 'housing'],
  panel: ['back panel', 'housing', 'body'],
  speaker: ['sound', 'audio', 'earpiece', 'ringer', 'loudspeaker', 'volume'],
  sound: ['speaker', 'audio', 'mic', 'microphone', 'earpiece', 'ringer'],
  audio: ['speaker', 'sound', 'mic', 'microphone', 'earpiece'],
  mic: ['microphone', 'voice', 'sound', 'audio'],
  microphone: ['mic', 'voice', 'sound', 'audio'],
  board: ['motherboard', 'ic', 'chip', 'logic', 'cpu', 'short', 'dead', 'power ic'],
  motherboard: ['board', 'ic', 'chip', 'logic', 'micro soldering', 'short'],
  ic: ['motherboard', 'board', 'chip', 'power ic', 'charging ic', 'audio ic', 'micro soldering', 'short'],
  water: ['liquid', 'corrosion', 'wet', 'moisture', 'drop in water'],
  liquid: ['water', 'corrosion', 'wet', 'moisture'],
  software: ['bootloop', 'restart', 'hang', 'logo', 'unlock', 'flash', 'update', 'os', 'stuck']
};

// Category style & icon resolver
export function getCategoryInfo(categoryName: string, serviceName?: string) {
  const norm = `${categoryName || ''} ${serviceName || ''}`.toLowerCase();
  
  // 1. Microphone Repair
  if (norm.includes('micro') || norm.includes('mic ') || norm.endsWith('mic') || norm.includes('voice')) {
    return {
      icon: Mic,
      name: 'Microphone Repair',
      bgClass: 'bg-cyan-50',
      textClass: 'text-cyan-700',
      badgeClass: 'bg-cyan-50 text-cyan-700 border-cyan-200/80',
      iconClass: 'text-cyan-600',
      gradientClass: 'from-cyan-500/10 to-cyan-500/5',
      cardHover: 'hover:border-cyan-400 hover:shadow-cyan-100/40'
    };
  }

  // 2. Speaker & Audio (earpiece, ringer, loudspeaker)
  if (norm.includes('speaker') || norm.includes('sound') || norm.includes('audio') || norm.includes('earpiece') || norm.includes('ringer') || norm.includes('buzzer')) {
    return {
      icon: Volume2,
      name: 'Speaker & Audio',
      bgClass: 'bg-rose-50',
      textClass: 'text-rose-700',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/80',
      iconClass: 'text-rose-600',
      gradientClass: 'from-rose-500/10 to-rose-500/5',
      cardHover: 'hover:border-rose-400 hover:shadow-rose-100/40'
    };
  }

  // 3. Front Glass (OCA) / Outer Glass
  if (norm.includes('front glass') || norm.includes('outer glass') || norm.includes('oca') || norm.includes('glass change') || norm.includes('glass lamination')) {
    return {
      icon: Smartphone,
      name: 'Front Glass (OCA)',
      bgClass: 'bg-teal-50',
      textClass: 'text-teal-700',
      badgeClass: 'bg-teal-50 text-teal-700 border-teal-200/80',
      iconClass: 'text-teal-600',
      gradientClass: 'from-teal-500/10 to-teal-500/5',
      cardHover: 'hover:border-teal-400 hover:shadow-teal-100/40'
    };
  }

  // 4. Laser Line Removal (Lining / Green line / Pink line)
  if (norm.includes('lining') || norm.includes('laser') || norm.includes('green line') || norm.includes('pink line') || norm.includes('white line') || norm.includes('screen line')) {
    return {
      icon: ScanLine,
      name: 'Laser Line Removal',
      bgClass: 'bg-orange-50',
      textClass: 'text-orange-700',
      badgeClass: 'bg-orange-50 text-orange-700 border-orange-200/80',
      iconClass: 'text-orange-600',
      gradientClass: 'from-orange-500/10 to-orange-500/5',
      cardHover: 'hover:border-orange-400 hover:shadow-orange-100/40'
    };
  }

  // 5. Flex Cable Bonding & Replacement
  if (norm.includes('flex')) {
    return {
      icon: Cable,
      name: 'Flex Cable Bonding',
      bgClass: 'bg-amber-50',
      textClass: 'text-amber-700',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200/80',
      iconClass: 'text-amber-600',
      gradientClass: 'from-amber-500/10 to-amber-500/5',
      cardHover: 'hover:border-amber-400 hover:shadow-amber-100/40'
    };
  }

  // 6. Green Screen / White Screen Recovery (WSOD / GSOD)
  if (norm.includes('green') || norm.includes('white screen') || norm.includes('wsod') || norm.includes('gsod')) {
    return {
      icon: Tv,
      name: 'WSOD Screen Recovery',
      bgClass: 'bg-emerald-50',
      textClass: 'text-emerald-700',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
      iconClass: 'text-emerald-600',
      gradientClass: 'from-emerald-500/10 to-emerald-500/5',
      cardHover: 'hover:border-emerald-400 hover:shadow-emerald-100/40'
    };
  }

  // 7. Display / Screen Replacement (AMOLED, OLED, LCD, Compatible Screen)
  if (norm.includes('display') || norm.includes('screen') || norm.includes('oled') || norm.includes('amoled') || norm.includes('lcd') || norm.includes('touch')) {
    return {
      icon: Smartphone,
      name: 'Display Replacement',
      bgClass: 'bg-sky-50',
      textClass: 'text-sky-700',
      badgeClass: 'bg-sky-50 text-sky-700 border-sky-200/80',
      iconClass: 'text-sky-600',
      gradientClass: 'from-sky-500/10 to-sky-500/5',
      cardHover: 'hover:border-sky-400 hover:shadow-sky-100/40'
    };
  }

  // 8. Battery Replacement
  if (norm.includes('battery') || norm.includes('drain') || norm.includes('batt') || norm.includes('backup') || norm.includes('cell')) {
    return {
      icon: Battery,
      name: 'Battery Replacement',
      bgClass: 'bg-emerald-50',
      textClass: 'text-emerald-700',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
      iconClass: 'text-emerald-600',
      gradientClass: 'from-emerald-500/10 to-emerald-500/5',
      cardHover: 'hover:border-emerald-400 hover:shadow-emerald-100/40'
    };
  }

  // 9. Charging Port & Pin (Type-C, Lightning, USB)
  if (norm.includes('charging') || norm.includes('charge') || norm.includes('port') || norm.includes('usb') || norm.includes('pin') || norm.includes('type-c') || norm.includes('socket')) {
    return {
      icon: Zap,
      name: 'Charging Port & Pin',
      bgClass: 'bg-indigo-50',
      textClass: 'text-indigo-700',
      badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
      iconClass: 'text-indigo-600',
      gradientClass: 'from-indigo-500/10 to-indigo-500/5',
      cardHover: 'hover:border-indigo-400 hover:shadow-indigo-100/40'
    };
  }

  // 10. Camera Module & Lens
  if (norm.includes('camera') || norm.includes('lens') || norm.includes('sensor') || norm.includes('cam') || norm.includes('visor')) {
    return {
      icon: Camera,
      name: 'Camera & Lens',
      bgClass: 'bg-purple-50',
      textClass: 'text-purple-700',
      badgeClass: 'bg-purple-50 text-purple-700 border-purple-200/80',
      iconClass: 'text-purple-600',
      gradientClass: 'from-purple-500/10 to-purple-500/5',
      cardHover: 'hover:border-purple-400 hover:shadow-purple-100/40'
    };
  }

  // 11. Motherboard & IC Micro-Soldering (CPU, Short circuit, Power IC)
  if (norm.includes('ic') || norm.includes('motherboard') || norm.includes('board') || norm.includes('chip') || norm.includes('soldering') || norm.includes('cpu') || norm.includes('logic') || norm.includes('short')) {
    return {
      icon: Cpu,
      name: 'Motherboard & IC',
      bgClass: 'bg-violet-50',
      textClass: 'text-violet-700',
      badgeClass: 'bg-violet-50 text-violet-700 border-violet-200/80',
      iconClass: 'text-violet-600',
      gradientClass: 'from-violet-500/10 to-violet-500/5',
      cardHover: 'hover:border-violet-400 hover:shadow-violet-100/40'
    };
  }

  // 12. Back Glass & Panel (Rear housing, door, back cover)
  if (norm.includes('back') || norm.includes('panel') || norm.includes('housing') || norm.includes('body') || norm.includes('rear glass') || norm.includes('cover') || norm.includes('glyph')) {
    return {
      icon: Layers,
      name: 'Back Glass & Panel',
      bgClass: 'bg-slate-100',
      textClass: 'text-slate-700',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200/80',
      iconClass: 'text-slate-600',
      gradientClass: 'from-slate-500/10 to-slate-500/5',
      cardHover: 'hover:border-slate-400 hover:shadow-slate-100/40'
    };
  }

  // 13. Water Damage Revival (Ultrasonic deoxidation)
  if (norm.includes('water') || norm.includes('liquid') || norm.includes('corrosion') || norm.includes('moisture') || norm.includes('wet') || norm.includes('ultrasonic')) {
    return {
      icon: Droplets,
      name: 'Water Damage Revival',
      bgClass: 'bg-blue-50',
      textClass: 'text-blue-700',
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200/80',
      iconClass: 'text-blue-600',
      gradientClass: 'from-blue-500/10 to-blue-500/5',
      cardHover: 'hover:border-blue-400 hover:shadow-blue-100/40'
    };
  }

  // 14. Software & Firmware (Flashing, Bootloop, Unlock, OS)
  if (norm.includes('software') || norm.includes('unlock') || norm.includes('flash') || norm.includes('bootloop') || norm.includes('logo') || norm.includes('firmware') || norm.includes('ios') || norm.includes('android')) {
    return {
      icon: Cpu,
      name: 'Software & Flash',
      bgClass: 'bg-pink-50',
      textClass: 'text-pink-700',
      badgeClass: 'bg-pink-50 text-pink-700 border-pink-200/80',
      iconClass: 'text-pink-600',
      gradientClass: 'from-pink-500/10 to-pink-500/5',
      cardHover: 'hover:border-pink-400 hover:shadow-pink-100/40'
    };
  }

  // 15. Face ID / Fingerprint / Touch ID / Biometrics
  if (norm.includes('face id') || norm.includes('fingerprint') || norm.includes('touch id') || norm.includes('biometric') || norm.includes('truedepth')) {
    return {
      icon: Fingerprint,
      name: 'Biometrics & Face ID',
      bgClass: 'bg-fuchsia-50',
      textClass: 'text-fuchsia-700',
      badgeClass: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200/80',
      iconClass: 'text-fuchsia-600',
      gradientClass: 'from-fuchsia-500/10 to-fuchsia-500/5',
      cardHover: 'hover:border-fuchsia-400 hover:shadow-fuchsia-100/40'
    };
  }

  // 16. Network & Signal (Wifi, SIM, Signal, 5G, Baseband, Bluetooth)
  if (norm.includes('network') || norm.includes('signal') || norm.includes('wifi') || norm.includes('sim') || norm.includes('baseband') || norm.includes('antenna') || norm.includes('bluetooth')) {
    return {
      icon: Wifi,
      name: 'Network & Signal',
      bgClass: 'bg-lime-50',
      textClass: 'text-lime-700',
      badgeClass: 'bg-lime-50 text-lime-700 border-lime-200/80',
      iconClass: 'text-lime-600',
      gradientClass: 'from-lime-500/10 to-lime-500/5',
      cardHover: 'hover:border-lime-400 hover:shadow-lime-100/40'
    };
  }

  // 17. Button & Keys (Power button, Volume keys, Switch)
  if (norm.includes('button') || norm.includes('power key') || norm.includes('volume button') || norm.includes('switch') || norm.includes('key')) {
    return {
      icon: Power,
      name: 'Button & Switch',
      bgClass: 'bg-yellow-50',
      textClass: 'text-yellow-700',
      badgeClass: 'bg-yellow-50 text-yellow-700 border-yellow-200/80',
      iconClass: 'text-yellow-600',
      gradientClass: 'from-yellow-500/10 to-yellow-500/5',
      cardHover: 'hover:border-yellow-400 hover:shadow-yellow-100/40'
    };
  }

  // 18. Vibration Motor / Taptic Engine
  if (norm.includes('vibrat') || norm.includes('taptic') || norm.includes('haptic') || norm.includes('motor')) {
    return {
      icon: Vibrate,
      name: 'Vibration Engine',
      bgClass: 'bg-emerald-50',
      textClass: 'text-emerald-700',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
      iconClass: 'text-emerald-600',
      gradientClass: 'from-emerald-500/10 to-emerald-500/5',
      cardHover: 'hover:border-emerald-400 hover:shadow-emerald-100/40'
    };
  }

  // 19. Flashlight / Torch
  if (norm.includes('flashlight') || norm.includes('torch') || norm.includes('flash led') || norm.includes('led')) {
    return {
      icon: Flashlight,
      name: 'Flashlight & Torch',
      bgClass: 'bg-amber-50',
      textClass: 'text-amber-700',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200/80',
      iconClass: 'text-amber-600',
      gradientClass: 'from-amber-500/10 to-amber-500/5',
      cardHover: 'hover:border-amber-400 hover:shadow-amber-100/40'
    };
  }

  // Safe Default Smartphone Hardware Service
  return {
    icon: Smartphone,
    name: categoryName || 'Smartphone Service',
    bgClass: 'bg-slate-50',
    textClass: 'text-slate-700',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200/80',
    iconClass: 'text-slate-600',
    gradientClass: 'from-slate-500/10 to-slate-500/5',
    cardHover: 'hover:border-slate-300 hover:shadow-slate-100/40'
  };
}

export default function Services() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthStore();

  const cachedServices = useServiceCache((state) => state.services);
  const cachedFilters = useServiceCache((state) => state.filters);
  const setCachedServices = useServiceCache((state) => state.setServices);
  const setCachedFilters = useServiceCache((state) => state.setFilters);
  const isCacheStale = useServiceCache((state) => state.isStale);

  const [prices, setPrices] = useState<RepairPriceItem[]>(() => {
    return cachedServices && cachedServices.length > 0 ? cachedServices : [];
  });
  const [loading, setLoading] = useState(() => {
    return !cachedServices || cachedServices.length === 0;
  });
  const [error, setError] = useState<string | null>(null);

  // Memoized deterministic service slug map
  const { serviceIdToSlug } = useMemo(() => buildSlugMap(prices), [prices]);

  // Search input and applied active filters - initialized from cachedFilters
  const [searchInput, setSearchInput] = useState(() => cachedFilters.searchInput || '');
  const [activeQuery, setActiveQuery] = useState(() => cachedFilters.activeQuery || '');
  const [selectedBrand, setSelectedBrand] = useState(() => cachedFilters.selectedBrand || 'All Brands');
  const [selectedCategory, setSelectedCategory] = useState(() => cachedFilters.selectedCategory || 'all');
  const [selectedDeviceType, setSelectedDeviceType] = useState<DeviceTypeId>(() => cachedFilters.selectedDeviceType || 'all');
  const [sortBy, setSortBy] = useState<'recommended' | 'priceLow' | 'priceHigh' | 'deviceAsc'>(() => cachedFilters.sortBy || 'recommended');

  // Filter expansion state & mobile bottom sheet state
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(() => cachedFilters.isFiltersExpanded || false);
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);

  // Category horizontal scroll controls & state
  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Autocomplete suggestions state
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(() => cachedFilters.currentPage || 1);

  // Synchronize state back to cache store on changes
  useEffect(() => {
    setCachedFilters({
      searchInput,
      activeQuery,
      selectedBrand,
      selectedCategory,
      selectedDeviceType,
      sortBy,
      isFiltersExpanded,
      currentPage,
    });
  }, [searchInput, activeQuery, selectedBrand, selectedCategory, selectedDeviceType, sortBy, isFiltersExpanded, currentPage, setCachedFilters]);

  // Element refs for keyboard focus and smooth positioning
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const catalogSectionRef = useRef<HTMLElement>(null);

  const isAdmin = user && ['ADMIN', 'SUPER_ADMIN'].includes(user.role);

  // Fetch active repair prices from public API with background SWR support
  const fetchPrices = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground && (!cachedServices || cachedServices.length === 0)) {
        setLoading(true);
      }
      setError(null);
      const res = await fetch('/api/public/repair-prices');
      if (!res.ok) {
        throw new Error('Failed to load repair price catalog');
      }
      const data: RepairPriceItem[] = await res.json();
      const active = Array.isArray(data) ? data.filter(item => item.status === 'ACTIVE') : [];
      setPrices(active);
      setCachedServices(active);
    } catch (err: any) {
      console.error('Error fetching repair prices:', err);
      if (!isBackground && (!cachedServices || cachedServices.length === 0)) {
        setError('Unable to load repair services. Please try again or contact MTS Lab directly.');
      }
    } finally {
      if (!isBackground) {
        setLoading(false);
      }
    }
  }, [cachedServices, setCachedServices]);

  useEffect(() => {
    if (!cachedServices || cachedServices.length === 0) {
      fetchPrices(false);
    } else if (isCacheStale(5 * 60 * 1000)) {
      fetchPrices(true);
    }
  }, [fetchPrices, cachedServices, isCacheStale]);

  // Real-time synchronization
  useRealtimeSync(['repairPrice', 'repairprice', 'price', 'sync'], () => {
    fetchPrices(true);
  });

  // Dynamic brand list reflecting selected device form + actual catalog data
  const availableBrands = useMemo(() => {
    const baseBrands = DEVICE_BRAND_MAPPINGS[selectedDeviceType] || DEVICE_BRAND_MAPPINGS.all;
    const dynamicBrandsSet = new Set<string>();

    for (const item of prices) {
      if (!item.brand) continue;
      const itemType = (item.deviceType || '').toLowerCase();
      const fullText = `${item.brand} ${item.model} ${item.serviceName || ''} ${item.category || ''} ${item.notes || ''}`.toLowerCase();
      
      let matchesDev = true;
      if (selectedDeviceType === 'smartphone') {
        matchesDev = itemType === 'smartphone' || itemType === 'phone' || (!itemType && !fullText.includes('macbook') && !fullText.includes('laptop') && !fullText.includes('ipad') && !fullText.includes('tablet') && !fullText.includes('tv'));
      } else if (selectedDeviceType === 'laptop') {
        matchesDev = itemType === 'laptop' || fullText.includes('macbook') || fullText.includes('laptop') || fullText.includes('notebook') || fullText.includes('thinkpad');
      } else if (selectedDeviceType === 'tablet') {
        matchesDev = itemType === 'tablet' || itemType === 'ipad' || fullText.includes('ipad') || fullText.includes('tablet') || fullText.includes('galaxy tab');
      } else if (selectedDeviceType === 'tv') {
        matchesDev = itemType === 'smart tv' || itemType === 'tv' || fullText.includes('smart tv') || fullText.includes('television') || fullText.includes('oled tv') || fullText.includes('bravia');
      }

      if (matchesDev) {
        const b = item.brand.trim();
        if (b.toLowerCase() === 'iphone') {
          dynamicBrandsSet.add('Apple');
        } else {
          dynamicBrandsSet.add(b.charAt(0).toUpperCase() + b.slice(1));
        }
      }
    }

    const combined = ['All Brands'];
    const seen = new Set<string>(['all brands']);
    
    for (const b of baseBrands) {
      if (!seen.has(b.toLowerCase())) {
        seen.add(b.toLowerCase());
        combined.push(b);
      }
    }

    for (const b of dynamicBrandsSet) {
      if (!seen.has(b.toLowerCase())) {
        seen.add(b.toLowerCase());
        combined.push(b);
      }
    }

    return combined;
  }, [prices, selectedDeviceType]);

  // Reconcile brand selection when device type changes so user isn't stuck with invalid selection
  useEffect(() => {
    if (selectedBrand !== 'All Brands') {
      const isStillAvailable = availableBrands.some(
        b => b.toLowerCase() === selectedBrand.toLowerCase() ||
        (selectedBrand.toLowerCase() === 'apple' && b.toLowerCase() === 'iphone') ||
        (selectedBrand.toLowerCase() === 'iphone' && b.toLowerCase() === 'apple')
      );
      if (!isStillAvailable) {
        setSelectedBrand('All Brands');
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('brand');
        setSearchParams(newParams, { replace: true });
      }
    }
  }, [selectedDeviceType, availableBrands]);

  // Count of active advanced filters (categories + brands)
  const activeAdvancedFilterCount = useMemo(() => {
    let count = 0;
    if (selectedCategory !== 'all') count++;
    if (selectedBrand !== 'All Brands') count++;
    return count;
  }, [selectedCategory, selectedBrand]);

  // Total active filters count including device type and query
  const totalActiveFilterCount = useMemo(() => {
    let count = 0;
    if (selectedDeviceType !== 'all') count++;
    if (selectedCategory !== 'all') count++;
    if (selectedBrand !== 'All Brands') count++;
    if (activeQuery) count++;
    return count;
  }, [selectedDeviceType, selectedCategory, selectedBrand, activeQuery]);

  // Check category scroll capability
  const checkCategoryScroll = () => {
    const el = categoryScrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 5);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 5);
  };

  useEffect(() => {
    checkCategoryScroll();
    const el = categoryScrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkCategoryScroll, { passive: true });
    window.addEventListener('resize', checkCategoryScroll);
    return () => {
      el.removeEventListener('scroll', checkCategoryScroll);
      window.removeEventListener('resize', checkCategoryScroll);
    };
  }, [isFiltersExpanded]);

  const handleScrollCategories = (direction: 'left' | 'right') => {
    const el = categoryScrollRef.current;
    if (!el) return;
    const delta = direction === 'left' ? -280 : 280;
    el.scrollBy({ left: delta, behavior: 'smooth' });
    setTimeout(checkCategoryScroll, 300);
  };

  // Handle URL query parameters
  useEffect(() => {
    const modelParam = searchParams.get('model');
    const q = searchParams.get('q') || searchParams.get('search');
    if (modelParam) {
      const cleanModel = modelParam.replace(/-/g, ' ').replace(/\biphone\b/gi, 'iPhone');
      setSearchInput(cleanModel);
      setActiveQuery(cleanModel);
    } else if (q !== null) {
      setSearchInput(q);
      setActiveQuery(q);
    }
    const dev = searchParams.get('deviceType') as DeviceTypeId | null;
    if (dev && ['all', 'smartphone', 'laptop', 'tablet', 'tv'].includes(dev)) {
      setSelectedDeviceType(dev);
    }
    const brand = searchParams.get('brand');
    if (brand) {
      setSelectedBrand(brand);
      setIsFiltersExpanded(true);
    }
    const category = searchParams.get('category');
    if (category) {
      setSelectedCategory(category);
      setIsFiltersExpanded(true);
    }
    const sortParam = searchParams.get('sort');
    if (sortParam && ['recommended', 'priceLow', 'priceHigh', 'deviceAsc'].includes(sortParam)) {
      setSortBy(sortParam as any);
    }
    const pageParam = searchParams.get('page');
    if (pageParam && !isNaN(parseInt(pageParam))) {
      setCurrentPage(Math.max(1, parseInt(pageParam)));
    }

    if (searchParams.get('focus') === 'search') {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }
  }, [location.search]);

  // Mobile bottom sheet escape listener and body scroll lock
  useEffect(() => {
    if (isMobileSheetOpen) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setIsMobileSheetOpen(false);
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      document.body.style.overflow = '';
    }
  }, [isMobileSheetOpen]);

  // Execute search function
  const executeSearch = (searchTerm: string) => {
    const trimmed = searchTerm.trim();
    setActiveQuery(trimmed);
    setSearchInput(trimmed);
    setCurrentPage(1);
    
    const newParams = new URLSearchParams(searchParams);
    if (trimmed) {
      newParams.set('q', trimmed);
    } else {
      newParams.delete('q');
    }
    newParams.delete('page');
    setSearchParams(newParams, { replace: true });

    if (trimmed && catalogSectionRef.current) {
      setTimeout(() => {
        const navOffset = 90;
        const targetTop = catalogSectionRef.current!.getBoundingClientRect().top + window.pageYOffset - navOffset;
        window.scrollTo({
          top: Math.max(0, targetTop),
          behavior: 'smooth'
        });
      }, 60);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(searchInput);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setActiveQuery('');
    setCurrentPage(1);
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('q');
    newParams.delete('page');
    setSearchParams(newParams, { replace: true });
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const handleResetAllFilters = () => {
    setSearchInput('');
    setActiveQuery('');
    setSelectedBrand('All Brands');
    setSelectedCategory('all');
    setSelectedDeviceType('all');
    setSortBy('recommended');
    setCurrentPage(1);
    setSearchParams({}, { replace: true });
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  // Autocomplete Suggestions computation with Dynamic Service & Category Icons
  const autoSuggestions = useMemo(() => {
    const query = searchInput.trim().toLowerCase();
    if (!query || query.length < 2) return [];

    const results: {
      type: 'model' | 'service' | 'category';
      title: string;
      subtitle: string;
      query: string;
      icon: React.ElementType;
      iconClass?: string;
      bgClass?: string;
      price?: number;
      priceType?: 'FIXED' | 'STARTING_FROM' | 'ON_INSPECTION' | 'CONTACT_FOR_PRICE';
    }[] = [];
    const seen = new Set<string>();

    for (const item of prices) {
      const fullDevice = `${item.brand} ${item.model}`;
      const serviceName = item.serviceName || item.problem;
      const category = item.category;
      const catInfo = getCategoryInfo(category, serviceName);

      if (fullDevice.toLowerCase().includes(query) && !seen.has(`model-${fullDevice.toLowerCase()}`)) {
        seen.add(`model-${fullDevice.toLowerCase()}`);
        const DevIcon = item.deviceType === 'Laptop' ? Laptop 
          : item.deviceType === 'Tablet' ? Tablet 
          : item.deviceType === 'TV' || item.deviceType === 'Smart TV' ? Tv 
          : Smartphone;
        results.push({
          type: 'model',
          title: fullDevice,
          subtitle: `${item.brand} Hardware Series`,
          query: fullDevice,
          icon: DevIcon,
          iconClass: 'text-indigo-600 dark:text-indigo-400',
          bgClass: 'bg-indigo-50 dark:bg-indigo-950/60'
        });
      }

      if (serviceName.toLowerCase().includes(query) && !seen.has(`svc-${serviceName.toLowerCase()}`)) {
        seen.add(`svc-${serviceName.toLowerCase()}`);
        results.push({
          type: 'service',
          title: serviceName,
          subtitle: `${item.brand} ${item.model} • ${category}`,
          query: serviceName,
          icon: catInfo.icon,
          iconClass: catInfo.iconClass,
          bgClass: catInfo.bgClass,
          price: item.price,
          priceType: item.priceType
        });
      }

      if (category.toLowerCase().includes(query) && !seen.has(`cat-${category.toLowerCase()}`)) {
        seen.add(`cat-${category.toLowerCase()}`);
        const catOnlyInfo = getCategoryInfo(category);
        results.push({
          type: 'category',
          title: category,
          subtitle: 'Browse Service Category',
          query: category,
          icon: catOnlyInfo.icon,
          iconClass: catOnlyInfo.iconClass,
          bgClass: catOnlyInfo.bgClass
        });
      }

      if (results.length >= 8) break;
    }
    return results;
  }, [searchInput, prices]);

  // Click outside listener for suggestions popup
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSuggestionsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCategoryClick = (catId: string) => {
    setCurrentPage(1);
    if (selectedCategory === catId) {
      setSelectedCategory('all');
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('category');
      newParams.delete('page');
      setSearchParams(newParams, { replace: true });
    } else {
      setSelectedCategory(catId);
      const newParams = new URLSearchParams(searchParams);
      if (catId === 'all') {
        newParams.delete('category');
      } else {
        newParams.set('category', catId);
      }
      newParams.delete('page');
      setSearchParams(newParams, { replace: true });
    }
  };

  const handleBrandClick = (brand: string) => {
    setSelectedBrand(brand);
    setCurrentPage(1);
    const newParams = new URLSearchParams(searchParams);
    if (brand === 'All Brands') {
      newParams.delete('brand');
    } else {
      newParams.set('brand', brand);
    }
    newParams.delete('page');
    setSearchParams(newParams, { replace: true });
  };

  const handleDeviceTypeClick = (devId: DeviceTypeId) => {
    setSelectedDeviceType(devId);
    setCurrentPage(1);
    const newParams = new URLSearchParams(searchParams);
    if (devId === 'all') {
      newParams.delete('deviceType');
    } else {
      newParams.set('deviceType', devId);
    }
    newParams.delete('page');
    setSearchParams(newParams, { replace: true });
  };

  const handleClearAdvancedFilters = () => {
    setSelectedBrand('All Brands');
    setSelectedCategory('all');
    setCurrentPage(1);
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('brand');
    newParams.delete('category');
    newParams.delete('page');
    setSearchParams(newParams, { replace: true });
  };


  // Smart Search & Scoring Algorithm + Category & Brand Filtering
  const filteredAndRankedPrices = useMemo(() => {
    let list = prices;

    // 0. Filter by Device Type (All, Smartphone & iPhone, Laptop, Tablet & iPad, Smart TV)
    if (selectedDeviceType !== 'all') {
      list = list.filter(item => {
        const itemType = (item.deviceType || '').toLowerCase();
        const fullText = `${item.brand || ''} ${item.model || ''} ${item.serviceName || ''} ${item.category || ''} ${item.notes || ''}`.toLowerCase();

        if (selectedDeviceType === 'smartphone') {
          if (itemType === 'smartphone' || itemType === 'phone') return true;
          const isLaptop = fullText.includes('macbook') || fullText.includes('laptop') || fullText.includes('notebook') || fullText.includes('thinkpad');
          const isTablet = fullText.includes('ipad') || fullText.includes('tablet') || fullText.includes('galaxy tab');
          const isTv = fullText.includes('tv') || fullText.includes('smart tv') || fullText.includes('television') || fullText.includes('oled tv');
          if (!itemType && !isLaptop && !isTablet && !isTv) return true;
          return false;
        }

        if (selectedDeviceType === 'laptop') {
          if (itemType === 'laptop') return true;
          return fullText.includes('macbook') || fullText.includes('laptop') || fullText.includes('notebook') || fullText.includes('thinkpad');
        }

        if (selectedDeviceType === 'tablet') {
          if (itemType === 'tablet' || itemType === 'ipad') return true;
          return fullText.includes('ipad') || fullText.includes('tablet') || fullText.includes('galaxy tab');
        }

        if (selectedDeviceType === 'tv') {
          if (itemType === 'smart tv' || itemType === 'tv') return true;
          return fullText.includes('smart tv') || fullText.includes('television') || fullText.includes('oled tv') || fullText.includes('bravia');
        }

        return false;
      });
    }

    // 1. Filter by Brand (with smart alias matching, e.g. Apple <-> Iphone)
    if (selectedBrand !== 'All Brands') {
      list = list.filter(item => {
        const b = (item.brand || '').toLowerCase().trim();
        const sel = selectedBrand.toLowerCase().trim();
        if (b === sel) return true;
        if (sel === 'apple' && (b === 'iphone' || b.includes('apple'))) return true;
        if (sel === 'iphone' && (b === 'apple' || b.includes('iphone'))) return true;
        return false;
      });
    }

    // 2. Filter by Category
    if (selectedCategory !== 'all') {
      const normCat = normalizeText(selectedCategory);
      list = list.filter(item => {
        const itemCat = normalizeText(item.category);
        const itemService = normalizeText(item.serviceName || '');
        const itemProblem = normalizeText(item.problem || '');
        const itemDesc = normalizeText(item.description || '');
        const itemNotes = normalizeText(item.notes || '');

        if (normCat === 'front glass') {
          if (itemCat === 'front glass' || itemCat.includes('front glass')) return true;
          if (itemCat.includes('glass') && !itemCat.includes('back') && !itemCat.includes('rear')) return true;
          const isFrontGlassService = 
            itemService.includes('front glass') ||
            itemService.includes('outer glass') ||
            itemService.includes('glass change') ||
            itemService.includes('glass replacement') ||
            itemService.includes('screen glass') ||
            itemService.includes('touch glass') ||
            itemService.includes('oca glass') ||
            itemProblem.includes('front glass') ||
            itemProblem.includes('outer glass') ||
            itemDesc.includes('front glass') ||
            itemDesc.includes('outer glass');
          const isBackGlass = itemCat.includes('back') || itemService.includes('back glass') || itemProblem.includes('back glass');
          return isFrontGlassService && !isBackGlass;
        }

        if (normCat === 'back glass' || normCat === 'back panel') {
          return (
            itemCat.includes('back') ||
            itemCat.includes('rear') ||
            itemCat.includes('panel') ||
            itemService.includes('back glass') ||
            itemService.includes('back panel') ||
            itemService.includes('rear glass') ||
            itemProblem.includes('back glass') ||
            itemProblem.includes('rear glass') ||
            itemProblem.includes('back panel')
          );
        }

        if (normCat === 'display') {
          return itemCat.includes('display') || itemCat.includes('screen');
        }

        if (normCat === 'lining') {
          return (
            itemCat === 'lining' ||
            itemCat.includes('lining') ||
            itemService.includes('lining') ||
            itemService.includes('laser line') ||
            itemProblem.includes('line') ||
            itemProblem.includes('lining') ||
            itemProblem.includes('laser')
          );
        }

        if (normCat === 'flex change' || normCat === 'flex') {
          return (
            itemCat === 'flex change' ||
            itemCat === 'flex' ||
            itemCat.includes('flex') ||
            itemService.includes('flex') ||
            itemProblem.includes('flex')
          );
        }

        if (normCat === 'green white screen' || (normCat.includes('green') && normCat.includes('white')) || normCat.includes('green') || normCat.includes('white')) {
          return (
            itemCat === 'green / white screen' ||
            itemCat.includes('green') ||
            itemCat.includes('white') ||
            itemService.includes('green') ||
            itemService.includes('white') ||
            itemProblem.includes('green') ||
            itemProblem.includes('white')
          );
        }

        if (normCat === 'battery') {
          return itemCat.includes('battery') || itemService.includes('battery') || itemProblem.includes('battery');
        }

        if (normCat === 'charging') {
          return itemCat.includes('charging') || itemService.includes('charging') || itemProblem.includes('charging') || itemService.includes('port');
        }

        if (normCat === 'camera') {
          return itemCat.includes('camera') || itemService.includes('camera') || itemProblem.includes('camera');
        }

        if (normCat === 'speaker') {
          return (
            itemCat.includes('speaker') || 
            itemCat.includes('sound') || 
            itemCat.includes('audio') || 
            itemService.includes('speaker') ||
            itemService.includes('audio') ||
            itemService.includes('earpiece')
          );
        }

        if (normCat === 'motherboard ic' || normCat.includes('motherboard') || normCat.includes('ic')) {
          return (
            itemCat.includes('motherboard') || 
            itemCat.includes('ic') || 
            itemCat.includes('board') ||
            itemService.includes('ic') ||
            itemService.includes('motherboard') ||
            itemProblem.includes('ic')
          );
        }

        if (normCat === 'water damage') {
          return itemCat.includes('water') || itemCat.includes('liquid') || itemProblem.includes('water') || itemProblem.includes('liquid');
        }

        if (normCat === 'software') {
          return itemCat.includes('software') || itemService.includes('software') || itemProblem.includes('software');
        }

        return itemCat.includes(normCat) || itemService.includes(normCat) || itemProblem.includes(normCat);
      });
    }

    // 3. Search Query Ranking
    const query = activeQuery.trim();
    if (!query) {
      return sortList(list, sortBy);
    }

    const queryNorm = normalizeText(query);
    const tokens = queryNorm.split(' ').filter(Boolean);

    const scoredItems = list.map(item => {
      const brandNorm = normalizeText(item.brand);
      const modelNorm = normalizeText(item.model);
      const variantNorm = normalizeText(item.variant || '');
      const categoryNorm = normalizeText(item.category);
      const problemNorm = normalizeText(item.problem || '');
      const serviceNorm = normalizeText(item.serviceName || '');
      const descNorm = normalizeText(item.description || '');
      const notesNorm = normalizeText(item.notes || '');

      const fullDeviceName = `${brandNorm} ${modelNorm} ${variantNorm}`.trim();
      const allText = `${fullDeviceName} ${categoryNorm} ${problemNorm} ${serviceNorm} ${descNorm} ${notesNorm}`;

      let allTokensMatch = true;
      let score = 0;

      for (const token of tokens) {
        let tokenMatched = false;

        if (allText.includes(token)) {
          tokenMatched = true;
          if (fullDeviceName.includes(token)) score += 40;
          if (modelNorm.includes(token)) score += 35;
          if (serviceNorm.includes(token)) score += 30;
          if (categoryNorm.includes(token)) score += 25;
          if (problemNorm.includes(token)) score += 20;
          if (descNorm.includes(token)) score += 10;
        } else {
          const syns = SYNONYMS[token] || [];
          for (const syn of syns) {
            if (allText.includes(syn)) {
              tokenMatched = true;
              score += 15;
              break;
            }
          }
        }

        if (!tokenMatched) {
          if (token.startsWith('s') && token.length > 2 && fullDeviceName.includes(token.substring(1))) {
            tokenMatched = true;
            score += 25;
          } else if (token.startsWith('iphone') && token.length > 6) {
            const numPart = token.replace('iphone', '').trim();
            if (fullDeviceName.includes('iphone') && fullDeviceName.includes(numPart)) {
              tokenMatched = true;
              score += 35;
            }
          }
        }

        if (!tokenMatched) {
          allTokensMatch = false;
          break;
        }
      }

      if (allTokensMatch) {
        if (fullDeviceName === queryNorm) score += 100;
        else if (fullDeviceName.includes(queryNorm)) score += 60;
        if (serviceNorm.includes(queryNorm)) score += 50;
      }

      return {
        item,
        matches: allTokensMatch,
        score
      };
    });

    const matchingItems = scoredItems
      .filter(entry => entry.matches)
      .sort((a, b) => b.score - a.score)
      .map(entry => entry.item);

    if (sortBy !== 'recommended') {
      return sortList(matchingItems, sortBy);
    }

    return matchingItems;
  }, [prices, selectedBrand, selectedCategory, activeQuery, sortBy, selectedDeviceType]);

  function sortList(list: RepairPriceItem[], sortKey: string): RepairPriceItem[] {
    const copy = [...list];
    if (sortKey === 'priceLow') {
      return copy.sort((a, b) => {
        const pA = a.price > 0 ? a.price : 999999;
        const pB = b.price > 0 ? b.price : 999999;
        return pA - pB;
      });
    }
    if (sortKey === 'priceHigh') {
      return copy.sort((a, b) => (b.price || 0) - (a.price || 0));
    }
    if (sortKey === 'deviceAsc') {
      return copy.sort((a, b) => {
        const devA = `${a.brand} ${a.model}`.toLowerCase();
        const devB = `${b.brand} ${b.model}`.toLowerCase();
        return devA.localeCompare(devB);
      });
    }
    return copy;
  }

  // Calculate pagination
  const totalItems = filteredAndRankedPrices.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;
  const paginatedItems = useMemo(() => {
    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAndRankedPrices.slice(startIdx, startIdx + ITEMS_PER_PAGE);
  }, [filteredAndRankedPrices, currentPage]);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setCurrentPage(newPage);
    
    const newParams = new URLSearchParams(searchParams);
    if (newPage === 1) {
      newParams.delete('page');
    } else {
      newParams.set('page', newPage.toString());
    }
    setSearchParams(newParams, { replace: true });

    if (catalogSectionRef.current) {
      const navOffset = 90;
      const targetTop = catalogSectionRef.current.getBoundingClientRect().top + window.pageYOffset - navOffset;
      window.scrollTo({
        top: Math.max(0, targetTop),
        behavior: 'smooth'
      });
    }
  };

  // Rating Display Formatter
  const renderRatingStars = (rating?: number | null, ratingCount?: number | null) => {
    if (!rating || rating <= 0) return null;
    return (
      <div className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold text-amber-500 bg-amber-50/90 dark:bg-amber-950/60 border border-amber-200/70 dark:border-amber-800/80 px-1.5 py-0.5 rounded-md">
        <span>★</span>
        <span className="text-slate-800 dark:text-amber-200 font-extrabold">{rating.toFixed(1)}</span>
        {ratingCount !== undefined && ratingCount !== null && ratingCount > 0 && (
          <span className="text-slate-500 dark:text-amber-300/70 font-medium">({ratingCount})</span>
        )}
      </div>
    );
  };

  // Price Display Formatter
  const renderPriceBadge = (item: RepairPriceItem) => {
    const hasDiscount = item.originalPrice && item.originalPrice > item.price && item.price > 0;
    const discountPercent = hasDiscount
      ? Math.round(((item.originalPrice! - item.price) / item.originalPrice!) * 100)
      : 0;

    if (item.priceType === 'ON_INSPECTION') {
      return (
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 leading-none mb-1">
            Estimate
          </span>
          <span className="text-xs sm:text-sm md:text-base font-extrabold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200/80 dark:border-amber-800/80 px-2 sm:px-2.5 py-0.5 rounded-lg inline-block w-fit whitespace-nowrap">
            On Inspection
          </span>
        </div>
      );
    }

    if (item.priceType === 'CONTACT_FOR_PRICE' || (!item.price && item.priceType !== 'FIXED')) {
      return (
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 leading-none mb-1">
            Quotation
          </span>
          <span className="text-xs sm:text-sm md:text-base font-extrabold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 sm:px-2.5 py-0.5 rounded-lg inline-block w-fit whitespace-nowrap">
            Contact
          </span>
        </div>
      );
    }

    if (item.priceType === 'STARTING_FROM') {
      return (
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 leading-none mb-1">
            Starting From
          </span>
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-sm sm:text-base md:text-lg font-black text-slate-950 dark:text-white tracking-tight whitespace-nowrap">
              NPR {item.price.toLocaleString()}
            </span>
            {hasDiscount && (
              <>
                <span className="text-xs sm:text-sm font-semibold text-slate-400 dark:text-slate-500 line-through whitespace-nowrap">
                  NPR {item.originalPrice!.toLocaleString()}
                </span>
                <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/80 px-1.5 py-0.5 rounded whitespace-nowrap">
                  -{discountPercent}%
                </span>
              </>
            )}
          </div>
        </div>
      );
    }

    // Default FIXED
    return (
      <div className="flex flex-col min-w-0">
        <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 leading-none mb-1">
          Price
        </span>
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-sm sm:text-base md:text-lg font-black text-slate-950 dark:text-white tracking-tight whitespace-nowrap">
            NPR {item.price.toLocaleString()}
          </span>
          {hasDiscount && (
            <>
              <span className="text-xs sm:text-sm font-semibold text-slate-400 dark:text-slate-500 line-through whitespace-nowrap">
                NPR {item.originalPrice!.toLocaleString()}
              </span>
              <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/80 px-1.5 py-0.5 rounded whitespace-nowrap">
                -{discountPercent}%
              </span>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-slate-950 dark:selection:bg-indigo-600 selection:text-white antialiased">
      <PageSeo
        title={STATIC_PAGES_SEO['/services'].title}
        description={STATIC_PAGES_SEO['/services'].description}
        canonical={STATIC_PAGES_SEO['/services'].canonical}
        noindex={false}
        jsonLd={getLocalBusinessJsonLd()}
      />
      <Navbar />

      <main className="flex-1 pt-24 sm:pt-28 lg:pt-32 pb-16 px-2.5 sm:px-4 md:px-6 lg:px-8 max-w-7xl 2xl:max-w-[1600px] min-[1800px]:max-w-[1850px] mx-auto w-full space-y-4 sm:space-y-6">
        
        {/* Dedicated Breadcrumb Container */}
        <div className="w-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl px-3.5 sm:px-4 py-2.5 shadow-2xs">
          <nav 
            aria-label="Breadcrumb" 
            className="flex items-center text-xs sm:text-sm text-slate-500 dark:text-slate-400 gap-1.5 overflow-x-auto whitespace-nowrap py-0.5 min-w-0 max-w-full"
          >
            <Link to="/" className="hover:text-slate-900 dark:hover:text-white font-medium shrink-0 transition-colors">Home</Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
            <span 
              className="font-bold text-slate-900 dark:text-white shrink-0"
              aria-current="page"
            >
              Repair Services
            </span>
          </nav>
        </div>
        
        {/* ========================================================= */}
        {/* 1. HERO SECTION & E-COMMERCE STYLE SERVICE SEARCH BAR      */}
        {/* ========================================================= */}
        <section 
          id="service-catalog-hero"
          className="text-center max-w-3xl mx-auto space-y-3.5 pt-1 sm:pt-2"
        >
          {/* Badge Tag */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-950 dark:bg-slate-900 text-white text-[11px] font-black tracking-wider uppercase shadow-xs border border-transparent dark:border-slate-800">
            <Wrench className="w-3.5 h-3.5 text-amber-400" />
            <span>MTS Official Service Catalog</span>
          </div>

          {/* Heading */}
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black tracking-tight text-slate-950 dark:text-white">
              Smartphone Repair Services & Pricing
            </h1>
            <p className="text-xs sm:text-sm md:text-base text-slate-600 dark:text-slate-400 font-medium max-w-xl mx-auto leading-relaxed">
              Explore lab-certified hardware restoration services with transparent pricing and expert turnaround.
            </p>
          </div>

          {/* Large E-Commerce Style Search Bar */}
          <div className="pt-1.5">
            <div ref={searchContainerRef} className="relative">
              <form 
                id="service-search-form"
                onSubmit={handleSearchSubmit}
                className="relative flex items-center bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border-2 border-slate-200 dark:border-slate-700 shadow-md shadow-slate-200/50 dark:shadow-none focus-within:border-slate-950 dark:focus-within:border-slate-400 focus-within:ring-4 focus-within:ring-slate-950/5 transition-all p-1 sm:p-1.5"
              >
                <div className="relative flex-1 flex items-center min-h-[46px] sm:min-h-[50px] pl-3 pr-2">
                  <Search className="w-5 h-5 text-slate-400 shrink-0 ml-1" />
                  
                  <input
                    ref={searchInputRef}
                    type="text"
                    id="repair-catalog-search-input"
                    name="search"
                    autoFocus
                    autoComplete="off"
                    placeholder="Search by device model, repair type, or problem (e.g. iPhone 13, Screen, Battery)..."
                    value={searchInput}
                    onFocus={() => {
                      if (searchInput.trim().length >= 2) setIsSuggestionsOpen(true);
                    }}
                    onChange={(e) => {
                      setSearchInput(e.target.value);
                      setIsSuggestionsOpen(true);
                      setSelectedSuggestionIndex(-1);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        if (autoSuggestions.length > 0) {
                          setSelectedSuggestionIndex(prev => (prev < autoSuggestions.length - 1 ? prev + 1 : 0));
                        }
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        if (autoSuggestions.length > 0) {
                          setSelectedSuggestionIndex(prev => (prev > 0 ? prev - 1 : autoSuggestions.length - 1));
                        }
                      } else if (e.key === 'Enter') {
                        if (isSuggestionsOpen && selectedSuggestionIndex >= 0 && autoSuggestions[selectedSuggestionIndex]) {
                          e.preventDefault();
                          executeSearch(autoSuggestions[selectedSuggestionIndex].query);
                          setIsSuggestionsOpen(false);
                        } else {
                          e.preventDefault();
                          executeSearch(searchInput);
                          setIsSuggestionsOpen(false);
                        }
                      } else if (e.key === 'Escape') {
                        setIsSuggestionsOpen(false);
                      }
                    }}
                    className="w-full h-full border-0 focus:outline-none text-base md:text-sm font-semibold px-3 bg-transparent placeholder:text-slate-400 placeholder:font-normal text-slate-950 dark:text-white"
                    aria-label="Search repair catalog"
                  />

                  {searchInput && (
                    <button
                      type="button"
                      id="search-clear-btn"
                      onClick={handleClearSearch}
                      className="flex items-center gap-1 px-2 py-1 text-xs font-bold text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-all cursor-pointer mr-1 shrink-0"
                      title="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Clear</span>
                    </button>
                  )}
                </div>

                {/* Search Submit Button */}
                <button
                  type="submit"
                  id="search-action-btn"
                  className="h-10 px-4 sm:px-6 rounded-xl sm:rounded-2xl bg-slate-950 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-700 active:scale-[0.98] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer shrink-0"
                  aria-label="Search services"
                >
                  <Search className="w-4 h-4 text-amber-400" />
                  <span>Search</span>
                </button>
              </form>

              {/* Autocomplete Suggestions Dropdown with Dynamic Service Icons */}
              {isSuggestionsOpen && autoSuggestions.length > 0 && (
                <div 
                  id="search-autocomplete-dropdown"
                  className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden z-50 divide-y divide-slate-100 dark:divide-slate-800 text-left"
                >
                  <div className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800/80 flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <span>Suggested Searches</span>
                    <span className="text-[10px] font-medium text-slate-400">Click or press Enter to choose</span>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {autoSuggestions.map((item, idx) => {
                      const SuggestionIcon = item.icon || Wrench;
                      return (
                        <div
                          key={`${item.type}-${item.query}-${idx}`}
                          onClick={() => {
                            executeSearch(item.query);
                            setIsSuggestionsOpen(false);
                          }}
                          className={`px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors ${
                            selectedSuggestionIndex === idx ? 'bg-slate-100 dark:bg-slate-800' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${item.bgClass || 'bg-slate-100 dark:bg-slate-800'}`}>
                              <SuggestionIcon className={`w-4 h-4 ${item.iconClass || 'text-slate-600 dark:text-slate-400'}`} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">{item.title}</p>
                              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">{item.subtitle}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {item.price !== undefined && item.price > 0 && (
                              <span className="text-[11px] sm:text-xs font-black text-slate-900 dark:text-white whitespace-nowrap">
                                {item.priceType === 'STARTING_FROM' ? 'From ' : ''}NPR {item.price.toLocaleString()}
                              </span>
                            )}
                            <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded shrink-0">
                              {item.type}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Popular Search Suggestions Chips with Dynamic Icons */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 mt-2.5 text-xs">
              <span className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider text-[10px] mr-0.5">
                Trending:
              </span>
              {POPULAR_SEARCH_KEYWORDS.map(({ text, icon: ChipIcon }) => (
                <button
                  key={text}
                  type="button"
                  onClick={() => executeSearch(text)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer border ${
                    activeQuery.toLowerCase() === text.toLowerCase()
                      ? 'bg-slate-950 dark:bg-indigo-600 text-white border-slate-950 dark:border-indigo-600 shadow-2xs'
                      : 'bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 hover:text-slate-950 dark:hover:text-white'
                  }`}
                >
                  <ChipIcon className="w-3 h-3 text-amber-500 shrink-0" />
                  <span>{text}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Admin shortcut button if logged in */}
          {isAdmin && (
            <div className="pt-0.5">
              <button
                type="button"
                onClick={() => navigate('/dashboard/repair-prices')}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                <span>Admin: Manage Catalog & Prices</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </section>

        {/* ========================================================= */}
        {/* 2. DEVICE FORM SELECTOR & COLLAPSIBLE FILTERS BAR         */}
        {/* ========================================================= */}
        <section 
          id="service-filters-section"
          aria-label="Service Filters and Hardware Navigation"
          className="space-y-3 bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xs"
        >
          {/* Main Top Bar: Device Selector + Filters & Brands Toggle */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
            
            {/* Left: Hardware Device Form Tabs */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1.5 sm:hidden">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                  <span>Hardware Device</span>
                </span>
                {selectedDeviceType !== 'all' && (
                  <button
                    type="button"
                    onClick={() => handleDeviceTypeClick('all')}
                    className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    All Devices
                  </button>
                )}
              </div>

              <div 
                role="tablist" 
                aria-label="Hardware Device Form"
                className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none"
              >
                {DEVICE_OPTIONS.map((dev) => {
                  const isSelected = selectedDeviceType === dev.id;
                  const Icon = dev.icon;
                  return (
                    <button
                      key={dev.id}
                      id={`device-type-${dev.id}`}
                      role="tab"
                      aria-selected={isSelected}
                      aria-controls="services-catalog-results"
                      type="button"
                      onClick={() => handleDeviceTypeClick(dev.id)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 dark:focus-visible:ring-indigo-400 select-none ${
                        isSelected
                          ? 'bg-slate-950 dark:bg-indigo-600 text-white border-slate-950 dark:border-indigo-600 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-950 dark:hover:text-white active:scale-95'
                      }`}
                      title={dev.description}
                    >
                      <Icon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-amber-400' : 'text-slate-400'}`} />
                      <span>{dev.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right: Filters & Brands Toggle Button (Desktop & Mobile triggers) */}
            <div className="flex items-center gap-2 shrink-0 pt-1 lg:pt-0 border-t border-slate-100 dark:border-slate-800 lg:border-t-0">
              
              {/* Dynamic Toggle Button */}
              <button
                type="button"
                id="toggle-filters-brands-btn"
                aria-expanded={isFiltersExpanded}
                aria-controls="advanced-filters-panel"
                onClick={() => {
                  if (typeof window !== 'undefined' && window.innerWidth < 768) {
                    setIsMobileSheetOpen(true);
                  } else {
                    setIsFiltersExpanded(prev => !prev);
                  }
                }}
                className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 h-10 px-3.5 rounded-xl font-bold text-xs transition-all cursor-pointer border select-none ${
                  activeAdvancedFilterCount > 0 || isFiltersExpanded
                    ? 'bg-slate-900 dark:bg-slate-800 text-white border-slate-900 dark:border-slate-700 shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-200/80 dark:hover:bg-slate-700'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Filters & Brands</span>
                
                {/* Active Filter Counter Badge */}
                {activeAdvancedFilterCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-[11px] font-black rounded-full bg-amber-400 text-slate-950 shrink-0 shadow-2xs">
                    {activeAdvancedFilterCount}
                  </span>
                )}

                {/* Desktop Chevron Indicator */}
                <span className="hidden md:inline-block ml-0.5">
                  {isFiltersExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  )}
                </span>
              </button>

              {/* Reset/Clear All Shortcut if any filter is active */}
              {totalActiveFilterCount > 0 && (
                <button
                  type="button"
                  onClick={handleResetAllFilters}
                  title="Clear all active filters"
                  className="h-10 px-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Clear All</span>
                </button>
              )}
            </div>

          </div>

          {/* ========================================================= */}
          {/* ADVANCED FILTER PANEL (Desktop & Tablet Collapsible)       */}
          {/* ========================================================= */}
          {isFiltersExpanded && (
            <div 
              id="advanced-filters-panel"
              role="region"
              aria-label="Service Categories and Brand Filters"
              className="pt-3 space-y-4 border-t border-slate-100 dark:border-slate-800 animate-in fade-in-50 slide-in-from-top-2 duration-200"
            >
              
              {/* Service Categories Horizontal Browser */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-slate-400" />
                    <span>Service Categories</span>
                    {selectedCategory !== 'all' && (
                      <Badge variant="outline" className="text-[10px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 py-0 px-1.5">
                        {selectedCategory}
                      </Badge>
                    )}
                  </span>
                  
                  <div className="flex items-center gap-2">
                    {selectedCategory !== 'all' && (
                      <button
                        type="button"
                        onClick={() => handleCategoryClick('all')}
                        className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                      >
                        All Categories
                      </button>
                    )}

                    {/* Scroll Buttons for Categories */}
                    <div className="hidden sm:flex items-center gap-1">
                      <button
                        type="button"
                        aria-label="Scroll categories left"
                        onClick={() => handleScrollCategories('left')}
                        disabled={!canScrollLeft}
                        className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Scroll categories right"
                        onClick={() => handleScrollCategories('right')}
                        disabled={!canScrollRight}
                        className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Horizontal Scrollable Categories Container with Fade Masks */}
                <div className="relative group/scroll">
                  {canScrollLeft && (
                    <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white dark:from-slate-900 to-transparent pointer-events-none z-10 hidden sm:block" />
                  )}
                  {canScrollRight && (
                    <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white dark:from-slate-900 to-transparent pointer-events-none z-10 hidden sm:block" />
                  )}

                  <div 
                    ref={categoryScrollRef}
                    className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-thin scroll-smooth"
                  >
                    {POPULAR_CATEGORIES.map((cat) => {
                      const IconComponent = cat.icon;
                      const isSelected = selectedCategory === cat.id;
                      const catElementId = `category-chip-${cat.id.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

                      return (
                        <button
                          key={cat.id}
                          id={catElementId}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => handleCategoryClick(cat.id)}
                          className={`flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 dark:focus-visible:ring-indigo-400 select-none ${
                            isSelected
                              ? 'bg-slate-950 dark:bg-indigo-600 text-white border-slate-950 dark:border-indigo-600 shadow-xs'
                              : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-950 dark:hover:text-white active:scale-95'
                          }`}
                        >
                          <IconComponent className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-amber-400' : 'text-slate-500 dark:text-slate-400'}`} />
                          <span>{cat.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Dynamic Brand Filter tailored to device selection */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                    <span>Filter by Brand</span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      ({availableBrands.length - 1} compatible)
                    </span>
                  </span>

                  {selectedBrand !== 'All Brands' && (
                    <button
                      type="button"
                      onClick={() => handleBrandClick('All Brands')}
                      className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      Reset Brand
                    </button>
                  )}
                </div>

                <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 scrollbar-thin">
                  {availableBrands.map((brand) => {
                    const isSelected = selectedBrand.toLowerCase() === brand.toLowerCase() ||
                      (selectedBrand.toLowerCase() === 'all brands' && brand === 'All Brands');

                    return (
                      <button
                        key={brand}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => handleBrandClick(brand)}
                        className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 dark:focus-visible:ring-indigo-400 select-none ${
                          isSelected
                            ? 'bg-slate-900 dark:bg-indigo-600 text-white border-slate-900 dark:border-indigo-600 shadow-2xs'
                            : 'bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {brand}
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

        </section>

        {/* ========================================================= */}
        {/* 3. CATALOG CONTROL BAR (COUNT, SORT, RESET)               */}
        {/* ========================================================= */}
        <section ref={catalogSectionRef} className="space-y-4 scroll-mt-24">
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 px-1">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg sm:text-xl md:text-2xl font-black text-slate-950 dark:text-white tracking-tight">
                  {activeQuery ? 'Search Results' : 'Available Services'}
                </h2>
                <Badge variant="outline" className="font-extrabold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-xs px-2 py-0.5 shadow-2xs">
                  {totalItems} {totalItems === 1 ? 'service' : 'services'}
                </Badge>
              </div>
              {activeQuery && (
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Showing results for <span className="font-bold text-slate-950 dark:text-white">"{activeQuery}"</span>
                </p>
              )}
            </div>

            {/* Sorting & Reset Controls */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 shadow-2xs">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[11px] text-slate-400 dark:text-slate-500 font-normal">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-transparent border-0 font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer pr-1 text-base md:text-xs"
                >
                  <option value="recommended" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">Recommended</option>
                  <option value="priceLow" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">Price: Low to High</option>
                  <option value="priceHigh" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">Price: High to Low</option>
                  <option value="deviceAsc" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">Device: A to Z</option>
                </select>
              </div>

              {totalActiveFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetAllFilters}
                  className="text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl cursor-pointer h-8 px-2.5"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1" />
                  Reset
                </Button>
              )}
            </div>
          </div>

          {/* Active Filter Chips Bar */}
          {totalActiveFilterCount > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-1 pb-0.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 mr-1 flex items-center gap-1">
                <Filter className="w-3 h-3" />
                <span>Active Filters:</span>
              </span>

              {/* Device Chip */}
              {selectedDeviceType !== 'all' && (
                <span className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold">
                  <span>Device: {DEVICE_OPTIONS.find(d => d.id === selectedDeviceType)?.label}</span>
                  <button
                    type="button"
                    onClick={() => handleDeviceTypeClick('all')}
                    aria-label="Remove device filter"
                    className="p-0.5 hover:bg-indigo-200/60 dark:hover:bg-indigo-900 rounded-md transition-colors cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {/* Category Chip */}
              {selectedCategory !== 'all' && (
                <span className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold">
                  <span>Category: {selectedCategory}</span>
                  <button
                    type="button"
                    onClick={() => handleCategoryClick('all')}
                    aria-label="Remove category filter"
                    className="p-0.5 hover:bg-emerald-200/60 dark:hover:bg-emerald-900 rounded-md transition-colors cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {/* Brand Chip */}
              {selectedBrand !== 'All Brands' && (
                <span className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-bold">
                  <span>Brand: {selectedBrand}</span>
                  <button
                    type="button"
                    onClick={() => handleBrandClick('All Brands')}
                    aria-label="Remove brand filter"
                    className="p-0.5 hover:bg-amber-200/60 dark:hover:bg-amber-900 rounded-md transition-colors cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {/* Search Query Chip */}
              {activeQuery && (
                <span className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold">
                  <span>Search: "{activeQuery}"</span>
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    aria-label="Remove search query filter"
                    className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              <button
                type="button"
                onClick={handleResetAllFilters}
                className="text-xs font-bold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white underline ml-1 cursor-pointer"
              >
                Clear all
              </button>
            </div>
          )}

          {/* ========================================================= */}
          {/* 4. LOADING STATE (SKELETON CARDS)                         */}
          {/* ========================================================= */}
          {loading && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 min-[1800px]:grid-cols-8 gap-2.5 sm:gap-3 md:gap-3.5 lg:gap-4">
              {Array.from({ length: 16 }).map((_, idx) => (
                <div 
                  key={idx} 
                  className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 p-2.5 sm:p-3.5 space-y-2 shadow-xs animate-pulse flex flex-col justify-between min-h-[170px] sm:min-h-[190px]"
                >
                  <div className="flex justify-between items-start">
                    <div className="h-8 w-8 sm:h-10 sm:w-10 bg-slate-100 dark:bg-slate-800 rounded-xl sm:rounded-2xl" />
                    <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-md w-12" />
                  </div>
                  <div className="space-y-1">
                    <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded w-1/2" />
                    <div className="h-3.5 bg-slate-200 dark:bg-slate-700 rounded w-4/5" />
                  </div>
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-16" />
                    <div className="h-6 w-6 bg-slate-100 dark:bg-slate-800 rounded-lg sm:rounded-xl" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ========================================================= */}
          {/* 5. ERROR STATE                                            */}
          {/* ========================================================= */}
          {!loading && error && (
            <div className="p-8 sm:p-12 text-center bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 rounded-3xl space-y-4 shadow-sm">
              <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/60 border border-rose-200/60 dark:border-rose-800/80 rounded-2xl flex items-center justify-center mx-auto text-rose-600 dark:text-rose-400">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="text-xl font-black text-slate-900 dark:text-white">Unable to load repair services</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                  {error}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <Button 
                  onClick={() => fetchPrices(false)} 
                  className="rounded-xl bg-slate-950 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white font-bold px-6 cursor-pointer"
                >
                  Try again
                </Button>
                <a
                  href={`tel:${MTS_PHONE}`}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold text-sm transition-all"
                >
                  <PhoneCall className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Call MTS ({MTS_PHONE_DISPLAY})</span>
                </a>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 6. EMPTY STATE                                            */}
          {/* ========================================================= */}
          {!loading && !error && paginatedItems.length === 0 && (
            <div className="p-8 sm:p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-6 shadow-xs max-w-2xl mx-auto">
              <div className="w-14 h-14 bg-amber-50 dark:bg-amber-950/60 border border-amber-200/60 dark:border-amber-800/80 rounded-2xl flex items-center justify-center mx-auto text-amber-600 dark:text-amber-400">
                <Search className="w-7 h-7" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xl sm:text-2xl font-black text-slate-950 dark:text-white tracking-tight">
                  {activeQuery 
                    ? `No repair services found for "${activeQuery}"` 
                    : selectedDeviceType !== 'all' || selectedCategory !== 'all' || selectedBrand !== 'All Brands'
                      ? `No services found matching current filters`
                      : 'No matching services found'
                  }
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium leading-relaxed max-w-md mx-auto">
                  {selectedDeviceType === 'laptop'
                    ? 'No laptop services are currently cataloged online. MTS Lab Kathmandu provides comprehensive chip-level MacBook & laptop hardware repair upon physical inspection.'
                    : selectedDeviceType === 'tv'
                      ? 'No smart TV panel services are currently cataloged online. MTS Lab provides laser line bonding and TV panel recovery at our Kathmandu Hub.'
                      : 'We could not find an exact match in our online catalog. Contact MTS Lab directly for an immediate free quotation on unlisted models.'
                  }
                </p>

                {/* Active Filter Chips in Empty State */}
                {(selectedDeviceType !== 'all' || selectedCategory !== 'all' || selectedBrand !== 'All Brands' || activeQuery) && (
                  <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2">
                    {selectedDeviceType !== 'all' && (
                      <Badge variant="outline" className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 font-bold">
                        Device: {DEVICE_OPTIONS.find(d => d.id === selectedDeviceType)?.label}
                      </Badge>
                    )}
                    {selectedCategory !== 'all' && (
                      <Badge variant="outline" className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 font-bold">
                        Category: {selectedCategory}
                      </Badge>
                    )}
                    {selectedBrand !== 'All Brands' && (
                      <Badge variant="outline" className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 font-bold">
                        Brand: {selectedBrand}
                      </Badge>
                    )}
                    {activeQuery && (
                      <Badge variant="outline" className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 font-bold">
                        Query: "{activeQuery}"
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              {/* Suggestions Box */}
              <div className="text-left bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 rounded-2xl p-4 sm:p-5 space-y-2.5">
                <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider block">
                  Search Tips & Suggestions:
                </span>
                <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1.5 list-disc list-inside">
                  <li>Check your spelling or try synonyms (e.g., <span className="font-semibold text-slate-800 dark:text-slate-200">"screen"</span> instead of <span className="font-semibold text-slate-800 dark:text-slate-200">"display"</span>, <span className="font-semibold text-slate-800 dark:text-slate-200">"battery"</span> instead of <span className="font-semibold text-slate-800 dark:text-slate-200">"charging"</span>).</li>
                  <li>Search by specific device model (e.g., <span className="font-semibold text-slate-800 dark:text-slate-200">"iPhone 13"</span>, <span className="font-semibold text-slate-800 dark:text-slate-200">"S23 Ultra"</span>, <span className="font-semibold text-slate-800 dark:text-slate-200">"Pixel 7"</span>).</li>
                  <li>Search by issue or component (e.g., <span className="font-semibold text-slate-800 dark:text-slate-200">"camera"</span>, <span className="font-semibold text-slate-800 dark:text-slate-200">"speaker"</span>, <span className="font-semibold text-slate-800 dark:text-slate-200">"water damage"</span>).</li>
                </ul>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
                  <a
                    href={`tel:${MTS_PHONE}`}
                    className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-slate-950 hover:bg-slate-800 active:scale-[0.98] text-white font-bold text-xs sm:text-sm shadow-xs transition-all"
                  >
                    <PhoneCall className="w-4 h-4 text-emerald-400" />
                    <span>Call MTS Lab ({MTS_PHONE_DISPLAY})</span>
                  </a>

                  <a
                    href={`https://wa.me/${MTS_WHATSAPP_NUMBER}?text=${encodeURIComponent(`Hello MTS Lab, I am looking for repair service for: ${activeQuery || selectedBrand}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold text-xs sm:text-sm shadow-xs transition-all"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Inquire on WhatsApp</span>
                  </a>
                </div>

                <div className="pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResetAllFilters}
                    className="text-xs font-bold text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                    Clear Search & Reset All Filters
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 7. PREMIUM E-COMMERCE STYLE COMPACT SERVICE CARD GRID     */}
          {/* ========================================================= */}
          {!loading && !error && paginatedItems.length > 0 && (
            <div className="space-y-6 sm:space-y-8">
              
              {/* Responsive Compact Rounded-Square Grid:
                  - Mobile Smartphones: at least 2 cards per row (grid-cols-2)
                  - Larger phones / phablets: 3 cards per row (sm:grid-cols-3)
                  - Tablets / iPads: 4 cards per row (md:grid-cols-4)
                  - Laptops / Desktops: 5-6 cards per row (lg:grid-cols-5 xl:grid-cols-6)
                  - Wide Monitors / Large TVs: 7-8 cards per row (2xl:grid-cols-7 min-[1800px]:grid-cols-8)
              */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 min-[1800px]:grid-cols-8 gap-2.5 sm:gap-3 md:gap-3.5 lg:gap-4">
                {paginatedItems.map((item) => {
                  const catInfo = getCategoryInfo(item.category, item.serviceName);
                  const CategoryIcon = catInfo.icon;
                  const fullDeviceName = `${item.brand} ${item.model}${item.variant ? ` ${item.variant}` : ''}`;
                  const isTablet = item.deviceType === 'Tablet' || item.deviceType === 'iPad';
                  const isLaptop = item.deviceType === 'Laptop';
                  const isTv = item.deviceType === 'Smart TV' || item.deviceType === 'TV';
                  const serviceSlug = serviceIdToSlug.get(item.id);
                  const serviceUrl = serviceSlug ? `/services/${serviceSlug}` : '/services';

                  return (
                    <article
                      key={item.id}
                      tabIndex={0}
                      role="link"
                      aria-label={`View repair service details for ${item.serviceName} - ${fullDeviceName}`}
                      onClick={() => {
                        useServiceCache.getState().setScrollY(window.scrollY);
                        navigate(serviceUrl);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          useServiceCache.getState().setScrollY(window.scrollY);
                          navigate(serviceUrl);
                        }
                      }}
                      className={`group bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 hover:border-indigo-400/80 dark:hover:border-indigo-500/80 p-2.5 sm:p-3.5 h-full flex flex-col justify-between hover:shadow-lg dark:hover:shadow-none hover:-translate-y-1 ${catInfo.cardHover} transition-all duration-200 cursor-pointer relative overflow-hidden select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 min-h-[170px] sm:min-h-[190px]`}
                    >
                      {/* Top: Category Icon Badge & Brand Pill */}
                      <div className="space-y-1.5 sm:space-y-2">
                        <div className="flex items-start justify-between gap-1.5">
                          {/* Category Icon */}
                          <div 
                            className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl ${catInfo.bgClass} flex items-center justify-center border border-slate-100/90 dark:border-slate-800/80 group-hover:scale-105 transition-transform shrink-0 shadow-2xs`}
                          >
                            <CategoryIcon className={`w-4 h-4 sm:w-5 sm:h-5 ${catInfo.iconClass}`} />
                          </div>

                          {/* Brand Pill */}
                          <span className="text-[9px] sm:text-[10px] font-black uppercase text-slate-700 dark:text-slate-300 bg-slate-100/90 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 px-1.5 py-0.5 rounded-md tracking-wider truncate max-w-[70px] sm:max-w-[90px] shrink-0">
                            {item.brand}
                          </span>
                        </div>

                        {/* Device Model & Service Name */}
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                            {isTablet ? (
                              <Tablet className="w-3 h-3 text-indigo-500 shrink-0" />
                            ) : isLaptop ? (
                              <Laptop className="w-3 h-3 text-blue-500 shrink-0" />
                            ) : isTv ? (
                              <Tv className="w-3 h-3 text-amber-500 shrink-0" />
                            ) : (
                              <Smartphone className="w-3 h-3 text-slate-400 shrink-0" />
                            )}
                            <span className="truncate">{fullDeviceName}</span>
                          </div>

                          <h3 className="text-xs sm:text-sm font-black text-slate-950 dark:text-white tracking-tight leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2 min-h-[2rem] sm:min-h-[2.25rem] flex items-center">
                            {item.serviceName}
                          </h3>
                        </div>
                      </div>

                      {/* Bottom: Complete Service Price & Subtle Click Indicator */}
                      <div className="pt-2 sm:pt-2.5 mt-2 sm:mt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1.5">
                        {/* Always completely visible service price (never truncated or clipped) */}
                        <div className="min-w-0 flex-1">
                          {renderPriceBadge(item)}
                        </div>

                        {/* Click Action Indicator Icon */}
                        <div 
                          className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl bg-slate-100 dark:bg-slate-800 group-hover:bg-slate-950 dark:group-hover:bg-indigo-600 text-slate-400 group-hover:text-white dark:text-slate-400 dark:group-hover:text-white flex items-center justify-center shrink-0 transition-all duration-200 shadow-2xs"
                          aria-hidden="true"
                        >
                          <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* ========================================================= */}
              {/* 8. PAGINATION CONTROLS                                    */}
              {/* ========================================================= */}
              {totalPages > 1 && (
                <div className="pt-4 pb-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-200/80 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} – {Math.min(currentPage * ITEMS_PER_PAGE, totalItems)} of {totalItems} repair services
                  </span>

                  <div className="flex items-center gap-1.5">
                    {/* Previous Page Button */}
                    <button
                      type="button"
                      id="pagination-prev-btn"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all shadow-2xs"
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span className="hidden sm:inline">Prev</span>
                    </button>

                    {/* Page Numbers */}
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                      if (
                        totalPages <= 7 ||
                        pageNum === 1 ||
                        pageNum === totalPages ||
                        (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                      ) {
                        const isActive = pageNum === currentPage;
                        return (
                          <button
                            key={pageNum}
                            type="button"
                            onClick={() => handlePageChange(pageNum)}
                            className={`w-9 h-9 rounded-xl text-xs font-extrabold flex items-center justify-center transition-all cursor-pointer ${
                              isActive
                                ? 'bg-slate-950 dark:bg-indigo-600 text-white shadow-xs'
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                            }`}
                            aria-label={`Page ${pageNum}`}
                            aria-current={isActive ? 'page' : undefined}
                          >
                            {pageNum}
                          </button>
                        );
                      } else if (
                        (pageNum === 2 && currentPage > 3) ||
                        (pageNum === totalPages - 1 && currentPage < totalPages - 2)
                      ) {
                        return (
                          <span key={pageNum} className="px-1 text-slate-400 dark:text-slate-500 font-black text-xs">
                            ...
                          </span>
                        );
                      }
                      return null;
                    })}

                    {/* Next Page Button */}
                    <button
                      type="button"
                      id="pagination-next-btn"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all shadow-2xs"
                      aria-label="Next page"
                    >
                      <span className="hidden sm:inline">Next</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

        </section>



        {/* ========================================================= */}
        {/* 10. DIRECT CONTACT & BOOKING ASSURANCE BANNER             */}
        {/* ========================================================= */}
        <section className="bg-slate-950 text-white rounded-3xl p-6 sm:p-8 lg:p-10 border border-slate-800 shadow-xl relative overflow-hidden space-y-4">
          <div className="relative z-10 max-w-2xl space-y-2.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-amber-400 text-[11px] font-black uppercase tracking-wider">
              <Phone className="w-3.5 h-3.5" />
              <span>Need Custom Hardware Diagnostic?</span>
            </div>

            <div className="space-y-1">
              <h3 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-white">
                Contact MTS Lab Kathmandu directly for instant quotation & booking.
              </h3>
              <p className="text-slate-400 text-xs sm:text-sm font-medium leading-relaxed">
                Our technicians are ready to verify your hardware model, discuss genuine replacement parts, and provide free 10-minute diagnostic inspection.
              </p>
            </div>

            {/* Contact Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <a
                id="cta-call-mts"
                href={`tel:${MTS_PHONE}`}
                className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-2xl bg-white hover:bg-slate-100 active:scale-[0.98] text-slate-950 font-black text-xs sm:text-sm shadow-md transition-all cursor-pointer"
              >
                <PhoneCall className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Call MTS ({MTS_PHONE_DISPLAY})</span>
              </a>

              <a
                id="cta-whatsapp-mts"
                href={`https://wa.me/${MTS_WHATSAPP_NUMBER}?text=${encodeURIComponent('Hello MTS Lab, I would like to inquire about smartphone repair services.')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-black text-xs sm:text-sm shadow-md transition-all cursor-pointer"
              >
                <MessageCircle className="w-4 h-4 shrink-0" />
                <span>Chat on WhatsApp</span>
              </a>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* 11. LAB TRUST & QUALITY METRICS                           */}
        {/* ========================================================= */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
          <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl sm:rounded-3xl space-y-2.5 shadow-2xs hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100/80 dark:border-emerald-800/80">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="font-black text-sm text-slate-950 dark:text-white">Certified Lab Quality</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium leading-relaxed">Comprehensive diagnostic testing on original-grade replacement components.</p>
            </div>
          </div>

          <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl sm:rounded-3xl space-y-2.5 shadow-2xs hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-100/80 dark:border-blue-800/80">
              <Clock className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="font-black text-sm text-slate-950 dark:text-white">Fast Turnaround</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium leading-relaxed">Glass change and battery swaps completed in 30-90 minutes at our hub.</p>
            </div>
          </div>

          <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl sm:rounded-3xl space-y-2.5 shadow-2xs hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100/80 dark:border-indigo-800/80">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="font-black text-sm text-slate-950 dark:text-white">Genuine Parts</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium leading-relaxed">Premium-grade AMOLED screens & high-density battery cells.</p>
            </div>
          </div>

          <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl sm:rounded-3xl space-y-2.5 shadow-2xs hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 flex items-center justify-center border border-slate-200/80 dark:border-slate-700">
              <Cpu className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="font-black text-sm text-slate-950 dark:text-white">Level 4 Micro-Soldering</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium leading-relaxed">Motherboard IC reballing, power short repair, and precision laser line removal.</p>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* 12. PRICE DISCLAIMER & TERMS                              */}
        {/* ========================================================= */}
        <section className="p-4 sm:p-6 bg-slate-100/80 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl space-y-2 text-slate-700 dark:text-slate-300">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-slate-950 dark:text-amber-400 shrink-0" />
            <h4 className="font-extrabold text-xs text-slate-950 dark:text-white uppercase tracking-wider">
              Price Disclaimer & Physical Inspection Terms
            </h4>
          </div>
          <p className="text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-400 font-medium">
            Listed prices represent standard laboratory estimates for genuine component replacement and technician labor. Actual pricing may vary slightly based on specific regional hardware variants, hidden liquid corrosion, frame warpage, or secondary IC board failures. A definitive quotation is verified after a complimentary 10-minute physical inspection at MTS Lab Kathmandu Hub.
          </p>
        </section>

        {/* ========================================================= */}
        {/* MOBILE BOTTOM SHEET FOR ADVANCED FILTERS & BRANDS         */}
        {/* ========================================================= */}
        {isMobileSheetOpen && (
          <div 
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-sheet-title"
            className="fixed inset-0 z-50 flex items-end justify-center md:hidden"
          >
            {/* Backdrop Blur Overlay */}
            <div 
              onClick={() => setIsMobileSheetOpen(false)}
              className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-xs transition-opacity animate-in fade-in-0 duration-200"
            />

            {/* Bottom Sheet Card */}
            <div className="relative w-full max-h-[85vh] bg-white dark:bg-slate-900 rounded-t-3xl border-t border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col z-10 overflow-hidden outline-none animate-in slide-in-from-bottom duration-250">
              
              {/* Drag Handle Bar */}
              <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-3 mb-1 shrink-0" />

              {/* Sheet Header */}
              <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-amber-500" />
                  <h3 id="mobile-sheet-title" className="text-base font-black text-slate-900 dark:text-white">
                    Filters & Brands
                  </h3>
                  {activeAdvancedFilterCount > 0 && (
                    <Badge className="bg-amber-400 text-slate-950 font-black text-[10px] px-1.5 py-0.2 rounded-full">
                      {activeAdvancedFilterCount}
                    </Badge>
                  )}
                </div>

                <button
                  type="button"
                  aria-label="Close filters"
                  onClick={() => setIsMobileSheetOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Sheet Scrollable Body */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                
                {/* 1. Device Form Selector in Mobile Sheet */}
                <div className="space-y-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                    <span>Hardware Device Form</span>
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {DEVICE_OPTIONS.map((dev) => {
                      const isSelected = selectedDeviceType === dev.id;
                      const Icon = dev.icon;
                      return (
                        <button
                          key={dev.id}
                          type="button"
                          onClick={() => handleDeviceTypeClick(dev.id)}
                          className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold transition-all border text-left cursor-pointer ${
                            isSelected
                              ? 'bg-slate-950 dark:bg-indigo-600 text-white border-slate-950 dark:border-indigo-600 shadow-xs'
                              : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-700'
                          }`}
                        >
                          <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-amber-400' : 'text-slate-400'}`} />
                          <span className="truncate">{dev.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Service Categories in Mobile Sheet */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-slate-400" />
                      <span>Service Categories</span>
                    </span>
                    {selectedCategory !== 'all' && (
                      <button
                        type="button"
                        onClick={() => handleCategoryClick('all')}
                        className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        Reset Category
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {POPULAR_CATEGORIES.map((cat) => {
                      const IconComponent = cat.icon;
                      const isSelected = selectedCategory === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => handleCategoryClick(cat.id)}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                            isSelected
                              ? 'bg-slate-950 dark:bg-indigo-600 text-white border-slate-950 dark:border-indigo-600 shadow-xs'
                              : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-700 active:scale-95'
                          }`}
                        >
                          <IconComponent className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-amber-400' : 'text-slate-400'}`} />
                          <span>{cat.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Filter by Brand in Mobile Sheet */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                      <span>Filter by Brand</span>
                    </span>
                    {selectedBrand !== 'All Brands' && (
                      <button
                        type="button"
                        onClick={() => handleBrandClick('All Brands')}
                        className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        Reset Brand
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {availableBrands.map((brand) => {
                      const isSelected = selectedBrand.toLowerCase() === brand.toLowerCase() ||
                        (selectedBrand.toLowerCase() === 'all brands' && brand === 'All Brands');
                      return (
                        <button
                          key={brand}
                          type="button"
                          onClick={() => handleBrandClick(brand)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                            isSelected
                              ? 'bg-slate-900 dark:bg-indigo-600 text-white border-slate-900 dark:border-indigo-600'
                              : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-slate-700'
                          }`}
                        >
                          {brand}
                        </button>
                      );
                    })}
                  </div>
                </div>

              </div>

              {/* Sheet Sticky Footer Action Bar */}
              <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3 shrink-0 pb-6 sm:pb-4">
                {totalActiveFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      handleClearAdvancedFilters();
                    }}
                    className="px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                  >
                    Clear Filters
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setIsMobileSheetOpen(false);
                    if (catalogSectionRef.current) {
                      const navOffset = 80;
                      const targetTop = catalogSectionRef.current.getBoundingClientRect().top + window.pageYOffset - navOffset;
                      window.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
                    }
                  }}
                  className="flex-1 py-3 px-4 rounded-xl bg-slate-950 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-500 text-white font-extrabold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Show {totalItems} {totalItems === 1 ? 'Service' : 'Services'}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

            </div>
          </div>
        )}

      </main>

      <Footer />
    </div>
  );
}
