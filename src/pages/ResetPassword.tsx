import React, { useState } from 'react';
import { useNavigate, useLocation, Navigate, Link } from 'react-router-dom';
import { Lock, Loader2, ShieldCheck, Eye, EyeOff, ArrowLeft, KeyRound, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import mtsLogo from '@/assets/images/mts-logo.jpg';

import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { validateStrongPassword } from '@/lib/passwordPolicy';

export default function ResetPassword() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const navigate = useNavigate();
  const location = useLocation();

  const searchParams = new URLSearchParams(location.search);
  const oobCode = searchParams.get('oobCode') || searchParams.get('token');
  const resetToken = location.state?.resetToken || oobCode;

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const valResult = validateStrongPassword(newPassword);
    if (!valResult.valid) {
      const msg = valResult.message;
      setErrorMsg(msg);
      toast.error(msg);
      return;
    }

    if (newPassword !== confirmPassword) {
      const msg = 'Passwords do not match. Please re-enter.';
      setErrorMsg(msg);
      toast.error(msg);
      return;
    }

    if (!resetToken) {
      const msg = 'This password reset link is invalid or has expired. Please request a new one.';
      setErrorMsg(msg);
      toast.error(msg);
      return;
    }

    setLoading(true);
    try {
      if (oobCode) {
        // Authoritative Firebase Authentication Reset Confirmation
        await confirmPasswordReset(auth, oobCode, newPassword);
      }
      
      // Update local database password hash
      const res: any = await api.post('/auth/reset-password', { resetToken, newPassword });
      toast.success(res.message || 'Password reset successfully. Please sign in with your new password.');
      navigate('/login');
    } catch (err: any) {
      const msg = err?.code === 'auth/invalid-action-code' || err?.code === 'auth/expired-action-code'
        ? 'This password reset link is invalid or has expired. Please request a new one.'
        : err.error || err.message || 'Failed to reset password';
      setErrorMsg(msg);
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
            <div className="mx-auto w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-1 border border-emerald-100/60 shadow-xs">
              <KeyRound className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
              Create New Password
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm font-medium text-slate-500 max-w-[320px] mx-auto leading-relaxed">
              Choose a strong, secure password with at least 12 characters.
            </CardDescription>
          </CardHeader>

          {/* Error Message Alert */}
          {errorMsg && (
            <div className="mx-6 sm:mx-8 mb-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-950 text-xs flex items-start gap-2.5 shadow-sm">
              <div className="space-y-0.5">
                <p className="font-bold text-rose-900">Security Notice</p>
                <p className="text-rose-700 leading-relaxed text-[11px]">
                  {errorMsg}
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleReset}>
            <CardContent className="space-y-4 px-6 sm:px-8 pt-2">
              {/* New Password Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 ml-1">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="New password (min 12 chars)"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    className="pl-10 pr-10 h-12 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-slate-950/10 transition-all text-xs sm:text-sm font-medium"
                    required
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors p-1 cursor-pointer"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 ml-1">Confirm New Password</label>
                <div className="relative">
                  <ShieldCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    className="pl-10 pr-10 h-12 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-slate-950/10 transition-all text-xs sm:text-sm font-medium"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors p-1 cursor-pointer"
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </CardContent>

            <CardFooter className="px-6 sm:px-8 pb-7 pt-3 flex flex-col gap-3">
              <Button
                type="submit"
                className="w-full h-12 rounded-xl bg-slate-950 hover:bg-slate-850 text-white font-bold text-xs sm:text-sm transition-all active:scale-[0.98] disabled:opacity-50 shadow-md shadow-slate-950/15 cursor-pointer"
                disabled={loading || !newPassword || !confirmPassword}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Updating Password...</span>
                  </div>
                ) : (
                  'Reset Password & Sign In'
                )}
              </Button>

              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors pt-1"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Cancel & Back to Login</span>
              </Link>
            </CardFooter>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}
