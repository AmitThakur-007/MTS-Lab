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
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(25);
  const [loading, setLoading] = useState(false);

  // Filters
  const [selectedStaffId, setSelectedStaffId] = useState<string>(initialUserId || 'ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [resourceFilter, setResourceFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  useEffect(() => {
    if (initialUserId) {
      setSelectedStaffId(initialUserId);
    }
  }, [initialUserId]);

  const fetchTimeline = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(selectedStaffId !== 'ALL' ? { userId: selectedStaffId } : {}),
        ...(categoryFilter !== 'ALL' ? { category: categoryFilter } : {}),
        ...(resourceFilter !== 'ALL' ? { resource: resourceFilter } : {}),
        ...(statusFilter !== 'ALL' ? { status: statusFilter } : {}),
        ...(searchQuery ? { search: searchQuery } : {}),
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
      });

      const res = await api.get(`/security/activity-timeline?${params.toString()}`);
      if (res && res.success) {
        setLogs(res.logs || []);
        setTotal(res.total || 0);
        setTotalPages(res.totalPages || 1);
      }
    } catch (err: any) {
      toast.error('Failed to load system activity logs.');
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

          <div className="flex items-center gap-2">
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
                <TableHead className="w-[180px]">Timestamp</TableHead>
                <TableHead>Staff Identity</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target Resource</TableHead>
                <TableHead>Network / IP</TableHead>
                <TableHead>Details Summary</TableHead>
                <TableHead className="text-right">Inspect</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-xs">Querying audit logs...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-slate-500">
                    <p className="text-sm font-medium text-slate-700">No activity records match your criteria.</p>
                    <p className="text-xs text-slate-400 mt-1">Try broadening your date range or clearing specific filters.</p>
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id} id={`audit-log-row-${log.id}`} className="hover:bg-slate-50/60">
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
                      <Button
                        id={`inspect-log-btn-${log.id}`}
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedLog(log)}
                        className="h-7 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                      >
                        <Info className="w-3.5 h-3.5 mr-1" />
                        Details
                      </Button>
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
    </Card>
  );
}
