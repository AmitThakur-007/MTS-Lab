import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { analyzeSmsEncoding, generateRepairCompletedMessage } from '@/lib/smsEncoding';
import { cn } from '@/lib/utils';
import SendSmsModal from '@/components/repair/SendSmsModal';

export default function SmsCenter() {
  const { user } = useAuthStore();
  const userRole = (user?.role || '').toUpperCase().trim();
  const isAuthorized = ['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST'].includes(userRole);

  // Stats
  const [stats, setStats] = useState<{
    totalSmsSent: number;
    staffConfirmedSms: number;
    carrierConfirmedDelivered: number;
    failedSms: number;
    pendingSms: number;
    whatsappSent: number;
  }>({
    totalSmsSent: 0,
    staffConfirmedSms: 0,
    carrierConfirmedDelivered: 0,
    failedSms: 0,
    pendingSms: 0,
    whatsappSent: 0,
  });
  const [statsLoading, setStatsLoading] = useState(false);

  // Pending Repaired Queue
  const [pendingRepairs, setPendingRepairs] = useState<any[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRepair, setSelectedRepair] = useState<any | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // Composer State (for selected repair)
  const [composerMessage, setComposerMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copiedComposerMsg, setCopiedComposerMsg] = useState(false);
  const [copiedComposerPhone, setCopiedComposerPhone] = useState(false);

  // Confirmation Flow state
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    channel: 'WINDOWS_PHONE_LINK' | 'WHATSAPP' | 'SMS_PROTOCOL';
    recordId: string;
    repairId: string;
  } | null>(null);

  // Notification History Table State
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('ALL');
  const [historyChannelFilter, setHistoryChannelFilter] = useState('ALL');

  // Modal helper
  const [modalRepair, setModalRepair] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Load stats
  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      const res = await api.get('/sms/stats');
      if (res) {
        setStats({
          totalSmsSent: res.totalSmsSent || 0,
          staffConfirmedSms: res.staffConfirmedSms || 0,
          carrierConfirmedDelivered: res.carrierConfirmedDelivered || 0,
          failedSms: res.failedSms || 0,
          pendingSms: res.pendingSms || 0,
          whatsappSent: res.whatsappSent || 0,
        });
      }
    } catch (err) {
      console.warn('[FETCH SMS STATS WARN]', err);
    } finally {
      setStatsLoading(false);
    }
  };

  // Load pending repairs
  const fetchPendingRepairs = async () => {
    try {
      setLoadingPending(true);
      const res = await api.get('/sms/pending-repairs');
      if (res && Array.isArray(res.repairs)) {
        setPendingRepairs(res.repairs);
      }
    } catch (err) {
      console.warn('[FETCH PENDING REPAIRS WARN]', err);
    } finally {
      setLoadingPending(false);
    }
  };

  // Load notification history
  const fetchHistory = async () => {
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
  };

  useEffect(() => {
    if (!isAuthorized) return;
    fetchStats();
    fetchPendingRepairs();
    fetchHistory();
  }, [isAuthorized]);

  // Execute Search for repairs
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.get(`/repairs?search=${encodeURIComponent(q)}&limit=10`);
        const repairs = Array.isArray(res) ? res : res?.repairs || [];
        setSearchResults(repairs);
      } catch (err) {
        console.warn('[SEARCH REPAIRS WARN]', err);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // When a repair is selected, initialize composer
  const handleSelectRepair = (repair: any) => {
    setSelectedRepair(repair);
    const customer = repair.customerName || repair.customer?.name || 'Customer';
    const dev = `${repair.deviceBrand ? `${repair.deviceBrand} ` : ''}${repair.deviceModel || 'Device'}`.trim();
    const repNum = repair.repairNumber || 'N/A';

    const tpl = generateRepairCompletedMessage({
      customerName: customer,
      deviceModel: dev,
      repairNumber: repNum,
    });
    setComposerMessage(tpl);
    setPendingConfirmation(null);
  };

  // Composer Phone and Encoding Calculations
  const selectedPhoneInfo = useMemo(() => {
    if (!selectedRepair) return null;
    const raw = selectedRepair.customerPhone || selectedRepair.customer?.phone || selectedRepair.customerPhoneRaw;
    return validateAndFormatNepalPhone(raw);
  }, [selectedRepair]);

  const composerEncoding = useMemo(() => {
    return analyzeSmsEncoding(composerMessage);
  }, [composerMessage]);

  // Dispatch Windows Phone Link from Composer
  const handleComposerSendPhoneLink = async () => {
    if (!selectedRepair || !selectedPhoneInfo?.isValid || submitting) return;
    if (!composerEncoding.isSingleSegment) {
      toast.error(`Message exceeds single-segment limit (${composerEncoding.unitsUsed}/${composerEncoding.maxUnitsSingleSegment}). Please shorten.`);
      return;
    }

    setSubmitting(true);
    try {
      // 1. Copy to clipboard
      try {
        await navigator.clipboard.writeText(composerMessage);
        setCopiedComposerMsg(true);
      } catch (_) {}

      // 2. Open on backend
      const res = await api.post('/sms/open', {
        repairId: selectedRepair.id || selectedRepair.repairId,
        customMessage: composerMessage,
        channel: 'WINDOWS_PHONE_LINK',
      });

      // 3. Launch sms: protocol deep link for Windows Phone Link
      const smsUri = `sms:${selectedPhoneInfo.international}?body=${encodeURIComponent(composerMessage)}`;
      window.location.href = smsUri;

      setPendingConfirmation({
        channel: 'WINDOWS_PHONE_LINK',
        recordId: res?.record?.id || '',
        repairId: selectedRepair.id || selectedRepair.repairId,
      });

      toast.info('Windows Phone Link launched. Please confirm once SMS is sent.', { duration: 5000 });
      fetchHistory();
      fetchPendingRepairs();
    } catch (err: any) {
      toast.error(err.message || 'Failed to initiate Windows Phone Link.');
    } finally {
      setSubmitting(false);
    }
  };

  // Dispatch WhatsApp from Composer
  const handleComposerSendWhatsApp = async () => {
    if (!selectedRepair || !selectedPhoneInfo?.isValid || submitting) return;

    setSubmitting(true);
    try {
      try {
        await navigator.clipboard.writeText(composerMessage);
        setCopiedComposerMsg(true);
      } catch (_) {}

      const res = await api.post('/sms/open', {
        repairId: selectedRepair.id || selectedRepair.repairId,
        customMessage: composerMessage,
        channel: 'WHATSAPP',
      });

      const waUrl = `https://wa.me/${selectedPhoneInfo.whatsappPhone}?text=${encodeURIComponent(composerMessage)}`;
      window.open(waUrl, '_blank', 'noopener,noreferrer');

      setPendingConfirmation({
        channel: 'WHATSAPP',
        recordId: res?.record?.id || '',
        repairId: selectedRepair.id || selectedRepair.repairId,
      });

      toast.info('WhatsApp opened. Please confirm once sent.', { duration: 5000 });
      fetchHistory();
      fetchPendingRepairs();
    } catch (err: any) {
      toast.error(err.message || 'Failed to open WhatsApp.');
    } finally {
      setSubmitting(false);
    }
  };

  // Confirm Sent / Failed action
  const handleConfirmSentStatus = async (status: 'STAFF_CONFIRMED_SENT' | 'FAILED', failureReason?: string) => {
    if (!pendingConfirmation?.recordId && !pendingConfirmation?.repairId) return;

    setSubmitting(true);
    try {
      await api.post('/sms/confirm', {
        smsRecordId: pendingConfirmation.recordId,
        repairId: pendingConfirmation.repairId,
        status,
        failureReason,
      });

      if (status === 'STAFF_CONFIRMED_SENT') {
        toast.success(
          pendingConfirmation.channel === 'WHATSAPP'
            ? 'WhatsApp notification confirmed sent.'
            : 'SMS notification confirmed sent.'
        );
      } else {
        toast.error('Notification logged as failed.');
      }

      setPendingConfirmation(null);
      fetchStats();
      fetchHistory();
      fetchPendingRepairs();
    } catch (err: any) {
      toast.error(err.message || 'Failed to confirm status.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Access Restricted</h2>
        <p className="text-sm text-slate-500">
          The SMS Notification Center is only accessible by Super Admin, Admin, and Receptionist roles.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                SMS Notification Center
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Staff-assisted customer notifications via Windows Phone Link & WhatsApp with single-segment GSM-7 validation.
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
              fetchPendingRepairs();
              fetchHistory();
              toast.success('SMS Center data refreshed.');
            }}
            className="text-xs border-slate-200 dark:border-slate-800"
          >
            <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", statsLoading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
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
              <span>All confirmed SMS</span>
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
              <span>Explicitly verified</span>
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
              <span>Requires attention</span>
            </span>
          </CardContent>
        </Card>

        {/* Pending SMS */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs">
          <CardContent className="p-3.5 sm:p-4">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">Pending / Draft</span>
            <div className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 mt-1">
              {statsLoading ? '...' : stats.pendingSms}
            </div>
            <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1 mt-1">
              <Clock className="w-3 h-3 text-amber-500" />
              <span>Awaiting dispatch</span>
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
              <span>Tracked separately</span>
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Customer Repair Search & Pending Queue (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Customer Repair Search Box */}
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Search className="w-4 h-4 text-cyan-500" />
                <span>Customer Repair Search</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Search by Repair Number (e.g. 10042), Customer Name, Phone, or Device Model.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Enter repair #, phone, customer name..."
                  className="pl-10 h-10 text-xs sm:text-sm bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                />
                {searching && (
                  <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-600 animate-spin" />
                )}
              </div>

              {/* Search Results Dropdown / List */}
              {searchResults.length > 0 && (
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 max-h-56 overflow-y-auto bg-white dark:bg-slate-950">
                  {searchResults.map((rep) => (
                    <button
                      key={rep.id}
                      type="button"
                      onClick={() => handleSelectRepair(rep)}
                      className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-slate-900 flex items-center justify-between transition-colors text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                            #{rep.repairNumber}
                          </span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {rep.customerName}
                          </span>
                          <Badge variant="outline" className="text-[10px]">
                            {rep.status}
                          </Badge>
                        </div>
                        <span className="text-[11px] text-slate-500 block mt-0.5">
                          {rep.deviceBrand} {rep.deviceModel} • {rep.customerPhone}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pending Repaired Devices Queue */}
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Repaired & Ready Queue ({pendingRepairs.length})</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Devices in REPAIRED status awaiting customer pickup notification.
                </CardDescription>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={fetchPendingRepairs}
                className="h-8 text-xs text-slate-500"
              >
                <RefreshCw className={cn("w-3 h-3 mr-1", loadingPending && "animate-spin")} />
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {loadingPending ? (
                <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-cyan-600" />
                  <span>Loading repaired queue...</span>
                </div>
              ) : pendingRepairs.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                  No repaired devices currently waiting for notification.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800/80 max-h-96 overflow-y-auto pr-1">
                  {pendingRepairs.map((item) => {
                    const isSelected = selectedRepair?.id === item.repairId || selectedRepair?.repairNumber === item.repairNumber;
                    const hasSent = item.smsSummary?.status === 'SENT';

                    return (
                      <div
                        key={item.repairId}
                        className={cn(
                          "py-3 px-2 flex items-center justify-between gap-3 rounded-lg transition-colors",
                          isSelected && "bg-cyan-50/50 dark:bg-cyan-950/30"
                        )}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-xs text-slate-900 dark:text-slate-100">
                              #{item.repairNumber}
                            </span>
                            <span className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate">
                              {item.customerName}
                            </span>
                            {hasSent ? (
                              <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400">
                                Notified ({item.smsSummary?.count}x)
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400">
                                Unnotified
                              </Badge>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                            {item.deviceModel} • {item.phoneValidation?.displayFormatted || item.customerPhoneRaw}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            size="sm"
                            variant={isSelected ? "default" : "outline"}
                            className={cn(
                              "h-8 text-xs font-semibold px-2.5",
                              isSelected ? "bg-cyan-600 hover:bg-cyan-700 text-white" : "border-slate-200 dark:border-slate-800"
                            )}
                            onClick={() => handleSelectRepair(item)}
                          >
                            <span>Compose</span>
                            <ArrowRight className="w-3 h-3 ml-1" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Notification Composer for Selected Repair (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm sticky top-6">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Send className="w-4 h-4 text-cyan-500" />
                    <span>Notification Composer</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Review and dispatch customer pickup alert.
                  </CardDescription>
                </div>

                {selectedRepair && (
                  <Badge variant="outline" className="font-mono text-[10px]">
                    #{selectedRepair.repairNumber}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {!selectedRepair ? (
                <div className="py-16 text-center text-xs text-slate-400 space-y-2">
                  <Smartphone className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto" />
                  <p>Select a repair ticket from the search or queue on the left to compose notification.</p>
                </div>
              ) : (
                <>
                  {/* Selected Device Meta */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 dark:text-slate-100">{selectedRepair.customerName}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {selectedRepair.status}
                      </Badge>
                    </div>
                    <div className="text-slate-500 text-[11px]">
                      Device: <span className="font-semibold text-slate-700 dark:text-slate-300">{selectedRepair.deviceBrand} {selectedRepair.deviceModel}</span>
                    </div>

                    <div className="pt-1.5 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{selectedPhoneInfo?.displayFormatted || selectedRepair.customerPhone}</span>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px] text-slate-500"
                        onClick={async () => {
                          const num = selectedPhoneInfo?.international || selectedRepair.customerPhone;
                          await navigator.clipboard.writeText(num);
                          setCopiedComposerPhone(true);
                          toast.success('Phone copied.');
                          setTimeout(() => setCopiedComposerPhone(false), 2000);
                        }}
                      >
                        {copiedComposerPhone ? <Check className="w-3 h-3 text-emerald-600 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                        {copiedComposerPhone ? 'Copied' : 'Copy'}
                      </Button>
                    </div>

                    {selectedPhoneInfo && !selectedPhoneInfo.isValid && (
                      <div className="p-2 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 text-[11px] flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{selectedPhoneInfo.error}</span>
                      </div>
                    )}
                  </div>

                  {/* Post-Trigger Confirmation Banner */}
                  {pendingConfirmation && (
                    <div className="p-3.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/70 border-2 border-cyan-400 dark:border-cyan-600 space-y-2.5 animate-in fade-in">
                      <div className="flex items-start gap-2">
                        <Send className="w-4 h-4 text-cyan-600 shrink-0 mt-0.5" />
                        <div className="text-xs">
                          <h4 className="font-bold text-slate-900 dark:text-slate-100">
                            Did you successfully dispatch this {pendingConfirmation.channel === 'WHATSAPP' ? 'WhatsApp' : 'SMS'}?
                          </h4>
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                            Please confirm whether the customer was notified.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          size="sm"
                          className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                          onClick={() => handleConfirmSentStatus('STAFF_CONFIRMED_SENT')}
                          disabled={submitting}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                          Confirm Sent
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400"
                          onClick={() => handleConfirmSentStatus('FAILED', 'Delivery failed or cancelled')}
                          disabled={submitting}
                        >
                          Report Failed
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-slate-500"
                          onClick={() => setPendingConfirmation(null)}
                          disabled={submitting}
                        >
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Message Composer Field */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <Label htmlFor="composer-text" className="font-bold text-slate-700 dark:text-slate-300">
                        Message Content
                      </Label>
                      <Badge variant="outline" className={cn(
                        "text-[10px] font-mono",
                        composerEncoding.encoding === 'GSM_7'
                          ? "text-cyan-700 bg-cyan-50 border-cyan-200 dark:text-cyan-300 dark:bg-cyan-950/60"
                          : "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/60"
                      )}>
                        {composerEncoding.encoding} Encoding
                      </Badge>
                    </div>

                    <Textarea
                      id="composer-text"
                      value={composerMessage}
                      onChange={(e) => setComposerMessage(e.target.value)}
                      rows={4}
                      className={cn(
                        "text-xs resize-none focus:ring-cyan-500",
                        !composerEncoding.isSingleSegment && "border-rose-400 focus:border-rose-500"
                      )}
                      placeholder="Type completed repair SMS..."
                    />

                    {/* Segment & Char Counter */}
                    <div className="flex items-center justify-between text-xs px-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className={cn(
                          "font-mono font-bold text-[11px]",
                          !composerEncoding.isSingleSegment ? "text-rose-600 dark:text-rose-400" : "text-slate-600 dark:text-slate-400"
                        )}>
                          {composerEncoding.unitsUsed}/{composerEncoding.maxUnitsSingleSegment} units
                        </span>
                        <Badge variant="outline" className={cn(
                          "text-[9px] font-bold px-1.5 py-0",
                          composerEncoding.isSingleSegment
                            ? "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/50"
                            : "text-rose-700 bg-rose-50 border-rose-300 dark:text-rose-400 dark:bg-rose-950/50"
                        )}>
                          {composerEncoding.segmentCount}/1 Segment
                        </Badge>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-5 text-[10px] text-cyan-600 hover:text-cyan-700 px-1"
                        onClick={async () => {
                          await navigator.clipboard.writeText(composerMessage);
                          setCopiedComposerMsg(true);
                          toast.success('Message copied.');
                          setTimeout(() => setCopiedComposerMsg(false), 2000);
                        }}
                      >
                        {copiedComposerMsg ? <Check className="w-3 h-3 mr-0.5 text-emerald-600" /> : <Copy className="w-3 h-3 mr-0.5" />}
                        {copiedComposerMsg ? 'Copied' : 'Copy'}
                      </Button>
                    </div>

                    {!composerEncoding.isSingleSegment && (
                      <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-[11px] flex items-start gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>Single-segment policy: Trim text to fit 1 SMS (max {composerEncoding.maxUnitsSingleSegment} {composerEncoding.encoding === 'GSM_7' ? 'septets' : 'chars'}).</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="space-y-2 pt-2">
                    <Button
                      type="button"
                      className="w-full h-10 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm"
                      onClick={handleComposerSendPhoneLink}
                      disabled={!selectedPhoneInfo?.isValid || !composerEncoding.isSingleSegment || submitting || !composerMessage.trim()}
                    >
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
                      <span>Send via Windows Phone Link</span>
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-10 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 font-bold text-xs flex items-center justify-center gap-2"
                      onClick={handleComposerSendWhatsApp}
                      disabled={!selectedPhoneInfo?.isValid || submitting || !composerMessage.trim()}
                    >
                      <MessageSquare className="w-4 h-4 text-emerald-600" />
                      <span>Send via WhatsApp</span>
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom Section: Comprehensive Notification Audit History */}
      <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-500" />
              <span>SMS & WhatsApp Dispatch History ({historyTotal})</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Audit log of all prepared, opened, staff-confirmed, and failed customer notifications.
            </CardDescription>
          </div>

          {/* History Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Search history..."
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
                setTimeout(fetchHistory, 50);
              }}
              aria-label="Filter notification history by status"
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
                setTimeout(fetchHistory, 50);
              }}
              aria-label="Filter notification history by channel"
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
              Apply
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-cyan-600" />
              <span>Loading notification records...</span>
            </div>
          ) : historyList.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
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
                    <th className="py-2.5 px-3">Date & Time</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
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
                          #{item.repairNumber}
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
                        <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                          {item.createdAt ? new Date(item.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-cyan-600 hover:text-cyan-700"
                            onClick={() => {
                              setModalRepair({
                                id: item.repairId,
                                repairNumber: item.repairNumber,
                                customerName: item.customerName,
                                customerPhone: item.customerPhoneRaw || item.customerPhoneNormalized,
                                deviceModel: item.deviceModel,
                                deviceBrand: item.deviceBrand,
                              });
                              setIsModalOpen(true);
                            }}
                          >
                            <span>Open Details</span>
                          </Button>
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

      {/* Modal Popup helper if launched */}
      {modalRepair && (
        <SendSmsModal
          open={isModalOpen}
          onOpenChange={(val) => {
            setIsModalOpen(val);
            if (!val) {
              fetchStats();
              fetchHistory();
              fetchPendingRepairs();
            }
          }}
          repair={modalRepair}
          onSuccess={() => {
            fetchStats();
            fetchHistory();
            fetchPendingRepairs();
          }}
        />
      )}
    </div>
  );
}
