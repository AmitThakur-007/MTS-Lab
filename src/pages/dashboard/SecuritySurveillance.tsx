import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, 
  Users, 
  Laptop, 
  Activity, 
  KeyRound, 
  RefreshCw, 
  Radio, 
  AlertTriangle,
  FileDown,
  Lock,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { useRealtimeSync } from '@/services/realtime';
import DashboardRefreshButton from '@/components/DashboardRefreshButton';

// Subcomponents
import SecurityMetricsSummary from '@/components/security/SecurityMetricsSummary';
import ActiveStaffSurveillance from '@/components/security/ActiveStaffSurveillance';
import DeviceControlRegistry from '@/components/security/DeviceControlRegistry';
import ActivityTimelineSurveillance from '@/components/security/ActivityTimelineSurveillance';
import AccessRequestsManager from '@/components/security/AccessRequestsManager';

export default function SecuritySurveillance() {
  const { user: currentUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'staff' | 'devices' | 'timeline' | 'requests'>('staff');

  // Stats state
  const [stats, setStats] = useState({
    totalStaff: 0,
    activeStaffNow: 0,
    totalDevices: 0,
    blockedDevices: 0,
    securityAlertsCount: 0,
    pendingAccessRequests: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  // Staff state
  const [staff, setStaff] = useState<any[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);

  // Devices state
  const [devices, setDevices] = useState<any[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [selectedDeviceUserFilter, setSelectedDeviceUserFilter] = useState<string | null>(null);

  // Access Requests state
  const [requests, setRequests] = useState<any[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const prevPendingRequests = useRef<number>(0);

  // Timeline selected user
  const [timelineUserId, setTimelineUserId] = useState<string | null>(null);

  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async () => {
    try {
      const res = await api.get('/security/stats');
      if (res && res.success && res.stats) {
        setStats(res.stats);
      }
    } catch (err) {
      console.warn('[SECURITY STATS ERROR]', err);
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchStaff = async (silent = false) => {
    if (!silent) setStaffLoading(true);
    try {
      const res = await api.get('/security/active-staff');
      if (res && res.success) {
        setStaff(res.staff || []);
      }
    } catch (err: any) {
      if (!silent) toast.error('Failed to load active staff surveillance data.');
    } finally {
      if (!silent) setStaffLoading(false);
    }
  };

  const fetchDevices = async (silent = false) => {
    if (!silent) setDevicesLoading(true);
    try {
      const res = await api.get('/security/devices');
      if (res && res.success) {
        setDevices(res.devices || []);
      }
    } catch (err: any) {
      if (!silent) toast.error('Failed to load device control registry.');
    } finally {
      if (!silent) setDevicesLoading(false);
    }
  };

  const fetchRequests = async (silent = false) => {
    if (!silent) setRequestsLoading(true);
    try {
      const res = await api.get('/security/access-requests');
      if (res && res.success) {
        const reqs = res.requests || [];
        const pendingCount = reqs.filter((r: any) => r.status === 'PENDING').length;
        if (silent && prevPendingRequests.current < pendingCount) {
          toast.info('🔔 New Access Request submitted!');
        }
        prevPendingRequests.current = pendingCount;
        setRequests(reqs);
      }
    } catch (err: any) {
      if (!silent) toast.error('Failed to load access requests.');
    } finally {
      if (!silent) setRequestsLoading(false);
    }
  };

  const loadAll = async (silent = false) => {
    await Promise.all([
      fetchStats(),
      fetchStaff(silent),
      fetchDevices(silent),
      fetchRequests(silent),
    ]);
  };

  useEffect(() => {
    loadAll(false);
  }, []);

  // Real-time synchronization
  useRealtimeSync(['user', 'approveddevice', 'auditlog', 'accessrequest', 'session'], () => {
    loadAll(true);
  });

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await loadAll(true);
    setRefreshing(false);
    toast.success('Security & Surveillance data synchronized.');
  };

  const handleInspectUserDevices = (userId: string) => {
    setSelectedDeviceUserFilter(userId);
    setActiveTab('devices');
  };

  const handleSelectUserTimeline = (userId: string) => {
    setTimelineUserId(userId);
    setActiveTab('timeline');
  };

  return (
    <div id="security-surveillance-page" className="p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-600 text-white rounded-lg shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Security &amp; Activity Surveillance Center
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Authoritative staff presence, device restrictions, hardware telemetry, and real-time audit logging.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            id="global-surveillance-refresh-btn"
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="h-9 text-xs bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Syncing...' : 'Sync Live Telemetry'}
          </Button>
        </div>
      </div>

      {/* 5-Metric Command Center Summary Bar */}
      <SecurityMetricsSummary stats={stats} loading={statsLoading} />

      {/* Tabbed Interactive Control Panels */}
      <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="space-y-4">
        <TabsList className="bg-slate-100/80 p-1 rounded-xl h-auto border border-slate-200/70 grid grid-cols-2 md:grid-cols-4 gap-1">
          <TabsTrigger
            id="tab-trigger-staff"
            value="staff"
            className="py-2 px-3 text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-xs rounded-lg flex items-center justify-center gap-2"
          >
            <Users className="w-4 h-4" />
            <span>Active Staff ({staff.filter(s => s.presenceStatus === 'ONLINE').length} Online)</span>
          </TabsTrigger>

          <TabsTrigger
            id="tab-trigger-devices"
            value="devices"
            className="py-2 px-3 text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-xs rounded-lg flex items-center justify-center gap-2"
          >
            <Laptop className="w-4 h-4" />
            <span>Device Control ({devices.length})</span>
          </TabsTrigger>

          <TabsTrigger
            id="tab-trigger-timeline"
            value="timeline"
            className="py-2 px-3 text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-xs rounded-lg flex items-center justify-center gap-2"
          >
            <Activity className="w-4 h-4" />
            <span>Activity Timeline</span>
          </TabsTrigger>

          <TabsTrigger
            id="tab-trigger-requests"
            value="requests"
            className="py-2 px-3 text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-xs rounded-lg flex items-center justify-center gap-2 relative"
          >
            <KeyRound className="w-4 h-4" />
            <span>Access Requests</span>
            {stats.pendingAccessRequests > 0 && (
              <span className="ml-1 bg-amber-500 text-white font-bold text-[10px] px-1.5 py-0.2 rounded-full">
                {stats.pendingAccessRequests}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Active Staff */}
        <TabsContent value="staff" className="space-y-4 m-0 focus-visible:outline-none">
          <ActiveStaffSurveillance
            staff={staff}
            loading={staffLoading}
            onSelectUserForTimeline={handleSelectUserTimeline}
            onInspectDevices={handleInspectUserDevices}
          />
        </TabsContent>

        {/* Tab 2: Devices */}
        <TabsContent value="devices" className="space-y-4 m-0 focus-visible:outline-none">
          <DeviceControlRegistry
            devices={devices}
            loading={devicesLoading}
            onRefresh={() => fetchDevices(false)}
            selectedUserIdFilter={selectedDeviceUserFilter}
            onClearUserFilter={() => setSelectedDeviceUserFilter(null)}
          />
        </TabsContent>

        {/* Tab 3: Timeline */}
        <TabsContent value="timeline" className="space-y-4 m-0 focus-visible:outline-none">
          <ActivityTimelineSurveillance
            initialUserId={timelineUserId}
            staffList={staff}
          />
        </TabsContent>

        {/* Tab 4: Access Requests */}
        <TabsContent value="requests" className="space-y-4 m-0 focus-visible:outline-none">
          <AccessRequestsManager
            requests={requests}
            loading={requestsLoading}
            onRefresh={() => {
              fetchRequests(false);
              fetchStats();
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
