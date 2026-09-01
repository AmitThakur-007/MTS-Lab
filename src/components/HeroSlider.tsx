import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  ShieldCheck, 
  Wrench, 
  ArrowRight,
  Clock,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { api } from '@/services/api';
import { useRealtimeSync } from '@/services/realtime';

export interface SlideData {
  id?: string;
  title: string;
  description: string;
  imageUrl: string;
  buttonText?: string;
  buttonLink?: string;
  displayOrder?: number;
  status?: string;
}

const FALLBACK_SLIDES: SlideData[] = [
  {
    id: 'default-1',
    title: 'Front Glass Change',
    description: 'Specialized outer glass replacement preserving your original AMOLED / OLED display and touch responsiveness.',
    imageUrl: '/assets/images/front-glass-change.jpg',
    buttonText: 'Check Repair Price',
    buttonLink: '/services?focus=search&q=Front+Glass'
  },
  {
    id: 'default-2',
    title: 'Display Replacement',
    description: '100% Genuine original quality screen restoration with True Tone, 120Hz ProMotion, and vibrant clarity.',
    imageUrl: '/assets/images/display-replacement.jpg',
    buttonText: 'Check Repair Price',
    buttonLink: '/services?focus=search&q=Display'
  },
  {
    id: 'default-3',
    title: 'Back Panel / Back Glass Change',
    description: 'Factory finish laser back panel replacement and frame restoration for Apple, Samsung, and flagship devices.',
    imageUrl: '/assets/images/back-glass-change.jpg',
    buttonText: 'Check Repair Price',
    buttonLink: '/services?focus=search&q=Back+Glass'
  },
  {
    id: 'default-4',
    title: 'Professional Smartphone Repair',
    description: 'Advanced IC-level micro-soldering, green/white screen laser line repair, and specialized liquid damage restoration.',
    imageUrl: '/assets/images/motherboard-repair.jpg',
    buttonText: 'Check Repair Price',
    buttonLink: '/services?focus=search'
  }
];

