import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Mail,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  KeyRound
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import mtsLogo from '@/assets/images/mts-logo.jpg';
import { auth } from '@/lib/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';

import { api } from '@/services/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const navigate = useNavigate();

  const handleSendResetLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Please enter your work email address');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const normalizedEmail = email.trim().toLowerCase();

      // 1. Check if email exists in MTS Lab database
      const checkRes: any = await api.post('/auth/forgot-password', { email: normalizedEmail });
      
      if (!checkRes?.success) {
        throw new Error(checkRes?.message || 'This email address is not registered with MTS Lab.');
      }
      
      // 2. Email exists in MTS Lab database -> Dispatch official Firebase password reset email
      try {
        await sendPasswordResetEmail(auth, normalizedEmail, {
          url: `${window.location.origin}/reset-password`,
          handleCodeInApp: true
        });
      } catch (fbErr: any) {
        console.warn('[FIREBASE RESET] Client reset email notice:', fbErr);
      }

      setSubmitted(true);
      toast.success('Password reset link sent to your email.');
    } catch (err: any) {
      const msg = err?.error || err?.message || 'Failed to send password reset email. Please try again.';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50/60 px-4 py-8 selection:bg-slate-900 selection:text-white font-sans antialiased">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="w-full max-w-[420px]"
      >
        {/* MTS Lab Official Logo & Header */}
        <div className="flex flex-col items-center mb-6 text-center space-y-2">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full p-1 bg-white shadow-xl shadow-slate-900/10 border border-slate-200/90 flex items-center justify-center overflow-hidden transition-transform duration-300 hover:scale-105">
            <img
              src={mtsLogo}
              alt="MTS Lab Logo"
              className="w-full h-full object-contain rounded-full"
            />
          </div>
          <div className="space-y-0.5">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-950">MTS Lab</h1>
            <p className="text-slate-500 text-xs sm:text-sm font-medium">
              Professional Smartphone Repair & Technical Services
            </p>
          </div>
        </div>

        {/* Main Card Container */}
        <Card className="border border-slate-200/90 shadow-xl shadow-slate-200/50 rounded-[28px] bg-white overflow-hidden">
          <CardHeader className="pt-7 pb-3 text-center space-y-1">
            <div className="mx-auto w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-1 border border-amber-100/60 shadow-xs">
              <KeyRound className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
              {submitted ? 'Reset Link Dispatched' : 'Forgot Password?'}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm font-medium text-slate-500 max-w-[320px] mx-auto leading-relaxed">
              {submitted
                ? 'Check your Gmail inbox for instructions to securely reset your password.'
                : 'Enter your registered email address to receive a secure password reset link.'}
            </CardDescription>
          </CardHeader>

          {/* Success Box */}
          {submitted ? (
            <CardContent className="px-6 sm:px-8 py-4 space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs flex items-start gap-3 shadow-xs">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-emerald-900">Email Dispatched</p>
                  <p className="text-emerald-700 leading-relaxed text-[11px]">
                    We sent a password reset email to <b>{email}</b>. Click the link in the email to create your new password.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                onClick={() => navigate('/login')}
                className="w-full h-12 rounded-xl bg-slate-950 hover:bg-slate-850 text-white font-bold text-xs sm:text-sm transition-all shadow-md cursor-pointer"
              >
                Return to Sign In
              </Button>
            </CardContent>
          ) : (
            <form onSubmit={handleSendResetLink}>
              {/* Error Notice Alert */}
              {errorMessage && (
                <div className="mx-6 sm:mx-8 mb-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-950 text-xs flex items-start gap-2.5 shadow-sm">
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-bold text-rose-900">Recovery Notice</p>
                    <p className="text-rose-700 leading-relaxed text-[11px]">
                      {errorMessage}
                    </p>
                  </div>
                </div>
              )}

              <CardContent className="space-y-4 px-6 sm:px-8 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 ml-1">
                    Registered Work Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      type="email"
                      placeholder="staff@mtslab.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      className="pl-10 h-12 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-slate-950/10 transition-all text-xs sm:text-sm font-medium"
                      required
                      autoFocus
                      autoComplete="email"
                    />
                  </div>
                </div>
              </CardContent>

              <CardFooter className="px-6 sm:px-8 pb-7 pt-3 flex flex-col gap-3">
                <Button
                  type="submit"
                  className="w-full h-12 rounded-xl bg-slate-950 hover:bg-slate-850 text-white font-bold text-xs sm:text-sm transition-all active:scale-[0.98] disabled:opacity-50 shadow-md shadow-slate-950/15 cursor-pointer"
                  disabled={loading}
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Sending Password Reset Email...</span>
                    </div>
                  ) : (
                    'Send Password Reset Link'
                  )}
                </Button>

                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors pt-1"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back to Sign In</span>
                </Link>
              </CardFooter>
            </form>
          )}
        </Card>

        {/* Footer Link */}
        <div className="mt-6 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to MTS Lab Home</span>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
