import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Package,
  Clock,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  MapPin,
  ShieldCheck,
  Phone,
  PhoneCall,
  History,
  Hash,
  Copy,
  Check,
  Wrench,
  Info,
  UserCheck,
  Layers,
  Truck,
  ExternalLink,
  RotateCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useRealtimeSync } from '@/services/realtime';

const statusConfig: Record<string, { label: string; color: string; bgSoft: string; textColor: string; icon: any; progress: number; desc: string }> = {
  RECEIVED: {
    label: 'Device Received',
    color: 'bg-amber-500',
    bgSoft: 'bg-amber-50 text-amber-900 border-amber-200',
    textColor: 'text-amber-600',
    icon: Clock,
    progress: 15,
    desc: 'Your device has been safely cataloged and inspected into the MTS Lab inventory.'
  },
  DIAGNOSING: {
    label: 'Diagnosis In Progress',
    color: 'bg-blue-600',
    bgSoft: 'bg-blue-50 text-blue-900 border-blue-200',
    textColor: 'text-blue-600',
    icon: Search,
    progress: 35,
    desc: 'Certified micro-engineers are diagnosing motherboards, IC circuits, and display assemblies.'
  },
  IN_PROCESS: {
    label: 'Restoration In Progress',
    color: 'bg-indigo-600',
    bgSoft: 'bg-indigo-50 text-indigo-900 border-indigo-200',
    textColor: 'text-indigo-600',
    icon: Wrench,
    progress: 55,
    desc: 'Active hardware repair, micro-soldering, and OEM component replacement in progress.'
  },
  WAITING_FOR_PARTS: {
    label: 'Waiting For Parts',
    color: 'bg-purple-600',
    bgSoft: 'bg-purple-50 text-purple-900 border-purple-200',
    textColor: 'text-purple-600',
    icon: Package,
    progress: 65,
    desc: 'Sourcing genuine Grade-A replacement components from our logistics inventory.'
  },
  TESTING: {
    label: 'Testing & QA Diagnostics',
    color: 'bg-orange-500',
    bgSoft: 'bg-orange-50 text-orange-900 border-orange-200',
    textColor: 'text-orange-600',
    icon: ShieldCheck,
    progress: 80,
    desc: 'Performing comprehensive 36-point diagnostic inspection and display touch calibration.'
  },
  REPAIRED: {
    label: 'Device Repaired',
    color: 'bg-cyan-600',
    bgSoft: 'bg-cyan-50 text-cyan-900 border-cyan-200',
    textColor: 'text-cyan-600',
    icon: CheckCircle2,
    progress: 90,
    desc: 'Technical repair completed successfully and passed quality verification standards.'
  },
  READY_FOR_PICKUP: {
    label: 'Ready For Collection / Dispatch',
    color: 'bg-emerald-600',
    bgSoft: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    textColor: 'text-emerald-600',
    icon: MapPin,
    progress: 92,
    desc: 'Restoration verified. Your device is sanitized and packaged ready for counter pickup or return courier dispatch.'
  },
  COURIER_DISPATCHED: {
    label: 'Return Courier Dispatched',
    color: 'bg-blue-700',
    bgSoft: 'bg-blue-50 text-blue-900 border-blue-300 ring-2 ring-blue-500/20',
    textColor: 'text-blue-700',
    icon: Truck,
    progress: 96,
    desc: 'Repaired device has been safely packed and dispatched via courier logistics back to your destination district.'
  },
  DELIVERED: {
    label: 'Delivered & Handed Over',
    color: 'bg-slate-900',
    bgSoft: 'bg-slate-100 text-slate-900 border-slate-300',
    textColor: 'text-slate-900',
    icon: CheckCircle2,
    progress: 100,
    desc: 'Device has been collected / delivered to the customer.'
  },
  RE_PROBLEM: {
    label: 'Re-Problem (Warranty Intake)',
    color: 'bg-rose-600',
    bgSoft: 'bg-rose-50 text-rose-900 border-rose-300 ring-2 ring-rose-500/20',
    textColor: 'text-rose-600',
    icon: AlertCircle,
    progress: 40,
    desc: 'Device has been reopened for priority post-delivery warranty inspection and diagnosis.'
  },
  REPROBLEM: {
    label: 'Re-Problem (Warranty Intake)',
    color: 'bg-rose-600',
    bgSoft: 'bg-rose-50 text-rose-900 border-rose-300 ring-2 ring-rose-500/20',
    textColor: 'text-rose-600',
    icon: AlertCircle,
    progress: 40,
    desc: 'Device has been reopened for priority post-delivery warranty inspection and diagnosis.'
  },
  CANNOT_REPAIR: {
    label: 'Cannot Repair',
    color: 'bg-rose-600',
    bgSoft: 'bg-rose-50 text-rose-900 border-rose-200',
    textColor: 'text-rose-600',
    icon: AlertCircle,
    progress: 100,
    desc: 'Catastrophic circuit damage exceeds viable safe restoration standards.'
  }
};

