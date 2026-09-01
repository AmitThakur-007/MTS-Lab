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
  History,
  Hash,
  Copy,
  Check,
  Wrench,
  Truck,
  RotateCw,
  Sparkles,
  CreditCard,
  Calendar,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useRealtimeSync } from '@/services/realtime';

// Format timestamp safely into Nepal Standard Time (UTC+05:45)
function formatNepalDateTime(dateStr?: string | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return (
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kathmandu',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(d) + ' NPT'
    );
  } catch {
    return '';
  }
}

function formatNepalDateOnly(dateStr?: string | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kathmandu',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return '';
  }
}

const statusConfig: Record<
  string,
  { label: string; color: string; bgSoft: string; textColor: string; icon: any; progress: number; desc: string }
> = {
  RECEIVED: {
    label: 'Device Received',
    color: 'bg-amber-500',
    bgSoft: 'bg-amber-50 text-amber-900 border-amber-200',
    textColor: 'text-amber-600',
    icon: Clock,
    progress: 15,
    desc: 'Your device has been safely cataloged and inspected into MTS Lab inventory.',
  },
  DIAGNOSING: {
    label: 'Diagnosis In Progress',
    color: 'bg-blue-600',
    bgSoft: 'bg-blue-50 text-blue-900 border-blue-200',
    textColor: 'text-blue-600',
    icon: Search,
    progress: 35,
    desc: 'Certified micro-engineers are inspecting device hardware, IC circuits, and display assemblies.',
  },
  IN_PROCESS: {
    label: 'Restoration In Progress',
    color: 'bg-indigo-600',
    bgSoft: 'bg-indigo-50 text-indigo-900 border-indigo-200',
    textColor: 'text-indigo-600',
    icon: Wrench,
    progress: 55,
    desc: 'Active hardware repair, precision micro-soldering, and OEM component replacement in progress.',
  },
  IN_PROGRESS: {
    label: 'Restoration In Progress',
    color: 'bg-indigo-600',
    bgSoft: 'bg-indigo-50 text-indigo-900 border-indigo-200',
    textColor: 'text-indigo-600',
    icon: Wrench,
    progress: 55,
    desc: 'Active hardware repair, precision micro-soldering, and OEM component replacement in progress.',
  },
  WAITING_FOR_PARTS: {
    label: 'Waiting For Parts',
    color: 'bg-purple-600',
    bgSoft: 'bg-purple-50 text-purple-900 border-purple-200',
    textColor: 'text-purple-600',
    icon: Package,
    progress: 65,
    desc: 'Sourcing genuine Grade-A replacement components from logistics inventory.',
  },
  TESTING: {
    label: 'Testing & QA Diagnostics',
    color: 'bg-orange-500',
    bgSoft: 'bg-orange-50 text-orange-900 border-orange-200',
    textColor: 'text-orange-600',
    icon: ShieldCheck,
    progress: 80,
    desc: 'Performing comprehensive 36-point diagnostic inspection and display touch calibration.',
  },
  REPAIRED: {
    label: 'Device Repaired',
    color: 'bg-teal-600',
    bgSoft: 'bg-teal-50 text-teal-900 border-teal-200',
    textColor: 'text-teal-600',
    icon: CheckCircle2,
    progress: 90,
    desc: 'Technical repair completed successfully and passed quality verification standards.',
  },
  READY_FOR_PICKUP: {
    label: 'Ready For Collection',
    color: 'bg-emerald-600',
    bgSoft: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    textColor: 'text-emerald-600',
    icon: MapPin,
    progress: 92,
    desc: 'Restoration verified. Your device is sanitized and packaged ready for counter pickup or return courier dispatch.',
  },
  READY_FOR_DELIVERY: {
    label: 'Ready For Collection',
    color: 'bg-emerald-600',
    bgSoft: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    textColor: 'text-emerald-600',
    icon: MapPin,
    progress: 92,
    desc: 'Restoration verified. Your device is packaged ready for counter pickup or courier handover.',
  },
  COURIER_DISPATCHED: {
    label: 'Return Courier Dispatched',
    color: 'bg-blue-700',
    bgSoft: 'bg-blue-50 text-blue-900 border-blue-300 ring-2 ring-blue-500/20',
    textColor: 'text-blue-700',
    icon: Truck,
    progress: 96,
    desc: 'Repaired device has been safely packed and dispatched via courier logistics back to your destination.',
  },
  DISPATCHED_VIA_COURIER: {
    label: 'Return Courier Dispatched',
    color: 'bg-blue-700',
    bgSoft: 'bg-blue-50 text-blue-900 border-blue-300 ring-2 ring-blue-500/20',
    textColor: 'text-blue-700',
    icon: Truck,
    progress: 96,
    desc: 'Repaired device has been safely packed and dispatched via courier logistics back to your destination.',
  },
  DELIVERED: {
    label: 'Delivered & Handed Over',
    color: 'bg-emerald-700',
    bgSoft: 'bg-emerald-50 text-emerald-950 border-emerald-300',
    textColor: 'text-emerald-700',
    icon: CheckCircle2,
    progress: 100,
    desc: 'Device handed over to customer successfully with service warranty.',
  },
  COMPLETED: {
    label: 'Delivered & Handed Over',
    color: 'bg-emerald-700',
    bgSoft: 'bg-emerald-50 text-emerald-950 border-emerald-300',
    textColor: 'text-emerald-700',
    icon: CheckCircle2,
    progress: 100,
    desc: 'Device handed over to customer successfully with service warranty.',
  },
  RE_PROBLEM: {
    label: 'Warranty Inspection',
    color: 'bg-rose-600',
    bgSoft: 'bg-rose-50 text-rose-900 border-rose-300 ring-2 ring-rose-500/20',
    textColor: 'text-rose-600',
    icon: AlertCircle,
    progress: 40,
    desc: 'Device received for priority post-delivery warranty inspection and diagnosis.',
  },
  REPROBLEM: {
    label: 'Warranty Inspection',
    color: 'bg-rose-600',
    bgSoft: 'bg-rose-50 text-rose-900 border-rose-300 ring-2 ring-rose-500/20',
    textColor: 'text-rose-600',
    icon: AlertCircle,
    progress: 40,
    desc: 'Device received for priority post-delivery warranty inspection and diagnosis.',
  },
  CANNOT_REPAIR: {
    label: 'Cannot Repair',
    color: 'bg-rose-600',
    bgSoft: 'bg-rose-50 text-rose-900 border-rose-200',
    textColor: 'text-rose-600',
    icon: AlertCircle,
    progress: 100,
    desc: 'Catastrophic circuit damage exceeds viable safe restoration standards.',
  },
  CANCELLED: {
    label: 'Service Cancelled',
    color: 'bg-slate-600',
    bgSoft: 'bg-slate-50 text-slate-900 border-slate-200',
    textColor: 'text-slate-600',
    icon: AlertTriangle,
    progress: 100,
    desc: 'Repair service ticket was closed or cancelled by customer request.',
  },
};

