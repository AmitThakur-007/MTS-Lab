import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Clock, ShieldAlert, Wrench, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RepairItem } from './types';

interface UrgentRepairsWidgetProps {
  urgentRepairs: RepairItem[];
  highPriorityCount: number;
  urgentCount: number;
}

export const UrgentRepairsWidget: React.FC<UrgentRepairsWidgetProps> = ({
  urgentRepairs,
  highPriorityCount,
  urgentCount,
}) => {
  const navigate = useNavigate();

  const getPriorityBadge = (priority: string) => {
    const p = (priority || '').toUpperCase();
    if (p === 'URGENT') {
      return (
        <Badge variant="destructive" className="text-[11px] font-semibold tracking-wide uppercase px-2 py-0.5 animate-pulse">
          Urgent
        </Badge>
      );
    }
    if (p === 'HIGH') {
      return (
        <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-semibold tracking-wide uppercase px-2 py-0.5">
          High
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="text-[11px] px-2 py-0.5">
        Normal
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const s = (status || '').toUpperCase();
    switch (s) {
      case 'PENDING':
      case 'RECEIVED':
        return <Badge variant="outline" className="text-[11px] text-amber-600 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30">Pending</Badge>;
      case 'IN_PROCESS':
      case 'DIAGNOSING':
        return <Badge variant="outline" className="text-[11px] text-blue-600 border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/30">In Progress</Badge>;
      case 'WAITING_FOR_PARTS':
        return <Badge variant="outline" className="text-[11px] text-purple-600 border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-950/30">Waiting Parts</Badge>;
      case 'REPAIRED':
      case 'READY_FOR_PICKUP':
        return <Badge variant="outline" className="text-[11px] text-emerald-600 border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30">Ready</Badge>;
      default:
        return <Badge variant="outline" className="text-[11px] text-gray-600 border-gray-300">{status}</Badge>;
    }
  };

  return (
    <div id="urgent-repairs-widget" className="bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-xl p-4 sm:p-5 shadow-xs">
      <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <span>Priority Action Queue</span>
              {(urgentCount > 0 || highPriorityCount > 0) && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300">
                  {urgentCount + highPriorityCount} Critical
                </span>
              )}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Repairs requiring fast turnaround and technician priority
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/dashboard/repairs?priority=URGENT')}
          className="text-xs text-primary hover:text-primary/80 h-8 px-2"
        >
          <span>View All</span>
          <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      </div>

      {urgentRepairs.length === 0 ? (
        <div className="py-8 text-center bg-gray-50/50 dark:bg-gray-800/30 rounded-lg border border-dashed border-gray-200 dark:border-gray-800">
          <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2 opacity-80" />
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">No urgent backlog</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            All high-priority jobs are currently under control or completed.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {urgentRepairs.map((repair) => (
            <div
              key={repair.id}
              onClick={() => navigate(`/dashboard/repairs?search=${repair.repairNumber}`)}
              className="p-3 sm:p-3.5 rounded-lg border border-gray-100 dark:border-gray-800/80 bg-gray-50/40 dark:bg-gray-800/20 hover:bg-white dark:hover:bg-gray-800/60 hover:border-gray-200 dark:hover:border-gray-700 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-mono text-xs font-bold text-primary">{repair.repairNumber}</span>
                  {getPriorityBadge(repair.priority)}
                  {getStatusBadge(repair.status)}
                </div>
                <div className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {repair.deviceBrand} {repair.deviceModel}
                  <span className="text-gray-400 dark:text-gray-500 font-normal ml-1.5">
                    — {repair.customerName}
                  </span>
                </div>
                {repair.problemDescription && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">
                    {repair.problemDescription}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-gray-100 dark:border-gray-800">
                {repair.estimatedCost !== undefined && (
                  <div className="text-right">
                    <span className="text-xs text-gray-400 block sm:hidden">Est. Cost</span>
                    <span className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-200">
                      NPR {repair.estimatedCost.toLocaleString()}
                    </span>
                  </div>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-gray-600">
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
