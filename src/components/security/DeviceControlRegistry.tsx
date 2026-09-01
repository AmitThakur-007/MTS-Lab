import React, { useState } from 'react';
import { 
  Laptop, 
  Smartphone, 
  Tablet, 
  Monitor, 
  ShieldCheck, 
  ShieldAlert, 
  Search, 
  Trash2, 
  Ban, 
  CheckCircle2, 
  HardDrive, 
  Clock, 
  Info, 
  KeyRound, 
  RefreshCw,
  SlidersHorizontal,
  User,
  AlertTriangle,
  Globe,
  Radio
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';
import { api } from '@/services/api';

interface DeviceItem {
  id: string;
  userId: string;
  deviceIdentifier: string;
  deviceName?: string;
  deviceType?: 'SMARTPHONE' | 'TABLET' | 'LAPTOP' | 'DESKTOP' | string;
  browser?: string;
  os?: string;
  ipAddress?: string;
  userAgent?: string;
  status: 'APPROVED' | 'REVOKED' | 'BLOCKED' | string;
  approvedBy?: string;
  approvedAt?: string;
  revokedAt?: string;
  lastUsedAt?: string;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
    profileImage?: string;
    department?: string;
  };
}

interface DeviceControlRegistryProps {
  devices: DeviceItem[];
  loading: boolean;
  onRefresh: () => void;
  selectedUserIdFilter?: string | null;
  onClearUserFilter?: () => void;
}

