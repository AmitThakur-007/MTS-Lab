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
      <Card className="border border-slate-200/80 bg-white shadow-2xs rounded-xl overflow-hidden min-w-0">
        <CardContent className="p-2.5 sm:p-3.5 flex items-center gap-2.5 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
            <Users className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 truncate">
              Total Staff
            </div>
            <div className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
              {isLoading ? '—' : totalStaff}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Present Today */}
      <Card className="border border-emerald-200/80 bg-emerald-50/40 shadow-2xs rounded-xl overflow-hidden min-w-0">
        <CardContent className="p-2.5 sm:p-3.5 flex items-center gap-2.5 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
            <UserCheck className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-emerald-800 truncate">
              Present
            </div>
            <div className="text-lg sm:text-xl font-black text-emerald-950 tracking-tight">
              {isLoading ? '—' : presentCount}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Late */}
      <Card className="border border-amber-200/80 bg-amber-50/40 shadow-2xs rounded-xl overflow-hidden min-w-0">
        <CardContent className="p-2.5 sm:p-3.5 flex items-center gap-2.5 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-amber-800 truncate">
              Late
            </div>
            <div className="text-lg sm:text-xl font-black text-amber-950 tracking-tight">
              {isLoading ? '—' : lateCount}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. Absent */}
      <Card className="border border-rose-200/80 bg-rose-50/40 shadow-2xs rounded-xl overflow-hidden min-w-0">
        <CardContent className="p-2.5 sm:p-3.5 flex items-center gap-2.5 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-700 shrink-0">
            <UserX className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-rose-800 truncate">
              Absent
            </div>
            <div className="text-lg sm:text-xl font-black text-rose-950 tracking-tight">
              {isLoading ? '—' : absentCount}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 5. Not Marked / Pending */}
      <Card className="border border-slate-200/80 bg-slate-50/50 shadow-2xs rounded-xl overflow-hidden min-w-0">
        <CardContent className="p-2.5 sm:p-3.5 flex items-center gap-2.5 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-700 shrink-0">
            <HelpCircle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-600 truncate">
              Unmarked
            </div>
            <div className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
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
            ? 'border-emerald-200/80 bg-emerald-500/10'
            : attendanceRate >= 60
            ? 'border-amber-200/80 bg-amber-500/10'
            : 'border-rose-200/80 bg-rose-500/10'
        )}
      >
        <CardContent className="p-2.5 sm:p-3.5 flex items-center gap-2.5 sm:gap-3">
          <div
            className={cn(
              'w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0 border font-bold text-xs sm:text-sm',
              attendanceRate >= 80
                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                : attendanceRate >= 60
                ? 'bg-amber-100 text-amber-800 border-amber-200'
                : 'bg-rose-100 text-rose-800 border-rose-200'
            )}
          >
            <Percent className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-600 truncate">
              Rate
            </div>
            <div
              className={cn(
                'text-lg sm:text-xl font-black tracking-tight',
                attendanceRate >= 80
                  ? 'text-emerald-950'
                  : attendanceRate >= 60
                  ? 'text-amber-950'
                  : 'text-rose-950'
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
