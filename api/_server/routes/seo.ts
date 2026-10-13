import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { supabaseAdmin } from '../config/supabase';
import { parseServiceItem, onRepairPricesChanged } from './repairPrices';
import {
  SITE_URL,
  BUSINESS_NAME,
  BUSINESS_PHONE,
  BUSINESS_PHONE_INTL,
  BUSINESS_LANDLINE,
  BUSINESS_EMAIL,
  BUSINESS_ADDRESS,
  ServiceLike,
  buildSlugMap,
  formatNprPrice,
  getServiceSeoTitle,
  getServiceSeoDescription,
  getServiceDirectAnswer,
  getServiceFaqs,
  getLocalBusinessJsonLd,
  getServicePageJsonLd,
  STATIC_PAGES_SEO,
  escapeHtml,
  safeJsonLdString,
} from '../../../src/lib/seo';

const router = Router();

// Memory-bounded caching for active services
let cachedActiveServices: ServiceLike[] | null = null;
let lastCacheFetchTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

export function invalidateSeoServicesCache() {
  cachedActiveServices = null;
  lastCacheFetchTime = 0;
}

// Invalidate on repair prices change
onRepairPricesChanged(() => {
  invalidateSeoServicesCache();
});

async function getAuthoritativeActiveServices(): Promise<ServiceLike[]> {
  const now = Date.now();
  if (cachedActiveServices && now - lastCacheFetchTime < CACHE_TTL_MS) {
    return cachedActiveServices;
  }

  const { data, error } = await supabaseAdmin
    .from('RepairPrice')
    .select('*')
    .eq('status', 'ACTIVE')
    .order('brand', { ascending: true })
    .order('model', { ascending: true });

  if (error) {
    console.error('[SEO ROUTER SUPABASE QUERY ERROR]', error);
    // If cache exists even if stale, return it on transient db error
    if (cachedActiveServices) {
      return cachedActiveServices;
    }
    throw new Error('Database service retrieval failed');
  }

  const parsed = (data || []).map((item) => parseServiceItem(item, true));
  cachedActiveServices = parsed;
  lastCacheFetchTime = now;
  return parsed;
}

function getHtmlTemplate(): string {
  const prodPath = path.join(process.cwd(), 'dist', 'index.html');
  if (fs.existsSync(prodPath)) {
    return fs.readFileSync(prodPath, 'utf8');
  }
  const devPath = path.join(process.cwd(), 'index.html');
  if (fs.existsSync(devPath)) {
    return fs.readFileSync(devPath, 'utf8');
  }
  throw new Error('HTML template not found');
}

interface PageMetaOptions {
  title: string;
  description: string;
  canonicalUrl: string;
  noindex?: boolean;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  bodyHtml: string;
}

function injectSeoIntoTemplate(template: string, options: PageMetaOptions): string {
  const { title, description, canonicalUrl, noindex = false, jsonLd, bodyHtml } = options;

  let html = template;

  // Replace <title>
  const escapedTitle = escapeHtml(title);
  if (html.includes('<title>')) {
    html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapedTitle}</title>`);
  } else {
    html = html.replace('</head>', `  <title>${escapedTitle}</title>\n</head>`);
  }

  // Build meta tags block
  const robotsValue = noindex
    ? 'noindex, nofollow'
    : 'index, follow, max-snippet:-1, max-image-preview:large';

  const metaTags = [
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<meta name="robots" content="${robotsValue}" />`,
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`,
    `<meta property="og:title" content="${escapedTitle}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:image" content="${SITE_URL}/mts-logo.jpg" />`,
    `<meta property="og:site_name" content="${escapeHtml(BUSINESS_NAME)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapedTitle}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    `<meta name="twitter:image" content="${SITE_URL}/mts-logo.jpg" />`,
  ];

  if (jsonLd) {
    metaTags.push(`<script type="application/ld+json">${safeJsonLdString(jsonLd)}</script>`);
  }

  const metaString = metaTags.join('\n    ');

  // Strip existing placeholder meta tags in template to prevent duplicates
  html = html.replace(/<meta name="description"[^>]*>/gi, '');
  html = html.replace(/<meta name="robots"[^>]*>/gi, '');
  html = html.replace(/<link rel="canonical"[^>]*>/gi, '');
  html = html.replace(/<meta property="og:title"[^>]*>/gi, '');
  html = html.replace(/<meta property="og:description"[^>]*>/gi, '');
  html = html.replace(/<meta property="og:url"[^>]*>/gi, '');
  html = html.replace(/<meta name="twitter:[^>]*>/gi, '');

  html = html.replace('</head>', `    ${metaString}\n  </head>`);

  // Inject content inside <div id="root">
  if (html.includes('<div id="root"></div>')) {
    html = html.replace('<div id="root"></div>', `<div id="root">${bodyHtml}</div>`);
  } else if (html.includes('<div id="root">')) {
    html = html.replace(/<div id="root">[\s\S]*?<\/div>/, `<div id="root">${bodyHtml}</div>`);
  }

  return html;
}

