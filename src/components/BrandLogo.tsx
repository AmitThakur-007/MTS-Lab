import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export interface BrandLogoProps {
  /**
   * Display mode:
   * - 'icon': Only the official emblem
   * - 'compact': Emblem + "MTS LAB" title
   * - 'full': Emblem + "MTS LAB" title + descriptive subtitle
   */
  variant?: 'icon' | 'compact' | 'full';

  /**
   * Presets for emblem sizing:
   * 'xs' = 24px, 'sm' = 32px, 'md' = 40px, 'lg' = 48px, 'xl' = 64px, '2xl' = 88px
   */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

  /**
   * Route to navigate to when clicked. Set to null / undefined for non-interactive rendering.
   */
  linkTo?: string | null;

  /**
   * High-level container classes.
   */
  className?: string;

  /**
   * Explicit image element classes (e.g. drop shadow, hover effects).
   */
  imgClassName?: string;

  /**
   * Visual theme for accompanying text:
   * - 'light': Dark text for light backgrounds
   * - 'dark': White text for dark/night backgrounds
   * - 'auto': Adapts via Tailwind dark: variants
   */
  theme?: 'light' | 'dark' | 'auto';

  /**
   * Custom alt description for accessibility.
   */
  alt?: string;

  /**
   * Custom subtitle override for 'full' variant
   */
  subtitle?: string;

  /**
   * Callback on image load error
   */
  onError?: () => void;
}

const sizeMap = {
  xs: { box: 'w-6 h-6', px: 24, text: 'text-sm', sub: 'text-[9px]' },
  sm: { box: 'w-8 h-8', px: 32, text: 'text-base', sub: 'text-[10px]' },
  md: { box: 'w-10 h-10', px: 40, text: 'text-lg', sub: 'text-[10px]' },
  lg: { box: 'w-12 h-12', px: 48, text: 'text-xl', sub: 'text-xs' },
  xl: { box: 'w-16 h-16', px: 64, text: 'text-2xl', sub: 'text-xs' },
  '2xl': { box: 'w-20 h-20 sm:w-24 sm:h-24', px: 96, text: 'text-3xl', sub: 'text-sm' },
};

export const OFFICIAL_LOGO_SRC = '/images/mts-lab-logo.png';
export const OFFICIAL_LOGO_ALT = 'MTS LAB — Mobile Technology Station';

export default function BrandLogo({
  variant = 'compact',
  size = 'md',
  linkTo = '/',
  className,
  imgClassName,
  theme = 'auto',
  alt = OFFICIAL_LOGO_ALT,
  subtitle,
  onError,
}: BrandLogoProps) {
  const [imageError, setImageError] = useState(false);
  const dims = sizeMap[size] || sizeMap.md;

  const handleImageError = () => {
    setImageError(true);
    if (onError) onError();
  };

  const imageElement = !imageError ? (
    <img
      src={OFFICIAL_LOGO_SRC}
      alt={alt}
      width={dims.px}
      height={dims.px}
      onError={handleImageError}
      loading="eager"
      className={cn(
        dims.box,
        'object-contain select-none shrink-0 transition-transform duration-300',
        imgClassName
      )}
    />
  ) : (
    /* High-fidelity Vector Fallback Emblem */
    <svg
      viewBox="0 0 100 100"
      width={dims.px}
      height={dims.px}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(dims.box, 'shrink-0 select-none drop-shadow-md', imgClassName)}
      aria-label={alt}
    >
      <defs>
        <linearGradient id="brand-fallback-blue" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0066cc" />
          <stop offset="100%" stopColor="#002266" />
        </linearGradient>
        <linearGradient id="brand-fallback-wrench" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>
        <linearGradient id="brand-fallback-orbit" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0284c7" />
          <stop offset="50%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0044aa" />
        </linearGradient>
      </defs>
      {/* Mechanical Gear */}
      <g fill="#64748b" opacity="0.9">
        <path d="M 38 12 L 44 14 L 43 20 A 28 28 0 0 1 50 24 L 56 21 L 60 27 L 55 31 A 28 28 0 0 1 57 39 L 63 42 L 61 48 L 55 49 A 28 28 0 0 1 51 56 L 54 62 L 48 66 L 43 61 A 28 28 0 0 1 35 63 L 32 69 L 26 67 L 27 61 A 28 28 0 0 1 20 57 L 14 60 L 10 54 L 15 50 A 28 28 0 0 1 13 42 L 7 39 L 9 33 L 15 32 A 28 28 0 0 1 19 25 L 16 19 L 22 15 L 27 20 A 28 28 0 0 1 35 18 Z" />
        <circle cx="35" cy="40" r="12" fill="#0f172a" />
      </g>
      {/* Smartphone Chassis */}
      <rect x="32" y="16" width="46" height="74" rx="10" fill="url(#brand-fallback-blue)" stroke="#38bdf8" strokeWidth="2.5" />
      <rect x="36" y="22" width="38" height="60" rx="6" fill="#020617" />
      {/* Home / Speaker indicator */}
      <rect x="49" y="18.5" width="12" height="2" rx="1" fill="#94a3b8" />
      <circle cx="55" cy="85" r="3" fill="#38bdf8" />
      {/* Wrench */}
      <g fill="url(#brand-fallback-wrench)">
        <path d="M 52 32 C 48 30 44 32 42 36 C 41 38 41 41 43 43 L 57 71 C 58 73 61 74 63 73 L 67 71 C 69 70 70 67 69 65 L 55 37 C 56 35 56 33 54 32 Z" />
      </g>
      {/* Orbit Ring */}
      <ellipse cx="50" cy="62" rx="42" ry="14" fill="none" stroke="url(#brand-fallback-orbit)" strokeWidth="4.5" transform="rotate(-18 50 62)" />
    </svg>
  );

  const titleColor =
    theme === 'dark'
      ? 'text-white'
      : theme === 'light'
      ? 'text-slate-950'
      : 'text-slate-950 dark:text-white';

  const subColor =
    theme === 'dark'
      ? 'text-slate-400'
      : theme === 'light'
      ? 'text-slate-500'
      : 'text-slate-500 dark:text-slate-400';

  const content = (
    <div
      className={cn(
        'inline-flex items-center gap-2.5 sm:gap-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-xl transition-all',
        className
      )}
    >
      <div className="shrink-0 flex items-center justify-center group-hover:scale-105 transition-transform">
        {imageElement}
      </div>

      {variant !== 'icon' && (
        <div className="flex flex-col min-w-0 text-left select-none">
          <span
            className={cn(
              'font-black tracking-tight leading-none flex items-center gap-1',
              dims.text,
              titleColor
            )}
          >
            MTS<span className="text-indigo-600 dark:text-indigo-400 font-bold">LAB</span>
          </span>

          {variant === 'full' && (
            <span
              className={cn(
                'font-bold uppercase tracking-widest leading-tight mt-1 truncate',
                dims.sub,
                subColor
              )}
            >
              {subtitle || 'Mobile Technology Station'}
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (linkTo) {
    return (
      <Link to={linkTo} aria-label={alt} className="inline-flex items-center group cursor-pointer">
        {content}
      </Link>
    );
  }

  return content;
}
