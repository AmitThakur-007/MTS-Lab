import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Briefcase,
  Users,
  Wrench,
  Clock,
  CircleCheck as CheckCircle2,
  AlertCircle,
  Smartphone,
  Search,
  Filter,
  Plus,
  ArrowRightLeft,
  UserCheck,
  UserX,
  FileSpreadsheet,
  RefreshCw,
  Phone,
  Flame,
  ShieldCheck,
  Send,
  Eye,
  Check,
  X,
  Loader2,
  Calendar,
  Layers,
  ChevronDown,
  AlertTriangle,
  RotateCcw,
  Zap,
  MoreVertical,
  Activity,
  SlidersHorizontal,
  BatteryCharging,
  Package,
  ArrowRight,
  FileWarning
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu';
import { api } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { useRealtimeSync } from '@/services/realtime';
import { toast } from 'sonner';
import {
  format,
  isToday,
  isYesterday,
  isThisWeek,
  isThisMonth,
  parseISO,
  startOfDay,
  endOfDay
} from 'date-fns';
import { cn } from '@/lib/utils';
import DashboardRefreshButton from '@/components/DashboardRefreshButton';
import UserOverviewCards from '@/components/dashboard/UserOverviewCards';
import { formatNPR } from '@/lib/format';

const statusConfig: Record<string, { label: string; badge: string; bgSoft: string; textClass: string }> = {
  PENDING: { label: 'Pending', badge: 'bg-amber-100 text-amber-900 border-amber-300', bgSoft: 'bg-amber-50', textClass: 'text-amber-800' },
  RECEIVED: { label: 'Received', badge: 'bg-sky-100 text-sky-900 border-sky-300', bgSoft: 'bg-sky-50', textClass: 'text-sky-800' },
  DIAGNOSING: { label: 'Diagnosing', badge: 'bg-blue-100 text-blue-900 border-blue-300', bgSoft: 'bg-blue-50', textClass: 'text-blue-800' },
  IN_PROCESS: { label: 'In Progress', badge: 'bg-indigo-100 text-indigo-900 border-indigo-300', bgSoft: 'bg-indigo-50', textClass: 'text-indigo-800' },
  WAITING_FOR_PARTS: { label: 'Parts Pending', badge: 'bg-purple-100 text-purple-900 border-purple-300', bgSoft: 'bg-purple-50', textClass: 'text-purple-800' },
  TESTING: { label: 'Testing QA', badge: 'bg-orange-100 text-orange-900 border-orange-300', bgSoft: 'bg-orange-50', textClass: 'text-orange-800' },
  REPAIRED: { label: 'Repaired', badge: 'bg-teal-100 text-teal-900 border-teal-300', bgSoft: 'bg-teal-50', textClass: 'text-teal-800' },
  READY_FOR_PICKUP: { label: 'Ready for Pickup', badge: 'bg-emerald-600 text-white border-transparent', bgSoft: 'bg-emerald-50', textClass: 'text-emerald-800' },
  DELIVERED: { label: 'Delivered', badge: 'bg-slate-200 text-slate-800 border-slate-300', bgSoft: 'bg-slate-50', textClass: 'text-slate-700' },
  RE_PROBLEM: { label: 'Re-Problem (Warranty)', badge: 'bg-rose-100 text-rose-800 border-rose-300 font-bold', bgSoft: 'bg-rose-50', textClass: 'text-rose-800' },
  REPROBLEM: { label: 'Re-Problem (Warranty)', badge: 'bg-rose-100 text-rose-800 border-rose-300 font-bold', bgSoft: 'bg-rose-50', textClass: 'text-rose-800' },
  REPROBLEM_FIXED: { label: 'Warranty Fixed', badge: 'bg-teal-100 text-teal-800 border-teal-300', bgSoft: 'bg-teal-50', textClass: 'text-teal-800' },
  CANNOT_REPAIR: { label: 'Cannot Repair', badge: 'bg-rose-100 text-rose-800 border-rose-300', bgSoft: 'bg-rose-50', textClass: 'text-rose-800' },
};

type DateFilterOption = 'ALL' | 'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'CUSTOM';

// Static array to ensure stable hook dependencies across renders
const MANAGER_REALTIME_ENTITIES = ['repair', 'technicianNote', 'repairTransfer', 'repairLog', 'notification', 'user'];

