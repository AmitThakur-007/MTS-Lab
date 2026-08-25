import { useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { 
  ShieldCheck, 
  FileText, 
  Clock, 
  Phone, 
  Mail, 
  MapPin, 
  ArrowLeft, 
  Lock, 
  Cpu, 
  ChevronRight
} from 'lucide-react';
import { motion } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';

export default function Terms() {
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
              <span className="text-slate-700 font-bold">Terms & Conditions</span>
            </div>
          </div>

          {/* Title & Tag */}
          <div className="text-center space-y-3 pt-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-950 text-white text-[11px] font-black tracking-wider uppercase shadow-xs">
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              <span>Official Service Agreement</span>
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black tracking-tight text-slate-950">
              Terms & Conditions
            </h1>

            <p className="text-xs sm:text-sm md:text-base text-slate-600 font-medium max-w-xl mx-auto leading-relaxed">
              Official laboratory repair policies and service terms for Mobile Technology Station (MTS).
            </p>

            <p className="text-[11px] sm:text-xs text-slate-400 font-semibold">
              Kathmandu, Nepal &bull; Effective August 2026
            </p>
          </div>

          {/* Quick Legal Tab Switcher */}
          <div className="flex items-center justify-center pt-1">
            <div className="inline-flex p-1 bg-slate-200/80 rounded-2xl border border-slate-300/60 shadow-2xs">
              <span className="px-4 py-1.5 rounded-xl bg-white text-slate-950 font-extrabold text-xs shadow-xs">
                Terms & Conditions
              </span>
              <Link
                to="/privacy"
                className="px-4 py-1.5 rounded-xl text-slate-600 hover:text-slate-950 font-bold text-xs transition-colors"
              >
                Privacy Policy
              </Link>
            </div>
          </div>

          {/* Table of Contents Quick Jump Chips */}
          <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 scrollbar-thin pt-2 justify-start sm:justify-center">
            {[
              { id: 'sec-overview', label: '1. Overview' },
              { id: 'sec-estimates', label: '2. Quotations' },
              { id: 'sec-privacy', label: '3. Data Security' },
              { id: 'sec-storage', label: '4. Device Storage' },
              { id: 'sec-grievance', label: '5. Support & Contact' }
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
          
          {/* Section 1: Business Overview */}
          <section id="sec-overview" className="space-y-3 border-b border-slate-100 pb-7">
            <h2 className="text-base sm:text-lg md:text-xl font-black text-slate-950 flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center text-xs font-black shrink-0 border border-indigo-100">
                1
              </span>
              <span>About Mobile Technology Station (MTS)</span>
            </h2>
            <p className="leading-relaxed">
              MTS (Mobile Technology Station) is a Kathmandu-based smartphone repair and technical service center specializing in professional mobile phone repair, diagnostics, parts replacement, software services, and advanced hardware repair. We are committed to providing reliable, transparent, and professional repair services to our customers. By submitting a device to MTS for inspection, diagnosis, repair, parts replacement, or technical service, you agree to the terms and conditions set forth in this agreement.
            </p>
          </section>

          {/* Section 2: Diagnostics & Estimates */}
          <section id="sec-estimates" className="space-y-3 border-b border-slate-100 pb-7">
            <h2 className="text-base sm:text-lg md:text-xl font-black text-slate-950 flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center text-xs font-black shrink-0 border border-indigo-100">
                2
              </span>
              <span>Inspection, Quotations & Authorization</span>
            </h2>
            <p className="leading-relaxed">
              All smartphone diagnoses are conducted in an ESD-protected clean laboratory environment using microscopic inspection tools. Price estimates provided on the website or via phone consultation are tentative approximations based on user-reported symptoms. Definitive quotations are confirmed after physical laboratory intake. No major component replacement will proceed without explicit customer approval if secondary faults are identified during disassembly.
            </p>
          </section>

          {/* Section 3: Customer Data & Privacy */}
          <section id="sec-privacy" className="space-y-3 border-b border-slate-100 pb-7">
            <h2 className="text-base sm:text-lg md:text-xl font-black text-slate-950 flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center text-xs font-black shrink-0 border border-indigo-100">
                3
              </span>
              <span>Customer Data & Zero-Access Security</span>
            </h2>
            <div className="p-4 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-slate-950 font-bold text-xs sm:text-sm">
                <Lock className="w-4 h-4 text-emerald-600" />
                <span>Zero-Access Privacy Commitment</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                MTS Lab strictly enforces a zero-access customer data protocol. Technicians only execute hardware diagnostic tests and never access personal galleries, apps, or private accounts. Customers are strongly encouraged to back up sensitive files before repair. MTS Lab is not liable for data loss caused by pre-existing NAND storage corruption or motherboard short circuits.
              </p>
            </div>
          </section>

          {/* Section 4: Unclaimed Devices */}
          <section id="sec-storage" className="space-y-3 border-b border-slate-100 pb-7">
            <h2 className="text-base sm:text-lg md:text-xl font-black text-slate-950 flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center text-xs font-black shrink-0 border border-indigo-100">
                4
              </span>
              <span>Device Collection & Storage Policy</span>
            </h2>
            <p className="leading-relaxed">
              Repaired or inspected devices must be picked up within <strong>60 calendar days</strong> following notification via SMS, WhatsApp, or phone call. Devices left unclaimed past 90 days may incur daily secure vault storage fees or be responsibly recycled in accordance with Nepal e-waste regulations.
            </p>
          </section>

          {/* Section 5: Grievance Redressal */}
          <section id="sec-grievance" className="space-y-4 bg-slate-50 p-5 sm:p-6 rounded-2xl border border-slate-200">
            <div className="space-y-1">
              <h3 className="font-black text-slate-950 text-sm sm:text-base">
                Grievance Redressal & Customer Support
              </h3>
              <p className="text-xs sm:text-sm text-slate-600">
                For any disputes, service inquiries, or customer support:
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
            to="/privacy"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            <span>Read Privacy Policy</span>
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
