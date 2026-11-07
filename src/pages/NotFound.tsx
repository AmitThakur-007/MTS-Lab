import React from 'react';
import { HelpCircle, ArrowLeft, Home, Search, LayoutDashboard, PhoneCall } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link, useNavigate } from 'react-router-dom';
import BrandLogo from '@/components/BrandLogo';
import { useAuthStore } from '@/store/authStore';

export default function NotFound() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 font-sans antialiased transition-colors">
      <div className="w-full max-w-lg text-center space-y-6">
        {/* Brand Header */}
        <div className="flex justify-center mb-2">
          <BrandLogo variant="icon" size="lg" imgClassName="w-14 h-14 drop-shadow-md" />
        </div>

        {/* 404 Visual Icon */}
        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl flex items-center justify-center mx-auto text-cyan-500 shadow-sm">
          <HelpCircle className="w-8 h-8 sm:w-10 sm:h-10 stroke-[1.75]" />
        </div>

        {/* Typography */}
        <div className="space-y-2">
          <span className="text-[11px] font-black uppercase tracking-widest text-cyan-600 dark:text-cyan-400">
            HTTP 404 · RESOURCE UNAVAILABLE
          </span>
          <h1 className="text-2xl sm:text-4xl font-black text-slate-950 dark:text-white tracking-tight">
            Page Not Found
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-md mx-auto">
            The page or resource you are attempting to reach does not exist, has been archived, or moved to another section.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto rounded-xl border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs sm:text-sm font-bold cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Go Back
          </Button>

          <Link to="/" className="w-full sm:w-auto">
            <Button
              variant="outline"
              className="w-full sm:w-auto rounded-xl border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs sm:text-sm font-bold cursor-pointer"
            >
              <Home className="w-4 h-4 mr-1.5" />
              Homepage
            </Button>
          </Link>

          {user ? (
            <Link to="/dashboard" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto rounded-xl bg-slate-950 hover:bg-slate-800 dark:bg-cyan-600 dark:hover:bg-cyan-700 text-white text-xs sm:text-sm font-bold cursor-pointer shadow-sm">
                <LayoutDashboard className="w-4 h-4 mr-1.5" />
                Return to Dashboard
              </Button>
            </Link>
          ) : (
            <Link to="/track" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto rounded-xl bg-slate-950 hover:bg-slate-800 dark:bg-cyan-600 dark:hover:bg-cyan-700 text-white text-xs sm:text-sm font-bold cursor-pointer shadow-sm">
                <Search className="w-4 h-4 mr-1.5" />
                Track Repair
              </Button>
            </Link>
          )}
        </div>

        {/* Support Footer Info */}
        <div className="pt-6 border-t border-slate-200 dark:border-slate-800/80 text-[11px] text-slate-400 space-y-1">
          <p>MTS LAB — New Road / Pakosadak, Kathmandu, Nepal</p>
          <p className="flex items-center justify-center gap-1.5">
            <PhoneCall className="w-3 h-3 text-cyan-500" />
            Support: +977-9801234567 · info@mobiletechnologystation.com.np
          </p>
        </div>
      </div>
    </div>
  );
}
