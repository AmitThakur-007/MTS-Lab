import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  Lock,
  Mail,
  Loader2,
  Eye,
  EyeOff,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { api } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { getDeviceDetails } from '@/lib/device';
import mtsLogo from '@/assets/images/mts-logo.jpg';
import { auth } from '@/lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { normalizeRole } from '@/lib/rbac';

export default function Login() {
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Email verification state
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resendVerifCooldown, setResendVerifCooldown] = useState(0);
  const [resendingVerif, setResendingVerif] = useState(false);
  const [checkingVerif, setCheckingVerif] = useState(false);
  const [emailVerificationSuccess, setEmailVerificationSuccess] = useState(false);
  const [emailVerificationError, setEmailVerificationError] = useState<string | null>(null);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setAuth = useAuthStore((state) => state.setAuth);
  // Shown when user is redirected here after 2-hour inactivity session expiration
  const [inactivityBanner, setInactivityBanner] = useState(false);

  useEffect(() => {
    const mode = searchParams.get('mode');
    const oobCode = searchParams.get('oobCode');

    if (mode === 'verifyEmail' && oobCode) {
      api.post('/auth/verify-email-status', { oobCode })
        .then((syncRes: any) => {
          if (syncRes?.success && syncRes?.emailVerified) {
            setIdentity(syncRes.user?.email || '');
            setEmailVerificationSuccess(true);
            setEmailVerificationError(null);
            setUnverifiedEmail(null);
            toast.success('Your email has been verified successfully. You can now log in.');
          } else {
            setEmailVerificationSuccess(false);
            setEmailVerificationError('We could not verify your email. The verification link may be invalid or expired.');
            toast.error('We could not verify your email. The verification link may be invalid or expired.');
          }
        })
        .catch((err: any) => {
          console.warn('[VERIFY SYNC ERROR]', err);
          setEmailVerificationSuccess(false);
          setEmailVerificationError('We could not verify your email. The verification link may be invalid or expired.');
          toast.error('We could not verify your email. The verification link may be invalid or expired.');
        })
        .finally(() => {
          navigate('/login', { replace: true });
        });
      return;
    }

    const emailVerifiedParam = searchParams.get('emailVerified');
    if (emailVerifiedParam !== null) {
      const cleanVal = emailVerifiedParam.trim().toLowerCase();
      const isSuccess = ['true', 'tru', '1', 'yes', 'success', 'verified'].includes(cleanVal);
      const isFailed = ['false', '0', 'no', 'failed', 'error', 'expired'].includes(cleanVal);

      if (isSuccess) {
        setEmailVerificationSuccess(false);
        setEmailVerificationError('Your verification link was processed. Enter your email and password to confirm current account status.');
      } else if (isFailed) {
        setEmailVerificationSuccess(false);
        setEmailVerificationError('Email verification was not completed. Please request a new verification email.');
        toast.error('Email verification was not completed. Please request a new verification email.');
      }

      navigate('/login', { replace: true });
    }

    const reason = searchParams.get('reason');
    if (reason === 'inactivity') {
      setInactivityBanner(true);
      navigate('/login', { replace: true });
    }
  }, [searchParams, navigate]);

  // Countdown timer for Email Verification resend
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendVerifCooldown > 0) {
      timer = setInterval(() => {
        setResendVerifCooldown((prev) => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendVerifCooldown]);

  // Handle credentials submission via Firebase Authentication
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identity.trim() || !password) {
      toast.error('Please enter your work email and password');
      return;
    }

    setLoading(true);
    setUnverifiedEmail(null);
    setEmailVerificationError(null);

    try {
      const trimmedEmail = identity.trim().toLowerCase();
      let firebaseIdToken: string | undefined;
      let userCred: any = null;

      // 1. Authoritative Firebase Authentication Client Sign-In
      try {
        const signInRes = await signInWithEmailAndPassword(auth, trimmedEmail, password);
        userCred = signInRes.user;
      } catch (fbErr: any) {
        userCred = null;
        if (fbErr?.code === 'auth/user-disabled') {
          toast.error('Your account has been disabled. Please contact MTS Lab administration.');
          setLoading(false);
          return;
        } else if (fbErr?.code === 'auth/too-many-requests') {
          toast.error('Too many failed login attempts. Please try again later.');
          setLoading(false);
          return;
        }
        // For other auth errors (e.g. auth/invalid-credential, user not yet in Firebase Auth,
        // or password not yet synced), fall back to backend login handler so bcrypt password
        // is validated FIRST and account synced/provisioned in Firebase Auth.
      }

      if (userCred) {
        try {
          await userCred.reload();
        } catch {}
        firebaseIdToken = await userCred.getIdToken(true);

        if (!userCred.emailVerified) {
          setUnverifiedEmail(trimmedEmail);
          toast.error('Please verify your email address before continuing.');
          setLoading(false);
          return;
        }
      }

      // 2. Authenticate session with MTS Lab Backend
      const device = getDeviceDetails();
      const res: any = await api.post('/auth/login', {
        identity: trimmedEmail,
        password,
        device,
        firebaseIdToken
      });

      if (res?.emailNotVerified || (res?.user && res?.user?.emailVerified === false)) {
        setUnverifiedEmail(identity.trim());
        toast.error('Please verify your email address before continuing.');
        return;
      }

      if (res?.token && res?.user) {
        const canonicalRole = normalizeRole(res.user.role);
        if (!canonicalRole) {
          toast.error('Access Denied: Invalid account role. Please contact an administrator.');
          return;
        }
        const validatedUser = { ...res.user, role: canonicalRole };
        setAuth(validatedUser, res.token, res.refreshToken);
        toast.success(`Welcome back, ${validatedUser.name}!`);
        navigate('/dashboard');
      } else {
        throw new Error(res?.message || 'Unable to sign in with these credentials.');
      }
    } catch (err: any) {
      if (err?.emailNotVerified || err?.message?.toLowerCase().includes('verify your email')) {
        setUnverifiedEmail(identity.trim());
        toast.error('Please verify your email address before continuing.');
      } else {
        toast.error(err.message || 'Unable to sign in with these credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle Resend Firebase Verification Email
  const handleResendVerificationEmail = async () => {
    if (!unverifiedEmail || resendingVerif || resendVerifCooldown > 0) return;
    setResendingVerif(true);
    setEmailVerificationError(null);

    try {
      if (auth.currentUser && auth.currentUser.email?.toLowerCase() === unverifiedEmail.toLowerCase()) {
        try {
          await auth.currentUser.reload();
        } catch {}

        if (auth.currentUser.emailVerified) {
          setEmailVerificationSuccess(true);
          setUnverifiedEmail(null);
          toast.success('Your email is already verified. You can now sign in.');
          return;
        }

        await sendEmailVerification(auth.currentUser);
        toast.success('Verification email sent through Firebase. Please check your Gmail inbox.');
        setResendVerifCooldown(60);
        return;
      }

      const res: any = await api.post('/auth/resend-verification', {
        email: unverifiedEmail,
        password
      });

      if (res.emailVerified) {
        setEmailVerificationSuccess(true);
        setUnverifiedEmail(null);
        toast.success('Your email is verified. You can now sign in.');
        return;
      }

      toast.success(res.message || 'Verification email sent. Please check your inbox.');
      setResendVerifCooldown(60);
    } catch (err: any) {
      const errMsg = err.message || 'Failed to resend verification email.';
      setEmailVerificationError(errMsg);
      toast.error(errMsg);
    } finally {
      setResendingVerif(false);
    }
  };

  // Handle Check Verification Status in Real-Time
  const handleCheckVerificationStatus = async () => {
    if (!unverifiedEmail || checkingVerif) return;
    setCheckingVerif(true);
    try {
      if (auth.currentUser) {
        await auth.currentUser.reload();
        if (auth.currentUser.emailVerified) {
          toast.success('Your email is verified! Please enter your password to sign in.');
          setEmailVerificationSuccess(true);
          setUnverifiedEmail(null);
          setCheckingVerif(false);
          return;
        }
      }

      const res: any = await api.post('/auth/verify-email-status', {
        email: unverifiedEmail,
        password: password || undefined
      });

      if (res.emailVerified) {
        toast.success('Your email is verified! Please sign in.');
        setEmailVerificationSuccess(true);
        setUnverifiedEmail(null);
      } else {
        toast.info('Email is not yet verified. Please click the link sent to your Gmail inbox.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to check verification status.');
    } finally {
      setCheckingVerif(false);
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
            <CardTitle className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
              Welcome Back
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm font-medium text-slate-500">
              Sign in to your MTS Lab account
            </CardDescription>
          </CardHeader>

          {/* Email Verification Success Alert */}
          {emailVerificationSuccess && (
            <div className="mx-6 sm:mx-8 mb-4 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs flex items-start gap-2.5 shadow-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold text-emerald-900">Email Verified Successfully!</p>
                <p className="text-emerald-700 leading-relaxed text-[11px]">
                  Your email address is verified. Enter your password to sign in.
                </p>
              </div>
            </div>
          )}

          {/* Email Verification Error Alert */}
          {emailVerificationError && (
            <div className="mx-6 sm:mx-8 mb-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-950 text-xs flex items-start gap-2.5 shadow-sm">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold text-rose-900">Verification Notice</p>
                <p className="text-rose-700 leading-relaxed text-[11px]">
                  {emailVerificationError}
                </p>
              </div>
            </div>
          )}

          {/* Session Inactivity Expiry Banner */}
          {inactivityBanner && (
            <div className="mx-6 sm:mx-8 mb-4 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 text-xs flex items-start gap-2.5 shadow-sm">
              <Clock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold text-amber-900">Session Expired Due to Inactivity</p>
                <p className="text-amber-700 leading-relaxed text-[11px]">
                  Your session ended after 2 hours of inactivity. Please sign in again.
                </p>
              </div>
            </div>
          )}

          {/* Email Verification Required Alert */}
          {unverifiedEmail && (
            <div className="mx-6 sm:mx-8 mb-4 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="font-bold">Email Verification Required</p>
                  <p className="text-amber-800 leading-relaxed">
                    Please verify your email address (<b>{unverifiedEmail}</b>) before continuing.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleResendVerificationEmail}
                  disabled={resendingVerif || resendVerifCooldown > 0}
                  className="h-8 text-xs font-bold rounded-xl bg-white border-amber-300 text-amber-900 hover:bg-amber-100"
                >
                  {resendingVerif ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                  ) : (
                    <RefreshCw className="h-3 w-3 mr-1.5" />
                  )}
                  {resendVerifCooldown > 0 ? `Available in ${resendVerifCooldown}s` : 'Resend Verification Email'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleCheckVerificationStatus}
                  disabled={checkingVerif}
                  className="h-8 text-xs font-bold rounded-xl text-amber-900 hover:bg-amber-100/60"
                >
                  {checkingVerif ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                  Check Status
                </Button>
              </div>
            </div>
          )}

          <form onSubmit={handleLoginSubmit}>
            <CardContent className="space-y-4 px-6 sm:px-8 pt-2">
              {/* Work Email Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 ml-1">
                  Work Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    type="email"
                    placeholder="Work Email"
                    value={identity}
                    onChange={(e) => setIdentity(e.target.value)}
                    className="pl-10 h-12 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-slate-950/10 transition-all text-xs sm:text-sm font-medium"
                    required
                    autoFocus
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password Field with Toggle */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-xs font-bold text-slate-700">Password</label>
                  <Link
                    to="/forgot-password"
                    className="text-[11px] sm:text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                  >
                    Forgot Password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 h-12 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-slate-950/10 transition-all text-xs sm:text-sm font-medium"
                    required
                    autoComplete="current-password"
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
                    <span>Signing In...</span>
                  </div>
                ) : (
                  'Sign In'
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* Clean Footer Link */}
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
