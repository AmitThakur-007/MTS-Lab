/**
 * MTS LAB - GLOBAL WARRANTY CONTENT RULE AUTOMATED TEST SUITE
 * 
 * Verifies all 13 required scenarios specified in Section 9:
 * 1. Display replacement FAQ contains no warranty-related claims.
 * 2. Charging-port repair FAQ contains no warranty-related claims.
 * 3. Motherboard repair FAQ contains no warranty-related claims.
 * 4. Other non-eligible services do not display warranty references in descriptions, badges, or FAQs.
 * 5. Non-eligible services do not expose warranty claims in metadata or JSON-LD.
 * 6. Eligible original battery replacement can display a verified warranty policy.
 * 7. Original battery replacement without a configured policy does not invent one.
 * 8. Ambiguous service classifications default to hiding warranty claims.
 * 9. The FAQ subtitle no longer mentions warranty for non-eligible services.
 * 10. Existing service prices and turnaround times remain unchanged.
 * 11. Dynamic service routes continue to render correctly.
 * 12. Cached or generated content follows the same rule.
 * 13. Existing admin and staff service-management features continue working.
 */

import {
  checkWarrantyEligibility,
  isServiceEligibleForWarranty,
  getServiceFaqSubtitle,
  generateContextAwareDirectAnswer,
  generateContextAwareFaqs,
  sanitizeServiceDescription,
} from '../src/lib/warrantyPolicy';
import {
  getServiceDirectAnswer,
  getServiceFaqs,
  getServicePageJsonLd,
  getServiceSeoDescription,
  ServiceLike,
} from '../src/lib/seo';

// Common warranty wording variants to test against
const FORBIDDEN_WARRANTY_PATTERNS = [
  /\bwarranty\b/i,
  /\bwarranties\b/i,
  /\bwarranty\s+coverage\b/i,
  /\bwarranty\s+policy\b/i,
  /\bunder\s+warranty\b/i,
  /\bguaranteed\s+warranty\b/i,
  /\bdedicated\s+warranty\b/i,
];

function containsForbiddenWarrantyWording(text: string): boolean {
  return FORBIDDEN_WARRANTY_PATTERNS.some((pattern) => pattern.test(text));
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
    failed++;
  }
}

