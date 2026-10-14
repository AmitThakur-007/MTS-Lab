import React from 'react';
import { cn } from '@/lib/utils';
import { useAppTheme, ThemeId } from '@/context/ThemeContext';

interface FestivalDecorationsProps {
  forcedTheme?: ThemeId;
  variant?: 'banner' | 'card-preview' | 'floating-accent';
  className?: string;
  customGreeting?: string;
}

/**
 * Authentic Nepalese Festival Vector Graphics & Visual Decorations
 * Culturally verified representations:
 * - Dashain: Sacred Green Jamara shoots growing in traditional terracotta Kalash/pot with red vermilion tika
 * - Tihar: Traditional handmade clay Diyo (oil lamp) with visible luminous golden flame and marigold petals
 * - Holi: Vibrant organic Gulal powder clouds in magenta, saffron yellow, turquoise and emerald
 * - Nepali New Year: Auspicious celebratory Toran garlands with mango leaves and Nawa Barsha motifs
 * 
 * STRICT COMPLIANCE: Zero AI elements, no robot heads, no futuristic magic wands or sparkles.
 */

// 1. Dashain: Authentic Sacred Green Jamara Shoots & Terracotta Kalash
export const JamaraArtwork: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={cn("w-14 h-14 sm:w-16 sm:h-16 shrink-0 drop-shadow-md select-none", className)}
    aria-label="Traditional Dashain Green Jamara"
    role="img"
  >
    {/* Terracotta Pot (Jamara Paatra / Kalash) */}
    <ellipse cx="60" cy="98" rx="34" ry="10" fill="#994723" />
    <path
      d="M32 94C32 80 42 75 48 70H72C78 75 88 80 88 94C88 103 76 106 60 106C44 106 32 103 32 94Z"
      fill="#b85d2a"
    />
    <path
      d="M44 70C44 67 48 64 60 64C72 64 76 67 76 70C76 72 72 74 60 74C48 74 44 72 44 70Z"
      fill="#853616"
    />
    {/* Red vermilion sacred tika on pot */}
    <circle cx="60" cy="88" r="4.5" fill="#dc2626" />
    <circle cx="60" cy="88" r="1.5" fill="#fef08a" />
    <path d="M50 88H70" stroke="#fef08a" strokeWidth="1.2" strokeLinecap="round" strokeDasharray="2 3" />

    {/* Rich Green & Golden-tipped Sprouting Jamara Shoots */}
    {/* Center tall shoots */}
    <path d="M60 66Q60 30 58 12" stroke="#15803d" strokeWidth="3" strokeLinecap="round" />
    <path d="M58 16L58 12" stroke="#eab308" strokeWidth="3.2" strokeLinecap="round" />

    <path d="M59 66Q63 32 66 14" stroke="#16a34a" strokeWidth="2.8" strokeLinecap="round" />
    <path d="M65 18L66 14" stroke="#facc15" strokeWidth="3" strokeLinecap="round" />

    {/* Left-arching lush Jamara blades */}
    <path d="M54 66Q44 40 32 24" stroke="#15803d" strokeWidth="2.8" strokeLinecap="round" />
    <path d="M34 27L32 24" stroke="#eab308" strokeWidth="3" strokeLinecap="round" />

    <path d="M51 68Q36 48 24 38" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M26 40L24 38" stroke="#fef08a" strokeWidth="2.8" strokeLinecap="round" />

    <path d="M56 67Q48 45 42 20" stroke="#166534" strokeWidth="2.6" strokeLinecap="round" />
    <path d="M43 24L42 20" stroke="#eab308" strokeWidth="2.8" strokeLinecap="round" />

    {/* Right-arching lush Jamara blades */}
    <path d="M66 66Q76 40 88 24" stroke="#15803d" strokeWidth="2.8" strokeLinecap="round" />
    <path d="M86 27L88 24" stroke="#eab308" strokeWidth="3" strokeLinecap="round" />

    <path d="M69 68Q84 48 96 38" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M94 40L96 38" stroke="#fef08a" strokeWidth="2.8" strokeLinecap="round" />

    <path d="M64 67Q72 45 78 20" stroke="#166534" strokeWidth="2.6" strokeLinecap="round" />
    <path d="M77 24L78 20" stroke="#eab308" strokeWidth="2.8" strokeLinecap="round" />

    {/* Secondary inner sprouts */}
    <path d="M55 67Q52 50 48 35" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" />
    <path d="M65 67Q68 50 72 35" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" />
    <path d="M60 67Q61 46 62 30" stroke="#86efac" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// 2. Tihar: Traditional Clay Oil Lamp (Diyo) with Glowing Golden Flame & Marigold Bed
