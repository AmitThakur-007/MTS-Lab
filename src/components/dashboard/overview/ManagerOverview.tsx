import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wrench,
  Users,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  UserCheck,
  Package,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { OverviewData } from './types';
import { OverviewStatCard } from './OverviewStatCard';
import { UrgentRepairsWidget } from './UrgentRepairsWidget';
import { AttendanceSummaryWidget } from './AttendanceSummaryWidget';
import { TechnicianWorkloadWidget } from './TechnicianWorkloadWidget';
import { RecentRepairsWidget } from './RecentRepairsWidget';
import { ReadyForPickupWidget } from './ReadyForPickupWidget';
import { InventoryAlertsWidget } from './InventoryAlertsWidget';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ManagerOverviewProps {
  data: OverviewData;
}

export const ManagerOverview: React.FC<ManagerOverviewProps> = ({ data }) => {
  const navigate = useNavigate();
  const sys = data.systemSummary;
  const today = data.todayOperations;
  const att = data.staffAttendance;
  const alerts = data.alerts;
  const queues = data.queues;

  return (
    <div className="space-y-6" id="manager-overview-layout">
      {/* 1. Manager KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <OverviewStatCard
          title="Active Repairs"
          value={sys.activeRepairs}
          subtitle={`${sys.inProgressRepairs} in progress • ${sys.pendingRepairs} pending`}
          icon={Wrench}
          colorScheme="blue"
          badgeText={sys.urgentPriorityCount > 0 ? `${sys.urgentPriorityCount} Urgent` : undefined}
          badgeVariant="destructive"
          onClick={() => navigate('/dashboard/repairs')}
        />

        <OverviewStatCard
          title="Unassigned Repairs"
          value={sys.unassignedRepairs}
          subtitle="Awaiting technician assignment"
          icon={Clock}
          colorScheme={sys.unassignedRepairs > 0 ? 'amber' : 'gray'}
          badgeText={sys.unassignedRepairs > 0 ? 'Assign Now' : undefined}
          badgeVariant="outline"
          onClick={() => navigate('/dashboard/repairs')}
        />

        <OverviewStatCard
          title="Staff Present Today"
          value={`${att.presentToday + att.lateToday} / ${att.totalStaff}`}
          subtitle={`${att.pendingRequestsCount} attendance requests pending`}
          icon={UserCheck}
          colorScheme="teal"
          badgeText={att.pendingRequestsCount > 0 ? 'Review' : undefined}
          onClick={() => navigate('/dashboard/attendance')}
        />

        <OverviewStatCard
          title="Ready For Handover"
          value={sys.readyForPickupRepairs}
          subtitle={`${today.todayCompletedRepairs} repaired today`}
          icon={CheckCircle2}
          colorScheme="emerald"
          onClick={() => navigate('/dashboard/repairs?status=READY_FOR_PICKUP')}
        />
      </div>

      {/* 2. Unassigned Repairs Alert Banner (if any) */}
      {sys.unassignedRepairs > 0 && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                {sys.unassignedRepairs} repairs need technician assignment
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Assign jobs to technicians with available bench capacity.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => navigate('/dashboard/repairs')}
            className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-8 px-3 shrink-0"
          >
            <span>Assign Repairs</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>
      )}

      {/* 3. Technician Bench Workload */}
      <TechnicianWorkloadWidget workload={queues.technicianWorkload} />

      {/* 4. Priority Queue & Attendance Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UrgentRepairsWidget
          urgentRepairs={queues.urgentQueue}
          urgentCount={alerts.urgentRepairsCount}
          highPriorityCount={alerts.highPriorityCount}
        />
        <AttendanceSummaryWidget summary={att} canManage={true} />
      </div>

      {/* 5. Ready for Pickup & Low Stock Parts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ReadyForPickupWidget repairs={queues.readyForPickupQueue} />
        <InventoryAlertsWidget summary={data.inventorySummary} />
      </div>

      {/* 6. Recent Repairs Table */}
      <RecentRepairsWidget repairs={queues.recentRepairs} />
    </div>
  );
};
