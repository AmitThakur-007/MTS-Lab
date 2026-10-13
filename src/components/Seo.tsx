import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  SITE_URL,
  BUSINESS_NAME,
  STATIC_PAGES_SEO,
  isNoindexRoute,
  getLocalBusinessJsonLd,
  safeJsonLdString,
} from '@/lib/seo';

export interface PageSeoProps {
  title?: string;
  description?: string;
  canonical?: string;
  noindex?: boolean;
  ogType?: 'website' | 'article' | 'product';
  ogImage?: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

const JSON_LD_CONTAINER_ID = 'mts-seo-jsonld';

function setMetaTag(selector: string, attribute: 'name' | 'property', attrValue: string, content: string | null) {
  let element = document.querySelector(selector) as HTMLMetaElement | null;
  if (!content) {
    if (element) element.remove();
    return;
  }
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, attrValue);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function setCanonical(href: string | null) {
  let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!href) {
    if (link) link.remove();
    return;
  }
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

export function updateDocumentSeo({
  title,
  description,
  canonical,
  noindex = false,
  ogType = 'website',
  ogImage = `${SITE_URL}/mts-logo.jpg`,
  jsonLd,
}: PageSeoProps) {
  if (typeof document === 'undefined') return;

  // 1. Document Title
  if (title) {
    document.title = title;
  }

  // 2. Meta Description
  if (description) {
    setMetaTag('meta[name="description"]', 'name', 'description', description);
  }

  // 3. Robots
  const robotsDirective = noindex ? 'noindex, nofollow' : 'index, follow, max-snippet:-1, max-image-preview:large';
  setMetaTag('meta[name="robots"]', 'name', 'robots', robotsDirective);

  // 4. Canonical URL
  if (canonical) {
    setCanonical(canonical);
  }

  // 5. Open Graph
  if (title) setMetaTag('meta[property="og:title"]', 'property', 'og:title', title);
  if (description) setMetaTag('meta[property="og:description"]', 'property', 'og:description', description);
  if (canonical) setMetaTag('meta[property="og:url"]', 'property', 'og:url', canonical);
  setMetaTag('meta[property="og:type"]', 'property', 'og:type', ogType);
  setMetaTag('meta[property="og:image"]', 'property', 'og:image', ogImage);
  setMetaTag('meta[property="og:site_name"]', 'property', 'og:site_name', BUSINESS_NAME);

  // 6. Twitter Card
  setMetaTag('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');
  if (title) setMetaTag('meta[name="twitter:title"]', 'name', 'twitter:title', title);
  if (description) setMetaTag('meta[name="twitter:description"]', 'name', 'twitter:description', description);
  setMetaTag('meta[name="twitter:image"]', 'name', 'twitter:image', ogImage);

  // 7. JSON-LD Structured Data
  let script = document.getElementById(JSON_LD_CONTAINER_ID) as HTMLScriptElement | null;
  if (jsonLd) {
    if (!script) {
      script = document.createElement('script');
      script.id = JSON_LD_CONTAINER_ID;
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = safeJsonLdString(jsonLd);
  } else if (script) {
    script.remove();
  }
}

/**
 * RouteSeo Component: Mounts once inside <Router> to automatically sync
 * title, meta, canonical, and structured data for static routes and private portals.
 */
export function RouteSeo() {
  const location = useLocation();

  useEffect(() => {
    const pathname = location.pathname;

    // Check static routes
    const staticConfig = STATIC_PAGES_SEO[pathname];
    if (staticConfig) {
      updateDocumentSeo({
        title: staticConfig.title,
        description: staticConfig.description,
        canonical: staticConfig.canonical,
        noindex: staticConfig.noindex || false,
        jsonLd: pathname === '/' ? getLocalBusinessJsonLd() : undefined,
      });
      return;
    }

    // Dynamic service pages handle their own SEO via <PageSeo /> in ServiceDetail
    if (pathname.startsWith('/services/')) {
      return;
    }

    // Private portals and auth routes: strictly noindex
    if (isNoindexRoute(pathname)) {
      updateDocumentSeo({
        title: `${BUSINESS_NAME} – Internal Portal`,
        description: 'Authorized administrative and technician workspace for MTS Lab.',
        canonical: `${SITE_URL}${pathname}`,
        noindex: true,
      });
      return;
    }

    // Default fallback for 404 / unknown routes
    updateDocumentSeo({
      title: `Page Not Found | ${BUSINESS_NAME}`,
      description: 'The requested page could not be located on MTS Lab.',
      canonical: `${SITE_URL}${pathname}`,
      noindex: true,
    });
  }, [location.pathname]);

  return null;
}

/**
 * PageSeo Component: Used by specific pages (like ServiceDetail) for fine-grained SEO injection
 */
export function PageSeo(props: PageSeoProps) {
  useEffect(() => {
    updateDocumentSeo(props);
    return () => {
      // Clean up injected dynamic JSON-LD on unmount
      const script = document.getElementById(JSON_LD_CONTAINER_ID);
      if (script) script.remove();
    };
  }, [props.title, props.description, props.canonical, props.noindex, JSON.stringify(props.jsonLd)]);

  return null;
}

export default RouteSeo;
