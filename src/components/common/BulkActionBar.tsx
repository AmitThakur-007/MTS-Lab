import React from 'react';
import { Button } from '@/components/ui/button';
import { 
  CheckSquare, 
  X, 
  Download, 
  Trash2, 
  RefreshCw,
  LucideIcon 
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BulkActionItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  variant?: 'default' | 'outline' | 'destructive' | 'secondary';
  onClick: (selectedIds: string[]) => void;
  disabled?: boolean;
}

export interface BulkActionBarProps {
  selectedIds: string[];
  totalCount?: number;
  onSelectAll?: () => void;
  onClearSelection: () => void;
  actions?: BulkActionItem[];
  onBulkDelete?: (selectedIds: string[]) => void;
  onBulkExport?: (selectedIds: string[]) => void;
  isProcessing?: boolean;
  className?: string;
}

export function BulkActionBar({
  selectedIds,
  totalCount,
  onSelectAll,
  onClearSelection,
  actions = [],
  onBulkDelete,
  onBulkExport,
  isProcessing = false,
  className,
}: BulkActionBarProps) {
  if (selectedIds.length === 0) return null;

  return (
    <div
      className={cn(
        'w-full p-2.5 sm:p-3 bg-slate-900 text-white rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-3 border border-slate-800 transition-all animate-in fade-in slide-in-from-bottom-2 duration-200 z-30',
        className
      )}
    >
      {/* Left: Selected count & Select all */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 rounded-xl text-xs font-mono font-bold text-cyan-400">
          <CheckSquare className="w-3.5 h-3.5" />
          <span>
            {selectedIds.length}
            {totalCount ? ` / ${totalCount}` : ''} selected
          </span>
        </div>

        {onSelectAll && totalCount && selectedIds.length < totalCount && (
          <button
            onClick={onSelectAll}
            disabled={isProcessing}
            className="text-xs font-semibold text-slate-300 hover:text-white underline cursor-pointer"
          >
            Select all {totalCount}
          </button>
        )}

        <button
          onClick={onClearSelection}
          disabled={isProcessing}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          title="Clear Selection"
          aria-label="Clear Selection"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center flex-wrap gap-2">
        {onBulkExport && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onBulkExport(selectedIds)}
            disabled={isProcessing}
            className="rounded-xl h-8 px-3 text-xs font-bold border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export Selected
          </Button>
        )}

        {actions.map((act) => {
          const Icon = act.icon;
          return (
            <Button
              key={act.id}
              size="sm"
              variant={act.variant || 'outline'}
              onClick={() => act.onClick(selectedIds)}
              disabled={act.disabled || isProcessing}
              className="rounded-xl h-8 px-3 text-xs font-bold cursor-pointer"
            >
              {Icon && <Icon className="w-3.5 h-3.5 mr-1.5" />}
              {act.label}
            </Button>
          );
        })}

        {onBulkDelete && (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => onBulkDelete(selectedIds)}
            disabled={isProcessing}
            className="rounded-xl h-8 px-3 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            Delete Selected
          </Button>
        )}
      </div>
    </div>
  );
}
