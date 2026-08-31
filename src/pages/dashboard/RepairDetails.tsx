import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Smartphone,
  User,
  Calendar,
  Clock,
  MapPin,
  Wrench,
  FileText,
  ShieldCheck,
  ChevronLeft,
  ArrowRight,
  Loader2,
  Banknote,
  CircleCheck as CheckCircle2,
  Zap,
  Printer,
  AlertCircle,
  RotateCcw,
  Bell,
  ArrowRightLeft,
  MessageSquare,
  Send,
  Flame,
  Check,
  Package,
  Truck,
  Edit3,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { formatNPR } from '@/lib/format';
import { motion } from 'motion/react';
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
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

  // Alert Tech Dialog States
  const [isAlertDialogOpen, setIsAlertDialogOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertPriority, setAlertPriority] = useState<'NORMAL' | 'MEDIUM' | 'HIGH' | 'URGENT'>('NORMAL');
  const [sendingAlert, setSendingAlert] = useState(false);

  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [sendingTransfer, setSendingTransfer] = useState(false);

  // Service Slip Modal
  const [isSlipModalOpen, setIsSlipModalOpen] = useState(false);

  // Edit Repair Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Courier Dispatch Modal State
  const [isCourierDispatchDialogOpen, setIsCourierDispatchDialogOpen] = useState(false);
  const [courierDispatchForm, setCourierDispatchForm] = useState<any>({
    returnCourierCompany: 'Nepal Can Move (NCM)',
    customCourierCompany: '',
    returnCourierTrackingNumber: '',
    returnCourierDispatchDate: format(new Date(), 'yyyy-MM-dd'),
    destinationDistrict: 'Kathmandu',
    destinationAddress: '',
    receiverName: '',
    receiverPhone: '',
    returnCourierNotes: ''
  });
  const [sendingCourierDispatch, setSendingCourierDispatch] = useState(false);

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
      setTechnicians(Array.isArray(staffData) ? staffData.filter((s: any) => ['TECHNICIAN', 'LEAD_TECHNICIAN'].includes(s.role) && s.isActive !== false) : []);
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

  useRealtimeSync(['repair', 'technicianNote', 'repairLog', 'notification', 'repairTransfer', 'payment', 'user', 'sync'], (event) => {
    if (
      !event.id ||
      event.id === id ||
      event.data?.id === id ||
      event.data?.repairId === id ||
      ['user', 'payment', 'technicianNote', 'repairLog', 'repair', 'sync', 'notification', 'repairTransfer'].includes(event.entity)
    ) {
      fetchData();
    }
  });

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

  const handleSendAlert = async () => {
    if (!alertMessage.trim() || sendingAlert) return;
    setSendingAlert(true);
    try {
      const res = await api.post(`/repairs/${id}/alert`, {
        message: alertMessage.trim(),
        priority: alertPriority,
        isUrgent: alertPriority === 'URGENT'
      });

      const updatedRepair = res?.repair || res;
      if (updatedRepair) {
        setRepair(updatedRepair);
        await syncRepairToRtdb(updatedRepair);
      }

      toast.success(`Priority alert (${alertPriority}) dispatched successfully!`);
      setIsAlertDialogOpen(false);
      setAlertMessage('');
      setAlertPriority('NORMAL');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to send repair alert");
    } finally {
      setSendingAlert(false);
    }
  };

  const handleSendTransfer = async () => {
    if (!transferTargetId || !transferReason.trim() || sendingTransfer) return;
    setSendingTransfer(true);
    try {
      const isManagerOrAdmin = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(user?.role || '');
      if (isManagerOrAdmin) {
        await api.post(`/repairs/${id}/transfer`, {
          targetTechnicianId: transferTargetId,
          reason: transferReason.trim()
        });
        toast.success("Repair transferred to specialist successfully");
      } else {
        await api.post(`/repairs/${id}/transfer-request`, {
          targetTechnicianId: transferTargetId,
          reason: transferReason.trim()
        });
        toast.success("Transfer request dispatched to specialist");
      }
      setIsTransferDialogOpen(false);
      setTransferTargetId('');
      setTransferReason('');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit transfer");
    } finally {
      setSendingTransfer(false);
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
      toast.success("Communication note recorded");
      setNewNote('');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to add note");
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleOpenCourierDispatch = () => {
    setCourierDispatchForm({
      returnCourierCompany: repair?.returnCourierCompany || repair?.courierCompany || 'Sundar Courier',
      customCourierCompany: '',
      returnCourierTrackingNumber: repair?.returnCourierTrackingNumber || '',
      returnCourierDispatchDate: format(new Date(), 'yyyy-MM-dd'),
      destinationDistrict: repair?.destinationDistrict || repair?.originDistrict || repair?.customer?.district || 'Kathmandu',
      destinationAddress: repair?.destinationAddress || repair?.originAddress || repair?.customerAddress || '',
      receiverName: repair?.receiverName || repair?.senderName || repair?.customerName || '',
      receiverPhone: repair?.receiverPhone || repair?.senderPhone || repair?.customerPhone || '',
      returnCourierNotes: repair?.returnCourierNotes || ''
    });
    setIsCourierDispatchDialogOpen(true);
  };

  const handleSaveCourierDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const company = courierDispatchForm.returnCourierCompany === 'Other Courier'
      ? courierDispatchForm.customCourierCompany
      : courierDispatchForm.returnCourierCompany;

    if (!company?.trim()) {
      toast.error('Courier Company is required');
      return;
    }
    if (!courierDispatchForm.returnCourierTrackingNumber?.trim()) {
      toast.error('Consignment / Tracking Number is required');
      return;
    }

    setSendingCourierDispatch(true);
    try {
      const res = await api.post(`/repairs/${id}/courier-dispatch`, {
        returnCourierCompany: company.trim(),
        returnCourierTrackingNumber: courierDispatchForm.returnCourierTrackingNumber.trim(),
        returnCourierDispatchDate: courierDispatchForm.returnCourierDispatchDate,
        destinationDistrict: courierDispatchForm.destinationDistrict.trim(),
        destinationAddress: courierDispatchForm.destinationAddress.trim(),
        receiverName: courierDispatchForm.receiverName.trim(),
        receiverPhone: courierDispatchForm.receiverPhone.trim(),
        returnCourierNotes: courierDispatchForm.returnCourierNotes.trim()
      });
      const updated = res.repair || res;
      await syncRepairToRtdb(updated);
      toast.success(`Repaired device dispatched via ${company}`);
      setRepair(updated);
      setIsCourierDispatchDialogOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to dispatch courier return');
    } finally {
      setSendingCourierDispatch(false);
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
      toast.success(`Status updated successfully`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Unable to save the repair status.');
    } finally {
      setUpdating(false);
    }
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

  return (
    <div className="space-y-6 sm:space-y-8 pb-32 max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 w-full overflow-x-hidden">

      {/* Top Header Toolbar */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-4 sm:p-6 rounded-3xl border border-slate-200/80 shadow-sm w-full">
        <div className="flex items-center gap-3 min-w-0 flex-1 w-full xl:w-auto">
          <Button
            variant="outline"
            onClick={() => navigate('/dashboard/repairs')}
            className="rounded-2xl border-slate-200 h-10 w-10 p-0 flex items-center justify-center shrink-0 cursor-pointer hover:bg-slate-100"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="font-mono text-xs font-black uppercase tracking-tight bg-slate-900 text-white px-2.5 py-1 rounded-xl">
                JOB #{repair.repairNumber}
              </Badge>
              <Badge className={repair.status === 'COMPLETED' || repair.status === 'REPAIRED' ? "bg-emerald-600 text-white font-bold" : "bg-indigo-600 text-white font-bold"}>
                {repair.status?.replace(/_/g, ' ') || 'RECEIVED'}
              </Badge>
              {repair.priority === 'URGENT' && (
                <Badge className="bg-rose-600 text-white font-bold animate-pulse">URGENT</Badge>
              )}
              {repair.priority === 'HIGH' && (
                <Badge className="bg-amber-500 text-white font-bold">HIGH</Badge>
              )}
              {repair.priority === 'MEDIUM' && (
                <Badge className="bg-yellow-500 text-slate-950 font-bold">MEDIUM</Badge>
              )}
              {(!repair.priority || repair.priority === 'NORMAL') && (
                <Badge variant="outline" className="bg-slate-100 text-slate-700 font-bold border-slate-300">
                  NORMAL
                </Badge>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 truncate">
              {repair.deviceBrand} {repair.deviceModel}
            </h2>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto justify-start xl:justify-end shrink-0 pt-2 xl:pt-0 border-t xl:border-t-0 border-slate-100">

          {['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST'].includes(user?.role || '') && (
            <Button
              variant="outline"
              onClick={handleOpenCourierDispatch}
              className="rounded-2xl border-blue-200 bg-blue-50/60 hover:bg-blue-100 text-blue-700 font-bold text-xs h-10 px-3 shadow-xs shrink-0 cursor-pointer"
            >
              <Package className="h-4 w-4 mr-1 text-blue-600" />
              <span>{repair.isReturnCourierDispatched ? 'Update Courier' : 'Dispatch Courier'}</span>
            </Button>
          )}

          {isAssigned && ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'LEAD_TECHNICIAN'].includes(user?.role || '') && (
            <Button
              variant="outline"
              onClick={() => setIsAlertDialogOpen(true)}
              className="rounded-2xl border-rose-200 bg-rose-50/50 hover:bg-rose-100 text-rose-700 font-bold text-xs h-10 px-3 shadow-xs shrink-0 cursor-pointer"
            >
              <Bell className="h-4 w-4 mr-1 text-rose-600 animate-bounce" />
              <span>Alert Tech</span>
            </Button>
          )}

          {['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST'].includes(user?.role || '') && (
            <Button
              variant="outline"
              onClick={() => setIsEditModalOpen(true)}
              className="rounded-2xl border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs h-10 px-3 shadow-xs shrink-0 cursor-pointer"
            >
              <Edit3 className="h-4 w-4 mr-1 text-blue-600" />
              <span>Edit</span>
            </Button>
          )}

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
        <div className="lg:col-span-2 space-y-6 sm:space-y-8 w-full min-w-0">

          {/* Diagnostics Card */}
          <Card className="rounded-[32px] sm:rounded-[40px] border-slate-200 shadow-sm overflow-hidden bg-white w-full">
            <CardHeader className="bg-slate-50/50 p-6 sm:p-8 border-b">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-slate-900 border border-slate-100 shrink-0">
                    <Smartphone className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-xl sm:text-2xl font-bold truncate">Repair Diagnostics</CardTitle>
                    <CardDescription className="text-xs">Comprehensive device state & reported issues.</CardDescription>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setIsSlipModalOpen(true)}
                  className="rounded-2xl font-bold border-slate-200 h-10 px-4 hover:bg-slate-50 cursor-pointer shrink-0 text-xs"
                >
                  <Printer className="h-4 w-4 mr-2 text-slate-700" /> Print Service Slip
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-6 sm:p-10 space-y-8 w-full">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
                <div className="space-y-1 bg-slate-50/60 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Brand / Manufacturer</p>
                  <p className="text-lg font-extrabold text-slate-900 truncate">{repair.deviceBrand}</p>
                </div>
                <div className="space-y-1 bg-slate-50/60 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Model Specification</p>
                  <p className="text-lg font-extrabold text-slate-900 truncate">{repair.deviceModel}</p>
                </div>
                <div className="space-y-1 bg-slate-50/60 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">IMEI / Serial</p>
                  <p className="text-lg font-mono font-bold text-indigo-600 truncate">{repair.imeiNumber || 'N/A'}</p>
                </div>
              </div>

              <div className="bg-slate-50 p-6 rounded-[28px] border border-slate-200/60 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center shadow-xs shrink-0">
                    <FileText className="h-4 w-4 text-indigo-600" />
                  </div>
                  <h4 className="font-bold text-sm sm:text-base text-slate-900">Problem Description</h4>
                </div>
                <p className="text-slate-700 font-medium text-sm sm:text-base leading-relaxed italic break-words">
                  "{repair.problemDescription}"
                </p>

                <div className="pt-2 flex flex-wrap gap-2">
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

              {/* Status Flow Buttons */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Update Operation Status</h4>
                <div className="flex flex-wrap gap-2">
                  {[
                    'DIAGNOSING',
                    'IN_PROCESS',
                    'WAITING_FOR_PARTS',
                    'TESTING',
                    'REPAIRED',
                    'READY_FOR_PICKUP',
                    'DELIVERED',
                    'RE_PROBLEM',
                    'CANNOT_REPAIR'
                  ].map((s) => (
                    <Button
                      key={s}
                      onClick={() => updateStatus(s)}
                      disabled={updating || repair.status === s}
                      variant={repair.status === s ? "default" : "outline"}
                      className={`rounded-2xl font-bold h-10 px-4 text-xs ${repair.status === s
                        ? s === 'RE_PROBLEM' ? 'bg-rose-600 text-white shadow-md' : 'bg-indigo-600 shadow-md text-white'
                        : s === 'RE_PROBLEM' ? 'border-rose-200 text-rose-700 hover:bg-rose-50' : 'border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                      {s === 'RE_PROBLEM' ? 'Re-Problem' : s.replace(/_/g, ' ')}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes Section */}
          <Card className="rounded-[32px] sm:rounded-[40px] border-slate-200 shadow-sm overflow-hidden bg-white w-full">
            <CardHeader className="bg-slate-50/50 p-6 sm:p-8 border-b">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center border border-blue-100 shrink-0">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold">Communication & Technical Notes</CardTitle>
                  <CardDescription className="text-xs">Real-time collaboration across roles.</CardDescription>
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
                    <div key={n.id} className="p-4 rounded-2xl text-xs space-y-1.5 border bg-slate-50 border-slate-100 text-slate-900 break-words">
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
                  onChange={e => setNewNote(e.target.value)}
                  className="rounded-2xl border-slate-200 text-xs font-medium min-h-[70px]"
                />
                <div className="flex items-center justify-end">
                  <Button
                    size="sm"
                    disabled={submittingNote || !newNote.trim()}
                    onClick={handleAddNote}
                    className="rounded-xl h-9 px-5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm cursor-pointer"
                  >
                    {submittingNote ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
                    Add Note
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6 sm:space-y-8 w-full min-w-0">

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
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                  <Banknote className="h-4 w-4" /> Billing Snapshot
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
                    <span className="font-black font-mono text-emerald-600">{formatNPR(repair.advancePaid || 0)}</span>
                  </div>
                  <Separator className="my-1" />
                  <div className="flex justify-between items-center text-base sm:text-lg">
                    <span className="font-black text-slate-900">Balance Due</span>
                    <span className="font-black font-mono text-rose-600">
                      {repair.estimatedCost != null ? formatNPR(Math.max(0, repair.estimatedCost - (repair.advancePaid || 0))) : '—'}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[32px] sm:rounded-[40px] border-indigo-100 shadow-sm overflow-hidden bg-white w-full">
            <CardHeader className="p-6 sm:p-8">
              <CardTitle className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
                <Zap className="h-5 w-5 text-indigo-600" /> Specialist Assignment
              </CardTitle>
              <CardDescription className="text-xs">Assign or transfer diagnostic case.</CardDescription>
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
                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm shrink-0">
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

      {/* ========================================================================= */}
      {/* 2. ADVANCED CRASH-PROOF ALERT TECH MODAL (Priority Moved Inside Here)      */}
      {/* ========================================================================= */}
      <Dialog open={isAlertDialogOpen} onOpenChange={setIsAlertDialogOpen}>
        <DialogContent className="max-w-md w-full rounded-[32px] p-6 sm:p-7 border border-slate-200 shadow-2xl bg-white space-y-6">
          <DialogHeader className="space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100 shadow-xs">
              <Bell className="h-6 w-6 animate-pulse" />
            </div>
            <DialogTitle className="text-xl font-extrabold text-slate-900 tracking-tight">
              Alert Assigned Technician
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed">
              Dispatch an operational alert for Job <span className="font-mono font-bold text-slate-900">#{repair?.repairNumber}</span> to <span className="font-bold text-slate-800">{repair?.technician?.name || 'Assigned Specialist'}</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-wider text-slate-500">Select Alert Priority</Label>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { value: 'NORMAL', label: 'Normal', desc: 'Standard Notice', emoji: '⚪' },
                  { value: 'MEDIUM', label: 'Medium', desc: 'Elevated Notice', emoji: '🟡' },
                  { value: 'HIGH', label: 'High', desc: 'Priority Queue', emoji: '🟠' },
                  { value: 'URGENT', label: 'Urgent', desc: 'Immediate Action', emoji: '🔴' },
                ].map((item) => {
                  const isSelected = alertPriority === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setAlertPriority(item.value as any)}
                      className={cn(
                        "flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all cursor-pointer text-center gap-1",
                        item.value === 'URGENT' && "border-rose-200 bg-rose-50/50 text-rose-800 hover:bg-rose-100",
                        item.value === 'HIGH' && "border-amber-200 bg-amber-50/50 text-amber-900 hover:bg-amber-100",
                        item.value === 'MEDIUM' && "border-yellow-200 bg-yellow-50/50 text-yellow-900 hover:bg-yellow-100",
                        item.value === 'NORMAL' && "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100",
                        isSelected && item.value === 'URGENT' && "border-rose-600 bg-rose-600 text-white shadow-md shadow-rose-600/20 scale-[1.02]",
                        isSelected && item.value === 'HIGH' && "border-amber-500 bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20 scale-[1.02]",
                        isSelected && item.value === 'MEDIUM' && "border-yellow-500 bg-yellow-500 text-slate-950 font-bold shadow-md shadow-yellow-500/20 scale-[1.02]",
                        isSelected && item.value === 'NORMAL' && "border-slate-900 bg-slate-900 text-white shadow-md scale-[1.02]"
                      )}
                    >
                      <span className="text-sm">{item.emoji}</span>
                      <span className="text-xs font-black uppercase tracking-wider">{item.label}</span>
                      <span className="text-[10px] opacity-80 font-medium">{item.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-wider text-slate-500">Alert Message / Instructions *</Label>
              <Textarea
                placeholder="e.g. Customer waiting at counter. Please expedite diagnostics..."
                value={alertMessage}
                onChange={e => setAlertMessage(e.target.value)}
                className="rounded-2xl border-slate-200 bg-slate-50/50 min-h-[110px] text-xs sm:text-sm font-medium p-3.5 focus:bg-white transition-all shadow-inner"
              />
            </div>
          </div>

          <DialogFooter className="pt-2 flex flex-row items-center gap-2.5 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAlertDialogOpen(false)}
              className="flex-1 rounded-2xl h-11 border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={sendingAlert || !alertMessage.trim()}
              onClick={handleSendAlert}
              className={cn(
                "flex-1 rounded-2xl h-11 font-bold text-xs shadow-md cursor-pointer text-white",
                alertPriority === 'URGENT' && "bg-rose-600 hover:bg-rose-700 shadow-rose-600/20",
                alertPriority === 'HIGH' && "bg-amber-500 hover:bg-amber-600 text-slate-950 font-black shadow-amber-500/20",
                alertPriority === 'MEDIUM' && "bg-yellow-500 hover:bg-yellow-600 text-slate-950 font-black shadow-yellow-500/20",
                alertPriority === 'NORMAL' && "bg-slate-900 hover:bg-slate-800 shadow-slate-900/20"
              )}
            >
              {sendingAlert ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  <span>Dispatching...</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-1.5" />
                  <span>Send {alertPriority} Alert</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reopen Modal */}
      <Dialog open={isReopenDialogOpen} onOpenChange={setIsReopenDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 border border-slate-200 shadow-2xl bg-white space-y-4">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Reopen Warranty Claim</DialogTitle>
          </DialogHeader>
          <Textarea placeholder="Reason..." value={reopenRemark} onChange={e => setReopenRemark(e.target.value)} className="rounded-xl" />
          <DialogFooter>
            <Button onClick={handleReopenReProblem} className="bg-rose-600 text-white">Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {repair && (
        <ServiceSlipModal
          open={isSlipModalOpen}
          onOpenChange={setIsSlipModalOpen}
          repairs={[repair]}
          customer={repair.customer || { name: repair.customerName, phone: repair.customerPhone, email: repair.customerEmail, address: repair.customerAddress }}
        />
      )}

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
    </div>
  );
}