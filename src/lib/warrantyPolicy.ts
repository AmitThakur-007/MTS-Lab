/**
 * MTS LAB - GLOBAL WARRANTY CONTENT RULE & ELIGIBILITY POLICY
 * 
 * Mandatory Business Rule:
 * Warranty-related information is permitted ONLY for services explicitly
 * classified as original battery replacement with a verified business policy.
 * 
 * For every other service (Display, Front Glass, Screen, Motherboard/IC,
 * Charging Port/Flex, Speaker, Camera, Back Panel, Housing, Software, Diagnostics,
 * Third-Party/Market Batteries, and Ambiguous classifications):
 * DO NOT display warranty promises, warranty coverage claims, warranty-policy references,
 * or warranty-related promotional wording.
 */

export interface WarrantyEligibilityResult {
  /** Whether warranty wording is permitted on public pages, FAQs, cards, and metadata */
  isEligible: boolean;
  /** Detailed reason explaining the classification */
  reason: string;
  /** Normalized service category */
  normalizedCategory: string;
  /** Whether the service category is strictly Battery */
  isBatteryCategory: boolean;
  /** Whether the part is strictly original / genuine */
  isOriginalPart: boolean;
  /** Whether the part is third-party / market / copy */
  isThirdPartyOrMarket: boolean;
  /** Whether an authoritative warranty policy is explicitly confirmed */
  hasConfiguredPolicy: boolean;
  /** Formatted verified duration (e.g. "1-Year Official Battery Warranty") */
  verifiedDuration?: string;
  /** Specific policy notes if available */
  policyDetails?: string;
}

export interface ServiceLikeForWarranty {
  id?: string;
  brand?: string;
  model?: string;
  variant?: string | null;
  category?: string | null;
  serviceName: string;
  description?: string | null;
  problem?: string | null;
  notes?: string | null;
  price?: number;
  priceType?: string;
}

// Canonical categories that are strictly forbidden from displaying warranty information
const NON_WARRANTY_CATEGORY_KEYWORDS = [
  'display',
  'screen',
  'glass',
  'front glass',
  'back glass',
  'back panel',
  'panel',
  'oled',
  'lcd',
  'lining',
  'laser',
  'flex',
  'charging',
  'charging flex',
  'speaker',
  'audio',
  'earpiece',
  'camera',
  'lens',
  'housing',
  'body',
  'motherboard',
  'ic',
  'mic',
  'microphone',
  'software',
  'water damage',
  'cleaning',
  'face id',
  'network',
];

// Keywords indicating third-party, aftermarket, copy, or market components
const THIRD_PARTY_OR_COPY_KEYWORDS = [
  'market original',
  'market',
  'copy',
  'third-party',
  'third party',
  '3rd party',
  'compatible',
  'aftermarket',
  'generic',
  'high copy',
  'grade a',
  'grade b',
  'gx',
  'zy',
  'rj',
  'jk',
];

// Keywords indicating genuine / original parts
const ORIGINAL_KEYWORDS = [
  'original',
  'orginal', // handle common typo in catalog
  'genuine',
  'oem',
  'apple original',
  'service center original',
];

/**
 * Determine warranty eligibility for a service using authoritative service metadata.
 * Defaults to false for any ambiguous, non-battery, or unverified service.
 */
