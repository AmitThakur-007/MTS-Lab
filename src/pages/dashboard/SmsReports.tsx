import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  FileText,
  Calendar,
  Filter,
  Download,
  Users,
  Smartphone,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  Search,
  RefreshCw,
  Info,
  TrendingUp,
  Loader2,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/utils';

export default function SmsReports() {
  const { user } = useAuthStore();
  const userRole = (user?.role || '').toUpperCase().trim();
  const isAuthorized = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(userRole);

  const [filterPreset, setFilterPreset] = useState<string>('THIS_MONTH');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<{
    totalSmsSent: number;
    staffConfirmedSms: number;
    carrierConfirmedDelivered: number;
    failedSms: number;
    pendingSms: number;
    whatsappSent: number;
    staffActivity: any[];
    dailyStats: any[];
  }>({
    totalSmsSent: 0,
    staffConfirmedSms: 0,
    carrierConfirmedDelivered: 0,
    failedSms: 0,
    pendingSms: 0,
    whatsappSent: 0,
    staffActivity: [],
    dailyStats: [],
  });

  const [historyList, setHistoryList] = useState<any[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('ALL');
  const [historyChannelFilter, setHistoryChannelFilter] = useState('ALL');

  const fetchReportData = async () => {
    try {
      setLoading(true);

      const params: any = {
        filterPreset,
      };
      if (filterPreset === 'CUSTOM') {
        if (customStart) params.startDate = new Date(customStart).toISOString();
        if (customEnd) params.endDate = new Date(customEnd).toISOString();
      }

      const queryStr = new URLSearchParams(params).toString();
      const statsRes = await api.get(`/sms/stats?${queryStr}`);
      if (statsRes) {
        setStats({
          totalSmsSent: statsRes.totalSmsSent || 0,
          staffConfirmedSms: statsRes.staffConfirmedSms || 0,
          carrierConfirmedDelivered: statsRes.carrierConfirmedDelivered || 0,
          failedSms: statsRes.failedSms || 0,
          pendingSms: statsRes.pendingSms || 0,
          whatsappSent: statsRes.whatsappSent || 0,
          staffActivity: statsRes.staffActivity || [],
          dailyStats: statsRes.dailyStats || [],
        });
      }

      // Fetch history with corresponding dates
      const histParams: any = {
        limit: 100,
      };
      if (historySearch.trim()) histParams.search = historySearch.trim();
      if (historyStatusFilter !== 'ALL') histParams.status = historyStatusFilter;
      if (historyChannelFilter !== 'ALL') histParams.channel = historyChannelFilter;
      if (statsRes?.filter?.startDate) histParams.startDate = statsRes.filter.startDate;
      if (statsRes?.filter?.endDate) histParams.endDate = statsRes.filter.endDate;

      const histQuery = new URLSearchParams(histParams).toString();
      const histRes = await api.get(`/sms/notifications?${histQuery}`);
      if (histRes) {
        setHistoryList(histRes.items || []);
        setHistoryTotal(histRes.total || 0);
      }
    } catch (err) {
      console.warn('[FETCH SMS REPORT WARN]', err);
      toast.error('Failed to load SMS report data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthorized) return;
    fetchReportData();
  }, [filterPreset, isAuthorized]);

  // Export report summary to CSV
  const handleExportCsv = () => {
    try {
      const rows = [
        ['Repair Number', 'Customer Name', 'Phone', 'Channel', 'Status', 'Staff Member', 'Role', 'Date'],
        ...historyList.map((h) => [
          `#${h.repairNumber || ''}`,
          `"${(h.customerName || '').replace(/"/g, '""')}"`,
          `'${h.customerPhoneNormalized || h.customerPhoneRaw || ''}`,
          h.channel || 'SMS',
          h.status || 'UNKNOWN',
          `"${(h.senderStaffName || '').replace(/"/g, '""')}"`,
          h.senderStaffRole || '',
          h.createdAt || '',
        ]),
      ];

      const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `MTS_Lab_SMS_Report_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('SMS Report exported to CSV.');
    } catch (e) {
      toast.error('Failed to export CSV report.');
    }
  };

  if (!isAuthorized) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Access Restricted</h2>
        <p className="text-sm text-slate-500">
          SMS Reports are accessible exclusively to Management and Administrative roles.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                  SMS & Messaging Reports
                </h1>
                <Badge variant="outline" className="text-[10px] font-bold border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40">
                  Strictly Read-Only
                </Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Operational analytics, staff-wise notification volume, and delivery compliance audit.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchReportData}
            className="text-xs border-slate-200 dark:border-slate-800"
          >
            <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={handleExportCsv}
            disabled={historyList.length === 0}
            className="text-xs bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-bold"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Strict Read-Only Governance Notice */}
      <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 text-xs flex items-center justify-between flex-wrap gap-2 text-slate-600 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-cyan-600 shrink-0" />
          <span>
            <strong>Manager Audit View:</strong> This section provides immutable reporting data calculated directly from the database. Sending, editing templates, and record deletions are disabled.
          </span>
        </div>
        <span className="font-mono text-[11px] text-slate-500">
          Role: {userRole}
        </span>
      </div>

      {/* Date Filter Bar */}
      <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 mr-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Period:</span>
              </span>

              {[
                { label: 'Today', value: 'TODAY' },
                { label: 'Yesterday', value: 'YESTERDAY' },
                { label: 'Last 7 Days', value: 'LAST_7_DAYS' },
                { label: 'Last 30 Days', value: 'LAST_30_DAYS' },
                { label: 'This Month', value: 'THIS_MONTH' },
                { label: 'All Time', value: 'ALL' },
                { label: 'Custom', value: 'CUSTOM' },
              ].map((preset) => (
                <Button
                  key={preset.value}
                  type="button"
                  size="sm"
                  variant={filterPreset === preset.value ? "default" : "outline"}
                  className={cn(
                    "h-7 text-xs font-semibold px-2.5",
                    filterPreset === preset.value
                      ? "bg-cyan-600 text-white hover:bg-cyan-700"
                      : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                  )}
                  onClick={() => setFilterPreset(preset.value)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>

            {filterPreset === 'CUSTOM' && (
              <div className="flex items-center gap-2 pt-2 sm:pt-0">
                <Input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="h-7 text-xs w-32 bg-slate-50 dark:bg-slate-950"
                  aria-label="Custom report start date"
                />
                <span className="text-xs text-slate-400">to</span>
                <Input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="h-7 text-xs w-32 bg-slate-50 dark:bg-slate-950"
                  aria-label="Custom report end date"
                />
                <Button
                  size="sm"
                  onClick={fetchReportData}
                  className="h-7 text-xs bg-cyan-600 hover:bg-cyan-700 text-white"
                >
                  Apply
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Aggregate Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Total SMS Sent */}
        <Card className="bg-slate-900 border-slate-800 text-white shadow-md">
          <CardContent className="p-3.5 sm:p-4">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Total SMS Sent</span>
            <div className="text-2xl sm:text-3xl font-black text-white mt-1">
              {loading ? '...' : stats.totalSmsSent}
            </div>
            <span className="text-[10px] text-cyan-400 font-medium flex items-center gap-1 mt-1">
              <Smartphone className="w-3 h-3" />
              <span>SMS channel total</span>
            </span>
          </CardContent>
        </Card>

        {/* Staff-Confirmed Sent */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs">
          <CardContent className="p-3.5 sm:p-4">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">Staff-Confirmed</span>
            <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {loading ? '...' : stats.staffConfirmedSms}
            </div>
            <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1 mt-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              <span>Verified by staff</span>
            </span>
          </CardContent>
        </Card>

        {/* Carrier Confirmed Delivered */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs">
          <CardContent className="p-3.5 sm:p-4">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">Carrier Delivered</span>
            <div className="text-2xl sm:text-3xl font-black text-cyan-600 dark:text-cyan-400 mt-1">
              {loading ? '...' : stats.carrierConfirmedDelivered}
            </div>
            <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1 mt-1">
              <ShieldCheck className="w-3 h-3 text-cyan-500" />
              <span>Network receipt</span>
            </span>
          </CardContent>
        </Card>

        {/* Failed SMS Attempts */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs">
          <CardContent className="p-3.5 sm:p-4">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">Failed SMS</span>
            <div className="text-2xl sm:text-3xl font-black text-rose-600 dark:text-rose-400 mt-1">
              {loading ? '...' : stats.failedSms}
            </div>
            <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1 mt-1">
              <XCircle className="w-3 h-3 text-rose-500" />
              <span>Reported failed</span>
            </span>
          </CardContent>
        </Card>

        {/* Pending SMS */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs">
          <CardContent className="p-3.5 sm:p-4">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">Pending SMS</span>
            <div className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 mt-1">
              {loading ? '...' : stats.pendingSms}
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
              {loading ? '...' : stats.whatsappSent}
            </div>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 mt-1">
              <MessageSquare className="w-3 h-3" />
              <span>Alternative channel</span>
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Staff Activity Breakdown Table */}
      <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Users className="w-4 h-4 text-cyan-500" />
            <span>Staff-Wise Notification Activity</span>
          </CardTitle>
          <CardDescription className="text-xs">
            Performance and volume metrics for each staff member dispatching customer notifications.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stats.staffActivity.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
              No staff activity recorded for the selected period.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    <th className="py-2.5 px-3">Staff Member</th>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3 text-center">SMS Sent</th>
                    <th className="py-2.5 px-3 text-center">WhatsApp Sent</th>
                    <th className="py-2.5 px-3 text-center">Failed</th>
                    <th className="py-2.5 px-3 text-center">Pending Drafts</th>
                    <th className="py-2.5 px-3 text-right">Total Dispatches</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {stats.staffActivity.map((staff) => (
                    <tr key={staff.staffId} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100">
                        {staff.staffName}
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge variant="outline" className="text-[10px]">
                          {staff.staffRole}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-emerald-600 dark:text-emerald-400">
                        {staff.smsSent}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-teal-600 dark:text-teal-400">
                        {staff.whatsappSent}
                      </td>
                      <td className="py-2.5 px-3 text-center font-semibold text-rose-600 dark:text-rose-400">
                        {staff.failed}
                      </td>
                      <td className="py-2.5 px-3 text-center text-amber-600 dark:text-amber-400">
                        {staff.pending}
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-slate-900 dark:text-slate-100 font-mono">
                        {staff.totalActions}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Date-wise Timeline Breakdown */}
      {stats.dailyStats.length > 0 && (
        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyan-500" />
              <span>Daily Notification Volume</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Chronological notification volume across the selected time period.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3 text-center">SMS Sent</th>
                    <th className="py-2 px-3 text-center">WhatsApp Sent</th>
                    <th className="py-2 px-3 text-center">Failed</th>
                    <th className="py-2 px-3 text-right">Total Daily Sent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {stats.dailyStats.map((day) => (
                    <tr key={day.date} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                      <td className="py-2 px-3 font-mono text-slate-800 dark:text-slate-200">
                        {day.date}
                      </td>
                      <td className="py-2 px-3 text-center font-bold text-cyan-600">
                        {day.smsSent}
                      </td>
                      <td className="py-2 px-3 text-center font-bold text-emerald-600">
                        {day.whatsappSent}
                      </td>
                      <td className="py-2 px-3 text-center text-rose-600">
                        {day.failed}
                      </td>
                      <td className="py-2 px-3 text-right font-black font-mono">
                        {day.smsSent + day.whatsappSent}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Complete Permitted Notification History */}
      <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-500" />
              <span>Full Notification Audit Log ({historyTotal})</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Complete historical record of customer alerts within the selected period.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Search logs..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchReportData()}
                className="h-8 text-xs pl-8 w-36 sm:w-48 bg-slate-50 dark:bg-slate-950"
              />
            </div>

            <select
              value={historyStatusFilter}
              onChange={(e) => {
                setHistoryStatusFilter(e.target.value);
                setTimeout(fetchReportData, 50);
              }}
              aria-label="Filter notification logs by status"
              className="h-8 text-xs rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2 text-slate-700 dark:text-slate-300"
            >
              <option value="ALL">All Statuses</option>
              <option value="STAFF_CONFIRMED_SENT">Confirmed Sent</option>
              <option value="PENDING">Pending</option>
              <option value="FAILED">Failed</option>
            </select>

            <select
              value={historyChannelFilter}
              onChange={(e) => {
                setHistoryChannelFilter(e.target.value);
                setTimeout(fetchReportData, 50);
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
              onClick={fetchReportData}
              className="h-8 text-xs"
            >
              <Filter className="w-3 h-3 mr-1" />
              Filter
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-cyan-600" />
              <span>Loading audit logs...</span>
            </div>
          ) : historyList.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
              No notification logs found for the selected period.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    <th className="py-2.5 px-3">Ticket #</th>
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3">Phone</th>
                    <th className="py-2.5 px-3">Channel</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Staff</th>
                    <th className="py-2.5 px-3">Message Preview</th>
                    <th className="py-2.5 px-3 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {historyList.map((log) => {
                    const isConfirmed = log.status === 'STAFF_CONFIRMED_SENT' || log.status === 'SENT';
                    const isFailed = log.status === 'FAILED';
                    const isWa = log.channel === 'WHATSAPP';

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                          #{log.repairNumber}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                          {log.customerName}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400">
                          {log.customerPhoneNormalized || log.customerPhoneRaw}
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge variant="outline" className={cn(
                            "text-[10px]",
                            isWa ? "text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400" : "text-slate-600 dark:text-slate-300"
                          )}>
                            {isWa ? 'WhatsApp' : log.channel?.replace(/_/g, ' ') || 'SMS'}
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
                            {log.status.replace(/_/g, ' ')}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                          {log.senderStaffName}
                        </td>
                        <td className="py-2.5 px-3 max-w-[240px] truncate text-slate-500 italic">
                          "{log.messageContent}"
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-400 text-[11px] font-mono">
                          {log.createdAt ? new Date(log.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '—'}
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
    </div>
  );
}