export default function ManagerDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  // Core Data States
  const [repairs, setRepairs] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [workload, setWorkload] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    totalRepairs: 0,
    pending: 0,
    assigned: 0,
    inProgress: 0,
    repaired: 0,
    ready: 0,
    delivered: 0,
    reproblem: 0,
    unassigned: 0,
    urgentCount: 0,
    highCount: 0
  });
  const [loading, setLoading] = useState(true);

  // Filters and Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [techFilter, setTechFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<DateFilterOption>('ALL');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'repairNumber' | 'customer' | 'priority'>('newest');

  // Modals & Action States
  const [selectedRepair, setSelectedRepair] = useState<any | null>(null);

  // Assign Modal
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignTechId, setAssignTechId] = useState('');
  const [assignPriority, setAssignPriority] = useState('NORMAL');
  const [assigning, setAssigning] = useState(false);

  // Transfer Modal
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferTechId, setTransferTechId] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [transferPriority, setTransferPriority] = useState('NORMAL');
  const [transferring, setTransferring] = useState(false);

  // Note Modal
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);

  // Status Change Modal
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Export state
  const [exportingExcel, setExportingExcel] = useState(false);

  // Repair-Related Damage team overview
  const [damageOverview, setDamageOverview] = useState<any>(null);

  // Fetch all core manager data with optional silent background execution
  const fetchData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [repairsRes, statsRes, workloadRes, staffRes, damageRes] = await Promise.all([
        api.get('/repairs'),
        api.get('/manager/stats').catch(() => null),
        api.get('/manager/workload').catch(() => []),
        api.get('/staff').catch(() => []),
        api.get('/repair-damage/overview').catch(() => null)
      ]);

      if (damageRes) setDamageOverview(damageRes);

      const repairList = Array.isArray(repairsRes) ? repairsRes : (repairsRes?.repairs || []);
      setRepairs(repairList);

      if (statsRes) {
        setStats(statsRes);
      } else {
        // Fallback local computation
        let unassigned = 0;
        let inProg = 0;
        let rep = 0;
        let ready = 0;
        let delivered = 0;
        let reproblem = 0;
        let urgent = 0;
        let high = 0;
        let pending = 0;
        let assigned = 0;

        repairList.forEach((r: any) => {
          const s = (r.status || '').toUpperCase();
          if (!r.technicianId && s !== 'DELIVERED' && s !== 'CANCELLED') unassigned++;
          if (r.technicianId && s !== 'DELIVERED' && s !== 'CANCELLED') assigned++;
          if (s === 'PENDING' || s === 'RECEIVED') pending++;
          if (s === 'IN_PROCESS' || s === 'DIAGNOSING' || s === 'TESTING' || s === 'WAITING_FOR_PARTS') inProg++;
          if (s === 'REPAIRED') rep++;
          if (s === 'READY_FOR_PICKUP') ready++;
          if (s === 'DELIVERED') delivered++;
          if (s === 'RE_PROBLEM' || s === 'REPROBLEM') reproblem++;
          if (r.priority === 'URGENT') urgent++;
          if (r.priority === 'HIGH') high++;
        });

        setStats({
          totalRepairs: repairList.length,
          pending,
          assigned,
          inProgress: inProg,
          repaired: rep,
          ready,
          delivered,
          reproblem,
          unassigned,
          urgentCount: urgent,
          highCount: high
        });
      }

      if (Array.isArray(workloadRes) && workloadRes.length > 0) {
        setWorkload(workloadRes);
      }

      const activeTechs = (Array.isArray(staffRes) ? staffRes : []).filter(
        (s: any) => ['TECHNICIAN', 'LEAD_TECHNICIAN'].includes(s.role) && s.isActive !== false
      );
      setTechnicians(activeTechs);

    } catch (err: any) {
      console.error("[MANAGER DASHBOARD ERROR]", err);
      if (!silent) toast.error(err.message || "Failed to load manager dashboard.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Debounced realtime synchronization to prevent infinite re-render cycles
  const realtimeDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (realtimeDebounceTimerRef.current) {
        clearTimeout(realtimeDebounceTimerRef.current);
      }
    };
  }, []);

  const handleRealtimeUpdate = useCallback(() => {
    if (realtimeDebounceTimerRef.current) {
      clearTimeout(realtimeDebounceTimerRef.current);
    }
    realtimeDebounceTimerRef.current = setTimeout(() => {
      fetchData(true);
    }, 500);
  }, [fetchData]);

  useRealtimeSync(MANAGER_REALTIME_ENTITIES, handleRealtimeUpdate);

  // Filtered & Sorted Repairs computation
  const filteredRepairs = useMemo(() => {
    return repairs.filter((r) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const repNum = (r.repairNumber || '').toLowerCase();
        const custName = (r.customerName || r.customer?.name || '').toLowerCase();
        const custPhone = (r.customerPhone || r.customer?.phone || '').toLowerCase();
        const brandModel = `${r.deviceBrand || ''} ${r.deviceModel || ''}`.toLowerCase();
        const imei = (r.imeiNumber || '').toLowerCase();

        const matches = repNum.includes(q) ||
          custName.includes(q) ||
          custPhone.includes(q) ||
          brandModel.includes(q) ||
          imei.includes(q);

        if (!matches) return false;
      }

      // 2. Status Filter
      if (statusFilter === 'UNASSIGNED') {
        if (r.technicianId || r.status === 'DELIVERED' || r.status === 'CANCELLED') return false;
      } else if (statusFilter === 'IN_PROGRESS') {
        if (!['IN_PROCESS', 'DIAGNOSING', 'WAITING_FOR_PARTS', 'TESTING'].includes(r.status)) return false;
      } else if (statusFilter === 'REPAIRED') {
        if (!['REPAIRED', 'READY_FOR_PICKUP'].includes(r.status)) return false;
      } else if (statusFilter === 'RE_PROBLEM') {
        if (!['RE_PROBLEM', 'REPROBLEM'].includes(r.status)) return false;
      } else if (statusFilter !== 'ALL') {
        if (r.status !== statusFilter) return false;
      }

      // 3. Technician Filter
      if (techFilter === 'UNASSIGNED') {
        if (r.technicianId) return false;
      } else if (techFilter !== 'ALL') {
        if (r.technicianId !== techFilter) return false;
      }

      // 4. Priority Filter
      if (priorityFilter !== 'ALL') {
        if ((r.priority || 'NORMAL').toUpperCase() !== priorityFilter) return false;
      }

      // 5. Date Filter
      if (dateFilter !== 'ALL' && r.createdAt) {
        try {
          const date = typeof r.createdAt === 'string' ? parseISO(r.createdAt) : new Date(r.createdAt);
          if (dateFilter === 'TODAY' && !isToday(date)) return false;
          if (dateFilter === 'YESTERDAY' && !isYesterday(date)) return false;
          if (dateFilter === 'THIS_WEEK' && !isThisWeek(date, { weekStartsOn: 0 })) return false;
          if (dateFilter === 'THIS_MONTH' && !isThisMonth(date)) return false;
          if (dateFilter === 'CUSTOM') {
            if (customStartDate) {
              const start = startOfDay(parseISO(customStartDate));
              if (date < start) return false;
            }
            if (customEndDate) {
              const end = endOfDay(parseISO(customEndDate));
              if (date > end) return false;
            }
          }
        } catch (e) {
          // ignore date parse errors
        }
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }
      if (sortBy === 'oldest') {
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      }
      if (sortBy === 'repairNumber') {
        return (a.repairNumber || '').localeCompare(b.repairNumber || '');
      }
      if (sortBy === 'customer') {
        return (a.customerName || '').localeCompare(b.customerName || '');
      }
      if (sortBy === 'priority') {
        const prioScore: Record<string, number> = { URGENT: 3, HIGH: 2, NORMAL: 1 };
        return (prioScore[b.priority || 'NORMAL'] || 1) - (prioScore[a.priority || 'NORMAL'] || 1);
      }
      return 0;
    });
  }, [repairs, searchQuery, statusFilter, techFilter, priorityFilter, dateFilter, customStartDate, customEndDate, sortBy]);

  // Handlers for Manager Actions
  const handleOpenAssignModal = (repair: any) => {
    setSelectedRepair(repair);
    setAssignTechId(repair.technicianId || '');
    setAssignPriority(repair.priority || 'NORMAL');
    setIsAssignModalOpen(true);
  };

  const handleConfirmAssign = async () => {
    if (!selectedRepair) return;
    setAssigning(true);
    try {
      await api.post(`/repairs/${selectedRepair.id}/assign`, {
        technicianId: assignTechId || null
      });

      if (assignPriority !== (selectedRepair.priority || 'NORMAL')) {
        await api.patch(`/repairs/${selectedRepair.id}/priority`, {
          priority: assignPriority
        });
      }

      toast.success(assignTechId ? "Technician assigned successfully." : "Repair marked as unassigned.");
      setIsAssignModalOpen(false);
      setSelectedRepair(null);
      fetchData(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to assign technician.");
    } finally {
      setAssigning(false);
    }
  };

  const handleOpenTransferModal = (repair: any) => {
    setSelectedRepair(repair);
    setTransferTechId('');
    setTransferReason('');
    setTransferPriority(repair.priority || 'NORMAL');
    setIsTransferModalOpen(true);
  };

  const handleConfirmTransfer = async () => {
    if (!selectedRepair || !transferTechId) {
      toast.error("Please select a target technician.");
      return;
    }
    if (!transferReason.trim()) {
      toast.error("Please provide a transfer reason or instruction.");
      return;
    }

    setTransferring(true);
    try {
      await api.post(`/repairs/${selectedRepair.id}/transfer`, {
        targetTechnicianId: transferTechId,
        reason: transferReason.trim(),
        priority: transferPriority
      });

      toast.success("Repair transferred and specialist notified.");
      setIsTransferModalOpen(false);
      setSelectedRepair(null);
      fetchData(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to transfer repair.");
    } finally {
      setTransferring(false);
    }
  };

  const handleOpenNoteModal = (repair: any) => {
    setSelectedRepair(repair);
    setNoteContent('');
    setIsNoteModalOpen(true);
  };

  const handleConfirmNote = async () => {
    if (!selectedRepair || !noteContent.trim()) {
      toast.error("Please enter a note before submitting.");
      return;
    }

    setSubmittingNote(true);
    try {
      await api.post(`/repairs/${selectedRepair.id}/notes`, {
        note: noteContent.trim(),
        isInternal: true
      });

      toast.success("Managerial instruction / note added.");
      setIsNoteModalOpen(false);
      setSelectedRepair(null);
      fetchData(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to add internal note.");
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleOpenStatusModal = (repair: any) => {
    setSelectedRepair(repair);
    setNewStatus(repair.status);
    setStatusNote('');
    setIsStatusModalOpen(true);
  };

  const handleConfirmStatusUpdate = async () => {
    if (!selectedRepair || !newStatus) return;
    setUpdatingStatus(true);
    try {
      await api.patch(`/repairs/${selectedRepair.id}/status`, {
        status: newStatus,
        note: statusNote.trim() || undefined
      });

      toast.success(`Status updated to ${newStatus.replace(/_/g, ' ')}`);
      setIsStatusModalOpen(false);
      setSelectedRepair(null);
      fetchData(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to update status.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleTogglePriority = async (repair: any, nextPriority: string) => {
    try {
      await api.patch(`/repairs/${repair.id}/priority`, { priority: nextPriority });
      toast.success(`Priority set to ${nextPriority}`);
      fetchData(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to update priority.");
    }
  };

  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      const queryParams = new URLSearchParams();
      if (statusFilter !== 'ALL') queryParams.set('status', statusFilter);
      if (techFilter !== 'ALL') queryParams.set('technicianId', techFilter);
      if (searchQuery.trim()) queryParams.set('search', searchQuery.trim());
      if (dateFilter === 'CUSTOM') {
        if (customStartDate) queryParams.set('startDate', customStartDate);
        if (customEndDate) queryParams.set('endDate', customEndDate);
      }

      const res = await fetch(`/api/repairs/export?${queryParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        }
      });

      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `MTS_Lab_Manager_Repairs_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Repair records exported successfully.");
    } catch (err: any) {
      toast.error(err.message || "Failed to export Excel.");
    } finally {
      setExportingExcel(false);
    }
  };

  return (
    <div className="space-y-8 pb-32 max-w-7xl mx-auto px-2 sm:px-4">
      {/* 1. Header Banner */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-5 sm:p-7 md:p-8 rounded-[28px] sm:rounded-[32px] border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="space-y-1.5 z-10 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200 font-bold px-3 py-1 rounded-xl text-xs flex items-center gap-1.5">
              <Briefcase className="h-3.5 w-3.5 text-blue-600" />
              Repair Operations Hub
            </Badge>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200 font-bold px-2.5 py-1 rounded-xl text-xs flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Operations Active
            </Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            Manager Control Center
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed">
            Coordinate technicians, reassign workloads, track real-time diagnosis milestones, and enforce quality control across the repair floor.
          </p>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-2.5 z-10 w-full lg:w-auto justify-start sm:justify-end shrink-0">
          <Button
            variant="outline"
            onClick={handleExportExcel}
            disabled={exportingExcel}
            className="flex-1 sm:flex-initial h-10 sm:h-11 px-3.5 sm:px-4 rounded-2xl border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-xs flex items-center justify-center gap-1.5"
          >
            {exportingExcel ? <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" /> : <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />}
            <span>Export Excel</span>
          </Button>

          <Button
            onClick={() => navigate('/dashboard/repairs/new')}
            className="flex-1 sm:flex-initial h-10 sm:h-11 px-4 sm:px-5 rounded-2xl bg-slate-900 hover:bg-black text-white font-bold text-xs shadow-md shadow-slate-900/10 flex items-center justify-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            <span>New Ticket</span>
          </Button>

          <DashboardRefreshButton
            onRefresh={() => fetchData(false)}
            showLiveBadge={false}
            showLastUpdated={false}
            size="sm"
            label="Refresh"
            variant="outline"
            className="h-10 sm:h-11 rounded-2xl border-slate-200 font-bold text-xs shrink-0"
          />
        </div>
      </div>

      {/* Quick Access Hubs for Operations */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
        <div
          onClick={() => navigate('/dashboard/attendance')}
          className="group flex items-center justify-between p-4 sm:p-5 rounded-[22px] sm:rounded-[24px] bg-gradient-to-r from-blue-950 to-indigo-900 text-white shadow-md hover:shadow-xl transition-all cursor-pointer border border-blue-800/60"
        >
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 pr-2">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-white/10 flex items-center justify-center text-blue-300 group-hover:scale-110 transition-transform shrink-0">
              <UserCheck className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h3 className="font-black text-sm tracking-tight text-white truncate">Attendance</h3>
                <Badge className="bg-blue-500/20 text-blue-200 border-0 text-[10px] font-bold shrink-0">10:00–10:45 AM</Badge>
              </div>
              <p className="text-xs text-blue-200/90 font-medium mt-0.5 line-clamp-1">Mark attendance & confirm staff presence</p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-blue-300 group-hover:text-white group-hover:translate-x-1 transition-all shrink-0" />
        </div>

        <div
          onClick={() => navigate('/dashboard/inventory')}
          className="group flex items-center justify-between p-4 sm:p-5 rounded-[22px] sm:rounded-[24px] bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-md hover:shadow-xl transition-all cursor-pointer border border-slate-700/60"
        >
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 pr-2">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-white/10 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform shrink-0">
              <Package className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h3 className="font-black text-sm tracking-tight text-white truncate">Inventory Hub</h3>
                <Badge className="bg-emerald-500/20 text-emerald-300 border-0 text-[10px] font-bold shrink-0">Parts & Stock</Badge>
              </div>
              <p className="text-xs text-slate-300 font-medium mt-0.5 line-clamp-1">Manage stock-in, stock-out & parts catalog</p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-slate-400 group-hover:text-white group-hover:translate-x-1 transition-all shrink-0" />
        </div>

        <div
          onClick={() => navigate('/dashboard/battery-warranty')}
          className="group flex items-center justify-between p-4 sm:p-5 rounded-[22px] sm:rounded-[24px] bg-gradient-to-r from-emerald-950 to-teal-900 text-white shadow-md hover:shadow-xl transition-all cursor-pointer border border-emerald-800/60 sm:col-span-2 lg:col-span-1"
        >
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 pr-2">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-white/10 flex items-center justify-center text-teal-300 group-hover:scale-110 transition-transform shrink-0">
              <BatteryCharging className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h3 className="font-black text-sm tracking-tight text-white truncate">Battery Warranty Hub</h3>
                <Badge className="bg-teal-500/20 text-teal-200 border-0 text-[10px] font-bold shrink-0">Active Coverage</Badge>
              </div>
              <p className="text-xs text-emerald-200/90 font-medium mt-0.5 line-clamp-1">Track warranty claims & certificates</p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-emerald-300 group-hover:text-white group-hover:translate-x-1 transition-all shrink-0" />
        </div>
      </div>

      {/* 2. Operations Overview KPI Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Total Repairs */}
        <Card
          onClick={() => { setStatusFilter('ALL'); setTechFilter('ALL'); }}
          className={cn(
            "p-4 rounded-3xl border transition-all cursor-pointer hover:shadow-md",
            statusFilter === 'ALL' ? "border-slate-900 bg-slate-900 text-white shadow-md" : "border-slate-200 bg-white text-slate-900"
          )}
        >
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider opacity-80">
            <span>Total Repairs</span>
            <Layers className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black">{stats.totalRepairs}</div>
          <p className="text-[11px] font-medium opacity-70 mt-1">All registered jobs</p>
        </Card>

        {/* Unassigned Attention Card */}
        <Card
          onClick={() => { setStatusFilter('UNASSIGNED'); }}
          className={cn(
            "p-4 rounded-3xl border transition-all cursor-pointer hover:shadow-md",
            statusFilter === 'UNASSIGNED'
              ? "border-amber-600 bg-amber-600 text-white shadow-md"
              : "border-amber-200 bg-amber-50/50 text-slate-900"
          )}
        >
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-amber-800">
            <span className={statusFilter === 'UNASSIGNED' ? 'text-white' : ''}>Unassigned</span>
            <AlertTriangle className={cn("h-4 w-4", statusFilter === 'UNASSIGNED' ? "text-white" : "text-amber-600")} />
          </div>
          <div className={cn("mt-2 text-2xl sm:text-3xl font-black", statusFilter === 'UNASSIGNED' ? "text-white" : "text-amber-700")}>
            {stats.unassigned}
          </div>
          <p className={cn("text-[11px] font-bold mt-1", statusFilter === 'UNASSIGNED' ? "text-amber-100" : "text-amber-600")}>
            Requires specialist
          </p>
        </Card>

        {/* In Progress */}
        <Card
          onClick={() => { setStatusFilter('IN_PROGRESS'); }}
          className={cn(
            "p-4 rounded-3xl border transition-all cursor-pointer hover:shadow-md",
            statusFilter === 'IN_PROGRESS'
              ? "border-indigo-600 bg-indigo-600 text-white shadow-md"
              : "border-slate-200 bg-white text-slate-900"
          )}
        >
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-indigo-700">
            <span className={statusFilter === 'IN_PROGRESS' ? 'text-white' : ''}>In Process</span>
            <Wrench className={cn("h-4 w-4", statusFilter === 'IN_PROGRESS' ? "text-white" : "text-indigo-600")} />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black">{stats.inProgress}</div>
          <p className="text-[11px] font-medium text-slate-400 mt-1">Bench diagnostics</p>
        </Card>

        {/* Repaired / Ready */}
        <Card
          onClick={() => { setStatusFilter('REPAIRED'); }}
          className={cn(
            "p-4 rounded-3xl border transition-all cursor-pointer hover:shadow-md",
            statusFilter === 'REPAIRED'
              ? "border-teal-600 bg-teal-600 text-white shadow-md"
              : "border-slate-200 bg-white text-slate-900"
          )}
        >
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-teal-700">
            <span className={statusFilter === 'REPAIRED' ? 'text-white' : ''}>Repaired</span>
            <CheckCircle2 className={cn("h-4 w-4", statusFilter === 'REPAIRED' ? "text-white" : "text-teal-600")} />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black">{stats.repaired + stats.ready}</div>
          <p className="text-[11px] font-medium text-slate-400 mt-1">Ready for pickup</p>
        </Card>

        {/* Delivered */}
        <Card
          onClick={() => { setStatusFilter('DELIVERED'); }}
          className={cn(
            "p-4 rounded-3xl border transition-all cursor-pointer hover:shadow-md",
            statusFilter === 'DELIVERED'
              ? "border-slate-700 bg-slate-700 text-white shadow-md"
              : "border-slate-200 bg-white text-slate-900"
          )}
        >
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-600">
            <span className={statusFilter === 'DELIVERED' ? 'text-white' : ''}>Delivered</span>
            <ShieldCheck className={cn("h-4 w-4", statusFilter === 'DELIVERED' ? "text-white" : "text-slate-500")} />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black">{stats.delivered}</div>
          <p className="text-[11px] font-medium text-slate-400 mt-1">Completed & billed</p>
        </Card>

        {/* Re-Problem / Warranty */}
        <Card
          onClick={() => { setStatusFilter('RE_PROBLEM'); }}
          className={cn(
            "p-4 rounded-3xl border transition-all cursor-pointer hover:shadow-md",
            statusFilter === 'RE_PROBLEM'
              ? "border-rose-600 bg-rose-600 text-white shadow-md"
              : "border-rose-200 bg-rose-50/50 text-slate-900"
          )}
        >
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-rose-700">
            <span className={statusFilter === 'RE_PROBLEM' ? 'text-white' : ''}>Warranty Issues</span>
            <RotateCcw className={cn("h-4 w-4", statusFilter === 'RE_PROBLEM' ? "text-white" : "text-rose-600")} />
          </div>
          <div className={cn("mt-2 text-2xl sm:text-3xl font-black", statusFilter === 'RE_PROBLEM' ? "text-white" : "text-rose-700")}>
            {stats.reproblem}
          </div>
          <p className={cn("text-[11px] font-bold mt-1", statusFilter === 'RE_PROBLEM' ? "text-rose-100" : "text-rose-600")}>
            Re-problem cases
          </p>
        </Card>
      </div>

      {/* ATTENDANCE & REPAIR-RELATED DAMAGE PERSONAL SUMMARY CARDS */}
      <UserOverviewCards />

      {/* 3. Technician Workload Hub */}
      <Card className="rounded-[36px] border-slate-200 shadow-sm bg-white overflow-hidden">
        <CardHeader className="p-6 sm:p-8 bg-slate-50/60 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
              <Users className="h-5 w-5 text-indigo-600" />
              Specialist Workload & Capacity Tracker
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 mt-1">
              Live distribution of active repair cases across technicians. Reassign tickets to prevent bottlenecks.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-white border-slate-200 text-xs font-bold text-slate-700 px-3 py-1">
              {technicians.length} Active Specialists
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-6 sm:p-8">
          {workload.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs font-bold uppercase tracking-wider">
              No technician workload records detected.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {workload.map((item) => {
                const isSelected = techFilter === item.technician.id;
                const isOverloaded = item.totalActive >= 6;
                const isAvailable = item.totalActive <= 2;

                return (
                  <div
                    key={item.technician.id}
                    onClick={() => setTechFilter(isSelected ? 'ALL' : item.technician.id)}
                    className={cn(
                      "p-5 rounded-3xl border transition-all cursor-pointer relative overflow-hidden",
                      isSelected
                        ? "border-indigo-600 bg-indigo-50/30 shadow-md ring-2 ring-indigo-600/20"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white font-black flex items-center justify-center text-sm shadow-sm">
                          {item.technician.name.charAt(0)}
                        </div>
                        <div>
                          <h4 className="font-extrabold text-sm text-slate-900">{item.technician.name}</h4>
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                            {item.technician.role.replace(/_/g, ' ')}
                          </p>
                        </div>
                      </div>

                      {isOverloaded ? (
                        <Badge className="bg-rose-100 text-rose-800 border-rose-200 text-[10px] font-black">
                          High Load
                        </Badge>
                      ) : isAvailable ? (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] font-black">
                          Available
                        </Badge>
                      ) : (
                        <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-[10px] font-black">
                          Balanced
                        </Badge>
                      )}
                    </div>

                    {/* Progress indicator */}
                    <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-4 gap-2 text-center">
                      <div className="bg-slate-50 p-2 rounded-xl">
                        <span className="text-[10px] font-bold text-slate-400 block">Pending</span>
                        <span className="text-sm font-black text-amber-600">{item.pendingCount}</span>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-xl">
                        <span className="text-[10px] font-bold text-slate-400 block">Process</span>
                        <span className="text-sm font-black text-indigo-600">{item.inProgressCount}</span>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-xl">
                        <span className="text-[10px] font-bold text-slate-400 block">Repaired</span>
                        <span className="text-sm font-black text-teal-600">{item.repairedCount + item.readyCount}</span>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-xl">
                        <span className="text-[10px] font-bold text-slate-400 block">Active</span>
                        <span className="text-sm font-black text-slate-900">{item.totalActive}</span>
                      </div>
                    </div>

                    {item.urgentCount > 0 && (
                      <div className="mt-3 flex items-center justify-between bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-100 text-[11px] font-bold text-rose-700">
                        <span className="flex items-center gap-1">
                          <Flame className="h-3.5 w-3.5 text-rose-600 animate-pulse" />
                          Urgent Priority Queue
                        </span>
                        <span>{item.urgentCount}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. Filter Toolbar & Search */}
      <div className="bg-white border border-slate-200 rounded-[24px] sm:rounded-[32px] p-4 sm:p-6 shadow-sm space-y-3.5 sm:space-y-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 sm:gap-4">
          {/* Search Input */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search by Repair #, Customer, Phone, IMEI, Device Model..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 sm:pl-11 h-11 sm:h-12 rounded-xl sm:rounded-2xl border-slate-200 font-bold text-xs sm:text-sm bg-slate-50/50 focus:bg-white transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 sm:right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                Clear
              </button>
            )}
          </div>

          {/* Quick Select Filters */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-2.5">
            {/* Specialist Filter */}
            <Select value={techFilter} onValueChange={setTechFilter}>
              <SelectTrigger className="h-10 sm:h-12 flex-1 sm:w-44 rounded-xl sm:rounded-2xl border-slate-200 font-bold text-xs bg-white">
                <SelectValue placeholder="All Specialists" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl max-h-60">
                <SelectItem value="ALL" className="font-bold text-xs">All Specialists</SelectItem>
                <SelectItem value="UNASSIGNED" className="font-bold text-xs text-amber-600">Unassigned Only</SelectItem>
                {technicians.map((t) => (
                  <SelectItem key={t.id} value={t.id} className="font-bold text-xs">
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Priority Filter */}
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="h-10 sm:h-12 flex-1 sm:w-36 rounded-xl sm:rounded-2xl border-slate-200 font-bold text-xs bg-white">
                <SelectValue placeholder="All Priorities" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                <SelectItem value="ALL" className="font-bold text-xs">All Priorities</SelectItem>
                <SelectItem value="URGENT" className="font-bold text-xs text-rose-600">Urgent Only</SelectItem>
                <SelectItem value="HIGH" className="font-bold text-xs text-amber-600">High Only</SelectItem>
                <SelectItem value="NORMAL" className="font-bold text-xs">Normal Only</SelectItem>
              </SelectContent>
            </Select>

            {/* Date Filter */}
            <Select value={dateFilter} onValueChange={(v: DateFilterOption) => setDateFilter(v)}>
              <SelectTrigger className="h-10 sm:h-12 flex-1 sm:w-36 rounded-xl sm:rounded-2xl border-slate-200 font-bold text-xs bg-white">
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                <SelectItem value="ALL" className="font-bold text-xs">All Time</SelectItem>
                <SelectItem value="TODAY" className="font-bold text-xs">Today</SelectItem>
                <SelectItem value="YESTERDAY" className="font-bold text-xs">Yesterday</SelectItem>
                <SelectItem value="THIS_WEEK" className="font-bold text-xs">This Week</SelectItem>
                <SelectItem value="THIS_MONTH" className="font-bold text-xs">This Month</SelectItem>
                <SelectItem value="CUSTOM" className="font-bold text-xs">Custom Range</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort Filter */}
            <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
              <SelectTrigger className="h-10 sm:h-12 flex-1 sm:w-36 rounded-xl sm:rounded-2xl border-slate-200 font-bold text-xs bg-white">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                <SelectItem value="newest" className="font-bold text-xs">Newest First</SelectItem>
                <SelectItem value="oldest" className="font-bold text-xs">Oldest First</SelectItem>
                <SelectItem value="priority" className="font-bold text-xs">Priority (Highest)</SelectItem>
                <SelectItem value="repairNumber" className="font-bold text-xs">Repair #</SelectItem>
                <SelectItem value="customer" className="font-bold text-xs">Customer Name</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Custom Date Pickers */}
        {dateFilter === 'CUSTOM' && (
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">From:</span>
              <Input
                type="date"
                value={customStartDate}
                onChange={e => setCustomStartDate(e.target.value)}
                className="h-10 rounded-xl font-bold text-xs w-36 sm:w-40"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">To:</span>
              <Input
                type="date"
                value={customEndDate}
                onChange={e => setCustomEndDate(e.target.value)}
                className="h-10 rounded-xl font-bold text-xs w-36 sm:w-40"
              />
            </div>
            {(customStartDate || customEndDate) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setCustomStartDate(''); setCustomEndDate(''); }}
                className="text-xs font-bold text-slate-400 hover:text-slate-600 h-8"
              >
                Reset Dates
              </Button>
            )}
          </div>
        )}

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 sm:gap-2 pt-2 overflow-x-auto no-scrollbar pb-1.5 flex-nowrap sm:flex-wrap">
          {[
            { key: 'ALL', label: 'All Jobs' },
            { key: 'UNASSIGNED', label: 'Unassigned', alert: true },
            { key: 'PENDING', label: 'Pending' },
            { key: 'RECEIVED', label: 'Received' },
            { key: 'IN_PROGRESS', label: 'In Progress' },
            { key: 'REPAIRED', label: 'Repaired & Ready' },
            { key: 'DELIVERED', label: 'Delivered' },
            { key: 'RE_PROBLEM', label: 'Warranty Claims' },
          ].map((tab) => {
            const isActive = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                className={cn(
                  "whitespace-nowrap shrink-0 px-3 sm:px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer",
                  isActive
                    ? "bg-slate-900 text-white shadow-xs"
                    : tab.alert
                      ? "bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                )}
              >
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Repairs List & Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-extrabold text-slate-900">
              Showing {filteredRepairs.length} of {repairs.length} Repairs
            </span>
            {(searchQuery || statusFilter !== 'ALL' || techFilter !== 'ALL' || priorityFilter !== 'ALL' || dateFilter !== 'ALL') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('ALL');
                  setTechFilter('ALL');
                  setPriorityFilter('ALL');
                  setDateFilter('ALL');
                }}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 h-7 px-2"
              >
                Reset All Filters
              </Button>
            )}
          </div>
        </div>

        {filteredRepairs.length === 0 ? (
          <Card className="rounded-[36px] border-slate-200 p-12 text-center bg-white">
            <Smartphone className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">No matching repairs found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              Try adjusting your search query, status filters, specialist selection, or date range.
            </p>
          </Card>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-700">
                  <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-4 px-4">Job #</th>
                      <th className="py-4 px-4">Date</th>
                      <th className="py-4 px-4">Customer</th>
                      <th className="py-4 px-4">Device & Problem</th>
                      <th className="py-4 px-4">Priority</th>
                      <th className="py-4 px-4">Specialist</th>
                      <th className="py-4 px-4">Status</th>
                      <th className="py-4 px-4 text-right">Manager Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filteredRepairs.map((repair) => {
                      const statusInfo = statusConfig[repair.status] || {
                        label: repair.status?.replace(/_/g, ' ') || 'Unknown',
                        badge: 'bg-slate-100 text-slate-700 border-slate-200',
                        bgSoft: 'bg-slate-50',
                        textClass: 'text-slate-700'
                      };

                      const isUrgent = repair.priority === 'URGENT';
                      const isHigh = repair.priority === 'HIGH';

                      return (
                        <tr key={repair.id} className="hover:bg-slate-50/70 transition-colors">
                          {/* Job # */}
                          <td className="py-4 px-4 font-mono font-bold whitespace-nowrap">
                            <button
                              onClick={() => navigate(`/dashboard/repairs/${repair.id}`)}
                              className="text-indigo-600 hover:underline flex items-center gap-1.5"
                            >
                              <span>#{repair.repairNumber}</span>
                            </button>
                          </td>

                          {/* Date */}
                          <td className="py-4 px-4 whitespace-nowrap text-xs text-slate-600">
                            <div>{repair.createdAt ? format(new Date(repair.createdAt), 'MMM dd, yyyy') : 'N/A'}</div>
                            <div className="text-[10px] text-slate-400">
                              {repair.createdAt ? format(new Date(repair.createdAt), 'hh:mm a') : ''}
                            </div>
                          </td>

                          {/* Customer */}
                          <td className="py-4 px-4">
                            <div className="font-bold text-slate-900 truncate max-w-[140px]">
                              {repair.customerName || repair.customer?.name}
                            </div>
                            <div className="text-xs text-slate-500 font-mono flex items-center gap-1">
                              <Phone className="h-3 w-3 text-slate-400 inline" />
                              <span>{repair.customerPhone || repair.customer?.phone}</span>
                            </div>
                          </td>

                          {/* Device & Problem */}
                          <td className="py-4 px-4 max-w-[200px]">
                            <div className="font-bold text-slate-900 truncate">
                              {repair.deviceBrand} {repair.deviceModel}
                            </div>
                            <div className="text-xs text-slate-500 truncate" title={repair.problemDescription}>
                              {repair.problemDescription}
                            </div>
                          </td>

                          {/* Priority */}
                          <td className="py-4 px-4 whitespace-nowrap">
                            <DropdownMenu>
                              <DropdownMenuTrigger className="outline-none flex items-center">
                                {isUrgent ? (
                                  <Badge className="bg-rose-600 text-white font-black text-[10px] px-2 py-0.5 animate-pulse cursor-pointer">
                                    URGENT
                                  </Badge>
                                ) : isHigh ? (
                                  <Badge className="bg-amber-500 text-white font-bold text-[10px] px-2 py-0.5 cursor-pointer">
                                    HIGH
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-slate-600 border-slate-200 text-[10px] font-semibold cursor-pointer">
                                    NORMAL
                                  </Badge>
                                )}
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" className="rounded-2xl p-1.5 w-36">
                                <DropdownMenuItem
                                  onClick={() => handleTogglePriority(repair, 'URGENT')}
                                  className="font-bold text-xs text-rose-600 rounded-xl"
                                >
                                  Urgent Priority
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleTogglePriority(repair, 'HIGH')}
                                  className="font-bold text-xs text-amber-600 rounded-xl"
                                >
                                  High Priority
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleTogglePriority(repair, 'NORMAL')}
                                  className="font-bold text-xs text-slate-700 rounded-xl"
                                >
                                  Normal Priority
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>

                          {/* Specialist Assignment */}
                          <td className="py-4 px-4 whitespace-nowrap">
                            {repair.technician ? (
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-xl bg-slate-900 text-white font-black flex items-center justify-center text-[10px]">
                                  {repair.technician.name.charAt(0)}
                                </div>
                                <div>
                                  <p className="font-bold text-xs text-slate-900 truncate max-w-[110px]">
                                    {repair.technician.name}
                                  </p>
                                  <button
                                    onClick={() => handleOpenTransferModal(repair)}
                                    className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-0.5"
                                  >
                                    <ArrowRightLeft className="h-2.5 w-2.5" /> Transfer
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => handleOpenAssignModal(repair)}
                                className="h-8 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs"
                              >
                                <UserCheck className="h-3 w-3 mr-1" /> Assign Tech
                              </Button>
                            )}
                          </td>

                          {/* Status Badge */}
                          <td className="py-4 px-4 whitespace-nowrap">
                            <Badge
                              onClick={() => handleOpenStatusModal(repair)}
                              className={cn(
                                "cursor-pointer font-bold text-[11px] px-2.5 py-0.5 rounded-lg border shadow-none",
                                statusInfo.badge
                              )}
                            >
                              {statusInfo.label}
                            </Badge>
                          </td>

                          {/* Actions */}
                          <td className="py-4 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenNoteModal(repair)}
                                className="h-8 px-2.5 rounded-xl text-slate-600 hover:text-slate-900 font-bold text-xs"
                                title="Add Manager Instruction / Note"
                              >
                                <Send className="h-3.5 w-3.5 mr-1 text-blue-600" /> Note
                              </Button>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(`/dashboard/repairs/${repair.id}`)}
                                className="h-8 px-2.5 rounded-xl border-slate-200 text-slate-700 font-bold text-xs"
                              >
                                <Eye className="h-3.5 w-3.5 mr-1" /> Details
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile / Tablet Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:hidden gap-3.5">
              {filteredRepairs.map((repair) => {
                const statusInfo = statusConfig[repair.status] || {
                  label: repair.status?.replace(/_/g, ' ') || 'Unknown',
                  badge: 'bg-slate-100 text-slate-700 border-slate-200',
                  bgSoft: 'bg-slate-50',
                  textClass: 'text-slate-700'
                };

                return (
                  <Card key={repair.id} className="p-5 rounded-3xl border-slate-200 shadow-sm bg-white space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-sm text-indigo-600">
                            #{repair.repairNumber}
                          </span>
                          <DropdownMenu>
                            <DropdownMenuTrigger className="outline-none">
                              {repair.priority === 'URGENT' ? (
                                <Badge className="bg-rose-600 text-white font-black text-[9px] px-1.5 py-0.5 animate-pulse cursor-pointer">
                                  URGENT
                                </Badge>
                              ) : repair.priority === 'HIGH' ? (
                                <Badge className="bg-amber-500 text-white font-bold text-[9px] px-1.5 py-0.5 cursor-pointer">
                                  HIGH
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-slate-600 border-slate-200 text-[9px] font-bold cursor-pointer">
                                  NORMAL
                                </Badge>
                              )}
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="rounded-2xl p-1.5 w-36">
                              <DropdownMenuItem
                                onClick={() => handleTogglePriority(repair, 'URGENT')}
                                className="font-bold text-xs text-rose-600 rounded-xl cursor-pointer"
                              >
                                Urgent Priority
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleTogglePriority(repair, 'HIGH')}
                                className="font-bold text-xs text-amber-600 rounded-xl cursor-pointer"
                              >
                                High Priority
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleTogglePriority(repair, 'NORMAL')}
                                className="font-bold text-xs text-slate-700 rounded-xl cursor-pointer"
                              >
                                Normal Priority
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <h4 className="font-extrabold text-base text-slate-900 mt-1">
                          {repair.deviceBrand} {repair.deviceModel}
                        </h4>
                        <p className="text-xs text-slate-500 font-medium">
                          Customer: <b>{repair.customerName}</b> ({repair.customerPhone})
                        </p>
                      </div>

                      <Badge className={cn("font-bold text-[10px] px-2 py-0.5 border shadow-none", statusInfo.badge)}>
                        {statusInfo.label}
                      </Badge>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-2xl text-xs text-slate-600 italic">
                      "{repair.problemDescription}"
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div className="text-xs">
                        <span className="text-slate-400 block text-[10px] font-bold uppercase">Technician</span>
                        {repair.technician ? (
                          <span className="font-bold text-slate-800">{repair.technician.name}</span>
                        ) : (
                          <span className="font-bold text-amber-600">Unassigned</span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {repair.technician ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenTransferModal(repair)}
                            className="h-8 px-2.5 rounded-xl border-slate-200 text-xs font-bold text-slate-700"
                          >
                            <ArrowRightLeft className="h-3 w-3 mr-1" /> Transfer
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleOpenAssignModal(repair)}
                            className="h-8 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs"
                          >
                            <UserCheck className="h-3 w-3 mr-1" /> Assign
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenNoteModal(repair)}
                          className="h-8 px-2 rounded-xl text-blue-600 font-bold text-xs"
                        >
                          <Send className="h-3.5 w-3.5" />
                        </Button>

                        <Button
                          size="sm"
                          onClick={() => navigate(`/dashboard/repairs/${repair.id}`)}
                          className="h-8 px-3 rounded-xl bg-slate-900 text-white font-bold text-xs"
                        >
                          Details
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 1. ASSIGN TECHNICIAN MODAL                                                */}
      {/* ========================================================================= */}
      <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 border border-slate-200 shadow-2xl bg-white space-y-4">
          <DialogHeader>
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-1 border border-indigo-100">
              <UserCheck className="h-5 w-5" />
            </div>
            <DialogTitle className="text-xl font-bold text-slate-900">Assign Specialist</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Assign diagnostic job <b>#{selectedRepair?.repairNumber}</b> to an active lab specialist.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Select Technician *</Label>
              <Select value={assignTechId} onValueChange={setAssignTechId}>
                <SelectTrigger className="rounded-xl h-11 border-slate-200 text-xs font-bold">
                  <SelectValue placeholder="Select technician..." />
                </SelectTrigger>
                <SelectContent className="rounded-2xl max-h-56">
                  {technicians.map((t) => (
                    <SelectItem key={t.id} value={t.id} className="text-xs font-bold py-2.5">
                      {t.name} ({t.role.replace(/_/g, ' ')})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Priority Level</Label>
              <Select value={assignPriority} onValueChange={setAssignPriority}>
                <SelectTrigger className="rounded-xl h-11 border-slate-200 text-xs font-bold">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="NORMAL" className="font-bold text-xs">Normal Priority</SelectItem>
                  <SelectItem value="HIGH" className="font-bold text-xs text-amber-600">High Priority</SelectItem>
                  <SelectItem value="URGENT" className="font-bold text-xs text-rose-600">Urgent Priority</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="pt-2 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsAssignModalOpen(false)}
              className="rounded-xl text-xs font-bold text-slate-500"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={assigning}
              onClick={handleConfirmAssign}
              className="rounded-xl h-10 px-5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20"
            >
              {assigning ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <UserCheck className="h-4 w-4 mr-1.5" />}
              Confirm Assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 2. REPAIR TRANSFER MODAL                                                  */}
      {/* ========================================================================= */}
      <Dialog open={isTransferModalOpen} onOpenChange={setIsTransferModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 border border-slate-200 shadow-2xl bg-white space-y-4">
          <DialogHeader>
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-1 border border-amber-100">
              <ArrowRightLeft className="h-5 w-5" />
            </div>
            <DialogTitle className="text-xl font-bold text-slate-900">Transfer Repair Case</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Transfer Job <b>#{selectedRepair?.repairNumber}</b> from {selectedRepair?.technician?.name || 'Unassigned'} to another specialist.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Target Specialist *</Label>
              <Select value={transferTechId} onValueChange={setTransferTechId}>
                <SelectTrigger className="rounded-xl h-11 border-slate-200 text-xs font-bold">
                  <SelectValue placeholder="Select target technician..." />
                </SelectTrigger>
                <SelectContent className="rounded-2xl max-h-56">
                  {technicians.filter(t => t.id !== selectedRepair?.technicianId).map((t) => (
                    <SelectItem key={t.id} value={t.id} className="text-xs font-bold py-2.5">
                      {t.name} ({t.role.replace(/_/g, ' ')})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Priority Level</Label>
              <Select value={transferPriority} onValueChange={setTransferPriority}>
                <SelectTrigger className="rounded-xl h-11 border-slate-200 text-xs font-bold">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="NORMAL" className="font-bold text-xs">Normal Priority</SelectItem>
                  <SelectItem value="HIGH" className="font-bold text-xs text-amber-600">High Priority</SelectItem>
                  <SelectItem value="URGENT" className="font-bold text-xs text-rose-600">Urgent Priority</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Transfer Reason / Special Instructions *</Label>
              <Textarea
                placeholder="e.g. Workload rebalance, specialized micro-soldering required..."
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
              onClick={() => setIsTransferModalOpen(false)}
              className="rounded-xl text-xs font-bold text-slate-500"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={transferring || !transferTechId || !transferReason.trim()}
              onClick={handleConfirmTransfer}
              className="rounded-xl h-10 px-5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md shadow-amber-600/20"
            >
              {transferring ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <ArrowRightLeft className="h-4 w-4 mr-1.5" />}
              Transfer Case
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 3. ADD INTERNAL MANAGERIAL NOTE MODAL                                     */}
      {/* ========================================================================= */}
      <Dialog open={isNoteModalOpen} onOpenChange={setIsNoteModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 border border-slate-200 shadow-2xl bg-white space-y-4">
          <DialogHeader>
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-1 border border-blue-100">
              <Send className="h-5 w-5" />
            </div>
            <DialogTitle className="text-xl font-bold text-slate-900">Add Manager Note / Instruction</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Attach managerial instruction to Job <b>#{selectedRepair?.repairNumber}</b>. Assigned specialist will be notified.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Textarea
              placeholder="e.g. Priority customer requested expedite, please verify thermal paste and stress test for 30 minutes..."
              value={noteContent}
              onChange={e => setNoteContent(e.target.value)}
              className="rounded-xl border-slate-200 min-h-[110px] text-xs font-medium"
            />
          </div>

          <DialogFooter className="pt-2 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsNoteModalOpen(false)}
              className="rounded-xl text-xs font-bold text-slate-500"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={submittingNote || !noteContent.trim()}
              onClick={handleConfirmNote}
              className="rounded-xl h-10 px-5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20"
            >
              {submittingNote ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Send className="h-4 w-4 mr-1.5" />}
              Send Instruction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 4. UPDATE REPAIR STATUS MODAL                                             */}
      {/* ========================================================================= */}
      <Dialog open={isStatusModalOpen} onOpenChange={setIsStatusModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 border border-slate-200 shadow-2xl bg-white space-y-4">
          <DialogHeader>
            <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mb-1 border border-teal-100">
              <Activity className="h-5 w-5" />
            </div>
            <DialogTitle className="text-xl font-bold text-slate-900">Update Operation Status</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Update status for Job <b>#{selectedRepair?.repairNumber}</b>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Target Status *</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger className="rounded-xl h-11 border-slate-200 text-xs font-bold">
                  <SelectValue placeholder="Select status..." />
                </SelectTrigger>
                <SelectContent className="rounded-2xl max-h-56">
                  {Object.entries(statusConfig).map(([key, info]) => (
                    <SelectItem key={key} value={key} className="text-xs font-bold py-2">
                      {info.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Status Update Note (Optional)</Label>
              <Textarea
                placeholder="e.g. Quality inspection passed, packaged and transferred to front counter..."
                value={statusNote}
                onChange={e => setStatusNote(e.target.value)}
                className="rounded-xl border-slate-200 min-h-[80px] text-xs font-medium"
              />
            </div>
          </div>

          <DialogFooter className="pt-2 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsStatusModalOpen(false)}
              className="rounded-xl text-xs font-bold text-slate-500"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={updatingStatus}
              onClick={handleConfirmStatusUpdate}
              className="rounded-xl h-10 px-5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md shadow-teal-600/20"
            >
              {updatingStatus ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Check className="h-4 w-4 mr-1.5" />}
              Save Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}