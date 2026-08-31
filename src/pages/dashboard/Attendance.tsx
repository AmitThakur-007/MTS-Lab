import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  UserCheck,
  Users,
  Clock,
  Calendar,
  Layers,
  History,
  FileSpreadsheet,
  CheckCircle2,
  Lock,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { useRealtimeSync } from '@/services/realtime';
import { api } from '@/services/api';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

// Subcomponents
import { AttendanceHeader } from '@/components/attendance/AttendanceHeader';
import { AttendanceStats } from '@/components/attendance/AttendanceStats';
import { TodayRosterView, StaffRosterItem } from '@/components/attendance/TodayRosterView';
import { MonthlyMatrixView, MonthlyStaffReport } from '@/components/attendance/MonthlyMatrixView';
import { AttendanceHistoryView, AttendanceHistoryRecord, AuditLogItem } from '@/components/attendance/AttendanceHistoryView';
import { PersonalAttendanceView, PersonalDailyLog } from '@/components/attendance/PersonalAttendanceView';
import {
  EditRecordModal,
  StaffHistoryModal,
  BulkMarkModal,
  PurgeStaffModal,
} from '@/components/attendance/AttendanceModals';

export default function Attendance() {
  const { user } = useAuthStore();
  const role = user?.role || 'STAFF';
  const isAdminOrSuperAdmin = role === 'SUPER_ADMIN' || role === 'ADMIN';
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const isManager = role === 'MANAGER';
  const isManagement = isAdminOrSuperAdmin || isManager;

  // Active Tab
  const [activeTab, setActiveTab] = useState<'roster' | 'monthly' | 'history' | 'personal'>('roster');

  // Dates
  const [serverDate, setServerDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [serverTime, setServerTime] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));

  // Time window status
  const [isWithinWindow, setIsWithinWindow] = useState<boolean>(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);
  const [secondsUntilOpen, setSecondsUntilOpen] = useState<number>(0);

  // Data states
  const [roster, setRoster] = useState<StaffRosterItem[]>([]);
  const [stats, setStats] = useState({
    totalStaff: 0,
    presentCount: 0,
    absentCount: 0,
    lateCount: 0,
    halfDayCount: 0,
    notMarkedCount: 0,
    pendingCount: 0,
    attendanceRate: 100,
  });

  const [monthlyReport, setMonthlyReport] = useState<MonthlyStaffReport[]>([]);
  const [historyRecords, setHistoryRecords] = useState<AttendanceHistoryRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);

  // Personal state
  const [myTodayRecord, setMyTodayRecord] = useState<any>(null);
  const [myMonthlyStats, setMyMonthlyStats] = useState({
    presentCount: 0,
    absentCount: 0,
    pendingCount: 0,
    attendanceRate: 100,
  });
  const [myDailyLogs, setMyDailyLogs] = useState<PersonalDailyLog[]>([]);

  // Modal states
  const [editingRecord, setEditingRecord] = useState<any | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [selectedStaffHistory, setSelectedStaffHistory] = useState<{
    userId: string;
    staffName: string;
    dailyLogs: any[];
    stats: any;
    month: string;
  } | null>(null);
  const [isStaffHistoryOpen, setIsStaffHistoryOpen] = useState(false);
  const [isLoadingStaffHistory, setIsLoadingStaffHistory] = useState(false);

  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);

  const [purgingStaff, setPurgingStaff] = useState<{ userId: string; staffName: string } | null>(null);
  const [isPurgeModalOpen, setIsPurgeModalOpen] = useState(false);
  const [isPurging, setIsPurging] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  // Realtime hook
  useRealtimeSync(['attendance'], () => {
    refreshAllData();
  });

  // 1. Fetch Server Time and NPT status
  const fetchServerTime = useCallback(async () => {
    try {
      const data = await api.get<{
        dateString: string;
        timeString: string;
        isWithinWindow: boolean;
        secondsRemaining: number;
        secondsUntilOpen: number;
      }>('/attendance/server-time');

      if (data) {
        setServerDate(data.dateString);
        setServerTime(data.timeString);
        setIsWithinWindow(data.isWithinWindow);
        setSecondsRemaining(data.secondsRemaining || 0);
        setSecondsUntilOpen(data.secondsUntilOpen || 0);
      }
    } catch (err) {
      console.warn('[SERVER TIME FETCH]', err);
    }
  }, []);

  // 2. Fetch Today Roster
  const fetchRoster = useCallback(async (targetDate: string) => {
    try {
      const data = await api.get<{
        success: boolean;
        roster: StaffRosterItem[];
        stats: any;
        windowInfo: any;
      }>(`/attendance/roster?date=${targetDate}`);

      if (data && data.roster) {
        setRoster(data.roster);
        if (data.stats) {
          setStats(data.stats);
        }
      }
    } catch (err) {
      console.error('[FETCH ROSTER ERROR]', err);
      toast.error('Failed to load attendance roster.');
    }
  }, []);

  // 3. Fetch Monthly Report
  const fetchMonthlyReport = useCallback(async (month: string) => {
    try {
      const data = await api.get<{
        success: boolean;
        report: MonthlyStaffReport[];
      }>(`/attendance/monthly-report?month=${month}`);

      if (data && data.report) {
        setMonthlyReport(data.report);
      }
    } catch (err) {
      console.error('[FETCH MONTHLY ERROR]', err);
    }
  }, []);

  // 4. Fetch Attendance History & Audit Logs
  const fetchHistory = useCallback(async () => {
    try {
      const records = await api.get<AttendanceHistoryRecord[]>('/attendance/history');
      if (Array.isArray(records)) {
        setHistoryRecords(records);
      }

      if (isAdminOrSuperAdmin) {
        const audit = await api.get<{ success: boolean; auditLogs: AuditLogItem[] }>('/attendance/audit-logs');
        if (audit && audit.auditLogs) {
          setAuditLogs(audit.auditLogs);
        }
      }
    } catch (err) {
      console.error('[FETCH HISTORY ERROR]', err);
    }
  }, [isAdminOrSuperAdmin]);

  // 5. Fetch Personal Attendance
  const fetchPersonalData = useCallback(async () => {
    if (!user?.id) return;
    try {
      const myData = await api.get<{ success: boolean; today: any; recent: any[] }>('/attendance/my');
      if (myData) {
        setMyTodayRecord(myData.today || null);
      }

      const monthlyData = await api.get<{
        success: boolean;
        dailyLogs: PersonalDailyLog[];
        stats: any;
      }>(`/attendance/staff/${user.id}/monthly?month=${selectedMonth}`);

      if (monthlyData) {
        setMyDailyLogs(monthlyData.dailyLogs || []);
        if (monthlyData.stats) {
          setMyMonthlyStats(monthlyData.stats);
        }
      }
    } catch (err) {
      console.error('[FETCH PERSONAL ERROR]', err);
    }
  }, [user?.id, selectedMonth]);

  // Refresh all
  const refreshAllData = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([
      fetchServerTime(),
      isManagement ? fetchRoster(selectedDate) : Promise.resolve(),
      isManagement ? fetchMonthlyReport(selectedMonth) : Promise.resolve(),
      isManagement ? fetchHistory() : Promise.resolve(),
      fetchPersonalData(),
    ]);
    setIsLoading(false);
  }, [
    fetchServerTime,
    isManagement,
    fetchRoster,
    selectedDate,
    fetchMonthlyReport,
    selectedMonth,
    fetchHistory,
    fetchPersonalData,
  ]);

  // Initial load & Polling
  useEffect(() => {
    refreshAllData();

    // 10s background sync
    const interval = setInterval(() => {
      fetchServerTime();
    }, 10000);

    return () => clearInterval(interval);
  }, [refreshAllData, fetchServerTime]);

  // Handle Quick Mark Action
  const handleQuickMark = async (
    userId: string,
    status: 'PRESENT' | 'LATE' | 'HALF_DAY' | 'ABSENT',
    staffName: string
  ) => {
    try {
      await api.post('/attendance/mark', {
        userId,
        date: selectedDate,
        status,
        notes: `Quick mark by ${user?.name || 'Administrator'}`,
      });

      toast.success(`${staffName} marked as ${status}.`);
      await fetchRoster(selectedDate);
      if (userId === user?.id) {
        await fetchPersonalData();
      }
    } catch (err: any) {
      console.error('[QUICK MARK ERROR]', err);
      toast.error(err?.response?.data?.error || err?.message || 'Failed to record attendance.');
    }
  };

  // Handle Self Check-In
  const handleSelfCheckIn = async () => {
    setIsCheckingIn(true);
    try {
      await api.post('/attendance/mark', {
        type: 'CHECK_IN',
        notes: 'Self-service digital check-in',
      });
      toast.success('Check-in confirmed successfully!');
      await fetchPersonalData();
      if (isManagement) {
        await fetchRoster(selectedDate);
      }
    } catch (err: any) {
      console.error('[SELF CHECK-IN ERROR]', err);
      toast.error(err?.response?.data?.error || err?.message || 'Failed to check in.');
    } finally {
      setIsCheckingIn(false);
    }
  };

  // Handle Save Edit Record
  const handleSaveRecord = async (payload: {
    userId: string;
    date: string;
    status: string;
    checkInTime?: string;
    notes?: string;
    reason?: string;
  }) => {
    try {
      await api.post('/attendance/mark', {
        userId: payload.userId,
        date: payload.date,
        status: payload.status,
        time: payload.checkInTime,
        notes: payload.notes,
        reason: payload.reason,
      });

      toast.success('Attendance record updated.');
      await refreshAllData();
    } catch (err: any) {
      console.error('[SAVE RECORD ERROR]', err);
      toast.error(err?.response?.data?.error || err?.message || 'Failed to update record.');
      throw err;
    }
  };

  // Handle Open Staff Monthly History
  const handleOpenStaffHistory = async (userId: string, staffName: string) => {
    setSelectedStaffHistory({
      userId,
      staffName,
      dailyLogs: [],
      stats: { presentCount: 0, absentCount: 0, attendanceRate: 100 },
      month: selectedMonth,
    });
    setIsStaffHistoryOpen(true);
    setIsLoadingStaffHistory(true);

    try {
      const data = await api.get<{
        success: boolean;
        dailyLogs: any[];
        stats: any;
      }>(`/attendance/staff/${userId}/monthly?month=${selectedMonth}`);

      if (data) {
        setSelectedStaffHistory({
          userId,
          staffName,
          dailyLogs: data.dailyLogs || [],
          stats: data.stats || { presentCount: 0, absentCount: 0, attendanceRate: 100 },
          month: selectedMonth,
        });
      }
    } catch (err) {
      console.error('[STAFF HISTORY MODAL ERROR]', err);
      toast.error('Failed to load staff monthly calendar.');
    } finally {
      setIsLoadingStaffHistory(false);
    }
  };

  // Handle Month Change in Staff History Modal
  const handleStaffHistoryMonthChange = async (newMonth: string) => {
    if (!selectedStaffHistory) return;
    setIsLoadingStaffHistory(true);
    try {
      const data = await api.get<{
        success: boolean;
        dailyLogs: any[];
        stats: any;
      }>(`/attendance/staff/${selectedStaffHistory.userId}/monthly?month=${newMonth}`);

      if (data) {
        setSelectedStaffHistory((prev) =>
          prev
            ? {
                ...prev,
                month: newMonth,
                dailyLogs: data.dailyLogs || [],
                stats: data.stats || { presentCount: 0, absentCount: 0, attendanceRate: 100 },
              }
            : null
        );
      }
    } catch (err) {
      console.error('[STAFF HISTORY MONTH CHANGE]', err);
    } finally {
      setIsLoadingStaffHistory(false);
    }
  };

  // Handle Bulk Mark All Present
  const handleBulkMarkAll = async () => {
    setIsBulkSubmitting(true);
    try {
      const activeStaff = roster.filter((r) => r.status !== 'PRESENT');
      for (const staff of activeStaff) {
        await api.post('/attendance/mark', {
          userId: staff.userId,
          date: selectedDate,
          status: 'PRESENT',
          notes: 'Bulk confirmation by Management',
        });
      }

      toast.success(`Successfully marked ${activeStaff.length} staff members as Present.`);
      setIsBulkModalOpen(false);
      await fetchRoster(selectedDate);
    } catch (err: any) {
      console.error('[BULK MARK ERROR]', err);
      toast.error(err?.response?.data?.error || err?.message || 'Failed to bulk mark attendance.');
    } finally {
      setIsBulkSubmitting(false);
    }
  };

  // Handle Delete Record (Admin/Super Admin)
  const handleDeleteRecord = async (recordId: string) => {
    if (!window.confirm('Are you sure you want to remove this attendance record?')) return;
    try {
      await api.delete(`/attendance/${recordId}`);
      toast.success('Attendance record deleted.');
      await fetchHistory();
      await fetchRoster(selectedDate);
    } catch (err: any) {
      console.error('[DELETE RECORD ERROR]', err);
      toast.error(err?.response?.data?.error || err?.message || 'Failed to delete record.');
    }
  };

  // Handle Purge Staff (Super Admin)
  const handlePurgeStaff = async () => {
    if (!purgingStaff) return;
    setIsPurging(true);
    try {
      await api.delete(`/attendance/staff/${purgingStaff.userId}`);
      toast.success(`${purgingStaff.staffName} and all associated records permanently deleted.`);
      setIsPurgeModalOpen(false);
      setPurgingStaff(null);
      await refreshAllData();
    } catch (err: any) {
      console.error('[PURGE STAFF ERROR]', err);
      toast.error(err?.response?.data?.error || err?.message || 'Failed to purge staff.');
    } finally {
      setIsPurging(false);
    }
  };

  // Handle Export CSV
  const handleExportCSV = async () => {
    try {
      const data = await api.get<{ success: boolean; rows: any[] }>(
        `/attendance/export?month=${selectedMonth}`
      );
      if (data && data.rows && data.rows.length > 0) {
        const headers = Object.keys(data.rows[0]);
        const csvContent = [
          headers.join(','),
          ...data.rows.map((row) =>
            headers.map((h) => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(',')
          ),
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `MTS_Lab_Attendance_${selectedMonth}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success(`Exported ${data.rows.length} attendance rows to CSV.`);
      } else {
        toast.info('No records to export for the selected month.');
      }
    } catch (err) {
      console.error('[EXPORT CSV ERROR]', err);
      toast.error('Failed to export attendance records.');
    }
  };

  // If user is Staff (Non-Management), render dedicated Personal View directly
  if (!isManagement) {
    return (
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <AttendanceHeader
          role={role}
          serverTime={serverTime}
          serverDate={serverDate}
          isWithinWindow={isWithinWindow}
          secondsRemaining={secondsRemaining}
          secondsUntilOpen={secondsUntilOpen}
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          onRefresh={refreshAllData}
          onExport={handleExportCSV}
          onOpenBulkModal={() => {}}
          isLoading={isLoading}
          isManagement={false}
          isAdminOrSuperAdmin={false}
          isManager={false}
        />

        <PersonalAttendanceView
          userName={user?.name || 'Staff Member'}
          userRole={role}
          serverDate={serverDate}
          serverTime={serverTime}
          todayRecord={myTodayRecord}
          monthlyStats={myMonthlyStats}
          dailyLogs={myDailyLogs}
          selectedMonth={selectedMonth}
          onMonthChange={setSelectedMonth}
          onSelfCheckIn={handleSelfCheckIn}
          isCheckingIn={isCheckingIn}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* 1. Header with NPT Time & Quick Controls */}
      <AttendanceHeader
        role={role}
        serverTime={serverTime}
        serverDate={serverDate}
        isWithinWindow={isWithinWindow}
        secondsRemaining={secondsRemaining}
        secondsUntilOpen={secondsUntilOpen}
        selectedDate={selectedDate}
        onDateChange={(date) => {
          setSelectedDate(date);
          fetchRoster(date);
        }}
        onRefresh={refreshAllData}
        onExport={handleExportCSV}
        onOpenBulkModal={() => setIsBulkModalOpen(true)}
        isLoading={isLoading}
        isManagement={true}
        isAdminOrSuperAdmin={isAdminOrSuperAdmin}
        isManager={isManager}
      />

      {/* 2. Executive KPI Cards */}
      <AttendanceStats stats={stats} isLoading={isLoading} />

      {/* 3. Navigation Tabs */}
      <div className="flex items-center gap-1.5 p-1.5 bg-slate-100/80 rounded-2xl border border-slate-200/80 w-fit overflow-x-auto">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setActiveTab('roster')}
          className={cn(
            'h-9 px-4 rounded-xl text-xs font-bold gap-2 transition-all',
            activeTab === 'roster'
              ? 'bg-white text-indigo-700 shadow-2xs font-black'
              : 'text-slate-600 hover:text-slate-900'
          )}
        >
          <Users className="w-4 h-4" />
          <span>Today's Roster & Marking</span>
          <Badge className="bg-indigo-100 text-indigo-800 text-[10px] font-mono font-bold px-1.5 py-0">
            {roster.length}
          </Badge>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setActiveTab('monthly');
            fetchMonthlyReport(selectedMonth);
          }}
          className={cn(
            'h-9 px-4 rounded-xl text-xs font-bold gap-2 transition-all',
            activeTab === 'monthly'
              ? 'bg-white text-indigo-700 shadow-2xs font-black'
              : 'text-slate-600 hover:text-slate-900'
          )}
        >
          <Calendar className="w-4 h-4" />
          <span>Monthly Matrix & Analytics</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setActiveTab('history');
            fetchHistory();
          }}
          className={cn(
            'h-9 px-4 rounded-xl text-xs font-bold gap-2 transition-all',
            activeTab === 'history'
              ? 'bg-white text-indigo-700 shadow-2xs font-black'
              : 'text-slate-600 hover:text-slate-900'
          )}
        >
          <History className="w-4 h-4" />
          <span>Attendance Logs & Audit</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setActiveTab('personal');
            fetchPersonalData();
          }}
          className={cn(
            'h-9 px-4 rounded-xl text-xs font-bold gap-2 transition-all',
            activeTab === 'personal'
              ? 'bg-white text-indigo-700 shadow-2xs font-black'
              : 'text-slate-600 hover:text-slate-900'
          )}
        >
          <UserCheck className="w-4 h-4" />
          <span>My Personal Attendance</span>
        </Button>
      </div>

      {/* 4. Tab Views */}
      {activeTab === 'roster' && (
        <TodayRosterView
          roster={roster}
          isLoading={isLoading}
          selectedDate={selectedDate}
          serverDate={serverDate}
          isManager={isManager}
          isWithinWindow={isWithinWindow}
          isAdminOrSuperAdmin={isAdminOrSuperAdmin}
          isSuperAdmin={isSuperAdmin}
          currentUserId={user?.id || ''}
          onQuickMark={handleQuickMark}
          onOpenEditModal={(staff) => {
            setEditingRecord(staff);
            setIsEditModalOpen(true);
          }}
          onOpenStaffHistory={handleOpenStaffHistory}
          onOpenPurgeModal={(userId, staffName) => {
            setPurgingStaff({ userId, staffName });
            setIsPurgeModalOpen(true);
          }}
        />
      )}

      {activeTab === 'monthly' && (
        <MonthlyMatrixView
          report={monthlyReport}
          isLoading={isLoading}
          selectedMonth={selectedMonth}
          onMonthChange={(m) => {
            setSelectedMonth(m);
            fetchMonthlyReport(m);
          }}
          onOpenStaffDetail={handleOpenStaffHistory}
        />
      )}

      {activeTab === 'history' && (
        <AttendanceHistoryView
          records={historyRecords}
          auditLogs={auditLogs}
          staffList={roster}
          isLoading={isLoading}
          isAdminOrSuperAdmin={isAdminOrSuperAdmin}
          isSuperAdmin={isSuperAdmin}
          onOpenEditModal={(rec) => {
            setEditingRecord(rec);
            setIsEditModalOpen(true);
          }}
          onDeleteRecord={handleDeleteRecord}
          onRefresh={fetchHistory}
        />
      )}

      {activeTab === 'personal' && (
        <PersonalAttendanceView
          userName={user?.name || 'Staff Member'}
          userRole={role}
          serverDate={serverDate}
          serverTime={serverTime}
          todayRecord={myTodayRecord}
          monthlyStats={myMonthlyStats}
          dailyLogs={myDailyLogs}
          selectedMonth={selectedMonth}
          onMonthChange={setSelectedMonth}
          onSelfCheckIn={handleSelfCheckIn}
          isCheckingIn={isCheckingIn}
        />
      )}

      {/* 5. Interactive Modals */}
      {/* Edit Record Modal */}
      <EditRecordModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingRecord(null);
        }}
        record={editingRecord}
        onSave={handleSaveRecord}
      />

      {/* Staff Monthly Calendar Modal */}
      {selectedStaffHistory && (
        <StaffHistoryModal
          isOpen={isStaffHistoryOpen}
          onClose={() => {
            setIsStaffHistoryOpen(false);
            setSelectedStaffHistory(null);
          }}
          staffName={selectedStaffHistory.staffName}
          userId={selectedStaffHistory.userId}
          dailyLogs={selectedStaffHistory.dailyLogs}
          stats={selectedStaffHistory.stats}
          isLoading={isLoadingStaffHistory}
          selectedMonth={selectedStaffHistory.month}
          onMonthChange={handleStaffHistoryMonthChange}
        />
      )}

      {/* Bulk Mark All Modal */}
      <BulkMarkModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        totalStaff={roster.length}
        targetDate={selectedDate}
        onConfirm={handleBulkMarkAll}
        isSubmitting={isBulkSubmitting}
      />

      {/* Purge Staff Modal (Super Admin) */}
      {purgingStaff && (
        <PurgeStaffModal
          isOpen={isPurgeModalOpen}
          onClose={() => {
            setIsPurgeModalOpen(false);
            setPurgingStaff(null);
          }}
          staffName={purgingStaff.staffName}
          userId={purgingStaff.userId}
          onConfirm={handlePurgeStaff}
          isSubmitting={isPurging}
        />
      )}
    </div>
  );
}
