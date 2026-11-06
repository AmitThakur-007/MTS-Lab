import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Smartphone,
  User,
  MapPin,
  Wrench,
  FileText,
  ShieldCheck,
  ChevronLeft,
  Loader2,
  Banknote,
  Zap,
  Printer,
  RotateCcw,
  MessageSquare,
  Send,
  Package,
  Truck,
  Edit3,
  ExternalLink,
  Check,
  Flame,
  Clock,
  CheckCircle2,
  AlertCircle,
  Copy,
  Ban,
  AlertTriangle,
  Phone,
  Mail,
  DollarSign,
  Calendar,
  Layers,
  HelpCircle,
  CheckCircle,
  Tag
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { formatNPR } from '@/lib/format';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { syncRepairToSupabase as syncRepairToRtdb } from '@/lib/supabase';
import DashboardRefreshButton from '@/components/DashboardRefreshButton';
import { useAuthStore } from '@/store/authStore';
import { useDashboardSidebar } from '@/context/SidebarContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import ServiceSlipModal from '@/components/repair/ServiceSlipModal';
import EditRepairModal from '@/components/repair/EditRepairModal';
import UpdateCourierModal from '@/components/repair/UpdateCourierModal';
import SendSmsModal from '@/components/repair/SendSmsModal';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useRepairCache } from '@/store/repairCache';
import { getRepairDeviceDisplay } from '@/lib/device';
import { getRepairTimelineMetrics } from '@/lib/repairTimeline';

export interface RepairRecordDetailProps {
  repair: any;
  technicians?: any[];
  notes?: any[];
  onRefresh?: () => void;
  onUpdateRepair?: (updated: any) => void;
}