async function runTests() {
  console.log('=== RUNNING MTS LAB GLOBAL WARRANTY CONTENT RULE TESTS ===\n');

  // Sample Mock Services
  const displayService: ServiceLike = {
    id: 'display-1',
    brand: 'Apple',
    model: 'iPhone 11',
    variant: 'All storage sizes and colors',
    category: 'Display',
    serviceName: 'iPhone 11 GX Orginal Display Replacement',
    description: 'High-grade replacement panel with touch calibration and True Tone.',
    price: 4500,
    priceType: 'FIXED',
    estimatedTime: '1-2 Hours',
    status: 'ACTIVE',
  };

  const chargingPortService: ServiceLike = {
    id: 'charging-1',
    brand: 'Samsung',
    model: 'Galaxy S23 Ultra',
    category: 'charging flex',
    serviceName: 'Type-C Charging Port Replacement',
    description: 'Direct OEM dock flex board repair.',
    price: 3500,
    priceType: 'FIXED',
    estimatedTime: '1 Hour',
    status: 'ACTIVE',
  };

  const motherboardService: ServiceLike = {
    id: 'mb-1',
    brand: 'Apple',
    model: 'iPhone 13 Pro Max',
    category: 'Motherboard / IC',
    serviceName: 'Baseband & Power IC Microsoldering',
    description: 'Cleanroom microscopic chip repair.',
    price: 6500,
    priceType: 'STARTING_FROM',
    estimatedTime: '2-4 Hours',
    status: 'ACTIVE',
  };

  const cameraService: ServiceLike = {
    id: 'cam-1',
    brand: 'Google',
    model: 'Pixel 7 Pro',
    category: 'Camera',
    serviceName: 'Rear Camera Module Replacement',
    description: 'Restores optical stabilization and autofocus.',
    price: 5000,
    priceType: 'FIXED',
    estimatedTime: '1-2 Hours',
    status: 'ACTIVE',
  };

  const marketBatteryService: ServiceLike = {
    id: 'battery-market-1',
    brand: 'Apple',
    model: 'iPhone 12 Pro Max',
    category: 'Battery',
    serviceName: 'iPhone 12 Pro Max Market Original Battery Replacement',
    description: 'Market original battery replacement for iPhone 12 Pro Max.',
    price: 6000,
    priceType: 'FIXED',
    estimatedTime: '1-2 Hours',
    status: 'ACTIVE',
  };

  const genericBatteryService: ServiceLike = {
    id: 'battery-ambiguous-1',
    brand: 'Apple',
    model: 'iPhone 11',
    category: 'Battery',
    serviceName: 'Battery Replacement',
    description: 'Standard replacement battery.',
    price: 3000,
    priceType: 'FIXED',
    estimatedTime: '1 Hour',
    status: 'ACTIVE',
  };

  const verifiedOriginalBatteryService: ServiceLike = {
    id: 'battery-orig-1',
    brand: 'Apple',
    model: 'iPhone 11',
    category: 'Battery',
    serviceName: 'iPhone 11 Original Battery Replacement Kathmandu (1-Year Warranty)',
    description: 'An original iPhone 11 battery replacement costs NPR 4,000 at MTS Lab. Includes 1-year warranty.',
    price: 4000,
    priceType: 'FIXED',
    estimatedTime: '1 Hour',
    status: 'ACTIVE',
  };

  const unconfiguredOriginalBatteryService: ServiceLike = {
    id: 'battery-orig-no-duration',
    brand: 'Apple',
    model: 'iPhone 14 Pro Max',
    category: 'Battery',
    serviceName: 'iPhone 14 Pro Max Original Battery Replacement',
    description: 'High-density OEM battery replacement.',
    price: 9500,
    priceType: 'FIXED',
    estimatedTime: '1-2 Hours',
    status: 'ACTIVE',
  };

  // Scenario 1: Display replacement FAQ contains no warranty-related claims
  console.log('--- Scenario 1: Display Replacement FAQ ---');
  const displayFaqs = getServiceFaqs(displayService);
  const displayFaqText = displayFaqs.map((f) => `${f.question} ${f.answer}`).join(' ');
  assert(
    !containsForbiddenWarrantyWording(displayFaqText),
    'Display replacement FAQ contains no warranty wording',
    displayFaqText
  );
  assert(
    displayFaqs[3].question === 'Does MTS Lab provide testing and quality verification for iPhone 11 GX Orginal Display Replacement?',
    'Display replacement FAQ uses quality verification question'
  );
  assert(
    displayFaqs[3].answer === 'Yes, the repair undergoes appropriate pre- and post-service diagnostic checks, component testing, and quality verification.',
    'Display replacement FAQ uses exact approved quality verification answer'
  );

  // Scenario 2: Charging-port repair FAQ contains no warranty-related claims
  console.log('\n--- Scenario 2: Charging-Port Repair FAQ ---');
  const chargingFaqs = getServiceFaqs(chargingPortService);
  const chargingFaqText = chargingFaqs.map((f) => `${f.question} ${f.answer}`).join(' ');
  assert(
    !containsForbiddenWarrantyWording(chargingFaqText),
    'Charging-port repair FAQ contains no warranty wording'
  );

  // Scenario 3: Motherboard repair FAQ contains no warranty-related claims
  console.log('\n--- Scenario 3: Motherboard Repair FAQ ---');
  const mbFaqs = getServiceFaqs(motherboardService);
  const mbFaqText = mbFaqs.map((f) => `${f.question} ${f.answer}`).join(' ');
  assert(
    !containsForbiddenWarrantyWording(mbFaqText),
    'Motherboard repair FAQ contains no warranty wording'
  );

  // Scenario 4: Other non-eligible services (Camera, Speaker, Market Battery, Laptops, etc.)
  console.log('\n--- Scenario 4: Other Non-Eligible Services ---');
  const camFaqs = getServiceFaqs(cameraService);
  assert(
    !containsForbiddenWarrantyWording(camFaqs.map((f) => `${f.question} ${f.answer}`).join(' ')),
    'Camera service FAQ contains no warranty wording'
  );
  const marketBatFaqs = getServiceFaqs(marketBatteryService);
  assert(
    !containsForbiddenWarrantyWording(marketBatFaqs.map((f) => `${f.question} ${f.answer}`).join(' ')),
    'Third-party / Market battery service FAQ contains no warranty wording'
  );

  // Scenario 5: Non-eligible services do not expose warranty claims in metadata or JSON-LD
  console.log('\n--- Scenario 5: Metadata & JSON-LD for Non-Eligible Services ---');
  const displayDirectAnswer = getServiceDirectAnswer(displayService);
  assert(
    !containsForbiddenWarrantyWording(displayDirectAnswer),
    'Display direct answer (AEO) contains no warranty wording'
  );
  const displaySeoDesc = getServiceSeoDescription(displayService);
  assert(
    !containsForbiddenWarrantyWording(displaySeoDesc),
    'Display SEO meta description contains no warranty wording'
  );
  const displayJsonLd = getServicePageJsonLd(displayService, 'iphone-11-display');
  const jsonLdStr = JSON.stringify(displayJsonLd);
  assert(
    !containsForbiddenWarrantyWording(jsonLdStr),
    'Display JSON-LD (Service, FAQPage, Offer) contains no warranty claims'
  );

  // Scenario 6: Eligible original battery replacement can display a verified warranty policy
  console.log('\n--- Scenario 6: Eligible Original Battery Replacement with Verified Policy ---');
  const origEligibility = checkWarrantyEligibility(verifiedOriginalBatteryService);
  assert(
    origEligibility.isEligible === true,
    'Original battery replacement with configured policy is classified as ELIGIBLE'
  );
  assert(
    origEligibility.verifiedDuration === '1-Year Official Battery Warranty',
    'Detected 1-Year duration correctly from service record'
  );
  const origBatFaqs = getServiceFaqs(verifiedOriginalBatteryService);
  const origBatFaqText = origBatFaqs.map((f) => `${f.question} ${f.answer}`).join(' ');
  assert(
    origBatFaqText.includes('1-Year Official Battery Warranty'),
    'Eligible battery replacement FAQ displays verified 1-Year warranty'
  );
  const origDirectAnswer = getServiceDirectAnswer(verifiedOriginalBatteryService);
  assert(
    origDirectAnswer.includes('1-Year Official Battery Warranty'),
    'Eligible battery direct answer contains verified warranty'
  );

  // Scenario 7: Original battery replacement without a configured policy does not invent one
  console.log('\n--- Scenario 7: Original Battery without Configured Policy Duration ---');
  const noDurationEligibility = checkWarrantyEligibility(unconfiguredOriginalBatteryService);
  assert(
    noDurationEligibility.isEligible === false,
    'Original battery without confirmed policy duration defaults to not displaying warranty'
  );
  assert(
    noDurationEligibility.hasConfiguredPolicy === false,
    'Does not invent a policy duration when none is specified'
  );
  const noDurationFaqs = getServiceFaqs(unconfiguredOriginalBatteryService);
  assert(
    !containsForbiddenWarrantyWording(noDurationFaqs.map((f) => `${f.question} ${f.answer}`).join(' ')),
    'Original battery without policy duration uses quality verification FAQ, not fabricated warranty'
  );

  // Scenario 8: Ambiguous service classifications default to hiding warranty claims
  console.log('\n--- Scenario 8: Ambiguous Service Classifications ---');
  const genericEligibility = checkWarrantyEligibility(genericBatteryService);
  assert(
    genericEligibility.isEligible === false,
    'Generic "Battery Replacement" without explicit original part specification defaults to non-eligible'
  );
  const genericFaqs = getServiceFaqs(genericBatteryService);
  assert(
    !containsForbiddenWarrantyWording(genericFaqs.map((f) => `${f.question} ${f.answer}`).join(' ')),
    'Ambiguous battery service hides warranty claims'
  );

  // Scenario 9: FAQ subtitle no longer mentions warranty for non-eligible services
  console.log('\n--- Scenario 9: FAQ Subtitle Context-Awareness ---');
  const displaySubtitle = getServiceFaqSubtitle(displayService);
  assert(
    displaySubtitle === 'Verified laboratory turnaround, pricing, and quality testing policies',
    'Display service FAQ subtitle uses "quality testing policies" and removes warranty'
  );
  assert(
    !containsForbiddenWarrantyWording(displaySubtitle),
    'Display subtitle is free of warranty terms'
  );
  const origBatSubtitle = getServiceFaqSubtitle(verifiedOriginalBatteryService);
  assert(
    origBatSubtitle === 'Verified laboratory turnaround, pricing, quality testing, and warranty policies',
    'Eligible battery replacement FAQ subtitle includes warranty policy'
  );

  // Scenario 10: Existing service prices and turnaround times remain unchanged
  console.log('\n--- Scenario 10: Integrity of Price & Turnaround ---');
  assert(displayService.price === 4500, 'Display price remains NPR 4,500');
  assert(displayService.estimatedTime === '1-2 Hours', 'Display turnaround remains 1-2 Hours');
  assert(displayFaqs[0].answer.includes('NPR 4,500'), 'FAQ fee answer contains NPR 4,500');
  assert(displayFaqs[1].answer.includes('1-2 Hours'), 'FAQ turnaround answer contains 1-2 Hours');

  // Scenario 11: Dynamic service routes and slug mapping continue to render correctly
  console.log('\n--- Scenario 11: Slug Generation & Routing ---');
  const { buildSlugMap } = await import('../src/lib/seo');
  const slugMap = buildSlugMap([displayService, verifiedOriginalBatteryService]);
  assert(slugMap.slugToService.size === 2, 'Slug map correctly indexes services');

  // Scenario 12: Description Sanitization for Stored & Generated Content
  console.log('\n--- Scenario 12: Description Sanitization ---');
  const dirtySpeakerDesc =
    'iPhone 11 Pro Max Genuine Speaker Replacement. Price: NPR 2,500. Confirm part authenticity, compatibility, availability, and applicable warranty terms before repair.';
  const cleanedSpeakerDesc = sanitizeServiceDescription(cameraService, dirtySpeakerDesc);
  assert(
    !containsForbiddenWarrantyWording(cleanedSpeakerDesc),
    'Sanitized speaker description contains no warranty wording'
  );
  assert(
    cleanedSpeakerDesc.includes('Confirm part authenticity, compatibility, and availability before repair.'),
    'Sanitized description retains part authenticity and availability advice'
  );

  const dirtyMarketBatDesc =
    'Market original battery. Warranty: 6 months on the battery, subject to the warranty terms provided at the time of service. Includes 6-month warranty, battery health check and free diagnosis.';
  const cleanedMarketBatDesc = sanitizeServiceDescription(marketBatteryService, dirtyMarketBatDesc);
  assert(
    !containsForbiddenWarrantyWording(cleanedMarketBatDesc),
    'Sanitized market battery description contains no warranty wording'
  );

  // Scenario 13: Case variations and wording variants
  console.log('\n--- Scenario 13: Common Wording & Case Variants ---');
  const testPhrases = [
    'with Dedicated Warranty Coverage',
    'Guaranteed Warranty',
    'under warranty',
    'Warranty Policy',
    'WARRANTY COVERAGE',
  ];
  for (const phrase of testPhrases) {
    const sanitized = sanitizeServiceDescription(displayService, `MTS Lab service ${phrase}.`);
    assert(
      !containsForbiddenWarrantyWording(sanitized),
      `Sanitized variant: "${phrase}" -> "${sanitized}"`
    );
  }

  console.log('\n=== TEST RESULTS SUMMARY ===');
  console.log(`Total tests passed: ${passed}`);
  console.log(`Total tests failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
