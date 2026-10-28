/**
 * MTS LAB SEO & AEO SHARED HELPERS
 * Verified business data, deterministic slug generation, JSON-LD schemas,
 * and search/answer engine optimization for mobiletechnologystation.com.np
 */

export const SITE_URL = 'https://www.mobiletechnologystation.com.np';
export const BUSINESS_NAME = 'MTS Lab';
export const BUSINESS_LEGAL_NAME = 'Mobile Technology Station (MTS Lab)';
export const BUSINESS_PHONE = '9869276668';
export const BUSINESS_PHONE_INTL = '+977-9869276668';
export const BUSINESS_LANDLINE = '015364307';
export const BUSINESS_EMAIL = 'support@mobiletechnologystation.com.np';
export const BUSINESS_ADDRESS = {
  streetAddress: "Pakosadak, New Road (Opposite People's Plaza back gate)",
  addressLocality: 'Kathmandu',
  addressRegion: 'Bagmati Province',
  postalCode: '44600',
  addressCountry: 'NP',
};
export const BUSINESS_GEO = {
  latitude: 27.7029,
  longitude: 85.3123,
};
export const BUSINESS_OPENING_HOURS = ['Su-Fr 10:00-19:00', 'Sa 10:00-18:00'];

export interface ServiceLike {
  id: string;
  brand: string;
  model: string;
  variant?: string | null;
  category?: string | null;
  problem?: string | null;
  serviceName: string;
  description?: string | null;
  price: number;
  priceType?: 'FIXED' | 'STARTING_FROM' | 'ON_INSPECTION' | 'CONTACT_FOR_PRICE' | string;
  status?: string;
  estimatedTime?: string | null;
  originalPrice?: number | null;
  deviceType?: string | null;
  icon?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

/**
 * HTML Escaping for security and valid metadata injection
 */
export function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Sanitize plain string for JSON-LD script inclusion to avoid XSS
 */
export function safeJsonLdString(obj: unknown): string {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

/**
 * Format price in Nepalese Rupees (NPR) accurately
 */
export function formatNprPrice(price: number, priceType?: string): string {
  if (priceType === 'ON_INSPECTION' || priceType === 'CONTACT_FOR_PRICE' || !price || price <= 0) {
    return 'Price on Inspection';
  }
  const formatted = `NPR ${price.toLocaleString('en-US')}`;
  if (priceType === 'STARTING_FROM') {
    return `Starting from ${formatted}`;
  }
  return formatted;
}

/**
 * Remove duplicate tokens to ensure clean human-readable slugs
 * Example: ["apple", "iphone", "13", "iphone", "13", "display"] -> ["apple", "iphone", "13", "display"]
 */
function deduplicateTokens(tokens: string[]): string[] {
  const result: string[] = [];
  for (const token of tokens) {
    if (!token) continue;
    // Don't repeat if already last or strictly repeated consecutively
    if (result.length > 0 && result[result.length - 1] === token) {
      continue;
    }
    // Also skip if token appears multiple times in whole chain, except numbers
    const isNum = /^\d+$/.test(token);
    if (!isNum && result.includes(token)) {
      continue;
    }
    result.push(token);
  }
  return result;
}

/**
 * Generate a clean base slug from service fields
 */
export function generateBaseSlug(service: Pick<ServiceLike, 'brand' | 'model' | 'serviceName' | 'variant'>): string {
  const brand = (service.brand || '').trim().toLowerCase();
  const model = (service.model || '').trim().toLowerCase();
  const variant = (service.variant || '').trim().toLowerCase();
  const serviceName = (service.serviceName || '').trim().toLowerCase();

  const rawCombined = `${brand} ${model} ${variant} ${serviceName}`
    .replace(/[+/&]/g, ' and ')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = rawCombined.split(' ').filter(Boolean);
  const deduped = deduplicateTokens(words);
  const slug = deduped.join('-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return slug || 'service';
}

export interface SlugMappingResult {
  slugToService: Map<string, ServiceLike>;
  serviceIdToSlug: Map<string, string>;
  allSlugs: string[];
}

/**
 * Build deterministic, collision-resistant slug mappings from an array of active services
 */
export function buildSlugMap(services: ServiceLike[]): SlugMappingResult {
  const slugToService = new Map<string, ServiceLike>();
  const serviceIdToSlug = new Map<string, string>();
  const slugCounts = new Map<string, number>();

  // Sort services stably by brand, model, serviceName, and id
  const sorted = [...services].sort((a, b) => {
    const brandCmp = (a.brand || '').localeCompare(b.brand || '');
    if (brandCmp !== 0) return brandCmp;
    const modelCmp = (a.model || '').localeCompare(b.model || '');
    if (modelCmp !== 0) return modelCmp;
    const nameCmp = (a.serviceName || '').localeCompare(b.serviceName || '');
    if (nameCmp !== 0) return nameCmp;
    return (a.id || '').localeCompare(b.id || '');
  });

  for (const service of sorted) {
    const base = generateBaseSlug(service);
    const count = (slugCounts.get(base) || 0) + 1;
    slugCounts.set(base, count);

    let finalSlug = base;
    if (count > 1) {
      // Append variant if available, otherwise deterministic short id hash
      if (service.variant && service.variant.trim()) {
        const vSlug = service.variant.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
        finalSlug = `${base}-${vSlug}`;
      } else {
        const shortId = (service.id || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toLowerCase();
        finalSlug = `${base}-${shortId || count}`;
      }
    }

    // Ensure absolutely no collision in map
    let collisionCounter = 2;
    while (slugToService.has(finalSlug)) {
      finalSlug = `${base}-${collisionCounter}`;
      collisionCounter++;
    }

    slugToService.set(finalSlug, service);
    serviceIdToSlug.set(service.id, finalSlug);
  }

  return {
    slugToService,
    serviceIdToSlug,
    allSlugs: Array.from(slugToService.keys()),
  };
}

/**
 * Centralized, typed registry of historical / legacy service slugs mapped to active canonical slugs.
 * Used to preserve inbound links, bookmarks, search engine citations, and GSC index equity.
 */
export const LEGACY_SLUGS: Record<string, string> = {
  // iPhone 14 Pro Max legacy/outdated variants
  'iphone-14-pro-max-standard-original-standard': 'iphone-14-pro-max-14-original-display-replacement',
  'iphone-14-pro-max-standard-original': 'iphone-14-pro-max-14-original-display-replacement',
  'iphone-14-pro-max-original-display-replacement': 'iphone-14-pro-max-14-original-display-replacement',
  // iPhone 11 & 12 legacy slug variants without repetitive model tokens
  'iphone-11-pro-max-original-display-replacement': 'iphone-11-pro-max-11-original-display-replacement',
  'iphone-12-pro-max-original-display-replacement': 'iphone-12-pro-max-12-original-display-replacement',
};

export type SlugResolutionType = 'ACTIVE' | 'REDIRECT' | 'NOT_FOUND';

export interface SlugResolutionResult {
  type: SlugResolutionType;
  requestedSlug: string;
  cleanSlug: string;
  targetSlug?: string;
  targetUrl?: string;
  service?: ServiceLike;
  matchStrategy?: 'EXACT_ACTIVE' | 'EXPLICIT_LEGACY' | 'AUTOMATED_LEGACY';
}

/**
 * Known historical descriptive phrases and noise tokens found in legacy GSC URLs.
 */
export const KNOWN_LEGACY_NOISE_PHRASES: string[] = [
  'all-storage-sizes-and-colors',
  'all-compatible-variants-confirm-before-repair',
  'confirm-before-repair',
  'all-storage-sizes-and-all-colors',
  'all-storage-sizes-and-color',
  'all-storage-sizes',
  'all-compatible-variants',
  'all-storage-variants',
  'all-standard-variants',
  'all-colors-and-variants',
  'all-colors',
  'confirm-before-visiting',
  'confirm-before-order',
  'subject-to-availability',
  'check-color-availability',
  'contact-to-confirm-availability',
  'standard-variants',
  'all-variants',
];

/**
 * Strips obsolete descriptive phrases without mutating model or service keywords.
 */
export function stripLegacyNoisePhrases(slug: string): string {
  if (!slug) return '';
  let cleaned = slug;
  let changed = true;
  let passes = 0;
  while (changed && passes < 10) {
    changed = false;
    passes++;
    for (const phrase of KNOWN_LEGACY_NOISE_PHRASES) {
      const pattern = new RegExp(`(^|-)${phrase}(-|$)`, 'g');
      if (pattern.test(cleaned)) {
        cleaned = cleaned.replace(pattern, '$1-$2').replace(/-+/g, '-').replace(/^-|-$/g, '');
        changed = true;
      }
    }
  }
  return cleaned.replace(/-+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Reusable, deterministic slug normalizer:
 * - Converts to lowercase and trims
 * - Replaces separators (_, +, &) with hyphens
 * - Collapses consecutive hyphens and trims edges
 * - Removes known obsolete descriptive phrases
 */
export function normalizeLegacySlug(rawSlug: string | undefined | null): string {
  if (!rawSlug) return '';
  let slug = String(rawSlug).trim().toLowerCase();
  slug = slug.replace(/[+/_&]/g, '-').replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  slug = stripLegacyNoisePhrases(slug);
  return slug;
}

// Known device model patterns ordered by token specificity (longest / most specific first)
const KNOWN_MODEL_PATTERNS = [
  { id: 'iphone-15-pro-max', regex: /(?:^|-)iphone-15-pro-max(?:-|$)/, name: '15 pro max' },
  { id: 'iphone-15-pro', regex: /(?:^|-)iphone-15-pro(?:-|$)(?!max)/, name: '15 pro' },
  { id: 'iphone-15-plus', regex: /(?:^|-)iphone-15-plus(?:-|$)/, name: '15 plus' },
  { id: 'iphone-15', regex: /(?:^|-)iphone-15(?:-|$)(?!pro|max|plus)/, name: '15' },
  { id: 'iphone-14-pro-max', regex: /(?:^|-)iphone-14-pro-max(?:-|$)/, name: '14 pro max' },
  { id: 'iphone-14-pro', regex: /(?:^|-)iphone-14-pro(?:-|$)(?!max)/, name: '14 pro' },
  { id: 'iphone-14-plus', regex: /(?:^|-)iphone-14-plus(?:-|$)/, name: '14 plus' },
  { id: 'iphone-14', regex: /(?:^|-)iphone-14(?:-|$)(?!pro|max|plus)/, name: '14' },
  { id: 'iphone-13-pro-max', regex: /(?:^|-)iphone-13-pro-max(?:-|$)/, name: '13 pro max' },
  { id: 'iphone-13-pro', regex: /(?:^|-)iphone-13-pro(?:-|$)(?!max)/, name: '13 pro' },
  { id: 'iphone-13-mini', regex: /(?:^|-)iphone-13-mini(?:-|$)/, name: '13 mini' },
  { id: 'iphone-13', regex: /(?:^|-)iphone-13(?:-|$)(?!pro|max|mini)/, name: '13' },
  { id: 'iphone-12-pro-max', regex: /(?:^|-)iphone-12-pro-max(?:-|$)/, name: '12 pro max' },
  { id: 'iphone-12-pro', regex: /(?:^|-)iphone-12-pro(?:-|$)(?!max)/, name: '12 pro' },
  { id: 'iphone-12-mini', regex: /(?:^|-)iphone-12-mini(?:-|$)/, name: '12 mini' },
  { id: 'iphone-12', regex: /(?:^|-)iphone-12(?:-|$)(?!pro|max|mini)/, name: '12' },
  { id: 'iphone-11-pro-max', regex: /(?:^|-)iphone-11-pro-max(?:-|$)/, name: '11 pro max' },
  { id: 'iphone-11-pro', regex: /(?:^|-)iphone-11-pro(?:-|$)(?!max)/, name: '11 pro' },
  { id: 'iphone-11', regex: /(?:^|-)iphone-11(?:-|$)(?!pro|max)/, name: '11' },
  { id: 'iphone-xs-max', regex: /(?:^|-)iphone-(?:xs-max|xsmax|xsmax-xs-max)(?:-|$)/, name: 'xsmax' },
  { id: 'iphone-xr', regex: /(?:^|-)iphone-xr(?:-|$)/, name: 'xr' },
  { id: 'iphone-xs', regex: /(?:^|-)iphone-xs(?:-|$)(?!max)/, name: 'xs' },
  { id: 'iphone-x', regex: /(?:^|-)iphone-x(?:-|$)(?!r|s)/, name: 'x' },
  { id: 'iphone-se', regex: /(?:^|-)iphone-se(?:-|$)/, name: 'se' },
  { id: 'iphone-8-plus', regex: /(?:^|-)iphone-8-plus(?:-|$)/, name: '8 plus' },
  { id: 'iphone-8', regex: /(?:^|-)iphone-8(?:-|$)(?!plus)/, name: '8' },
  { id: 'iphone-7-plus', regex: /(?:^|-)iphone-7-plus(?:-|$)/, name: '7 plus' },
  { id: 'iphone-7', regex: /(?:^|-)iphone-7(?:-|$)(?!plus)/, name: '7' },
];

/**
 * Extracts normalized device model identifier with strict boundary checks
 * to prevent confusion between models (e.g. X vs XR vs XS, 11 vs 11 Pro Max).
 */
export function extractModelIdentifier(slug: string): { id: string; name: string } | null {
  for (const item of KNOWN_MODEL_PATTERNS) {
    if (item.regex.test(slug)) {
      return { id: item.id, name: item.name };
    }
  }
  return null;
}

/**
 * Automated legacy slug matching against active catalog services.
 * Strict rules:
 * 1. Checks noise-stripped slug against active catalog
 * 2. Checks redundant model number tokens (e.g. iphone-11-11- -> iphone-11-)
 * 3. Structured match on Device Model + Component Category + Grade/Subtype
 * 4. Rejects ambiguous candidates (if multiple services remain plausible, returns null)
 * 5. Returns active service only if confidence threshold is met
 */
export function normalizeAndMatchLegacySlug(
  requestedSlug: string,
  activeServices: ServiceLike[],
  slugToServiceMap?: Map<string, ServiceLike>
): { targetSlug: string; service: ServiceLike } | null {
  const norm = normalizeLegacySlug(requestedSlug);
  if (!norm) return null;

  const slugToService = slugToServiceMap || buildSlugMap(activeServices).slugToService;

  // 1. Direct match on normalized slug
  if (slugToService.has(norm)) {
    return { targetSlug: norm, service: slugToService.get(norm)! };
  }

  // 2. Redundant model number removed (e.g. iphone-11-11- -> iphone-11-)
  const collapsed = norm.replace(/iphone-(\d+)-\1-/, 'iphone-$1-');
  if (slugToService.has(collapsed)) {
    return { targetSlug: collapsed, service: slugToService.get(collapsed)! };
  }

  // 3. Redundant model number inserted (e.g. iphone-14-pro-max- -> iphone-14-pro-max-14-)
  const inserted = norm.replace(/iphone-(\d+)-(pro-max)-/, 'iphone-$1-$2-$1-');
  if (slugToService.has(inserted)) {
    return { targetSlug: inserted, service: slugToService.get(inserted)! };
  }

  // 4. Structured Model Extraction
  const modelMatch = extractModelIdentifier(norm);
  if (!modelMatch) return null;

  // Filter services by matched model
  const modelServices = activeServices.filter((s) => {
    const sModel = (s.model || '').trim().toLowerCase();
    if (modelMatch.id === 'iphone-xs-max') {
      return sModel === 'xsmax' || sModel === 'xs max';
    }
    return sModel === modelMatch.name;
  });

  if (modelServices.length === 0) return null;

  // Detect component category
  const isDisplay = norm.includes('display') || norm.includes('screen') || norm.includes('lcd') || norm.includes('oled') || norm.includes('amoled');
  const isBattery = norm.includes('battery');
  const isCamera = norm.includes('camera');
  const isBackPanel = norm.includes('back-panel') || norm.includes('back-cover') || norm.includes('back-glass') || norm.includes('rear-glass');
  const isSpeaker = norm.includes('speaker') || norm.includes('buzzer') || norm.includes('ringer');
  const isCharging = norm.includes('charging') || norm.includes('dock-flex') || norm.includes('charging-flex');

  // A. DISPLAY MATCHING
  if (isDisplay) {
    const compServices = modelServices.filter(
      (s) => (s.category || '').toLowerCase() === 'display' || s.serviceName.toLowerCase().includes('display')
    );
    if (compServices.length === 0) return null;

    const isOriginal = (norm.includes('original') || norm.includes('genuine')) &&
      !norm.includes('copy') && !norm.includes('gx') && !norm.includes('dd') && !norm.includes('incell') && !norm.includes('in-cell');
    const isCopy = norm.includes('copy') || norm.includes('aftermarket');
    const isGx = norm.includes('gx');
    const isDd = norm.includes('dd');
    const isIncell = norm.includes('incell') || norm.includes('in-cell');

    let filtered: ServiceLike[] = [];
    if (isOriginal) {
      filtered = compServices.filter(
        (s) => s.serviceName.toLowerCase().includes('original') &&
          !s.serviceName.toLowerCase().includes('gx') &&
          !s.serviceName.toLowerCase().includes('dd') &&
          !s.serviceName.toLowerCase().includes('copy')
      );
    } else if (isCopy) {
      filtered = compServices.filter((s) => s.serviceName.toLowerCase().includes('copy'));
    } else if (isGx) {
      filtered = compServices.filter((s) => s.serviceName.toLowerCase().includes('gx'));
    } else if (isDd) {
      filtered = compServices.filter((s) => s.serviceName.toLowerCase().includes('dd'));
    } else if (isIncell) {
      filtered = compServices.filter((s) => s.serviceName.toLowerCase().includes('incell') || s.serviceName.toLowerCase().includes('in-cell'));
    } else {
      // Unspecified grade! If multiple display options exist, reject as ambiguous (Requirement 6 & Test J)
      if (compServices.length > 1) return null;
      filtered = compServices;
    }

    if (filtered.length === 1) {
      const match = filtered[0];
      const targetSlug = Array.from(slugToService.entries()).find(([_, s]) => s.id === match.id)?.[0];
      return targetSlug ? { targetSlug, service: match } : null;
    }
    return null;
  }

  // B. BATTERY MATCHING
  if (isBattery) {
    const compServices = modelServices.filter(
      (s) => (s.category || '').toLowerCase() === 'battery' || s.serviceName.toLowerCase().includes('battery')
    );
    if (compServices.length === 0) return null;

    const isMarket = norm.includes('market');
    const isCopy = norm.includes('copy');
    const isOrig = (norm.includes('original') || norm.includes('1-year-warranty')) && !isMarket && !isCopy;

    let filtered: ServiceLike[] = [];
    if (isMarket) {
      filtered = compServices.filter((s) => s.serviceName.toLowerCase().includes('market'));
    } else if (isCopy) {
      filtered = compServices.filter((s) => s.serviceName.toLowerCase().includes('copy'));
    } else if (isOrig) {
      filtered = compServices.filter((s) => s.serviceName.toLowerCase().includes('original') && !s.serviceName.toLowerCase().includes('market'));
    } else {
      if (compServices.length > 1) return null;
      filtered = compServices;
    }

    if (filtered.length === 1) {
      const match = filtered[0];
      const targetSlug = Array.from(slugToService.entries()).find(([_, s]) => s.id === match.id)?.[0];
      return targetSlug ? { targetSlug, service: match } : null;
    }
    return null;
  }

  // C. CAMERA MATCHING
  if (isCamera) {
    const compServices = modelServices.filter(
      (s) => (s.category || '').toLowerCase() === 'camera' || s.serviceName.toLowerCase().includes('camera')
    );
    if (compServices.length === 0) return null;

    const isFront = norm.includes('front') || norm.includes('selfie');
    const isBack = norm.includes('back') || norm.includes('rear');

    if (isFront && !isBack) {
      const filtered = compServices.filter((s) => s.serviceName.toLowerCase().includes('front'));
      if (filtered.length === 1) {
        const match = filtered[0];
        const targetSlug = Array.from(slugToService.entries()).find(([_, s]) => s.id === match.id)?.[0];
        return targetSlug ? { targetSlug, service: match } : null;
      }
    } else if (isBack && !isFront) {
      const filtered = compServices.filter((s) => s.serviceName.toLowerCase().includes('back'));
      if (filtered.length === 1) {
        const match = filtered[0];
        const targetSlug = Array.from(slugToService.entries()).find(([_, s]) => s.id === match.id)?.[0];
        return targetSlug ? { targetSlug, service: match } : null;
      }
    }
    return null;
  }

  // D. SPEAKER MATCHING
  if (isSpeaker) {
    const compServices = modelServices.filter(
      (s) => (s.category || '').toLowerCase() === 'speaker' ||
        s.serviceName.toLowerCase().includes('speaker') ||
        s.serviceName.toLowerCase().includes('buzzer')
    );
    if (compServices.length === 0) return null;

    if (norm.includes('buzzer')) {
      const buz = compServices.filter((s) => s.serviceName.toLowerCase().includes('buzzer'));
      if (buz.length === 1) {
        const match = buz[0];
        const targetSlug = Array.from(slugToService.entries()).find(([_, s]) => s.id === match.id)?.[0];
        return targetSlug ? { targetSlug, service: match } : null;
      }
    }
    if (compServices.length === 1) {
      const match = compServices[0];
      const targetSlug = Array.from(slugToService.entries()).find(([_, s]) => s.id === match.id)?.[0];
      return targetSlug ? { targetSlug, service: match } : null;
    }
    return null;
  }

  // E. CHARGING FLEX MATCHING
  if (isCharging) {
    const compServices = modelServices.filter(
      (s) => (s.category || '').toLowerCase().includes('charging') ||
        s.serviceName.toLowerCase().includes('charging')
    );
    if (compServices.length === 0) return null;

    if (compServices.length === 1) {
      const match = compServices[0];
      const targetSlug = Array.from(slugToService.entries()).find(([_, s]) => s.id === match.id)?.[0];
      return targetSlug ? { targetSlug, service: match } : null;
    }

    const isMarket = norm.includes('market');
    const isGenuine = norm.includes('genuine');
    let filtered: ServiceLike[] = [];
    if (isMarket) {
      filtered = compServices.filter((s) => s.serviceName.toLowerCase().includes('market'));
    } else if (isGenuine) {
      filtered = compServices.filter((s) => s.serviceName.toLowerCase().includes('genuine') || s.serviceName.toLowerCase().includes('original'));
    }

    if (filtered.length === 1) {
      const match = filtered[0];
      const targetSlug = Array.from(slugToService.entries()).find(([_, s]) => s.id === match.id)?.[0];
      return targetSlug ? { targetSlug, service: match } : null;
    }
    return null;
  }

  // F. BACK PANEL MATCHING
  if (isBackPanel) {
    const compServices = modelServices.filter(
      (s) => (s.category || '').toLowerCase().includes('back panel') ||
        s.serviceName.toLowerCase().includes('back panel')
    );
    if (compServices.length === 0) return null;

    const isHq = norm.includes('high-quality') || norm.includes('high quality');
    const isCopy = norm.includes('copy');
    const isOrig = norm.includes('original') && !isCopy;

    let filtered: ServiceLike[] = [];
    if (isHq) {
      filtered = compServices.filter((s) => s.serviceName.toLowerCase().includes('high quality') || s.serviceName.toLowerCase().includes('high-quality'));
    } else if (isCopy) {
      filtered = compServices.filter((s) => s.serviceName.toLowerCase().includes('copy') && !s.serviceName.toLowerCase().includes('high quality'));
    } else if (isOrig) {
      filtered = compServices.filter((s) => s.serviceName.toLowerCase().includes('original'));
    } else {
      if (compServices.length > 1) return null;
      filtered = compServices;
    }

    if (filtered.length === 1) {
      const match = filtered[0];
      const targetSlug = Array.from(slugToService.entries()).find(([_, s]) => s.id === match.id)?.[0];
      return targetSlug ? { targetSlug, service: match } : null;
    }
    return null;
  }

  return null;
}

/**
 * Resolves a requested URL slug against active services and legacy redirects.
 * Follows strict priority order:
 * 1. Exact active slug match
 * 2. Explicit legacy dictionary lookup (LEGACY_SLUGS) with loop protection
 * 3. Automated legacy matching (normalizeAndMatchLegacySlug)
 * 4. NOT_FOUND (never redirects ambiguous or unknown requests)
 */
export function resolveServiceSlug(
  rawRequestedSlug: string | undefined | null,
  slugMapOrServices: Map<string, ServiceLike> | ServiceLike[]
): SlugResolutionResult {
  const requestedSlug = rawRequestedSlug ? String(rawRequestedSlug) : '';
  const cleanSlug = requestedSlug.trim().replace(/^\/+|\/+$/g, '').toLowerCase();

  if (!cleanSlug) {
    return {
      type: 'NOT_FOUND',
      requestedSlug,
      cleanSlug: '',
    };
  }

  const slugToService = Array.isArray(slugMapOrServices)
    ? buildSlugMap(slugMapOrServices).slugToService
    : slugMapOrServices;

  const activeServices = Array.isArray(slugMapOrServices)
    ? slugMapOrServices
    : Array.from(slugToService.values());

  // PRIORITY 1: Exact active service match
  if (slugToService.has(cleanSlug)) {
    return {
      type: 'ACTIVE',
      requestedSlug,
      cleanSlug,
      service: slugToService.get(cleanSlug),
      matchStrategy: 'EXACT_ACTIVE',
    };
  }

  // PRIORITY 2: Explicit legacy mapping from dictionary with loop protection
  if (Object.prototype.hasOwnProperty.call(LEGACY_SLUGS, cleanSlug)) {
    let currentSlug = cleanSlug;
    const visited = new Set<string>([currentSlug]);
    let target = LEGACY_SLUGS[currentSlug]?.trim().toLowerCase();
    let steps = 0;

    while (target && Object.prototype.hasOwnProperty.call(LEGACY_SLUGS, target) && steps < 5) {
      const nextTarget = LEGACY_SLUGS[target]?.trim().toLowerCase();
      if (!nextTarget || visited.has(nextTarget)) {
        break;
      }
      visited.add(nextTarget);
      target = nextTarget;
      steps++;
    }

    if (target && slugToService.has(target)) {
      return {
        type: 'REDIRECT',
        requestedSlug,
        cleanSlug,
        targetSlug: target,
        targetUrl: `/services/${target}`,
        service: slugToService.get(target),
        matchStrategy: 'EXPLICIT_LEGACY',
      };
    }
  }

  // PRIORITY 3: Automated legacy matching
  const autoMatch = normalizeAndMatchLegacySlug(cleanSlug, activeServices, slugToService);
  if (autoMatch && autoMatch.targetSlug && slugToService.has(autoMatch.targetSlug)) {
    return {
      type: 'REDIRECT',
      requestedSlug,
      cleanSlug,
      targetSlug: autoMatch.targetSlug,
      targetUrl: `/services/${autoMatch.targetSlug}`,
      service: autoMatch.service,
      matchStrategy: 'AUTOMATED_LEGACY',
    };
  }

  // PRIORITY 4: Not found in active catalog or legacy map
  return {
    type: 'NOT_FOUND',
    requestedSlug,
    cleanSlug,
  };
}


/**
 * Generate SEO Page Title for a service (30-60 characters ideal)
 */
export function getServiceSeoTitle(service: ServiceLike): string {
  const device = `${service.brand} ${service.model}${service.variant ? ` ${service.variant}` : ''}`.trim();
  const title = `${service.serviceName} for ${device} | MTS Lab Kathmandu`;
  if (title.length <= 65) return title;
  return `${service.serviceName} - ${device} | MTS Lab`;
}

/**
 * Generate SEO Meta Description (strictly <= 158 chars)
 */
export function getServiceSeoDescription(service: ServiceLike): string {
  const device = `${service.brand} ${service.model}`.trim();
  const priceStr = formatNprPrice(service.price, service.priceType);
  const timeStr = service.estimatedTime ? ` Time: ${service.estimatedTime}.` : '';

  let desc = `Professional ${service.serviceName} for ${device} at MTS Lab Kathmandu.${timeStr} Cost: ${priceStr}. Certified repair in New Road. Call 9869276668.`;
  if (desc.length > 158) {
    desc = `${service.serviceName} for ${device} at MTS Lab Kathmandu. Cost: ${priceStr}. New Road lab. Call 9869276668.`;
  }
  if (desc.length > 158) {
    desc = `${service.serviceName} for ${device} at MTS Lab Kathmandu. ${priceStr}. Call 9869276668.`;
  }
  return desc.slice(0, 158);
}

import {
  checkWarrantyEligibility,
  isServiceEligibleForWarranty,
  getServiceFaqSubtitle,
  generateContextAwareDirectAnswer,
  generateContextAwareFaqs,
  sanitizeServiceDescription,
  WarrantyEligibilityResult,
} from './warrantyPolicy';

export {
  checkWarrantyEligibility,
  isServiceEligibleForWarranty,
  getServiceFaqSubtitle,
  generateContextAwareDirectAnswer,
  generateContextAwareFaqs,
  sanitizeServiceDescription,
};
export type { WarrantyEligibilityResult };

/**
 * Generate direct answer text for Answer Engines (AEO - Google AI Mode, ChatGPT, Gemini)
 * Enforces the global warranty rule: only verified original battery replacements may claim warranty.
 */
export function getServiceDirectAnswer(service: ServiceLike): string {
  const device = `${service.brand} ${service.model}${service.variant ? ` ${service.variant}` : ''}`.trim();
  const priceStr = formatNprPrice(service.price, service.priceType);
  const timeStr = service.estimatedTime ? ` Estimated turnaround time is ${service.estimatedTime}.` : '';
  const problem = service.problem ? ` Solves: ${service.problem}.` : '';

  return generateContextAwareDirectAnswer(service, {
    device,
    priceStr,
    timeStr,
    problemStr: problem,
  });
}

/**
 * Generate verified FAQs for a service
 * Enforces the global warranty rule: only verified original battery replacements may feature warranty FAQs.
 */
export function getServiceFaqs(service: ServiceLike): { question: string; answer: string }[] {
  const device = `${service.brand} ${service.model}${service.variant ? ` ${service.variant}` : ''}`.trim();
  const priceStr = formatNprPrice(service.price, service.priceType);
  const estTime = service.estimatedTime || '1 to 2 hours';

  return generateContextAwareFaqs(service, {
    device,
    priceStr,
    estTime,
  });
}

/**
 * Generate Schema.org LocalBusiness JSON-LD
 */
export function getLocalBusinessJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${SITE_URL}/#localbusiness`,
    name: BUSINESS_NAME,
    legalName: BUSINESS_LEGAL_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/mts-logo.jpg`,
    image: `${SITE_URL}/mts-logo.jpg`,
    telephone: BUSINESS_PHONE_INTL,
    email: BUSINESS_EMAIL,
    priceRange: 'NPR',
    currenciesAccepted: 'NPR',
    paymentAccepted: 'Cash, Fonepay, Bank Transfer',
    address: {
      '@type': 'PostalAddress',
      ...BUSINESS_ADDRESS,
    },
    geo: {
      '@type': 'GeoCoordinates',
      ...BUSINESS_GEO,
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '10:00',
        closes: '19:00',
      },
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Saturday'],
        opens: '10:00',
        closes: '18:00',
      },
    ],
    sameAs: ['https://www.facebook.com/mtslabnepal'],
  };
}

/**
 * Generate Schema.org Service, Offer, FAQPage, and BreadcrumbList JSON-LD for a service page
 */
export function getServicePageJsonLd(service: ServiceLike, slug: string): Record<string, unknown>[] {
  const serviceUrl = `${SITE_URL}/services/${slug}`;
  const device = `${service.brand} ${service.model}${service.variant ? ` ${service.variant}` : ''}`.trim();
  const faqs = getServiceFaqs(service);

  const breadcrumbsJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: SITE_URL,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Repair Services',
        item: `${SITE_URL}/services`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: `${service.serviceName} (${device})`,
        item: serviceUrl,
      },
    ],
  };

  const serviceJsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${serviceUrl}#service`,
    name: `${service.serviceName} for ${device}`,
    serviceType: service.category || 'Smartphone Hardware Repair',
    description: getServiceSeoDescription(service),
    provider: {
      '@type': 'LocalBusiness',
      name: BUSINESS_NAME,
      telephone: BUSINESS_PHONE_INTL,
      address: {
        '@type': 'PostalAddress',
        ...BUSINESS_ADDRESS,
      },
    },
    areaServed: {
      '@type': 'City',
      name: 'Kathmandu',
    },
  };

  // Only include Offer when verified price > 0 and priceType justifies it
  if (service.price && service.price > 0 && service.priceType !== 'ON_INSPECTION' && service.priceType !== 'CONTACT_FOR_PRICE') {
    serviceJsonLd.offers = {
      '@type': 'Offer',
      price: String(service.price),
      priceCurrency: 'NPR',
      priceValidUntil: '2026-12-31',
      availability: 'https://schema.org/InStock',
      url: serviceUrl,
    };
  }

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: f.answer,
      },
    })),
  };

  return [breadcrumbsJsonLd, serviceJsonLd, faqJsonLd];
}

