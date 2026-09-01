import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Search, 
  Filter, 
  RefreshCw, 
  Eye, 
  Calendar, 
  Clock, 
  User, 
  CheckCircle, 
  XCircle, 
  ChevronLeft, 
  ChevronRight, 
  FileDown, 
  Info, 
  Copy, 
  Terminal, 
  SlidersHorizontal 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from '@/components/ui/dialog';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useRealtimeSync } from '@/services/realtime';
import { cn } from '@/lib/utils';

export default function AuditLogsTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [resourceFilter, setResourceFilter] = useState('ALL');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Inspection modal
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const fetchLogs = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(actionFilter !== 'ALL' ? { action: actionFilter } : {}),
        ...(resourceFilter !== 'ALL' ? { resource: resourceFilter } : {}),
        ...(roleFilter !== 'ALL' ? { role: roleFilter } : {}),
        ...(statusFilter !== 'ALL' ? { status: statusFilter } : {}),
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
      });

      const res: any = await api.get(`/admin/audit-logs?${params.toString()}`);
      if (res && res.success) {
        setLogs(res.logs || []);
        setTotal(res.total || 0);
        setTotalPages(res.totalPages || 1);
      }
    } catch (err: any) {
      console.error('[AUDIT LOGS LOAD ERROR]', err);
      if (!silent) toast.error('Failed to load audit logs.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, actionFilter, resourceFilter, roleFilter, statusFilter]);

  useRealtimeSync(['auditLog'], () => {
    fetchLogs(true);
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const handleResetFilters = () => {
    setSearch('');
    setActionFilter('ALL');
    setResourceFilter('ALL');
    setRoleFilter('ALL');
    setStatusFilter('ALL');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const getActionBadgeColor = (action: string) => {
    if (!action) return 'bg-slate-100 text-slate-700 border-slate-200';
    const act = action.toUpperCase();
    if (act.includes('DELETE') || act.includes('PURGE') || act.includes('FAIL') || act.includes('WIPE')) {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
    if (act.includes('UPDATE') || act.includes('EDIT') || act.includes('MUTATE') || act.includes('ROLE')) {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    if (act.includes('CREATE') || act.includes('INSERT') || act.includes('SUCCESS') || act.includes('LOGIN')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (act.includes('BACKUP') || act.includes('EXPORT') || act.includes('RESTORE')) {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }
    return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied payload to clipboard.');
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-3xl border border-slate-200/80 shadow-xs bg-white overflow-hidden">
        <CardHeader className="p-6 sm:p-7 bg-slate-900 text-white flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 text-[10px] font-bold">
                ENTERPRISE AUDIT TRAIL
              </Badge>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Sync
              </div>
            </div>
            <CardTitle className="text-xl sm:text-2xl font-black mt-2">Activity &amp; Audit Logs</CardTitle>
            <CardDescription className="text-slate-400 text-xs font-semibold">
              Authoritative, tamper-resistant record of user logins, role mutations, data exports, purges, and security events.
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-4 py-2 bg-slate-800/80 rounded-2xl border border-slate-700/60 text-right">
              <div className="text-[10px] uppercase font-bold text-slate-400">Total Entries</div>
              <div className="text-xl font-black text-emerald-400">{total.toLocaleString()}</div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchLogs()}
              className="bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white rounded-xl text-xs font-bold"
            >
              <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", loading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-5 sm:p-7 space-y-6">
          {/* Search & Filter Bar */}
          <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200/80 space-y-3">
            <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Search by action, email, user name, IP, resource, details..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 h-10 bg-white rounded-xl border-slate-200 text-xs font-semibold"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button type="submit" className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs h-10 px-4">
                  Search Logs
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleResetFilters} 
                  className="rounded-xl border-slate-200 text-slate-600 font-bold text-xs h-10 px-3 hover:bg-slate-100"
                >
                  Reset
                </Button>
              </div>
            </form>

            {/* Structured Select Filters */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-200/60">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Action Type</label>
                <select 
                  value={actionFilter} 
                  onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
                  className="w-full h-9 bg-white rounded-xl border border-slate-200 text-xs font-semibold px-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="ALL">All Actions</option>
                  <option value="LOGIN">Login &amp; Auth</option>
                  <option value="2FA">Two-Factor Auth</option>
                  <option value="ROLE_CHANGE">Role Changes</option>
                  <option value="DELETE">Deletions</option>
                  <option value="PURGE">System Purges</option>
                  <option value="BACKUP">Backups</option>
                  <option value="RESTORE">Restores</option>
                  <option value="EXPORT">Data Exports</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Resource</label>
                <select 
                  value={resourceFilter} 
                  onChange={(e) => { setResourceFilter(e.target.value); setPage(1); }}
                  className="w-full h-9 bg-white rounded-xl border border-slate-200 text-xs font-semibold px-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="ALL">All Resources</option>
                  <option value="User">User / Staff</option>
                  <option value="Repair">Repair</option>
                  <option value="Customer">Customer</option>
                  <option value="InventoryItem">Inventory</option>
                  <option value="BatteryWarranty">Warranty</option>
                  <option value="Attendance">Attendance</option>
                  <option value="RepairRelatedDamage">Damage</option>
                  <option value="SYSTEM_BACKUP">System Backup</option>
                  <option value="APPLET_SHARE">Federation Share</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Actor Role</label>
                <select 
                  value={roleFilter} 
                  onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
                  className="w-full h-9 bg-white rounded-xl border border-slate-200 text-xs font-semibold px-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="ALL">All Roles</option>
                  <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="MANAGER">MANAGER</option>
                  <option value="LEAD_TECHNICIAN">LEAD_TECHNICIAN</option>
                  <option value="TECHNICIAN">TECHNICIAN</option>
                  <option value="RECEPTIONIST">RECEPTIONIST</option>
                  <option value="ACCOUNTANT">ACCOUNTANT</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Status</label>
                <select 
                  value={statusFilter} 
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                  className="w-full h-9 bg-white rounded-xl border border-slate-200 text-xs font-semibold px-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="SUCCESS">SUCCESS</option>
                  <option value="FAILED">FAILED</option>
                  <option value="BLOCKED">BLOCKED</option>
                  <option value="WARNING">WARNING</option>
                </select>
              </div>
            </div>
          </div>

          {/* Logs List Table */}
          <div className="border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/90 text-slate-700 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <th className="py-3.5 px-4">Timestamp</th>
                    <th className="py-3.5 px-4">Actor</th>
                    <th className="py-3.5 px-4">Action</th>
                    <th className="py-3.5 px-4">Resource</th>
                    <th className="py-3.5 px-4">IP / Client</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-slate-400" />
                        <span className="font-bold">Loading immutable audit logs...</span>
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <Shield className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                        <p className="font-bold text-slate-600">No audit logs matching current filter parameters.</p>
                        <p className="text-[11px] text-slate-400 mt-1">Try resetting filters or adjusting search queries.</p>
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                          {log.createdAt ? format(new Date(log.createdAt), 'MMM dd, yyyy HH:mm:ss') : 'N/A'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span className="truncate max-w-[140px]">{log.userName || log.userEmail || 'System'}</span>
                          </div>
                          {log.userRole && (
                            <span className="text-[10px] text-slate-400 font-semibold block">{log.userRole}</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className={cn("text-[10px] font-bold", getActionBadgeColor(log.action))}>
                            {log.action}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-slate-700 font-semibold">
                          {log.resource || '—'}
                        </td>
                        <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                          {log.ipAddress || 'Internal'}
                        </td>
                        <td className="py-3 px-4">
                          {log.status === 'SUCCESS' || !log.status ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-[11px]">
                              <CheckCircle className="h-3.5 w-3.5" /> Success
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-600 font-bold text-[11px]">
                              <XCircle className="h-3.5 w-3.5" /> {log.status}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedLog(log)}
                            className="h-7 px-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-lg"
                          >
                            <Eye className="h-3.5 w-3.5 mr-1 text-slate-500" />
                            Inspect
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-4 bg-slate-50 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="text-slate-500 font-semibold">
                Showing <span className="font-bold text-slate-900">{logs.length > 0 ? (page - 1) * limit + 1 : 0}</span> to{' '}
                <span className="font-bold text-slate-900">{Math.min(page * limit, total)}</span> of{' '}
                <span className="font-bold text-slate-900">{total}</span> entries
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-xl h-8 px-3 text-xs font-bold"
                >
                  <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Previous
                </Button>
                <span className="text-xs font-bold text-slate-700 px-2">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-xl h-8 px-3 text-xs font-bold"
                >
                  Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Log Inspection Detail Modal */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-2xl rounded-3xl p-6 bg-white">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <Badge className={cn("text-[10px] font-bold", getActionBadgeColor(selectedLog?.action))}>
                {selectedLog?.action}
              </Badge>
              <Badge variant="outline" className="text-[10px] font-mono">
                ID: {selectedLog?.id?.substring(0, 8)}...
              </Badge>
            </div>
            <DialogTitle className="text-lg font-black text-slate-900">
              Audit Event Deep Inspection
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Recorded at {selectedLog?.createdAt ? format(new Date(selectedLog.createdAt), 'yyyy-MM-dd HH:mm:ss') : 'N/A'}
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Actor Name</span>
                  <span className="font-bold text-slate-900">{selectedLog.userName || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Actor Email</span>
                  <span className="font-bold text-slate-900">{selectedLog.userEmail || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Role</span>
                  <span className="font-bold text-indigo-600">{selectedLog.userRole || 'System'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">IP Address</span>
                  <span className="font-mono text-slate-800">{selectedLog.ipAddress || 'Internal/Direct'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Target Resource</span>
                  <span className="font-bold text-slate-800">{selectedLog.resource || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Target Resource ID</span>
                  <span className="font-mono text-slate-800 truncate block">{selectedLog.resourceId || 'N/A'}</span>
                </div>
              </div>

              {selectedLog.userAgent && (
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">User Agent / Client</span>
                  <p className="font-mono text-[11px] text-slate-700 break-all">{selectedLog.userAgent}</p>
                </div>
              )}

              {selectedLog.details && (
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Details Summary</span>
                  <p className="text-slate-800 font-semibold whitespace-pre-wrap">{typeof selectedLog.details === 'string' ? selectedLog.details : JSON.stringify(selectedLog.details, null, 2)}</p>
                </div>
              )}

              {selectedLog.metadata && (
                <div className="p-3 bg-slate-900 text-emerald-400 rounded-2xl font-mono text-[11px] overflow-x-auto max-h-48">
                  <div className="flex justify-between items-center mb-1 text-slate-400 text-[10px] font-bold border-b border-slate-800 pb-1">
                    <span>EVENT METADATA PAYLOAD</span>
                    <button 
                      onClick={() => copyToClipboard(JSON.stringify(selectedLog.metadata, null, 2))}
                      className="text-slate-300 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="h-3 w-3" /> Copy
                    </button>
                  </div>
                  <pre>{JSON.stringify(selectedLog.metadata, null, 2)}</pre>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setSelectedLog(null)}
              className="rounded-xl text-xs font-bold w-full"
            >
              Close Inspection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
