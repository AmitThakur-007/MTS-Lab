import React, { useState, useEffect } from 'react';
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

// Customer-Safe Sanitization: Completely strips staff/user names, roles, and internal identities
function sanitizeLogMessage(msg: string, status?: string): string {
  if (!msg || typeof msg !== 'string') {
    return statusConfig[status || 'RECEIVED']?.desc || 'Repair progress updated.';
  }

  let cleaned = msg.trim();

  // If message matches generic status change "Status changed to STATUS by Name (ROLE)"
  if (/^Status (?:changed|updated) to ([A-Z_]+)/i.test(cleaned)) {
    const match = cleaned.match(/^Status (?:changed|updated) to ([A-Z_]+)/i);
    const targetStatus = match ? match[1] : status;
    return statusConfig[targetStatus || status || 'RECEIVED']?.desc || 'Repair progress updated.';
  }

  // 1. Strip emails
  cleaned = cleaned.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi, '');

  // 2. Strip "by [Name] (ROLE)" or "(ROLE)"
  cleaned = cleaned.replace(/\bby\s+([a-zA-Z0-9_.'\s-]+?)\s*\((?:SUPER_ADMIN|SUPER\s*ADMIN|ADMIN|MANAGER|RECEPTIONIST|TECHNICIAN|STAFF)\)/gi, '');
  cleaned = cleaned.replace(/\((?:SUPER_ADMIN|SUPER\s*ADMIN|ADMIN|MANAGER|RECEPTIONIST|TECHNICIAN|STAFF)\)/gi, '');

  // 3. Strip "by Technician/Specialist [Name]"
  cleaned = cleaned.replace(/\bby\s+(?:technician|specialist|engineer|staff|user|super\s*admin|admin|manager|receptionist)\s+[A-Za-z0-9_.'-]+/gi, '');

  // 4. Strip "by [Staff Name / Role]"
  cleaned = cleaned.replace(/\bby\s+(?:MTS\s+)?(?:super\s*admin|admin|manager|receptionist|staff|specialist|technician|user|engineer)\b/gi, '');
  cleaned = cleaned.replace(/\bby\s+[A-Z][a-zA-Z0-9_.'-]+(?:\s+[A-Z][a-zA-Z0-9_.'-]+)*/g, '');

  // 5. Strip "Technician/Specialist/Engineer [Name]" anywhere
  cleaned = cleaned.replace(/\b(?:technician|specialist|engineer|staff)\s+[A-Z][a-zA-Z0-9_.'-]+/gi, 'Technician');
  cleaned = cleaned.replace(/\bTechnician\b/gi, '');

  // 6. Strip action verbs followed by "by ..."
  cleaned = cleaned.replace(/\b(handled|updated|diagnosed|logged|received|repaired|inspected|completed|verified|transitioned)\s+by\s+[^,\.\n]+/gi, '$1');

  // 7. Strip "Assigned to [Name]" or "Assigned to/by ..."
  cleaned = cleaned.replace(/\bassigned\s+(?:to|by)\s+[^,\.\n]+/gi, 'Assigned for laboratory service');

  // 8. Strip "Updated by: ...", "Created by: ...", "Technician: ...", "Staff: ...", "User: ..."
  cleaned = cleaned.replace(/\b(?:updated|created|processed|handled|logged|verified)\s+by\s*:\s*[^,\.\n]+/gi, '');
  cleaned = cleaned.replace(/\b(?:technician|specialist|staff|user|engineer)\s*:\s*[^,\.\n]+/gi, '');

  // 9. Clean trailing punctuation or orphan spaces
  cleaned = cleaned.replace(/\s+/g, ' ').replace(/\s+([,\.;])/g, '$1').replace(/^[\s,;.-]+|[\s,;.-]+$/g, '').trim();

  if (!cleaned || cleaned.length < 5) {
    return statusConfig[status || 'RECEIVED']?.desc || 'Repair progress updated.';
  }

  return cleaned;
}

export default function Tracking() {
  const [searchParams] = useSearchParams();
  const [repairNumber, setRepairNumber] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [trackingData, setTrackingData] = useState<any>(null);
  const [selectedDeviceIndex, setSelectedDeviceIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  // Auto-fetch if query param is present on page load (for example from WhatsApp link)
  useEffect(() => {
    const urlRepairNo = searchParams.get('repairNumber')?.trim();
    const urlPhone = searchParams.get('phone')?.trim();

    if (urlRepairNo) {
      setRepairNumber(urlRepairNo);
      executeTracking(urlRepairNo, urlPhone || '');
    } else if (urlPhone) {
      setPhoneNumber(urlPhone);
      executeTracking('', urlPhone);
    }
  }, [searchParams]);

  const executeTracking = async (repNo: string, phone: string) => {
    if (!repNo && !phone) {
      toast.error('Please enter your Repair Job Number or Registered Phone Number.');
      return;
    }

    setLoading(true);
    try {
      let query = '';
      if (repNo && phone) {
        query = `repairNumber=${encodeURIComponent(repNo)}&phone=${encodeURIComponent(phone)}`;
      } else if (repNo) {
        query = `repairNumber=${encodeURIComponent(repNo)}`;
      } else {
        query = `phone=${encodeURIComponent(phone)}`;
      }

      const data: any = await api.get(`/track?${query}`);
      setTrackingData(data);
      setSelectedDeviceIndex(0);
      toast.success('Live repair records retrieved successfully.');
    } catch (err: any) {
      console.error('[TRACK REPAIR ERROR]', err);
      toast.error(
        err?.message || 'We couldn’t find a repair record matching the information provided. Please check your details and try again.'
      );
      setTrackingData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeTracking(repairNumber.trim(), phoneNumber.trim());
  };

  // Real-time synchronization
  useRealtimeSync(['repair', 'repairLog', 'sync'], (event) => {
    if (trackingData) {
      const activeRep = trackingData.devices?.[selectedDeviceIndex] || trackingData;
      if (!event.id || event.id === activeRep.id || event.data?.id === activeRep.id) {
        const repNo = repairNumber.trim() || activeRep.repairNumber;
        const phone = phoneNumber.trim() || activeRep.customerPhone;
        api.get(`/track?${repNo ? `repairNumber=${encodeURIComponent(repNo)}` : `phone=${encodeURIComponent(phone)}`}`)
          .then((refreshed: any) => setTrackingData(refreshed))
          .catch(() => {});
      }
    }
  });

  const activeRepair = trackingData?.devices?.[selectedDeviceIndex] || trackingData;
  const isCourierDevice = activeRepair?.receivingMethod === 'COURIER' || activeRepair?.isCourierIn === true || Boolean(activeRepair?.isReturnCourierDispatched);
  const timelineSteps = isCourierDevice ? COURIER_TIMELINE_STEPS : WALK_IN_TIMELINE_STEPS;

  // Determine current active status configuration
  let currentStatusKey = activeRepair?.status || 'RECEIVED';
  if (activeRepair?.courierStatus === 'COURIER_DISPATCHED' || activeRepair?.isReturnCourierDispatched) {
    if (activeRepair?.status !== 'DELIVERED') {
      currentStatusKey = 'COURIER_DISPATCHED';
    }
  }
  const currentStatus = statusConfig[currentStatusKey] || statusConfig[activeRepair?.status] || statusConfig.RECEIVED;

  const copyRepairNumber = (num: string) => {
    if (!num) return;
    navigator.clipboard.writeText(num);
    setCopied(true);
    toast.success(`Copied Repair #${num}`);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStepStatus = (stepKey: string, currentRepairStatus: string, repairObj: any) => {
    const isDispatched = repairObj?.courierStatus === 'COURIER_DISPATCHED' || repairObj?.isReturnCourierDispatched;

    const sequence = isCourierDevice
      ? ['RECEIVED', 'DIAGNOSING', 'IN_PROCESS', 'TESTING', 'READY_FOR_PICKUP', 'COURIER_DISPATCHED', 'DELIVERED']
      : ['RECEIVED', 'DIAGNOSING', 'IN_PROCESS', 'TESTING', 'READY_FOR_PICKUP', 'DELIVERED'];

    let effectiveStatus = currentRepairStatus;
    if (isDispatched && currentRepairStatus !== 'DELIVERED') {
      effectiveStatus = 'COURIER_DISPATCHED';
    }
    if (currentRepairStatus === 'REPAIRED') effectiveStatus = 'READY_FOR_PICKUP';
    if (currentRepairStatus === 'WAITING_FOR_PARTS') effectiveStatus = 'IN_PROCESS';

    const currentIndex = sequence.indexOf(effectiveStatus);
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
            <p className="text-slate-600 text-xs sm:text-sm md:text-base font-medium leading-relaxed">
              Track your device repair status quickly and securely.
            </p>
          </div>

          {/* Search Card */}
          <Card className="rounded-2xl sm:rounded-3xl border border-slate-200 shadow-lg shadow-slate-900/5 bg-white overflow-hidden max-w-3xl mx-auto">
            <CardContent className="p-5 sm:p-7 md:p-8">
              <form onSubmit={handleTrackSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  {/* Repair Number Input */}
                  <div className="space-y-1.5">
                    <label 
                      htmlFor="tracking-repair-number-input"
                      className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5"
                    >
                      <Hash className="w-3.5 h-3.5 text-slate-500" />
                      <span>Repair Job Number</span>
                    </label>
                    <div className="relative">
                      <Input
                        id="tracking-repair-number-input"
                        placeholder="Repair Job Number"
                        value={repairNumber}
                        onChange={(e) => setRepairNumber(e.target.value)}
                        className="h-11 sm:h-12 rounded-xl bg-slate-50 border-slate-200 font-mono font-medium text-slate-900 focus:bg-white transition-all text-xs sm:text-sm pl-3.5"
                      />
                    </div>
                  </div>

                  {/* Customer Phone Input */}
                  <div className="space-y-1.5">
                    <label 
                      htmlFor="tracking-phone-number-input"
                      className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5"
                    >
                      <Phone className="w-3.5 h-3.5 text-slate-500" />
                      <span>Registered Phone Number</span>
                    </label>
                    <div className="relative">
                      <Input
                        id="tracking-phone-number-input"
                        placeholder="Registered Phone Number"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="h-11 sm:h-12 rounded-xl bg-slate-50 border-slate-200 font-medium text-slate-900 focus:bg-white transition-all text-xs sm:text-sm pl-3.5"
                      />
                    </div>
                  </div>

                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                  <div className="text-xs text-slate-500 flex items-center gap-1.5 text-center sm:text-left">
                    <Info className="w-4 h-4 text-slate-400 shrink-0 hidden sm:inline" />
                    <span>Enter your repair details to view current status and diagnostics.</span>
                  </div>

                  <Button
                    id="track-repair-submit-btn"
                    type="submit"
                    disabled={loading}
                    className="w-full sm:w-auto h-11 sm:h-12 px-7 rounded-xl bg-slate-950 hover:bg-black text-white font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shrink-0 shadow-md cursor-pointer disabled:opacity-70"
                  >
                    {loading ? (
                      <>
                        <RotateCw className="w-4 h-4 animate-spin" />
                        <span>Tracking...</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        <span>Track Repair</span>
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Results Display */}
          <AnimatePresence mode="wait">
            {trackingData && activeRepair && (
              <motion.div
                key={activeRepair.repairNumber || selectedDeviceIndex}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6 sm:space-y-8"
              >

                {/* Multiple Devices Switcher Tabs */}
                {trackingData.devices && trackingData.devices.length > 1 && (
                  <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                        <Layers className="w-4 h-4 text-indigo-600" />
                        <span>Registered Devices ({trackingData.devices.length})</span>
                      </div>
                      <span className="text-xs font-medium text-slate-500">
                        Customer: <strong className="text-slate-900">{trackingData.customer?.name}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                      {trackingData.devices.map((device: any, idx: number) => {
                        const isSelected = selectedDeviceIndex === idx;
                        const dStatus = statusConfig[device.status] || statusConfig.RECEIVED;
                        return (
                          <button
                            key={device.id || idx}
                            type="button"
                            onClick={() => setSelectedDeviceIndex(idx)}
                            className={cn(
                              "flex items-center gap-2.5 px-3.5 py-2 rounded-xl border text-left transition-all shrink-0 font-medium text-xs cursor-pointer",
                              isSelected 
                                ? "bg-slate-900 text-white border-slate-900 shadow-sm" 
                                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                            )}
                          >
                            <Smartphone className={cn("w-3.5 h-3.5 shrink-0", isSelected ? "text-indigo-300" : "text-slate-500")} />
                            <div className="leading-tight">
                              <div className="font-bold">{device.deviceBrand?.toUpperCase()} {device.deviceModel}</div>
                              <div className={cn("text-[11px] font-mono", isSelected ? "text-slate-300" : "text-slate-500")}>
                                #{device.repairNumber} • <span className={isSelected ? "text-emerald-300 font-bold" : dStatus.textColor}>{dStatus.label}</span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Status Timeline Card */}
                <Card className="rounded-2xl sm:rounded-3xl border border-slate-200 shadow-md bg-white overflow-hidden">
                  <div className="p-5 sm:p-7 border-b border-slate-100 bg-slate-50/70">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Current Status</span>
                          <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-bold border", currentStatus.bgSoft)}>
                            {currentStatus.label}
                          </span>
                          {isCourierDevice && (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                              <Package className="w-3 h-3 text-amber-700" />
                              Courier Shipment
                            </span>
                          )}
                        </div>
                        <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-900">
                          {activeRepair.deviceBrand?.toUpperCase()} {activeRepair.deviceModel}
                        </h2>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="bg-white border border-slate-200 rounded-xl px-3.5 py-2 shadow-2xs text-left sm:text-right">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Repair Number</div>
                          <div className="font-mono font-black text-slate-900 text-sm sm:text-base flex items-center gap-2">
                            <span>#{activeRepair.repairNumber}</span>
                            <button
                              type="button"
                              onClick={() => copyRepairNumber(activeRepair.repairNumber)}
                              className="text-slate-400 hover:text-slate-800 transition-colors cursor-pointer"
                              title="Copy Repair Number"
                            >
                              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <CardContent className="p-5 sm:p-7 space-y-6 sm:space-y-8">
                    {/* Stepper Timeline */}
                    <div className="overflow-x-auto pb-3 pt-2 scrollbar-thin">
                      <div className={cn("flex items-center justify-between relative px-4", isCourierDevice ? "min-w-[680px]" : "min-w-[560px]")}>
                        
                        {/* Connecting Line */}
                        <div className="absolute top-5 left-10 right-10 h-1 bg-slate-200 -z-0" />
                        
                        {timelineSteps.map((step) => {
                          const status = getStepStatus(step.key, activeRepair.status, activeRepair);
                          const StepIcon = step.icon;
                          const isCompleted = status === 'completed';
                          const isCurrent = status === 'current';

                          return (
                            <div key={step.key} className="flex flex-col items-center gap-2 relative z-10 w-24 text-center">
                              <div className={cn(
                                "w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs transition-all shadow-sm border-2",
                                isCompleted 
                                  ? "bg-slate-900 text-white border-slate-900" 
                                  : isCurrent 
                                    ? "bg-indigo-600 text-white border-indigo-600 ring-4 ring-indigo-100 scale-105" 
                                    : "bg-white text-slate-400 border-slate-300"
                              )}>
                                {isCompleted ? <Check className="w-4 h-4" /> : <StepIcon className="w-4 h-4" />}
                              </div>
                              <div className="space-y-0.5">
                                <p className={cn(
                                  "text-xs font-bold leading-tight",
                                  isCurrent ? "text-indigo-600" : isCompleted ? "text-slate-900" : "text-slate-400"
                                )}>
                                  {step.label}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Status Description Box */}
                    <div className="bg-slate-50 rounded-xl p-4 sm:p-5 border border-slate-200 flex items-start gap-3.5">
                      <div className={cn("p-2 rounded-lg shrink-0", currentStatus.color, "text-white")}>
                        {(() => {
                          const Icon = currentStatus.icon;
                          return <Icon className="w-4 h-4" />;
                        })()}
                      </div>
                      <div className="space-y-0.5 flex-1">
                        <h3 className="font-bold text-slate-900 text-sm">{currentStatus.label}</h3>
                        <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">{currentStatus.desc}</p>
                      </div>
                    </div>

                    {/* Dedicated RE-PROBLEM Notice */}
                    {(activeRepair.status === 'RE_PROBLEM' || activeRepair.status === 'REPROBLEM') && (
                      <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3 text-rose-900">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div className="text-xs space-y-1">
                          <span className="font-bold block text-xs text-rose-900">Warranty Re-Inspection Active</span>
                          <span className="text-rose-700 leading-relaxed block text-xs">
                            This device was previously delivered and has now been reopened for warranty diagnostic assessment.
                          </span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* COURIER LOGISTICS CARDS (Rendered if courier details present) */}
                {isCourierDevice && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                    
                    {/* Inbound Courier */}
                    {activeRepair.courierCompany && (
                      <Card className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5 space-y-3.5 shadow-2xs">
                        <div className="flex items-center gap-2 border-b border-amber-200/60 pb-2.5">
                          <Package className="w-4 h-4 text-amber-700" />
                          <h3 className="font-bold text-amber-950 text-sm">Inbound Courier Logistics</h3>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-amber-800/80 font-bold block text-[11px]">Courier Partner:</span>
                            <strong className="text-slate-900 text-xs font-bold">{activeRepair.courierCompany}</strong>
                          </div>
                          <div>
                            <span className="text-amber-800/80 font-bold block text-[11px]">Inbound Tracking #:</span>
                            <strong className="font-mono text-slate-900 text-xs font-bold">{activeRepair.courierTrackingNumber || 'N/A'}</strong>
                          </div>
                          <div>
                            <span className="text-amber-800/80 font-bold block text-[11px]">Origin District:</span>
                            <span className="text-slate-900 font-semibold">{activeRepair.originDistrict || 'Nepal'}</span>
                          </div>
                          <div>
                            <span className="text-amber-800/80 font-bold block text-[11px]">Lab Received Date:</span>
                            <span className="text-slate-900 font-semibold">
                              {activeRepair.courierReceivedDate 
                                ? new Date(activeRepair.courierReceivedDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
                                : 'Received'}
                            </span>
                          </div>
                        </div>

                        {(activeRepair.courierCompany?.toLowerCase().includes('nepal can move') || activeRepair.courierCompany?.toLowerCase().includes('ncm')) && (
                          <div className="pt-2 border-t border-amber-200/60 flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[11px] text-amber-900 font-medium">External Live Tracking:</span>
                            <a
                              href="https://portal.nepalcanmove.com/track/"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-950 hover:text-black bg-white px-3 py-1.5 rounded-lg border border-amber-300 shadow-2xs transition-colors"
                            >
                              <span>Track on Nepal Can Move</span>
                              <ExternalLink className="w-3 h-3 text-amber-700" />
                            </a>
                          </div>
                        )}
                      </Card>
                    )}

                    {/* Return Dispatch Courier */}
                    {activeRepair.isReturnCourierDispatched && (
                      <Card className="rounded-2xl border border-blue-200 bg-blue-50/40 p-5 space-y-3.5 shadow-2xs">
                        <div className="flex items-center gap-2 border-b border-blue-200/60 pb-2.5">
                          <Truck className="w-4 h-4 text-blue-700" />
                          <h3 className="font-bold text-blue-950 text-sm">Return Consignment Details</h3>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-blue-800/80 font-bold block text-[11px]">Dispatch Courier:</span>
                            <strong className="text-slate-900 text-xs font-bold">{activeRepair.returnCourierCompany}</strong>
                          </div>
                          <div>
                            <span className="text-blue-800/80 font-bold block text-[11px]">Return Tracking #:</span>
                            <strong className="font-mono text-blue-700 text-xs font-bold">{activeRepair.returnCourierTrackingNumber || 'N/A'}</strong>
                          </div>
                          <div>
                            <span className="text-blue-800/80 font-bold block text-[11px]">Destination District:</span>
                            <span className="text-slate-900 font-semibold">{activeRepair.destinationDistrict || 'Customer Address'}</span>
                          </div>
                          <div>
                            <span className="text-blue-800/80 font-bold block text-[11px]">Dispatched Date:</span>
                            <span className="text-slate-900 font-semibold">
                              {activeRepair.returnCourierDispatchDate 
                                ? new Date(activeRepair.returnCourierDispatchDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
                                : 'Dispatched'}
                            </span>
                          </div>
                        </div>

                        {(activeRepair.returnCourierCompany?.toLowerCase().includes('nepal can move') || activeRepair.returnCourierCompany?.toLowerCase().includes('ncm')) && (
                          <div className="pt-2 border-t border-blue-200/60 flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[11px] text-blue-900 font-medium">External Live Tracking:</span>
                            <a
                              href="https://portal.nepalcanmove.com/track/"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-950 hover:text-black bg-white px-3 py-1.5 rounded-lg border border-blue-300 shadow-2xs transition-colors"
                            >
                              <span>Track on Nepal Can Move</span>
                              <ExternalLink className="w-3 h-3 text-blue-700" />
                            </a>
                          </div>
                        )}
                      </Card>
                    )}

                  </div>
                )}

                {/* Device & Laboratory Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">

                  {/* Device Specification & Fault Overview */}
                  <Card className="rounded-2xl border border-slate-200 shadow-sm bg-white p-5 sm:p-6 space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                      <Smartphone className="w-4 h-4 text-slate-700" />
                      <h3 className="font-bold text-slate-900 text-sm sm:text-base">Device & Fault Report</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <div className="text-slate-500 text-[11px] font-bold uppercase">Brand / Model</div>
                        <div className="font-bold text-slate-900 mt-0.5">{activeRepair.deviceBrand?.toUpperCase()} {activeRepair.deviceModel}</div>
                      </div>

                      <div>
                        <div className="text-slate-500 text-[11px] font-bold uppercase">Device Condition</div>
                        <div className="font-medium text-slate-800 mt-0.5">{activeRepair.deviceCondition || 'Normal Intake'}</div>
                      </div>

                      <div className="col-span-2">
                        <div className="text-slate-500 text-[11px] font-bold uppercase">Reported Problem</div>
                        <div className="font-medium text-slate-900 mt-0.5 bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs">
                          {activeRepair.problemDescription || 'Inspection requested'}
                        </div>
                      </div>

                      {activeRepair.accessoriesReceived && (
                        <div className="col-span-2">
                          <div className="text-slate-500 text-[11px] font-bold uppercase">Accessories Logged</div>
                          <div className="font-medium text-slate-800 mt-0.5 text-xs">{activeRepair.accessoriesReceived}</div>
                        </div>
                      )}
                    </div>
                  </Card>

                  {/* Repair Logistics & Customer Record */}
                  <Card className="rounded-2xl border border-slate-200 shadow-sm bg-white p-5 sm:p-6 space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                      <UserCheck className="w-4 h-4 text-slate-700" />
                      <h3 className="font-bold text-slate-900 text-sm sm:text-base">Intake & Logistics</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <div className="text-slate-500 text-[11px] font-bold uppercase">Customer Name</div>
                        <div className="font-bold text-slate-900 mt-0.5">{activeRepair.customerName}</div>
                      </div>

                      <div>
                        <div className="text-slate-500 text-[11px] font-bold uppercase">Intake Date</div>
                        <div className="font-medium text-slate-800 mt-0.5">
                          {activeRepair.createdAt ? new Date(activeRepair.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                        </div>
                      </div>

                      <div>
                        <div className="text-slate-500 text-[11px] font-bold uppercase">Receiving Method</div>
                        <div className="font-bold text-slate-900 mt-0.5">{isCourierDevice ? 'Courier Shipment' : 'Walk-in Counter'}</div>
                      </div>

                      <div>
                        <div className="text-slate-500 text-[11px] font-bold uppercase">Service Laboratory</div>
                        <div className="font-bold text-slate-900 mt-0.5">MTS Central Lab</div>
                      </div>

                      <div className="col-span-2 border-t border-slate-100 pt-2.5">
                        <div className="text-slate-500 text-[11px] font-bold uppercase">Service Location</div>
                        <div className="font-medium text-slate-800 mt-0.5 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-500" />
                          <span>{activeRepair.branch?.name || 'MTS Central Lab — New Road, Kathmandu'}</span>
                        </div>
                      </div>
                    </div>
                  </Card>

                </div>

                {/* Granular History Logs */}
                <Card className="rounded-2xl border border-slate-200 shadow-sm bg-white overflow-hidden">
                  <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <History className="w-4 h-4 text-slate-700" />
                      <h3 className="font-bold text-slate-900 text-sm sm:text-base">Diagnostic Activity Trace</h3>
                    </div>
                    <span className="text-xs text-slate-500">Live Timestamped</span>
                  </div>

                  <CardContent className="p-4 sm:p-5">
                    {activeRepair.logs && activeRepair.logs.length > 0 ? (
                      <div className="relative pl-5 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                        {activeRepair.logs.map((log: any, idx: number) => {
                          const logStatus = statusConfig[log.status] || statusConfig.RECEIVED;
                          return (
                            <div key={idx} className="relative">
                              <div className={cn(
                                "absolute -left-[25px] top-1 w-3 h-3 rounded-full border-2 border-white shadow-xs",
                                idx === 0 ? "bg-indigo-600 ring-2 ring-indigo-100" : "bg-slate-400"
                              )} />
                              <div className="space-y-0.5">
                                <div className="flex items-center justify-between gap-2">
                                  <span className={cn("text-xs font-bold uppercase tracking-wider", logStatus.textColor)}>
                                    {logStatus.label}
                                  </span>
                                  <span className="text-[11px] text-slate-400">
                                    {new Date(log.createdAt).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-700 font-medium">
                                  {sanitizeLogMessage(log.message)}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-center py-4 text-slate-400 text-xs">Awaiting diagnostic trace logs...</p>
                    )}
                  </CardContent>
                </Card>

              </motion.div>
            )}
          </AnimatePresence>

          {/* Quick Features / Empty State */}
          {!trackingData && !loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
              {[
                { 
                  icon: Wrench, 
                  title: 'Real-Time Diagnostics', 
                  desc: 'Track live progress from motherboard circuit inspection to component restoration and 36-point QA testing.' 
                },
                { 
                  icon: ShieldCheck, 
                  title: 'Secure Ticket Verification', 
                  desc: 'Every repair is verified against authentic job records with encrypted logs and tamper-proof history.' 
                },
                { 
                  icon: Truck, 
                  title: '77 Districts Courier Support', 
                  desc: 'Full visibility on inbound parcels and outgoing courier consignments across all districts in Nepal.' 
                }
              ].map((item, i) => (
                <Card key={i} className="rounded-2xl border border-slate-200/80 bg-white p-5 space-y-2.5 shadow-2xs hover:shadow-sm transition-shadow">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-800">
                    <item.icon className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">{item.title}</h4>
                  <p className="text-slate-600 text-xs leading-relaxed">{item.desc}</p>
                </Card>
              ))}
            </div>
          )}

          {/* Reception Telephone Support Card */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950 text-white rounded-2xl p-5 sm:p-6 shadow-md border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-5">
            <div className="flex items-center gap-3.5 text-center sm:text-left">
              <div className="w-11 h-11 rounded-xl bg-indigo-600/30 border border-indigo-500/40 text-indigo-400 flex items-center justify-center shrink-0 shadow-inner">
                <PhoneCall className="w-5 h-5 text-indigo-300" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider mb-0.5">
                  Direct Reception Assistance
                </div>
                <h3 className="text-sm sm:text-base font-extrabold text-white tracking-tight">
                  Need Help With Your Repair Ticket?
                </h3>
                <p className="text-xs text-slate-300 font-medium mt-0.5">
                  Call our customer service desk for live tracking assistance or courier confirmation.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto shrink-0">
              <div className="text-center sm:text-right hidden md:block pr-2">
                <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider">Landline</span>
                <a 
                  href="tel:015364307" 
                  className="text-base font-black text-white hover:text-indigo-400 transition-colors font-mono tracking-tight"
                >
                  015364307
                </a>
              </div>

              <a
                id="call-mts-reception-button"
                href="tel:015364307"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
              >
                <Phone className="w-3.5 h-3.5 text-white" />
                <span>Call Reception (015364307)</span>
              </a>
            </div>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
}