import React from 'react';
import {
  Clock,
  Download,
  RefreshCw,
  Calendar,
  CheckCircle2,
  Lock,
  ShieldCheck,
  UserCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface AttendanceHeaderProps {
  role: string;
  serverTime: string;
  serverDate: string;
  isWithinWindow: boolean;
  secondsRemaining: number;
  secondsUntilOpen: number;
  selectedDate: string;
  onDateChange: (date: string) => void;
  onRefresh: () => void;
  onExport: () => void;
  onOpenBulkModal: () => void;
  isLoading: boolean;
  isManagement: boolean;
  isAdminOrSuperAdmin: boolean;
  isManager: boolean;
}

export const AttendanceHeader: React.FC<AttendanceHeaderProps> = ({
  role,
  serverTime,
  serverDate,
  isWithinWindow,
  secondsRemaining,
  secondsUntilOpen,
  selectedDate,
  onDateChange,
  onRefresh,
  onExport,
  onOpenBulkModal,
  isLoading,
  isManagement,
  isAdminOrSuperAdmin,
  isManager,
}) => {
  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${String(s).padStart(2, '0')}s`;
  };

  const isToday = selectedDate === serverDate;

  return (
    <div className="space-y-3 sm:space-y-4 w-full min-w-0">
      {/* Top Banner / Breadcrumb & Title */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs w-full min-w-0">
        <div className="space-y-1.5 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5 shrink-0">
              <UserCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
              MTS Lab Operations
            </span>
            <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">•</span>
            {isAdminOrSuperAdmin ? (
              <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-bold gap-1 px-2.5 py-0.5 whitespace-normal break-words text-left">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span>{role === 'SUPER_ADMIN' ? 'Super Admin Mode (24/7 Access)' : 'Admin Mode (24/7 Access)'}</span>
              </Badge>
            ) : isManager ? (
              <Badge
                className={cn(
                  'text-[11px] font-bold gap-1 px-2.5 py-0.5 border whitespace-normal break-words text-left',
                  isWithinWindow
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 animate-pulse'
                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800'
                )}
              >
                {isWithinWindow ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Manager Window OPEN (10:00–10:45 AM NPT)</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>Manager Window CLOSED (10:00–10:45 AM NPT)</span>
                  </>
                )}
              </Badge>
            ) : (
              <Badge className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[11px] font-bold gap-1 px-2.5 py-0.5">
                <UserCheck className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                Staff Personal Attendance
              </Badge>
            )}
          </div>

          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            Attendance Hub
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
            {isAdminOrSuperAdmin
              ? 'Complete authoritative attendance tracking, roster verification, and records management.'
              : isManager
              ? 'Staff attendance marking (10:00 AM – 10:45 AM NPT window), roster oversight, and monthly logs.'
              : 'View your verified attendance history, daily presence status, and monthly logs.'}
          </p>
        </div>

        {/* Live NPT Business Clock & Actions */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 w-full sm:w-auto shrink-0">
          {/* NPT Clock Display */}
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-900 dark:bg-slate-800 border border-transparent dark:border-slate-700 text-white rounded-xl shadow-xs shrink-0">
            <Clock className="w-4 h-4 text-emerald-400 shrink-0 animate-pulse" />
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-slate-300 dark:text-slate-400 uppercase tracking-wider leading-none">
                MTS Lab Time (NPT)
              </span>
              <span className="text-xs font-mono font-black text-white tracking-wider">
                {serverTime || '--:--:--'}
              </span>
            </div>
          </div>

          {/* Manager Window Countdown (if Manager) */}
          {isManager && (
            <div
              className={cn(
                'px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 shrink-0',
                isWithinWindow
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              )}
            >
              {isWithinWindow ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
                  <span>Window Closes: {formatCountdown(secondsRemaining)}</span>
                </>
              ) : secondsUntilOpen > 0 ? (
                <>
                  <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>Opens in: {formatCountdown(secondsUntilOpen)}</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>Window Closed</span>
                </>
              )}
            </div>
          )}

          {/* Action Buttons for Management */}
          {isManagement && (
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              {/* Bulk Mark Button */}
              <Button
                size="sm"
                onClick={onOpenBulkModal}
                disabled={isManager && !isWithinWindow}
                className={cn(
                  'h-9 px-3 text-xs font-bold rounded-xl gap-1.5 shadow-2xs transition-all shrink-0 cursor-pointer',
                  isManager && !isWithinWindow
                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                )}
                title={
                  isManager && !isWithinWindow
                    ? 'Bulk attendance is only available during 10:00 AM – 10:45 AM NPT'
                    : 'Mark all active staff as Present for today'
                }
              >
                <Users className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Mark All Present</span>
                <span className="sm:hidden">Bulk Present</span>
              </Button>

              {/* Export CSV */}
              <Button
                variant="outline"
                size="sm"
                onClick={onExport}
                className="h-9 px-3 text-xs font-bold rounded-xl gap-1.5 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-2xs shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
                <span className="hidden sm:inline">Export CSV</span>
                <span className="sm:hidden">Export</span>
              </Button>

              {/* Refresh Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={isLoading}
                className="h-9 w-9 p-0 text-slate-700 dark:text-slate-200 rounded-xl border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 shrink-0 cursor-pointer"
                title="Refresh Attendance Data"
              >
                <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin text-indigo-600')} />
              </Button>
            </div>
          )}

          {!isManagement && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading}
              className="h-9 w-9 p-0 text-slate-700 dark:text-slate-200 rounded-xl border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 shrink-0 cursor-pointer"
              title="Refresh Attendance Data"
            >
              <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin text-indigo-600')} />
            </Button>
          )}
        </div>
      </div>

      {/* Date Filter Bar for Management */}
      {isManagement && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 bg-slate-50/80 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200/60 dark:border-slate-700/80 w-full min-w-0">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <div className="flex items-center gap-1.5 shrink-0">
              <Calendar className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">Target Date:</span>
            </div>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="h-8 text-xs font-bold bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg w-36 px-2 shrink-0"
            />
            {!isToday && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDateChange(serverDate)}
                className="h-8 px-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg shrink-0 whitespace-nowrap cursor-pointer"
              >
                Reset to Today
              </Button>
            )}
          </div>

          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 shrink-0">
            Authoritative Date:{' '}
            <strong className="text-slate-800 dark:text-slate-200 font-mono">{selectedDate}</strong>
          </div>
        </div>
      )}
    </div>
  );
};
