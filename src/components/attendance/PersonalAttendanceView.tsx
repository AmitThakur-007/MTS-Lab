import React, { useState } from 'react';
import {
  UserCheck,
  Clock,
  CheckCircle2,
  XCircle,
  Calendar,
  Sparkles,
  TrendingUp,
  Percent,
  History,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  UserX,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export interface PersonalDailyLog {
  date: string;
  dayOfWeek: string;
  isToday: boolean;
  isFuture: boolean;
  status: 'PRESENT' | 'LATE' | 'HALF_DAY' | 'ABSENT' | 'NOT_MARKED' | 'FUTURE';
  record?: {
    id: string;
    formattedCheckInTime?: string;
    markedBy?: string;
    notes?: string;
  };
}

interface PersonalAttendanceViewProps {
  userName: string;
  userRole: string;
  serverDate: string;
  serverTime: string;
  todayRecord: any;
  monthlyStats: {
    presentCount: number;
    absentCount: number;
    pendingCount: number;
    attendanceRate: number | null;
  };
  dailyLogs: PersonalDailyLog[];
  selectedMonth: string;
  onMonthChange: (month: string) => void;
  onSelfCheckIn: () => void;
  isCheckingIn: boolean;
}

export const PersonalAttendanceView: React.FC<PersonalAttendanceViewProps> = ({
  userName,
  userRole,
  serverDate,
  serverTime,
  todayRecord,
  monthlyStats,
  dailyLogs,
  selectedMonth,
  onMonthChange,
  onSelfCheckIn,
  isCheckingIn,
}) => {
  const isCheckedInToday = todayRecord && (todayRecord.status === 'PRESENT' || todayRecord.status === 'LATE' || todayRecord.status === 'HALF_DAY');
  const todayStatus = todayRecord?.status || 'NOT_MARKED';
  const todayCheckInTime = todayRecord?.checkInTime || todayRecord?.time;

  return (
    <div className="space-y-4 sm:space-y-6 w-full min-w-0">
      {/* Hero Check-In Banner */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-4 sm:p-6 md:p-8 shadow-xl border border-indigo-900/40 w-full min-w-0">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-5 sm:gap-6 min-w-0">
          <div className="space-y-2 max-w-xl min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold border border-indigo-500/30 flex items-center gap-1.5 shrink-0">
                <Clock className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span>NPT: {serverTime}</span>
              </span>
              <span className="text-xs text-slate-400 font-mono font-bold">
                {serverDate}
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-white truncate">
              Hello, {userName}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-medium">
              Your attendance status is verified daily against MTS Lab business hours.
              {isCheckedInToday
                ? ` Your presence for today is confirmed.`
                : ` Please click below to record your check-in.`}
            </p>
          </div>

          {/* Action Box */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0 w-full sm:w-auto">
            {isCheckedInToday ? (
              <div className="flex items-center gap-3 sm:gap-3.5 px-4 sm:px-5 py-3.5 sm:py-4 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl w-full sm:w-auto">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] sm:text-xs font-bold text-emerald-300 uppercase tracking-wider truncate">
                    Today's Verified Presence
                  </div>
                  <div className="text-sm sm:text-base font-black text-white flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    <span>{todayStatus}</span>
                    {todayCheckInTime && (
                      <span className="text-[11px] sm:text-xs font-mono font-normal text-emerald-200">
                        at {todayCheckInTime}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <Button
                size="lg"
                onClick={onSelfCheckIn}
                disabled={isCheckingIn}
                className="h-12 sm:h-14 px-5 sm:px-7 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm sm:text-base rounded-2xl shadow-lg shadow-emerald-600/30 gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] w-full sm:w-auto justify-center"
              >
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>{isCheckingIn ? 'Recording...' : 'Mark Self Check-In'}</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Monthly Statistics Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* KPI 1: Present Days */}
        <Card className="border border-slate-200/80 bg-white shadow-2xs rounded-2xl">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Days Present ({selectedMonth})
              </div>
              <div className="text-2xl font-black text-slate-900">
                {monthlyStats.presentCount} <span className="text-sm font-semibold text-slate-400">days</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI 2: Absent Days */}
        <Card className="border border-slate-200/80 bg-white shadow-2xs rounded-2xl">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
              <UserX className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Days Absent ({selectedMonth})
              </div>
              <div className="text-2xl font-black text-slate-900">
                {monthlyStats.absentCount} <span className="text-sm font-semibold text-slate-400">days</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI 3: Attendance Rate */}
        <Card className="border border-slate-200/80 bg-white shadow-2xs rounded-2xl">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
              <Percent className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Monthly Attendance Rate
              </div>
              <div className="text-2xl font-black text-indigo-950">
                {monthlyStats.attendanceRate !== null ? `${monthlyStats.attendanceRate}%` : '100%'}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Attendance Calendar Log */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600" />
              My Daily Attendance Log
            </h3>
            <p className="text-xs text-slate-500">
              Day-by-day record of check-in times and verified statuses.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => onMonthChange(e.target.value)}
              className="h-9 px-3 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
            />
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="divide-y divide-slate-100">
          {dailyLogs.map((log) => {
            const isSaturday = log.dayOfWeek === 'Sat';

            return (
              <div
                key={log.date}
                className={cn(
                  'p-4 flex items-center justify-between gap-4 transition-colors',
                  log.isToday ? 'bg-indigo-50/40 font-semibold' : 'hover:bg-slate-50/60'
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-xl flex flex-col items-center justify-center text-xs font-bold shrink-0',
                      log.isToday
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : isSaturday
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-slate-100 text-slate-700'
                    )}
                  >
                    <span className="text-[9px] uppercase leading-tight font-black">{log.dayOfWeek}</span>
                    <span className="text-xs font-mono">{log.date.split('-')[2]}</span>
                  </div>

                  <div>
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                      <span>{log.date}</span>
                      {log.isToday && (
                        <Badge className="bg-indigo-600 text-white text-[9px] font-bold px-1.5 py-0">
                          TODAY
                        </Badge>
                      )}
                      {isSaturday && (
                        <Badge className="bg-amber-100 text-amber-800 border border-amber-200 text-[9px] font-bold px-1.5 py-0">
                          SATURDAY OFF
                        </Badge>
                      )}
                    </div>
                    {log.record?.formattedCheckInTime && log.record.formattedCheckInTime !== '—' && (
                      <div className="text-[11px] font-mono text-slate-500 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 text-slate-400" />
                        Check-in at {log.record.formattedCheckInTime}
                      </div>
                    )}
                  </div>
                </div>

                {/* Status Badge */}
                <div>
                  {log.status === 'PRESENT' && (
                    <Badge className="bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 text-xs font-bold gap-1">
                      <CheckCircle2 className="w-3 h-3" /> PRESENT
                    </Badge>
                  )}
                  {log.status === 'LATE' && (
                    <Badge className="bg-amber-500/10 text-amber-700 border border-amber-500/20 text-xs font-bold gap-1">
                      <Clock className="w-3 h-3" /> LATE
                    </Badge>
                  )}
                  {log.status === 'HALF_DAY' && (
                    <Badge className="bg-sky-500/10 text-sky-700 border border-sky-500/20 text-xs font-bold gap-1">
                      <Clock className="w-3 h-3" /> HALF DAY
                    </Badge>
                  )}
                  {log.status === 'ABSENT' && (
                    <Badge className="bg-rose-500/10 text-rose-700 border border-rose-500/20 text-xs font-bold gap-1">
                      <XCircle className="w-3 h-3" /> ABSENT
                    </Badge>
                  )}
                  {log.status === 'NOT_MARKED' && !log.isFuture && (
                    <Badge className="bg-slate-100 text-slate-500 border border-slate-200 text-xs font-bold">
                      NOT MARKED
                    </Badge>
                  )}
                  {log.isFuture && (
                    <span className="text-xs text-slate-400 font-medium italic">Upcoming</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
