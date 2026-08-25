import { motion } from 'motion/react';
import {
  MapPin,
  PhoneCall,
  Mail,
  ShieldCheck,
  Cpu,
  Bookmark,
  Quote,
  Layers,
  Wrench,
  Smartphone,
  CheckCircle2,
  Building2,
  Clock,
  ArrowRight,
  Shield
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Badge } from '@/components/ui/badge';
import mtsLogo from '@/assets/images/mts-logo.jpg';
import sabitaPhoto from '@/assets/team/sabita-thakur.jpg';
import manishPhoto from '@/assets/team/manish-sharma.jpg';
import amitPhoto from '@/assets/team/amit-sharma.jpg';

const leadershipMessages = [
  {
    name: 'Sabita Thakur',
    position: 'Chief Executive Officer (CEO)',
    shortRole: 'CEO',
    image: sabitaPhoto,
    alt: 'Sabita Thakur - Chief Executive Officer (CEO) of MTS Lab',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
    dotColor: 'bg-indigo-500',
    objectPosition: 'object-[center_15%]',
    paragraphs: [
      'Welcome to MTS Lab.',
      'Our vision is to build a trusted and professional destination for mobile repair and technical services. At MTS Lab, we believe that every customer deserves honest communication, quality workmanship, and dependable service.',
      'We continuously focus on improving our services, strengthening our team, and adopting better repair practices so that our customers can confidently rely on MTS Lab for their devices.',
      'Thank you for trusting MTS Lab. We look forward to serving you with professionalism, responsibility, and dedication.'
    ]
  },
  {
    name: 'Manish Thakur',
    position: 'Founder',
    shortRole: 'Founder',
    image: manishPhoto,
    alt: 'Manish Thakur - Founder of MTS Lab',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200/80',
    dotColor: 'bg-amber-500',
    objectPosition: 'object-[center_15%]',
    paragraphs: [
      'MTS Lab was established with a simple goal: to provide reliable, professional, and customer-focused mobile repair services.',
      'Over time, our commitment has grown from repairing devices to building a trusted technical service center where quality, transparency, and customer satisfaction remain our priorities.',
      'We are proud of the journey MTS Lab has taken and grateful to every customer and team member who has contributed to our growth.',
      'Our commitment is to continue improving, learning, and providing better technical solutions to our customers.'
    ]
  },
  {
    name: 'Amit Thakur',
    position: 'Technical Head | Computer Engineer',
    shortRole: 'Technical Head',
    image: amitPhoto,
    alt: 'Amit Thakur - Technical Head | Computer Engineer at MTS Lab',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    dotColor: 'bg-emerald-500',
    objectPosition: 'object-[center_15%]',
    paragraphs: [
      'At MTS Lab, technology and technical expertise are at the heart of everything we do.',
      'As the Technical Head and a Computer Engineer, my focus is on maintaining professional repair standards, improving technical processes, and encouraging the use of modern diagnostic and repair techniques.',
      'Our technical team works to carefully diagnose problems before performing repairs, while continuously improving our knowledge of hardware, software, electronics, and advanced device technologies.',
      'Our goal is not simply to repair a device, but to provide a reliable technical solution that our customers can trust.'
    ]
  }
];

