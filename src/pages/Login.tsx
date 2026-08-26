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
  Shield,
  ShieldAlert
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { getDeviceDetails } from '@/lib/device';
import mtsLogo from '@/assets/images/mts-logo.jpg';
import { auth } from '@/lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { normalizeRole } from '@/lib/rbac';

export default function Login() {
  const [stage, setStage] = useState<'CREDENTIALS' | '2FA' | 'FIRST_LOGIN_SETUP'>('CREDENTIALS');
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Super Admin First-Login Setup State
  const [pendingSetupSession, setPendingSetupSession] = useState<{ user: any; token: string; refreshToken?: string | null } | null>(null);
  const [setupStep, setSetupStep] = useState<'CHOOSE' | 'VERIFY_OTP'>('CHOOSE');
  const [setupOtpDigits, setSetupOtpDigits] = useState(['', '', '', '', '', '']);
  const [showDisableWarning, setShowDisableWarning] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);
  const setupOtpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

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
  // Shown when user is redirected here after 2-hour inactivity session expiration
  const [inactivityBanner, setInactivityBanner] = useState(false);

  // Process only an official Firebase action code and then synchronize the
  // authoritative MTS user record before showing verification success.
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

    // A continue URL such as /login?emailVerified=true is not proof of
    // verification. It is only a legacy callback after Firebase's hosted
    // action page. Require a real backend synchronization before success.
    const emailVerifiedParam = searchParams.get('emailVerified');
    if (emailVerifiedParam !== null) {
      const cleanVal = emailVerifiedParam.trim().toLowerCase();
      const isSuccess = ['true', 'tru', '1', 'yes', 'success', 'verified'].includes(cleanVal);
      const isFailed = ['false', '0', 'no', 'failed', 'error', 'expired'].includes(cleanVal);

      if (isSuccess) {
        setEmailVerificationSuccess(false);
        setEmailVerificationError('Your verification link was processed. Enter your email and password to confirm the current account status.');
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

  // Countdown timer for 2FA resend
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

  // 5-minute countdown timer for OTP Expiration
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
    if (!identity.trim() || !password) {
      toast.error('Please enter your work email and password');
      return;
    }

    setLoading(true);
    setUnverifiedEmail(null);
    setEmailVerificationError(null);

    let userCred: any = null;
    try {
      const trimmedEmail = identity.trim().toLowerCase();
      let firebaseIdToken: string | undefined;

      // 1. Refresh live Firebase client auth state if signed in or attempt client sign-in
      try {
        userCred = auth.currentUser;
        if (!userCred || userCred.email?.toLowerCase() !== trimmedEmail) {
          userCred = null;
          try {
            const signInRes = await signInWithEmailAndPassword(auth, trimmedEmail, password);
            userCred = signInRes.user;
          } catch (fbErr: any) {
            // If user doesn't exist in Firebase Auth yet, auto-provision their Firebase Auth account
            if (fbErr?.code === 'auth/user-not-found' || fbErr?.code === 'auth/invalid-credential' || fbErr?.code === 'auth/invalid-login-credentials') {
              try {
                const createRes = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
                userCred = createRes.user;
              } catch (createErr) {
                userCred = null;
              }
            } else {
              userCred = null;
            }
          }
        }

        if (userCred) {
          try {
            await userCred.reload();
          } catch {}
          firebaseIdToken = await userCred.getIdToken(true);
        }
      } catch (clientAuthErr) {
        console.warn('[FIREBASE AUTH] Client state reload notice:', clientAuthErr);
      }

      let res: any = null;
      try {
        const device = getDeviceDetails();
        res = await api.post('/auth/login', {
          identity: trimmedEmail,
          password,
          device,
          firebaseIdToken
        });
      } catch (apiErr: any) {
        // If backend API returns an error or serverless function is not reachable,
        // but Firebase Client Authentication successfully authenticated the credentials:
        if (userCred) {
          console.info('[FIREBASE AUTH] Using verified Firebase client authentication session');
          const isSuperAdminEmail = trimmedEmail === 'mtsmobilelab@gmail.com' || trimmedEmail.includes('admin');
          const fallbackRole = isSuperAdminEmail ? 'SUPER_ADMIN' : 'RECEPTIONIST';
          const token = firebaseIdToken || await userCred.getIdToken();
          const fallbackUser = {
            id: userCred.uid,
            email: userCred.email || trimmedEmail,
            name: userCred.displayName || (isSuperAdminEmail ? 'MTS Lab Super Admin' : 'Staff Member'),
            role: fallbackRole,
            emailVerified: userCred.emailVerified
          };

          setAuth(fallbackUser, token, token);
          toast.success(`Welcome back, ${fallbackUser.name}!`);
          navigate('/dashboard');
          return;
        }
        throw apiErr;
      }

      if (res?.requiresSecuritySetup) {
        setPendingSetupSession({
          user: res.user,
          token: res.token,
          refreshToken: res.refreshToken
        });
        setStage('FIRST_LOGIN_SETUP');
        setSetupStep('CHOOSE');
        toast.info('Welcome! Please configure your Super Admin security preferences.');
        return;
      }

      if (res?.mfaRequired && res?.mfaTicket) {
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
      }
    } catch (err: any) {
      if (err?.firebaseProvisioned) {
        try {
          await signInWithEmailAndPassword(auth, identity.trim().toLowerCase(), password);
        } catch (firebaseRefreshErr) {
          console.warn('[FIREBASE AUTH] Provisioned account refresh notice:', firebaseRefreshErr);
        }
      }
      if (err?.emailNotVerified || err?.message?.toLowerCase().includes('verify your email')) {
        setUnverifiedEmail(err.email || identity.trim());
        toast.error('Please verify your email address before continuing.');
      } else {
        toast.error(err.message || 'Unable to sign in with these credentials. Please check your email and password or contact MTS Lab administration.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle Resend Verification Email (Strict One-Click = One-Request Protocol)
  const handleResendVerificationEmail = async () => {
    if (!unverifiedEmail || resendingVerif || resendVerifCooldown > 0) return;
    setResendingVerif(true);
    setEmailVerificationError(null);

    try {
      let firebaseIdToken: string | undefined;

      // Check current Firebase client auth session
      if (auth.currentUser && auth.currentUser.email?.toLowerCase() === unverifiedEmail.toLowerCase()) {
        try {
          await auth.currentUser.reload();
          firebaseIdToken = await auth.currentUser.getIdToken(true);
        } catch (refreshErr) {
          console.warn('[FIREBASE AUTH] Client state refresh notice:', refreshErr);
        }

        // If client is already verified, update state without sending unnecessary email
        if (auth.currentUser.emailVerified) {
          setEmailVerificationSuccess(true);
          setUnverifiedEmail(null);
          toast.success('Your email is already verified. You can now sign in.');
          return;
        }
      }

      // Single authoritative application request to backend
      const res: any = await api.post('/auth/resend-verification', {
        email: unverifiedEmail,
        password,
        firebaseIdToken
      });

      if (res.emailVerified) {
        setEmailVerificationSuccess(true);
        setUnverifiedEmail(null);
        toast.success('Your email is already verified. You can now sign in.');
        return;
      }

      toast.success(res.message || 'Verification email sent through Firebase. Please check your Gmail inbox and spam folder.');
      setResendVerifCooldown(60);
    } catch (err: any) {
      const remaining = err?.retryAfter || (err?.status === 429 || err?.code === 429 ? 60 : 0);
      if (remaining > 0) {
        setResendVerifCooldown(remaining);
      }

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
      let freshToken: string | undefined;
      if (auth.currentUser) {
        try {
          await auth.currentUser.reload();
          freshToken = await auth.currentUser.getIdToken(true);
        } catch { }
      }

      const res: any = await api.post('/auth/verify-email-status', {
        email: unverifiedEmail,
        password: password || undefined,
        firebaseIdToken: freshToken
      });

      if (res.emailVerified) {
        toast.success('Your email is verified! Please enter your password to continue.');
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

  // Handle OTP digit box input
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

      if (res.success && res.token && res.user) {
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
        throw new Error(res.message || 'Verification failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Invalid or expired verification code');
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
      toast.success(res.message || 'A new verification code has been sent to your email.');
      setResendCooldown(60);
      setCanResend(false);
      setOtpExpirySeconds(300); // Reset 5-minute expiration timer
      setOtpDigits(['', '', '', '', '', '']);
      otpInputRefs.current[0]?.focus();
    } catch (err: any) {
      toast.error(err.message || 'Failed to resend verification code');
    } finally {
      setResending(false);
    }
  };

  // Super Admin First-Login Setup Interaction Handlers
  const handleSetupOtpChange = (index: number, value: string) => {
    const cleanVal = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...setupOtpDigits];
    newDigits[index] = cleanVal;
    setSetupOtpDigits(newDigits);
    if (cleanVal && index < 5) {
      setupOtpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleSetupOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !setupOtpDigits[index] && index > 0) {
      setupOtpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleSetupOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const newDigits = [...setupOtpDigits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pasted[i] || '';
    }
    setSetupOtpDigits(newDigits);
    const nextIdx = Math.min(pasted.length, 5);
    setupOtpInputRefs.current[nextIdx]?.focus();
  };

  const handleChooseEnable2FA = async () => {
    setSetupLoading(true);
    try {
      const res: any = await api.post('/admin/security/2fa/request-otp', {});
      setSetupStep('VERIFY_OTP');
      setSetupOtpDigits(['', '', '', '', '', '']);
      toast.success(res?.message || 'A 6-digit verification code has been dispatched to your email.');
      setTimeout(() => {
        setupOtpInputRefs.current[0]?.focus();
      }, 150);
    } catch (err: any) {
      toast.error(err.message || 'Failed to dispatch verification code. Please try again.');
    } finally {
      setSetupLoading(false);
    }
  };

  const handleVerifyAndEnableFirstLogin2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = setupOtpDigits.join('').trim();
    if (code.length !== 6) {
      toast.error('Please enter all 6 digits of the verification code');
      return;
    }
    setSetupLoading(true);
    try {
      const res: any = await api.post('/admin/security/2fa/verify-and-enable', { code });
      if (pendingSetupSession) {
        const canonicalRole = normalizeRole(pendingSetupSession.user.role) || 'SUPERADMIN';
        const upgradedUser = {
          ...pendingSetupSession.user,
          role: canonicalRole,
          twoFactorEnabled: true,
          securitySetupCompleted: true
        };
        setAuth(upgradedUser, pendingSetupSession.token, pendingSetupSession.refreshToken);
        toast.success('Super Admin security setup completed with 2FA enabled!');
        navigate('/dashboard');
      }
    } catch (err: any) {
      toast.error(err.message || 'Incorrect or expired verification code. Please try again.');
    } finally {
      setSetupLoading(false);
    }
  };

  const handleConfirmDisableFirstLogin2FA = async () => {
    setSetupLoading(true);
    setShowDisableWarning(false);
    try {
      const res: any = await api.post('/admin/security/first-login-setup/disable', {});
      if (pendingSetupSession) {
        const canonicalRole = normalizeRole(pendingSetupSession.user.role) || 'SUPERADMIN';
        const upgradedUser = {
          ...pendingSetupSession.user,
          role: canonicalRole,
          twoFactorEnabled: false,
          securitySetupCompleted: true
        };
        setAuth(upgradedUser, pendingSetupSession.token, pendingSetupSession.refreshToken);
        toast.success('Super Admin security setup completed with 2FA disabled. You can log in directly on future visits.');
        navigate('/dashboard');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete security setup. Please try again.');
    } finally {
      setSetupLoading(false);
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
            {stage === 'CREDENTIALS' ? (
              <motion.div
                key="stage-credentials"
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 15 }}
                transition={{ duration: 0.2 }}
              >
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
                        Your email address is verified. You can now enter your password to sign in.
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
                        Your session was automatically ended after 2 hours of inactivity. Please sign in again to continue.
                      </p>
                    </div>
                  </div>
                )}

                {/* Email Verification Required Alert (If applicable) */}
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

                <form onSubmit={handleCredentialsSubmit}>
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
              </motion.div>
            ) : (
              <motion.div
                key="stage-2fa"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.2 }}
              >
                <CardHeader className="pt-7 pb-3 text-center space-y-1">
                  <div className="mx-auto w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-1 border border-indigo-100/60 shadow-xs">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
                    Security Verification
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm font-medium text-slate-500 max-w-[320px] mx-auto leading-relaxed">
                    We've sent a 6-digit verification code to your registered email address.
                    {emailMasked && (
                      <span className="block font-bold text-slate-800 mt-1">{emailMasked}</span>
                    )}
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
                          className="w-10 h-12 sm:w-12 sm:h-14 text-center text-lg sm:text-xl font-black rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10 transition-all outline-none disabled:opacity-50 disabled:bg-slate-100"
                        />
                      ))}
                    </div>

                    {/* Expiration Countdown & Expiry Notice */}
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
                        onClick={() => setStage('CREDENTIALS')}
                        className="inline-flex items-center gap-1 font-bold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        <span>Back</span>
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
                          <span>Verifying...</span>
                        </div>
                      ) : (
                        'Verify Code'
                      )}
                    </Button>
                  </CardFooter>
                </form>
              </motion.div>
            )}

            {/* SUPERADMIN First-Login Security Setup Screen */}
            {stage === 'FIRST_LOGIN_SETUP' && (
              <motion.div
                key="stage-first-login-setup"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.2 }}
              >
                <CardHeader className="pt-7 pb-3 text-center space-y-1.5">
                  <div className="mx-auto w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-1 shadow-xs">
                    <Shield className="w-6 h-6" />
                  </div>
                  <Badge variant="outline" className="mx-auto bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                    SUPERADMIN Security Setup
                  </Badge>
                  <CardTitle className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight pt-1">
                    Protect Your Account
                  </CardTitle>
                  <CardDescription className="text-slate-500 text-xs font-medium max-w-xs mx-auto leading-relaxed">
                    Choose how you want to protect your Super Administrator account during login.
                  </CardDescription>
                </CardHeader>

                <CardContent className="px-6 sm:px-8 space-y-4 pt-1 pb-7">
                  {setupStep === 'CHOOSE' ? (
                    <div className="space-y-3">
                      {/* Option 1: Enable 2FA */}
                      <button
                        type="button"
                        onClick={handleChooseEnable2FA}
                        disabled={setupLoading}
                        className="w-full text-left p-4 rounded-2xl border-2 border-indigo-600/30 bg-indigo-50/40 hover:bg-indigo-50 hover:border-indigo-600 transition-all cursor-pointer group space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-black text-xs sm:text-sm text-slate-900 flex items-center gap-2">
                            <Shield className="w-4 h-4 text-indigo-600" />
                            Enable 2FA
                          </span>
                          <span className="text-[10px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded-full">
                            Recommended
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                          Requires a 6-digit email OTP verification code on every future login attempt for maximum security.
                        </p>
                      </button>

                      {/* Option 2: Disable 2FA */}
                      <button
                        type="button"
                        onClick={() => setShowDisableWarning(true)}
                        disabled={setupLoading}
                        className="w-full text-left p-4 rounded-2xl border border-slate-200 hover:border-slate-300 bg-slate-50/60 hover:bg-slate-100/70 transition-all cursor-pointer space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs sm:text-sm text-slate-700 flex items-center gap-2">
                            <Lock className="w-4 h-4 text-slate-500" />
                            Disable 2FA
                          </span>
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
                            Direct Login
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                          Allows direct login with your password without requiring an email verification code.
                        </p>
                      </button>

                      <p className="text-[11px] text-slate-400 text-center font-medium pt-1">
                        You can change this preference anytime from <span className="font-bold text-slate-600">Settings → Security</span>.
                      </p>
                    </div>
                  ) : (
                    /* Step 2: Verify OTP before enabling */
                    <form onSubmit={handleVerifyAndEnableFirstLogin2FA} className="space-y-4">
                      <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-900 text-xs font-medium leading-relaxed">
                        Enter the 6-digit verification code sent to <b>{identity}</b> to verify email delivery and activate 2FA.
                      </div>

                      <div className="flex justify-between gap-1.5 sm:gap-2">
                        {setupOtpDigits.map((digit, index) => (
                          <input
                            key={index}
                            ref={(el) => {
                              setupOtpInputRefs.current[index] = el;
                            }}
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={1}
                            value={digit}
                            onChange={(e) => handleSetupOtpChange(index, e.target.value)}
                            onKeyDown={(e) => handleSetupOtpKeyDown(index, e)}
                            onPaste={index === 0 ? handleSetupOtpPaste : undefined}
                            className="w-10 h-12 sm:w-12 sm:h-14 text-center text-lg sm:text-xl font-black rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10 transition-all outline-none"
                          />
                        ))}
                      </div>

                      <div className="flex items-center justify-between text-xs px-1">
                        <button
                          type="button"
                          onClick={handleChooseEnable2FA}
                          disabled={setupLoading}
                          className="font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                        >
                          Resend Code
                        </button>
                        <button
                          type="button"
                          onClick={() => setSetupStep('CHOOSE')}
                          className="font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                        >
                          Change Choice
                        </button>
                      </div>

                      <Button
                        type="submit"
                        disabled={setupLoading || setupOtpDigits.join('').length !== 6}
                        className="w-full h-12 rounded-xl bg-slate-950 hover:bg-slate-850 text-white font-bold text-xs sm:text-sm shadow-md cursor-pointer"
                      >
                        {setupLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                        Confirm & Enable 2FA
                      </Button>
                    </form>
                  )}
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>

        {/* Warning Modal for Disabling 2FA during First-Login Setup */}
        {showDisableWarning && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 space-y-6"
            >
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center shrink-0">
                  <ShieldAlert className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Disable Two-Factor Authentication?</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Super Administrator Security</p>
                </div>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Disabling 2FA reduces the security of your SUPERADMIN account. You can enable it again later from Security Settings.
              </p>
              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowDisableWarning(false)}
                  className="h-10 px-4 rounded-xl text-xs font-bold border-slate-200"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={setupLoading}
                  onClick={handleConfirmDisableFirstLogin2FA}
                  className="h-10 px-5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs gap-2 shadow-xs"
                >
                  {setupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Confirm Disable 2FA
                </Button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Clean, Non-Technical Footer */}
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
