import React from 'react';
import { useNavigate } from 'react-router-dom';
import { UserCheck, CheckCircle2, Clock, XCircle, AlertCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StaffAttendanceSummary } from './types';

interface AttendanceSummaryWidgetProps {
  summary: StaffAttendanceSummary;
  canManage?: boolean;
}

export const AttendanceSummaryWidget: React.FC<AttendanceSummaryWidgetProps> = ({
  summary,
  canManage = false,
}) => {
  const navigate = useNavigate();

  const total = summary.totalStaff || 0;
  const present = summary.presentToday || 0;
  const late = summary.lateToday || 0;
  const absent = summary.absentToday || 0;
  const notMarked = summary.notMarkedToday || 0;

  const presentPercentage = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

  return (
    <div id="attendance-summary-widget" className="bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
      <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400">
            <UserCheck className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
              Staff Attendance Today
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Live NPT check-in roster
            </p>
          </div>
        </div>

        {canManage && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard/attendance')}
            className="text-xs text-primary hover:text-primary/80 h-8 px-2"
          >
            <span>Roster</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {/* Metric Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-2.5 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30">
            <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Present
            </span>
            <div className="text-lg font-bold text-emerald-900 dark:text-emerald-100 mt-1">
              {present}
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-amber-50/60 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30">
            <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Late
            </span>
            <div className="text-lg font-bold text-amber-900 dark:text-amber-100 mt-1">
              {late}
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-rose-50/60 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30">
            <span className="text-[11px] font-medium text-rose-700 dark:text-rose-300 flex items-center gap-1">
              <XCircle className="w-3 h-3" /> Absent
            </span>
            <div className="text-lg font-bold text-rose-900 dark:text-rose-100 mt-1">
              {absent}
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/40 border border-gray-200/60 dark:border-gray-700/40">
            <span className="text-[11px] font-medium text-gray-600 dark:text-gray-400 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> Unmarked
            </span>
            <div className="text-lg font-bold text-gray-800 dark:text-gray-200 mt-1">
              {notMarked}
            </div>
          </div>
        </div>

        {/* Attendance Rate Progress */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500 dark:text-gray-400">Total Team Coverage</span>
            <span className="font-semibold text-gray-800 dark:text-gray-200 font-mono">
              {present + late} of {total} staff ({presentPercentage}%)
            </span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-gray-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-teal-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(presentPercentage, 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
