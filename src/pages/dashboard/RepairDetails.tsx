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
import { syncRepairToSupabase as syncRepairToRtdb, syncRepairToSupabase } from '@/lib/supabase';
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
  
  const [isAlertDialogOpen, setIsAlertDialogOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertPriority, setAlertPriority] = useState<'URGENT' | 'HIGH' | 'NORMAL'>('URGENT');
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
      setTechnicians(staffData.filter((s: any) => ['TECHNICIAN', 'LEAD_TECHNICIAN'].includes(s.role) && s.isActive !== false));
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

  // Real-time synchronization for instant status, payment, and technician assignment updates across all devices
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
      toast.success('Specialist assigned and notified in real time');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Unable to update specialist assignment. Please try again.');
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
      await api.post(`/repairs/${id}/alert`, {
        message: alertMessage.trim(),
        priority: alertPriority
      });
      toast.success("Priority alert dispatched to assigned technician in real-time");
      setIsAlertDialogOpen(false);
      setAlertMessage('');
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

  const handleUpdatePriority = async (priority: string) => {
    setUpdating(true);
    try {
      await api.patch(`/repairs/${id}/priority`, { priority });
      toast.success(`Priority updated to ${priority}`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update priority");
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
      returnCourierCompany: repair.returnCourierCompany || repair.courierCompany || 'Sundar Courier',
      customCourierCompany: '',
      returnCourierTrackingNumber: repair.returnCourierTrackingNumber || '',
      returnCourierDispatchDate: format(new Date(), 'yyyy-MM-dd'),
      destinationDistrict: repair.destinationDistrict || repair.originDistrict || repair.customer?.district || 'Kathmandu',
      destinationAddress: repair.destinationAddress || repair.originAddress || repair.customerAddress || '',
      receiverName: repair.receiverName || repair.senderName || repair.customerName || '',
      receiverPhone: repair.receiverPhone || repair.senderPhone || repair.customerPhone || '',
      returnCourierNotes: repair.returnCourierNotes || ''
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
      toast.success(`Repaired device dispatched via ${company} (Tracking #${courierDispatchForm.returnCourierTrackingNumber.trim()})`);
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
      toast.success(`Status updated to ${status.replace(/_/g, ' ')}`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Unable to save the repair status. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-12 w-12 text-slate-300 animate-spin" />
        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Opening Repair Vault...</p>
      </div>
    );
  }

  const isAssigned = Boolean(repair.technicianId);

  return (
    <div className="space-y-8 pb-32 max-w-7xl mx-auto px-2 sm:px-4">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-4 sm:p-6 rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          <Button 
            variant="outline" 
            onClick={() => navigate('/dashboard/repairs')} 
            className="rounded-2xl border-slate-200 h-10 w-10 sm:h-11 sm:w-11 p-0 flex items-center justify-center shrink-0 cursor-pointer hover:bg-slate-100"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
               <Badge variant="secondary" className="font-mono text-xs font-black uppercase tracking-tighter bg-slate-900 text-white px-2.5 py-1 rounded-xl">
                 JOB #{repair.repairNumber}
               </Badge>
               <Badge className={repair.status === 'COMPLETED' || repair.status === 'REPAIRED' ? "bg-emerald-600 text-white font-bold" : "bg-indigo-600 text-white font-bold"}>
                 {repair.status.replace(/_/g, ' ')}
               </Badge>
               {repair.priority === 'URGENT' && (
                 <Badge className="bg-rose-600 text-white font-bold animate-pulse">
                   URGENT PRIORITY
                 </Badge>
               )}
               {repair.priority === 'HIGH' && (
                 <Badge className="bg-amber-500 text-white font-bold">
                   HIGH PRIORITY
                 </Badge>
               )}
            </div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 truncate">
              {repair.deviceBrand} {repair.deviceModel}
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 w-full lg:w-auto justify-start lg:justify-end shrink-0">
          {/* Priority selector for managers/admins */}
          {['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(user?.role || '') && (
            <Select 
              value={repair.priority || 'NORMAL'} 
              onValueChange={handleUpdatePriority}
              disabled={updating}
            >
              <SelectTrigger className="h-10 sm:h-11 rounded-2xl border-slate-200 bg-white font-bold text-xs w-32 sm:w-36 shrink-0 cursor-pointer">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="NORMAL" className="font-bold text-xs">Normal Priority</SelectItem>
                <SelectItem value="HIGH" className="font-bold text-xs text-amber-600">High Priority</SelectItem>
                <SelectItem value="URGENT" className="font-bold text-xs text-rose-600">Urgent Priority</SelectItem>
              </SelectContent>
            </Select>
          )}

          {/* Dispatch via Courier Button (for Super Admin, Admin, Receptionist) */}
          {['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST'].includes(user?.role || '') && (
            <Button
              variant="outline"
              onClick={handleOpenCourierDispatch}
              className="rounded-2xl border-blue-200 bg-blue-50/60 hover:bg-blue-100 text-blue-700 font-bold text-xs h-10 sm:h-11 px-3 sm:px-4 shadow-sm shrink-0 cursor-pointer"
            >
              <Package className="h-4 w-4 mr-1.5 text-blue-600" />
              <span>{repair.isReturnCourierDispatched ? 'Update Courier Dispatch' : 'Dispatch Courier'}</span>
            </Button>
          )}

          {/* Priority Alert to Technician Button (for Manager, Receptionist, Admin, Super Admin) */}
          {isAssigned && ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'LEAD_TECHNICIAN'].includes(user?.role || '') && (
            <Button
              variant="outline"
              onClick={() => setIsAlertDialogOpen(true)}
              className="rounded-2xl border-rose-200 bg-rose-50/50 hover:bg-rose-100/80 text-rose-700 font-bold text-xs h-10 sm:h-11 px-3 sm:px-4 shadow-sm shrink-0 cursor-pointer"
            >
              <Bell className="h-4 w-4 mr-1.5 text-rose-600 animate-bounce" />
              <span>Alert Technician</span>
            </Button>
          )}

          {/* Edit Repair Button (Super Admin, Admin, Manager, Receptionist) */}
          {['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST'].includes(user?.role || '') && (
            <Button
              variant="outline"
              onClick={() => setIsEditModalOpen(true)}
              className="rounded-2xl border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs h-10 sm:h-11 px-3 sm:px-4 shadow-sm shrink-0 cursor-pointer"
            >
              <Edit3 className="h-4 w-4 mr-1.5 text-blue-600" />
              <span>Edit Repair</span>
            </Button>
          )}

          <DashboardRefreshButton
            onRefresh={fetchData}
            size="default"
            label="Refresh"
            variant="outline"
            className="rounded-2xl h-10 sm:h-11 border-slate-200 font-bold text-xs shrink-0"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Device & Status Card */}
          <Card className="rounded-[40px] border-slate-200 shadow-sm overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/50 p-8 border-b">
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                     <div className="w-14 h-14 bg-white rounded-2xl shadow-md flex items-center justify-center text-slate-900 border border-slate-100">
                        <Smartphone className="h-7 w-7" />
                     </div>
                     <div>
                        <CardTitle className="text-2xl font-bold">Repair Diagnostics</CardTitle>
                        <CardDescription>Comprehensive device state and reported issues.</CardDescription>
                     </div>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={() => setIsSlipModalOpen(true)}
                    className="rounded-2xl font-bold border-slate-200 h-10 px-4 hover:bg-slate-50 cursor-pointer"
                  >
                     <Printer className="h-4 w-4 mr-2 text-slate-700" /> Print Service Slip
                  </Button>
               </div>
            </CardHeader>
            <CardContent className="p-8 sm:p-10 space-y-8">
               <div className="grid sm:grid-cols-3 gap-6 text-center sm:text-left">
                  <div className="space-y-1">
                     <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Brand / Manufacturer</p>
                     <p className="text-xl font-extrabold text-slate-900">{repair.deviceBrand}</p>
                  </div>
                  <div className="space-y-1">
                     <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Model Specification</p>
                     <p className="text-xl font-extrabold text-slate-900">{repair.deviceModel}</p>
                  </div>
                  <div className="space-y-1">
                     <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">IMEI / Serial</p>
                     <p className="text-xl font-mono font-bold text-indigo-600">{repair.imeiNumber || 'N/A'}</p>
                  </div>
               </div>

               <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-200/60 relative overflow-hidden">
                  <div className="relative z-10 space-y-4">
                     <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-xs">
                           <FileText className="h-4 w-4 text-indigo-600" />
                        </div>
                        <h4 className="font-bold text-base text-slate-900">Problem Description</h4>
                     </div>
                     <p className="text-slate-700 font-medium text-base leading-relaxed italic">
                        "{repair.problemDescription}"
                     </p>
                     
                      <div className="pt-2 flex flex-wrap gap-3">
                        <Badge variant="outline" className="bg-white rounded-xl px-3.5 py-1.5 font-bold border-slate-200 text-xs">
                           <ShieldCheck className="h-3.5 w-3.5 mr-1.5 text-emerald-500" /> Condition: {repair.deviceCondition}
                        </Badge>
                        {repair.deviceColor && (
                          <Badge variant="outline" className="bg-white rounded-xl px-3.5 py-1.5 font-bold border-slate-200 text-xs text-slate-800">
                            Color: {repair.deviceColor}
                          </Badge>
                        )}
                        {repair.accessoriesReceived && (
                          <Badge variant="outline" className="bg-white rounded-xl px-3.5 py-1.5 font-bold border-slate-200 text-xs">
                            <Zap className="h-3.5 w-3.5 mr-1.5 text-amber-500" /> Includes: {repair.accessoriesReceived}
                          </Badge>
                        )}
                        {(repair.receivingMethod === 'COURIER' || repair.isCourierIn) && (
                          <Badge className="bg-amber-500 text-white font-bold text-xs rounded-xl px-3.5 py-1.5 flex items-center gap-1 shadow-xs">
                            <Package className="w-3.5 h-3.5" /> Received Via Courier
                          </Badge>
                        )}
                      </div>

                      {repair.conditionNotes && (
                        <div className="pt-1 text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-200/80">
                          <span className="font-bold text-slate-800">Condition Notes:</span> {repair.conditionNotes}
                        </div>
                      )}
                  </div>
                </div>

                {/* INBOUND & RETURN COURIER DETAILS PANELS */}
                {(repair.isCourierIn || repair.receivingMethod === 'COURIER' || repair.isReturnCourierDispatched) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Inbound Courier */}
                    {(repair.isCourierIn || repair.receivingMethod === 'COURIER') && (
                      <div className="p-5 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-2 text-xs">
                        <div className="flex items-center gap-2 font-bold text-amber-900 text-sm border-b border-amber-200/60 pb-2">
                          <Package className="w-4 h-4 text-amber-700" />
                          <span>Inbound Courier Consignment</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-slate-800 pt-1">
                          <div>
                            <span className="text-amber-800/80 block text-[10px] font-bold uppercase">Courier:</span>
                            <span className="font-bold">{repair.courierCompany || 'Courier Partner'}</span>
                          </div>
                          <div>
                            <span className="text-amber-800/80 block text-[10px] font-bold uppercase">Tracking #:</span>
                            <span className="font-mono font-bold">{repair.courierTrackingNumber || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-amber-800/80 block text-[10px] font-bold uppercase">Origin District:</span>
                            <span>{repair.originDistrict || repair.customer?.district || 'Nepal'}</span>
                          </div>
                          <div>
                            <span className="text-amber-800/80 block text-[10px] font-bold uppercase">Sender Phone:</span>
                            <span className="font-mono">{repair.senderPhone || repair.customerPhone || '—'}</span>
                          </div>
                        </div>
                        {repair.courierNotes && (
                          <p className="text-[11px] text-amber-900/80 italic pt-1 border-t border-amber-200/40">
                            Notes: {repair.courierNotes}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Return Courier Dispatch */}
                    {repair.isReturnCourierDispatched && (
                      <div className="p-5 rounded-2xl bg-blue-50/60 border border-blue-200/80 space-y-2 text-xs">
                        <div className="flex items-center justify-between border-b border-blue-200/60 pb-2">
                          <div className="flex items-center gap-2 font-bold text-blue-950 text-sm">
                            <Truck className="w-4 h-4 text-blue-700" />
                            <span>Return Dispatch Consignment</span>
                          </div>
                          <Badge className="bg-blue-600 text-white text-[9px] px-1.5 py-0.5 font-bold">
                            Dispatched
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-slate-800 pt-1">
                          <div>
                            <span className="text-blue-800/80 block text-[10px] font-bold uppercase">Dispatch Courier:</span>
                            <span className="font-bold">{repair.returnCourierCompany}</span>
                          </div>
                          <div>
                            <span className="text-blue-800/80 block text-[10px] font-bold uppercase">Return Tracking #:</span>
                            <span className="font-mono font-bold text-blue-700">{repair.returnCourierTrackingNumber}</span>
                          </div>
                          <div>
                            <span className="text-blue-800/80 block text-[10px] font-bold uppercase">Destination District:</span>
                            <span>{repair.destinationDistrict || 'Customer Address'}</span>
                          </div>
                          <div>
                            <span className="text-blue-800/80 block text-[10px] font-bold uppercase">Receiver:</span>
                            <span>{repair.receiverName || repair.customerName}</span>
                          </div>
                        </div>
                        {repair.returnCourierNotes && (
                          <p className="text-[11px] text-blue-900/80 italic pt-1 border-t border-blue-200/40">
                            Notes: {repair.returnCourierNotes}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Reopen / Warranty Claim Banner if Delivered */}
                {repair.status === 'DELIVERED' && ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST'].includes(user?.role || '') && (
                  <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 border border-amber-200">
                        <RotateCcw className="h-5 w-5" />
                      </div>
                      <div>
                        <h5 className="font-bold text-sm text-amber-900">Warranty Claim / Re-Problem</h5>
                        <p className="text-xs text-amber-700">If the customer reports a recurring fault after delivery, reopen this job for warranty service.</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      onClick={() => setIsReopenDialogOpen(true)}
                      className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs h-10 px-5 rounded-xl shrink-0 shadow-md shadow-rose-600/10"
                    >
                      <AlertCircle className="w-4 h-4 mr-1.5" />
                      Reopen as Re-Problem
                    </Button>
                  </div>
                )}

                <div className="space-y-4">
                   <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Update Operation Status</h4>
                   <div className="flex flex-wrap gap-2.5">
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
                          className={`rounded-2xl font-bold h-11 px-5 text-xs ${
                            repair.status === s 
                              ? s === 'RE_PROBLEM' ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20' : 'bg-indigo-600 shadow-lg shadow-indigo-600/20 text-white' 
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

          {/* Communication & Multi-Role Notes Section */}
          <Card className="rounded-[40px] border-slate-200 shadow-sm overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/50 p-6 sm:p-8 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center border border-blue-100">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold">Communication & Technical Notes</CardTitle>
                    <CardDescription className="text-xs">Real-time collaboration between Reception, Technicians, and Admin.</CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 sm:p-8 space-y-6">
              {/* Notes List */}
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {notes.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    No communication notes recorded yet.
                  </div>
                ) : (
                  notes.map((n) => {
                    const isAlert = n.note?.startsWith('[Priority Alert]') || n.note?.startsWith('[Staff Alert]');
                    return (
                      <div 
                        key={n.id} 
                        className={cn(
                          "p-4 rounded-2xl text-xs space-y-1.5 border",
                          isAlert ? "bg-rose-50/90 border-rose-200 text-rose-950" : "bg-slate-50 border-slate-100 text-slate-900"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-extrabold text-[11px] flex items-center gap-1.5">
                            {isAlert ? <Flame className="h-3.5 w-3.5 text-rose-600" /> : null}
                            {n.authorName || n.technician?.name || 'Staff Member'}
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
                    );
                  })
                )}
              </div>

              {/* Add Note Composer */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <Textarea
                  placeholder="Post internal instruction, customer update, or diagnostic note..."
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  className="rounded-2xl border-slate-200 text-xs font-medium min-h-[70px]"
                />
                <div className="flex items-center justify-end">
                  <Button
                    size="sm"
                    disabled={submittingNote || !newNote.trim()}
                    onClick={handleAddNote}
                    className="rounded-xl h-9 px-5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm"
                  >
                    {submittingNote ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
                    Add Note
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          {/* Customer & Billing */}
          <Card className="rounded-[40px] border-slate-200 shadow-sm overflow-hidden bg-white">
             <CardHeader className="bg-slate-950 text-white p-8">
                <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                   <User className="h-5 w-5" /> Client Information
                </CardTitle>
                </div>
             </CardHeader>
             <CardContent className="p-8 space-y-8">
                <div className="space-y-4">
                   <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Customer ID</span>
                      <span className="font-mono font-bold text-blue-600 text-xs bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                        {repair.customer?.customerId || repair.customerId || 'CUS-00101'}
                      </span>
                   </div>
                   <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Client Name</span>
                      <span className="font-bold text-slate-900">{repair.customerName}</span>
                   </div>
                   <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Phone Number</span>
                      <span className="font-mono font-bold text-slate-900">{repair.customerPhone}</span>
                   </div>
                   {repair.customerEmail && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Email Address</span>
                        <span className="font-bold text-slate-900 text-sm">{repair.customerEmail}</span>
                      </div>
                   )}
                </div>
                
                <Separator />

                <div className="space-y-6">
                   <h4 className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <Banknote className="h-4 w-4" /> Billing Snapshot
                   </h4>
                   <div className="space-y-3">
                      <div className="flex justify-between items-center text-lg">
                        <span className="font-bold text-slate-500">Total Estimation</span>
                        <span className="font-black font-mono text-slate-900">
                          {repair.estimatedCost !== null && repair.estimatedCost !== undefined
                            ? formatNPR(repair.estimatedCost)
                            : <span className="text-sm font-medium text-slate-400 italic">Unspecified</span>}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-lg">
                        <span className="font-bold text-slate-500">Advance Paid</span>
                        <span className="font-black font-mono text-emerald-600">{formatNPR(repair.advancePaid || 0)}</span>
                      </div>
                      <Separator className="my-2" />
                      <div className="flex justify-between items-center text-2xl">
                        <span className="font-black text-slate-900">Balance Due</span>
                        <span className="font-black font-mono text-rose-600">
                          {repair.estimatedCost !== null && repair.estimatedCost !== undefined
                            ? formatNPR(Math.max(0, repair.estimatedCost - (repair.advancePaid || 0)))
                            : <span className="text-sm font-medium text-slate-400 italic">—</span>}
                        </span>
                      </div>
                   </div>
                </div>
             </CardContent>
          </Card>

          {/* Specialist Assignment & Transfer Card */}
          <Card className="rounded-[40px] border-indigo-100 bg-indigo-50/20 shadow-sm overflow-hidden bg-white">
             <CardHeader className="p-8">
                <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                   <Zap className="h-5 w-5 text-indigo-600" /> Specialist Assignment
                </CardTitle>
                <CardDescription>Assign or transfer this diagnostic case.</CardDescription>
             </CardHeader>
             <CardContent className="p-8 pt-0 space-y-6">
                <Select 
                  value={repair.technicianId || ''} 
                  onValueChange={handleAssignmentChange}
                  disabled={updating}
                >
                   <SelectTrigger className="h-14 rounded-2xl border-slate-200 bg-white shadow-sm font-bold text-base">
                      <SelectValue placeholder="Manual Assignment" />
                   </SelectTrigger>
                   <SelectContent className="rounded-2xl">
                      {technicians.map((t) => (
                        <SelectItem key={t.id} value={t.id} className="rounded-xl font-bold py-3">
                           {t.name} ({t.role.replace(/_/g, ' ')})
                        </SelectItem>
                      ))}
                   </SelectContent>
                </Select>

                {repair.technician && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-indigo-100 shadow-sm">
                       <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-600/30">
                          {repair.technician.name.charAt(0)}
                       </div>
                       <div className="flex-1">
                          <p className="font-bold text-slate-900">{repair.technician.name}</p>
                          <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Active Specialist</p>
                       </div>
                    </div>

                    {/* Quick Transfer Button */}
                    {['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'LEAD_TECHNICIAN', 'TECHNICIAN'].includes(user?.role || '') && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsTransferDialogOpen(true)}
                        className="w-full rounded-2xl border-amber-200 text-amber-800 hover:bg-amber-50 font-bold text-xs h-11"
                      >
                        <ArrowRightLeft className="h-4 w-4 mr-2 text-amber-600" />
                        Transfer Case to Another Specialist
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
          </Card>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. REOPEN FOR RE-PROBLEM (WARRANTY) MODAL                                 */}
      {/* ========================================================================= */}
      <Dialog open={isReopenDialogOpen} onOpenChange={setIsReopenDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 border border-slate-200 shadow-2xl bg-white space-y-4">
          <DialogHeader>
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-1 border border-rose-100">
              <RotateCcw className="h-5 w-5" />
            </div>
            <DialogTitle className="text-xl font-bold text-slate-900">Reopen for Re-Problem (Warranty)</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Reopen job <b>#{repair?.repairNumber}</b> for warranty diagnostic assessment
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Reported Problem / Customer Remarks *</Label>
              <Textarea
                placeholder="e.g. Customer reported display flicker after 3 days of delivery..."
                value={reopenRemark}
                onChange={e => setReopenRemark(e.target.value)}
                className="rounded-xl border-slate-200 min-h-[100px] text-xs font-medium"
              />
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              This will update the status to <b>RE-PROBLEM</b>, add a timestamped log to the activity trace, and alert the technical squad.
            </p>
          </div>

          <DialogFooter className="pt-2 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsReopenDialogOpen(false)}
              className="rounded-xl text-xs font-bold text-slate-500"
            >
              Cancel
            </Button>
            <Button 
              type="button"
              onClick={handleReopenReProblem}
              className="rounded-xl h-10 px-5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/10"
              disabled={updating}
            >
              {updating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RotateCcw className="h-4 w-4 mr-1.5" />}
              Confirm Reopen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 2. PRIORITY ALERT TO ASSIGNED TECHNICIAN MODAL                            */}
      {/* ========================================================================= */}
      <Dialog open={isAlertDialogOpen} onOpenChange={setIsAlertDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 border border-slate-200 shadow-2xl bg-white space-y-4">
          <DialogHeader>
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-1 border border-rose-100">
              <Bell className="h-5 w-5" />
            </div>
            <DialogTitle className="text-xl font-bold text-slate-900">Alert Assigned Technician</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Send instant high-priority alert for Job <b>#{repair?.repairNumber}</b> to <b>{repair?.technician?.name}</b>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Urgency Level</Label>
              <Select value={alertPriority} onValueChange={(val: any) => setAlertPriority(val)}>
                <SelectTrigger className="rounded-xl h-11 border-slate-200 text-xs font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="URGENT" className="text-xs font-bold text-rose-600">🚨 URGENT Priority</SelectItem>
                  <SelectItem value="HIGH" className="text-xs font-bold text-amber-600">⚠️ High Priority</SelectItem>
                  <SelectItem value="NORMAL" className="text-xs font-bold text-slate-700">ℹ️ Normal Priority</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Alert Message *</Label>
              <Textarea
                placeholder="e.g. Customer is waiting at the counter. Please expedite IC replacement testing."
                value={alertMessage}
                onChange={e => setAlertMessage(e.target.value)}
                className="rounded-xl border-slate-200 min-h-[90px] text-xs font-medium"
              />
            </div>
          </div>

          <DialogFooter className="pt-2 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsAlertDialogOpen(false)}
              className="rounded-xl text-xs font-bold text-slate-500"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={sendingAlert || !alertMessage.trim()}
              onClick={handleSendAlert}
              className="rounded-xl h-10 px-5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/20"
            >
              {sendingAlert ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Send className="h-4 w-4 mr-1.5" />}
              Send Priority Alert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 3. REPAIR TRANSFER MODAL                                                  */}
      {/* ========================================================================= */}
      <Dialog open={isTransferDialogOpen} onOpenChange={setIsTransferDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 border border-slate-200 shadow-2xl bg-white space-y-4">
          <DialogHeader>
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-1 border border-amber-100">
              <ArrowRightLeft className="h-5 w-5" />
            </div>
            <DialogTitle className="text-xl font-bold text-slate-900">Transfer Repair Case</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Transfer Job <b>#{repair?.repairNumber}</b> to another lab technician
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Target Specialist *</Label>
              <Select value={transferTargetId} onValueChange={setTransferTargetId}>
                <SelectTrigger className="rounded-xl h-11 border-slate-200 text-xs font-bold">
                  <SelectValue placeholder="Select target technician..." />
                </SelectTrigger>
                <SelectContent className="rounded-2xl max-h-56">
                  {technicians.filter(t => t.id !== repair?.technicianId).map((t) => (
                    <SelectItem key={t.id} value={t.id} className="text-xs font-bold py-2.5">
                      {t.name} ({t.role.replace(/_/g, ' ')})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Reason for Transfer *</Label>
              <Textarea
                placeholder="e.g. Requires specialized microscope setup for CPU reballing..."
                value={transferReason}
                onChange={e => setTransferReason(e.target.value)}
                className="rounded-xl border-slate-200 min-h-[90px] text-xs font-medium"
              />
            </div>
          </div>

          <DialogFooter className="pt-2 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsTransferDialogOpen(false)}
              className="rounded-xl text-xs font-bold text-slate-500"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={sendingTransfer || !transferTargetId || !transferReason.trim()}
              onClick={handleSendTransfer}
              className="rounded-xl h-10 px-5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md shadow-amber-600/20"
            >
              {sendingTransfer ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <ArrowRightLeft className="h-4 w-4 mr-1.5" />}
              Submit Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 4. COURIER RETURN DISPATCH DIALOG                                         */}
      {/* ========================================================================= */}
      <Dialog open={isCourierDispatchDialogOpen} onOpenChange={setIsCourierDispatchDialogOpen}>
        <DialogContent className="rounded-3xl border-slate-200 shadow-2xl p-6 sm:p-8 max-w-lg">
          <form onSubmit={handleSaveCourierDispatch}>
            <DialogHeader>
              <div className="w-12 h-12 bg-blue-100 text-blue-700 rounded-2xl flex items-center justify-center mb-3">
                <Truck className="h-6 w-6" />
              </div>
              <DialogTitle className="text-xl font-bold text-slate-900">
                Dispatch Repaired Device via Courier
              </DialogTitle>
              <DialogDescription className="text-slate-500 text-xs">
                Record shipment details to dispatch job <strong>#{repair?.repairNumber}</strong> back to the customer.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 my-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                
                {/* Courier Partner */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Courier Partner *</Label>
                  <Select
                    value={courierDispatchForm.returnCourierCompany}
                    onValueChange={(v) => setCourierDispatchForm((prev: any) => ({ ...prev, returnCourierCompany: v }))}
                  >
                    <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-slate-50 text-xs font-semibold">
                      <SelectValue placeholder="Select Courier" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl shadow-xl">
                      {[
                        "Nepal Can Move (NCM)",
                        "Sundar Courier",
                        "Nepal Post / GPO",
                        "Pathao Logistics",
                        "Aramex Nepal",
                        "DHL Express",
                        "FedEx / TNT",
                        "Gorkha Express",
                        "Gaura Courier",
                        "Other Courier"
                      ].map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {courierDispatchForm.returnCourierCompany === 'Other Courier' && (
                    <Input
                      placeholder="Specify Courier Name"
                      value={courierDispatchForm.customCourierCompany}
                      onChange={(e) => setCourierDispatchForm((prev: any) => ({ ...prev, customCourierCompany: e.target.value }))}
                      className="h-9 rounded-xl border-slate-200 bg-white text-xs mt-1"
                      required
                    />
                  )}
                </div>

                {/* Tracking / Consignment Number */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Consignment / Tracking # *</Label>
                  <Input
                    placeholder="e.g. SCN-982341, TRK-10293"
                    value={courierDispatchForm.returnCourierTrackingNumber}
                    onChange={(e) => setCourierDispatchForm((prev: any) => ({ ...prev, returnCourierTrackingNumber: e.target.value }))}
                    className="h-10 rounded-xl border-slate-200 bg-slate-50 font-mono text-xs font-bold"
                    required
                  />
                </div>

                {/* Dispatch Date */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Dispatch Date *</Label>
                  <Input
                    type="date"
                    value={courierDispatchForm.returnCourierDispatchDate}
                    onChange={(e) => setCourierDispatchForm((prev: any) => ({ ...prev, returnCourierDispatchDate: e.target.value }))}
                    className="h-10 rounded-xl border-slate-200 bg-slate-50 text-xs"
                    required
                  />
                </div>

                {/* Destination District */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Destination District</Label>
                  <Input
                    placeholder="e.g. Pokhara, Morang"
                    value={courierDispatchForm.destinationDistrict}
                    onChange={(e) => setCourierDispatchForm((prev: any) => ({ ...prev, destinationDistrict: e.target.value }))}
                    className="h-10 rounded-xl border-slate-200 bg-slate-50 text-xs"
                  />
                </div>

                {/* Receiver Name */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Receiver Name</Label>
                  <Input
                    placeholder="Receiver Full Name"
                    value={courierDispatchForm.receiverName}
                    onChange={(e) => setCourierDispatchForm((prev: any) => ({ ...prev, receiverName: e.target.value }))}
                    className="h-10 rounded-xl border-slate-200 bg-slate-50 text-xs"
                  />
                </div>

                {/* Receiver Phone */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Receiver Phone</Label>
                  <Input
                    placeholder="Receiver Phone Number"
                    value={courierDispatchForm.receiverPhone}
                    onChange={(e) => setCourierDispatchForm((prev: any) => ({ ...prev, receiverPhone: e.target.value }))}
                    className="h-10 rounded-xl border-slate-200 bg-slate-50 text-xs font-mono"
                  />
                </div>

              </div>

              {/* Destination Address */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Destination Full Address</Label>
                <Input
                  placeholder="Full delivery location / address"
                  value={courierDispatchForm.destinationAddress}
                  onChange={(e) => setCourierDispatchForm((prev: any) => ({ ...prev, destinationAddress: e.target.value }))}
                  className="h-10 rounded-xl border-slate-200 bg-slate-50 text-xs"
                />
              </div>

              {/* Courier Notes */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Courier Return Notes</Label>
                <Textarea
                  rows={2}
                  placeholder="e.g. Fragile display sticker attached, bubble wrap 3-layers"
                  value={courierDispatchForm.returnCourierNotes}
                  onChange={(e) => setCourierDispatchForm((prev: any) => ({ ...prev, returnCourierNotes: e.target.value }))}
                  className="rounded-xl border-slate-200 bg-slate-50 text-xs font-medium"
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCourierDispatchDialogOpen(false)}
                disabled={sendingCourierDispatch}
                className="h-10 rounded-xl border-slate-200 text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={sendingCourierDispatch}
                className="h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 shadow-sm flex items-center gap-1.5"
              >
                {sendingCourierDispatch ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Dispatching...</span>
                  </>
                ) : (
                  <>
                    <Truck className="h-3.5 w-3.5" />
                    <span>Confirm Courier Dispatch</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Printable Service Slip Modal */}
      {repair && (
        <ServiceSlipModal
          open={isSlipModalOpen}
          onOpenChange={setIsSlipModalOpen}
          repairs={[repair]}
          customer={repair.customer || { name: repair.customerName, phone: repair.customerPhone, email: repair.customerEmail, address: repair.customerAddress }}
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
    </div>
  );
}
