import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { 
  MapPin, 
  PhoneCall, 
  Phone,
  Mail, 
  Clock, 
  ExternalLink, 
  Compass, 
  HelpCircle, 
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Send,
  Loader2,
  ArrowRight,
  Smartphone,
  Navigation,
  MessageCircle,
  History
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';

export default function Contact() {
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    subject: 'Screen & Glass Refurbishing',
    message: ''
  });

  const [honeypot, setHoneypot] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submittedInquiry, setSubmittedInquiry] = useState<{
    name: string;
    phone: string;
    email?: string;
    subject?: string;
    message: string;
  } | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  // Copy feedback states
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);

  // Generates official WhatsApp wa.me link with encoded inquiry
  const getWhatsAppUrl = useCallback((data: { name: string; phone: string; email?: string; subject?: string; message: string }) => {
    const lines = [
      'Hello MTS Lab,',
      '',
      'I have a new inquiry.',
      '',
      `Name: ${data.name.trim() || 'Customer'}`,
      `Phone: ${data.phone.trim() || 'Not specified'}`,
      `Email: ${data.email?.trim() || 'Not provided'}`,
      `Subject: ${data.subject?.trim() || 'General Inquiry'}`,
      '',
      'Message:',
      data.message.trim() || 'I would like to make an inquiry regarding device repairs.',
      '',
      'Thank you.'
    ];
    const text = lines.join('\n');
    return `https://wa.me/9779869276668?text=${encodeURIComponent(text)}`;
  }, []);

  // Live status in Nepal Time (UTC+5:45)
  const isLabCurrentlyOpen = (() => {
    try {
      const now = new Date();
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      const nepalTime = new Date(utc + (5.75 * 3600000));
      const day = nepalTime.getDay(); // 0 = Sunday, 6 = Saturday
      const hour = nepalTime.getHours();
      const minute = nepalTime.getMinutes();
      const timeInMinutes = hour * 60 + minute;

      if (day >= 0 && day <= 5) {
        // Sunday - Friday: 10:30 AM (630 mins) to 7:30 PM (1170 mins)
        return timeInMinutes >= 630 && timeInMinutes <= 1170;
      } else if (day === 6) {
        // Saturday: 2:00 PM (840 mins) to 5:30 PM (1050 mins)
        return timeInMinutes >= 840 && timeInMinutes <= 1050;
      }
      return false;
    } catch {
      return true;
    }
  })();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors(prev => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
    if (serverError) setServerError(null);
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim() || formData.name.trim().length < 2) {
      errors.name = 'Please provide your name (at least 2 characters).';
    }

    const cleanPhone = formData.phone.trim().replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 7 || cleanPhone.length > 15) {
      errors.phone = 'Please provide a valid contact number (e.g. 98XXXXXXXX or 01XXXXXXX).';
    }

    if (formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        errors.email = 'Please provide a valid email format or leave this blank.';
      }
    }

    if (!formData.message.trim() || formData.message.trim().length < 10) {
      errors.message = 'Please provide a message with at least 10 characters describing your inquiry.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!validateForm()) return;

    setIsSubmitting(true);
    setServerError(null);

    const submissionPayload = {
      name: formData.name.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim(),
      subject: formData.subject,
      message: formData.message.trim(),
      website: honeypot
    };

    try {
      const response = await fetch('/api/public/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submissionPayload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "We couldn't submit your inquiry right now. Please try again or contact us directly.");
      }

      setSubmittedInquiry({
        name: submissionPayload.name,
        phone: submissionPayload.phone,
        email: submissionPayload.email,
        subject: submissionPayload.subject,
        message: submissionPayload.message
      });
      setSubmitSuccess(true);
      setFormData({
        name: '',
        phone: '',
        email: '',
        subject: 'Screen & Glass Refurbishing',
        message: ''
      });
      setHoneypot('');
    } catch (err: any) {
      setServerError(err?.message || "We couldn't submit your inquiry right now. Please try again or contact us directly.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyEmail = useCallback(() => {
    navigator.clipboard.writeText('support@mobiletechnologystation.com.np').then(() => {
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2200);
    }).catch(() => {
      // Fallback
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2200);
    });
  }, []);

  const handleCopyPhone = useCallback(() => {
    navigator.clipboard.writeText('+9779869276668').then(() => {
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2200);
    }).catch(() => {
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2200);
    });
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800 antialiased overflow-x-hidden selection:bg-slate-900 selection:text-white">
      <Navbar />

      {/* Header & Introduction */}
      <header className="pt-24 sm:pt-28 md:pt-32 pb-12 sm:pb-16 bg-slate-900 text-white border-b border-slate-800 relative">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-4">
            {/* Breadcrumb / Category Status Tag */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs font-medium text-slate-300">
              <span className={`h-2 w-2 rounded-full shrink-0 ${isLabCurrentlyOpen ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span>{isLabCurrentlyOpen ? 'Reception Desk Open' : 'Reception Closed (Opens 10:30 AM)'}</span>
              <span className="text-slate-500 font-normal">|</span>
              <span className="text-slate-400">Kathmandu Central Lab</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white">
              Contact MTS Lab
            </h1>

            <p className="text-slate-300 text-sm sm:text-base md:text-lg leading-relaxed max-w-2xl">
              Connect directly with certified hardware diagnostics, screen refurbishment engineers, and reception staff at our New Road, Kathmandu facility.
            </p>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10 sm:space-y-12 flex-1">
        
        {/* 1. Essential Contact Channels Grid */}
        <section aria-labelledby="contact-essentials-heading">
          <h2 id="contact-essentials-heading" className="sr-only">Contact Information Channels</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            
            {/* Card 1: Phone Hotlines */}
            <div className="w-full min-w-0 bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-3 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                    <PhoneCall className="h-5 w-5 shrink-0" />
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyPhone}
                    aria-label="Copy mobile number"
                    className="text-xs text-slate-400 hover:text-slate-700 font-medium inline-flex items-center gap-1 py-1 px-2 rounded-md hover:bg-slate-100 transition-colors"
                  >
                    {copiedPhone ? <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" /> : <Copy className="h-3.5 w-3.5 shrink-0" />}
                    <span>{copiedPhone ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                <div className="min-w-0">
                  <h3 className="text-base font-bold text-slate-900">Phone Hotlines</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Direct reception & technician desk</p>
                </div>

                <div className="space-y-2 pt-1 min-w-0">
                  <a 
                    href="tel:+9779869276668" 
                    className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-slate-100 bg-slate-50/70 hover:bg-emerald-50/50 hover:border-emerald-200 text-slate-900 transition-colors group min-w-0"
                  >
                    <div className="min-w-0">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Mobile Hotline</span>
                      <span className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors block truncate">
                        +977 9869276668
                      </span>
                    </div>
                    <Phone className="h-4 w-4 text-slate-400 group-hover:text-emerald-600 shrink-0" />
                  </a>

                  <a 
                    href="tel:015364307" 
                    className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-slate-100 bg-slate-50/70 hover:bg-emerald-50/50 hover:border-emerald-200 text-slate-900 transition-colors group min-w-0"
                  >
                    <div className="min-w-0">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Kathmandu Landline</span>
                      <span className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors block truncate">
                        01-5364307
                      </span>
                    </div>
                    <Phone className="h-4 w-4 text-slate-400 group-hover:text-emerald-600 shrink-0" />
                  </a>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                Tap to call instantly during hours
              </div>
            </div>

            {/* Card 2: Support Email */}
            <div className="w-full min-w-0 bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-3 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
                    <Mail className="h-5 w-5 shrink-0" />
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyEmail}
                    aria-label="Copy support email address"
                    className="text-xs text-slate-400 hover:text-slate-700 font-medium inline-flex items-center gap-1 py-1 px-2 rounded-md hover:bg-slate-100 transition-colors"
                  >
                    {copiedEmail ? <Check className="h-3.5 w-3.5 text-indigo-600 shrink-0" /> : <Copy className="h-3.5 w-3.5 shrink-0" />}
                    <span>{copiedEmail ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                <div className="min-w-0">
                  <h3 className="text-base font-bold text-slate-900">Email Inquiries</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Written estimates & quotations</p>
                </div>

                <div className="pt-1 min-w-0">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Support Desk</span>
                  <a 
                    href="mailto:support@mobiletechnologystation.com.np"
                    className="text-xs sm:text-sm font-semibold text-indigo-600 hover:text-indigo-800 hover:underline break-all block leading-snug"
                  >
                    support@mobiletechnologystation.com.np
                  </a>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                Response within 24 business hours
              </div>
            </div>

            {/* Card 3: Location Address */}
            <div className="w-full min-w-0 bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-3 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="h-10 w-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
                    <MapPin className="h-5 w-5 shrink-0" />
                  </div>
                  <a
                    href="https://maps.app.goo.gl/baP5yg6qgcgBT7neA"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-rose-600 hover:text-rose-800 font-semibold inline-flex items-center gap-1 hover:underline"
                  >
                    <span>Maps</span>
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                </div>

                <div className="min-w-0">
                  <h3 className="text-base font-bold text-slate-900">Physical Lab</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Central service & diagnostic facility</p>
                </div>

                <div className="pt-1 text-xs sm:text-sm text-slate-700 font-medium leading-relaxed min-w-0">
                  <p className="font-semibold text-slate-900">Pakosadak, Newroad</p>
                  <p className="text-slate-600">Kathmandu, Nepal</p>
                  <p className="text-slate-500 text-xs mt-1.5 flex items-center gap-1">
                    <Compass className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                    <span>Opposite People's Plaza back gate</span>
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                Walk-ins welcomed without prior booking
              </div>
            </div>

            {/* Card 4: Operating Hours */}
            <div className="w-full min-w-0 bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-3 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
                    <Clock className="h-5 w-5 shrink-0" />
                  </div>
                  <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                    Nepal Time
                  </span>
                </div>

                <div className="min-w-0">
                  <h3 className="text-base font-bold text-slate-900">Operating Hours</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Laboratory schedule</p>
                </div>

                <div className="space-y-2 pt-1 text-xs min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-slate-700">Sun – Fri:</span>
                    <span className="text-slate-900 font-bold text-right">10:30 AM – 7:30 PM</span>
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-slate-700">Saturday:</span>
                    <span className="text-slate-900 font-bold text-right">2:00 PM – 5:30 PM</span>
                  </div>
                  <p className="text-[11px] text-slate-400 pt-0.5">
                    Saturday: Emergency repair intake & scheduled deliveries
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                Public holiday adjustments announced on Facebook
              </div>
            </div>

          </div>
        </section>

        {/* 2. Interactive Area: Get in Touch Form + Support Information */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Contact Form (7 cols) */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-8 shadow-xs min-w-0">
            <div className="space-y-2 mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Send an Inquiry
              </h2>
              <p className="text-slate-500 text-xs sm:text-sm leading-relaxed">
                Have a hardware issue, screen damage, or inquiry about repairs? Leave your message and our reception team will get in touch with you.
              </p>
            </div>

            {submitSuccess && submittedInquiry ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 sm:p-7 space-y-5 animate-in fade-in-50 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-start gap-3.5 text-left">
                  <div className="h-11 w-11 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-6 w-6 shrink-0" />
                  </div>
                  <div className="space-y-1 min-w-0">
                    <h3 className="text-base sm:text-lg font-bold text-emerald-950">
                      Inquiry Submitted Successfully
                    </h3>
                    <p className="text-xs sm:text-sm text-emerald-800 leading-relaxed">
                      Your inquiry has been submitted successfully. Our support team will get back to you at <span className="font-semibold">{submittedInquiry.phone}</span> or via email.
                    </p>
                  </div>
                </div>

                {/* Submitted Inquiry Summary Box */}
                <div className="bg-white/95 border border-emerald-200/80 rounded-xl p-4 text-xs sm:text-sm space-y-2.5 min-w-0 shadow-2xs">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Inquiry Summary
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700">
                    <div>
                      <span className="text-slate-500 font-medium">Customer: </span>
                      <span className="font-semibold text-slate-900">{submittedInquiry.name}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">Phone: </span>
                      <span className="font-semibold text-slate-900">{submittedInquiry.phone}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">Subject: </span>
                      <span className="font-semibold text-slate-900">{submittedInquiry.subject || 'General Inquiry'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">Email: </span>
                      <span className="font-semibold text-slate-900">{submittedInquiry.email || 'Not provided'}</span>
                    </div>
                  </div>
                  <div className="pt-1 text-[11px] text-slate-400 border-t border-slate-100">
                    Dispatched to: <span className="font-medium text-slate-600">support@mobiletechnologystation.com.np</span>
                  </div>
                </div>

                {/* Send via WhatsApp Action Box */}
                <div className="p-4 rounded-xl bg-white border border-emerald-200 space-y-3 shadow-2xs">
                  <div className="space-y-0.5">
                    <div className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <MessageCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>Send this inquiry via WhatsApp</span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-slate-500 leading-relaxed">
                      Want an immediate response? Connect directly with our technician desk on WhatsApp (+977 9869276668) with your message pre-filled.
                    </p>
                  </div>
                  <a
                    href={getWhatsAppUrl(submittedInquiry)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Send this inquiry to MTS Lab via WhatsApp"
                    className="inline-flex items-center justify-center gap-2 w-full px-5 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-xs sm:text-sm transition-colors shadow-xs cursor-pointer"
                  >
                    <MessageCircle className="h-4 w-4 shrink-0" />
                    <span>Send via WhatsApp (+977 9869276668)</span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-80" />
                  </a>
                </div>

                {/* Secondary Actions */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSubmitSuccess(false);
                      setSubmittedInquiry(null);
                    }}
                    className="border-emerald-300 text-emerald-900 hover:bg-emerald-100 text-xs sm:text-sm h-10 px-4"
                  >
                    Send Another Message
                  </Button>
                  <a
                    href="tel:+9779869276668"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-medium transition-colors"
                  >
                    <Phone className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                    <span>Call Hotline Directly</span>
                  </a>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="space-y-4 sm:space-y-5">
                {/* Honeypot field for bot protection */}
                <div className="hidden" aria-hidden="true">
                  <label htmlFor="website-trap">Leave this empty</label>
                  <input
                    id="website-trap"
                    type="text"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={honeypot}
                    onChange={e => setHoneypot(e.target.value)}
                  />
                </div>

                {serverError && (
                  <div className="p-3.5 sm:p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs sm:text-sm space-y-2.5">
                    <div className="flex items-start gap-2.5">
                      <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                      <span className="min-w-0 font-medium leading-relaxed">{serverError}</span>
                    </div>
                    <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-rose-200/70">
                      <span className="text-[11px] text-rose-700">Need immediate help? Reach us directly on WhatsApp:</span>
                      <a
                        href={getWhatsAppUrl(formData)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shrink-0 cursor-pointer"
                      >
                        <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                        <span>Send on WhatsApp</span>
                      </a>
                    </div>
                  </div>
                )}

                {/* Name & Phone in 2 cols on tablet/desktop */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  {/* Name */}
                  <div className="space-y-1.5 min-w-0">
                    <label htmlFor="contact-name" className="block text-xs font-semibold text-slate-700">
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="contact-name"
                      name="name"
                      type="text"
                      required
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="e.g. Aashish Sharma"
                      className={`w-full text-sm px-3.5 py-2.5 rounded-lg border bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all ${
                        formErrors.name 
                          ? 'border-rose-300 focus:ring-rose-200 focus:border-rose-500' 
                          : 'border-slate-300 focus:ring-slate-900/15 focus:border-slate-900'
                      }`}
                    />
                    {formErrors.name && (
                      <p className="text-xs text-rose-600 font-medium">{formErrors.name}</p>
                    )}
                  </div>

                  {/* Phone */}
                  <div className="space-y-1.5 min-w-0">
                    <label htmlFor="contact-phone" className="block text-xs font-semibold text-slate-700">
                      Phone Number <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="contact-phone"
                      name="phone"
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={handleInputChange}
                      placeholder="e.g. 98XXXXXXXX"
                      className={`w-full text-sm px-3.5 py-2.5 rounded-lg border bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all ${
                        formErrors.phone 
                          ? 'border-rose-300 focus:ring-rose-200 focus:border-rose-500' 
                          : 'border-slate-300 focus:ring-slate-900/15 focus:border-slate-900'
                      }`}
                    />
                    {formErrors.phone && (
                      <p className="text-xs text-rose-600 font-medium">{formErrors.phone}</p>
                    )}
                  </div>

                </div>

                {/* Email & Inquiry Department in 2 cols */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  {/* Email */}
                  <div className="space-y-1.5 min-w-0">
                    <label htmlFor="contact-email" className="block text-xs font-semibold text-slate-700">
                      Email Address <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      id="contact-email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="name@example.com"
                      className={`w-full text-sm px-3.5 py-2.5 rounded-lg border bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all ${
                        formErrors.email 
                          ? 'border-rose-300 focus:ring-rose-200 focus:border-rose-500' 
                          : 'border-slate-300 focus:ring-slate-900/15 focus:border-slate-900'
                      }`}
                    />
                    {formErrors.email && (
                      <p className="text-xs text-rose-600 font-medium">{formErrors.email}</p>
                    )}
                  </div>

                  {/* Subject Dropdown */}
                  <div className="space-y-1.5 min-w-0">
                    <label htmlFor="contact-subject" className="block text-xs font-semibold text-slate-700">
                      Inquiry Category
                    </label>
                    <select
                      id="contact-subject"
                      name="subject"
                      value={formData.subject}
                      onChange={handleInputChange}
                      className="w-full text-sm px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900 transition-all cursor-pointer"
                    >
                      <option value="Screen & Glass Refurbishing">Screen & Glass Refurbishing</option>
                      <option value="Motherboard & Micro-Soldering">Motherboard & Micro-Soldering</option>
                      <option value="Battery Replacement & Warranty">Battery Replacement & Warranty</option>
                      <option value="Courier / Outstation Drop-off">Courier / Outstation Drop-off</option>
                      <option value="Wholesale / B2B Technical Support">Wholesale / B2B Technical Support</option>
                      <option value="General Question">General Question</option>
                    </select>
                  </div>

                </div>

                {/* Message */}
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor="contact-message" className="block text-xs font-semibold text-slate-700">
                      Inquiry Details <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[11px] text-slate-400">
                      {formData.message.length}/2000
                    </span>
                  </div>
                  <textarea
                    id="contact-message"
                    name="message"
                    required
                    rows={4}
                    maxLength={2000}
                    value={formData.message}
                    onChange={handleInputChange}
                    placeholder="Describe your device brand, model, and the issue you are experiencing (e.g. Samsung S23 display flickering after fall)..."
                    className={`w-full text-sm p-3.5 rounded-lg border bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all resize-y min-h-[100px] ${
                      formErrors.message 
                        ? 'border-rose-300 focus:ring-rose-200 focus:border-rose-500' 
                        : 'border-slate-300 focus:ring-slate-900/15 focus:border-slate-900'
                    }`}
                  />
                  {formErrors.message && (
                    <p className="text-xs text-rose-600 font-medium">{formErrors.message}</p>
                  )}
                </div>

                {/* Submit Action */}
                <div className="pt-2 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full sm:flex-1 h-11 px-6 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm transition-all shadow-xs inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                          <span>Sending inquiry...</span>
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 shrink-0" />
                          <span>Submit Inquiry</span>
                        </>
                      )}
                    </Button>

                    <a
                      href={getWhatsAppUrl(formData)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Send inquiry directly via WhatsApp"
                      className="w-full sm:w-auto h-11 px-4 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold text-xs sm:text-sm transition-colors inline-flex items-center justify-center gap-2 cursor-pointer shrink-0"
                    >
                      <MessageCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>Send via WhatsApp</span>
                      <ExternalLink className="h-3 w-3 opacity-70 shrink-0" />
                    </a>
                  </div>

                  <p className="text-[11px] text-slate-400 text-center sm:text-left">
                    Your inquiry will be sent to <span className="font-medium text-slate-600">support@mobiletechnologystation.com.np</span> and logged with our reception team.
                  </p>
                </div>

              </form>
            )}
          </div>

          {/* Right Column: Quick Guidance & Direct Actions (5 cols) */}
          <div className="lg:col-span-5 space-y-5 min-w-0">
            
            {/* Quick Self-Service Card */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-4 min-w-0">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <History className="h-4 w-4 text-indigo-600 shrink-0" />
                <span>Looking for Your Repair Ticket?</span>
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                If your device is currently admitted at MTS Lab, you can track its live stage, diagnostic logs, and technical notes instantly using your repair number or phone.
              </p>
              <Link
                to="/track"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs sm:text-sm transition-colors border border-indigo-200"
              >
                <span>Open Public Repair Tracker</span>
                <ArrowRight className="h-4 w-4 shrink-0" />
              </Link>
            </div>

            {/* Direct Messenger Support Card */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-4 min-w-0">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-blue-600 shrink-0" />
                <span>Instant Messaging</span>
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Prefer chatting on social channels? Send photos or short videos of your damaged screen directly to our official Facebook page for quick preliminary quotes.
              </p>
              <a
                href="https://www.facebook.com/MTSmobilescreenrefurblab"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-xs sm:text-sm transition-colors border border-blue-200"
              >
                <span>Message on Facebook</span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              </a>
            </div>

            {/* Logistics for Customers Outside Valley */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-3 min-w-0">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                <h4 className="text-sm font-bold text-slate-900">Courier Intake from All 7 Provinces</h4>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Clients outside the Kathmandu Valley can safely dispatch phones through reputable couriers (Sundar, Pathao, Nepal Post). Include your full name, phone number, and lock passcode inside the parcel.
              </p>
              <p className="text-[11px] text-slate-500 font-medium">
                Parcel destination: MTS Lab Reception, Pakosadak, Newroad, Kathmandu.
              </p>
            </div>

          </div>

        </section>

        {/* 3. Location, Directions & Responsive Map Section */}
        <section aria-labelledby="location-heading" className="w-full min-w-0 bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-7 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5 min-w-0">
            <div className="space-y-1 min-w-0">
              <h2 id="location-heading" className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <MapPin className="h-5 w-5 text-rose-500 shrink-0" />
                <span>Visit Our Central Laboratory</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-500">
                Pakosadak, Newroad, Kathmandu, Nepal &bull; Opposite People's Plaza back gate
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <a
                href="https://maps.app.goo.gl/baP5yg6qgcgBT7neA"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold transition-colors shadow-xs"
              >
                <Navigation className="h-3.5 w-3.5 shrink-0" />
                <span>Open Google Maps</span>
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
              <a
                href="tel:+9779869276668"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold transition-colors"
              >
                <Phone className="h-3.5 w-3.5 shrink-0" />
                <span>Call Hotline</span>
              </a>
            </div>
          </div>

          {/* Embedded Responsive Map */}
          <div className="w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-100 relative min-w-0">
            <div className="w-full h-72 sm:h-80 md:h-96 relative">
              <iframe
                title="MTS Lab Location Map - Pakosadak, Newroad, Kathmandu"
                src="https://www.openstreetmap.org/export/embed.html?bbox=85.3080%2C27.7010%2C85.3160%2C27.7060&layer=mapnik&marker=27.7035%2C85.3118"
                className="w-full h-full border-0"
                loading="lazy"
              />
            </div>
          </div>

          {/* Practical Transit & Navigation Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1 text-xs text-slate-600">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1 min-w-0">
              <span className="font-bold text-slate-900 block">Walking Proximity</span>
              <p className="text-slate-600">50 meters inside Pakosadak directly from the New Road gate entrance.</p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1 min-w-0">
              <span className="font-bold text-slate-900 block">Vehicle Parking</span>
              <p className="text-slate-600">Public two-wheeler & car parking available at Khulla Manch and New Road square.</p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1 min-w-0">
              <span className="font-bold text-slate-900 block">Identifiable Landmark</span>
              <p className="text-slate-600">Directly on the opposite side of People's Plaza rear exit in Pakosadak.</p>
            </div>
          </div>
        </section>

        {/* 4. Frequently Asked Questions */}
        <section aria-labelledby="faq-heading" className="space-y-4">
          <div className="space-y-1">
            <h2 id="faq-heading" className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              Frequently Asked Questions
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Common questions regarding our repair reception, parts quality, and turnaround timelines.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs space-y-2 min-w-0">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-indigo-600 shrink-0" />
                <h3 className="text-sm font-bold text-slate-900">Are walk-in diagnostics free at Pakosadak?</h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Yes. Our technician team conducts an initial 15-minute diagnostic assessment free of charge. You will receive an exact quote and turnaround estimation prior to repair commencement.
              </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs space-y-2 min-w-0">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                <h3 className="text-sm font-bold text-slate-900">How long does screen refurbishment or glass repair take?</h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Most OLED/AMOLED outer glass replacements and polariser laminations are completed within 2 to 4 hours on the same business day using clean-room OCA machines.
              </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs space-y-2 min-w-0">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-rose-600 shrink-0" />
                <h3 className="text-sm font-bold text-slate-900">Can I send my device via courier from outside Kathmandu?</h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Absolutely. We accept phones sent by courier from outside Kathmandu through Nepal Can Move (NCM), Pathao Parcel, and local cargo services. We regularly receive devices from Pokhara, Butwal, Biratnagar, Chitwan, and other parts of Nepal.
              </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs space-y-2 min-w-0">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-amber-600 shrink-0" />
                <h3 className="text-sm font-bold text-slate-900">What warranty is provided on replaced batteries and displays?</h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Batteries carry our verifiable 6-month or 1-year battery warranty card with serial registration. Restored original displays are verified through a 24-point hardware check before handover.
              </p>
            </div>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
