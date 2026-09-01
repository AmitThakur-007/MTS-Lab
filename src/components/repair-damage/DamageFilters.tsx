import React from 'react';
import { Search, X, Layers, LayoutGrid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { STANDARD_COMPONENTS, DAMAGE_TYPES } from './types';
import { cn } from '@/lib/utils';

interface Props {
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  selectedStaffFilter: string;
  setSelectedStaffFilter: (v: string) => void;
  selectedComponentFilter: string;
  setSelectedComponentFilter: (v: string) => void;
  selectedTypeFilter: string;
  setSelectedTypeFilter: (v: string) => void;
  periodTab: 'ALL' | 'TODAY' | 'THIS_MONTH' | 'THIS_YEAR' | 'CUSTOM';
  setPeriodTab: (v: 'ALL' | 'TODAY' | 'THIS_MONTH' | 'THIS_YEAR' | 'CUSTOM') => void;
  customDate: string;
  setCustomDate: (v: string) => void;
  customMonth: string;
  setCustomMonth: (v: string) => void;
  customYear: string;
  setCustomYear: (v: string) => void;
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
  staffList: any[];
  isElevated: boolean;
  totalRecordsCount: number;
  filteredCount: number;
  componentBreakdown?: Record<string, number>;
  viewMode: 'grid' | 'table';
  setViewMode: (v: 'grid' | 'table') => void;
}

export const DamageFilters: React.FC<Props> = ({
  searchQuery,
  setSearchQuery,
  selectedStaffFilter,
  setSelectedStaffFilter,
  selectedComponentFilter,
  setSelectedComponentFilter,
  selectedTypeFilter,
  setSelectedTypeFilter,
  periodTab,
  setPeriodTab,
  customDate,
  setCustomDate,
  customMonth,
  setCustomMonth,
  customYear,
  setCustomYear,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  staffList,
  isElevated,
  totalRecordsCount,
  filteredCount,
  componentBreakdown,
  viewMode,
  setViewMode,
}) => {
  const hasActiveFilters = 
    Boolean(searchQuery) ||
    selectedStaffFilter !== 'ALL' ||
    selectedComponentFilter !== 'ALL' ||
    selectedTypeFilter !== 'ALL' ||
    periodTab !== 'ALL';

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedStaffFilter('ALL');
    setSelectedComponentFilter('ALL');
    setSelectedTypeFilter('ALL');
    setPeriodTab('ALL');
    setCustomDate('');
    setCustomMonth('');
    setCustomYear('');
    setStartDate('');
    setEndDate('');
  };

  return (
    <div className="space-y-4" id="damage-filter-controls">
      {/* Component Breakdown Summary Chips */}
      {componentBreakdown && Object.keys(componentBreakdown).length > 0 && (
        <div className="bg-white p-3.5 sm:p-4 rounded-3xl border border-slate-200/70 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span>Component Breakdown Summary</span>
            </h3>
            <span className="text-[11px] font-semibold text-slate-400">
              {(Object.values(componentBreakdown) as number[]).reduce((a, b) => a + b, 0)} total incidents
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
            {Object.entries(componentBreakdown).map(([compName, count]: [string, any]) => {
              if (count === 0 && selectedComponentFilter !== compName) return null;
              const isSelected = selectedComponentFilter === compName;
              return (
                <button
                  key={compName}
                  type="button"
                  onClick={() => setSelectedComponentFilter(isSelected ? 'ALL' : compName)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border shrink-0 flex items-center gap-2 cursor-pointer shadow-2xs",
                    isSelected 
                      ? "bg-slate-900 text-white border-slate-900" 
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  )}
                >
                  <span className="truncate max-w-[160px]">{compName}</span>
                  <span className={cn(
                    "px-1.5 py-0.5 rounded-md text-[10px] font-black",
                    isSelected ? "bg-white text-slate-900" : "bg-slate-200 text-slate-700"
                  )}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Filter Container */}
      <div className="bg-white p-4 sm:p-5 lg:p-6 rounded-3xl border border-slate-200/70 shadow-xs space-y-4">
        {/* Quick Period Tabs & View Mode */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mr-1 hidden sm:inline">Period:</span>
            {[
              { id: 'ALL', label: 'All Records' },
              { id: 'TODAY', label: 'Today' },
              { id: 'THIS_MONTH', label: 'This Month' },
              { id: 'THIS_YEAR', label: 'This Year' },
              { id: 'CUSTOM', label: 'Custom Range' }
            ].map(tab => (
              <Button
                key={tab.id}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPeriodTab(tab.id as any)}
                className={cn(
                  "rounded-xl text-xs font-bold h-8 sm:h-9 px-2.5 sm:px-3.5 cursor-pointer transition-all",
                  periodTab === tab.id 
                    ? "bg-slate-900 text-white hover:bg-slate-800 shadow-xs" 
                    : "text-slate-600 hover:bg-slate-100"
                )}
              >
                {tab.label}
              </Button>
            ))}
          </div>

          <div className="flex items-center justify-between w-full sm:w-auto gap-3">
            <div className="text-xs font-bold text-slate-500 whitespace-nowrap">
              Showing <span className="text-slate-900 font-extrabold">{filteredCount}</span> of {totalRecordsCount} records
            </div>

            {/* View Mode Toggle (Grid vs Table) */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/60 shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={cn(
                  "p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  viewMode === 'grid' ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-900"
                )}
                title="Grid View"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={cn(
                  "p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  viewMode === 'table' ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-900"
                )}
                title="Table View"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Custom Range Selectors (when CUSTOM is active) */}
        {periodTab === 'CUSTOM' && (
          <div className="p-3.5 sm:p-4 bg-slate-50 rounded-2xl border border-slate-200/60 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-in fade-in duration-200">
            <div className="space-y-1 min-w-0">
              <Label className="text-[11px] font-bold text-slate-600 truncate block">Specific Date</Label>
              <Input 
                type="date"
                value={customDate}
                onChange={e => {
                  setCustomDate(e.target.value);
                  setCustomMonth('');
                  setCustomYear('');
                  setStartDate('');
                  setEndDate('');
                }}
                className="h-9 text-xs rounded-xl bg-white border-slate-200 font-medium"
              />
            </div>
            <div className="space-y-1 min-w-0">
              <Label className="text-[11px] font-bold text-slate-600 truncate block">Specific Month</Label>
              <Input 
                type="month"
                value={customMonth}
                onChange={e => {
                  setCustomMonth(e.target.value);
                  setCustomDate('');
                  setCustomYear('');
                  setStartDate('');
                  setEndDate('');
                }}
                className="h-9 text-xs rounded-xl bg-white border-slate-200 font-medium"
              />
            </div>
            <div className="space-y-1 min-w-0">
              <Label className="text-[11px] font-bold text-slate-600 truncate block">Start Date</Label>
              <Input 
                type="date"
                value={startDate}
                onChange={e => {
                  setStartDate(e.target.value);
                  setCustomDate('');
                  setCustomMonth('');
                  setCustomYear('');
                }}
                className="h-9 text-xs rounded-xl bg-white border-slate-200 font-medium"
              />
            </div>
            <div className="space-y-1 min-w-0">
              <Label className="text-[11px] font-bold text-slate-600 truncate block">End Date</Label>
              <Input 
                type="date"
                value={endDate}
                onChange={e => {
                  setEndDate(e.target.value);
                  setCustomDate('');
                  setCustomMonth('');
                  setCustomYear('');
                }}
                className="h-9 text-xs rounded-xl bg-white border-slate-200 font-medium"
              />
            </div>
          </div>
        )}

        {/* Search & Filter Dropdowns */}
        <div className={cn("grid gap-3", isElevated ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-3")}>
          {/* Search Box */}
          <div className="relative min-w-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <Input
              type="text"
              placeholder={isElevated ? "Search staff, repair #, device, part..." : "Search repair #, device, part..."}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-10 pl-9 pr-8 rounded-xl border-slate-200 bg-slate-50/70 focus:bg-white text-xs font-medium"
            />
            {searchQuery && (
              <button 
                type="button" 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer"
                title="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Staff Filter (Elevated Roles Only) */}
          {isElevated && (
            <div className="min-w-0">
              <Select value={selectedStaffFilter} onValueChange={setSelectedStaffFilter}>
                <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-slate-50/70 text-xs font-bold">
                  <SelectValue placeholder="All Staff Members" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl shadow-xl max-h-60">
                  <SelectItem value="ALL" className="text-xs font-bold">All Staff Members</SelectItem>
                  {staffList.map(s => (
                    <SelectItem key={s.id} value={s.id} className="text-xs">
                      <span className="font-bold">{s.name}</span>
                      <span className="text-[10px] text-slate-400 ml-1.5">({s.role?.replace(/_/g, ' ')})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Component Filter */}
          <div className="min-w-0">
            <Select value={selectedComponentFilter} onValueChange={setSelectedComponentFilter}>
              <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-slate-50/70 text-xs font-bold">
                <SelectValue placeholder="All Components" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl shadow-xl max-h-60">
                <SelectItem value="ALL" className="text-xs font-bold">All Components</SelectItem>
                {STANDARD_COMPONENTS.map(c => (
                  <SelectItem key={c} value={c} className="text-xs font-medium">{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Damage Type Filter */}
          <div className="min-w-0">
            <Select value={selectedTypeFilter} onValueChange={setSelectedTypeFilter}>
              <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-slate-50/70 text-xs font-bold">
                <SelectValue placeholder="All Damage Types" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl shadow-xl max-h-60">
                <SelectItem value="ALL" className="text-xs font-bold">All Damage Types</SelectItem>
                {DAMAGE_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value} className="text-xs font-medium">{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Active Filter Pills */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <span className="text-[11px] font-bold text-slate-400 shrink-0">Active filters:</span>
            {searchQuery && (
              <Badge variant="secondary" className="text-[10px] font-bold gap-1 rounded-lg bg-slate-100 text-slate-800 border-slate-200">
                <span className="truncate max-w-[120px]">Search: {searchQuery}</span>
                <X className="h-3 w-3 cursor-pointer shrink-0" onClick={() => setSearchQuery('')} />
              </Badge>
            )}
            {selectedStaffFilter !== 'ALL' && (
              <Badge variant="secondary" className="text-[10px] font-bold gap-1 rounded-lg bg-slate-100 text-slate-800 border-slate-200">
                <span className="truncate max-w-[120px]">Staff: {staffList.find(s => s.id === selectedStaffFilter)?.name || selectedStaffFilter}</span>
                <X className="h-3 w-3 cursor-pointer shrink-0" onClick={() => setSelectedStaffFilter('ALL')} />
              </Badge>
            )}
            {selectedComponentFilter !== 'ALL' && (
              <Badge variant="secondary" className="text-[10px] font-bold gap-1 rounded-lg bg-slate-100 text-slate-800 border-slate-200">
                <span className="truncate max-w-[120px]">Component: {selectedComponentFilter}</span>
                <X className="h-3 w-3 cursor-pointer shrink-0" onClick={() => setSelectedComponentFilter('ALL')} />
              </Badge>
            )}
            {selectedTypeFilter !== 'ALL' && (
              <Badge variant="secondary" className="text-[10px] font-bold gap-1 rounded-lg bg-slate-100 text-slate-800 border-slate-200">
                <span className="truncate max-w-[120px]">Type: {DAMAGE_TYPES.find(t => t.value === selectedTypeFilter)?.label || selectedTypeFilter}</span>
                <X className="h-3 w-3 cursor-pointer shrink-0" onClick={() => setSelectedTypeFilter('ALL')} />
              </Badge>
            )}
            {periodTab !== 'ALL' && (
              <Badge variant="secondary" className="text-[10px] font-bold gap-1 rounded-lg bg-slate-100 text-slate-800 border-slate-200">
                <span>Period: {periodTab.replace(/_/g, ' ')}</span>
                <X className="h-3 w-3 cursor-pointer shrink-0" onClick={() => setPeriodTab('ALL')} />
              </Badge>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="h-6 text-[10px] font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 rounded-lg cursor-pointer"
            >
              Reset all filters
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