export const DiyoArtwork: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={cn("w-14 h-14 sm:w-16 sm:h-16 shrink-0 drop-shadow-lg select-none", className)}
    aria-label="Traditional Tihar Clay Oil Lamp Diyo"
    role="img"
  >
    {/* Soft radiant aura from the sacred flame */}
    <circle cx="60" cy="46" r="32" fill="url(#tiharFlameGlow)" opacity="0.45" />

    {/* Marigold Petals (Sayapatri) base */}
    <ellipse cx="60" cy="98" rx="42" ry="10" fill="#c2410c" opacity="0.3" />
    <circle cx="34" cy="96" r="6" fill="#f59e0b" />
    <circle cx="46" cy="99" r="6.5" fill="#ea580c" />
    <circle cx="60" cy="101" r="7" fill="#f59e0b" />
    <circle cx="74" cy="99" r="6.5" fill="#ea580c" />
    <circle cx="86" cy="96" r="6" fill="#f59e0b" />

    {/* Terracotta Clay Diyo Body */}
    <path
      d="M24 74C24 92 40 96 60 96C80 96 96 92 96 74C96 70 82 72 60 72C38 72 24 70 24 74Z"
      fill="#b45309"
    />
    <path
      d="M26 73C34 85 46 89 60 89C74 89 86 85 94 73C90 77 78 81 60 81C42 81 30 77 26 73Z"
      fill="#78350f"
    />
    {/* Oil Reservoir Inside */}
    <ellipse cx="60" cy="73" rx="33" ry="5.5" fill="#92400e" />
    <ellipse cx="60" cy="73" rx="28" ry="4" fill="#d97706" />

    {/* Cotton Wick (Batti) tip */}
    <path d="M59 73C59 66 60 60 60 56" stroke="#451a03" strokeWidth="2.5" strokeLinecap="round" />

    {/* Traditional Steady Flame (Outer amber -> Core bright golden-white) */}
    <path
      d="M60 22C54 36 48 46 48 56C48 64 53 69 60 69C67 69 72 64 72 56C72 46 66 36 60 22Z"
      fill="url(#tiharFlameOuter)"
    />
    <path
      d="M60 30C56 40 52 47 52 55C52 61 56 65 60 65C64 65 68 61 68 55C68 47 64 40 60 30Z"
      fill="url(#tiharFlameInner)"
    />
    <ellipse cx="60" cy="56" rx="4" ry="7" fill="#ffffff" />

    <defs>
      <radialGradient id="tiharFlameGlow" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
        <stop offset="60%" stopColor="#d97706" stopOpacity="0.3" />
        <stop offset="100%" stopColor="#b45309" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="tiharFlameOuter" x1="60" y1="22" x2="60" y2="69" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#fef08a" />
        <stop offset="35%" stopColor="#f59e0b" />
        <stop offset="85%" stopColor="#dc2626" />
      </linearGradient>
      <linearGradient id="tiharFlameInner" x1="60" y1="30" x2="60" y2="65" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="50%" stopColor="#fef08a" />
        <stop offset="100%" stopColor="#f59e0b" />
      </linearGradient>
    </defs>
  </svg>
);