export default function HeroSlider() {
  const [slides, setSlides] = useState<SlideData[]>(FALLBACK_SLIDES);
  const [hasLoadedFromApi, setHasLoadedFromApi] = useState(false);
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const touchStartX = useRef<number | null>(null);

  // Authoritative data fetch from backend API
  const loadSlides = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get('/slides');
      if (Array.isArray(data)) {
        setSlides(data);
        setHasLoadedFromApi(true);
      }
    } catch (err) {
      console.warn('[HERO SLIDER] Could not fetch live slides, keeping current view:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadSlides();
  }, [loadSlides]);

  // Live Multi-device Real-Time Synchronization via Supabase & SSE Broadcast
  useRealtimeSync(['homeSlide', 'slide', 'slides'], () => {
    loadSlides();
  });

  // Re-check on window focus to ensure fresh state across tabs
  useEffect(() => {
    const handleFocus = () => loadSlides();
    window.addEventListener('focus', handleFocus);
    window.addEventListener('mts-realtime-update', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('mts-realtime-update', handleFocus);
    };
  }, [loadSlides]);

  // Safely clamp active index whenever slides list changes
  useEffect(() => {
    if (slides.length > 0 && current >= slides.length) {
      setCurrent(0);
    }
  }, [slides.length, current]);

  const total = slides.length;

  const next = useCallback(() => {
    if (total <= 1) return;
    setCurrent((prev) => (prev === total - 1 ? 0 : prev + 1));
  }, [total]);

  const prev = useCallback(() => {
    if (total <= 1) return;
    setCurrent((prev) => (prev === 0 ? total - 1 : prev - 1));
  }, [total]);

  // Auto-play interval
  useEffect(() => {
    if (isPaused || total <= 1) return;
    const timer = setInterval(next, 6000);
    return () => clearInterval(timer);
  }, [next, isPaused, total]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [next, prev]);

  // Touch Swipe Handlers for Mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;

    if (diff > 50) {
      next(); // Swiped left -> next slide
    } else if (diff < -50) {
      prev(); // Swiped right -> prev slide
    }
    touchStartX.current = null;
  };

  // If database explicitly returned empty active slides list
  if (hasLoadedFromApi && slides.length === 0) {
    return (
      <div className="relative w-full overflow-hidden rounded-[28px] sm:rounded-[40px] md:rounded-[48px] shadow-2xl shadow-slate-950/20 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 min-h-[480px] sm:min-h-[520px] flex items-center justify-center p-8 sm:p-14 text-center">
        <div className="max-w-2xl mx-auto space-y-6 text-white">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs font-bold uppercase tracking-widest">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            <span>MTS Lab — Master Repair Center</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
            Nepal's Premier Smartphone Repair Specialists
          </h1>

          <p className="text-base sm:text-lg text-slate-300 max-w-xl mx-auto leading-relaxed">
            From cracked AMOLED screens and laser back glass to motherboard IC micro-soldering, our central lab restores your device to factory perfection.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button
              onClick={() => navigate('/services?focus=search')}
              className="h-12 px-7 rounded-2xl bg-white text-slate-950 hover:bg-slate-100 font-extrabold text-sm shadow-lg flex items-center gap-2"
            >
              <Search className="h-4 w-4" />
              <span>Find Repair Rate</span>
            </Button>
            <Button
              onClick={() => navigate('/track')}
              variant="outline"
              className="h-12 px-7 rounded-2xl border-white/30 bg-white/10 hover:bg-white/20 text-white font-bold text-sm"
            >
              Track Device Status
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const activeIndex = Math.min(current, Math.max(0, slides.length - 1));
  const currentSlide = slides[activeIndex] || FALLBACK_SLIDES[0];

  return (
    <div 
      className="relative w-full overflow-hidden rounded-[28px] sm:rounded-[40px] md:rounded-[48px] shadow-2xl shadow-slate-950/20 bg-slate-950 min-h-[560px] sm:min-h-[620px] lg:min-h-[660px] flex items-center select-none"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSlide.id || activeIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          {/* Background Image with subtle zoom */}
          <motion.div 
            initial={{ scale: 1.05 }}
            animate={{ scale: 1 }}
            transition={{ duration: 7, ease: "easeOut" }}
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${currentSlide.imageUrl})` }}
          />

          {/* High-grade Multilayer Gradient Overlay for pristine text legibility */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-slate-950/40 md:bg-gradient-to-r md:from-slate-950 md:via-slate-950/85 md:to-transparent" />
          <div className="absolute inset-0 bg-black/25 backdrop-blur-[0.5px]" />

          {/* Slide Content */}
          <div className="relative h-full flex flex-col justify-center px-6 sm:px-12 md:px-16 lg:px-20 py-16 max-w-3xl z-10">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.12, duration: 0.45 }}
              className="space-y-6"
            >
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs font-bold uppercase tracking-widest">
                <Wrench className="h-3.5 w-3.5 text-amber-400" />
                <span>MTS Lab — Smartphone Repair</span>
              </div>

              {/* Title */}
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.15] text-balance">
                {currentSlide.title}
              </h1>

              {/* Description */}
              <p className="text-base sm:text-lg lg:text-xl text-slate-200/90 font-medium leading-relaxed max-w-2xl text-balance">
                {currentSlide.description}
              </p>

              {/* Features Pill Row */}
              <div className="flex flex-wrap gap-2 pt-1 text-xs font-semibold text-slate-300">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/5 border border-white/10 backdrop-blur-xs">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> 24-Point Tested
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/5 border border-white/10 backdrop-blur-xs">
                  <Clock className="h-3.5 w-3.5 text-sky-400" /> 60-Min Express Fix
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/5 border border-white/10 backdrop-blur-xs">
                  <Wrench className="h-3.5 w-3.5 text-amber-400" /> Certified Techs
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-2">
                <Button 
                  onClick={() => navigate(currentSlide.buttonLink || '/services?focus=search')}
                  className="h-13 sm:h-14 px-7 sm:px-8 rounded-2xl bg-white text-slate-950 hover:bg-slate-100 font-extrabold text-base shadow-xl shadow-black/30 flex items-center justify-center gap-2 group cursor-pointer"
                >
                  <Search className="h-4 w-4" />
                  <span>{currentSlide.buttonText || 'Check Repair Price'}</span>
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>

                <Button 
                  onClick={() => navigate('/track')}
                  variant="outline" 
                  className="h-13 sm:h-14 px-7 sm:px-8 rounded-2xl border-white/30 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white font-bold text-base flex items-center justify-center gap-2 cursor-pointer"
                >
                  Track Repair Status
                </Button>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation Arrows (rendered if more than 1 slide) */}
      {total > 1 && (
        <div className="absolute bottom-8 right-6 sm:right-10 flex items-center gap-3 z-20">
          <button 
            onClick={prev}
            aria-label="Previous Slide"
            className="w-12 h-12 rounded-full bg-slate-900/80 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-white hover:text-slate-950 transition-all shadow-lg active:scale-95 cursor-pointer"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button 
            onClick={next}
            aria-label="Next Slide"
            className="w-12 h-12 rounded-full bg-slate-900/80 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-white hover:text-slate-950 transition-all shadow-lg active:scale-95 cursor-pointer"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Progress Dots Indicators */}
      {total > 1 && (
        <div className="absolute bottom-8 left-6 sm:left-12 flex items-center gap-2.5 z-20">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={cn(
                "h-2 rounded-full transition-all duration-300 cursor-pointer",
                activeIndex === i 
                  ? "w-8 sm:w-10 bg-white shadow-sm" 
                  : "w-2 sm:w-2.5 bg-white/40 hover:bg-white/70"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}

