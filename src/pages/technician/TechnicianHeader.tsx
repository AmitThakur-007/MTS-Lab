import React, { useState, useEffect, useMemo } from 'react';
import { Clock, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/store/authStore';
import { getNepalCalendarInfo } from '@/lib/nepalDate';
import DashboardRefreshButton from '@/components/DashboardRefreshButton';

interface TechnicianHeaderProps {
  title: string;
  subtitle?: string;
  badgeText?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  actions?: React.ReactNode;
}

export const TechnicianHeader: React.FC<TechnicianHeaderProps> = ({
  title,
  subtitle,
  badgeText = 'Bench Active',
  onRefresh,
  isRefreshing = false,
  actions,
}) => {
  const { user } = useAuthStore();
  const nepalCalendar = useMemo(() => getNepalCalendarInfo(new Date()), []);
  const [liveNptTime, setLiveNptTime] = useState('');

  // Live Nepal clock (Asia/Kathmandu timezone, UTC+05:45)
  useEffect(() => {
    const updateTime = () => {
      try {
        const timeStr = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Kathmandu',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        }).format(new Date());
        setLiveNptTime(timeStr);
      } catch {
        setLiveNptTime('');
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white dark:bg-slate-900 p-5 sm:p-6 md:p-7 rounded-[24px] sm:rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm transition-colors">
      <div className="space-y-1.5 max-w-2xl min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <Wrench className="h-6 w-6 sm:h-7 sm:w-7 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span className="truncate">{title}</span>
          </h1>
          <Badge
            variant="outline"
            className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 font-bold text-[11px] px-2.5 py-0.5 rounded-full flex items-center gap-1.5 shrink-0"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {badgeText}
          </Badge>
        </div>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
          Welcome back, <strong className="text-slate-900 dark:text-white font-extrabold">{user?.name || 'Abishek thakur'}</strong> • {subtitle || 'MTS Lab precision repair operations & quality control bench.'}
        </p>
      </div>

      {/* Right controls: Nepal Time Indicator + Refresh + Custom Actions */}
      <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 shrink-0 self-stretch sm:self-auto justify-end">
        {/* NPT Time Indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-xs shadow-2xs">
          <Clock className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <div className="flex flex-col text-right min-w-0">
            <span className="font-mono font-bold text-slate-900 dark:text-white text-[11px] truncate">
              {liveNptTime || '12:00:00 PM'} NPT (UTC+05:45)
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">
              {nepalCalendar.todayNpt}
            </span>
          </div>
        </div>

        {onRefresh && (
          <DashboardRefreshButton
            onRefresh={onRefresh}
            isRefreshing={isRefreshing}
          />
        )}

        {actions}
      </div>
    </div>
  );
};

export default TechnicianHeader;
