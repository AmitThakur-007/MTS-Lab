import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  UserCheck,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar as CalendarIcon,
  Search,
  Filter,
  Download,
  Edit3,
  Trash2,
  RefreshCw,
  UserX,
  Send,
  Check,
  X,
  Loader2,
  Info,
  Calendar,
  Layers,
  ArrowRight,
  User,
  History,
  AlertTriangle,
  FileText,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  CalendarDays,
  ExternalLink,
  Eye,
  Percent,
  CheckSquare,
  TrendingUp,
  Award,
  Activity,
  FileSpreadsheet,
  Clock4,
  RotateCcw,
  SlidersHorizontal
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { useRealtimeSync } from '@/services/realtime';
import { api } from '@/services/api';
import { cn } from '@/lib/utils';
import { format, addMonths, subMonths } from 'date-fns';

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function Attendance() {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isAdmin = isSuperAdmin || user?.role === 'ADMIN';
  const isManager = user?.role === 'MANAGER';
  const isStaff = user?.role === 'TECHNICIAN' || user?.role === 'LEAD_TECHNICIAN' || user?.role === 'RECEPTIONIST';
  const canManage = isSuperAdmin || isAdmin || isManager;

  // Primary Active Tab: 'monthly', 'daily', 'today', 'my', 'history'
  const [activeTab, setActiveTab] = useState<'monthly' | 'daily' | 'today' | 'my' | 'history'>(
    canManage ? 'monthly' : 'my'
  );

  // Server Time & Window State
  const [serverTime, setServerTime] = useState<{
    dateStr: string;
    year: string;
    month: string;
    day: string;
    formattedTime: string;
    formattedSeconds: string;
    isManagerWindowOpen: boolean;
    isBeforeManagerWindow: boolean;
    isAfterManagerWindow: boolean;
    remainingSeconds: number;
    timezone: string;
  } | null>(null);

  // 1. Monthly Report State
  const [selectedYearMonth, setSelectedYearMonth] = useState<string>(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  });
  const [monthlyReport, setMonthlyReport] = useState<any[]>([]);
  const [monthlyStats, setMonthlyStats] = useState({
    totalStaff: 0,
    presentToday: 0,
    absentToday: 0,
    attendanceRate: 100
  });
  const [monthlyLoading, setMonthlyLoading] = useState(false);

  // 2. Daily View State (Specific Date)
  const [selectedDailyDate, setSelectedDailyDate] = useState<string>(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });
  const [dailyRoster, setDailyRoster] = useState<any[]>([]);
  const [dailyStats, setDailyStats] = useState({
    totalStaff: 0,
    presentCount: 0,
    absentCount: 0,
    pendingCount: 0,
    rejectedCount: 0,
    notMarkedCount: 0
  });
  const [dailyLoading, setDailyLoading] = useState(false);

  // 3. Individual Staff Modal State
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [selectedStaffUser, setSelectedStaffUser] = useState<any | null>(null);
  const [staffMonthlyData, setStaffMonthlyData] = useState<any | null>(null);
  const [staffModalLoading, setStaffModalLoading] = useState(false);

  // 4. Pending Requests State (for employee)
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);

  // 5. My Personal Attendance State
  const [myStats, setMyStats] = useState({
    totalMonthRecords: 0,
    presentCount: 0,
    absentCount: 0,
    pendingCount: 0,
    rejectedCount: 0,
    attendanceRate: 100
  });
  const [myHistory, setMyHistory] = useState<any[]>([]);

  // 6. Organization History State
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateRangeFilter, setDateRangeFilter] = useState('this_month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Modals & Action States
  const [loading, setLoading] = useState(false);
  const [actionProcessing, setActionProcessing] = useState<string | null>(null);

  // Reject Modal State
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedRequestToReject, setSelectedRequestToReject] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [submittingReject, setSubmittingReject] = useState(false);

  // Edit Attendance Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedRecordToEdit, setSelectedRecordToEdit] = useState<any | null>(null);
  const [editStatus, setEditStatus] = useState('PRESENT');
  const [editNotes, setEditNotes] = useState('');
  const [editReason, setEditReason] = useState('');
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Delete Attendance Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedRecordToDelete, setSelectedRecordToDelete] = useState<any | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [submittingDelete, setSubmittingDelete] = useState(false);

  // Export State
  const [exporting, setExporting] = useState(false);

  // Check if any filter is active
  const hasActiveFilters = searchQuery.trim() !== '' || roleFilter !== 'ALL' || statusFilter !== 'ALL';

  const resetFilters = () => {
    setSearchQuery('');
    setRoleFilter('ALL');
    setStatusFilter('ALL');
  };

  // Fetch Authoritative Server Time
  const fetchServerTime = useCallback(async () => {
    try {
      const res = await api.get('/attendance/server-time');
      if (res?.success) {
        setServerTime(res);
      }
    } catch {
      // silently ignore
    }
  }, []);

  // 1. Fetch Monthly Attendance Report
  const fetchMonthlyReport = useCallback(async () => {
    if (!canManage) return;
    setMonthlyLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('month', selectedYearMonth);
      if (roleFilter !== 'ALL') params.set('role', roleFilter);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const res = await api.get(`/attendance/monthly-report?${params.toString()}`);
      if (res?.success) {
        setMonthlyReport(res.report || []);
        if (res.stats) {
          setMonthlyStats(res.stats);
        }
      }
    } catch (err: any) {
      console.error("[FETCH MONTHLY REPORT ERROR]", err);
      toast.error(err?.message || "Failed to load monthly attendance report.");
    } finally {
      setMonthlyLoading(false);
    }
  }, [canManage, selectedYearMonth, roleFilter, statusFilter, searchQuery]);

  // 2. Fetch Daily Attendance View (Specific Date)
  const fetchDailyData = useCallback(async (targetDateStr?: string) => {
    if (!canManage) return;
    setDailyLoading(true);
    try {
      const dateToFetch = targetDateStr || selectedDailyDate;
      const res = await api.get(`/attendance/today?date=${dateToFetch}`);
      if (res?.success) {
        setDailyRoster(res.roster || []);
        setDailyStats(res.stats || {
          totalStaff: 0,
          presentCount: 0,
          absentCount: 0,
          pendingCount: 0,
          rejectedCount: 0,
          notMarkedCount: 0
        });
      }
    } catch (err: any) {
      console.error("[FETCH DAILY ATTENDANCE ERROR]", err);
    } finally {
      setDailyLoading(false);
    }
  }, [canManage, selectedDailyDate]);

  // 3. Fetch Individual Staff Monthly Breakdown
  const fetchStaffMonthly = useCallback(async (userId: string, monthStr: string) => {
    setStaffModalLoading(true);
    try {
      const res = await api.get(`/attendance/staff/${userId}/monthly?month=${monthStr}`);
      if (res?.success) {
        setStaffMonthlyData(res);
      }
    } catch (err: any) {
      console.error("[FETCH STAFF MONTHLY ERROR]", err);
      toast.error(err?.message || "Failed to load attendance logs.");
    } finally {
      setStaffModalLoading(false);
    }
  }, []);

  // Open Individual Staff Modal
  const handleOpenStaffModal = (staff: any) => {
    setSelectedStaffUser(staff);
    setStaffModalOpen(true);
    fetchStaffMonthly(staff.id, selectedYearMonth);
  };

  // 4. Fetch Pending Requests (for employee)
  const fetchPendingRequests = useCallback(async () => {
    try {
      const data = await api.get('/attendance/pending-requests');
      if (Array.isArray(data)) {
        setPendingRequests(data);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  // 5. Fetch My Personal Attendance
  const fetchMyAttendance = useCallback(async () => {
    try {
      const res = await api.get('/attendance/my');
      if (res?.success) {
        setMyHistory(res.history || []);
        setMyStats(res.stats || {
          totalMonthRecords: 0,
          presentCount: 0,
          absentCount: 0,
          pendingCount: 0,
          rejectedCount: 0,
          attendanceRate: 100
        });
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  // 6. Fetch Organization Attendance History
  const fetchHistory = useCallback(async () => {
    if (!canManage) return;
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams();
      if (roleFilter !== 'ALL') params.set('role', roleFilter);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (searchQuery) params.set('search', searchQuery);

      if (dateRangeFilter === 'today') {
        params.set('range', 'today');
      } else if (dateRangeFilter === 'this_month') {
        params.set('range', 'this_month');
      } else if (dateRangeFilter === 'custom' && customStartDate) {
        params.set('startDate', customStartDate);
        if (customEndDate) params.set('endDate', customEndDate);
      }

      const data = await api.get(`/attendance/history?${params.toString()}`);
      if (Array.isArray(data)) {
        setHistoryRecords(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  }, [canManage, roleFilter, statusFilter, searchQuery, dateRangeFilter, customStartDate, customEndDate]);

  // Month Navigation Handlers
  const handlePrevMonth = () => {
    const [y, m] = selectedYearMonth.split('-').map(Number);
    const prevDate = subMonths(new Date(y, m - 1, 1), 1);
    const newMonthStr = format(prevDate, 'yyyy-MM');
    setSelectedYearMonth(newMonthStr);
  };

  const handleNextMonth = () => {
    const [y, m] = selectedYearMonth.split('-').map(Number);
    const nextDate = addMonths(new Date(y, m - 1, 1), 1);
    const newMonthStr = format(nextDate, 'yyyy-MM');
    setSelectedYearMonth(newMonthStr);
  };

  const handleCurrentMonth = () => {
    if (serverTime) {
      setSelectedYearMonth(`${serverTime.year}-${serverTime.month}`);
    } else {
      setSelectedYearMonth(format(new Date(), 'yyyy-MM'));
    }
  };

  // Initial Load & Tab switching
  useEffect(() => {
    fetchServerTime();
    fetchPendingRequests();
    fetchMyAttendance();
  }, [fetchServerTime, fetchPendingRequests, fetchMyAttendance]);

  useEffect(() => {
    if (activeTab === 'monthly') {
      fetchMonthlyReport();
    } else if (activeTab === 'daily' || activeTab === 'today') {
      fetchDailyData();
    } else if (activeTab === 'history') {
      fetchHistory();
    } else if (activeTab === 'my') {
      fetchMyAttendance();
    }
  }, [activeTab, fetchMonthlyReport, fetchDailyData, fetchHistory, fetchMyAttendance]);

  // Realtime synchronization
  useRealtimeSync(
    ['attendance', 'notification', 'user'],
    () => {
      fetchServerTime();
      if (activeTab === 'monthly') fetchMonthlyReport();
      if (activeTab === 'daily' || activeTab === 'today') fetchDailyData();
      if (activeTab === 'history') fetchHistory();
      fetchMyAttendance();
      fetchPendingRequests();
      if (staffModalOpen && selectedStaffUser) {
        fetchStaffMonthly(selectedStaffUser.id, selectedYearMonth);
      }
    }
  );

  // Refresh All
  const refreshAll = () => {
    setLoading(true);
    fetchServerTime();
    fetchMonthlyReport();
    fetchDailyData();
    fetchMyAttendance();
    fetchPendingRequests();
    if (activeTab === 'history') fetchHistory();
    setTimeout(() => {
      setLoading(false);
      toast.success("Attendance records synchronized!");
    }, 400);
  };

  // Mark Attendance Handler
  const handleMarkAttendance = async (targetUserId: string, targetStatus: string = 'PRESENT', targetDate?: string) => {
    setActionProcessing(targetUserId);
    try {
      const res: any = await api.post('/attendance/mark', {
        userId: targetUserId,
        status: targetStatus,
        date: targetDate || (activeTab === 'daily' ? selectedDailyDate : undefined)
      });
      if (res?.success) {
        toast.success(res.message || "Attendance recorded successfully!");
        fetchDailyData();
        fetchMonthlyReport();
        fetchMyAttendance();
      } else {
        toast.error(res?.error || "Unable to record attendance.");
      }
    } catch (err: any) {
      const errorMsg = err?.response?.data?.error || err?.message || "Unable to save attendance. Please try again.";
      toast.error(errorMsg);
    } finally {
      setActionProcessing(null);
    }
  };

  // Respond to Attendance Request (Accept)
  const handleAcceptRequest = async (requestId: string) => {
    setActionProcessing(requestId);
    try {
      const res: any = await api.post(`/attendance/${requestId}/respond`, {
        action: 'ACCEPT'
      });
      if (res?.success) {
        toast.success("Attendance accepted! You are marked PRESENT for today.");
        fetchPendingRequests();
        fetchMyAttendance();
        fetchDailyData();
      } else {
        toast.error(res?.error || "Failed to accept attendance.");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to accept attendance.");
    } finally {
      setActionProcessing(null);
    }
  };

  // Open Reject Modal
  const handleOpenRejectModal = (request: any) => {
    setSelectedRequestToReject(request);
    setRejectionReason('');
    setRejectModalOpen(true);
  };

  // Submit Rejection
  const handleSubmitReject = async () => {
    if (!selectedRequestToReject) return;
    setSubmittingReject(true);
    try {
      const res: any = await api.post(`/attendance/${selectedRequestToReject.id}/respond`, {
        action: 'REJECT',
        rejectionReason: rejectionReason.trim()
      });
      if (res?.success) {
        toast.success("Attendance request rejected.");
        setRejectModalOpen(false);
        fetchPendingRequests();
        fetchMyAttendance();
        fetchDailyData();
      } else {
        toast.error(res?.error || "Failed to reject attendance.");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to reject attendance.");
    } finally {
      setSubmittingReject(false);
    }
  };

  // Open Edit Modal
  const handleOpenEditModal = (record: any) => {
    setSelectedRecordToEdit(record);
    setEditStatus(record.status || 'PRESENT');
    setEditNotes(record.notes || '');
    setEditReason('');
    setEditModalOpen(true);
  };

  // Submit Edit Correction
  const handleSubmitEdit = async () => {
    if (!selectedRecordToEdit) return;
    if (!editReason.trim()) {
      toast.error("Please enter a mandatory reason for attendance correction.");
      return;
    }
    setSubmittingEdit(true);
    try {
      const res: any = await api.patch(`/attendance/${selectedRecordToEdit.id}`, {
        status: editStatus,
        notes: editNotes.trim() || null,
        reason: editReason.trim()
      });
      if (res?.success) {
        toast.success("Attendance record updated successfully!");
        setEditModalOpen(false);
        fetchDailyData();
        fetchMonthlyReport();
        if (activeTab === 'history') fetchHistory();
        if (staffModalOpen && selectedStaffUser) {
          fetchStaffMonthly(selectedStaffUser.id, selectedYearMonth);
        }
      } else {
        toast.error(res?.error || "Failed to update attendance.");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to update attendance record.");
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Open Delete Modal
  const handleOpenDeleteModal = (record: any) => {
    setSelectedRecordToDelete(record);
    setDeleteReason('');
    setDeleteModalOpen(true);
  };

  // Submit Delete
  const handleSubmitDelete = async () => {
    if (!selectedRecordToDelete) return;
    setSubmittingDelete(true);
    try {
      const res: any = await api.delete(`/attendance/${selectedRecordToDelete.id}`, {
        data: { reason: deleteReason.trim() }
      });
      if (res?.success) {
        toast.success("Attendance record archived.");
        setDeleteModalOpen(false);
        fetchDailyData();
        fetchMonthlyReport();
        if (activeTab === 'history') fetchHistory();
        if (staffModalOpen && selectedStaffUser) {
          fetchStaffMonthly(selectedStaffUser.id, selectedYearMonth);
        }
      } else {
        toast.error(res?.error || "Failed to archive attendance record.");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to archive attendance.");
    } finally {
      setSubmittingDelete(false);
    }
  };

  // Export Data to CSV
  const handleExportData = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (roleFilter !== 'ALL') params.set('role', roleFilter);
      if (activeTab === 'monthly') {
        const [y, m] = selectedYearMonth.split('-');
        const lastDay = new Date(Number(y), Number(m), 0).getDate();
        params.set('startDate', `${selectedYearMonth}-01`);
        params.set('endDate', `${selectedYearMonth}-${String(lastDay).padStart(2, '0')}`);
      }
      const res: any = await api.get(`/attendance/export?${params.toString()}`);
      if (res?.success && Array.isArray(res.rows)) {
        const rows = res.rows;
        if (rows.length === 0) {
          toast.info("No attendance records found for the selected filter to export.");
          return;
        }
        const headers = Object.keys(rows[0]).join(',');
        const csvContent = "data:text/csv;charset=utf-8," +
          [headers, ...rows.map(e => Object.values(e).map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(','))].join('\n');

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `MTS_Attendance_${selectedYearMonth}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast.success(`Exported ${rows.length} attendance records successfully!`);
      }
    } catch (err) {
      toast.error("Failed to export attendance records.");
    } finally {
      setExporting(false);
    }
  };

  // Formatted Month Title (e.g., "August 2026")
  const formattedMonthDisplay = useMemo(() => {
    try {
      const [y, m] = selectedYearMonth.split('-').map(Number);
      return `${MONTH_NAMES[m - 1]} ${y}`;
    } catch {
      return selectedYearMonth;
    }
  }, [selectedYearMonth]);

  // Manager Self Attendance Record for Today
  const myTodayRecord = useMemo(() => {
    return dailyRoster.find(r => r.user?.id === user?.id)?.attendance || null;
  }, [dailyRoster, user]);

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-4 pb-12 animate-in fade-in duration-150 overflow-hidden">

      {/* 1. Header Banner with Authoritative Nepal Time & Window Status */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3.5 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-start sm:items-center gap-3 min-w-0 max-w-full">
          <div className="w-10 h-10 sm:w-11 sm:h-11 bg-slate-950 text-white rounded-xl flex items-center justify-center shadow-xs shrink-0 mt-0.5 sm:mt-0">
            <UserCheck className="w-5 h-5 text-indigo-400 shrink-0" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight truncate">
                Attendance Hub
              </h1>

              {/* Authoritative Manager Time Window Status Badge */}
              {serverTime?.isManagerWindowOpen ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 shrink-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse shrink-0" />
                  <span className="truncate">Manager Window Active (10:00–10:45 AM)</span>
                </span>
              ) : serverTime?.isBeforeManagerWindow ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300 shrink-0">
                  <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span className="truncate">Opens at 10:00 AM</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                  <Clock4 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="truncate">Window Closed</span>
                </span>
              )}

              <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 shrink-0">
                <span>NPT:</span>
                <span>{serverTime?.formattedSeconds || '10:00:00'}</span>
              </span>
            </div>
            <p className="text-xs font-medium text-slate-500 mt-1 line-clamp-1 sm:line-clamp-none">
              {canManage
                ? "Monthly attendance reporting, daily presence logs, and individual staff audit records for MTS Lab."
                : "View your verified monthly attendance logs and respond to attendance requests."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end shrink-0 w-full sm:w-auto">
          {canManage && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportData}
              disabled={exporting}
              className="flex-1 sm:flex-initial h-9 px-3.5 rounded-xl border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-2xs gap-1.5 cursor-pointer min-w-0"
              title="Export filtered records to CSV"
            >
              {exporting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600 shrink-0" />
              ) : (
                <Download className="h-3.5 w-3.5 text-slate-600 shrink-0" />
              )}
              <span className="truncate">Export CSV</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={refreshAll}
            disabled={loading}
            className="flex-1 sm:flex-initial h-9 px-3.5 rounded-xl border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-2xs gap-1.5 cursor-pointer min-w-0"
            title="Synchronize records"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 text-indigo-600 shrink-0", loading && "animate-spin")} />
            <span className="truncate">Sync</span>
          </Button>
        </div>
      </div>

      {/* 2. Employee Pending Attendance Request Callout Card (If active) */}
      <AnimatePresence>
        {pendingRequests.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 rounded-2xl bg-amber-500 text-white shadow-sm border border-amber-400"
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3.5">
              <div className="flex items-start sm:items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0 mt-0.5 sm:mt-0">
                  <UserCheck className="h-5 w-5 shrink-0" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm sm:text-base font-black text-white truncate">Daily Attendance Request</h2>
                    <span className="px-2 py-0.5 rounded-md bg-white text-amber-900 text-[10px] font-black uppercase shrink-0">
                      Action Required
                    </span>
                  </div>
                  <p className="text-xs text-amber-50 font-medium mt-0.5 line-clamp-2">
                    {pendingRequests[0].markedByName || 'Manager'} marked your attendance for today ({pendingRequests[0].date}). Please confirm your presence.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
                <Button
                  size="sm"
                  onClick={() => handleAcceptRequest(pendingRequests[0].id)}
                  disabled={actionProcessing === pendingRequests[0].id}
                  className="flex-1 sm:flex-initial h-8.5 px-4 rounded-xl bg-white text-emerald-900 hover:bg-emerald-50 font-black text-xs shadow-xs gap-1.5 cursor-pointer"
                >
                  {actionProcessing === pendingRequests[0].id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                  ) : (
                    <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  )}
                  <span className="truncate">Accept (Present)</span>
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleOpenRejectModal(pendingRequests[0])}
                  disabled={actionProcessing === pendingRequests[0].id}
                  className="h-8.5 px-3 rounded-xl bg-black/20 hover:bg-black/30 border-white/30 text-white font-bold text-xs gap-1 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5 shrink-0" />
                  <span>Reject</span>
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Manager Self-Attendance Card (For Manager Role) */}
      {isManager && (
        <div className="p-4 sm:p-4.5 rounded-2xl bg-slate-900 text-white border border-slate-800 shadow-2xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5">
            <div className="flex items-start sm:items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5 sm:mt-0">
                <UserCheck className="h-5 w-5 shrink-0" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-sm sm:text-base text-white truncate">Manager Self Attendance</h3>
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded shrink-0">
                    10:00 – 10:45 AM
                  </span>
                </div>
                <p className="text-xs text-slate-300 font-medium mt-0.5 line-clamp-2">
                  {myTodayRecord?.status === 'PRESENT'
                    ? `✓ Your attendance is recorded as PRESENT today at ${new Date(myTodayRecord.markedAt).toLocaleTimeString('en-US', { timeZone: 'Asia/Kathmandu', hour: '2-digit', minute: '2-digit' })}.`
                    : serverTime?.isManagerWindowOpen
                      ? "Manager attendance window is currently OPEN. Click below to record your presence."
                      : serverTime?.isBeforeManagerWindow
                        ? "Attendance window opens at 10:00 AM."
                        : "Manager attendance window has closed for today."}
                </p>
              </div>
            </div>

            <div className="w-full sm:w-auto shrink-0 flex justify-end">
              {myTodayRecord?.status === 'PRESENT' ? (
                <Badge className="bg-emerald-500 text-white font-black px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow-xs">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  <span>Present Today</span>
                </Badge>
              ) : (
                <Button
                  size="sm"
                  onClick={() => handleMarkAttendance(user?.id || '', 'PRESENT')}
                  disabled={!serverTime?.isManagerWindowOpen || actionProcessing === user?.id}
                  className={cn(
                    "w-full sm:w-auto h-9 px-4 rounded-xl font-black text-xs shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                    serverTime?.isManagerWindowOpen
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
                      : "bg-slate-800 text-slate-400 cursor-not-allowed opacity-70"
                  )}
                >
                  {actionProcessing === user?.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                  ) : (
                    <Check className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span>Mark My Attendance</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. Top Dynamic KPI Summary Cards */}
      {canManage ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

          {/* Total Staff */}
          <Card className="p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 bg-white shadow-2xs">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <span className="truncate">Total Staff</span>
              <Users className="h-4 w-4 text-slate-400 shrink-0" />
            </div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-slate-900">{monthlyStats.totalStaff}</span>
              <span className="text-xs font-medium text-slate-400">Roster</span>
            </div>
          </Card>

          {/* Present Today */}
          <Card className="p-3.5 sm:p-4 rounded-2xl border border-emerald-200/90 bg-emerald-50/40 shadow-2xs">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-emerald-700">
              <span className="truncate">Present Today</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            </div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-emerald-800">{monthlyStats.presentToday}</span>
              <span className="text-xs font-bold text-emerald-600">On Duty</span>
            </div>
          </Card>

          {/* Absent Today */}
          <Card className="p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 bg-slate-50/70 shadow-2xs">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-600">
              <span className="truncate">Absent Today</span>
              <UserX className="h-4 w-4 text-slate-400 shrink-0" />
            </div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-slate-800">{monthlyStats.absentToday}</span>
              <span className="text-xs font-medium text-slate-400">Off Duty</span>
            </div>
          </Card>

          {/* Attendance Rate */}
          <Card className="p-3.5 sm:p-4 rounded-2xl border border-indigo-200/90 bg-indigo-50/40 shadow-2xs">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-indigo-700">
              <span className="truncate">Attendance Rate</span>
              <TrendingUp className="h-4 w-4 text-indigo-600 shrink-0" />
            </div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-indigo-800">{monthlyStats.attendanceRate}%</span>
              <span className="text-xs font-bold text-indigo-600">Monthly Avg</span>
            </div>
          </Card>

        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="p-3.5 sm:p-4 rounded-2xl border border-emerald-200/90 bg-emerald-50/40 shadow-2xs">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-emerald-700">
              <span className="truncate">Present Days</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            </div>
            <div className="mt-1.5 text-2xl sm:text-3xl font-black text-emerald-700">{myStats.presentCount}</div>
            <p className="text-[11px] font-medium text-emerald-600 mt-0.5">This month</p>
          </Card>

          <Card className="p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 bg-white shadow-2xs">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <span className="truncate">Absent Days</span>
              <UserX className="h-4 w-4 text-slate-400 shrink-0" />
            </div>
            <div className="mt-1.5 text-2xl sm:text-3xl font-black text-slate-800">{myStats.absentCount}</div>
            <p className="text-[11px] font-medium text-slate-400 mt-0.5">Recorded absences</p>
          </Card>

          <Card className="p-3.5 sm:p-4 rounded-2xl border border-rose-200/90 bg-rose-50/40 shadow-2xs">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-rose-700">
              <span className="truncate">Rejected</span>
              <XCircle className="h-4 w-4 text-rose-600 shrink-0" />
            </div>
            <div className="mt-1.5 text-2xl sm:text-3xl font-black text-rose-700">{myStats.rejectedCount}</div>
            <p className="text-[11px] font-medium text-rose-600 mt-0.5">Declined requests</p>
          </Card>

          <Card className="p-3.5 sm:p-4 rounded-2xl border border-indigo-200/90 bg-indigo-50/40 shadow-2xs">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-indigo-700">
              <span className="truncate">Monthly Rate</span>
              <TrendingUp className="h-4 w-4 text-indigo-600 shrink-0" />
            </div>
            <div className="mt-1.5 text-2xl sm:text-3xl font-black text-indigo-700">{myStats.attendanceRate}%</div>
            <p className="text-[11px] font-bold text-indigo-600 mt-0.5">Attendance score</p>
          </Card>
        </div>
      )}

      {/* 5. Primary Navigation Tabs & Dedicated Filter Toolbar (Zero Overflow) */}
      <Card className="rounded-2xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">

        {/* Tier 1: Tab Navigation Bar */}
        <div className="p-3 sm:p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="inline-flex p-1 bg-slate-100/90 rounded-xl border border-slate-200/70 overflow-x-auto max-w-full scrollbar-none">
            {canManage && (
              <button
                onClick={() => setActiveTab('monthly')}
                className={cn(
                  "px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0",
                  activeTab === 'monthly' ? "bg-slate-950 text-white shadow-xs" : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                )}
              >
                <BarChart3 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span>Monthly Report</span>
              </button>
            )}

            {canManage && (
              <button
                onClick={() => setActiveTab('daily')}
                className={cn(
                  "px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0",
                  activeTab === 'daily' ? "bg-slate-950 text-white shadow-xs" : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                )}
              >
                <CalendarDays className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Daily View</span>
              </button>
            )}

            {canManage && (
              <button
                onClick={() => setActiveTab('today')}
                className={cn(
                  "px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0",
                  activeTab === 'today' ? "bg-slate-950 text-white shadow-xs" : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                )}
              >
                <Users className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span>Take Attendance</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('my')}
              className={cn(
                "px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0",
                activeTab === 'my' ? "bg-slate-950 text-white shadow-xs" : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
              )}
            >
              <User className="w-3.5 h-3.5 shrink-0" />
              <span>My Attendance</span>
            </button>

            {canManage && (
              <button
                onClick={() => setActiveTab('history')}
                className={cn(
                  "px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0",
                  activeTab === 'history' ? "bg-slate-950 text-white shadow-xs" : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                )}
              >
                <History className="w-3.5 h-3.5 shrink-0" />
                <span>Audit Log</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 text-xs font-bold px-2.5 py-1">
              {activeTab === 'monthly' && `Month: ${formattedMonthDisplay}`}
              {activeTab === 'daily' && `Date: ${selectedDailyDate}`}
              {activeTab === 'today' && "Today's Live Roster"}
              {activeTab === 'my' && "My Records"}
              {activeTab === 'history' && "Audit Trails"}
            </Badge>
          </div>
        </div>

        {/* Tier 2: Dedicated Filter & Date Controls (Full-width, cleanly wrapped, zero overflow) */}
        {canManage && activeTab !== 'my' && (
          <div className="p-3 sm:p-4 bg-slate-50/60 flex flex-col md:flex-row md:items-center justify-between gap-3">

            {/* Left Column: Contextual Date or Month Selector */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Monthly View Month Picker */}
              {activeTab === 'monthly' && (
                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handlePrevMonth}
                    className="h-7 w-7 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
                    title="Previous Month"
                  >
                    <ChevronLeft className="w-4 h-4 shrink-0" />
                  </Button>

                  <span className="font-bold text-xs text-slate-900 px-2 min-w-[120px] text-center truncate">
                    {formattedMonthDisplay}
                  </span>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleNextMonth}
                    className="h-7 w-7 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
                    title="Next Month"
                  >
                    <ChevronRight className="w-4 h-4 shrink-0" />
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCurrentMonth}
                    className="h-7 px-2.5 text-[11px] font-bold rounded-lg border-slate-200 bg-white hover:bg-slate-100 cursor-pointer"
                  >
                    Current
                  </Button>
                </div>
              )}

              {/* Daily View Date Picker */}
              {activeTab === 'daily' && (
                <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                  <Input
                    type="date"
                    value={selectedDailyDate}
                    onChange={(e) => {
                      setSelectedDailyDate(e.target.value);
                      fetchDailyData(e.target.value);
                    }}
                    className="h-7 text-xs bg-white border-0 font-bold rounded-lg w-[130px] sm:w-[140px] focus-visible:ring-0"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const todayStr = serverTime?.dateStr || format(new Date(), 'yyyy-MM-dd');
                      setSelectedDailyDate(todayStr);
                      fetchDailyData(todayStr);
                    }}
                    className="h-7 px-2.5 text-[11px] font-bold rounded-lg border-slate-200 bg-white hover:bg-slate-100 cursor-pointer"
                  >
                    Today
                  </Button>
                </div>
              )}

              {/* Today View Contextual Badge */}
              {activeTab === 'today' && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl border border-slate-200 text-xs font-bold text-slate-700 shadow-2xs">
                  <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>Live Kathmandu Date: {serverTime?.dateStr || format(new Date(), 'yyyy-MM-dd')}</span>
                </div>
              )}

              {/* History View Date Range Picker */}
              {activeTab === 'history' && (
                <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs text-xs font-bold">
                  <Select value={dateRangeFilter} onValueChange={(v) => setDateRangeFilter(v)}>
                    <SelectTrigger className="h-7 w-[120px] rounded-lg border-0 text-xs font-bold bg-white focus:ring-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl text-xs">
                      <SelectItem value="this_month">This Month</SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Right Column: Search, Role Filter, Status Filter, Reset */}
            <div className="flex flex-wrap items-center gap-2 flex-1 justify-start md:justify-end min-w-0">

              {/* Search Staff */}
              <div className="relative flex-1 sm:flex-initial min-w-[160px] sm:w-[200px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 shrink-0" />
                <Input
                  type="text"
                  placeholder="Search staff name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8.5 pl-8 pr-7 rounded-xl bg-white border-slate-200 text-xs font-medium w-full shadow-2xs"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5 shrink-0" />
                  </button>
                )}
              </div>

              {/* Role Filter */}
              <div className="w-[calc(50%-4px)] sm:w-[135px]">
                <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v)}>
                  <SelectTrigger className="h-8.5 w-full rounded-xl bg-white border-slate-200 text-xs font-bold shadow-2xs">
                    <SelectValue placeholder="All Roles" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl text-xs">
                    <SelectItem value="ALL">All Roles</SelectItem>
                    <SelectItem value="MANAGER">Manager</SelectItem>
                    <SelectItem value="RECEPTIONIST">Receptionist</SelectItem>
                    <SelectItem value="TECHNICIAN">Technician</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <div className="w-[calc(50%-4px)] sm:w-[125px]">
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
                  <SelectTrigger className="h-8.5 w-full rounded-xl bg-white border-slate-200 text-xs font-bold shadow-2xs">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl text-xs">
                    <SelectItem value="ALL">All Status</SelectItem>
                    <SelectItem value="PRESENT">Present</SelectItem>
                    <SelectItem value="ABSENT">Absent</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="REJECTED">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Reset Filters Button */}
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetFilters}
                  className="h-8.5 px-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 cursor-pointer gap-1 shrink-0"
                  title="Reset all filters"
                >
                  <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                  <span>Reset</span>
                </Button>
              )}

            </div>

          </div>
        )}

      </Card>

      {/* 6. TAB 1: MONTHLY ATTENDANCE REPORT (SUPER ADMIN, ADMIN, MANAGER) */}
      {activeTab === 'monthly' && canManage && (
        <Card className="rounded-2xl border-slate-200/90 bg-white p-3.5 sm:p-5 shadow-2xs">

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-3.5">
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2 truncate">
                <BarChart3 className="w-4 h-4 text-indigo-600 shrink-0" />
                <span className="truncate">Monthly Attendance Report — {formattedMonthDisplay}</span>
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5 line-clamp-1">
                Overview of staff working days, presence score, and performance rating for {formattedMonthDisplay}.
              </p>
            </div>
            <Badge className="bg-slate-900 text-white text-xs font-bold px-2.5 py-0.5 rounded-lg shrink-0 self-start sm:self-auto">
              {monthlyReport.length} Staff Members
            </Badge>
          </div>

          {monthlyLoading ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <RefreshCw className="w-7 h-7 animate-spin mx-auto text-indigo-600 shrink-0" />
              <p className="text-xs font-bold text-slate-600">Compiling monthly attendance report...</p>
            </div>
          ) : monthlyReport.length === 0 ? (
            <div className="p-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 space-y-2">
              <Calendar className="w-9 h-9 mx-auto text-slate-300 shrink-0" />
              <p className="text-sm font-bold text-slate-700">No attendance records found</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No attendance records were logged for {formattedMonthDisplay} matching the current filters.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop / Laptop High-Density Professional Table */}
              <div className="hidden lg:block overflow-x-auto rounded-xl border border-slate-200/80">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/90 border-b border-slate-200/80 text-slate-600 font-extrabold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-3.5 min-w-[200px]">Staff Member</th>
                      <th className="py-3 px-3 min-w-[120px]">Role</th>
                      <th className="py-3 px-3 text-center min-w-[80px]">Present</th>
                      <th className="py-3 px-3 text-center min-w-[80px]">Absent</th>
                      <th className="py-3 px-3 text-center min-w-[110px]">Pending / Rejected</th>
                      <th className="py-3 px-3 text-center min-w-[130px]">Attendance %</th>
                      <th className="py-3 px-3 text-center min-w-[110px]">Rating</th>
                      <th className="py-3 px-3.5 text-right min-w-[120px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {monthlyReport.map((item) => {
                      const staff = item.user;
                      const rate = item.attendanceRate;

                      return (
                        <tr key={staff.id} className="hover:bg-slate-50/80 transition-colors">

                          {/* Staff Info */}
                          <td className="py-3 px-3.5">
                            <div className="flex items-center gap-2.5 min-w-0 max-w-[240px]">
                              <Avatar className="h-8.5 w-8.5 rounded-xl border border-slate-200 shrink-0">
                                <AvatarImage src={staff.profileImage} alt={staff.name} />
                                <AvatarFallback className="bg-slate-900 text-white font-bold text-[11px] rounded-xl">
                                  {staff.name?.slice(0, 2).toUpperCase() || 'ST'}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <strong className="font-bold text-slate-900 block text-xs truncate" title={staff.name}>
                                  {staff.name}
                                </strong>
                                <span className="text-[11px] text-slate-500 font-medium block truncate" title={staff.email}>
                                  {staff.email}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Role */}
                          <td className="py-3 px-3">
                            <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 rounded-md border bg-slate-50 text-slate-700 truncate max-w-[120px]">
                              {staff.role.replace(/_/g, ' ')}
                            </Badge>
                          </td>

                          {/* Present Days */}
                          <td className="py-3 px-3 text-center">
                            <span className="font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200 font-mono text-xs">
                              {item.presentDays}
                            </span>
                          </td>

                          {/* Absent Days */}
                          <td className="py-3 px-3 text-center">
                            <span className={cn(
                              "font-bold px-2.5 py-0.5 rounded-md border font-mono text-xs",
                              item.absentDays > 0 ? "text-rose-700 bg-rose-50 border-rose-200" : "text-slate-500 bg-slate-50 border-slate-200"
                            )}>
                              {item.absentDays}
                            </span>
                          </td>

                          {/* Pending / Rejected */}
                          <td className="py-3 px-3 text-center text-slate-500 font-mono text-xs">
                            {item.pendingDays > 0 && <span className="text-amber-700 font-bold mr-1.5">{item.pendingDays}p</span>}
                            {item.rejectedDays > 0 && <span className="text-rose-700 font-bold mr-1.5">{item.rejectedDays}r</span>}
                            {item.pendingDays === 0 && item.rejectedDays === 0 && <span className="text-slate-400">—</span>}
                          </td>

                          {/* Attendance Rate */}
                          <td className="py-3 px-3 text-center">
                            {rate !== null ? (
                              <div className="inline-flex items-center gap-2">
                                <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden shrink-0">
                                  <div
                                    className={cn(
                                      "h-full rounded-full",
                                      rate >= 90 ? "bg-emerald-500" : rate >= 75 ? "bg-amber-500" : "bg-rose-500"
                                    )}
                                    style={{ width: `${rate}%` }}
                                  />
                                </div>
                                <span className="font-mono font-bold text-slate-900 text-xs shrink-0">{rate}%</span>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs">No records</span>
                            )}
                          </td>

                          {/* Status / Rating Badge */}
                          <td className="py-3 px-3 text-center">
                            {item.statusTag === 'EXCELLENT' && (
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-bold px-2 py-0.5">
                                Excellent
                              </Badge>
                            )}
                            {item.statusTag === 'GOOD' && (
                              <Badge className="bg-blue-100 text-blue-800 border-blue-300 text-[10px] font-bold px-2 py-0.5">
                                Good
                              </Badge>
                            )}
                            {item.statusTag === 'AVERAGE' && (
                              <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-bold px-2 py-0.5">
                                Average
                              </Badge>
                            )}
                            {item.statusTag === 'NEEDS_ATTENTION' && (
                              <Badge className="bg-rose-100 text-rose-800 border-rose-300 text-[10px] font-bold px-2 py-0.5">
                                Needs Attention
                              </Badge>
                            )}
                            {item.statusTag === 'NO_DATA' && (
                              <span className="text-[10px] font-semibold text-slate-400">No Data</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-3.5 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenStaffModal(staff)}
                              className="h-7.5 px-3 rounded-lg text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 cursor-pointer gap-1.5 shrink-0"
                            >
                              <Eye className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                              <span>View History</span>
                            </Button>
                          </td>

                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Tablet & Smartphone Responsive Cards (< 1024px) */}
              <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-3">
                {monthlyReport.map((item) => {
                  const staff = item.user;
                  const rate = item.attendanceRate;

                  return (
                    <div
                      key={staff.id}
                      className="p-3.5 sm:p-4 rounded-xl border border-slate-200/90 bg-white shadow-2xs space-y-3 transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar className="h-9 w-9 rounded-xl border border-slate-200 shrink-0">
                            <AvatarImage src={staff.profileImage} alt={staff.name} />
                            <AvatarFallback className="bg-slate-900 text-white font-bold text-xs rounded-xl">
                              {staff.name?.slice(0, 2).toUpperCase() || 'ST'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <strong className="font-bold text-slate-900 text-xs block truncate" title={staff.name}>
                              {staff.name}
                            </strong>
                            <Badge variant="outline" className="text-[9px] font-bold px-1.5 py-0 mt-0.5 bg-slate-50 text-slate-600 truncate">
                              {staff.role.replace(/_/g, ' ')}
                            </Badge>
                          </div>
                        </div>

                        <div className="shrink-0">
                          {item.statusTag === 'EXCELLENT' && <Badge className="bg-emerald-100 text-emerald-800 text-[10px] font-bold">Excellent</Badge>}
                          {item.statusTag === 'GOOD' && <Badge className="bg-blue-100 text-blue-800 text-[10px] font-bold">Good</Badge>}
                          {item.statusTag === 'AVERAGE' && <Badge className="bg-amber-100 text-amber-800 text-[10px] font-bold">Average</Badge>}
                          {item.statusTag === 'NEEDS_ATTENTION' && <Badge className="bg-rose-100 text-rose-800 text-[10px] font-bold">Low</Badge>}
                          {item.statusTag === 'NO_DATA' && <span className="text-[10px] text-slate-400 font-semibold">No Data</span>}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 p-2.5 bg-slate-50 rounded-xl text-center text-xs font-mono">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-sans font-medium">Present</span>
                          <strong className="text-emerald-700 font-bold text-sm">{item.presentDays}</strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-sans font-medium">Absent</span>
                          <strong className="text-rose-700 font-bold text-sm">{item.absentDays}</strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-sans font-medium">Rate</span>
                          <strong className="text-indigo-700 font-bold text-sm">{rate !== null ? `${rate}%` : '—'}</strong>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenStaffModal(staff)}
                        className="w-full h-8.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 border-slate-200 cursor-pointer gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span>View Detailed History</span>
                      </Button>
                    </div>
                  );
                })}
              </div>
            </>
          )}

        </Card>
      )}

      {/* 7. TAB 2: DAILY ATTENDANCE VIEW (SPECIFIC DATE) */}
      {activeTab === 'daily' && canManage && (
        <Card className="rounded-2xl border-slate-200/90 bg-white p-3.5 sm:p-5 shadow-2xs space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2 truncate">
                <CalendarDays className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="truncate">Daily Attendance Roster — {selectedDailyDate}</span>
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5 line-clamp-1">
                Attendance verification and check-in records for {selectedDailyDate}.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold shrink-0 self-start sm:self-auto">
              <span className="text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                {dailyStats.presentCount} Present
              </span>
              <span className="text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
                {dailyStats.totalStaff} Total
              </span>
            </div>
          </div>

          {dailyLoading ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <RefreshCw className="w-7 h-7 animate-spin mx-auto text-emerald-600 shrink-0" />
              <p className="text-xs font-bold text-slate-600">Loading daily attendance records...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {dailyRoster.map((item) => {
                const staff = item.user;
                const att = item.attendance;

                return (
                  <div
                    key={staff.id}
                    className={cn(
                      "p-3.5 sm:p-4 rounded-xl border transition-all bg-white shadow-2xs space-y-3",
                      item.status === 'PRESENT' && "border-emerald-200/90 bg-emerald-50/10",
                      item.status === 'PENDING' && "border-amber-200/90 bg-amber-50/10",
                      item.status === 'REJECTED' && "border-rose-200/90 bg-rose-50/10",
                      item.status === 'NOT_MARKED' && "border-slate-200/90"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar className="h-9 w-9 rounded-xl border border-slate-200 shrink-0">
                          <AvatarImage src={staff.profileImage} alt={staff.name} />
                          <AvatarFallback className="bg-slate-900 text-white font-bold text-xs rounded-xl">
                            {staff.name?.slice(0, 2).toUpperCase() || 'ST'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <strong className="font-bold text-slate-900 text-xs block truncate" title={staff.name}>
                            {staff.name}
                          </strong>
                          <span className="text-[11px] text-slate-500 font-medium block truncate" title={staff.email}>
                            {staff.email}
                          </span>
                          <Badge variant="outline" className="text-[9px] font-bold px-1.5 py-0 mt-0.5 bg-slate-50 text-slate-600 truncate">
                            {staff.role.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div className="shrink-0">
                        {item.status === 'PRESENT' && (
                          <Badge className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 shadow-xs">
                            ✓ Present
                          </Badge>
                        )}
                        {item.status === 'PENDING' && (
                          <Badge className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 shadow-xs">
                            ⏳ Pending
                          </Badge>
                        )}
                        {item.status === 'REJECTED' && (
                          <Badge className="bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 shadow-xs">
                            ✕ Rejected
                          </Badge>
                        )}
                        {item.status === 'NOT_MARKED' && (
                          <Badge variant="outline" className="text-[10px] font-bold text-slate-400 border-slate-200">
                            Not Marked
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Check-in Time / Marked By */}
                    {att && (
                      <div className="p-2.5 bg-slate-50/80 rounded-xl text-xs text-slate-600 space-y-1">
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-slate-400 text-[11px]">Marked By:</span>
                          <span className="font-semibold text-slate-800 truncate">{att.markedByName || att.markedByRole}</span>
                        </div>
                        <div className="flex justify-between items-center gap-2 font-mono text-[11px]">
                          <span className="text-slate-400 font-sans">Check-in:</span>
                          <span>{new Date(att.markedAt).toLocaleTimeString('en-US', { timeZone: 'Asia/Kathmandu', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    )}

                    {/* Action */}
                    <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                      {item.status === 'NOT_MARKED' ? (
                        <Button
                          size="sm"
                          onClick={() => handleMarkAttendance(staff.id, 'PRESENT', selectedDailyDate)}
                          disabled={actionProcessing === staff.id}
                          className="w-full h-8 rounded-xl text-xs font-bold bg-slate-950 hover:bg-black text-white cursor-pointer gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>Mark Present</span>
                        </Button>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenEditModal(att)}
                            className="flex-1 h-8 rounded-xl text-xs font-bold border-slate-200 hover:bg-slate-100 cursor-pointer gap-1.5"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span>Correct</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenStaffModal(staff)}
                            className="h-8 px-2.5 rounded-xl text-xs font-bold border-slate-200 hover:bg-slate-100 cursor-pointer"
                            title="View Staff History"
                          >
                            <Eye className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* 8. TAB 3: TODAY'S LIVE ROSTER (FOR MANAGERS & LIVE INTAKE) */}
      {activeTab === 'today' && canManage && (
        <Card className="rounded-2xl border-slate-200/90 bg-white p-3.5 sm:p-5 shadow-2xs space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2 truncate">
                <Users className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="truncate">Today's Live Attendance Roster</span>
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5 line-clamp-1">
                Dispatch attendance requests and record live staff presence for today.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {dailyRoster.map((item) => {
              const staff = item.user;
              const att = item.attendance;
              const isSelf = staff.id === user?.id;

              return (
                <div
                  key={staff.id}
                  className="p-3.5 sm:p-4 rounded-xl border border-slate-200/90 bg-white shadow-2xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar className="h-9 w-9 rounded-xl border border-slate-200 shrink-0">
                        <AvatarImage src={staff.profileImage} alt={staff.name} />
                        <AvatarFallback className="bg-slate-900 text-white font-bold text-xs rounded-xl">
                          {staff.name?.slice(0, 2).toUpperCase() || 'ST'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <strong className="font-bold text-slate-900 text-xs block truncate" title={staff.name}>
                          {staff.name}
                        </strong>
                        <Badge variant="outline" className="text-[9px] font-bold px-1.5 py-0 mt-0.5 bg-slate-50 text-slate-600 truncate">
                          {staff.role.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {item.status === 'PRESENT' && <Badge className="bg-emerald-600 text-white text-[10px] font-bold">✓ Present</Badge>}
                      {item.status === 'PENDING' && <Badge className="bg-amber-500 text-white text-[10px] font-bold">⏳ Pending</Badge>}
                      {item.status === 'REJECTED' && <Badge className="bg-rose-600 text-white text-[10px] font-bold">✕ Rejected</Badge>}
                      {item.status === 'NOT_MARKED' && <Badge variant="outline" className="text-[10px] text-slate-400">Not Marked</Badge>}
                    </div>
                  </div>

                  <div className="pt-1 border-t border-slate-100">
                    {item.status === 'NOT_MARKED' ? (
                      <Button
                        size="sm"
                        onClick={() => handleMarkAttendance(staff.id, 'PRESENT')}
                        disabled={actionProcessing === staff.id || (isManager && !serverTime?.isManagerWindowOpen)}
                        className={cn(
                          "w-full h-8.5 rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 cursor-pointer",
                          isManager && !serverTime?.isManagerWindowOpen
                            ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                            : "bg-slate-950 hover:bg-black text-white"
                        )}
                      >
                        {actionProcessing === staff.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                        ) : isManager && !isSelf ? (
                          <Send className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                        ) : (
                          <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        )}
                        <span>{isManager && !isSelf ? "Send Request" : "Mark Present"}</span>
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenEditModal(att)}
                        className="w-full h-8.5 rounded-xl text-xs font-bold border-slate-200 hover:bg-slate-100 cursor-pointer gap-1.5"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>Correct Record</span>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* 9. TAB 4: MY ATTENDANCE (FOR ALL STAFF) */}
      {activeTab === 'my' && (
        <Card className="rounded-2xl border-slate-200/90 bg-white p-3.5 sm:p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="min-w-0">
              <h2 className="text-base font-black text-slate-900 truncate">Personal Attendance Record</h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Authoritative log of your verified presence.</p>
            </div>
            <Badge className="bg-slate-900 text-white font-mono text-xs px-2.5 py-0.5 rounded-lg shrink-0">
              {myHistory.length} Days
            </Badge>
          </div>

          {myHistory.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No attendance records found for your account yet.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200/80">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200/80 text-slate-600 font-extrabold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-3 min-w-[110px]">Date</th>
                    <th className="py-3 px-3 min-w-[100px]">Status</th>
                    <th className="py-3 px-3 min-w-[130px]">Marked By</th>
                    <th className="py-3 px-3 min-w-[110px]">Time</th>
                    <th className="py-3 px-3 min-w-[150px]">Method / Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {myHistory.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-bold text-slate-900 font-mono">{rec.date}</td>
                      <td className="py-2.5 px-3">
                        {rec.status === 'PRESENT' && <Badge className="bg-emerald-100 text-emerald-800 text-[10px] font-bold">Present</Badge>}
                        {rec.status === 'PENDING' && <Badge className="bg-amber-100 text-amber-800 text-[10px] font-bold">Pending</Badge>}
                        {rec.status === 'REJECTED' && <Badge className="bg-rose-100 text-rose-800 text-[10px] font-bold">Rejected</Badge>}
                        {rec.status === 'ABSENT' && <Badge variant="outline" className="text-[10px] font-bold">Absent</Badge>}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 truncate max-w-[140px]">{rec.markedByName || rec.markedByRole}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-500">
                        {new Date(rec.markedAt).toLocaleTimeString('en-US', { timeZone: 'Asia/Kathmandu', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 text-xs">
                        {rec.rejectionReason ? (
                          <span className="text-rose-600 font-medium">Rejection: {rec.rejectionReason}</span>
                        ) : (
                          rec.notes || (rec.method ? rec.method.replace(/_/g, ' ') : '—')
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* 10. TAB 5: AUDIT LOG & HISTORICAL RECORDS */}
      {activeTab === 'history' && canManage && (
        <Card className="rounded-2xl border-slate-200/90 bg-white p-3.5 sm:p-5 shadow-2xs space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2 truncate">
                <History className="w-4 h-4 text-slate-600 shrink-0" />
                <span className="truncate">Historical Attendance Logs & Audit History</span>
              </h2>
            </div>
            <Badge className="bg-slate-100 text-slate-800 font-bold text-xs shrink-0">
              {historyRecords.length} Records
            </Badge>
          </div>

          {historyLoading ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <RefreshCw className="w-7 h-7 animate-spin mx-auto text-indigo-600 shrink-0" />
              <p className="text-xs font-bold text-slate-600">Loading audit history...</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200/80">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200/80 text-slate-600 font-extrabold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-3 min-w-[110px]">Date</th>
                    <th className="py-3 px-3 min-w-[150px]">Staff</th>
                    <th className="py-3 px-3 min-w-[110px]">Role</th>
                    <th className="py-3 px-3 min-w-[100px]">Status</th>
                    <th className="py-3 px-3 min-w-[130px]">Marked By</th>
                    <th className="py-3 px-3 min-w-[180px]">Audit Trail</th>
                    <th className="py-3 px-3 text-right min-w-[100px]">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {historyRecords.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-bold text-slate-900 font-mono">{rec.date}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800 truncate max-w-[160px]">{rec.user?.name}</td>
                      <td className="py-2.5 px-3">
                        <Badge variant="outline" className="text-[10px] font-bold bg-slate-50">
                          {rec.user?.role?.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3">
                        {rec.status === 'PRESENT' && <Badge className="bg-emerald-100 text-emerald-800 text-[10px] font-bold">Present</Badge>}
                        {rec.status === 'PENDING' && <Badge className="bg-amber-100 text-amber-800 text-[10px] font-bold">Pending</Badge>}
                        {rec.status === 'REJECTED' && <Badge className="bg-rose-100 text-rose-800 text-[10px] font-bold">Rejected</Badge>}
                        {rec.status === 'ABSENT' && <Badge variant="outline" className="text-[10px] font-bold">Absent</Badge>}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 truncate max-w-[130px]">{rec.markedByName || rec.markedByRole}</td>
                      <td className="py-2.5 px-3 text-slate-500 text-xs">
                        {rec.auditLogs && rec.auditLogs.length > 0 ? (
                          <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[10px] block truncate max-w-[200px]" title={`${rec.auditLogs[0].action}: ${rec.auditLogs[0].reason || 'Logged'}`}>
                            {rec.auditLogs[0].action}: {rec.auditLogs[0].reason || 'Logged'}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenEditModal(rec)}
                          className="h-7 px-2.5 rounded-lg text-xs font-bold border-slate-200 hover:bg-slate-100 cursor-pointer gap-1 shrink-0"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span>Correct</span>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* 11. INDIVIDUAL ATTENDANCE HISTORY MODAL */}
      <Dialog open={staffModalOpen} onOpenChange={setStaffModalOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:w-full sm:max-w-3xl md:max-w-4xl max-h-[88vh] overflow-y-auto rounded-2xl p-4 sm:p-6 space-y-4">
          <DialogHeader className="pb-3 border-b border-slate-100 space-y-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl border border-slate-200 shrink-0">
                  <AvatarImage src={selectedStaffUser?.profileImage} alt={selectedStaffUser?.name} />
                  <AvatarFallback className="bg-slate-900 text-white font-bold text-xs rounded-xl">
                    {selectedStaffUser?.name?.slice(0, 2).toUpperCase() || 'ST'}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <DialogTitle className="text-base sm:text-lg font-black text-slate-900 truncate">
                    {selectedStaffUser?.name}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-500 font-medium mt-0.5 truncate">
                    {selectedStaffUser?.role?.replace(/_/g, ' ')} • {selectedStaffUser?.email}
                  </DialogDescription>
                </div>
              </div>

              {/* Month Indicator in Header */}
              <Badge className="bg-slate-900 text-white font-mono text-xs px-3 py-1 rounded-xl shrink-0 self-start sm:self-auto">
                {formattedMonthDisplay}
              </Badge>
            </div>
          </DialogHeader>

          {staffModalLoading ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <RefreshCw className="w-7 h-7 animate-spin mx-auto text-indigo-600 shrink-0" />
              <p className="text-xs font-bold text-slate-600">Loading attendance logs...</p>
            </div>
          ) : staffMonthlyData ? (
            <div className="space-y-4">

              {/* Top Monthly Metrics for this Staff */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200 text-center">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase block truncate">Present Days</span>
                  <strong className="text-xl sm:text-2xl font-black text-emerald-800">{staffMonthlyData.stats.presentCount}</strong>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  <span className="text-[10px] font-bold text-slate-600 uppercase block truncate">Absent Days</span>
                  <strong className="text-xl sm:text-2xl font-black text-slate-800">{staffMonthlyData.stats.absentCount}</strong>
                </div>
                <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-200 text-center">
                  <span className="text-[10px] font-bold text-indigo-700 uppercase block truncate">Attendance Rate</span>
                  <strong className="text-xl sm:text-2xl font-black text-indigo-800">
                    {staffMonthlyData.stats.attendanceRate !== null ? `${staffMonthlyData.stats.attendanceRate}%` : '—'}
                  </strong>
                </div>
                <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 text-center">
                  <span className="text-[10px] font-bold text-amber-700 uppercase block truncate">Pending / Rejected</span>
                  <strong className="text-xl sm:text-2xl font-black text-amber-800">
                    {staffMonthlyData.stats.pendingCount + staffMonthlyData.stats.rejectedCount}
                  </strong>
                </div>
              </div>

              {/* Day-by-Day Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200/80 max-h-[48vh] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                    <tr className="text-slate-600 font-extrabold uppercase tracking-wider text-[10px]">
                      <th className="py-2.5 px-3 min-w-[100px]">Date</th>
                      <th className="py-2.5 px-3 min-w-[80px]">Day</th>
                      <th className="py-2.5 px-3 min-w-[90px]">Status</th>
                      <th className="py-2.5 px-3 min-w-[90px]">Check-in</th>
                      <th className="py-2.5 px-3 min-w-[110px]">Marked By</th>
                      <th className="py-2.5 px-3 min-w-[140px]">Notes</th>
                      <th className="py-2.5 px-3 text-right min-w-[80px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {staffMonthlyData.dailyLogs.map((log: any) => (
                      <tr key={log.date} className={cn("hover:bg-slate-50 transition-colors", log.isToday && "bg-indigo-50/30")}>
                        <td className="py-2 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                          {log.date}
                          {log.isToday && <span className="ml-1 text-[9px] text-indigo-600 font-sans font-black">(Today)</span>}
                        </td>
                        <td className="py-2 px-3 font-semibold text-slate-600">{log.dayOfWeek}</td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          {log.status === 'PRESENT' && <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-bold">Present</Badge>}
                          {log.status === 'ABSENT' && <Badge className="bg-slate-100 text-slate-700 border-slate-300 text-[10px] font-bold">Absent</Badge>}
                          {log.status === 'PENDING' && <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-bold">Pending</Badge>}
                          {log.status === 'REJECTED' && <Badge className="bg-rose-100 text-rose-800 border-rose-300 text-[10px] font-bold">Rejected</Badge>}
                          {log.status === 'NOT_MARKED' && <span className="text-slate-400 text-[10px] font-semibold">Not Marked</span>}
                          {log.status === 'FUTURE' && <span className="text-slate-300 text-[10px] font-medium italic">Upcoming</span>}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-700 whitespace-nowrap">
                          {log.record?.formattedCheckInTime || '—'}
                        </td>
                        <td className="py-2 px-3 text-slate-600 truncate max-w-[120px]">
                          {log.record?.markedBy || '—'}
                        </td>
                        <td className="py-2 px-3 text-slate-500 text-xs max-w-[180px]">
                          {log.record?.rejectionReason ? (
                            <span className="text-rose-600 font-medium truncate block" title={`Rejection: ${log.record.rejectionReason}`}>
                              Rejection: {log.record.rejectionReason}
                            </span>
                          ) : (
                            <span className="truncate block" title={log.record?.notes || ''}>
                              {log.record?.notes || (log.record?.method ? log.record.method.replace(/_/g, ' ') : '—')}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right whitespace-nowrap">
                          {log.record ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenEditModal(log.record)}
                              className="h-6.5 px-2 text-[11px] font-bold text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                            >
                              Edit
                            </Button>
                          ) : !log.isFuture ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleMarkAttendance(selectedStaffUser.id, 'PRESENT', log.date)}
                              className="h-6.5 px-2 text-[11px] font-bold text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                            >
                              Mark
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>
          ) : null}

          <DialogFooter className="pt-2 border-t border-slate-100">
            <Button variant="outline" onClick={() => setStaffModalOpen(false)} className="rounded-xl h-9 text-xs font-bold border-slate-200 cursor-pointer">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 12. REJECT ATTENDANCE MODAL */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl p-5 space-y-3">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-slate-900 flex items-center gap-2">
              <XCircle className="h-5 w-5 text-rose-600 shrink-0" />
              <span>Reject Attendance Request</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Please specify the reason why you are rejecting this attendance request for {selectedRequestToReject?.date}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
            <Label className="text-xs font-bold text-slate-700">Reason for Rejection (Optional)</Label>
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g., I was out on on-site customer repair..."
              className="text-xs rounded-xl bg-slate-50 border-slate-200 min-h-[80px]"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-1">
            <Button
              variant="outline"
              onClick={() => setRejectModalOpen(false)}
              disabled={submittingReject}
              className="rounded-xl text-xs font-bold border-slate-200 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitReject}
              disabled={submittingReject}
              className="rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
            >
              {submittingReject ? <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" /> : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 13. EDIT / CORRECTION ATTENDANCE MODAL */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl p-5 space-y-3">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-slate-900 flex items-center gap-2">
              <Edit3 className="h-5 w-5 text-blue-600 shrink-0" />
              <span>Correct Attendance Record</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Update status and preserve historical audit logging for {selectedRecordToEdit?.user?.name || selectedRecordToEdit?.date}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <Label className="text-xs font-bold text-slate-700">New Status *</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger className="h-9 text-xs rounded-xl bg-white border-slate-200 font-bold mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl text-xs">
                    <SelectItem value="PRESENT">Present</SelectItem>
                    <SelectItem value="ABSENT">Absent</SelectItem>
                    <SelectItem value="REJECTED">Rejected</SelectItem>
                    <SelectItem value="LATE">Late</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700">Current Status</Label>
                <div className="h-9 rounded-xl bg-slate-100 flex items-center px-3 text-xs font-bold text-slate-700 mt-1">
                  {selectedRecordToEdit?.status}
                </div>
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-700">
                Reason for Correction <span className="text-rose-500">*</span>
              </Label>
              <Input
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="e.g., Staff arrived with Manager verbal approval..."
                className="h-9 text-xs rounded-xl bg-white border-slate-200 font-medium mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-700">Internal Operational Notes</Label>
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Optional notes..."
                className="text-xs rounded-xl bg-white border-slate-200 min-h-[60px] mt-1"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-1">
            <Button
              variant="outline"
              onClick={() => setEditModalOpen(false)}
              disabled={submittingEdit}
              className="rounded-xl text-xs font-bold border-slate-200 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitEdit}
              disabled={submittingEdit}
              className="rounded-xl text-xs font-bold bg-slate-950 hover:bg-black text-white px-4 cursor-pointer"
            >
              {submittingEdit ? <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" /> : "Save Correction"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 14. DELETE / ARCHIVE ATTENDANCE MODAL */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl p-5 space-y-3">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-slate-900 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
              <span>Archive Attendance Record</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Are you sure you want to archive the attendance record for {selectedRecordToDelete?.user?.name} on {selectedRecordToDelete?.date}?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-1">
            <Label className="text-xs font-bold text-slate-700">Reason for Archiving</Label>
            <Input
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="e.g., Erroneous duplicate entry..."
              className="h-9 text-xs rounded-xl bg-white border-slate-200"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-1">
            <Button
              variant="outline"
              onClick={() => setDeleteModalOpen(false)}
              disabled={submittingDelete}
              className="rounded-xl text-xs font-bold border-slate-200 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitDelete}
              disabled={submittingDelete}
              className="rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
            >
              {submittingDelete ? <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" /> : "Archive Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
