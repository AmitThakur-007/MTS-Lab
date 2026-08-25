import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Clock, ShieldAlert, ArrowLeft, RefreshCw, Smartphone, Laptop, Tablet, Monitor, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { motion } from 'motion/react';
import { api } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { getDeviceDetails, getDeviceIdentifier } from '@/lib/device';
import { toast } from 'sonner';

export default function PendingApproval() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [checking, setChecking] = useState(false);
  const [deviceInfo] = useState(() => getDeviceDetails());
  const [deviceIdentifier] = useState(() => getDeviceIdentifier());
  const [email] = useState(() => localStorage.getItem('pending_auth_email') || '');

  const checkStatus = async (silent = false) => {
    if (!email) return;
    if (!silent) setChecking(true);

    try {
      const res = await api.get(`/auth/device-status?email=${encodeURIComponent(email)}&deviceIdentifier=${encodeURIComponent(deviceIdentifier)}`);
      
      if (res.approved && res.token && res.user) {
        setAuth(res.user, res.token, res.refreshToken);
        localStorage.removeItem('google_request_count');
        localStorage.removeItem('google_request_limit_reached');
        localStorage.removeItem('pending_auth_email');
        toast.success(`Access Approved! Welcome back, ${res.user.name}.`);
        navigate('/dashboard');
      } else if (res.rejected) {
        toast.error("Your device access request was rejected by the Super Administrator.");
        navigate('/rejected-access');
      } else if (!silent) {
        toast.info(res.message || "Still awaiting Super Administrator review...");
      }
    } catch (err: any) {
      if (!silent) {
        console.error("Status check failed:", err);
      }
    } finally {
      if (!silent) setChecking(false);
    }
  };

  useEffect(() => {
    // Initial check
    checkStatus(true);

    // Periodic polling every 3 seconds for instant response
    const interval = setInterval(() => {
      checkStatus(true);
    }, 3000);

    return () => clearInterval(interval);
  }, [email, deviceIdentifier]);

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'SMARTPHONE':
        return <Smartphone className="h-5 w-5 text-indigo-600" />;
      case 'TABLET':
        return <Tablet className="h-5 w-5 text-indigo-600" />;
      case 'LAPTOP':
        return <Laptop className="h-5 w-5 text-indigo-600" />;
      default:
        return <Monitor className="h-5 w-5 text-indigo-600" />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#fdfdfd] px-4 selection:bg-slate-200">
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-[480px]"
      >
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-[72px] h-[72px] bg-amber-500 rounded-[22px] flex items-center justify-center text-white mb-6 shadow-2xl shadow-amber-500/10">
            <Clock className="h-8 w-8 animate-pulse" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-1">MTS Lab</h1>
          <p className="text-slate-500 text-sm font-medium">Repair Management OS v2.0</p>
        </div>

        <Card className="border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.03)] rounded-[24px] text-center overflow-hidden">
          <CardHeader className="pt-8 pb-3">
            <CardTitle className="text-xl font-bold text-slate-900">Device Access Awaiting Approval</CardTitle>
            <CardDescription className="font-medium text-slate-500">
              New Device Security Verification
            </CardDescription>
          </CardHeader>
          <CardContent className="px-8 py-4 space-y-4">
            <p className="text-slate-600 text-[14px] leading-relaxed">
              Your Google access request from this device has been sent to the MTS Super Administrator for authorization.
            </p>

            {/* Device Info Card */}
            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl text-left space-y-2">
              <div className="flex items-center gap-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
                {getDeviceIcon(deviceInfo.deviceType)}
                <span>Detected Device</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="font-extrabold text-slate-900 text-sm">{deviceInfo.deviceName}</span>
                <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 uppercase">{deviceInfo.deviceType}</span>
              </div>
              <div className="text-[11px] text-slate-500 font-medium">
                {deviceInfo.browser} • {deviceInfo.os}
              </div>
            </div>

            {/* Request Attempts Display */}
            <div className="py-2.5 px-4 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col items-center justify-center">
              <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase mb-1">Request Attempts</span>
              <span className="text-xl font-black text-slate-800 tracking-tight">
                {parseInt(localStorage.getItem('google_request_count') || '1', 10)} / 3
              </span>
            </div>

            {/* Warning or Alert card on limit reached */}
            {(localStorage.getItem('google_request_limit_reached') === 'true' || parseInt(localStorage.getItem('google_request_count') || '0', 10) >= 3) ? (
              <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100 flex flex-col items-center gap-2 text-center">
                <ShieldAlert className="h-6 w-6 text-rose-600 shrink-0" />
                <span className="text-xs font-black text-rose-800 uppercase tracking-wide">Maximum request limit reached.</span>
                <p className="text-[11px] text-rose-700 font-bold leading-relaxed">
                  You have used all 3 access request attempts. Please wait for administrator action or contact MTS Lab.
                </p>
              </div>
            ) : (
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-3 text-left">
                <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 font-semibold leading-relaxed">
                  New devices require explicit authorization. As soon as the Super Administrator approves your device, this screen will automatically refresh and log you into your workspace.
                </p>
              </div>
            )}
          </CardContent>
          <CardFooter className="px-8 pb-8 pt-2 flex flex-col gap-3">
            <Button 
              onClick={() => checkStatus(false)} 
              disabled={checking}
              className="w-full h-12 rounded-xl bg-black hover:bg-slate-800 text-white font-bold text-[14px] flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
              {checking ? 'Checking Status...' : 'Check Approval Status'}
            </Button>
            <Link to="/login" className="w-full">
              <Button variant="outline" className="w-full h-12 rounded-xl border-slate-200 bg-white font-bold text-[14px] flex items-center justify-center gap-2 hover:bg-slate-50">
                <ArrowLeft className="h-4 w-4" />
                Return to Login
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}
