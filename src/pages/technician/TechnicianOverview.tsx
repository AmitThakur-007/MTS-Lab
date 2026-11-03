import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wrench,
  Cpu,
  Clock,
  Flame,
  AlertTriangle,
  Calendar,
  CalendarDays,
  Layers,
  CheckCheck,
  CheckCircle2,
  ArrowRightLeft,
  Eye,
  Loader2,
  ArrowUpRight,
  TrendingUp,
  Package,
  AlertCircle,
  ExternalLink,
  Smartphone,
  Tablet,
  Laptop,
  Tv,
  HelpCircle,
  Zap,
  Check,
  X
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { useRealtimeSync } from '@/services/realtime';
import { formatTimeAgo } from '@/lib/timeUtils';
import { getNepalCalendarInfo } from '@/lib/nepalDate';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import TechnicianHeader from './TechnicianHeader';
import {
  detectDeviceCategory,
  getPriorityMeta,
  STATUS_STYLES,
  TECHNICIAN_ALLOWED_STATUSES,
  DEVICE_CATEGORIES
} from './types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { TechnicianOverviewSkeleton } from './TechnicianSkeletons';

export default function TechnicianOverview() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [repairs, setRepairs] = useState<any[]>([]);
  const [serverStats, setServerStats] = useState<any>(null);
  const [transferRequests, setTransferRequests] = useState<{ incoming: any[]; outgoing: any[]; pendingIncomingCount: number }>({
    incoming: [],
    outgoing: [],
    pendingIncomingCount: 0,
  });
  const [attendanceOverview, setAttendanceOverview] = useState<{
    todayStatus: string | null;
    checkInTime: string | null;
    checkOutTime: string | null;
    totalHoursWorked: string | null;
    monthlyStats: { presentDays: number; absentDays: number; totalDays: number; attendanceRate: number };
    loading: boolean;
  }>({
    todayStatus: null,
    checkInTime: null,
    checkOutTime: null,
    totalHoursWorked: null,
    monthlyStats: { presentDays: 0, absentDays: 0, totalDays: 0, attendanceRate: 100 },
    loading: true,
  });

  const [respondingTransferId, setRespondingTransferId] = useState<string | null>(null);

  // Quick Action Modal states for urgent alerts
  const [selectedRepair, setSelectedRepair] = useState<any | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [updateForm, setUpdateForm] = useState({
    status: '',
    remarks: '',
    partsUsed: '',
    cost: '',
    expectedCompletionDate: '',
  });
  const [submittingUpdate, setSubmittingUpdate] = useState(false);

  // Fetch Dashboard Data
  const fetchOverviewData = useCallback(async (isBackground = false) => {
    if (!user?.id) return;
    try {
      if (!isBackground) setLoading(true);

      const [repairsRes, statsRes, transfersRes] = await Promise.allSettled([
        api.get('/repairs', { params: { assignedToMe: 'true' } }),
        api.get('/repairs/stats'),
        api.get('/repair-transfers/my-requests'),
      ]);

      if (repairsRes.status === 'fulfilled') {
        const raw = repairsRes.value;
        const list = Array.isArray(raw) ? raw : (raw?.repairs || raw?.data || []);
        // Strictly filter to logged-in technician
        const isolated = list.filter((r: any) =>
          (r.technicianId === user.id || r.assignedTechnicianId === user.id) &&
          r.status !== 'CANCELLED'
        );
        setRepairs(isolated);
      }

      if (statsRes.status === 'fulfilled' && statsRes.value) {
        setServerStats(statsRes.value);
      }

      if (transfersRes.status === 'fulfilled' && transfersRes.value) {
        setTransferRequests({
          incoming: transfersRes.value.incoming || [],
          outgoing: transfersRes.value.outgoing || [],
          pendingIncomingCount: transfersRes.value.pendingIncomingCount || 0,
        });
      }
    } catch (err: any) {
      console.error('[TECHNICIAN OVERVIEW FETCH ERROR]', err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [user?.id]);

  // Fetch Attendance Integration
  const fetchMyAttendance = useCallback(async () => {
    try {
      setAttendanceOverview(prev => ({ ...prev, loading: true }));
      const [res, timeRes] = await Promise.allSettled([
        api.get('/attendance/my'),
        api.get('/attendance/server-time'),
      ]);

      if (res.status === 'fulfilled' && res.value) {
        const data = res.value;
        let todayStatus = data.todayRecord?.status || null;
        let checkInTime = data.todayRecord?.checkInTime || null;
        let checkOutTime = data.todayRecord?.checkOutTime || null;
        let totalHours = null;

        if (checkInTime && checkOutTime) {
          const diffMs = new Date(checkOutTime).getTime() - new Date(checkInTime).getTime();
          const hrs = (diffMs / (1000 * 60 * 60)).toFixed(1);
          totalHours = `${hrs} hrs`;
        } else if (checkInTime) {
          const nowTime = timeRes.status === 'fulfilled' && timeRes.value?.serverTimeUtc
            ? new Date(timeRes.value.serverTimeUtc).getTime()
            : Date.now();
          const diffMs = Math.max(0, nowTime - new Date(checkInTime).getTime());
          const hrs = (diffMs / (1000 * 60 * 60)).toFixed(1);
          totalHours = `${hrs} hrs (active)`;
        }

        const present = data.summary?.presentDays || 0;
        const total = data.summary?.workingDaysInMonth || 26;
        const absent = Math.max(0, (data.summary?.absentDays || 0));
        const rate = total > 0 ? Math.round((present / total) * 100) : 100;

        setAttendanceOverview({
          todayStatus,
          checkInTime,
          checkOutTime,
          totalHoursWorked: totalHours,
          monthlyStats: { presentDays: present, absentDays: absent, totalDays: total, attendanceRate: rate },
          loading: false,
        });
      }
    } catch {
      setAttendanceOverview(prev => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    fetchOverviewData();
    fetchMyAttendance();
  }, [fetchOverviewData, fetchMyAttendance]);

  // Real-time synchronization
  useRealtimeSync(['repair', 'repair_log', 'repair_transfer', 'attendance'], () => {
    fetchOverviewData(true);
    fetchMyAttendance();
  });

  // Calculate High-level Dashboard Metrics
  const metrics = useMemo(() => {
    const activeList = repairs.filter(r =>
      !['REPAIRED', 'READY_FOR_PICKUP', 'DELIVERED', 'CANNOT_REPAIR', 'CANCELLED'].includes(r.status)
    );

    const pendingCount = repairs.filter(r => r.status === 'PENDING').length;
    const inProgressCount = repairs.filter(r => ['IN_PROCESS', 'IN_PROGRESS', 'DIAGNOSING'].includes(r.status)).length;
    const waitingForPartsCount = repairs.filter(r => r.status === 'WAITING_FOR_PARTS').length;
    const testingCount = repairs.filter(r => r.status === 'TESTING').length;
    const repairedLifetime = serverStats?.userAssigned?.completedTotal ?? repairs.filter(r => ['REPAIRED', 'READY_FOR_PICKUP', 'DELIVERED', 'REPROBLEM_FIXED'].includes(r.status)).length;
    const completedToday = serverStats?.userAssigned?.completedToday ?? 0;
    const completedThisWeek = serverStats?.userAssigned?.completedThisWeek ?? 0;
    const completedThisMonth = serverStats?.userAssigned?.completedThisMonth ?? 0;

    const overdueRepairs = activeList.filter(r => {
      if (!r.expectedCompletionDate) return false;
      return new Date(r.expectedCompletionDate).getTime() < Date.now();
    });

    const urgentRepairs = activeList.filter(r => {
      const tier = getPriorityMeta(r).tier;
      return tier === 'URGENT' || tier === 'HIGH';
    });

    // Category breakdown
    const categoryCounts: Record<string, number> = {
      IPHONE: 0,
      SMARTPHONE: 0,
      IPAD: 0,
      TABLET: 0,
      LAPTOP: 0,
      TV: 0,
    };

    activeList.forEach(r => {
      const cat = detectDeviceCategory(r);
      if (categoryCounts[cat] !== undefined) {
        categoryCounts[cat]++;
      }
    });

    return {
      totalActive: activeList.length,
      pendingCount,
      inProgressCount,
      waitingForPartsCount,
      testingCount,
      repairedLifetime,
      completedToday,
      completedThisWeek,
      completedThisMonth,
      overdueCount: overdueRepairs.length,
      overdueRepairs,
      urgentRepairs,
      categoryCounts,
      pendingTransfers: transferRequests.pendingIncomingCount,
    };
  }, [repairs, serverStats, transferRequests]);

  // Handle Transfer Responses
  const handleRespondTransfer = async (transferId: string, action: 'ACCEPT' | 'REJECT') => {
    setRespondingTransferId(transferId);
    try {
      await api.post(`/repair-transfers/${transferId}/respond`, { action });
      toast.success(action === 'ACCEPT' ? 'Transfer accepted into your bench.' : 'Transfer declined.');
      fetchOverviewData(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Failed to respond to transfer.');
    } finally {
      setRespondingTransferId(null);
    }
  };

  // Open Update Modal
  const handleOpenUpdateModal = (repair: any) => {
    setSelectedRepair(repair);
    setUpdateForm({
      status: repair.status || 'IN_PROCESS',
      remarks: repair.remarks || '',
      partsUsed: repair.partsUsed || '',
      cost: repair.cost ? String(repair.cost) : '',
      expectedCompletionDate: repair.expectedCompletionDate
        ? new Date(repair.expectedCompletionDate).toISOString().split('T')[0]
        : '',
    });
    setIsUpdateModalOpen(true);
  };

  // Submit Update
  const submitStatusUpdate = async () => {
    if (!selectedRepair || submittingUpdate) return;
    setSubmittingUpdate(true);
    try {
      await api.put(`/repairs/${selectedRepair.id}`, {
        status: updateForm.status,
        remarks: updateForm.remarks,
        partsUsed: updateForm.partsUsed,
        cost: updateForm.cost ? parseFloat(updateForm.cost) : undefined,
        expectedCompletionDate: updateForm.expectedCompletionDate || undefined,
      });
      toast.success(`Repair #${selectedRepair.repairNumber} updated successfully.`);
      setIsUpdateModalOpen(false);
      fetchOverviewData(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Failed to update repair.');
    } finally {
      setSubmittingUpdate(false);
    }
  };

  if (loading && repairs.length === 0) {
    return <TechnicianOverviewSkeleton />;
  }

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto px-2 sm:px-4">
      {/* 1. Header with dynamic greeting, NPT live clock, Bench Active badge */}
      <TechnicianHeader
        title="Technician Dashboard Overview"
        subtitle="High-level operational metrics, performance summary, and urgent triage queue."
        onRefresh={() => fetchOverviewData(true)}
        isRefreshing={loading}
        actions={
          <Button
            onClick={() => navigate('/technician/repairs')}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 px-3.5 shadow-sm cursor-pointer"
          >
            <Wrench className="h-3.5 w-3.5 mr-1.5" />
            <span>Repairs Bench</span>
            <ArrowRightLeft className="h-3.5 w-3.5 ml-1.5 opacity-60" />
          </Button>
        }
      />

      {/* 2. 6-Card Dashboard Metric Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        {/* Total Active Repairs */}
        <div
          onClick={() => navigate('/technician/repairs?tab=ACTIVE')}
          className="p-4 rounded-2xl border text-left flex flex-col justify-between gap-3 shadow-sm bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-200/80 dark:border-indigo-800/50 hover:border-indigo-400 dark:hover:border-indigo-600 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 dark:bg-indigo-500 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              <Wrench className="h-4 w-4" />
            </div>
            <Badge variant="outline" className="text-[10px] font-bold bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-700">
              Active Bench
            </Badge>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              {metrics.totalActive}
            </div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Active Repairs</div>
          </div>
        </div>

        {/* Pending Repairs */}
        <div
          onClick={() => navigate('/technician/repairs?tab=PENDING')}
          className="p-4 rounded-2xl border text-left flex flex-col justify-between gap-3 shadow-sm bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-slate-700 dark:bg-slate-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              <Clock className="h-4 w-4" />
            </div>
            <Badge variant="outline" className="text-[10px] font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700">
              Unstarted
            </Badge>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              {metrics.pendingCount}
            </div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Pending Repairs</div>
          </div>
        </div>

        {/* In Progress */}
        <div
          onClick={() => navigate('/technician/repairs?tab=IN_PROCESS')}
          className="p-4 rounded-2xl border text-left flex flex-col justify-between gap-3 shadow-sm bg-blue-50/50 dark:bg-blue-950/30 border-blue-200/80 dark:border-blue-800/50 hover:border-blue-400 dark:hover:border-blue-600 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              <Cpu className="h-4 w-4" />
            </div>
            <Badge variant="outline" className="text-[10px] font-bold bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700">
              Bench Active
            </Badge>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              {metrics.inProgressCount + metrics.testingCount}
            </div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">In Progress / QA</div>
          </div>
        </div>

        {/* Completed Repairs */}
        <div
          onClick={() => navigate('/technician/repairs?tab=REPAIRED')}
          className="p-4 rounded-2xl border text-left flex flex-col justify-between gap-3 shadow-sm bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-200/80 dark:border-emerald-800/50 hover:border-emerald-400 dark:hover:border-emerald-600 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 dark:bg-emerald-500 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              <CheckCheck className="h-4 w-4" />
            </div>
            <Badge variant="outline" className="text-[10px] font-bold bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700">
              {metrics.completedToday} Today
            </Badge>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              {metrics.repairedLifetime}
            </div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Completed Work</div>
          </div>
        </div>

        {/* Waiting for Parts */}
        <div
          onClick={() => navigate('/technician/repairs?tab=WAITING_FOR_PARTS')}
          className="p-4 rounded-2xl border text-left flex flex-col justify-between gap-3 shadow-sm bg-amber-50/50 dark:bg-amber-950/30 border-amber-200/80 dark:border-amber-800/50 hover:border-amber-400 dark:hover:border-amber-600 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-amber-600 dark:bg-amber-500 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              <Package className="h-4 w-4" />
            </div>
            <Badge variant="outline" className="text-[10px] font-bold bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700">
              Stock Wait
            </Badge>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              {metrics.waitingForPartsCount}
            </div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Waiting for Parts</div>
          </div>
        </div>

        {/* Pending Transfers */}
        <div
          onClick={() => navigate('/technician/transfers')}
          className={cn(
            "p-4 rounded-2xl border text-left flex flex-col justify-between gap-3 shadow-sm transition-all cursor-pointer group",
            metrics.pendingTransfers > 0
              ? "bg-rose-50/60 dark:bg-rose-950/40 border-rose-300 dark:border-rose-700 ring-2 ring-rose-400/20"
              : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-400"
          )}
        >
          <div className="flex items-center justify-between">
            <div className={cn(
              "w-9 h-9 rounded-xl text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform",
              metrics.pendingTransfers > 0 ? "bg-rose-600" : "bg-slate-600"
            )}>
              <ArrowRightLeft className="h-4 w-4" />
            </div>
            <Badge variant="outline" className={cn(
              "text-[10px] font-bold border",
              metrics.pendingTransfers > 0
                ? "bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-700 animate-pulse"
                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
            )}>
              {metrics.pendingTransfers > 0 ? 'Action Req' : 'Handoffs'}
            </Badge>
          </div>
          <div>
            <div className={cn(
              "text-2xl sm:text-3xl font-black",
              metrics.pendingTransfers > 0 ? "text-rose-700 dark:text-rose-400" : "text-slate-900 dark:text-white"
            )}>
              {metrics.pendingTransfers}
            </div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Pending Transfers</div>
          </div>
        </div>
      </div>

      {/* 3. Urgent Alerts & Priority Action Queue */}
      {(metrics.urgentRepairs.length > 0 || metrics.overdueCount > 0 || metrics.pendingTransfers > 0) && (
        <Card className="rounded-3xl border border-rose-200/80 dark:border-rose-900/50 bg-rose-50/30 dark:bg-rose-950/20 shadow-sm overflow-hidden">
          <CardHeader className="p-5 sm:p-6 pb-3 border-b border-rose-100 dark:border-rose-900/40 flex flex-row items-center justify-between gap-3 space-y-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-xs">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base sm:text-lg font-black text-rose-950 dark:text-rose-200 flex items-center gap-2">
                  <span>Urgent Action Required</span>
                  <Badge className="bg-rose-600 text-white font-extrabold text-[10px] px-2 py-0.5 rounded-full">
                    {metrics.urgentRepairs.length + metrics.overdueCount + metrics.pendingTransfers} Items
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs text-rose-700 dark:text-rose-400 font-medium">
                  High-priority tickets, delayed target deliveries, or incoming handoffs awaiting your response.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-5 sm:p-6 space-y-4">
            {/* Incoming Transfers Banner */}
            {transferRequests.incoming.filter(t => t.status === 'PENDING').length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-rose-900 dark:text-rose-300">
                  Transfer Handoffs Awaiting Decision:
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {transferRequests.incoming.filter(t => t.status === 'PENDING').map(t => (
                    <div
                      key={t.id}
                      className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 shadow-sm flex flex-col justify-between gap-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-bold text-xs bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-2.5 py-0.5 rounded-md">
                          #{t.repairNumber}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          From: <strong className="text-slate-800 dark:text-slate-200">{t.senderTechnicianName || 'Technician'}</strong>
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 p-2 rounded-xl">
                        <strong>Reason:</strong> {t.reason}
                      </p>
                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          size="sm"
                          disabled={respondingTransferId === t.id}
                          onClick={() => handleRespondTransfer(t.id, 'ACCEPT')}
                          className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8 cursor-pointer"
                        >
                          {respondingTransferId === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                          Accept Job
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={respondingTransferId === t.id}
                          onClick={() => handleRespondTransfer(t.id, 'REJECT')}
                          className="flex-1 rounded-xl border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-950 font-bold text-xs h-8 cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5 mr-1" />
                          Decline
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Urgent & Overdue Repairs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {metrics.urgentRepairs.slice(0, 6).map((repair) => {
                const priorityMeta = getPriorityMeta(repair);
                const isOverdue = repair.expectedCompletionDate && new Date(repair.expectedCompletionDate).getTime() < Date.now();
                const category = detectDeviceCategory(repair);
                const statusInfo = STATUS_STYLES[repair.status] || {
                  label: repair.status?.replace(/_/g, ' ') || 'Assigned',
                  badge: 'bg-slate-100 text-slate-800 border-slate-300',
                };

                return (
                  <div
                    key={repair.id}
                    className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between gap-3 min-w-0"
                  >
                    <div className="space-y-2 min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                          <span className="font-mono font-bold text-xs bg-slate-950 dark:bg-white text-white dark:text-slate-950 px-2.5 py-0.5 rounded-lg shrink-0">
                            #{repair.repairNumber}
                          </span>
                          <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 rounded-md border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 shrink-0">
                            {category}
                          </Badge>
                          <Badge className={cn("text-[10px] font-bold px-2.5 py-0.5 rounded-full shrink-0", priorityMeta.badgeClass)}>
                            {priorityMeta.label}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                          {isOverdue && (
                            <Badge className="bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 font-bold text-[10px] px-2 py-0.5 rounded-full shrink-0">
                              Overdue
                            </Badge>
                          )}
                          <Badge className={cn("text-[10px] font-bold px-3 py-1 rounded-full border whitespace-nowrap inline-flex items-center shrink-0 shadow-2xs", statusInfo.badge)}>
                            {statusInfo.label}
                          </Badge>
                        </div>
                      </div>

                      <div className="font-black text-xs text-slate-900 dark:text-white truncate" title={`${repair.deviceBrand} ${repair.deviceModel}`}>
                        {repair.deviceBrand} {repair.deviceModel}
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 break-words" title={repair.problemDescription}>
                        {repair.problemDescription || 'Inspection & diagnosis'}
                      </p>

                      {repair.expectedCompletionDate && (
                        <div className="text-[11px] font-mono font-semibold text-slate-500 dark:text-slate-400">
                          Due: {format(new Date(repair.expectedCompletionDate), 'dd MMM yyyy')}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <Button
                        size="sm"
                        onClick={() => handleOpenUpdateModal(repair)}
                        className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-8 cursor-pointer"
                      >
                        Update
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate(`/dashboard/repairs/${repair.id}`)}
                        className="rounded-xl h-8 px-2 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                        title="View Full Ticket"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 4. Performance Analytics & Integrated Attendance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* A. Performance Analytics Summary (2 columns) */}
        <Card className="lg:col-span-2 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          <CardHeader className="p-5 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800/80 flex flex-row items-center justify-between gap-3 space-y-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                <TrendingUp className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  Technician Performance Analytics
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                  Authoritative completed work count calculated using Asia/Kathmandu (NPT) time intervals.
                </CardDescription>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/technician/repairs?tab=REPAIRED')}
              className="rounded-xl border-slate-200 dark:border-slate-700 text-xs font-bold text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950 h-8 px-2.5 cursor-pointer"
            >
              <span>View Completed</span>
              <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </CardHeader>

          <CardContent className="p-5 sm:p-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="p-4 rounded-2xl bg-teal-50/50 dark:bg-teal-950/30 border border-teal-200/80 dark:border-teal-800/50">
                <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-300 block">Today (NPT)</span>
                <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white block mt-1">
                  {metrics.completedToday}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">Repaired today</span>
              </div>

              <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800/50">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300 block">This Week</span>
                <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white block mt-1">
                  {metrics.completedThisWeek}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">Monday to today</span>
              </div>

              <div className="p-4 rounded-2xl bg-cyan-50/50 dark:bg-cyan-950/30 border border-cyan-200/80 dark:border-cyan-800/50">
                <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-300 block">This Month</span>
                <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white block mt-1">
                  {metrics.completedThisMonth}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">Calendar month</span>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 block">Lifetime Total</span>
                <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white block mt-1">
                  {metrics.repairedLifetime}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">Total jobs delivered</span>
              </div>
            </div>

            {/* Category Distribution Bar */}
            <div className="mt-5 pt-5 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Active Workload by Device Category
                </h4>
                <span className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400">
                  {metrics.totalActive} Active Devices
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {DEVICE_CATEGORIES.filter(c => c.key !== 'ALL').map(cat => {
                  const count = metrics.categoryCounts[cat.key] || 0;
                  const Icon = cat.icon;
                  return (
                    <div
                      key={cat.key}
                      onClick={() => navigate(`/technician/repairs?category=${cat.key}`)}
                      className="p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-1 bg-slate-50/50 dark:bg-slate-800/40"
                    >
                      <Icon className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                      <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate w-full">{cat.label}</span>
                      <span className="font-black text-sm text-slate-900 dark:text-white">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* B. Integrated Attendance Overview Card */}
        <Card className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden flex flex-col justify-between">
          <CardHeader className="p-5 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800/80 flex flex-row items-center justify-between gap-3 space-y-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Calendar className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base font-black text-slate-900 dark:text-white">
                  Attendance Overview
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                  Today's bench check-in & hours
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-5 sm:p-6 space-y-4 flex-1 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Today's Status</span>
                <Badge className={cn(
                  "font-bold text-xs px-2.5 py-0.5 rounded-full",
                  attendanceOverview.todayStatus === 'PRESENT' ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" :
                  attendanceOverview.todayStatus === 'HALF_DAY' ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" :
                  "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                )}>
                  {attendanceOverview.todayStatus || 'NOT CHECKED IN'}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Check In</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {attendanceOverview.checkInTime ? format(new Date(attendanceOverview.checkInTime), 'hh:mm a') : '—'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Working Hours</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {attendanceOverview.totalHoursWorked || '0 hrs'}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/40 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 block">Monthly Rate</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {attendanceOverview.monthlyStats.presentDays} of {attendanceOverview.monthlyStats.totalDays} days
                  </span>
                </div>
                <span className="text-xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
                  {attendanceOverview.monthlyStats.attendanceRate}%
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/dashboard/attendance')}
              className="w-full rounded-xl border-slate-200 dark:border-slate-700 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-800 h-9 cursor-pointer mt-2"
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              <span>Open Attendance Hub</span>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Update Repair Modal */}
      <Dialog open={isUpdateModalOpen} onOpenChange={setIsUpdateModalOpen}>
        <DialogContent className="max-w-md w-full rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white space-y-4">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold text-slate-900 dark:text-white">
              Update Repair #{selectedRepair?.repairNumber}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
              Update status, remarks, and parts used for this device.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 pt-1">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Status</Label>
              <Select value={updateForm.status} onValueChange={(val) => setUpdateForm(prev => ({ ...prev, status: val }))}>
                <SelectTrigger className="h-10 rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-2xl dark:bg-slate-900 dark:border-slate-800">
                  {TECHNICIAN_ALLOWED_STATUSES.map(s => (
                    <SelectItem key={s.value} value={s.value} className="text-xs font-bold py-2">
                      <div className="flex flex-col">
                        <span>{s.label}</span>
                        <span className="text-[10px] text-slate-400 font-normal">{s.desc}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Target Completion Date</Label>
              <Input
                type="date"
                value={updateForm.expectedCompletionDate}
                onChange={e => setUpdateForm(prev => ({ ...prev, expectedCompletionDate: e.target.value }))}
                className="h-10 rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Spare Parts Used</Label>
              <Input
                placeholder="e.g. OLED Display Assembly, Charging Port Flex"
                value={updateForm.partsUsed}
                onChange={e => setUpdateForm(prev => ({ ...prev, partsUsed: e.target.value }))}
                className="h-10 rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Technician Remarks</Label>
              <Textarea
                placeholder="Diagnostic findings, rework details..."
                value={updateForm.remarks}
                onChange={e => setUpdateForm(prev => ({ ...prev, remarks: e.target.value }))}
                className="rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs min-h-[70px]"
              />
            </div>
          </div>

          <DialogFooter className="flex items-center gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsUpdateModalOpen(false)}
              className="rounded-xl border-slate-200 dark:border-slate-700 text-xs font-bold h-9"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={submittingUpdate}
              onClick={submitStatusUpdate}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold h-9"
            >
              {submittingUpdate ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