// ==========================================
// 1. SITEMAP: GET /sitemap.xml
// ==========================================
router.get('/sitemap.xml', async (req: Request, res: Response) => {
  try {
    const services = await getAuthoritativeActiveServices();
    const { slugToService } = buildSlugMap(services);

    const nowIso = new Date().toISOString().split('T')[0];

    const staticUrls = [
      { loc: `${SITE_URL}/`, priority: '1.0', changefreq: 'weekly' },
      { loc: `${SITE_URL}/services`, priority: '0.9', changefreq: 'daily' },
      { loc: `${SITE_URL}/about`, priority: '0.8', changefreq: 'monthly' },
      { loc: `${SITE_URL}/contact`, priority: '0.8', changefreq: 'monthly' },
      { loc: `${SITE_URL}/track`, priority: '0.7', changefreq: 'monthly' },
      { loc: `${SITE_URL}/shop`, priority: '0.7', changefreq: 'weekly' },
      { loc: `${SITE_URL}/terms`, priority: '0.4', changefreq: 'yearly' },
      { loc: `${SITE_URL}/privacy`, priority: '0.4', changefreq: 'yearly' },
    ];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    for (const item of staticUrls) {
      xml += `  <url>\n`;
      xml += `    <loc>${escapeHtml(item.loc)}</loc>\n`;
      xml += `    <lastmod>${nowIso}</lastmod>\n`;
      xml += `    <changefreq>${item.changefreq}</changefreq>\n`;
      xml += `    <priority>${item.priority}</priority>\n`;
      xml += `  </url>\n`;
    }

    slugToService.forEach((svc, slug) => {
      const lastmod = svc.updatedAt
        ? new Date(svc.updatedAt).toISOString().split('T')[0]
        : nowIso;
      xml += `  <url>\n`;
      xml += `    <loc>${escapeHtml(`${SITE_URL}/services/${slug}`)}</loc>\n`;
      xml += `    <lastmod>${lastmod}</lastmod>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.8</priority>\n`;
      xml += `  </url>\n`;
    });

    xml += `</urlset>`;

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    return res.status(200).send(xml);
  } catch (err: any) {
    console.error('[SITEMAP GENERATION ERROR]', err);
    return res.status(500).type('text/plain').send('Failed to generate sitemap.xml');
  }
});

