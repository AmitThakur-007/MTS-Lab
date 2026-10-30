import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  AlertTriangle
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
import { useRealtimeSync } from '@/services/realtime';
import { syncRepairToSupabase as syncRepairToRtdb } from '@/lib/supabase';
import DashboardRefreshButton from '@/components/DashboardRefreshButton';
import { useAuthStore } from '@/store/authStore';
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
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useRepairCache } from '@/store/repairCache';

export default function RepairDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [repair, setRepair] = useState<any>(null);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

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

  // Service Slip Modal
  const [isSlipModalOpen, setIsSlipModalOpen] = useState(false);

  // Edit Repair Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Courier Update / Dispatch Modal
  const [isCourierDispatchDialogOpen, setIsCourierDispatchDialogOpen] = useState(false);

  // Customer SMS Notification Modal
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);

  // Communication Notes
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);

  const fetchData = async () => {
    try {
      const [repairData, staffData, notesData] = await Promise.all([
        api.get(`/repairs/${id}`),
        api.get('/staff'),
        api.get(`/repairs/${id}/notes`).catch(() => [])
      ]);
      setRepair(repairData);
      if (repairData && (repairData.id || repairData.repairNumber)) {
        useRepairCache.getState().updateRepair(repairData.id || repairData.repairNumber, repairData);
      }
      setTechnicians(
        Array.isArray(staffData)
          ? staffData.filter((s: any) => ['TECHNICIAN', 'LEAD_TECHNICIAN'].includes(s.role) && s.isActive !== false)
          : []
      );
      setNotes(Array.isArray(notesData) ? notesData : []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load repair details');
      navigate('/dashboard/repairs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  useRealtimeSync(
    ['repair', 'technicianNote', 'repairLog', 'notification', 'repairTransfer', 'payment', 'user', 'sync'],
    (event) => {
      if (
        !event.id ||
        event.id === id ||
        event.data?.id === id ||
        event.data?.repairId === id ||
        ['user', 'payment', 'technicianNote', 'repairLog', 'repair', 'sync', 'notification', 'repairTransfer'].includes(
          event.entity
        )
      ) {
        fetchData();
      }
    }
  );

  const handleAssignmentChange = async (technicianId: string) => {
    setUpdating(true);
    try {
      const updated = await api.post(`/repairs/${id}/assign`, { technicianId });
      await syncRepairToRtdb(updated);
      setRepair(updated);
      toast.success('Specialist assigned successfully');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Unable to update specialist assignment.');
    } finally {
      setUpdating(false);
    }
  };

  const handleReopenReProblem = async () => {
    setUpdating(true);
    try {
      const payload: any = {
        status: 'RE_PROBLEM',
        note: reopenRemark.trim() || 'Customer reported issue after delivery'
      };
      const updated = await api.patch(`/repairs/${id}`, payload);
      await syncRepairToRtdb(updated);
      setRepair(updated);
      setIsReopenDialogOpen(false);
      setReopenRemark('');
      toast.success('Repair reopened under Re-Problem / Warranty status');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reopen repair');
    } finally {
      setUpdating(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || submittingNote) return;
    setSubmittingNote(true);
    try {
      await api.post(`/repairs/${id}/notes`, {
        note: newNote.trim(),
        isInternal: true
      });
      toast.success('Communication note recorded');
      setNewNote('');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add note');
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleCancelRepair = async () => {
    setCancelling(true);
    try {
      const response: any = await api.post(`/repairs/${id}/cancel`, {
        reason: cancelReasonPreset,
        remarks: cancelRemarks.trim()
      });
      const updated = response?.repair || response;
      await syncRepairToRtdb(updated);
      setRepair(updated);
      setIsCancelDialogOpen(false);
      toast.success(`Repair #${repair?.repairNumber} marked as Cancelled`);
      fetchData();
    } catch (err: any) {
      console.error('[CANCEL REPAIR ERROR]', err);
      toast.error(err.message || 'Failed to cancel repair');
    } finally {
      setCancelling(false);
    }
  };

  const handleRestoreRepair = async () => {
    setRestoring(true);
    try {
      const response: any = await api.post(`/repairs/${id}/reopen`, {
        targetStatus: restoreTargetStatus,
        note: restoreNote.trim() || 'Reopened from Cancelled status'
      });
      const updated = response?.repair || response;
      await syncRepairToRtdb(updated);
      setRepair(updated);
      setIsRestoreDialogOpen(false);
      toast.success(`Repair #${repair?.repairNumber} restored to ${restoreTargetStatus.replace(/_/g, ' ')}`);
      fetchData();
    } catch (err: any) {
      console.error('[RESTORE REPAIR ERROR]', err);
      toast.error(err.message || 'Failed to restore repair');
    } finally {
      setRestoring(false);
    }
  };

  const updateStatus = async (status: string) => {
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
      const updated = await api.patch(`/repairs/${id}`, { status });
      await syncRepairToRtdb(updated);
      setRepair(updated);
      if (id) useRepairCache.getState().updateRepair(id, updated);
      toast.success(`Status updated to ${status.replace(/_/g, ' ')}`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Unable to save the repair status.');
    } finally {
      setUpdating(false);
    }
  };

  const updatePriority = async (newPriority: string) => {
    if (repair?.priority === newPriority || updating) return;
    setUpdating(true);
    try {
      const updated = await api.patch(`/repairs/${id}`, { priority: newPriority });
      const synced = updated?.repair || updated;
      await syncRepairToRtdb(synced);
      setRepair(synced);
      if (id) useRepairCache.getState().updateRepair(id, synced);
      toast.success(`Priority set to ${newPriority}`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update priority level.');
    } finally {
      setUpdating(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  if (loading || !repair) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-12 w-12 text-indigo-600 animate-spin" />
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Opening Repair Vault...</p>
      </div>
    );
  }

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

  const PRIORITY_OPTIONS = [
    {
      value: 'NORMAL',
      label: 'Normal',
      badge: 'Standard Queue',
      activeBorder: 'border-slate-900 ring-2 ring-slate-900/10 shadow-sm',
      activeBg: 'bg-slate-900 text-white',
      badgeActive: 'bg-slate-800 text-slate-200',
      badgeInactive: 'bg-slate-100 text-slate-600',
      dotColor: 'bg-slate-400',
    },
    {
      value: 'MEDIUM',
      label: 'Medium',
      badge: 'Elevated',
      activeBorder: 'border-amber-400 ring-2 ring-amber-400/20 shadow-sm',
      activeBg: 'bg-amber-400 text-slate-950',
      badgeActive: 'bg-amber-500 text-slate-950 font-black',
      badgeInactive: 'bg-amber-50 text-amber-700',
      dotColor: 'bg-amber-500',
    },
    {
      value: 'HIGH',
      label: 'High',
      badge: 'Priority Rush',
      activeBorder: 'border-orange-500 ring-2 ring-orange-500/20 shadow-sm',
      activeBg: 'bg-orange-500 text-white',
      badgeActive: 'bg-orange-600 text-white',
      badgeInactive: 'bg-orange-50 text-orange-700',
      dotColor: 'bg-orange-500',
    },
    {
      value: 'URGENT',
      label: 'Urgent / Expedite',
      badge: 'Immediate Action',
      activeBorder: 'border-rose-600 ring-2 ring-rose-600/20 shadow-sm',
      activeBg: 'bg-rose-600 text-white',
      badgeActive: 'bg-rose-700 text-white',
      badgeInactive: 'bg-rose-50 text-rose-700',
      dotColor: 'bg-rose-600',
    },
  ];

  return (
    <div className="space-y-6 sm:space-y-8 pb-32 max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 w-full overflow-x-hidden">
      {/* Top Header Toolbar */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm w-full">
        <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1 w-full xl:w-auto">
          <Button
            variant="outline"
            onClick={() => {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate('/dashboard/repairs');
              }
            }}
            className="rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 h-10 w-10 p-0 flex items-center justify-center shrink-0 cursor-pointer hover:bg-slate-100 mt-1 sm:mt-0"
            title="Back to repairs"
          >
            <ChevronLeft className="h-5 w-5 text-slate-700 dark:text-slate-300" />
          </Button>

          <div className="space-y-1.5 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="secondary"
                className="font-mono text-xs font-black uppercase tracking-tight bg-slate-900 dark:bg-slate-800 text-white dark:text-slate-100 px-2.5 py-1 rounded-xl shadow-xs"
              >
                JOB #{repair.repairNumber}
              </Badge>

              <Badge
                className={
                  repair.status === 'COMPLETED' || repair.status === 'REPAIRED' || repair.status === 'DELIVERED'
                    ? 'bg-emerald-600 text-white font-bold'
                    : repair.status === 'CANCELLED'
                    ? 'bg-slate-700 text-white font-bold'
                    : repair.status === 'RE_PROBLEM'
                    ? 'bg-rose-600 text-white font-bold'
                    : repair.status === 'DISPATCHED_VIA_COURIER'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'bg-indigo-600 text-white font-bold'
                }
              >
                {repair.status?.replace(/_/g, ' ') || 'RECEIVED'}
              </Badge>

              {repair.priority === 'URGENT' && (
                <Badge className="bg-rose-600 text-white font-bold flex items-center gap-1 shadow-xs">
                  <Flame className="h-3 w-3" /> URGENT
                </Badge>
              )}
              {repair.priority === 'HIGH' && (
                <Badge className="bg-orange-500 text-white font-bold flex items-center gap-1 shadow-xs">
                  <AlertCircle className="h-3 w-3" /> HIGH
                </Badge>
              )}
              {repair.priority === 'MEDIUM' && (
                <Badge className="bg-amber-400 text-slate-950 font-bold flex items-center gap-1 shadow-xs">
                  <Clock className="h-3 w-3" /> MEDIUM
                </Badge>
              )}
              {(!repair.priority || repair.priority === 'NORMAL') && (
                <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-slate-300 dark:border-slate-700">
                  NORMAL
                </Badge>
              )}

              {isCourierDispatched && (
                <Badge className="bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-bold flex items-center gap-1">
                  <Truck className="h-3 w-3 text-blue-600 dark:text-blue-400" /> Courier Dispatched
                </Badge>
              )}
            </div>

            {/* Device Brand and Model (no aggressive truncation) */}
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 break-words leading-tight">
              {repair.deviceBrand} {repair.deviceModel}
            </h1>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto justify-start xl:justify-end shrink-0 pt-3 xl:pt-0 border-t xl:border-t-0 border-slate-100 dark:border-slate-800">
          {['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST', 'MANAGER'].includes(user?.role || '') && (
            <Button
              variant="outline"
              onClick={() => setIsCourierDispatchDialogOpen(true)}
              className={cn(
                "rounded-2xl font-bold text-xs h-10 px-3.5 shadow-xs shrink-0 cursor-pointer transition-all flex items-center gap-1.5",
                isCourierDispatched
                  ? "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-extrabold"
                  : "border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200"
              )}
            >
              <Truck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span>{isCourierDispatched ? 'Update Courier' : 'Dispatch Courier'}</span>
            </Button>
          )}

          {['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST'].includes(user?.role || '') && (
            <Button
              variant="outline"
              onClick={() => setIsEditModalOpen(true)}
              className="rounded-2xl border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs h-10 px-3.5 shadow-xs shrink-0 cursor-pointer flex items-center gap-1.5"
            >
              <Edit3 className="h-4 w-4 text-slate-700 dark:text-slate-300" />
              <span>Edit</span>
            </Button>
          )}

          {canSendSms && isRepairedOrReady && (
            <Button
              variant="outline"
              onClick={() => setIsSmsModalOpen(true)}
              className={`rounded-2xl font-bold text-xs h-10 px-3.5 shadow-xs shrink-0 cursor-pointer flex items-center gap-1.5 transition-all ${
                repair.smsSummary?.status === 'SENT'
                  ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/80 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300'
                  : 'border-teal-300 dark:border-teal-700 bg-teal-50/80 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900/60 text-teal-800 dark:text-teal-300'
              }`}
              title="Send SMS to Customer"
              aria-label="Send SMS to Customer"
            >
              <MessageSquare className={`h-4 w-4 ${repair.smsSummary?.status === 'SENT' ? 'text-emerald-600 dark:text-emerald-400' : 'text-teal-600 dark:text-teal-400'}`} />
              <span>{repair.smsSummary?.status === 'SENT' ? 'Send SMS Again' : 'Send SMS'}</span>
            </Button>
          )}

          <Button
            variant="outline"
            onClick={() => setIsSlipModalOpen(true)}
            className="rounded-2xl border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs h-10 px-3.5 shadow-xs shrink-0 cursor-pointer flex items-center gap-1.5"
          >
            <Printer className="h-4 w-4 text-slate-700 dark:text-slate-300" />
            <span>Slip</span>
          </Button>

          {['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST'].includes(user?.role || '') && repair.status !== 'CANCELLED' && (
            <Button
              variant="outline"
              onClick={() => setIsCancelDialogOpen(true)}
              className="rounded-2xl border-rose-200 dark:border-rose-800 bg-rose-50/60 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 font-bold text-xs h-10 px-3.5 shadow-xs shrink-0 cursor-pointer flex items-center gap-1.5 transition-all"
            >
              <Ban className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              <span>Cancel Device</span>
            </Button>
          )}

          {['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST'].includes(user?.role || '') && repair.status === 'CANCELLED' && (
            <Button
              variant="outline"
              onClick={() => setIsRestoreDialogOpen(true)}
              className="rounded-2xl border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold text-xs h-10 px-3.5 shadow-xs shrink-0 cursor-pointer flex items-center gap-1.5 transition-all"
            >
              <RotateCcw className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <span>Re-Open Repair</span>
            </Button>
          )}

          <DashboardRefreshButton
            onRefresh={fetchData}
            size="sm"
            label="Refresh"
            variant="outline"
            className="rounded-2xl h-10 border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 font-bold text-xs shrink-0"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 w-full">
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-6 sm:space-y-8 w-full min-w-0">
          {/* Diagnostics & Priority Card */}
          <Card className="rounded-[32px] sm:rounded-[40px] border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900 w-full">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-850/60 p-6 sm:p-8 border-b border-slate-100 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-2xl shadow-xs flex items-center justify-center text-slate-900 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700 shrink-0">
                    <Smartphone className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-xl sm:text-2xl font-bold truncate text-slate-900 dark:text-slate-100">
                      Repair Diagnostics
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Comprehensive device state & reported issues.
                    </CardDescription>
                  </div>
                </div>

                <Button
                  variant="outline"
                  onClick={() => setIsSlipModalOpen(true)}
                  className="rounded-2xl font-bold border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 h-10 px-4 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer shrink-0 text-xs shadow-xs text-slate-700 dark:text-slate-200"
                >
                  <Printer className="h-4 w-4 mr-2 text-slate-700 dark:text-slate-300" /> Print Service Slip
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-6 sm:p-8 space-y-8 w-full">
              {/* Device Spec Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-left">
                <div className="space-y-1 bg-slate-50/70 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Brand / Manufacturer</p>
                  <p className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100 truncate">{repair.deviceBrand}</p>
                </div>
                <div className="space-y-1 bg-slate-50/70 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Model Specification</p>
                  <p className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100 truncate">{repair.deviceModel}</p>
                </div>
                <div className="space-y-1 bg-slate-50/70 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">IMEI / Serial</p>
                    <p className="text-base sm:text-lg font-mono font-bold text-indigo-600 dark:text-indigo-400 truncate">
                      {repair.imeiNumber || 'N/A'}
                    </p>
                  </div>
                  {repair.imeiNumber && (
                    <button
                      onClick={() => copyToClipboard(repair.imeiNumber, 'IMEI')}
                      className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 mt-1 transition-colors"
                      title="Copy IMEI"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Problem Description */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-5 sm:p-6 rounded-[28px] border border-slate-200/70 dark:border-slate-800 space-y-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center shadow-xs shrink-0 border border-slate-100 dark:border-slate-700">
                    <FileText className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">Problem Description</h4>
                </div>
                <p className="text-slate-800 dark:text-slate-200 font-medium text-sm sm:text-base leading-relaxed break-words bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800">
                  "{repair.problemDescription || 'No diagnostic notes provided on intake.'}"
                </p>

                <div className="pt-1 flex flex-wrap gap-2">
                  <Badge variant="outline" className="bg-white dark:bg-slate-900 rounded-xl px-3 py-1.5 font-bold border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200">
                    <ShieldCheck className="h-3.5 w-3.5 mr-1 text-emerald-500" /> Condition: {repair.deviceCondition}
                  </Badge>
                  {repair.deviceColor && (
                    <Badge variant="outline" className="bg-white dark:bg-slate-900 rounded-xl px-3 py-1.5 font-bold border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200">
                      Color: {repair.deviceColor}
                    </Badge>
                  )}
                  {repair.accessoriesReceived && (
                    <Badge variant="outline" className="bg-white dark:bg-slate-900 rounded-xl px-3 py-1.5 font-bold border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200">
                      <Zap className="h-3.5 w-3.5 mr-1 text-amber-500" /> Includes: {repair.accessoriesReceived}
                    </Badge>
                  )}
                </div>
              </div>

              {/* ========================================================================= */}
              {/* 1. PROFESSIONAL REPAIR QUEUE PRIORITY SELECTOR (COMPACT & RESPONSIVE)    */}
              {/* ========================================================================= */}
              <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="space-y-0.5">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">
                      Repair Queue Priority
                    </h3>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                      Select triage priority to reorder queue position for technicians
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-xl text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    <span className="text-slate-400 dark:text-slate-500">Current:</span>
                    <span className="font-extrabold text-slate-900 dark:text-slate-100">
                      {repair.priority || 'NORMAL'}
                    </span>
                  </div>
                </div>

                {/* Priority Selector Grid: Responsive 4-col on desktop, 2x2 on mobile */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full">
                  {PRIORITY_OPTIONS.map((p) => {
                    const isCurrent = (repair.priority || 'NORMAL') === p.value;
                    return (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => updatePriority(p.value)}
                        disabled={updating}
                        className={cn(
                          'relative w-full rounded-2xl p-3 text-left transition-all duration-150 flex flex-col justify-between gap-2 border cursor-pointer select-none',
                          isCurrent
                            ? cn(p.activeBg, p.activeBorder)
                            : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200/90 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
                        )}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                'h-2 w-2 rounded-full shrink-0',
                                isCurrent ? (p.value === 'MEDIUM' ? 'bg-slate-950' : 'bg-white') : p.dotColor
                              )}
                            />
                            <span
                              className={cn(
                                'text-xs font-extrabold tracking-tight',
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
                              <Check className="h-2.5 w-2.5 stroke-[3]" />
                            </div>
                          )}
                        </div>

                        <div className="w-full">
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
              <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">
                  Update Operation Status
                </h3>
                <div className="flex flex-wrap gap-2">
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
                    ...(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST'].includes(user?.role || '') ? ['CANCELLED'] : [])
                  ].map((s) => {
                    const isCurrentStatus = repair.status === s;
                    return (
                      <Button
                        key={s}
                        onClick={() => updateStatus(s)}
                        disabled={updating || isCurrentStatus}
                        variant={isCurrentStatus ? 'default' : 'outline'}
                        className={cn(
                          'rounded-2xl font-bold h-10 px-3.5 text-xs transition-all cursor-pointer',
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
                        {s === 'RE_PROBLEM'
                          ? 'Re-Problem (Warranty)'
                          : s === 'DISPATCHED_VIA_COURIER'
                          ? 'Dispatched (Courier)'
                          : s.replace(/_/g, ' ')}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dedicated Courier Logistics Section (Visible if Courier Details Exist) */}
          {hasCourierActivity && (
            <Card className="rounded-[32px] sm:rounded-[40px] border-blue-200/80 dark:border-blue-900/60 shadow-sm overflow-hidden bg-white dark:bg-slate-900 w-full">
              <CardHeader className="bg-blue-50/60 dark:bg-blue-950/40 p-6 sm:p-8 border-b border-blue-100 dark:border-blue-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-xs shrink-0">
                    <Truck className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">Courier Logistics Details</CardTitle>
                    <CardDescription className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                      Active parcel consignment & shipment tracking data
                    </CardDescription>
                  </div>
                </div>

                <Button
                  variant="outline"
                  onClick={() => setIsCourierDispatchDialogOpen(true)}
                  className="rounded-2xl border-blue-300 dark:border-blue-800 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-bold text-xs h-10 px-4 shadow-xs shrink-0 flex items-center gap-1.5"
                >
                  <Truck className="h-4 w-4" />
                  <span>Update Courier Info</span>
                </Button>
              </CardHeader>

              <CardContent className="p-6 sm:p-8 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Outbound Courier Partner */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Return Courier Partner</p>
                    <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100 truncate">
                      {repair.returnCourierCompany || repair.courierCompany || 'Not Specified'}
                    </p>
                  </div>

                  {/* Tracking Number */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1 flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Tracking / AWB #</p>
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
                        className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 transition-colors"
                        title="Copy Tracking Number"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Shipment Status */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Logistics Status</p>
                    <Badge className="bg-blue-600 text-white text-[11px] font-bold">
                      {repair.courierOutStatus || repair.courierStatus || (isCourierDispatched ? 'DISPATCHED' : 'IN_LAB')}
                    </Badge>
                  </div>

                  {/* Destination */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Destination District</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                      {repair.destinationDistrict || repair.originDistrict || 'Kathmandu'}
                    </p>
                  </div>

                  {/* Receiver */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Receiver Contact</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                      {repair.receiverName || repair.customerName || 'Customer'}
                      {repair.receiverPhone ? ` (${repair.receiverPhone})` : ''}
                    </p>
                  </div>

                  {/* Dispatch Date */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Dispatched Date</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                      {repair.returnCourierDispatchDate
                        ? format(new Date(repair.returnCourierDispatchDate), 'dd MMM yyyy')
                        : repair.returnCourierDispatchedAt
                        ? format(new Date(repair.returnCourierDispatchedAt), 'dd MMM yyyy')
                        : '—'}
                    </p>
                  </div>
                </div>

                {/* Delivery Address & Notes */}
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

          {/* Notes Section */}
          <Card className="rounded-[32px] sm:rounded-[40px] border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900 w-full">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-850/60 p-6 sm:p-8 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center border border-blue-100 dark:border-blue-900/60 shrink-0">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">Communication & Technical Notes</CardTitle>
                  <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                    Real-time collaboration across roles and diagnostics history.
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
        </div>

        {/* Sidebar Column */}
        <div className="space-y-6 sm:space-y-8 w-full min-w-0">
          {/* Client Information */}
          <Card className="rounded-[32px] sm:rounded-[40px] border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900 w-full">
            <CardHeader className="bg-slate-950 text-white p-6 sm:p-8">
              <CardTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
                <User className="h-5 w-5 text-indigo-400" /> Client Information
              </CardTitle>
            </CardHeader>

            <CardContent className="p-6 sm:p-8 space-y-6">
              <div className="space-y-3.5 text-xs">
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest text-[10px]">Customer ID</span>
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-900/60 truncate">
                    {repair.customer?.customerId || repair.customerId || 'CUS-00101'}
                  </span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest text-[10px]">Client Name</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100 truncate">{repair.customerName}</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest text-[10px]">Phone Number</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100 truncate">{repair.customerPhone}</span>
                </div>
                {isRepairedOrReady && (
                  <div className="mt-2 p-3 rounded-2xl bg-teal-50/50 dark:bg-teal-950/30 border border-teal-200/80 dark:border-teal-800/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                        <span className="text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400 tracking-wider">SMS Notification</span>
                      </div>
                      {repair.smsSummary?.status === 'SENT' ? (
                        <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 font-bold text-[10px] py-0.5 px-2 gap-1 shadow-2xs">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          <span>SMS: Sent</span>
                        </Badge>
                      ) : repair.smsSummary?.status === 'INITIATED' ? (
                        <Badge variant="outline" className="bg-sky-50 dark:bg-sky-950/50 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-800 font-bold text-[10px] py-0.5 px-2 gap-1 shadow-2xs">
                          <Clock className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                          <span>SMS: Initiated</span>
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 font-bold text-[10px] py-0.5 px-2 shadow-2xs">
                          SMS: Not Sent
                        </Badge>
                      )}
                    </div>

                    <div className="text-xs text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      <span>Messages Sent:</span>
                      <strong className="text-slate-900 dark:text-slate-100 font-bold">{repair.smsSummary?.count || 0}</strong>
                    </div>

                    {repair.smsSummary?.lastSentAt && (
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                        Last: {format(new Date(repair.smsSummary.lastSentAt), 'dd MMM yyyy, h:mm a')}
                      </div>
                    )}

                    {canSendSms && (
                      <div className="pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsSmsModalOpen(true)}
                          className={`w-full rounded-xl font-bold text-xs h-8 px-2.5 flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer ${
                            repair.smsSummary?.status === 'SENT'
                              ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300'
                              : 'border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/40 hover:bg-teal-100 dark:hover:bg-teal-900/50 text-teal-800 dark:text-teal-300'
                          }`}
                          title="Send Customer SMS (Google Messages for Web)"
                          aria-label="Send Customer SMS"
                        >
                          <MessageSquare className={`h-3.5 w-3.5 ${repair.smsSummary?.status === 'SENT' ? 'text-emerald-600 dark:text-emerald-400' : 'text-teal-600 dark:text-teal-400'}`} />
                          <span>{repair.smsSummary?.status === 'SENT' ? 'Send SMS Again' : 'Send Customer SMS'}</span>
                        </Button>
                      </div>
                    )}
                  </div>
                )}
                {repair.customerEmail && (
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest text-[10px]">Email</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300 truncate">{repair.customerEmail}</span>
                  </div>
                )}
                {repair.customerAddress && (
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest text-[10px]">Address</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300 truncate">{repair.customerAddress}</span>
                  </div>
                )}
              </div>

              <Separator className="dark:bg-slate-800" />

              {/* Billing Snapshot */}
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Billing Snapshot
                </h4>
                <div className="space-y-2.5 text-xs sm:text-sm">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-500 dark:text-slate-400">Total Estimation</span>
                    <span className="font-black font-mono text-slate-900 dark:text-slate-100">
                      {repair.estimatedCost != null ? formatNPR(repair.estimatedCost) : 'Unspecified'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-500 dark:text-slate-400">Advance Paid</span>
                    <span className="font-black font-mono text-emerald-600 dark:text-emerald-400">
                      {formatNPR(repair.advancePaid || 0)}
                    </span>
                  </div>
                  <Separator className="my-1 dark:bg-slate-800" />
                  <div className="flex justify-between items-center text-base sm:text-lg">
                    <span className="font-black text-slate-900 dark:text-slate-100">Balance Due</span>
                    <span className="font-black font-mono text-rose-600 dark:text-rose-400">
                      {repair.estimatedCost != null
                        ? formatNPR(Math.max(0, repair.estimatedCost - (repair.advancePaid || 0)))
                        : '—'}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Specialist Assignment */}
          <Card className="rounded-[32px] sm:rounded-[40px] border-indigo-100 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900 w-full">
            <CardHeader className="p-6 sm:p-8">
              <CardTitle className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Zap className="h-5 w-5 text-indigo-600 dark:text-indigo-400" /> Specialist Assignment
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                Assign or transfer diagnostic case.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 sm:p-8 pt-0 space-y-4">
              <Select
                value={repair.technicianId || ''}
                onValueChange={handleAssignmentChange}
                disabled={updating}
              >
                <SelectTrigger className="h-12 rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100">
                  <SelectValue placeholder="Manual Assignment" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                  {technicians.map((t) => (
                    <SelectItem key={t.id} value={t.id} className="rounded-xl font-bold text-xs py-2.5">
                      {t.name} ({t.role?.replace(/_/g, ' ') || 'STAFF'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {repair.technician && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-3.5 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-indigo-100 dark:border-slate-800">
                    <div className="w-10 h-10 bg-indigo-600 dark:bg-indigo-500 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-xs shrink-0">
                      {repair.technician.name?.charAt(0) || 'T'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-900 dark:text-slate-100 text-xs truncate">{repair.technician.name}</p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Active Specialist</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

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
              Job #{repair.repairNumber} — {repair.deviceBrand} {repair.deviceModel} ({repair.customerName || 'Customer'})
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
            fetchData();
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
            fetchData();
          }}
        />
      )}

      {/* Send Customer SMS Modal (Google Messages for Web) */}
      {repair && (
        <SendSmsModal
          open={isSmsModalOpen}
          onOpenChange={setIsSmsModalOpen}
          repair={repair}
          onSuccess={() => {
            fetchData();
          }}
        />
      )}
    </div>
  );
}
