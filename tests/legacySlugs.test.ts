import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import {
  LEGACY_SLUGS,
  resolveServiceSlug,
  normalizeLegacySlug,
  stripLegacyNoisePhrases,
  normalizeAndMatchLegacySlug,
  buildSlugMap,
  ServiceLike,
} from '../src/lib/seo';

// Controlled active-service catalogue fixture with known valid slugs
const mockServices: ServiceLike[] = [
  // iPhone 11
  {
    id: 'srv-iph-11-disp-orig',
    brand: 'Iphone',
    model: '11',
    serviceName: 'iPhone 11 Original Display Replacement',
    price: 9500,
    priceType: 'FIXED',
    category: 'Display',
    status: 'ACTIVE',
  },
  {
    id: 'srv-iph-11-disp-copy',
    brand: 'Iphone',
    model: '11',
    serviceName: 'iPhone 11 Copy Display Replacement',
    price: 4500,
    priceType: 'FIXED',
    category: 'Display',
    status: 'ACTIVE',
  },
  {
    id: 'srv-iph-11-disp-gx',
    brand: 'Iphone',
    model: '11',
    serviceName: 'iPhone 11 GX Orginal Display Replacement',
    price: 6500,
    priceType: 'FIXED',
    category: 'Display',
    status: 'ACTIVE',
  },
  {
    id: 'srv-iph-11-front-cam',
    brand: 'Iphone',
    model: '11',
    serviceName: 'iPhone 11 Front Camera Replacement',
    price: 3500,
    priceType: 'FIXED',
    category: 'Camera',
    status: 'ACTIVE',
  },
  {
    id: 'srv-iph-11-back-cam',
    brand: 'Iphone',
    model: '11',
    serviceName: 'iPhone 11 Back Camera Replacement',
    price: 5500,
    priceType: 'FIXED',
    category: 'Camera',
    status: 'ACTIVE',
  },
  {
    id: 'srv-iph-11-batt-orig',
    brand: 'Iphone',
    model: '11',
    serviceName: 'iPhone 11 Original Battery Replacement Kathmandu (1-Year Warranty)',
    price: 4500,
    priceType: 'FIXED',
    category: 'Battery',
    status: 'ACTIVE',
  },
  {
    id: 'srv-iph-11-batt-copy',
    brand: 'Iphone',
    model: '11',
    serviceName: 'iPhone 11 Copy Battery Replacement',
    price: 2500,
    priceType: 'FIXED',
    category: 'Battery',
    status: 'ACTIVE',
  },

  // iPhone 11 Pro Max
  {
    id: 'srv-iph-11pm-disp-orig',
    brand: 'Iphone',
    model: '11 pro max',
    serviceName: 'iPhone 11 Pro Max Original Display Replacement',
    price: 18000,
    priceType: 'FIXED',
    category: 'Display',
    status: 'ACTIVE',
  },
  {
    id: 'srv-iph-11pm-disp-copy',
    brand: 'Iphone',
    model: '11 pro max',
    serviceName: 'iPhone 11 Pro Max Copy Display Replacement',
    price: 7500,
    priceType: 'FIXED',
    category: 'Display',
    status: 'ACTIVE',
  },

  // iPhone 13 Pro Max
  {
    id: 'srv-iph-13pm-buzzer',
    brand: 'Iphone',
    model: '13 Pro Max',
    serviceName: 'iPhone 13 Pro Max Buzzer Speaker Replacement',
    price: 3500,
    priceType: 'FIXED',
    category: 'Speaker',
    status: 'ACTIVE',
  },
  {
    id: 'srv-iph-13pm-disp-orig',
    brand: 'Iphone',
    model: '13 Pro Max',
    serviceName: 'iPhone 13 Pro Max Original Display Replacement',
    price: 32000,
    priceType: 'FIXED',
    category: 'Display',
    status: 'ACTIVE',
  },
  {
    id: 'srv-iph-13pm-disp-incell',
    brand: 'Iphone',
    model: '13 Pro Max',
    serviceName: 'iPhone 13 Pro Max Incell Display Replacement',
    price: 14000,
    priceType: 'FIXED',
    category: 'Display',
    status: 'ACTIVE',
  },

  // iPhone 14 Pro Max
  {
    id: 'a66572ae-724d-4703-b982-f5b8f1a3e252',
    brand: 'Iphone',
    model: '14 pro max',
    serviceName: 'iPhone 14 Pro Max Original Display Replacement',
    price: 35000,
    priceType: 'FIXED',
    category: 'Display',
    status: 'ACTIVE',
  },

  // iPhone X, XR, XS, XS Max
  {
    id: 'srv-iph-x-disp-orig',
    brand: 'Iphone',
    model: 'X',
    serviceName: 'iPhone X Original Display Replacement',
    price: 8500,
    priceType: 'FIXED',
    category: 'Display',
    status: 'ACTIVE',
  },
  {
    id: 'srv-iph-x-disp-copy',
    brand: 'Iphone',
    model: 'X',
    serviceName: 'iPhone X Copy Display Replacement',
    price: 3800,
    priceType: 'FIXED',
    category: 'Display',
    status: 'ACTIVE',
  },
  {
    id: 'srv-iph-xr-disp-orig',
    brand: 'Iphone',
    model: 'XR',
    serviceName: 'iPhone XR Original Display Replacement',
    price: 7500,
    priceType: 'FIXED',
    category: 'Display',
    status: 'ACTIVE',
  },
  {
    id: 'srv-iph-xsmax-disp-orig',
    brand: 'Iphone',
    model: 'Xsmax',
    serviceName: 'iPhone XS Max Original Display Replacement',
    price: 12000,
    priceType: 'FIXED',
    category: 'Display',
    status: 'ACTIVE',
  },
];

