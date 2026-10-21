import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  ShieldCheck, 
  Wrench, 
  ArrowRight, 
  Clock, 
  Battery, 
  Zap, 
  Layers, 
  Tv, 
  Cpu, 
  CheckCircle2, 
  Smartphone,
  Activity,
  Award,
  Play,
  Pause
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { api } from '@/services/api';
import { useRealtimeSync } from '@/services/realtime';

export const AUTOPLAY_INTERVAL = 6000; // Exactly 6000ms (6 seconds) as required

export interface SlideTheme {
  accentColor: string;
  accentGlow: string;
  pillBorder: string;
  glassBg: string;
  headerBorder: string;
  textColor: string;
}

export interface SlideData {
  id?: string;
  title: string;
  description: string;
  imageUrl: string;
  mobileImageUrl?: string | null;
  category?: string | null;
  badgeIcon?: string | null;
  features?: string[] | string | null;
  buttonText?: string;
  buttonLink?: string;
  buttonSecondaryText?: string | null;
  buttonSecondaryLink?: string | null;
  focalPoint?: string | null;
  overlayIntensity?: 'heavy' | 'medium' | 'subtle' | null;
  displayOrder?: number;
  status?: string;
}

const FALLBACK_SLIDES: SlideData[] = [
  {
    id: 'default-1',
    title: 'Front Glass Change',
    category: 'MTS LAB — SMARTPHONE REPAIR',
    badgeIcon: 'wrench',
    description: 'Specialized outer glass replacement preserving your original AMOLED / OLED display and touch responsiveness.',
    imageUrl: '/assets/images/front_glass_repair_1786719176945.jpg',
    features: ['24-Point Tested', '60-Min Express Fix', 'Certified Techs'],
    buttonText: 'Check Repair Price',
    buttonLink: '/services?focus=search&q=Front+Glass',
    buttonSecondaryText: 'Track Repair Status',
    buttonSecondaryLink: '/track',
    focalPoint: 'center',
    overlayIntensity: 'heavy',
    displayOrder: 1,
    status: 'ACTIVE'
  },
  {
    id: 'default-2',
    title: 'Battery & Port Replacement',
    category: 'MTS LAB — BATTERY & CHARGING',
    badgeIcon: 'battery',
    description: 'OEM high-capacity battery installation with battery health calibration and high-speed charging port replacement.',
    imageUrl: '/assets/images/phone_repair_lab_1786719222650.jpg',
    features: ['100% Health restored', '1-Year Warranty', 'Fast Charge Tested'],
    buttonText: 'Check Repair Price',
    buttonLink: '/services?focus=search&q=Battery',
    buttonSecondaryText: 'Track Repair Status',
    buttonSecondaryLink: '/track',
    focalPoint: 'center',
    overlayIntensity: 'heavy',
    displayOrder: 2,
    status: 'ACTIVE'
  },
  {
    id: 'default-3',
    title: 'Display Replacement',
    category: 'MTS LAB — 120HZ AMOLED DISPLAY',
    badgeIcon: 'screen',
    description: '100% Genuine original quality screen restoration with True Tone, 120Hz ProMotion, and vibrant clarity.',
    imageUrl: '/assets/images/display_replace_1786719191504.jpg',
    features: ['True Tone Retained', '120Hz ProMotion', 'Zero Dead Pixels'],
    buttonText: 'Check Repair Price',
    buttonLink: '/services?focus=search&q=Display',
    buttonSecondaryText: 'Track Repair Status',
    buttonSecondaryLink: '/track',
    focalPoint: 'center',
    overlayIntensity: 'heavy',
    displayOrder: 3,
    status: 'ACTIVE'
  },
  {
    id: 'default-4',
    title: 'Back Panel / Back Glass Change',
    category: 'MTS LAB — LASER HOUSING RESTORATION',
    badgeIcon: 'layers',
    description: 'Factory finish laser back panel replacement and frame restoration for Apple, Samsung, and flagship devices.',
    imageUrl: '/assets/images/back_glass_fix_1786719207185.jpg',
    features: ['High-Precision Laser', 'Original Magnet Array', 'Factory Finish'],
    buttonText: 'Check Repair Price',
    buttonLink: '/services?focus=search&q=Back+Glass',
    buttonSecondaryText: 'Track Repair Status',
    buttonSecondaryLink: '/track',
    focalPoint: 'center',
    overlayIntensity: 'heavy',
    displayOrder: 4,
    status: 'ACTIVE'
  }
];