export function checkWarrantyEligibility(service: ServiceLikeForWarranty): WarrantyEligibilityResult {
  if (!service || !service.serviceName) {
    return {
      isEligible: false,
      reason: 'Missing service specification',
      normalizedCategory: 'unknown',
      isBatteryCategory: false,
      isOriginalPart: false,
      isThirdPartyOrMarket: false,
      hasConfiguredPolicy: false,
    };
  }

  const rawCat = (service.category || '').trim().toLowerCase();
  const rawName = (service.serviceName || '').trim().toLowerCase();
  const rawDesc = (service.description || '').trim().toLowerCase();
  const rawProblem = (service.problem || '').trim().toLowerCase();
  const rawNotes = (service.notes || '').trim().toLowerCase();
  const fullText = `${rawName} ${rawDesc} ${rawProblem} ${rawNotes}`;

  // 1. Strict Category Normalization
  const isBatteryCategory = rawCat === 'battery' || rawCat === 'battery replacement';

  // 2. Immediate Disqualification for Non-Battery Categories & Keywords
  const hasDisqualifyingKeyword = NON_WARRANTY_CATEGORY_KEYWORDS.some(
    (kw) => rawCat.includes(kw) || rawName.includes(kw)
  );

  if (!isBatteryCategory || hasDisqualifyingKeyword) {
    return {
      isEligible: false,
      reason: `Non-battery service category (${rawCat || 'unspecified'}). Warranty is restricted to original battery replacement only.`,
      normalizedCategory: rawCat || 'repair',
      isBatteryCategory: false,
      isOriginalPart: false,
      isThirdPartyOrMarket: false,
      hasConfiguredPolicy: false,
    };
  }

  // 3. Inspect Component Grade: Market / Copy / Third-party vs Genuine Original
  const isThirdPartyOrMarket = THIRD_PARTY_OR_COPY_KEYWORDS.some((kw) => fullText.includes(kw));

  if (isThirdPartyOrMarket) {
    return {
      isEligible: false,
      reason: 'Third-party or market-grade battery replacement. Warranty display is not permitted under MTS Lab policy.',
      normalizedCategory: 'battery',
      isBatteryCategory: true,
      isOriginalPart: false,
      isThirdPartyOrMarket: true,
      hasConfiguredPolicy: false,
    };
  }

  const isOriginalPart = ORIGINAL_KEYWORDS.some((kw) => rawName.includes(kw) || rawDesc.includes(kw));

  if (!isOriginalPart) {
    // Ambiguous: category is battery, but not explicitly specified as original
    return {
      isEligible: false,
      reason: 'Ambiguous battery grade. Must be explicitly certified as original battery replacement.',
      normalizedCategory: 'battery',
      isBatteryCategory: true,
      isOriginalPart: false,
      isThirdPartyOrMarket: false,
      hasConfiguredPolicy: false,
    };
  }

  // 4. Verify Authoritative Policy Duration (Do not invent duration!)
  let verifiedDuration: string | undefined;
  let policyDetails: string | undefined;

  // Search for verified duration in service records
  if (/\b(2[\s-]?(?:years?|yrs?)|24[\s-]?(?:months?|mos?))\b/i.test(fullText)) {
    verifiedDuration = '2-Year Warranty';
    policyDetails = '24-month battery performance and health certificate';
  } else if (/\b(1[\s-]?(?:year|yr)|12[\s-]?(?:months?|mos?))\b/i.test(fullText)) {
    verifiedDuration = '1-Year Warranty';
    policyDetails = '12-month battery performance and health certificate';
  } else if (/\b(6[\s-]?(?:months?|mos?))\b/i.test(fullText)) {
    verifiedDuration = '6-Month Warranty';
    policyDetails = '6-month battery performance and health certificate';
  }

  const hasConfiguredPolicy = Boolean(verifiedDuration);

  if (!hasConfiguredPolicy) {
    // Eligible original battery, but NO verified policy duration exists in database -> do not invent one!
    return {
      isEligible: false,
      reason: 'Original battery replacement without a confirmed warranty policy duration. Defaulting to quality testing claims.',
      normalizedCategory: 'battery',
      isBatteryCategory: true,
      isOriginalPart: true,
      isThirdPartyOrMarket: false,
      hasConfiguredPolicy: false,
    };
  }

  return {
    isEligible: true,
    reason: 'Verified original battery replacement with confirmed warranty policy.',
    normalizedCategory: 'battery',
    isBatteryCategory: true,
    isOriginalPart: true,
    isThirdPartyOrMarket: false,
    hasConfiguredPolicy: true,
    verifiedDuration,
    policyDetails,
  };
}

/**
 * Quick boolean check for warranty eligibility
 */
export function isServiceEligibleForWarranty(service: ServiceLikeForWarranty): boolean {
  return checkWarrantyEligibility(service).isEligible;
}

/**
 * Return context-aware FAQ Subtitle
 */
export function getServiceFaqSubtitle(service: ServiceLikeForWarranty): string {
  const eligibility = checkWarrantyEligibility(service);
  if (eligibility.isEligible && eligibility.verifiedDuration) {
    return 'Verified laboratory turnaround, pricing, quality testing, and warranty policies';
  }
  return 'Verified laboratory turnaround, pricing, and quality testing policies';
}

/**
 * Return context-aware Direct Answer for Search Engines & Answer Engines (AEO)
 */
export function generateContextAwareDirectAnswer(
  service: ServiceLikeForWarranty,
  options: {
    device: string;
    priceStr: string;
    timeStr: string;
    problemStr: string;
  }
): string {
  const { device, priceStr, timeStr, problemStr } = options;
  const eligibility = checkWarrantyEligibility(service);

  if (eligibility.isEligible && eligibility.verifiedDuration) {
    return `${service.serviceName} for ${device} is performed at MTS Lab in Pakosadak, New Road, Kathmandu. The verified cost is ${priceStr}.${timeStr}${problemStr} Genuine battery cells, battery health calibration, and verified ${eligibility.verifiedDuration} coverage are provided.`;
  }

  return `${service.serviceName} for ${device} is performed at MTS Lab in Pakosadak, New Road, Kathmandu. The verified cost is ${priceStr}.${timeStr}${problemStr} Genuine quality parts, laser calibration, and component quality verification are provided.`;
}

