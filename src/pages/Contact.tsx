import { motion } from 'motion/react';
import { 
  MapPin, 
  PhoneCall, 
  Mail, 
  Clock, 
  ExternalLink, 
  MessageSquare, 
  Compass, 
  HelpCircle, 
  HeartHandshake,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function Contact() {
  return (
    <div className="min-h-screen bg-slate-50/50 font-sans text-slate-850 leading-relaxed selection:bg-indigo-600 selection:text-white flex flex-col">
      <Navbar />

      {/* 1. Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 bg-slate-900 border-b border-slate-800 overflow-hidden">
        {/* Decorative background gradients */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-1/2 -right-1/4 w-[75%] h-[150%] rounded-full bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.12),transparent_60%)] blur-3xl" />
          <div className="absolute -bottom-1/2 -left-1/4 w-[75%] h-[150%] rounded-full bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.06),transparent_60%)] blur-3xl" />
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />
        </div>

        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="space-y-4"
          >
            <Badge className="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/25 px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase inline-flex items-center gap-1.5 shadow-inner">
              <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" /> Nepal's Premium Repair Support
            </Badge>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white tracking-tight leading-none max-w-4xl mx-auto select-none">
              Contact <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-indigo-300 bg-clip-text text-transparent">MTS Lab</span>
            </h1>

            <p className="text-slate-350 text-base sm:text-lg md:text-xl max-w-2xl mx-auto font-medium leading-relaxed">
              We are here to help you with all smartphone repair inquiries and support.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-6 py-12 md:py-16 -mt-12 relative z-20 space-y-16">
        
        {/* 2. Contact Information Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 items-stretch">
          
          {/* Card 1: Geographic Location */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            whileHover={{ y: -5 }}
            className="group"
          >
            <Card className="rounded-[32px] border border-slate-100 shadow-xl shadow-slate-100/50 bg-white h-full flex flex-col justify-between overflow-hidden">
              <CardContent className="p-8 space-y-6 flex-grow">
                <div className="h-14 w-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center border border-indigo-100/30 shadow-sm shrink-0 transition-colors group-hover:bg-indigo-600 group-hover:text-white">
                  <MapPin className="h-6 w-6" />
                </div>
                <div className="space-y-3">
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Our Laboratory</h3>
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Headquarters Location</p>
                  <p className="text-slate-600 font-semibold text-sm sm:text-base leading-relaxed">
                    Pakosadak, Newroad, Kathmandu, Nepal
                  </p>
                  <p className="text-xs text-indigo-600 font-extrabold flex items-center gap-1.5 pt-2">
                    <Compass className="h-4 w-4" /> Opposite people's plaza back gate
                  </p>
                </div>
              </CardContent>
              <div className="px-8 py-5 bg-slate-50/50 border-t border-slate-50/80 mt-auto flex items-center justify-between text-xs text-slate-400 font-bold">
                <span>Central Zone (Kathmandu)</span>
                <a 
                  href="https://maps.app.goo.gl/baP5yg6qgcgBT7neA" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-indigo-600 font-extrabold hover:underline flex items-center gap-1"
                >
                  View Map <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </Card>
          </motion.div>

          {/* Card 2: Call and Connect Hotlines */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.15 }}
            whileHover={{ y: -5 }}
            className="group"
          >
            <Card className="rounded-[32px] border border-slate-100 shadow-xl shadow-slate-100/50 bg-white h-full flex flex-col justify-between overflow-hidden">
              <CardContent className="p-8 space-y-6 flex-grow">
                <div className="h-14 w-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center border border-emerald-100/30 shadow-sm shrink-0 transition-colors group-hover:bg-emerald-600 group-hover:text-white">
                  <PhoneCall className="h-6 w-6" />
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-sans">Support Hotlines</h3>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Direct Mobile & Landline connections</p>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-3 pt-1">
                    <a 
                      href="tel:9869276668" 
                      className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-100 hover:border-indigo-100 hover:bg-slate-50/60 transition-all font-bold text-slate-800 text-sm group/btn"
                    >
                      <span className="flex items-center gap-2">
                        <PhoneCall className="h-4 w-4 text-indigo-500" />
                        9869276668 (Mobile)
                      </span>
                      <ChevronRight className="h-4 w-4 text-slate-300 group-hover/btn:translate-x-1 transition-transform" />
                    </a>
                    
                    <a 
                      href="tel:015364307" 
                      className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-100 hover:border-indigo-100 hover:bg-slate-50/60 transition-all font-bold text-slate-800 text-sm group/btn"
                    >
                      <span className="flex items-center gap-2">
                        <PhoneCall className="h-4 w-4 text-indigo-500" />
                        015364307 (Landline)
                      </span>
                      <ChevronRight className="h-4 w-4 text-slate-300 group-hover/btn:translate-x-1 transition-transform" />
                    </a>
                  </div>
                </div>
              </CardContent>
              <div className="px-8 py-5 bg-slate-50/50 border-t border-slate-50/80 mt-auto flex items-center justify-between text-xs text-slate-400 font-bold">
                <span>Click numbers to call directly</span>
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
            </Card>
          </motion.div>

          {/* Card 3: Mail & Business Hours */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            whileHover={{ y: -5 }}
            className="group"
          >
            <Card className="rounded-[32px] border border-slate-100 shadow-xl shadow-slate-100/50 bg-white h-full flex flex-col justify-between overflow-hidden">
              <CardContent className="p-8 space-y-6 flex-grow">
                <div className="h-14 w-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center border border-amber-100/30 shadow-sm shrink-0 transition-colors group-hover:bg-amber-600 group-hover:text-white">
                  <Clock className="h-6 w-6" />
                </div>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Hours & Email</h3>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Corporate Availability</p>
                  </div>
                  
                  <div className="space-y-3.5 text-sm font-bold text-slate-600 leading-relaxed">
                    <div className="flex items-start gap-3">
                      <Mail className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold">Inbox Support</p>
                        <a 
                          href="mailto:mtslabcustomerservice@gmail.com" 
                          className="text-slate-800 hover:text-indigo-650 transition-colors block break-all font-bold underline decoration-slate-200 underline-offset-4"
                        >
                          mtslabcustomerservice@gmail.com
                        </a>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <Clock className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold">Service Lab Hours</p>
                        <p className="text-slate-800 font-bold">Sun - Fri: 10:30 AM - 7:30 PM</p>
                        <p className="text-xs text-amber-600 font-medium">Saturday Recess & Staff Rest</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
              <div className="px-8 py-5 bg-slate-50/50 border-t border-slate-50/80 mt-auto flex items-center justify-between text-xs text-slate-400 font-bold">
                <span>Response within 24 hours</span>
                <ChevronRight className="h-4 w-4 text-slate-300" />
              </div>
            </Card>
          </motion.div>

        </div>

        {/* 3. Our Location Section (Replaces broken map with pristine Location Card) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="space-y-6 animate-in fade-in-50 duration-500"
        >
          <div className="space-y-1.5 text-center sm:text-left">
            <Badge className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 border-none px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest">
              Physical Location
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Geographic Navigation</h2>
            <p className="text-slate-500 font-medium text-xs sm:text-sm md:text-base leading-relaxed">
              Find physical directions to our main headquarters and labs.
            </p>
          </div>

          <div className="bg-white rounded-[32px] p-8 md:p-10 border border-slate-100 shadow-xl overflow-hidden relative grid grid-cols-1 md:grid-cols-12 gap-8 items-center bg-gradient-to-br from-white to-slate-50/50">
            {/* Ambient pattern decoration inside the card */}
            <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-indigo-50/30 blur-[80px] pointer-events-none -mr-20 -mt-20" />
            <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-emerald-50/25 blur-[60px] pointer-events-none -ml-16 -mb-16" />

            {/* Left Column: Location Details */}
            <div className="md:col-span-7 space-y-6 relative z-10">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 bg-indigo-100/80 text-indigo-700 rounded-2xl flex items-center justify-center shrink-0 border border-indigo-200/40 shadow-sm">
                  <MapPin className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600">Headquarters</span>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">Our Location</h3>
                  <p className="text-slate-800 font-bold text-base sm:text-lg leading-snug">
                    Pakosadak, Newroad, Kathmandu, Nepal
                  </p>
                </div>
              </div>

              <div className="pl-16 space-y-4">
                <p className="text-slate-600 font-medium text-sm sm:text-base max-w-lg leading-relaxed">
                  Visit MTS Lab for professional smartphone repair services and technical support.
                </p>

                <div className="flex flex-wrap gap-2.5 pt-1">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-600">
                    <Compass className="h-3.5 w-3.5 text-indigo-500" /> Newroad Pako Zone
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-600">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Authorized Lab center
                  </span>
                </div>
              </div>
            </div>

            {/* Right Column: Dynamic Action Card */}
            <div className="md:col-span-5 w-full relative z-10 flex flex-col items-stretch md:items-end justify-center">
              <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-2xl shadow-slate-900/10 space-y-6 border border-slate-800 w-full md:max-w-xs transition-transform hover:scale-[1.02] duration-300">
                <div className="space-y-2">
                  <h4 className="text-sm font-black uppercase tracking-widest text-slate-400">Route & Navigation Guide</h4>
                  <p className="text-xs text-slate-300 font-medium leading-relaxed">
                    Instantly load precise physical coordinate mapping and optimal traffic paths directly in Google Maps.
                  </p>
                </div>

                <a 
                  href="https://maps.app.goo.gl/baP5yg6qgcgBT7neA" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-5 h-13 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-extrabold text-sm shadow-xl shadow-indigo-600/25 transition-all w-full text-center"
                >
                  <span>Open in Google Maps</span>
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </motion.div>

        {/* 4. Help & Call To Action Panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="bg-indigo-900 rounded-[32px] p-6 sm:p-10 md:p-12 text-white relative overflow-hidden shadow-2xl"
        >
          {/* Ambient visual overlay inside card */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.25),transparent_65%)] pointer-events-none" />
          <div className="absolute -top-24 -left-20 w-80 h-80 rounded-full bg-indigo-600/35 blur-[120px] pointer-events-none" />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            <div className="lg:col-span-8 space-y-4">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-white/10 backdrop-blur-sm border border-white/15 rounded-full text-[10px] font-black uppercase tracking-widest text-indigo-200">
                <HeartHandshake className="h-3.5 w-3.5 text-indigo-300" /> Professional Service Assurance
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight md:max-w-xl">
                Ready to restore your device's raw potential?
              </h2>
              <p className="text-indigo-200 text-sm sm:text-base font-semibold max-w-2xl leading-relaxed">
                Connect with our front receptionist at the service desk, check in with diagnostic technicians directly, or schedule custom bulk logic-board repairs today.
              </p>
            </div>

            <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-4 select-none">
              <a 
                href="tel:9869276668" 
                className="flex items-center justify-center gap-2 h-14 bg-white hover:bg-slate-50 text-slate-900 rounded-2xl shadow-xl font-bold transition-all px-6 w-full text-center"
              >
                <PhoneCall className="h-5 w-5 text-indigo-600 shrink-0" />
                <span>Call Hotline Now</span>
              </a>
              
              <a 
                href="mailto:mtslabcustomerservice@gmail.com" 
                className="flex items-center justify-center gap-2 h-14 bg-slate-950/40 hover:bg-slate-950/60 border border-white/10 text-white rounded-2xl font-bold transition-all px-6 w-full text-center"
              >
                <MessageSquare className="h-5 w-5 text-indigo-300 shrink-0" />
                <span>Email Support Desk</span>
              </a>
            </div>

          </div>
        </motion.div>

        {/* 5. FAQs / Frequently Asked Queries teaser */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6">
          <div className="p-6 sm:p-8 bg-white border border-slate-100 rounded-3xl shadow-sm space-y-4">
            <div className="h-10 w-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center border border-indigo-100/35">
              <HelpCircle className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-black text-slate-900">Are walk-in diagnostics free at Pako?</h3>
            <p className="text-xs sm:text-sm text-slate-500 font-bold leading-relaxed">
              Yes, our certified specialists perform the initial clean micro-soldering and screen inspection assessments on-demand. Quotes are generated transparently prior to processing!
            </p>
          </div>

          <div className="p-6 sm:p-8 bg-white border border-slate-100 rounded-3xl shadow-sm space-y-4">
            <div className="h-10 w-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center border border-emerald-100/35">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-black text-slate-900">What quality inspection standards are followed for repairs?</h3>
            <p className="text-xs sm:text-sm text-slate-500 font-bold leading-relaxed">
              Every device undergoes our comprehensive 24-point diagnostic testing before handover, including display touch fidelity, battery discharge calibration, and IC-level thermal profiling.
            </p>
          </div>
        </div>

      </div>

      <Footer />
    </div>
  );
}