// ==========================================
// 2. SERVICES CATALOG: GET /services
// ==========================================
router.get('/services', async (req: Request, res: Response) => {
  try {
    const services = await getAuthoritativeActiveServices();
    const { slugToService } = buildSlugMap(services);

    const seoConfig = STATIC_PAGES_SEO['/services'];
    const template = getHtmlTemplate();

    // Generate crawler-readable body HTML
    let serviceItemsHtml = '';
    slugToService.forEach((service, slug) => {
      const priceStr = formatNprPrice(service.price, service.priceType);
      const device = `${service.brand} ${service.model}${service.variant ? ` ${service.variant}` : ''}`;
      serviceItemsHtml += `
        <article style="border:1px solid #e2e8f0; border-radius:12px; padding:16px; margin-bottom:12px;">
          <h2 style="font-size:18px; margin:0 0 6px 0;">
            <a href="/services/${escapeHtml(slug)}" style="color:#0f172a; text-decoration:underline;">
              ${escapeHtml(service.serviceName)} - ${escapeHtml(device)}
            </a>
          </h2>
          <p style="margin:4px 0; color:#475569; font-size:14px;">Brand: <strong>${escapeHtml(service.brand)}</strong> | Category: <strong>${escapeHtml(service.category || 'Repair')}</strong></p>
          <p style="margin:4px 0; color:#059669; font-weight:bold; font-size:16px;">Cost: ${escapeHtml(priceStr)}</p>
          ${service.estimatedTime ? `<p style="margin:4px 0; color:#64748b; font-size:13px;">Estimated Turnaround: ${escapeHtml(service.estimatedTime)}</p>` : ''}
          ${service.problem ? `<p style="margin:4px 0; color:#334155; font-size:13px;">${escapeHtml(service.problem)}</p>` : ''}
          <p style="margin:6px 0 0 0;"><a href="/services/${escapeHtml(slug)}" style="color:#2563eb; font-weight:600;">View full service details &rarr;</a></p>
        </article>
      `;
    });

    const bodyHtml = `
      <main style="max-width:960px; margin:0 auto; padding:24px 16px; font-family:system-ui,-apple-system,sans-serif;">
        <nav aria-label="Breadcrumb" style="font-size:14px; color:#64748b; margin-bottom:16px;">
          <a href="/" style="color:#64748b; text-decoration:none;">Home</a> &gt; 
          <span style="color:#0f172a; font-weight:600;">Repair Services</span>
        </nav>
        <header style="margin-bottom:24px;">
          <h1 style="font-size:28px; font-weight:800; color:#0f172a;">${escapeHtml(seoConfig.title)}</h1>
          <p style="font-size:16px; color:#475569; margin-top:8px;">${escapeHtml(seoConfig.description)}</p>
          <div style="margin-top:12px; font-size:14px; color:#334155;">
            <strong>Location:</strong> ${escapeHtml(BUSINESS_ADDRESS.streetAddress)}, ${escapeHtml(BUSINESS_ADDRESS.addressLocality)} | 
            <strong>Hotline:</strong> <a href="tel:${BUSINESS_PHONE}" style="color:#059669; font-weight:bold;">${BUSINESS_PHONE}</a> | 
            <strong>Landline:</strong> ${BUSINESS_LANDLINE}
          </div>
        </header>
        <section>
          ${serviceItemsHtml}
        </section>
      </main>
    `;

    const html = injectSeoIntoTemplate(template, {
      title: seoConfig.title,
      description: seoConfig.description,
      canonicalUrl: seoConfig.canonical,
      jsonLd: getLocalBusinessJsonLd(),
      bodyHtml,
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
    return res.status(200).send(html);
  } catch (err: any) {
    console.error('[SEO /services ERROR]', err);
    return res.status(503).send('Authoritative repair service directory is temporarily unavailable.');
  }
});

// ==========================================
// 3. SERVICE DETAIL: GET /services/:slug
// ==========================================
router.get('/services/:slug', async (req: Request, res: Response) => {
  const reqSlug = (req.params.slug || '').trim().toLowerCase();
  try {
    const services = await getAuthoritativeActiveServices();
    const { slugToService } = buildSlugMap(services);

    const service = slugToService.get(reqSlug);
    const template = getHtmlTemplate();

    if (!service) {
      // Return HTTP 404 with noindex for nonexistent slugs
      const notFoundBody = `
        <main style="max-width:640px; margin:40px auto; padding:24px; text-align:center; font-family:system-ui,-apple-system,sans-serif;">
          <h1 style="font-size:24px; color:#0f172a;">Repair Service Not Found</h1>
          <p style="color:#64748b; margin:12px 0 24px;">The repair service slug "${escapeHtml(reqSlug)}" does not exist in our active database.</p>
          <p><a href="/services" style="display:inline-block; padding:10px 20px; background:#0f172a; color:#fff; text-decoration:none; border-radius:8px; font-weight:bold;">Browse All Services</a></p>
        </main>
      `;

      const notFoundHtml = injectSeoIntoTemplate(template, {
        title: `Service Not Found | ${BUSINESS_NAME}`,
        description: 'The requested smartphone repair service could not be found.',
        canonicalUrl: `${SITE_URL}/services`,
        noindex: true,
        bodyHtml: notFoundBody,
      });

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(404).send(notFoundHtml);
    }

    const title = getServiceSeoTitle(service);
    const description = getServiceSeoDescription(service);
    const canonicalUrl = `${SITE_URL}/services/${reqSlug}`;
    const directAnswer = getServiceDirectAnswer(service);
    const faqs = getServiceFaqs(service);
    const pageJsonLd = getServicePageJsonLd(service, reqSlug);
    const priceDisplay = formatNprPrice(service.price, service.priceType);
    const fullDeviceName = `${service.brand} ${service.model}${service.variant ? ` ${service.variant}` : ''}`.trim();

    let faqHtml = '';
    for (const faq of faqs) {
      faqHtml += `
        <div style="margin-top:16px;">
          <h3 style="font-size:16px; font-weight:700; color:#0f172a; margin:0 0 4px 0;">${escapeHtml(faq.question)}</h3>
          <p style="color:#475569; font-size:14px; margin:0; line-height:1.5;">${escapeHtml(faq.answer)}</p>
        </div>
      `;
    }

    const bodyHtml = `
      <main style="max-width:800px; margin:0 auto; padding:32px 16px; font-family:system-ui,-apple-system,sans-serif;">
        <nav style="font-size:14px; color:#64748b; margin-bottom:16px;">
          <a href="/" style="color:#64748b; text-decoration:none;">Home</a> &gt; 
          <a href="/services" style="color:#64748b; text-decoration:none;">Repair Services</a> &gt; 
          <span style="color:#0f172a; font-weight:600;">${escapeHtml(service.serviceName)}</span>
        </nav>

        <article style="background:#fff; border:1px solid #e2e8f0; border-radius:16px; padding:24px; margin-bottom:24px;">
          <div style="display:inline-block; padding:4px 10px; background:#f1f5f9; border-radius:100px; font-size:12px; font-weight:700; color:#334155; margin-bottom:12px;">
            ${escapeHtml(service.brand)} &bull; ${escapeHtml(service.category || 'Repair')}
          </div>
          <h1 style="font-size:28px; font-weight:800; color:#0f172a; margin:0 0 8px 0; line-height:1.3;">
            ${escapeHtml(service.serviceName)} for ${escapeHtml(fullDeviceName)}
          </h1>
          <p style="font-size:16px; color:#475569; margin:0 0 16px 0;">Hardware Device: <strong>${escapeHtml(fullDeviceName)}</strong></p>

          <div style="background:#0f172a; color:#fff; border-radius:12px; padding:20px; margin:16px 0;">
            <div style="font-size:12px; text-transform:uppercase; letter-spacing:1px; color:#94a3b8;">Verified Laboratory Cost</div>
            <div style="font-size:28px; font-weight:900; color:#34d399; margin:4px 0;">${escapeHtml(priceDisplay)}</div>
            ${service.estimatedTime ? `<div style="font-size:13px; color:#cbd5e1; margin-top:6px;">Estimated Turnaround: <strong>${escapeHtml(service.estimatedTime)}</strong></div>` : ''}
          </div>

          <div style="margin:20px 0; padding:16px; background:#eff6ff; border-left:4px solid #3b82f6; border-radius:8px;">
            <strong style="color:#1e40af; font-size:14px; display:block; margin-bottom:4px;">Diagnostic Overview:</strong>
            <p style="margin:0; font-size:14px; color:#1e293b; line-height:1.5;">${escapeHtml(directAnswer)}</p>
          </div>

          ${service.problem ? `
            <div style="margin:20px 0;">
              <h2 style="font-size:18px; font-weight:700; color:#0f172a; margin:0 0 6px 0;">Problem Addressed</h2>
              <p style="font-size:14px; color:#334155; margin:0; line-height:1.5;">${escapeHtml(service.problem)}</p>
            </div>
          ` : ''}

          <div style="margin:24px 0; padding-top:16px; border-top:1px solid #e2e8f0;">
            <h2 style="font-size:20px; font-weight:800; color:#0f172a; margin:0 0 12px 0;">Frequently Asked Questions</h2>
            ${faqHtml}
          </div>

          <div style="margin-top:24px; padding:16px; background:#f8fafc; border-radius:12px; border:1px solid #e2e8f0; font-size:14px; color:#334155;">
            <p style="margin:0 0 6px 0;"><strong>Laboratory Location:</strong> ${escapeHtml(BUSINESS_ADDRESS.streetAddress)}, ${escapeHtml(BUSINESS_ADDRESS.addressLocality)}, Nepal.</p>
            <p style="margin:0;"><strong>Hotline Call:</strong> <a href="tel:${BUSINESS_PHONE}" style="color:#059669; font-weight:700;">${BUSINESS_PHONE}</a> | <strong>Landline:</strong> ${BUSINESS_LANDLINE}</p>
          </div>
        </article>
      </main>
    `;

    const html = injectSeoIntoTemplate(template, {
      title,
      description,
      canonicalUrl,
      jsonLd: pageJsonLd,
      bodyHtml,
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
    return res.status(200).send(html);
  } catch (err: any) {
    console.error(`[SEO /services/${reqSlug} ERROR]`, err);
    return res.status(503).send('Authoritative repair service details are temporarily unavailable.');
  }
});

// ==========================================
// 4. ABOUT PAGE: GET /about
// ==========================================
router.get('/about', (req: Request, res: Response) => {
  try {
    const seoConfig = STATIC_PAGES_SEO['/about'];
    const template = getHtmlTemplate();

    const bodyHtml = `
      <main style="max-width:800px; margin:0 auto; padding:32px 16px; font-family:system-ui,-apple-system,sans-serif;">
        <h1 style="font-size:28px; font-weight:800; color:#0f172a; margin:0 0 12px 0;">${escapeHtml(seoConfig.title)}</h1>
        <p style="font-size:16px; color:#475569; line-height:1.6;">${escapeHtml(seoConfig.description)}</p>
        <section style="margin-top:24px; line-height:1.6; color:#334155; font-size:15px;">
          <h2 style="font-size:20px; font-weight:700; color:#0f172a; margin:16px 0 8px;">Cleanroom Hardware Repair Facility</h2>
          <p>MTS Lab is Kathmandu's advanced mobile hardware station specializing in laser screen line repairs, OCA laminations, motherboard IC micro-soldering, and certified hardware restoration.</p>
          <h2 style="font-size:20px; font-weight:700; color:#0f172a; margin:16px 0 8px;">Address & Contact</h2>
          <p>${escapeHtml(BUSINESS_ADDRESS.streetAddress)}, ${escapeHtml(BUSINESS_ADDRESS.addressLocality)}, Nepal.</p>
          <p>Phone: <a href="tel:${BUSINESS_PHONE}" style="color:#059669; font-weight:700;">${BUSINESS_PHONE}</a> | Landline: ${BUSINESS_LANDLINE}</p>
        </section>
      </main>
    `;

    const html = injectSeoIntoTemplate(template, {
      title: seoConfig.title,
      description: seoConfig.description,
      canonicalUrl: seoConfig.canonical,
      jsonLd: getLocalBusinessJsonLd(),
      bodyHtml,
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    return res.status(200).send(html);
  } catch (err: any) {
    console.error('[SEO /about ERROR]', err);
    return res.status(500).send('Unable to render page');
  }
});

// ==========================================
// 5. CONTACT PAGE: GET /contact
// ==========================================
router.get('/contact', (req: Request, res: Response) => {
  try {
    const seoConfig = STATIC_PAGES_SEO['/contact'];
    const template = getHtmlTemplate();

    const bodyHtml = `
      <main style="max-width:800px; margin:0 auto; padding:32px 16px; font-family:system-ui,-apple-system,sans-serif;">
        <h1 style="font-size:28px; font-weight:800; color:#0f172a; margin:0 0 12px 0;">${escapeHtml(seoConfig.title)}</h1>
        <p style="font-size:16px; color:#475569; line-height:1.6;">${escapeHtml(seoConfig.description)}</p>
        <section style="margin-top:24px; line-height:1.6; color:#334155; font-size:15px; background:#fff; border:1px solid #e2e8f0; border-radius:16px; padding:24px;">
          <h2 style="font-size:20px; font-weight:700; color:#0f172a; margin:0 0 12px;">Kathmandu Laboratory Hub</h2>
          <p style="margin:4px 0;"><strong>Address:</strong> ${escapeHtml(BUSINESS_ADDRESS.streetAddress)}, ${escapeHtml(BUSINESS_ADDRESS.addressLocality)} 44600, Nepal.</p>
          <p style="margin:4px 0;"><strong>Hotline Phone:</strong> <a href="tel:${BUSINESS_PHONE}" style="color:#059669; font-weight:700;">${BUSINESS_PHONE}</a></p>
          <p style="margin:4px 0;"><strong>Landline:</strong> ${BUSINESS_LANDLINE}</p>
          <p style="margin:4px 0;"><strong>Email:</strong> <a href="mailto:${BUSINESS_EMAIL}" style="color:#2563eb;">${BUSINESS_EMAIL}</a></p>
          <div style="margin-top:16px; padding-top:12px; border-top:1px solid #e2e8f0;">
            <p style="margin:2px 0;"><strong>Hours:</strong> Sunday &ndash; Friday: 10:00 AM &ndash; 7:00 PM</p>
            <p style="margin:2px 0;">Saturday: 10:00 AM &ndash; 6:00 PM</p>
          </div>
        </section>
      </main>
    `;

    const html = injectSeoIntoTemplate(template, {
      title: seoConfig.title,
      description: seoConfig.description,
      canonicalUrl: seoConfig.canonical,
      jsonLd: getLocalBusinessJsonLd(),
      bodyHtml,
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    return res.status(200).send(html);
  } catch (err: any) {
    console.error('[SEO /contact ERROR]', err);
    return res.status(500).send('Unable to render page');
  }
});

export default router;