/**
 * Return context-aware FAQs for a service
 */
export function generateContextAwareFaqs(
  service: ServiceLikeForWarranty,
  options: {
    device: string;
    priceStr: string;
    estTime: string;
  }
): { question: string; answer: string }[] {
  const { device, priceStr, estTime } = options;
  const eligibility = checkWarrantyEligibility(service);

  const baseFaqs = [
    {
      question: `How much does ${service.serviceName} for ${device} cost at MTS Lab?`,
      answer: `The verified laboratory fee for ${service.serviceName} on ${device} at MTS Lab Kathmandu is ${priceStr}. Free multi-point diagnostic inspection is included.`,
    },
    {
      question: `How long does ${service.serviceName} for ${device} take?`,
      answer: `Estimated service turnaround time is ${estTime} at our New Road Kathmandu laboratory under standard queue conditions.`,
    },
    {
      question: `Where is MTS Lab located for ${device} hardware repairs?`,
      answer: `MTS Lab is located at Pakosadak, New Road (directly opposite the back gate of People's Plaza), Kathmandu 44600, Nepal. Call 9869276668 or 015364307 for directions.`,
    },
  ];

  if (eligibility.isEligible && eligibility.verifiedDuration) {
    baseFaqs.push({
      question: `What warranty coverage is provided for ${service.serviceName}?`,
      answer: `MTS Lab provides our verified ${eligibility.verifiedDuration} for this original battery replacement, including battery health calibration, serial card registration, and laboratory quality testing.`,
    });
  } else {
    // Non-eligible services (Displays, Motherboards, Charging ports, Speakers, Cameras, Back panels, 3rd-party batteries)
    baseFaqs.push({
      question: `Does MTS Lab provide testing and quality verification for ${service.serviceName}?`,
      answer: `Yes, the repair undergoes appropriate pre- and post-service diagnostic checks, component testing, and quality verification.`,
    });
  }

  return baseFaqs;
}

/**
 * Cleanse inappropriate warranty claims from service descriptions for non-eligible services.
 * Leaves genuine descriptions intact while sanitizing misleading warranty promises.
 */
export function sanitizeServiceDescription(
  service: ServiceLikeForWarranty,
  description?: string | null
): string {
  if (!description) return '';
  const text = String(description).trim();
  const eligibility = checkWarrantyEligibility(service);

  // If eligible original battery replacement with confirmed policy, preserve the authentic description
  if (eligibility.isEligible) {
    return text;
  }

  // Otherwise, sanitize warranty references from non-eligible services
  let sanitized = text;

  // Handle Oxford comma lists: "..., <item>, and applicable warranty terms before repair." -> "..., and <item> before repair."
  sanitized = sanitized.replace(
    /,\s*([^,]+),\s+and\s+(?:applicable\s+)?warranty\s+(?:terms|coverage|policies)\s+before\s+repair\./gi,
    ', and $1 before repair.'
  );

  // Replace exact common phrases found in database records
  sanitized = sanitized.replace(
    /,?\s*and\s+applicable\s+warranty\s+terms\s+before\s+repair\./gi,
    ' before repair.'
  );
  sanitized = sanitized.replace(
    /,?\s*and\s+warranty\s+terms\s+before\s+repair\./gi,
    ' before repair.'
  );
  sanitized = sanitized.replace(
    /,?\s*and\s+warranty\s+coverage\s+before\s+repair\./gi,
    ' before repair.'
  );
  sanitized = sanitized.replace(
    /Please\s+confirm\s+battery\s+authenticity,\s+availability,\s+and\s+warranty\s+coverage\s+with\s+our\s+team\s+before\s+repair\./gi,
    'Please confirm battery authenticity and availability with our team before repair.'
  );
  sanitized = sanitized.replace(
    /We\s+recommend\s+confirming\s+battery\s+specifications,\s+availability,\s+and\s+warranty\s+coverage\s+before\s+repair\./gi,
    'We recommend confirming battery specifications and availability before repair.'
  );

  // Remove lines like "Warranty: 6 months on the battery, subject to the warranty terms provided at the time of service"
  sanitized = sanitized.replace(/Warranty:\s*[^.\n]+(?:at\s+the\s+time\s+of\s+service|terms)?[.\n]?/gi, '');

  // Remove phrases like "Includes 6-month warranty," -> "Includes "
  sanitized = sanitized.replace(/Includes\s+\d+[\s-]?(?:month|year|day)s?\s+warranty,?\s*/gi, 'Includes ');

  // Clean phrases like "with dedicated warranty coverage" -> "with dedicated quality verification"
  sanitized = sanitized.replace(/with\s+dedicated\s+warranty\s+coverage/gi, 'with dedicated quality verification');
  sanitized = sanitized.replace(/and\s+warranty\s+coverage\s+are\s+provided/gi, 'and quality verification are provided');
  sanitized = sanitized.replace(/,\s*laser\s+calibration,\s+and\s+warranty\s+coverage/gi, ', laser calibration, and component testing');

  // Generic phrase replacements
  sanitized = sanitized.replace(/\b(?:dedicated\s+)?warranty\s+coverage\b/gi, 'quality verification');
  sanitized = sanitized.replace(/\bguaranteed\s+warranty\b/gi, 'quality testing');
  sanitized = sanitized.replace(/\bwarranty\s+policy\b/gi, 'quality policy');
  sanitized = sanitized.replace(/\b(?:under|with)\s+warranty\b/gi, 'with quality verification');
  sanitized = sanitized.replace(/\bwarranty\s+(?:period|duration|guarantee|claim|terms|details)\b/gi, 'service verification');

  // Final fallback: any remaining "warranty" or "warranties" in non-eligible service text
  sanitized = sanitized.replace(/\bwarrant(?:y|ies)\b/gi, 'quality verification');

  // Clean up any double spaces, dangling punctuation or blank lines created by removal
  sanitized = sanitized
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s*,\s*\./g, '.')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return sanitized;
}

