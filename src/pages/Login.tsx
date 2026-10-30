import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  Lock,
  Mail,
  Loader2,
  Eye,
  EyeOff,
  ArrowLeft,
  KeyRound,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Cpu,
  Activity,
  Sun,
  Moon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { api } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { useAppTheme } from '@/context/ThemeContext';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { getDeviceDetails } from '@/lib/device';
import BrandLogo from '@/components/BrandLogo';

export default function Login() {
  const { effectiveTheme, setUserPreference } = useAppTheme();
  const isDarkMode = effectiveTheme === 'dark' || effectiveTheme === 'night' || effectiveTheme === 'tihar';

  const toggleTheme = () => {
    setUserPreference(isDarkMode ? 'light' : 'dark');
  };

  const [stage, setStage] = useState<'CREDENTIALS' | '2FA'>('CREDENTIALS');
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Email verification state
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resendVerifCooldown, setResendVerifCooldown] = useState(0);
  const [resendingVerif, setResendingVerif] = useState(false);
  const [checkingVerif, setCheckingVerif] = useState(false);
  const [emailVerificationSuccess, setEmailVerificationSuccess] = useState(false);
  const [emailVerificationError, setEmailVerificationError] = useState<string | null>(null);

  // 2FA state
  const [mfaTicket, setMfaTicket] = useState('');
  const [emailMasked, setEmailMasked] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [resendCooldown, setResendCooldown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [resending, setResending] = useState(false);
  const [otpExpirySeconds, setOtpExpirySeconds] = useState(300); // 5 minutes expiration

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setAuth = useAuthStore((state) => state.setAuth);

  // Inactivity expiration notice
  const [inactivityBanner, setInactivityBanner] = useState(false);

  // Check for email verification query params or token on mount
  useEffect(() => {
    const token = searchParams.get('token') || searchParams.get('oobCode');
    const email = searchParams.get('email');

    if (token) {
      api.post('/auth/verify-email-status', { token, email: email || undefined })
        .then((syncRes: any) => {
          if (syncRes?.emailVerified) {
            setEmailVerificationSuccess(true);
            setEmailVerificationError(null);
            setUnverifiedEmail(null);
            toast.success('Email verified successfully in database. You can now log in.');
          } else {
            setEmailVerificationError('Database status could not be confirmed. Please log in to complete.');
          }
          navigate('/login', { replace: true });
        })
        .catch((err) => {
          console.warn('[AUTH] Email verification error:', err?.message || err);
          setEmailVerificationError('Verification link is invalid or has expired.');
          toast.error('Email verification link is invalid or has expired.');
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
        setEmailVerificationSuccess(true);
        setEmailVerificationError(null);
        setUnverifiedEmail(null);
        toast.success('Email verified successfully. You can now log in.');
      } else if (isFailed) {
        setEmailVerificationError('Email verification was not completed. Please try again.');
        toast.error('Email verification was not completed. Please try again.');
      }
      navigate('/login', { replace: true });
    }

    const reason = searchParams.get('reason');
    if (reason === 'inactivity') {
      setInactivityBanner(true);
      navigate('/login', { replace: true });
    }
  }, [searchParams, navigate]);

  // 2FA countdown
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (stage === '2FA' && resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [stage, resendCooldown]);

  // 5-minute countdown for OTP Expiration
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (stage === '2FA' && otpExpirySeconds > 0) {
      timer = setInterval(() => {
        setOtpExpirySeconds((prev) => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [stage, otpExpirySeconds]);

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

  const formatExpiryTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle stage 1 credentials submission
  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    const trimmedIdentity = identity.trim();
    if (!trimmedIdentity || !password) {
      const msg = 'Please enter both your email and password.';
      setAuthError(msg);
      toast.error(msg);
      return;
    }

    setLoading(true);
    setUnverifiedEmail(null);
    setEmailVerificationError(null);

    try {
      const trimmedEmail = trimmedIdentity.toLowerCase();
      const device = getDeviceDetails();

      const res: any = await api.post('/auth/login', {
        email: trimmedEmail,
        password,
        device,
      });

      if (res?.requires2FA && res?.mfaTicket) {
        setMfaTicket(res.mfaTicket);
        setEmailMasked(res.emailMasked || 'your registered email');
        setStage('2FA');
        setOtpDigits(['', '', '', '', '', '']);
        setOtpExpirySeconds(300); // 5 minutes expiration
        setResendCooldown(60);
        setCanResend(false);
        toast.info('Verification code sent to your email.');
        setTimeout(() => {
          otpInputRefs.current[0]?.focus();
        }, 150);
      } else if (res?.token && res?.user) {
        setAuth(res.user, res.token, res.refreshToken);
        toast.success(`Welcome back, ${res.user.name}!`);
        navigate('/dashboard');
      } else {
        throw new Error('Unable to authenticate. Please check your credentials.');
      }
    } catch (err: any) {
      if (err?.emailNotVerified || err?.message?.toLowerCase().includes('verify your email')) {
        setUnverifiedEmail(err.email || identity.trim());
        const msg = 'Please verify your email address before continuing.';
        setAuthError(msg);
        toast.error(msg);
      } else {
        const msg = err?.message || 'Invalid email or password. Please try again.';
        setAuthError(msg);
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle Resend Verification Email
  const handleResendVerificationEmail = async () => {
    if (!unverifiedEmail || resendingVerif || resendVerifCooldown > 0) return;
    setResendingVerif(true);
    try {
      const res: any = await api.post('/auth/resend-verification', { email: unverifiedEmail });
      toast.success(res?.message || 'Verification email sent. Please check your inbox and spam folder.');
      setResendVerifCooldown(60);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to resend verification email.');
    } finally {
      setResendingVerif(false);
    }
  };

  // Handle Check Verification Status in Real-Time
  const handleCheckVerificationStatus = async () => {
    if (!unverifiedEmail || checkingVerif) return;
    setCheckingVerif(true);
    try {
      const res: any = await api.post('/auth/verify-email-status', {
        email: unverifiedEmail,
        password: password || undefined
      });

      if (res?.emailVerified) {
        toast.success('Your email is verified! Please enter your password to continue.');
        setEmailVerificationSuccess(true);
        setUnverifiedEmail(null);
        setAuthError(null);
      } else {
        toast.info('Email is not yet verified. Please click the link sent to your email.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to check verification status.');
    } finally {
      setCheckingVerif(false);
    }
  };

  // OTP digit box input
  const handleOtpChange = (index: number, value: string) => {
    const cleanValue = value.replace(/\D/g, '');
    const newDigits = [...otpDigits];

    if (cleanValue.length > 1) {
      const pastedCodes = cleanValue.slice(0, 6).split('');
      for (let i = 0; i < 6; i++) {
        newDigits[i] = pastedCodes[i] || '';
      }
      setOtpDigits(newDigits);
      const nextIndex = Math.min(pastedCodes.length, 5);
      otpInputRefs.current[nextIndex]?.focus();
      return;
    }

    newDigits[index] = cleanValue;
    setOtpDigits(newDigits);

    if (cleanValue && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pastedData) {
      const newDigits = [...otpDigits];
      for (let i = 0; i < 6; i++) {
        newDigits[i] = pastedData[i] || '';
      }
      setOtpDigits(newDigits);
      const targetFocus = Math.min(pastedData.length, 5);
      otpInputRefs.current[targetFocus]?.focus();
    }
  };

  // Handle Stage 2 OTP Verification
  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpExpirySeconds <= 0) {
      toast.error('Verification code expired. Please request a new code.');
      return;
    }

    const code = otpDigits.join('').trim();
    if (code.length !== 6) {
      toast.error('Please enter all 6 digits of the verification code');
      return;
    }

    setLoading(true);
    try {
      const device = getDeviceDetails();
      const res: any = await api.post('/auth/2fa/verify', {
        mfaTicket,
        code,
        device
      });

      if (res?.success && res?.token && res?.user) {
        setAuth(res.user, res.token, res.refreshToken);
        toast.success(`Welcome back, ${res.user.name}!`);
        navigate('/dashboard');
      } else {
        throw new Error(res?.message || 'Verification failed');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Invalid or expired verification code');
    } finally {
      setLoading(false);
    }
  };

  // Handle Resend OTP Code
  const handleResendCode = async () => {
    if (!canResend || resending) return;
    setResending(true);
    try {
      const res: any = await api.post('/auth/2fa/resend', { mfaTicket });
      toast.success(res?.message || 'A new verification code has been sent to your email.');
      setResendCooldown(60);
      setCanResend(false);
      setOtpExpirySeconds(300);
      setOtpDigits(['', '', '', '', '', '']);
      otpInputRefs.current[0]?.focus();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to resend verification code');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-background text-foreground transition-colors duration-200 selection:bg-cyan-500 selection:text-white dark:selection:text-slate-950 font-sans antialiased">
      {/* Background Decorative Ambience (Subtle and Theme-Aware) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
        <div className="absolute -top-40 left-1/3 -translate-x-1/2 w-[700px] h-[400px] bg-gradient-to-b from-cyan-500/10 via-blue-600/5 to-transparent blur-3xl rounded-full opacity-60 dark:opacity-100" />
        <div className="absolute -bottom-40 right-1/4 w-[500px] h-[350px] bg-gradient-to-t from-indigo-500/10 via-cyan-500/5 to-transparent blur-3xl rounded-full opacity-60 dark:opacity-100" />
      </div>

      {/* Top Header */}
      <header className="relative z-10 w-full px-4 sm:px-8 py-4 sm:py-5 flex items-center justify-between border-b border-border bg-background/80 backdrop-blur-md transition-colors">
        <div className="flex items-center gap-3">
          <BrandLogo
            variant="icon"
            size="md"
            linkTo="/"
            imgClassName="w-9 h-9 drop-shadow-md hover:scale-105 transition-transform"
          />
          <div>
            <span className="text-sm font-black tracking-tight text-foreground">
              MTS <span className="text-cyan-600 dark:text-cyan-400">LAB</span>
            </span>
            <span className="text-[11px] block text-muted-foreground font-medium">Enterprise Management</span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Global Theme Controller Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-lg hover:bg-muted border border-border cursor-pointer"
            title={isDarkMode ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            aria-label={isDarkMode ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          >
            {isDarkMode ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-600" />}
            <span className="hidden sm:inline">{isDarkMode ? 'Light' : 'Dark'}</span>
          </button>

          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-muted border border-border"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">MTS Lab Home</span>
            <span className="sm:hidden">Home</span>
          </Link>
        </div>
      </header>

      {/* Main Body */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-5xl">
          <div className="lg:grid lg:grid-cols-12 gap-8 items-center">
            {/* Left Brand Panel (Desktop only - 5 cols) */}
            <div className="hidden lg:flex lg:col-span-5 flex-col justify-between p-8 rounded-3xl bg-card border border-border backdrop-blur-xl h-full shadow-lg dark:shadow-2xl space-y-8 transition-colors">
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <BrandLogo variant="icon" size="xl" imgClassName="w-14 h-14 drop-shadow-xl" />
                  <div>
                    <h2 className="text-xl font-black text-foreground tracking-tight">MTS LAB</h2>
                    <p className="text-xs text-cyan-600 dark:text-cyan-400 font-semibold tracking-wide uppercase">Precision Engineering</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-foreground leading-snug">
                    Smartphone Repair & Workshop Control Operations
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Unified workstation for repair diagnostics, micro-soldering job cards, inventory tracking, and client communications.
                  </p>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-3 text-xs text-foreground p-2.5 rounded-xl bg-muted/60 border border-border">
                    <Activity className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>Kathmandu Central Lab: <strong className="text-foreground">Active & Online</strong></span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-foreground p-2.5 rounded-xl bg-muted/60 border border-border">
                    <ShieldCheck className="h-4 w-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                    <span>End-to-End Encrypted Session Management</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-foreground p-2.5 rounded-xl bg-muted/60 border border-border">
                    <Cpu className="h-4 w-4 text-indigo-500 shrink-0" />
                    <span>Multi-Role Diagnostic & Role-Based Workflows</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Security Protocol v4.2</span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  System Healthy
                </span>
              </div>
            </div>

            {/* Right Authentication Form Panel (7 cols desktop, full width mobile/tablet) */}
            <div className="lg:col-span-7 flex justify-center">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="w-full max-w-[440px]"
              >
                {/* Inactivity Notice Banner */}
                {inactivityBanner && (
                  <div className="mb-4 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5 shadow-sm">
                    <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="font-bold text-amber-800 dark:text-amber-300">Session Expired</p>
                      <p className="text-amber-700 dark:text-amber-200/90 leading-relaxed text-[11px]">
                        Your previous session timed out after inactivity. Please sign in to resume your workstation.
                      </p>
                    </div>
                  </div>
                )}

                {/* Email Verification Alerts */}
                {emailVerificationSuccess && (
                  <div className="mb-4 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-900 dark:text-emerald-200 text-xs flex items-start gap-2.5 shadow-sm">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <p className="text-[12px] font-medium leading-relaxed">
                      Email verified successfully! Please enter your password to sign in.
                    </p>
                  </div>
                )}

                {emailVerificationError && (
                  <div className="mb-4 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-900 dark:text-rose-200 text-xs flex items-start gap-2.5 shadow-sm">
                    <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    <p className="text-[12px] font-medium leading-relaxed">
                      {emailVerificationError}
                    </p>
                  </div>
                )}

                {unverifiedEmail && (
                  <div className="mb-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs space-y-2.5 shadow-sm">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="font-bold text-amber-800 dark:text-amber-300">Email Verification Required</p>
                        <p className="text-amber-700 dark:text-amber-200/90 leading-relaxed text-[11px]">
                          Please confirm your email address <strong className="text-foreground">{unverifiedEmail}</strong> by clicking the link sent to your inbox.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 pt-1">
                      <button
                        type="button"
                        onClick={handleResendVerificationEmail}
                        disabled={resendingVerif || resendVerifCooldown > 0}
                        className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 hover:underline disabled:text-muted-foreground cursor-pointer transition-colors"
                      >
                        {resendingVerif ? 'Sending email...' : resendVerifCooldown > 0 ? `Resend link in ${resendVerifCooldown}s` : 'Resend verification email'}
                      </button>
                      <button
                        type="button"
                        onClick={handleCheckVerificationStatus}
                        disabled={checkingVerif}
                        className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline disabled:text-muted-foreground cursor-pointer transition-colors"
                      >
                        {checkingVerif ? 'Checking...' : 'Check Status Now'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Main Card */}
                <Card className="border border-border shadow-xl shadow-black/5 dark:shadow-2xl dark:shadow-black/70 rounded-2xl sm:rounded-3xl bg-card text-card-foreground overflow-hidden transition-colors">
                  <AnimatePresence mode="wait">
                    {stage === 'CREDENTIALS' ? (
                      <motion.div
                        key="stage-credentials"
                        initial={{ opacity: 0, x: -16 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 16 }}
                        transition={{ duration: 0.2 }}
                      >
                        <CardHeader className="pt-8 pb-3 text-center space-y-2">
                          <div className="mx-auto w-12 h-12 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 rounded-2xl flex items-center justify-center mb-1 border border-cyan-500/20 shadow-inner">
                            <Lock className="h-6 w-6" />
                          </div>
                          <CardTitle className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                            Welcome Back
                          </CardTitle>
                          <CardDescription className="text-xs sm:text-sm font-medium text-muted-foreground max-w-[340px] mx-auto leading-relaxed">
                            Sign in to your MTS Lab account to access your repair workstation.
                          </CardDescription>
                        </CardHeader>

                        {/* Authentication Error Banner */}
                        {authError && (
                          <div className="mx-6 sm:mx-8 mb-3 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-900 dark:text-rose-200 text-xs flex items-start gap-2.5" role="alert">
                            <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                            <p className="leading-relaxed text-[12px] font-medium">
                              {authError}
                            </p>
                          </div>
                        )}

                        <form onSubmit={handleCredentialsSubmit} noValidate>
                          <CardContent className="space-y-4 px-6 sm:px-8 pt-2">
                            {/* Email / Username Field */}
                            <div className="space-y-1.5">
                              <label htmlFor="login-identity" className="text-xs font-semibold text-foreground ml-1">
                                Work Email or Username
                              </label>
                              <div className="relative">
                                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                <Input
                                  id="login-identity"
                                  type="text"
                                  placeholder="Enter your email or username"
                                  value={identity}
                                  onChange={(e) => {
                                    setIdentity(e.target.value);
                                    if (authError) setAuthError(null);
                                  }}
                                  className="pl-10 h-12 rounded-xl border-input bg-background text-foreground placeholder:text-muted-foreground focus:bg-background focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all text-sm font-medium"
                                  required
                                  autoFocus
                                  autoComplete="username"
                                  disabled={loading}
                                />
                              </div>
                            </div>

                            {/* Password Field */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between ml-1">
                                <label htmlFor="login-password" className="text-xs font-semibold text-foreground">
                                  Password
                                </label>
                                <Link
                                  to="/forgot-password"
                                  tabIndex={-1}
                                  className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline transition-colors"
                                >
                                  Forgot Password?
                                </Link>
                              </div>
                              <div className="relative">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                <Input
                                  id="login-password"
                                  type={showPassword ? 'text' : 'password'}
                                  placeholder="Enter your password"
                                  value={password}
                                  onChange={(e) => {
                                    setPassword(e.target.value);
                                    if (authError) setAuthError(null);
                                  }}
                                  className="pl-10 pr-10 h-12 rounded-xl border-input bg-background text-foreground placeholder:text-muted-foreground focus:bg-background focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all text-sm font-medium"
                                  required
                                  autoComplete="current-password"
                                  disabled={loading}
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowPassword(!showPassword)}
                                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1 cursor-pointer"
                                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                              </div>
                            </div>
                          </CardContent>

                          <CardFooter className="px-6 sm:px-8 pb-8 pt-3 flex flex-col gap-3 bg-transparent">
                            <Button
                              type="submit"
                              className="w-full h-12 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 dark:from-cyan-500 dark:to-blue-600 text-white dark:text-slate-950 font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-50 shadow-md shadow-cyan-600/20 cursor-pointer"
                              disabled={loading}
                            >
                              {loading ? (
                                <div className="flex items-center gap-2">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  <span>Signing In...</span>
                                </div>
                              ) : (
                                'Sign In to Dashboard'
                              )}
                            </Button>

                            <div className="flex items-center justify-center gap-2 pt-1 text-xs text-muted-foreground">
                              <span>Tracking a repair?</span>
                              <Link
                                to="/track"
                                className="font-semibold text-cyan-600 dark:text-cyan-400 hover:underline transition-colors"
                              >
                                Customer Status Lookup
                              </Link>
                            </div>
                          </CardFooter>
                        </form>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="stage-2fa"
                        initial={{ opacity: 0, x: 16 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -16 }}
                        transition={{ duration: 0.2 }}
                      >
                        <CardHeader className="pt-8 pb-3 text-center space-y-2">
                          <div className="mx-auto w-12 h-12 bg-blue-500/10 text-cyan-600 dark:text-cyan-400 rounded-2xl flex items-center justify-center mb-1 border border-cyan-500/20 shadow-inner">
                            <ShieldCheck className="h-6 w-6" />
                          </div>
                          <CardTitle className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                            Two-Factor Authentication
                          </CardTitle>
                          <CardDescription className="text-xs sm:text-sm font-medium text-muted-foreground max-w-[340px] mx-auto leading-relaxed">
                            Enter the 6-digit verification code sent to:
                            <span className="block font-semibold text-foreground mt-1 font-mono text-[13px]">{emailMasked}</span>
                          </CardDescription>
                        </CardHeader>

                        <form onSubmit={handleVerify2FA}>
                          <CardContent className="space-y-4 px-6 sm:px-8 pt-2">
                            {/* 6-box OTP input */}
                            <div className="flex justify-between gap-1.5 sm:gap-2">
                              {otpDigits.map((digit, index) => (
                                <input
                                  key={index}
                                  ref={(el) => {
                                    otpInputRefs.current[index] = el;
                                  }}
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  maxLength={1}
                                  disabled={otpExpirySeconds <= 0}
                                  value={digit}
                                  onChange={(e) => handleOtpChange(index, e.target.value)}
                                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                                  onPaste={index === 0 ? handleOtpPaste : undefined}
                                  aria-label={`Digit ${index + 1} of verification code`}
                                  className="w-10 h-12 sm:w-12 sm:h-14 text-center text-lg sm:text-xl font-bold font-mono rounded-xl border border-input bg-background text-foreground focus:bg-background focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all outline-none disabled:opacity-40 disabled:bg-muted"
                                />
                              ))}
                            </div>

                            {/* Expiration Countdown & Notice */}
                            <div className="flex items-center justify-center pt-1">
                              {otpExpirySeconds > 0 ? (
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted border border-border text-foreground text-xs font-semibold">
                                  <Clock className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
                                  <span>Code expires in <span className="font-mono font-bold text-foreground">{formatExpiryTime(otpExpirySeconds)}</span></span>
                                </div>
                              ) : (
                                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-900 dark:text-rose-200 text-xs font-bold flex items-center justify-center gap-1.5 w-full">
                                  <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
                                  <span>Verification code expired. Please request a new code.</span>
                                </div>
                              )}
                            </div>

                            {/* Resend code controls */}
                            <div className="flex items-center justify-between text-xs px-1 pt-1">
                              <button
                                type="button"
                                onClick={handleResendCode}
                                disabled={!canResend || resending}
                                className="inline-flex items-center gap-1.5 font-bold text-cyan-600 dark:text-cyan-400 hover:underline disabled:text-muted-foreground disabled:cursor-not-allowed transition-colors cursor-pointer"
                              >
                                <RefreshCw className={`h-3.5 w-3.5 ${resending ? 'animate-spin' : ''}`} />
                                <span>{canResend ? 'Resend Code' : `Resend in ${resendCooldown}s`}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setStage('CREDENTIALS');
                                  setAuthError(null);
                                }}
                                className="inline-flex items-center gap-1 font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                              >
                                <ArrowLeft className="h-3.5 w-3.5" />
                                <span>Back to Credentials</span>
                              </button>
                            </div>
                          </CardContent>

                          <CardFooter className="px-6 sm:px-8 pb-8 pt-3 flex flex-col gap-3 bg-transparent">
                            <Button
                              type="submit"
                              className="w-full h-12 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 dark:from-cyan-500 dark:to-blue-600 text-white dark:text-slate-950 font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-50 shadow-md shadow-cyan-600/20 cursor-pointer"
                              disabled={loading || otpDigits.join('').length !== 6 || otpExpirySeconds <= 0}
                            >
                              {loading ? (
                                <div className="flex items-center gap-2">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  <span>Authenticating...</span>
                                </div>
                              ) : (
                                'Verify Code & Sign In'
                              )}
                            </Button>
                          </CardFooter>
                        </form>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </motion.div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full py-4 text-center text-xs text-muted-foreground border-t border-border bg-background/50 transition-colors">
        &copy; {new Date().getFullYear()} MTS Lab. Authorized Personnel Only. Confidential & Encrypted.
      </footer>
    </div>
  );
}
