import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wrench,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRightLeft,
  CalendarCheck,
  ArrowRight,
  ShieldAlert,
  Layers,
  Sparkles
} from 'lucide-react';
import { OverviewData } from './types';
import { OverviewStatCard } from './OverviewStatCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface TechnicianOverviewProps {
  data: OverviewData;
}

export const TechnicianOverview: React.FC<TechnicianOverviewProps> = ({ data }) => {
  const navigate = useNavigate();
  const tech = data.technicianCockpit;
  const myRepairs = tech.myActiveRepairs || [];
  const incomingTransfers = tech.incomingTransfers || [];

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

  const getPriorityBadge = (priority: string) => {
    const p = (priority || '').toUpperCase();
    if (p === 'URGENT') {
      return (
        <Badge variant="destructive" className="text-[10px] font-bold uppercase px-1.5 py-0.2 animate-pulse">
          Urgent
        </Badge>
      );
    }
    if (p === 'HIGH') {
      return (
        <Badge className="bg-amber-500 text-white text-[10px] font-bold uppercase px-1.5 py-0.2">
          High
        </Badge>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6" id="technician-overview-layout">
      {/* 1. Technician Workbench KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <OverviewStatCard
          title="My Active Bench"
          value={tech.assignedToMeTotal}
          subtitle={`${tech.myInProgressCount} in progress • ${tech.myWaitingPartsCount} waiting parts`}
          icon={Wrench}
          colorScheme="blue"
          badgeText={tech.myUrgentCount > 0 ? `${tech.myUrgentCount} Urgent` : undefined}
          badgeVariant="destructive"
          onClick={() => navigate('/dashboard/repairs')}
        />

        <OverviewStatCard
          title="Completed Today"
          value={`+${tech.myCompletedTodayCount}`}
          subtitle="Successfully repaired jobs"
          icon={CheckCircle2}
          colorScheme="emerald"
          badgeText="NPT Today"
          onClick={() => navigate('/dashboard/repairs')}
        />

        <OverviewStatCard
          title="Incoming Transfers"
          value={incomingTransfers.length}
          subtitle="Requests sent to your bench"
          icon={ArrowRightLeft}
          colorScheme={incomingTransfers.length > 0 ? 'purple' : 'gray'}
          badgeText={incomingTransfers.length > 0 ? 'Review' : undefined}
          onClick={() => navigate('/dashboard/repairs')}
        />

        <OverviewStatCard
          title="My Attendance Today"
          value={tech.todayAttendance?.status || 'NOT MARKED'}
          subtitle={`Monthly Attendance Rate: ${tech.attendanceRate}%`}
          icon={CalendarCheck}
          colorScheme={tech.todayAttendance?.status === 'PRESENT' ? 'teal' : 'amber'}
          onClick={() => navigate('/dashboard/attendance')}
        />
      </div>

      {/* 2. Incoming Transfer Request Banner (if any) */}
      {incomingTransfers.length > 0 && (
        <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300 shrink-0">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-purple-900 dark:text-purple-200">
                You have {incomingTransfers.length} repair transfer request(s) awaiting response
              </div>
              <p className="text-xs text-purple-700 dark:text-purple-300">
                Another technician has requested to hand over repair responsibilities to you.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => navigate('/dashboard/repairs')}
            className="bg-purple-600 hover:bg-purple-700 text-white text-xs h-8 px-3 shrink-0"
          >
            <span>Review Transfers</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>
      )}

      {/* 3. My Active Repair Queue */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-xl p-4 sm:p-5 shadow-xs">
        <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
              <Wrench className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
                My Active Repair Queue
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Devices assigned to your bench for diagnosis & repair
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard/repairs')}
            className="text-xs text-primary hover:text-primary/80 h-8 px-2"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>

        {myRepairs.length === 0 ? (
          <div className="py-8 text-center bg-gray-50/50 dark:bg-gray-800/30 rounded-lg border border-dashed border-gray-200 dark:border-gray-800">
            <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2 opacity-80" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Your bench is all clear!</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              No active pending repairs assigned to you right now.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {myRepairs.map((repair) => (
              <div
                key={repair.id}
                onClick={() => navigate(`/dashboard/repairs?search=${repair.repairNumber}`)}
                className="p-3 sm:p-3.5 rounded-lg border border-gray-100 dark:border-gray-800/80 bg-gray-50/40 dark:bg-gray-800/20 hover:bg-white dark:hover:bg-gray-800/60 hover:border-gray-200 dark:hover:border-gray-700 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
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
                      Problem: {repair.problemDescription}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-gray-100 dark:border-gray-800">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs font-medium"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/dashboard/repairs?search=${repair.repairNumber}`);
                    }}
                  >
                    <span>Work on Job</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
