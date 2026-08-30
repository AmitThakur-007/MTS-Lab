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
    canManage ? 'today' : 'my'
  );

  // Server Time & Window State
  const [serverTime, setServerTime] = useState<{
    dateStr?: string;
    year?: string;
    month?: string;
    day?: string;
    formattedTime?: string;
    formattedSeconds?: string;
    isManagerWindowOpen?: boolean;
    isBeforeManagerWindow?: boolean;
    isAfterManagerWindow?: boolean;
    remainingSeconds?: number;
    timezone?: string;
    dispatchCount?: number;
    canManagerDispatch?: boolean;
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

  // Purge Staff Modal State (Super Admin Only)
  const [purgeModalOpen, setPurgeModalOpen] = useState(false);
  const [submittingPurge, setSubmittingPurge] = useState(false);

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
      const res: any = await api.get('/attendance/server-time');
      if (res) {
        setServerTime({
          dateStr: res.dateString,
          year: res.dateString?.split('-')[0],
          month: res.dateString?.split('-')[1],
          day: res.dateString?.split('-')[2],
          formattedTime: res.timeString,
          formattedSeconds: res.timeString,
          isManagerWindowOpen: res.isWithinWindow,
          isBeforeManagerWindow: false,
          isAfterManagerWindow: !res.isWithinWindow,
          remainingSeconds: 0,
          timezone: 'Asia/Kathmandu'
        });
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

      const res: any = await api.get(`/attendance/monthly-report?${params.toString()}`);
      const list = Array.isArray(res) ? res : res?.report || res?.data || [];
      setMonthlyReport(list);
    } catch (err: any) {
      console.error("[FETCH MONTHLY REPORT ERROR]", err);
    } finally {
      setMonthlyLoading(false);
    }
  }, [canManage, selectedYearMonth, roleFilter, statusFilter, searchQuery]);

  // 2. Fetch Daily Attendance View (Specific Date or Today's Roster)
  const fetchDailyData = useCallback(async (targetDateStr?: string) => {
    if (!canManage) return;
    setDailyLoading(true);
    try {
      const dateToFetch = targetDateStr || selectedDailyDate;
      const res: any = await api.get(`/attendance/roster?date=${dateToFetch}`);

      const rawRoster = res?.roster || (Array.isArray(res) ? res : []);

      const rosterList = rawRoster.map((item: any) => ({
        user: {
          id: item.userId || item.id,
          name: item.name || 'Staff Member',
          email: item.email || '',
          role: item.role || 'TECHNICIAN',
          department: item.department || 'Repair Lab',
          profileImage: item.avatarUrl || null,
        },
        attendance: item.attendanceId ? {
          id: item.attendanceId,
          status: item.status,
          checkInTime: item.checkInTime,
          checkOutTime: item.checkOutTime,
          markedByName: item.markedByName || 'Administrator',
          markedAt: item.checkInTime || item.date,
          notes: item.notes
        } : null,
        status: item.status || 'NOT_MARKED'
      }));

      setDailyRoster(rosterList);

      const presentCount = rosterList.filter((r: any) => ['PRESENT', 'LATE', 'HALF_DAY'].includes(r.status)).length;
      const absentCount = rosterList.filter((r: any) => r.status === 'ABSENT').length;
      const pendingCount = rosterList.filter((r: any) => r.status === 'PENDING').length;
      const notMarkedCount = rosterList.filter((r: any) => r.status === 'NOT_MARKED').length;

      const rate = rosterList.length > 0 ? Math.round((presentCount / rosterList.length) * 100) : 100;

      setDailyStats({
        totalStaff: rosterList.length,
        presentCount,
        absentCount,
        pendingCount,
        rejectedCount: rosterList.filter((r: any) => r.status === 'REJECTED').length,
        notMarkedCount
      });

      setMonthlyStats({
        totalStaff: rosterList.length,
        presentToday: presentCount,
        absentToday: absentCount,
        attendanceRate: rate
      });

      if (res?.windowInfo) {
        setServerTime(prev => ({
          ...prev,
          isManagerWindowOpen: res.windowInfo.isWithinWindow,
          formattedSeconds: res.windowInfo.currentTimeNPT,
          dispatchCount: res.windowInfo.dispatchCount,
          canManagerDispatch: res.windowInfo.canManagerDispatch
        }));
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
      const res: any = await api.get(`/attendance/staff/${userId}/monthly?month=${monthStr}`);
      const logs = Array.isArray(res) ? res : res?.dailyLogs || [];
      const presentCount = logs.filter((l: any) => l.status === 'PRESENT').length;
      const absentCount = logs.filter((l: any) => l.status === 'ABSENT').length;

      setStaffMonthlyData({
        dailyLogs: logs,
        stats: {
          presentCount,
          absentCount,
          pendingCount: logs.filter((l: any) => l.status === 'PENDING').length,
          rejectedCount: logs.filter((l: any) => l.status === 'REJECTED').length,
          attendanceRate: logs.length > 0 ? Math.round((presentCount / logs.length) * 100) : null
        }
      });
    } catch (err: any) {
      console.error("[FETCH STAFF MONTHLY ERROR]", err);
      toast.error(err?.message || "Failed to load attendance logs.");
    } finally {
      setStaffModalLoading(false);
    }
  }, []);

  const handleOpenStaffModal = (staff: any) => {
    setSelectedStaffUser(staff);
    setStaffModalOpen(true);
    fetchStaffMonthly(staff.id, selectedYearMonth);
  };

  // Purge / Remove Staff & All Records (Super Admin Only)
  const handlePurgeStaffAttendance = async () => {
    if (!selectedStaffUser) return;
    setSubmittingPurge(true);
    try {
      const res: any = await api.delete(`/attendance/staff/${selectedStaffUser.id}`);
      if (res?.success) {
        toast.success("Staff member and attendance records permanently deleted.");
        setPurgeModalOpen(false);
        setStaffModalOpen(false);
        fetchDailyData();
        fetchMonthlyReport();
      } else {
        toast.error(res?.error || "Failed to remove staff records.");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to remove staff records.");
    } finally {
      setSubmittingPurge(false);
    }
  };

  // 4. Fetch Pending Requests
  const fetchPendingRequests = useCallback(async () => {
    try {
      const data: any = await api.get('/attendance/pending-requests');
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
      const res: any = await api.get('/attendance/my');
      const recent = res?.recent || (Array.isArray(res) ? res : []);
      setMyHistory(recent);

      const presentCount = recent.filter((r: any) => r.status === 'PRESENT').length;
      const absentCount = recent.filter((r: any) => r.status === 'ABSENT').length;
      const rate = recent.length > 0 ? Math.round((presentCount / recent.length) * 100) : 100;

      setMyStats({
        totalMonthRecords: recent.length,
        presentCount,
        absentCount,
        pendingCount: recent.filter((r: any) => r.status === 'PENDING').length,
        rejectedCount: recent.filter((r: any) => r.status === 'REJECTED').length,
        attendanceRate: rate
      });
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

      const data: any = await api.get(`/attendance/history?${params.toString()}`);
      if (Array.isArray(data)) {
        setHistoryRecords(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  }, [canManage, roleFilter, statusFilter, searchQuery]);

  // Month Navigation Handlers
  const handlePrevMonth = () => {
    const [y, m] = selectedYearMonth.split('-').map(Number);
    const prevDate = subMonths(new Date(y, m - 1, 1), 1);
    setSelectedYearMonth(format(prevDate, 'yyyy-MM'));
  };

  const handleNextMonth = () => {
    const [y, m] = selectedYearMonth.split('-').map(Number);
    const nextDate = addMonths(new Date(y, m - 1, 1), 1);
    setSelectedYearMonth(format(nextDate, 'yyyy-MM'));
  };

  const handleCurrentMonth = () => {
    if (serverTime?.year && serverTime?.month) {
      setSelectedYearMonth(`${serverTime.year}-${serverTime.month}`);
    } else {
      setSelectedYearMonth(format(new Date(), 'yyyy-MM'));
    }
  };

  // Initial Load
  useEffect(() => {
    fetchServerTime();
    fetchPendingRequests();
    fetchMyAttendance();
    fetchDailyData();
  }, [fetchServerTime, fetchPendingRequests, fetchMyAttendance, fetchDailyData]);

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

  // Realtime Sync
  useRealtimeSync(['attendance', 'user', 'AttendanceBroadcast'], () => {
    fetchServerTime();
    if (activeTab === 'monthly') fetchMonthlyReport();
    if (activeTab === 'daily' || activeTab === 'today') fetchDailyData();
    if (activeTab === 'history') fetchHistory();
    fetchMyAttendance();
    fetchPendingRequests();
  });

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
      toast.success("Attendance synchronized!");
    }, 300);
  };

  // Direct Attendance Marker (Universal Super Admin Override)
  const handleMarkAttendance = async (targetUserId: string, targetStatus: string = 'PRESENT', targetDate?: string) => {
    setActionProcessing(targetUserId);
    try {
      const res: any = await api.post('/attendance/mark', {
        userId: targetUserId,
        status: targetStatus,
        date: targetDate || (activeTab === 'daily' ? selectedDailyDate : undefined)
      });
      if (res?.success) {
        toast.success(res.message || `Attendance marked as ${targetStatus}!`);
        fetchDailyData();
        fetchMonthlyReport();
        fetchMyAttendance();
      } else {
        toast.error(res?.error || "Unable to record attendance.");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || "Unable to save attendance.");
    } finally {
      setActionProcessing(null);
    }
  };

  // Manager Broadcast Dispatch (10:00 - 10:35 AM)
  const handleDispatchBroadcast = async () => {
    setLoading(true);
    try {
      const res: any = await api.post('/attendance/dispatch-request', {});
      if (res?.success) {
        toast.success(res.message);
        fetchDailyData();
        fetchPendingRequests();
      } else {
        toast.error(res?.error || "Failed to dispatch request.");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || "Broadcast dispatch rejected.");
    } finally {
      setLoading(false);
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

  // Filtered Roster for View
  const filteredDailyRoster = useMemo(() => {
    return dailyRoster.filter((item) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q ||
        item.user.name.toLowerCase().includes(q) ||
        item.user.email.toLowerCase().includes(q);
      const matchesRole = roleFilter === 'ALL' || item.user.role === roleFilter;
      const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [dailyRoster, searchQuery, roleFilter, statusFilter]);

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-4 pb-12 animate-in fade-in duration-150 overflow-hidden font-sans">

      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3.5 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-start sm:items-center gap-3 min-w-0 max-w-full">
          <div className="w-10 h-10 sm:w-11 sm:h-11 bg-slate-950 text-white rounded-xl flex items-center justify-center shadow-xs shrink-0 mt-0.5 sm:mt-0">
            <UserCheck className="w-5 h-5 text-indigo-400 shrink-0" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight truncate">
                Attendance Hub
              </h1>

              {serverTime?.isManagerWindowOpen ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 shrink-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse shrink-0" />
                  <span className="truncate">Manager Window Active (10:00–10:35 AM)</span>
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
              {isSuperAdmin
                ? "24/7 Universal Override Active: Super Admin can take and update staff attendance at any time."
                : "Live staff attendance and operational presence verification for MTS Lab."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end shrink-0 w-full sm:w-auto">
          {isManager && (
            <Button
              size="sm"
              onClick={handleDispatchBroadcast}
              disabled={!serverTime?.isManagerWindowOpen || (serverTime?.dispatchCount || 0) >= 3 || loading}
              className="h-9 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs gap-1.5 cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Broadcast Request ({serverTime?.dispatchCount || 0}/3)</span>
            </Button>
          )}

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

      {/* 2. Employee Pending Attendance Request Callout Card */}
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

      {/* 3. Top Dynamic KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-3.5 sm:p-4 rounded-2xl border border-slate-200 bg-white shadow-2xs">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <span className="truncate">Total Staff</span>
            <Users className="h-4 w-4 text-slate-400 shrink-0" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-slate-900">{dailyStats.totalStaff}</span>
            <span className="text-xs font-medium text-slate-400">Roster</span>
          </div>
        </Card>

        <Card className="p-3.5 sm:p-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 shadow-2xs">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-emerald-700">
            <span className="truncate">Present Today</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-emerald-800">{dailyStats.presentCount}</span>
            <span className="text-xs font-bold text-emerald-600">On Duty</span>
          </div>
        </Card>

        <Card className="p-3.5 sm:p-4 rounded-2xl border border-slate-200 bg-slate-50/70 shadow-2xs">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-600">
            <span className="truncate">Absent Today</span>
            <UserX className="h-4 w-4 text-slate-400 shrink-0" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-slate-800">{dailyStats.absentCount}</span>
            <span className="text-xs font-medium text-slate-400">Off Duty</span>
          </div>
        </Card>

        <Card className="p-3.5 sm:p-4 rounded-2xl border border-indigo-200 bg-indigo-50/40 shadow-2xs">
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

      {/* 4. Navigation Tabs & Filter Bar */}
      <Card className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        <div className="p-3 sm:p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="inline-flex p-1 bg-slate-100/90 rounded-xl border border-slate-200/70 overflow-x-auto max-w-full scrollbar-none">
            {canManage && (
              <button
                onClick={() => setActiveTab('today')}
                className={cn(
                  "px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0",
                  activeTab === 'today' ? "bg-slate-950 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Users className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span>Take Attendance</span>
              </button>
            )}

            {canManage && (
              <button
                onClick={() => setActiveTab('monthly')}
                className={cn(
                  "px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0",
                  activeTab === 'monthly' ? "bg-slate-950 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
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
                  activeTab === 'daily' ? "bg-slate-950 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                <CalendarDays className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Daily View</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('my')}
              className={cn(
                "px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0",
                activeTab === 'my' ? "bg-slate-950 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
              )}
            >
              <User className="w-3.5 h-3.5 shrink-0" />
              <span>My Attendance</span>
            </button>
          </div>

          <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 text-xs font-bold px-2.5 py-1 self-start sm:self-auto">
            {activeTab === 'today' && "Today's Live Roster"}
            {activeTab === 'monthly' && `Month: ${formattedMonthDisplay}`}
            {activeTab === 'daily' && `Date: ${selectedDailyDate}`}
            {activeTab === 'my' && "My Records"}
          </Badge>
        </div>

        {/* Filter Controls */}
        <div className="p-3 sm:p-4 bg-slate-50/60 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
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
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v)}>
              <SelectTrigger className="h-8.5 w-[130px] rounded-xl bg-white border-slate-200 text-xs font-bold shadow-2xs">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent className="rounded-xl text-xs">
                <SelectItem value="ALL">All Roles</SelectItem>
                <SelectItem value="MANAGER">Manager</SelectItem>
                <SelectItem value="TECHNICIAN">Technician</SelectItem>
                <SelectItem value="RECEPTIONIST">Receptionist</SelectItem>
                <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
              <SelectTrigger className="h-8.5 w-[130px] rounded-xl bg-white border-slate-200 text-xs font-bold shadow-2xs">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent className="rounded-xl text-xs">
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="PRESENT">Present</SelectItem>
                <SelectItem value="ABSENT">Absent</SelectItem>
                <SelectItem value="NOT_MARKED">Not Marked</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="h-8.5 px-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* 5. TAB: TODAY'S LIVE ROSTER (TAKE ATTENDANCE) */}
      {(activeTab === 'today' || activeTab === 'daily') && canManage && (
        <Card className="rounded-2xl border-slate-200 bg-white p-4 sm:p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span>Today's Live Attendance Roster</span>
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Dispatch attendance requests and record live staff presence for today.
              </p>
            </div>
            <span className="text-xs font-bold text-slate-500 font-mono">
              {filteredDailyRoster.length} Staff Listed
            </span>
          </div>

          {dailyLoading ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <RefreshCw className="w-7 h-7 animate-spin mx-auto text-indigo-600" />
              <p className="text-xs font-bold text-slate-600">Loading staff roster...</p>
            </div>
          ) : filteredDailyRoster.length === 0 ? (
            <div className="p-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 space-y-2">
              <Users className="w-9 h-9 mx-auto text-slate-300" />
              <p className="text-sm font-bold text-slate-700">No staff members found</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No staff users matched the selected filters.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
              {filteredDailyRoster.map((item) => {
                const staff = item.user;
                const isMarked = item.status === 'PRESENT';
                const isAbsent = item.status === 'ABSENT';

                return (
                  <div
                    key={staff.id}
                    className={cn(
                      "p-4 rounded-xl border transition-all bg-white shadow-2xs space-y-3",
                      isMarked ? "border-emerald-200 bg-emerald-50/10" :
                        isAbsent ? "border-rose-200 bg-rose-50/10" : "border-slate-200"
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
                          <span className="text-[11px] text-slate-500 font-medium block truncate">
                            {staff.email}
                          </span>
                          <Badge variant="outline" className="text-[9px] font-bold px-1.5 py-0 mt-0.5 bg-slate-50 text-slate-600">
                            {staff.role.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {item.status === 'PRESENT' && <Badge className="bg-emerald-600 text-white text-[10px] font-bold">✓ Present</Badge>}
                        {item.status === 'ABSENT' && <Badge className="bg-rose-600 text-white text-[10px] font-bold">✕ Absent</Badge>}
                        {item.status === 'LATE' && <Badge className="bg-amber-500 text-white text-[10px] font-bold">⏳ Late</Badge>}
                        {item.status === 'PENDING' && <Badge className="bg-amber-500 text-white text-[10px] font-bold">⏳ Pending</Badge>}
                        {item.status === 'NOT_MARKED' && <Badge variant="outline" className="text-[10px] text-slate-400">Not Marked</Badge>}
                      </div>
                    </div>

                    {/* Attendance Action Buttons */}
                    <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5">
                      <Button
                        size="sm"
                        onClick={() => handleMarkAttendance(staff.id, 'PRESENT')}
                        disabled={actionProcessing === staff.id}
                        className={cn(
                          "flex-1 h-8 rounded-lg text-xs font-bold gap-1 cursor-pointer",
                          isMarked ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-slate-900 hover:bg-black text-white"
                        )}
                      >
                        {actionProcessing === staff.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                        <span>{isMarked ? "Present" : "Mark Present"}</span>
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleMarkAttendance(staff.id, 'ABSENT')}
                        disabled={actionProcessing === staff.id}
                        className="h-8 px-2.5 rounded-lg text-xs font-bold text-rose-600 hover:bg-rose-50 border-rose-200 cursor-pointer"
                        title="Mark Absent"
                      >
                        <UserX className="h-3.5 w-3.5" />
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenStaffModal(staff)}
                        className="h-8 px-2.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 border-slate-200 cursor-pointer"
                        title="View Monthly History"
                      >
                        <Eye className="h-3.5 w-3.5 text-indigo-600" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* 6. TAB: MONTHLY ATTENDANCE REPORT */}
      {activeTab === 'monthly' && canManage && (
        <Card className="rounded-2xl border-slate-200 bg-white p-4 sm:p-5 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-600" />
                <span>Monthly Attendance Report — {formattedMonthDisplay}</span>
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Overview of staff working days, presence score, and performance rating.
              </p>
            </div>
            <Badge className="bg-slate-900 text-white text-xs font-bold px-2.5 py-0.5 rounded-lg">
              {monthlyReport.length} Staff Records
            </Badge>
          </div>

          {monthlyLoading ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <RefreshCw className="w-7 h-7 animate-spin mx-auto text-indigo-600" />
              <p className="text-xs font-bold text-slate-600">Compiling report...</p>
            </div>
          ) : monthlyReport.length === 0 ? (
            <div className="p-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 space-y-2">
              <Calendar className="w-9 h-9 mx-auto text-slate-300" />
              <p className="text-sm font-bold text-slate-700">No attendance records found</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-3.5">Staff Member</th>
                    <th className="py-3 px-3">Role</th>
                    <th className="py-3 px-3 text-center">Present</th>
                    <th className="py-3 px-3 text-center">Absent</th>
                    <th className="py-3 px-3 text-center">Attendance %</th>
                    <th className="py-3 px-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {monthlyReport.map((item) => {
                    const staff = item.user;
                    const rate = item.attendanceRate;

                    return (
                      <tr key={staff.id} className="hover:bg-slate-50">
                        <td className="py-3 px-3.5 font-bold text-slate-900">{staff.name}</td>
                        <td className="py-3 px-3"><Badge variant="outline">{staff.role.replace(/_/g, ' ')}</Badge></td>
                        <td className="py-3 px-3 text-center font-bold text-emerald-700">{item.presentDays}</td>
                        <td className="py-3 px-3 text-center font-bold text-rose-700">{item.absentDays}</td>
                        <td className="py-3 px-3 text-center font-mono font-bold">{rate !== null ? `${rate}%` : '—'}</td>
                        <td className="py-3 px-3.5 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenStaffModal(staff)}
                            className="h-7 px-2.5 rounded-lg text-xs font-bold"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1 text-indigo-600" />
                            <span>View History</span>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* 7. TAB: MY ATTENDANCE */}
      {activeTab === 'my' && (
        <Card className="rounded-2xl border-slate-200 bg-white p-4 sm:p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-black text-slate-900">Personal Attendance Record</h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Authoritative log of your verified presence.</p>
            </div>
            <Badge className="bg-slate-900 text-white font-mono text-xs px-2.5 py-0.5 rounded-lg">
              {myHistory.length} Days Recorded
            </Badge>
          </div>

          {myHistory.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No attendance records found for your account yet.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Check In</th>
                    <th className="py-3 px-3">Check Out</th>
                    <th className="py-3 px-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {myHistory.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-bold font-mono">{rec.date}</td>
                      <td className="py-2.5 px-3">
                        <Badge className={cn(
                          "text-[10px] font-bold",
                          rec.status === 'PRESENT' ? "bg-emerald-100 text-emerald-800" :
                            rec.status === 'ABSENT' ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"
                        )}>
                          {rec.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 font-mono">{rec.checkInTime || '—'}</td>
                      <td className="py-2.5 px-3 font-mono">{rec.checkOutTime || '—'}</td>
                      <td className="py-2.5 px-3 text-slate-500">{rec.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* 8. INDIVIDUAL ATTENDANCE HISTORY MODAL WITH SUPER ADMIN DELETE */}
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
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase block">Present Days</span>
                  <strong className="text-xl sm:text-2xl font-black text-emerald-800">{staffMonthlyData.stats.presentCount}</strong>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  <span className="text-[10px] font-bold text-slate-600 uppercase block">Absent Days</span>
                  <strong className="text-xl sm:text-2xl font-black text-slate-800">{staffMonthlyData.stats.absentCount}</strong>
                </div>
                <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-200 text-center">
                  <span className="text-[10px] font-bold text-indigo-700 uppercase block">Attendance Rate</span>
                  <strong className="text-xl sm:text-2xl font-black text-indigo-800">
                    {staffMonthlyData.stats.attendanceRate !== null ? `${staffMonthlyData.stats.attendanceRate}%` : '—'}
                  </strong>
                </div>
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-center">
                  <span className="text-[10px] font-bold text-amber-700 uppercase block">Pending / Other</span>
                  <strong className="text-xl sm:text-2xl font-black text-amber-800">
                    {staffMonthlyData.stats.pendingCount + staffMonthlyData.stats.rejectedCount}
                  </strong>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-[48vh] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                    <tr className="text-slate-600 font-extrabold uppercase tracking-wider text-[10px]">
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Check-in</th>
                      <th className="py-2.5 px-3">Notes</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {staffMonthlyData.dailyLogs.map((log: any) => (
                      <tr key={log.id || log.date} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono font-bold">{log.date}</td>
                        <td className="py-2 px-3">
                          <Badge className={cn(
                            "text-[10px] font-bold",
                            log.status === 'PRESENT' ? "bg-emerald-100 text-emerald-800" :
                              log.status === 'ABSENT' ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"
                          )}>
                            {log.status}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 font-mono">{log.checkInTime || '—'}</td>
                        <td className="py-2 px-3 text-slate-500">{log.notes || '—'}</td>
                        <td className="py-2 px-3 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenEditModal(log)}
                            className="h-6.5 px-2 text-[11px] font-bold text-blue-600 hover:bg-blue-50"
                          >
                            Edit
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <DialogFooter className="pt-2 border-t border-slate-100 flex items-center justify-between">
            {isSuperAdmin && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setPurgeModalOpen(true)}
                className="rounded-xl h-9 text-xs font-bold gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove Staff & All Records</span>
              </Button>
            )}
            <Button variant="outline" onClick={() => setStaffModalOpen(false)} className="rounded-xl h-9 text-xs font-bold ml-auto">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 9. REJECT ATTENDANCE MODAL */}
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
            <Label className="text-xs font-bold text-slate-700">Reason for Rejection</Label>
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

      {/* 10. EDIT ATTENDANCE RECORD MODAL */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl p-5 space-y-3">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-slate-900 flex items-center gap-2">
              <Edit3 className="h-5 w-5 text-blue-600 shrink-0" />
              <span>Correct Attendance Record</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Update status and notes for {selectedRecordToEdit?.user?.name || selectedRecordToEdit?.date}.
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
                    <SelectItem value="LATE">Late</SelectItem>
                    <SelectItem value="HALF_DAY">Half Day</SelectItem>
                    <SelectItem value="REJECTED">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700">Current Status</Label>
                <div className="h-9 rounded-xl bg-slate-100 flex items-center px-3 text-xs font-bold text-slate-700 mt-1">
                  {selectedRecordToEdit?.status || 'NOT_MARKED'}
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
              <Label className="text-xs font-bold text-slate-700">Internal Notes</Label>
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
              {submittingEdit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save Correction"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 11. PURGE / REMOVE STAFF CONFIRMATION MODAL (SUPER ADMIN ONLY) */}
      <Dialog open={purgeModalOpen} onOpenChange={setPurgeModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl p-5 space-y-3">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-slate-900 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
              <span>Permanently Remove Staff Member?</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              This will permanently delete <strong className="text-slate-800">{selectedStaffUser?.name}</strong> and purge all their historical attendance logs from the system. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 pt-1">
            <Button
              variant="outline"
              onClick={() => setPurgeModalOpen(false)}
              disabled={submittingPurge}
              className="rounded-xl text-xs font-bold border-slate-200 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={handlePurgeStaffAttendance}
              disabled={submittingPurge}
              className="rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
            >
              {submittingPurge ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Yes, Remove Permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}