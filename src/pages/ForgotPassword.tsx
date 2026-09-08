import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Mail,
  Loader2,
  ArrowLeft,
  KeySquare,
  RefreshCw,
  Clock,
  AlertCircle,
  ShieldAlert,
  KeyRound
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

const mtsLogo = '/apple-touch-icon.png';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [resetTicket, setResetTicket] = useState('');
  const [emailMasked, setEmailMasked] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [step, setStep] = useState<'EMAIL' | 'OTP'>('EMAIL');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Please enter your work email address');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const res: any = await api.post('/auth/forgot-password', { email: normalizedEmail });

      if (res.success && res.resetTicket) {
        setResetTicket(res.resetTicket);
        setEmailMasked(res.emailMasked || normalizedEmail);
        setStep('OTP');
        setOtpDigits(['', '', '', '', '', '']);
        setOtpExpirySeconds(900); // 15 minutes
        setResendCooldown(60);
        setCanResend(false);
        toast.success(res.message || 'Verification code sent to your registered email.');
        setTimeout(() => {
          otpInputRefs.current[0]?.focus();
        }, 150);
      } else {
        throw new Error(res.message || 'Failed to send verification code');
      }
    } catch (err: any) {
      const msg = err.message || 'This email is not registered with MTS Lab. Please enter your registered email address.';
      setErrorMessage(msg);
      toast.error(msg);
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
      toast.error('Verification code expired. Please request a new code.');
      return;
    }

    const code = otpDigits.join('').trim();
    if (code.length !== 6) {
      toast.error('Please enter all 6 digits of the verification code');
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

      if (res.success && res.resetToken) {
        toast.success('Code verified successfully.');
        navigate('/reset-password', { state: { resetToken: res.resetToken } });
      } else {
        throw new Error(res.error || res.message || 'Verification failed');
      }
    } catch (err: any) {
      const msg = err.error || err.message || 'Invalid or expired verification code';
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
      const normalizedEmail = email.trim().toLowerCase();
      const res: any = await api.post('/auth/forgot-password', { email: normalizedEmail });

      if (res.success && res.resetTicket) {
        setResetTicket(res.resetTicket);
        toast.success(res.message || 'A new verification code has been sent to your email.');
        setResendCooldown(60);
        setCanResend(false);
        setOtpExpirySeconds(900); // 15 minutes
        setOtpDigits(['', '', '', '', '', '']);
        otpInputRefs.current[0]?.focus();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to resend recovery code');
    } finally {
      setResending(false);
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
          <AnimatePresence mode="wait">
            {step === 'EMAIL' ? (
              <motion.div
                key="step-email"
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 15 }}
                transition={{ duration: 0.2 }}
              >
                <CardHeader className="pt-7 pb-3 text-center space-y-1">
                  <div className="mx-auto w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-1 border border-amber-100/60 shadow-xs">
                    <KeyRound className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
                    Forgot Password?
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm font-medium text-slate-500 max-w-[320px] mx-auto leading-relaxed">
                    Enter your registered email address to receive a recovery code.
                  </CardDescription>
                </CardHeader>

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

                <form onSubmit={handleSendOTP}>
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
                          <span>Sending Recovery Code...</span>
                        </div>
                      ) : (
                        'Send Recovery Code'
                      )}
                    </Button>

                    <Link
                      to="/login"
                      className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors pt-1"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      <span>Back to Login</span>
                    </Link>
                  </CardFooter>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="step-otp"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.2 }}
              >
                <CardHeader className="pt-7 pb-3 text-center space-y-1">
                  <div className="mx-auto w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-1 border border-indigo-100/60 shadow-xs">
                    <KeySquare className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
                    Verification Code
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm font-medium text-slate-500 max-w-[320px] mx-auto leading-relaxed">
                    Enter the 6-digit recovery code sent to your registered email.
                    {emailMasked && (
                      <span className="block font-bold text-slate-800 mt-1">{emailMasked}</span>
                    )}
                  </CardDescription>
                </CardHeader>

                {/* Error Notice Alert */}
                {errorMessage && (
                  <div className="mx-6 sm:mx-8 mb-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-950 text-xs flex items-start gap-2.5 shadow-sm">
                    <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="font-bold text-rose-900">Verification Notice</p>
                      <p className="text-rose-700 leading-relaxed text-[11px]">
                        {errorMessage}
                      </p>
                    </div>
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
                          className="w-10 h-12 sm:w-12 sm:h-14 text-center text-lg sm:text-xl font-black rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10 transition-all outline-none disabled:opacity-50 disabled:bg-slate-100"
                        />
                      ))}
                    </div>

                    {/* Expiration Countdown & Notice */}
                    <div className="flex items-center justify-center pt-1 pb-0.5">
                      {otpExpirySeconds > 0 ? (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100/90 text-slate-600 text-xs font-semibold">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          <span>Code expires in <span className="font-mono font-bold text-slate-900">{formatExpiryTime(otpExpirySeconds)}</span></span>
                        </div>
                      ) : (
                        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center justify-center gap-1.5 w-full">
                          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
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
                        className="inline-flex items-center gap-1.5 font-bold text-indigo-600 hover:text-indigo-800 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors cursor-pointer"
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
                        className="inline-flex items-center gap-1 font-bold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        <span>Change Email</span>
                      </button>
                    </div>
                  </CardContent>

                  <CardFooter className="px-6 sm:px-8 pb-7 pt-2 flex flex-col gap-3">
                    <Button
                      type="submit"
                      className="w-full h-12 rounded-xl bg-slate-950 hover:bg-slate-850 text-white font-bold text-xs sm:text-sm transition-all active:scale-[0.98] disabled:opacity-50 shadow-md shadow-slate-950/15 cursor-pointer"
                      disabled={loading || otpDigits.join('').length !== 6 || otpExpirySeconds <= 0}
                    >
                      {loading ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Verifying Code...</span>
                        </div>
                      ) : (
                        'Verify & Proceed'
                      )}
                    </Button>
                  </CardFooter>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
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
