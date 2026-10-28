import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import {
  normalizeSeoPath,
  slugToHumanTitle,
  isNoindexRoute,
  STATIC_PAGES_SEO,
  INDEX_ROBOTS,
  NOINDEX_ROBOTS,
  SITE_URL,
} from '../src/lib/seo';

describe('MTS Lab Technical SEO & GSC Exclusion Fix Suite', () => {

  // Test 1: URL Normalization
  test('1. normalizeSeoPath removes redundant trailing slashes and handles case-insensitivity', () => {
    assert.equal(normalizeSeoPath('/services/'), '/services');
    assert.equal(normalizeSeoPath('/services'), '/services');
    assert.equal(normalizeSeoPath('/About/'), '/about');
    assert.equal(normalizeSeoPath('/SERVICES/IPHONE-11/'), '/services/iphone-11');
    assert.equal(normalizeSeoPath('/'), '/');
    assert.equal(normalizeSeoPath(''), '/');
  });

  // Test 2: Slug to Human Title Converter
  test('2. slugToHumanTitle converts URL slugs into professional, well-cased titles', () => {
    const title1 = slugToHumanTitle('iphone-11-back-camera-replacement');
    assert.equal(title1, 'iPhone 11 Back Camera Replacement');

    const title2 = slugToHumanTitle('ipad-pro-11-front-glass-oca-replacement');
    assert.equal(title2, 'iPad Pro 11 Front Glass OCA Replacement');

    const title3 = slugToHumanTitle('samsung-galaxy-s23-ultra-amoled-display-replacement');
    assert.equal(title3, 'Samsung Galaxy S23 Ultra AMOLED Display Replacement');

    const title4 = slugToHumanTitle('power-ic-reballing-motherboard');
    assert.equal(title4, 'Power IC Reballing Motherboard');
  });

  // Test 3: Public vs Private Route Indexing Guard
  test('3. isNoindexRoute strictly protects private/internal portals and preserves public pages', () => {
    // Protected private paths must return true
    assert.equal(isNoindexRoute('/dashboard'), true);
    assert.equal(isNoindexRoute('/dashboard/repairs'), true);
    assert.equal(isNoindexRoute('/dashboard/staff'), true);
    assert.equal(isNoindexRoute('/login'), true);
    assert.equal(isNoindexRoute('/login/'), true);
    assert.equal(isNoindexRoute('/forgot-password'), true);
    assert.equal(isNoindexRoute('/reset-password'), true);
    assert.equal(isNoindexRoute('/pending-approval'), true);
    assert.equal(isNoindexRoute('/rejected-access'), true);

    // Public pages must NEVER be noindexed
    assert.equal(isNoindexRoute('/'), false);
    assert.equal(isNoindexRoute('/services'), false);
    assert.equal(isNoindexRoute('/services/'), false);
    assert.equal(isNoindexRoute('/services/iphone-11-back-camera-replacement'), false);
    assert.equal(isNoindexRoute('/about'), false);
    assert.equal(isNoindexRoute('/about/'), false);
    assert.equal(isNoindexRoute('/contact'), false);
    assert.equal(isNoindexRoute('/shop'), false);
    assert.equal(isNoindexRoute('/track'), false);
    assert.equal(isNoindexRoute('/terms'), false);
    assert.equal(isNoindexRoute('/privacy'), false);
  });

  // Test 4: Static Pages SEO Metadata Quality
  test('4. STATIC_PAGES_SEO has complete and valid metadata for all canonical public pages', () => {
    const publicPaths = ['/', '/services', '/about', '/contact', '/track', '/shop', '/terms', '/privacy'];

    for (const p of publicPaths) {
      const config = STATIC_PAGES_SEO[p];
      assert.ok(config, `Missing SEO config for static path: ${p}`);
      assert.ok(config.title && config.title.length >= 25, `Title too short for ${p}: ${config.title}`);
      assert.ok(config.description && config.description.length >= 50, `Description too short for ${p}: ${config.description}`);
      assert.ok(config.canonical.startsWith(SITE_URL), `Invalid canonical for ${p}: ${config.canonical}`);
      assert.equal(config.noindex, undefined, `Public route ${p} must not specify noindex`);
    }
  });

  // Test 5: Robots Directives Standard Compliance
  test('5. Robots directives conform to Google Search Central requirements', () => {
    assert.equal(INDEX_ROBOTS, 'index, follow, max-snippet:-1, max-image-preview:large');
    assert.equal(NOINDEX_ROBOTS, 'noindex, nofollow');
  });

  // Test 6: vercel.json Syntax & Routing Verification
  test('6. vercel.json contains complete headers, rewrites, redirects, and lambda packaging', () => {
    const raw = fs.readFileSync(path.join(process.cwd(), 'vercel.json'), 'utf8');
    const config = JSON.parse(raw);

    // 6a. Function packaging
    assert.ok(config.functions && config.functions['api/index.js'], 'Missing functions config in vercel.json');
    assert.equal(config.functions['api/index.js'].includeFiles, 'dist/**');

    // 6b. Redirects (301 permanent)
    assert.ok(Array.isArray(config.redirects), 'vercel.json missing redirects array');
    const priceFinderRedirect = config.redirects.find((r: any) => r.source === '/price-finder');
    assert.ok(priceFinderRedirect, 'Missing /price-finder redirect');
    assert.equal(priceFinderRedirect.destination, '/services');
    assert.equal(priceFinderRedirect.permanent, true);

    const legacyHtmlRedirect = config.redirects.find((r: any) => r.source === '/About.html');
    assert.ok(legacyHtmlRedirect, 'Missing legacy .html redirect');
    assert.equal(legacyHtmlRedirect.destination, '/about');
    assert.equal(legacyHtmlRedirect.permanent, true);

    // 6c. Headers: X-Robots-Tag index on public routes
    assert.ok(Array.isArray(config.headers), 'vercel.json missing headers array');
    const servicesHeader = config.headers.find((h: any) => h.source === '/services');
    assert.ok(servicesHeader, 'Missing /services header configuration');
    const servicesRobots = servicesHeader.headers.find((kv: any) => kv.key === 'X-Robots-Tag');
    assert.ok(servicesRobots && servicesRobots.value.includes('index, follow'), 'Services header missing index, follow');

    const serviceDetailHeader = config.headers.find((h: any) => h.source === '/services/(.*)');
    assert.ok(serviceDetailHeader, 'Missing /services/(.*) header configuration');
    const detailRobots = serviceDetailHeader.headers.find((kv: any) => kv.key === 'X-Robots-Tag');
    assert.ok(detailRobots && detailRobots.value.includes('index, follow'), 'Service detail header missing index, follow');

    // 6d. Headers: X-Robots-Tag noindex on dashboard & login
    const dashboardHeader = config.headers.find((h: any) => h.source === '/dashboard/(.*)');
    assert.ok(dashboardHeader, 'Missing /dashboard/(.*) header configuration');
    const dashRobots = dashboardHeader.headers.find((kv: any) => kv.key === 'X-Robots-Tag');
    assert.ok(dashRobots && dashRobots.value === 'noindex, nofollow', 'Dashboard must be noindex, nofollow');

    // 6e. Rewrites: SPA catch-all & API routes
    assert.ok(Array.isArray(config.rewrites), 'vercel.json missing rewrites array');
    assert.ok(config.rewrites.some((r: any) => r.source === '/api/(.*)' && r.destination === '/api/index.js'));
    assert.ok(config.rewrites.some((r: any) => r.source === '/(.*)' && r.destination === '/index.html'));
  });

  // Test 7: robots.txt and sitemap.xml Integrity
  test('7. public/robots.txt and public/sitemap.xml are populated and valid', () => {
    const robotsPath = path.join(process.cwd(), 'public', 'robots.txt');
    assert.ok(fs.existsSync(robotsPath), 'public/robots.txt must exist');
    const robotsTxt = fs.readFileSync(robotsPath, 'utf8');
    assert.ok(robotsTxt.includes('Allow: /'), 'robots.txt must Allow: /');
    assert.ok(robotsTxt.includes('Allow: /services'), 'robots.txt must Allow: /services');
    assert.ok(robotsTxt.includes('Disallow: /dashboard'), 'robots.txt must Disallow: /dashboard');
    assert.ok(robotsTxt.includes('Sitemap: https://www.mobiletechnologystation.com.np/sitemap.xml'), 'robots.txt missing Sitemap declaration');

    const sitemapPath = path.join(process.cwd(), 'public', 'sitemap.xml');
    assert.ok(fs.existsSync(sitemapPath), 'public/sitemap.xml must exist');
    const sitemapXml = fs.readFileSync(sitemapPath, 'utf8');
    assert.ok(sitemapXml.includes('<loc>https://www.mobiletechnologystation.com.np/</loc>'), 'sitemap.xml missing homepage');
    assert.ok(sitemapXml.includes('<loc>https://www.mobiletechnologystation.com.np/services</loc>'), 'sitemap.xml missing /services');
    assert.ok(sitemapXml.includes('<loc>https://www.mobiletechnologystation.com.np/services/iphone-11-back-camera-replacement</loc>'), 'sitemap.xml missing sample service URL');
    assert.ok(sitemapXml.includes('</urlset>'), 'sitemap.xml missing closing urlset tag');
  });

});
