import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wrench,
  Users,
  AlertTriangle,
  Clock,
  Layers,
  ArrowRight,
  ShieldAlert,
  ArrowRightLeft,
  CheckCircle2,
  Package
} from 'lucide-react';
import { OverviewData } from './types';
import { OverviewStatCard } from './OverviewStatCard';
import { UrgentRepairsWidget } from './UrgentRepairsWidget';
import { TechnicianWorkloadWidget } from './TechnicianWorkloadWidget';
import { RecentRepairsWidget } from './RecentRepairsWidget';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface HeadTechnicianOverviewProps {
  data: OverviewData;
}

export const HeadTechnicianOverview: React.FC<HeadTechnicianOverviewProps> = ({ data }) => {
  const navigate = useNavigate();
  const sys = data.systemSummary;
  const today = data.todayOperations;
  const alerts = data.alerts;
  const queues = data.queues;

  return (
    <div className="space-y-6" id="head-technician-overview-layout">
      {/* 1. Technical Hub KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <OverviewStatCard
          title="Active Workshop Repairs"
          value={sys.activeRepairs}
          subtitle={`${sys.inProgressRepairs} under bench diagnosis & repair`}
          icon={Wrench}
          colorScheme="blue"
          badgeText={sys.urgentPriorityCount > 0 ? `${sys.urgentPriorityCount} Urgent` : undefined}
          badgeVariant="destructive"
          onClick={() => navigate('/dashboard/repairs')}
        />

        <OverviewStatCard
          title="Urgent & High Priority"
          value={alerts.urgentRepairsCount + alerts.highPriorityCount}
          subtitle={`${alerts.urgentRepairsCount} urgent • ${alerts.highPriorityCount} high priority`}
          icon={ShieldAlert}
          colorScheme={alerts.urgentRepairsCount > 0 ? 'rose' : 'amber'}
          badgeText="Action Req"
          badgeVariant="destructive"
          onClick={() => navigate('/dashboard/repairs?priority=URGENT')}
        />

        <OverviewStatCard
          title="Repairs Completed Today"
          value={`+${today.todayCompletedRepairs}`}
          subtitle={`${today.todayNewRepairs} new intake received today`}
          icon={CheckCircle2}
          colorScheme="emerald"
          onClick={() => navigate('/dashboard/repairs')}
        />

        <OverviewStatCard
          title="Pending Transfers"
          value={alerts.pendingTransfersCount}
          subtitle="Repair handovers between tech"
          icon={ArrowRightLeft}
          colorScheme={alerts.pendingTransfersCount > 0 ? 'purple' : 'gray'}
          badgeText={alerts.pendingTransfersCount > 0 ? 'Review' : undefined}
          onClick={() => navigate('/dashboard/repairs')}
        />
      </div>

      {/* 2. Technician Workload & Bench Distribution */}
      <TechnicianWorkloadWidget workload={queues.technicianWorkload} />

      {/* 3. Priority Queue & Recent Repairs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UrgentRepairsWidget
          urgentRepairs={queues.urgentQueue}
          urgentCount={alerts.urgentRepairsCount}
          highPriorityCount={alerts.highPriorityCount}
        />
        <RecentRepairsWidget repairs={queues.recentRepairs} />
      </div>
    </div>
  );
};