/**
 * Helper to check if a category string or object represents a battery category
 */
export function isBatteryCategory(categoryOrService: any): boolean {
  if (!categoryOrService) return false;
  const cat = typeof categoryOrService === 'string'
    ? categoryOrService.trim().toLowerCase()
    : (categoryOrService.category || '').trim().toLowerCase();
  return cat === 'battery' || cat === 'battery replacement';
}

/**
 * Helper to check if a service is an original battery service
 */
export function isOriginalBatteryService(service: any): boolean {
  if (!service) return false;
  if (!isBatteryCategory(service)) return false;

  const rawName = (service.serviceName || '').trim().toLowerCase();
  const rawDesc = (service.description || '').trim().toLowerCase();
  const rawNotes = (service.notes || '').trim().toLowerCase();
  const fullText = `${rawName} ${rawDesc} ${rawNotes}`;

  const isThirdParty = THIRD_PARTY_OR_COPY_KEYWORDS.some(k => fullText.includes(k));
  if (isThirdParty) return false;

  return ORIGINAL_KEYWORDS.some(k => fullText.includes(k));
}

/**
 * Helper to extract verified battery warranty duration
 */
export function extractVerifiedBatteryWarrantyPeriod(service: any): string | null {
  if (!service) return null;
  const text = `${service.notes || ''} ${service.description || ''}`.toLowerCase();

  if (/\b(?:12[\s-]months?|1[\s-]year)\b/i.test(text)) {
    return '1-Year Warranty';
  }
  if (/\b(?:6[\s-]months?)\b/i.test(text)) {
    return '6-Month Warranty';
  }
  if (/\b(?:24[\s-]months?|2[\s-]years?)\b/i.test(text)) {
    return '2-Year Warranty';
  }
  if (/\b(?:3[\s-]months?)\b/i.test(text)) {
    return '3-Month Warranty';
  }
  return null;
}

/**
 * Comprehensive eligibility evaluation matching test expectations
 */
export function evaluateWarrantyEligibility(service: any) {
  const result = checkWarrantyEligibility(service);
  const isOriginal = isOriginalBatteryService(service);
  const period = isOriginal ? extractVerifiedBatteryWarrantyPeriod(service) : null;
  const hasVerified = Boolean(isOriginal && period);
  const isEligible = hasVerified;

  const faqSubtitle = isEligible
    ? 'Verified laboratory turnaround, pricing, and warranty policies'
    : 'Verified laboratory turnaround, pricing, and quality testing policies';

  return {
    ...result,
    isEligible,
    isOriginalBattery: isOriginal,
    hasVerifiedPolicy: hasVerified,
    warrantyPeriod: period,
    faqSubtitle,
  };
}

/**
 * Sanitize public facing text for non-eligible services
 */
export function sanitizeServiceTextForPublic(text?: string | null, isEligible: boolean = false): string {
  if (!text) return '';
  if (isEligible) return text;

  let sanitized = text;
  sanitized = sanitized.replace(/applicable warranty terms before repair/gi, 'service details before repair');
  sanitized = sanitized.replace(/warranty terms before repair/gi, 'service details before repair');
  sanitized = sanitized.replace(/warranty terms/gi, 'service details');
  sanitized = sanitized.replace(/warranty coverage/gi, 'quality verification');
  sanitized = sanitized.replace(/under warranty/gi, 'with quality verification');
  sanitized = sanitized.replace(/dedicated warranty/gi, 'dedicated quality verification');
  return sanitized;
}