export function getSlideTheme(slide?: SlideData | null): SlideTheme {
  const norm = ((slide?.category || '') + ' ' + (slide?.title || '')).toLowerCase();
  
  if (norm.includes('battery') || norm.includes('charging') || norm.includes('port')) {
    return {
      accentColor: '#10b981', // Emerald
      accentGlow: 'rgba(16, 185, 129, 0.28)',
      pillBorder: 'rgba(16, 185, 129, 0.35)',
      glassBg: 'rgba(6, 78, 59, 0.35)',
      headerBorder: 'rgba(16, 185, 129, 0.25)',
      textColor: '#ecfdf5',
    };
  }
  
  if (norm.includes('display') || norm.includes('amoled') || norm.includes('120hz') || norm.includes('screen')) {
    return {
      accentColor: '#6366f1', // Indigo
      accentGlow: 'rgba(99, 102, 241, 0.28)',
      pillBorder: 'rgba(99, 102, 241, 0.35)',
      glassBg: 'rgba(30, 27, 75, 0.35)',
      headerBorder: 'rgba(99, 102, 241, 0.25)',
      textColor: '#eef2ff',
    };
  }
  
  if (norm.includes('laser') || norm.includes('housing') || norm.includes('back')) {
    return {
      accentColor: '#ec4899', // Pink / Rose
      accentGlow: 'rgba(236, 72, 153, 0.28)',
      pillBorder: 'rgba(236, 72, 153, 0.35)',
      glassBg: 'rgba(80, 7, 36, 0.35)',
      headerBorder: 'rgba(236, 72, 153, 0.25)',
      textColor: '#fdf2f8',
    };
  }
  
  if (norm.includes('ic') || norm.includes('motherboard') || norm.includes('soldering') || norm.includes('chip')) {
    return {
      accentColor: '#f59e0b', // Amber
      accentGlow: 'rgba(245, 158, 11, 0.28)',
      pillBorder: 'rgba(245, 158, 11, 0.35)',
      glassBg: 'rgba(69, 26, 3, 0.35)',
      headerBorder: 'rgba(245, 158, 11, 0.25)',
      textColor: '#fffbeb',
    };
  }
  
  // Default: MTS Technical Sky Blue
  return {
    accentColor: '#38bdf8', // Sky
    accentGlow: 'rgba(56, 189, 248, 0.28)',
    pillBorder: 'rgba(56, 189, 248, 0.35)',
    glassBg: 'rgba(15, 23, 42, 0.45)',
    headerBorder: 'rgba(56, 189, 248, 0.22)',
    textColor: '#f0f9ff',
  };
}

function getBadgeIcon(iconName?: string | null, title?: string) {
  const norm = (iconName || title || '').toLowerCase();
  if (norm.includes('battery')) return Battery;
  if (norm.includes('charging') || norm.includes('zap') || norm.includes('port')) return Zap;
  if (norm.includes('screen') || norm.includes('display')) return Smartphone;
  if (norm.includes('laser') || norm.includes('layer') || norm.includes('back')) return Layers;
  if (norm.includes('tv')) return Tv;
  if (norm.includes('cpu') || norm.includes('motherboard') || norm.includes('ic')) return Cpu;
  if (norm.includes('shield')) return ShieldCheck;
  if (norm.includes('clock') || norm.includes('express')) return Clock;
  return Wrench;
}

function getFeatureIcon(featureText: string): React.ElementType {
  const norm = (featureText || '').toLowerCase();
  if (norm.includes('health') || norm.includes('pulse') || norm.includes('restored')) return Activity;
  if (norm.includes('warrant') || norm.includes('guarantee') || norm.includes('shield')) return ShieldCheck;
  if (norm.includes('charge') || norm.includes('fast') || norm.includes('zap') || norm.includes('speed') || norm.includes('power')) return Zap;
  if (norm.includes('min') || norm.includes('express') || norm.includes('clock') || norm.includes('time') || norm.includes('hour')) return Clock;
  if (norm.includes('certif') || norm.includes('tech') || norm.includes('award') || norm.includes('pro') || norm.includes('expert')) return Award;
  if (norm.includes('tone') || norm.includes('oled') || norm.includes('pixel') || norm.includes('120hz') || norm.includes('screen')) return Smartphone;
  if (norm.includes('battery')) return Battery;
  return CheckCircle2;
}

