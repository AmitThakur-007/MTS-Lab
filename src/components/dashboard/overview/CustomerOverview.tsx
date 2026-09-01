import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wrench,
  CheckCircle2,
  Clock,
  BatteryCharging,
  ArrowRight,
  ShieldCheck,
  Search
} from 'lucide-react';
import { OverviewData, RepairItem } from './types';
import { OverviewStatCard } from './OverviewStatCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface CustomerOverviewProps {
  data: OverviewData;
}

export const CustomerOverview: React.FC<CustomerOverviewProps> = ({ data }) => {
  const navigate = useNavigate();
  const customerRepairs = data.queues.customerRepairs || [];

  const getStatusBadge = (status: string) => {
    const s = (status || '').toUpperCase();
    switch (s) {
      case 'PENDING':
      case 'RECEIVED':
        return <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 bg-amber-50">Received / Pending</Badge>;
      case 'IN_PROCESS':
      case 'DIAGNOSING':
        return <Badge variant="outline" className="text-xs text-blue-600 border-blue-300 bg-blue-50">Under Repair</Badge>;
      case 'WAITING_FOR_PARTS':
        return <Badge variant="outline" className="text-xs text-purple-600 border-purple-300 bg-purple-50">Waiting for Parts</Badge>;
      case 'REPAIRED':
      case 'READY_FOR_PICKUP':
        return <Badge className="text-xs bg-emerald-600 text-white">Ready For Pickup</Badge>;
      case 'DELIVERED':
      case 'COMPLETED':
        return <Badge variant="secondary" className="text-xs">Delivered</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6" id="customer-overview-layout">
      {/* 1. Customer KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <OverviewStatCard
          title="My Active Repairs"
          value={customerRepairs.filter((r) => !['COMPLETED', 'DELIVERED'].includes((r.status || '').toUpperCase())).length}
          subtitle="Currently at MTS Lab"
          icon={Wrench}
          colorScheme="blue"
        />

        <OverviewStatCard
          title="Completed Repairs"
          value={customerRepairs.filter((r) => ['COMPLETED', 'DELIVERED'].includes((r.status || '').toUpperCase())).length}
          subtitle="Past service records"
          icon={CheckCircle2}
          colorScheme="emerald"
        />

        <OverviewStatCard
          title="Track Any Device"
          value="Live Status"
          subtitle="Look up by Repair or IMEI number"
          icon={Search}
          colorScheme="purple"
          onClick={() => navigate('/track')}
        />
      </div>

      {/* 2. Customer Repair Records List */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-xl p-5 shadow-xs">
        <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
              <Wrench className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                My Registered Repairs
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Track status and repair milestones for your devices
              </p>
            </div>
          </div>
        </div>

        {customerRepairs.length === 0 ? (
          <div className="py-8 text-center bg-gray-50/50 dark:bg-gray-800/30 rounded-lg border border-dashed border-gray-200 dark:border-gray-800">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">No repair tickets associated with your account</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-4">
              Have a repair job with us? You can track it using your repair number.
            </p>
            <Button size="sm" onClick={() => navigate('/track')} className="text-xs">
              <Search className="w-3.5 h-3.5 mr-1.5" />
              <span>Track Repair Number</span>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {customerRepairs.map((r) => (
              <div
                key={r.id}
                onClick={() => navigate(`/track?number=${r.repairNumber}`)}
                className="p-4 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-800/20 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-sm font-bold text-primary">{r.repairNumber}</span>
                    {getStatusBadge(r.status)}
                  </div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {r.deviceBrand} {r.deviceModel}
                  </div>
                  {r.problemDescription && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">
                      Issue: {r.problemDescription}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 dark:border-gray-800">
                  <div className="text-right">
                    <span className="text-xs text-gray-400 block">Payment Status</span>
                    <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                      {r.paymentStatus || 'UNPAID'}
                    </span>
                  </div>
                  <Button size="sm" variant="outline" className="text-xs h-8">
                    <span>Track Live</span>
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
