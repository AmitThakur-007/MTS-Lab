import React from 'react';
import {
  Clock,
  Calendar,
  AlertTriangle,
  UserCheck,
  UserX,
  Timer,
  Zap,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  Hourglass
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  getRepairTimelineMetrics,
  RepairTimelineMetrics,
  formatElapsedDuration,
  formatCompactDuration
} from '@/lib/repairTimeline';
import { cn } from '@/lib/utils';

interface RepairTimelineProps {
  repair: any;
  now?: Date;
  onFilterUnassigned?: () => void;
  onFilterProlonged?: () => void;
}

/**
 * Desktop Table Timeline Column Component
 * Displays Device Received, Technician Assigned, Time Since Received, Time Until Assignment,
 * Time Since Assignment, and Latency Alert Indicators.
 */
export const RepairTimelineTableCell: React.FC<RepairTimelineProps> = ({ repair, now = new Date() }) => {
  const metrics: RepairTimelineMetrics = getRepairTimelineMetrics(repair, now);
  const {
    receivedAtFormatted,
    assignedAtFormatted,
    timeSinceReceived,
    timeUntilAssignment,
    timeSinceAssignment,
    isAssigned,
    latency,
  } = metrics;

  return (
    <div className="py-1 min-w-[210px] max-w-[280px] space-y-1.5 text-xs text-slate-700">
      {/* 1. Device Received Row */}
      <div className="flex items-start gap-1.5">
        <div className="p-1 rounded-md bg-sky-50 text-sky-700 shrink-0 mt-0.5" title="Device Received at Laboratory">
          <Calendar className="h-3 w-3" />
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Received</span>
            <span className="text-[10px] font-semibold text-slate-500">{receivedAtFormatted}</span>
          </div>
          <div className="text-[11px] font-bold text-slate-900 mt-0.5 flex items-center gap-1">
            <Clock className="h-2.5 w-2.5 text-slate-400" />
            <span className="truncate">{timeSinceReceived}</span>
            <span className="text-[10px] font-normal text-slate-400">ago</span>
          </div>
        </div>
      </div>

      {/* 2. Technician Assigned & Latency Row */}
      <div className="flex items-start gap-1.5 pt-1 border-t border-slate-100">
        <div
          className={cn(
            "p-1 rounded-md shrink-0 mt-0.5",
            isAssigned ? "bg-indigo-50 text-indigo-700" : (latency.isProlonged ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700")
          )}
          title={isAssigned ? "Technician Assigned" : "Assignment Pending"}
        >
          {isAssigned ? <UserCheck className="h-3 w-3" /> : <Hourglass className="h-3 w-3" />}
        </div>

        <div className="min-w-0 flex-1 leading-tight">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {isAssigned ? 'Assigned' : 'Assignment'}
            </span>
            <Badge
              variant="outline"
              className={cn("text-[9px] px-1.5 py-0 font-bold border", latency.badgeClass)}
            >
              {isAssigned ? (
                <span>To Assign: {timeUntilAssignment}</span>
              ) : (
                <span>{latency.label}</span>
              )}
            </Badge>
          </div>

          {isAssigned ? (
            <div className="text-[10px] text-slate-600 mt-0.5 space-y-0.5">
              <div className="flex items-center justify-between text-slate-500">
                <span>At:</span>
                <span className="font-medium text-slate-700">{assignedAtFormatted}</span>
              </div>
              <div className="flex items-center justify-between text-slate-500">
                <span>Since Assign:</span>
                <span className="font-bold text-indigo-700">{timeSinceAssignment}</span>
              </div>
            </div>
          ) : (
            <div className="text-[11px] font-bold text-amber-700 mt-0.5 flex items-center gap-1">
              <span className="text-slate-500 font-medium">Waiting:</span>
              <span className={cn(latency.level === 'critical' ? 'text-rose-700 font-black' : 'text-amber-800')}>
                {timeSinceReceived}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Mobile and Tablet Card Timeline Section
 */
export const RepairTimelineCardSection: React.FC<RepairTimelineProps> = ({ repair, now = new Date() }) => {
  const metrics: RepairTimelineMetrics = getRepairTimelineMetrics(repair, now);
  const {
    receivedAtFormatted,
    assignedAtFormatted,
    timeSinceReceived,
    timeUntilAssignment,
    timeSinceAssignment,
    isAssigned,
    latency,
  } = metrics;

  return (
    <div
      className={cn(
        "rounded-2xl p-3 border transition-all text-xs space-y-2.5",
        !isAssigned && latency.level === 'critical'
          ? "bg-rose-50/60 border-rose-200"
          : (!isAssigned && latency.level === 'moderate'
            ? "bg-amber-50/60 border-amber-200"
            : "bg-slate-50/70 border-slate-200/80")
      )}
    >
      <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
        <div className="flex items-center gap-1.5 text-[11px] font-black text-slate-800 uppercase tracking-wider">
          <Timer className="h-3.5 w-3.5 text-indigo-600" />
          <span>Repair Timeline & Tracking</span>
        </div>
        <Badge variant="outline" className={cn("text-[10px] px-2 py-0.5 font-bold border", latency.badgeClass)}>
          {latency.label}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 text-slate-700">
        {/* Device Received */}
        <div className="bg-white/80 p-2 rounded-xl border border-slate-100 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Device Received
          </span>
          <div className="font-semibold text-[11px] text-slate-800 leading-tight">
            {receivedAtFormatted}
          </div>
          <div className="text-[10px] font-bold text-sky-700 pt-0.5 flex items-center gap-1">
            <Clock className="h-2.5 w-2.5 text-sky-500" />
            <span>{timeSinceReceived} ago</span>
          </div>
        </div>

        {/* Technician Assigned */}
        <div className="bg-white/80 p-2 rounded-xl border border-slate-100 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Technician Assigned
          </span>
          {isAssigned ? (
            <>
              <div className="font-semibold text-[11px] text-slate-800 leading-tight truncate" title={assignedAtFormatted}>
                {assignedAtFormatted}
              </div>
              <div className="text-[10px] font-bold text-indigo-700 pt-0.5 flex items-center gap-1">
                <CheckCircle2 className="h-2.5 w-2.5 text-indigo-500" />
                <span>Assign in {timeUntilAssignment}</span>
              </div>
            </>
          ) : (
            <>
              <div className="font-bold text-[11px] text-amber-700">
                Pending Assignment
              </div>
              <div className="text-[10px] font-bold text-amber-600 pt-0.5">
                Waiting: {timeSinceReceived}
              </div>
            </>
          )}
        </div>
      </div>

      {isAssigned && (
        <div className="flex items-center justify-between text-[11px] bg-indigo-50/70 text-indigo-900 px-2.5 py-1.5 rounded-xl border border-indigo-100/80">
          <span className="text-slate-600 font-medium">Time Since Assignment:</span>
          <span className="font-bold text-indigo-800">{timeSinceAssignment}</span>
        </div>
      )}
    </div>
  );
};

interface TimelineOverviewBannerProps {
  repairs: any[];
  now: Date;
  onFilterUnassigned: () => void;
  onFilterProlonged: () => void;
  activeStatusFilter: string;
}

/**
 * Top KPI & Bottleneck Monitor Bar for Manager Dashboard
 */
export const RepairTimelineOverviewBanner: React.FC<TimelineOverviewBannerProps> = ({
  repairs,
  now,
  onFilterUnassigned,
  onFilterProlonged,
  activeStatusFilter,
}) => {
  // Compute timeline aggregates across active repairs
  let unassignedCount = 0;
  let prolongedModerateCount = 0; // > 2 hours
  let prolongedCriticalCount = 0; // > 24 hours
  let totalAssignedSampleCount = 0;
  let totalTimeToAssignmentMs = 0;
  let longestWaitingRepair: any = null;
  let longestWaitingMs = 0;

  (repairs || []).forEach((r) => {
    const s = (r.status || '').toUpperCase();
    if (s === 'DELIVERED' || s === 'CANCELLED') return;

    const metrics = getRepairTimelineMetrics(r, now);
    if (!metrics.isAssigned) {
      unassignedCount++;
      if (metrics.latency.level === 'critical') prolongedCriticalCount++;
      if (metrics.latency.level === 'moderate') prolongedModerateCount++;

      if (metrics.rawElapsedSinceReceivedMs > longestWaitingMs) {
        longestWaitingMs = metrics.rawElapsedSinceReceivedMs;
        longestWaitingRepair = r;
      }
    } else if (metrics.rawTimeUntilAssignmentMs > 0) {
      totalAssignedSampleCount++;
      totalTimeToAssignmentMs += metrics.rawTimeUntilAssignmentMs;
    }
  });

  const avgMinutesToAssign = totalAssignedSampleCount > 0
    ? Math.round(totalTimeToAssignmentMs / totalAssignedSampleCount / 60000)
    : 0;

  const avgAssignReadable = avgMinutesToAssign > 0
    ? (avgMinutesToAssign >= 60
      ? `${Math.floor(avgMinutesToAssign / 60)}h ${avgMinutesToAssign % 60}m`
      : `${avgMinutesToAssign}m`)
    : 'N/A';

  const hasCritical = prolongedCriticalCount > 0;
  const hasModerate = prolongedModerateCount > 0;

  return (
    <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-[28px] p-5 sm:p-6 shadow-md border border-slate-700/60 relative overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left Title & Live Indicator */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Badge className="bg-indigo-500/20 text-indigo-200 border-indigo-400/30 text-[10px] font-black px-2.5 py-0.5 rounded-lg flex items-center gap-1.5">
              <Timer className="h-3 w-3 text-indigo-400" />
              <span>TIMELINE & BOTTLENECK TRACKER</span>
            </Badge>
            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
              Live Elapsed Tracking
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
            Laboratory Assignment Latency & Floor Time
          </h2>
          <p className="text-xs text-slate-300 font-medium max-w-xl">
            Continuously monitors intake time, assignment latency, and device floor time across all benches in Asia/Kathmandu timezone.
          </p>
        </div>

        {/* Right Metric Highlights */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 shrink-0">
          {/* Average Assignment Speed */}
          <div className="bg-white/10 backdrop-blur-xs p-3 rounded-2xl border border-white/10 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 block">
              Avg Time to Assign
            </span>
            <div className="text-lg sm:text-xl font-black text-emerald-300 mt-0.5">
              {avgAssignReadable}
            </div>
            <span className="text-[10px] text-slate-400 font-medium">intake to tech</span>
          </div>

          {/* Unassigned Waiting */}
          <button
            type="button"
            onClick={onFilterUnassigned}
            className={cn(
              "p-3 rounded-2xl border text-center transition-all cursor-pointer text-left",
              activeStatusFilter === 'UNASSIGNED'
                ? "bg-amber-500 text-white border-amber-400 shadow-sm"
                : "bg-white/10 hover:bg-white/15 border-white/10 text-white"
            )}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 block text-center">
              Unassigned Queue
            </span>
            <div className={cn("text-lg sm:text-xl font-black text-center mt-0.5", activeStatusFilter === 'UNASSIGNED' ? 'text-white' : 'text-amber-300')}>
              {unassignedCount}
            </div>
            <span className="text-[10px] text-slate-400 font-medium block text-center">awaiting tech</span>
          </button>

          {/* Prolonged Bottleneck Alert */}
          <div
            onClick={onFilterProlonged}
            className={cn(
              "col-span-2 sm:col-span-1 p-3 rounded-2xl border text-center cursor-pointer transition-all",
              hasCritical
                ? "bg-rose-500/20 border-rose-500/60 hover:bg-rose-500/30 text-rose-200"
                : (hasModerate
                  ? "bg-amber-500/20 border-amber-500/60 hover:bg-amber-500/30 text-amber-200"
                  : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300")
            )}
            title="Click to view unassigned repairs with longest delay"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider block">
              {hasCritical ? 'Critical Latency' : (hasModerate ? 'Moderate Latency' : 'Queue Health')}
            </span>
            <div className="text-lg sm:text-xl font-black mt-0.5 flex items-center justify-center gap-1">
              {hasCritical && <AlertTriangle className="h-4 w-4 text-rose-400 animate-bounce" />}
              <span>{prolongedCriticalCount + prolongedModerateCount}</span>
              <span className="text-xs font-normal text-slate-400">delayed</span>
            </div>
            <span className="text-[10px] opacity-80 font-medium">
              {hasCritical ? `${prolongedCriticalCount} waiting >24h` : (hasModerate ? `${prolongedModerateCount} waiting >2h` : 'No bottlenecks')}
            </span>
          </div>
        </div>
      </div>

      {/* Longest waiting device alert bar (if any unassigned device exists) */}
      {longestWaitingRepair && longestWaitingMs > 2 * 3600 * 1000 && (
        <div className="mt-3 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
            <span>
              Longest waiting unassigned: <b className="text-white">#{longestWaitingRepair.repairNumber}</b> ({longestWaitingRepair.deviceBrand} {longestWaitingRepair.deviceModel})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-300">
              Elapsed time: <b className="text-amber-300">{formatElapsedDuration(getRepairTimelineMetrics(longestWaitingRepair, now).receivedAtDate, now)}</b>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
