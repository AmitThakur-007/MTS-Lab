import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Wrench,
  Search,
  Filter,
  Eye,
  Clock,
  CircleCheck as CheckCircle2,
  Calendar,
  History,
  CalendarDays,
  CalendarRange,
  Zap,
  Flame,
  AlertTriangle,
  RotateCcw,
  Check,
  X,
  MessageSquare,
  ArrowRightLeft,
  Loader2,
  Plus,
  SlidersHorizontal,
  Table as TableIcon,
  LayoutGrid,
  ChevronRight,
  Package,
  Layers,
  HelpCircle,
  ExternalLink
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
import { api } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { useRealtimeSync } from '@/services/realtime';
import { formatTimeAgo } from '@/lib/timeUtils';
import { getNepalCalendarInfo } from '@/lib/nepalDate';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Pagination } from '@/components/common/Pagination';
import { REPAIRS_PER_PAGE } from '@/lib/pagination';
import TechnicianHeader from './TechnicianHeader';
import {
  DeviceCategory,
  DEVICE_CATEGORIES,
  detectDeviceCategory,
  getPriorityMeta,
  STATUS_STYLES,
  TECHNICIAN_ALLOWED_STATUSES
} from './types';

export type DatePreset = 'ALL' | 'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'CUSTOM';

export type StatusFilterTab =
  | 'ACTIVE'
  | 'PENDING'
  | 'IN_PROCESS'
  | 'WAITING_FOR_PARTS'
  | 'TESTING'
  | 'PRIORITY'
  | 'REPAIRED';