// 3. Holi: Authentic Colorful Gulal Festival Powder Splashes & Thali
export const GulalArtwork: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={cn("w-14 h-14 sm:w-16 sm:h-16 shrink-0 drop-shadow-md select-none", className)}
    aria-label="Traditional Holi Colorful Gulal Powders"
    role="img"
  >
    {/* Magenta / Pink Gulal Burst */}
    <circle cx="42" cy="40" r="16" fill="#be185d" opacity="0.85" />
    <circle cx="34" cy="30" r="7" fill="#ec4899" opacity="0.9" />
    <circle cx="50" cy="30" r="6" fill="#f43f5e" opacity="0.8" />
    <circle cx="28" cy="44" r="5" fill="#db2777" opacity="0.75" />

    {/* Golden Yellow / Saffron Gulal Burst */}
    <circle cx="78" cy="40" r="15" fill="#eab308" opacity="0.9" />
    <circle cx="88" cy="32" r="7.5" fill="#facc15" opacity="0.95" />
    <circle cx="70" cy="30" r="6" fill="#ca8a04" opacity="0.85" />
    <circle cx="92" cy="45" r="5" fill="#fbbf24" opacity="0.75" />

    {/* Cyan / Turquoise Splash */}
    <circle cx="38" cy="74" r="13" fill="#0284c7" opacity="0.85" />
    <circle cx="26" cy="70" r="6" fill="#38bdf8" opacity="0.8" />
    <circle cx="34" cy="84" r="5" fill="#0369a1" opacity="0.75" />

    {/* Emerald Green Splash */}
    <circle cx="82" cy="74" r="13" fill="#16a34a" opacity="0.85" />
    <circle cx="94" cy="70" r="6" fill="#4ade80" opacity="0.8" />
    <circle cx="86" cy="84" r="5" fill="#15803d" opacity="0.75" />

    {/* Center blend bowl / Traditional Thali */}
    <ellipse cx="60" cy="94" rx="38" ry="12" fill="#71717a" opacity="0.4" />
    <ellipse cx="60" cy="92" rx="34" ry="10" fill="#e4e4e7" />
    <ellipse cx="60" cy="91" rx="30" ry="8" fill="#d4d4d8" />

    {/* Gulal heaps on thali */}
    <path d="M42 92C42 86 48 83 54 83C60 83 62 87 62 92Z" fill="#db2777" />
    <path d="M58 92C58 85 64 82 70 82C76 82 78 87 78 92Z" fill="#eab308" />
    <path d="M48 94C48 88 54 85 60 85C66 85 68 89 68 94Z" fill="#0284c7" />
  </svg>
);

// 4. Nepali New Year: Traditional Auspicious Garland & Kalash Banner Accent
export const NewYearArtwork: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={cn("w-14 h-14 sm:w-16 sm:h-16 shrink-0 drop-shadow-md select-none", className)}
    aria-label="Nepali New Year Auspicious Motifs"
    role="img"
  >
    {/* Auspicious Toran (Traditional Garland Arch) */}
    <path
      d="M12 28Q60 48 108 28"
      stroke="#b91c1c"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
    {/* Hanging mango leaves & marigold flowers */}
    <path d="M24 33Q22 45 20 48" stroke="#15803d" strokeWidth="2.2" strokeLinecap="round" />
    <circle cx="20" cy="49" r="3.5" fill="#f59e0b" />

    <path d="M42 38Q40 52 38 56" stroke="#15803d" strokeWidth="2.2" strokeLinecap="round" />
    <circle cx="38" cy="57" r="4" fill="#dc2626" />

    <path d="M60 40Q60 55 60 60" stroke="#15803d" strokeWidth="2.2" strokeLinecap="round" />
    <circle cx="60" cy="61" r="4.5" fill="#f59e0b" />

    <path d="M78 38Q80 52 82 56" stroke="#15803d" strokeWidth="2.2" strokeLinecap="round" />
    <circle cx="82" cy="57" r="4" fill="#dc2626" />

    <path d="M96 33Q98 45 100 48" stroke="#15803d" strokeWidth="2.2" strokeLinecap="round" />
    <circle cx="100" cy="49" r="3.5" fill="#f59e0b" />

    {/* Sacred Mangal Kalash (Brass/Copper) */}
    <ellipse cx="60" cy="100" rx="26" ry="7" fill="#78350f" opacity="0.4" />
    <path
      d="M42 98C42 86 48 80 52 75H68C72 80 78 86 78 98C78 103 70 105 60 105C50 105 42 103 42 98Z"
      fill="#d97706"
    />
    <path
      d="M50 75C50 72 54 70 60 70C66 70 70 72 70 75C70 77 66 79 60 79C54 79 50 77 50 75Z"
      fill="#b45309"
    />
    {/* Coconut & Mango Leaves on top of Kalash */}
    <circle cx="60" cy="66" r="7.5" fill="#78350f" />
    <path d="M52 68Q44 60 40 56" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M68 68Q76 60 80 56" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M60 60Q60 52 60 48" stroke="#15803d" strokeWidth="2.5" strokeLinecap="round" />

    {/* Auspicious red tika on Kalash */}
    <circle cx="60" cy="92" r="3.5" fill="#dc2626" />
    <circle cx="60" cy="92" r="1.2" fill="#fef08a" />
  </svg>
);