/**
 * Static page SEO definitions
 */
export interface StaticPageSeo {
  title: string;
  description: string;
  canonical: string;
  noindex?: boolean;
}

export const INDEX_ROBOTS = 'index, follow, max-snippet:-1, max-image-preview:large';
export const NOINDEX_ROBOTS = 'noindex, nofollow';

/**
 * Normalizes a URL path for consistent routing and lookup:
 * - Trims whitespace
 * - Strips redundant trailing slashes (preserves root '/')
 * - Lowercases path for routing lookup
 */
export function normalizeSeoPath(pathname: string): string {
  if (!pathname) return '/';
  const clean = pathname.trim();
  const withoutTrailing = clean.replace(/\/+$/, '');
  return withoutTrailing === '' ? '/' : withoutTrailing.toLowerCase();
}

/**
 * Gracefully converts a service slug into a human-readable title
 * used for immediate metadata rendering prior to asynchronous catalog hydration.
 * E.g., 'iphone-11-back-camera-replacement' -> 'iPhone 11 Back Camera Replacement'
 */
export function slugToHumanTitle(slug?: string | null): string {
  if (!slug) return 'Repair Service';
  const clean = slug.trim().replace(/^[\/]+|[\/]+$/g, '');
  const tokens = clean.split('-').filter(Boolean);

  const formatted = tokens.map((word) => {
    const lower = word.toLowerCase();
    if (lower === 'iphone') return 'iPhone';
    if (lower === 'ipad') return 'iPad';
    if (lower === 'oled') return 'OLED';
    if (lower === 'amoled') return 'AMOLED';
    if (lower === 'oca') return 'OCA';
    if (lower === 'ic') return 'IC';
    if (lower === 'lcd') return 'LCD';
    if (lower === 'gx') return 'GX';
    if (lower === 'sim') return 'SIM';
    if (lower === '5g') return '5G';
    if (lower === '4g') return '4G';
    if (lower === 'npr') return 'NPR';
    if (lower === 'usb') return 'USB';
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  });

  return formatted.join(' ') || 'Repair Service';
}

