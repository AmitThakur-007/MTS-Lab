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
export const BUSINESS_OPENING_HOURS = ['Su-Fr 10:20-18:30'];

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
  'iphone-14-pro-max-standard-original-2': 'iphone-14-pro-max-14-original-display-replacement',
  'iphone-14-pro-max-standard-original': 'iphone-14-pro-max-14-original-display-replacement',
  'iphone-14-pro-max-standard-original-standard': 'iphone-14-pro-max-14-original-display-replacement',
  'iphone-14-pro-max-original-display-replacement': 'iphone-14-pro-max-14-original-display-replacement',
  // iPhone 11 & 12 legacy slug variants without repetitive model tokens
  'iphone-11-pro-max-original-display-replacement': 'iphone-11-pro-max-11-original-display-replacement',
  'iphone-12-pro-max-original-display-replacement': 'iphone-12-pro-max-12-original-display-replacement',
  // iPhone 13 & 15 Pro Max legacy slug variants
  'iphone-13-pro-max-original-display-replacement': 'iphone-13-pro-max-13-original-display-replacement',
  'iphone-15-pro-max-original-display-replacement': 'iphone-15-pro-max-15-original-display-replacement',
};

export type SlugResolutionType = 'ACTIVE' | 'REDIRECT' | 'NOT_FOUND';

export type SlugResolutionReason =
  | 'EXACT_ACTIVE'
  | 'LEGACY_ALIAS'
  | 'NORMALIZED_SLUG'
  | 'MODEL_COMPONENT_MATCH'
  | 'MODEL_DEFAULT_FALLBACK'
  | 'MODEL_LISTING_FALLBACK'
  | 'UNKNOWN_MODEL'
  | 'UNKNOWN_SERVICE'
  | 'AMBIGUOUS_SERVICE';