const WALK_IN_TIMELINE_STEPS = [
  { key: 'RECEIVED', label: 'Received', icon: Clock },
  { key: 'DIAGNOSING', label: 'Diagnosing', icon: Search },
  { key: 'IN_PROCESS', label: 'Restoration', icon: Wrench },
  { key: 'TESTING', label: 'QA Testing', icon: ShieldCheck },
  { key: 'READY_FOR_PICKUP', label: 'Ready', icon: MapPin },
  { key: 'DELIVERED', label: 'Delivered', icon: CheckCircle2 }
];

const COURIER_TIMELINE_STEPS = [
  { key: 'RECEIVED', label: 'Lab Received', icon: Package },
  { key: 'DIAGNOSING', label: 'Diagnosing', icon: Search },
  { key: 'IN_PROCESS', label: 'Restoration', icon: Wrench },
  { key: 'TESTING', label: 'QA Testing', icon: ShieldCheck },
  { key: 'READY_FOR_PICKUP', label: 'Ready', icon: MapPin },
  { key: 'COURIER_DISPATCHED', label: 'Dispatched', icon: Truck },
  { key: 'DELIVERED', label: 'Delivered', icon: CheckCircle2 }
];

function sanitizeLogMessage(msg: string): string {
  if (!msg || typeof msg !== 'string') return '';
  let sanitized = msg;
  sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi, 'Technician');
  sanitized = sanitized.replace(/\bby\s+([a-zA-Z0-9_.'\s-]+?)\s*\((?:SUPER_ADMIN|SUPER\s*ADMIN|ADMIN|MANAGER|RECEPTIONIST|TECHNICIAN|STAFF)\)/gi, 'by Technician');
  sanitized = sanitized.replace(/\bby\s+(?:MTS\s+)?(?:super\s*admin|admin|manager|receptionist|staff|specialist)\b/gi, 'by Technician');
  sanitized = sanitized.replace(/\bby\s+specialist\s+[^,\.\n]+/gi, 'by Technician');
  return sanitized.trim();
}

function getCustomerFriendlyLogDetails(action: string, status?: string, notes?: string) {
  const state = (status || action || '').toUpperCase();

  if (state.includes('RECEIVED') || state.includes('CREATED') || state === 'CREATED') {
    return { title: 'Device Received', desc: 'Device securely cataloged and checked into MTS Lab inventory.' };
  }
  if (state.includes('DIAGNOSING')) {
    return { title: 'Diagnosis In Progress', desc: 'Certified micro-engineers are inspecting device hardware and circuitry.' };
  }
  if (state.includes('PROCESS') || state.includes('REPAIR') || state.includes('RESTORATION')) {
    return { title: 'Restoration In Progress', desc: notes ? sanitizeLogMessage(notes) : 'Active hardware restoration and component replacement under way.' };
  }
  if (state.includes('TEST') || state.includes('QA')) {
    return { title: 'QA & Stress Testing', desc: 'Performing rigorous 36-point benchmark and touch validation.' };
  }
  if (state.includes('READY') || state.includes('PICKUP')) {
    return { title: 'Ready for Collection', desc: 'Device sanitized and packaged ready for pickup or dispatch.' };
  }
  if (state.includes('DELIVERED')) {
    return { title: 'Delivered Successfully', desc: 'Device handed over to customer with service warranty.' };
  }

  return { title: 'Status Update', desc: notes ? sanitizeLogMessage(notes) : 'Device status updated to reflect current laboratory progress.' };
}

const TRACKING_REALTIME_ENTITIES = ['repair', 'repairLog'];

export default function Tracking() {
  const [searchParams] = useSearchParams();
  const [repairNumber, setRepairNumber] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [trackingData, setTrackingData] = useState<any>(null);
  const [selectedDeviceIndex, setSelectedDeviceIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  const executeTracking = useCallback(async (repNo: string, phone: string) => {
    const cleanRepNo = (repNo || '').trim().replace(/^#+/, '').trim();
    const cleanPhone = (phone || '').trim().replace(/\D/g, '');

    if (!cleanRepNo && !cleanPhone) {
      toast.error('Please enter your Repair Job Number or Registered Phone Number.');
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (cleanRepNo) params.set('repairNumber', cleanRepNo);
      if (cleanPhone) params.set('phone', cleanPhone);

      const res: any = await api.get(`/track?${params.toString()}`);
      let normalizedData: any = null;

      if (Array.isArray(res)) {
        if (res.length === 0) throw new Error('No repair records found.');
        normalizedData = res.length === 1 ? res[0] : { devices: res, customer: { name: res[0]?.customerName } };
      } else if (res?.repair) {
        normalizedData = res.repair;
      } else if (res?.repairs && Array.isArray(res.repairs)) {
        normalizedData = res.repairs.length === 1 ? res.repairs[0] : { devices: res.repairs, customer: { name: res.repairs[0]?.customerName } };
      } else {
        normalizedData = res;
      }

      setTrackingData(normalizedData);
      setSelectedDeviceIndex(0);
      toast.success('Live repair records retrieved successfully.');
    } catch (err: any) {
      console.error('[TRACK REPAIR ERROR]', err);
      toast.error(err?.message || 'We couldn’t find a repair record matching the information provided.');
      setTrackingData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const urlRepairNo = searchParams.get('repairNumber')?.trim() || searchParams.get('job')?.trim() || searchParams.get('ticket')?.trim();
    const urlPhone = searchParams.get('phone')?.trim();

    if (urlRepairNo) {
      setRepairNumber(urlRepairNo);
      if (urlPhone) setPhoneNumber(urlPhone);
      executeTracking(urlRepairNo, urlPhone || '');
    } else if (urlPhone) {
      setPhoneNumber(urlPhone);
      executeTracking('', urlPhone);
    }
  }, [searchParams, executeTracking]);

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeTracking(repairNumber, phoneNumber);
  };

  useRealtimeSync(TRACKING_REALTIME_ENTITIES, useCallback((event: any) => {
    if (trackingData) {
      const activeRep = trackingData.devices?.[selectedDeviceIndex] || trackingData;
      if (!event.id || event.id === activeRep.id || event.data?.id === activeRep.id) {
        executeTracking(repairNumber, phoneNumber);
      }
    }
  }, [trackingData, selectedDeviceIndex, repairNumber, phoneNumber, executeTracking]));

  const activeRepair = trackingData?.devices?.[selectedDeviceIndex] || trackingData;
  const isCourierDevice = activeRepair?.receivingMethod === 'COURIER' || activeRepair?.isCourierIn === true || Boolean(activeRepair?.isReturnCourierDispatched);
  const timelineSteps = isCourierDevice ? COURIER_TIMELINE_STEPS : WALK_IN_TIMELINE_STEPS;

  let currentStatusKey = activeRepair?.status || 'RECEIVED';
  const currentStatus = statusConfig[currentStatusKey] || statusConfig.RECEIVED;

  const copyRepairNumber = (num: string) => {
    if (!num) return;
    navigator.clipboard.writeText(num.replace(/^#+/, ''));
    setCopied(true);
    toast.success(`Copied Repair #${num.replace(/^#+/, '')}`);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStepStatus = (stepKey: string, currentRepairStatus: string) => {
    const sequence = isCourierDevice
      ? ['RECEIVED', 'DIAGNOSING', 'IN_PROCESS', 'TESTING', 'READY_FOR_PICKUP', 'COURIER_DISPATCHED', 'DELIVERED']
      : ['RECEIVED', 'DIAGNOSING', 'IN_PROCESS', 'TESTING', 'READY_FOR_PICKUP', 'DELIVERED'];

    const currentIndex = sequence.indexOf(currentRepairStatus);
    const stepIndex = sequence.indexOf(stepKey);

    if (currentIndex === -1) return 'upcoming';
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'upcoming';
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-slate-900 selection:text-white">
      <Navbar />

      <main className="flex-1 pt-28 sm:pt-32 md:pt-36 pb-12 sm:pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8">

          {/* Header Banner */}
          <div className="text-center space-y-2.5 max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-200/80 border border-slate-300 text-slate-800 text-[11px] font-bold uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-700" />
              <span>MTS Lab Official Tracking Portal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
              Track Your Repair
            </h1>
          </div>

          {/* Search Card */}
          <Card className="rounded-2xl sm:rounded-3xl border border-slate-200 shadow-lg bg-white overflow-hidden max-w-3xl mx-auto">
            <CardContent className="p-5 sm:p-7 md:p-8">
              <form onSubmit={handleTrackSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5 text-slate-500" />
                      <span>Repair Job Number</span>
                    </label>
                    <Input
                      placeholder="e.g. MTS-2026-0001"
                      value={repairNumber}
                      onChange={(e) => setRepairNumber(e.target.value)}
                      className="h-11 sm:h-12 rounded-xl bg-slate-50 border-slate-200 font-mono text-xs sm:text-sm pl-3.5"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-500" />
                      <span>Registered Phone Number</span>
                    </label>
                    <Input
                      placeholder="e.g. 9801234567"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="h-11 sm:h-12 rounded-xl bg-slate-50 border-slate-200 text-xs sm:text-sm pl-3.5"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 sm:h-12 rounded-xl bg-slate-950 hover:bg-black text-white font-bold text-xs sm:text-sm shadow-md cursor-pointer"
                >
                  {loading ? <RotateCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  <span>Track Repair</span>
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Results Display */}
          <AnimatePresence mode="wait">
            {trackingData && activeRepair && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 sm:space-y-8">

                {/* Status Timeline Card */}
                <Card className="rounded-2xl border border-slate-200 shadow-md bg-white overflow-hidden">
                  <div className="p-5 sm:p-7 border-b border-slate-100 bg-slate-50/70 flex justify-between items-center">
                    <div>
                      <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-bold border", currentStatus.bgSoft)}>
                        {currentStatus.label}
                      </span>
                      <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">
                        {activeRepair.deviceBrand?.toUpperCase()} {activeRepair.deviceModel}
                      </h2>
                    </div>
                    <div className="font-mono font-black text-slate-900 text-sm sm:text-base flex items-center gap-2">
                      <span>#{activeRepair.repairNumber}</span>
                      <button onClick={() => copyRepairNumber(activeRepair.repairNumber)}>
                        {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-400" />}
                      </button>
                    </div>
                  </div>

                  <CardContent className="p-5 sm:p-7 space-y-6">
                    <div className="overflow-x-auto pb-3 pt-2">
                      <div className={cn("flex items-center justify-between relative px-4", isCourierDevice ? "min-w-[680px]" : "min-w-[560px]")}>
                        <div className="absolute top-5 left-10 right-10 h-1 bg-slate-200 z-0" />
                        {timelineSteps.map((step) => {
                          const status = getStepStatus(step.key, activeRepair.status);
                          const StepIcon = step.icon;
                          const isCompleted = status === 'completed';
                          const isCurrent = status === 'current';

                          return (
                            <div key={step.key} className="flex flex-col items-center gap-2 relative z-10 w-24 text-center">
                              <div className={cn(
                                "w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shadow-sm border-2",
                                isCompleted ? "bg-slate-900 text-white border-slate-900" : isCurrent ? "bg-indigo-600 text-white border-indigo-600 ring-4 ring-indigo-100" : "bg-white text-slate-400 border-slate-300"
                              )}>
                                {isCompleted ? <Check className="w-4 h-4" /> : <StepIcon className="w-4 h-4" />}
                              </div>
                              <p className={cn("text-xs font-bold", isCurrent ? "text-indigo-600" : isCompleted ? "text-slate-900" : "text-slate-400")}>
                                {step.label}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* DIAGNOSTIC ACTIVITY TRACE (GUARANTEED MULTI-SOURCE FALLBACK RENDERER) */}
                <Card className="rounded-2xl border border-slate-200 shadow-sm bg-white overflow-hidden w-full">
                  <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center">
                        <History className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm sm:text-base">Diagnostic Activity Trace</h3>
                        <p className="text-xs text-slate-500">Live timestamped progress tracker for your repair service</p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                      <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
                      Live Timestamped
                    </span>
                  </div>

                  <CardContent className="p-4 sm:p-6 lg:p-8">
                    {(() => {
                      // Collect logs from any possible array format, or synthesize a fallback if empty
                      let repairLogs = activeRepair?.logs || trackingData?.logs || activeRepair?.repairLogs || [];

                      if (!Array.isArray(repairLogs) || repairLogs.length === 0) {
                        repairLogs = [
                          {
                            id: `fallback-${activeRepair?.id || 'ticket'}`,
                            action: 'STATUS_UPDATED',
                            status: activeRepair?.status || 'RECEIVED',
                            notes: `Device registered in system with status: ${activeRepair?.status || 'RECEIVED'}.`,
                            createdAt: activeRepair?.createdAt || new Date().toISOString()
                          }
                        ];
                      }

                      return (
                        <div className="relative pl-5 sm:pl-7 space-y-6 before:absolute before:left-[11px] sm:before:left-[15px] before:top-2 before:bottom-2 before:w-0.5 before:bg-indigo-100">
                          {repairLogs.map((log: any, idx: number) => {
                            const logStatus = statusConfig[log.status] || statusConfig[log.action] || statusConfig.RECEIVED;
                            const friendlyInfo = getCustomerFriendlyLogDetails(log.action, log.status, log.notes || log.message);
                            const isLatest = idx === 0;

                            return (
                              <div key={log.id || idx} className="relative flex items-start group">
                                <div className={cn(
                                  "absolute -left-[25px] sm:-left-[31px] flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 border-white shadow-sm",
                                  isLatest ? "bg-indigo-600 text-white ring-4 ring-indigo-50" : "bg-slate-200 text-slate-600"
                                )}>
                                  <span className="w-2 h-2 rounded-full bg-current"></span>
                                </div>

                                <div className="ml-2 sm:ml-4 flex-1 bg-slate-50 hover:bg-slate-50/80 rounded-xl p-4 sm:p-5 border border-slate-200/70 shadow-2xs">
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
                                    <span className={cn("text-xs sm:text-sm font-bold uppercase tracking-wider", logStatus.textColor || "text-indigo-600")}>
                                      {friendlyInfo.title}
                                    </span>
                                    <span className="text-[11px] sm:text-xs font-medium text-slate-400 bg-white px-2.5 py-0.5 rounded-md border border-slate-200/60 font-mono">
                                      {new Date(log.createdAt || log.timestamp || Date.now()).toLocaleString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                  <p className="text-xs sm:text-sm text-slate-700 font-medium leading-relaxed">
                                    {friendlyInfo.desc}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>

              </motion.div>
            )}
          </AnimatePresence>

          {/* Support Banner */}
          <div className="bg-slate-900 text-white rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-white">Need Help With Your Repair Ticket?</h3>
              <p className="text-xs text-slate-300 mt-0.5">Call our customer service desk for live tracking assistance.</p>
            </div>
            <a href="tel:015364307" className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs">
              <Phone className="w-3.5 h-3.5" />
              <span>Call Reception (015364307)</span>
            </a>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
}