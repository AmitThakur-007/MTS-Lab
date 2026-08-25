import { Link } from 'react-router-dom';
import { 
  Smartphone, 
  MapPin, 
  Mail, 
  Phone, 
  PhoneCall,
  Clock, 
  ShieldCheck, 
  FileText, 
  Building2, 
  UserCheck, 
  ExternalLink,
  ChevronRight
} from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-slate-950 text-slate-300 border-t border-slate-800/80 pt-16 pb-10 px-6 sm:px-10 lg:px-12 mt-auto selection:bg-indigo-500 selection:text-white relative overflow-hidden">
      {/* Subtle Ambient Glow */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-sky-600/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10 space-y-12">
        {/* Top Tier: Brand, Description, Socials & Certifications */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 pb-12 border-b border-slate-800/80">
          
          {/* Brand & Overview */}
          <div className="lg:col-span-5 space-y-4">
            <Link to="/" className="inline-flex items-center gap-3 group">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-950 font-black text-xl shadow-lg shadow-white/10 group-hover:scale-105 transition-transform">
                M
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-black tracking-tight text-white flex items-center gap-1.5">
                  MTS<span className="text-indigo-400 font-medium">LAB</span>
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Mobile Technology Station (MTS)
                </span>
              </div>
            </Link>

            <p className="text-slate-400 text-xs sm:text-sm font-normal leading-relaxed max-w-md">
              Mobile Technology Station (MTS) is Nepal's premier smartphone hardware restoration and Level-4 micro-soldering laboratory. We specialize in precision OCA front glass lamination, AMOLED display restoration, laser line removal, and circuit-level logic board recovery.
            </p>

            {/* Social Media Links */}
            <div className="pt-2 flex flex-wrap items-center gap-2.5 sm:gap-3">
              <span className="text-xs font-bold text-slate-400 mr-1">Follow Us:</span>
              
              {/* Facebook */}
              <a 
                href="https://www.facebook.com/MTSmobilescreenrefurblab/" 
                target="_blank" 
                rel="noopener noreferrer"
                aria-label="Visit MTS Lab on Facebook"
                className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 hover:border-indigo-500/60 hover:bg-indigo-600 hover:text-white text-slate-300 flex items-center justify-center transition-all shadow-sm group cursor-pointer"
              >
                <svg className="w-4 h-4 fill-current group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </a>

              {/* Instagram */}
              <a 
                href="https://www.instagram.com/mtsmobilescreenrefurblab/?hl=en" 
                target="_blank" 
                rel="noopener noreferrer"
                aria-label="Visit MTS Lab on Instagram"
                className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 hover:border-pink-500/60 hover:bg-gradient-to-tr hover:from-amber-500 hover:via-pink-600 hover:to-purple-600 hover:text-white text-slate-300 flex items-center justify-center transition-all shadow-sm group cursor-pointer"
              >
                <svg className="w-4 h-4 fill-current group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>

              {/* TikTok */}
              <a 
                href="https://www.tiktok.com/@mtslab" 
                target="_blank" 
                rel="noopener noreferrer"
                aria-label="Visit MTS Lab on TikTok"
                className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 hover:border-cyan-500/60 hover:bg-slate-800 hover:text-cyan-400 text-slate-300 flex items-center justify-center transition-all shadow-sm group cursor-pointer"
              >
                <svg className="w-4 h-4 fill-current group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.77 1.52V6.76c-.4 0-.8-.03-1.2-.07z"/>
                </svg>
              </a>

              {/* YouTube */}
              <a 
                href="https://www.youtube.com/channel/UCmE9DPhJeyhy3UVNL_Iz_1Q" 
                target="_blank" 
                rel="noopener noreferrer"
                aria-label="Visit MTS Lab on YouTube"
                className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 hover:border-red-500/60 hover:bg-red-600 hover:text-white text-slate-300 flex items-center justify-center transition-all shadow-sm group cursor-pointer"
              >
                <svg className="w-4 h-4 fill-current group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="lg:col-span-2 space-y-3.5">
            <h4 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              Quick Links
            </h4>
            <ul className="space-y-2 text-xs sm:text-sm font-medium">
              <li>
                <Link to="/" className="text-slate-400 hover:text-white transition-colors flex items-center gap-1.5">
                  <ChevronRight className="w-3.5 h-3.5 text-slate-600" /> Home
                </Link>
              </li>
              <li>
                <Link to="/about" className="text-slate-400 hover:text-white transition-colors flex items-center gap-1.5">
                  <ChevronRight className="w-3.5 h-3.5 text-slate-600" /> About Us
                </Link>
              </li>
              <li>
                <Link to="/services" className="text-slate-400 hover:text-white transition-colors flex items-center gap-1.5">
                  <ChevronRight className="w-3.5 h-3.5 text-slate-600" /> Services & Prices
                </Link>
              </li>
              <li>
                <Link to="/track" className="text-slate-400 hover:text-white transition-colors flex items-center gap-1.5">
                  <ChevronRight className="w-3.5 h-3.5 text-slate-600" /> Track Repair
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-slate-400 hover:text-white transition-colors flex items-center gap-1.5">
                  <ChevronRight className="w-3.5 h-3.5 text-slate-600" /> Contact Lab
                </Link>
              </li>
              <li>
                <Link to="/login" className="text-slate-400 hover:text-indigo-400 transition-colors flex items-center gap-1.5">
                  <ChevronRight className="w-3.5 h-3.5 text-slate-600" /> Staff Portal
                </Link>
              </li>
            </ul>
          </div>

          {/* Customer Support */}
          <div className="lg:col-span-5 space-y-3.5">
            <h4 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Customer Support & Hours
            </h4>
            <div className="space-y-2.5 text-xs sm:text-sm text-slate-400">
              <div className="flex items-start gap-2.5">
                <Mail className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[11px] text-slate-500 uppercase tracking-wider block font-bold">Support Email</span>
                  <a href="mailto:mtslabcustomerservice@gmail.com" className="text-slate-300 hover:text-indigo-400 transition-colors font-medium break-all underline decoration-slate-800 underline-offset-4">
                    mtslabcustomerservice@gmail.com
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <PhoneCall className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[11px] text-slate-500 uppercase tracking-wider block font-bold">MTS Reception</span>
                  <a href="tel:015364307" className="text-slate-300 hover:text-sky-400 transition-colors font-bold font-mono tracking-tight text-sm">
                    015364307
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Phone className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[11px] text-slate-500 uppercase tracking-wider block font-bold">Telephone / Mobile</span>
                  <a href="tel:+977986927668" className="text-slate-300 hover:text-emerald-400 transition-colors font-medium">
                    +977-986927668
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[11px] text-slate-500 uppercase tracking-wider block font-bold">Operating Hours</span>
                  <span className="text-slate-300 font-medium">Sun–Fri &bull; 10:20 AM – 6:30 PM</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Middle Tier: Business, Legal, Tax & Grievance Redressal */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 p-6 sm:p-8 rounded-2xl sm:rounded-3xl bg-slate-900/90 border border-slate-800">
          
          {/* Business Information */}
          <div className="space-y-2.5">
            <h5 className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-400" />
              Business Information
            </h5>
            <div className="space-y-1.5 text-xs text-slate-400 leading-relaxed">
              <p><strong className="text-slate-300">Platform Name:</strong> Mobile Technology Station (MTS)</p>
              <p><strong className="text-slate-300">Business Nature:</strong> Smartphone Repair</p>
              <p><strong className="text-slate-300">Registered Address:</strong> Pako Sadak, New Road, Kathmandu, Nepal</p>
              <p><strong className="text-slate-300">Head Office / Outlets:</strong> New Road</p>
            </div>
          </div>

          {/* Legal & Tax Details */}
          <div className="space-y-2.5">
            <h5 className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Legal & Tax Details
            </h5>
            <div className="space-y-1.5 text-xs text-slate-400 leading-relaxed">
              <p><strong className="text-slate-300">PAN Number:</strong> <span className="font-mono text-emerald-400 font-bold">125084235</span></p>
              <p><strong className="text-slate-300">Registering Authority:</strong> Local Ward Office 22</p>
              <p><strong className="text-slate-300">Registration Certificate No:</strong> <span className="font-mono text-slate-300 font-semibold">5650</span></p>
              <p><strong className="text-slate-300">E-Commerce Portal Listing No:</strong> <span className="text-slate-500 font-medium"></span></p>
            </div>
          </div>

          {/* Grievance Redressal Unit */}
          <div className="space-y-2.5 md:col-span-2 lg:col-span-1">
            <h5 className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-amber-400" />
              Grievance Redressal Unit
            </h5>
            <div className="space-y-1.5 text-xs text-slate-400 leading-relaxed">
              <p><strong className="text-slate-300">Responsible Person / Unit:</strong> Amit Thakur</p>
              <p>
                <strong className="text-slate-300">Phone / Mobile:</strong>{' '}
                <a href="tel:+9779709797526" className="text-amber-400 hover:underline font-mono font-bold">
                  9709797526
                </a>
              </p>
              <p><strong className="text-slate-300">Address:</strong> Pako Sadak, New Road, Kathmandu, Nepal</p>
            </div>
          </div>

        </div>

        {/* Bottom Tier: Copyright, Policies & Certification */}
        <div className="pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p className="text-center sm:text-left">
            &copy; {currentYear} Mobile Technology Station (MTS). All rights reserved.
          </p>

          <div className="flex items-center gap-6 font-medium">
            <Link 
              id="footer-terms-link"
              to="/terms" 
              className="text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Terms & Conditions
            </Link>
            <span className="text-slate-700">|</span>
            <Link 
              id="footer-privacy-link"
              to="/privacy" 
              className="text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Privacy Policy
            </Link>
          </div>
        </div>

      </div>
    </footer>
  );
}
