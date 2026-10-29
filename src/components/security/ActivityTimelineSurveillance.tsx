import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Search, 
  Filter, 
  Calendar, 
  Download, 
  ChevronLeft, 
  ChevronRight, 
  User, 
  ShieldAlert, 
  ShieldCheck, 
  KeyRound, 
  Laptop, 
  Database, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  Info,
  Clock,
  RefreshCw,
  Trash2,
  AlertTriangle,
  CheckSquare,
  Square,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/authStore';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { format, formatDistanceToNow } from 'date-fns';
import { api } from '@/services/api';
import { toast } from 'sonner';

interface AuditLog {
  id: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
  userRole?: string;
  action: string;
  resource: string;
  resourceId?: string;
  status: string;
  ipAddress?: string;
  userAgent?: string;
  deviceInfo?: string;
  details?: string;
  previousValue?: string;
  newValue?: string;
  metadata?: string;
  createdAt: string;
}

interface ActivityTimelineSurveillanceProps {
  initialUserId?: string | null;
  staffList: any[];
}

export default function ActivityTimelineSurveillance({
  initialUserId,
  staffList,
}: ActivityTimelineSurveillanceProps) {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(25);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Super Admin Log Deletion & Selection States
  const [selectedLogIds, setSelectedLogIds] = useState<string[]>([]);
  const [isSingleDeleteOpen, setIsSingleDeleteOpen] = useState(false);
  const [targetDeleteLog, setTargetDeleteLog] = useState<AuditLog | null>(null);
  const [singleDeleting, setSingleDeleting] = useState(false);

  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [isClearLogsOpen, setIsClearLogsOpen] = useState(false);
  const [clearCategory, setClearCategory] = useState('ALL');
  const [clearConfirmPhrase, setClearConfirmPhrase] = useState('');
  const [clearDeleting, setClearDeleting] = useState(false);

  const handleToggleSelectAll = () => {
    if (selectedLogIds.length === logs.length && logs.length > 0) {
      setSelectedLogIds([]);
    } else {
      setSelectedLogIds(logs.map((l) => l.id));
    }
  };

  const handleToggleSelectLog = (id: string) => {
    setSelectedLogIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const confirmDeleteSingleLog = async () => {
    if (!targetDeleteLog) return;
    setSingleDeleting(true);
    try {
      const res: any = await api.delete(`/security/activity-timeline/${targetDeleteLog.id}`);
      if (res && (res.success || res.deletedCount)) {
        toast.success('Activity log record permanently deleted.');
        setIsSingleDeleteOpen(false);
        setTargetDeleteLog(null);
        setSelectedLogIds((prev) => prev.filter((i) => i !== targetDeleteLog.id));
        await fetchTimeline();
      } else {
        throw new Error(res?.error || res?.message || 'Failed to delete record.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete activity log.');
    } finally {
      setSingleDeleting(false);
    }
  };

  const confirmBulkDeleteLogs = async () => {
    if (selectedLogIds.length === 0) return;
    setBulkDeleting(true);
    try {
      const res: any = await api.post('/security/activity-timeline/bulk-delete', { ids: selectedLogIds });
      if (res && (res.success || res.deletedCount !== undefined)) {
        toast.success(res.message || `Permanently deleted ${res.deletedCount} log records.`);
        setIsBulkDeleteOpen(false);
        setSelectedLogIds([]);
        await fetchTimeline();
      } else {
        throw new Error(res?.error || res?.message || 'Failed to bulk-delete records.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to bulk-delete activity records.');
    } finally {
      setBulkDeleting(false);
    }
  };

  const confirmClearLogs = async () => {
    if (clearConfirmPhrase !== 'PERMANENTLY_DELETE') {
      toast.error("Type 'PERMANENTLY_DELETE' exactly to confirm dataset purge.");
      return;
    }
    setClearDeleting(true);
    try {
      const res: any = await api.post('/security/activity-timeline/clear', {
        category: clearCategory,
        confirmPhrase: clearConfirmPhrase,
      });
      if (res && (res.success || res.deletedCount !== undefined)) {
        toast.success(res.message || `Cleared ${res.deletedCount} records.`);
        setIsClearLogsOpen(false);
        setClearConfirmPhrase('');
        setSelectedLogIds([]);
        await fetchTimeline();
      } else {
        throw new Error(res?.error || res?.message || 'Failed to clear activity timeline.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to clear activity timeline.');
    } finally {
      setClearDeleting(false);
    }
  };

  // Filters
  const [selectedStaffId, setSelectedStaffId] = useState<string>(initialUserId || 'ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [resourceFilter, setResourceFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const hasActiveFilters =
    selectedStaffId !== 'ALL' ||
    categoryFilter !== 'ALL' ||
    resourceFilter !== 'ALL' ||
    statusFilter !== 'ALL' ||
    searchQuery.trim().length > 0 ||
    Boolean(startDate) ||
    Boolean(endDate);

  const handleResetFilters = () => {
    setSelectedStaffId('ALL');
    setCategoryFilter('ALL');
    setResourceFilter('ALL');
    setStatusFilter('ALL');
    setSearchQuery('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  useEffect(() => {
    if (initialUserId) {
      setSelectedStaffId(initialUserId);
    }
  }, [initialUserId]);

  const fetchTimeline = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(selectedStaffId !== 'ALL' ? { userId: selectedStaffId } : {}),
        ...(categoryFilter !== 'ALL' ? { category: categoryFilter } : {}),
        ...(resourceFilter !== 'ALL' ? { resource: resourceFilter } : {}),
        ...(statusFilter !== 'ALL' ? { status: statusFilter } : {}),
        ...(searchQuery.trim() ? { search: searchQuery.trim() } : {}),
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
      });

      const res = await api.get(`/security/activity-timeline?${params.toString()}`);
      if (res && (res.success || Array.isArray(res.logs))) {
        setLogs(res.logs || []);
        setTotal(res.total || 0);
        setTotalPages(res.totalPages || Math.ceil((res.total || 0) / limit) || 1);
        setError(null);
      } else {
        throw new Error(res?.error || 'Failed to retrieve activity timeline.');
      }
    } catch (err: any) {
      console.error('[ACTIVITY TIMELINE LOAD ERROR]', err);
      const errMsg = err?.message || 'Failed to load system activity logs.';
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimeline();
  }, [page, selectedStaffId, categoryFilter, resourceFilter, statusFilter, startDate, endDate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchTimeline();
  };

  const handleExportCSV = () => {
    if (logs.length === 0) {
      toast.error('No log records available to export.');
      return;
    }

    const headers = ['Timestamp', 'Action', 'Resource', 'Resource ID', 'Status', 'Staff Name', 'Email', 'Role', 'IP Address', 'Details'];
    const rows = logs.map(l => [
      format(new Date(l.createdAt), 'yyyy-MM-dd HH:mm:ss'),
      `"${l.action || ''}"`,
      `"${l.resource || ''}"`,
      `"${l.resourceId || ''}"`,
      `"${l.status || ''}"`,
      `"${l.userName || ''}"`,
      `"${l.userEmail || ''}"`,
      `"${l.userRole || ''}"`,
      `"${l.ipAddress || ''}"`,
      `"${(l.details || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `MTS_Security_Audit_Log_${format(new Date(), 'yyyy-MM-dd_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Security audit log exported to CSV.');
  };

  const getActionBadge = (action: string, status: string) => {
    const isFail = status === 'FAILED';
    if (isFail) {
      return (
        <Badge className="bg-rose-100 text-rose-800 border-rose-200 gap-1 font-mono text-[10px]">
          <ShieldAlert className="w-3 h-3" /> {action}
        </Badge>
      );
    }

    if (action.includes('LOGIN')) {
      return (
        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 gap-1 font-mono text-[10px]">
          <KeyRound className="w-3 h-3" /> {action}
        </Badge>
      );
    }

    if (action.includes('DEVICE') || action.includes('BLOCKED') || action.includes('REVOKE')) {
      return (
        <Badge className="bg-amber-100 text-amber-800 border-amber-200 gap-1 font-mono text-[10px]">
          <Laptop className="w-3 h-3" /> {action}
        </Badge>
      );
    }

    if (action.includes('DELETE') || action.includes('PURGE')) {
      return (
        <Badge className="bg-red-100 text-red-800 border-red-200 gap-1 font-mono text-[10px]">
          {action}
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="font-mono text-[10px] text-slate-700 bg-slate-50">
        {action}
      </Badge>
    );
  };

  return (
    <Card id="activity-timeline-surveillance-card" className="border-slate-200/80 shadow-xs bg-white">
      <CardHeader className="p-5 border-b border-slate-100 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              System Activity &amp; Audit Surveillance Timeline
            </CardTitle>
            <CardDescription className="text-slate-500 text-xs mt-0.5">
              Authoritative, tamper-evident audit record capturing authentication, authorization, and administrative events.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isSuperAdmin && selectedLogIds.length > 0 && (
              <Button
                id="bulk-delete-timeline-btn"
                variant="destructive"
                size="sm"
                onClick={() => setIsBulkDeleteOpen(true)}
                className="h-8 text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold"
                title="Bulk delete selected records"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete Selected ({selectedLogIds.length})
              </Button>
            )}
            {isSuperAdmin && (
              <Button
                id="clear-timeline-btn"
                variant="outline"
                size="sm"
                onClick={() => setIsClearLogsOpen(true)}
                className="h-8 text-xs bg-white border-rose-200 text-rose-700 hover:bg-rose-50 font-bold"
                title="Clear activity timeline category"
              >
                <AlertTriangle className="w-3.5 h-3.5 mr-1 text-rose-600" /> Clear Timeline
              </Button>
            )}
            <Button
              id="export-audit-csv-btn"
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="h-8 text-xs bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <Download className="w-3.5 h-3.5 mr-1" /> Export CSV
            </Button>
            <Button
              id="refresh-timeline-btn"
              variant="outline"
              size="sm"
              onClick={() => fetchTimeline()}
              className="h-8 text-xs bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
            </Button>
          </div>
        </div>

        {/* Multi-criteria filters */}
        <div className="mt-4 space-y-3">
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                id="timeline-search-input"
                placeholder="Search by staff name, action, resource, IP, or payload details..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-sm h-9 bg-slate-50/50"
              />
            </div>
            <Button type="submit" size="sm" className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs">
              Search
            </Button>
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2.5 text-xs">
            {/* Staff Filter */}
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Staff Member</label>
              <select
                id="timeline-staff-filter"
                value={selectedStaffId}
                onChange={(e) => {
                  setSelectedStaffId(e.target.value);
                  setPage(1);
                }}
                className="w-full h-8 bg-slate-50 border border-slate-200 rounded-md px-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">All Staff Personnel</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Action Category</label>
              <select
                id="timeline-category-filter"
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full h-8 bg-slate-50 border border-slate-200 rounded-md px-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">All Categories</option>
                <option value="AUTH">Authentication (Login/Logout/2FA)</option>
                <option value="SECURITY">Security &amp; Device Restrictions</option>
                <option value="DATA_MUTATION">Data Mutations (Create/Update/Delete)</option>
              </select>
            </div>

            {/* Resource Filter */}
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Resource Entity</label>
              <select
                id="timeline-resource-filter"
                value={resourceFilter}
                onChange={(e) => {
                  setResourceFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full h-8 bg-slate-50 border border-slate-200 rounded-md px-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">All Resources</option>
                <option value="User">User Accounts</option>
                <option value="ApprovedDevice">Approved Devices</option>
                <option value="AccessRequest">Access Requests</option>
                <option value="Repair">Repairs</option>
                <option value="Customer">Customers</option>
                <option value="InventoryItem">Inventory</option>
                <option value="BatteryWarranty">Battery Warranties</option>
                <option value="Attendance">Attendance</option>
              </select>
            </div>

            {/* Date Range Start */}
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">From Date</label>
              <Input
                id="timeline-start-date"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="h-8 text-xs bg-slate-50/50"
              />
            </div>

            {/* Date Range End */}
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">To Date</label>
              <Input
                id="timeline-end-date"
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="h-8 text-xs bg-slate-50/50"
              />
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table id="timeline-audit-table">
            <TableHeader className="bg-slate-50/80">
              <TableRow>
                {isSuperAdmin && (
                  <TableHead className="w-10 text-center">
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      className="p-1 hover:bg-slate-200 rounded cursor-pointer"
                      title={selectedLogIds.length === logs.length && logs.length > 0 ? "Deselect all" : "Select all logs on page"}
                    >
                      {logs.length > 0 && selectedLogIds.length === logs.length ? (
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  </TableHead>
                )}
                <TableHead className="w-[180px]">Timestamp</TableHead>
                <TableHead>Staff Identity</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target Resource</TableHead>
                <TableHead>Network / IP</TableHead>
                <TableHead>Details Summary</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={isSuperAdmin ? 8 : 7} className="text-center py-12 text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-xs">Querying audit logs...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={isSuperAdmin ? 8 : 7} className="text-center py-10 text-rose-600">
                    <p className="text-sm font-bold text-rose-700">{error}</p>
                    <p className="text-xs text-slate-500 mt-1">Unable to load activity logs from server.</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => fetchTimeline()}
                      className="mt-3 h-8 px-4 text-xs font-bold border-rose-200 text-rose-700 hover:bg-rose-50"
                    >
                      Retry
                    </Button>
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isSuperAdmin ? 8 : 7} className="text-center py-10 text-slate-500">
                    <p className="text-sm font-medium text-slate-700">
                      {hasActiveFilters ? 'No activity records match your criteria.' : 'No activity records logged in system yet.'}
                    </p>
                    {hasActiveFilters && (
                      <div className="mt-2">
                        <p className="text-xs text-slate-400 mb-2">Try broadening your date range or clearing specific filters.</p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleResetFilters}
                          className="h-8 px-3 text-xs font-bold"
                        >
                          Reset Filters
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id} id={`audit-log-row-${log.id}`} className={`hover:bg-slate-50/60 ${selectedLogIds.includes(log.id) ? 'bg-blue-50/40' : ''}`}>
                    {isSuperAdmin && (
                      <TableCell className="text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleSelectLog(log.id)}
                          className="p-1 hover:bg-slate-200 rounded cursor-pointer"
                          title="Select record for deletion"
                        >
                          {selectedLogIds.includes(log.id) ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300" />
                          )}
                        </button>
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="text-xs">
                        <p className="font-semibold text-slate-800">
                          {format(new Date(log.createdAt), 'MMM d, yyyy')}
                        </p>
                        <p className="text-[11px] text-slate-500 font-mono">
                          {format(new Date(log.createdAt), 'HH:mm:ss')}
                        </p>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="text-xs">
                        <p className="font-medium text-slate-900">{log.userName || log.userEmail || 'System Process'}</p>
                        {log.userRole && (
                          <span className="text-[10px] text-slate-400 font-mono">{log.userRole}</span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      {getActionBadge(log.action, log.status)}
                    </TableCell>

                    <TableCell>
                      <div className="text-xs">
                        <span className="font-medium text-slate-800">{log.resource}</span>
                        {log.resourceId && (
                          <span className="text-[10px] text-slate-400 block font-mono truncate max-w-[120px]">
                            #{log.resourceId}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="text-xs">
                        {log.ipAddress ? (
                          <span className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-sm border border-slate-200">
                            {log.ipAddress}
                          </span>
                        ) : (
                          <span className="text-slate-400">Internal</span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      <p className="text-xs text-slate-600 truncate max-w-[280px]">
                        {log.details ? (typeof log.details === 'string' ? log.details : JSON.stringify(log.details)) : '—'}
                      </p>
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          id={`inspect-log-btn-${log.id}`}
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedLog(log)}
                          className="h-7 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                          title="Inspect details"
                        >
                          <Info className="w-3.5 h-3.5 mr-1" />
                          Details
                        </Button>
                        {isSuperAdmin && (
                          <Button
                            id={`delete-log-btn-${log.id}`}
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setTargetDeleteLog(log);
                              setIsSingleDeleteOpen(true);
                            }}
                            className="h-7 text-xs text-rose-600 hover:text-rose-800 hover:bg-rose-50"
                            title="Permanently Delete Log Record (Super Admin)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination bar */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Showing <span className="font-semibold text-slate-800">{logs.length}</span> of{' '}
            <span className="font-semibold text-slate-800">{total}</span> total events
          </p>

          <div className="flex items-center gap-2">
            <Button
              id="timeline-prev-page-btn"
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="h-8 text-xs"
            >
              <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Prev
            </Button>
            <span className="text-xs text-slate-600 px-2 font-medium">
              Page {page} of {totalPages}
            </span>
            <Button
              id="timeline-next-page-btn"
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="h-8 text-xs"
            >
              Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </CardContent>

      {/* Log Details Inspector Modal */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <Activity className="w-5 h-5 text-blue-600" />
              Audit Event Forensics Inspector
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Complete metadata snapshot for event #{selectedLog?.id}
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4 py-2 text-xs">
              <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-2">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="text-slate-500">Action:</span>
                  <span className="font-mono font-bold text-slate-900">{selectedLog.action}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Resource Entity:</span>
                  <span className="font-semibold text-slate-800">{selectedLog.resource} {selectedLog.resourceId && `(#${selectedLog.resourceId})`}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Status:</span>
                  <span className={`font-bold ${selectedLog.status === 'SUCCESS' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {selectedLog.status}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Staff Account:</span>
                  <span className="font-medium text-slate-800">{selectedLog.userName} ({selectedLog.userEmail || 'System'})</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">IP Address:</span>
                  <span className="font-mono bg-white px-2 py-0.5 rounded-sm border border-slate-200 text-slate-800">
                    {selectedLog.ipAddress || 'Not recorded'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Timestamp:</span>
                  <span className="text-slate-800 font-medium">{format(new Date(selectedLog.createdAt), 'PPpp')}</span>
                </div>
              </div>

              {selectedLog.details && (
                <div>
                  <p className="font-medium text-slate-700 mb-1">Details Payload:</p>
                  <pre className="bg-slate-900 text-slate-100 p-3 rounded-md font-mono text-[11px] overflow-x-auto">
                    {(() => {
                      try {
                        return JSON.stringify(typeof selectedLog.details === 'string' ? JSON.parse(selectedLog.details) : selectedLog.details, null, 2);
                      } catch {
                        return selectedLog.details;
                      }
                    })()}
                  </pre>
                </div>
              )}

              {selectedLog.deviceInfo && (
                <div>
                  <p className="font-medium text-slate-700 mb-1">Device / Hardware Context:</p>
                  <pre className="bg-slate-100 text-slate-800 p-2.5 rounded-md font-mono text-[10px] overflow-x-auto">
                    {(() => {
                      try {
                        return JSON.stringify(typeof selectedLog.deviceInfo === 'string' ? JSON.parse(selectedLog.deviceInfo) : selectedLog.deviceInfo, null, 2);
                      } catch {
                        return selectedLog.deviceInfo;
                      }
                    })()}
                  </pre>
                </div>
              )}

              {selectedLog.userAgent && (
                <div>
                  <p className="font-medium text-slate-700 mb-1">Client User-Agent:</p>
                  <p className="bg-slate-100 text-slate-700 p-2 rounded-md font-mono text-[10px] break-all">
                    {selectedLog.userAgent}
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedLog(null)} className="text-xs">
              Close Inspector
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single Activity Log Deletion Confirmation Dialog */}
      <Dialog open={isSingleDeleteOpen} onOpenChange={setIsSingleDeleteOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md p-0 overflow-hidden border border-slate-200 shadow-xl">
          <div className="bg-rose-600 p-5 text-white">
            <div className="flex items-center gap-2 mb-1">
              <Badge className="bg-white/20 text-white font-bold text-[10px]">
                SUPER ADMIN RESTRICTED
              </Badge>
            </div>
            <DialogTitle className="text-lg font-bold">Delete Activity Record</DialogTitle>
            <DialogDescription className="text-rose-100 text-xs mt-0.5">
              Permanently purge this activity event from the database.
            </DialogDescription>
          </div>
          <div className="p-5 space-y-4 bg-white">
            {targetDeleteLog && (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Event:</span>
                  <span className="font-mono font-bold text-slate-800">{targetDeleteLog.action}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Resource:</span>
                  <span className="font-semibold text-slate-800">{targetDeleteLog.resource}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Staff:</span>
                  <span className="font-semibold text-slate-800">{targetDeleteLog.userName || targetDeleteLog.userEmail || 'System'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Time:</span>
                  <span className="font-mono text-slate-600">{format(new Date(targetDeleteLog.createdAt), 'MMM d, yyyy HH:mm:ss')}</span>
                </div>
              </div>
            )}
            <p className="text-xs text-rose-600 font-medium leading-relaxed">
              This log will be permanently erased. An administrative proof-of-action entry will be kept in the protected immutable audit trail.
            </p>
            <DialogFooter className="grid grid-cols-2 gap-2 pt-1">
              <Button
                variant="ghost"
                className="h-9 rounded-lg font-bold"
                onClick={() => setIsSingleDeleteOpen(false)}
                disabled={singleDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="h-9 rounded-lg font-bold bg-rose-600 hover:bg-rose-700 text-white"
                onClick={confirmDeleteSingleLog}
                disabled={singleDeleting}
              >
                {singleDeleting ? <Loader2 className="animate-spin h-3.5 w-3.5 mr-1" /> : <Trash2 className="h-3.5 w-3.5 mr-1" />}
                Delete Record
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Timeline Deletion Dialog */}
      <Dialog open={isBulkDeleteOpen} onOpenChange={setIsBulkDeleteOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md p-0 overflow-hidden border border-slate-200 shadow-xl">
          <div className="bg-rose-600 p-5 text-white">
            <div className="flex items-center gap-2 mb-1">
              <Badge className="bg-white/20 text-white font-bold text-[10px]">
                SUPER ADMIN RESTRICTED
              </Badge>
            </div>
            <DialogTitle className="text-lg font-bold">Bulk Delete Timeline Records</DialogTitle>
            <DialogDescription className="text-rose-100 text-xs mt-0.5">
              Permanently delete {selectedLogIds.length} selected timeline records.
            </DialogDescription>
          </div>
          <div className="p-5 space-y-4 bg-white">
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
              <p className="font-semibold">Confirm bulk deletion of {selectedLogIds.length} activity records.</p>
              <p className="text-[11px] text-rose-700 mt-1">
                Selected entries will be removed from the database surveillance timeline.
              </p>
            </div>
            <DialogFooter className="grid grid-cols-2 gap-2 pt-1">
              <Button
                variant="ghost"
                className="h-9 rounded-lg font-bold"
                onClick={() => setIsBulkDeleteOpen(false)}
                disabled={bulkDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="h-9 rounded-lg font-bold bg-rose-600 hover:bg-rose-700 text-white"
                onClick={confirmBulkDeleteLogs}
                disabled={bulkDeleting || selectedLogIds.length === 0}
              >
                {bulkDeleting ? <Loader2 className="animate-spin h-3.5 w-3.5 mr-1" /> : <Trash2 className="h-3.5 w-3.5 mr-1" />}
                Delete {selectedLogIds.length} Records
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Clear Timeline Category Dialog */}
      <Dialog open={isClearLogsOpen} onOpenChange={setIsClearLogsOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md p-0 overflow-hidden border border-slate-200 shadow-xl">
          <div className="bg-rose-600 p-5 text-white">
            <div className="flex items-center gap-2 mb-1">
              <Badge className="bg-white/20 text-white font-bold text-[10px]">
                SUPER ADMIN RESTRICTED
              </Badge>
            </div>
            <DialogTitle className="text-lg font-bold">Clear Timeline Dataset</DialogTitle>
            <DialogDescription className="text-rose-100 text-xs mt-0.5">
              Select category and confirm permanent deletion.
            </DialogDescription>
          </div>
          <div className="p-5 space-y-4 bg-white">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">Select Category to Purge:</label>
              <select
                value={clearCategory}
                onChange={(e) => setClearCategory(e.target.value)}
                className="w-full h-9 px-3 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 outline-none"
              >
                <option value="ALL">ALL TIMELINE RECORDS</option>
                <option value="AUTH">Authentication Only (Logins, 2FA)</option>
                <option value="SECURITY">Security &amp; Device Policies Only</option>
                <option value="DATA_MUTATION">Data Mutation Events Only</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Type <span className="font-mono text-rose-600 font-bold">PERMANENTLY_DELETE</span> to confirm:
              </label>
              <Input
                placeholder="PERMANENTLY_DELETE"
                value={clearConfirmPhrase}
                onChange={(e) => setClearConfirmPhrase(e.target.value.trim().toUpperCase())}
                className="h-9 rounded-lg text-center font-bold tracking-wider bg-slate-50 border-slate-200 text-slate-900"
              />
            </div>
            <DialogFooter className="grid grid-cols-2 gap-2 pt-1">
              <Button
                variant="ghost"
                className="h-9 rounded-lg font-bold"
                onClick={() => {
                  setIsClearLogsOpen(false);
                  setClearConfirmPhrase('');
                }}
                disabled={clearDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="h-9 rounded-lg font-bold bg-rose-600 hover:bg-rose-700 text-white"
                onClick={confirmClearLogs}
                disabled={clearDeleting || clearConfirmPhrase !== 'PERMANENTLY_DELETE'}
              >
                {clearDeleting ? <Loader2 className="animate-spin h-3.5 w-3.5 mr-1" /> : 'Confirm Clear'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
