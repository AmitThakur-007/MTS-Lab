import { useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import HeroSlider from '@/components/HeroSlider';
import {
  Search,
  Smartphone,
  Battery,
  Zap,
  ArrowRight,
  ShieldCheck,
  Clock,
  Wrench,
  Camera,
  Volume2,
  Cpu,
  Layers,
  ScanLine,
  Cable,
  Tv,
  Droplets,
  PhoneCall,
  MessageCircle,
  MapPin,
  Mail,
  CheckCircle2,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  History
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion } from 'motion/react';
import { useNavigate, Link } from 'react-router-dom';

// Popular Repair Categories with specialized icons and descriptions
const POPULAR_REPAIR_CATEGORIES = [
  {
    name: 'Display',
    searchParam: 'Display',
    icon: Smartphone,
    desc: 'Full screen replacement with genuine 120Hz AMOLED & True Tone clarity.',
    badge: 'Popular',
    accentColor: 'text-sky-600 bg-sky-50 border-sky-200'
  },
  {
    name: 'Front Glass',
    searchParam: 'Front Glass',
    icon: Smartphone,
    desc: 'High-precision OCA lamination replacing cracked glass while keeping original panel.',
    badge: 'Top Pick',
    accentColor: 'text-teal-600 bg-teal-50 border-teal-200'
  },
  {
    name: 'Lining',
    searchParam: 'Lining',
    icon: ScanLine,
    desc: 'Specialized laser micro-welding removing green & pink vertical screen lines.',
    badge: 'Speciality',
    accentColor: 'text-orange-600 bg-orange-50 border-orange-200'
  },
  {
    name: 'Flex Change',
    searchParam: 'Flex Change',
    icon: Cable,
    desc: 'FPC ribbon cable replacement restoring charging, audio, display, and power lines.',
    badge: 'Hardware',
    accentColor: 'text-amber-600 bg-amber-50 border-amber-200'
  },
  {
    name: 'Green / White Screen',
    searchParam: 'Green / White Screen',
    icon: Tv,
    desc: 'Display controller micro-jumper restore for post-update screen death (WSOD).',
    badge: 'Advanced',
    accentColor: 'text-emerald-600 bg-emerald-50 border-emerald-200'
  },
  {
    name: 'Battery',
    searchParam: 'Battery',
    icon: Battery,
    desc: 'Certified high-capacity battery replacements with 100% health calibration.',
    badge: 'Quick Fix',
    accentColor: 'text-emerald-600 bg-emerald-50 border-emerald-200'
  },
  {
    name: 'Charging',
    searchParam: 'Charging',
    icon: Zap,
    desc: 'Type-C / Lightning port repairs, slow charging fix, and moisture fault recovery.',
    badge: 'Essential',
    accentColor: 'text-indigo-600 bg-indigo-50 border-indigo-200'
  },
  {
    name: 'Camera',
    searchParam: 'Camera',
    icon: Camera,
    desc: 'Lens glass replacement, OIS optical stabilizer repair, and sensor restoration.',
    badge: 'Precision',
    accentColor: 'text-purple-600 bg-purple-50 border-purple-200'
  },
  {
    name: 'Back Glass',
    searchParam: 'Back Glass',
    icon: Layers,
    desc: 'Laser-assisted rear panel and frame restoration without disassembling the device.',
    badge: 'Laser Finish',
    accentColor: 'text-slate-700 bg-slate-100 border-slate-200'
  },
  {
    name: 'Speaker',
    searchParam: 'Speaker',
    icon: Volume2,
    desc: 'Earpiece distortion fix, loudspeaker replacement, and mesh ultrasonic cleaning.',
    badge: 'Audio',
    accentColor: 'text-rose-600 bg-rose-50 border-rose-200'
  },
  {
    name: 'Motherboard / IC',
    searchParam: 'Motherboard / IC',
    icon: Cpu,
    desc: 'Micro-soldering, power IC, audio IC, baseband, and liquid damage logic fix.',
    badge: 'Master Lab',
    accentColor: 'text-violet-600 bg-violet-50 border-violet-200'
  },
  {
    name: 'Water Damage',
    searchParam: 'Water Damage',
    icon: Droplets,
    desc: 'Emergency ultrasonic deoxidation, chemical corrosion cleaning, and board revive.',
    badge: 'Revival',
    accentColor: 'text-blue-600 bg-blue-50 border-blue-200'
  },
  {
    name: 'Software',
    searchParam: 'Software',
    icon: Cpu,
    desc: 'Bootloop fix, official firmware flashing, data recovery, and system debugging.',
    badge: 'Diagnostics',
    accentColor: 'text-pink-600 bg-pink-50 border-pink-200'
  }
];

const VALUE_PILLARS = [
  {
    title: 'Master IC Micro-Soldering',
    desc: 'Our specialized technicians fix motherboards and power chips that other repair shops claim are dead.',
    icon: Cpu,
    color: 'text-indigo-600 bg-indigo-50'
  },
  {
    title: 'Original OEM Components',
    desc: 'We strictly utilize 100% genuine and certified Grade-A parts for longevity and uncompromised performance.',
    icon: ShieldCheck,
    color: 'text-emerald-600 bg-emerald-50'
  },
  {
    title: 'Factory OCA Glass Lamination',
    desc: 'Replace only the broken outer glass while preserving your original vibrant AMOLED screen and factory touch.',
    icon: Layers,
    color: 'text-blue-600 bg-blue-50'
  },
  {
    title: '60-Minute Express Turnaround',
    desc: 'Most common repairs like screens, batteries, and charging ports are completed swiftly while you wait.',
    icon: Clock,
    color: 'text-amber-600 bg-amber-50'
  },
  {
    title: '24-Point Quality Inspection',
    desc: 'Every repair undergoes rigorous multi-point functional diagnostics with dedicated after-service support.',
    icon: Wrench,
    color: 'text-teal-600 bg-teal-50'
  },
  {
    title: 'Live Real-Time Repair Tracking',
    desc: 'Check live technician notes, repair progress stages, and estimated completion online anytime.',
    icon: Smartphone,
    color: 'text-purple-600 bg-purple-50'
  }
];

const WORKFLOW_STEPS = [
  {
    step: '01',
    title: 'Find Your Repair Price',
    desc: 'Search our transparent price catalogue by device model (Apple, Samsung, Xiaomi, OnePlus, Pixel).'
  },
  {
    step: '02',
    title: 'Drop Off or Courier',
    desc: 'Visit our central New Road lab in Kathmandu or send your smartphone via courier from anywhere in Nepal.'
  },
  {
    step: '03',
    title: 'Precision Diagnosis & Repair',
    desc: 'Certified engineers inspect under microscopic magnification and perform factory-standard repairs.'
  },
  {
    step: '04',
    title: 'Test & Verified Handover',
    desc: 'Complete 24-point quality inspection and live functional verification before handover.'
  }
];

export default function Home() {
  const [quickSearch, setQuickSearch] = useState('');
  const navigate = useNavigate();

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickSearch.trim()) {
      navigate(`/services?q=${encodeURIComponent(quickSearch.trim())}&focus=search`);
    } else {
      navigate('/services?focus=search');
    }
  };

  const handleCategoryClick = (categoryName: string) => {
    navigate(`/services?q=${encodeURIComponent(categoryName)}&focus=search`);
  };

  return (
    <div className="min-h-screen bg-[#fafafa] text-slate-900 selection:bg-slate-900 selection:text-white">
      <Navbar />

      <main className="pt-24 sm:pt-28 px-4 sm:px-8 lg:px-12 pb-24">
        <div className="max-w-7xl mx-auto space-y-20 sm:space-y-28">

          {/* ========================================================= */}
          {/* 1. HERO SECTION & DYNAMIC SMARTPHONE REPAIR SLIDESHOW     */}
          {/* ========================================================= */}
          <section className="space-y-8">
            <HeroSlider />

            {/* Quick Actions Bar below Hero: Price Finder & Track Repair */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

              {/* Quick Price Finder Bar */}
              <div className="lg:col-span-8 p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white border border-slate-200/80 shadow-lg shadow-slate-900/5 flex flex-col justify-center">
                <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="w-10 h-10 rounded-xl bg-slate-950 text-white flex items-center justify-center shrink-0">
                      <Search className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm sm:text-base text-slate-900 leading-tight">
                        Repair Price Finder
                      </h3>
                      <p className="text-xs text-slate-500 hidden sm:block">
                        Search rates for iPhone, Samsung, OnePlus & Xiaomi.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto flex-1 max-w-md">
                    <div className="relative flex-1">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        id="home-quick-repair-search-input"
                        placeholder="Device or repair (e.g. S23 Display)..."
                        value={quickSearch}
                        onChange={(e) => setQuickSearch(e.target.value)}
                        className="h-11 sm:h-12 pl-10 pr-4 rounded-xl border-slate-200 bg-slate-50/70 focus:bg-white text-sm font-medium transition-all"
                      />
                    </div>
                    <Button
                      type="submit"
                      id="home-quick-search-button"
                      className="h-11 sm:h-12 px-5 sm:px-6 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-sm shrink-0 cursor-pointer shadow-sm"
                    >
                      Find Price
                    </Button>
                  </div>
                </form>
              </div>

              {/* Dedicated Track Repair Card */}
              <div className="lg:col-span-4 p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-slate-950 text-white border border-slate-800 shadow-lg flex items-center justify-between gap-3 sm:gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-white/10 text-amber-400 flex items-center justify-center shrink-0">
                    <History className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm sm:text-base text-white leading-tight truncate">
                      Track Repair Status
                    </h3>
                    <p className="text-xs text-slate-400 truncate">
                      Live lab diagnostics & pickup
                    </p>
                  </div>
                </div>

                <Link
                  to="/track"
                  id="home-track-repair-btn"
                  className="inline-flex items-center justify-center gap-1.5 h-11 sm:h-12 px-4 sm:px-5 rounded-xl bg-white hover:bg-slate-100 active:scale-[0.98] text-slate-950 font-bold text-xs sm:text-sm shrink-0 shadow-sm transition-all cursor-pointer"
                  aria-label="Track your repair status"
                >
                  <Search className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>Track</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </Link>
              </div>

            </div>
          </section>

          {/* ========================================================= */}
          {/* 2. POPULAR REPAIR SERVICES (12 ESSENTIAL CATEGORIES)      */}
          {/* ========================================================= */}
          <section id="services" className="space-y-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 text-white text-[11px] font-bold uppercase tracking-widest">
                  <Wrench className="h-3.5 w-3.5 text-amber-400" />
                  MTS Lab Specialities
                </div>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-950 tracking-tight">
                  Popular Repair Services
                </h2>
                <p className="text-slate-600 max-w-2xl text-base sm:text-lg font-medium">
                  Select a category to view active repair price records and schedule service for your smartphone.
                </p>
              </div>

              <Button
                onClick={() => navigate('/services?focus=search')}
                variant="outline"
                className="h-11 px-5 rounded-xl border-slate-300 hover:bg-slate-100 font-bold text-sm text-slate-900 gap-2 shrink-0 self-start md:self-auto"
              >
                View Full Price Catalogue <ArrowRight className="h-4 w-4" />
              </Button>
            </div>

            {/* 12 Category Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              {POPULAR_REPAIR_CATEGORIES.map((category, index) => {
                const IconComponent = category.icon;
                return (
                  <motion.div
                    key={category.name}
                    initial={{ opacity: 0, y: 15 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.03, duration: 0.3 }}
                  >
                    <button
                      onClick={() => handleCategoryClick(category.searchParam)}
                      className="w-full text-left p-5 sm:p-6 rounded-2xl sm:rounded-3xl bg-white border border-slate-200/90 hover:border-slate-400 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between h-full group cursor-pointer"
                    >
                      <div className="space-y-4 w-full">
                        <div className="flex items-center justify-between">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 ${category.accentColor}`}>
                            <IconComponent className="h-6 w-6" />
                          </div>
                          <Badge variant="outline" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50 border-slate-200">
                            {category.badge}
                          </Badge>
                        </div>

                        <div className="space-y-1.5">
                          <h3 className="font-bold text-lg sm:text-xl text-slate-900 group-hover:text-indigo-600 transition-colors">
                            {category.name}
                          </h3>
                          <p className="text-xs sm:text-sm text-slate-500 line-clamp-2 leading-relaxed font-normal">
                            {category.desc}
                          </p>
                        </div>
                      </div>

                      <div className="pt-4 mt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-700 group-hover:text-indigo-600">
                        <span>Check Price</span>
                        <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </button>
                  </motion.div>
                );
              })}
            </div>
          </section>

          {/* ========================================================= */}
          {/* 3. WHY CHOOSE MTS LAB (TRUST & QUALITY PILLARS)           */}
          {/* ========================================================= */}
          <section className="p-8 sm:p-12 lg:p-16 rounded-[32px] sm:rounded-[48px] bg-slate-950 text-white relative overflow-hidden shadow-2xl">
            <div className="max-w-6xl mx-auto space-y-12 sm:space-y-16 relative z-10">
              <div className="text-center space-y-4 max-w-3xl mx-auto">
                <Badge variant="secondary" className="px-3.5 py-1 rounded-full bg-white/10 text-white border border-white/20 text-xs font-bold uppercase tracking-widest">
                  Engineering Precision
                </Badge>
                <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
                  Why Customers Choose MTS Lab
                </h2>
                <p className="text-slate-300 text-base sm:text-lg font-medium leading-relaxed">
                  Nepal's state-of-the-art laboratory equipped with cleanroom laminators, laser separators, and micro-soldering stations.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                {VALUE_PILLARS.map((pillar, idx) => {
                  const Icon = pillar.icon;
                  return (
                    <div
                      key={idx}
                      className="p-6 rounded-2xl sm:rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xs space-y-4 hover:bg-white/10 transition-colors"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white">
                        <Icon className="h-6 w-6 text-amber-400" />
                      </div>
                      <h3 className="text-xl font-bold text-white tracking-tight">
                        {pillar.title}
                      </h3>
                      <p className="text-sm text-slate-300 leading-relaxed">
                        {pillar.desc}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Trust Stat Bar */}
              <div className="pt-8 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
                <div>
                  <span className="block text-3xl sm:text-4xl font-extrabold text-white">99%</span>
                  <span className="text-xs sm:text-sm text-slate-400 font-medium">Repair Success Rate</span>
                </div>
                <div>
                  <span className="block text-3xl sm:text-4xl font-extrabold text-white">25,000+</span>
                  <span className="text-xs sm:text-sm text-slate-400 font-medium">Devices Restored</span>
                </div>
                <div>
                  <span className="block text-3xl sm:text-4xl font-extrabold text-white">60 Min</span>
                  <span className="text-xs sm:text-sm text-slate-400 font-medium">Express Service Time</span>
                </div>
                <div>
                  <span className="block text-3xl sm:text-4xl font-extrabold text-white">24-Point</span>
                  <span className="text-xs sm:text-sm text-slate-400 font-medium">Lab Quality Check</span>
                </div>
              </div>
            </div>

            {/* Subtle glow backdrops */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/20 blur-[130px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-500/15 blur-[130px] rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none" />
          </section>

          {/* ========================================================= */}
          {/* 4. HOW IT WORKS (4 SIMPLE STEPS)                          */}
          {/* ========================================================= */}
          <section className="space-y-10">
            <div className="text-center space-y-3 max-w-2xl mx-auto">
              <Badge variant="outline" className="px-3 py-1 rounded-full text-slate-600 border-slate-300 text-[11px] font-bold uppercase tracking-widest">
                Simple & Transparent
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                How MTS Lab Repair Works
              </h2>
              <p className="text-slate-500 text-sm sm:text-base font-medium">
                Get your smartphone repaired with 100% transparency and zero hidden surprises.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {WORKFLOW_STEPS.map((step, idx) => (
                <div
                  key={idx}
                  className="p-6 rounded-2xl sm:rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-4 relative flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <span className="inline-block text-3xl sm:text-4xl font-black text-slate-300">
                      {step.step}
                    </span>
                    <h3 className="font-bold text-lg text-slate-900">
                      {step.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                      {step.desc}
                    </p>
                  </div>

                  <div className="w-8 h-1 bg-slate-900 rounded-full mt-4" />
                </div>
              ))}
            </div>
          </section>

          {/* ========================================================= */}
          {/* 5. CONTACT & DIRECT REPAIR INQUIRIES                      */}
          {/* ========================================================= */}
          <section id="contact" className="p-8 sm:p-12 rounded-[32px] sm:rounded-[40px] bg-gradient-to-br from-slate-900 to-slate-950 text-white border border-slate-800 shadow-xl">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-bold uppercase tracking-widest">
                  <PhoneCall className="h-3.5 w-3.5 text-emerald-400" />
                  We are here to help
                </div>

                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight">
                  Need Help with Your Device? Contact MTS Lab Today.
                </h2>

                <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                  Call our customer hotline or send us a direct message on Facebook for rapid troubleshooting advice and quote estimates.
                </p>

                <div className="flex flex-wrap gap-4 pt-2">
                  <a
                    href="tel:+9779869276668"
                    className="inline-flex items-center gap-2.5 h-13 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-sm sm:text-base shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
                  >
                    <PhoneCall className="h-4 w-4" />
                    <span>Call Now: +977 9869276668</span>
                  </a>

                  <a
                    href="https://www.facebook.com/MTSmobilescreenrefurblab"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2.5 h-13 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm sm:text-base shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
                  >
                    <MessageCircle className="h-4 w-4" />
                    <span>Message on Facebook</span>
                  </a>
                </div>
              </div>

              {/* Lab Location & Timings Card */}
              <div className="p-5 sm:p-7 md:p-8 rounded-2xl sm:rounded-3xl bg-white/10 border border-white/15 backdrop-blur-md space-y-5 sm:space-y-6">
                <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-rose-400 shrink-0" />
                  <span>Visit MTS Lab Service Center</span>
                </h3>

                <div className="space-y-3.5 sm:space-y-4 text-xs sm:text-sm text-slate-300">
                  <div className="flex flex-col xs:flex-row xs:items-start gap-1 xs:gap-3">
                    <span className="font-bold text-white xs:w-28 shrink-0 flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-rose-400 shrink-0 hidden xs:inline" />
                      <span>Lab Address:</span>
                    </span>
                    <span className="text-slate-200">New Road, Kathmandu, Nepal (Near Central Square)</span>
                  </div>

                  <div className="flex flex-col xs:flex-row xs:items-start gap-1 xs:gap-3">
                    <span className="font-bold text-white xs:w-28 shrink-0 flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-amber-400 shrink-0 hidden xs:inline" />
                      <span>Opening Hours:</span>
                    </span>
                    <span className="text-slate-200">
                      Sunday – Friday: 10:30 AM – 7:30 PM<br />Saturday: 2PM – 5:30 PM
                    </span>
                  </div>

                  <div className="flex flex-col xs:flex-row xs:items-start gap-1 xs:gap-3 min-w-0">
                    <span className="font-bold text-white xs:w-28 shrink-0 flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-indigo-400 shrink-0 hidden xs:inline" />
                      <span>Support Email Address:</span>
                    </span>
                    <a
                      href="mailto:mtslabcustomerservice@gmail.com"
                      className="text-indigo-300 hover:text-white hover:underline underline-offset-4 transition-colors font-medium break-all sm:break-normal inline-block min-w-0 max-w-full"
                    >
                      mtslabcustomerservice@gmail.com
                    </a>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <span className="text-xs text-slate-400">Track your pending ticket?</span>
                  <Button
                    onClick={() => navigate('/track')}
                    variant="outline"
                    size="sm"
                    className="rounded-xl border-white/20 bg-white/5 hover:bg-white/15 text-white font-bold text-xs shrink-0 cursor-pointer"
                  >
                    Track Repair Status
                  </Button>
                </div>
              </div>
            </div>
          </section>

        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
