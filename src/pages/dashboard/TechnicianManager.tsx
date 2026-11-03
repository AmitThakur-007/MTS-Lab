import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  UserCog,
  Users,
  ArrowRightLeft,
  Gauge,
  UserCheck,
  Flame,
  RefreshCw,
  ShieldAlert,
  AlertTriangle,
  Layers,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { useRealtimeSync } from '@/services/realtime';
import { toast } from 'sonner';

import {
  TechnicianSummary,
  TechnicianPerformance,
  EnrichedTransferRequest,
  RepairItem,
  PriorityLevel
} from '@/components/technician-manager/types';
import { TechnicianOverviewTab } from '@/components/technician-manager/TechnicianOverviewTab';
import { TransferRequestsTab } from '@/components/technician-manager/TransferRequestsTab';
import { TechnicianWorkloadTab } from '@/components/technician-manager/TechnicianWorkloadTab';
import { RepairAssignmentsTab } from '@/components/technician-manager/RepairAssignmentsTab';
import { PriorityManagementTab } from '@/components/technician-manager/PriorityManagementTab';

type ManagerTabKey = 'overview' | 'transfers' | 'workload' | 'assignments' | 'priority';

const REALTIME_ENTITIES = ['repair', 'repair_transfer', 'repairLog', 'user', 'notification'];

