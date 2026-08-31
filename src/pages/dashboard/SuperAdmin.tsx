import React, { useState, useEffect } from 'react';
import { 
  Trash2, 
  ShieldAlert, 
  History, 
  CircleCheck as CheckCircle2, 
  Loader2, 
  Lock,
  ArrowLeft,
  AlertTriangle,
  Calendar,
  FileDown,
  Activity,
  UserX,
  FileWarning,
  Search,
  Filter,
  Shield,
  User,
  Users,
  Smartphone,
  ChevronLeft,
  ChevronRight,
  Eye,
  Info,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from '@/components/ui/dialog';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import DashboardRefreshButton from '@/components/DashboardRefreshButton';
import { useRealtimeSync } from '@/services/realtime';
import StaffManagement from './Staff';
import PermanentDeletionHub from '@/components/admin/PermanentDeletionHub';

export default function SuperAdmin() {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletionType, setDeletionType] = useState<'ALL' | 'DATE' | 'MONTH' | 'YEAR' | 'RANGE'>('ALL');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [selectedYear, setSelectedYear] = useState(format(new Date(), 'yyyy'));
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const navigate = useNavigate();

  // Applet Sharing states
  const [shareForm, setShareForm] = useState({
    appletName: 'MTS Lab System',
    description: 'Advanced Lab & Repair Management suite with diagnostic records, invoicing, and real-time technician workspaces.',
    visibility: 'PUBLIC' as 'PUBLIC' | 'PRIVATE' | 'SHARED',
    sharingTarget: '',
    allowFork: true
  });
  const [sharingHistory, setSharingHistory] = useState<any[]>([]);
  const [shareLoading, setShareLoading] = useState(false);

  // Security Audit Logs state
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [auditLimit] = useState(15);
  const [auditLoading, setAuditLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAction, setFilterAction] = useState('ALL');
  const [filterRole, setFilterRole] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterResource, setFilterResource] = useState('ALL');
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const fetchHistory = async () => {
    try {
      const data = await api.get('/admin/deletion-history');
      setHistory(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchShareHistory = async () => {
    try {
      const response = await api.get('/share/history');
      if (response && response.success) {
        setSharingHistory(response.data || []);
      }
    } catch (err: any) {
      console.error("[SHARE HISTORY LOAD ERROR]", err);
    }
  };

  const fetchAuditLogs = async () => {
    setAuditLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(auditPage),
        limit: String(auditLimit),
        ...(searchQuery ? { search: searchQuery } : {}),
        ...(filterAction !== 'ALL' ? { action: filterAction } : {}),
        ...(filterRole !== 'ALL' ? { role: filterRole } : {}),
        ...(filterStatus !== 'ALL' ? { status: filterStatus } : {}),
        ...(filterResource !== 'ALL' ? { resource: filterResource } : {})
      });

      const res: any = await api.get(`/admin/audit-logs?${params.toString()}`);
      if (res && res.success) {
        setAuditLogs(res.logs || []);
        setAuditTotal(res.total || 0);
        setAuditTotalPages(res.totalPages || 1);
      }
    } catch (err: any) {
      console.error("[AUDIT LOGS LOAD ERROR]", err);
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    fetchShareHistory();
  }, []);

  useEffect(() => {
    fetchAuditLogs();
  }, [auditPage, filterAction, filterRole, filterStatus, filterResource]);

  // Real-time synchronization for audit logs
  useRealtimeSync(['auditLog'], () => {
    fetchAuditLogs();
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAuditPage(1);
    fetchAuditLogs();
  };

  const handleShareApplet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareForm.appletName.trim()) {
      toast.error("Applet name is required");
      return;
    }

    setShareLoading(true);
    try {
      const response = await api.post('/share/applet', shareForm);
      if (response && response.success) {
        toast.success(response.message || "Applet shared successfully!");
        fetchShareHistory();
        setShareForm({
          appletName: 'MTS Lab System',
          description: 'Advanced Lab & Repair Management suite with diagnostic records, invoicing, and real-time technician workspaces.',
          visibility: 'PUBLIC',
          sharingTarget: '',
          allowFork: true
        });
      } else {
        toast.error(response?.message || "Failed to share applet");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred while sharing the applet");
    } finally {
      setShareLoading(false);
    }
  };

  const handleDeleteData = async () => {
    if (confirmText !== 'DELETE') {
      toast.error("Please type DELETE to confirm");
      return;
    }

    setDeleting(true);
    try {
      const res: any = await api.post('/admin/delete-data', {
        password,
        deletionType,
        selectedDate,
        selectedMonth,
        selectedYear,
        startDate,
        endDate
      });
      toast.success(res.message || 'Data deleted successfully');
      setIsDeleteDialogOpen(false);
      setPassword('');
      setConfirmText('');
      fetchHistory();
      fetchAuditLogs();
    } catch (err: any) {
      toast.error(err.message || 'Deletion failed');
    } finally {
      setDeleting(false);
    }
  };

  const getActionBadgeColor = (action: string) => {
    if (action.includes('SUCCESS') || action.includes('CREATED') || action.includes('ENABLED')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (action.includes('FAILED') || action.includes('DELETED') || action.includes('DISABLED')) {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
    if (action.includes('OTP') || action.includes('PASSWORD') || action.includes('EMAIL')) {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    return 'bg-slate-50 text-slate-700 border-slate-200';
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-20 px-4 sm:px-0">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 sm:p-6 lg:p-7 rounded-3xl border border-slate-200/90 shadow-2xs">
        <div className="space-y-2 max-w-2xl">
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-fit gap-1.5 font-bold text-slate-500 hover:text-slate-900 rounded-xl px-2.5 h-8 cursor-pointer" 
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Button>
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shadow-2xs shrink-0 mt-0.5 sm:mt-0">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-slate-900">
                  Super Admin Console
                </h1>
                <Badge className="bg-rose-50 text-rose-700 border-rose-200 font-extrabold text-[10px]">
                  RESTRICTED PRIVILEGES
                </Badge>
              </div>
              <p className="text-slate-500 font-medium text-xs mt-1 leading-relaxed">
                Security surveillance, immutable audit logs, applet federation & system data governance.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end shrink-0">
          <Button
            id="superadmin-goto-surveillance-btn"
            onClick={() => navigate('/dashboard/security-surveillance')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs"
          >
            <Shield className="h-4 w-4 mr-1.5" />
            Security &amp; Surveillance
          </Button>
          <DashboardRefreshButton
            onRefresh={async () => {
              await fetchHistory();
              await fetchShareHistory();
              await fetchAuditLogs();
            }}
            size="default"
            label="Refresh Hub"
          />
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="audit-logs" className="space-y-6">
        <TabsList className="bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200 w-full flex flex-wrap sm:inline-flex gap-1.5 h-auto">
          <TabsTrigger value="audit-logs" className="rounded-xl py-2 px-3 sm:px-4 font-bold text-xs data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm">
            <Shield className="h-4 w-4 mr-1.5 text-indigo-600 shrink-0" />
            <span>Activity & Security Logs</span>
            <span className="ml-1.5 text-[10px] font-mono font-black bg-slate-200/80 text-slate-700 px-1.5 py-0.5 rounded-md">{auditTotal}</span>
          </TabsTrigger>
          <TabsTrigger value="permanent-deletion" className="rounded-xl py-2 px-3 sm:px-4 font-bold text-xs data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm">
            <Trash2 className="h-4 w-4 mr-1.5 text-rose-600 shrink-0" />
            <span>Permanent Deletion</span>
          </TabsTrigger>
          <TabsTrigger value="staff-directory" className="rounded-xl py-2 px-3 sm:px-4 font-bold text-xs data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm">
            <Users className="h-4 w-4 mr-1.5 text-purple-600 shrink-0" />
            <span>Staff Directory</span>
          </TabsTrigger>
          <TabsTrigger value="data-wipe" className="rounded-xl py-2 px-3 sm:px-4 font-bold text-xs data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm">
            <ShieldAlert className="h-4 w-4 mr-1.5 text-amber-600 shrink-0" />
            <span>System Data Purge</span>
          </TabsTrigger>
          <TabsTrigger value="applet-sharing" className="rounded-xl py-2 px-3 sm:px-4 font-bold text-xs data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm">
            <FileDown className="h-4 w-4 mr-1.5 text-blue-600 shrink-0" />
            <span>Federation & Sharing</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab: Permanent Deletion Controls Hub */}
        <TabsContent value="permanent-deletion" className="space-y-6">
          <PermanentDeletionHub />
        </TabsContent>

        {/* Tab: Staff Directory Embedded */}
        <TabsContent value="staff-directory" className="space-y-6">
          <StaffManagement />
        </TabsContent>

        {/* Tab 1: Activity & Security Logs */}
        <TabsContent value="audit-logs" className="space-y-6">
          <Card className="rounded-[32px] border-none shadow-xl bg-white overflow-hidden">
            <CardHeader className="p-7 sm:p-8 bg-slate-900 text-white flex flex-col md:flex-row justify-between md:items-center gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 text-[10px] font-bold">
                    IMMUTABLE AUDIT TRAIL
                  </Badge>
                </div>
                <CardTitle className="text-2xl font-black mt-2">Security & Activity Surveillance</CardTitle>
                <CardDescription className="text-slate-400 text-xs font-semibold">
                  Real-time recording of logins, 2FA verifications, password updates, role mutations, and system events.
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <div className="px-4 py-2 bg-slate-800/80 rounded-2xl border border-slate-700/60 text-right">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Total Entries</div>
                  <div className="text-xl font-black text-emerald-400">{auditTotal.toLocaleString()}</div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6 sm:p-8 space-y-6">
              {/* Search & Filter Bar */}
              <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input 
                      placeholder="Search action, email, user, IP, resource..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 h-11 bg-white rounded-xl border-slate-200 text-xs font-semibold"
                    />
                  </div>
                  <Button type="submit" size="sm" className="h-11 px-5 rounded-xl bg-slate-900 text-white font-bold text-xs">
                    Search
                  </Button>
                </form>

                <div className="flex flex-wrap gap-2 items-center">
                  {/* Action Filter */}
                  <select 
                    value={filterAction} 
                    onChange={(e) => { setFilterAction(e.target.value); setAuditPage(1); }}
                    className="h-11 px-3 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 outline-none"
                  >
                    <option value="ALL">All Actions</option>
                    <option value="LOGIN_SUCCESS">Login Success</option>
                    <option value="LOGIN_FAILED">Login Failed</option>
                    <option value="OTP_REQUESTED">OTP Requested</option>
                    <option value="OTP_VERIFICATION_SUCCESS">OTP Verified</option>
                    <option value="OTP_VERIFICATION_FAILED">OTP Failed</option>
                    <option value="PASSWORD_CHANGED">Password Changed</option>
                    <option value="PASSWORD_RESET">Password Reset</option>
                    <option value="EMAIL_CHANGED">Email Changed</option>
                    <option value="USER_CREATED">User Created</option>
                    <option value="USER_UPDATED">User Updated</option>
                    <option value="USER_DELETED">User Deleted</option>
                    <option value="ROLE_CHANGED">Role Changed</option>
                    <option value="LOGOUT">Logout</option>
                  </select>

                  {/* Role Filter */}
                  <select 
                    value={filterRole} 
                    onChange={(e) => { setFilterRole(e.target.value); setAuditPage(1); }}
                    className="h-11 px-3 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 outline-none"
                  >
                    <option value="ALL">All Roles</option>
                    <option value="SUPER_ADMIN">Super Admin</option>
                    <option value="ADMIN">Admin</option>
                    <option value="MANAGER">Manager</option>
                    <option value="RECEPTIONIST">Receptionist</option>
                    <option value="LEAD_TECHNICIAN">Lead Technician</option>
                    <option value="TECHNICIAN">Technician</option>
                    <option value="TECHNICAL_ASSISTANT">Technical Assistant</option>
                    <option value="CUSTOMER">Customer</option>
                  </select>

                  {/* Status Filter */}
                  <select 
                    value={filterStatus} 
                    onChange={(e) => { setFilterStatus(e.target.value); setAuditPage(1); }}
                    className="h-11 px-3 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 outline-none"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="SUCCESS">Success</option>
                    <option value="FAILED">Failed</option>
                  </select>

                  {/* Resource Filter */}
                  <select 
                    value={filterResource} 
                    onChange={(e) => { setFilterResource(e.target.value); setAuditPage(1); }}
                    className="h-11 px-3 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 outline-none"
                  >
                    <option value="ALL">All Resources</option>
                    <option value="AUTH">AUTH</option>
                    <option value="USER">USER</option>
                    <option value="REPAIR">REPAIR</option>
                    <option value="CUSTOMER">CUSTOMER</option>
                    <option value="INVENTORY">INVENTORY</option>
                    <option value="PAYMENT">PAYMENT</option>
                  </select>
                </div>
              </div>

              {/* Logs Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100/80 border-b border-slate-200 font-bold text-slate-600 uppercase tracking-wider text-[10px]">
                        <th className="py-3.5 px-4">Timestamp</th>
                        <th className="py-3.5 px-4">Action</th>
                        <th className="py-3.5 px-4">Actor / Role</th>
                        <th className="py-3.5 px-4">Resource</th>
                        <th className="py-3.5 px-4">Details</th>
                        <th className="py-3.5 px-4">IP / Device</th>
                        <th className="py-3.5 px-4 text-center">Inspect</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {auditLoading ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-400">
                            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-indigo-500" />
                            <p className="font-semibold text-xs">Loading Security Audit Logs...</p>
                          </td>
                        </tr>
                      ) : auditLogs.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-400">
                            <Activity className="h-8 w-8 mx-auto mb-2 opacity-30" />
                            <p className="font-semibold text-xs">No audit logs matching current criteria</p>
                          </td>
                        </tr>
                      ) : (
                        auditLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3.5 px-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                              {format(new Date(log.createdAt), 'dd MMM yyyy HH:mm:ss')}
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black border ${getActionBadgeColor(log.action)}`}>
                                {log.status === 'SUCCESS' ? (
                                  <CheckCircle className="h-3 w-3 text-emerald-600" />
                                ) : (
                                  <XCircle className="h-3 w-3 text-rose-600" />
                                )}
                                {log.action}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-slate-900 truncate max-w-[140px]">{log.userName || log.user?.name || 'System'}</div>
                              <div className="text-[10px] text-slate-400 truncate max-w-[140px]">{log.userEmail || log.user?.email || 'N/A'}</div>
                              {log.userRole && (
                                <Badge className="text-[9px] font-black bg-slate-100 text-slate-600 mt-0.5 px-1.5 py-0">
                                  {log.userRole}
                                </Badge>
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              <Badge className="text-[10px] font-bold bg-indigo-50 text-indigo-700 border-indigo-200">
                                {log.resource}
                              </Badge>
                              {log.resourceId && (
                                <div className="font-mono text-[9px] text-slate-400 truncate max-w-[90px] mt-0.5">
                                  ID: {log.resourceId}
                                </div>
                              )}
                            </td>
                            <td className="py-3.5 px-4 font-medium text-slate-700 max-w-[280px]">
                              <p className="line-clamp-2 text-xs leading-relaxed">{log.details || 'No event description'}</p>
                            </td>
                            <td className="py-3.5 px-4 text-[11px] text-slate-500 whitespace-nowrap">
                              <div className="font-mono">{log.ipAddress || '127.0.0.1'}</div>
                              <div className="text-[10px] text-slate-400 truncate max-w-[120px]">
                                {log.deviceInfo || log.userAgent?.slice(0, 30) || 'Terminal'}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-8 w-8 p-0 rounded-lg hover:bg-slate-200"
                                onClick={() => setSelectedLog(log)}
                              >
                                <Eye className="h-4 w-4 text-slate-600" />
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination footer */}
                <div className="bg-slate-50 p-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3">
                  <div className="text-xs text-slate-500 font-semibold">
                    Page <b>{auditPage}</b> of <b>{auditTotalPages}</b> &bull; Total <b>{auditTotal}</b> logs
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={auditPage <= 1 || auditLoading}
                      onClick={() => setAuditPage(p => Math.max(1, p - 1))}
                      className="h-9 px-3 rounded-xl font-bold text-xs"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={auditPage >= auditTotalPages || auditLoading}
                      onClick={() => setAuditPage(p => Math.min(auditTotalPages, p + 1))}
                      className="h-9 px-3 rounded-xl font-bold text-xs"
                    >
                      Next <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: System Data Purge */}
        <TabsContent value="data-wipe" className="space-y-6">
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <Card className="rounded-[32px] border-none shadow-2xl overflow-hidden">
                <CardHeader className="bg-slate-900 p-8 text-white">
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="text-2xl font-black">Forensic Data Management</CardTitle>
                      <CardDescription className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Select targeted deletion parameters</CardDescription>
                    </div>
                    <div className="p-3 bg-rose-600 rounded-2xl shadow-xl shadow-rose-600/30">
                      <Activity className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-8">
                  <Tabs defaultValue="ALL" onValueChange={(v) => setDeletionType(v as any)}>
                    <TabsList className="grid grid-cols-2 sm:grid-cols-5 h-auto min-h-12 rounded-2xl bg-slate-100 p-1.5 gap-1 mb-6">
                      <TabsTrigger value="ALL" className="rounded-xl font-bold uppercase text-[10px] tracking-wider py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">Global</TabsTrigger>
                      <TabsTrigger value="DATE" className="rounded-xl font-bold uppercase text-[10px] tracking-wider py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">Daily</TabsTrigger>
                      <TabsTrigger value="MONTH" className="rounded-xl font-bold uppercase text-[10px] tracking-wider py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">Monthly</TabsTrigger>
                      <TabsTrigger value="YEAR" className="rounded-xl font-bold uppercase text-[10px] tracking-wider py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">Yearly</TabsTrigger>
                      <TabsTrigger value="RANGE" className="col-span-2 sm:col-span-1 rounded-xl font-bold uppercase text-[10px] tracking-wider py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">Range</TabsTrigger>
                    </TabsList>

                    <div className="min-h-[140px] flex items-center justify-center bg-slate-50 rounded-[32px] p-8 border border-dashed border-slate-200">
                      <AnimatePresence mode="wait">
                        {deletionType === 'ALL' && (
                          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="text-center space-y-4">
                            <FileWarning className="mx-auto h-12 w-12 text-rose-500" />
                            <div className="space-y-1">
                              <p className="font-black text-xl text-slate-900 leading-tight">COMPLETE SYSTEM DATA WIPE</p>
                              <p className="text-slate-500 font-bold text-sm">Targets: Every repair, customer, and transactional record.</p>
                            </div>
                          </motion.div>
                        )}
                        {deletionType === 'DATE' && (
                          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="w-full flex flex-col items-center gap-4">
                            <Label className="text-xs font-black uppercase tracking-widest text-slate-400">Select Specific Day</Label>
                            <Input 
                              type="date" 
                              className="h-14 w-full max-w-sm rounded-2xl border-none shadow-xl font-bold text-lg text-center" 
                              value={selectedDate}
                              onChange={e => setSelectedDate(e.target.value)}
                            />
                          </motion.div>
                        )}
                        {deletionType === 'MONTH' && (
                          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="w-full flex flex-col items-center gap-4">
                            <Label className="text-xs font-black uppercase tracking-widest text-slate-400">Select Month</Label>
                            <Input 
                              type="month" 
                              className="h-14 w-full max-w-sm rounded-2xl border-none shadow-xl font-bold text-lg text-center" 
                              value={selectedMonth}
                              onChange={e => setSelectedMonth(e.target.value)}
                            />
                          </motion.div>
                        )}
                        {deletionType === 'YEAR' && (
                          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="w-full flex shrink-0 flex-col items-center gap-4">
                            <Label className="text-xs font-black uppercase tracking-widest text-slate-400">Select Year</Label>
                            <Input 
                              type="number" 
                              min="2020" 
                              max="2030" 
                              className="h-14 w-full max-w-sm rounded-2xl border-none shadow-xl font-bold text-lg text-center" 
                              value={selectedYear}
                              onChange={e => setSelectedYear(e.target.value)}
                            />
                          </motion.div>
                        )}
                        {deletionType === 'RANGE' && (
                          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="w-full grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-xs font-black uppercase tracking-widest text-slate-400">Start Date</Label>
                              <Input 
                                type="date" 
                                className="h-14 rounded-2xl border-none shadow-xl font-bold text-sm" 
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs font-black uppercase tracking-widest text-slate-400">End Date</Label>
                              <Input 
                                type="date" 
                                className="h-14 rounded-2xl border-none shadow-xl font-bold text-sm" 
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                              />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <div className="mt-8 flex justify-end">
                      <Button 
                        variant="destructive" 
                        className="h-16 px-10 rounded-3xl font-black bg-rose-600 hover:bg-rose-700 shadow-2xl shadow-rose-600/30 text-lg transition-all active:scale-95 flex items-center gap-3"
                        onClick={() => setIsDeleteDialogOpen(true)}
                      >
                        <Trash2 className="h-6 w-6" /> Execute System Purge
                      </Button>
                    </div>
                  </Tabs>
                </CardContent>
              </Card>
            </div>

            {/* Deletion Audit History */}
            <div className="space-y-8">
              <Card className="rounded-[32px] border-none shadow-2xl overflow-hidden min-h-[500px]">
                <CardHeader className="p-8 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-100 rounded-xl">
                      <History className="h-5 w-5 text-slate-600" />
                    </div>
                    <CardTitle className="text-xl font-black">Purge Audit Log</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-8 space-y-4">
                  {history.length > 0 ? (
                    history.slice(0, 10).map((event, i) => (
                      <div key={i} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                        <div className="flex items-center gap-2 text-rose-600 font-black text-xs">
                          <Trash2 className="h-4 w-4" /> System Purge
                        </div>
                        <p className="text-[11px] font-medium text-slate-600 leading-relaxed">{event.details}</p>
                        <span className="inline-block text-[9px] font-black text-slate-400">
                          {format(new Date(event.createdAt), 'dd MMM yyyy • HH:mm')}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-slate-400 italic text-xs">No purge events recorded</div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Tab 3: Applet Sharing */}
        <TabsContent value="applet-sharing" className="space-y-6">
          <Card className="rounded-[32px] border-none shadow-2xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-900 p-8 text-white">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-2xl font-black">Applet Federation & Sharing</CardTitle>
                  <CardDescription className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                    Deploy and federate MTS Lab modules across authorized workspaces
                  </CardDescription>
                </div>
                <div className="p-3 bg-amber-500 rounded-2xl shadow-xl shadow-amber-500/30">
                  <FileDown className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <form onSubmit={handleShareApplet} className="space-y-6 max-w-2xl">
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Applet Name</Label>
                  <Input 
                    value={shareForm.appletName}
                    onChange={(e) => setShareForm({ ...shareForm, appletName: e.target.value })}
                    className="h-12 rounded-xl bg-slate-50 font-bold"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Description</Label>
                  <Input 
                    value={shareForm.description}
                    onChange={(e) => setShareForm({ ...shareForm, description: e.target.value })}
                    className="h-12 rounded-xl bg-slate-50 font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Visibility</Label>
                  <select
                    value={shareForm.visibility}
                    onChange={(e) => setShareForm({ ...shareForm, visibility: e.target.value as any })}
                    className="h-12 w-full rounded-xl bg-slate-50 px-4 font-bold border border-slate-200 text-sm"
                  >
                    <option value="PUBLIC">PUBLIC (All System Admins)</option>
                    <option value="SHARED">SHARED (Specific Target Recipient)</option>
                    <option value="PRIVATE">PRIVATE (Local Instance Only)</option>
                  </select>
                </div>
                <Button 
                  type="submit" 
                  disabled={shareLoading}
                  className="h-14 px-8 rounded-2xl bg-slate-900 text-white font-bold"
                >
                  {shareLoading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <FileDown className="h-4 w-4 mr-2" />}
                  Publish Applet Module
                </Button>
              </form>

              {/* Published Shares */}
              <div className="pt-6 border-t border-slate-100 space-y-4">
                <h3 className="text-lg font-black text-slate-900 uppercase">Published Applet Shares</h3>
                {sharingHistory.length > 0 ? (
                  <div className="grid sm:grid-cols-2 gap-4">
                    {sharingHistory.map((item, index) => (
                      <div key={item.id || index} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                        <div className="flex justify-between items-start">
                          <span className="font-extrabold text-slate-900 text-sm">{item.appletName}</span>
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">
                            {item.visibility}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">{item.description}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No published applet shares recorded.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Log Details Modal */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="rounded-[32px] sm:max-w-xl p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-slate-900 p-6 text-white">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-black tracking-widest text-indigo-400 uppercase">AUDIT EVENT INSPECTION</span>
                <DialogTitle className="text-xl font-black mt-1">{selectedLog?.action}</DialogTitle>
              </div>
              <Badge className={`text-xs font-black ${selectedLog?.status === 'SUCCESS' ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                {selectedLog?.status}
              </Badge>
            </div>
          </div>
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto bg-white text-xs">
            <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Timestamp</div>
                <div className="font-mono font-semibold text-slate-800">
                  {selectedLog && format(new Date(selectedLog.createdAt), 'dd MMM yyyy HH:mm:ss')}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Resource</div>
                <div className="font-semibold text-slate-800">{selectedLog?.resource} {selectedLog?.resourceId ? `(#${selectedLog.resourceId})` : ''}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Actor</div>
                <div className="font-semibold text-slate-800">{selectedLog?.userName || 'System'} ({selectedLog?.userRole || 'N/A'})</div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Actor Email</div>
                <div className="font-semibold text-slate-800">{selectedLog?.userEmail || 'N/A'}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Client IP</div>
                <div className="font-mono font-semibold text-slate-800">{selectedLog?.ipAddress || '127.0.0.1'}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Device Info</div>
                <div className="font-semibold text-slate-800">{selectedLog?.deviceInfo || 'N/A'}</div>
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Details</div>
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 font-medium text-slate-800 leading-relaxed">
                {selectedLog?.details || 'No details provided'}
              </div>
            </div>

            {selectedLog?.previousValue && (
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Previous Value</div>
                <pre className="p-3 bg-slate-900 text-slate-100 rounded-2xl font-mono text-[11px] overflow-x-auto">
                  {selectedLog.previousValue}
                </pre>
              </div>
            )}

            {selectedLog?.newValue && (
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">New Value</div>
                <pre className="p-3 bg-slate-900 text-slate-100 rounded-2xl font-mono text-[11px] overflow-x-auto">
                  {selectedLog.newValue}
                </pre>
              </div>
            )}

            {selectedLog?.userAgent && (
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">User Agent</div>
                <div className="p-2.5 bg-slate-50 rounded-xl font-mono text-[10px] text-slate-600 break-all">
                  {selectedLog.userAgent}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="p-4 bg-slate-50 border-t border-slate-100">
            <Button className="rounded-xl font-bold w-full" onClick={() => setSelectedLog(null)}>
              Close Inspection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deletion Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="rounded-[32px] sm:max-w-lg p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-rose-600 p-8 text-white relative">
            <div className="space-y-2">
               <DialogTitle className="text-2xl font-black uppercase">PERMANENT SYSTEM DATA PURGE</DialogTitle>
               <DialogDescription className="text-rose-100 font-semibold text-xs leading-relaxed">
                 You are executing a permanent wipe on repair/customer records. This cannot be undone.
               </DialogDescription>
            </div>
          </div>
          <div className="p-8 space-y-6 bg-white">
            <div className="space-y-2">
               <Label className="text-xs font-bold text-slate-600">Type <span className="text-rose-600 font-black">DELETE</span> to confirm:</Label>
               <Input 
                 placeholder="DELETE" 
                 className="h-12 rounded-xl text-center font-black tracking-widest"
                 value={confirmText}
                 onChange={e => setConfirmText(e.target.value.toUpperCase())}
               />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-600">Authority Master Password:</Label>
              <Input 
                type="password" 
                placeholder="Enter password" 
                className="h-12 rounded-xl"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
            <DialogFooter className="grid grid-cols-2 gap-3 pt-2">
              <Button variant="ghost" className="h-12 rounded-xl font-bold" onClick={() => setIsDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                className="h-12 rounded-xl font-black bg-rose-600 hover:bg-rose-700"
                onClick={handleDeleteData}
                disabled={deleting || confirmText !== 'DELETE' || !password}
              >
                {deleting ? <Loader2 className="animate-spin h-5 w-5" /> : 'Confirm Purge'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
