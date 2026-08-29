import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Smartphone, 
  Clock, 
  CircleCheck as CheckCircle2, 
  MessageSquare, 
  Wrench,
  Loader2,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  History,
  ArrowRightLeft,
  Bell,
  Check,
  X,
  Send,
  Search,
  Flame,
  ShieldCheck,
  Zap,
  Package,
  Eye,
  RotateCcw,
  CheckCheck,
  FileWarning
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { api } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { useRealtimeSync } from '@/services/realtime';
import { syncRepairToSupabase as syncRepairToRtdb, syncRepairToSupabase } from '@/lib/supabase';
import { formatTimeAgo, formatShortTimeAgo } from '@/lib/timeUtils';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import DashboardRefreshButton from '@/components/DashboardRefreshButton';
import UserOverviewCards from '@/components/dashboard/UserOverviewCards';

const REPAIR_STATUS_FLOW = [
  'RECEIVED',
  'DIAGNOSING',
  'IN_PROCESS',
  'WAITING_FOR_PARTS',
  'TESTING',
  'REPAIRED',
  'READY_FOR_PICKUP',
  'DELIVERED',
  'RE_PROBLEM',
  'REPROBLEM_FIXED',
  'CANNOT_REPAIR'
];

const statusStyles: Record<string, { label: string; badge: string; bgSoft: string; border: string }> = {
  RECEIVED: { label: 'Received', badge: 'bg-amber-100 text-amber-900 border-amber-300', bgSoft: 'bg-amber-50', border: 'border-amber-200' },
  DIAGNOSING: { label: 'Diagnosing', badge: 'bg-blue-100 text-blue-900 border-blue-300', bgSoft: 'bg-blue-50', border: 'border-blue-200' },
  IN_PROCESS: { label: 'In Progress', badge: 'bg-indigo-100 text-indigo-900 border-indigo-300', bgSoft: 'bg-indigo-50', border: 'border-indigo-200' },
  WAITING_FOR_PARTS: { label: 'Waiting for Parts', badge: 'bg-purple-100 text-purple-900 border-purple-300', bgSoft: 'bg-purple-50', border: 'border-purple-200' },
  TESTING: { label: 'Testing QA', badge: 'bg-orange-100 text-orange-900 border-orange-300', bgSoft: 'bg-orange-50', border: 'border-orange-200' },
  REPAIRED: { label: 'Repaired', badge: 'bg-teal-100 text-teal-900 border-teal-300', bgSoft: 'bg-teal-50', border: 'border-teal-200' },
  READY_FOR_PICKUP: { label: 'Ready for Pickup', badge: 'bg-emerald-600 text-white border-transparent', bgSoft: 'bg-emerald-50', border: 'border-emerald-200' },
  DELIVERED: { label: 'Delivered', badge: 'bg-slate-200 text-slate-800 border-slate-300', bgSoft: 'bg-slate-50', border: 'border-slate-200' },
  RE_PROBLEM: { label: 'Re-Problem (Warranty)', badge: 'bg-rose-100 text-rose-800 border-rose-300 font-bold', bgSoft: 'bg-rose-50', border: 'border-rose-300' },
  REPROBLEM: { label: 'Re-Problem (Warranty)', badge: 'bg-rose-100 text-rose-800 border-rose-300 font-bold', bgSoft: 'bg-rose-50', border: 'border-rose-300' },
  REPROBLEM_FIXED: { label: 'Warranty Fixed', badge: 'bg-teal-100 text-teal-800 border-teal-300', bgSoft: 'bg-teal-50', border: 'border-teal-200' },
  CANNOT_REPAIR: { label: 'Cannot Repair', badge: 'bg-rose-100 text-rose-800 border-rose-300', bgSoft: 'bg-rose-50', border: 'border-rose-200' },
  PENDING: { label: 'Pending', badge: 'bg-slate-100 text-slate-700 border-slate-300', bgSoft: 'bg-slate-50', border: 'border-slate-200' }
};

type StatusFilterTab = 'ALL' | 'URGENT' | 'HIGH' | 'ACTIVE' | 'IN_PROCESS' | 'TESTING' | 'WAITING_FOR_PARTS' | 'REPAIRED' | 'RE_PROBLEM' | 'TRANSFERS';

/**
 * Categorizes repair priority into 3 authoritative tiers:
 * 🔴 High Priority (URGENT)
 * 🟠 Priority (HIGH)
 * 🔵 Normal (NORMAL / standard)
 */
export function getPriorityMeta(repair: any) {
  const p = String(repair?.priority || '').toUpperCase().trim();
  const isUrgent = p === 'URGENT' || 
                   repair?.isUrgent === true || 
                   String(repair?.problemDescription || '').toLowerCase().includes('urgent') ||
                   String(repair?.remarks || '').toLowerCase().includes('urgent');

  const isHigh = !isUrgent && (
    p === 'HIGH' || 
    p === 'PRIORITY' || 
    String(repair?.problemDescription || '').toLowerCase().includes('priority') ||
    String(repair?.remarks || '').toLowerCase().includes('priority')
  );

  if (isUrgent) {
    return {
      tier: 'URGENT' as const,
      label: 'High Priority',
      badgeClass: 'bg-rose-600 hover:bg-rose-700 text-white font-extrabold border-rose-700 shadow-sm shadow-rose-600/30 animate-pulse',
      cardBorder: 'border-rose-400 ring-2 ring-rose-500/20 shadow-sm shadow-rose-500/10',
      headerBg: 'bg-rose-50/60',
      icon: Flame,
      iconColor: 'text-rose-600',
      tagColor: 'text-rose-700',
      bannerBg: 'bg-gradient-to-r from-rose-500/15 via-red-500/10 to-amber-500/10 border-rose-400'
    };
  }

  if (isHigh) {
    return {
      tier: 'HIGH' as const,
      label: 'Priority',
      badgeClass: 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-black border-amber-600 shadow-xs',
      cardBorder: 'border-amber-300 ring-2 ring-amber-400/20 shadow-sm',
      headerBg: 'bg-amber-50/50',
      icon: Zap,
      iconColor: 'text-amber-600',
      tagColor: 'text-amber-700',
      bannerBg: 'bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-yellow-500/10 border-amber-300'
    };
  }

  return {
    tier: 'NORMAL' as const,
    label: 'Normal',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300 font-semibold',
    cardBorder: 'border-slate-200/90 hover:border-indigo-300',
    headerBg: 'bg-transparent',
    icon: Smartphone,
    iconColor: 'text-slate-500',
    tagColor: 'text-slate-600',
    bannerBg: 'bg-slate-50 border-slate-200'
  };
}