const WALK_IN_TIMELINE_STEPS = [
  { key: 'RECEIVED', label: 'Received', icon: Clock },
  { key: 'DIAGNOSING', label: 'Diagnosing', icon: Search },
  { key: 'IN_PROCESS', label: 'Restoration', icon: Wrench },
  { key: 'TESTING', label: 'QA Testing', icon: ShieldCheck },
  { key: 'READY_FOR_PICKUP', label: 'Ready', icon: MapPin },
  { key: 'DELIVERED', label: 'Delivered', icon: CheckCircle2 },
];

const COURIER_TIMELINE_STEPS = [
  { key: 'RECEIVED', label: 'Lab Received', icon: Package },
  { key: 'DIAGNOSING', label: 'Diagnosing', icon: Search },
  { key: 'IN_PROCESS', label: 'Restoration', icon: Wrench },
  { key: 'TESTING', label: 'QA Testing', icon: ShieldCheck },
  { key: 'READY_FOR_PICKUP', label: 'Ready', icon: MapPin },
  { key: 'COURIER_DISPATCHED', label: 'Dispatched', icon: Truck },
  { key: 'DELIVERED', label: 'Delivered', icon: CheckCircle2 },
];

function sanitizeLogMessage(msg: string): string {
  if (!msg || typeof msg !== 'string') return '';
  let sanitized = msg;
  sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi, 'Technician');
  sanitized = sanitized.replace(
    /\bby\s+([a-zA-Z0-9_.'\s-]+?)\s*\((?:SUPER_ADMIN|SUPER\s*ADMIN|ADMIN|MANAGER|RECEPTIONIST|TECHNICIAN|STAFF)\)/gi,
    'by Technician'
  );
  sanitized = sanitized.replace(/\bby\s+(?:MTS\s+)?(?:super\s*admin|admin|manager|receptionist|staff|specialist)\b/gi, 'by Technician');
  sanitized = sanitized.replace(/\bby\s+specialist\s+[^,.\n]+/gi, 'by Technician');
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
    return {
      title: 'Restoration In Progress',
      desc: notes ? sanitizeLogMessage(notes) : 'Active hardware restoration and component replacement under way.',
    };
  }
  if (state.includes('TEST') || state.includes('QA')) {
    return { title: 'QA & Stress Testing', desc: 'Performing rigorous 36-point benchmark and touch validation.' };
  }
  if (state.includes('READY') || state.includes('PICKUP')) {
    return { title: 'Ready for Collection', desc: 'Device sanitized and packaged ready for pickup or dispatch.' };
  }
  if (state.includes('COURIER') || state.includes('DISPATCH')) {
    return { title: 'Courier Dispatched', desc: 'Device packed securely and handed to courier logistics.' };
  }
  if (state.includes('DELIVERED') || state.includes('COMPLETED')) {
    return { title: 'Delivered Successfully', desc: 'Device handed over to customer with service warranty.' };
  }

  return {
    title: 'Status Update',
    desc: notes ? sanitizeLogMessage(notes) : 'Device status updated to reflect laboratory progress.',
  };
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
      toast.error('Please enter your Repair Number or Phone Number.');
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
        if (res.length === 0) throw new Error('No repair records found matching your tracking information.');
        normalizedData = res.length === 1 ? res[0] : { devices: res, customer: { name: res[0]?.customerName } };
      } else if (res?.repair) {
        normalizedData = res.repair;
      } else if (res?.repairs && Array.isArray(res.repairs)) {
        normalizedData =
          res.repairs.length === 1
            ? res.repairs[0]
            : { devices: res.repairs, customer: { name: res.repairs[0]?.customerName } };
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
    const urlRepairNo =
      searchParams.get('repairNumber')?.trim() ||
      searchParams.get('job')?.trim() ||
      searchParams.get('ticket')?.trim();
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

  useRealtimeSync(
    TRACKING_REALTIME_ENTITIES,
    useCallback(
      (event: any) => {
        if (trackingData) {
          const activeRep = trackingData.devices?.[selectedDeviceIndex] || trackingData;
          if (!event.id || event.id === activeRep.id || event.data?.id === activeRep.id) {
            executeTracking(repairNumber, phoneNumber);
          }
        }
      },
      [trackingData, selectedDeviceIndex, repairNumber, phoneNumber, executeTracking]
    )
  );

  const activeRepair = trackingData?.devices?.[selectedDeviceIndex] || trackingData;
  const isCourierDevice =
    activeRepair?.receivingMethod === 'COURIER' ||
    activeRepair?.isCourierIn === true ||
    Boolean(activeRepair?.isReturnCourierDispatched);
  const timelineSteps = isCourierDevice ? COURIER_TIMELINE_STEPS : WALK_IN_TIMELINE_STEPS;

  const currentStatusRaw = (activeRepair?.status || 'RECEIVED').toUpperCase();
  const currentStatus = statusConfig[currentStatusRaw] || statusConfig.RECEIVED;
  const isDelivered = currentStatusRaw === 'DELIVERED' || currentStatusRaw === 'COMPLETED';

  const copyRepairNumber = (num: string) => {
    if (!num) return;
    navigator.clipboard.writeText(num.replace(/^#+/, ''));
    setCopied(true);
    toast.success(`Copied Repair #${num.replace(/^#+/, '')}`);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStepStatus = (stepKey: string, currentRepairStatus: string) => {
    const rawStatus = (currentRepairStatus || 'RECEIVED').toUpperCase();
    if (rawStatus === 'DELIVERED' || rawStatus === 'COMPLETED') {
      return 'completed';
    }

    const sequence = isCourierDevice
      ? ['RECEIVED', 'DIAGNOSING', 'IN_PROCESS', 'TESTING', 'READY_FOR_PICKUP', 'COURIER_DISPATCHED', 'DELIVERED']
      : ['RECEIVED', 'DIAGNOSING', 'IN_PROCESS', 'TESTING', 'READY_FOR_PICKUP', 'DELIVERED'];

    // Map intermediate statuses
    let mappedStatus = rawStatus;
    if (rawStatus === 'IN_PROGRESS') mappedStatus = 'IN_PROCESS';
    if (rawStatus === 'READY_FOR_DELIVERY') mappedStatus = 'READY_FOR_PICKUP';
    if (rawStatus === 'DISPATCHED_VIA_COURIER') mappedStatus = 'COURIER_DISPATCHED';

    const currentIndex = sequence.indexOf(mappedStatus);
    const stepIndex = sequence.indexOf(stepKey);

    if (currentIndex === -1) return 'upcoming';
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'upcoming';
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-slate-900 selection:text-white">
      <Navbar />

      <main className="flex-1 pt-24 sm:pt-28 md:pt-32 pb-12 sm:pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
          {/* Header Banner */}
          <div className="text-center space-y-2 max-w-xl mx-auto">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-200/80 border border-slate-300 text-slate-800 text-[11px] font-bold uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-700" />
              <span>MTS Lab Live Tracking Portal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Track Your Repair</h1>
            <p className="text-xs sm:text-sm text-slate-600">
              Enter your repair number and registered phone number to check live diagnostic progress and delivery status.
            </p>
          </div>

          {/* Search Card */}
          <Card className="rounded-2xl border border-slate-200 shadow-md bg-white overflow-hidden max-w-2xl mx-auto">
            <CardContent className="p-5 sm:p-7">
              <form onSubmit={handleTrackSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5 text-slate-500" />
                      <span>Repair Number</span>
                    </label>
                    <Input
                      placeholder="Enter repair number"
                      value={repairNumber}
                      onChange={(e) => setRepairNumber(e.target.value)}
                      className="h-11 rounded-xl bg-slate-50 border-slate-200 font-mono text-xs sm:text-sm pl-3.5 focus-visible:ring-slate-900"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-500" />
                      <span>Phone Number</span>
                    </label>
                    <Input
                      placeholder="Enter phone number"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="h-11 rounded-xl bg-slate-50 border-slate-200 text-xs sm:text-sm pl-3.5 focus-visible:ring-slate-900"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 rounded-xl bg-slate-900 hover:bg-slate-950 text-white font-bold text-xs sm:text-sm shadow-sm cursor-pointer transition-colors"
                >
                  {loading ? <RotateCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 mr-1.5" />}
                  <span>{loading ? 'Searching Records...' : 'Track Repair'}</span>
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Results Section */}
          <AnimatePresence mode="wait">
            {trackingData && activeRepair && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                {/* Multi-Device Selector Pills (if customer has multiple devices) */}
                {trackingData?.devices && trackingData.devices.length > 1 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    <span className="text-xs font-bold text-slate-600 whitespace-nowrap">Your Devices:</span>
                    {trackingData.devices.map((dev: any, idx: number) => (
                      <button
                        key={dev.id || idx}
                        onClick={() => setSelectedDeviceIndex(idx)}
                        className={cn(
                          'px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer border',
                          selectedDeviceIndex === idx
                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        )}
                      >
                        Device #{idx + 1}: {dev.deviceBrand} {dev.deviceModel}
                      </button>
                    ))}
                  </div>
                )}

                {/* Delivered Completion Banner */}
                {isDelivered && (
                  <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-5 sm:p-6 text-emerald-950 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base sm:text-lg font-black text-emerald-950">
                            Delivered & Handed Over
                          </h3>
                          <Badge className="bg-emerald-600 text-white text-[10px] font-extrabold uppercase px-2 py-0.5">
                            Completed
                          </Badge>
                        </div>
                        <p className="text-xs sm:text-sm text-emerald-800 font-medium mt-1">
                          This device was successfully delivered and handed over to the customer with warranty.
                        </p>
                        {(activeRepair.deliveredAt || activeRepair.updatedAt) && (
                          <div className="flex items-center gap-1.5 text-xs text-emerald-900 font-bold mt-2">
                            <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Delivered on: {formatNepalDateTime(activeRepair.deliveredAt || activeRepair.updatedAt)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Main Status & Timeline Card */}
                <Card className="rounded-2xl border border-slate-200 shadow-md bg-white overflow-hidden">
                  <div className="p-5 sm:p-6 border-b border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-bold border', currentStatus.bgSoft)}>
                          {currentStatus.label}
                        </span>
                        {activeRepair.hasBatteryWarranty && (
                          <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900 text-[11px] font-bold">
                            <Sparkles className="w-3 h-3 mr-1 text-amber-600" />
                            {activeRepair.batteryWarrantyPeriod ? `${activeRepair.batteryWarrantyPeriod.replace(/_/g, ' ')} Warranty` : 'Battery Warranty Active'}
                          </Badge>
                        )}
                      </div>
                      <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1.5">
                        {activeRepair.deviceBrand?.toUpperCase()} {activeRepair.deviceModel}
                      </h2>
                    </div>

                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 self-start sm:self-auto shadow-2xs">
                      <span className="text-xs text-slate-500 font-bold uppercase">Ticket:</span>
                      <span className="font-mono font-black text-slate-900 text-sm">#{activeRepair.repairNumber}</span>
                      <button
                        type="button"
                        onClick={() => copyRepairNumber(activeRepair.repairNumber)}
                        className="text-slate-400 hover:text-slate-700 cursor-pointer transition-colors p-1"
                        title="Copy Repair Number"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <CardContent className="p-5 sm:p-6 space-y-6">
                    {/* Status Description Message */}
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-700 font-medium leading-relaxed">
                      {currentStatus.desc}
                    </div>

                    {/* Interactive Visual Timeline */}
                    <div className="overflow-x-auto pb-2 pt-2">
                      <div
                        className={cn(
                          'flex items-center justify-between relative px-4',
                          isCourierDevice ? 'min-w-[620px]' : 'min-w-[520px]'
                        )}
                      >
                        <div className="absolute top-5 left-10 right-10 h-1 bg-slate-200 z-0" />
                        {timelineSteps.map((step) => {
                          const status = getStepStatus(step.key, activeRepair.status);
                          const StepIcon = step.icon;
                          const isCompleted = status === 'completed';
                          const isCurrent = status === 'current';

                          return (
                            <div key={step.key} className="flex flex-col items-center gap-2 relative z-10 w-20 text-center">
                              <div
                                className={cn(
                                  'w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shadow-sm border-2 transition-all',
                                  isCompleted
                                    ? 'bg-emerald-600 text-white border-emerald-600'
                                    : isCurrent
                                    ? 'bg-slate-900 text-white border-slate-900 ring-4 ring-slate-200'
                                    : 'bg-white text-slate-400 border-slate-300'
                                )}
                              >
                                {isCompleted ? <Check className="w-4 h-4" /> : <StepIcon className="w-4 h-4" />}
                              </div>
                              <p
                                className={cn(
                                  'text-[11px] sm:text-xs font-bold leading-tight',
                                  isCurrent ? 'text-slate-900' : isCompleted ? 'text-emerald-700' : 'text-slate-400'
                                )}
                              >
                                {step.label}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Detailed Specifications & Overview Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  {/* Device & Repair Details */}
                  <Card className="rounded-2xl border border-slate-200 shadow-sm bg-white overflow-hidden">
                    <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70 flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-slate-700" />
                      <h3 className="font-bold text-slate-900 text-sm">Device & Service Information</h3>
                    </div>
                    <CardContent className="p-4 sm:p-5 space-y-3 text-xs sm:text-sm">
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span className="text-slate-500 font-medium">Device:</span>
                        <span className="font-bold text-slate-900 text-right">
                          {activeRepair.deviceBrand} {activeRepair.deviceModel}
                        </span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span className="text-slate-500 font-medium">Intake Method:</span>
                        <span className="font-bold text-slate-900">
                          {isCourierDevice ? 'Courier Logistics Delivery' : 'Walk-in Counter Service'}
                        </span>
                      </div>
                      {activeRepair.problemDescription && (
                        <div className="py-1.5 border-b border-slate-100">
                          <span className="text-slate-500 font-medium block mb-1">Reported Problem:</span>
                          <span className="font-medium text-slate-800 bg-slate-50 p-2 rounded-lg block border border-slate-100">
                            {activeRepair.problemDescription}
                          </span>
                        </div>
                      )}
                      {activeRepair.conditionNotes && (
                        <div className="py-1.5 border-b border-slate-100">
                          <span className="text-slate-500 font-medium block mb-1">Condition Notes:</span>
                          <span className="font-medium text-slate-800">{activeRepair.conditionNotes}</span>
                        </div>
                      )}
                      {activeRepair.accessoriesReceived && (
                        <div className="py-1.5 border-b border-slate-100">
                          <span className="text-slate-500 font-medium">Accessories:</span>
                          <span className="font-medium text-slate-800 ml-2">{activeRepair.accessoriesReceived}</span>
                        </div>
                      )}
                      <div className="flex justify-between py-1.5">
                        <span className="text-slate-500 font-medium">Intake Date:</span>
                        <span className="font-bold text-slate-900">{formatNepalDateOnly(activeRepair.createdAt) || 'Recorded'}</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Warranty & Billing Summary */}
                  <Card className="rounded-2xl border border-slate-200 shadow-sm bg-white overflow-hidden flex flex-col justify-between">
                    <div>
                      <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70 flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-slate-700" />
                        <h3 className="font-bold text-slate-900 text-sm">Payment & Warranty Status</h3>
                      </div>
                      <CardContent className="p-4 sm:p-5 space-y-3 text-xs sm:text-sm">
                        <div className="flex justify-between py-1.5 border-b border-slate-100">
                          <span className="text-slate-500 font-medium">Estimated Amount:</span>
                          <span className="font-mono font-bold text-slate-900">
                            NPR {Number(activeRepair.estimatedCost || 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-slate-100">
                          <span className="text-slate-500 font-medium">Amount Paid:</span>
                          <span className="font-mono font-bold text-emerald-700">
                            NPR {Number(activeRepair.totalPaid || activeRepair.advancePaid || 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-slate-100 items-center">
                          <span className="text-slate-500 font-medium">Payment Status:</span>
                          <Badge
                            className={cn(
                              'text-[10px] font-extrabold uppercase',
                              activeRepair.paymentStatus === 'PAID'
                                ? 'bg-emerald-600 text-white'
                                : activeRepair.paymentStatus === 'PARTIAL'
                                ? 'bg-amber-600 text-white'
                                : 'bg-slate-200 text-slate-800'
                            )}
                          >
                            {activeRepair.paymentStatus || 'UNPAID'}
                          </Badge>
                        </div>

                        {/* Courier Info if return courier is active */}
                        {activeRepair.returnCourierTrackingNumber && (
                          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-1">
                            <div className="flex items-center gap-1.5 text-blue-900 font-bold text-xs">
                              <Truck className="w-3.5 h-3.5 text-blue-700" />
                              <span>Return Courier Tracking</span>
                            </div>
                            <p className="text-[11px] text-blue-800">
                              {activeRepair.returnCourierCompany || 'Courier'}:{' '}
                              <strong className="font-mono">{activeRepair.returnCourierTrackingNumber}</strong>
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </div>

                    <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <p className="text-[11px] text-slate-600 font-medium">
                        MTS Lab official technical warranty applies to all certified replacements.
                      </p>
                    </div>
                  </Card>
                </div>

                {/* Diagnostic Activity Trace */}
                <Card className="rounded-2xl border border-slate-200 shadow-sm bg-white overflow-hidden w-full">
                  <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-xs">
                        <History className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">Diagnostic Activity Trace</h3>
                        <p className="text-[11px] text-slate-500">Chronological service log for your device</p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                      Live
                    </span>
                  </div>

                  <CardContent className="p-4 sm:p-6">
                    {(() => {
                      let repairLogs = activeRepair?.logs || trackingData?.logs || activeRepair?.repairLogs || [];

                      if (!Array.isArray(repairLogs) || repairLogs.length === 0) {
                        repairLogs = [
                          {
                            id: `fallback-${activeRepair?.id || 'ticket'}`,
                            action: 'STATUS_UPDATED',
                            status: activeRepair?.status || 'RECEIVED',
                            notes: `Device registered in system with status: ${activeRepair?.status || 'RECEIVED'}.`,
                            createdAt: activeRepair?.createdAt || new Date().toISOString(),
                          },
                        ];
                      }

                      return (
                        <div className="relative pl-5 sm:pl-6 space-y-4 before:absolute before:left-[9px] sm:before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                          {repairLogs.map((log: any, idx: number) => {
                            const friendlyInfo = getCustomerFriendlyLogDetails(log.action, log.status, log.notes || log.message);
                            const isLatest = idx === 0;

                            return (
                              <div key={log.id || idx} className="relative flex items-start group">
                                <div
                                  className={cn(
                                    'absolute -left-[23px] sm:-left-[27px] flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 border-white shadow-2xs',
                                    isLatest
                                      ? 'bg-slate-900 text-white ring-2 ring-slate-200'
                                      : 'bg-slate-200 text-slate-600'
                                  )}
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                </div>

                                <div className="ml-2 sm:ml-3 flex-1 bg-slate-50/80 hover:bg-slate-50 rounded-xl p-3.5 sm:p-4 border border-slate-200/70">
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                                    <span className="text-xs font-bold text-slate-900">{friendlyInfo.title}</span>
                                    {log.createdAt && (
                                      <span className="text-[10px] text-slate-400 font-mono">
                                        {formatNepalDateTime(log.createdAt)}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-600 font-medium leading-relaxed">
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
          <div className="bg-slate-900 text-white rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-white">Need Assistance With Your Repair?</h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Reach out to our customer service desk for live technician updates and dispatch tracking.
              </p>
            </div>
            <a
              href="tel:015364307"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs shadow-xs transition-colors shrink-0"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Contact Service Desk</span>
            </a>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
