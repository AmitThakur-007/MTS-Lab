import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Award,
  TrendingUp,
  Percent,
  CheckCircle2,
  XCircle,
  Clock,
  HelpCircle,
  Eye,
  Download,
  Filter,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { format, addMonths, subMonths } from 'date-fns';

export interface MonthlyStaffReport {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    department?: string;
    profileImage?: string;
  };
  presentDays: number;
  absentDays: number;
  lateDays?: number;
  halfDays?: number;
  pendingDays: number;
  rejectedDays: number;
  attendanceRate: number | null;
  statusTag: 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'NEEDS_ATTENTION' | 'NO_DATA';
  logs: Array<{
    id: string;
    date: string;
    status: string;
    checkInTime?: string;
    notes?: string;
  }>;
}

interface MonthlyMatrixViewProps {
  report: MonthlyStaffReport[];
  isLoading: boolean;
  selectedMonth: string; // "YYYY-MM"
  onMonthChange: (month: string) => void;
  onOpenStaffDetail: (userId: string, staffName: string) => void;
}

export const MonthlyMatrixView: React.FC<MonthlyMatrixViewProps> = ({
  report = [],
  isLoading,
  selectedMonth,
  onMonthChange,
  onOpenStaffDetail,
}) => {
  const [selectedTagFilter, setSelectedTagFilter] = useState('ALL');

  const safeReport = Array.isArray(report) ? report : [];

  // Parse Year and Month
  const [yearNum, monthNum] = useMemo(() => {
    const parts = (selectedMonth || new Date().toISOString().slice(0, 7)).split('-').map(Number);
    return [parts[0] || new Date().getFullYear(), parts[1] || new Date().getMonth() + 1];
  }, [selectedMonth]);

  const currentDateObj = useMemo(() => new Date(yearNum, monthNum - 1, 1), [yearNum, monthNum]);
  const daysInMonth = useMemo(() => new Date(yearNum, monthNum, 0).getDate(), [yearNum, monthNum]);

  // Generate array of day numbers: [1, 2, ..., 31]
  const daysArray = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => i + 1);
  }, [daysInMonth]);

  const handlePrevMonth = () => {
    const prev = subMonths(currentDateObj, 1);
    onMonthChange(format(prev, 'yyyy-MM'));
  };

  const handleNextMonth = () => {
    const next = addMonths(currentDateObj, 1);
    onMonthChange(format(next, 'yyyy-MM'));
  };

  // Filtered by Tag
  const filteredReport = useMemo(() => {
    if (selectedTagFilter === 'ALL') return safeReport;
    return safeReport.filter((r) => r.statusTag === selectedTagFilter);
  }, [safeReport, selectedTagFilter]);

  // Executive Stats Calculation
  const averageRate = useMemo(() => {
    const rated = safeReport.filter((r) => r && r.attendanceRate !== null && r.attendanceRate !== undefined);
    if (rated.length === 0) return 100;
    const total = rated.reduce((acc, curr) => acc + (curr.attendanceRate || 0), 0);
    return Math.round(total / rated.length);
  }, [safeReport]);

  const topPerformer = useMemo(() => {
    if (safeReport.length === 0) return null;
    const sorted = [...safeReport].sort((a, b) => (b.attendanceRate || 0) - (a.attendanceRate || 0));
    return sorted[0]?.attendanceRate !== null && sorted[0]?.attendanceRate !== undefined ? sorted[0] : null;
  }, [safeReport]);

  const getTagBadge = (tag: string) => {
    switch (tag) {
      case 'EXCELLENT':
        return <Badge className="bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 text-[10px] font-bold">EXCELLENT (90%+)</Badge>;
      case 'GOOD':
        return <Badge className="bg-teal-500/10 text-teal-700 border border-teal-500/20 text-[10px] font-bold">GOOD (75–89%)</Badge>;
      case 'AVERAGE':
        return <Badge className="bg-amber-500/10 text-amber-700 border border-amber-500/20 text-[10px] font-bold">AVERAGE (60–74%)</Badge>;
      case 'NEEDS_ATTENTION':
        return <Badge className="bg-rose-500/10 text-rose-700 border border-rose-500/20 text-[10px] font-bold">NEEDS ATTENTION (&lt;60%)</Badge>;
      default:
        return <Badge className="bg-slate-100 text-slate-500 border border-slate-200 text-[10px] font-bold">NO DATA</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Month Navigator Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Monthly Attendance Performance
            </div>
            <div className="text-lg font-black text-slate-900 flex items-center gap-2">
              {format(currentDateObj, 'MMMM yyyy')}
            </div>
          </div>
        </div>

        {/* Month Switching Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevMonth}
            className="h-9 px-3 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onMonthChange(new Date().toISOString().slice(0, 7))}
            className="h-9 px-3 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold"
          >
            Current Month
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleNextMonth}
            className="h-9 px-3 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold gap-1"
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Monthly Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* KPI 1: Average Monthly Rate */}
        <Card className="border border-slate-200/80 bg-white shadow-2xs rounded-xl">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
              <Percent className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Average Team Attendance
              </div>
              <div className="text-xl font-black text-slate-900">
                {isLoading ? '—' : `${averageRate}%`}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI 2: Total Active Staff */}
        <Card className="border border-slate-200/80 bg-white shadow-2xs rounded-xl">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Staff Members Tracked
              </div>
              <div className="text-xl font-black text-slate-900">
                {isLoading ? '—' : report.length}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI 3: Top Performer */}
        <Card className="border border-slate-200/80 bg-white shadow-2xs rounded-xl">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider truncate">
                Top Monthly Attendee
              </div>
              <div className="text-sm font-black text-slate-900 truncate">
                {isLoading || !topPerformer
                  ? '—'
                  : `${topPerformer.user.name} (${topPerformer.attendanceRate}%)`}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Interactive Matrix */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {/* Matrix Legend Header */}
        <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs font-bold text-slate-700 flex items-center gap-2">
            <span>Legend:</span>
            <span className="flex items-center gap-1 font-semibold text-emerald-700">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Present (P)
            </span>
            <span className="flex items-center gap-1 font-semibold text-amber-700">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Late (L)
            </span>
            <span className="flex items-center gap-1 font-semibold text-sky-700">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500" /> Half Day (H)
            </span>
            <span className="flex items-center gap-1 font-semibold text-rose-700">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Absent (A)
            </span>
          </div>

          <div className="text-[11px] text-slate-500 font-medium">
            * Saturdays highlighted in soft amber (standard rest day in Nepal).
          </div>
        </div>

        {/* Matrix Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-bold">
                <th className="p-3 sticky left-0 bg-slate-100 z-10 min-w-[180px] shadow-xs">
                  Staff Member
                </th>
                {daysArray.map((day) => {
                  const dayDate = new Date(yearNum, monthNum - 1, day);
                  const isSaturday = dayDate.getDay() === 6;
                  return (
                    <th
                      key={day}
                      className={cn(
                        'p-1.5 text-center min-w-[28px] border-r border-slate-200/60 font-mono text-[11px]',
                        isSaturday ? 'bg-amber-100/60 text-amber-900 font-black' : ''
                      )}
                      title={`${format(dayDate, 'EEEE, MMM d')}`}
                    >
                      {day}
                    </th>
                  );
                })}
                <th className="p-3 text-center min-w-[70px] bg-slate-100">Present</th>
                <th className="p-3 text-center min-w-[70px] bg-slate-100">Absent</th>
                <th className="p-3 text-center min-w-[80px] bg-slate-100">Rate</th>
                <th className="p-3 text-center min-w-[120px] bg-slate-100">Standing</th>
                <th className="p-3 text-center min-w-[60px] bg-slate-100">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={daysInMonth + 6} className="p-10 text-center text-slate-400 font-medium">
                    <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Calculating monthly matrix...
                  </td>
                </tr>
              ) : filteredReport.length === 0 ? (
                <tr>
                  <td colSpan={daysInMonth + 6} className="p-8 text-center text-slate-400 font-medium">
                    No attendance records for {format(currentDateObj, 'MMMM yyyy')}.
                  </td>
                </tr>
              ) : (
                filteredReport.map((staffReport) => {
                  const staffAny = staffReport as any;
                  const user = staffReport?.user || {
                    id: staffAny?.id || `staff-${Math.random()}`,
                    name: staffAny?.name || 'Staff Member',
                    email: staffAny?.email || '',
                    role: staffAny?.role || 'STAFF',
                    department: staffAny?.department || 'Repair Lab',
                    profileImage: staffAny?.profileImage || undefined,
                  };

                  const logMap = new Map();
                  const logs = Array.isArray(staffReport?.logs) ? staffReport.logs : [];
                  logs.forEach((l) => {
                    if (l && l.date) logMap.set(l.date, l);
                  });

                  if (logs.length === 0 && staffAny?.dailyStatus) {
                    Object.entries(staffAny.dailyStatus).forEach(([date, status]) => {
                      if (status && status !== 'NOT_MARKED') {
                        logMap.set(date, { date, status: status as string });
                      }
                    });
                  }

                  const presentDays = staffReport?.presentDays ?? staffAny?.presentCount ?? 0;
                  const absentDays = staffReport?.absentDays ?? staffAny?.absentCount ?? 0;
                  const attendanceRate = staffReport?.attendanceRate ?? staffAny?.attendanceRate ?? null;
                  const statusTag = staffReport?.statusTag ?? staffAny?.statusTag ?? 'NO_DATA';

                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      onClick={() => onOpenStaffDetail(user.id, user.name)}
                    >
                      {/* Column 1: Staff Name & Role */}
                      <td className="p-3 sticky left-0 bg-white group-hover:bg-slate-50 transition-colors z-10 shadow-xs border-r border-slate-200/60">
                        <div className="flex items-center gap-2">
                          <Avatar className="w-7 h-7 rounded-lg shrink-0 bg-indigo-50 border border-slate-200">
                            <AvatarFallback className="text-[10px] font-black text-indigo-700">
                              {(user.name || 'ST').slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 truncate max-w-[130px]">
                              {user.name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-semibold truncate">
                              {user.role}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Day Cells 1 to 31 */}
                      {daysArray.map((day) => {
                        const dateStr = `${selectedMonth}-${String(day).padStart(2, '0')}`;
                        const log = logMap.get(dateStr);
                        const dayDate = new Date(yearNum, monthNum - 1, day);
                        const isSaturday = dayDate.getDay() === 6;

                        let cellBg = isSaturday ? 'bg-amber-50/40 text-amber-800' : 'text-slate-300';
                        let cellContent = '·';

                        if (log) {
                          if (log.status === 'PRESENT') {
                            cellBg = 'bg-emerald-500 text-white font-bold';
                            cellContent = 'P';
                          } else if (log.status === 'LATE') {
                            cellBg = 'bg-amber-500 text-white font-bold';
                            cellContent = 'L';
                          } else if (log.status === 'HALF_DAY') {
                            cellBg = 'bg-sky-500 text-white font-bold';
                            cellContent = 'H';
                          } else if (log.status === 'ABSENT') {
                            cellBg = 'bg-rose-500 text-white font-bold';
                            cellContent = 'A';
                          }
                        }

                        return (
                          <td
                            key={day}
                            className={cn(
                              'p-1 text-center border-r border-slate-100 font-mono text-[10px]',
                              isSaturday && !log && 'bg-amber-50/50'
                            )}
                            title={`${user.name} — ${dateStr}: ${log ? log.status : isSaturday ? 'Saturday (Off)' : 'Unmarked'}`}
                          >
                            <span
                              className={cn(
                                'inline-flex items-center justify-center w-5 h-5 rounded-md text-[10px]',
                                cellBg
                              )}
                            >
                              {cellContent}
                            </span>
                          </td>
                        );
                      })}

                      {/* Summary Present */}
                      <td className="p-2.5 text-center font-bold text-emerald-700 bg-emerald-50/20">
                        {presentDays}
                      </td>

                      {/* Summary Absent */}
                      <td className="p-2.5 text-center font-bold text-rose-700 bg-rose-50/20">
                        {absentDays}
                      </td>

                      {/* Summary Rate */}
                      <td className="p-2.5 text-center font-black text-slate-900">
                        {attendanceRate !== null
                          ? `${attendanceRate}%`
                          : '—'}
                      </td>

                      {/* Standing Tag */}
                      <td className="p-2.5 text-center">
                        {getTagBadge(statusTag)}
                      </td>

                      {/* Action Detail */}
                      <td className="p-2.5 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg cursor-pointer"
                          title="Open Detailed Staff Calendar"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
