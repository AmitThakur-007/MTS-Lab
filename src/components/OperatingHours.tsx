import React from 'react';
import { Clock, PhoneCall } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OPERATING_HOURS } from '@/lib/businessHours';

export interface OperatingHoursProps {
  /**
   * Layout style:
   * - 'footer': Compact stacked layout for global footer
   * - 'card': Full standalone card (used in Contact page / Service Detail)
   * - 'home': Format tailored for Home page "Visit Service Center" box
   * - 'badge': Compact status badge for About page
   * - 'compact': Minimal two-line format
   */
  variant?: 'footer' | 'card' | 'home' | 'badge' | 'compact';
  className?: string;
  showIcon?: boolean;
  theme?: 'dark' | 'light' | 'auto';
}

export default function OperatingHours({
  variant = 'compact',
  className,
  showIcon = true,
  theme = 'auto',
}: OperatingHoursProps) {
  // Footer Variant
  if (variant === 'footer') {
    return (
      <div className={cn('flex items-start gap-2.5', className)}>
        {showIcon && <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />}
        <div className="space-y-0.5">
          <span className="text-[11px] text-slate-500 uppercase tracking-wider block font-bold">
            {OPERATING_HOURS.title}
          </span>
          <div className="text-slate-300 font-medium text-xs sm:text-sm">
            <span>{OPERATING_HOURS.regularSchedule}</span>
            <span className="text-slate-500 mx-1.5">•</span>
            <span className="inline-flex items-center gap-1 text-slate-300">
              {OPERATING_HOURS.saturdayDayLabel}:{' '}
              <a
                href={OPERATING_HOURS.phoneTel}
                className="text-amber-400 hover:text-amber-300 underline underline-offset-2 font-semibold transition-colors"
                title={`Call MTS Lab at ${OPERATING_HOURS.phone}`}
              >
                {OPERATING_HOURS.saturdayActionLabel}
              </a>
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Home Page Variant
  if (variant === 'home') {
    return (
      <div className={cn('flex flex-col xs:flex-row xs:items-start gap-1 xs:gap-3', className)}>
        <span className="font-bold text-white xs:w-28 shrink-0 flex items-center gap-1.5">
          {showIcon && <Clock className="h-3.5 w-3.5 text-amber-400 shrink-0 hidden xs:inline" />}
          <span>{OPERATING_HOURS.title}:</span>
        </span>
        <div className="text-slate-200">
          <div>{OPERATING_HOURS.regularSchedule}</div>
          <div className="text-slate-300">
            {OPERATING_HOURS.saturdayDayLabel}:{' '}
            <a
              href={OPERATING_HOURS.phoneTel}
              className="text-amber-400 hover:text-amber-300 underline underline-offset-2 font-semibold transition-colors"
              title={`Call MTS Lab at ${OPERATING_HOURS.phone}`}
            >
              {OPERATING_HOURS.saturdayActionLabel}
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Badge Variant (About Page Kathmandu Laboratory)
  if (variant === 'badge') {
    return (
      <div
        className={cn(
          'border border-slate-800 rounded-2xl p-2.5 sm:p-3 bg-slate-900 text-slate-300 text-xs font-semibold flex flex-col sm:flex-row items-center gap-1.5 sm:gap-2 text-center',
          className
        )}
      >
        <div className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <span>{OPERATING_HOURS.title}:</span>
          <span className="text-white font-bold">{OPERATING_HOURS.regularSchedule}</span>
        </div>
        <span className="text-slate-600 hidden sm:inline">•</span>
        <div className="inline-flex items-center gap-1 text-slate-300">
          <span>{OPERATING_HOURS.saturdayDayLabel}:</span>
          <a
            href={OPERATING_HOURS.phoneTel}
            className="text-amber-400 hover:text-amber-300 underline underline-offset-2 font-bold transition-colors"
            title={`Call MTS Lab at ${OPERATING_HOURS.phone}`}
          >
            {OPERATING_HOURS.saturdayActionLabel}
          </a>
        </div>
      </div>
    );
  }

  // Card Variant (Contact Page / Service Detail Sidebar)
  if (variant === 'card') {
    const isDark = theme === 'dark';
    return (
      <div
        className={cn(
          'rounded-2xl p-5 sm:p-6 border transition-colors flex flex-col justify-between space-y-4',
          isDark
            ? 'bg-slate-900 border-slate-800 text-slate-200'
            : 'bg-white border-slate-200/90 text-slate-900 shadow-xs',
          className
        )}
      >
        <div className="space-y-3 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 border border-amber-500/20">
              <Clock className="h-5 w-5 shrink-0" />
            </div>
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
              Nepal Time
            </span>
          </div>

          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {OPERATING_HOURS.title}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Laboratory schedule</p>
          </div>

          <div className="space-y-2 pt-1 text-xs min-w-0">
            <div className="flex items-start justify-between gap-2">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {OPERATING_HOURS.regularDays}:
              </span>
              <span className="text-slate-900 dark:text-white font-bold text-right">
                {OPERATING_HOURS.openTime} – {OPERATING_HOURS.closeTime}
              </span>
            </div>
            <div className="flex items-start justify-between gap-2">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {OPERATING_HOURS.saturdayDayLabel}:
              </span>
              <a
                href={OPERATING_HOURS.phoneTel}
                className="text-amber-600 dark:text-amber-400 hover:underline font-bold text-right flex items-center gap-1"
                title={`Call MTS Lab at ${OPERATING_HOURS.phone}`}
              >
                <PhoneCall className="w-3 h-3" />
                <span>{OPERATING_HOURS.saturdayActionLabel}</span>
              </a>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 pt-0.5">
              {OPERATING_HOURS.saturdayInstruction} (Emergency intake &amp; scheduled deliveries)
            </p>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 dark:text-slate-500">
          Public holiday adjustments announced on Facebook
        </div>
      </div>
    );
  }

  // Compact Variant (Default)
  return (
    <div className={cn('text-xs sm:text-sm space-y-1', className)}>
      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
        {showIcon && <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
        <span>{OPERATING_HOURS.title}</span>
      </div>
      <div className="text-slate-600 dark:text-slate-300">
        <div>{OPERATING_HOURS.regularSchedule}</div>
        <div className="flex items-center gap-1">
          <span>{OPERATING_HOURS.saturdayDayLabel}:</span>
          <a
            href={OPERATING_HOURS.phoneTel}
            className="text-amber-600 dark:text-amber-400 hover:underline font-semibold"
          >
            {OPERATING_HOURS.saturdayActionLabel}
          </a>
        </div>
      </div>
    </div>
  );
}