export default function RepairRecordDetail({
  repair: initialRepair,
  technicians = [],
  notes = [],
  onRefresh,
  onUpdateRepair,
}: RepairRecordDetailProps) {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { isCollapsed } = useDashboardSidebar();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      return isCollapsed ? window.innerWidth - 100 : window.innerWidth - 300;
    }
    return 1200;
  });

  // Dynamically observe container width to adapt layout to sidebar expand/collapse
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0) {
          setContainerWidth(rect.width);
        }
      }
    };

    measure();

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });

    observer.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [isCollapsed]);

  // Adaptive columns based on actual available container width:
  // - Compact container (< 680px): 1 column
  // - Medium / desktop with expanded sidebar on laptop (< 1120px): 2 columns (spacious, zero squishing)
  // - Wide / desktop with collapsed sidebar or large monitor (>= 1120px): 3 columns
  const sectionGridClass = React.useMemo(() => {
    if (containerWidth < 680) {
      return 'grid-cols-1';
    }
    if (containerWidth < 1120) {
      return 'grid-cols-1 md:grid-cols-2';
    }
    return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
  }, [containerWidth]);

  const [repair, setRepair] = useState<any>(initialRepair);
  const [updating, setUpdating] = useState(false);

  // Sync state if initialRepair changes
  React.useEffect(() => {
    if (initialRepair) {
      setRepair(initialRepair);
    }
  }, [initialRepair]);

  // Dialogs
  const [isReopenDialogOpen, setIsReopenDialogOpen] = useState(false);
  const [reopenRemark, setReopenRemark] = useState('');

  // Cancel Repair Dialog
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [cancelReasonPreset, setCancelReasonPreset] = useState('Customer cancelled / withdrew repair');
  const [cancelRemarks, setCancelRemarks] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // Restore Cancelled Repair Dialog
  const [isRestoreDialogOpen, setIsRestoreDialogOpen] = useState(false);
  const [restoreTargetStatus, setRestoreTargetStatus] = useState('PENDING');
  const [restoreNote, setRestoreNote] = useState('');
  const [restoring, setRestoring] = useState(false);

  // Modals
  const [isSlipModalOpen, setIsSlipModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCourierDispatchDialogOpen, setIsCourierDispatchDialogOpen] = useState(false);
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);

  // Payment Recording Modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentType, setPaymentType] = useState<'ADVANCE' | 'FULL' | 'CUSTOM'>('FULL');
  const [paymentNote, setPaymentNote] = useState('');
  const [recordingPayment, setRecordingPayment] = useState(false);

  // Communication Notes
  const [newNote, setNewNote] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);

  // Device display parsing
  const device = getRepairDeviceDisplay(repair);
  const timeline = getRepairTimelineMetrics(repair);

  const copyToClipboard = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const handleAssignmentChange = async (technicianId: string) => {
    if (!repair?.id) return;
    setUpdating(true);
    try {
      const updated = await api.post(`/repairs/${repair.id}/assign`, { technicianId });
      await syncRepairToRtdb(updated);
      setRepair(updated);
      if (onUpdateRepair) onUpdateRepair(updated);
      if (repair.id) useRepairCache.getState().updateRepair(repair.id, updated);
      toast.success('Specialist assigned successfully');
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Unable to update specialist assignment.');
    } finally {
      setUpdating(false);
    }
  };

  const updateStatus = async (status: string) => {
    if (!repair?.id) return;
    if (status === 'RE_PROBLEM') {
      setIsReopenDialogOpen(true);
      return;
    }
    if (status === 'CANCELLED') {
      setIsCancelDialogOpen(true);
      return;
    }
    setUpdating(true);
    try {
      const updated = await api.patch(`/repairs/${repair.id}`, { status });
      await syncRepairToRtdb(updated);
      setRepair(updated);
      if (onUpdateRepair) onUpdateRepair(updated);
      if (repair.id) useRepairCache.getState().updateRepair(repair.id, updated);
      toast.success(`Status updated to ${status.replace(/_/g, ' ')}`);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Unable to save the repair status.');
    } finally {
      setUpdating(false);
    }
  };

  const updatePriority = async (newPriority: string) => {
    if (!repair?.id || repair?.priority === newPriority || updating) return;
    setUpdating(true);
    try {
      const updated = await api.patch(`/repairs/${repair.id}`, { priority: newPriority });
      const synced = updated?.repair || updated;
      await syncRepairToRtdb(synced);
      setRepair(synced);
      if (onUpdateRepair) onUpdateRepair(synced);
      if (repair.id) useRepairCache.getState().updateRepair(repair.id, synced);
      toast.success(`Priority set to ${newPriority}`);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update priority level.');
    } finally {
      setUpdating(false);
    }
  };

  const handleReopenReProblem = async () => {
    if (!repair?.id) return;
    setUpdating(true);
    try {
      const payload: any = {
        status: 'RE_PROBLEM',
        note: reopenRemark.trim() || 'Customer reported issue after delivery'
      };
      const updated = await api.patch(`/repairs/${repair.id}`, payload);
      await syncRepairToRtdb(updated);
      setRepair(updated);
      if (onUpdateRepair) onUpdateRepair(updated);
      if (repair.id) useRepairCache.getState().updateRepair(repair.id, updated);
      setIsReopenDialogOpen(false);
      setReopenRemark('');
      toast.success('Repair reopened under Re-Problem / Warranty status');
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reopen repair');
    } finally {
      setUpdating(false);
    }
  };

  const handleCancelRepair = async () => {
    if (!repair?.id) return;
    setCancelling(true);
    try {
      const response: any = await api.post(`/repairs/${repair.id}/cancel`, {
        reason: cancelReasonPreset,
        remarks: cancelRemarks.trim()
      });
      const updated = response?.repair || response;
      await syncRepairToRtdb(updated);
      setRepair(updated);
      if (onUpdateRepair) onUpdateRepair(updated);
      if (repair.id) useRepairCache.getState().updateRepair(repair.id, updated);
      setIsCancelDialogOpen(false);
      toast.success(`Repair #${repair?.repairNumber} marked as Cancelled`);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error('[CANCEL REPAIR ERROR]', err);
      toast.error(err.message || 'Failed to cancel repair');
    } finally {
      setCancelling(false);
    }
  };

  const handleRestoreRepair = async () => {
    if (!repair?.id) return;
    setRestoring(true);
    try {
      const response: any = await api.post(`/repairs/${repair.id}/reopen`, {
        targetStatus: restoreTargetStatus,
        note: restoreNote.trim() || 'Reopened from Cancelled status'
      });
      const updated = response?.repair || response;
      await syncRepairToRtdb(updated);
      setRepair(updated);
      if (onUpdateRepair) onUpdateRepair(updated);
      if (repair.id) useRepairCache.getState().updateRepair(repair.id, updated);
      setIsRestoreDialogOpen(false);
      toast.success(`Repair #${repair?.repairNumber} restored to ${restoreTargetStatus.replace(/_/g, ' ')}`);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error('[RESTORE REPAIR ERROR]', err);
      toast.error(err.message || 'Failed to restore repair');
    } finally {
      setRestoring(false);
    }
  };

  const handleAddNote = async () => {
    if (!repair?.id || !newNote.trim() || submittingNote) return;
    setSubmittingNote(true);
    try {
      await api.post(`/repairs/${repair.id}/notes`, {
        note: newNote.trim(),
        isInternal: true
      });
      toast.success('Communication note recorded');
      setNewNote('');
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add note');
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleRecordPayment = async () => {
    if (!repair?.id) return;
    const amountNum = parseFloat(paymentAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }
    setRecordingPayment(true);
    try {
      const currentPaid = Number(repair.totalPaid || repair.advancePaid || 0);
      const newTotalPaid = currentPaid + amountNum;
      const estCost = repair.estimatedCost != null ? Number(repair.estimatedCost) : null;
      let newStatus = repair.paymentStatus || 'PARTIAL';
      if (estCost !== null && newTotalPaid >= estCost) {
        newStatus = 'PAID';
      } else if (newTotalPaid > 0) {
        newStatus = 'PARTIAL';
      }

      const updated = await api.patch(`/repairs/${repair.id}`, {
        totalPaid: newTotalPaid,
        advancePaid: repair.advancePaid ? Math.max(Number(repair.advancePaid), newTotalPaid) : newTotalPaid,
        paymentStatus: newStatus,
        remarks: paymentNote.trim() ? `${repair.remarks || ''}\n[Payment Recorded]: ${formatNPR(amountNum)} - ${paymentNote}`.trim() : repair.remarks
      });

      await syncRepairToRtdb(updated);
      setRepair(updated);
      if (onUpdateRepair) onUpdateRepair(updated);
      if (repair.id) useRepairCache.getState().updateRepair(repair.id, updated);
      setIsPaymentModalOpen(false);
      setPaymentAmount('');
      setPaymentNote('');
      toast.success(`Payment of ${formatNPR(amountNum)} successfully recorded!`);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to record payment');
    } finally {
      setRecordingPayment(false);
    }
  };

  // Roles & flags
  const isAssigned = Boolean(repair.technicianId);
  const isCourierDispatched = Boolean(repair.isReturnCourierDispatched || repair.isCourierOut);
  const hasCourierActivity = Boolean(
    isCourierDispatched ||
    repair.returnCourierTrackingNumber ||
    repair.isCourierIn ||
    repair.courierTrackingNumber
  );

  const isRepairedOrReady = ['REPAIRED', 'READY_FOR_PICKUP', 'READY', 'READY_FOR_DELIVERY'].includes(
    String(repair?.status || '').toUpperCase().trim()
  );
  const canSendSms = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST'].includes(user?.role || '');
  const canManageRepairs = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST'].includes(user?.role || '');

  // Cost calculations
  const estimatedCost = repair.estimatedCost != null ? Number(repair.estimatedCost) : (repair.estimated_cost != null ? Number(repair.estimated_cost) : null);
  const advancePaid = repair.advancePaid != null ? Number(repair.advancePaid) : (repair.advance_paid != null ? Number(repair.advance_paid) : 0);
  const totalPaid = repair.totalPaid != null ? Number(repair.totalPaid) : (repair.total_paid != null ? Number(repair.total_paid) : advancePaid);
  const balanceDue = estimatedCost != null ? Math.max(0, estimatedCost - totalPaid) : null;
  const paymentStatus = repair.paymentStatus || repair.payment_status || (estimatedCost && totalPaid >= estimatedCost ? 'PAID' : (totalPaid > 0 ? 'PARTIAL' : 'UNPAID'));

  const PRIORITY_OPTIONS = [
    {
      value: 'NORMAL',
      label: 'Normal',
      badge: 'Standard Queue',
      activeBorder: 'border-slate-900 dark:border-slate-100 ring-2 ring-slate-900/10 dark:ring-slate-100/10 shadow-sm',
      activeBg: 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950',
      badgeActive: 'bg-slate-800 dark:bg-slate-200 text-slate-200 dark:text-slate-900',
      badgeInactive: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
      dotColor: 'bg-slate-400',
    },
    {
      value: 'MEDIUM',
      label: 'Medium',
      badge: 'Elevated',
      activeBorder: 'border-amber-400 ring-2 ring-amber-400/20 shadow-sm',
      activeBg: 'bg-amber-400 text-slate-950',
      badgeActive: 'bg-amber-500 text-slate-950 font-black',
      badgeInactive: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300',
      dotColor: 'bg-amber-500',
    },
    {
      value: 'HIGH',
      label: 'High',
      badge: 'Priority Rush',
      activeBorder: 'border-orange-500 ring-2 ring-orange-500/20 shadow-sm',
      activeBg: 'bg-orange-500 text-white',
      badgeActive: 'bg-orange-600 text-white',
      badgeInactive: 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300',
      dotColor: 'bg-orange-500',
    },
    {
      value: 'URGENT',
      label: 'Urgent / Expedite',
      badge: 'Immediate Action',
      activeBorder: 'border-rose-600 ring-2 ring-rose-600/20 shadow-sm',
      activeBg: 'bg-rose-600 text-white',
      badgeActive: 'bg-rose-700 text-white',
      badgeInactive: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300',
      dotColor: 'bg-rose-600',
    },
  ];

  return (
    <div
      ref={containerRef}
      className="space-y-6 sm:space-y-8 pb-32 max-w-7xl mx-auto px-0 sm:px-1 w-full min-w-0 overflow-x-hidden text-slate-900 dark:text-slate-100 transition-all duration-200 @container"
    >
      {/* ========================================================================= */}
      {/* TOP HEADER TOOLBAR                                                        */}
      {/* ========================================================================= */}
      <div
        className={cn(
          "bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm w-full min-w-0 transition-all",
          containerWidth >= 1180 && isCollapsed
            ? "flex flex-row justify-between items-center gap-4"
            : "flex flex-col gap-4"
        )}
      >
        <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1 w-full">
          <Button
            variant="outline"
            onClick={() => {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate('/dashboard/repairs');
              }
            }}
            className="rounded-2xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 h-10 w-10 p-0 flex items-center justify-center shrink-0 cursor-pointer mt-1 sm:mt-0"
            title="Back to repairs"
          >
            <ChevronLeft className="h-5 w-5 text-slate-700 dark:text-slate-300 shrink-0" />
          </Button>

          <div className="space-y-1.5 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <Badge
                variant="secondary"
                className="font-mono text-xs font-black uppercase tracking-tight bg-slate-900 dark:bg-slate-800 text-white dark:text-slate-100 px-2.5 py-1 rounded-xl shadow-xs shrink-0"
              >
                JOB #{repair.repairNumber}
              </Badge>

              <Badge
                className={cn(
                  'font-bold text-xs px-2.5 py-0.5 rounded-lg shadow-xs shrink-0',
                  repair.status === 'COMPLETED' || repair.status === 'REPAIRED' || repair.status === 'DELIVERED'
                    ? 'bg-emerald-600 text-white'
                    : repair.status === 'CANCELLED'
                    ? 'bg-slate-700 text-white'
                    : repair.status === 'RE_PROBLEM'
                    ? 'bg-rose-600 text-white'
                    : repair.status === 'DISPATCHED_VIA_COURIER'
                    ? 'bg-blue-600 text-white'
                    : 'bg-indigo-600 text-white'
                )}
              >
                {repair.status?.replace(/_/g, ' ') || 'RECEIVED'}
              </Badge>

              {repair.priority === 'URGENT' && (
                <Badge className="bg-rose-600 text-white font-bold flex items-center gap-1 shadow-xs text-xs shrink-0">
                  <Flame className="h-3 w-3 shrink-0" /> URGENT
                </Badge>
              )}
              {repair.priority === 'HIGH' && (
                <Badge className="bg-orange-500 text-white font-bold flex items-center gap-1 shadow-xs text-xs shrink-0">
                  <AlertCircle className="h-3 w-3 shrink-0" /> HIGH
                </Badge>
              )}
              {repair.priority === 'MEDIUM' && (
                <Badge className="bg-amber-400 text-slate-950 font-bold flex items-center gap-1 shadow-xs text-xs shrink-0">
                  <Clock className="h-3 w-3 shrink-0" /> MEDIUM
                </Badge>
              )}
              {(!repair.priority || repair.priority === 'NORMAL') && (
                <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-slate-300 dark:border-slate-700 text-xs shrink-0">
                  NORMAL
                </Badge>
              )}

              {isCourierDispatched && (
                <Badge className="bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-bold flex items-center gap-1 text-xs shrink-0">
                  <Truck className="h-3 w-3 text-blue-600 dark:text-blue-400 shrink-0" /> Courier Dispatched
                </Badge>
              )}
            </div>

            {/* Complete Device Title with Full Display Name */}
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 break-words leading-tight">
              {device.fullName}
            </h1>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div
          className={cn(
            "flex flex-wrap items-center gap-2 min-w-0 max-w-full",
            containerWidth >= 1180 && isCollapsed
              ? "justify-end shrink-0 pt-0 border-t-0"
              : "w-full justify-start pt-3 border-t border-slate-100 dark:border-slate-800"
          )}
        >
          {canManageRepairs && (
            <Button
              variant="outline"
              onClick={() => setIsCourierDispatchDialogOpen(true)}
              className={cn(
                "rounded-2xl font-bold text-xs h-10 px-3.5 shadow-xs shrink-0 cursor-pointer transition-all flex items-center gap-1.5 min-w-0",
                isCourierDispatched
                  ? "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-extrabold"
                  : "border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200"
              )}
            >
              <Truck className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>{isCourierDispatched ? 'Update Courier' : 'Dispatch Courier'}</span>
            </Button>
          )}

          {canManageRepairs && (
            <Button
              variant="outline"
              onClick={() => setIsEditModalOpen(true)}
              className="rounded-2xl border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs h-10 px-3.5 shadow-xs shrink-0 cursor-pointer flex items-center gap-1.5 min-w-0"
            >
              <Edit3 className="h-4 w-4 text-slate-700 dark:text-slate-300 shrink-0" />
              <span>Edit</span>
            </Button>
          )}

          {canSendSms && isRepairedOrReady && (
            <Button
              variant="outline"
              onClick={() => setIsSmsModalOpen(true)}
              className={cn(
                "rounded-2xl font-bold text-xs h-10 px-3.5 shadow-xs shrink-0 cursor-pointer flex items-center gap-1.5 transition-all min-w-0",
                repair.smsSummary?.status === 'SENT'
                  ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/80 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300'
                  : 'border-teal-300 dark:border-teal-700 bg-teal-50/80 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900/60 text-teal-800 dark:text-teal-300'
              )}
              title="Send SMS to Customer"
              aria-label="Send SMS to Customer"
            >
              <MessageSquare className={cn("h-4 w-4 shrink-0", repair.smsSummary?.status === 'SENT' ? 'text-emerald-600 dark:text-emerald-400' : 'text-teal-600 dark:text-teal-400')} />
              <span>{repair.smsSummary?.status === 'SENT' ? 'Send SMS Again' : 'Send SMS'}</span>
            </Button>
          )}

          <Button
            variant="outline"
            onClick={() => setIsSlipModalOpen(true)}
            className="rounded-2xl border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs h-10 px-3.5 shadow-xs shrink-0 cursor-pointer flex items-center gap-1.5 min-w-0"
          >
            <Printer className="h-4 w-4 text-slate-700 dark:text-slate-300 shrink-0" />
            <span>Slip</span>
          </Button>

          {canManageRepairs && (
            <Button
              variant="outline"
              onClick={() => setIsPaymentModalOpen(true)}
              className="rounded-2xl border-emerald-300 dark:border-emerald-700 bg-emerald-50/70 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 font-bold text-xs h-10 px-3.5 shadow-xs shrink-0 cursor-pointer flex items-center gap-1.5 transition-all min-w-0"
            >
              <Banknote className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Record Payment</span>
            </Button>
          )}

          {canManageRepairs && repair.status !== 'CANCELLED' && (
            <Button
              variant="outline"
              onClick={() => setIsCancelDialogOpen(true)}
              className="rounded-2xl border-rose-200 dark:border-rose-800 bg-rose-50/60 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 font-bold text-xs h-10 px-3.5 shadow-xs shrink-0 cursor-pointer flex items-center gap-1.5 transition-all min-w-0"
            >
              <Ban className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>Cancel Device</span>
            </Button>
          )}

          {canManageRepairs && repair.status === 'CANCELLED' && (
            <Button
              variant="outline"
              onClick={() => setIsRestoreDialogOpen(true)}
              className="rounded-2xl border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold text-xs h-10 px-3.5 shadow-xs shrink-0 cursor-pointer flex items-center gap-1.5 transition-all min-w-0"
            >
              <RotateCcw className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>Re-Open Repair</span>
            </Button>
          )}

          {onRefresh && (
            <DashboardRefreshButton
              onRefresh={onRefresh}
              size="sm"
              label="Refresh"
              variant="outline"
              className="rounded-2xl h-10 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs shrink-0 min-w-0"
            />
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 6 ORGANIZED SECTIONS (CONTAINER-ADAPTIVE GRID)                            */}
      {/* ========================================================================= */}
      <div className={cn("grid gap-5 sm:gap-6 w-full min-w-0 transition-all duration-200", sectionGridClass)}>
        
        {/* ======================================================================= */}
        {/* SECTION 1: DEVICE SPECIFICATIONS                                        */}
        {/* ======================================================================= */}
        <Card className="rounded-[32px] border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900 flex flex-col justify-between min-w-0 max-w-full">
          <div className="min-w-0">
            <CardHeader className="bg-slate-50/70 dark:bg-slate-800/40 p-4 sm:p-5 lg:p-6 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between gap-2 min-w-0">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-950/60 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 shrink-0">
                    <Smartphone className="h-5 w-5 shrink-0" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                      Device Specifications
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      Hardware details & serial
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 font-mono text-[10px] font-bold shrink-0 truncate max-w-[120px]">
                  {device.brand}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-5 lg:p-6 space-y-4 min-w-0">
              {/* Formatted Device Hero Box */}
              <div className="bg-indigo-50/60 dark:bg-indigo-950/30 p-3.5 sm:p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 space-y-1 min-w-0">
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block truncate">
                  Identified Device Model
                </span>
                <p className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100 break-words leading-snug">
                  {device.fullName}
                </p>
              </div>

              {/* Specs Breakdown */}
              <div className="space-y-2.5 sm:space-y-3 text-xs min-w-0">
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800 gap-2 min-w-0">
                  <span className="text-slate-500 dark:text-slate-400 font-semibold shrink-0">Manufacturer</span>
                  <span className="font-extrabold text-slate-900 dark:text-slate-100 truncate text-right">{device.brand}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800 gap-2 min-w-0">
                  <span className="text-slate-500 dark:text-slate-400 font-semibold shrink-0">Model</span>
                  <span className="font-extrabold text-slate-900 dark:text-slate-100 truncate text-right">{device.model}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800 gap-2 min-w-0">
                  <span className="text-slate-500 dark:text-slate-400 font-semibold shrink-0">IMEI / Serial</span>
                  <div className="flex items-center gap-1.5 min-w-0 justify-end">
                    <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 truncate max-w-[130px] sm:max-w-[200px]" title={device.imei}>
                      {device.imei}
                    </span>
                    {device.imei && device.imei !== 'N/A' && (
                      <button
                        onClick={() => copyToClipboard(device.imei, 'IMEI')}
                        className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-0.5 transition-colors shrink-0 cursor-pointer"
                        title="Copy IMEI"
                        aria-label="Copy IMEI"
                      >
                        <Copy className="h-3 w-3 shrink-0" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800 gap-2 min-w-0">
                  <span className="text-slate-500 dark:text-slate-400 font-semibold shrink-0">Device Color</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200 truncate text-right">{device.color}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800 gap-2 min-w-0">
                  <span className="text-slate-500 dark:text-slate-400 font-semibold shrink-0">Intake Condition</span>
                  <Badge variant="outline" className="text-[10px] font-bold border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 shrink-0 truncate max-w-[160px]">
                    <ShieldCheck className="h-3 w-3 mr-1 text-emerald-500 shrink-0" /> <span className="truncate">{device.condition}</span>
                  </Badge>
                </div>
                <div className="flex justify-between items-center py-1 gap-2 min-w-0">
                  <span className="text-slate-500 dark:text-slate-400 font-semibold shrink-0">Accessories</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200 max-w-[60%] truncate text-right" title={device.accessories}>
                    {device.accessories}
                  </span>
                </div>
              </div>
            </CardContent>
          </div>
        </Card>

        {/* ======================================================================= */}
        {/* SECTION 2: CUSTOMER INFORMATION                                         */}
        {/* ======================================================================= */}
        <Card className="rounded-[32px] border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900 flex flex-col justify-between min-w-0 max-w-full">
          <div className="min-w-0">
            <CardHeader className="bg-slate-50/70 dark:bg-slate-800/40 p-4 sm:p-5 lg:p-6 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between gap-2 min-w-0">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 bg-blue-50 dark:bg-blue-950/60 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50 shrink-0">
                    <User className="h-5 w-5 shrink-0" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                      Customer Information
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      Contact & channel details
                    </CardDescription>
                  </div>
                </div>
                <span className="font-mono text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-900/60 shrink-0 truncate max-w-[120px]">
                  {repair.customer?.customerId || repair.customerId || 'CUS-INTAKE'}
                </span>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-5 lg:p-6 space-y-4 min-w-0">
              {/* Customer Primary Details */}
              <div className="space-y-2.5 sm:space-y-3 text-xs min-w-0">
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800 gap-2 min-w-0">
                  <span className="text-slate-500 dark:text-slate-400 font-semibold shrink-0">Client Name</span>
                  <span className="font-extrabold text-slate-900 dark:text-slate-100 text-sm truncate max-w-[65%] text-right" title={repair.customerName || repair.customer_name || 'Customer'}>
                    {repair.customerName || repair.customer_name || 'Customer'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800 gap-2 min-w-0">
                  <span className="text-slate-500 dark:text-slate-400 font-semibold shrink-0">Phone Number</span>
                  <div className="flex items-center gap-1.5 min-w-0 justify-end">
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100 truncate max-w-[140px] sm:max-w-none text-right">
                      {repair.customerPhone || repair.customer_phone || 'N/A'}
                    </span>
                    {(repair.customerPhone || repair.customer_phone) && (
                      <button
                        onClick={() => copyToClipboard(repair.customerPhone || repair.customer_phone, 'Phone')}
                        className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-0.5 transition-colors shrink-0 cursor-pointer"
                        title="Copy Phone"
                        aria-label="Copy Phone"
                      >
                        <Copy className="h-3 w-3 shrink-0" />
                      </button>
                    )}
                  </div>
                </div>
                {repair.customerEmail && (
                  <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800 gap-2 min-w-0">
                    <span className="text-slate-500 dark:text-slate-400 font-semibold shrink-0">Email</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[60%] text-right" title={repair.customerEmail}>
                      {repair.customerEmail}
                    </span>
                  </div>
                )}
                {repair.customerAddress && (
                  <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800 gap-2 min-w-0">
                    <span className="text-slate-500 dark:text-slate-400 font-semibold shrink-0">Address</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[60%] text-right" title={repair.customerAddress}>
                      {repair.customerAddress}
                    </span>
                  </div>
                )}
              </div>

              {/* Direct Actions: Call & WhatsApp */}
              {(repair.customerPhone || repair.customer_phone) && (
                <div className="grid grid-cols-2 gap-2 pt-1 min-w-0 w-full">
                  <a
                    href={`tel:${repair.customerPhone || repair.customer_phone}`}
                    className="flex items-center justify-center gap-1.5 h-9 px-2 rounded-xl font-bold text-xs border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors min-w-0"
                  >
                    <Phone className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="truncate">Call Client</span>
                  </a>
                  <a
                    href={`https://wa.me/${String(repair.customerPhone || repair.customer_phone).replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-1.5 h-9 px-2 rounded-xl font-bold text-xs border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/40 hover:bg-teal-100 dark:hover:bg-teal-900/50 text-teal-800 dark:text-teal-300 transition-colors min-w-0"
                  >
                    <MessageSquare className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                    <span className="truncate">WhatsApp</span>
                  </a>
                </div>
              )}

              {/* Dual Channel Notification Snapshot */}
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-2 min-w-0">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300 gap-1 min-w-0">
                  <span className="flex items-center gap-1 shrink-0">
                    <MessageSquare className="h-3 w-3 text-teal-600 shrink-0" />
                    <span>Notifications:</span>
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate text-right">
                    {repair.smsSummary?.count ? `${repair.smsSummary.count} messages sent` : 'No messages sent'}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <Badge variant="outline" className="text-[10px] px-2 py-0.5 rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 truncate">
                    SMS: {repair.smsSummary?.smsStatus || 'NONE'}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] px-2 py-0.5 rounded-lg border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 truncate">
                    WA: {repair.smsSummary?.whatsappStatus || 'NONE'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </div>
        </Card>

        {/* ======================================================================= */}
        {/* SECTION 3: REPAIR INFORMATION                                           */}
        {/* ======================================================================= */}
        <Card className="rounded-[32px] border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900 flex flex-col justify-between min-w-0 max-w-full">
          <div className="min-w-0">
            <CardHeader className="bg-slate-50/70 dark:bg-slate-800/40 p-4 sm:p-5 lg:p-6 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between gap-2 min-w-0">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 bg-amber-50 dark:bg-amber-950/60 rounded-2xl flex items-center justify-center text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/50 shrink-0">
                    <Wrench className="h-5 w-5 shrink-0" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                      Repair Information
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      Ticket status & timeline
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono text-[10px] font-bold border-slate-200 dark:border-slate-700 shrink-0 truncate max-w-[120px]">
                  #{repair.repairNumber}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-5 lg:p-6 space-y-4 min-w-0">
              <div className="space-y-2.5 sm:space-y-3 text-xs min-w-0">
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800 gap-2 min-w-0">
                  <span className="text-slate-500 dark:text-slate-400 font-semibold shrink-0">Intake Method</span>
                  <Badge variant="outline" className="text-[10px] font-bold border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 shrink-0 truncate">
                    {repair.isCourierIn || repair.receivingMethod === 'COURIER' ? 'Courier Intake' : 'Walk-in Intake'}
                  </Badge>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800 gap-2 min-w-0">
                  <span className="text-slate-500 dark:text-slate-400 font-semibold shrink-0">Received Date</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100 truncate text-right">
                    {timeline.receivedAtFormatted}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800 gap-2 min-w-0">
                  <span className="text-slate-500 dark:text-slate-400 font-semibold shrink-0">Time Elapsed</span>
                  <span className="font-bold text-sky-600 dark:text-sky-400 truncate text-right">
                    {timeline.timeSinceReceived} ago
                  </span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800 gap-2 min-w-0">
                  <span className="text-slate-500 dark:text-slate-400 font-semibold shrink-0">Target Completion</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100 truncate text-right">
                    {repair.expectedCompletionDate
                      ? format(new Date(repair.expectedCompletionDate), 'dd MMM yyyy')
                      : 'Pending estimate'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 gap-2 min-w-0">
                  <span className="text-slate-500 dark:text-slate-400 font-semibold shrink-0">Queue Priority</span>
                  <Badge className={cn('text-[10px] font-bold shrink-0 truncate', repair.priority === 'URGENT' ? 'bg-rose-600 text-white' : repair.priority === 'HIGH' ? 'bg-orange-500 text-white' : repair.priority === 'MEDIUM' ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-white')}>
                    {repair.priority || 'NORMAL'}
                  </Badge>
                </div>
              </div>

              {/* Status Pill */}
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 min-w-0">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 shrink-0">Current Status</span>
                <span className="font-extrabold text-xs text-indigo-600 dark:text-indigo-400 uppercase tracking-wide truncate text-right">
                  {repair.status?.replace(/_/g, ' ')}
                </span>
              </div>
            </CardContent>
          </div>
        </Card>

        {/* ======================================================================= */}
        {/* SECTION 4: FINANCIAL DETAILS                                            */}
        {/* ======================================================================= */}
        <Card className="rounded-[32px] border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900 flex flex-col justify-between min-w-0 max-w-full">
          <div className="min-w-0">
            <CardHeader className="bg-slate-50/70 dark:bg-slate-800/40 p-4 sm:p-5 lg:p-6 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between gap-2 min-w-0">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-950/60 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50 shrink-0">
                    <Banknote className="h-5 w-5 shrink-0" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                      Financial Details
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      Costs, advance & balance
                    </CardDescription>
                  </div>
                </div>
                <Badge
                  className={cn(
                    'font-bold text-[10px] uppercase shrink-0 truncate max-w-[120px]',
                    paymentStatus === 'PAID'
                      ? 'bg-emerald-600 text-white'
                      : paymentStatus === 'PARTIAL'
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-rose-600 text-white'
                  )}
                >
                  {paymentStatus}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-5 lg:p-6 space-y-4 min-w-0">
              <div className="space-y-2.5 sm:space-y-3 text-xs min-w-0">
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800 gap-2 min-w-0">
                  <span className="text-slate-500 dark:text-slate-400 font-semibold shrink-0">Estimated Cost</span>
                  <span className="font-extrabold font-mono text-slate-900 dark:text-slate-100 text-sm truncate text-right">
                    {estimatedCost !== null ? formatNPR(estimatedCost) : 'Unspecified'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800 gap-2 min-w-0">
                  <span className="text-slate-500 dark:text-slate-400 font-semibold shrink-0">Advance Received</span>
                  <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400 truncate text-right">
                    {formatNPR(advancePaid)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800 gap-2 min-w-0">
                  <span className="text-slate-500 dark:text-slate-400 font-semibold shrink-0">Total Paid Amount</span>
                  <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400 truncate text-right">
                    {formatNPR(totalPaid)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1.5 bg-rose-50/50 dark:bg-rose-950/20 px-3 rounded-xl border border-rose-100 dark:border-rose-900/30 gap-2 min-w-0">
                  <span className="font-extrabold text-slate-900 dark:text-slate-100 truncate">Remaining Balance</span>
                  <span className="font-black font-mono text-rose-600 dark:text-rose-400 text-base shrink-0">
                    {balanceDue !== null ? formatNPR(balanceDue) : '—'}
                  </span>
                </div>
              </div>

              {canManageRepairs && (
                <Button
                  onClick={() => setIsPaymentModalOpen(true)}
                  className="w-full h-10 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs cursor-pointer flex items-center justify-center gap-1.5 min-w-0 transition-all"
                >
                  <DollarSign className="h-4 w-4 shrink-0" />
                  <span className="truncate">Record Payment / Advance</span>
                </Button>
              )}
            </CardContent>
          </div>
        </Card>

        {/* ======================================================================= */}
        {/* SECTION 5: TECHNICIAN DETAILS                                           */}
        {/* ======================================================================= */}
        <Card className="rounded-[32px] border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900 flex flex-col justify-between min-w-0 max-w-full">
          <div className="min-w-0">
            <CardHeader className="bg-slate-50/70 dark:bg-slate-800/40 p-4 sm:p-5 lg:p-6 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between gap-2 min-w-0">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 bg-purple-50 dark:bg-purple-950/60 rounded-2xl flex items-center justify-center text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/50 shrink-0">
                    <Zap className="h-5 w-5 shrink-0" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                      Technician Details
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      Assigned workbench specialist
                    </CardDescription>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px] font-bold shrink-0 truncate max-w-[120px]',
                    isAssigned
                      ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                      : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                  )}
                >
                  {isAssigned ? 'ASSIGNED' : 'UNASSIGNED'}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-5 lg:p-6 space-y-4 min-w-0">
              {repair.technician ? (
                <div className="flex items-center gap-3 p-3 sm:p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800 min-w-0">
                  <div className="w-10 h-10 bg-purple-600 text-white rounded-xl flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                    {repair.technician.name?.charAt(0) || 'T'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-900 dark:text-slate-100 text-xs truncate">
                      {repair.technician.name}
                    </p>
                    <p className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider truncate">
                      {repair.technician.role?.replace(/_/g, ' ') || 'SPECIALIST'}
                    </p>
                    {repair.technician.email && (
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate" title={repair.technician.email}>
                        {repair.technician.email}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2 min-w-0">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span className="leading-snug">Ticket currently in queue awaiting technician assignment.</span>
                </div>
              )}

              {/* Assignment Selector for Admins & Managers */}
              {canManageRepairs && (
                <div className="space-y-1.5 pt-1 min-w-0">
                  <Label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block truncate">
                    Assign / Re-Assign Specialist
                  </Label>
                  <Select
                    value={repair.technicianId || ''}
                    onValueChange={handleAssignmentChange}
                    disabled={updating}
                  >
                    <SelectTrigger className="h-10 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-slate-100 w-full min-w-0">
                      <SelectValue placeholder="Choose specialist..." className="truncate" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                      {technicians.map((t) => (
                        <SelectItem key={t.id} value={t.id} className="text-xs font-bold py-2">
                          {t.name} ({t.role?.replace(/_/g, ' ') || 'STAFF'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </div>
        </Card>

        {/* ======================================================================= */}
        {/* SECTION 6: ISSUE DIAGNOSTICS & REMARKS                                  */}
        {/* ======================================================================= */}
        <Card className="rounded-[32px] border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900 flex flex-col justify-between min-w-0 max-w-full">
          <div className="min-w-0">
            <CardHeader className="bg-slate-50/70 dark:bg-slate-800/40 p-4 sm:p-5 lg:p-6 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between gap-2 min-w-0">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 bg-rose-50 dark:bg-rose-950/60 rounded-2xl flex items-center justify-center text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/50 shrink-0">
                    <FileText className="h-5 w-5 shrink-0" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                      Issue Diagnostics
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      Reported issues & diagnosis
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] font-bold border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 shrink-0 truncate max-w-[120px]">
                  Fault Intake
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-5 lg:p-6 space-y-3.5 min-w-0">
              <div className="space-y-1.5 min-w-0">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 block truncate">
                  Customer Reported Issue
                </span>
                <p className="text-xs sm:text-sm font-medium leading-relaxed bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-800 text-slate-800 dark:text-slate-200 break-words whitespace-pre-wrap overflow-hidden">
                  "{repair.problemDescription || repair.problem_description || 'No diagnostic notes provided on intake.'}"
                </p>
              </div>

              {repair.remarks && (
                <div className="space-y-1 min-w-0">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 block truncate">
                    Technical Remarks
                  </span>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/30 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 break-words whitespace-pre-wrap overflow-hidden">
                    {repair.remarks}
                  </p>
                </div>
              )}

              {repair.partsUsed && (
                <div className="space-y-1 min-w-0">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 block truncate">
                    Spare Parts Utilized
                  </span>
                  <Badge variant="outline" className="text-xs font-mono font-bold bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 max-w-full break-words inline-block">
                    {repair.partsUsed}
                  </Badge>
                </div>
              )}
            </CardContent>
          </div>
        </Card>
      </div>

      {/* ========================================================================= */}
      {/* OPERATIONS WORKFLOW: PRIORITY & STATUS FLOW                                */}
      {/* ========================================================================= */}
      <Card className="rounded-[32px] sm:rounded-[40px] border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900 w-full min-w-0">
        <CardHeader className="bg-slate-50/50 dark:bg-slate-850/60 p-5 sm:p-6 lg:p-8 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 min-w-0">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-xs shrink-0">
                <Wrench className="h-5 w-5 shrink-0" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 truncate">
                  Operations & Workflow Management
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  Manage queue priority, workshop progression, and repair status
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 w-full min-w-0">
          {/* Priority Selector Grid */}
          <div className="space-y-3 min-w-0">
            <div className="flex items-center justify-between flex-wrap gap-2 min-w-0">
              <div className="space-y-0.5 min-w-0">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 truncate">
                  Repair Queue Priority
                </h3>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                  Select triage priority to reorder queue position for workbench technicians
                </p>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-xl text-[11px] font-bold text-slate-700 dark:text-slate-300 shrink-0">
                <span className="text-slate-400 dark:text-slate-500">Current:</span>
                <span className="font-extrabold text-slate-900 dark:text-slate-100">
                  {repair.priority || 'NORMAL'}
                </span>
              </div>
            </div>

            <div className={cn(
              "grid gap-2.5 w-full min-w-0",
              containerWidth < 768 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"
            )}>
              {PRIORITY_OPTIONS.map((p) => {
                const isCurrent = (repair.priority || 'NORMAL') === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => updatePriority(p.value)}
                    disabled={updating}
                    className={cn(
                      'relative w-full rounded-2xl p-3 text-left transition-all duration-150 flex flex-col justify-between gap-2 border cursor-pointer select-none min-w-0',
                      isCurrent
                        ? cn(p.activeBg, p.activeBorder)
                        : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200/90 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
                    )}
                  >
                    <div className="flex items-center justify-between w-full min-w-0 gap-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={cn(
                            'h-2 w-2 rounded-full shrink-0',
                            isCurrent ? (p.value === 'MEDIUM' ? 'bg-slate-950' : 'bg-white') : p.dotColor
                          )}
                        />
                        <span
                          className={cn(
                            'text-xs font-extrabold tracking-tight truncate',
                            isCurrent
                              ? p.value === 'MEDIUM'
                                ? 'text-slate-950'
                                : 'text-white'
                              : 'text-slate-900 dark:text-slate-100'
                          )}
                        >
                          {p.label}
                        </span>
                      </div>

                      {isCurrent && (
                        <div
                          className={cn(
                            'h-4 w-4 rounded-full flex items-center justify-center shrink-0',
                            p.value === 'MEDIUM' ? 'bg-slate-950 text-white' : 'bg-white text-slate-900'
                          )}
                        >
                          <Check className="h-2.5 w-2.5 stroke-[3] shrink-0" />
                        </div>
                      )}
                    </div>

                    <div className="w-full min-w-0">
                      <span
                        className={cn(
                          'inline-block text-[10px] font-semibold px-2 py-0.5 rounded-lg truncate max-w-full',
                          isCurrent ? p.badgeActive : p.badgeInactive
                        )}
                      >
                        {p.badge}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Status Flow Buttons */}
          <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800 min-w-0">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 truncate">
              Update Repair Stage
            </h3>
            <div className="flex flex-wrap gap-2 min-w-0 max-w-full">
              {[
                'PENDING',
                'RECEIVED',
                'DIAGNOSING',
                'IN_PROCESS',
                'WAITING_FOR_PARTS',
                'TESTING',
                'REPAIRED',
                'READY_FOR_PICKUP',
                'DISPATCHED_VIA_COURIER',
                'DELIVERED',
                'RE_PROBLEM',
                'CANNOT_REPAIR',
                ...(canManageRepairs ? ['CANCELLED'] : [])
              ].map((s) => {
                const isCurrentStatus = repair.status === s;
                return (
                  <Button
                    key={s}
                    onClick={() => updateStatus(s)}
                    disabled={updating || isCurrentStatus}
                    variant={isCurrentStatus ? 'default' : 'outline'}
                    className={cn(
                      'rounded-2xl font-bold h-10 px-3.5 text-xs transition-all cursor-pointer shrink-0 min-w-0',
                      isCurrentStatus
                        ? s === 'RE_PROBLEM'
                          ? 'bg-rose-600 text-white shadow-sm'
                          : s === 'CANCELLED'
                          ? 'bg-slate-800 dark:bg-slate-700 text-white shadow-sm'
                          : s === 'DISPATCHED_VIA_COURIER'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-indigo-600 text-white shadow-sm'
                        : s === 'RE_PROBLEM'
                        ? 'border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                        : s === 'CANCELLED'
                        ? 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        : s === 'DISPATCHED_VIA_COURIER'
                        ? 'border-blue-200 dark:border-blue-900/60 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                    )}
                  >
                    <span>
                      {s === 'RE_PROBLEM'
                        ? 'Re-Problem (Warranty)'
                        : s === 'DISPATCHED_VIA_COURIER'
                        ? 'Dispatched (Courier)'
                        : s.replace(/_/g, ' ')}
                    </span>
                  </Button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ========================================================================= */}
      {/* COURIER LOGISTICS (IF ACTIVE)                                             */}
      {/* ========================================================================= */}
      {hasCourierActivity && (
        <Card className="rounded-[32px] sm:rounded-[40px] border-blue-200/80 dark:border-blue-900/60 shadow-sm overflow-hidden bg-white dark:bg-slate-900 w-full min-w-0">
          <CardHeader className="bg-blue-50/60 dark:bg-blue-950/40 p-5 sm:p-6 lg:p-8 border-b border-blue-100 dark:border-blue-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-w-0">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-xs shrink-0">
                <Truck className="h-6 w-6 shrink-0" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 truncate">Courier Logistics Details</CardTitle>
                <CardDescription className="text-xs text-blue-700 dark:text-blue-300 font-medium truncate">
                  Active parcel consignment & shipment tracking data
                </CardDescription>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => setIsCourierDispatchDialogOpen(true)}
              className="rounded-2xl border-blue-300 dark:border-blue-800 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-bold text-xs h-10 px-4 shadow-xs shrink-0 flex items-center gap-1.5 min-w-0"
            >
              <Truck className="h-4 w-4 shrink-0" />
              <span>Update Courier Info</span>
            </Button>
          </CardHeader>

          <CardContent className="p-5 sm:p-6 lg:p-8 space-y-6 min-w-0">
            <div className={cn(
              "grid gap-4 min-w-0",
              containerWidth < 680
                ? "grid-cols-1"
                : containerWidth < 1140
                ? "grid-cols-1 sm:grid-cols-2"
                : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
            )}>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">Return Courier Partner</p>
                <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100 truncate">
                  {repair.returnCourierCompany || repair.courierCompany || 'Not Specified'}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1 flex items-start justify-between gap-2 min-w-0">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">Tracking / AWB #</p>
                  <p className="text-sm font-mono font-black text-blue-600 dark:text-blue-400 truncate">
                    {repair.returnCourierTrackingNumber || repair.courierTrackingNumber || 'Pending'}
                  </p>
                </div>
                {(repair.returnCourierTrackingNumber || repair.courierTrackingNumber) && (
                  <button
                    onClick={() =>
                      copyToClipboard(
                        repair.returnCourierTrackingNumber || repair.courierTrackingNumber,
                        'Tracking Number'
                      )
                    }
                    className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 transition-colors shrink-0 cursor-pointer"
                    title="Copy Tracking Number"
                    aria-label="Copy Tracking Number"
                  >
                    <Copy className="h-3.5 w-3.5 shrink-0" />
                  </button>
                )}
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">Logistics Status</p>
                <Badge className="bg-blue-600 text-white text-[11px] font-bold shrink-0 truncate">
                  {repair.courierOutStatus || repair.courierStatus || (isCourierDispatched ? 'DISPATCHED' : 'IN_LAB')}
                </Badge>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">Destination District</p>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                  {repair.destinationDistrict || repair.originDistrict || 'Kathmandu'}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">Receiver Contact</p>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                  {repair.receiverName || repair.customerName || 'Customer'}
                  {repair.receiverPhone ? ` (${repair.receiverPhone})` : ''}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">Dispatched Date</p>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                  {repair.returnCourierDispatchDate
                    ? format(new Date(repair.returnCourierDispatchDate), 'dd MMM yyyy')
                    : repair.returnCourierDispatchedAt
                    ? format(new Date(repair.returnCourierDispatchedAt), 'dd MMM yyyy')
                    : '—'}
                </p>
              </div>
            </div>

            {(repair.destinationAddress || repair.returnCourierNotes) && (
              <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 space-y-2 text-xs">
                {repair.destinationAddress && (
                  <div>
                    <span className="font-bold text-slate-500 dark:text-slate-400">Delivery Address: </span>
                    <span className="text-slate-800 dark:text-slate-200 font-medium">{repair.destinationAddress}</span>
                  </div>
                )}
                {repair.returnCourierNotes && (
                  <div>
                    <span className="font-bold text-slate-500 dark:text-slate-400">Logistics Notes: </span>
                    <span className="text-slate-800 dark:text-slate-200 font-medium italic">"{repair.returnCourierNotes}"</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* COMMUNICATION & TECHNICAL NOTES                                           */}
      {/* ========================================================================= */}
      <Card className="rounded-[32px] sm:rounded-[40px] border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900 w-full">
        <CardHeader className="bg-slate-50/50 dark:bg-slate-850/60 p-6 sm:p-8 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center border border-blue-100 dark:border-blue-900/60 shrink-0">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">Communication & Technical Notes</CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                Real-time collaboration across roles and diagnostics history
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 sm:p-8 space-y-6">
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {notes.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                No communication notes recorded yet.
              </div>
            ) : (
              notes.map((n) => (
                <div
                  key={n.id}
                  className="p-4 rounded-2xl text-xs space-y-1.5 border bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 text-slate-900 dark:text-slate-100 break-words"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-extrabold text-[11px] flex items-center gap-1.5">
                      <span>{n.authorName || n.technician?.name || 'Staff Member'}</span>
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 rounded-md font-bold uppercase border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                        {n.authorRole || n.technician?.role || 'STAFF'}
                      </Badge>
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                      {n.createdAt ? format(new Date(n.createdAt), 'dd MMM yyyy, hh:mm a') : ''}
                    </span>
                  </div>
                  <p className="text-xs font-medium leading-relaxed text-slate-800 dark:text-slate-200">{n.note}</p>
                </div>
              ))
            )}
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Textarea
              placeholder="Post internal instruction or diagnostic note..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              className="rounded-2xl border-slate-200 dark:border-slate-800 text-xs font-medium min-h-[70px] bg-slate-50/60 dark:bg-slate-950/60 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100"
            />
            <div className="flex items-center justify-end">
              <Button
                size="sm"
                disabled={submittingNote || !newNote.trim()}
                onClick={handleAddNote}
                className="rounded-xl h-9 px-5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                {submittingNote ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                <span>Add Note</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ========================================================================= */}
      {/* MODALS & POPUPS                                                           */}
      {/* ========================================================================= */}

      {/* Record Payment Modal */}
      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 space-y-4">
          <DialogHeader>
            <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl flex items-center justify-center mb-1">
              <Banknote className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <DialogTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Record Customer Payment
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
              Job #{repair.repairNumber} — Total Estimate: {estimatedCost !== null ? formatNPR(estimatedCost) : 'Unspecified'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/60 dark:border-slate-800 flex justify-between items-center text-xs">
              <div>
                <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Already Paid</span>
                <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400 text-sm">{formatNPR(totalPaid)}</span>
              </div>
              <div className="text-right">
                <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Remaining Due</span>
                <span className="font-black font-mono text-rose-600 dark:text-rose-400 text-sm">
                  {balanceDue !== null ? formatNPR(balanceDue) : '—'}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Payment Amount (NPR)
              </Label>
              <Input
                type="number"
                placeholder="Enter amount..."
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="h-11 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm font-mono font-bold"
              />
              {balanceDue !== null && balanceDue > 0 && (
                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPaymentAmount(String(balanceDue))}
                    className="h-7 text-[10px] font-bold rounded-lg border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
                  >
                    Pay Full Balance ({formatNPR(balanceDue)})
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Payment Method / Note (Optional)
              </Label>
              <Input
                placeholder="e.g. eSewa, Fonepay, Cash, Bank Transfer..."
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
                className="h-10 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsPaymentModalOpen(false)}
              disabled={recordingPayment}
              className="h-10 rounded-xl font-bold text-xs border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleRecordPayment}
              disabled={recordingPayment || !paymentAmount}
              className="h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 shadow-sm flex items-center gap-1.5"
            >
              {recordingPayment ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              <span>Record Payment</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reopen Warranty Modal */}
      <Dialog open={isReopenDialogOpen} onOpenChange={setIsReopenDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 space-y-4">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">Reopen Warranty Claim</DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
              Mark this repair as Re-Problem and provide details of customer claim.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Specify reason for reopening under warranty..."
            value={reopenRemark}
            onChange={(e) => setReopenRemark(e.target.value)}
            className="rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs"
          />
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setIsReopenDialogOpen(false)}
              className="rounded-xl font-bold text-xs border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleReopenReProblem}
              disabled={updating}
              className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs"
            >
              Confirm Reopen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Repair Confirmation Dialog */}
      <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <DialogContent className="max-w-lg rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 space-y-4">
          <DialogHeader>
            <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 rounded-2xl flex items-center justify-center mb-2">
              <Ban className="h-6 w-6 text-rose-600 dark:text-rose-400" />
            </div>
            <DialogTitle className="text-xl font-black text-slate-900 dark:text-slate-100">
              Cancel Repair Service?
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
              Job #{repair.repairNumber} — {device.fullName} ({repair.customerName || 'Customer'})
            </DialogDescription>
          </DialogHeader>

          <div className="p-3.5 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-2xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1 leading-relaxed">
              <p className="font-bold text-amber-950 dark:text-amber-100">Active Queue Removal</p>
              <p>
                Marking this ticket as <strong>CANCELLED</strong> removes it from active bench queues and technician workloads. All diagnostic logs and history remain safely archived.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Reason for Cancellation</Label>
              <Select value={cancelReasonPreset} onValueChange={setCancelReasonPreset}>
                <SelectTrigger className="h-11 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs font-semibold">
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                  <SelectItem value="Customer cancelled / withdrew repair">Customer cancelled / withdrew repair</SelectItem>
                  <SelectItem value="Customer did not approve estimate / quote">Customer did not approve estimate / quote</SelectItem>
                  <SelectItem value="Device collected unrepaired">Device collected unrepaired</SelectItem>
                  <SelectItem value="Duplicate repair entry">Duplicate repair entry</SelectItem>
                  <SelectItem value="Parts unavailable / repair unfeasible">Parts unavailable / repair unfeasible</SelectItem>
                  <SelectItem value="Incorrect entry / wrong ticket">Incorrect entry / wrong ticket</SelectItem>
                  <SelectItem value="Other reason">Other reason</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Additional Remarks & Explanation (Optional)</Label>
              <Textarea
                rows={3}
                placeholder="Specific customer feedback, parts context, or cancellation details..."
                value={cancelRemarks}
                onChange={(e) => setCancelRemarks(e.target.value)}
                className="rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs font-medium"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCancelDialogOpen(false)}
              disabled={cancelling}
              className="h-10 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold"
            >
              Back
            </Button>
            <Button
              type="button"
              onClick={handleCancelRepair}
              disabled={cancelling}
              className="h-10 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-5 shadow-sm flex items-center gap-1.5"
            >
              {cancelling ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Ban className="h-3.5 w-3.5" />
                  <span>Confirm Cancellation</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore Cancelled Repair Dialog */}
      <Dialog open={isRestoreDialogOpen} onOpenChange={setIsRestoreDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 space-y-4">
          <DialogHeader>
            <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-900/60 rounded-xl flex items-center justify-center mb-1">
              <RotateCcw className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <DialogTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">Re-Open Cancelled Repair</DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
              Restore this repair ticket to the active workflow.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Restore to Target Status</Label>
              <Select value={restoreTargetStatus} onValueChange={setRestoreTargetStatus}>
                <SelectTrigger className="h-11 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs font-semibold">
                  <SelectValue placeholder="Target status" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                  <SelectItem value="PENDING">PENDING</SelectItem>
                  <SelectItem value="RECEIVED">RECEIVED</SelectItem>
                  <SelectItem value="DIAGNOSING">DIAGNOSING</SelectItem>
                  <SelectItem value="IN_PROCESS">IN_PROCESS</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Reason / Notes for Reopening</Label>
              <Textarea
                rows={2}
                placeholder="Why is this repair being reopened?..."
                value={restoreNote}
                onChange={(e) => setRestoreNote(e.target.value)}
                className="rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs font-medium"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsRestoreDialogOpen(false)}
              disabled={restoring}
              className="h-10 rounded-xl font-bold text-xs border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleRestoreRepair}
              disabled={restoring}
              className="h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 shadow-sm flex items-center gap-1.5"
            >
              {restoring ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Restoring...</span>
                </>
              ) : (
                <>
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Restore Ticket</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Service Slip Modal */}
      {repair && (
        <ServiceSlipModal
          open={isSlipModalOpen}
          onOpenChange={setIsSlipModalOpen}
          repairs={[repair]}
          customer={
            repair.customer || {
              name: repair.customerName,
              phone: repair.customerPhone,
              email: repair.customerEmail,
              address: repair.customerAddress,
            }
          }
        />
      )}

      {/* Edit Repair Modal */}
      {isEditModalOpen && repair && (
        <EditRepairModal
          open={isEditModalOpen}
          onOpenChange={setIsEditModalOpen}
          repair={repair}
          onSaved={(updated) => {
            setRepair(updated);
            if (onUpdateRepair) onUpdateRepair(updated);
            if (onRefresh) onRefresh();
          }}
        />
      )}

      {/* Update Courier Modal */}
      {repair && (
        <UpdateCourierModal
          open={isCourierDispatchDialogOpen}
          onOpenChange={setIsCourierDispatchDialogOpen}
          repair={repair}
          onSuccess={(updated) => {
            setRepair((prev: any) => ({ ...prev, ...updated }));
            if (onUpdateRepair) onUpdateRepair(updated);
            if (onRefresh) onRefresh();
          }}
        />
      )}

      {/* Send Customer SMS Modal */}
      {repair && (
        <SendSmsModal
          open={isSmsModalOpen}
          onOpenChange={setIsSmsModalOpen}
          repair={repair}
          onSuccess={() => {
            if (onRefresh) onRefresh();
          }}
        />
      )}
    </div>
  );
}
