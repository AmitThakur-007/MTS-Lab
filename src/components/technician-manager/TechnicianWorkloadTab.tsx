import React, { useState, useMemo } from 'react';
import {
  Activity,
  UserCheck,
  AlertTriangle,
  Flame,
  Zap,
  Wrench,
  CheckCircle2,
  Package,
  Clock,
  ArrowRightLeft,
  ChevronRight,
  Filter,
  BarChart3,
  Smartphone,
  Tablet,
  Laptop,
  Tv,
  Eye,
  SlidersHorizontal
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { TechnicianPerformance } from './types';
import { STATUS_STYLES, getPriorityMeta, DEVICE_CATEGORIES, DeviceCategory } from '@/pages/technician/types';
import { formatTimeAgo } from '@/lib/timeUtils';

interface TechnicianWorkloadTabProps {
  technicians: TechnicianPerformance[];
  loading: boolean;
  onOpenAssignModal?: (repair: any) => void;
  onOpenPriorityModal?: (repair: any) => void;
  onRefresh?: () => void;
}

export const TechnicianWorkloadTab: React.FC<TechnicianWorkloadTabProps> = ({
  technicians,
  loading,
  onOpenAssignModal,
  onOpenPriorityModal,
  onRefresh,
}) => {
  const [selectedTechId, setSelectedTechId] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<DeviceCategory>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Filter technicians
  const displayedTechnicians = useMemo(() => {
    if (selectedTechId === 'ALL') return technicians;
    return technicians.filter(t => t.id === selectedTechId);
  }, [technicians, selectedTechId]);

  // Overall capacity aggregates
  const capacityStats = useMemo(() => {
    let totalActive = 0;
    let availableCount = 0;
    let normalCount = 0;
    let heavyCount = 0;
    let overloadedCount = 0;

    technicians.forEach(t => {
      totalActive += t.activeRepairsCount;
      if (t.workloadStatus === 'AVAILABLE') availableCount++;
      else if (t.workloadStatus === 'NORMAL') normalCount++;
      else if (t.workloadStatus === 'HEAVY') heavyCount++;
      else if (t.workloadStatus === 'OVERLOADED') overloadedCount++;
    });

    return {
      totalActive,
      availableCount,
      normalCount,
      heavyCount,
      overloadedCount,
    };
  }, [technicians]);

  return (
    <div className="space-y-6">
      {/* ====================================================================
          1. COMPARATIVE WORKLOAD CAPACITY OVERVIEW
         ==================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Available Capacity */}
        <Card className="rounded-2xl border-emerald-200/80 dark:border-emerald-950/60 bg-emerald-50/20 dark:bg-emerald-950/20 shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                Available Capacity
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
                <UserCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-emerald-700 dark:text-emerald-300">
                {capacityStats.availableCount}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                technicians (0-2 jobs)
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Normal Capacity */}
        <Card className="rounded-2xl border-blue-200/80 dark:border-blue-950/60 bg-blue-50/20 dark:bg-blue-950/20 shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                Normal Workload
              </span>
              <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 flex items-center justify-center">
                <Activity className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-blue-700 dark:text-blue-300">
                {capacityStats.normalCount}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                technicians (3-6 jobs)
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Heavy Capacity */}
        <Card className="rounded-2xl border-amber-200/80 dark:border-amber-950/60 bg-amber-50/20 dark:bg-amber-950/20 shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider">
                Heavy Workload
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 flex items-center justify-center">
                <Flame className="w-4 h-4 text-amber-600" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-amber-800 dark:text-amber-400">
                {capacityStats.heavyCount}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                technicians (7-9 jobs)
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Overloaded */}
        <Card className="rounded-2xl border-rose-200/80 dark:border-rose-950/60 bg-rose-50/20 dark:bg-rose-950/20 shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider">
                Overloaded Benches
              </span>
              <div className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-rose-600 animate-pulse" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-rose-700 dark:text-rose-400">
                {capacityStats.overloadedCount}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                technicians (10+ jobs)
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ====================================================================
          2. FILTER TOOLBAR
         ==================================================================== */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Technician Filter Pill */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 max-w-full">
          <button
            type="button"
            onClick={() => setSelectedTechId('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              selectedTechId === 'ALL'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            All Technicians ({technicians.length})
          </button>
          {technicians.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelectedTechId(t.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                selectedTechId === t.id
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${t.workloadDotColor}`} />
              <span>{t.name}</span>
              <span className="text-[10px] opacity-75">({t.activeRepairsCount})</span>
            </button>
          ))}
        </div>

        {/* Device Category Filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-slate-400">Category:</span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as any)}
            className="h-9 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
          >
            {DEVICE_CATEGORIES.map(c => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ====================================================================
          3. COMPARATIVE TECHNICIAN CARDS & QUEUES
         ==================================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {displayedTechnicians.map((tech) => {
          // Filter repair queue by category if selected
          const filteredActiveRepairs = tech.activeRepairs.filter(r => {
            if (selectedCategory !== 'ALL' && r.category !== selectedCategory) {
              return false;
            }
            return true;
          });

          return (
            <div
              key={tech.id}
              className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col"
            >
              {/* Header Box */}
              <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10 rounded-2xl border border-slate-200 dark:border-slate-700 shrink-0">
                      {tech.profileImage ? (
                        <AvatarImage src={tech.profileImage} alt={tech.name} />
                      ) : null}
                      <AvatarFallback className="bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-black text-xs">
                        {tech.name ? tech.name.substring(0, 2).toUpperCase() : 'TC'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <span className="font-black text-sm text-slate-900 dark:text-white truncate block">
                        {tech.name}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-400 truncate block">
                        {tech.role.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>

                  <Badge variant="outline" className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-lg border ${tech.workloadBadgeClass}`}>
                    <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${tech.workloadDotColor}`} />
                    <span>{tech.workloadLabel}</span>
                  </Badge>
                </div>

                {/* Capacity Progress Bar */}
                <div className="mt-3.5 space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="text-slate-500">Active Workload Capacity</span>
                    <span className="text-slate-900 dark:text-white font-mono">{tech.activeRepairsCount} / 10 jobs</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        tech.activeRepairsCount >= 10
                          ? 'bg-rose-500'
                          : tech.activeRepairsCount >= 7
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, (tech.activeRepairsCount / 10) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Hardware Category Pills */}
                <div className="mt-3 flex flex-wrap gap-1">
                  {Object.entries(tech.deviceCategories)
                    .filter(([_, count]) => count > 0)
                    .map(([cat, count]) => (
                      <span
                        key={cat}
                        className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                      >
                        {cat}: {count}
                      </span>
                    ))}
                </div>
              </div>

              {/* Status Counters Strip */}
              <div className="grid grid-cols-4 p-3 border-b border-slate-100 dark:border-slate-800 text-center divide-x divide-slate-100 dark:divide-slate-800 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Pending</span>
                  <span className="font-extrabold text-slate-800 dark:text-slate-200">{tech.pendingCount}</span>
                </div>
                <div>
                  <span className="text-[10px] text-sky-600 font-bold uppercase block">In Prog</span>
                  <span className="font-extrabold text-sky-700 dark:text-sky-300">{tech.inProgressCount}</span>
                </div>
                <div>
                  <span className="text-[10px] text-amber-600 font-bold uppercase block">Parts</span>
                  <span className="font-extrabold text-amber-700 dark:text-amber-400">{tech.waitingForPartsCount}</span>
                </div>
                <div>
                  <span className="text-[10px] text-rose-600 font-bold uppercase block">Urgent</span>
                  <span className="font-extrabold text-rose-700 dark:text-rose-400">{tech.highPriorityCount}</span>
                </div>
              </div>

              {/* Active Repairs List */}
              <div className="flex-1 p-3.5 space-y-2.5 overflow-y-auto max-h-[360px] min-h-[160px]">
                {filteredActiveRepairs.length === 0 ? (
                  <div className="py-8 text-center text-slate-400">
                    <CheckCircle2 className="w-6 h-6 mx-auto mb-1 text-emerald-500 opacity-50" />
                    <p className="text-xs font-semibold">No active jobs in this view</p>
                  </div>
                ) : (
                  filteredActiveRepairs.map((repair) => {
                    const priorityMeta = getPriorityMeta(repair);
                    const statusMeta = STATUS_STYLES[repair.status] || { label: repair.status, badge: 'bg-slate-100 text-slate-700' };

                    return (
                      <div
                        key={repair.id}
                        className="p-3 rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-black text-xs text-indigo-600 dark:text-indigo-400">
                            #{repair.repairNumber}
                          </span>
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className={`text-[9px] font-extrabold px-1.5 py-0 ${priorityMeta.badgeClass}`}>
                              {priorityMeta.indicatorText}
                            </Badge>
                            <Badge variant="outline" className={`text-[9px] font-bold px-1.5 py-0 ${statusMeta.badge}`}>
                              {statusMeta.label}
                            </Badge>
                          </div>
                        </div>

                        <p className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          {repair.deviceBrand} {repair.deviceModel}
                        </p>
                        <p className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate">
                          Customer: {repair.customerName}
                        </p>

                        {/* Reassign / Priority Quick Bar */}
                        <div className="pt-1.5 flex items-center justify-between border-t border-slate-200/60 dark:border-slate-800 text-[10px]">
                          <span className="text-slate-400">
                            {formatTimeAgo(repair.updatedAt)}
                          </span>

                          <div className="flex items-center gap-1">
                            {onOpenPriorityModal && (
                              <button
                                type="button"
                                onClick={() => onOpenPriorityModal(repair)}
                                className="px-2 py-0.5 rounded-md font-bold text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer"
                              >
                                Priority
                              </button>
                            )}
                            {onOpenAssignModal && (
                              <button
                                type="button"
                                onClick={() => onOpenAssignModal(repair)}
                                className="px-2 py-0.5 rounded-md font-bold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer"
                              >
                                Reassign
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
