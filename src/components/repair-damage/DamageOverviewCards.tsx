import React from 'react';
import { FileWarning, Calendar, Clock, DollarSign, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { DamageOverviewStats } from './types';
import { format } from 'date-fns';

interface Props {
  stats: DamageOverviewStats | null;
  loading: boolean;
  isElevated: boolean;
}

export const DamageOverviewCards: React.FC<Props> = ({ stats, loading, isElevated }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4" id="damage-overview-metrics">
      {/* 1. Total Incidents */}
      <Card className="rounded-3xl border border-slate-200/70 shadow-xs bg-white overflow-hidden p-4 sm:p-5 flex items-center gap-3.5 sm:gap-4">
        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 shadow-2xs">
          <FileWarning className="h-5 w-5 sm:h-6 sm:w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">
            {isElevated ? 'Total Damage Incidents' : 'My Total Incidents'}
          </p>
          <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-0.5 truncate">
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-slate-400 inline" />
            ) : (
              (stats?.totalRecords ?? 0).toLocaleString()
            )}
          </div>
          <p className="text-[11px] font-medium text-slate-500 mt-0.5 truncate">
            {isElevated ? 'Active logged incidents' : 'Associated with your repairs'}
          </p>
        </div>
      </Card>

      {/* 2. This Month */}
      <Card className="rounded-3xl border border-slate-200/70 shadow-xs bg-white overflow-hidden p-4 sm:p-5 flex items-center gap-3.5 sm:gap-4">
        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0 shadow-2xs">
          <Calendar className="h-5 w-5 sm:h-6 sm:w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">
            {isElevated ? 'This Month' : 'My Month Incidents'}
          </p>
          <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-0.5 truncate">
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-slate-400 inline" />
            ) : (
              (stats?.thisMonthRecords ?? 0).toLocaleString()
            )}
          </div>
          <p className="text-[11px] font-medium text-slate-500 mt-0.5 truncate">
            {stats?.currentMonth || format(new Date(), 'MMMM yyyy')}
          </p>
        </div>
      </Card>

      {/* 3. Today */}
      <Card className="rounded-3xl border border-slate-200/70 shadow-xs bg-white overflow-hidden p-4 sm:p-5 flex items-center gap-3.5 sm:gap-4">
        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0 shadow-2xs">
          <Clock className="h-5 w-5 sm:h-6 sm:w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">
            {isElevated ? "Today's Incidents" : "My Today Incidents"}
          </p>
          <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-0.5 truncate">
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-slate-400 inline" />
            ) : (
              (stats?.todayRecords ?? 0).toLocaleString()
            )}
          </div>
          <p className="text-[11px] font-medium text-slate-500 mt-0.5 truncate">
            Authoritative Nepal date
          </p>
        </div>
      </Card>

      {/* 4. Total Est. Cost */}
      <Card className="rounded-3xl border border-slate-200/70 shadow-xs bg-white overflow-hidden p-4 sm:p-5 flex items-center gap-3.5 sm:gap-4">
        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 shadow-2xs">
          <DollarSign className="h-5 w-5 sm:h-6 sm:w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">
            {isElevated ? 'Total Est. Value' : 'My Est. Cost'}
          </p>
          <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-0.5 truncate" title={`NPR ${(stats?.totalEstimatedCost || 0).toLocaleString()}`}>
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-slate-400 inline" />
            ) : (
              `NPR ${(stats?.totalEstimatedCost || 0).toLocaleString()}`
            )}
          </div>
          <p className="text-[11px] font-medium text-slate-500 mt-0.5 truncate">
            Cumulative part valuation
          </p>
        </div>
      </Card>
    </div>
  );
};
