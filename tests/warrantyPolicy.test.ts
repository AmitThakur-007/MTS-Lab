import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateWarrantyEligibility,
  isBatteryCategory,
  isOriginalBatteryService,
  extractVerifiedBatteryWarrantyPeriod,
  sanitizeServiceTextForPublic,
} from '../src/lib/warrantyPolicy';
import {
  getServiceDirectAnswer,
  getServiceFaqs,
  getServicePageJsonLd,
  ServiceLike,
} from '../src/lib/seo';

// Test Service Mocks
const MOCK_DISPLAY_SERVICE: ServiceLike = {
  id: 'disp-1',
  brand: 'Iphone',
  model: '11',
  category: 'Display',
  serviceName: 'iPhone 11 GX Orginal Display Replacement',
  problem: 'Cracked screen and vertical lines',
  price: 4500,
  priceType: 'FIXED',
  status: 'ACTIVE',
  estimatedTime: '1-2 Hours',
  notes: 'High quality GX display replacement in Kathmandu',
  description: 'Verified display panel with touch calibration',
};

const MOCK_CHARGING_SERVICE: ServiceLike = {
  id: 'chg-1',
  brand: 'Samsung',
  model: 'Galaxy S23',
  category: 'Charging flex',
  serviceName: 'Samsung Galaxy S23 Charging Port Replacement',
  problem: 'Slow charging and moisture detected error',
  price: 3200,
  priceType: 'FIXED',
  status: 'ACTIVE',
  estimatedTime: '45 Minutes',
};

const MOCK_MOTHERBOARD_SERVICE: ServiceLike = {
  id: 'mb-1',
  brand: 'Apple',
  model: 'iPhone 13 Pro',
  category: 'Motherboard / IC',
  serviceName: 'iPhone 13 Pro Audio IC Micro-soldering',
  problem: 'No audio during cellular calls',
  price: 6500,
  priceType: 'STARTING_FROM',
  status: 'ACTIVE',
  estimatedTime: '3-4 Hours',
};

const MOCK_SPEAKER_SERVICE: ServiceLike = {
  id: 'spk-1',
  brand: 'Apple',
  model: 'iPhone 11 Pro Max',
  category: 'Speaker',
  serviceName: 'iPhone 11 Pro Max Genuine Speaker Replacement',
  problem: 'Distorted earpiece sound',
  price: 2500,
  priceType: 'FIXED',
  status: 'ACTIVE',
  notes: 'Confirm part authenticity, compatibility, availability, and applicable warranty terms before repair.',
  description: 'MTS Lab offers iPhone 11 Pro Max speaker replacement. Confirm warranty terms before repair.',
};

const MOCK_MARKET_BATTERY_SERVICE: ServiceLike = {
  id: 'bat-market',
  brand: 'Iphone',
  model: '12 Pro Max',
  category: 'Battery',
  serviceName: 'iPhone 12 Pro Max Market Original Battery Replacement',
  problem: 'Battery Draining Quickly',
  price: 6000,
  priceType: 'FIXED',
  status: 'ACTIVE',
  notes: 'Warranty: 6 months on the battery, subject to the warranty terms provided at the time of service',
};

const MOCK_ORIGINAL_BATTERY_WITH_POLICY: ServiceLike = {
  id: 'bat-orig-1',
  brand: 'Iphone',
  model: '12 Pro Max',
  category: 'Battery',
  serviceName: 'iPhone 12 Pro Max Original Battery Replacement',
  problem: 'Reduced battery health and unexpected shutdowns',
  price: 9000,
  priceType: 'FIXED',
  status: 'ACTIVE',
  estimatedTime: '1 Hour',
  notes: 'Warranty: 12 months on the battery, subject to the written warranty terms. Free diagnostics.',
};

