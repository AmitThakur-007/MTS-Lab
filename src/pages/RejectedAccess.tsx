import { Link } from 'react-router-dom';
import { XCircle, ArrowLeft, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { motion } from 'motion/react';

export default function RejectedAccess() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#fdfdfd] px-4 selection:bg-slate-200">
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-[440px]"
      >
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-[72px] h-[72px] bg-red-600 rounded-[22px] flex items-center justify-center text-white mb-6 shadow-2xl shadow-red-600/10">
            <XCircle className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-1">MTS Lab</h1>
          <p className="text-slate-500 text-sm font-medium">Repair Management OS v2.0</p>
        </div>

        <Card className="border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.03)] rounded-[24px] text-center overflow-hidden">
          <CardHeader className="pt-8 pb-3">
            <CardTitle className="text-xl font-bold text-slate-900 text-red-600">Access Denied</CardTitle>
            <CardDescription className="font-medium text-slate-500">
              Request Refused by Security Policy
            </CardDescription>
          </CardHeader>
          <CardContent className="px-8 py-4 space-y-4">
            <p className="text-slate-600 text-[15px] leading-relaxed">
              Access request rejected. Please contact MTS Lab administration.
            </p>

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
                <XCircle className="h-6 w-6 text-rose-600 shrink-0" />
                <span className="text-xs font-black text-rose-800 uppercase tracking-wide">Maximum request limit reached.</span>
                <p className="text-[11px] text-rose-700 font-bold leading-relaxed">
                  Access request limit exceeded. You have already submitted the maximum number of requests allowed. Please contact the Super Administrator.
                </p>
              </div>
            ) : (
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-3 text-left">
                <HelpCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 font-semibold leading-relaxed">
                  If you believe this is an error or need your role configured differently, reach out directly to your assigned depot administrator. You still have further attempts remaining.
                </p>
              </div>
            )}
          </CardContent>
          <CardFooter className="px-8 pb-8 pt-2">
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