export const FestivalDecorations: React.FC<FestivalDecorationsProps> = ({
  forcedTheme,
  variant = 'banner',
  className,
  customGreeting,
}) => {
  const { effectiveTheme, globalTheme } = useAppTheme();
  const active = forcedTheme || effectiveTheme;

  // STRICT RULE: If theme is light, dark, night, or neutral-default, render NOTHING.
  if (
    active === 'light' ||
    active === 'dark' ||
    active === 'night' ||
    active === 'neutral-default'
  ) {
    return null;
  }

  const greeting = customGreeting || globalTheme.festivalGreeting;

  // Render variant based on active Nepalese festival
  if (active === 'dashain') {
    if (variant === 'card-preview') {
      return (
        <div className={cn("flex items-center gap-2.5 p-3 rounded-xl bg-amber-50/90 border border-amber-200/80 text-amber-900 select-none", className)}>
          <JamaraArtwork className="w-10 h-10" />
          <div className="min-w-0">
            <span className="text-xs font-black tracking-wide block uppercase text-amber-900">Dashain Festival</span>
            <span className="text-[10px] text-amber-700 font-medium truncate block">Sacred Green Jamara &amp; Prosperity</span>
          </div>
        </div>
      );
    }

    return (
      <section
        className={cn(
          "relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-50 via-emerald-50/70 to-amber-50/80 border border-amber-200/80 p-3 sm:p-4 mb-4 sm:mb-6 shadow-sm select-none transition-all",
          className
        )}
        aria-label="Dashain Festival Greeting"
      >
        <div className="relative z-10 flex items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <JamaraArtwork />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-200/90 text-amber-900 border border-amber-300">
                  बडा दशैं विशेष
                </span>
                <span className="text-xs sm:text-sm font-extrabold text-amber-950 truncate">
                  Happy Dashain
                </span>
              </div>
              <p className="text-xs sm:text-sm font-bold text-emerald-900 mt-0.5 leading-snug line-clamp-2">
                {greeting || "बडा दशैंको हार्दिक मंगलमय शुभकामना | Celebrating Prosperity & Renewal at MTS Lab Kathmandu"}
              </p>
              <p className="text-[11px] font-medium text-amber-800/80 mt-0.5 hidden md:block">
                May the sacred blessings of Jamara bring health, success, and prosperity to all our valued clients and technical staff.
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 shrink-0 pr-1">
            <JamaraArtwork className="w-10 h-10 opacity-70 scale-x-[-1]" />
          </div>
        </div>
      </section>
    );
  }

  if (active === 'tihar') {
    if (variant === 'card-preview') {
      return (
        <div className={cn("flex items-center gap-2.5 p-3 rounded-xl bg-slate-900/90 border border-amber-500/40 text-amber-300 select-none", className)}>
          <DiyoArtwork className="w-10 h-10" />
          <div className="min-w-0">
            <span className="text-xs font-black tracking-wide block uppercase text-amber-300">Tihar Festival</span>
            <span className="text-[10px] text-amber-400 font-medium truncate block">Traditional Clay Diyo &amp; Deepawali Lights</span>
          </div>
        </div>
      );
    }

    return (
      <section
        className={cn(
          "relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950/90 border border-amber-500/40 p-3 sm:p-4 mb-4 sm:mb-6 shadow-md select-none transition-all",
          className
        )}
        aria-label="Tihar Festival Greeting"
      >
        <div className="relative z-10 flex items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <DiyoArtwork />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/30 text-amber-300 border border-amber-400/50">
                  शुभ दीपावली तथा तिहार
                </span>
                <span className="text-xs sm:text-sm font-extrabold text-amber-200 truncate">
                  Happy Tihar &amp; Deepawali
                </span>
              </div>
              <p className="text-xs sm:text-sm font-bold text-amber-300 mt-0.5 leading-snug line-clamp-2">
                {greeting || "शुभ दीपावली तथा तिहारको हार्दिक शुभकामना | Festival of Lights at MTS Lab Kathmandu"}
              </p>
              <p className="text-[11px] font-medium text-amber-200/70 mt-0.5 hidden md:block">
                Lighting up smiles, fellowship, and precision hardware craftsmanship across Nepal.
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 shrink-0 pr-1">
            <DiyoArtwork className="w-10 h-10 opacity-70 scale-x-[-1]" />
          </div>
        </div>
      </section>
    );
  }

  if (active === 'holi') {
    if (variant === 'card-preview') {
      return (
        <div className={cn("flex items-center gap-2.5 p-3 rounded-xl bg-pink-50/90 border border-pink-200/80 text-pink-900 select-none", className)}>
          <GulalArtwork className="w-10 h-10" />
          <div className="min-w-0">
            <span className="text-xs font-black tracking-wide block uppercase text-pink-900">Holi Festival</span>
            <span className="text-[10px] text-pink-700 font-medium truncate block">Organic Colorful Gulal Powders</span>
          </div>
        </div>
      );
    }

    return (
      <section
        className={cn(
          "relative overflow-hidden rounded-2xl bg-gradient-to-r from-pink-50/95 via-yellow-50/80 to-sky-50/90 border border-pink-200/80 p-3 sm:p-4 mb-4 sm:mb-6 shadow-sm select-none transition-all",
          className
        )}
        aria-label="Holi Festival Greeting"
      >
        <div className="relative z-10 flex items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <GulalArtwork />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-pink-200/90 text-pink-900 border border-pink-300">
                  रङ्गहरूको पर्व होली
                </span>
                <span className="text-xs sm:text-sm font-extrabold text-pink-950 truncate">
                  Happy Holi
                </span>
              </div>
              <p className="text-xs sm:text-sm font-bold text-pink-900 mt-0.5 leading-snug line-clamp-2">
                {greeting || "होली पर्वको हार्दिक शुभकामना | Festival of Vibrant Colors & Joy at MTS Lab Kathmandu"}
              </p>
              <p className="text-[11px] font-medium text-pink-800/80 mt-0.5 hidden md:block">
                Wishing all staff, clients, and partners a joyous and colorful celebration of unity and harmony.
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 shrink-0 pr-1">
            <GulalArtwork className="w-10 h-10 opacity-70" />
          </div>
        </div>
      </section>
    );
  }

  if (active === 'nepali-new-year') {
    if (variant === 'card-preview') {
      return (
        <div className={cn("flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50/90 border border-emerald-200/80 text-emerald-900 select-none", className)}>
          <NewYearArtwork className="w-10 h-10" />
          <div className="min-w-0">
            <span className="text-xs font-black tracking-wide block uppercase text-emerald-900">Nepali New Year</span>
            <span className="text-[10px] text-emerald-700 font-medium truncate block">Auspicious Toran &amp; Kalash</span>
          </div>
        </div>
      );
    }

    return (
      <section
        className={cn(
          "relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-50/95 via-amber-50/70 to-emerald-50/80 border border-emerald-200/80 p-3 sm:p-4 mb-4 sm:mb-6 shadow-sm select-none transition-all",
          className
        )}
        aria-label="Nepali New Year Greeting"
      >
        <div className="relative z-10 flex items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <NewYearArtwork />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-200/90 text-emerald-950 border border-emerald-300">
                  नयाँ वर्षको शुभकामना
                </span>
                <span className="text-xs sm:text-sm font-extrabold text-emerald-950 truncate">
                  Happy Nepali New Year
                </span>
              </div>
              <p className="text-xs sm:text-sm font-bold text-emerald-900 mt-0.5 leading-snug line-clamp-2">
                {greeting || "नयाँ वर्षको हार्दिक मंगलमय शुभकामना | Fresh Beginnings & Prosperity at MTS Lab Kathmandu"}
              </p>
              <p className="text-[11px] font-medium text-emerald-800/80 mt-0.5 hidden md:block">
                Embracing the new year with cutting-edge repair technology, dedicated service, and renewed commitment to Kathmandu.
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 shrink-0 pr-1">
            <NewYearArtwork className="w-10 h-10 opacity-70" />
          </div>
        </div>
      </section>
    );
  }

  return null;
};

export default FestivalDecorations;