const MOCK_ORIGINAL_BATTERY_NO_POLICY: ServiceLike = {
  id: 'bat-orig-no-policy',
  brand: 'Iphone',
  model: 'Xsmax',
  variant: 'Standard',
  category: 'battery',
  serviceName: 'original battery',
  problem: 'Weak battery backup',
  price: 4500,
  priceType: 'FIXED',
  status: 'ACTIVE',
  notes: 'Standard original replacement battery. No policy configured yet.',
};

const MOCK_AMBIGUOUS_SERVICE: ServiceLike = {
  id: 'amb-1',
  brand: 'Apple',
  model: 'Watch Series 7',
  category: 'Hardware',
  serviceName: 'Battery Tuneup & Power Calibration',
  price: 3000,
  priceType: 'ON_INSPECTION',
  status: 'ACTIVE',
};

describe('MTS Lab Centralized Warranty Content Policy Suite', () => {

  // Scenario 1: Display replacement FAQ contains no warranty-related claims
  test('1. Display replacement FAQ contains no warranty-related claims', () => {
    const policy = evaluateWarrantyEligibility(MOCK_DISPLAY_SERVICE);
    assert.equal(policy.isEligible, false);
    assert.equal(policy.hasVerifiedPolicy, false);

    const faqs = getServiceFaqs(MOCK_DISPLAY_SERVICE);
    assert.equal(faqs.length, 4);

    const combinedFaqText = faqs.map(f => `${f.question} ${f.answer}`).join(' ').toLowerCase();
    assert.ok(!combinedFaqText.includes('warranty'));
    assert.ok(!combinedFaqText.includes('warranty coverage'));
    assert.ok(!combinedFaqText.includes('dedicated warranty'));

    // Check specific 4th FAQ phrasing
    const fourthFaq = faqs[3];
    assert.equal(
      fourthFaq.question,
      'Does MTS Lab provide testing and quality verification for iPhone 11 GX Orginal Display Replacement?'
    );
    assert.equal(
      fourthFaq.answer,
      'Yes, the repair undergoes appropriate pre- and post-service diagnostic checks, component testing, and quality verification.'
    );
  });

  // Scenario 2: Charging-port repair FAQ contains no warranty-related claims
  test('2. Charging-port repair FAQ contains no warranty-related claims', () => {
    const policy = evaluateWarrantyEligibility(MOCK_CHARGING_SERVICE);
    assert.equal(policy.isEligible, false);

    const faqs = getServiceFaqs(MOCK_CHARGING_SERVICE);
    const combinedFaqText = faqs.map(f => `${f.question} ${f.answer}`).join(' ').toLowerCase();
    assert.ok(!combinedFaqText.includes('warranty'));
    assert.ok(faqs[3].question.includes('testing and quality verification'));
  });

  // Scenario 3: Motherboard repair FAQ contains no warranty-related claims
  test('3. Motherboard repair FAQ contains no warranty-related claims', () => {
    const policy = evaluateWarrantyEligibility(MOCK_MOTHERBOARD_SERVICE);
    assert.equal(policy.isEligible, false);

    const faqs = getServiceFaqs(MOCK_MOTHERBOARD_SERVICE);
    const combinedFaqText = faqs.map(f => `${f.question} ${f.answer}`).join(' ').toLowerCase();
    assert.ok(!combinedFaqText.includes('warranty'));
    assert.ok(!combinedFaqText.includes('warranty policies'));
  });

  // Scenario 4: Other non-eligible services do not display warranty in descriptions or FAQs
  test('4. Other non-eligible services (e.g. speakers) sanitize warranty in public text', () => {
    const policy = evaluateWarrantyEligibility(MOCK_SPEAKER_SERVICE);
    assert.equal(policy.isEligible, false);

    const faqs = getServiceFaqs(MOCK_SPEAKER_SERVICE);
    assert.ok(!faqs.map(f => `${f.question} ${f.answer}`).join(' ').toLowerCase().includes('warranty'));

    const directAnswer = getServiceDirectAnswer(MOCK_SPEAKER_SERVICE);
    assert.ok(!directAnswer.toLowerCase().includes('warranty'));
    assert.ok(directAnswer.includes('quality verification are provided'));

    // Test text sanitization on legacy notes
    const sanitizedNotes = sanitizeServiceTextForPublic(MOCK_SPEAKER_SERVICE.notes, false);
    assert.ok(!sanitizedNotes.toLowerCase().includes('warranty terms'));
    assert.ok(sanitizedNotes.includes('service details before repair'));
  });

  // Scenario 5: Non-eligible services do not expose warranty claims in metadata or JSON-LD
  test('5. Non-eligible services do not expose warranty claims in metadata or JSON-LD', () => {
    const jsonLd = getServicePageJsonLd(MOCK_DISPLAY_SERVICE, 'iphone-11-gx-original-display');
    const jsonString = JSON.stringify(jsonLd).toLowerCase();

    assert.ok(!jsonString.includes('warranty'));
    assert.ok(!jsonString.includes('warranty coverage'));
    assert.ok(!jsonString.includes('under warranty'));

    // FAQPage schema must match context-aware FAQs
    const faqSchema = jsonLd.find((item: any) => item['@type'] === 'FAQPage') as any;
    assert.ok(faqSchema);
    const questions = faqSchema.mainEntity;
    const lastQuestion = questions[questions.length - 1];
    assert.ok(lastQuestion.name.includes('testing and quality verification'));
    assert.ok(!lastQuestion.name.toLowerCase().includes('warranty'));
    assert.ok(lastQuestion.acceptedAnswer.text.includes('quality verification'));
  });

  // Scenario 6: Eligible original battery replacement can display verified warranty policy
  test('6. Eligible original battery replacement can display verified warranty policy', () => {
    const policy = evaluateWarrantyEligibility(MOCK_ORIGINAL_BATTERY_WITH_POLICY);
    assert.equal(policy.isEligible, true);
    assert.equal(policy.isOriginalBattery, true);
    assert.equal(policy.hasVerifiedPolicy, true);
    assert.equal(policy.warrantyPeriod, '1-Year Warranty');
    assert.equal(policy.faqSubtitle, 'Verified laboratory turnaround, pricing, and warranty policies');

    const faqs = getServiceFaqs(MOCK_ORIGINAL_BATTERY_WITH_POLICY);
    assert.ok(faqs[3].question.includes('warranty'));
    assert.ok(faqs[3].answer.includes('1-Year Warranty'));

    const directAnswer = getServiceDirectAnswer(MOCK_ORIGINAL_BATTERY_WITH_POLICY);
    assert.ok(directAnswer.includes('verified 1-Year Warranty coverage'));
  });

  // Scenario 7: Original battery replacement without configured policy does not invent one
  test('7. Original battery replacement without configured policy does not invent one', () => {
    const policy = evaluateWarrantyEligibility(MOCK_ORIGINAL_BATTERY_NO_POLICY);
    // When no policy is confirmed in system, default to hiding claims
    assert.equal(policy.isEligible, false);
    assert.equal(policy.isOriginalBattery, true);
    assert.equal(policy.hasVerifiedPolicy, false);
    assert.equal(policy.warrantyPeriod, null);
    assert.equal(policy.faqSubtitle, 'Verified laboratory turnaround, pricing, and quality testing policies');

    const faqs = getServiceFaqs(MOCK_ORIGINAL_BATTERY_NO_POLICY);
    assert.ok(!faqs.map(f => `${f.question} ${f.answer}`).join(' ').toLowerCase().includes('warranty'));
    assert.ok(faqs[3].question.includes('testing and quality verification'));
  });

  // Scenario 8: Ambiguous service classifications default to hiding warranty claims
  test('8. Ambiguous service classifications default to hiding warranty claims', () => {
    const policy = evaluateWarrantyEligibility(MOCK_AMBIGUOUS_SERVICE);
    assert.equal(policy.isEligible, false);
    assert.equal(policy.hasVerifiedPolicy, false);
    assert.equal(policy.faqSubtitle, 'Verified laboratory turnaround, pricing, and quality testing policies');

    // Third-party / Market Original battery replacement is also disqualified
    const marketBatPolicy = evaluateWarrantyEligibility(MOCK_MARKET_BATTERY_SERVICE);
    assert.equal(marketBatPolicy.isEligible, false);
    assert.equal(marketBatPolicy.isOriginalBattery, false);
  });

  // Scenario 9: FAQ subtitle no longer mentions warranty for non-eligible services
  test('9. FAQ subtitle no longer mentions warranty for non-eligible services', () => {
    const nonEligibleServices = [
      MOCK_DISPLAY_SERVICE,
      MOCK_CHARGING_SERVICE,
      MOCK_MOTHERBOARD_SERVICE,
      MOCK_SPEAKER_SERVICE,
      MOCK_MARKET_BATTERY_SERVICE,
      MOCK_AMBIGUOUS_SERVICE,
    ];

    for (const svc of nonEligibleServices) {
      const policy = evaluateWarrantyEligibility(svc);
      assert.equal(
        policy.faqSubtitle,
        'Verified laboratory turnaround, pricing, and quality testing policies',
        `Service ${svc.serviceName} has invalid FAQ subtitle`
      );
      assert.ok(!policy.faqSubtitle.toLowerCase().includes('warranty'));
    }
  });

  // Scenario 10: Existing service prices and turnaround times remain unchanged
  test('10. Existing service prices and turnaround times remain unchanged', () => {
    const displayFaqs = getServiceFaqs(MOCK_DISPLAY_SERVICE);
    assert.ok(displayFaqs[0].answer.includes('NPR 4,500'));
    assert.ok(displayFaqs[1].answer.includes('1-2 Hours'));

    const batteryFaqs = getServiceFaqs(MOCK_ORIGINAL_BATTERY_WITH_POLICY);
    assert.ok(batteryFaqs[0].answer.includes('NPR 9,000'));
    assert.ok(batteryFaqs[1].answer.includes('1 Hour'));
  });

  // Scenario 11: Case variations and semantic wording variations are tested
  test('11. Case variations and wording variants are handled accurately', () => {
    // Test helper category detection
    assert.equal(isBatteryCategory('Battery'), true);
    assert.equal(isBatteryCategory('battery'), true);
    assert.equal(isBatteryCategory('BATTERY REPLACEMENT'), true);
    assert.equal(isBatteryCategory('Display'), false);
    assert.equal(isBatteryCategory('Charging Flex'), false);
    assert.equal(isBatteryCategory(null), false);

    // Test original battery detection
    assert.equal(isOriginalBatteryService({ category: 'Battery', serviceName: 'Original Battery Replacement' }), true);
    assert.equal(isOriginalBatteryService({ category: 'battery', serviceName: 'market original battery' }), false);
    assert.equal(isOriginalBatteryService({ category: 'Battery', serviceName: 'Copy Battery' }), false);
    assert.equal(isOriginalBatteryService({ category: 'Display', serviceName: 'Original Display' }), false);

    // Test duration extraction variants
    assert.equal(extractVerifiedBatteryWarrantyPeriod({ notes: 'Includes 12-month warranty' }), '1-Year Warranty');
    assert.equal(extractVerifiedBatteryWarrantyPeriod({ notes: '1 year warranty coverage' }), '1-Year Warranty');
    assert.equal(extractVerifiedBatteryWarrantyPeriod({ notes: '6 months warranty' }), '6-Month Warranty');
    assert.equal(extractVerifiedBatteryWarrantyPeriod({ notes: '2 years extended warranty' }), '2-Year Warranty');
    assert.equal(extractVerifiedBatteryWarrantyPeriod({ notes: 'No warranty listed' }), null);
  });

});
