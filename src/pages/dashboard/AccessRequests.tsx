import { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  ShieldCheck, 
  X, 
  Check, 
  UserMinus, 
  Loader2, 
  Calendar, 
  CheckCircle,
  HelpCircle,
  Search,
  KeyRound,
  RotateCcw,
  Wrench,
  Smartphone,
  Laptop,
  Tablet,
  Monitor,
  Trash2,
  Ban,
  ShieldAlert,
  HardDrive,
  RefreshCw,
  Radio
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { api } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useRealtimeSync } from '@/services/realtime';
import DashboardRefreshButton from '@/components/DashboardRefreshButton';

const ASSIGNABLE_ROLES = [
  { value: 'SUPERADMIN', label: 'Super Admin (Restricted)' },
  { value: 'ADMIN', label: 'Administrator' },
  { value: 'MANAGER', label: 'Repair Operations Manager' },
  { value: 'HEAD_TECHNICIAN', label: 'Head Technician' },
  { value: 'TECHNICIAN', label: 'Technician' },
  { value: 'RECEPTIONIST', label: 'Receptionist' },
];

export default function AccessRequests() {
  const { user: currentUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'requests' | 'devices'>('requests');
  const [requests, setRequests] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [assignedRole, setAssignedRole] = useState<string>('RECEPTIONIST');
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const previousPendingCount = useRef<number>(0);

  const fetchRequests = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await api.get('/access-requests');
      if (Array.isArray(data)) {
        const pendingCount = data.filter((r: any) => r.status === 'PENDING').length;
        if (silent && previousPendingCount.current < pendingCount) {
          toast.info("🔔 New Device Access Request received!");
        }
        previousPendingCount.current = pendingCount;
        setRequests(data);
      }
    } catch (err: any) {
      if (!silent) {
        toast.error(err.message || 'Failed to fetch access requests');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchDevices = async (silent = false) => {
    if (!silent) setDevicesLoading(true);
    try {
      const data = await api.get('/approved-devices');
      if (Array.isArray(data)) {
        setDevices(data);
      }
    } catch (err: any) {
      if (!silent) {
        toast.error(err.message || 'Failed to fetch authorized devices');
      }
    } finally {
      if (!silent) setDevicesLoading(false);
    }
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchRequests(true), fetchDevices(true)]);
    setRefreshing(false);
    toast.success('Access requests and device registry synced.');
  };

  useEffect(() => {
    fetchRequests(false);
    fetchDevices(false);
  }, []);

  // Multi-device real-time sync for access requests and authorized devices
  useRealtimeSync(['accessRequest', 'user', 'session', 'approvedDevice', 'sync'], () => {
    fetchRequests(true);
    fetchDevices(true);
  });

  const handleOpenApproveDialog = (req: any) => {
    setSelectedRequest(req);
    setAssignedRole(req.userRole || req.requestedRole || 'RECEPTIONIST');
    setIsApproveDialogOpen(true);
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;
    setActionLoading(true);
    try {
      const res = await api.post(`/access-requests/${selectedRequest.id}/approve`, {
        role: assignedRole
      });
      toast.success(res.message || 'Access request approved successfully.');
      setIsApproveDialogOpen(false);
      setSelectedRequest(null);
      fetchRequests();
      fetchDevices();
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (id: string) => {
    const confirm = window.confirm("Are you sure you want to reject this device access request? The user will be blocked on this device.");
    if (!confirm) return;

    try {
      const res = await api.post(`/access-requests/${id}/reject`, {});
      toast.success(res.message || 'Access request rejected.');
      fetchRequests();
      fetchDevices();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject request');
    }
  };

  const handleRevokeDevice = async (id: string, name: string) => {
    const confirm = window.confirm(`Revoke authorized access for "${name}"? The user will have to request access again from this device.`);
    if (!confirm) return;

    try {
      const res = await api.post(`/approved-devices/${id}/revoke`, {});
      toast.success(res.message || 'Device access revoked.');
      fetchDevices();
      fetchRequests();
    } catch (err: any) {
      toast.error(err.message || 'Failed to revoke device');
    }
  };

  const handleDeleteDevice = async (id: string) => {
    const confirm = window.confirm("Remove this device record completely from the registry?");
    if (!confirm) return;

    try {
      const res = await api.delete(`/approved-devices/${id}`);
      toast.success(res.message || 'Device record removed.');
      fetchDevices();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete device');
    }
  };

  const handleResetAttempts = async (id: string, email: string) => {
    const confirm = window.confirm(`Are you sure you want to reset request attempts and unblock ${email}?`);
    if (!confirm) return;

    try {
      const res = await api.post(`/access-requests/${id}/reset-attempts`, {});
      toast.success(res.message || 'Request attempts reset and account unblocked successfully.');
      fetchRequests();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reset attempts');
    }
  };

  const handleSystemRepair = async () => {
    try {
      const res = await api.post('/access-requests/system-repair', {});
      toast.success(res.message || 'Database status scan and repair completed successfully!');
      fetchRequests();
      fetchDevices();
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete status repair');
    }
  };

  const handleResetStatus = async (id: string, email: string) => {
    const confirm = window.confirm(`Are you sure you want to reset the request and account status back to PENDING for ${email}?`);
    if (!confirm) return;

    try {
      const res = await api.post(`/access-requests/${id}/reset-status`, {});
      toast.success(res.message || 'Successfully reset status to PENDING.');
      fetchRequests();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reset status');
    }
  };

  const getDeviceIcon = (type?: string) => {
    switch (type) {
      case 'SMARTPHONE':
        return <Smartphone className="h-4 w-4 text-slate-700" />;
      case 'TABLET':
        return <Tablet className="h-4 w-4 text-slate-700" />;
      case 'LAPTOP':
        return <Laptop className="h-4 w-4 text-slate-700" />;
      default:
        return <Monitor className="h-4 w-4 text-slate-700" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border border-emerald-200">Approved</Badge>;
      case 'REJECTED':
      case 'REVOKED':
        return <Badge className="bg-rose-50 text-rose-700 hover:bg-rose-50 border border-rose-200">Rejected / Revoked</Badge>;
      default:
        return <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50 border border-amber-200">Pending Approval</Badge>;
    }
  };

  const filteredRequests = requests.filter(req => {
    const searchLow = searchTerm.toLowerCase();
    return (
      (req.fullName && req.fullName.toLowerCase().includes(searchLow)) ||
      (req.email && req.email.toLowerCase().includes(searchLow)) ||
      (req.deviceName && req.deviceName.toLowerCase().includes(searchLow)) ||
      (req.browser && req.browser.toLowerCase().includes(searchLow)) ||
      (req.os && req.os.toLowerCase().includes(searchLow))
    );
  });

  const filteredDevices = devices.filter(dev => {
    const searchLow = searchTerm.toLowerCase();
    return (
      (dev.deviceName && dev.deviceName.toLowerCase().includes(searchLow)) ||
      (dev.user?.name && dev.user.name.toLowerCase().includes(searchLow)) ||
      (dev.user?.email && dev.user.email.toLowerCase().includes(searchLow)) ||
      (dev.browser && dev.browser.toLowerCase().includes(searchLow)) ||
      (dev.os && dev.os.toLowerCase().includes(searchLow))
    );
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-2">
              <ShieldCheck className="h-8 w-8 text-slate-800" />
              ACCESS & DEVICE CONTROL
            </h2>
          </div>
          <p className="text-slate-500 font-bold mt-1">
            Authorize new smartphones, laptops, tablets, and Google Sign-In access requests in real time.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DashboardRefreshButton
            onRefresh={handleManualRefresh}
            size="default"
            label="Refresh Requests"
          />
          <Button
            onClick={handleSystemRepair}
            variant="outline"
            className="rounded-2xl h-11 px-4 text-sm font-bold flex items-center gap-2 border-slate-200"
            title="Scan database for missing, incorrect, invalid, or legacy status values and repair them automatically"
          >
            <Wrench className="h-4 w-4 text-slate-500" />
            Status Repair Tool
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 p-1 bg-slate-100/80 rounded-2xl w-fit border border-slate-200/50">
        <button
          onClick={() => setActiveTab('requests')}
          className={`px-5 py-2.5 rounded-xl font-extrabold text-sm transition-all flex items-center gap-2 ${
            activeTab === 'requests' 
              ? 'bg-white text-slate-900 shadow-md shadow-black/5' 
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
          Access Requests
          {requests.filter(r => r.status === 'PENDING').length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[11px] font-black">
              {requests.filter(r => r.status === 'PENDING').length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('devices')}
          className={`px-5 py-2.5 rounded-xl font-extrabold text-sm transition-all flex items-center gap-2 ${
            activeTab === 'devices' 
              ? 'bg-white text-slate-900 shadow-md shadow-black/5' 
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <HardDrive className="h-4 w-4" />
          Authorized Devices Registry
          <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[11px] font-black">
            {devices.filter(d => d.status === 'APPROVED').length}
          </span>
        </button>
      </div>

      {activeTab === 'requests' ? (
        <Card className="rounded-[32px] border-none shadow-2xl p-6 md:p-8 bg-white overflow-hidden">
          <CardHeader className="px-0 pt-0 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100">
            <div>
              <CardTitle className="text-xl font-extrabold text-slate-900">Google & Device Access Requests</CardTitle>
              <CardDescription className="font-bold text-slate-400 text-xs uppercase tracking-wider">
                Multi-device authentication & authorization protocol
              </CardDescription>
            </div>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by user, device, or OS..."
                className="pl-11 h-12 rounded-xl bg-slate-50 border-none font-medium placeholder:text-slate-400"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardHeader>

          <CardContent className="px-0 py-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <Loader2 className="h-10 w-10 text-slate-800 animate-spin" />
                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Loading access requests...</p>
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="text-center py-20 border border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
                <Users className="mx-auto h-12 w-12 text-slate-300 mb-4" />
                <h3 className="text-lg font-bold text-slate-800 mb-1">No Access Requests Found</h3>
                <p className="text-slate-400 text-sm max-w-md mx-auto">
                  No access or device authorization requests match your parameters.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-100">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="font-bold text-slate-600">User / Profile</TableHead>
                      <TableHead className="font-bold text-slate-600">Device & Platform</TableHead>
                      <TableHead className="font-bold text-slate-600">Attempts / Lock</TableHead>
                      <TableHead className="font-bold text-slate-600">Request Date</TableHead>
                      <TableHead className="font-bold text-slate-600 text-center">Status</TableHead>
                      <TableHead className="font-bold text-slate-600 text-right pr-6">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRequests.map((req) => {
                      const isSelf = currentUser?.email && req.email && currentUser.email.toLowerCase() === req.email.toLowerCase();

                      return (
                        <TableRow key={req.id} className="hover:bg-slate-50/50">
                          <TableCell className="font-bold py-4">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10 border shadow-sm rounded-lg overflow-hidden">
                                <AvatarImage src={req.profilePhoto || req.user?.profileImage || undefined} />
                                <AvatarFallback className="bg-slate-100 text-slate-800 font-bold">
                                  {(req.fullName || req.email || 'U')[0].toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-[15px] font-extrabold text-slate-900 flex items-center gap-1.5">
                                  {req.fullName}
                                  {isSelf && (
                                    <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-black">YOU</span>
                                  )}
                                </p>
                                <p className="text-xs text-slate-500 font-semibold">{req.email}</p>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell className="font-bold text-slate-700">
                            <div className="flex items-start gap-2">
                              <div className="p-2 bg-slate-100 rounded-lg shrink-0 mt-0.5">
                                {getDeviceIcon(req.deviceType)}
                              </div>
                              <div>
                                <p className="text-sm font-black text-slate-900">
                                  {req.deviceName || 'Unidentified Device'}
                                </p>
                                <p className="text-xs text-slate-500 font-medium">
                                  {req.browser || 'Browser'} • {req.os || 'OS'}
                                </p>
                                {req.ipAddress && (
                                  <p className="text-[10px] text-slate-400 font-mono">IP: {req.ipAddress}</p>
                                )}
                              </div>
                            </div>
                          </TableCell>

                          <TableCell className="font-bold text-slate-600">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1 text-[13px] font-black text-slate-800">
                                Attempts: {req.requestCount ?? 1} / 3
                              </div>
                              {req.requestLimitReached ? (
                                <Badge className="bg-rose-50 text-rose-700 border border-rose-200 uppercase text-[9px] font-black w-fit">
                                  Blocked Account
                                </Badge>
                              ) : (
                                <Badge className="bg-slate-50 text-slate-600 border border-slate-200 uppercase text-[9px] font-extrabold w-fit">
                                  Active / Allowed
                                </Badge>
                              )}
                            </div>
                          </TableCell>

                          <TableCell className="text-slate-500 font-semibold text-xs whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5 text-slate-400" />
                              {format(new Date(req.createdAt), 'dd MMM yyyy • HH:mm')}
                            </div>
                          </TableCell>

                          <TableCell className="text-center py-4">
                            {getStatusBadge(req.status)}
                          </TableCell>

                          <TableCell className="text-right py-4 pr-6">
                            <div className="flex items-center justify-end gap-2">
                              {req.status === 'PENDING' && (
                                <>
                                  {isSelf ? (
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 rounded-lg border border-amber-200 text-amber-800 text-xs font-bold" title="Security policy prohibits self-approval">
                                      <ShieldAlert className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                                      Self-Approval Restricted
                                    </div>
                                  ) : (
                                    <>
                                      <Button
                                        onClick={() => handleOpenApproveDialog(req)}
                                        className="h-9 px-4 bg-black text-white hover:bg-slate-800 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm"
                                      >
                                        <Check className="h-3.5 w-3.5" />
                                        Approve
                                      </Button>
                                      <Button
                                        variant="outline"
                                        onClick={() => handleReject(req.id)}
                                        className="h-9 px-4 border-slate-200 text-slate-600 hover:bg-rose-50 hover:text-rose-600 rounded-lg text-xs font-bold flex items-center gap-1"
                                      >
                                        <X className="h-3.5 w-3.5" />
                                        Reject
                                      </Button>
                                    </>
                                  )}
                                </>
                              )}
                              
                              {/* Unblock and Reset count button */}
                              {((req.requestCount ?? 0) > 0 || req.requestLimitReached) && (
                                <Button
                                  variant="outline"
                                  onClick={() => handleResetAttempts(req.id, req.email)}
                                  className="h-9 px-3 border-slate-200 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-colors"
                                  title="Reset request attempts to unblock account"
                                >
                                  <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
                                  Reset Count
                                </Button>
                              )}

                              {/* Reset Status back to PENDING button */}
                              {req.status !== 'PENDING' && (
                                <Button
                                  variant="outline"
                                  onClick={() => handleResetStatus(req.id, req.email)}
                                  className="h-9 px-3 border-slate-200 text-indigo-700 hover:bg-slate-100 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-colors"
                                  title="Reset request and account status back to PENDING"
                                >
                                  <RotateCcw className="h-3.5 w-3.5 text-indigo-500" />
                                  Reset Status
                                </Button>
                              )}

                              {req.status !== 'PENDING' && !((req.requestCount ?? 0) > 0 || req.requestLimitReached) && (
                                <span className="text-xs text-slate-400 font-bold italic ml-2">
                                  {req.approvedBy ? `By ${req.approvedBy}` : ''}
                                </span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        /* Authorized Devices Registry */
        <Card className="rounded-[32px] border-none shadow-2xl p-6 md:p-8 bg-white overflow-hidden">
          <CardHeader className="px-0 pt-0 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100">
            <div>
              <CardTitle className="text-xl font-extrabold text-slate-900">Authorized Devices Registry</CardTitle>
              <CardDescription className="font-bold text-slate-400 text-xs uppercase tracking-wider">
                List of all smartphones, laptops, tablets, and computers approved for MTS Lab
              </CardDescription>
            </div>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search authorized devices..."
                className="pl-11 h-12 rounded-xl bg-slate-50 border-none font-medium placeholder:text-slate-400"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardHeader>

          <CardContent className="px-0 py-6">
            {devicesLoading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <Loader2 className="h-10 w-10 text-slate-800 animate-spin" />
                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Loading authorized devices...</p>
              </div>
            ) : filteredDevices.length === 0 ? (
              <div className="text-center py-20 border border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
                <HardDrive className="mx-auto h-12 w-12 text-slate-300 mb-4" />
                <h3 className="text-lg font-bold text-slate-800 mb-1">No Authorized Devices Found</h3>
                <p className="text-slate-400 text-sm max-w-md mx-auto">
                  No devices have been authorized in the registry yet.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-100">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="font-bold text-slate-600">User</TableHead>
                      <TableHead className="font-bold text-slate-600">Device Name & Hardware</TableHead>
                      <TableHead className="font-bold text-slate-600">Browser & OS</TableHead>
                      <TableHead className="font-bold text-slate-600">Last Active</TableHead>
                      <TableHead className="font-bold text-slate-600 text-center">Status</TableHead>
                      <TableHead className="font-bold text-slate-600 text-right pr-6">Management</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDevices.map((dev) => (
                      <TableRow key={dev.id} className="hover:bg-slate-50/50">
                        <TableCell className="font-bold py-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 border shadow-sm rounded-lg overflow-hidden">
                              <AvatarImage src={dev.user?.profileImage || undefined} />
                              <AvatarFallback className="bg-slate-100 text-slate-800 font-bold">
                                {(dev.user?.name || 'U')[0].toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-extrabold text-slate-900">{dev.user?.name || 'Unknown User'}</p>
                              <p className="text-xs text-slate-500 font-semibold">{dev.user?.email}</p>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="font-bold text-slate-700">
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-slate-100 rounded-lg">
                              {getDeviceIcon(dev.deviceType)}
                            </div>
                            <div>
                              <p className="text-sm font-black text-slate-900">{dev.deviceName || 'Device'}</p>
                              <span className="text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded font-black uppercase">{dev.deviceType}</span>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="font-medium text-xs text-slate-600">
                          <div>{dev.browser} • {dev.os}</div>
                          {dev.ipAddress && <div className="text-[10px] text-slate-400 font-mono">IP: {dev.ipAddress}</div>}
                        </TableCell>

                        <TableCell className="text-xs text-slate-500 font-semibold whitespace-nowrap">
                          {dev.lastUsedAt ? format(new Date(dev.lastUsedAt), 'dd MMM yyyy • HH:mm') : 'Never'}
                        </TableCell>

                        <TableCell className="text-center py-4">
                          {dev.status === 'APPROVED' ? (
                            <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200">Authorized</Badge>
                          ) : (
                            <Badge className="bg-rose-50 text-rose-700 border border-rose-200">Revoked</Badge>
                          )}
                        </TableCell>

                        <TableCell className="text-right py-4 pr-6">
                          <div className="flex items-center justify-end gap-2">
                            {dev.status === 'APPROVED' ? (
                              <Button
                                variant="outline"
                                onClick={() => handleRevokeDevice(dev.id, dev.deviceName || 'Device')}
                                className="h-8 px-3 text-rose-600 border-rose-200 hover:bg-rose-50 rounded-lg text-xs font-bold flex items-center gap-1"
                              >
                                <Ban className="h-3.5 w-3.5" />
                                Revoke Access
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                onClick={() => handleDeleteDevice(dev.id)}
                                className="h-8 px-3 text-slate-500 hover:text-rose-600 rounded-lg text-xs font-bold flex items-center gap-1"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Role Assignment & Approval Dialog */}
      <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
        <DialogContent className="rounded-[28px] sm:max-w-md p-6 overflow-hidden border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              Approve Device & Role
            </DialogTitle>
            <DialogDescription className="text-sm font-semibold text-slate-500">
              Authorize access for {selectedRequest?.fullName} ({selectedRequest?.email}) on this device.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            {/* Device summary box */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-900">{selectedRequest?.deviceName || 'Device'}</span>
                <span className="text-[10px] font-black bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded uppercase">{selectedRequest?.deviceType || 'DESKTOP'}</span>
              </div>
              <div className="text-xs text-slate-500">
                {selectedRequest?.browser} on {selectedRequest?.os} {selectedRequest?.ipAddress ? `(${selectedRequest?.ipAddress})` : ''}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="role-select" className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                Workplace Role Provisioning
              </Label>
              <Select value={assignedRole} onValueChange={setAssignedRole}>
                <SelectTrigger id="role-select" className="h-12 rounded-xl border-slate-200 font-semibold text-slate-800">
                  <SelectValue placeholder="Choose a workplace role" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                  {ASSIGNABLE_ROLES.map((role) => (
                    <SelectItem key={role.value} value={role.value} className="font-semibold py-3 hover:bg-slate-50 rounded-lg">
                      {role.value === 'SUPER_ADMIN' ? (
                        <span className="text-purple-600 font-bold">{role.label} ⚠️</span>
                      ) : (
                        role.label
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-start gap-3">
              <HelpCircle className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                Approving will register this device in the Authorized Registry and unlock access under role <span className="text-slate-900 font-bold">{assignedRole}</span>.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setIsApproveDialogOpen(false)}
              className="h-12 rounded-xl font-bold"
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              className="h-12 rounded-xl bg-black text-white hover:bg-slate-800 font-bold px-6 flex items-center gap-1.5"
              disabled={actionLoading}
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              Authorize & Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
