import React, { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/services/api';
import { useRealtimeSync } from '@/services/realtime';
import { OverviewData } from '@/components/dashboard/overview/types';
import { OverviewHeader } from '@/components/dashboard/overview/OverviewHeader';
import { SuperAdminOverview } from '@/components/dashboard/overview/SuperAdminOverview';
import { AdminOverview } from '@/components/dashboard/overview/AdminOverview';
import { ManagerOverview } from '@/components/dashboard/overview/ManagerOverview';
import { HeadTechnicianOverview } from '@/components/dashboard/overview/HeadTechnicianOverview';
import { TechnicianOverview } from '@/components/dashboard/overview/TechnicianOverview';
import { ReceptionistOverview } from '@/components/dashboard/overview/ReceptionistOverview';
import { AccountantOverview } from '@/components/dashboard/overview/AccountantOverview';
import { CustomerOverview } from '@/components/dashboard/overview/CustomerOverview';
import { OverviewLoadingSkeleton } from '@/components/dashboard/overview/OverviewLoadingSkeleton';
import { OverviewErrorState } from '@/components/dashboard/overview/OverviewErrorState';

export default function Overview() {
  const { user } = useAuthStore();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = useCallback(async (showSkeleton = false) => {
    if (showSkeleton) setLoading(true);
    setError(null);
    try {
      const res = await api.get<OverviewData>('/dashboard/overview');
      if (res && typeof res === 'object') {
        setData(res);
      } else {
        throw new Error('Invalid data payload received from server.');
      }
    } catch (err: any) {
      console.error('[OVERVIEW FETCH ERROR]', err);
      setError(err?.message || 'Failed to connect to server and retrieve overview metrics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview(true);
  }, [fetchOverview]);

  // Real-time synchronization when any database event occurs
  useRealtimeSync(['repair', 'payment', 'product', 'user', 'attendance', 'transfer', 'inventory', 'sync'], () => {
    fetchOverview(false);
  });

  if (loading && !data) {
    return (
      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-4 sm:py-6">
        <OverviewLoadingSkeleton />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-4 sm:py-6">
        <OverviewErrorState error={error} onRetry={() => fetchOverview(true)} />
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const role = (data.role || user?.role || 'RECEPTIONIST').toUpperCase().replace(/\s+/g, '_');

  const renderRoleDashboard = () => {
    switch (role) {
      case 'SUPER_ADMIN':
        return <SuperAdminOverview data={data} />;
      case 'ADMIN':
        return <AdminOverview data={data} />;
      case 'MANAGER':
        return <ManagerOverview data={data} />;
      case 'HEAD_TECHNICIAN':
      case 'LEAD_TECHNICIAN':
        return <HeadTechnicianOverview data={data} />;
      case 'TECHNICIAN':
      case 'TECHNICAL_ASSISTANT':
        return <TechnicianOverview data={data} />;
      case 'ACCOUNTANT':
        return <AccountantOverview data={data} />;
      case 'CUSTOMER':
        return <CustomerOverview data={data} />;
      case 'RECEPTIONIST':
      default:
        return <ReceptionistOverview data={data} />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 py-4 sm:py-6 pb-20">
      <OverviewHeader data={data} loading={loading} onRefresh={() => fetchOverview(false)} />
      {renderRoleDashboard()}
    </div>
  );
}
