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
  if (
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password') ||
    pathname.startsWith('/pending-approval') ||
    pathname.startsWith('/rejected-access')
  ) {
    return true;
  }
  return false;
}
