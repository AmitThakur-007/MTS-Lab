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
import { useDashboardSidebar } from '@/context/SidebarContext';
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
  const { isCollapsed } = useDashboardSidebar();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Container width sensing for responsive layout when desktop sidebar expands/collapses
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(1200);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      if (el) {
        setContainerWidth(el.getBoundingClientRect().width);
      }
    };

    measure();

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });

    observer.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [isCollapsed]);

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
    <div ref={containerRef} className="@container w-full max-w-full min-w-0 space-y-6 pb-12 overflow-x-hidden">
      {/* Top Main Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/80 pb-4 min-w-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shrink-0 mt-0.5 sm:mt-0">
              <UserCog className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">
                  Technician Manager
                </h1>
                <Badge variant="secondary" className="text-xs font-normal shrink-0">
                  Control Center
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 line-clamp-2 sm:line-clamp-1">
                Centralized technician workloads, repair transfers, active queues, and workorder priority management.
              </p>
            </div>
          </div>
        </div>

        {/* Global Action / Refresh Controls */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData(false)}
            disabled={loading || refreshing}
            className="gap-2 shrink-0 w-full sm:w-auto h-9"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing || loading ? 'animate-spin' : ''}`} />
            <span>Refresh Data</span>
          </Button>
        </div>
      </div>

      {/* Error Alert if any */}
      {error && (
        <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="truncate">{error}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => fetchData(false)} className="shrink-0">
            Retry
          </Button>
        </div>
      )}

      {/* 5 Primary Navigation Tabs with Horizontal Scroll & Touch Friendly Layout */}
      <div className="overflow-x-auto no-scrollbar scroll-smooth w-full min-w-0 pb-1 -mx-1 px-1">
        <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl border border-border w-max min-w-full sm:min-w-0">
          {/* Tab 1: Overview */}
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-3 sm:px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all shrink-0 cursor-pointer min-h-[38px] ${
              currentTab === 'overview'
                ? 'bg-card text-foreground shadow-sm font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Users className="w-4 h-4 text-primary shrink-0" />
            <span className="whitespace-nowrap">Technician Overview</span>
          </button>

          {/* Tab 2: Transfer Requests */}
          <button
            type="button"
            onClick={() => setActiveTab('transfers')}
            className={`flex items-center gap-2 px-3 sm:px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all shrink-0 cursor-pointer min-h-[38px] ${
              currentTab === 'transfers'
                ? 'bg-card text-foreground shadow-sm font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <ArrowRightLeft className="w-4 h-4 text-blue-500 shrink-0" />
            <span className="whitespace-nowrap">Transfer Requests</span>
            {pendingTransfersCount > 0 && (
              <Badge variant="destructive" className="ml-1 text-[11px] px-1.5 py-0.2 shrink-0 animate-pulse">
                {pendingTransfersCount}
              </Badge>
            )}
          </button>

          {/* Tab 3: Technician Workload */}
          <button
            type="button"
            onClick={() => setActiveTab('workload')}
            className={`flex items-center gap-2 px-3 sm:px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all shrink-0 cursor-pointer min-h-[38px] ${
              currentTab === 'workload'
                ? 'bg-card text-foreground shadow-sm font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Gauge className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="whitespace-nowrap">Technician Workload</span>
          </button>

          {/* Tab 4: Repair Assignments */}
          <button
            type="button"
            onClick={() => setActiveTab('assignments')}
            className={`flex items-center gap-2 px-3 sm:px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all shrink-0 cursor-pointer min-h-[38px] ${
              currentTab === 'assignments'
                ? 'bg-card text-foreground shadow-sm font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <UserCheck className="w-4 h-4 text-violet-500 shrink-0" />
            <span className="whitespace-nowrap">Repair Assignments</span>
            {unassignedRepairsCount > 0 && (
              <Badge variant="outline" className="ml-1 text-[11px] px-1.5 py-0.2 shrink-0 border-amber-500/40 text-amber-500 bg-amber-500/10">
                {unassignedRepairsCount}
              </Badge>
            )}
          </button>

          {/* Tab 5: Priority Management */}
          <button
            type="button"
            onClick={() => setActiveTab('priority')}
            className={`flex items-center gap-2 px-3 sm:px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all shrink-0 cursor-pointer min-h-[38px] ${
              currentTab === 'priority'
                ? 'bg-card text-foreground shadow-sm font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Flame className="w-4 h-4 text-red-500 shrink-0" />
            <span className="whitespace-nowrap">Priority Management</span>
            {urgentRepairsCount > 0 && (
              <Badge variant="destructive" className="ml-1 text-[11px] px-1.5 py-0.2 shrink-0">
                {urgentRepairsCount}
              </Badge>
            )}
          </button>
        </div>
      </div>

      {/* Tab Panels */}
      <div className="w-full min-w-0">
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
            containerWidth={containerWidth}
          />
        )}

        {currentTab === 'transfers' && (
          <TransferRequestsTab
            transfers={transfers}
            technicians={technicians}
            loading={loading}
            onRefresh={() => fetchData(false)}
            containerWidth={containerWidth}
          />
        )}

        {currentTab === 'workload' && (
          <TechnicianWorkloadTab
            technicians={technicians}
            loading={loading}
            onRefresh={() => fetchData(false)}
            onOpenAssignModal={handleOpenAssignModal}
            onOpenPriorityModal={handleOpenPriorityModal}
            containerWidth={containerWidth}
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
            containerWidth={containerWidth}
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
            containerWidth={containerWidth}
          />
        )}
      </div>
    </div>
  );
}