export interface SlugResolutionResult {
  type: SlugResolutionType;
  requestedSlug: string;
  cleanSlug: string;
  targetSlug?: string;
  targetUrl?: string;
  service?: ServiceLike;
  matchStrategy?: 'EXACT_ACTIVE' | 'EXPLICIT_LEGACY' | 'AUTOMATED_LEGACY';
  reason?: SlugResolutionReason;
  recognizedModel?: string;
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
  'standard',
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
 * Strips trailing duplicate counters such as -2, -3, -4, _1, _2
 * while preserving legitimate device model numbers (e.g. iPhone 11, iPhone 12, iPhone 7, iPhone 8).
 */
export function stripTrailingDuplicateCounter(slug: string): string {
  if (!slug) return '';
  const match = slug.match(/[-_](\d+)$/);
  if (!match) return slug;
  const num = match[1];

  // If the slug is just a standalone model like iphone-11, iphone-12, iphone-7, iphone-8,
  // do not strip the number because it defines the device model!
  if (/^iphone-\d+$/.test(slug)) {
    return slug;
  }

  // If slug ends with a model pattern like -iphone-11 or -iphone-7, preserve it
  if (/(?:^|-)iphone-\d+$/.test(slug)) {
    return slug;
  }

  // Otherwise, it is a trailing duplicate counter (e.g. -standard-original-2, -replacement-2, _1)
  return slug.replace(/[-_]\d+$/, '');
}

/**
 * Reusable, deterministic slug normalizer:
 * - Converts to lowercase and trims
 * - Strips trailing duplicate counters (-2, -3, _1, etc.)
 * - Replaces separators (_, +, &) with hyphens
 * - Collapses consecutive hyphens and trims edges
 * - Removes known obsolete descriptive phrases
 */
export function normalizeLegacySlug(rawSlug: string | undefined | null): string {
  if (!rawSlug) return '';
  let slug = String(rawSlug).trim().toLowerCase();
  slug = stripTrailingDuplicateCounter(slug);
  slug = slug.replace(/[+/_&]/g, '-').replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  slug = stripLegacyNoisePhrases(slug);
  slug = stripTrailingDuplicateCounter(slug);
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

export interface LegacyMatchOutput {
  targetSlug?: string;
  targetUrl?: string;
  service?: ServiceLike;
  reason: SlugResolutionReason;
  recognizedModel?: string;
}

/**
 * Universal 4-Tier Legacy Service URL Resolution Engine
 * Tier 1: Exact active slug match
 * Tier 2: Legacy normalization & catalog matching
 * Tier 3: Model-level safe fallback (primary display replacement or model listing)
 * Tier 4: Genuine NOT_FOUND for unknown brands or unsupported models
 */
export function normalizeAndMatchLegacySlug(
  requestedSlug: string,
  activeServices: ServiceLike[],
  slugToServiceMap?: Map<string, ServiceLike>
): LegacyMatchOutput | null {
  const norm = normalizeLegacySlug(requestedSlug);
  if (!norm) return null;

  const slugToService = slugToServiceMap || buildSlugMap(activeServices).slugToService;

  // 1. Direct match on normalized slug (TIER 2)
  if (slugToService.has(norm)) {
    const s = slugToService.get(norm)!;
    return {
      targetSlug: norm,
      targetUrl: `/services/${norm}`,
      service: s,
      reason: 'NORMALIZED_SLUG',
      recognizedModel: s.model,
    };
  }

  // 2. Redundant model number removed (e.g. iphone-11-11- -> iphone-11-) (TIER 2)
  const collapsed = norm.replace(/iphone-(\d+)-\1-/, 'iphone-$1-');
  if (slugToService.has(collapsed)) {
    const s = slugToService.get(collapsed)!;
    return {
      targetSlug: collapsed,
      targetUrl: `/services/${collapsed}`,
      service: s,
      reason: 'NORMALIZED_SLUG',
      recognizedModel: s.model,
    };
  }

  // 3. Redundant model number inserted (e.g. iphone-14-pro-max- -> iphone-14-pro-max-14-) (TIER 2)
  const inserted = norm.replace(/iphone-(\d+)-(pro-max)-/, 'iphone-$1-$2-$1-');
  if (slugToService.has(inserted)) {
    const s = slugToService.get(inserted)!;
    return {
      targetSlug: inserted,
      targetUrl: `/services/${inserted}`,
      service: s,
      reason: 'NORMALIZED_SLUG',
      recognizedModel: s.model,
    };
  }

  // 4. Structured Model Extraction
  const modelMatch = extractModelIdentifier(norm);
  if (!modelMatch) {
    // Model not recognized -> proceed to Tier 4 NOT_FOUND
    return null;
  }

  // Filter active catalog services for this recognized model
  const modelServices = activeServices.filter((s) => {
    const sModel = (s.model || '').trim().toLowerCase();
    if (modelMatch.id === 'iphone-xs-max') {
      return sModel === 'xsmax' || sModel === 'xs max';
    }
    return sModel === modelMatch.name;
  });

  if (modelServices.length === 0) {
    // Recognized brand pattern but unsupported model in catalog -> Tier 4 NOT_FOUND
    return null;
  }

  // Helper: Find primary display replacement service for Tier 3 fallback
  const getPrimaryDisplayService = (): { slug: string; service: ServiceLike } | null => {
    const displays = modelServices.filter(
      (s) => (s.category || '').toLowerCase() === 'display' || s.serviceName.toLowerCase().includes('display')
    );
    if (displays.length === 0) return null;

    const origDisplay = displays.find(
      (s) => s.serviceName.toLowerCase().includes('original') &&
        !s.serviceName.toLowerCase().includes('gx') &&
        !s.serviceName.toLowerCase().includes('dd') &&
        !s.serviceName.toLowerCase().includes('copy')
    ) || displays[0];

    const slug = Array.from(slugToService.entries()).find(([_, s]) => s.id === origDisplay.id)?.[0];
    return slug ? { slug, service: origDisplay } : null;
  };

  // Detect component category and grade tokens
  const isDisplay = norm.includes('display') || norm.includes('screen') || norm.includes('lcd') || norm.includes('oled') || norm.includes('amoled');
  const isBattery = norm.includes('battery');
  const isCamera = norm.includes('camera');
  const isBackPanel = norm.includes('back-panel') || norm.includes('back-cover') || norm.includes('back-glass') || norm.includes('rear-glass');
  const isSpeaker = norm.includes('speaker') || norm.includes('buzzer') || norm.includes('ringer');
  const isCharging = norm.includes('charging') || norm.includes('dock-flex') || norm.includes('charging-flex');

  const hasOriginal = norm.includes('original') || norm.includes('genuine');
  const hasGx = norm.includes('gx');
  const hasCopy = norm.includes('copy') || norm.includes('aftermarket');
  const hasDd = norm.includes('dd');
  const hasIncell = norm.includes('incell') || norm.includes('in-cell');

  // Check for conflicting grade keywords (e.g. gx + original, copy + original, copy + gx)
  const isConflictingGrade = (hasGx && hasOriginal) || (hasCopy && hasOriginal) || (hasCopy && hasGx);

  // A. DISPLAY MATCHING & CONFLICTING DISPLAY GRADES (TIER 2 & TIER 3)
  if (isDisplay || isConflictingGrade || (hasOriginal && !isBattery && !isCamera && !isSpeaker && !isCharging && !isBackPanel)) {
    const compServices = modelServices.filter(
      (s) => (s.category || '').toLowerCase() === 'display' || s.serviceName.toLowerCase().includes('display')
    );

    // If conflicting grade keywords (e.g. iphone-15-pro-max-standard-gx-original):
    // Do NOT return NOT_FOUND! Treat grade as uncertain and use Tier 3 Model-level safe fallback
    if (isConflictingGrade) {
      const primary = getPrimaryDisplayService();
      if (primary) {
        return {
          targetSlug: primary.slug,
          targetUrl: `/services/${primary.slug}`,
          service: primary.service,
          reason: 'MODEL_DEFAULT_FALLBACK',
          recognizedModel: modelMatch.id,
        };
      }
      return {
        targetUrl: `/services?model=${encodeURIComponent(modelMatch.id)}`,
        reason: 'MODEL_LISTING_FALLBACK',
        recognizedModel: modelMatch.id,
      };
    }

    if (compServices.length > 0) {
      let filtered: ServiceLike[] = [];
      if (hasOriginal && !hasCopy && !hasGx && !hasDd && !hasIncell) {
        filtered = compServices.filter(
          (s) => s.serviceName.toLowerCase().includes('original') &&
            !s.serviceName.toLowerCase().includes('gx') &&
            !s.serviceName.toLowerCase().includes('dd') &&
            !s.serviceName.toLowerCase().includes('copy')
        );
      } else if (hasCopy) {
        filtered = compServices.filter((s) => s.serviceName.toLowerCase().includes('copy'));
      } else if (hasGx) {
        filtered = compServices.filter((s) => s.serviceName.toLowerCase().includes('gx'));
      } else if (hasDd) {
        filtered = compServices.filter((s) => s.serviceName.toLowerCase().includes('dd'));
      } else if (hasIncell) {
        filtered = compServices.filter((s) => s.serviceName.toLowerCase().includes('incell') || s.serviceName.toLowerCase().includes('in-cell'));
      } else {
        // Unspecified grade! If single service, match it. If multiple, proceed to Tier 3 Fallback A
        if (compServices.length === 1) {
          filtered = compServices;
        } else {
          const primary = getPrimaryDisplayService();
          if (primary) {
            return {
              targetSlug: primary.slug,
              targetUrl: `/services/${primary.slug}`,
              service: primary.service,
              reason: 'MODEL_DEFAULT_FALLBACK',
              recognizedModel: modelMatch.id,
            };
          }
        }
      }

      if (filtered.length === 1) {
        const match = filtered[0];
        const targetSlug = Array.from(slugToService.entries()).find(([_, s]) => s.id === match.id)?.[0];
        if (targetSlug) {
          return {
            targetSlug,
            targetUrl: `/services/${targetSlug}`,
            service: match,
            reason: 'MODEL_COMPONENT_MATCH',
            recognizedModel: modelMatch.id,
          };
        }
      }
    }
  }

  // B. BATTERY MATCHING (TIER 2)
  if (isBattery) {
    const compServices = modelServices.filter(
      (s) => (s.category || '').toLowerCase() === 'battery' || s.serviceName.toLowerCase().includes('battery')
    );
    if (compServices.length > 0) {
      const isMarket = norm.includes('market');
      const isCopy = norm.includes('copy');
      const isOrig = (hasOriginal || norm.includes('1-year-warranty')) && !isMarket && !isCopy;

      let filtered: ServiceLike[] = [];
      if (isMarket) {
        filtered = compServices.filter((s) => s.serviceName.toLowerCase().includes('market'));
      } else if (isCopy) {
        filtered = compServices.filter((s) => s.serviceName.toLowerCase().includes('copy'));
      } else if (isOrig) {
        filtered = compServices.filter((s) => s.serviceName.toLowerCase().includes('original') && !s.serviceName.toLowerCase().includes('market'));
      } else if (compServices.length === 1) {
        filtered = compServices;
      }

      if (filtered.length === 1) {
        const match = filtered[0];
        const targetSlug = Array.from(slugToService.entries()).find(([_, s]) => s.id === match.id)?.[0];
        if (targetSlug) {
          return {
            targetSlug,
            targetUrl: `/services/${targetSlug}`,
            service: match,
            reason: 'MODEL_COMPONENT_MATCH',
            recognizedModel: modelMatch.id,
          };
        }
      }
    }
  }

  // C. CAMERA MATCHING (TIER 2)
  if (isCamera) {
    const compServices = modelServices.filter(
      (s) => (s.category || '').toLowerCase() === 'camera' || s.serviceName.toLowerCase().includes('camera')
    );
    if (compServices.length > 0) {
      const isFront = norm.includes('front') || norm.includes('selfie');
      const isBack = norm.includes('back') || norm.includes('rear');

      if (isFront && !isBack) {
        const filtered = compServices.filter((s) => s.serviceName.toLowerCase().includes('front'));
        if (filtered.length === 1) {
          const match = filtered[0];
          const targetSlug = Array.from(slugToService.entries()).find(([_, s]) => s.id === match.id)?.[0];
          if (targetSlug) {
            return {
              targetSlug,
              targetUrl: `/services/${targetSlug}`,
              service: match,
              reason: 'MODEL_COMPONENT_MATCH',
              recognizedModel: modelMatch.id,
            };
          }
        }
      } else if (isBack && !isFront) {
        const filtered = compServices.filter((s) => s.serviceName.toLowerCase().includes('back'));
        if (filtered.length === 1) {
          const match = filtered[0];
          const targetSlug = Array.from(slugToService.entries()).find(([_, s]) => s.id === match.id)?.[0];
          if (targetSlug) {
            return {
              targetSlug,
              targetUrl: `/services/${targetSlug}`,
              service: match,
              reason: 'MODEL_COMPONENT_MATCH',
              recognizedModel: modelMatch.id,
            };
          }
        }
      }
    }
  }

  // D. SPEAKER / BUZZER MATCHING (TIER 2)
  if (isSpeaker) {
    const compServices = modelServices.filter(
      (s) => (s.category || '').toLowerCase() === 'speaker' ||
        s.serviceName.toLowerCase().includes('speaker') ||
        s.serviceName.toLowerCase().includes('buzzer')
    );
    if (compServices.length > 0) {
      if (norm.includes('buzzer')) {
        const buz = compServices.filter((s) => s.serviceName.toLowerCase().includes('buzzer'));
        if (buz.length === 1) {
          const match = buz[0];
          const targetSlug = Array.from(slugToService.entries()).find(([_, s]) => s.id === match.id)?.[0];
          if (targetSlug) {
            return {
              targetSlug,
              targetUrl: `/services/${targetSlug}`,
              service: match,
              reason: 'MODEL_COMPONENT_MATCH',
              recognizedModel: modelMatch.id,
            };
          }
        }
      }
      if (compServices.length === 1) {
        const match = compServices[0];
        const targetSlug = Array.from(slugToService.entries()).find(([_, s]) => s.id === match.id)?.[0];
        if (targetSlug) {
          return {
            targetSlug,
            targetUrl: `/services/${targetSlug}`,
            service: match,
            reason: 'MODEL_COMPONENT_MATCH',
            recognizedModel: modelMatch.id,
          };
        }
      }
    }
  }

  // E. CHARGING FLEX MATCHING (TIER 2)
  if (isCharging) {
    const compServices = modelServices.filter(
      (s) => (s.category || '').toLowerCase().includes('charging') ||
        s.serviceName.toLowerCase().includes('charging')
    );
    if (compServices.length > 0) {
      if (compServices.length === 1) {
        const match = compServices[0];
        const targetSlug = Array.from(slugToService.entries()).find(([_, s]) => s.id === match.id)?.[0];
        if (targetSlug) {
          return {
            targetSlug,
            targetUrl: `/services/${targetSlug}`,
            service: match,
            reason: 'MODEL_COMPONENT_MATCH',
            recognizedModel: modelMatch.id,
          };
        }
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
        if (targetSlug) {
          return {
            targetSlug,
            targetUrl: `/services/${targetSlug}`,
            service: match,
            reason: 'MODEL_COMPONENT_MATCH',
            recognizedModel: modelMatch.id,
          };
        }
      }
    }
  }

  // F. BACK PANEL MATCHING (TIER 2)
  if (isBackPanel) {
    const compServices = modelServices.filter(
      (s) => (s.category || '').toLowerCase().includes('back panel') ||
        s.serviceName.toLowerCase().includes('back panel')
    );
    if (compServices.length > 0) {
      const isHq = norm.includes('high-quality') || norm.includes('high quality');
      const isCopy = norm.includes('copy');
      const isOrig = hasOriginal && !isCopy;

      let filtered: ServiceLike[] = [];
      if (isHq) {
        filtered = compServices.filter((s) => s.serviceName.toLowerCase().includes('high quality') || s.serviceName.toLowerCase().includes('high-quality'));
      } else if (isCopy) {
        filtered = compServices.filter((s) => s.serviceName.toLowerCase().includes('copy') && !s.serviceName.toLowerCase().includes('high quality'));
      } else if (isOrig) {
        filtered = compServices.filter((s) => s.serviceName.toLowerCase().includes('original'));
      } else if (compServices.length === 1) {
        filtered = compServices;
      }

      if (filtered.length === 1) {
        const match = filtered[0];
        const targetSlug = Array.from(slugToService.entries()).find(([_, s]) => s.id === match.id)?.[0];
        if (targetSlug) {
          return {
            targetSlug,
            targetUrl: `/services/${targetSlug}`,
            service: match,
            reason: 'MODEL_COMPONENT_MATCH',
            recognizedModel: modelMatch.id,
          };
        }
      }
    }
  }

  // TIER 3: MODEL-LEVEL SAFE FALLBACK
  // When model is recognized in catalog, but service wording is corrupted, ambiguous, or outdated:
  // Fallback A: Primary display replacement service
  const primaryDisplay = getPrimaryDisplayService();
  if (primaryDisplay) {
    return {
      targetSlug: primaryDisplay.slug,
      targetUrl: `/services/${primaryDisplay.slug}`,
      service: primaryDisplay.service,
      reason: 'MODEL_DEFAULT_FALLBACK',
      recognizedModel: modelMatch.id,
    };
  }

  // Fallback B: Model-filtered listing
  return {
    targetUrl: `/services?model=${encodeURIComponent(modelMatch.id)}`,
    reason: 'MODEL_LISTING_FALLBACK',
    recognizedModel: modelMatch.id,
  };
}

/**
 * Resolves a requested URL slug against active services and legacy redirects.
 * Follows strict priority order:
 * TIER 1. Exact active slug match
 * TIER 2. Explicit legacy dictionary lookup (LEGACY_SLUGS) with loop protection
 * TIER 2 / 3. Automated legacy normalization & model-level recovery (normalizeAndMatchLegacySlug)
 * TIER 4. NOT_FOUND (never redirects ambiguous or unknown requests to arbitrary devices)
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
      reason: 'UNKNOWN_MODEL',
    };
  }

  const slugToService = Array.isArray(slugMapOrServices)
    ? buildSlugMap(slugMapOrServices).slugToService
    : slugMapOrServices;

  const activeServices = Array.isArray(slugMapOrServices)
    ? slugMapOrServices
    : Array.from(slugToService.values());

  // TIER 1: Exact active service match
  if (slugToService.has(cleanSlug)) {
    const activeService = slugToService.get(cleanSlug);
    return {
      type: 'ACTIVE',
      requestedSlug,
      cleanSlug,
      service: activeService,
      matchStrategy: 'EXACT_ACTIVE',
      reason: 'EXACT_ACTIVE',
      recognizedModel: activeService?.model,
    };
  }

  // TIER 2: Explicit legacy mapping from dictionary with loop protection
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
      const matched = slugToService.get(target);
      return {
        type: 'REDIRECT',
        requestedSlug,
        cleanSlug,
        targetSlug: target,
        targetUrl: `/services/${target}`,
        service: matched,
        matchStrategy: 'EXPLICIT_LEGACY',
        reason: 'LEGACY_ALIAS',
        recognizedModel: matched?.model,
      };
    }
  }

  // TIER 2 & TIER 3: Automated legacy matching and model-level safe fallback
  const autoMatch = normalizeAndMatchLegacySlug(cleanSlug, activeServices, slugToService);
  if (autoMatch && (autoMatch.targetSlug || autoMatch.targetUrl)) {
    const targetSlug = autoMatch.targetSlug;
    const targetUrl = autoMatch.targetUrl || (targetSlug ? `/services/${targetSlug}` : undefined);
    return {
      type: 'REDIRECT',
      requestedSlug,
      cleanSlug,
      targetSlug,
      targetUrl,
      service: autoMatch.service,
      matchStrategy: 'AUTOMATED_LEGACY',
      reason: autoMatch.reason,
      recognizedModel: autoMatch.recognizedModel,
    };
  }

  // TIER 4: Genuinely unknown or unsupported destinations
  return {
    type: 'NOT_FOUND',
    requestedSlug,
    cleanSlug,
    reason: 'UNKNOWN_MODEL',
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
        opens: '10:20',
        closes: '18:30',
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