export default function TechnicianDashboard() {
  const { token, user } = useAuthStore();
  const navigate = useNavigate();
  
  // Core Data
  const [repairs, setRepairs] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [transferRequests, setTransferRequests] = useState<{ incoming: any[]; outgoing: any[]; pendingIncomingCount: number }>({
    incoming: [],
    outgoing: [],
    pendingIncomingCount: 0
  });
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Centralized Relative Time Ticker (updates all elapsed timestamps dynamically every 30s)
  const [tickerTime, setTickerTime] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setTickerTime(Date.now());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<StatusFilterTab>('ALL');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'dueDate' | 'priority'>('newest');

  // Expanded Problem Descriptions State (per repair ID)
  const [expandedDescriptions, setExpandedDescriptions] = useState<Record<string, boolean>>({});
  const toggleDescription = (repairId: string) => {
    setExpandedDescriptions(prev => ({ ...prev, [repairId]: !prev[repairId] }));
  };

  // Modals & States
  const [selectedRepair, setSelectedRepair] = useState<any>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);

  // Submitting States
  const [submittingUpdate, setSubmittingUpdate] = useState(false);
  const [submittingTransfer, setSubmittingTransfer] = useState(false);
  const [submittingNote, setSubmittingNote] = useState(false);
  const [respondingTransferId, setRespondingTransferId] = useState<string | null>(null);

  // Update Status Form
  const [updateForm, setUpdateForm] = useState({
    status: '',
    note: '',
    partsUsed: '',
    expectedCompletionDate: ''
  });

  // Transfer Form
  const [transferForm, setTransferForm] = useState({
    targetTechnicianId: '',
    reason: ''
  });

  // Notes Form & Data
  const [repairNotes, setRepairNotes] = useState<any[]>([]);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [loadingNotes, setLoadingNotes] = useState(false);

  // Repair-Related Damage Stats
  const [damageOverview, setDamageOverview] = useState<any>(null);

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const fetchDashboardData = useCallback(async () => {
    try {
      const [repairsData, staffData, transfersData, notifsData, damageData] = await Promise.allSettled([
        api.get('/repairs'),
        api.get('/staff'),
        api.get('/repair-transfers/my-requests'),
        api.get('/notifications'),
        api.get('/repair-damage/overview')
      ]);

      if (repairsData.status === 'fulfilled') {
        setRepairs(Array.isArray(repairsData.value) ? repairsData.value : []);
      }
      
      if (staffData.status === 'fulfilled') {
        const techStaff = (Array.isArray(staffData.value) ? staffData.value : []).filter(
          (s: any) => ['TECHNICIAN', 'LEAD_TECHNICIAN'].includes(s.role) && s.id !== user?.id && s.isActive !== false
        );
        setTechnicians(techStaff);
      }

      if (transfersData.status === 'fulfilled' && transfersData.value) {
        setTransferRequests({
          incoming: transfersData.value.incoming || [],
          outgoing: transfersData.value.outgoing || [],
          pendingIncomingCount: transfersData.value.pendingIncomingCount || 0
        });
      }

      if (notifsData.status === 'fulfilled' && notifsData.value) {
        const list = Array.isArray(notifsData.value) ? notifsData.value : (notifsData.value.notifications || []);
        setNotifications(list);
        setUnreadNotificationCount(typeof notifsData.value.unreadCount === 'number' ? notifsData.value.unreadCount : list.filter((n: any) => !n.isRead).length);
      }

      if (damageData.status === 'fulfilled' && damageData.value) {
        setDamageOverview(damageData.value);
      }
    } catch (err: any) {
      console.error("[TECHNICIAN DASHBOARD FETCH ERROR]", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData, token]);

  // Real-time synchronization for instant cross-device updates without manual refresh
  useRealtimeSync(
    ['repair', 'technicianNote', 'repairLog', 'notification', 'repairTransfer', 'user', 'sync'],
    (event) => {
      const isForMe = !event?.data?.technicianId || event?.data?.technicianId === user?.id || event?.data?.userId === user?.id;

      if (isForMe) {
        const eventPriority = String(event?.data?.priority || event?.data?.metadata?.priority || '').toUpperCase();
        const jobNum = event?.data?.repairNumber || event?.data?.metadata?.repairNumber || 'Ticket';
        const deviceName = `${event?.data?.deviceBrand || ''} ${event?.data?.deviceModel || ''}`.trim() || 'Device';

        if (event?.data?.type === 'REPAIR_URGENT' || eventPriority === 'URGENT') {
          toast.error(`🚨 High Priority Alert: Job #${jobNum} (${deviceName}) marked as High Priority!`, {
            duration: 9000,
            action: {
              label: "View Job",
              onClick: () => {
                const targetId = event?.data?.repairId || event?.data?.id;
                if (targetId) navigate(`/dashboard/repairs/${targetId}`);
                else fetchDashboardData();
              }
            }
          });
        } else if (event?.data?.type === 'REPAIR_ALERT' || eventPriority === 'HIGH') {
          toast.warning(`🟠 Priority Alert: Job #${jobNum} (${deviceName}) priority updated!`, {
            duration: 7000,
            action: {
              label: "View Job",
              onClick: () => {
                const targetId = event?.data?.repairId || event?.data?.id;
                if (targetId) navigate(`/dashboard/repairs/${targetId}`);
                else fetchDashboardData();
              }
            }
          });
        } else if (event?.data?.type === 'REPAIR_ASSIGNED') {
          toast.info(`🔔 New Job #${jobNum} (${deviceName}) assigned to your workspace.`, {
            duration: 6000
          });
        }
      }

      fetchDashboardData();
      if (selectedRepair && isNotesModalOpen) {
        fetchNotesForRepair(selectedRepair.id);
      }
    }
  );

  const fetchNotesForRepair = async (repairId: string) => {
    setLoadingNotes(true);
    try {
      const notes = await api.get(`/repairs/${repairId}/notes`);
      setRepairNotes(Array.isArray(notes) ? notes : []);
    } catch (err) {
      console.error("[FETCH NOTES ERROR]", err);
    } finally {
      setLoadingNotes(false);
    }
  };

  // ============================================================================
  // MODAL ACTIONS
  // ============================================================================

  const handleOpenUpdateModal = (repair: any) => {
    setSelectedRepair(repair);
    setUpdateForm({
      status: repair.status || 'IN_PROCESS',
      note: '',
      partsUsed: repair.partsUsed || '',
      expectedCompletionDate: repair.expectedCompletionDate ? new Date(repair.expectedCompletionDate).toISOString().split('T')[0] : ''
    });
    setIsUpdateModalOpen(true);
  };

  const handleOpenTransferModal = (repair: any) => {
    setSelectedRepair(repair);
    setTransferForm({
      targetTechnicianId: '',
      reason: ''
    });
    setIsTransferModalOpen(true);
  };

  const handleOpenNotesModal = (repair: any) => {
    setSelectedRepair(repair);
    setNewNoteContent('');
    setIsNotesModalOpen(true);
    fetchNotesForRepair(repair.id);
  };

  // ============================================================================
  // SUBMISSIONS
  // ============================================================================

  const submitStatusUpdate = async () => {
    if (!selectedRepair || submittingUpdate) return;
    setSubmittingUpdate(true);
    try {
      const updated = await api.patch(`/repairs/${selectedRepair.id}/technician-update`, updateForm);
      await syncRepairToRtdb(updated);
      toast.success(`Job #${selectedRepair.repairNumber} progress saved successfully`);
      setIsUpdateModalOpen(false);
      fetchDashboardData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update repair status");
    } finally {
      setSubmittingUpdate(false);
    }
  };

  const submitTransferRequest = async () => {
    if (!selectedRepair || submittingTransfer) return;
    if (!transferForm.targetTechnicianId) {
      toast.error("Please select a target technician.");
      return;
    }
    if (!transferForm.reason || transferForm.reason.trim().length < 3) {
      toast.error("Please provide a reason for the transfer (minimum 3 characters).");
      return;
    }

    setSubmittingTransfer(true);
    try {
      await api.post(`/repairs/${selectedRepair.id}/transfer-request`, {
        targetTechnicianId: transferForm.targetTechnicianId,
        reason: transferForm.reason.trim()
      });
      toast.success("Transfer request dispatched to specialist successfully.");
      setIsTransferModalOpen(false);
      fetchDashboardData();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit transfer request.");
    } finally {
      setSubmittingTransfer(false);
    }
  };

  const submitNote = async () => {
    if (!selectedRepair || !newNoteContent.trim() || submittingNote) return;
    setSubmittingNote(true);
    try {
      await api.post(`/repairs/${selectedRepair.id}/notes`, {
        note: newNoteContent.trim(),
        isInternal: true
      });
      setNewNoteContent('');
      toast.success("Note logged to repair thread.");
      fetchNotesForRepair(selectedRepair.id);
      fetchDashboardData();
    } catch (err: any) {
      toast.error(err.message || "Failed to add communication note.");
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleRespondTransfer = async (transferId: string, action: 'ACCEPT' | 'REJECT') => {
    setRespondingTransferId(transferId);
    try {
      await api.post(`/repair-transfers/${transferId}/respond`, { action });
      toast.success(action === 'ACCEPT' ? "Transfer accepted! Repair assigned to your workspace." : "Transfer request declined.");
      fetchDashboardData();
    } catch (err: any) {
      toast.error(err.message || "Failed to respond to transfer request.");
    } finally {
      setRespondingTransferId(null);
    }
  };

  const handleMarkNotificationRead = async (notifId: string) => {
    try {
      await api.post(`/notifications/${notifId}/read`, {});
      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, isRead: true } : n));
      setUnreadNotificationCount(prev => Math.max(0, prev - 1));
    } catch {
      // silent
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      await api.post('/notifications/mark-all-read', {});
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadNotificationCount(0);
      toast.success("All notifications marked as read");
    } catch {
      // silent
    }
  };

  // ============================================================================
  // FILTERING & STATS
  // ============================================================================

  const highPriorityRepairs = useMemo(() => {
    return repairs.filter(r => {
      const meta = getPriorityMeta(r);
      return meta.tier === 'URGENT' && !['REPAIRED', 'READY_FOR_PICKUP', 'DELIVERED', 'CANNOT_REPAIR', 'CANCELLED'].includes(r.status);
    });
  }, [repairs]);

  const priorityRepairs = useMemo(() => {
    return repairs.filter(r => {
      const meta = getPriorityMeta(r);
      return meta.tier === 'HIGH' && !['REPAIRED', 'READY_FOR_PICKUP', 'DELIVERED', 'CANNOT_REPAIR', 'CANCELLED'].includes(r.status);
    });
  }, [repairs]);

  const stats = useMemo(() => {
    const active = repairs.filter(r => !['REPAIRED', 'READY_FOR_PICKUP', 'DELIVERED', 'CANNOT_REPAIR', 'CANCELLED'].includes(r.status));
    const inProgress = repairs.filter(r => r.status === 'IN_PROCESS' || r.status === 'DIAGNOSING');
    const testing = repairs.filter(r => r.status === 'TESTING');
    const repaired = repairs.filter(r => ['REPAIRED', 'READY_FOR_PICKUP'].includes(r.status));
    const reProblem = repairs.filter(r => r.status === 'RE_PROBLEM' || r.status === 'REPROBLEM');
    
    return {
      activeCount: active.length,
      inProgressCount: inProgress.length,
      testingCount: testing.length,
      repairedCount: repaired.length,
      reProblemCount: reProblem.length,
      highPriorityCount: highPriorityRepairs.length,
      priorityCount: priorityRepairs.length,
      pendingTransfersCount: transferRequests.pendingIncomingCount
    };
  }, [repairs, highPriorityRepairs, priorityRepairs, transferRequests]);

  const filteredRepairs = useMemo(() => {
    let list = [...repairs];

    // Filter Tab
    if (activeTab === 'URGENT') {
      list = list.filter(r => getPriorityMeta(r).tier === 'URGENT' && !['REPAIRED', 'READY_FOR_PICKUP', 'DELIVERED', 'CANNOT_REPAIR', 'CANCELLED'].includes(r.status));
    } else if (activeTab === 'HIGH') {
      list = list.filter(r => getPriorityMeta(r).tier === 'HIGH' && !['REPAIRED', 'READY_FOR_PICKUP', 'DELIVERED', 'CANNOT_REPAIR', 'CANCELLED'].includes(r.status));
    } else if (activeTab === 'ACTIVE') {
      list = list.filter(r => !['REPAIRED', 'READY_FOR_PICKUP', 'DELIVERED', 'CANNOT_REPAIR', 'CANCELLED'].includes(r.status));
    } else if (activeTab === 'IN_PROCESS') {
      list = list.filter(r => r.status === 'IN_PROCESS' || r.status === 'DIAGNOSING');
    } else if (activeTab === 'WAITING_FOR_PARTS') {
      list = list.filter(r => r.status === 'WAITING_FOR_PARTS');
    } else if (activeTab === 'TESTING') {
      list = list.filter(r => r.status === 'TESTING');
    } else if (activeTab === 'REPAIRED') {
      list = list.filter(r => ['REPAIRED', 'READY_FOR_PICKUP'].includes(r.status));
    } else if (activeTab === 'RE_PROBLEM') {
      list = list.filter(r => r.status === 'RE_PROBLEM' || r.status === 'REPROBLEM');
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(r => 
        (r.repairNumber && r.repairNumber.toLowerCase().includes(q)) ||
        (r.customerName && r.customerName.toLowerCase().includes(q)) ||
        (r.customerPhone && r.customerPhone.toLowerCase().includes(q)) ||
        (r.deviceBrand && r.deviceBrand.toLowerCase().includes(q)) ||
        (r.deviceModel && r.deviceModel.toLowerCase().includes(q)) ||
        (r.problemDescription && r.problemDescription.toLowerCase().includes(q)) ||
        (r.remarks && r.remarks.toLowerCase().includes(q))
      );
    }

    // Sort
    if (sortBy === 'newest') {
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sortBy === 'oldest') {
      list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else if (sortBy === 'dueDate') {
      list.sort((a, b) => {
        if (!a.expectedCompletionDate) return 1;
        if (!b.expectedCompletionDate) return -1;
        return new Date(a.expectedCompletionDate).getTime() - new Date(b.expectedCompletionDate).getTime();
      });
    } else if (sortBy === 'priority') {
      const priorityScore = (r: any) => {
        const tier = getPriorityMeta(r).tier;
        if (tier === 'URGENT') return 3;
        if (tier === 'HIGH') return 2;
        return 1;
      };
      list.sort((a, b) => priorityScore(b) - priorityScore(a));
    }

    return list;
  }, [repairs, activeTab, searchQuery, sortBy]);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
        <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">Loading Technician Workspace...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 max-w-7xl mx-auto px-2 sm:px-4">
      
      {/* ========================================================================= */}
      {/* HEADER SECTION                                                            */}
      {/* ========================================================================= */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-5 sm:p-7 md:p-8 rounded-[28px] sm:rounded-3xl border border-slate-200/80 shadow-sm">
        <div className="space-y-1 max-w-2xl min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <Wrench className="h-7 w-7 text-indigo-600 shrink-0" />
              <span>Technician Workspace</span>
            </h1>
            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 font-bold text-[11px] px-2.5 py-0.5 rounded-full flex items-center gap-1.5 shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Sync
            </Badge>
          </div>
          <p className="text-slate-500 text-xs sm:text-sm font-medium leading-relaxed break-words">
            Welcome back, <span className="font-bold text-slate-800">{user?.name}</span>. You have <span className="font-bold text-indigo-600">{stats.activeCount} active repairs</span> requiring technical action.
          </p>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-2.5 w-full lg:w-auto justify-start sm:justify-end shrink-0">
          {/* Notification Bell Button */}
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsNotificationCenterOpen(true)}
            className="flex-1 sm:flex-initial rounded-2xl border-slate-200 h-10 sm:h-11 px-3.5 sm:px-4 relative flex items-center justify-center gap-2 bg-white hover:bg-slate-50 shadow-xs cursor-pointer"
          >
            <Bell className="h-4 w-4 text-slate-700" />
            <span className="font-bold text-xs text-slate-800">Alerts</span>
            {unreadNotificationCount > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 bg-rose-500 text-white rounded-full flex items-center justify-center text-[10px] font-black shadow-xs animate-bounce">
                {unreadNotificationCount}
              </span>
            )}
          </Button>

          {/* Quick Dashboard Refresh Button */}
          <DashboardRefreshButton
            onRefresh={fetchDashboardData}
            showLiveBadge={false}
            showLastUpdated={false}
            size="sm"
            label="Refresh"
            variant="outline"
            className="h-10 sm:h-11 rounded-2xl border-slate-200 font-bold text-xs shrink-0"
          />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 🚨 HIGH PRIORITY & PRIORITY REPAIRS ACTION QUEUE BANNER                    */}
      {/* ========================================================================= */}
      {highPriorityRepairs.length > 0 && (
        <div className="bg-gradient-to-r from-rose-500/15 via-red-500/10 to-amber-500/10 border-2 border-rose-500/40 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-md shadow-rose-600/30 animate-pulse shrink-0">
                <Flame className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-extrabold text-slate-900 text-base sm:text-lg">
                    High Priority Repairs Requiring Immediate Technical Action
                  </h3>
                  <Badge className="bg-rose-600 text-white font-black text-xs px-2.5 py-0.5 rounded-full shadow-xs">
                    {highPriorityRepairs.length} Urgent
                  </Badge>
                </div>
                <p className="text-xs text-slate-600 font-medium">
                  Assigned by Management. Please prioritize diagnostics, parts allocation, and resolution for these devices.
                </p>
              </div>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setActiveTab('URGENT')}
              className="rounded-xl border-rose-300 text-rose-700 bg-white hover:bg-rose-50 font-bold text-xs h-9 shadow-xs"
            >
              Filter High Priority
            </Button>
          </div>

          {/* Quick List of High Priority Devices */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {highPriorityRepairs.slice(0, 3).map((r) => (
              <div key={r.id} className="bg-white/95 backdrop-blur-sm rounded-2xl p-3.5 border border-rose-200/90 shadow-xs flex flex-col justify-between gap-2.5">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="font-mono font-bold text-xs bg-slate-900 text-white px-2 py-0.5 rounded-md truncate">
                      #{r.repairNumber}
                    </span>
                    <Badge className="bg-rose-100 text-rose-800 border-rose-300 text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                      <Flame className="h-3 w-3 text-rose-600" /> High Priority
                    </Badge>
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm truncate">
                    {r.deviceBrand} {r.deviceModel}
                  </h4>
                  <p className="text-xs text-slate-600 font-medium line-clamp-1">
                    {r.problemDescription || 'Diagnosis required'}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-rose-100/80 text-[11px]">
                  <span className="text-slate-500 font-semibold flex items-center gap-1">
                    <Clock className="h-3 w-3 text-slate-400" />
                    {formatTimeAgo(r.assignedAt || r.createdAt, tickerTime)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleOpenUpdateModal(r)}
                    className="font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    Action <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* INCOMING REPAIR TRANSFER REQUESTS BANNER                                  */}
      {/* ========================================================================= */}
      {transferRequests.incoming.filter(t => t.status === 'PENDING').length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 border-2 border-amber-400/40 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-md shadow-amber-500/30 shrink-0">
                <ArrowRightLeft className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-base sm:text-lg">
                  Incoming Repair Transfer Requests
                </h3>
                <p className="text-xs text-slate-600 font-medium">
                  Fellow technicians have requested to transfer tickets to your specialized workstation.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {transferRequests.incoming.filter(t => t.status === 'PENDING').map((transfer) => (
              <div key={transfer.id} className="bg-white rounded-2xl p-4 border border-amber-200 shadow-sm flex flex-col justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-xs bg-slate-900 text-white px-2 py-0.5 rounded-md">
                      #{transfer.repairNumber}
                    </span>
                    <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                      From: {transfer.senderTechnicianName}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 font-medium bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <b className="text-slate-900">Reason:</b> {transfer.reason}
                  </p>
                  <span className="text-[10px] text-slate-400 font-medium block">
                    Requested: {formatTimeAgo(transfer.createdAt, tickerTime)}
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                  <Button
                    size="sm"
                    disabled={respondingTransferId === transfer.id}
                    onClick={() => handleRespondTransfer(transfer.id, 'ACCEPT')}
                    className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 shadow-sm cursor-pointer"
                  >
                    {respondingTransferId === transfer.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                    Accept Job
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={respondingTransferId === transfer.id}
                    onClick={() => handleRespondTransfer(transfer.id, 'REJECT')}
                    className="flex-1 rounded-xl border-slate-200 text-slate-700 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 font-bold text-xs h-9 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5 mr-1" />
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* KPI METRIC CARDS                                                          */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {[
          { label: 'Active Jobs', value: stats.activeCount, icon: Wrench, color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-100', tab: 'ACTIVE' },
          { label: 'High Priority', value: stats.highPriorityCount, icon: Flame, color: 'text-rose-600', bg: 'bg-rose-50 border-rose-200', tab: 'URGENT' },
          { label: 'Priority', value: stats.priorityCount, icon: Zap, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', tab: 'HIGH' },
          { label: 'In Progress', value: stats.inProgressCount, icon: Smartphone, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100', tab: 'IN_PROCESS' },
          { label: 'Testing QA', value: stats.testingCount, icon: ShieldCheck, color: 'text-orange-600', bg: 'bg-orange-50 border-orange-100', tab: 'TESTING' },
          { label: 'Repaired', value: stats.repairedCount, icon: CheckCircle2, color: 'text-teal-600', bg: 'bg-teal-50 border-teal-100', tab: 'REPAIRED' },
          { label: 'Re-Problem', value: stats.reProblemCount, icon: RotateCcw, color: 'text-rose-600', bg: 'bg-rose-50 border-rose-100', tab: 'RE_PROBLEM' },
        ].map((item, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActiveTab(item.tab as StatusFilterTab)}
            className={cn(
              "p-3.5 sm:p-4 rounded-2xl border text-left transition-all hover:scale-[1.02] flex flex-col justify-between gap-2 shadow-sm cursor-pointer",
              item.bg,
              activeTab === item.tab && "ring-2 ring-indigo-500 shadow-md"
            )}
          >
            <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center bg-white shadow-xs", item.color)}>
              <item.icon className="h-4 w-4" />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900">{item.value}</div>
              <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 truncate">{item.label}</div>
            </div>
          </button>
        ))}
      </div>

      {/* ========================================================================= */}
      {/* ATTENDANCE & REPAIR-RELATED DAMAGE PERSONAL SUMMARY CARDS                  */}
      {/* ========================================================================= */}
      <UserOverviewCards />
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          
          {/* Scrollable Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full no-scrollbar">
            {[
              { key: 'ALL', label: 'All Jobs', count: repairs.length, color: 'normal' },
              { key: 'URGENT', label: '🔥 High Priority', count: stats.highPriorityCount, color: 'urgent' },
              { key: 'HIGH', label: '🟠 Priority', count: stats.priorityCount, color: 'priority' },
              { key: 'ACTIVE', label: 'Active', count: stats.activeCount, color: 'normal' },
              { key: 'IN_PROCESS', label: 'In Progress', count: stats.inProgressCount, color: 'normal' },
              { key: 'TESTING', label: 'Testing QA', count: stats.testingCount, color: 'normal' },
              { key: 'WAITING_FOR_PARTS', label: 'Parts Wait', count: repairs.filter(r => r.status === 'WAITING_FOR_PARTS').length, color: 'normal' },
              { key: 'REPAIRED', label: 'Repaired', count: stats.repairedCount, color: 'normal' },
              { key: 'RE_PROBLEM', label: 'Warranty Re-Problem', count: stats.reProblemCount, color: 'normal' },
            ].map(tab => {
              const isSelected = activeTab === tab.key;
              let styleClass = "bg-slate-50 hover:bg-slate-100 text-slate-600";

              if (isSelected) {
                if (tab.color === 'urgent') styleClass = "bg-rose-600 text-white shadow-sm";
                else if (tab.color === 'priority') styleClass = "bg-amber-500 text-slate-950 font-black shadow-sm";
                else styleClass = "bg-slate-900 text-white shadow-sm";
              } else {
                if (tab.color === 'urgent') styleClass = "bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200";
                else if (tab.color === 'priority') styleClass = "bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200";
              }

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key as StatusFilterTab)}
                  className={cn(
                    "px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 cursor-pointer",
                    styleClass
                  )}
                >
                  <span>{tab.label}</span>
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold",
                    isSelected 
                      ? (tab.color === 'urgent' ? "bg-rose-800 text-white" : (tab.color === 'priority' ? "bg-amber-700 text-white" : "bg-slate-800 text-slate-200"))
                      : (tab.color === 'urgent' ? "bg-rose-200 text-rose-800" : (tab.color === 'priority' ? "bg-amber-200 text-amber-900" : "bg-slate-200 text-slate-700"))
                  )}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-bold text-slate-400 hidden sm:inline">Sort:</span>
            <Select value={sortBy} onValueChange={(val: any) => setSortBy(val)}>
              <SelectTrigger className="h-9 rounded-xl border-slate-200 text-xs font-bold w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="newest" className="text-xs font-bold">Newest First</SelectItem>
                <SelectItem value="oldest" className="text-xs font-bold">Oldest First</SelectItem>
                <SelectItem value="dueDate" className="text-xs font-bold">By Due Date</SelectItem>
                <SelectItem value="priority" className="text-xs font-bold">By Priority (Highest)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by Repair #, Customer Name, Phone, Device Model, or Problem description..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10 h-11 rounded-2xl border-slate-200 bg-slate-50/70 text-xs sm:text-sm font-medium focus:bg-white transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* REPAIR CARDS GRID (RESPONSIVE FOR ALL SCREEN SIZES: SMARTPHONE, TABLET, DESKTOP) */}
      {/* ========================================================================= */}
      {filteredRepairs.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-slate-300 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center mx-auto">
            <Package className="h-6 w-6" />
          </div>
          <h3 className="font-bold text-slate-800 text-base">No repairs matching this criteria</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery ? "No repair tickets matched your search query. Try clearing search filters." : "You currently have no repair cases assigned under this filter tab."}
          </p>
          {searchQuery && (
            <Button size="sm" variant="outline" onClick={() => setSearchQuery('')} className="rounded-xl text-xs font-bold cursor-pointer">
              Reset Search Filters
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
          <AnimatePresence>
            {filteredRepairs.map((repair) => {
              const statusInfo = statusStyles[repair.status] || {
                label: repair.status.replace(/_/g, ' '),
                badge: 'bg-slate-100 text-slate-800 border-slate-300',
                bgSoft: 'bg-slate-50',
                border: 'border-slate-200'
              };

              const priorityMeta = getPriorityMeta(repair);
              const PriorityIcon = priorityMeta.icon;
              const isDescExpanded = !!expandedDescriptions[repair.id];
              const desc = repair.problemDescription || 'Inspection & diagnosis requested';
              const isLongDesc = desc.length > 110;

              return (
                <motion.div
                  key={repair.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className={cn(
                    "rounded-3xl border transition-all hover:shadow-xl overflow-hidden flex flex-col justify-between bg-white min-w-0",
                    priorityMeta.cardBorder
                  )}>
                    <CardHeader className={cn("p-4 sm:p-5 pb-3 space-y-3", priorityMeta.headerBg)}>
                      
                      {/* Top Badges Row */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-black text-xs bg-slate-950 text-white px-2.5 py-1 rounded-xl shadow-xs">
                            #{repair.repairNumber}
                          </span>

                          {/* 3-Tier Priority Indicator */}
                          <Badge className={cn("text-[10px] uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1 shrink-0", priorityMeta.badgeClass)}>
                            <PriorityIcon className="h-3 w-3" />
                            <span>{priorityMeta.label}</span>
                          </Badge>
                        </div>

                        {/* Status Badge */}
                        <Badge className={cn("text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border shrink-0", statusInfo.badge)}>
                          {statusInfo.label}
                        </Badge>
                      </div>

                      {/* Device Title */}
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                            <Smartphone className="h-4 w-4 text-indigo-600" />
                          </div>
                          <h3 className="font-black text-slate-900 text-base sm:text-lg leading-tight truncate">
                            {repair.deviceBrand} {repair.deviceModel}
                          </h3>
                        </div>

                        {/* Problem Description Area with Expandable View */}
                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/70 space-y-1 mt-2">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                            Customer Device Problem:
                          </span>
                          <p className={cn(
                            "text-xs text-slate-700 font-medium leading-relaxed break-words",
                            !isDescExpanded && isLongDesc && "line-clamp-2"
                          )}>
                            {desc}
                          </p>

                          {isLongDesc && (
                            <button
                              type="button"
                              onClick={() => toggleDescription(repair.id)}
                              className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 pt-1 cursor-pointer"
                            >
                              {isDescExpanded ? (
                                <><span>View Less</span> <ChevronUp className="h-3 w-3" /></>
                              ) : (
                                <><span>View More</span> <ChevronDown className="h-3 w-3" /></>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 sm:p-5 pt-0 space-y-3.5">
                      
                      {/* Timing & Attribution Information */}
                      <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-100 space-y-1.5">
                        {/* Primary Assignment Elapsed Time */}
                        <div className="flex items-center justify-between text-xs gap-2">
                          <span className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
                            <Clock className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                            <span className="font-bold text-slate-700">Assigned:</span>
                          </span>
                          <span className="font-bold text-indigo-700 text-[11px] sm:text-xs truncate">
                            {formatTimeAgo(repair.assignedAt || repair.createdAt, tickerTime)}
                          </span>
                        </div>

                        {/* Secondary Manager Update Timestamp */}
                        {(repair.managerUpdatedAt || repair.priorityUpdatedAt || repair.updatedAt) && (
                          <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-400 pt-1 border-t border-slate-200/60 gap-2">
                            <span className="font-medium text-slate-500 flex items-center gap-1 truncate">
                              <History className="h-3 w-3 text-slate-400 shrink-0" />
                              <span>Manager update</span>
                            </span>
                            <span className="font-semibold text-slate-600 shrink-0">
                              {formatShortTimeAgo(repair.managerUpdatedAt || repair.priorityUpdatedAt || repair.updatedAt, tickerTime)}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Customer & Scheduling Metadata Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
                        <div className="min-w-0">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">Customer</span>
                          <span className="font-bold text-slate-800 truncate block" title={repair.customerName}>
                            {repair.customerName || 'Customer'}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">Intake Date</span>
                          <span className="font-semibold text-slate-700 block truncate">
                            {repair.createdAt ? format(new Date(repair.createdAt), 'dd MMM yyyy') : 'N/A'}
                          </span>
                        </div>
                        <div className="col-span-2 sm:col-span-1 min-w-0">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">Target Due</span>
                          <span className={cn(
                            "font-bold block truncate",
                            repair.expectedCompletionDate ? "text-indigo-600" : "text-slate-400 font-normal"
                          )}>
                            {repair.expectedCompletionDate ? format(new Date(repair.expectedCompletionDate), 'dd MMM yyyy') : 'Not scheduled'}
                          </span>
                        </div>
                      </div>

                      {/* Parts Used / Remarks preview if available */}
                      {repair.partsUsed && (
                        <div className="text-[11px] text-slate-600 flex items-center gap-1.5 font-medium bg-purple-50/60 p-2 rounded-xl border border-purple-100 truncate">
                          <Package className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                          <span className="truncate"><b>Parts:</b> {repair.partsUsed}</span>
                        </div>
                      )}

                      {/* Action Buttons Row */}
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                        {/* 1. Update Progress */}
                        <Button
                          size="sm"
                          onClick={() => handleOpenUpdateModal(repair)}
                          className="flex-1 min-w-[120px] rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 shadow-sm cursor-pointer"
                        >
                          <Wrench className="h-3.5 w-3.5 mr-1.5" />
                          Update Progress
                        </Button>

                        {/* 2. Communication & Notes */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenNotesModal(repair)}
                          className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100 font-bold text-xs h-9 px-3 cursor-pointer shrink-0"
                          title="View & Add Notes"
                        >
                          <MessageSquare className="h-3.5 w-3.5 mr-1 text-slate-500" />
                          Notes
                        </Button>

                        {/* 3. Transfer Request */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenTransferModal(repair)}
                          className="rounded-xl border-slate-200 text-slate-700 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-200 font-bold text-xs h-9 px-3 cursor-pointer shrink-0"
                          title="Transfer to another Specialist"
                        >
                          <ArrowRightLeft className="h-3.5 w-3.5 mr-1 text-amber-600" />
                          Transfer
                        </Button>

                        {/* 4. Full Details */}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate(`/dashboard/repairs/${repair.id}`)}
                          className="rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 h-9 px-2.5 cursor-pointer shrink-0"
                          title="View Complete Vault Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. UPDATE STATUS MODAL                                                    */}
      {/* ========================================================================= */}
      <Dialog open={isUpdateModalOpen} onOpenChange={setIsUpdateModalOpen}>
        <DialogContent className="max-w-md w-full max-h-[90vh] overflow-y-auto rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-2xl bg-white space-y-4">
          <DialogHeader>
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-1 border border-indigo-100">
              <Wrench className="h-5 w-5" />
            </div>
            <DialogTitle className="text-xl font-extrabold text-slate-900">
              Update Repair #{selectedRepair?.repairNumber}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {selectedRepair?.deviceBrand} {selectedRepair?.deviceModel} — Customer: {selectedRepair?.customerName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Status Select */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Repair Status</Label>
              <Select
                value={updateForm.status}
                onValueChange={(val) => setUpdateForm(prev => ({ ...prev, status: val }))}
              >
                <SelectTrigger className="h-11 rounded-2xl border-slate-200 text-xs font-bold">
                  <SelectValue placeholder="Select Status" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {REPAIR_STATUS_FLOW.map(s => {
                    const info = statusStyles[s] || { label: s };
                    return (
                      <SelectItem key={s} value={s} className="text-xs font-bold py-2">
                        {info.label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Target Expected Date */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Estimated Delivery Date</Label>
              <Input
                type="date"
                value={updateForm.expectedCompletionDate}
                onChange={e => setUpdateForm(prev => ({ ...prev, expectedCompletionDate: e.target.value }))}
                className="h-11 rounded-2xl border-slate-200 text-xs font-medium"
              />
            </div>

            {/* Parts Consumed / Installed */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Spare Parts Used (Optional)</Label>
              <Input
                placeholder="e.g. Original OLED Panel, Battery Pack 5000mAh..."
                value={updateForm.partsUsed}
                onChange={e => setUpdateForm(prev => ({ ...prev, partsUsed: e.target.value }))}
                className="h-11 rounded-2xl border-slate-200 text-xs font-medium"
              />
            </div>

            {/* Technical Log Note */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Technical Work Log Note (Optional)</Label>
              <Textarea
                placeholder="Describe diagnostics performed, test voltages, micro-soldering, or parts replacement..."
                value={updateForm.note}
                onChange={e => setUpdateForm(prev => ({ ...prev, note: e.target.value }))}
                className="min-h-[90px] rounded-2xl border-slate-200 text-xs font-medium p-3"
              />
            </div>
          </div>

          <DialogFooter className="flex flex-row items-center gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsUpdateModalOpen(false)}
              className="flex-1 rounded-2xl border-slate-200 text-slate-700 h-11 text-xs font-bold cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={submittingUpdate}
              onClick={submitStatusUpdate}
              className="flex-1 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white h-11 text-xs font-bold shadow-md cursor-pointer"
            >
              {submittingUpdate ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Progress"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 2. REPAIR TRANSFER MODAL                                                  */}
      {/* ========================================================================= */}
      <Dialog open={isTransferModalOpen} onOpenChange={setIsTransferModalOpen}>
        <DialogContent className="max-w-md w-full rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-2xl bg-white space-y-4">
          <DialogHeader>
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-1 border border-amber-100">
              <ArrowRightLeft className="h-5 w-5" />
            </div>
            <DialogTitle className="text-xl font-extrabold text-slate-900">
              Transfer Repair #{selectedRepair?.repairNumber}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Transfer this job to another certified MTS Lab technician or lead specialist.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Target Specialist</Label>
              <Select
                value={transferForm.targetTechnicianId}
                onValueChange={(val) => setTransferForm(prev => ({ ...prev, targetTechnicianId: val }))}
              >
                <SelectTrigger className="h-11 rounded-2xl border-slate-200 text-xs font-bold">
                  <SelectValue placeholder="Select Technician" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {technicians.map(t => (
                    <SelectItem key={t.id} value={t.id} className="text-xs font-bold py-2">
                      {t.name} ({t.role.replace(/_/g, ' ')})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Reason for Transfer</Label>
              <Textarea
                placeholder="Explain why this repair requires transfer (e.g. requires ultrasonic micro-soldering, FaceID programming tool, shift change)..."
                value={transferForm.reason}
                onChange={e => setTransferForm(prev => ({ ...prev, reason: e.target.value }))}
                className="min-h-[100px] rounded-2xl border-slate-200 text-xs font-medium p-3"
              />
            </div>
          </div>

          <DialogFooter className="flex flex-row items-center gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsTransferModalOpen(false)}
              className="flex-1 rounded-2xl border-slate-200 text-slate-700 h-11 text-xs font-bold cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={submittingTransfer}
              onClick={submitTransferRequest}
              className="flex-1 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black h-11 text-xs shadow-md cursor-pointer"
            >
              {submittingTransfer ? <Loader2 className="h-4 w-4 animate-spin" /> : "Dispatch Transfer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 3. NOTES & COMMUNICATION THREAD MODAL                                     */}
      {/* ========================================================================= */}
      <Dialog open={isNotesModalOpen} onOpenChange={setIsNotesModalOpen}>
        <DialogContent className="max-w-lg w-full max-h-[90vh] flex flex-col rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-2xl bg-white space-y-4">
          <DialogHeader>
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-1 border border-blue-100">
              <MessageSquare className="h-5 w-5" />
            </div>
            <DialogTitle className="text-xl font-extrabold text-slate-900">
              Diagnostic Notes — #{selectedRepair?.repairNumber}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Internal technical notes, voltage readings, and communication history.
            </DialogDescription>
          </DialogHeader>

          {/* Notes List */}
          <div className="flex-1 overflow-y-auto max-h-[300px] space-y-2.5 pr-1">
            {loadingNotes ? (
              <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading notes thread...
              </div>
            ) : repairNotes.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                No diagnostic notes logged yet for this repair case.
              </div>
            ) : (
              repairNotes.map((note: any) => (
                <div key={note.id} className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-1">
                  <div className="flex items-center justify-between text-[11px] gap-2">
                    <span className="font-bold text-slate-800">
                      {note.technician?.name || note.authorName || 'Staff Specialist'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {formatTimeAgo(note.createdAt, tickerTime)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 font-medium whitespace-pre-wrap">
                    {note.note}
                  </p>
                </div>
              ))
            )}
          </div>

          {/* New Note Form */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <Textarea
              placeholder="Type technical note or diagnostic observation..."
              value={newNoteContent}
              onChange={e => setNewNoteContent(e.target.value)}
              className="min-h-[80px] rounded-2xl border-slate-200 text-xs font-medium p-3"
            />
            <Button
              type="button"
              disabled={submittingNote || !newNoteContent.trim()}
              onClick={submitNote}
              className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white h-11 text-xs font-bold shadow-md cursor-pointer"
            >
              {submittingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                <><Send className="h-3.5 w-3.5 mr-1.5" /> Post Diagnostic Note</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 4. NOTIFICATION & PRIORITY ALERT CENTER MODAL                             */}
      {/* ========================================================================= */}
      <Dialog open={isNotificationCenterOpen} onOpenChange={setIsNotificationCenterOpen}>
        <DialogContent className="max-w-lg w-full max-h-[85vh] flex flex-col rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-2xl bg-white space-y-4">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                  <Bell className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-extrabold text-slate-900">
                    Technician Alerts & Priority Feed
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-500">
                    Real-time assignment notices, high-priority alerts, and transfer requests.
                  </DialogDescription>
                </div>
              </div>

              {unreadNotificationCount > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleMarkAllNotificationsRead}
                  className="rounded-xl text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 h-8"
                >
                  <CheckCheck className="h-3.5 w-3.5 mr-1" /> Mark all read
                </Button>
              )}
            </div>
          </DialogHeader>

          {/* Notifications Feed */}
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 max-h-[420px]">
            {notifications.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <Bell className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                No alerts or notifications recorded in your feed.
              </div>
            ) : (
              notifications.map((notif: any) => {
                const isUrgent = notif.type === 'REPAIR_URGENT' || String(notif.title || '').includes('Urgent') || String(notif.title || '').includes('High Priority');
                const isPriority = notif.type === 'REPAIR_ALERT' || String(notif.title || '').includes('Priority');

                return (
                  <div
                    key={notif.id}
                    onClick={() => {
                      if (!notif.isRead) handleMarkNotificationRead(notif.id);
                      if (notif.repairId) {
                        setIsNotificationCenterOpen(false);
                        navigate(`/dashboard/repairs/${notif.repairId}`);
                      }
                    }}
                    className={cn(
                      "p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3",
                      notif.isRead ? "bg-white border-slate-100 opacity-80" : "bg-indigo-50/40 border-indigo-200 shadow-xs",
                      isUrgent && !notif.isRead && "bg-rose-50/60 border-rose-300"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
                      isUrgent ? "bg-rose-600 text-white" : (isPriority ? "bg-amber-500 text-slate-950" : "bg-indigo-100 text-indigo-700")
                    )}>
                      {isUrgent ? <Flame className="h-4 w-4" /> : (isPriority ? <Zap className="h-4 w-4" /> : <Bell className="h-4 w-4" />)}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className={cn("text-xs font-black truncate", isUrgent ? "text-rose-950" : "text-slate-900")}>
                          {notif.title}
                        </h4>
                        <span className="text-[10px] text-slate-400 font-medium shrink-0">
                          {formatTimeAgo(notif.createdAt, tickerTime)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 font-medium leading-relaxed break-words">
                        {notif.message}
                      </p>
                      {notif.repairNumber && (
                        <span className="inline-block font-mono font-bold text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md mt-1">
                          Ticket #{notif.repairNumber}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter className="pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsNotificationCenterOpen(false)}
              className="w-full rounded-2xl border-slate-200 text-slate-700 h-10 text-xs font-bold cursor-pointer"
            >
              Close Alert Center
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
