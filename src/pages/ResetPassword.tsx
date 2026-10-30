import React, { useState } from 'react';
import { useNavigate, useLocation, Navigate, Link } from 'react-router-dom';
import {
  Lock,
  Loader2,
  ShieldCheck,
  Eye,
  EyeOff,
  ArrowLeft,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Sun,
  Moon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { api } from '@/services/api';
import { useAppTheme } from '@/context/ThemeContext';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import BrandLogo from '@/components/BrandLogo';

export default function ResetPassword() {
  const { effectiveTheme, setUserPreference } = useAppTheme();
  const isDarkMode = effectiveTheme === 'dark' || effectiveTheme === 'night' || effectiveTheme === 'tihar';

  const toggleTheme = () => {
    setUserPreference(isDarkMode ? 'light' : 'dark');
  };

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const navigate = useNavigate();
  const location = useLocation();
  const resetToken = location.state?.resetToken;

  if (!resetToken) {
    return <Navigate to="/forgot-password" replace />;
  }

  // Password requirements calculation
  const hasMinLength = newPassword.length >= 8;
  const hasNumberOrSymbol = /[0-9!@#$%^&*(),.?":{}|<>]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!hasMinLength) {
      const msg = 'Password must be at least 8 characters long.';
      setErrorMsg(msg);
      toast.error(msg);
      return;
    }

    if (newPassword !== confirmPassword) {
      const msg = 'Passwords do not match. Please verify both fields.';
      setErrorMsg(msg);
      toast.error(msg);
      return;
    }

    setLoading(true);
    try {
      const res: any = await api.post('/auth/reset-password', { resetToken, newPassword });
      toast.success(res?.message || 'Password reset successfully. Please sign in with your new password.');
      navigate('/login', { replace: true });
    } catch (err: any) {
      const msg = err?.error || err?.message || 'Failed to reset password. The link or token may have expired.';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-background text-foreground transition-colors duration-200 selection:bg-cyan-500 selection:text-white dark:selection:text-slate-950 font-sans antialiased">
      {/* Background Decorative Ambience */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-gradient-to-b from-cyan-500/10 via-blue-600/5 to-transparent blur-3xl rounded-full opacity-60 dark:opacity-100" />
        <div className="absolute -bottom-32 right-1/4 w-[450px] h-[300px] bg-gradient-to-t from-emerald-500/10 via-cyan-500/5 to-transparent blur-3xl rounded-full opacity-60 dark:opacity-100" />
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
            <span>Cancel & Sign In</span>
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
          {/* Main Card Container */}
          <Card className="border border-border shadow-xl shadow-black/5 dark:shadow-2xl dark:shadow-black/70 rounded-2xl sm:rounded-3xl bg-card text-card-foreground overflow-hidden transition-colors">
            <CardHeader className="pt-8 pb-3 text-center space-y-2">
              <div className="mx-auto w-12 h-12 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mb-1 border border-emerald-500/20 shadow-inner">
                <KeyRound className="h-6 w-6" />
              </div>
              <CardTitle className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                Create New Password
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm font-medium text-muted-foreground max-w-[340px] mx-auto leading-relaxed">
                Choose a strong, secure password with at least 8 characters.
              </CardDescription>
            </CardHeader>

            {/* Error Message Alert */}
            {errorMsg && (
              <div className="mx-6 sm:mx-8 mb-3 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-900 dark:text-rose-200 text-xs flex items-start gap-2.5" role="alert">
                <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed text-[12px] font-medium">
                  {errorMsg}
                </p>
              </div>
            )}

            <form onSubmit={handleReset} noValidate>
              <CardContent className="space-y-4 px-6 sm:px-8 pt-2">
                {/* New Password Field */}
                <div className="space-y-1.5">
                  <label htmlFor="new-password" className="text-xs font-semibold text-foreground ml-1">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="new-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        if (errorMsg) setErrorMsg(null);
                      }}
                      className="pl-10 pr-10 h-12 rounded-xl border-input bg-background text-foreground placeholder:text-muted-foreground focus:bg-background focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all text-sm font-medium"
                      required
                      autoFocus
                      autoComplete="new-password"
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

                {/* Confirm Password Field */}
                <div className="space-y-1.5">
                  <label htmlFor="confirm-password" className="text-xs font-semibold text-foreground ml-1">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <ShieldCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Re-type new password"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (errorMsg) setErrorMsg(null);
                      }}
                      className="pl-10 pr-10 h-12 rounded-xl border-input bg-background text-foreground placeholder:text-muted-foreground focus:bg-background focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all text-sm font-medium"
                      required
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1 cursor-pointer"
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Password Criteria Checklist */}
                <div className="p-3 rounded-xl bg-muted/60 border border-border space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className={`h-3.5 w-3.5 ${hasMinLength ? 'text-emerald-500' : 'text-muted-foreground/40'}`} />
                    <span className={hasMinLength ? 'text-foreground font-medium' : ''}>At least 8 characters</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className={`h-3.5 w-3.5 ${hasNumberOrSymbol ? 'text-emerald-500' : 'text-muted-foreground/40'}`} />
                    <span className={hasNumberOrSymbol ? 'text-foreground font-medium' : ''}>Includes a number or special symbol</span>
                  </div>
                  {confirmPassword.length > 0 && (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className={`h-3.5 w-3.5 ${passwordsMatch ? 'text-emerald-500' : 'text-rose-500'}`} />
                      <span className={passwordsMatch ? 'text-foreground font-medium' : 'text-rose-600 dark:text-rose-400 font-medium'}>
                        {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>

              <CardFooter className="px-6 sm:px-8 pb-8 pt-3 flex flex-col gap-3 bg-transparent">
                <Button
                  type="submit"
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 dark:from-emerald-500 dark:to-cyan-600 text-white dark:text-slate-950 font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-50 shadow-md shadow-emerald-600/20 cursor-pointer"
                  disabled={loading || !hasMinLength || !passwordsMatch}
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
                  className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors pt-1"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Cancel & Back to Sign In</span>
                </Link>
              </CardFooter>
            </form>
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
