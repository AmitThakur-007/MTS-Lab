import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Wrench,
  Clock,
  ShieldCheck,
  CheckCircle2,
  PhoneCall,
  MessageCircle,
  MapPin,
  ArrowLeft,
  Share2,
  Check,
  ChevronRight,
  HelpCircle,
  Search,
  Smartphone,
  Cpu,
  Layers,
  FileText,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { PageSeo } from '@/components/Seo';
import {
  SITE_URL,
  BUSINESS_NAME,
  BUSINESS_PHONE,
  BUSINESS_PHONE_INTL,
  BUSINESS_LANDLINE,
  BUSINESS_ADDRESS,
  ServiceLike,
  buildSlugMap,
  formatNprPrice,
  getServiceSeoTitle,
  getServiceSeoDescription,
  getServiceDirectAnswer,
  getServiceFaqs,
  getServicePageJsonLd,
  getServiceFaqSubtitle,
  sanitizeServiceDescription,
} from '@/lib/seo';
import { toast } from 'sonner';

export default function ServiceDetail() {
  const { slug } = useParams<{ slug: string }>();

  const [services, setServices] = useState<ServiceLike[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Fetch verified active services from authoritative public API
  useEffect(() => {
    let isMounted = true;
    async function fetchServices() {
      try {
        setLoading(true);
        const res = await fetch('/api/public/repair-prices');
        if (!res.ok) {
          throw new Error(`Failed to load repair services (HTTP ${res.status})`);
        }
        const data = await res.json();
        if (isMounted) {
          const activeOnly = Array.isArray(data) ? data.filter((s) => s.status === 'ACTIVE') : [];
          setServices(activeOnly);
          setError(null);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || 'Unable to load service details at this time.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    fetchServices();
    return () => {
      isMounted = false;
    };
  }, []);

  // Compute deterministic slug map
  const { slugToService, serviceIdToSlug } = useMemo(() => {
    return buildSlugMap(services);
  }, [services]);

  const service = slug ? slugToService.get(slug.toLowerCase()) : undefined;

  // Find related services (same brand or model)
  const relatedServices = useMemo(() => {
    if (!service) return [];
    return services
      .filter((s) => s.id !== service.id && (s.brand === service.brand || s.category === service.category))
      .slice(0, 4);
  }, [services, service]);

  const handleShare = () => {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      toast.success('Link copied to clipboard');
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const fullDeviceName = service
    ? `${service.brand} ${service.model}${service.variant ? ` ${service.variant}` : ''}`
    : '';

  const whatsappMessage = service
    ? `Hello MTS Lab, I would like to inquire about ${service.serviceName} for my ${fullDeviceName}. Price: ${formatNprPrice(service.price, service.priceType)}. Location: Pakosadak, New Road.`
    : '';

  const whatsappUrl = `https://wa.me/9779869276668?text=${encodeURIComponent(whatsappMessage)}`;

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 antialiased">
        <Navbar />
        <main className="flex-1 max-w-5xl w-full mx-auto px-4 pt-28 pb-16 flex flex-col items-center justify-center space-y-4">
          <div className="w-10 h-10 border-3 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
          <p className="text-slate-600 font-medium text-sm">Loading service specification...</p>
        </main>
        <Footer />
      </div>
    );
  }

  // Not Found state
  if (!service || !slug) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 antialiased">
        <PageSeo
          title="Service Not Found | MTS Lab Kathmandu"
          description="The requested smartphone repair service could not be found in our verified catalog."
          canonical={`${SITE_URL}/services`}
          noindex={true}
        />
        <Navbar />
        <main className="flex-1 max-w-2xl w-full mx-auto px-4 pt-28 pb-16 text-center space-y-6">
          <div className="w-16 h-16 bg-slate-100 border border-slate-200 rounded-2xl flex items-center justify-center mx-auto text-slate-600">
            <HelpCircle className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Repair Service Not Found</h1>
            <p className="text-slate-600 max-w-md mx-auto text-sm sm:text-base leading-relaxed">
              The service identifier you requested does not exist or may have been updated. You can browse our complete repair catalog or contact our workshop directly.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              to="/services"
              className="inline-flex items-center justify-center h-12 px-6 rounded-xl font-semibold bg-slate-950 hover:bg-slate-800 text-white text-sm shadow-sm transition-colors cursor-pointer"
            >
              <Search className="w-4 h-4 mr-2" />
              <span>Browse All Services</span>
            </Link>
            <a
              href={`tel:${BUSINESS_PHONE}`}
              className="inline-flex items-center justify-center h-12 px-6 rounded-xl font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm shadow-sm transition-colors cursor-pointer"
            >
              <PhoneCall className="w-4 h-4 mr-2 text-slate-700 dark:text-slate-300" />
              <span>Call Workshop ({BUSINESS_PHONE})</span>
            </a>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const faqs = getServiceFaqs(service);
  const directAnswer = getServiceDirectAnswer(service);
  const pageJsonLd = getServicePageJsonLd(service, slug);
  const priceDisplay = formatNprPrice(service.price, service.priceType);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans antialiased selection:bg-slate-950 dark:selection:bg-indigo-600 selection:text-white">
      <PageSeo
        title={getServiceSeoTitle(service)}
        description={getServiceSeoDescription(service)}
        canonical={`${SITE_URL}/services/${slug}`}
        jsonLd={pageJsonLd}
      />
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-3.5 sm:px-6 lg:px-8 pt-24 sm:pt-28 lg:pt-32 pb-16 space-y-6 sm:space-y-8">
        {/* Dedicated Breadcrumb Container */}
        <div className="w-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl px-3.5 sm:px-4 py-2.5 shadow-2xs">
          <nav 
            aria-label="Breadcrumb" 
            className="flex items-center text-xs sm:text-sm text-slate-500 dark:text-slate-400 gap-1.5 overflow-x-auto whitespace-nowrap py-0.5 min-w-0 max-w-full"
          >
            <Link to="/" className="hover:text-slate-900 dark:hover:text-white font-medium shrink-0 transition-colors">Home</Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
            <Link to="/services" className="hover:text-slate-900 dark:hover:text-white font-medium shrink-0 transition-colors">Repair Services</Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
            <span 
              className="font-bold text-slate-900 dark:text-white truncate max-w-[160px] sm:max-w-xs md:max-w-md lg:max-w-xl shrink-0"
              aria-current="page"
              title={service.serviceName}
            >
              {service.serviceName}
            </span>
          </nav>
        </div>

        {/* Back Link */}
        <div>
          <Link
            to="/services"
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Price Directory</span>
          </Link>
        </div>

        {/* Hero Section: Technical Overview & Verified Laboratory Fee */}
        <article className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-6 sm:p-8 lg:p-10 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
            
            {/* Left: Device & Service Identity */}
            <div className="space-y-3.5 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 px-3 py-1 rounded-md">
                  {service.brand}
                </span>
                {service.category && (
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 px-2.5 py-1 rounded-md">
                    {service.category}
                  </span>
                )}
                {service.deviceType && (
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-md">
                    {service.deviceType}
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-950 tracking-tight leading-tight">
                {service.serviceName}
              </h1>

              <p className="text-sm sm:text-base font-medium text-slate-600 flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                <span>Compatible Hardware: <strong className="text-slate-900 font-semibold">{fullDeviceName}</strong></span>
              </p>
            </div>

            {/* Right: Quotation & Laboratory Fee Box */}
            <div className="bg-slate-950 text-white rounded-2xl p-6 lg:min-w-[300px] border border-slate-800 shadow-md flex flex-col justify-between space-y-4">
              <div className="space-y-1">
                <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                  {service.priceType === 'STARTING_FROM' ? 'Starting Price' : 'Verified Laboratory Fee'}
                </span>
                <div className="text-3xl font-extrabold text-emerald-400 tracking-tight">
                  {priceDisplay}
                </div>
                {service.originalPrice && service.originalPrice > service.price && service.price > 0 && (
                  <div className="flex items-center gap-2 text-xs text-slate-400 pt-0.5">
                    <span className="line-through">NPR {service.originalPrice.toLocaleString('en-US')}</span>
                    <span className="text-amber-400 font-semibold">
                      Save NPR {(service.originalPrice - service.price).toLocaleString('en-US')}
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-800 space-y-2 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Pre- and post-repair diagnostic assessment included</span>
                </div>
                {service.estimatedTime && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Estimated Turnaround: <strong className="text-white">{service.estimatedTime}</strong></span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Laboratory Quality Indicators */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
            <div className="flex items-start gap-3 p-4 bg-slate-50/80 rounded-2xl border border-slate-100">
              <ShieldCheck className="w-5 h-5 text-slate-700 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-slate-900">Functional Testing</div>
                <div className="text-xs text-slate-600 leading-normal">Touch calibration, sensory checks, and current draw testing</div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-slate-50/80 rounded-2xl border border-slate-100">
              <Wrench className="w-5 h-5 text-slate-700 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-slate-900">Precision Equipment</div>
                <div className="text-xs text-slate-600 leading-normal">Cleanroom OCA lamination, micro-soldering, and laser tooling</div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-slate-50/80 rounded-2xl border border-slate-100">
              <MapPin className="w-5 h-5 text-slate-700 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-slate-900">Kathmandu Workshop</div>
                <div className="text-xs text-slate-600 leading-normal">Pakosadak, New Road (Opposite People's Plaza back gate)</div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-3">
            <a
              href={`tel:${BUSINESS_PHONE}`}
              className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl bg-slate-950 hover:bg-slate-800 active:scale-[0.98] text-white font-bold text-sm shadow-sm transition-colors cursor-pointer"
            >
              <PhoneCall className="w-4 h-4 text-emerald-400" />
              <span>Call Hotline ({BUSINESS_PHONE})</span>
            </a>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold text-sm shadow-sm transition-colors cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              <span>WhatsApp Inquiry</span>
            </a>

            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handleShare}
              className="rounded-xl h-12 font-bold text-slate-700 hover:text-slate-900 border-slate-300"
            >
              {copiedLink ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600 mr-2" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4 mr-2 text-slate-500" />
                  <span>Share Quotation</span>
                </>
              )}
            </Button>
          </div>
        </article>

        {/* Section: Hardware Diagnostics & Repair Process */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-8 lg:p-10 space-y-6 shadow-xs">
          <div className="space-y-2">
            <h2 className="text-lg sm:text-xl font-bold text-slate-950 dark:text-white tracking-tight flex items-center gap-2">
              <FileText className="w-5 h-5 text-slate-700 dark:text-slate-300" />
              <span>Hardware Diagnostics &amp; Repair Process</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-3xl">
              Each device is assessed according to the reported fault and observed physical condition. Our technicians inspect the affected component, verify the appropriate repair procedure, and confirm applicable parts and service costs before commencing work.
            </p>
          </div>

          {/* Factual Diagnostic Summary */}
          <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/70 dark:border-slate-700 space-y-1.5">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Service Scope &amp; Assessment</div>
            <p className="text-slate-800 dark:text-slate-200 text-sm sm:text-base leading-relaxed font-normal">
              {directAnswer}
            </p>
            {service.description && (
              <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm pt-2 border-t border-slate-200/60 dark:border-slate-700 leading-relaxed">
                {sanitizeServiceDescription(service, service.description)}
              </p>
            )}
          </div>

          {/* Structured Technical Specifications Grid */}
          <div className="pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">Technical Specifications &amp; Workshop Details</h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3.5 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700 space-y-1">
                <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Repair Category</dt>
                <dd className="text-sm font-semibold text-slate-900 dark:text-white">{service.category || 'Hardware Restoration'}</dd>
              </div>

              <div className="p-3.5 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700 space-y-1">
                <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Device Model</dt>
                <dd className="text-sm font-semibold text-slate-900 dark:text-white">{fullDeviceName}</dd>
              </div>

              <div className="p-3.5 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700 space-y-1">
                <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Service Fee</dt>
                <dd className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{priceDisplay}</dd>
              </div>

              <div className="p-3.5 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700 space-y-1">
                <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Turnaround</dt>
                <dd className="text-sm font-semibold text-slate-900 dark:text-white">{service.estimatedTime || '1–2 Hours (Subject to intake)'}</dd>
              </div>
            </dl>
          </div>
        </section>

        {/* Detailed Service Information & Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            
            {/* Common Symptoms / Problem Solved */}
            {service.problem && (
              <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 space-y-3 shadow-xs">
                <h2 className="text-base sm:text-lg font-bold text-slate-950 dark:text-white flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                  <span>Faults &amp; Symptoms Addressed</span>
                </h2>
                <p className="text-slate-700 dark:text-slate-300 text-sm sm:text-base leading-relaxed">
                  {service.problem}
                </p>
              </section>
            )}

            {/* Verified FAQs */}
            <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 space-y-5 shadow-xs">
              <div className="space-y-1">
                <h2 className="text-base sm:text-lg font-bold text-slate-950 dark:text-white flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                  <span>Frequently Asked Questions</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">{getServiceFaqSubtitle(service)}</p>
              </div>

              <div className="space-y-4 divide-y divide-slate-100 dark:divide-slate-800 pt-1">
                {faqs.map((faq, idx) => (
                  <div key={idx} className={idx > 0 ? 'pt-4 space-y-1.5' : 'space-y-1.5'}>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">{faq.question}</h3>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{faq.answer}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Location & Workshop Hours */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 space-y-4 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                <span>Kathmandu Workshop Location</span>
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {BUSINESS_ADDRESS.streetAddress}, {BUSINESS_ADDRESS.addressLocality}, Nepal.
              </p>
              <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div><strong>Sunday &ndash; Friday:</strong> 10:00 AM &ndash; 7:00 PM</div>
                <div><strong>Saturday:</strong> 10:00 AM &ndash; 6:00 PM</div>
              </div>
              <div className="pt-1">
                <Link
                  to="/contact"
                  className="inline-flex items-center justify-center w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                >
                  View Workshop Map &amp; Directions
                </Link>
              </div>
            </div>

            {/* Online Repair Tracking */}
            <div className="bg-slate-950 text-white rounded-3xl p-6 space-y-3.5 shadow-sm border border-slate-800">
              <h3 className="text-sm font-bold flex items-center gap-2 text-white">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Device Already in Lab?</span>
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Enter your Repair Tracking ID to monitor live hardware inspection notes, parts status, and delivery timeline.
              </p>
              <Link
                to="/track"
                className="inline-flex items-center justify-center w-full h-10 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
              >
                Track Repair Status
              </Link>
            </div>
          </div>
        </div>

        {/* Related Services */}
        {relatedServices.length > 0 && (
          <section className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-bold text-slate-950 dark:text-white">Related Repairs for {service.brand}</h2>
              <Link to="/services" className="text-xs font-bold text-slate-700 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white transition-colors">
                View All Services &rarr;
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {relatedServices.map((rel) => {
                const relSlug = serviceIdToSlug.get(rel.id);
                return (
                  <Link
                    key={rel.id}
                    to={relSlug ? `/services/${relSlug}` : '/services'}
                    className="block p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-xs transition-all group"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                        <span>{rel.brand}</span>
                        <span>{rel.category}</span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
                        {rel.serviceName}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">{rel.model}</p>
                      <div className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400 pt-2">
                        {formatNprPrice(rel.price, rel.priceType)}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
