import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  DollarSign,
  CreditCard,
  Layers,
  ArrowRight,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { OverviewData } from './types';
import { OverviewStatCard } from './OverviewStatCard';
import { RecentRepairsWidget } from './RecentRepairsWidget';
import { Button } from '@/components/ui/button';

interface AccountantOverviewProps {
  data: OverviewData;
}

export const AccountantOverview: React.FC<AccountantOverviewProps> = ({ data }) => {
  const navigate = useNavigate();
  const today = data.todayOperations;
  const sys = data.systemSummary;
  const queues = data.queues;

  return (
    <div className="space-y-6" id="accountant-overview-layout">
      {/* 1. Financial Revenue KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <OverviewStatCard
          title="Today's Revenue"
          value={`NPR ${today.todayRevenue.toLocaleString()}`}
          subtitle="Collections recorded today"
          icon={DollarSign}
          colorScheme="emerald"
          badgeText="NPT Today"
          onClick={() => navigate('/dashboard/revenue')}
        />

        <OverviewStatCard
          title="This Week's Revenue"
          value={`NPR ${today.weekRevenue.toLocaleString()}`}
          subtitle="Rolling 7-day total"
          icon={TrendingUp}
          colorScheme="teal"
          onClick={() => navigate('/dashboard/revenue')}
        />

        <OverviewStatCard
          title="This Month's Revenue"
          value={`NPR ${today.monthRevenue.toLocaleString()}`}
          subtitle="Current calendar month"
          icon={CreditCard}
          colorScheme="blue"
          onClick={() => navigate('/dashboard/revenue')}
        />

        <OverviewStatCard
          title="Pending Receivables"
          value={`NPR ${today.pendingReceivables.toLocaleString()}`}
          subtitle="Outstanding customer balances"
          icon={Clock}
          colorScheme="amber"
          badgeText="Pending"
          onClick={() => navigate('/dashboard/repairs')}
        />
      </div>

      {/* 2. Secondary Breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <OverviewStatCard
          title="All-Time Revenue"
          value={`NPR ${today.totalRevenue.toLocaleString()}`}
          subtitle="Total repair settlements"
          icon={DollarSign}
          colorScheme="indigo"
          onClick={() => navigate('/dashboard/revenue')}
        />

        <OverviewStatCard
          title="Completed Repairs"
          value={sys.completedRepairs.toLocaleString()}
          subtitle="Successfully delivered jobs"
          icon={CheckCircle2}
          colorScheme="emerald"
          onClick={() => navigate('/dashboard/repairs')}
        />

        <OverviewStatCard
          title="Active Work Orders"
          value={sys.activeRepairs.toLocaleString()}
          subtitle="Jobs currently in pipeline"
          icon={Layers}
          colorScheme="purple"
          onClick={() => navigate('/dashboard/repairs')}
        />
      </div>

      {/* 3. Recent Transaction Stream */}
      <RecentRepairsWidget repairs={queues.recentRepairs} />
    </div>
  );
};