export default function TechnicianManager() {
  const { user } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Active tab state from URL search params or default to 'overview'
  const currentTab = (searchParams.get('tab') as ManagerTabKey) || 'overview';
  const setActiveTab = (tab: ManagerTabKey) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      return next;
    });
  };

  // RBAC Access Guard: SUPER_ADMIN, ADMIN, MANAGER
  const isAuthorized = useMemo(() => {
    const role = user?.role || '';
    return ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(role);
  }, [user?.role]);

  // Data States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [summary, setSummary] = useState<TechnicianSummary | null>(null);
  const [technicians, setTechnicians] = useState<TechnicianPerformance[]>([]);
  const [transfers, setTransfers] = useState<EnrichedTransferRequest[]>([]);
  const [repairs, setRepairs] = useState<RepairItem[]>([]);

  // Cross-tab interaction state (e.g. Reassign or Priority trigger)
  const [selectedRepairForAssign, setSelectedRepairForAssign] = useState<RepairItem | null>(null);
  const [selectedRepairForPriority, setSelectedRepairForPriority] = useState<RepairItem | null>(null);

  // Fetch Data Function
  const fetchData = useCallback(async (silent = false) => {
    if (!isAuthorized) return;
    try {
      if (!silent) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);

      const [overviewRes, transfersRes, repairsRes] = await Promise.all([
        api.get('/technician-manager/overview').catch((err) => {
          console.error('Failed to load overview:', err);
          return null;
        }),
        api.get('/technician-manager/transfers').catch((err) => {
          console.error('Failed to load transfers:', err);
          return { transfers: [] };
        }),
        api.get('/technician-manager/repairs').catch((err) => {
          console.error('Failed to load repairs:', err);
          return { repairs: [] };
        })
      ]);

      if (overviewRes) {
        setSummary(overviewRes.summary || null);
        setTechnicians(overviewRes.technicians || []);
      }

      setTransfers(transfersRes?.transfers || []);
      setRepairs(repairsRes?.repairs || []);
    } catch (err: any) {
      console.error('TechnicianManager fetchData error:', err);
      setError(err?.message || 'Failed to load technician management data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthorized]);

  // Initial Load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime synchronization callback
  useRealtimeSync(REALTIME_ENTITIES, () => {
    fetchData(true);
  });

  // Action: Respond to Transfer Request (Approve / Reject)
  const handleRespondTransfer = async (
    transferId: string,
    status: 'ACCEPTED' | 'REJECTED',
    responseNote?: string
  ): Promise<boolean> => {
    try {
      const res = await api.post(`/technician-manager/transfers/${transferId}/respond`, {
        status,
        responseNote
      });

      if (res?.success) {
        toast.success(
          status === 'ACCEPTED'
            ? 'Transfer request approved and repair reassigned.'
            : 'Transfer request rejected.'
        );
        await fetchData(true);
        return true;
      }
      toast.error(res?.message || 'Failed to respond to transfer.');
      return false;
    } catch (err: any) {
      toast.error(err?.message || 'Failed to respond to transfer request.');
      return false;
    }
  };

  // Action: Direct Management Transfer
  const handleDirectTransfer = async (data: {
    repairId: string;
    targetTechnicianId: string;
    reason: string;
    priority?: string;
  }): Promise<boolean> => {
    try {
      const res = await api.post('/technician-manager/direct-transfer', data);
      if (res?.success) {
        toast.success('Repair successfully transferred to selected technician.');
        await fetchData(true);
        return true;
      }
      toast.error(res?.message || 'Failed to execute direct transfer.');
      return false;
    } catch (err: any) {
      toast.error(err?.message || 'Failed to execute direct transfer.');
      return false;
    }
  };

  // Action: Assign / Reassign Repair
  const handleAssignSubmit = async (data: {
    repairId: string;
    technicianId: string;
    priority?: string;
    assignmentNotes?: string;
  }): Promise<boolean> => {
    try {
      const res = await api.post('/technician-manager/assign', data);
      if (res?.success) {
        toast.success('Technician assignment updated successfully.');
        await fetchData(true);
        return true;
      }
      toast.error(res?.message || 'Failed to assign repair.');
      return false;
    } catch (err: any) {
      toast.error(err?.message || 'Failed to assign repair.');
      return false;
    }
  };

  // Action: Priority Update
  const handlePrioritySubmit = async (data: {
    repairId: string;
    priority: PriorityLevel;
    reason?: string;
  }): Promise<boolean> => {
    try {
      const res = await api.post('/technician-manager/priority', data);
      if (res?.success) {
        toast.success(`Repair priority updated to ${data.priority}.`);
        await fetchData(true);
        return true;
      }
      toast.error(res?.message || 'Failed to adjust priority.');
      return false;
    } catch (err: any) {
      toast.error(err?.message || 'Failed to adjust priority.');
      return false;
    }
  };

  // Quick Action Navigators
  const handleOpenAssignModal = (repair: RepairItem) => {
    setSelectedRepairForAssign(repair);
    setActiveTab('assignments');
  };

  const handleOpenPriorityModal = (repair: RepairItem) => {
    setSelectedRepairForPriority(repair);
    setActiveTab('priority');
  };

  // Calculate Badges for Tabs
  const pendingTransfersCount = useMemo(() => {
    return transfers.filter((t) => t.status === 'PENDING').length;
  }, [transfers]);

  const unassignedRepairsCount = useMemo(() => {
    return repairs.filter((r) => !r.technicianId).length;
  }, [repairs]);

  const urgentRepairsCount = useMemo(() => {
    return repairs.filter(
      (r) =>
        (r.priority === 'URGENT' || r.priority === 'HIGH') &&
        r.status !== 'COMPLETED' &&
        r.status !== 'CANCELLED'
    ).length;
  }, [repairs]);

  // Authorization Check Guard
  if (!isAuthorized) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Card className="border-destructive/30 bg-destructive/5 text-center p-8">
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Access Restricted</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              The Technician Manager module is restricted to Super Admins, Admins, and Managers. Your current role ({user?.role || 'Guest'}) does not have permission to access this area.
            </p>
            <Button variant="outline" onClick={() => navigate('/dashboard')} className="mt-2">
              Return to Dashboard
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Top Main Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-border/80 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
              <UserCog className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Technician Manager
                <Badge variant="secondary" className="text-xs font-normal">
                  Control Center
                </Badge>
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Centralized technician workloads, repair transfers, active queues, and workorder priority management.
              </p>
            </div>
          </div>
        </div>

        {/* Global Action / Refresh Controls */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData(false)}
            disabled={loading || refreshing}
            className="gap-2 shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing || loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh Data</span>
          </Button>
        </div>
      </div>

      {/* Error Alert if any */}
      {error && (
        <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => fetchData(false)}>
            Retry
          </Button>
        </div>
      )}

      {/* 5 Primary Navigation Tabs */}
      <div className="overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl border border-border w-max min-w-full sm:min-w-0">
          {/* Tab 1: Overview */}
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all ${
              currentTab === 'overview'
                ? 'bg-card text-foreground shadow-sm font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Users className="w-4 h-4 text-primary" />
            <span>Technician Overview</span>
          </button>

          {/* Tab 2: Transfer Requests */}
          <button
            type="button"
            onClick={() => setActiveTab('transfers')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all ${
              currentTab === 'transfers'
                ? 'bg-card text-foreground shadow-sm font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <ArrowRightLeft className="w-4 h-4 text-blue-500" />
            <span>Transfer Requests</span>
            {pendingTransfersCount > 0 && (
              <Badge variant="destructive" className="ml-1 text-[11px] px-1.5 py-0.2 animate-pulse">
                {pendingTransfersCount}
              </Badge>
            )}
          </button>

          {/* Tab 3: Technician Workload */}
          <button
            type="button"
            onClick={() => setActiveTab('workload')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all ${
              currentTab === 'workload'
                ? 'bg-card text-foreground shadow-sm font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Gauge className="w-4 h-4 text-emerald-500" />
            <span>Technician Workload</span>
          </button>

          {/* Tab 4: Repair Assignments */}
          <button
            type="button"
            onClick={() => setActiveTab('assignments')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all ${
              currentTab === 'assignments'
                ? 'bg-card text-foreground shadow-sm font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <UserCheck className="w-4 h-4 text-violet-500" />
            <span>Repair Assignments</span>
            {unassignedRepairsCount > 0 && (
              <Badge variant="outline" className="ml-1 text-[11px] px-1.5 py-0.2 border-amber-500/40 text-amber-500 bg-amber-500/10">
                {unassignedRepairsCount}
              </Badge>
            )}
          </button>

          {/* Tab 5: Priority Management */}
          <button
            type="button"
            onClick={() => setActiveTab('priority')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all ${
              currentTab === 'priority'
                ? 'bg-card text-foreground shadow-sm font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Flame className="w-4 h-4 text-red-500" />
            <span>Priority Management</span>
            {urgentRepairsCount > 0 && (
              <Badge variant="destructive" className="ml-1 text-[11px] px-1.5 py-0.2">
                {urgentRepairsCount}
              </Badge>
            )}
          </button>
        </div>
      </div>

      {/* Tab Panels */}
      <div>
        {currentTab === 'overview' && (
          <TechnicianOverviewTab
            summary={summary}
            technicians={technicians}
            loading={loading}
            onSelectTechnicianQueue={() => setActiveTab('workload')}
            onOpenAssignModal={handleOpenAssignModal}
            onOpenPriorityModal={handleOpenPriorityModal}
            onNavigateToTransfers={() => setActiveTab('transfers')}
            onRefresh={() => fetchData(false)}
          />
        )}

        {currentTab === 'transfers' && (
          <TransferRequestsTab
            transfers={transfers}
            technicians={technicians}
            loading={loading}
            onRefresh={() => fetchData(false)}
          />
        )}

        {currentTab === 'workload' && (
          <TechnicianWorkloadTab
            technicians={technicians}
            loading={loading}
            onRefresh={() => fetchData(false)}
            onOpenAssignModal={handleOpenAssignModal}
            onOpenPriorityModal={handleOpenPriorityModal}
          />
        )}

        {currentTab === 'assignments' && (
          <RepairAssignmentsTab
            repairs={repairs}
            technicians={technicians}
            loading={loading}
            onRefresh={() => fetchData(false)}
            onAssignSubmit={handleAssignSubmit}
            initialSelectedRepair={selectedRepairForAssign}
          />
        )}

        {currentTab === 'priority' && (
          <PriorityManagementTab
            repairs={repairs}
            technicians={technicians}
            loading={loading}
            onRefresh={() => fetchData(false)}
            onPrioritySubmit={handlePrioritySubmit}
            initialSelectedRepair={selectedRepairForPriority}
          />
        )}
      </div>
    </div>
  );
}
