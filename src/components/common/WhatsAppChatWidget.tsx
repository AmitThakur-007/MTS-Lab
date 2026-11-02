import React, { useState, useRef, useEffect, useId } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, MessageSquare, Sparkles, AlertCircle, ArrowUpRight, Check, Phone } from 'lucide-react';
import BrandLogo from '@/components/BrandLogo';
import { useAppTheme } from '@/context/ThemeContext';
import { getMtsLabOpenStatus, OPERATING_HOURS } from '@/lib/businessHours';

export const MTS_WHATSAPP_PHONE = '9779869276668';
export const MTS_WHATSAPP_DISPLAY = '+977 9869276668';
export const MTS_WHATSAPP_BASE_URL = `https://wa.me/${MTS_WHATSAPP_PHONE}`;

export const WELCOME_MESSAGE =
  'Namaste! Welcome to MTS LAB. Need help with your smartphone repair? Send us a message and our team will assist you.';

export interface QuickInquiry {
  id: string;
  label: string;
  template: string;
}

export const QUICK_INQUIRIES: QuickInquiry[] = [
  {
    id: 'iphone',
    label: 'iPhone Repair',
    template: 'Namaste MTS LAB, I need help with iPhone repair. Please provide details.',
  },
  {
    id: 'samsung',
    label: 'Samsung Repair',
    template: 'Namaste MTS LAB, I need help with Samsung smartphone repair. Please provide details.',
  },
  {
    id: 'display',
    label: 'Display Replacement',
    template: 'Namaste MTS LAB, I need a display replacement. Please share the available options and price.',
  },
  {
    id: 'battery',
    label: 'Battery Replacement',
    template: 'Namaste MTS LAB, I need a smartphone battery replacement. Please provide details.',
  },
  {
    id: 'back-panel',
    label: 'Back Panel Replacement',
    template: 'Namaste MTS LAB, I need a back panel replacement. Please provide details.',
  },
  {
    id: 'repair-status',
    label: 'Repair Status',
    template: 'Namaste MTS LAB, I would like to check my repair status. My repair number is: ',
  },
  {
    id: 'other',
    label: 'Other Inquiry',
    template: 'Namaste MTS LAB, I have an inquiry: ',
  },
];

export const MAX_MESSAGE_LENGTH = 500;

