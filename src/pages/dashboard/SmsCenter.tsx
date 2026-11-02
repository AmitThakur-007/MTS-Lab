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

  // Pending Confirmations State
  const [pendingConfirmationsList, setPendingConfirmationsList] = useState<any[]>([]);
  const [pendingConfirmationsLoading, setPendingConfirmationsLoading] = useState<boolean>(false);

  // Stats - prehydrated from cache if present
  const [stats, setStats] = useState<{
    totalSmsSent: number;
    staffConfirmedSms: number;
    carrierConfirmedDelivered: number;
    failedSms: number;
    pendingSms: number;
    whatsappSent: number;
    notSentSms: number;
    whatsappPending: number;
    whatsappFailed: number;
    totalNotifications: number;
    uniqueCustomersNotified: number;
    uniqueCustomersNotNotified: number;
  }>(() => cachedSmsCenter.stats || {
    totalSmsSent: 0,
    staffConfirmedSms: 0,
    carrierConfirmedDelivered: 0,
    failedSms: 0,
    pendingSms: 0,
    whatsappSent: 0,
    notSentSms: 0,
    whatsappPending: 0,
    whatsappFailed: 0,
    totalNotifications: 0,
    uniqueCustomersNotified: 0,
    uniqueCustomersNotNotified: 0,
  });
  const [statsLoading, setStatsLoading] = useState(false);

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

  // Load summary stats
  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      const res = await api.get('/sms/stats');
      if (res) {
        const newStats = {
          totalSmsSent: res.totalSmsSent || 0,
          staffConfirmedSms: res.staffConfirmedSms || 0,
          carrierConfirmedDelivered: res.carrierConfirmedDelivered || 0,
          failedSms: res.failedSms || 0,
          pendingSms: res.pendingSms || 0,
          whatsappSent: res.whatsappSent || 0,
          notSentSms: res.notSentSms || 0,
          whatsappPending: res.whatsappPending || 0,
          whatsappFailed: res.whatsappFailed || 0,
          totalNotifications: res.totalNotifications || 0,
          uniqueCustomersNotified: res.uniqueCustomersNotified || 0,
          uniqueCustomersNotNotified: res.uniqueCustomersNotNotified || 0,
        };
        setStats(newStats);
        useDashboardCache.getState().setSmsCenter({ stats: newStats }, user?.id);
      }
    } catch (err) {
      console.warn('[FETCH SMS STATS WARN]', err);
    } finally {
      setStatsLoading(false);
    }
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

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Total SMS Sent */}
        <Card className="bg-slate-900 border-slate-800 text-white shadow-md">
          <CardContent className="p-3.5 sm:p-4">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Total SMS Sent</span>
            <div className="text-2xl sm:text-3xl font-black text-white mt-1">
              {statsLoading ? '...' : stats.totalSmsSent}
            </div>
            <span className="text-[10px] text-cyan-400 font-medium flex items-center gap-1 mt-1">
              <Check className="w-3 h-3" />
              <span>SMS channel total</span>
            </span>
          </CardContent>
        </Card>

        {/* Staff-Confirmed Sent */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs">
          <CardContent className="p-3.5 sm:p-4">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">Staff-Confirmed</span>
            <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {statsLoading ? '...' : stats.staffConfirmedSms}
            </div>
            <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1 mt-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              <span>Verified sent</span>
            </span>
          </CardContent>
        </Card>

        {/* Carrier Confirmed Delivered */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs">
          <CardContent className="p-3.5 sm:p-4">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">Carrier Delivered</span>
            <div className="text-2xl sm:text-3xl font-black text-cyan-600 dark:text-cyan-400 mt-1">
              {statsLoading ? '...' : stats.carrierConfirmedDelivered}
            </div>
            <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1 mt-1">
              <ShieldCheck className="w-3 h-3 text-cyan-500" />
              <span>Network receipt</span>
            </span>
          </CardContent>
        </Card>

        {/* Failed SMS */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs">
          <CardContent className="p-3.5 sm:p-4">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">Failed SMS</span>
            <div className="text-2xl sm:text-3xl font-black text-rose-600 dark:text-rose-400 mt-1">
              {statsLoading ? '...' : stats.failedSms}
            </div>
            <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1 mt-1">
              <XCircle className="w-3 h-3 text-rose-500" />
              <span>Attention needed</span>
            </span>
          </CardContent>
        </Card>

        {/* Pending / Draft SMS */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs">
          <CardContent className="p-3.5 sm:p-4">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">Pending / Draft</span>
            <div className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 mt-1">
              {statsLoading ? '...' : stats.pendingSms}
            </div>
            <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1 mt-1">
              <Clock className="w-3 h-3 text-amber-500" />
              <span>Awaiting send</span>
            </span>
          </CardContent>
        </Card>

        {/* WhatsApp Sent */}
        <Card className="bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60 shadow-xs">
          <CardContent className="p-3.5 sm:p-4">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 block">WhatsApp Sent</span>
            <div className="text-2xl sm:text-3xl font-black text-emerald-700 dark:text-emerald-400 mt-1">
              {statsLoading ? '...' : stats.whatsappSent}
            </div>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 mt-1">
              <MessageSquare className="w-3 h-3" />
              <span>Alternative channel</span>
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Extended Metrics & Customer Reach Strip */}
      <div className="flex items-center justify-between flex-wrap gap-2 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
        <div className="flex items-center gap-4 flex-wrap text-slate-600 dark:text-slate-400">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="text-slate-400 font-normal">Total Notifications:</span>
            <strong className="text-slate-800 dark:text-slate-200 font-bold">{statsLoading ? '...' : stats.totalNotifications}</strong>
          </span>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <span className="flex items-center gap-1.5 font-medium">
            <span className="text-slate-400 font-normal">Unique Customers Notified:</span>
            <strong className="text-indigo-600 dark:text-indigo-400 font-bold">{statsLoading ? '...' : stats.uniqueCustomersNotified}</strong>
          </span>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <span className="flex items-center gap-1.5 font-medium">
            <span className="text-slate-400 font-normal">WhatsApp Pending:</span>
            <strong className="text-amber-600 dark:text-amber-400 font-bold">{statsLoading ? '...' : stats.whatsappPending}</strong>
          </span>
          {stats.whatsappFailed > 0 && (
            <>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span className="flex items-center gap-1.5 font-medium text-rose-600 dark:text-rose-400">
                <span>WhatsApp Failed:</span>
                <strong>{stats.whatsappFailed}</strong>
              </span>
            </>
          )}
          {stats.notSentSms > 0 && (
            <>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span className="flex items-center gap-1.5 font-medium text-slate-500">
                <span>SMS Skipped:</span>
                <strong>{stats.notSentSms}</strong>
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
                <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-cyan-600" />
                  <span>Retrieving completed repairs from database...</span>
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
                <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-cyan-600" />
                  <span>Retrieving received devices from database...</span>
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
                <div className="py-16 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                  <span>Checking awaiting confirmations...</span>
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
                <div className="py-16 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-cyan-600" />
                  <span>Loading history logs...</span>
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
    </div>
  );
}
