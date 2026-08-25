import { useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { 
  ShieldCheck, 
  Lock, 
  EyeOff, 
  FileText, 
  CheckCircle2, 
  Phone, 
  Mail, 
  MapPin, 
  ArrowLeft,
  ChevronRight,
  Database,
  Key
} from 'lucide-react';
import { motion } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';

export default function Privacy() {
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const yOffset = -90;
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans selection:bg-slate-950 selection:text-white antialiased">
      <Navbar />

      <main className="flex-1 pt-20 sm:pt-24 lg:pt-28 pb-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full space-y-6 sm:space-y-8">
        
        {/* Navigation & Header Section */}
        <div className="space-y-4">
          
          {/* Back Action & Breadcrumb */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:text-slate-950 hover:bg-slate-50 transition-all shadow-2xs cursor-pointer active:scale-95"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>

            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
              <Link to="/" className="hover:text-slate-900 transition-colors">Home</Link>
              <span>/</span>
              <span className="text-slate-700 font-bold">Privacy Policy</span>
            </div>
          </div>

          {/* Title & Tag */}
          <div className="text-center space-y-3 pt-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-950 text-white text-[11px] font-black tracking-wider uppercase shadow-xs">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Zero-Trust Data Security</span>
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black tracking-tight text-slate-950">
              Privacy Policy
            </h1>

            <p className="text-xs sm:text-sm md:text-base text-slate-600 font-medium max-w-xl mx-auto leading-relaxed">
              How Mobile Technology Station (MTS Lab) collects, encrypts, handles customer records, and guarantees zero-access to private device data.
            </p>

            <p className="text-[11px] sm:text-xs text-slate-400 font-semibold">
              Effective Date: August 2026 &bull; Mobile Technology Station (MTS), Kathmandu, Nepal
            </p>
          </div>

          {/* Quick Legal Tab Switcher */}
          <div className="flex items-center justify-center pt-1">
            <div className="inline-flex p-1 bg-slate-200/80 rounded-2xl border border-slate-300/60 shadow-2xs">
              <Link
                to="/terms"
                className="px-4 py-1.5 rounded-xl text-slate-600 hover:text-slate-950 font-bold text-xs transition-colors"
              >
                Terms & Conditions
              </Link>
              <span className="px-4 py-1.5 rounded-xl bg-white text-slate-950 font-extrabold text-xs shadow-xs">
                Privacy Policy
              </span>
            </div>
          </div>

          {/* Table of Contents Quick Jump Chips */}
          <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 scrollbar-thin pt-2 justify-start sm:justify-center">
            {[
              { id: 'sec-privacy-commitment', label: '1. Commitment' },
              { id: 'sec-privacy-data', label: '2. Collected Data' },
              { id: 'sec-privacy-zero-access', label: '3. Zero-Access Protocol' },
              { id: 'sec-privacy-security', label: '4. Security & Retention' },
              { id: 'sec-privacy-contact', label: '5. Privacy Officer' }
            ].map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => scrollToSection(chip.id)}
                className="px-3 py-1 rounded-xl bg-white border border-slate-200 hover:border-slate-400 text-slate-700 hover:text-slate-950 text-xs font-bold whitespace-nowrap shadow-2xs transition-all cursor-pointer"
              >
                {chip.label}
              </button>
            ))}
          </div>

        </div>

        {/* Legal Document Content Card */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-sm p-5 sm:p-8 md:p-10 space-y-8 text-slate-700 leading-relaxed text-xs sm:text-sm md:text-base">
          
          {/* Section 1: Commitment */}
          <section id="sec-privacy-commitment" className="space-y-3 border-b border-slate-100 pb-7">
            <h2 className="text-base sm:text-lg md:text-xl font-black text-slate-950 flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-xs font-black shrink-0 border border-emerald-100">
                1
              </span>
              <span>Our Commitment to Customer Privacy</span>
            </h2>
            <p className="leading-relaxed">
              At <strong>Mobile Technology Station (MTS)</strong>, we recognize the deep sensitivity of smartphone hardware and personal data. We enforce rigorous administrative, technical, and physical safeguards across our central laboratory in Kathmandu to ensure your personal information remains strictly confidential, encrypted, and isolated at all times.
            </p>
          </section>

          {/* Section 2: Information Collected */}
          <section id="sec-privacy-data" className="space-y-3 border-b border-slate-100 pb-7">
            <h2 className="text-base sm:text-lg md:text-xl font-black text-slate-950 flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-xs font-black shrink-0 border border-emerald-100">
                2
              </span>
              <span>Information We Collect & Purpose</span>
            </h2>
            <p>We strictly collect only the minimal data required for repair tickets, customer tracking, and warranty verification:</p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-slate-950 text-xs sm:text-sm">
                  <Database className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>Contact Data</span>
                </div>
                <p className="text-xs text-slate-600">Customer full name, mobile number for SMS/WhatsApp repair updates, and optional email.</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-slate-950 text-xs sm:text-sm">
                  <Key className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Device Identity</span>
                </div>
                <p className="text-xs text-slate-600">Brand, model, serial number/IMEI, and intake condition to prevent misplacement.</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-slate-950 text-xs sm:text-sm">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Service Logs</span>
                </div>
                <p className="text-xs text-slate-600">Service slip numbers, replacement part serials, and warranty verification dates.</p>
              </div>
            </div>
          </section>

          {/* Section 3: Device Storage Zero-Access Guarantee */}
          <section id="sec-privacy-zero-access" className="space-y-3 border-b border-slate-100 pb-7">
            <h2 className="text-base sm:text-lg md:text-xl font-black text-slate-950 flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-xs font-black shrink-0 border border-emerald-100">
                3
              </span>
              <span>Zero-Access Private Data Protocol</span>
            </h2>
            
            <div className="bg-emerald-50/70 border border-emerald-200/80 p-4 sm:p-5 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-emerald-900 font-black text-xs sm:text-sm">
                <Lock className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Zero-Access Guarantee</span>
              </div>
              <p className="text-xs sm:text-sm text-emerald-950 leading-relaxed">
                Technicians at MTS Lab test touch digitizers, display panels, charging ports, cameras, and audio transducers using dedicated standalone hardware diagnostic tools that <strong>do not require opening personal photo galleries, applications, messages, or accounts</strong>. We encourage customers to enable OS Maintenance/Repair Mode before dropping off devices.
              </p>
            </div>
          </section>

          {/* Section 4: Security & Third-Party Non-Disclosure */}
          <section id="sec-privacy-security" className="space-y-3 border-b border-slate-100 pb-7">
            <h2 className="text-base sm:text-lg md:text-xl font-black text-slate-950 flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-xs font-black shrink-0 border border-emerald-100">
                4
              </span>
              <span>Security Protocols & Non-Disclosure</span>
            </h2>
            <p className="leading-relaxed">
              Mobile Technology Station (MTS) never sells, rents, leases, or trades customer personal data or repair history to any third-party marketing companies. All online tracking queries are encrypted via TLS 1.3 cryptographic protocols with strict role-based access control (RBAC).
            </p>
          </section>

          {/* Section 5: Grievance Officer */}
          <section id="sec-privacy-contact" className="space-y-4 bg-slate-50 p-5 sm:p-6 rounded-2xl border border-slate-200">
            <div className="space-y-1">
              <h3 className="font-black text-slate-950 text-sm sm:text-base">
                Privacy Officer & Data Erasure Contact
              </h3>
              <p className="text-xs sm:text-sm text-slate-600">
                To request data deletion, review your stored records, or discuss privacy matters:
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm font-semibold text-slate-800 pt-1">
              <div className="flex items-center gap-2 p-2.5 bg-white rounded-xl border border-slate-200/80">
                <span className="text-slate-400">Officer:</span>
                <span className="text-slate-950 font-bold">Amit Thakur</span>
              </div>

              <a 
                href="tel:+9779709797526"
                className="flex items-center gap-2 p-2.5 bg-white rounded-xl border border-slate-200/80 hover:border-slate-400 transition-colors"
              >
                <Phone className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>+977 9709797526</span>
              </a>

              <a 
                href="mailto:mtslabcustomerservice@gmail.com"
                className="flex items-center gap-2 p-2.5 bg-white rounded-xl border border-slate-200/80 hover:border-slate-400 transition-colors sm:col-span-2"
              >
                <Mail className="w-4 h-4 text-indigo-600 shrink-0" />
                <span className="truncate">mtslabcustomerservice@gmail.com</span>
              </a>

              <div className="flex items-center gap-2 p-2.5 bg-white rounded-xl border border-slate-200/80 sm:col-span-2">
                <MapPin className="w-4 h-4 text-slate-500 shrink-0" />
                <span>Pako Sadak, New Road, Kathmandu, Nepal</span>
              </div>
            </div>
          </section>

        </div>

        {/* Quick Footer Navigation Links */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <Link
            to="/terms"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            <span>Read Terms & Conditions</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>

          <Link
            to="/services"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-950 transition-colors"
          >
            <span>Explore Repair Services</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

      </main>

      <Footer />
    </div>
  );
}