export default function WhatsAppChatWidget() {
  const location = useLocation();
  const { effectiveTheme } = useAppTheme();
  const isDarkMode = effectiveTheme === 'dark' || effectiveTheme === 'night' || effectiveTheme === 'tihar';

  // State
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedInquiryId, setSelectedInquiryId] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [hasUnreadNotice, setHasUnreadNotice] = useState(true);

  // Genuine operating status from businessHours schedule
  const [openStatus, setOpenStatus] = useState(getMtsLabOpenStatus());

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const errorId = useId();

  // Periodically refresh open status every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setOpenStatus(getMtsLabOpenStatus());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Keyboard navigation: Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Focus textarea when panel opens
  useEffect(() => {
    if (isOpen) {
      setHasUnreadNotice(false);
      // Small timeout to allow transition to mount
      const timeout = setTimeout(() => {
        textareaRef.current?.focus();
      }, 150);
      return () => clearTimeout(timeout);
    }
  }, [isOpen]);

  // Exclude widget strictly from dashboard routes
  if (location.pathname.startsWith('/dashboard')) {
    return null;
  }

  // Handle selecting a predefined quick inquiry option
  const handleSelectInquiry = (inquiry: QuickInquiry) => {
    setSelectedInquiryId(inquiry.id);
    setMessage(inquiry.template);
    if (validationError) setValidationError(null);

    // Focus textarea and move cursor to end
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // Handle text input changes
  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    if (newText.length <= MAX_MESSAGE_LENGTH) {
      setMessage(newText);
      if (validationError) setValidationError(null);
    }
  };

  // Validate and dispatch WhatsApp Click-to-Chat
  const handleSendToWhatsApp = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const cleanMessage = message.trim();

    if (!cleanMessage) {
      setValidationError('Please type your message or select an inquiry option above.');
      textareaRef.current?.focus();
      return;
    }

    setValidationError(null);

    // Construct WhatsApp Click-to-Chat URL
    const whatsappUrl = `${MTS_WHATSAPP_BASE_URL}?text=${encodeURIComponent(cleanMessage)}`;

    // Open WhatsApp in a new tab/window
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      {/* =========================================================================
          1. FLOATING TRIGGER BUTTON (Fixed bottom-right)
          Smoothly hidden/scaled down when the panel is open to prevent overlapping
         ========================================================================= */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 16 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="fixed z-50 bottom-4 right-4 sm:bottom-6 sm:right-6 pointer-events-auto"
            style={{
              bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
            }}
          >
            <div className="relative group">
              {/* Optional Subtle Floating Tooltip on Desktop */}
              <div
                role="tooltip"
                className="hidden sm:block absolute right-full top-1/2 -translate-y-1/2 mr-3 px-3 py-1.5 rounded-xl bg-slate-900/95 dark:bg-slate-950/95 text-white text-xs font-semibold tracking-wide whitespace-nowrap shadow-xl border border-slate-700/80 pointer-events-none opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-all duration-200 transform translate-x-1 group-hover:translate-x-0"
              >
                <span>Chat with MTS LAB</span>
                {/* Tooltip arrow */}
                <div className="absolute left-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-slate-900 dark:border-l-slate-950" />
              </div>

              {/* Unread Ping Badge */}
              {hasUnreadNotice && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 z-10" aria-label="1 unread message">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 text-[10px] font-black text-white items-center justify-center shadow-xs">
                    1
                  </span>
                </span>
              )}

              {/* Main Circular WhatsApp Trigger */}
              <button
                ref={triggerRef}
                type="button"
                onClick={() => setIsOpen(true)}
                aria-label="Open MTS LAB WhatsApp chat support"
                aria-haspopup="dialog"
                aria-expanded={isOpen}
                aria-controls="mts-whatsapp-chat-panel"
                className="w-14 h-14 sm:w-15 sm:h-15 rounded-full bg-[#25D366] hover:bg-[#20ba59] active:scale-95 text-white flex items-center justify-center shadow-lg shadow-emerald-600/35 hover:shadow-xl hover:shadow-emerald-600/45 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 transition-all duration-200 cursor-pointer"
              >
                {/* Official WhatsApp Vector Icon */}
                <svg
                  className="w-7 h-7 sm:w-8 sm:h-8 fill-current drop-shadow-xs"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                </svg>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          2. EXPANDED WHATSAPP LIVE CHAT PANEL
          Responsive clamped dimensions, flex-column, internal scroll only
         ========================================================================= */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="mts-whatsapp-chat-panel"
            ref={panelRef}
            role="dialog"
            aria-modal="false"
            aria-label="MTS LAB WhatsApp Chat Support"
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className={`fixed z-50 flex flex-col min-h-0 overflow-hidden shadow-2xl transition-colors
              /* Desktop & Laptop Targets */
              sm:right-6 sm:bottom-6 sm:w-[380px] sm:max-w-[calc(100vw-48px)] sm:max-h-[min(620px,calc(100dvh-40px))] sm:rounded-3xl
              /* Mobile Targets (respects safe areas, never clips) */
              right-3 bottom-3 w-[min(380px,calc(100vw-24px))] max-h-[min(560px,calc(100dvh-80px))] rounded-2xl
              /* Colors & Border */
              bg-white/98 dark:bg-[#0c1322]/98 text-slate-900 dark:text-slate-100 border border-slate-200/90 dark:border-slate-800 backdrop-blur-xl
            `}
            style={{
              bottom: 'calc(14px + env(safe-area-inset-bottom, 0px))',
              right: 'max(12px, env(safe-area-inset-right, 12px))',
            }}
          >
            {/* -------------------------------------------------------------------
                SECTION A: COMPACT HEADER (Flex-none, always pinned)
               ------------------------------------------------------------------- */}
            <div className="flex-none bg-slate-950 text-white px-4 py-3 sm:px-4.5 sm:py-3.5 border-b border-slate-800 relative select-none">
              <div className="flex items-center justify-between gap-2.5">
                {/* Brand & Title */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative shrink-0">
                    <BrandLogo
                      variant="icon"
                      size="sm"
                      theme="dark"
                      imgClassName="w-8 h-8 rounded-xl ring-1 ring-cyan-500/30"
                    />
                    {/* Official WhatsApp Mini Indicator */}
                    <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#25D366] ring-2 ring-slate-950 flex items-center justify-center">
                      <svg className="w-2.5 h-2.5 fill-white" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                      </svg>
                    </span>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-sm tracking-tight text-white truncate">
                        Welcome to MTS LAB!
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 dark:text-slate-400 truncate">
                      How can we help you today?
                    </p>
                  </div>
                </div>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    triggerRef.current?.focus();
                  }}
                  aria-label="Close WhatsApp chat"
                  className="w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 active:scale-95 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 shrink-0 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Genuine Live Business Hours Status Bar */}
              <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      openStatus.isOpen
                        ? 'bg-emerald-400 animate-pulse'
                        : openStatus.isSaturday
                        ? 'bg-amber-400'
                        : 'bg-slate-400'
                    }`}
                  />
                  <span className="font-semibold text-slate-300 truncate">
                    {openStatus.isOpen ? 'Technician Desk Online' : openStatus.statusLabel}
                  </span>
                  <span className="text-slate-500 hidden xs:inline">•</span>
                  <span className="text-slate-400 truncate hidden xs:inline">{OPERATING_HOURS.regularDays}</span>
                </div>

                <span className="text-cyan-400/90 font-mono text-[9.5px] shrink-0 font-medium ml-1">
                  New Road, KTM
                </span>
              </div>
            </div>

            {/* -------------------------------------------------------------------
                SECTION B: SCROLLABLE CHAT BODY (Flex-1, min-h-0, internal scroll)
               ------------------------------------------------------------------- */}
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3.5 overscroll-contain">
              {/* Welcome Message Speech Bubble */}
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <MessageSquare className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 bg-slate-100 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl rounded-tl-xs p-3 text-xs leading-relaxed text-slate-800 dark:text-slate-200 shadow-2xs">
                  <p className="font-medium text-[12px]">{WELCOME_MESSAGE}</p>
                  <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                    <span>MTS Support Desk</span>
                    <span>Direct WhatsApp</span>
                  </div>
                </div>
              </div>

              {/* Quick Inquiry Options */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-400 px-0.5">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                    <span>Quick Inquiries (click to edit):</span>
                  </span>
                </div>

                {/* Wrap pill buttons, compact touch-friendly targets */}
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_INQUIRIES.map((inquiry) => {
                    const isSelected = selectedInquiryId === inquiry.id;
                    return (
                      <button
                        key={inquiry.id}
                        type="button"
                        onClick={() => handleSelectInquiry(inquiry)}
                        className={`text-[11px] font-medium px-2.5 py-1.5 rounded-lg border transition-all duration-150 text-left active:scale-95 cursor-pointer flex items-center gap-1 ${
                          isSelected
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-800 dark:text-emerald-200 ring-1 ring-emerald-500/30 font-semibold'
                            : 'bg-slate-100/90 hover:bg-slate-200/80 dark:bg-slate-800/80 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                        <span>{inquiry.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Editable Textarea Input Area */}
              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 dark:text-slate-300 px-0.5">
                  <label htmlFor="mts-whatsapp-message-input">Your Custom Message:</label>
                  <span
                    className={`font-mono text-[10px] ${
                      message.length >= MAX_MESSAGE_LENGTH ? 'text-rose-500 font-bold' : 'text-slate-500'
                    }`}
                  >
                    {message.length} / {MAX_MESSAGE_LENGTH}
                  </span>
                </div>

                <div className="relative">
                  <textarea
                    id="mts-whatsapp-message-input"
                    ref={textareaRef}
                    rows={3}
                    value={message}
                    onChange={handleMessageChange}
                    placeholder="Type your repair inquiry, phone model, or defect details..."
                    aria-invalid={!!validationError}
                    aria-describedby={validationError ? errorId : undefined}
                    className={`w-full min-h-[72px] max-h-[130px] rounded-xl px-3 py-2 text-xs font-medium leading-relaxed resize-none transition-all duration-150 outline-none ${
                      validationError
                        ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20 dark:bg-rose-950/20 text-slate-900 dark:text-slate-100'
                        : 'border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20'
                    }`}
                  />
                </div>

                {/* Inline Validation Alert */}
                {validationError && (
                  <div
                    id={errorId}
                    role="alert"
                    className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-[11px] flex items-center gap-1.5 animate-fadeIn"
                  >
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600 dark:text-rose-400" />
                    <span>{validationError}</span>
                  </div>
                )}
              </div>
            </div>

            {/* -------------------------------------------------------------------
                SECTION C: FIXED FOOTER (Flex-none, always pinned)
               ------------------------------------------------------------------- */}
            <div className="flex-none p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <button
                type="button"
                onClick={() => handleSendToWhatsApp()}
                className="w-full h-11 rounded-xl bg-[#25D366] hover:bg-[#20ba59] active:scale-[0.98] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-emerald-600/25 transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                {/* WhatsApp Vector Icon */}
                <svg className="w-4.5 h-4.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                </svg>
                <span>Chat on WhatsApp</span>
                <ArrowUpRight className="w-4 h-4 opacity-80" />
              </button>

              <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 px-1">
                <span>Continued securely in WhatsApp</span>
                <span className="text-slate-400 dark:text-slate-500">Press Send in app</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
