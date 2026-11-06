import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Smartphone,
  MessageSquare,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  Copy,
  Check,
  X,
  RefreshCw,
  ExternalLink,
  XCircle,
  Filter,
  User,
  Phone,
  ShieldCheck,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Layers,
  ChevronRight,
  ChevronLeft,
  Calendar,
  Eye,
  CheckSquare,
  Tag,
  Loader2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { validateAndFormatNepalPhone } from '@/lib/nepalPhone';
import {
  analyzeSmsEncoding,
  generateRepairedDeviceSmsMessage,
  generateReceivedDeviceSmsMessage,
} from '@/lib/smsEncoding';
import { toNepalDateString } from '@/lib/nepalDate';
import { cn } from '@/lib/utils';
import SendSmsModal from '@/components/repair/SendSmsModal';
import { useRealtimeSync } from '@/services/realtime';
import { useDashboardCache } from '@/store/dashboardCache';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { SmsKpiCardsSkeleton, TableSkeleton } from '@/components/common/SkeletonLoaders';

export interface SmsStatsState {
  totalSmsSent: number;
  smsChannelTotal: number;
  staffConfirmedSms: number;
  carrierConfirmedDelivered: number;
  failedSms: number;
  pendingSms: number;
  notSentSms: number;
  whatsappSent: number;
  whatsappPending: number;
  whatsappFailed: number;
  whatsappDelivered: number;
  whatsappRead: number;
  totalNotifications: number;
  uniqueCustomersNotified: number;
  uniqueCustomersNotNotified: number;
}

export type SmsMetricType =
  | 'TOTAL_SMS_SENT'
  | 'SMS_CHANNEL_TOTAL'
  | 'STAFF_CONFIRMED'
  | 'CARRIER_DELIVERED'
  | 'FAILED_SMS'
  | 'PENDING_DRAFT'
  | 'WHATSAPP_SENT';

