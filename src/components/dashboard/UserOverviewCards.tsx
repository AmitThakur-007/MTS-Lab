import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  UserCheck, 
  Calendar, 
  Clock, 
  TrendingUp, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  FileWarning, 
  Wrench, 
  Smartphone, 
  ChevronRight, 
  ArrowUpRight, 
  RotateCcw, 
  Loader2,
  ShieldCheck,
  Check,
  Percent,
  Layers,
  CalendarDays
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { useRealtimeSync } from '@/services/realtime';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';

interface UserOverviewCardsProps {
  className?: string;
}

export default function UserOverviewCards({ className }: UserOverviewCardsProps) {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  // Attendance State
  const [attendanceData, setAttendanceData] = useState<{
    stats: {
      presentCount: number;
      absentCount: number;
      pendingCount: number;
      rejectedCount: number;
      totalMonthRecords: number;
      attendanceRate: number | null;
    } | null;
    latestRecord: any | null;
  }>({
    stats: null,
    latestRecord: null
  });
  const [loadingAttendance, setLoadingAttendance] = useState(true);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);

  // Repair Damage State
  const [damageData, setDamageData] = useState<{
    overview: {
      totalRecords: number;
      thisMonthRecords: number;
      todayRecords: number;
      totalEstimatedCost: number;
      componentBreakdown?: Record<string, number>;
      recentRecords?: any[];
    } | null;
    latestRecord: any | null;
    recentList: any[];
  }>({
    overview: null,
    latestRecord: null,
    recentList: []
  });
  const [loadingDamage, setLoadingDamage] = useState(true);
  const [damageError, setDamageError] = useState<string | null>(null);

  // ============================================================================
  // FETCH ATTENDANCE DATA
  // ============================================================================
  const fetchAttendance = useCallback(async () => {
    setAttendanceError(null);
    try {
      const res: any = await api.get('/attendance/my');
      if (res && (res.stats || res.history)) {
        const stats = res.stats || {
          presentCount: 0,
          absentCount: 0,
          pendingCount: 0,
          rejectedCount: 0,
          totalMonthRecords: 0,
          attendanceRate: 100
        };
        const historyList = Array.isArray(res.history) ? res.history : [];
        const latestRecord = historyList.length > 0 ? historyList[0] : null;

        setAttendanceData({
          stats,
          latestRecord
        });
      } else {
        setAttendanceData({
          stats: {
            presentCount: 0,
            absentCount: 0,
            pendingCount: 0,
            rejectedCount: 0,
            totalMonthRecords: 0,
            attendanceRate: 100
          },
          latestRecord: null
        });
      }
    } catch (err: any) {
      console.error("[USER OVERVIEW ATTENDANCE ERROR]", err);
      setAttendanceError(err?.message || "Unable to load attendance data.");
    } finally {
      setLoadingAttendance(false);
    }
  }, []);

  // ============================================================================
  // FETCH REPAIR DAMAGE DATA
  // ============================================================================
  const fetchDamage = useCallback(async () => {
    setDamageError(null);
    try {
      const [overviewRes, listRes] = await Promise.allSettled([
        api.get('/repair-damage/overview'),
        api.get('/repair-damage?limit=5')
      ]);

      let overview = null;
      let recentList: any[] = [];
      let latestRecord = null;

      if (overviewRes.status === 'fulfilled' && overviewRes.value) {
        overview = overviewRes.value;
      }

      if (listRes.status === 'fulfilled' && listRes.value) {
        const data = listRes.value;
        if (Array.isArray(data.records)) {
          recentList = data.records;
        } else if (Array.isArray(data)) {
          recentList = data;
        }
      }

      if (recentList.length > 0) {
        latestRecord = recentList[0];
      } else if (overview?.recentRecords && overview.recentRecords.length > 0) {
        latestRecord = overview.recentRecords[0];
      }

      setDamageData({
        overview,
        latestRecord,
        recentList
      });
    } catch (err: any) {
      console.error("[USER OVERVIEW DAMAGE ERROR]", err);
      setDamageError(err?.message || "Unable to load repair damage records.");
    } finally {
      setLoadingDamage(false);
    }
  }, []);

  // Initial Load
  useEffect(() => {
    fetchAttendance();
    fetchDamage();
  }, [fetchAttendance, fetchDamage]);

  // Real-time synchronization
  useRealtimeSync(['attendance', 'repairDamage', 'user', 'sync'], () => {
    fetchAttendance();
    fetchDamage();
  });

  // Current Month String
  const currentMonthName = format(new Date(), 'MMMM yyyy');

  // Format Date Safely
  const formatDateDisplay = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      const parsed = parseISO(dateStr);
      return format(parsed, 'dd MMM yyyy');
    } catch {
      return dateStr;
    }
  };

  return (
    <div className={cn("grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5", className)}>
      
      {/* ========================================================================= */}
      {/* 1. ATTENDANCE OVERVIEW CARD                                               */}
      {/* ========================================================================= */}
      <Card className="rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all bg-white overflow-hidden flex flex-col justify-between">
        <div>
          {/* Card Header */}
          <CardHeader className="p-5 sm:p-6 pb-3 sm:pb-4 border-b border-slate-100 flex flex-row items-center justify-between gap-3 space-y-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs shrink-0">
                <UserCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight truncate">
                    Attendance
                  </h3>
                  <Badge variant="outline" className="rounded-lg bg-indigo-50/70 border-indigo-200 text-indigo-700 font-extrabold text-[10px] px-2 py-0.5 shrink-0">
                    {currentMonthName}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                  Your verified monthly presence & activity status
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/dashboard/attendance')}
              className="h-8.5 px-3 rounded-xl border-slate-200 font-bold text-xs text-slate-700 hover:bg-slate-50 hover:text-indigo-600 gap-1 shrink-0 cursor-pointer shadow-2xs"
            >
              <span>View Attendance</span>
              <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
            </Button>
          </CardHeader>

          {/* Card Content */}
          <CardContent className="p-5 sm:p-6 pt-4 space-y-4">
            {loadingAttendance ? (
              <div className="space-y-3 py-2">
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="h-18 bg-slate-100 rounded-2xl animate-pulse" />
                  <div className="h-18 bg-slate-100 rounded-2xl animate-pulse" />
                  <div className="h-18 bg-slate-100 rounded-2xl animate-pulse" />
                </div>
                <div className="h-14 bg-slate-100 rounded-2xl animate-pulse" />
              </div>
            ) : attendanceError ? (
              <div className="p-4 rounded-2xl bg-rose-50/80 border border-rose-200 text-center space-y-2">
                <p className="text-xs font-bold text-rose-700">{attendanceError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchAttendance}
                  className="h-7 px-3 text-[11px] font-bold rounded-lg border-rose-200 bg-white text-rose-700 hover:bg-rose-100 cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3 mr-1" /> Retry
                </Button>
              </div>
            ) : !attendanceData.stats || (attendanceData.stats.totalMonthRecords === 0 && !attendanceData.latestRecord) ? (
              <div className="p-6 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 space-y-1.5">
                <CalendarDays className="h-8 w-8 mx-auto text-slate-300" />
                <p className="text-xs font-bold text-slate-700">No attendance records yet.</p>
                <p className="text-[11px] text-slate-400 font-medium max-w-xs mx-auto">
                  Your daily presence records will appear here as soon as attendance is recorded for this month.
                </p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {/* 3 Metrics Grid */}
                <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
                  {/* Present Days */}
                  <div className="p-3 sm:p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 text-center space-y-0.5">
                    <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider block truncate">
                      Present
                    </span>
                    <strong className="text-xl sm:text-2xl font-black text-emerald-700 block">
                      {attendanceData.stats.presentCount}
                    </strong>
                    <span className="text-[10px] font-semibold text-emerald-600/90 block truncate">
                      Days on duty
                    </span>
                  </div>

                  {/* Absent Days */}
                  <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-center space-y-0.5">
                    <span className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider block truncate">
                      Absent
                    </span>
                    <strong className={cn(
                      "text-xl sm:text-2xl font-black block",
                      attendanceData.stats.absentCount > 0 ? "text-rose-600" : "text-slate-800"
                    )}>
                      {attendanceData.stats.absentCount}
                    </strong>
                    <span className="text-[10px] font-semibold text-slate-400 block truncate">
                      Days off duty
                    </span>
                  </div>

                  {/* Rate / Percentage */}
                  <div className="p-3 sm:p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200/80 text-center space-y-0.5">
                    <span className="text-[10px] font-extrabold text-indigo-800 uppercase tracking-wider block truncate">
                      Rate
                    </span>
                    <strong className="text-xl sm:text-2xl font-black text-indigo-700 block">
                      {attendanceData.stats.attendanceRate !== null ? `${attendanceData.stats.attendanceRate}%` : '—'}
                    </strong>
                    <span className="text-[10px] font-semibold text-indigo-600/90 block truncate">
                      Monthly score
                    </span>
                  </div>
                </div>

                {/* Latest Attendance Status Strip */}
                <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-50/90 border border-slate-200/80 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center text-slate-600 shrink-0">
                      <Clock className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block truncate">
                        Latest Attendance
                      </span>
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {attendanceData.latestRecord?.date ? formatDateDisplay(attendanceData.latestRecord.date) : 'Today'}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    {attendanceData.latestRecord?.status === 'PRESENT' ? (
                      <Badge className="bg-emerald-600 text-white font-black text-[10px] px-2.5 py-1 rounded-xl shadow-2xs gap-1">
                        <Check className="h-3 w-3" />
                        <span>Present</span>
                      </Badge>
                    ) : attendanceData.latestRecord?.status === 'PENDING' ? (
                      <Badge className="bg-amber-500 text-white font-black text-[10px] px-2.5 py-1 rounded-xl shadow-2xs gap-1">
                        <Clock className="h-3 w-3" />
                        <span>Pending</span>
                      </Badge>
                    ) : attendanceData.latestRecord?.status === 'REJECTED' ? (
                      <Badge className="bg-rose-600 text-white font-black text-[10px] px-2.5 py-1 rounded-xl shadow-2xs gap-1">
                        <XCircle className="h-3 w-3" />
                        <span>Rejected</span>
                      </Badge>
                    ) : attendanceData.latestRecord?.status === 'ABSENT' ? (
                      <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300 font-black text-[10px] px-2.5 py-1 rounded-xl">
                        Absent
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-200 font-bold text-[10px] px-2.5 py-1 rounded-xl">
                        Not Marked
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </div>
      </Card>

      {/* ========================================================================= */}
      {/* 2. REPAIR DAMAGE RECORD OVERVIEW CARD                                     */}
      {/* ========================================================================= */}
      <Card className="rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all bg-white overflow-hidden flex flex-col justify-between">
        <div>
          {/* Card Header */}
          <CardHeader className="p-5 sm:p-6 pb-3 sm:pb-4 border-b border-slate-100 flex flex-row items-center justify-between gap-3 space-y-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shadow-xs shrink-0">
                <FileWarning className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight truncate">
                    Repair Damage Record
                  </h3>
                  {damageData.overview && (
                    <Badge variant="outline" className="rounded-lg bg-rose-50/70 border-rose-200 text-rose-700 font-extrabold text-[10px] px-2 py-0.5 shrink-0">
                      {damageData.overview.thisMonthRecords ?? 0} This Month
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                  Tracked component damage & quality control logs
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/dashboard/repair-damage')}
              className="h-8.5 px-3 rounded-xl border-slate-200 font-bold text-xs text-slate-700 hover:bg-slate-50 hover:text-rose-600 gap-1 shrink-0 cursor-pointer shadow-2xs"
            >
              <span>View Records</span>
              <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
            </Button>
          </CardHeader>

          {/* Card Content */}
          <CardContent className="p-5 sm:p-6 pt-4 space-y-4">
            {loadingDamage ? (
              <div className="space-y-3 py-2">
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="h-18 bg-slate-100 rounded-2xl animate-pulse" />
                  <div className="h-18 bg-slate-100 rounded-2xl animate-pulse" />
                  <div className="h-18 bg-slate-100 rounded-2xl animate-pulse" />
                </div>
                <div className="h-14 bg-slate-100 rounded-2xl animate-pulse" />
              </div>
            ) : damageError ? (
              <div className="p-4 rounded-2xl bg-rose-50/80 border border-rose-200 text-center space-y-2">
                <p className="text-xs font-bold text-rose-700">{damageError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchDamage}
                  className="h-7 px-3 text-[11px] font-bold rounded-lg border-rose-200 bg-white text-rose-700 hover:bg-rose-100 cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3 mr-1" /> Retry
                </Button>
              </div>
            ) : !damageData.overview || (damageData.overview.totalRecords === 0 && !damageData.latestRecord) ? (
              <div className="p-6 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 space-y-1.5">
                <ShieldCheck className="h-8 w-8 mx-auto text-emerald-400" />
                <p className="text-xs font-bold text-slate-700">No repair damage records.</p>
                <p className="text-[11px] text-slate-400 font-medium max-w-xs mx-auto">
                  Optimal quality control maintained. Zero repair-related damage recorded for your account.
                </p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {/* 3 Metrics Grid */}
                <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
                  {/* Total Records */}
                  <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-center space-y-0.5">
                    <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block truncate">
                      Total Records
                    </span>
                    <strong className="text-xl sm:text-2xl font-black text-slate-900 block">
                      {damageData.overview.totalRecords ?? 0}
                    </strong>
                    <span className="text-[10px] font-semibold text-slate-400 block truncate">
                      All-time logged
                    </span>
                  </div>

                  {/* This Month */}
                  <div className="p-3 sm:p-3.5 rounded-2xl bg-rose-50/70 border border-rose-200/80 text-center space-y-0.5">
                    <span className="text-[10px] font-extrabold text-rose-800 uppercase tracking-wider block truncate">
                      This Month
                    </span>
                    <strong className="text-xl sm:text-2xl font-black text-rose-700 block">
                      {damageData.overview.thisMonthRecords ?? 0}
                    </strong>
                    <span className="text-[10px] font-semibold text-rose-600/90 block truncate">
                      Current cycle
                    </span>
                  </div>

                  {/* Today or Est Cost */}
                  <div className="p-3 sm:p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-center space-y-0.5">
                    <span className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wider block truncate">
                      Today Logged
                    </span>
                    <strong className="text-xl sm:text-2xl font-black text-amber-700 block">
                      {damageData.overview.todayRecords ?? 0}
                    </strong>
                    <span className="text-[10px] font-semibold text-amber-600/90 block truncate">
                      Recent activity
                    </span>
                  </div>
                </div>

                {/* Latest Damage Record Strip */}
                {damageData.latestRecord ? (
                  <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-50/90 border border-slate-200/80 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-white border border-rose-200/80 flex items-center justify-center text-rose-600 shrink-0">
                        <Smartphone className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block truncate">
                          Latest Record: {damageData.latestRecord.damagedComponent || 'Component'}
                        </span>
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {[damageData.latestRecord.deviceBrand, damageData.latestRecord.deviceModel].filter(Boolean).join(' ') || 'Device Service'}
                          <span className="font-normal text-slate-500 ml-1">
                            &bull; {formatDateDisplay(damageData.latestRecord.damageDate || damageData.latestRecord.createdAt)}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0">
                      <Badge className="bg-rose-50 text-rose-700 border-rose-200 font-extrabold text-[10px] px-2 py-0.5 rounded-lg truncate max-w-[120px]">
                        {damageData.latestRecord.damagedComponent || 'Damaged Part'}
                      </Badge>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-2xl bg-slate-50/90 border border-slate-200/80 flex items-center justify-between text-xs text-slate-600 font-medium">
                    <span className="truncate">No recent repair damage incidents recorded.</span>
                    <span className="text-emerald-600 font-bold shrink-0">Clean Record</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </div>
      </Card>

    </div>
  );
}