export default function About() {
  return (
    <div className="min-h-screen bg-slate-50/60 font-sans text-slate-800 leading-relaxed selection:bg-indigo-600 selection:text-white flex flex-col antialiased">
      <Navbar />

      {/* 1. Hero Section with Official MTS Logo & Core Positioning */}
      <section className="relative pt-28 pb-20 md:pt-36 md:pb-28 bg-slate-900 border-b border-slate-800 overflow-hidden">
        {/* Background ambient mesh */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-1/2 -right-1/4 w-[75%] h-[150%] rounded-full bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.15),transparent_60%)] blur-3xl" />
          <div className="absolute -bottom-1/2 -left-1/4 w-[75%] h-[150%] rounded-full bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.08),transparent_60%)] blur-3xl" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="space-y-5 sm:space-y-6"
          >
            {/* Prominent Official MTS Logo Container */}
            <div className="inline-block relative">
              <div className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-3xl p-2 bg-white shadow-2xl shadow-indigo-500/20 border-2 border-indigo-400/30 mx-auto flex items-center justify-center overflow-hidden transition-transform duration-300 hover:scale-105">
                <img
                  src={mtsLogo}
                  alt="MTS Lab Official Logo"
                  className="w-full h-full object-contain rounded-2xl"
                />
              </div>
            </div>

            <div className="space-y-3 max-w-4xl mx-auto">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/25 text-xs sm:text-sm font-bold tracking-wide shadow-inner">
                <ShieldCheck className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                <span>Nepal’s First Wholesale Mobile Screen Refurb Lab</span>
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight select-none">
                Nepal’s First <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-indigo-300 bg-clip-text text-transparent">Mobile Screen Refurb Lab</span>
              </h1>

              <p className="text-slate-300 text-sm sm:text-base md:text-lg max-w-3xl mx-auto font-medium leading-relaxed">
                Dedicated Screen Refurb &bull; Advanced Board-Level Repair &bull; Professional Smartphone Technical Services
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 2. Structured Company Description & Capabilities */}
      <section className="relative py-12 sm:py-16 md:py-20 -mt-8 sm:-mt-10 px-4 sm:px-6 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* Main Structured Company Presentation */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-8 bg-white p-6 sm:p-8 md:p-10 rounded-[28px] sm:rounded-[36px] border border-slate-200/80 shadow-xl shadow-slate-100/60 space-y-8"
          >
            {/* Header Identity Card */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5 pb-6 border-b border-slate-100">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white p-1.5 shadow-sm border border-slate-200/80 shrink-0 flex items-center justify-center overflow-hidden">
                <img
                  src={mtsLogo}
                  alt="MTS Lab Logo"
                  className="w-full h-full object-contain rounded-xl"
                />
              </div>
              <div className="text-center sm:text-left space-y-1.5 min-w-0">
                <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-black uppercase tracking-wider border border-indigo-100/70">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Kathmandu, Nepal</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  MTS Lab
                </h2>
                <p className="text-xs sm:text-sm font-bold text-indigo-600">
                  Nepal’s First Wholesale Mobile Screen Refurb Lab
                </p>
              </div>
            </div>

            {/* Section 1: Who We Are */}
            <div className="space-y-3">
              <div className="flex items-center gap-2.5 text-slate-900">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
                  <Bookmark className="w-4 h-4" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold tracking-tight">Who We Are</h3>
              </div>
              <div className="space-y-3 text-slate-600 text-sm sm:text-base font-normal leading-relaxed pl-0 sm:pl-10">
                <p>
                  MTS Lab is a reliable Kathmandu-based mobile phone repair service dedicated to providing professional and dependable solutions for smartphones and other mobile devices.
                </p>
                <p>
                  MTS Lab is proud to be positioned as Nepal’s First Wholesale Mobile Screen Refurb Lab and a dedicated screen refurb laboratory, providing professional screen refurb solutions for the mobile repair industry.
                </p>
              </div>
            </div>

            {/* Section 2: Screen Refurb */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2.5 text-slate-900">
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100">
                  <Layers className="w-4 h-4" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold tracking-tight">Screen Refurb</h3>
              </div>
              <div className="space-y-3 text-slate-600 text-sm sm:text-base font-normal leading-relaxed pl-0 sm:pl-10">
                <p>
                  We operate a specialized screen refurb laboratory offering wholesale mobile display and screen refurb services for repair businesses, retail shops, and individual device owners.
                </p>
                <p>
                  Supported by specialized refurb equipment, controlled working environments, and modern lamination techniques, our lab restores cracked or damaged outer glass while preserving the original factory display panel and touch sensitivity.
                </p>
              </div>
            </div>

            {/* Section 3: Professional Repair Services */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2.5 text-slate-900">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                  <Wrench className="w-4 h-4" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold tracking-tight">Professional Repair Services</h3>
              </div>
              <div className="space-y-3 text-slate-600 text-sm sm:text-base font-normal leading-relaxed pl-0 sm:pl-10">
                <p>
                  We provide a wide range of mobile repair, screen refurb, and technical services, supported by experienced technicians, specialized equipment, and modern repair techniques. Our team handles various types of hardware and software problems across different mobile brands and models.
                </p>
                <p>
                  From battery replacements, camera modules, and charging port repairs to complex diagnostic investigations, our solutions are designed to be practical, reliable, and durable.
                </p>
              </div>
            </div>

            {/* Section 4: Our Expertise */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2.5 text-slate-900">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                  <Cpu className="w-4 h-4" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold tracking-tight">Our Expertise</h3>
              </div>
              <div className="space-y-3 text-slate-600 text-sm sm:text-base font-normal leading-relaxed pl-0 sm:pl-10">
                <p>
                  Our technical expertise covers advanced board-level and hardware repair, precision micro-soldering, power IC troubleshooting, and component-level circuit diagnostics.
                </p>
                <p>
                  As a specialized mobile technology and screen refurb lab, MTS Lab focuses on maintaining high standards of workmanship and continuously improving our repair and refurb techniques.
                </p>
              </div>
            </div>

            {/* Section 5: Our Commitment & Customer Motto */}
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2.5 text-slate-900">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold tracking-tight">Our Commitment</h3>
              </div>
              <div className="space-y-3 text-slate-600 text-sm sm:text-base font-normal leading-relaxed pl-0 sm:pl-10">
                <p>
                  MTS Lab is committed to providing customers and industry partners with quality service, transparent communication, and professional technical support. From common mobile issues to advanced hardware, screen refurb, and board-level repairs, our goal is to provide practical, reliable, and professional repair solutions.
                </p>
                <p>
                  Bring your mobile device to MTS Lab with confidence. Our experienced technicians are dedicated to diagnosing problems carefully and providing the best possible repair and refurb service.
                </p>
              </div>

              {/* Motto Callout Card */}
              <div className="mt-4 p-4 sm:p-5 rounded-2xl bg-indigo-50/70 border border-indigo-100/90 flex items-start gap-3.5">
                <Quote className="h-6 w-6 text-indigo-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-900">Our Motto</span>
                  <p className="text-xs sm:text-sm md:text-base font-bold text-indigo-950 leading-snug">
                    “To provide you with reliable, professional, and customer-focused service.”
                  </p>
                </div>
              </div>
            </div>

          </motion.div>

          {/* Side Capabilities & Trust Pillars */}
          <div className="lg:col-span-4 space-y-6">

            {/* Wholesale Screen Refurb Pillar */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/80 shadow-md hover:shadow-lg transition-all space-y-3"
            >
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100/70">
                <Layers className="h-6 w-6" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  Wholesale Screen Refurb
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                  Dedicated screen refurb laboratory supporting mobile technicians, retail shops, and partners across Nepal with precision glass and display renewal.
                </p>
              </div>
            </motion.div>

            {/* Advanced Board-Level Diagnostics Pillar */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/80 shadow-md hover:shadow-lg transition-all space-y-3"
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100/70">
                <Cpu className="h-6 w-6" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  Advanced Board-Level Repair
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                  Expert micro-soldering, motherboard diagnostics, and component-level circuit troubleshooting for complex smartphone hardware issues.
                </p>
              </div>
            </motion.div>

            {/* Quality & Transparent Support Pillar */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/80 shadow-md hover:shadow-lg transition-all space-y-3"
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100/70">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  Transparent & Reliable Service
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                  Honest problem diagnosis, clear customer communication, and disciplined repair standards for smartphone owners and industry partners.
                </p>
              </div>
            </motion.div>

          </div>

        </div>
      </section>

      {/* 3. Leadership Messages Section */}
      <section className="py-14 sm:py-16 md:py-20 max-w-7xl mx-auto px-4 sm:px-6 w-full" id="leadership-messages">
        <div className="text-center space-y-3 mb-10 sm:mb-14">
          <Badge className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-100 px-3.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-2xs">
            Executive Vision & Direction
          </Badge>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-950 tracking-tight">
            Leadership Messages
          </h2>
          <p className="text-xs sm:text-sm md:text-base text-slate-500 font-medium max-w-2xl mx-auto leading-relaxed">
            Our commitment to quality, technical excellence, and customer-focused service.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto items-stretch">
          {leadershipMessages.map((leader, i) => (
            <motion.div
              key={leader.name}
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.12 }}
              className="group bg-white rounded-[28px] sm:rounded-[32px] border border-slate-200/90 shadow-md hover:shadow-2xl hover:shadow-slate-200/80 transition-all duration-300 overflow-hidden flex flex-col justify-between"
            >
              <div className="p-5 sm:p-6 space-y-5">
                {/* Profile Photo with Position Badge */}
                <div className="relative aspect-[4/5] w-full rounded-2xl overflow-hidden bg-slate-100 shadow-inner">
                  <img
                    src={leader.image}
                    alt={leader.alt}
                    loading="lazy"
                    decoding="async"
                    className={`w-full h-full object-cover ${leader.objectPosition} group-hover:scale-105 transition-transform duration-500 ease-out`}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/25 via-transparent to-transparent pointer-events-none" />

                  {/* Position Pill Overlay on Photo */}
                  <div className="absolute top-3 left-3 right-3 flex justify-between items-center">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border text-[11px] font-extrabold shadow-sm bg-white/95 backdrop-blur-md ${leader.badgeClass}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${leader.dotColor} animate-pulse`} />
                      <span>{leader.shortRole}</span>
                    </span>
                  </div>
                </div>

                {/* Leader Identity Header */}
                <div className="space-y-1 text-center sm:text-left border-b border-slate-100 pb-3">
                  <h3 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight group-hover:text-indigo-950 transition-colors">
                    {leader.name}
                  </h3>
                  <p className="text-xs font-extrabold text-indigo-600 tracking-wide uppercase">
                    {leader.position}
                  </p>
                </div>

                {/* Leadership Message Content */}
                <div className="space-y-3 relative">
                  <Quote className="w-6 h-6 text-indigo-200/80 absolute -top-1 -left-1 -z-0 opacity-60" />
                  <div className="space-y-2.5 relative z-10 text-xs sm:text-sm text-slate-600 font-medium leading-relaxed text-justify">
                    {leader.paragraphs.map((p, idx) => (
                      <p key={idx} className={idx === 0 ? "font-semibold text-slate-800" : ""}>
                        {p}
                      </p>
                    ))}
                  </div>
                </div>
              </div>

              {/* Card Footer Accent Bar */}
              <div className="px-6 py-3.5 bg-slate-50/90 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-bold">
                <span>MTS Lab</span>
                <span className="text-indigo-600 font-black">Kathmandu</span>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* 4. Contact & Support Section */}
      <section className="py-14 sm:py-16 md:py-20 max-w-7xl mx-auto px-4 sm:px-6 border-t border-slate-200/60 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start">

          {/* Informational Column */}
          <div className="lg:col-span-5 space-y-6 sm:space-y-8">
            <div className="space-y-2.5">
              <Badge className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border-none px-3.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                Support Desk
              </Badge>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Contact & Support</h2>
              <p className="text-slate-500 font-medium leading-relaxed text-xs sm:text-sm md:text-base">
                Have hardware repair queries, wholesale screen refurb inquiries, or need technical assistance? Connect with our service desk directly.
              </p>
            </div>

            {/* Structured Fields */}
            <div className="space-y-4 sm:space-y-5">

              {/* Business Email */}
              <div className="p-4 sm:p-5 bg-white border border-slate-200/80 rounded-2xl shadow-xs flex gap-4 items-start">
                <div className="p-2.5 sm:p-3 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
                  <Mail className="h-5 w-5" />
                </div>
                <div className="space-y-1 min-w-0">
                  <h4 className="text-[10px] sm:text-xs text-slate-400 font-black uppercase tracking-wider">Business Inquiry Email</h4>
                  <a
                    href="mailto:mtslabcustomerservice@gmail.com"
                    className="text-xs sm:text-sm md:text-base font-bold text-slate-800 hover:text-indigo-600 transition-colors block break-all underline decoration-slate-200 underline-offset-4"
                  >
                    mtslabcustomerservice@gmail.com
                  </a>
                </div>
              </div>

              {/* Phone Contacts */}
              <div className="p-4 sm:p-5 bg-white border border-slate-200/80 rounded-2xl shadow-xs flex gap-4 items-start">
                <div className="p-2.5 sm:p-3 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
                  <PhoneCall className="h-5 w-5" />
                </div>
                <div className="space-y-1 min-w-0 w-full">
                  <h4 className="text-[10px] sm:text-xs text-slate-400 font-black uppercase tracking-wider mb-1.5">Support Numbers</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <a
                      href="tel:9869276668"
                      className="border border-slate-200/80 hover:border-indigo-200 hover:bg-indigo-50/30 p-2.5 rounded-xl block text-center text-xs sm:text-sm font-bold text-slate-800 hover:text-indigo-600 transition-colors"
                    >
                      9869276668 (Mob)
                    </a>
                    <a
                      href="tel:015364307"
                      className="border border-slate-200/80 hover:border-indigo-200 hover:bg-indigo-50/30 p-2.5 rounded-xl block text-center text-xs sm:text-sm font-bold text-slate-800 hover:text-indigo-600 transition-colors"
                    >
                      015364307 (Land)
                    </a>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Map and Office Address Box */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-slate-900 rounded-[28px] sm:rounded-[32px] p-2 overflow-hidden shadow-2xl h-[380px] sm:h-[420px] relative border border-slate-800">

              {/* Kathmandu Central Laboratory Location box */}
              <div className="w-full h-full bg-slate-950 rounded-[24px] sm:rounded-[28px] overflow-hidden flex flex-col items-center justify-center p-6 text-center space-y-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-indigo-500/30 rounded-full blur-xl animate-pulse" />
                  <div className="h-12 w-12 sm:h-14 sm:w-14 bg-indigo-600/20 text-indigo-400 rounded-full flex items-center justify-center border border-indigo-500/20 relative">
                    <MapPin className="h-6 w-6 sm:h-7 sm:w-7 animate-bounce" />
                  </div>
                </div>

                <div className="space-y-1.5 max-w-sm mx-auto">
                  <h3 className="text-base sm:text-lg font-bold text-white">Kathmandu Central Laboratory</h3>
                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                    New Road, Pako (Opposite side of people's plaza back gate), Kathmandu, Nepal
                  </p>
                </div>

                <div className="border border-slate-800 rounded-2xl p-2.5 sm:p-3 bg-slate-900 text-slate-300 text-xs font-semibold inline-flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Open Sun - Fri: 10:30 AM - 7:30 PM</span>
                </div>
              </div>

            </div>
          </div>

        </div>
      </section>

      <Footer />
    </div>
  );
}
