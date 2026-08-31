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
  Copy
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
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

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

  // Service Slip Modal
  const [isSlipModalOpen, setIsSlipModalOpen] = useState(false);

  // Edit Repair Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Courier Update / Dispatch Modal
  const [isCourierDispatchDialogOpen, setIsCourierDispatchDialogOpen] = useState(false);

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

  const updateStatus = async (status: string) => {
    if (status === 'RE_PROBLEM') {
      setIsReopenDialogOpen(true);
      return;
    }
    setUpdating(true);
    try {
      const updated = await api.patch(`/repairs/${id}`, { status });
      await syncRepairToRtdb(updated);
      setRepair(updated);
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
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-4 sm:p-6 rounded-3xl border border-slate-200/80 shadow-sm w-full">
        <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1 w-full xl:w-auto">
          <Button
            variant="outline"
            onClick={() => navigate('/dashboard/repairs')}
            className="rounded-2xl border-slate-200 h-10 w-10 p-0 flex items-center justify-center shrink-0 cursor-pointer hover:bg-slate-100 mt-1 sm:mt-0"
            title="Back to repairs"
          >
            <ChevronLeft className="h-5 w-5 text-slate-700" />
          </Button>

          <div className="space-y-1.5 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="secondary"
                className="font-mono text-xs font-black uppercase tracking-tight bg-slate-900 text-white px-2.5 py-1 rounded-xl shadow-xs"
              >
                JOB #{repair.repairNumber}
              </Badge>

              <Badge
                className={
                  repair.status === 'COMPLETED' || repair.status === 'REPAIRED' || repair.status === 'DELIVERED'
                    ? 'bg-emerald-600 text-white font-bold'
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
                <Badge variant="outline" className="bg-slate-100 text-slate-700 font-bold border-slate-300">
                  NORMAL
                </Badge>
              )}

              {isCourierDispatched && (
                <Badge className="bg-blue-50 text-blue-700 border border-blue-200 font-bold flex items-center gap-1">
                  <Truck className="h-3 w-3 text-blue-600" /> Courier Dispatched
                </Badge>
              )}
            </div>

            {/* Device Brand and Model (no aggressive truncation) */}
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 break-words leading-tight">
              {repair.deviceBrand} {repair.deviceModel}
            </h1>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto justify-start xl:justify-end shrink-0 pt-3 xl:pt-0 border-t xl:border-t-0 border-slate-100">
          {['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST', 'MANAGER'].includes(user?.role || '') && (
            <Button
              variant="outline"
              onClick={() => setIsCourierDispatchDialogOpen(true)}
              className={cn(
                "rounded-2xl font-bold text-xs h-10 px-3.5 shadow-xs shrink-0 cursor-pointer transition-all flex items-center gap-1.5",
                isCourierDispatched
                  ? "border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-700 font-extrabold"
                  : "border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-800"
              )}
            >
              <Truck className="h-4 w-4 text-blue-600" />
              <span>{isCourierDispatched ? 'Update Courier' : 'Dispatch Courier'}</span>
            </Button>
          )}

          {['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST'].includes(user?.role || '') && (
            <Button
              variant="outline"
              onClick={() => setIsEditModalOpen(true)}
              className="rounded-2xl border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs h-10 px-3.5 shadow-xs shrink-0 cursor-pointer flex items-center gap-1.5"
            >
              <Edit3 className="h-4 w-4 text-slate-700" />
              <span>Edit</span>
            </Button>
          )}

          <Button
            variant="outline"
            onClick={() => setIsSlipModalOpen(true)}
            className="rounded-2xl border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs h-10 px-3.5 shadow-xs shrink-0 cursor-pointer flex items-center gap-1.5"
          >
            <Printer className="h-4 w-4 text-slate-700" />
            <span>Slip</span>
          </Button>

          <DashboardRefreshButton
            onRefresh={fetchData}
            size="sm"
            label="Refresh"
            variant="outline"
            className="rounded-2xl h-10 border-slate-200 font-bold text-xs shrink-0"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 w-full">
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-6 sm:space-y-8 w-full min-w-0">
          {/* Diagnostics & Priority Card */}
          <Card className="rounded-[32px] sm:rounded-[40px] border-slate-200 shadow-sm overflow-hidden bg-white w-full">
            <CardHeader className="bg-slate-50/50 p-6 sm:p-8 border-b border-slate-100">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-12 h-12 bg-white rounded-2xl shadow-xs flex items-center justify-center text-slate-900 border border-slate-200/80 shrink-0">
                    <Smartphone className="h-6 w-6 text-indigo-600" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-xl sm:text-2xl font-bold truncate text-slate-900">
                      Repair Diagnostics
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 font-medium">
                      Comprehensive device state & reported issues.
                    </CardDescription>
                  </div>
                </div>

                <Button
                  variant="outline"
                  onClick={() => setIsSlipModalOpen(true)}
                  className="rounded-2xl font-bold border-slate-200 h-10 px-4 hover:bg-slate-50 cursor-pointer shrink-0 text-xs shadow-xs"
                >
                  <Printer className="h-4 w-4 mr-2 text-slate-700" /> Print Service Slip
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-6 sm:p-8 space-y-8 w-full">
              {/* Device Spec Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-left">
                <div className="space-y-1 bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Brand / Manufacturer</p>
                  <p className="text-base sm:text-lg font-extrabold text-slate-900 truncate">{repair.deviceBrand}</p>
                </div>
                <div className="space-y-1 bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Model Specification</p>
                  <p className="text-base sm:text-lg font-extrabold text-slate-900 truncate">{repair.deviceModel}</p>
                </div>
                <div className="space-y-1 bg-slate-50/70 p-4 rounded-2xl border border-slate-100 flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">IMEI / Serial</p>
                    <p className="text-base sm:text-lg font-mono font-bold text-indigo-600 truncate">
                      {repair.imeiNumber || 'N/A'}
                    </p>
                  </div>
                  {repair.imeiNumber && (
                    <button
                      onClick={() => copyToClipboard(repair.imeiNumber, 'IMEI')}
                      className="text-slate-400 hover:text-slate-700 p-1 mt-1 transition-colors"
                      title="Copy IMEI"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Problem Description */}
              <div className="bg-slate-50 p-5 sm:p-6 rounded-[28px] border border-slate-200/70 space-y-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 bg-white rounded-xl flex items-center justify-center shadow-xs shrink-0 border border-slate-100">
                    <FileText className="h-4 w-4 text-indigo-600" />
                  </div>
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700">Problem Description</h4>
                </div>
                <p className="text-slate-800 font-medium text-sm sm:text-base leading-relaxed break-words bg-white p-4 rounded-2xl border border-slate-200/50">
                  "{repair.problemDescription || 'No diagnostic notes provided on intake.'}"
                </p>

                <div className="pt-1 flex flex-wrap gap-2">
                  <Badge variant="outline" className="bg-white rounded-xl px-3 py-1.5 font-bold border-slate-200 text-xs">
                    <ShieldCheck className="h-3.5 w-3.5 mr-1 text-emerald-500" /> Condition: {repair.deviceCondition}
                  </Badge>
                  {repair.deviceColor && (
                    <Badge variant="outline" className="bg-white rounded-xl px-3 py-1.5 font-bold border-slate-200 text-xs text-slate-800">
                      Color: {repair.deviceColor}
                    </Badge>
                  )}
                  {repair.accessoriesReceived && (
                    <Badge variant="outline" className="bg-white rounded-xl px-3 py-1.5 font-bold border-slate-200 text-xs">
                      <Zap className="h-3.5 w-3.5 mr-1 text-amber-500" /> Includes: {repair.accessoriesReceived}
                    </Badge>
                  )}
                </div>
              </div>

              {/* ========================================================================= */}
              {/* 1. PROFESSIONAL REPAIR QUEUE PRIORITY SELECTOR (COMPACT & RESPONSIVE)    */}
              {/* ========================================================================= */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="space-y-0.5">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-600">
                      Repair Queue Priority
                    </h3>
                    <p className="text-[11px] text-slate-400 font-medium">
                      Select triage priority to reorder queue position for technicians
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-xl text-[11px] font-bold text-slate-700">
                    <span className="text-slate-400">Current:</span>
                    <span className="font-extrabold text-slate-900">
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
                            : 'bg-white hover:bg-slate-50 border-slate-200/90 text-slate-800 hover:border-slate-300'
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
                                  : 'text-slate-900'
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
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-600">
                  Update Operation Status
                </h3>
                <div className="flex flex-wrap gap-2">
                  {[
                    'DIAGNOSING',
                    'IN_PROCESS',
                    'WAITING_FOR_PARTS',
                    'TESTING',
                    'REPAIRED',
                    'READY_FOR_PICKUP',
                    'DISPATCHED_VIA_COURIER',
                    'DELIVERED',
                    'RE_PROBLEM',
                    'CANNOT_REPAIR'
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
                              : s === 'DISPATCHED_VIA_COURIER'
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'bg-indigo-600 text-white shadow-sm'
                            : s === 'RE_PROBLEM'
                            ? 'border-rose-200 text-rose-700 hover:bg-rose-50'
                            : s === 'DISPATCHED_VIA_COURIER'
                            ? 'border-blue-200 text-blue-700 hover:bg-blue-50'
                            : 'border-slate-200 hover:bg-slate-50 text-slate-700'
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
            <Card className="rounded-[32px] sm:rounded-[40px] border-blue-200/80 shadow-sm overflow-hidden bg-white w-full">
              <CardHeader className="bg-blue-50/60 p-6 sm:p-8 border-b border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-xs shrink-0">
                    <Truck className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold text-slate-900">Courier Logistics Details</CardTitle>
                    <CardDescription className="text-xs text-blue-700 font-medium">
                      Active parcel consignment & shipment tracking data
                    </CardDescription>
                  </div>
                </div>

                <Button
                  variant="outline"
                  onClick={() => setIsCourierDispatchDialogOpen(true)}
                  className="rounded-2xl border-blue-300 bg-white hover:bg-blue-50 text-blue-700 font-bold text-xs h-10 px-4 shadow-xs shrink-0 flex items-center gap-1.5"
                >
                  <Truck className="h-4 w-4" />
                  <span>Update Courier Info</span>
                </Button>
              </CardHeader>

              <CardContent className="p-6 sm:p-8 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Outbound Courier Partner */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Return Courier Partner</p>
                    <p className="text-sm font-extrabold text-slate-900 truncate">
                      {repair.returnCourierCompany || repair.courierCompany || 'Not Specified'}
                    </p>
                  </div>

                  {/* Tracking Number */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1 flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Tracking / AWB #</p>
                      <p className="text-sm font-mono font-black text-blue-600 truncate">
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
                        className="text-slate-400 hover:text-slate-700 p-1 transition-colors"
                        title="Copy Tracking Number"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Shipment Status */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Logistics Status</p>
                    <Badge className="bg-blue-600 text-white text-[11px] font-bold">
                      {repair.courierOutStatus || repair.courierStatus || (isCourierDispatched ? 'DISPATCHED' : 'IN_LAB')}
                    </Badge>
                  </div>

                  {/* Destination */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Destination District</p>
                    <p className="text-sm font-bold text-slate-900 truncate">
                      {repair.destinationDistrict || repair.originDistrict || 'Kathmandu'}
                    </p>
                  </div>

                  {/* Receiver */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Receiver Contact</p>
                    <p className="text-sm font-bold text-slate-900 truncate">
                      {repair.receiverName || repair.customerName || 'Customer'}
                      {repair.receiverPhone ? ` (${repair.receiverPhone})` : ''}
                    </p>
                  </div>

                  {/* Dispatch Date */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Dispatched Date</p>
                    <p className="text-sm font-bold text-slate-900 truncate">
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
                  <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/60 space-y-2 text-xs">
                    {repair.destinationAddress && (
                      <div>
                        <span className="font-bold text-slate-500">Delivery Address: </span>
                        <span className="text-slate-800 font-medium">{repair.destinationAddress}</span>
                      </div>
                    )}
                    {repair.returnCourierNotes && (
                      <div>
                        <span className="font-bold text-slate-500">Logistics Notes: </span>
                        <span className="text-slate-800 font-medium italic">"{repair.returnCourierNotes}"</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Notes Section */}
          <Card className="rounded-[32px] sm:rounded-[40px] border-slate-200 shadow-sm overflow-hidden bg-white w-full">
            <CardHeader className="bg-slate-50/50 p-6 sm:p-8 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center border border-blue-100 shrink-0">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-slate-900">Communication & Technical Notes</CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Real-time collaboration across roles and diagnostics history.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6 sm:p-8 space-y-6">
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {notes.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    No communication notes recorded yet.
                  </div>
                ) : (
                  notes.map((n) => (
                    <div
                      key={n.id}
                      className="p-4 rounded-2xl text-xs space-y-1.5 border bg-slate-50 border-slate-100 text-slate-900 break-words"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-extrabold text-[11px] flex items-center gap-1.5">
                          <span>{n.authorName || n.technician?.name || 'Staff Member'}</span>
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 rounded-md font-bold uppercase">
                            {n.authorRole || n.technician?.role || 'STAFF'}
                          </Badge>
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {n.createdAt ? format(new Date(n.createdAt), 'dd MMM yyyy, hh:mm a') : ''}
                        </span>
                      </div>
                      <p className="text-xs font-medium leading-relaxed">{n.note}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <Textarea
                  placeholder="Post internal instruction or diagnostic note..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="rounded-2xl border-slate-200 text-xs font-medium min-h-[70px] bg-slate-50/60 focus:bg-white"
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
          <Card className="rounded-[32px] sm:rounded-[40px] border-slate-200 shadow-sm overflow-hidden bg-white w-full">
            <CardHeader className="bg-slate-950 text-white p-6 sm:p-8">
              <CardTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
                <User className="h-5 w-5 text-indigo-400" /> Client Information
              </CardTitle>
            </CardHeader>

            <CardContent className="p-6 sm:p-8 space-y-6">
              <div className="space-y-3.5 text-xs">
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Customer ID</span>
                  <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 truncate">
                    {repair.customer?.customerId || repair.customerId || 'CUS-00101'}
                  </span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Client Name</span>
                  <span className="font-bold text-slate-900 truncate">{repair.customerName}</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Phone Number</span>
                  <span className="font-mono font-bold text-slate-900 truncate">{repair.customerPhone}</span>
                </div>
                {repair.customerEmail && (
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Email</span>
                    <span className="font-medium text-slate-700 truncate">{repair.customerEmail}</span>
                  </div>
                )}
                {repair.customerAddress && (
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Address</span>
                    <span className="font-medium text-slate-700 truncate">{repair.customerAddress}</span>
                  </div>
                )}
              </div>

              <Separator />

              {/* Billing Snapshot */}
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-emerald-600" /> Billing Snapshot
                </h4>
                <div className="space-y-2.5 text-xs sm:text-sm">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-500">Total Estimation</span>
                    <span className="font-black font-mono text-slate-900">
                      {repair.estimatedCost != null ? formatNPR(repair.estimatedCost) : 'Unspecified'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-500">Advance Paid</span>
                    <span className="font-black font-mono text-emerald-600">
                      {formatNPR(repair.advancePaid || 0)}
                    </span>
                  </div>
                  <Separator className="my-1" />
                  <div className="flex justify-between items-center text-base sm:text-lg">
                    <span className="font-black text-slate-900">Balance Due</span>
                    <span className="font-black font-mono text-rose-600">
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
          <Card className="rounded-[32px] sm:rounded-[40px] border-indigo-100 shadow-sm overflow-hidden bg-white w-full">
            <CardHeader className="p-6 sm:p-8">
              <CardTitle className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
                <Zap className="h-5 w-5 text-indigo-600" /> Specialist Assignment
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Assign or transfer diagnostic case.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 sm:p-8 pt-0 space-y-4">
              <Select
                value={repair.technicianId || ''}
                onValueChange={handleAssignmentChange}
                disabled={updating}
              >
                <SelectTrigger className="h-12 rounded-2xl border-slate-200 bg-white shadow-xs font-bold text-xs sm:text-sm">
                  <SelectValue placeholder="Manual Assignment" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {technicians.map((t) => (
                    <SelectItem key={t.id} value={t.id} className="rounded-xl font-bold text-xs py-2.5">
                      {t.name} ({t.role?.replace(/_/g, ' ') || 'STAFF'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {repair.technician && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-3.5 p-3.5 bg-slate-50 rounded-2xl border border-indigo-100">
                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-xs shrink-0">
                      {repair.technician.name?.charAt(0) || 'T'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-900 text-xs truncate">{repair.technician.name}</p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Active Specialist</p>
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
        <DialogContent className="max-w-md rounded-3xl p-6 border border-slate-200 shadow-2xl bg-white space-y-4">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900">Reopen Warranty Claim</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Mark this repair as Re-Problem and provide details of customer claim.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Specify reason for reopening under warranty..."
            value={reopenRemark}
            onChange={(e) => setReopenRemark(e.target.value)}
            className="rounded-2xl border-slate-200 text-xs"
          />
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setIsReopenDialogOpen(false)}
              className="rounded-xl font-bold text-xs"
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
    </div>
  );
}