export default function DeviceControlRegistry({
  devices,
  loading,
  onRefresh,
  selectedUserIdFilter,
  onClearUserFilter,
}: DeviceControlRegistryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'APPROVED' | 'REVOKED'>('ALL');
  const [inspectDevice, setInspectDevice] = useState<DeviceItem | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [confirmBlockDevice, setConfirmBlockDevice] = useState<DeviceItem | null>(null);
  const [confirmDeleteDevice, setConfirmDeleteDevice] = useState<DeviceItem | null>(null);

  const getDeviceIcon = (deviceType?: string, os?: string) => {
    const type = deviceType?.toUpperCase();
    if (type === 'SMARTPHONE') return <Smartphone className="w-4 h-4 text-sky-600" />;
    if (type === 'TABLET') return <Tablet className="w-4 h-4 text-amber-600" />;
    if (type === 'LAPTOP' || os?.includes('macOS') || os?.includes('Windows')) return <Laptop className="w-4 h-4 text-indigo-600" />;
    return <Monitor className="w-4 h-4 text-slate-700" />;
  };

  const filteredDevices = devices.filter((d) => {
    if (selectedUserIdFilter && d.userId !== selectedUserIdFilter) {
      return false;
    }

    const matchesStatus = 
      statusFilter === 'ALL' || 
      (statusFilter === 'APPROVED' && d.status === 'APPROVED') ||
      (statusFilter === 'REVOKED' && (d.status === 'REVOKED' || d.status === 'BLOCKED'));

    const q = searchTerm.toLowerCase();
    const matchesSearch = 
      (d.deviceName && d.deviceName.toLowerCase().includes(q)) ||
      (d.deviceIdentifier && d.deviceIdentifier.toLowerCase().includes(q)) ||
      (d.browser && d.browser.toLowerCase().includes(q)) ||
      (d.os && d.os.toLowerCase().includes(q)) ||
      (d.ipAddress && d.ipAddress.includes(q)) ||
      (d.user?.name && d.user.name.toLowerCase().includes(q)) ||
      (d.user?.email && d.user.email.toLowerCase().includes(q));

    return matchesStatus && matchesSearch;
  });

  const handleRevokeDevice = async (device: DeviceItem) => {
    setActionLoadingId(device.id);
    try {
      const res = await api.post(`/security/devices/${device.id}/revoke`, {
        reason: 'Manually blocked via Security & Device Control Registry'
      });
      toast.success(res.message || 'Device access has been revoked and blocked.');
      setConfirmBlockDevice(null);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to revoke device access');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleApproveDevice = async (device: DeviceItem) => {
    setActionLoadingId(device.id);
    try {
      const res = await api.post(`/security/devices/${device.id}/approve`, {});
      toast.success(res.message || 'Device has been authorized and unblocked.');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to authorize device');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteDevice = async (device: DeviceItem) => {
    setActionLoadingId(device.id);
    try {
      await api.delete(`/security/devices/${device.id}`);
      toast.success('Device record removed successfully.');
      setConfirmDeleteDevice(null);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove device record');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <Card id="device-control-registry-card" className="border-slate-200/80 shadow-xs bg-white">
      <CardHeader className="p-5 border-b border-slate-100 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Laptop className="w-5 h-5 text-indigo-600" />
              Hardware &amp; Device Control Registry
            </CardTitle>
            <CardDescription className="text-slate-500 text-xs mt-0.5">
              Enforce backend device authorization, inspect hardware telemetry, and revoke compromised workstations.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            {selectedUserIdFilter && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs gap-1.5 py-1">
                <span>Filtered by Staff Member</span>
                <button
                  id="clear-user-device-filter-btn"
                  onClick={onClearUserFilter}
                  className="font-bold hover:text-blue-900"
                >
                  ✕
                </button>
              </Badge>
            )}
            <Button
              id="refresh-devices-btn"
              variant="outline"
              size="sm"
              onClick={onRefresh}
              className="h-8 text-xs bg-white border-slate-200 text-slate-700"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
            </Button>
          </div>
        </div>

        {/* Filter controls */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              id="device-search-input"
              placeholder="Search by device name, OS, browser, IP, fingerprint, or staff..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 text-sm h-9 bg-slate-50/50"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100/70 p-1 rounded-lg">
            {(['ALL', 'APPROVED', 'REVOKED'] as const).map((status) => (
              <button
                key={status}
                id={`filter-device-${status.toLowerCase()}`}
                onClick={() => setStatusFilter(status)}
                className={`flex-1 py-1 px-2 text-xs font-medium rounded-md transition-all ${
                  statusFilter === status
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {status === 'ALL' ? 'All Devices' : status === 'APPROVED' ? 'Authorized' : 'Blocked / Revoked'}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table id="device-registry-table">
            <TableHeader className="bg-slate-50/80">
              <TableRow>
                <TableHead className="w-[260px]">Device / Hardware</TableHead>
                <TableHead>Associated Staff</TableHead>
                <TableHead>OS &amp; Browser</TableHead>
                <TableHead>IP &amp; Fingerprint</TableHead>
                <TableHead>Access Status</TableHead>
                <TableHead>Last Connection</TableHead>
                <TableHead className="text-right">Security Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-xs">Loading hardware authorization registry...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredDevices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-slate-500">
                    <p className="text-sm font-medium text-slate-700">No registered devices match your criteria.</p>
                    <p className="text-xs text-slate-400 mt-1">When staff log in from browsers, their workstations are registered here.</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredDevices.map((device) => {
                  const isBlocked = device.status === 'REVOKED' || device.status === 'BLOCKED';
                  return (
                    <TableRow key={device.id} id={`device-row-${device.id}`} className={isBlocked ? 'bg-rose-50/30 hover:bg-rose-50/50' : 'hover:bg-slate-50/60'}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg shrink-0 ${isBlocked ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'}`}>
                            {getDeviceIcon(device.deviceType, device.os)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">
                              {device.deviceName || 'Workstation Terminal'}
                            </p>
                            <p className="text-[11px] text-slate-500 font-mono truncate max-w-[170px]">
                              ID: {device.deviceIdentifier ? `${device.deviceIdentifier.slice(0, 12)}...` : 'Unknown'}
                            </p>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        {device.user ? (
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7 border border-slate-200">
                              <AvatarImage src={device.user.profileImage} alt={device.user.name} />
                              <AvatarFallback className="bg-slate-100 text-slate-700 text-[10px] font-semibold">
                                {device.user.name ? device.user.name.slice(0, 2).toUpperCase() : 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-800 truncate">{device.user.name}</p>
                              <p className="text-[11px] text-slate-400 truncate">{device.user.email}</p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Unassigned User</span>
                        )}
                      </TableCell>

                      <TableCell>
                        <div className="text-xs">
                          <p className="font-medium text-slate-800">{device.os || 'Unknown OS'}</p>
                          <p className="text-[11px] text-slate-500">{device.browser || 'Unknown Browser'}</p>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="text-xs">
                          {device.ipAddress ? (
                            <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded-sm border border-slate-200 text-slate-700">
                              {device.ipAddress}
                            </span>
                          ) : (
                            <span className="text-slate-400">No IP</span>
                          )}
                          <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[150px]">
                            Type: {device.deviceType || 'DESKTOP'}
                          </p>
                        </div>
                      </TableCell>

                      <TableCell>
                        {isBlocked ? (
                          <Badge className="bg-rose-100 text-rose-800 border-rose-200 gap-1 text-[11px]">
                            <ShieldAlert className="w-3 h-3" /> Blocked / Revoked
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 gap-1 text-[11px]">
                            <ShieldCheck className="w-3 h-3" /> Authorized
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell>
                        <div className="text-xs text-slate-600">
                          {device.lastUsedAt ? (
                            <div>
                              <p className="font-medium text-slate-800">
                                {formatDistanceToNow(new Date(device.lastUsedAt), { addSuffix: true })}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {format(new Date(device.lastUsedAt), 'MMM d, h:mm a')}
                              </p>
                            </div>
                          ) : (
                            <span className="text-slate-400">Never active</span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            id={`inspect-device-btn-${device.id}`}
                            variant="ghost"
                            size="sm"
                            onClick={() => setInspectDevice(device)}
                            title="Inspect Hardware Telemetry"
                            className="h-7 w-7 p-0 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                          >
                            <Info className="w-4 h-4" />
                          </Button>

                          {isBlocked ? (
                            <Button
                              id={`unblock-device-btn-${device.id}`}
                              size="sm"
                              variant="outline"
                              onClick={() => handleApproveDevice(device)}
                              disabled={actionLoadingId === device.id}
                              className="h-7 text-xs px-2 bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                              Unblock
                            </Button>
                          ) : (
                            <Button
                              id={`block-device-btn-${device.id}`}
                              size="sm"
                              variant="outline"
                              onClick={() => setConfirmBlockDevice(device)}
                              disabled={actionLoadingId === device.id}
                              className="h-7 text-xs px-2 bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                            >
                              <Ban className="w-3.5 h-3.5 mr-1" />
                              Block Device
                            </Button>
                          )}

                          <Button
                            id={`delete-device-btn-${device.id}`}
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmDeleteDevice(device)}
                            title="Delete Record"
                            className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* Inspect Device Dialog */}
      <Dialog open={!!inspectDevice} onOpenChange={(open) => !open && setInspectDevice(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <Laptop className="w-5 h-5 text-indigo-600" />
              Hardware Telemetry &amp; Device Identity
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Cryptographic hardware identifier and connection profile stored for security enforcement.
            </DialogDescription>
          </DialogHeader>

          {inspectDevice && (
            <div className="space-y-4 py-2 text-xs">
              <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-2">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="text-slate-500">Hardware Profile:</span>
                  <span className="font-semibold text-slate-900">{inspectDevice.deviceName || 'Workstation'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Operating System:</span>
                  <span className="font-medium text-slate-800">{inspectDevice.os || 'Unknown'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Browser Client:</span>
                  <span className="font-medium text-slate-800">{inspectDevice.browser || 'Unknown'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">IP Address:</span>
                  <span className="font-mono bg-white px-2 py-0.5 rounded-sm border border-slate-200 text-slate-800">
                    {inspectDevice.ipAddress || 'Not Recorded'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Authorization Status:</span>
                  <span className={`font-bold ${inspectDevice.status === 'APPROVED' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {inspectDevice.status}
                  </span>
                </div>
              </div>

              <div>
                <p className="font-medium text-slate-700 mb-1">Hardware Fingerprint Identifier:</p>
                <div className="bg-slate-900 text-slate-100 p-2.5 rounded-md font-mono text-[11px] break-all select-all">
                  {inspectDevice.deviceIdentifier}
                </div>
              </div>

              {inspectDevice.userAgent && (
                <div>
                  <p className="font-medium text-slate-700 mb-1">Raw User-Agent String:</p>
                  <div className="bg-slate-100 text-slate-700 p-2 rounded-md font-mono text-[10px] break-all">
                    {inspectDevice.userAgent}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-slate-500 text-[11px] pt-1">
                <div>First Registered: <span className="text-slate-800 font-medium">{format(new Date(inspectDevice.createdAt), 'PPpp')}</span></div>
                <div>Last Active: <span className="text-slate-800 font-medium">{inspectDevice.lastUsedAt ? format(new Date(inspectDevice.lastUsedAt), 'PPpp') : '—'}</span></div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setInspectDevice(null)} className="text-xs">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Block Dialog */}
      <Dialog open={!!confirmBlockDevice} onOpenChange={(open) => !open && setConfirmBlockDevice(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <Ban className="w-5 h-5" />
              Revoke &amp; Block Device Access?
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600 mt-2">
              Blocking this device will immediately invalidate any active sessions originating from this hardware. Subsequent API requests carrying this device identifier will be denied by the security middleware.
            </DialogDescription>
          </DialogHeader>

          {confirmBlockDevice && (
            <div className="bg-rose-50 p-3 rounded-lg border border-rose-200 text-xs space-y-1 text-rose-900">
              <p><strong>Device:</strong> {confirmBlockDevice.deviceName || confirmBlockDevice.deviceIdentifier}</p>
              <p><strong>Associated Staff:</strong> {confirmBlockDevice.user?.name} ({confirmBlockDevice.user?.email})</p>
              <p><strong>IP Address:</strong> {confirmBlockDevice.ipAddress || 'Unknown'}</p>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmBlockDevice(null)} className="text-xs">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmBlockDevice && handleRevokeDevice(confirmBlockDevice)}
              disabled={!!actionLoadingId}
              className="text-xs bg-rose-600 hover:bg-rose-700"
            >
              Confirm Block
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <Dialog open={!!confirmDeleteDevice} onOpenChange={(open) => !open && setConfirmDeleteDevice(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <Trash2 className="w-5 h-5 text-rose-600" />
              Remove Device Record?
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600 mt-2">
              This will remove the device fingerprint from the registry. If the user logs in from this browser again, it will be re-registered as a new device.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmDeleteDevice(null)} className="text-xs">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmDeleteDevice && handleDeleteDevice(confirmDeleteDevice)}
              disabled={!!actionLoadingId}
              className="text-xs"
            >
              Delete Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
