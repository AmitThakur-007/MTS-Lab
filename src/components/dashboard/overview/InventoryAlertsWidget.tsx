import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { InventorySummary } from './types';

interface InventoryAlertsWidgetProps {
  summary: InventorySummary;
}

export const InventoryAlertsWidget: React.FC<InventoryAlertsWidgetProps> = ({ summary }) => {
  const navigate = useNavigate();
  const lowStock = summary.lowStockItems || [];

  return (
    <div id="inventory-alerts-widget" className="bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-xl p-4 sm:p-5 shadow-xs">
      <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
            <Package className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
              Inventory & Spare Parts Alert
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Low-stock replacement parts needing replenishment
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/dashboard/inventory')}
          className="text-xs text-primary hover:text-primary/80 h-8 px-2"
        >
          <span>Inventory Hub</span>
          <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      </div>

      {lowStock.length === 0 ? (
        <div className="py-6 text-center bg-gray-50/50 dark:bg-gray-800/30 rounded-lg border border-dashed border-gray-200 dark:border-gray-800">
          <CheckCircle2 className="w-7 h-7 mx-auto text-emerald-500 mb-1.5 opacity-80" />
          <p className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">All parts adequately stocked</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Total of {summary.totalItems} catalog items active in lab.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {lowStock.map((item) => (
            <div
              key={item.id}
              onClick={() => navigate('/dashboard/inventory')}
              className="p-2.5 sm:p-3 rounded-lg border border-rose-100 dark:border-rose-950/40 bg-rose-50/30 dark:bg-rose-950/10 hover:bg-rose-50/60 dark:hover:bg-rose-950/20 transition-colors cursor-pointer flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="font-medium text-xs sm:text-sm text-gray-900 dark:text-gray-100 truncate">
                  {item.name}
                </div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                  {item.brand} {item.model ? `— ${item.model}` : ''} • {item.category || 'Spare Parts'}
                </div>
              </div>

              <div className="text-right shrink-0">
                <Badge variant="destructive" className="text-[11px] font-bold px-2 py-0.5">
                  {item.currentStock} {item.unit || 'pcs'} left
                </Badge>
                <div className="text-[10px] text-gray-400 mt-0.5">
                  Min: {item.minStockLevel}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