export default function SmsCenter() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const userRole = (user?.role || '').toUpperCase().trim();
  const isAuthorized = ['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST', 'MANAGER'].includes(userRole);
  const isReadOnly = userRole === 'MANAGER';

  // Sequence refs to prevent race conditions during rapid preset toggling
  const repairedSeqRef = useRef<number>(0);
  const receivedSeqRef = useRef<number>(0);

  // Active Category Tab: 'REPAIRED' | 'RECEIVED' | 'CONFIRMATION' | 'HISTORY'
  const [activeTab, setActiveTab] = useState<'REPAIRED' | 'RECEIVED' | 'CONFIRMATION' | 'HISTORY'>('REPAIRED');

  // Cached state access
  const cachedSmsCenter = useDashboardCache.getState().smsCenter;

  // Global Date Filter State (NPT) - synchronized across KPI cards and tables
  const [globalPreset, setGlobalPreset] = useState<string>('TODAY');
  const [globalCustomStart, setGlobalCustomStart] = useState<string>('');
  const [globalCustomEnd, setGlobalCustomEnd] = useState<string>('');

  // Pending Confirmations State
  const [pendingConfirmationsList, setPendingConfirmationsList] = useState<any[]>([]);
  const [pendingConfirmationsLoading, setPendingConfirmationsLoading] = useState<boolean>(false);

  // Stats - prehydrated from cache if present; null indicates initial loading to prevent false 0s
  const [stats, setStats] = useState<SmsStatsState | null>(() => cachedSmsCenter.stats || null);
  const [statsLoading, setStatsLoading] = useState<boolean>(() => !cachedSmsCenter.stats);
  const [statsError, setStatsError] = useState<string | null>(null);

  // Clickable Metric Card Modal State
  const [selectedMetric, setSelectedMetric] = useState<SmsMetricType | null>(null);
  const [isMetricModalOpen, setIsMetricModalOpen] = useState<boolean>(false);
  const [activeMetricTitle, setActiveMetricTitle] = useState<string>('');
  const [activeMetricSubtitle, setActiveMetricSubtitle] = useState<string>('');
  const [metricRecords, setMetricRecords] = useState<any[]>([]);
  const [metricRecordsTotal, setMetricRecordsTotal] = useState<number>(0);
  const [metricRecordsPage, setMetricRecordsPage] = useState<number>(1);
  const [metricRecordsLoading, setMetricRecordsLoading] = useState<boolean>(false);
  const [metricSearch, setMetricSearch] = useState<string>('');

  // Repaired Devices State - prehydrated from cache if present
  const [repairedPreset, setRepairedPreset] = useState<string>('TODAY');
  const [repairedCustomStart, setRepairedCustomStart] = useState<string>('');
  const [repairedCustomEnd, setRepairedCustomEnd] = useState<string>('');
  const [repairedSearch, setRepairedSearch] = useState<string>('');
  const [repairedPage, setRepairedPage] = useState<number>(1);
  const [repairedTotal, setRepairedTotal] = useState<number>(() => cachedSmsCenter.repairedTotal || 0);
  const [repairedTotalPages, setRepairedTotalPages] = useState<number>(1);
  const [repairedList, setRepairedList] = useState<any[]>(() => cachedSmsCenter.repairedList || []);
  const [repairedLoading, setRepairedLoading] = useState<boolean>(false);
  const [repairedError, setRepairedError] = useState<string | null>(null);

  // Received Devices State - prehydrated from cache if present
  const [receivedPreset, setReceivedPreset] = useState<string>('TODAY');
  const [receivedCustomStart, setReceivedCustomStart] = useState<string>('');
  const [receivedCustomEnd, setReceivedCustomEnd] = useState<string>('');
  const [receivedSearch, setReceivedSearch] = useState<string>('');
  const [receivedPage, setReceivedPage] = useState<number>(1);
  const [receivedTotal, setReceivedTotal] = useState<number>(() => cachedSmsCenter.receivedTotal || 0);
  const [receivedTotalPages, setReceivedTotalPages] = useState<number>(1);
  const [receivedList, setReceivedList] = useState<any[]>(() => cachedSmsCenter.receivedList || []);
  const [receivedLoading, setReceivedLoading] = useState<boolean>(false);
  const [receivedError, setReceivedError] = useState<string | null>(null);

  // Notification History Table State
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('ALL');
  const [historyChannelFilter, setHistoryChannelFilter] = useState('ALL');

  // Modal State for Preview & Send
  const [modalRepair, setModalRepair] = useState<any | null>(null);
  const [modalNotificationType, setModalNotificationType] = useState<'REPAIR_COMPLETED' | 'DEVICE_RECEIVED'>('REPAIR_COMPLETED');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Load summary stats with date filtering and graceful error handling
  const fetchStats = useCallback(async (
    preset = globalPreset,
    customStart = globalCustomStart,
    customEnd = globalCustomEnd
  ) => {
    try {
      setStatsLoading(true);
      setStatsError(null);
      const params: any = { filterPreset: preset };
      if (preset === 'CUSTOM') {
        if (customStart) params.startDate = customStart;
        if (customEnd) params.endDate = customEnd;
      }
      const queryStr = new URLSearchParams(params).toString();
      const res = await api.get(`/sms/stats?${queryStr}`);
      if (res && res.success) {
        const newStats: SmsStatsState = {
          totalSmsSent: res.totalSmsSent || 0,
          smsChannelTotal: res.smsChannelTotal !== undefined ? res.smsChannelTotal : (res.totalSms || 0),
          staffConfirmedSms: res.staffConfirmedSms || 0,
          carrierConfirmedDelivered: res.carrierConfirmedDelivered || 0,
          failedSms: res.failedSms || 0,
          pendingSms: res.pendingSms || 0,
          whatsappSent: res.whatsappSent || 0,
          notSentSms: res.notSentSms || 0,
          whatsappPending: res.whatsappPending || 0,
          whatsappFailed: res.whatsappFailed || 0,
          whatsappDelivered: res.whatsappDelivered || 0,
          whatsappRead: res.whatsappRead || 0,
          totalNotifications: res.totalNotifications || 0,
          uniqueCustomersNotified: res.uniqueCustomersNotified || 0,
          uniqueCustomersNotNotified: res.uniqueCustomersNotNotified || 0,
        };
        setStats(newStats);
        useDashboardCache.getState().setSmsCenter({ stats: newStats }, user?.id);
      }
    } catch (err: any) {
      console.warn('[FETCH SMS STATS WARN]', err);
      setStatsError(err?.message || 'Failed to retrieve SMS statistics.');
    } finally {
      setStatsLoading(false);
    }
  }, [globalPreset, globalCustomStart, globalCustomEnd, user?.id]);

  // Fetch filtered records corresponding to the clicked KPI card
  const fetchMetricRecords = useCallback(async (
    metric: SmsMetricType,
    preset = globalPreset,
    search = metricSearch,
    page = metricRecordsPage
  ) => {
    try {
      setMetricRecordsLoading(true);
      const params: any = {
        metric,
        filterPreset: preset,
        limit: 15,
        offset: (page - 1) * 15,
      };
      if (preset === 'CUSTOM') {
        if (globalCustomStart) params.startDate = globalCustomStart;
        if (globalCustomEnd) params.endDate = globalCustomEnd;
      }
      if (search.trim()) {
        params.search = search.trim();
      }
      const queryStr = new URLSearchParams(params).toString();
      const res = await api.get(`/sms/notifications?${queryStr}`);
      if (res && res.success) {
        setMetricRecords(res.items || []);
        setMetricRecordsTotal(res.total || 0);
        setMetricRecordsPage(page);
      }
    } catch (err: any) {
      console.warn('[FETCH METRIC RECORDS WARN]', err);
      toast.error('Failed to load metric records.');
    } finally {
      setMetricRecordsLoading(false);
    }
  }, [globalPreset, globalCustomStart, globalCustomEnd, metricSearch, metricRecordsPage]);

  // Open interactive modal for a clicked KPI card
  const handleCardClick = (metric: SmsMetricType, title: string, subtitle: string) => {
    setSelectedMetric(metric);
    setActiveMetricTitle(title);
    setActiveMetricSubtitle(subtitle);
    setMetricRecordsPage(1);
    setMetricSearch('');
    setIsMetricModalOpen(true);
    fetchMetricRecords(metric, globalPreset, '', 1);
  };

  // Load Repaired Devices
  const fetchRepairedDevices = useCallback(async () => {
    const seq = ++repairedSeqRef.current;
    try {
      setRepairedLoading(true);
      setRepairedError(null);
      const params: any = {
        preset: repairedPreset,
        page: repairedPage,
        limit: 20,
      };
      if (repairedPreset === 'CUSTOM') {
        if (repairedCustomStart) params.startDate = repairedCustomStart;
        if (repairedCustomEnd) params.endDate = repairedCustomEnd;
      }
      if (repairedSearch.trim()) {
        params.search = repairedSearch.trim();
      }

      const queryStr = new URLSearchParams(params).toString();
      const res = await api.get(`/sms/devices/repaired?${queryStr}`);
      if (seq !== repairedSeqRef.current) return;

      if (res && res.success) {
        setRepairedList(res.items || []);
        setRepairedTotal(res.total || 0);
        setRepairedTotalPages(res.totalPages || 1);
        useDashboardCache.getState().setSmsCenter({
          repairedList: res.items || [],
          repairedTotal: res.total || 0,
        }, user?.id);
      }
    } catch (err: any) {
      if (seq !== repairedSeqRef.current) return;
      console.warn('[FETCH REPAIRED DEVICES WARN]', err);
      const msg = err?.response?.data?.error || err?.message || 'Failed to load repaired devices.';
      setRepairedError(msg);
      toast.error(msg, { id: 'sms-repaired-device-error' });
    } finally {
      if (seq === repairedSeqRef.current) {
        setRepairedLoading(false);
      }
    }
  }, [repairedPreset, repairedCustomStart, repairedCustomEnd, repairedSearch, repairedPage, user?.id]);

  // Load Received Devices
  const fetchReceivedDevices = useCallback(async () => {
    const seq = ++receivedSeqRef.current;
    try {
      setReceivedLoading(true);
      setReceivedError(null);
      const params: any = {
        preset: receivedPreset,
        page: receivedPage,
        limit: 20,
      };
      if (receivedPreset === 'CUSTOM') {
        if (receivedCustomStart) params.startDate = receivedCustomStart;
        if (receivedCustomEnd) params.endDate = receivedCustomEnd;
      }
      if (receivedSearch.trim()) {
        params.search = receivedSearch.trim();
      }

      const queryStr = new URLSearchParams(params).toString();
      const res = await api.get(`/sms/devices/received?${queryStr}`);
      if (seq !== receivedSeqRef.current) return;

      if (res && res.success) {
        setReceivedList(res.items || []);
        setReceivedTotal(res.total || 0);
        setReceivedTotalPages(res.totalPages || 1);
        useDashboardCache.getState().setSmsCenter({
          receivedList: res.items || [],
          receivedTotal: res.total || 0,
        }, user?.id);
      }
    } catch (err: any) {
      if (seq !== receivedSeqRef.current) return;
      console.warn('[FETCH RECEIVED DEVICES WARN]', err);
      const msg = err?.response?.data?.error || err?.message || 'Failed to load received devices.';
      setReceivedError(msg);
      toast.error(msg, { id: 'sms-received-device-error' });
    } finally {
      if (seq === receivedSeqRef.current) {
        setReceivedLoading(false);
      }
    }
  }, [receivedPreset, receivedCustomStart, receivedCustomEnd, receivedSearch, receivedPage]);

  // Load Notification History
  const fetchHistory = useCallback(async () => {
    try {
      setHistoryLoading(true);
      const params: any = {
        limit: 50,
      };
      if (historySearch.trim()) params.search = historySearch.trim();
      if (historyStatusFilter !== 'ALL') params.status = historyStatusFilter;
      if (historyChannelFilter !== 'ALL') params.channel = historyChannelFilter;

      const queryStr = new URLSearchParams(params).toString();
      const res = await api.get(`/sms/notifications?${queryStr}`);
      if (res) {
        setHistoryList(res.items || []);
        setHistoryTotal(res.total || 0);
      }
    } catch (err) {
      console.warn('[FETCH SMS NOTIFICATIONS WARN]', err);
    } finally {
      setHistoryLoading(false);
    }
  }, [historySearch, historyStatusFilter, historyChannelFilter]);

  // Fetch pending messages awaiting staff verification
  const fetchPendingConfirmations = useCallback(async () => {
    try {
      setPendingConfirmationsLoading(true);
      const res: any = await api.get('/sms/pending-confirmations');
      if (res && Array.isArray(res.items)) {
        setPendingConfirmationsList(res.items);
      }
    } catch (err) {
      console.warn('[PENDING CONFIRMATIONS WARN]', err);
    } finally {
      setPendingConfirmationsLoading(false);
    }
  }, []);

  // Inline Confirmation Action (YES - Sent / NO - Not Sent / Cancel)
  const handleInlineConfirm = async (
    recordId: string,
    status: 'STAFF_CONFIRMED_SENT' | 'FAILED' | 'CANCELLED'
  ) => {
    try {
      await api.post('/sms/confirm', {
        smsRecordId: recordId,
        status,
      });
      toast.success(
        status === 'STAFF_CONFIRMED_SENT'
          ? 'Customer notification verified as sent!'
          : `Notification marked as ${status.replace(/_/g, ' ')}.`
      );
      fetchPendingConfirmations();
      fetchStats();
      if (activeTab === 'REPAIRED') fetchRepairedDevices();
      if (activeTab === 'RECEIVED') fetchReceivedDevices();
      if (activeTab === 'HISTORY') fetchHistory();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update confirmation status');
    }
  };

  // Trigger data fetches based on active tab and filters
  useEffect(() => {
    if (!isAuthorized) return;
    fetchStats();
    fetchPendingConfirmations();
  }, [isAuthorized, fetchPendingConfirmations]);

  useEffect(() => {
    if (!isAuthorized) return;
    if (activeTab === 'REPAIRED') {
      fetchRepairedDevices();
    } else if (activeTab === 'RECEIVED') {
      fetchReceivedDevices();
    } else if (activeTab === 'CONFIRMATION') {
      fetchPendingConfirmations();
    } else if (activeTab === 'HISTORY') {
      fetchHistory();
    }
  }, [activeTab, fetchRepairedDevices, fetchReceivedDevices, fetchPendingConfirmations, fetchHistory, isAuthorized]);

  // Realtime synchronization across all tabs and dashboards
  useRealtimeSync(['smsNotification', 'repair', 'repairLog'], () => {
    fetchStats();
    fetchPendingConfirmations();
    if (activeTab === 'REPAIRED') fetchRepairedDevices();
    if (activeTab === 'RECEIVED') fetchReceivedDevices();
    if (activeTab === 'HISTORY') fetchHistory();
  });

  // Open modal with specific repair and notification type
  const handleOpenNotificationModal = (repair: any, type: 'REPAIR_COMPLETED' | 'DEVICE_RECEIVED') => {
    setModalRepair(repair);
    setModalNotificationType(type);
    setIsModalOpen(true);
  };

  // Quick Direct WhatsApp Launch (with confirmation modal)
  const handleDirectWhatsApp = (repair: any, type: 'REPAIR_COMPLETED' | 'DEVICE_RECEIVED') => {
    handleOpenNotificationModal(repair, type);
  };

  if (!isAuthorized) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Access Restricted</h2>
        <p className="text-sm text-slate-500">
          The SMS Notification Center is accessible by Super Admin, Admin, Manager, and Receptionist roles.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white flex items-center justify-center shadow-lg shadow-cyan-500/20 shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                  SMS & Customer Notification Center
                </h1>
                <Badge variant="outline" className="text-[10px] font-mono text-cyan-600 border-cyan-500/30 bg-cyan-50/50 dark:bg-cyan-950/30">
                  NPT (UTC+05:45)
                </Badge>
                {isReadOnly && (
                  <Badge variant="secondary" className="text-[10px] font-semibold text-amber-700 bg-amber-50 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-300/60">
                    Manager View (Read-Only)
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Retrieve repaired and received devices by date and notify customers via single-segment SMS and WhatsApp.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchStats();
              if (activeTab === 'REPAIRED') fetchRepairedDevices();
              if (activeTab === 'RECEIVED') fetchReceivedDevices();
              if (activeTab === 'HISTORY') fetchHistory();
              toast.success('Data refreshed.');
            }}
            className="text-xs border-slate-200 dark:border-slate-800"
          >
            <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", statsLoading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Global Date Filter Bar for SMS Center (Asia/Kathmandu NPT) */}
      <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 mr-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                <span>Date Period (NPT):</span>
              </span>

              {[
                { label: 'Today', value: 'TODAY' },
                { label: 'Yesterday', value: 'YESTERDAY' },
                { label: 'This Week', value: 'THIS_WEEK' },
                { label: 'This Month', value: 'THIS_MONTH' },
                { label: 'All Time', value: 'ALL' },
                { label: 'Custom', value: 'CUSTOM' },
              ].map((p) => (
                <Button
                  key={p.value}
                  type="button"
                  size="sm"
                  variant={globalPreset === p.value ? "default" : "outline"}
                  className={cn(
                    "h-7 text-xs font-semibold px-2.5 transition-all cursor-pointer",
                    globalPreset === p.value
                      ? "bg-cyan-600 text-white hover:bg-cyan-700 shadow-xs"
                      : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                  )}
                  onClick={() => {
                    setGlobalPreset(p.value);
                    setRepairedPreset(p.value);
                    setReceivedPreset(p.value);
                    fetchStats(p.value);
                  }}
                >
                  {p.label}
                </Button>
              ))}
            </div>

            {globalPreset === 'CUSTOM' && (
              <div className="flex items-center gap-2 pt-2 sm:pt-0">
                <Input
                  type="date"
                  value={globalCustomStart}
                  onChange={(e) => setGlobalCustomStart(e.target.value)}
                  className="h-7 text-xs w-32 bg-slate-50 dark:bg-slate-950"
                  aria-label="Custom start date"
                />
                <span className="text-xs text-slate-400">to</span>
                <Input
                  type="date"
                  value={globalCustomEnd}
                  onChange={(e) => setGlobalCustomEnd(e.target.value)}
                  className="h-7 text-xs w-32 bg-slate-50 dark:bg-slate-950"
                  aria-label="Custom end date"
                />
                <Button
                  size="sm"
                  onClick={() => {
                    fetchStats('CUSTOM', globalCustomStart, globalCustomEnd);
                  }}
                  className="h-7 text-xs bg-cyan-600 hover:bg-cyan-700 text-white cursor-pointer"
                >
                  Apply
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary KPI Cards (7 Clickable Interactive Cards with Skeleton Loading) */}
      {statsLoading && !stats ? (
        <SmsKpiCardsSkeleton count={7} />
      ) : statsError && !stats ? (
        <Card className="bg-rose-50/60 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60 p-4">
          <div className="flex items-center justify-between gap-3 text-xs text-rose-700 dark:text-rose-300">
            <span className="flex items-center gap-1.5 font-medium">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{statsError}</span>
            </span>
            <Button size="sm" variant="outline" onClick={() => fetchStats()} className="h-7 text-xs">
              Retry
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2.5 sm:gap-3.5">
          {/* 1. Total SMS Sent */}
          <Card
            onClick={() => handleCardClick('TOTAL_SMS_SENT', 'Total SMS Sent', 'All SMS messages confirmed sent')}
            className={cn(
              "bg-slate-900 border-slate-800 text-white shadow-md cursor-pointer hover:border-cyan-500/80 transition-all select-none group",
              selectedMetric === 'TOTAL_SMS_SENT' && "ring-2 ring-cyan-400 scale-[1.02]"
            )}
          >
            <CardContent className="p-3 sm:p-3.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block truncate">Total SMS Sent</span>
              <div className="text-xl sm:text-2xl font-black text-white mt-0.5">
                {stats?.totalSmsSent ?? 0}
              </div>
              <div className="text-[10px] text-cyan-400 font-medium flex items-center justify-between mt-1 pt-0.5 border-t border-slate-800">
                <span className="flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  <span>SMS Sent</span>
                </span>
                <span className="opacity-0 group-hover:opacity-100 transition-opacity">View →</span>
              </div>
            </CardContent>
          </Card>

          {/* 2. SMS Channel Total */}
          <Card
            onClick={() => handleCardClick('SMS_CHANNEL_TOTAL', 'SMS Channel Total', 'All messages processed on SMS channels')}
            className={cn(
              "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs cursor-pointer hover:border-indigo-500/80 transition-all select-none group",
              selectedMetric === 'SMS_CHANNEL_TOTAL' && "ring-2 ring-indigo-500 scale-[1.02]"
            )}
          >
            <CardContent className="p-3 sm:p-3.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block truncate">SMS Channel Total</span>
              <div className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
                {stats?.smsChannelTotal ?? 0}
              </div>
              <div className="text-[10px] text-slate-400 font-medium flex items-center justify-between mt-1 pt-0.5 border-t border-slate-100 dark:border-slate-800">
                <span className="flex items-center gap-1">
                  <Smartphone className="w-3 h-3 text-indigo-500" />
                  <span>All SMS</span>
                </span>
                <span className="opacity-0 group-hover:opacity-100 text-indigo-600 dark:text-indigo-400 transition-opacity">View →</span>
              </div>
            </CardContent>
          </Card>

          {/* 3. Staff-Confirmed */}
          <Card
            onClick={() => handleCardClick('STAFF_CONFIRMED', 'Staff-Confirmed SMS', 'SMS messages verified as sent by authorized staff')}
            className={cn(
              "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs cursor-pointer hover:border-emerald-500/80 transition-all select-none group",
              selectedMetric === 'STAFF_CONFIRMED' && "ring-2 ring-emerald-500 scale-[1.02]"
            )}
          >
            <CardContent className="p-3 sm:p-3.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block truncate">Staff-Confirmed</span>
              <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                {stats?.staffConfirmedSms ?? 0}
              </div>
              <div className="text-[10px] text-slate-400 font-medium flex items-center justify-between mt-1 pt-0.5 border-t border-slate-100 dark:border-slate-800">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  <span>Verified</span>
                </span>
                <span className="opacity-0 group-hover:opacity-100 text-emerald-600 dark:text-emerald-400 transition-opacity">View →</span>
              </div>
            </CardContent>
          </Card>

          {/* 4. Carrier Delivered */}
          <Card
            onClick={() => handleCardClick('CARRIER_DELIVERED', 'Carrier-Delivered SMS', 'Messages with network delivery receipts')}
            className={cn(
              "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs cursor-pointer hover:border-cyan-500/80 transition-all select-none group",
              selectedMetric === 'CARRIER_DELIVERED' && "ring-2 ring-cyan-500 scale-[1.02]"
            )}
          >
            <CardContent className="p-3 sm:p-3.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block truncate">Carrier Delivered</span>
              <div className="text-xl sm:text-2xl font-black text-cyan-600 dark:text-cyan-400 mt-0.5">
                {stats?.carrierConfirmedDelivered ?? 0}
              </div>
              <div className="text-[10px] text-slate-400 font-medium flex items-center justify-between mt-1 pt-0.5 border-t border-slate-100 dark:border-slate-800">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-cyan-500" />
                  <span>Receipts</span>
                </span>
                <span className="opacity-0 group-hover:opacity-100 text-cyan-600 dark:text-cyan-400 transition-opacity">View →</span>
              </div>
            </CardContent>
          </Card>

          {/* 5. Failed SMS */}
          <Card
            onClick={() => handleCardClick('FAILED_SMS', 'Failed SMS Records', 'Messages that failed or could not be delivered')}
            className={cn(
              "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs cursor-pointer hover:border-rose-500/80 transition-all select-none group",
              selectedMetric === 'FAILED_SMS' && "ring-2 ring-rose-500 scale-[1.02]"
            )}
          >
            <CardContent className="p-3 sm:p-3.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block truncate">Failed SMS</span>
              <div className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 mt-0.5">
                {stats?.failedSms ?? 0}
              </div>
              <div className="text-[10px] text-slate-400 font-medium flex items-center justify-between mt-1 pt-0.5 border-t border-slate-100 dark:border-slate-800">
                <span className="flex items-center gap-1">
                  <XCircle className="w-3 h-3 text-rose-500" />
                  <span>Failed</span>
                </span>
                <span className="opacity-0 group-hover:opacity-100 text-rose-600 dark:text-rose-400 transition-opacity">View →</span>
              </div>
            </CardContent>
          </Card>

          {/* 6. Pending / Draft */}
          <Card
            onClick={() => handleCardClick('PENDING_DRAFT', 'Pending & Draft SMS', 'Messages prepared, opened, or awaiting sending')}
            className={cn(
              "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs cursor-pointer hover:border-amber-500/80 transition-all select-none group",
              selectedMetric === 'PENDING_DRAFT' && "ring-2 ring-amber-500 scale-[1.02]"
            )}
          >
            <CardContent className="p-3 sm:p-3.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block truncate">Pending / Draft</span>
              <div className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 mt-0.5">
                {stats?.pendingSms ?? 0}
              </div>
              <div className="text-[10px] text-slate-400 font-medium flex items-center justify-between mt-1 pt-0.5 border-t border-slate-100 dark:border-slate-800">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-500" />
                  <span>Pending</span>
                </span>
                <span className="opacity-0 group-hover:opacity-100 text-amber-600 dark:text-amber-400 transition-opacity">View →</span>
              </div>
            </CardContent>
          </Card>

          {/* 7. WhatsApp Sent */}
          <Card
            onClick={() => handleCardClick('WHATSAPP_SENT', 'WhatsApp Sent Records', 'WhatsApp messages confirmed sent')}
            className={cn(
              "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60 shadow-xs cursor-pointer hover:border-emerald-500/80 transition-all select-none group",
              selectedMetric === 'WHATSAPP_SENT' && "ring-2 ring-emerald-500 scale-[1.02]"
            )}
          >
            <CardContent className="p-3 sm:p-3.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 block truncate">WhatsApp Sent</span>
              <div className="text-xl sm:text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-0.5">
                {stats?.whatsappSent ?? 0}
              </div>
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center justify-between mt-1 pt-0.5 border-t border-emerald-200/60 dark:border-emerald-800/60">
                <span className="flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" />
                  <span>WhatsApp</span>
                </span>
                <span className="opacity-0 group-hover:opacity-100 transition-opacity">View →</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}


      {/* Extended Metrics & Customer Reach Strip */}
      <div className="flex items-center justify-between flex-wrap gap-2 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
        <div className="flex items-center gap-4 flex-wrap text-slate-600 dark:text-slate-400">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="text-slate-400 font-normal">Total Notifications:</span>
            <strong className="text-slate-800 dark:text-slate-200 font-bold">{statsLoading ? '...' : (stats?.totalNotifications ?? 0)}</strong>
          </span>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <span className="flex items-center gap-1.5 font-medium">
            <span className="text-slate-400 font-normal">Unique Customers Notified:</span>
            <strong className="text-indigo-600 dark:text-indigo-400 font-bold">{statsLoading ? '...' : (stats?.uniqueCustomersNotified ?? 0)}</strong>
          </span>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <span className="flex items-center gap-1.5 font-medium">
            <span className="text-slate-400 font-normal">WhatsApp Pending:</span>
            <strong className="text-amber-600 dark:text-amber-400 font-bold">{statsLoading ? '...' : (stats?.whatsappPending ?? 0)}</strong>
          </span>
          {(stats?.whatsappFailed ?? 0) > 0 && (
            <>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span className="flex items-center gap-1.5 font-medium text-rose-600 dark:text-rose-400">
                <span>WhatsApp Failed:</span>
                <strong>{stats?.whatsappFailed}</strong>
              </span>
            </>
          )}
          {(stats?.notSentSms ?? 0) > 0 && (
            <>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span className="flex items-center gap-1.5 font-medium text-slate-500">
                <span>SMS Skipped:</span>
                <strong>{stats?.notSentSms}</strong>
              </span>
            </>
          )}
        </div>
        <span className="text-[11px] text-slate-400 font-medium">Permanent Supabase Store</span>
      </div>

      {/* Primary Category Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(val: any) => setActiveTab(val)}
        className="w-full space-y-4"
      >
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2 flex-wrap gap-2">
          <TabsList className="bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl h-auto flex flex-wrap gap-1">
            <TabsTrigger
              value="REPAIRED"
              className="text-xs font-bold py-2 px-3.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-xs rounded-lg flex items-center gap-2"
            >
              <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Repaired Devices</span>
              {repairedTotal > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300">
                  {repairedTotal}
                </Badge>
              )}
            </TabsTrigger>

            <TabsTrigger
              value="RECEIVED"
              className="text-xs font-bold py-2 px-3.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-xs rounded-lg flex items-center gap-2"
            >
              <Tag className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <span>Received Devices</span>
              {receivedTotal > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-cyan-100 dark:bg-cyan-950/80 text-cyan-800 dark:text-cyan-300">
                  {receivedTotal}
                </Badge>
              )}
            </TabsTrigger>

            <TabsTrigger
              value="CONFIRMATION"
              className="text-xs font-bold py-2 px-3.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-xs rounded-lg flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>Awaiting Confirmation</span>
              {pendingConfirmationsList.length > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-bold animate-pulse">
                  {pendingConfirmationsList.length}
                </Badge>
              )}
            </TabsTrigger>

            <TabsTrigger
              value="HISTORY"
              className="text-xs font-bold py-2 px-3.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-xs rounded-lg flex items-center gap-2"
            >
              <Clock className="w-4 h-4 text-slate-500" />
              <span>Notification Audit History</span>
              {historyTotal > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                  {historyTotal}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ---------------------------------------------------- */}
        {/* TAB 1: REPAIRED DEVICES                              */}
        {/* ---------------------------------------------------- */}
        <TabsContent value="REPAIRED" className="space-y-4 pt-1">
          {/* Controls: Date Preset Filters & Search */}
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <CardContent className="p-3.5 sm:p-4 space-y-3">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                {/* Date Presets */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 mr-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Completion Date (NPT):</span>
                  </span>

                  {[
                    { label: 'Today', value: 'TODAY' },
                    { label: 'Yesterday', value: 'YESTERDAY' },
                    { label: 'This Week', value: 'THIS_WEEK' },
                    { label: 'This Month', value: 'THIS_MONTH' },
                    { label: 'Custom Range', value: 'CUSTOM' },
                    { label: 'All Repaired', value: 'ALL' },
                  ].map((p) => (
                    <Button
                      key={p.value}
                      type="button"
                      size="sm"
                      variant={repairedPreset === p.value ? "default" : "outline"}
                      className={cn(
                        "h-8 text-xs font-semibold px-2.5",
                        repairedPreset === p.value
                          ? "bg-cyan-600 text-white hover:bg-cyan-700 shadow-xs"
                          : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                      )}
                      onClick={() => {
                        setRepairedPreset(p.value);
                        setRepairedPage(1);
                      }}
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>

                {/* Search Box */}
                <div className="relative w-full lg:w-72">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    placeholder="Search repair #, phone, model..."
                    value={repairedSearch}
                    onChange={(e) => {
                      setRepairedSearch(e.target.value);
                      setRepairedPage(1);
                    }}
                    className="h-8 text-xs pl-8.5 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                  />
                </div>
              </div>

              {/* Custom Date Inputs if CUSTOM selected */}
              {repairedPreset === 'CUSTOM' && (
                <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-3 flex-wrap text-xs">
                  <span className="font-bold text-slate-700 dark:text-slate-300">Select Date Bounds:</span>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="repaired-start" className="text-[11px] text-slate-500">From:</Label>
                    <Input
                      id="repaired-start"
                      type="date"
                      value={repairedCustomStart}
                      onChange={(e) => setRepairedCustomStart(e.target.value)}
                      className="h-8 text-xs w-36 bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="repaired-end" className="text-[11px] text-slate-500">To:</Label>
                    <Input
                      id="repaired-end"
                      type="date"
                      value={repairedCustomEnd}
                      onChange={(e) => setRepairedCustomEnd(e.target.value)}
                      className="h-8 text-xs w-36 bg-white dark:bg-slate-900"
                    />
                  </div>
                  <Button
                    size="sm"
                    className="h-8 text-xs bg-cyan-600 hover:bg-cyan-700 text-white font-bold"
                    onClick={() => {
                      setRepairedPage(1);
                      fetchRepairedDevices();
                    }}
                  >
                    Apply Filter
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Repaired Devices Results Table */}
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800/80 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-emerald-500" />
                  <span>Repaired Devices Ready for Customer Collection ({repairedTotal})</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Filter based on actual repair completion date. Standard notification includes collection alert and tracking URL.
                </CardDescription>
              </div>

              <div className="text-xs text-slate-400">
                Page {repairedPage} of {repairedTotalPages}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {repairedError ? (
                <div className="py-12 text-center text-xs text-rose-500 bg-rose-50/50 dark:bg-rose-950/20 m-4 rounded-xl border border-rose-200 dark:border-rose-900/50 space-y-3 p-4">
                  <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-600 flex items-center justify-center mx-auto">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-rose-700 dark:text-rose-300">{repairedError}</p>
                    <p className="text-[11px] text-rose-500/80 mt-0.5">An error occurred while communicating with the database.</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/30"
                    onClick={() => fetchRepairedDevices()}
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                    Retry Loading
                  </Button>
                </div>
              ) : repairedLoading ? (
                <div className="p-4">
                  <TableSkeleton rows={6} columns={7} />
                </div>
              ) : repairedList.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400 bg-slate-50/50 dark:bg-slate-950/20 m-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
                  <p className="font-semibold text-slate-600 dark:text-slate-300">
                    No completed repairs found for {repairedPreset === 'TODAY' ? 'Today' : repairedPreset === 'YESTERDAY' ? 'Yesterday' : repairedPreset === 'THIS_WEEK' ? 'This Week' : repairedPreset === 'THIS_MONTH' ? 'This Month' : 'the selected period'}.
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                    Try selecting another date filter like This Month or All Repaired, or adjust your search term.
                  </p>
                  <div className="pt-1 flex items-center justify-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs font-semibold"
                      onClick={() => {
                        setRepairedPreset('THIS_MONTH');
                        setRepairedPage(1);
                      }}
                    >
                      View This Month
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs font-semibold"
                      onClick={() => {
                        setRepairedPreset('ALL');
                        setRepairedPage(1);
                      }}
                    >
                      View All Repaired
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 bg-slate-50/60 dark:bg-slate-950/60">
                        <th className="py-3 px-3.5">Repair #</th>
                        <th className="py-3 px-3">Customer</th>
                        <th className="py-3 px-3">Phone</th>
                        <th className="py-3 px-3">Device Model</th>
                        <th className="py-3 px-3">Repair Problem</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3">Completed (NPT)</th>
                        <th className="py-3 px-3">SMS Status</th>
                        <th className="py-3 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                      {repairedList.map((item) => {
                        const hasSent = item.smsSummary?.status === 'SENT';
                        const isPhoneValid = item.phoneValidation?.isValid;

                        return (
                          <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/60 transition-colors">
                            {/* Repair Number */}
                            <td className="py-3 px-3.5 font-mono font-bold text-slate-900 dark:text-slate-100">
                              <span className="text-cyan-600 hover:underline cursor-pointer" onClick={() => navigate(`/dashboard/repairs/${item.id}`)}>
                                #{item.repairNumber}
                              </span>
                            </td>

                            {/* Customer Name */}
                            <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[130px]">
                              {item.customerName}
                            </td>

                            {/* Customer Phone */}
                            <td className="py-3 px-3 font-mono">
                              <div className="flex items-center gap-1.5">
                                <span className={cn("text-xs font-semibold", isPhoneValid ? "text-slate-700 dark:text-slate-300" : "text-rose-600")}>
                                  {item.phoneValidation?.displayFormatted || item.customerPhoneRaw}
                                </span>
                              </div>
                            </td>

                            {/* Device Model */}
                            <td className="py-3 px-3 text-slate-700 dark:text-slate-300 truncate max-w-[140px]">
                              <span className="font-semibold">{item.deviceBrand}</span> {item.deviceModel}
                            </td>

                            {/* Problem */}
                            <td className="py-3 px-3 text-slate-500 truncate max-w-[160px] italic">
                              {item.problemDescription || 'Inspection'}
                            </td>

                            {/* Status */}
                            <td className="py-3 px-3">
                              <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400">
                                {item.status}
                              </Badge>
                            </td>

                            {/* Completion Date */}
                            <td className="py-3 px-3 font-mono text-[11px] text-slate-500">
                              {item.completedDate ? toNepalDateString(item.completedDate) : '—'}
                            </td>

                            {/* SMS Status */}
                            <td className="py-3 px-3">
                              {hasSent ? (
                                <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400">
                                  Notified ({item.smsSummary?.count}x)
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400">
                                  Unnotified
                                </Badge>
                              )}
                            </td>

                            {/* Action Buttons */}
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {isReadOnly ? (
                                  <Badge variant="outline" className="text-[10px] text-slate-500 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                                    Audit Only
                                  </Badge>
                                ) : (
                                  <>
                                    <Button
                                      size="sm"
                                      className="h-7 text-[11px] font-bold px-2.5 bg-cyan-600 hover:bg-cyan-700 text-white shadow-xs"
                                      onClick={() => handleOpenNotificationModal(item, 'REPAIR_COMPLETED')}
                                      title="Send Repaired SMS Notification"
                                    >
                                      <Smartphone className="w-3 h-3 mr-1" />
                                      <span>Send SMS</span>
                                    </Button>

                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-[11px] font-bold px-2 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                                      onClick={() => handleDirectWhatsApp(item, 'REPAIR_COMPLETED')}
                                      title="Send WhatsApp Notification"
                                    >
                                      <MessageSquare className="w-3 h-3 text-emerald-600" />
                                      <span className="hidden sm:inline ml-1">WhatsApp</span>
                                    </Button>
                                  </>
                                )}

                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs text-slate-500 px-1.5"
                                  onClick={() => navigate(`/dashboard/repairs/${item.id}`)}
                                  title="View Repair Ticket Details"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination Controls */}
              {repairedTotalPages > 1 && (
                <div className="p-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-500">
                    Showing {repairedList.length} of {repairedTotal} records
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={repairedPage <= 1 || repairedLoading}
                      onClick={() => setRepairedPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="w-3 h-3 mr-1" />
                      Previous
                    </Button>
                    <span className="px-2 font-mono font-bold text-slate-700 dark:text-slate-300">
                      {repairedPage} / {repairedTotalPages}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={repairedPage >= repairedTotalPages || repairedLoading}
                      onClick={() => setRepairedPage((p) => p + 1)}
                    >
                      Next
                      <ChevronRight className="w-3 h-3 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------------------------------------------- */}
        {/* TAB 2: RECEIVED DEVICES                              */}
        {/* ---------------------------------------------------- */}
        <TabsContent value="RECEIVED" className="space-y-4 pt-1">
          {/* Controls: Date Preset Filters & Search */}
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <CardContent className="p-3.5 sm:p-4 space-y-3">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                {/* Date Presets */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 mr-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Received Date (NPT):</span>
                  </span>

                  {[
                    { label: 'Today', value: 'TODAY' },
                    { label: 'Yesterday', value: 'YESTERDAY' },
                    { label: 'This Week', value: 'THIS_WEEK' },
                    { label: 'This Month', value: 'THIS_MONTH' },
                    { label: 'Custom Range', value: 'CUSTOM' },
                    { label: 'All Received', value: 'ALL' },
                  ].map((p) => (
                    <Button
                      key={p.value}
                      type="button"
                      size="sm"
                      variant={receivedPreset === p.value ? "default" : "outline"}
                      className={cn(
                        "h-8 text-xs font-semibold px-2.5",
                        receivedPreset === p.value
                          ? "bg-cyan-600 text-white hover:bg-cyan-700 shadow-xs"
                          : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                      )}
                      onClick={() => {
                        setReceivedPreset(p.value);
                        setReceivedPage(1);
                      }}
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>

                {/* Search Box */}
                <div className="relative w-full lg:w-72">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    placeholder="Search repair #, phone, customer..."
                    value={receivedSearch}
                    onChange={(e) => {
                      setReceivedSearch(e.target.value);
                      setReceivedPage(1);
                    }}
                    className="h-8 text-xs pl-8.5 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                  />
                </div>
              </div>

              {/* Custom Date Inputs if CUSTOM selected */}
              {receivedPreset === 'CUSTOM' && (
                <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-3 flex-wrap text-xs">
                  <span className="font-bold text-slate-700 dark:text-slate-300">Select Date Bounds:</span>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="received-start" className="text-[11px] text-slate-500">From:</Label>
                    <Input
                      id="received-start"
                      type="date"
                      value={receivedCustomStart}
                      onChange={(e) => setReceivedCustomStart(e.target.value)}
                      className="h-8 text-xs w-36 bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="received-end" className="text-[11px] text-slate-500">To:</Label>
                    <Input
                      id="received-end"
                      type="date"
                      value={receivedCustomEnd}
                      onChange={(e) => setReceivedCustomEnd(e.target.value)}
                      className="h-8 text-xs w-36 bg-white dark:bg-slate-900"
                    />
                  </div>
                  <Button
                    size="sm"
                    className="h-8 text-xs bg-cyan-600 hover:bg-cyan-700 text-white font-bold"
                    onClick={() => {
                      setReceivedPage(1);
                      fetchReceivedDevices();
                    }}
                  >
                    Apply Filter
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Received Devices Results Table */}
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800/80 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-cyan-500" />
                  <span>Devices Received at MTS Lab ({receivedTotal})</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Intake records filtered by device received date. Confirmation SMS provides tracking link to customer.
                </CardDescription>
              </div>

              <div className="text-xs text-slate-400">
                Page {receivedPage} of {receivedTotalPages}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {receivedError ? (
                <div className="py-12 text-center text-xs text-rose-500 bg-rose-50/50 dark:bg-rose-950/20 m-4 rounded-xl border border-rose-200 dark:border-rose-900/50 space-y-3 p-4">
                  <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-600 flex items-center justify-center mx-auto">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-rose-700 dark:text-rose-300">{receivedError}</p>
                    <p className="text-[11px] text-rose-500/80 mt-0.5">An error occurred while communicating with the database.</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/30"
                    onClick={() => fetchReceivedDevices()}
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                    Retry Loading
                  </Button>
                </div>
              ) : receivedLoading ? (
                <div className="p-4">
                  <TableSkeleton rows={6} columns={7} />
                </div>
              ) : receivedList.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400 bg-slate-50/50 dark:bg-slate-950/20 m-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
                  <p className="font-semibold text-slate-600 dark:text-slate-300">
                    No received devices found for {receivedPreset === 'TODAY' ? 'Today' : receivedPreset === 'YESTERDAY' ? 'Yesterday' : receivedPreset === 'THIS_WEEK' ? 'This Week' : receivedPreset === 'THIS_MONTH' ? 'This Month' : 'the selected period'}.
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                    Try adjusting your date filters like This Month or All Received, or clear your search input.
                  </p>
                  <div className="pt-1 flex items-center justify-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs font-semibold"
                      onClick={() => {
                        setReceivedPreset('THIS_MONTH');
                        setReceivedPage(1);
                      }}
                    >
                      View This Month
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs font-semibold"
                      onClick={() => {
                        setReceivedPreset('ALL');
                        setReceivedPage(1);
                      }}
                    >
                      View All Received
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 bg-slate-50/60 dark:bg-slate-950/60">
                        <th className="py-3 px-3.5">Repair #</th>
                        <th className="py-3 px-3">Customer</th>
                        <th className="py-3 px-3">Phone</th>
                        <th className="py-3 px-3">Device Model</th>
                        <th className="py-3 px-3">Reported Problem</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3">Received (NPT)</th>
                        <th className="py-3 px-3">SMS Status</th>
                        <th className="py-3 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                      {receivedList.map((item) => {
                        const hasSent = item.smsSummary?.status === 'SENT';
                        const isPhoneValid = item.phoneValidation?.isValid;

                        return (
                          <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/60 transition-colors">
                            {/* Repair Number */}
                            <td className="py-3 px-3.5 font-mono font-bold text-slate-900 dark:text-slate-100">
                              <span className="text-cyan-600 hover:underline cursor-pointer" onClick={() => navigate(`/dashboard/repairs/${item.id}`)}>
                                #{item.repairNumber}
                              </span>
                            </td>

                            {/* Customer Name */}
                            <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[130px]">
                              {item.customerName}
                            </td>

                            {/* Customer Phone */}
                            <td className="py-3 px-3 font-mono">
                              <span className={cn("text-xs font-semibold", isPhoneValid ? "text-slate-700 dark:text-slate-300" : "text-rose-600")}>
                                {item.phoneValidation?.displayFormatted || item.customerPhoneRaw}
                              </span>
                            </td>

                            {/* Device Model */}
                            <td className="py-3 px-3 text-slate-700 dark:text-slate-300 truncate max-w-[140px]">
                              <span className="font-semibold">{item.deviceBrand}</span> {item.deviceModel}
                            </td>

                            {/* Problem */}
                            <td className="py-3 px-3 text-slate-500 truncate max-w-[160px] italic">
                              {item.problemDescription || 'Inspection'}
                            </td>

                            {/* Status */}
                            <td className="py-3 px-3">
                              <Badge variant="outline" className="text-[10px]">
                                {item.status}
                              </Badge>
                            </td>

                            {/* Received Date */}
                            <td className="py-3 px-3 font-mono text-[11px] text-slate-500">
                              {item.receivedDate ? toNepalDateString(item.receivedDate) : '—'}
                            </td>

                            {/* SMS Status */}
                            <td className="py-3 px-3">
                              {hasSent ? (
                                <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400">
                                  Notified ({item.smsSummary?.count}x)
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400">
                                  Unnotified
                                </Badge>
                              )}
                            </td>

                            {/* Action Buttons */}
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {isReadOnly ? (
                                  <Badge variant="outline" className="text-[10px] text-slate-500 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                                    Audit Only
                                  </Badge>
                                ) : (
                                  <>
                                    <Button
                                      size="sm"
                                      className="h-7 text-[11px] font-bold px-2.5 bg-cyan-600 hover:bg-cyan-700 text-white shadow-xs"
                                      onClick={() => handleOpenNotificationModal(item, 'DEVICE_RECEIVED')}
                                      title="Send Received Confirmation SMS"
                                    >
                                      <Smartphone className="w-3 h-3 mr-1" />
                                      <span>Send SMS</span>
                                    </Button>

                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-[11px] font-bold px-2 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                                      onClick={() => handleDirectWhatsApp(item, 'DEVICE_RECEIVED')}
                                      title="Send WhatsApp Confirmation"
                                    >
                                      <MessageSquare className="w-3 h-3 text-emerald-600" />
                                      <span className="hidden sm:inline ml-1">WhatsApp</span>
                                    </Button>
                                  </>
                                )}

                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs text-slate-500 px-1.5"
                                  onClick={() => navigate(`/dashboard/repairs/${item.id}`)}
                                  title="View Repair Ticket Details"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination Controls */}
              {receivedTotalPages > 1 && (
                <div className="p-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-500">
                    Showing {receivedList.length} of {receivedTotal} records
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={receivedPage <= 1 || receivedLoading}
                      onClick={() => setReceivedPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="w-3 h-3 mr-1" />
                      Previous
                    </Button>
                    <span className="px-2 font-mono font-bold text-slate-700 dark:text-slate-300">
                      {receivedPage} / {receivedTotalPages}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={receivedPage >= receivedTotalPages || receivedLoading}
                      onClick={() => setReceivedPage((p) => p + 1)}
                    >
                      Next
                      <ChevronRight className="w-3 h-3 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------------------------------------------- */}
        {/* TAB 3: AWAITING CONFIRMATION QUEUE                   */}
        {/* ---------------------------------------------------- */}
        <TabsContent value="CONFIRMATION" className="space-y-4 pt-1">
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  <span>Awaiting Staff Delivery Confirmation ({pendingConfirmationsList.length})</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  When Windows Phone Link or WhatsApp is opened, the app cannot detect when the OS 'Send' button is pressed. Staff must verify delivery here.
                </CardDescription>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={fetchPendingConfirmations}
                disabled={pendingConfirmationsLoading}
                className="h-8 text-xs border-slate-200 dark:border-slate-800"
              >
                <RefreshCw className={cn("w-3 h-3 mr-1.5", pendingConfirmationsLoading && "animate-spin")} />
                Refresh Queue
              </Button>
            </CardHeader>

            <CardContent>
              {pendingConfirmationsLoading ? (
                <div className="py-2">
                  <TableSkeleton rows={4} columns={7} />
                </div>
              ) : pendingConfirmationsList.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400 bg-emerald-50/40 dark:bg-emerald-950/20 rounded-xl border border-dashed border-emerald-200 dark:border-emerald-800/40 space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                  <p className="font-semibold text-slate-700 dark:text-slate-300">All launched notifications have been verified!</p>
                  <p className="text-[11px] text-slate-500">There are no messages currently waiting for staff confirmation.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        <th className="py-2.5 px-3">Repair #</th>
                        <th className="py-2.5 px-3">Customer & Recipient</th>
                        <th className="py-2.5 px-3">Channel</th>
                        <th className="py-2.5 px-3">Message Preview</th>
                        <th className="py-2.5 px-3">Opened By</th>
                        <th className="py-2.5 px-3">Launched At</th>
                        <th className="py-2.5 px-3 text-right">Confirm Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {pendingConfirmationsList.map((item) => {
                        const isWa = item.channel === 'WHATSAPP';
                        return (
                          <tr key={item.id} className="hover:bg-amber-50/30 dark:hover:bg-amber-950/10">
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                              <span
                                className="text-cyan-600 hover:underline cursor-pointer"
                                onClick={() => navigate(`/dashboard/repairs/${item.repairId}`)}
                              >
                                #{item.repairNumber}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-slate-800 dark:text-slate-200">{item.customerName}</div>
                              <div className="font-mono text-[11px] text-slate-500">{item.customerPhoneNormalized || item.customerPhoneRaw}</div>
                            </td>
                            <td className="py-2.5 px-3">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] font-bold",
                                  isWa
                                    ? "text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400"
                                    : "text-cyan-700 bg-cyan-50 border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-400"
                                )}
                              >
                                {isWa ? 'WhatsApp' : 'Phone Link / SMS'}
                              </Badge>
                            </td>
                            <td className="py-2.5 px-3 max-w-[220px]">
                              <span className="truncate block text-slate-600 dark:text-slate-300 italic" title={item.messageContent}>
                                "{item.messageContent}"
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                              {item.senderStaffName}
                            </td>
                            <td className="py-2.5 px-3 text-slate-400 text-[11px] font-mono">
                              {item.openedAt || item.createdAt
                                ? new Date(item.openedAt || item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {isReadOnly ? (
                                <Badge variant="secondary" className="text-[10px] text-amber-700 bg-amber-50">
                                  Awaiting Staff Confirmation
                                </Badge>
                              ) : (
                                <div className="flex items-center justify-end gap-1.5">
                                  <Button
                                    size="sm"
                                    className="h-7 text-[11px] font-bold px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                                    onClick={() => handleInlineConfirm(item.id, 'STAFF_CONFIRMED_SENT')}
                                  >
                                    <Check className="w-3 h-3 mr-1" />
                                    YES — Sent
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-[11px] font-semibold px-2 text-rose-600 border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                    onClick={() => handleInlineConfirm(item.id, 'FAILED')}
                                  >
                                    <X className="w-3 h-3 mr-1" />
                                    NO — Not Sent
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-[11px] text-slate-400 hover:text-slate-600 px-1.5"
                                    onClick={() => handleInlineConfirm(item.id, 'CANCELLED')}
                                    title="Cancel notification record"
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------------------------------------------- */}
        {/* TAB 4: COMPLETE NOTIFICATION AUDIT HISTORY           */}
        {/* ---------------------------------------------------- */}
        <TabsContent value="HISTORY" className="space-y-4 pt-1">
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-cyan-500" />
                  <span>Notification Audit History ({historyTotal})</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Comprehensive log of all customer notification attempts, staff confirmations, and status transitions.
                </CardDescription>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <Input
                    placeholder="Search logs..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && fetchHistory()}
                    className="h-8 text-xs pl-8 w-36 sm:w-48 bg-slate-50 dark:bg-slate-950"
                  />
                </div>

                <select
                  value={historyStatusFilter}
                  onChange={(e) => {
                    setHistoryStatusFilter(e.target.value);
                  }}
                  aria-label="Filter notification logs by status"
                  className="h-8 text-xs rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2 text-slate-700 dark:text-slate-300"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="STAFF_CONFIRMED_SENT">Confirmed Sent</option>
                  <option value="PENDING">Pending / Draft</option>
                  <option value="FAILED">Failed</option>
                </select>

                <select
                  value={historyChannelFilter}
                  onChange={(e) => {
                    setHistoryChannelFilter(e.target.value);
                  }}
                  aria-label="Filter notification logs by channel"
                  className="h-8 text-xs rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2 text-slate-700 dark:text-slate-300"
                >
                  <option value="ALL">All Channels</option>
                  <option value="WINDOWS_PHONE_LINK">Phone Link</option>
                  <option value="SMS_PROTOCOL">SMS Protocol</option>
                  <option value="WHATSAPP">WhatsApp</option>
                </select>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchHistory}
                  className="h-8 text-xs"
                >
                  <Filter className="w-3 h-3 mr-1" />
                  Filter
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="py-2">
                  <TableSkeleton rows={6} columns={8} />
                </div>
              ) : historyList.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                  No notification logs found matching the filter criteria.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        <th className="py-2.5 px-3">Repair #</th>
                        <th className="py-2.5 px-3">Customer</th>
                        <th className="py-2.5 px-3">Phone</th>
                        <th className="py-2.5 px-3">Channel</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Staff Member</th>
                        <th className="py-2.5 px-3">Message Preview</th>
                        <th className="py-2.5 px-3 text-right">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {historyList.map((item) => {
                        const isConfirmed = item.status === 'STAFF_CONFIRMED_SENT' || item.status === 'SENT';
                        const isFailed = item.status === 'FAILED';
                        const isWa = item.channel === 'WHATSAPP';

                        return (
                          <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                              <span className="text-cyan-600 hover:underline cursor-pointer" onClick={() => navigate(`/dashboard/repairs/${item.repairId}`)}>
                                #{item.repairNumber}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">
                              {item.customerName}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400">
                              {item.customerPhoneNormalized || item.customerPhoneRaw}
                            </td>
                            <td className="py-2.5 px-3">
                              <Badge variant="outline" className={cn(
                                "text-[10px]",
                                isWa ? "text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400" : "text-slate-600 dark:text-slate-300"
                              )}>
                                {isWa ? 'WhatsApp' : item.channel?.replace(/_/g, ' ') || 'SMS'}
                              </Badge>
                            </td>
                            <td className="py-2.5 px-3">
                              <Badge variant="outline" className={cn(
                                "text-[10px] font-bold",
                                isConfirmed
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400"
                                  : isFailed
                                  ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-400"
                                  : "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300"
                              )}>
                                {item.status.replace(/_/g, ' ')}
                              </Badge>
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                              {item.senderStaffName} ({item.senderStaffRole})
                            </td>
                            <td className="py-2.5 px-3 max-w-[240px] truncate text-slate-500 italic">
                              "{item.messageContent}"
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-400 text-[11px] font-mono">
                              {item.createdAt ? new Date(item.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Reusable Send & Preview Modal */}
      {modalRepair && (
        <SendSmsModal
          open={isModalOpen}
          onOpenChange={(val) => {
            setIsModalOpen(val);
            if (!val) {
              fetchStats();
              if (activeTab === 'REPAIRED') fetchRepairedDevices();
              if (activeTab === 'RECEIVED') fetchReceivedDevices();
              if (activeTab === 'HISTORY') fetchHistory();
            }
          }}
          repair={modalRepair}
          defaultNotificationType={modalNotificationType}
          onSuccess={() => {
            fetchStats();
            if (activeTab === 'REPAIRED') fetchRepairedDevices();
            if (activeTab === 'RECEIVED') fetchReceivedDevices();
            if (activeTab === 'HISTORY') fetchHistory();
          }}
        />
      )}

      {/* Interactive Metric Records Dialog for Clickable KPI Cards */}
      <Dialog open={isMetricModalOpen} onOpenChange={setIsMetricModalOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 overflow-hidden bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <DialogHeader className="p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between gap-3 pr-6">
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>{activeMetricTitle || 'Metric Records'}</span>
                  <Badge variant="secondary" className="text-xs px-2 py-0.5 font-mono bg-cyan-100 dark:bg-cyan-950/80 text-cyan-800 dark:text-cyan-300">
                    {metricRecordsTotal} {metricRecordsTotal === 1 ? 'record' : 'records'}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {activeMetricSubtitle} • Period: <span className="font-semibold text-slate-700 dark:text-slate-300">{globalPreset === 'ALL' ? 'All Time' : globalPreset.replace('_', ' ')} (Asia/Kathmandu)</span>
                </DialogDescription>
              </div>
            </div>

            {/* Filter Bar inside Modal */}
            <div className="flex items-center gap-2 pt-3">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <Input
                  placeholder="Search by customer, phone, repair #, staff..."
                  value={metricSearch}
                  onChange={(e) => setMetricSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && selectedMetric) {
                      setMetricRecordsPage(1);
                      fetchMetricRecords(selectedMetric, globalPreset, metricSearch, 1);
                    }
                  }}
                  className="h-8 text-xs pl-8 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (selectedMetric) {
                    setMetricRecordsPage(1);
                    fetchMetricRecords(selectedMetric, globalPreset, metricSearch, 1);
                  }
                }}
                className="h-8 text-xs shrink-0"
              >
                <Search className="w-3 h-3 mr-1" />
                Filter
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setMetricSearch('');
                  if (selectedMetric) {
                    setMetricRecordsPage(1);
                    fetchMetricRecords(selectedMetric, globalPreset, '', 1);
                  }
                }}
                className="h-8 text-xs shrink-0 text-slate-500"
              >
                Clear
              </Button>
            </div>
          </DialogHeader>

          {/* Modal Body / Table */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            {metricRecordsLoading ? (
              <div className="py-2">
                <TableSkeleton rows={6} columns={7} />
              </div>
            ) : metricRecords.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 space-y-1.5 p-4">
                <AlertCircle className="w-6 h-6 text-slate-400 mx-auto" />
                <p className="font-semibold text-slate-700 dark:text-slate-300">No records found for this metric</p>
                <p className="text-[11px] text-slate-500">
                  {metricSearch ? 'No matches for your search query. Try clearing the search filter.' : 'There are no notification logs matching this metric in the selected period.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2 px-3">Repair #</th>
                      <th className="py-2 px-3">Customer</th>
                      <th className="py-2 px-3">Channel</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Staff</th>
                      <th className="py-2 px-3">Message</th>
                      <th className="py-2 px-3 text-right">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {metricRecords.map((item) => {
                      const isWa = item.channel === 'WHATSAPP';
                      const isConfirmed = item.status === 'STAFF_CONFIRMED_SENT' || item.status === 'SENT';
                      const isDelivered = item.status === 'DELIVERED';
                      const isFailed = item.status === 'FAILED';
                      const timestamp = item.confirmedAt || item.sentAt || item.initiatedAt || item.createdAt;

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-bold">
                            <span
                              className="text-cyan-600 hover:underline cursor-pointer"
                              onClick={() => {
                                setIsMetricModalOpen(false);
                                navigate(`/dashboard/repairs/${item.repairId}`);
                              }}
                            >
                              #{item.repairNumber || 'N/A'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-800 dark:text-slate-200">{item.customerName || 'Customer'}</div>
                            <div className="font-mono text-[11px] text-slate-500">{item.customerPhoneNormalized || item.customerPhoneRaw || '—'}</div>
                          </td>
                          <td className="py-2.5 px-3">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] font-medium",
                                isWa
                                  ? "text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400"
                                  : "text-indigo-700 bg-indigo-50 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-400"
                              )}
                            >
                              {isWa ? 'WhatsApp' : 'SMS'}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] font-bold",
                                isConfirmed || isDelivered
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400"
                                  : isFailed
                                  ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-400"
                                  : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-400"
                              )}
                            >
                              {item.status?.replace(/_/g, ' ') || 'UNKNOWN'}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                            <div>{item.senderStaffName || 'Staff'}</div>
                            <div className="text-[10px] text-slate-400">{item.senderStaffRole || ''}</div>
                          </td>
                          <td className="py-2.5 px-3 max-w-[200px]">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-slate-600 dark:text-slate-300 italic text-[11px]" title={item.messageContent}>
                                "{item.messageContent || '—'}"
                              </span>
                              {item.messageContent && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(item.messageContent);
                                    toast.success('Message copied!');
                                  }}
                                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0 p-1"
                                  title="Copy text"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right text-[11px] font-mono text-slate-500 whitespace-nowrap">
                            {timestamp ? new Date(timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Modal Footer with Pagination */}
          <div className="p-3 sm:p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex items-center justify-between gap-3 text-xs">
            <span className="text-slate-500">
              Showing {metricRecords.length} of {metricRecordsTotal} total entries
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={metricRecordsPage <= 1 || metricRecordsLoading}
                onClick={() => {
                  if (selectedMetric && metricRecordsPage > 1) {
                    const prev = metricRecordsPage - 1;
                    setMetricRecordsPage(prev);
                    fetchMetricRecords(selectedMetric, globalPreset, metricSearch, prev);
                  }
                }}
                className="h-7 text-xs"
              >
                <ChevronLeft className="w-3 h-3 mr-1" />
                Previous
              </Button>
              <span className="font-mono text-slate-600 dark:text-slate-400">
                Page {metricRecordsPage} of {Math.max(1, Math.ceil(metricRecordsTotal / 15))}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={metricRecordsPage * 15 >= metricRecordsTotal || metricRecordsLoading}
                onClick={() => {
                  if (selectedMetric) {
                    const next = metricRecordsPage + 1;
                    setMetricRecordsPage(next);
                    fetchMetricRecords(selectedMetric, globalPreset, metricSearch, next);
                  }
                }}
                className="h-7 text-xs"
              >
                Next
                <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
              <Button
                size="sm"
                onClick={() => setIsMetricModalOpen(false)}
                className="h-7 text-xs bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 ml-2"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
