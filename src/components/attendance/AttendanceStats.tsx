import React from 'react';
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  Percent,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface AttendanceStatsProps {
  stats: {
    totalStaff: number;
    presentCount: number;
    absentCount: number;
    lateCount: number;
    halfDayCount: number;
    notMarkedCount: number;
    pendingCount: number;
    attendanceRate: number;
  };
  isLoading?: boolean;
}

export const AttendanceStats: React.FC<AttendanceStatsProps> = ({ stats, isLoading }) => {
  const {
    totalStaff = 0,
    presentCount = 0,
    absentCount = 0,
    lateCount = 0,
    halfDayCount = 0,
    notMarkedCount = 0,
    pendingCount = 0,
    attendanceRate = 0,
  } = stats || {};

  const totalMarked = presentCount + absentCount + lateCount + halfDayCount;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 w-full min-w-0">
      {/* 1. Total Staff */}
      <Card className="border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs rounded-xl overflow-hidden min-w-0">
        <CardContent className="p-2.5 sm:p-3.5 flex items-center gap-2.5 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
            <Users className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
              Total Staff
            </div>
            <div className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
              {isLoading ? '—' : totalStaff}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Present Today */}
      <Card className="border border-emerald-200/80 dark:border-emerald-800/80 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-2xs rounded-xl overflow-hidden min-w-0">
        <CardContent className="p-2.5 sm:p-3.5 flex items-center gap-2.5 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-700 dark:text-emerald-300 shrink-0">
            <UserCheck className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 truncate">
              Present
            </div>
            <div className="text-lg sm:text-xl font-black text-emerald-950 dark:text-emerald-100 tracking-tight">
              {isLoading ? '—' : presentCount}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Late */}
      <Card className="border border-amber-200/80 dark:border-amber-800/80 bg-amber-50/40 dark:bg-amber-950/20 shadow-2xs rounded-xl overflow-hidden min-w-0">
        <CardContent className="p-2.5 sm:p-3.5 flex items-center gap-2.5 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-amber-100 dark:bg-amber-900/50 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-700 dark:text-amber-300 shrink-0">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400 truncate">
              Late
            </div>
            <div className="text-lg sm:text-xl font-black text-amber-950 dark:text-amber-100 tracking-tight">
              {isLoading ? '—' : lateCount}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. Absent */}
      <Card className="border border-rose-200/80 dark:border-rose-800/80 bg-rose-50/40 dark:bg-rose-950/20 shadow-2xs rounded-xl overflow-hidden min-w-0">
        <CardContent className="p-2.5 sm:p-3.5 flex items-center gap-2.5 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-rose-100 dark:bg-rose-900/50 border border-rose-200 dark:border-rose-800 flex items-center justify-center text-rose-700 dark:text-rose-300 shrink-0">
            <UserX className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-rose-800 dark:text-rose-400 truncate">
              Absent
            </div>
            <div className="text-lg sm:text-xl font-black text-rose-950 dark:text-rose-100 tracking-tight">
              {isLoading ? '—' : absentCount}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 5. Not Marked / Pending */}
      <Card className="border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 shadow-2xs rounded-xl overflow-hidden min-w-0">
        <CardContent className="p-2.5 sm:p-3.5 flex items-center gap-2.5 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 shrink-0">
            <HelpCircle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 truncate">
              Unmarked
            </div>
            <div className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
              {isLoading ? '—' : notMarkedCount}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 6. Attendance Rate */}
      <Card
        className={cn(
          'border shadow-2xs rounded-xl overflow-hidden min-w-0',
          attendanceRate >= 80
            ? 'border-emerald-200/80 dark:border-emerald-800/80 bg-emerald-500/10'
            : attendanceRate >= 60
            ? 'border-amber-200/80 dark:border-amber-800/80 bg-amber-500/10'
            : 'border-rose-200/80 dark:border-rose-800/80 bg-rose-500/10'
        )}
      >
        <CardContent className="p-2.5 sm:p-3.5 flex items-center gap-2.5 sm:gap-3">
          <div
            className={cn(
              'w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0 border font-bold text-xs sm:text-sm',
              attendanceRate >= 80
                ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                : attendanceRate >= 60
                ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                : 'bg-rose-100 dark:bg-rose-900/50 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
            )}
          >
            <Percent className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 truncate">
              Rate
            </div>
            <div
              className={cn(
                'text-lg sm:text-xl font-black tracking-tight',
                attendanceRate >= 80
                  ? 'text-emerald-950 dark:text-emerald-100'
                  : attendanceRate >= 60
                  ? 'text-amber-950 dark:text-amber-100'
                  : 'text-rose-950 dark:text-rose-100'
              )}
            >
              {isLoading ? '—' : `${attendanceRate}%`}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
