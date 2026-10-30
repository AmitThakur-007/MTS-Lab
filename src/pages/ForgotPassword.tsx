import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Mail,
  Loader2,
  ArrowLeft,
  KeyRound,
  RefreshCw,
  Clock,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  Info,
  Sun,
  Moon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { api } from '@/services/api';
import { useAppTheme } from '@/context/ThemeContext';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import BrandLogo from '@/components/BrandLogo';

const MANDATORY_PRIVACY_NOTICE =
  'If an account exists for this email address, password-reset instructions will be sent shortly. Please check your inbox and spam folder.';

export default function ForgotPassword() {
  const { effectiveTheme, setUserPreference } = useAppTheme();
  const isDarkMode = effectiveTheme === 'dark' || effectiveTheme === 'night' || effectiveTheme === 'tihar';

  const toggleTheme = () => {
    setUserPreference(isDarkMode ? 'light' : 'dark');
  };

  const [email, setEmail] = useState('');
  const [resetTicket, setResetTicket] = useState('');
  const [emailMasked, setEmailMasked] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [step, setStep] = useState<'EMAIL' | 'OTP'>('EMAIL');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedNotice, setSubmittedNotice] = useState<string | null>(null);

  // Timers
  const [resendCooldown, setResendCooldown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [resending, setResending] = useState(false);
  const [otpExpirySeconds, setOtpExpirySeconds] = useState(900); // 15 minutes expiration

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const navigate = useNavigate();

  // Countdown timer for resend cooldown
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === 'OTP' && resendCooldown > 0) {
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
  }, [step, resendCooldown]);

  // 15-minute countdown timer for OTP Expiration
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === 'OTP' && otpExpirySeconds > 0) {
      timer = setInterval(() => {
        setOtpExpirySeconds((prev) => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, otpExpirySeconds]);

  const formatExpiryTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSendResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      setErrorMessage('Please enter a valid email address.');
      toast.error('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res: any = await api.post('/auth/forgot-password', { email: cleanEmail });

      // Always advance to OTP with uniform privacy notice
      const ticket = res?.resetTicket || 'recovery-session';
      const masked = res?.emailMasked || cleanEmail;

      setResetTicket(ticket);
      setEmailMasked(masked);
      setSubmittedNotice(MANDATORY_PRIVACY_NOTICE);
      setStep('OTP');
      setOtpDigits(['', '', '', '', '', '']);
      setOtpExpirySeconds(900); // 15 minutes
      setResendCooldown(60);
      setCanResend(false);
      toast.info(MANDATORY_PRIVACY_NOTICE);

      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 150);
    } catch {
      // In case of any network interruption, still maintain privacy and avoid leaking registration status
      setSubmittedNotice(MANDATORY_PRIVACY_NOTICE);
      setStep('OTP');
      setOtpDigits(['', '', '', '', '', '']);
      setOtpExpirySeconds(900);
      setResendCooldown(60);
      setCanResend(false);
      toast.info(MANDATORY_PRIVACY_NOTICE);
    } finally {
      setLoading(false);
    }
  };

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

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpExpirySeconds <= 0) {
      toast.error('Recovery code expired. Please request a new code.');
      return;
    }

    const code = otpDigits.join('').trim();
    if (code.length !== 6) {
      toast.error('Please enter all 6 digits of the recovery code');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res: any = await api.post('/auth/verify-otp', {
        resetTicket,
        email: email.trim().toLowerCase(),
        code
      });

      if (res?.success && res?.resetToken) {
        toast.success('Code verified successfully.');
        navigate('/reset-password', { state: { resetToken: res.resetToken } });
      } else {
        throw new Error(res?.error || res?.message || 'Invalid or expired recovery code.');
      }
    } catch (err: any) {
      const msg = err?.error || err?.message || 'Invalid or expired recovery code. Please check your email or request a new code.';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!canResend || resending) return;
    setResending(true);
    setErrorMessage(null);
    try {
      const cleanEmail = email.trim().toLowerCase();
      await api.post('/auth/forgot-password', { email: cleanEmail });
      toast.info(MANDATORY_PRIVACY_NOTICE);
      setResendCooldown(60);
      setCanResend(false);
      setOtpExpirySeconds(900);
      setOtpDigits(['', '', '', '', '', '']);
      otpInputRefs.current[0]?.focus();
    } catch {
      toast.info(MANDATORY_PRIVACY_NOTICE);
      setResendCooldown(60);
      setCanResend(false);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-background text-foreground transition-colors duration-200 selection:bg-cyan-500 selection:text-white dark:selection:text-slate-950 font-sans antialiased">
      {/* Background Decorative Ambience */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-gradient-to-b from-cyan-500/10 via-blue-600/5 to-transparent blur-3xl rounded-full opacity-60 dark:opacity-100" />
        <div className="absolute -bottom-32 right-1/4 w-[450px] h-[300px] bg-gradient-to-t from-indigo-500/10 via-cyan-500/5 to-transparent blur-3xl rounded-full opacity-60 dark:opacity-100" />
      </div>

      {/* Top Bar / Header */}
      <header className="relative z-10 w-full px-4 sm:px-8 py-4 sm:py-5 flex items-center justify-between border-b border-border bg-background/80 backdrop-blur-md transition-colors">
        <div className="flex items-center gap-3">
          <BrandLogo
            variant="icon"
            size="md"
            linkTo="/"
            imgClassName="w-9 h-9 drop-shadow-md hover:scale-105 transition-transform"
          />
          <div className="hidden sm:block">
            <span className="text-sm font-black tracking-tight text-foreground">
              MTS <span className="text-cyan-600 dark:text-cyan-400">LAB</span>
            </span>
            <span className="text-[11px] block text-muted-foreground font-medium">Enterprise Repair Portal</span>
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
            to="/login"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-muted border border-border"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Sign In</span>
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="w-full max-w-[440px]"
        >
          {/* Main Card */}
          <Card className="border border-border shadow-xl shadow-black/5 dark:shadow-2xl dark:shadow-black/70 rounded-2xl sm:rounded-3xl bg-card text-card-foreground overflow-hidden transition-colors">
            <AnimatePresence mode="wait">
              {step === 'EMAIL' ? (
                <motion.div
                  key="step-email"
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  transition={{ duration: 0.2 }}
                >
                  <CardHeader className="pt-8 pb-3 text-center space-y-2">
                    <div className="mx-auto w-12 h-12 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 rounded-2xl flex items-center justify-center mb-1 border border-cyan-500/20 shadow-inner">
                      <KeyRound className="h-6 w-6" />
                    </div>
                    <CardTitle className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                      Forgot Password?
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm font-medium text-muted-foreground max-w-[340px] mx-auto leading-relaxed">
                      Enter your account email to receive recovery instructions and a secure verification code.
                    </CardDescription>
                  </CardHeader>

                  {/* Informational Privacy Guarantee Notice */}
                  <div className="mx-6 sm:mx-8 mt-2 mb-3 p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-900 dark:text-cyan-200 text-xs flex items-start gap-2.5">
                    <Info className="h-4 w-4 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
                    <p className="leading-relaxed text-[12px] font-medium">
                      For your privacy and security, password-recovery instructions are dispatched uniformly to protected mailboxes without exposing registration records.
                    </p>
                  </div>

                  {/* Error Notice */}
                  {errorMessage && (
                    <div className="mx-6 sm:mx-8 mb-3 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-900 dark:text-rose-200 text-xs flex items-start gap-2.5" role="alert">
                      <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                      <p className="leading-relaxed text-[12px] font-medium">
                        {errorMessage}
                      </p>
                    </div>
                  )}

                  <form onSubmit={handleSendResetRequest} noValidate>
                    <CardContent className="space-y-4 px-6 sm:px-8 pt-2">
                      <div className="space-y-1.5">
                        <label htmlFor="recovery-email" className="text-xs font-semibold text-foreground ml-1">
                          Account Email Address
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                          <Input
                            id="recovery-email"
                            type="email"
                            placeholder="Enter your email address"
                            value={email}
                            onChange={(e) => {
                              setEmail(e.target.value);
                              if (errorMessage) setErrorMessage(null);
                            }}
                            className="pl-10 h-12 rounded-xl border-input bg-background text-foreground placeholder:text-muted-foreground focus:bg-background focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all text-sm font-medium"
                            required
                            autoFocus
                            autoComplete="email"
                            disabled={loading}
                          />
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
                            <span>Processing Request...</span>
                          </div>
                        ) : (
                          'Send Recovery Code'
                        )}
                      </Button>

                      <Link
                        to="/login"
                        className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors pt-1"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        <span>Return to Sign In</span>
                      </Link>
                    </CardFooter>
                  </form>
                </motion.div>
              ) : (
                <motion.div
                  key="step-otp"
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
                      Verify Recovery Code
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm font-medium text-muted-foreground max-w-[340px] mx-auto leading-relaxed">
                      Enter the 6-digit recovery code.
                      {emailMasked && (
                        <span className="block font-semibold text-foreground mt-1 font-mono text-[13px]">{emailMasked}</span>
                      )}
                    </CardDescription>
                  </CardHeader>

                  {/* Mandatory Uniform Privacy Notice Card */}
                  <div className="mx-6 sm:mx-8 mt-1 mb-3 p-3.5 rounded-xl bg-muted/60 border border-border text-foreground text-xs flex items-start gap-2.5 shadow-sm">
                    <CheckCircle2 className="h-4 w-4 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
                    <p className="leading-relaxed text-[12px] font-medium text-foreground">
                      {submittedNotice || MANDATORY_PRIVACY_NOTICE}
                    </p>
                  </div>

                  {/* Error Notice */}
                  {errorMessage && (
                    <div className="mx-6 sm:mx-8 mb-3 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-900 dark:text-rose-200 text-xs flex items-start gap-2.5" role="alert">
                      <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                      <p className="leading-relaxed text-[12px] font-medium">
                        {errorMessage}
                      </p>
                    </div>
                  )}

                  <form onSubmit={handleVerifyOTP}>
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
                            setStep('EMAIL');
                            setErrorMessage(null);
                          }}
                          className="inline-flex items-center gap-1 font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        >
                          <ArrowLeft className="h-3.5 w-3.5" />
                          <span>Change Email</span>
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
                            <span>Verifying Code...</span>
                          </div>
                        ) : (
                          'Verify Code & Set New Password'
                        )}
                      </Button>
                    </CardFooter>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full py-4 text-center text-xs text-muted-foreground border-t border-border bg-background/50 transition-colors">
        &copy; {new Date().getFullYear()} MTS Lab. Authorized Personnel Only. Confidential & Encrypted.
      </footer>
    </div>
  );
}