export default function TechnicianRepairs() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const nepalCalendar = useMemo(() => getNepalCalendarInfo(new Date()), []);

  // Filter params from URL or state
  const initialTab = (searchParams.get('tab') as StatusFilterTab) || 'ACTIVE';
  const initialCategory = (searchParams.get('category') as DeviceCategory) || 'ALL';
  const initialPreset = (searchParams.get('datePreset') as DatePreset) || 'ALL';

  const [activeTab, setActiveTab] = useState<StatusFilterTab>(initialTab);
  const [deviceCategory, setDeviceCategory] = useState<DeviceCategory>(initialCategory);
  const [datePreset, setDatePreset] = useState<DatePreset>(initialPreset);
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [isCustomExpanded, setIsCustomExpanded] = useState(initialPreset === 'CUSTOM');

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [onlyOverdueFilter, setOnlyOverdueFilter] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'dueDate' | 'priority' | 'recentlyUpdated'>('newest');
  const [viewMode, setViewMode] = useState<'CARDS' | 'TABLE'>('CARDS');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Core Data
  const [loading, setLoading] = useState(true);
  const [repairs, setRepairs] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);

  // Modals
  const [selectedRepair, setSelectedRepair] = useState<any | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [updateForm, setUpdateForm] = useState({
    status: '',
    remarks: '',
    partsUsed: '',
    cost: '',
    expectedCompletionDate: '',
  });
  const [submittingUpdate, setSubmittingUpdate] = useState(false);

  // Notes Modal
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [repairNotes, setRepairNotes] = useState<any[]>([]);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(false);

  // Transfer Modal
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferForm, setTransferForm] = useState({
    targetTechnicianId: '',
    reason: '',
  });
  const [submittingTransfer, setSubmittingTransfer] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, deviceCategory, datePreset, customStartDate, customEndDate, debouncedSearch, priorityFilter, onlyOverdueFilter, sortBy]);

  // Fetch Repairs Data
  const fetchRepairsData = useCallback(async (isBackground = false) => {
    if (!user?.id) return;
    try {
      if (!isBackground) setLoading(true);

      const params: any = {
        assignedToMe: 'true',
      };

      if (datePreset !== 'ALL') {
        params.datePreset = datePreset;
        if (datePreset === 'CUSTOM') {
          if (customStartDate) params.startDate = customStartDate;
          if (customEndDate) params.endDate = customEndDate;
        }
      }

      const [repairsRes, staffRes] = await Promise.allSettled([
        api.get('/repairs', { params }),
        api.get('/users/staff'),
      ]);

      if (repairsRes.status === 'fulfilled') {
        const raw = repairsRes.value;
        const list = Array.isArray(raw) ? raw : (raw?.repairs || raw?.data || []);
        // Strictly filter to logged-in technician
        const isolated = list.filter((r: any) =>
          (r.technicianId === user.id || r.assignedTechnicianId === user.id) &&
          r.status !== 'CANCELLED'
        );
        setRepairs(isolated);
      }

      if (staffRes.status === 'fulfilled') {
        const staff = Array.isArray(staffRes.value) ? staffRes.value : [];
        setTechnicians(staff.filter((s: any) => ['TECHNICIAN', 'LEAD_TECHNICIAN'].includes(s.role) && s.id !== user.id));
      }
    } catch (err: any) {
      console.error('[TECHNICIAN REPAIRS FETCH ERROR]', err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [user?.id, datePreset, customStartDate, customEndDate]);

  useEffect(() => {
    fetchRepairsData();
  }, [fetchRepairsData]);

  // Real-time synchronization
  useRealtimeSync(['repair', 'repair_log', 'repair_transfer'], () => {
    fetchRepairsData(true);
  });

  // Client-side multi-criteria filtering
  const filteredRepairs = useMemo(() => {
    let list = [...repairs];

    // Status Tab filter
    if (activeTab === 'ACTIVE') {
      list = list.filter(r => !['REPAIRED', 'READY_FOR_PICKUP', 'DELIVERED', 'CANNOT_REPAIR', 'CANCELLED'].includes(r.status));
    } else if (activeTab === 'PENDING') {
      list = list.filter(r => r.status === 'PENDING');
    } else if (activeTab === 'IN_PROCESS') {
      list = list.filter(r => ['IN_PROCESS', 'IN_PROGRESS', 'DIAGNOSING'].includes(r.status));
    } else if (activeTab === 'WAITING_FOR_PARTS') {
      list = list.filter(r => r.status === 'WAITING_FOR_PARTS');
    } else if (activeTab === 'TESTING') {
      list = list.filter(r => r.status === 'TESTING');
    } else if (activeTab === 'PRIORITY') {
      list = list.filter(r => {
        const tier = getPriorityMeta(r).tier;
        return (tier === 'URGENT' || tier === 'HIGH') && !['REPAIRED', 'READY_FOR_PICKUP', 'DELIVERED', 'CANNOT_REPAIR'].includes(r.status);
      });
    } else if (activeTab === 'REPAIRED') {
      list = list.filter(r => ['REPAIRED', 'READY_FOR_PICKUP', 'DELIVERED', 'REPROBLEM_FIXED'].includes(r.status));
    }

    // Device Category filter
    if (deviceCategory !== 'ALL') {
      list = list.filter(r => detectDeviceCategory(r) === deviceCategory);
    }

    // Priority filter
    if (priorityFilter !== 'ALL') {
      list = list.filter(r => {
        const tier = getPriorityMeta(r).tier;
        return tier === priorityFilter;
      });
    }

    // Overdue filter
    if (onlyOverdueFilter) {
      list = list.filter(r => {
        if (!r.expectedCompletionDate) return false;
        return new Date(r.expectedCompletionDate).getTime() < Date.now() &&
          !['REPAIRED', 'READY_FOR_PICKUP', 'DELIVERED', 'CANNOT_REPAIR'].includes(r.status);
      });
    }

    // Search filter across Repair #, Customer, Phone, Brand, Model, Serial, IMEI, Problem
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase().trim();
      list = list.filter(r => {
        const num = String(r.repairNumber || '').toLowerCase();
        const cust = String(r.customerName || '').toLowerCase();
        const phone = String(r.customerPhone || '').toLowerCase();
        const brand = String(r.deviceBrand || '').toLowerCase();
        const model = String(r.deviceModel || '').toLowerCase();
        const imei = String(r.imei || '').toLowerCase();
        const serial = String(r.serialNumber || '').toLowerCase();
        const prob = String(r.problemDescription || '').toLowerCase();
        return num.includes(q) || cust.includes(q) || phone.includes(q) || brand.includes(q) || model.includes(q) || imei.includes(q) || serial.includes(q) || prob.includes(q);
      });
    }

    // Sort order
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
        if (tier === 'URGENT') return 4;
        if (tier === 'HIGH') return 3;
        if (tier === 'MEDIUM') return 2;
        return 1;
      };
      list.sort((a, b) => priorityScore(b) - priorityScore(a));
    } else if (sortBy === 'recentlyUpdated') {
      list.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
    }

    return list;
  }, [repairs, activeTab, deviceCategory, priorityFilter, onlyOverdueFilter, debouncedSearch, sortBy]);

  // Pagination slice
  const totalFilteredCount = filteredRepairs.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredCount / REPAIRS_PER_PAGE));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedRepairs = useMemo(() => {
    const start = (safeCurrentPage - 1) * REPAIRS_PER_PAGE;
    return filteredRepairs.slice(start, start + REPAIRS_PER_PAGE);
  }, [filteredRepairs, safeCurrentPage]);

  // Tab counts
  const tabCounts = useMemo(() => {
    return {
      ACTIVE: repairs.filter(r => !['REPAIRED', 'READY_FOR_PICKUP', 'DELIVERED', 'CANNOT_REPAIR', 'CANCELLED'].includes(r.status)).length,
      PENDING: repairs.filter(r => r.status === 'PENDING').length,
      IN_PROCESS: repairs.filter(r => ['IN_PROCESS', 'IN_PROGRESS', 'DIAGNOSING'].includes(r.status)).length,
      WAITING_FOR_PARTS: repairs.filter(r => r.status === 'WAITING_FOR_PARTS').length,
      TESTING: repairs.filter(r => r.status === 'TESTING').length,
      PRIORITY: repairs.filter(r => {
        const tier = getPriorityMeta(r).tier;
        return (tier === 'URGENT' || tier === 'HIGH') && !['REPAIRED', 'READY_FOR_PICKUP', 'DELIVERED', 'CANNOT_REPAIR'].includes(r.status);
      }).length,
      REPAIRED: repairs.filter(r => ['REPAIRED', 'READY_FOR_PICKUP', 'DELIVERED', 'REPROBLEM_FIXED'].includes(r.status)).length,
    };
  }, [repairs]);

  // Reset Filters
  const handleResetFilters = () => {
    setActiveTab('ACTIVE');
    setDeviceCategory('ALL');
    setDatePreset('ALL');
    setCustomStartDate('');
    setCustomEndDate('');
    setIsCustomExpanded(false);
    setSearchQuery('');
    setPriorityFilter('ALL');
    setOnlyOverdueFilter(false);
    setSortBy('newest');
    setCurrentPage(1);
    toast.info('Filters Reset', { description: 'Showing all active assigned repairs.' });
  };

  // Open Update Modal
  const handleOpenUpdateModal = (repair: any) => {
    setSelectedRepair(repair);
    setUpdateForm({
      status: repair.status || 'IN_PROCESS',
      remarks: repair.remarks || '',
      partsUsed: repair.partsUsed || '',
      cost: repair.cost ? String(repair.cost) : '',
      expectedCompletionDate: repair.expectedCompletionDate
        ? new Date(repair.expectedCompletionDate).toISOString().split('T')[0]
        : '',
    });
    setIsUpdateModalOpen(true);
  };

  // Submit Update
  const submitStatusUpdate = async () => {
    if (!selectedRepair || submittingUpdate) return;
    setSubmittingUpdate(true);
    try {
      await api.put(`/repairs/${selectedRepair.id}`, {
        status: updateForm.status,
        remarks: updateForm.remarks,
        partsUsed: updateForm.partsUsed,
        cost: updateForm.cost ? parseFloat(updateForm.cost) : undefined,
        expectedCompletionDate: updateForm.expectedCompletionDate || undefined,
      });
      toast.success(`Repair #${selectedRepair.repairNumber} updated.`);
      setIsUpdateModalOpen(false);
      fetchRepairsData(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Failed to update repair.');
    } finally {
      setSubmittingUpdate(false);
    }
  };

  // Notes Dialog
  const handleOpenNotesModal = async (repair: any) => {
    setSelectedRepair(repair);
    setIsNotesModalOpen(true);
    setLoadingNotes(true);
    try {
      const res: any = await api.get(`/repairs/${repair.id}/notes`);
      setRepairNotes(Array.isArray(res) ? res : res?.notes || []);
    } catch {
      setRepairNotes([]);
    } finally {
      setLoadingNotes(false);
    }
  };

  const submitNote = async () => {
    if (!selectedRepair || !newNoteContent.trim() || submittingNote) return;
    setSubmittingNote(true);
    try {
      await api.post(`/repairs/${selectedRepair.id}/notes`, {
        note: newNoteContent.trim(),
        isInternal: true,
      });
      setNewNoteContent('');
      toast.success('Note logged to repair record.');
      // Refresh notes list
      const res: any = await api.get(`/repairs/${selectedRepair.id}/notes`);
      setRepairNotes(Array.isArray(res) ? res : res?.notes || []);
      fetchRepairsData(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Failed to add note.');
    } finally {
      setSubmittingNote(false);
    }
  };

  // Transfer Dialog
  const handleOpenTransferModal = (repair: any) => {
    setSelectedRepair(repair);
    setTransferForm({
      targetTechnicianId: '',
      reason: '',
    });
    setIsTransferModalOpen(true);
  };

  const submitTransfer = async () => {
    if (!selectedRepair || !transferForm.targetTechnicianId || !transferForm.reason.trim() || submittingTransfer) return;
    setSubmittingTransfer(true);
    try {
      await api.post(`/repairs/${selectedRepair.id}/transfer`, {
        targetTechnicianId: transferForm.targetTechnicianId,
        reason: transferForm.reason.trim(),
      });
      toast.success('Transfer request dispatched successfully.');
      setIsTransferModalOpen(false);
      fetchRepairsData(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Failed to submit transfer request.');
    } finally {
      setSubmittingTransfer(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3 bg-[#f8f9fa] dark:bg-slate-950">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600 dark:text-indigo-400" />
        <p className="text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-widest">
          Loading Repairs Bench...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 max-w-7xl mx-auto px-2 sm:px-4">
      {/* 1. Dedicated Header */}
      <TechnicianHeader
        title="Repairs Bench Workspace"
        subtitle="Active device repair operations, testing, parts tracking, and workorders."
        badgeText={`${tabCounts.ACTIVE} Active Jobs`}
        onRefresh={() => fetchRepairsData(true)}
        isRefreshing={loading}
      />

      {/* 2. Date Range Filter & Preset Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Filter className="h-4 w-4" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">Date Range Filter</span>
              <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                {datePreset === 'ALL' && 'Assigned Work (All Active Bench Queue)'}
                {datePreset === 'TODAY' && `Today (${nepalCalendar.todayNpt})`}
                {datePreset === 'YESTERDAY' && `Yesterday (${nepalCalendar.yesterdayNpt})`}
                {datePreset === 'THIS_WEEK' && `This Week (${nepalCalendar.weekStartNpt} to ${nepalCalendar.weekEndNpt})`}
                {datePreset === 'THIS_MONTH' && 'This Month'}
                {datePreset === 'CUSTOM' && (customStartDate && customEndDate ? `${customStartDate} to ${customEndDate}` : 'Custom Date Range')}
              </span>
            </div>
          </div>

          {/* Preset Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full no-scrollbar">
            {[
              { key: 'ALL' as DatePreset, label: 'Assigned Work', icon: Wrench },
              { key: 'TODAY' as DatePreset, label: 'Today', icon: Calendar },
              { key: 'YESTERDAY' as DatePreset, label: 'Yesterday', icon: History },
              { key: 'THIS_WEEK' as DatePreset, label: 'This Week', icon: CalendarDays },
              { key: 'CUSTOM' as DatePreset, label: 'Custom Date', icon: CalendarRange }
            ].map(preset => {
              const isSelected = datePreset === preset.key;
              return (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => {
                    setDatePreset(preset.key);
                    setIsCustomExpanded(preset.key === 'CUSTOM');
                  }}
                  className={cn(
                    "px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer",
                    isSelected
                      ? "bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-600/30"
                      : "bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700"
                  )}
                >
                  <preset.icon className="h-3.5 w-3.5" />
                  <span>{preset.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Date Inputs */}
        {isCustomExpanded && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <Input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="h-9 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium"
              />
              <span className="text-xs text-slate-400 text-center font-bold">to</span>
              <Input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="h-9 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium"
              />
            </div>
            <Button
              size="sm"
              onClick={() => fetchRepairsData(true)}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 px-4 shrink-0 cursor-pointer"
            >
              Apply Filter
            </Button>
          </div>
        )}
      </div>

      {/* 3. Status Tabs Navigation */}
      <div className="bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1 min-w-max">
          {[
            { key: 'ACTIVE' as StatusFilterTab, label: 'Active Bench', count: tabCounts.ACTIVE },
            { key: 'PENDING' as StatusFilterTab, label: 'Pending', count: tabCounts.PENDING },
            { key: 'IN_PROCESS' as StatusFilterTab, label: 'In Progress', count: tabCounts.IN_PROCESS },
            { key: 'WAITING_FOR_PARTS' as StatusFilterTab, label: 'Waiting for Parts', count: tabCounts.WAITING_FOR_PARTS },
            { key: 'TESTING' as StatusFilterTab, label: 'Testing / QA', count: tabCounts.TESTING },
            { key: 'PRIORITY' as StatusFilterTab, label: 'Priority Queue', count: tabCounts.PRIORITY },
            { key: 'REPAIRED' as StatusFilterTab, label: 'Completed', count: tabCounts.REPAIRED },
          ].map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer",
                  isActive
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                )}
              >
                <span>{tab.label}</span>
                <span className={cn(
                  "text-[10px] px-1.5 py-0.2 rounded-full font-mono font-black",
                  isActive
                    ? "bg-white/20 dark:bg-slate-900/20 text-white dark:text-slate-900"
                    : "bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                )}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Search and Multi-criteria Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3.5 transition-colors">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Debounced Search */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search Repair #, Customer, Phone, Model, Serial, IMEI, Problem..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10 rounded-2xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white placeholder:text-slate-400 text-xs font-medium focus-visible:ring-indigo-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Controls: Device Category + Priority + Sort + Layout View Mode */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Device Category Dropdown */}
            <Select value={deviceCategory} onValueChange={(val) => setDeviceCategory(val as DeviceCategory)}>
              <SelectTrigger className="h-10 rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white text-xs font-bold w-[140px] shrink-0">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl dark:bg-slate-900 dark:border-slate-800">
                {DEVICE_CATEGORIES.map(cat => (
                  <SelectItem key={cat.key} value={cat.key} className="text-xs font-bold py-1.5">
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Priority Filter */}
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="h-10 rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white text-xs font-bold w-[130px] shrink-0">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl dark:bg-slate-900 dark:border-slate-800">
                <SelectItem value="ALL" className="text-xs font-bold py-1.5">All Priorities</SelectItem>
                <SelectItem value="URGENT" className="text-xs font-bold py-1.5 text-rose-600">Urgent Only</SelectItem>
                <SelectItem value="HIGH" className="text-xs font-bold py-1.5 text-amber-600">High Priority</SelectItem>
                <SelectItem value="MEDIUM" className="text-xs font-bold py-1.5 text-sky-600">Medium</SelectItem>
                <SelectItem value="NORMAL" className="text-xs font-bold py-1.5">Normal</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort Order */}
            <Select value={sortBy} onValueChange={(val: any) => setSortBy(val)}>
              <SelectTrigger className="h-10 rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white text-xs font-bold w-[140px] shrink-0">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl dark:bg-slate-900 dark:border-slate-800">
                <SelectItem value="newest" className="text-xs font-bold py-1.5">Newest First</SelectItem>
                <SelectItem value="oldest" className="text-xs font-bold py-1.5">Oldest First</SelectItem>
                <SelectItem value="dueDate" className="text-xs font-bold py-1.5">Target Due Date</SelectItem>
                <SelectItem value="priority" className="text-xs font-bold py-1.5">Highest Priority</SelectItem>
                <SelectItem value="recentlyUpdated" className="text-xs font-bold py-1.5">Recently Updated</SelectItem>
              </SelectContent>
            </Select>

            {/* Overdue Only Toggle */}
            <Button
              type="button"
              variant={onlyOverdueFilter ? "destructive" : "outline"}
              size="sm"
              onClick={() => setOnlyOverdueFilter(!onlyOverdueFilter)}
              className={cn(
                "h-10 px-3 rounded-xl font-bold text-xs shrink-0 cursor-pointer transition-all",
                onlyOverdueFilter
                  ? "bg-rose-600 text-white"
                  : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              <AlertTriangle className="h-3.5 w-3.5 mr-1" />
              <span>Overdue Only</span>
            </Button>

            {/* View Mode Toggle: Grid vs Table */}
            <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('CARDS')}
                className={cn(
                  "p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  viewMode === 'CARDS'
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                )}
                title="Grid Cards View"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('TABLE')}
                className={cn(
                  "p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  viewMode === 'TABLE'
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                )}
                title="Compact Table View"
              >
                <TableIcon className="h-4 w-4" />
              </button>
            </div>

            {/* Reset Filters */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="h-10 px-2.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              title="Reset All Filters"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Results Info Bar */}
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1">
          <span>
            Showing <strong className="text-slate-900 dark:text-white font-extrabold">{totalFilteredCount}</strong> assigned workorders
            {deviceCategory !== 'ALL' && ` in ${deviceCategory}`}
            {debouncedSearch && ` matching "${debouncedSearch}"`}
          </span>
          <span className="font-mono text-[11px]">Page {safeCurrentPage} of {totalPages} (40/page)</span>
        </div>
      </div>

      {/* 5. Repairs Display */}
      {totalFilteredCount === 0 ? (
        <div className="bg-white dark:bg-slate-900 p-12 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-3">
          <Wrench className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-600" />
          <h3 className="font-black text-slate-800 dark:text-slate-200 text-lg">No repairs match current bench criteria</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Try adjusting your status tab, resetting date range presets, or clearing the search query.
          </p>
          <Button
            size="sm"
            onClick={handleResetFilters}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 px-4 mt-2"
          >
            Show All Assigned Repairs
          </Button>
        </div>
      ) : viewMode === 'CARDS' ? (
        /* Grid Cards View */
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedRepairs.map((repair) => {
              const priorityMeta = getPriorityMeta(repair);
              const statusInfo = STATUS_STYLES[repair.status] || {
                label: repair.status?.replace(/_/g, ' ') || 'Assigned',
                badge: 'bg-slate-100 text-slate-800 border-slate-300',
              };
              const isOverdue = repair.expectedCompletionDate && new Date(repair.expectedCompletionDate).getTime() < Date.now();
              const category = detectDeviceCategory(repair);

              return (
                <Card
                  key={repair.id}
                  className={cn(
                    "rounded-3xl border shadow-sm transition-all duration-200 bg-white dark:bg-slate-900 flex flex-col justify-between overflow-hidden",
                    priorityMeta.cardBorder
                  )}
                >
                  <CardHeader className={cn("p-4 pb-3 border-b border-slate-100 dark:border-slate-800/80 space-y-0", priorityMeta.headerBg)}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono font-bold text-xs bg-slate-950 dark:bg-white text-white dark:text-slate-950 px-2.5 py-0.5 rounded-lg shrink-0">
                          #{repair.repairNumber}
                        </span>
                        <Badge variant="outline" className="text-[10px] font-bold px-2 py-0 rounded-md border-slate-200 dark:border-slate-700">
                          {category}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", priorityMeta.badgeClass)}>
                          {priorityMeta.label}
                        </Badge>
                        <Badge className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", statusInfo.badge)}>
                          {statusInfo.label}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 sm:p-5 space-y-3.5 flex-1 flex flex-col justify-between">
                    <div className="space-y-2.5">
                      <div>
                        <div className="text-sm font-black text-slate-900 dark:text-white truncate">
                          {repair.deviceBrand} {repair.deviceModel}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                          Customer: <strong className="text-slate-800 dark:text-slate-200">{repair.customerName || 'Walk-in'}</strong>
                          {repair.customerPhone ? ` • ${repair.customerPhone}` : ''}
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 text-xs">
                        <span className="font-bold text-slate-400 uppercase text-[10px] block mb-0.5">Problem</span>
                        <p className="text-slate-700 dark:text-slate-300 line-clamp-2">
                          {repair.problemDescription || 'Inspection required'}
                        </p>
                      </div>

                      {/* Technical Details: Expected due, Serial/IMEI, parts */}
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                        <div>
                          <span className="font-semibold block text-[10px] uppercase text-slate-400">Target Delivery</span>
                          <span className={cn(
                            "font-mono font-bold",
                            isOverdue ? "text-rose-600 dark:text-rose-400" : "text-slate-800 dark:text-slate-200"
                          )}>
                            {repair.expectedCompletionDate ? format(new Date(repair.expectedCompletionDate), 'dd MMM yyyy') : '—'}
                          </span>
                        </div>
                        <div>
                          <span className="font-semibold block text-[10px] uppercase text-slate-400">IMEI / Serial</span>
                          <span className="font-mono text-slate-700 dark:text-slate-300 truncate block">
                            {repair.imei || repair.serialNumber || '—'}
                          </span>
                        </div>
                      </div>

                      {repair.partsUsed && (
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          <span className="font-bold text-slate-400 text-[10px] uppercase block">Parts:</span>
                          <span className="text-slate-700 dark:text-slate-300 truncate block">{repair.partsUsed}</span>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                      {repair.status !== 'DELIVERED' && (
                        <Button
                          size="sm"
                          onClick={() => handleOpenUpdateModal(repair)}
                          className="flex-1 min-w-[110px] rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 shadow-sm cursor-pointer"
                        >
                          <Wrench className="h-3.5 w-3.5 mr-1.5" />
                          Update Status
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenNotesModal(repair)}
                        className="rounded-xl border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs h-9 px-3 cursor-pointer shrink-0"
                        title="Technical Remarks & Notes"
                      >
                        <MessageSquare className="h-3.5 w-3.5 mr-1 text-slate-500" />
                        Notes
                      </Button>

                      {repair.status !== 'REPAIRED' && repair.status !== 'DELIVERED' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenTransferModal(repair)}
                          className="rounded-xl border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-800 dark:hover:text-amber-300 font-bold text-xs h-9 px-3 cursor-pointer shrink-0"
                          title="Handoff to Another Specialist"
                        >
                          <ArrowRightLeft className="h-3.5 w-3.5 mr-1 text-amber-600" />
                          Transfer
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate(`/dashboard/repairs/${repair.id}`)}
                        className="rounded-xl text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 h-9 px-2.5 cursor-pointer shrink-0"
                        title="View Full Ticket Details"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* 40-item pagination */}
          <Pagination
            currentPage={safeCurrentPage}
            totalItems={totalFilteredCount}
            pageSize={REPAIRS_PER_PAGE}
            onPageChange={setCurrentPage}
            itemLabel="assigned repair"
            itemsLabel="assigned repairs"
          />
        </div>
      ) : (
        /* Compact Table View */
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto min-w-0 max-w-full">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-3 px-4">Repair #</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Device Model</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Problem</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Target Due</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {paginatedRepairs.map((repair) => {
                  const priorityMeta = getPriorityMeta(repair);
                  const statusInfo = STATUS_STYLES[repair.status] || {
                    label: repair.status?.replace(/_/g, ' ') || 'Assigned',
                    badge: 'bg-slate-100 text-slate-800 border-slate-300',
                  };
                  const category = detectDeviceCategory(repair);

                  return (
                    <tr key={repair.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                        #{repair.repairNumber}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-600 dark:text-slate-400">
                        {category}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-slate-200">
                        {repair.deviceBrand} {repair.deviceModel}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                        {repair.customerName || 'Walk-in'}
                      </td>
                      <td className="py-3.5 px-4 max-w-xs truncate text-slate-600 dark:text-slate-400" title={repair.problemDescription}>
                        {repair.problemDescription || 'Inspection'}
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", priorityMeta.badgeClass)}>
                          {priorityMeta.label}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", statusInfo.badge)}>
                          {statusInfo.label}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-400">
                        {repair.expectedCompletionDate ? format(new Date(repair.expectedCompletionDate), 'dd MMM yyyy') : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            onClick={() => handleOpenUpdateModal(repair)}
                            className="h-8 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
                          >
                            Update
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenNotesModal(repair)}
                            className="h-8 px-2 rounded-lg border-slate-200 dark:border-slate-700"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate(`/dashboard/repairs/${repair.id}`)}
                            className="h-8 px-2 rounded-lg"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-slate-100 dark:border-slate-800">
            <Pagination
              currentPage={safeCurrentPage}
              totalItems={totalFilteredCount}
              pageSize={REPAIRS_PER_PAGE}
              onPageChange={setCurrentPage}
              itemLabel="assigned repair"
              itemsLabel="assigned repairs"
            />
          </div>
        </div>
      )}

      {/* Modal A: Update Status */}
      <Dialog open={isUpdateModalOpen} onOpenChange={setIsUpdateModalOpen}>
        <DialogContent className="max-w-md w-full rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white space-y-4">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold text-slate-900 dark:text-white">
              Update Repair #{selectedRepair?.repairNumber}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
              Log technical progress, spare parts used, target due date, and updated status.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Repair Status</Label>
              <Select value={updateForm.status} onValueChange={(val) => setUpdateForm(prev => ({ ...prev, status: val }))}>
                <SelectTrigger className="h-11 rounded-2xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-2xl dark:bg-slate-900 dark:border-slate-800">
                  {TECHNICIAN_ALLOWED_STATUSES.map(s => (
                    <SelectItem key={s.value} value={s.value} className="text-xs font-bold py-2">
                      <div className="flex flex-col">
                        <span>{s.label}</span>
                        <span className="text-[10px] text-slate-400 font-normal">{s.desc}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Target Delivery Date</Label>
              <Input
                type="date"
                value={updateForm.expectedCompletionDate}
                onChange={e => setUpdateForm(prev => ({ ...prev, expectedCompletionDate: e.target.value }))}
                className="h-10 rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Replacement Parts Used</Label>
              <Input
                placeholder="e.g., iPhone 13 Pro OLED, 0.02mm jumper wire, BGA solder"
                value={updateForm.partsUsed}
                onChange={e => setUpdateForm(prev => ({ ...prev, partsUsed: e.target.value }))}
                className="h-10 rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Technician Remarks</Label>
              <Textarea
                placeholder="Multimeter diode readings, fault diagnosis, replacement outcome..."
                value={updateForm.remarks}
                onChange={e => setUpdateForm(prev => ({ ...prev, remarks: e.target.value }))}
                className="rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs min-h-[80px]"
              />
            </div>
          </div>

          <DialogFooter className="flex items-center gap-2 pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsUpdateModalOpen(false)}
              className="rounded-xl border-slate-200 dark:border-slate-700 text-xs font-bold h-10"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={submittingUpdate}
              onClick={submitStatusUpdate}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold h-10"
            >
              {submittingUpdate ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Progress'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal B: Technical Remarks & Notes */}
      <Dialog open={isNotesModalOpen} onOpenChange={setIsNotesModalOpen}>
        <DialogContent className="max-w-lg w-full max-h-[85vh] overflow-y-auto rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white space-y-4">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold text-slate-900 dark:text-white">
              Technical Remarks — Repair #{selectedRepair?.repairNumber}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
              Internal technician communication log and bench remarks.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100 dark:divide-slate-800">
              {loadingNotes ? (
                <div className="py-6 text-center text-slate-400 text-xs">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-indigo-600" />
                  Loading remarks...
                </div>
              ) : repairNotes.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs">
                  No internal notes recorded for this repair yet.
                </div>
              ) : (
                repairNotes.map((note, idx) => (
                  <div key={note.id || idx} className="pt-2 first:pt-0">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                      <strong className="text-slate-800 dark:text-slate-200">{note.authorName || 'Technician'}</strong>
                      <span>{note.createdAt ? formatTimeAgo(note.createdAt) : ''}</span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/60">
                      {note.note || note.content}
                    </p>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Add Technical Note</Label>
              <Textarea
                placeholder="Log internal bench progress, parts requirements, or diagnostic test values..."
                value={newNoteContent}
                onChange={e => setNewNoteContent(e.target.value)}
                className="rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs min-h-[70px]"
              />
            </div>
          </div>

          <DialogFooter className="flex items-center gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsNotesModalOpen(false)}
              className="rounded-xl border-slate-200 dark:border-slate-700 text-xs font-bold h-9"
            >
              Close
            </Button>
            <Button
              type="button"
              disabled={submittingNote || !newNoteContent.trim()}
              onClick={submitNote}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold h-9"
            >
              {submittingNote ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Log Note'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal C: Transfer to Specialist */}
      <Dialog open={isTransferModalOpen} onOpenChange={setIsTransferModalOpen}>
        <DialogContent className="max-w-md w-full rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white space-y-4">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-amber-500" />
              <span>Transfer Repair #{selectedRepair?.repairNumber}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
              Reassign this repair ticket to a colleague for specialized micro-soldering, board rework, or scheduling assistance.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Target Specialist</Label>
              <Select
                value={transferForm.targetTechnicianId}
                onValueChange={(val) => setTransferForm(prev => ({ ...prev, targetTechnicianId: val }))}
              >
                <SelectTrigger className="h-11 rounded-2xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold">
                  <SelectValue placeholder="Select Colleague" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl dark:bg-slate-900 dark:border-slate-800">
                  {technicians.map(t => (
                    <SelectItem key={t.id} value={t.id} className="text-xs font-bold py-2">
                      <div className="flex flex-col">
                        <span>{t.name}</span>
                        <span className="text-[10px] text-slate-400">{t.role?.replace(/_/g, ' ')} • {t.email}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Reason for Transfer</Label>
              <Textarea
                placeholder="Explain reason (e.g. Requires NAND reballing / microscope rework, urgent queue rebalancing)..."
                value={transferForm.reason}
                onChange={e => setTransferForm(prev => ({ ...prev, reason: e.target.value }))}
                className="rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs min-h-[90px]"
              />
            </div>
          </div>

          <DialogFooter className="flex items-center gap-2 pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsTransferModalOpen(false)}
              className="rounded-xl border-slate-200 dark:border-slate-700 text-xs font-bold h-10"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={submittingTransfer || !transferForm.targetTechnicianId || !transferForm.reason.trim()}
              onClick={submitTransfer}
              className="rounded-xl bg-amber-600 hover:bg-amber-700 text-slate-950 font-bold text-xs h-10"
            >
              {submittingTransfer ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send Transfer Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
