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
  Calendar,
  AlertTriangle,
  Inbox,
  ClipboardCheck,
  PackageCheck
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
  PENDING: {
    label: 'Pending Queue',
    color: 'bg-slate-500',
    bgSoft: 'bg-slate-50 text-slate-900 border-slate-200',
    textColor: 'text-slate-600',
    icon: Clock,
    progress: 10,
    desc: 'Your device is cataloged in the service queue awaiting laboratory intake and diagnosis.',
  },
  RECEIVED: {
    label: 'Device Received',
    color: 'bg-amber-500',
    bgSoft: 'bg-amber-50 text-amber-900 border-amber-200',
    textColor: 'text-amber-600',
    icon: Inbox,
    progress: 16,
    desc: 'Your device has been safely cataloged and checked into MTS Lab inventory.',
  },
  DIAGNOSING: {
    label: 'Diagnosis In Progress',
    color: 'bg-blue-600',
    bgSoft: 'bg-blue-50 text-blue-900 border-blue-200',
    textColor: 'text-blue-600',
    icon: Search,
    progress: 33,
    desc: 'Certified micro-engineers are inspecting device hardware, IC circuits, and display assemblies.',
  },
  IN_PROCESS: {
    label: 'Restoration In Progress',
    color: 'bg-indigo-600',
    bgSoft: 'bg-indigo-50 text-indigo-900 border-indigo-200',
    textColor: 'text-indigo-600',
    icon: Wrench,
    progress: 50,
    desc: 'Active hardware repair, precision micro-soldering, and OEM component replacement in progress.',
  },
  IN_PROGRESS: {
    label: 'Restoration In Progress',
    color: 'bg-indigo-600',
    bgSoft: 'bg-indigo-50 text-indigo-900 border-indigo-200',
    textColor: 'text-indigo-600',
    icon: Wrench,
    progress: 50,
    desc: 'Active hardware repair, precision micro-soldering, and OEM component replacement in progress.',
  },
  WAITING_FOR_PARTS: {
    label: 'Waiting For Parts',
    color: 'bg-purple-600',
    bgSoft: 'bg-purple-50 text-purple-900 border-purple-200',
    textColor: 'text-purple-600',
    icon: Package,
    progress: 55,
    desc: 'Sourcing genuine Grade-A replacement components from logistics inventory.',
  },
  TESTING: {
    label: 'QA Testing',
    color: 'bg-orange-500',
    bgSoft: 'bg-orange-50 text-orange-900 border-orange-200',
    textColor: 'text-orange-600',
    icon: ClipboardCheck,
    progress: 70,
    desc: 'Performing comprehensive 36-point diagnostic inspection and display touch calibration.',
  },
  REPAIRED: {
    label: 'Device Repaired',
    color: 'bg-teal-600',
    bgSoft: 'bg-teal-50 text-teal-900 border-teal-200',
    textColor: 'text-teal-600',
    icon: CheckCircle2,
    progress: 88,
    desc: 'Technical repair completed successfully and passed quality verification standards.',
  },
  READY_FOR_PICKUP: {
    label: 'Ready For Collection',
    color: 'bg-emerald-600',
    bgSoft: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    textColor: 'text-emerald-600',
    icon: MapPin,
    progress: 90,
    desc: 'Restoration verified. Your device is sanitized and packaged ready for counter pickup or return courier dispatch.',
  },
  READY_FOR_DELIVERY: {
    label: 'Ready For Collection',
    color: 'bg-emerald-600',
    bgSoft: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    textColor: 'text-emerald-600',
    icon: MapPin,
    progress: 90,
    desc: 'Restoration verified. Your device is packaged ready for counter pickup or courier handover.',
  },
  COURIER_DISPATCHED: {
    label: 'Return Courier Dispatched',
    color: 'bg-blue-700',
    bgSoft: 'bg-blue-50 text-blue-900 border-blue-300 ring-2 ring-blue-500/20',
    textColor: 'text-blue-700',
    icon: Truck,
    progress: 95,
    desc: 'Repaired device has been safely packed and dispatched via courier logistics back to your destination.',
  },
  DISPATCHED_VIA_COURIER: {
    label: 'Return Courier Dispatched',
    color: 'bg-blue-700',
    bgSoft: 'bg-blue-50 text-blue-900 border-blue-300 ring-2 ring-blue-500/20',
    textColor: 'text-blue-700',
    icon: Truck,
    progress: 95,
    desc: 'Repaired device has been safely packed and dispatched via courier logistics back to your destination.',
  },
  DELIVERED: {
    label: 'Delivered & Handed Over',
    color: 'bg-emerald-700',
    bgSoft: 'bg-emerald-50 text-emerald-950 border-emerald-300',
    textColor: 'text-emerald-700',
    icon: PackageCheck,
    progress: 100,
    desc: 'Device handed over to customer successfully.',
  },
  COMPLETED: {
    label: 'Delivered & Handed Over',
    color: 'bg-emerald-700',
    bgSoft: 'bg-emerald-50 text-emerald-950 border-emerald-300',
    textColor: 'text-emerald-700',
    icon: PackageCheck,
    progress: 100,
    desc: 'Device handed over to customer successfully.',
  },
  RE_PROBLEM: {
    label: 'Re-Check Inspection',
    color: 'bg-rose-600',
    bgSoft: 'bg-rose-50 text-rose-900 border-rose-300 ring-2 ring-rose-500/20',
    textColor: 'text-rose-600',
    icon: AlertCircle,
    progress: 40,
    desc: 'Device received for priority post-delivery diagnostic inspection.',
  },
  REPROBLEM: {
    label: 'Re-Check Inspection',
    color: 'bg-rose-600',
    bgSoft: 'bg-rose-50 text-rose-900 border-rose-300 ring-2 ring-rose-500/20',
    textColor: 'text-rose-600',
    icon: AlertCircle,
    progress: 40,
    desc: 'Device received for priority post-delivery diagnostic inspection.',
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

export interface TimelineStageDefinition {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  shortDesc: string;
}

// The official 6 customer-facing repair journey stages with professional icons
export const REPAIR_TIMELINE_STAGES: TimelineStageDefinition[] = [
  {
    key: 'RECEIVED',
    label: 'Received',
    icon: Inbox,
    shortDesc: 'Cataloged & checked in',
  },
  {
    key: 'DIAGNOSING',
    label: 'Diagnosing',
    icon: Search,
    shortDesc: 'Circuit inspection',
  },
  {
    key: 'RESTORATION',
    label: 'Restoration',
    icon: Wrench,
    shortDesc: 'Component repair',
  },
  {
    key: 'QA_TESTING',
    label: 'QA Testing',
    icon: ClipboardCheck,
    shortDesc: '36-point calibration',
  },
  {
    key: 'REPAIRED',
    label: 'Repaired',
    icon: CheckCircle2,
    shortDesc: 'Ready for collection',
  },
  {
    key: 'DELIVERED',
    label: 'Delivered',
    icon: PackageCheck,
    shortDesc: 'Service completed',
  },
];

function getCustomerFriendlyLogDetails(action: string, status?: string, notes?: string) {
  const state = (status || action || '').toUpperCase();

  if (state.includes('RECEIVED') || state.includes('CREATED') || state === 'CREATED') {
    return { title: 'Device Received', desc: 'Device securely cataloged and checked into MTS Lab inventory.' };
  }
  if (state.includes('DIAGNOSING')) {
    return { title: 'Diagnosis In Progress', desc: 'Hardware inspection and diagnostic testing in progress.' };
  }
  if (state.includes('PROCESS') || state.includes('REPAIR') || state.includes('RESTORATION')) {
    return {
      title: 'Restoration In Progress',
      desc: 'Active hardware restoration and component replacement under way.',
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
  if (state.includes('RE_PROBLEM') || state.includes('REPROBLEM')) {
    return { title: 'Re-Check Inspection', desc: 'Device received for priority diagnostic re-evaluation.' };
  }
  if (state.includes('CANCEL')) {
    return { title: 'Service Cancelled', desc: 'Repair service ticket was closed or cancelled by customer request.' };
  }

  return {
    title: 'Status Update',
    desc: 'Device status updated to reflect laboratory progress.',
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

  const currentStatusRaw = (activeRepair?.status || 'RECEIVED').toUpperCase();
  const currentStatus = statusConfig[currentStatusRaw] || statusConfig.RECEIVED;
  const isPending = currentStatusRaw === 'PENDING';
  const isRepaired = ['REPAIRED', 'READY_FOR_PICKUP', 'READY_FOR_DELIVERY'].includes(currentStatusRaw);
  const isDelivered = currentStatusRaw === 'DELIVERED' || currentStatusRaw === 'COMPLETED';

  const copyRepairNumber = (num: string) => {
    if (!num) return;
    navigator.clipboard.writeText(num.replace(/^#+/, ''));
    setCopied(true);
    toast.success(`Copied Repair #${num.replace(/^#+/, '')}`);
    setTimeout(() => setCopied(false), 2000);
  };

  // Safely map current backend status to the 6-stage customer timeline
  const getStageStatus = (stageIdx: number): 'completed' | 'current' | 'upcoming' => {
    if (isDelivered) {
      return 'completed';
    }

    let activeStageIdx = 0;

    if (
      currentStatusRaw === 'REPAIRED' ||
      currentStatusRaw === 'READY_FOR_PICKUP' ||
      currentStatusRaw === 'READY_FOR_DELIVERY' ||
      currentStatusRaw === 'COURIER_DISPATCHED' ||
      currentStatusRaw === 'DISPATCHED_VIA_COURIER' ||
      currentStatusRaw === 'REPROBLEM_FIXED'
    ) {
      activeStageIdx = 4; // Repaired
    } else if (
      currentStatusRaw === 'TESTING' ||
      currentStatusRaw === 'QA_TESTING' ||
      currentStatusRaw === 'QA'
    ) {
      activeStageIdx = 3; // QA Testing
    } else if (
      currentStatusRaw === 'IN_PROCESS' ||
      currentStatusRaw === 'IN_PROGRESS' ||
      currentStatusRaw === 'WAITING_FOR_PARTS' ||
      currentStatusRaw === 'RESTORATION' ||
      currentStatusRaw === 'RE_PROBLEM' ||
      currentStatusRaw === 'REPROBLEM'
    ) {
      activeStageIdx = 2; // Restoration
    } else if (currentStatusRaw === 'DIAGNOSING') {
      activeStageIdx = 1; // Diagnosing
    } else if (currentStatusRaw === 'RECEIVED' || currentStatusRaw === 'PENDING') {
      activeStageIdx = 0; // Received
    } else {
      activeStageIdx = 0;
    }

    if (stageIdx < activeStageIdx) return 'completed';
    if (stageIdx === activeStageIdx) return 'current';
    return 'upcoming';
  };

  // Calculate percentage for progress connector line
  const activeStageIndex = (() => {
    if (isDelivered) return 5;
    for (let i = 0; i < REPAIR_TIMELINE_STAGES.length; i++) {
      if (getStageStatus(i) === 'current') return i;
    }
    return 0;
  })();

  const progressPercentage = isDelivered ? 100 : (activeStageIndex / (REPAIR_TIMELINE_STAGES.length - 1)) * 100;

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

                {/* Pending Status Banner */}
                {isPending && (
                  <div className="bg-amber-50/90 border-2 border-amber-300 rounded-2xl p-5 sm:p-6 text-amber-950 shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5 sm:gap-4">
                      <div className="w-11 h-11 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-md shadow-amber-500/20">
                        <Clock className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base sm:text-lg font-black text-amber-950 tracking-tight">
                            Your device is currently in Pending status.
                          </h3>
                          <Badge className="bg-amber-500 hover:bg-amber-500 text-white text-[10px] font-extrabold uppercase px-2 py-0.5">
                            Pending
                          </Badge>
                        </div>
                        <p className="text-xs sm:text-sm text-amber-900 font-semibold leading-relaxed">
                          For more information or assistance, please contact MTS Lab directly.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full lg:w-auto pt-3 lg:pt-0 border-t lg:border-t-0 border-amber-200/80">
                      <a
                        href="tel:9869276668"
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-bold transition-colors shadow-xs shrink-0 flex-1 sm:flex-initial"
                      >
                        <Phone className="w-4 h-4" />
                        <span>Call: 9869276668</span>
                      </a>
                      <a
                        href="tel:015364307"
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-amber-100 text-amber-950 border border-amber-300 text-xs sm:text-sm font-bold transition-colors shadow-xs shrink-0 flex-1 sm:flex-initial"
                      >
                        <Phone className="w-4 h-4" />
                        <span>Tel: 015364307</span>
                      </a>
                    </div>
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
                          This device was successfully delivered and handed over to the customer.
                        </p>
                        {(activeRepair.deliveredAt || activeRepair.updatedAt) && (
                          <div className="flex items-center gap-1.5 text-xs text-emerald-900 font-bold mt-2">
                            <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Delivered on: {formatNepalDateOnly(activeRepair.deliveredAt || activeRepair.updatedAt)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Device Repaired — Ready for Pickup Banner */}
                {isRepaired && !isDelivered && (
                  <div className="bg-emerald-50/90 border-2 border-emerald-300 rounded-2xl p-5 sm:p-6 text-emerald-950 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5 sm:gap-4">
                      <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-md shadow-emerald-600/20">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base sm:text-lg font-black text-emerald-950 tracking-tight">
                            Your Device Is Repaired
                          </h3>
                          <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[10px] font-extrabold uppercase px-2 py-0.5">
                            Ready for Pickup
                          </Badge>
                        </div>
                        <p className="text-xs sm:text-sm text-emerald-900 font-semibold leading-relaxed">
                          Your device has been successfully repaired and is ready for pickup. You can pick it up now.
                        </p>
                        {activeRepair.updatedAt && (
                          <p className="text-[11px] text-emerald-800 font-medium pt-0.5">
                            Verified completed: {formatNepalDateOnly(activeRepair.updatedAt)}
                          </p>
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

                    {/* Desktop & Tablet Timeline (Horizontal) */}
                    <div className="hidden sm:block pt-3 pb-2">
                      <div className="relative px-2">
                        {/* Background Track */}
                        <div className="absolute top-5 left-8 right-8 h-1 bg-slate-200 z-0 rounded-full" />
                        {/* Active Progress Fill */}
                        <div
                          className="absolute top-5 left-8 h-1 bg-emerald-600 z-0 rounded-full transition-all duration-500 ease-out"
                          style={{
                            width: `calc(${progressPercentage}% - ${progressPercentage === 100 ? '0px' : '32px'})`,
                            maxWidth: 'calc(100% - 64px)'
                          }}
                        />

                        {/* 6 Stage Nodes */}
                        <div className="grid grid-cols-6 relative z-10">
                          {REPAIR_TIMELINE_STAGES.map((stage, idx) => {
                            const status = getStageStatus(idx);
                            const StageIcon = stage.icon;
                            const isCompleted = status === 'completed';
                            const isCurrent = status === 'current';

                            return (
                              <div key={stage.key} className="flex flex-col items-center text-center px-1">
                                <div
                                  className={cn(
                                    'w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-200',
                                    isCompleted
                                      ? 'bg-emerald-600 text-white shadow-xs'
                                      : isCurrent
                                      ? 'bg-slate-900 text-white ring-4 ring-slate-200 shadow-md scale-105'
                                      : 'bg-white text-slate-400 border-2 border-slate-200'
                                  )}
                                >
                                  {isCompleted ? (
                                    <Check className="w-5 h-5 stroke-[2.5]" />
                                  ) : (
                                    <StageIcon className="w-4 h-4" />
                                  )}
                                </div>
                                <div className="mt-2.5 space-y-0.5">
                                  <p
                                    className={cn(
                                      'text-xs font-bold leading-tight',
                                      isCurrent
                                        ? 'text-slate-900 font-extrabold'
                                        : isCompleted
                                        ? 'text-emerald-700'
                                        : 'text-slate-400'
                                    )}
                                  >
                                    {stage.label}
                                  </p>
                                  <span
                                    className={cn(
                                      'text-[10px] block leading-tight font-medium',
                                      isCurrent
                                        ? 'text-slate-600 font-semibold'
                                        : isCompleted
                                        ? 'text-emerald-600/80'
                                        : 'text-slate-400'
                                    )}
                                  >
                                    {isCompleted ? 'Completed' : isCurrent ? 'Active' : 'Pending'}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Mobile Timeline (Vertical Stepper for clean responsive view) */}
                    <div className="block sm:hidden pt-2">
                      <div className="relative pl-7 space-y-4 before:absolute before:left-[15px] before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
                        {REPAIR_TIMELINE_STAGES.map((stage, idx) => {
                          const status = getStageStatus(idx);
                          const StageIcon = stage.icon;
                          const isCompleted = status === 'completed';
                          const isCurrent = status === 'current';

                          return (
                            <div key={stage.key} className="relative flex items-start">
                              {/* Step Node Icon */}
                              <div
                                className={cn(
                                  'absolute -left-7 flex items-center justify-center w-8 h-8 rounded-full border-2 border-white shadow-xs transition-all',
                                  isCompleted
                                    ? 'bg-emerald-600 text-white'
                                    : isCurrent
                                    ? 'bg-slate-900 text-white ring-2 ring-slate-200 scale-105'
                                    : 'bg-slate-100 text-slate-400 border-slate-200'
                                )}
                              >
                                {isCompleted ? (
                                  <Check className="w-4 h-4 stroke-[2.5]" />
                                ) : (
                                  <StageIcon className="w-3.5 h-3.5" />
                                )}
                              </div>

                              {/* Step Details */}
                              <div
                                className={cn(
                                  'ml-3 flex-1 rounded-xl p-3 border transition-all',
                                  isCurrent
                                    ? 'bg-slate-50/90 border-slate-300 ring-1 ring-slate-200 shadow-2xs'
                                    : isCompleted
                                    ? 'bg-white border-slate-200/80'
                                    : 'bg-white/60 border-slate-100 opacity-75'
                                )}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span
                                    className={cn(
                                      'text-xs font-bold',
                                      isCurrent
                                        ? 'text-slate-900'
                                        : isCompleted
                                        ? 'text-emerald-800'
                                        : 'text-slate-500'
                                    )}
                                  >
                                    {stage.label}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      'text-[9px] uppercase px-1.5 py-0 font-extrabold',
                                      isCurrent
                                        ? 'bg-slate-900 text-white border-slate-900'
                                        : isCompleted
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : 'bg-slate-50 text-slate-400 border-slate-200'
                                    )}
                                  >
                                    {isCompleted ? 'Done' : isCurrent ? 'In Progress' : 'Pending'}
                                  </Badge>
                                </div>
                                <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                                  {stage.shortDesc}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Device & Service Information Card */}
                <Card className="rounded-2xl border border-slate-200 shadow-sm bg-white overflow-hidden w-full">
                  <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-slate-700" />
                      <h3 className="font-bold text-slate-900 text-sm">Device & Service Information</h3>
                    </div>
                    <span className="text-[11px] font-mono text-slate-500 font-bold">#{activeRepair.repairNumber}</span>
                  </div>
                  <CardContent className="p-4 sm:p-6 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 text-xs sm:text-sm">
                      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-slate-500 font-semibold block text-[11px] uppercase tracking-wider">Device Model</span>
                        <span className="font-bold text-slate-900 text-sm mt-1 block">
                          {activeRepair.deviceBrand} {activeRepair.deviceModel}
                        </span>
                      </div>
                      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-slate-500 font-semibold block text-[11px] uppercase tracking-wider">Intake Method</span>
                        <span className="font-bold text-slate-900 text-sm mt-1 block">
                          {isCourierDevice ? 'Courier Logistics Delivery' : 'Walk-in Counter Service'}
                        </span>
                      </div>
                      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-slate-500 font-semibold block text-[11px] uppercase tracking-wider">Intake Date</span>
                        <span className="font-bold text-slate-900 text-sm mt-1 block">
                          {formatNepalDateOnly(activeRepair.createdAt) || 'Recorded'}
                        </span>
                      </div>
                    </div>

                    {activeRepair.problemDescription && (
                      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                        <span className="text-slate-500 font-semibold block text-[11px] uppercase tracking-wider">Reported Issue / Fault</span>
                        <p className="font-medium text-slate-800 text-xs sm:text-sm leading-relaxed">
                          {activeRepair.problemDescription}
                        </p>
                      </div>
                    )}

                    {activeRepair.conditionNotes && (
                      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                        <span className="text-slate-500 font-semibold block text-[11px] uppercase tracking-wider">Physical Condition Notes</span>
                        <p className="font-medium text-slate-800 text-xs sm:text-sm leading-relaxed">
                          {activeRepair.conditionNotes}
                        </p>
                      </div>
                    )}

                    {activeRepair.accessoriesReceived && (
                      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                        <span className="text-slate-500 font-semibold block text-[11px] uppercase tracking-wider">Accessories Received</span>
                        <p className="font-medium text-slate-800 text-xs sm:text-sm">
                          {activeRepair.accessoriesReceived}
                        </p>
                      </div>
                    )}

                    {activeRepair.returnCourierTrackingNumber && (
                      <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl space-y-1">
                        <div className="flex items-center gap-1.5 text-blue-900 font-bold text-xs">
                          <Truck className="w-3.5 h-3.5 text-blue-700" />
                          <span>Return Courier Tracking</span>
                        </div>
                        <p className="text-xs text-blue-800 font-medium">
                          {activeRepair.returnCourierCompany || 'Courier'}:{' '}
                          <strong className="font-mono font-bold text-blue-950">{activeRepair.returnCourierTrackingNumber}</strong>
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

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
                                  <div className="mb-0.5">
                                    <span className="text-xs font-bold text-slate-900">{friendlyInfo.title}</span>
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
                Reach out to our customer service desk for live updates and dispatch tracking.
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
