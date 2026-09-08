import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Wrench, ArrowRight, Clock, ShieldCheck, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RepairItem } from './types';

interface RecentRepairsWidgetProps {
  repairs: RepairItem[];
}

export const RecentRepairsWidget: React.FC<RecentRepairsWidgetProps> = ({ repairs }) => {
  const navigate = useNavigate();

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
      case 'DELIVERED':
      case 'COMPLETED':
        return <Badge variant="secondary" className="text-[11px] text-gray-700 bg-gray-100 dark:bg-gray-800">Delivered</Badge>;
      default:
        return <Badge variant="outline" className="text-[11px] text-gray-600 border-gray-300">{status}</Badge>;
    }
  };

  return (
    <div id="recent-repairs-widget" className="bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-xl p-4 sm:p-5 shadow-xs">
      <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
            <Wrench className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
              Recent Repair Records
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Live intake & repair stream
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/dashboard/repairs')}
          className="text-xs text-primary hover:text-primary/80 h-8 px-2"
        >
          <span>All Repairs</span>
          <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      </div>

      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-400 font-medium">
              <th className="pb-2.5 pl-4 sm:pl-0 font-medium">Repair #</th>
              <th className="pb-2.5 px-2 font-medium">Customer / Phone</th>
              <th className="pb-2.5 px-2 font-medium">Device Model</th>
              <th className="pb-2.5 px-2 font-medium text-center">Status</th>
              <th className="pb-2.5 pr-4 sm:pr-0 font-medium text-right">Est. Cost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
            {repairs.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-gray-400 text-xs">
                  No repair jobs recorded yet.
                </td>
              </tr>
            ) : (
              repairs.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => navigate(`/dashboard/repairs?search=${r.repairNumber}`)}
                  className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition-colors cursor-pointer"
                >
                  <td className="py-3 pl-4 sm:pl-0 font-mono font-semibold text-primary">
                    {r.repairNumber}
                  </td>
                  <td className="py-3 px-2">
                    <div className="font-medium text-gray-900 dark:text-gray-100">{r.customerName}</div>
                    {r.customerPhone && (
                      <div className="text-[11px] text-gray-400 font-mono">{r.customerPhone}</div>
                    )}
                  </td>
                  <td className="py-3 px-2 text-gray-700 dark:text-gray-300">
                    {r.deviceBrand} {r.deviceModel}
                  </td>
                  <td className="py-3 px-2 text-center">
                    {getStatusBadge(r.status)}
                  </td>
                  <td className="py-3 pr-4 sm:pr-0 text-right font-medium text-gray-900 dark:text-gray-100 font-mono">
                    {r.estimatedCost ? `NPR ${r.estimatedCost.toLocaleString()}` : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