export const STATIC_PAGES_SEO: Record<string, StaticPageSeo> = {
  '/': {
    title: 'MTS Lab – Smartphone Hardware & Chip-Level Repair Lab Kathmandu',
    description: 'Premier mobile repair laboratory in New Road, Kathmandu. Laser screen repair, OCA glass replacement, motherboard IC microsoldering, battery replacement & tracking.',
    canonical: `${SITE_URL}/`,
  },
  '/services': {
    title: 'Repair Price Finder & Services Catalog | MTS Lab Kathmandu',
    description: 'Explore verified repair prices for Apple, Samsung, OnePlus, Xiaomi & more. Laser line fix, display replacement, glass change & IC repairs in New Road.',
    canonical: `${SITE_URL}/services`,
  },
  '/price-finder': {
    title: 'Repair Price Finder & Services Catalog | MTS Lab Kathmandu',
    description: 'Explore verified repair prices for Apple, Samsung, OnePlus, Xiaomi & more. Laser line fix, display replacement, glass change & IC repairs in New Road.',
    canonical: `${SITE_URL}/services`, // Canonicalizes to /services
  },
  '/about': {
    title: 'About MTS Lab – Advanced Mobile Hardware Technology Station',
    description: 'Learn about MTS Lab Kathmandu, our cleanroom hardware facility, master technician team, advanced laser machines, and chip-level repair expertise.',
    canonical: `${SITE_URL}/about`,
  },
  '/contact': {
    title: 'Contact MTS Lab Kathmandu – Hotline, Location & Support',
    description: 'Visit MTS Lab at Pakosadak, New Road (Opposite People\'s Plaza back gate), Kathmandu. Hotline: 9869276668, Landline: 015364307. Directions & inquiry.',
    canonical: `${SITE_URL}/contact`,
  },
  '/track': {
    title: 'Track Repair Status Online | MTS Lab Kathmandu',
    description: 'Enter your Repair Tracking ID to monitor live repair progress, diagnostic results, technician notes, and delivery status in real-time.',
    canonical: `${SITE_URL}/track`,
  },
  '/shop': {
    title: 'Hardware & Accessories Shop | MTS Lab Kathmandu',
    description: 'Shop genuine smartphone accessories, displays, batteries, cables, and certified replacement parts at MTS Lab New Road, Kathmandu.',
    canonical: `${SITE_URL}/shop`,
  },
  '/terms': {
    title: 'Terms of Service | MTS Lab Kathmandu',
    description: 'Terms of service, repair warranty policies, diagnostic assessment terms, and customer rights at MTS Lab Kathmandu.',
    canonical: `${SITE_URL}/terms`,
  },
  '/privacy': {
    title: 'Privacy Policy | MTS Lab Kathmandu',
    description: 'Privacy policy and data protection commitments for repair tracking and customer communications at MTS Lab Kathmandu.',
    canonical: `${SITE_URL}/privacy`,
  },
};

/**
 * Detect if a route should have noindex directive
 */
export function isNoindexRoute(pathname: string): boolean {
  const norm = normalizeSeoPath(pathname);
  if (
    norm.startsWith('/dashboard') ||
    norm.startsWith('/login') ||
    norm.startsWith('/forgot-password') ||
    norm.startsWith('/reset-password') ||
    norm.startsWith('/pending-approval') ||
    norm.startsWith('/rejected-access')
  ) {
    return true;
  }
  return false;
}