function parseFeatures(features?: string[] | string | null, title?: string): string[] {
  if (Array.isArray(features) && features.length > 0) {
    return features.filter(Boolean);
  }
  if (typeof features === 'string' && features.trim()) {
    return features.includes(',')
      ? features.split(',').map(f => f.trim()).filter(Boolean)
      : [features.trim()];
  }
  const norm = (title || '').toLowerCase();
  if (norm.includes('battery')) return ['100% Health restored', '1-Year Warranty', 'Fast Charge Tested'];
  if (norm.includes('display')) return ['True Tone Retained', '120Hz ProMotion', 'Zero Dead Pixels'];
  if (norm.includes('back')) return ['High-Precision Laser', 'Original Magnet Array', 'Factory Finish'];
  if (norm.includes('motherboard')) return ['Micro-Soldering', 'Schematic Traced', 'Component Level'];
  return ['24-Point Tested', '60-Min Express Fix', 'Certified Techs'];
}

export default function HeroSlider() {
  const [slides, setSlides] = useState<SlideData[]>(FALLBACK_SLIDES);
  const [current, setCurrent] = useState(0);
  const [progressKey, setProgressKey] = useState(0);
  const [loading, setLoading] = useState(true);

  // Interaction & Autoplay Pause State
  const [isHovered, setIsHovered] = useState(false);
  const [isTouching, setIsTouching] = useState(false);
  const [isFocusWithin, setIsFocusWithin] = useState(false);
  const [isTabHidden, setIsTabHidden] = useState(false);
  const [isManuallyPaused, setIsManuallyPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const navigate = useNavigate();

  // Unified Pointer Swipe Tracking for Multi-device Responsiveness
  const pointerStartX = useRef<number | null>(null);
  const pointerStartY = useRef<number | null>(null);
  const isDragging = useRef(false);

  // Authoritative data fetch from backend API
  const loadSlides = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get('/slides');
      if (Array.isArray(data) && data.length > 0) {
        setSlides(data);
      }
    } catch (err) {
      console.warn('[HERO SLIDER] Could not fetch live slides, keeping current view:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSlides();
  }, [loadSlides]);

  // Live Multi-device Real-Time Synchronization via Supabase & SSE Broadcast
  useRealtimeSync(['homeSlide', 'slide', 'slides'], () => {
    loadSlides();
  });

  useEffect(() => {
    const handleFocus = () => loadSlides();
    window.addEventListener('focus', handleFocus);
    window.addEventListener('mts-realtime-update', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('mts-realtime-update', handleFocus);
    };
  }, [loadSlides]);

  // Detect prefers-reduced-motion
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  // Detect Tab Visibility
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handleVisibility = () => {
      setIsTabHidden(document.hidden);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Clamp active index safely
  useEffect(() => {
    if (slides.length > 0 && current >= slides.length) {
      setCurrent(0);
    }
  }, [slides.length, current]);

  const total = slides.length;
  const activeIndex = Math.min(current, Math.max(0, slides.length - 1));
  const currentSlide = slides[activeIndex] || FALLBACK_SLIDES[0];

  // Broadcast current slide theme to Navbar so it smoothly blends with active slide
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const theme = getSlideTheme(currentSlide);
    window.dispatchEvent(new CustomEvent('mts-hero-slide-change', {
      detail: {
        slideId: currentSlide.id,
        title: currentSlide.title,
        theme,
        index: activeIndex,
      }
    }));
  }, [currentSlide, activeIndex]);

  const next = useCallback(() => {
    if (total <= 1) return;
    setCurrent((prev) => (prev === total - 1 ? 0 : prev + 1));
    setProgressKey(prev => prev + 1);
  }, [total]);

  const prev = useCallback(() => {
    if (total <= 1) return;
    setCurrent((prev) => (prev === 0 ? total - 1 : prev - 1));
    setProgressKey(prev => prev + 1);
  }, [total]);

  const goToSlide = (index: number) => {
    setCurrent(index);
    setProgressKey(prev => prev + 1);
  };

  // Determine effective paused state
  const isEffectivelyPaused = 
    isHovered || 
    isTouching || 
    isFocusWithin || 
    isTabHidden || 
    isManuallyPaused || 
    prefersReducedMotion;

  // Single authoritative 6000ms timer
  useEffect(() => {
    if (isEffectivelyPaused || total <= 1) return;
    const timer = setInterval(() => {
      next();
    }, AUTOPLAY_INTERVAL);
    return () => clearInterval(timer);
  }, [next, isEffectivelyPaused, total, current]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [next, prev]);

  // Unified Pointer Swipe Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointerStartX.current = e.clientX;
    pointerStartY.current = e.clientY;
    isDragging.current = true;
    setIsTouching(true);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsTouching(false);
    if (!isDragging.current || pointerStartX.current === null) return;
    const diffX = e.clientX - pointerStartX.current;
    const diffY = pointerStartY.current !== null ? Math.abs(e.clientY - pointerStartY.current) : 0;
    
    // Swipe threshold 45px, ensure horizontal motion dominates vertical scrolling
    if (Math.abs(diffX) > 45 && Math.abs(diffX) > diffY) {
      if (diffX < 0) next();
      else prev();
    }
    
    pointerStartX.current = null;
    pointerStartY.current = null;
    isDragging.current = false;
  };

  const handlePointerCancel = () => {
    setIsTouching(false);
    pointerStartX.current = null;
    pointerStartY.current = null;
    isDragging.current = false;
  };

  const BadgeIcon = getBadgeIcon(currentSlide.badgeIcon, currentSlide.title);
  const featuresList = parseFeatures(currentSlide.features, currentSlide.title);
  const categoryText = currentSlide.category || 'MTS LAB — SMARTPHONE REPAIR';
  const currentTheme = getSlideTheme(currentSlide);

  return (
    <div 
      className="relative w-full h-[100dvh] min-h-[580px] sm:min-h-[640px] lg:min-h-[720px] max-h-[1050px] overflow-hidden bg-slate-950 isolate select-none touch-pan-y"
      style={{ touchAction: 'pan-y' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onFocus={() => setIsFocusWithin(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsFocusWithin(false);
        }
      }}
      role="region"
      aria-roledescription="carousel"
      aria-label="MTS Lab Featured Highlights Hero Slideshow"
      aria-live={isEffectivelyPaused ? 'polite' : 'off'}
    >
      {/* Keyframe animation definition for synchronized 6000ms progress */}
      <style>{`
        @keyframes heroSlideProgressAnim {
          0% { width: 0%; }
          100% { width: 100%; }
        }
      `}</style>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentSlide.id || activeIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.65, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          {/* Background Image Layer with Zoom effect and Responsive Picture */}
          <motion.div 
            initial={{ scale: 1.05 }}
            animate={{ scale: 1 }}
            transition={{ duration: 7, ease: "easeOut" }}
            className="absolute inset-0"
          >
            <picture className="w-full h-full block">
              {currentSlide.mobileImageUrl && (
                <source media="(max-width: 640px)" srcSet={currentSlide.mobileImageUrl} />
              )}
              <img 
                src={currentSlide.imageUrl} 
                alt={currentSlide.title}
                className="w-full h-full object-cover"
                style={{ objectPosition: currentSlide.focalPoint || 'center' }}
                loading={activeIndex === 0 ? 'eager' : 'lazy'}
              />
            </picture>
          </motion.div>

          {/* Top Vignette Overlay for Header Contrast */}
          <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-slate-950/90 via-slate-950/50 to-transparent pointer-events-none z-1" />

          {/* Desktop Left-to-Right Dark Gradient Overlay (Cinematic contrast behind content) */}
          <div className="hidden md:block absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-transparent pointer-events-none z-1" />

          {/* Mobile Bottom-to-Top Dark Gradient Overlay (Optimized for Portrait Screens) */}
          <div className="md:hidden absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/85 to-slate-950/30 pointer-events-none z-1" />

          {/* Bottom Vignette Overlay */}
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent pointer-events-none z-1" />
        </motion.div>
      </AnimatePresence>

      {/* Hero Content Container */}
      <div className="max-w-7xl 2xl:max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-12 2xl:px-16 w-full h-full flex flex-col justify-between pt-24 sm:pt-32 lg:pt-36 pb-6 sm:pb-10 relative z-10">
        
        {/* Main Slide Content */}
        <div className="flex-1 flex flex-col justify-center max-w-2xl lg:max-w-3xl my-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide.id || activeIndex}
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -16, opacity: 0 }}
              transition={{ delay: 0.1, duration: 0.45, ease: "easeOut" }}
              className="space-y-4 sm:space-y-5"
            >
              {/* Category Badge */}
              <div 
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/75 dark:bg-slate-900/85 backdrop-blur-md border text-slate-200 text-[11px] sm:text-xs font-bold uppercase tracking-wider shadow-sm transition-all duration-500"
                style={{ borderColor: currentTheme.pillBorder }}
              >
                <BadgeIcon 
                  className="w-3.5 h-3.5 shrink-0 transition-colors duration-500" 
                  style={{ color: currentTheme.accentColor }}
                />
                <span>{categoryText}</span>
              </div>

              {/* Title */}
              <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-white tracking-tight leading-[1.06] text-balance drop-shadow-md">
                {currentSlide.title}
              </h1>

              {/* Description */}
              <p className="text-sm sm:text-base lg:text-lg text-slate-200/90 font-normal leading-relaxed max-w-xl text-balance drop-shadow-xs">
                {currentSlide.description}
              </p>

              {/* Feature Pills */}
              {featuresList.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {featuresList.map((feat, idx) => {
                    const FeatIcon = getFeatureIcon(feat);
                    return (
                      <span 
                        key={idx} 
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/75 backdrop-blur-md border border-slate-700/60 text-xs font-semibold text-slate-200 shadow-2xs transition-all duration-300"
                      >
                        <FeatIcon 
                          className="w-3.5 h-3.5 shrink-0" 
                          style={{ color: currentTheme.accentColor }}
                        />
                        <span>{feat}</span>
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 pt-3">
                <Button 
                  onClick={() => navigate(currentSlide.buttonLink || '/services?focus=search')}
                  className="h-12 sm:h-13 px-7 sm:px-8 rounded-full bg-white text-slate-950 hover:bg-slate-100 font-extrabold text-sm sm:text-base shadow-xl shadow-black/40 flex items-center justify-center gap-2 group transition-all active:scale-95 cursor-pointer"
                  style={{
                    boxShadow: `0 10px 30px -5px ${currentTheme.accentGlow}`
                  }}
                >
                  <span>{currentSlide.buttonText || 'Check Repair Price'}</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform shrink-0" />
                </Button>

                <Button 
                  onClick={() => navigate(currentSlide.buttonSecondaryLink || '/track')}
                  className="h-12 sm:h-13 px-7 sm:px-8 rounded-full bg-slate-900/80 hover:bg-slate-800/95 backdrop-blur-md border border-slate-700/70 text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer shadow-md"
                >
                  <span>{currentSlide.buttonSecondaryText || 'Track Repair Status'}</span>
                </Button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom Carousel Controls: Counter, Progress Indicators, Play/Pause, and Previous/Next Buttons */}
        <div className="flex items-center justify-between w-full pt-4">
          
          {/* Left: Numeric Slide Counter & Segmented Progress Bar & Accessible Pause Toggle */}
          <div className="flex items-center gap-3 sm:gap-5">
            {/* Numeric Counter e.g. 04 / 04 */}
            <div className="flex items-baseline gap-1 font-mono select-none">
              <span className="font-black text-white text-base sm:text-lg tracking-tight">
                {String(activeIndex + 1).padStart(2, '0')}
              </span>
              <span className="text-slate-500 font-bold text-xs sm:text-sm">
                / {String(total).padStart(2, '0')}
              </span>
            </div>

            {/* Segmented Progress Indicators */}
            {total > 1 && (
              <div className="flex items-center gap-1.5 sm:gap-2">
                {slides.map((_, i) => {
                  const isActive = activeIndex === i;
                  return (
                    <button
                      key={i}
                      onClick={() => goToSlide(i)}
                      aria-label={`Go to slide ${i + 1}`}
                      className={cn(
                        "h-1.5 sm:h-2 rounded-full transition-all duration-300 cursor-pointer overflow-hidden relative",
                        isActive 
                          ? "w-8 sm:w-11 bg-white/30" 
                          : "w-4 sm:w-6 bg-white/20 hover:bg-white/40"
                      )}
                    >
                      {isActive && (
                        <div
                          key={`progress-${activeIndex}-${progressKey}`}
                          className="h-full bg-white rounded-full"
                          style={{
                            animationName: prefersReducedMotion ? 'none' : 'heroSlideProgressAnim',
                            animationDuration: `${AUTOPLAY_INTERVAL}ms`,
                            animationTimingFunction: 'linear',
                            animationFillMode: 'forwards',
                            animationPlayState: isEffectivelyPaused ? 'paused' : 'running',
                            width: prefersReducedMotion ? '100%' : undefined
                          }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Accessible WCAG 2.2.2 Pause / Play Autoplay Toggle */}
            {total > 1 && (
              <button
                type="button"
                onClick={() => setIsManuallyPaused(prev => !prev)}
                aria-label={isManuallyPaused ? "Resume automatic slideshow" : "Pause automatic slideshow"}
                className="w-8 h-8 rounded-full bg-slate-900/70 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                title={isManuallyPaused ? "Resume slideshow" : "Pause slideshow"}
              >
                {isManuallyPaused ? (
                  <Play className="w-3.5 h-3.5 fill-current" />
                ) : (
                  <Pause className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>

          {/* Right: Circular Navigation Previous & Next Buttons */}
          {total > 1 && (
            <div className="flex items-center gap-2 sm:gap-3">
              <button 
                onClick={prev}
                aria-label="Previous Slide"
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 text-white flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button 
                onClick={next}
                aria-label="Next Slide"
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 text-white flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
