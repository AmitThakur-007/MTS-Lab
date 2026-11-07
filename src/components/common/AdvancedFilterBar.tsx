import React from 'react';
import { Search, X, Calendar, Filter, RotateCcw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type DateFilterPreset = 'ALL' | 'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'CUSTOM';

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

export interface AdvancedFilterBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  
  // Status Filter
  statusValue?: string;
  onStatusChange?: (value: string) => void;
  statusOptions?: FilterOption[];
  statusLabel?: string;

  // Date Preset Filter
  datePreset?: DateFilterPreset;
  onDatePresetChange?: (preset: DateFilterPreset) => void;
  customStartDate?: string;
  customEndDate?: string;
  onCustomDateChange?: (start: string, end: string) => void;

  // Generic Extra Selectors (e.g., technician, category)
  extraFilters?: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: FilterOption[];
  }[];

  // Actions
  onResetAll?: () => void;
  hasActiveFilters?: boolean;
  className?: string;
}

/**
 * Calculates start and end dates based on Asia/Kathmandu (+05:45) timezone
 */
export function getKathmanduDateRange(preset: DateFilterPreset): { startDate: string; endDate: string } {
  // Current time in Kathmandu
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const ktmTime = new Date(utc + 5.75 * 3600000);

  const formatDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = formatDate(ktmTime);

  switch (preset) {
    case 'TODAY':
      return { startDate: todayStr, endDate: todayStr };
    case 'YESTERDAY': {
      const y = new Date(ktmTime);
      y.setDate(y.getDate() - 1);
      const yStr = formatDate(y);
      return { startDate: yStr, endDate: yStr };
    }
    case 'THIS_WEEK': {
      const w = new Date(ktmTime);
      const day = w.getDay(); // 0 is Sunday
      w.setDate(w.getDate() - day);
      return { startDate: formatDate(w), endDate: todayStr };
    }
    case 'THIS_MONTH': {
      const m = new Date(ktmTime.getFullYear(), ktmTime.getMonth(), 1);
      return { startDate: formatDate(m), endDate: todayStr };
    }
    default:
      return { startDate: '', endDate: '' };
  }
}

export function AdvancedFilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search records by number, customer, phone...',
  statusValue,
  onStatusChange,
  statusOptions = [],
  statusLabel = 'Status',
  datePreset,
  onDatePresetChange,
  customStartDate = '',
  customEndDate = '',
  onCustomDateChange,
  extraFilters = [],
  onResetAll,
  hasActiveFilters = false,
  className,
}: AdvancedFilterBarProps) {
  const datePresets: { value: DateFilterPreset; label: string }[] = [
    { value: 'ALL', label: 'All Time' },
    { value: 'TODAY', label: 'Today' },
    { value: 'YESTERDAY', label: 'Yesterday' },
    { value: 'THIS_WEEK', label: 'This Week' },
    { value: 'THIS_MONTH', label: 'This Month' },
    { value: 'CUSTOM', label: 'Custom Range' },
  ];

  return (
    <div
      className={cn(
        'p-3.5 sm:p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs space-y-3 transition-colors',
        className
      )}
    >
      {/* Top Row: Search Input + Date Preset Tabs + Reset Button */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 shrink-0 pointer-events-none" />
          <Input
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-9 pr-8 h-9.5 text-xs sm:text-sm rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/70"
          />
          {searchValue && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Date Presets Segmented Buttons */}
        {onDatePresetChange && (
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl overflow-x-auto max-w-full">
            {datePresets.map((preset) => (
              <button
                key={preset.value}
                onClick={() => onDatePresetChange(preset.value)}
                className={cn(
                  'px-2.5 py-1 text-xs font-bold rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer',
                  datePreset === preset.value
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>
        )}

        {/* Reset Filter Button */}
        {hasActiveFilters && onResetAll && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onResetAll}
            className="rounded-xl h-9 text-xs font-bold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            Clear Filters
          </Button>
        )}
      </div>

      {/* Custom Date Pickers (Shown if CUSTOM selected) */}
      {datePreset === 'CUSTOM' && onCustomDateChange && (
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800 text-xs">
          <span className="font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" /> Custom Date (Kathmandu Time):
          </span>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={customStartDate}
              onChange={(e) => onCustomDateChange(e.target.value, customEndDate)}
              className="h-8 text-xs rounded-lg w-36 border-slate-200 dark:border-slate-700"
            />
            <span className="text-slate-400">to</span>
            <Input
              type="date"
              value={customEndDate}
              onChange={(e) => onCustomDateChange(customStartDate, e.target.value)}
              className="h-8 text-xs rounded-lg w-36 border-slate-200 dark:border-slate-700"
            />
          </div>
        </div>
      )}

      {/* Second Row: Status filters & extra dropdowns */}
      {(statusOptions.length > 0 || extraFilters.length > 0) && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          {/* Status selector */}
          {statusOptions.length > 0 && onStatusChange && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mr-1">
                {statusLabel}:
              </span>
              <div className="flex items-center gap-1 flex-wrap">
                {statusOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => onStatusChange(opt.value)}
                    className={cn(
                      'px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5',
                      statusValue === opt.value
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 border-slate-900 dark:border-white font-bold shadow-2xs'
                        : 'bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700/80 hover:bg-slate-100'
                    )}
                  >
                    <span>{opt.label}</span>
                    {typeof opt.count === 'number' && (
                      <span
                        className={cn(
                          'text-[10px] px-1.5 py-0.2 rounded-full tabular-nums font-mono',
                          statusValue === opt.value
                            ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                        )}
                      >
                        {opt.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Extra filters */}
          {extraFilters.map((flt) => (
            <div key={flt.id} className="flex items-center gap-1 ml-auto">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                {flt.label}:
              </span>
              <select
                value={flt.value}
                onChange={(e) => flt.onChange(e.target.value)}
                className="h-7.5 px-2 text-xs font-semibold rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer outline-none"
              >
                {flt.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
