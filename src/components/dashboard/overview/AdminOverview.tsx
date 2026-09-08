import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wrench,
  Users,
  TrendingUp,
  Package,
  Layers,
  ShieldAlert,
  UserCheck,
  CheckCircle2,
  Truck,
  BatteryCharging
} from 'lucide-react';
import { OverviewData } from './types';
import { OverviewStatCard } from './OverviewStatCard';
import { RepairTrendsChart } from './RepairTrendsChart';
import { BrandDistributionWidget } from './BrandDistributionWidget';
import { UrgentRepairsWidget } from './UrgentRepairsWidget';
import { AttendanceSummaryWidget } from './AttendanceSummaryWidget';
import { RecentRepairsWidget } from './RecentRepairsWidget';
import { ReadyForPickupWidget } from './ReadyForPickupWidget';
import { InventoryAlertsWidget } from './InventoryAlertsWidget';
import { TechnicianWorkloadWidget } from './TechnicianWorkloadWidget';

interface AdminOverviewProps {
  data: OverviewData;
}

export const AdminOverview: React.FC<AdminOverviewProps> = ({ data }) => {
  const navigate = useNavigate();
  const sys = data.systemSummary;
  const today = data.todayOperations;
  const att = data.staffAttendance;
  const alerts = data.alerts;
  const queues = data.queues;

  const totalWeekIntake = data.charts.intakeTrends.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="space-y-6" id="admin-overview-layout">
      {/* 1. Primary Operational KPI Cards */}
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
          title="Today's Intake"
          value={`+${today.todayNewRepairs}`}
          subtitle={`${today.todayCompletedRepairs} completed today`}
          icon={Layers}
          colorScheme="purple"
          badgeText="NPT Today"
          onClick={() => navigate('/dashboard/repairs')}
        />

        <OverviewStatCard
          title="Today's Revenue"
          value={`NPR ${today.todayRevenue.toLocaleString()}`}
          subtitle={`Pending: NPR ${today.pendingReceivables.toLocaleString()}`}
          icon={TrendingUp}
          colorScheme="emerald"
          onClick={() => navigate('/dashboard/revenue')}
        />

        <OverviewStatCard
          title="Staff Attendance"
          value={`${att.presentToday + att.lateToday} / ${att.totalStaff}`}
          subtitle={`${att.absentToday} absent • ${att.notMarkedToday} unmarked`}
          icon={UserCheck}
          colorScheme="teal"
          onClick={() => navigate('/dashboard/attendance')}
        />
      </div>

      {/* 2. Secondary Operations Row */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <OverviewStatCard
          title="Ready For Handover"
          value={sys.readyForPickupRepairs}
          subtitle="Completed customer devices"
          icon={CheckCircle2}
          colorScheme="emerald"
          onClick={() => navigate('/dashboard/repairs?status=READY_FOR_PICKUP')}
        />

        <OverviewStatCard
          title="Spare Parts Inventory"
          value={data.inventorySummary.totalItems}
          subtitle={`${data.inventorySummary.lowStockCount} low stock alerts`}
          icon={Package}
          colorScheme={data.inventorySummary.lowStockCount > 0 ? 'rose' : 'gray'}
          badgeText={data.inventorySummary.lowStockCount > 0 ? `${data.inventorySummary.lowStockCount} Low` : undefined}
          badgeVariant="destructive"
          onClick={() => navigate('/dashboard/inventory')}
        />

        <OverviewStatCard
          title="Courier Logistics"
          value={data.courierSummary.courierInCount + data.courierSummary.courierOutCount}
          subtitle={`${data.courierSummary.courierPendingCount} parcels in transit`}
          icon={Truck}
          colorScheme="teal"
          onClick={() => navigate('/dashboard/couriers')}
        />

        <OverviewStatCard
          title="Battery Warranties"
          value={data.warrantySummary.activeWarrantiesCount}
          subtitle={`${data.warrantySummary.totalWarranties} total registered`}
          icon={BatteryCharging}
          colorScheme="cyan"
          onClick={() => navigate('/dashboard/battery-warranties')}
        />
      </div>

      {/* 3. Charts: 7-Day Intake Trend & Device Brands */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RepairTrendsChart data={data.charts.intakeTrends} totalWeekCount={totalWeekIntake} />
        </div>
        <div>
          <BrandDistributionWidget brands={data.charts.topBrands} totalRepairs={sys.totalRepairs} />
        </div>
      </div>

      {/* 4. Priority Queue & Ready for Handover */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UrgentRepairsWidget
          urgentRepairs={queues.urgentQueue}
          urgentCount={alerts.urgentRepairsCount}
          highPriorityCount={alerts.highPriorityCount}
        />
        <ReadyForPickupWidget repairs={queues.readyForPickupQueue} />
      </div>

      {/* 5. Technician Workload & Low Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TechnicianWorkloadWidget workload={queues.technicianWorkload} />
        </div>
        <div>
          <InventoryAlertsWidget summary={data.inventorySummary} />
        </div>
      </div>

      {/* 6. Recent Repairs Table */}
      <RecentRepairsWidget repairs={queues.recentRepairs} />
    </div>
  );
};