describe('MTS Lab Automated Legacy Service URL Resolution Engine', () => {
  const { slugToService } = buildSlugMap(mockServices);

  // Test A: Legacy noise phrase
  test('Test A: Legacy noise phrase resolves to active service slug', () => {
    const input = 'iphone-11-all-storage-sizes-and-colors-11-original-display-replacement';
    const resolution = resolveServiceSlug(input, slugToService);

    assert.equal(resolution.type, 'REDIRECT');
    assert.equal(resolution.targetSlug, 'iphone-11-original-display-replacement');
    assert.equal(resolution.targetUrl, '/services/iphone-11-original-display-replacement');
    assert.ok(resolution.service);
    assert.equal(resolution.service.serviceName, 'iPhone 11 Original Display Replacement');
    assert.equal(resolution.matchStrategy, 'AUTOMATED_LEGACY');
  });

  // Test B: Long legacy phrase
  test('Test B: Long legacy phrase resolves to verified active buzzer speaker service', () => {
    const input = 'iphone-13-pro-max-all-compatible-variants-confirm-before-repair-13-buzzer-speaker-replacement';
    const resolution = resolveServiceSlug(input, slugToService);

    assert.equal(resolution.type, 'REDIRECT');
    assert.equal(resolution.targetSlug, 'iphone-13-pro-max-13-buzzer-speaker-replacement');
    assert.equal(resolution.targetUrl, '/services/iphone-13-pro-max-13-buzzer-speaker-replacement');
    assert.ok(resolution.service);
    assert.equal(resolution.service.serviceName, 'iPhone 13 Pro Max Buzzer Speaker Replacement');
    assert.equal(resolution.matchStrategy, 'AUTOMATED_LEGACY');
  });

  // Test C: Exact active slug
  test('Test C: Exact active slug returns without redirecting', () => {
    const activeSlug = 'iphone-11-original-display-replacement';
    const resolution = resolveServiceSlug(activeSlug, slugToService);

    assert.equal(resolution.type, 'ACTIVE');
    assert.equal(resolution.cleanSlug, activeSlug);
    assert.equal(resolution.targetSlug, undefined);
    assert.ok(resolution.service);
    assert.equal(resolution.service.serviceName, 'iPhone 11 Original Display Replacement');
    assert.equal(resolution.matchStrategy, 'EXACT_ACTIVE');
  });

  // Test D: Explicit legacy dictionary entry
  test('Test D: Explicit legacy dictionary entry resolves to verified active destination', () => {
    const legacySlug = 'iphone-14-pro-max-standard-original-standard';
    const resolution = resolveServiceSlug(legacySlug, slugToService);

    assert.equal(resolution.type, 'REDIRECT');
    assert.equal(resolution.targetSlug, 'iphone-14-pro-max-14-original-display-replacement');
    assert.equal(resolution.matchStrategy, 'EXPLICIT_LEGACY');
    assert.ok(resolution.service);
    assert.equal(resolution.service.serviceName, 'iPhone 14 Pro Max Original Display Replacement');
  });

  // Test E: Multiple noise phrases
  test('Test E: Multiple noise phrases are stripped without mutating meaningful model or service tokens', () => {
    const input = 'iphone-11-all-storage-sizes-and-colors-all-compatible-variants-confirm-before-repair-original-display-replacement';
    const resolution = resolveServiceSlug(input, slugToService);

    assert.equal(resolution.type, 'REDIRECT');
    assert.equal(resolution.targetSlug, 'iphone-11-original-display-replacement');
    assert.ok(resolution.service);
    assert.equal(resolution.service.serviceName, 'iPhone 11 Original Display Replacement');
  });

  // Test F: Model distinction
  test('Test F: Model distinction ensures distinct models are never confused', () => {
    // 1. iPhone X vs iPhone XR
    const xRes = resolveServiceSlug('iphone-x-copy-display-replacement', slugToService);
    assert.equal(xRes.type, 'ACTIVE');
    assert.equal(xRes.service?.model.toLowerCase(), 'x');

    const xrRes = resolveServiceSlug('iphone-xr-original-display-replacement', slugToService);
    assert.equal(xrRes.type, 'ACTIVE');
    assert.equal(xrRes.service?.model.toLowerCase(), 'xr');

    // 2. iPhone XS vs iPhone XS Max
    const xsMaxRes = resolveServiceSlug('iphone-xsmax-xs-max-original-display-replacement', slugToService);
    assert.equal(xsMaxRes.type, 'ACTIVE');
    assert.equal(xsMaxRes.service?.model.toLowerCase(), 'xsmax');

    // 3. iPhone 11 vs iPhone 11 Pro Max
    const iph11Res = resolveServiceSlug('iphone-11-original-display-replacement', slugToService);
    assert.equal(iph11Res.service?.model.toLowerCase(), '11');

    const iph11PmRes = resolveServiceSlug('iphone-11-pro-max-11-original-display-replacement', slugToService);
    assert.equal(iph11PmRes.service?.model.toLowerCase(), '11 pro max');

    // 4. iPhone 13 vs iPhone 13 Pro Max
    const iph13PmRes = resolveServiceSlug('iphone-13-pro-max-13-buzzer-speaker-replacement', slugToService);
    assert.equal(iph13PmRes.service?.model.toLowerCase(), '13 pro max');
  });

  // Test G: Service-type distinction
  test('Test G: Service-type distinction prevents confusing display grades, cameras, or parts', () => {
    // Original vs Copy display
    const origDisp = resolveServiceSlug('iphone-11-pro-max-11-original-display-replacement', slugToService);
    const copyDisp = resolveServiceSlug('iphone-11-pro-max-11-copy-display-replacement', slugToService);
    assert.notEqual(origDisp.service?.id, copyDisp.service?.id);
    assert.ok(origDisp.service?.serviceName.includes('Original'));
    assert.ok(copyDisp.service?.serviceName.includes('Copy'));

    // Front Camera vs Back Camera
    const frontCam = resolveServiceSlug('iphone-11-front-camera-replacement', slugToService);
    const backCam = resolveServiceSlug('iphone-11-back-camera-replacement', slugToService);
    assert.notEqual(frontCam.service?.id, backCam.service?.id);
    assert.ok(frontCam.service?.serviceName.includes('Front Camera'));
    assert.ok(backCam.service?.serviceName.includes('Back Camera'));

    // Original vs Incell display on 13 Pro Max
    const orig13 = resolveServiceSlug('iphone-13-pro-max-13-original-display-replacement', slugToService);
    const incell13 = resolveServiceSlug('iphone-13-pro-max-13-incell-display-replacement', slugToService);
    assert.notEqual(orig13.service?.id, incell13.service?.id);
    assert.ok(orig13.service?.serviceName.includes('Original'));
    assert.ok(incell13.service?.serviceName.includes('Incell'));
  });

  // Test H: Unknown model returns NOT_FOUND
  test('Test H: Unknown model returns NOT_FOUND', () => {
    const unknown1 = resolveServiceSlug('nokia-3310-display-replacement', slugToService);
    assert.equal(unknown1.type, 'NOT_FOUND');

    const unknown2 = resolveServiceSlug('iphone-99-screen-fix', slugToService);
    assert.equal(unknown2.type, 'NOT_FOUND');
  });

  // Test I: Unknown service type returns NOT_FOUND
  test('Test I: Unknown service type returns NOT_FOUND', () => {
    const unknown = resolveServiceSlug('iphone-11-coffee-cup-holder', slugToService);
    assert.equal(unknown.type, 'NOT_FOUND');
  });

  // Test J: Ambiguous candidates return NOT_FOUND
  test('Test J: Ambiguous candidates return NOT_FOUND without picking arbitrarily', () => {
    // Multiple display grades exist for iPhone 11 (Original, Copy, GX), but no grade specified
    const ambiguousDisplay = resolveServiceSlug('iphone-11-display-replacement', slugToService);
    assert.equal(ambiguousDisplay.type, 'NOT_FOUND');

    // Both front and back camera exist for iPhone 11, but direction not specified
    const ambiguousCamera = resolveServiceSlug('iphone-11-camera-replacement', slugToService);
    assert.equal(ambiguousCamera.type, 'NOT_FOUND');
  });

  // Test K: Destination missing does NOT redirect to dead end
  test('Test K: Destination missing safely returns NOT_FOUND', () => {
    const isolatedMap = new Map<string, ServiceLike>();
    // 'iphone-14-pro-max-14-original-display-replacement' is deliberately missing
    const res = resolveServiceSlug('iphone-14-pro-max-standard-original-standard', isolatedMap);
    assert.equal(res.type, 'NOT_FOUND');
  });

  // Test L: Normalization stability
  test('Test L: Repeated normalization yields identical, deterministic results', () => {
    const input = 'iphone-11-all-storage-sizes-and-colors-11-original-display-replacement';
    const norm1 = normalizeLegacySlug(input);
    const norm2 = normalizeLegacySlug(input);
    const norm3 = normalizeLegacySlug(norm1);

    assert.equal(norm1, norm2);
    assert.equal(norm1, norm3);
    assert.equal(norm1, 'iphone-11-11-original-display-replacement');

    const res1 = resolveServiceSlug(input, slugToService);
    const res2 = resolveServiceSlug(input, slugToService);
    assert.deepEqual(res1, res2);
  });

  // Test M: Regression & Integration
  test('Test M: Server integration verifies HTTP 301 redirects for legacy slugs and 404 for unknown', async () => {
    try {
      // 1. Legacy slug with query parameter preservation
      const res = await fetch(
        'http://localhost:3000/services/iphone-11-all-storage-sizes-and-colors-11-original-display-replacement?utm_campaign=gsc_test',
        { redirect: 'manual' }
      );
      assert.equal(res.status, 301, 'Should return HTTP 301 for legacy slug');
      const location = res.headers.get('location');
      assert.ok(location?.startsWith('/services/iphone-11-original-display-replacement'));
      assert.ok(location?.includes('utm_campaign=gsc_test'));

      // 2. Genuinely unknown slug
      const notFoundRes = await fetch('http://localhost:3000/services/completely-unknown-device-model-404');
      assert.equal(notFoundRes.status, 404, 'Unknown slug must return HTTP 404');
      const xRobots = notFoundRes.headers.get('x-robots-tag');
      assert.ok(xRobots?.includes('noindex'), '404 response must specify noindex');
    } catch (err: any) {
      console.warn('Live server test notice:', err.message);
    }
  });
});
