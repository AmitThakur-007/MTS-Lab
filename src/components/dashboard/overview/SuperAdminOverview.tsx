import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wrench,
  Users,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Package,
  Layers,
  ArrowRight,
  UserCheck,
  DollarSign
} from 'lucide-react';
import { OverviewData } from './types';
import { OverviewStatCard } from './OverviewStatCard';
import { RepairTrendsChart } from './RepairTrendsChart';
import { BrandDistributionWidget } from './BrandDistributionWidget';
import { UrgentRepairsWidget } from './UrgentRepairsWidget';
import { AttendanceSummaryWidget } from './AttendanceSummaryWidget';
import { RecentRepairsWidget } from './RecentRepairsWidget';
import { TechnicianWorkloadWidget } from './TechnicianWorkloadWidget';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface SuperAdminOverviewProps {
  data: OverviewData;
}

export const SuperAdminOverview: React.FC<SuperAdminOverviewProps> = ({ data }) => {
  const navigate = useNavigate();
  const sys = data.systemSummary;
  const today = data.todayOperations;
  const att = data.staffAttendance;
  const alerts = data.alerts;
  const queues = data.queues;

  const totalWeekIntake = data.charts.intakeTrends.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="space-y-6" id="super-admin-overview-layout">
      {/* 1. Primary Operational KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <OverviewStatCard
          id="stat-active-repairs"
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
          id="stat-today-intake"
          title="Today's Intake"
          value={`+${today.todayNewRepairs}`}
          subtitle={`${today.todayCompletedRepairs} completed today`}
          icon={Layers}
          colorScheme="purple"
          badgeText="NPT Today"
          onClick={() => navigate('/dashboard/repairs')}
        />

        <OverviewStatCard
          id="stat-today-revenue"
          title="Today's Revenue"
          value={`NPR ${today.todayRevenue.toLocaleString()}`}
          subtitle={`This Month: NPR ${today.monthRevenue.toLocaleString()}`}
          icon={TrendingUp}
          colorScheme="emerald"
          onClick={() => navigate('/dashboard/revenue')}
        />

        <OverviewStatCard
          id="stat-staff-present"
          title="Staff Present Today"
          value={`${att.presentToday + att.lateToday} / ${att.totalStaff}`}
          subtitle={`${att.absentToday} absent • ${att.notMarkedToday} unmarked`}
          icon={UserCheck}
          colorScheme="teal"
          badgeText={att.pendingRequestsCount > 0 ? `${att.pendingRequestsCount} Pending` : undefined}
          onClick={() => navigate('/dashboard/attendance')}
        />
      </div>

      {/* 2. Secondary Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <OverviewStatCard
          title="Total Customers"
          value={sys.totalCustomers.toLocaleString()}
          subtitle="Registered customer profiles"
          icon={Users}
          colorScheme="indigo"
          onClick={() => navigate('/dashboard/customers')}
        />

        <OverviewStatCard
          title="Pending Receivables"
          value={`NPR ${today.pendingReceivables.toLocaleString()}`}
          subtitle="Uncollected repair balances"
          icon={DollarSign}
          colorScheme="amber"
          onClick={() => navigate('/dashboard/revenue')}
        />

        <OverviewStatCard
          title="Low Stock Alerts"
          value={data.inventorySummary.lowStockCount}
          subtitle={`${data.inventorySummary.outOfStockCount} out of stock parts`}
          icon={Package}
          colorScheme={data.inventorySummary.lowStockCount > 0 ? 'rose' : 'gray'}
          badgeText={data.inventorySummary.lowStockCount > 0 ? 'Action Req' : undefined}
          badgeVariant="destructive"
          onClick={() => navigate('/dashboard/inventory')}
        />

        <OverviewStatCard
          title="Security Surveillance"
          value={alerts.pendingAccessRequestsCount > 0 ? `${alerts.pendingAccessRequestsCount} Requests` : 'Protected'}
          subtitle="Access controls & audit trails"
          icon={ShieldCheck}
          colorScheme="purple"
          badgeText={alerts.pendingAccessRequestsCount > 0 ? 'Review' : 'Active'}
          badgeVariant={alerts.pendingAccessRequestsCount > 0 ? 'destructive' : 'secondary'}
          onClick={() => navigate('/dashboard/security')}
        />
      </div>

      {/* 3. Charts Row: 7-Day Intake Trend & Top Device Brands */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RepairTrendsChart data={data.charts.intakeTrends} totalWeekCount={totalWeekIntake} />
        </div>
        <div>
          <BrandDistributionWidget brands={data.charts.topBrands} totalRepairs={sys.totalRepairs} />
        </div>
      </div>

      {/* 4. Priority Queue & Attendance Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UrgentRepairsWidget
          urgentRepairs={queues.urgentQueue}
          urgentCount={alerts.urgentRepairsCount}
          highPriorityCount={alerts.highPriorityCount}
        />
        <AttendanceSummaryWidget summary={att} canManage={true} />
      </div>

      {/* 5. Technician Bench Workload */}
      <TechnicianWorkloadWidget workload={queues.technicianWorkload} />

      {/* 6. Recent Repairs Table */}
      <RecentRepairsWidget repairs={queues.recentRepairs} />
    </div>
  );
};
