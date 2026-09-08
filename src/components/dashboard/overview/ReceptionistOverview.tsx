import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layers,
  CheckCircle2,
  Users,
  Clock,
  PlusCircle,
  Truck,
  BatteryCharging,
  ArrowRight,
  Phone,
  DollarSign
} from 'lucide-react';
import { OverviewData } from './types';
import { OverviewStatCard } from './OverviewStatCard';
import { ReadyForPickupWidget } from './ReadyForPickupWidget';
import { RecentRepairsWidget } from './RecentRepairsWidget';
import { Button } from '@/components/ui/button';

interface ReceptionistOverviewProps {
  data: OverviewData;
}

export const ReceptionistOverview: React.FC<ReceptionistOverviewProps> = ({ data }) => {
  const navigate = useNavigate();
  const sys = data.systemSummary;
  const today = data.todayOperations;
  const queues = data.queues;

  return (
    <div className="space-y-6" id="receptionist-overview-layout">
      {/* 1. Front-Desk KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <OverviewStatCard
          title="Today's Intake"
          value={`+${today.todayNewRepairs}`}
          subtitle="New device registrations today"
          icon={Layers}
          colorScheme="purple"
          badgeText="NPT Today"
          onClick={() => navigate('/dashboard/repairs')}
        />

        <OverviewStatCard
          title="Ready For Handover"
          value={sys.readyForPickupRepairs}
          subtitle="Customer devices awaiting pickup"
          icon={CheckCircle2}
          colorScheme="emerald"
          badgeText={sys.readyForPickupRepairs > 0 ? 'Pending Pickup' : undefined}
          badgeVariant="secondary"
          onClick={() => navigate('/dashboard/repairs?status=READY_FOR_PICKUP')}
        />

        <OverviewStatCard
          title="Delivered Today"
          value={`+${today.todayDeliveredRepairs}`}
          subtitle="Handed over to customers"
          icon={CheckCircle2}
          colorScheme="teal"
          onClick={() => navigate('/dashboard/repairs')}
        />

        <OverviewStatCard
          title="Pending Receivables"
          value={`NPR ${today.pendingReceivables.toLocaleString()}`}
          subtitle="Outstanding repair balances"
          icon={DollarSign}
          colorScheme="amber"
          onClick={() => navigate('/dashboard/repairs')}
        />
      </div>

      {/* 2. Secondary Operations Row */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <OverviewStatCard
          title="Total Customers"
          value={sys.totalCustomers.toLocaleString()}
          subtitle="Customer contact directory"
          icon={Users}
          colorScheme="indigo"
          onClick={() => navigate('/dashboard/customers')}
        />

        <OverviewStatCard
          title="Courier Parcels"
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

      {/* 3. Ready For Pickup Handover Queue */}
      <ReadyForPickupWidget repairs={queues.readyForPickupQueue} />

      {/* 4. Recent Repair Intake Stream */}
      <RecentRepairsWidget repairs={queues.recentRepairs} />
    </div>
  );
};
