import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Phone, ArrowRight, User, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RepairItem } from './types';

interface ReadyForPickupWidgetProps {
  repairs: RepairItem[];
}

export const ReadyForPickupWidget: React.FC<ReadyForPickupWidgetProps> = ({ repairs }) => {
  const navigate = useNavigate();

  return (
    <div id="ready-for-pickup-widget" className="bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-xl p-4 sm:p-5 shadow-xs">
      <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
              Ready for Customer Delivery
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Completed repairs awaiting customer handover & payment
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/dashboard/repairs?status=READY_FOR_PICKUP')}
          className="text-xs text-primary hover:text-primary/80 h-8 px-2"
        >
          <span>View All</span>
          <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      </div>

      {repairs.length === 0 ? (
        <div className="py-6 text-center bg-gray-50/50 dark:bg-gray-800/30 rounded-lg border border-dashed border-gray-200 dark:border-gray-800">
          <p className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">No devices pending pickup</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            All completed repairs have been handed over to customers.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {repairs.map((repair) => {
            const paid = Number(repair.totalPaid || repair.advancePaid || 0);
            const est = Number(repair.estimatedCost || 0);
            const balanceDue = Math.max(est - paid, 0);

            return (
              <div
                key={repair.id}
                onClick={() => navigate(`/dashboard/repairs?search=${repair.repairNumber}`)}
                className="p-3 rounded-lg border border-emerald-100 dark:border-emerald-950/40 bg-emerald-50/30 dark:bg-emerald-950/10 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/20 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400">
                      {repair.repairNumber}
                    </span>
                    <Badge variant="outline" className="text-[10px] bg-emerald-100/60 text-emerald-800 border-emerald-300">
                      Ready
                    </Badge>
                  </div>
                  <div className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {repair.customerName}
                    <span className="text-gray-500 dark:text-gray-400 font-normal ml-1.5">
                      ({repair.deviceBrand} {repair.deviceModel})
                    </span>
                  </div>
                  {repair.customerPhone && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mt-0.5 font-mono">
                      <Phone className="w-3 h-3 text-emerald-600" />
                      <span>{repair.customerPhone}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-emerald-100 dark:border-emerald-900/30">
                  <div className="text-right">
                    <span className="text-[10px] text-gray-400 block">Balance Due</span>
                    <span className={`text-xs sm:text-sm font-bold font-mono ${balanceDue > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {balanceDue > 0 ? `NPR ${balanceDue.toLocaleString()}` : 'PAID IN FULL'}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-2.5 text-xs text-emerald-700 dark:text-emerald-300 border-emerald-300"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/dashboard/repairs?search=${repair.repairNumber}`);
                    }}
                  >
                    <span>Handover</span>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
