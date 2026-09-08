import React, { useState } from 'react';
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
  Radio,
  Lock,
  UserCheck
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format, formatDistanceToNow } from 'date-fns';
import { api } from '@/services/api';
import { toast } from 'sonner';

const ASSIGNABLE_ROLES = [
  { value: 'RECEPTIONIST', label: 'Receptionist (Front Desk)' },
  { value: 'TECHNICIAN', label: 'Technician (Repairs & Diagnostic)' },
  { value: 'LEAD_TECHNICIAN', label: 'Lead Technician' },
  { value: 'MANAGER', label: 'Manager (Branch Operations)' },
  { value: 'INVENTORY_MANAGER', label: 'Inventory Manager' },
  { value: 'ACCOUNTANT', label: 'Accountant (Billing & Revenue)' },
  { value: 'SUPER_ADMIN', label: 'Super Admin (Restricted)' },
];

interface AccessRequestsManagerProps {
  requests: any[];
  loading: boolean;
  onRefresh: () => void;
}

export default function AccessRequestsManager({
  requests,
  loading,
  onRefresh,
}: AccessRequestsManagerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [assignedRole, setAssignedRole] = useState<string>('RECEPTIONIST');
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [repairing, setRepairing] = useState(false);

  const filteredRequests = requests.filter((r) => {
    const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
    const q = searchTerm.toLowerCase();
    const matchesSearch = 
      (r.fullName && r.fullName.toLowerCase().includes(q)) ||
      (r.email && r.email.toLowerCase().includes(q)) ||
      (r.deviceName && r.deviceName.toLowerCase().includes(q)) ||
      (r.deviceIdentifier && r.deviceIdentifier.toLowerCase().includes(q)) ||
      (r.requestedRole && r.requestedRole.toLowerCase().includes(q));

    return matchesStatus && matchesSearch;
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
      const res = await api.post(`/security/access-requests/${selectedRequest.id}/approve`, {
        assignedRole,
      });
      toast.success(res.message || 'Access granted and device authorized.');
      setIsApproveDialogOpen(false);
      setSelectedRequest(null);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve access request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (req: any) => {
    setActionLoading(true);
    try {
      const res = await api.post(`/security/access-requests/${req.id}/reject`, {
        reason: 'Manually rejected by Administrator',
      });
      toast.success(res.message || 'Access request rejected.');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject access request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetAttempts = async (req: any) => {
    setActionLoading(true);
    try {
      const res = await api.post(`/security/access-requests/${req.id}/reset-attempts`, {});
      toast.success(res.message || 'Attempts reset successfully.');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reset attempts');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSystemRepair = async () => {
    setRepairing(true);
    try {
      const res = await api.post('/security/access-requests/system-repair', {});
      toast.success(res.message || 'System integrity repair completed.');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'System repair failed');
    } finally {
      setRepairing(false);
    }
  };

  return (
    <Card id="access-requests-manager-card" className="border-slate-200/80 shadow-xs bg-white">
      <CardHeader className="p-5 border-b border-slate-100 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              Access Requests &amp; Role Provisioning
            </CardTitle>
            <CardDescription className="text-slate-500 text-xs mt-0.5">
              Review incoming staff onboarding requests, assign authoritative RBAC roles, and authorize verified hardware.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button
              id="system-repair-btn"
              variant="outline"
              size="sm"
              onClick={handleSystemRepair}
              disabled={repairing}
              className="h-8 text-xs bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <Wrench className={`w-3.5 h-3.5 mr-1 ${repairing ? 'animate-spin' : ''}`} />
              {repairing ? 'Repairing...' : 'Auto-Repair Database'}
            </Button>

            <Button
              id="refresh-requests-btn"
              variant="outline"
              size="sm"
              onClick={onRefresh}
              className="h-8 text-xs bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
            </Button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              id="requests-search-input"
              placeholder="Search by applicant name, email, role, device, or hardware ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 text-sm h-9 bg-slate-50/50"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100/70 p-1 rounded-lg">
            {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map((status) => (
              <button
                key={status}
                id={`filter-request-${status.toLowerCase()}`}
                onClick={() => setStatusFilter(status)}
                className={`flex-1 py-1 px-2 text-xs font-medium rounded-md transition-all ${
                  statusFilter === status
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {status === 'ALL' ? 'All' : status.charAt(0) + status.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table id="access-requests-table">
            <TableHeader className="bg-slate-50/80">
              <TableRow>
                <TableHead className="w-[260px]">Applicant Identity</TableHead>
                <TableHead>Requested Role</TableHead>
                <TableHead>Device Profile</TableHead>
                <TableHead>Attempts &amp; Lockout</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Decision Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-xs">Loading access requests...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredRequests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-slate-500">
                    <p className="text-sm font-medium text-slate-700">No access requests in this category.</p>
                    <p className="text-xs text-slate-400 mt-1">Pending onboarding requests will show up here in real time.</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredRequests.map((req) => {
                  const isBlocked = (req.totalRequests || req.requestNumber || 1) >= 3;
                  return (
                    <TableRow key={req.id} id={`request-row-${req.id}`} className="hover:bg-slate-50/60">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 border border-slate-200">
                            <AvatarImage src={req.profilePhoto} alt={req.fullName} />
                            <AvatarFallback className="bg-slate-100 text-slate-700 text-xs font-semibold">
                              {req.fullName ? req.fullName.slice(0, 2).toUpperCase() : 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">{req.fullName}</p>
                            <p className="text-xs text-slate-500 truncate">{req.email}</p>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge variant="outline" className="font-semibold text-slate-700 bg-slate-50">
                          {req.requestedRole || 'RECEPTIONIST'}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <div className="text-xs">
                          <p className="font-medium text-slate-800">{req.deviceName || 'Workstation'}</p>
                          <p className="text-[11px] text-slate-500">
                            {req.browser || ''} on {req.os || 'Unknown OS'}
                          </p>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs font-bold ${isBlocked ? 'text-rose-600' : 'text-slate-700'}`}>
                            {req.totalRequests || req.requestNumber || 1} / 3
                          </span>
                          {isBlocked && (
                            <Badge className="bg-rose-100 text-rose-800 border-rose-200 text-[10px] py-0">
                              Locked
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        {req.status === 'PENDING' && (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-200">Pending</Badge>
                        )}
                        {req.status === 'APPROVED' && (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Approved</Badge>
                        )}
                        {req.status === 'REJECTED' && (
                          <Badge className="bg-rose-100 text-rose-800 border-rose-200">Rejected</Badge>
                        )}
                      </TableCell>

                      <TableCell>
                        <div className="text-xs text-slate-600">
                          <p className="font-medium text-slate-800">
                            {formatDistanceToNow(new Date(req.createdAt), { addSuffix: true })}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {format(new Date(req.createdAt), 'MMM d, h:mm a')}
                          </p>
                        </div>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {req.status === 'PENDING' ? (
                            <>
                              <Button
                                id={`approve-req-btn-${req.id}`}
                                size="sm"
                                onClick={() => handleOpenApproveDialog(req)}
                                className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-2.5"
                              >
                                <Check className="w-3.5 h-3.5 mr-1" />
                                Approve
                              </Button>

                              <Button
                                id={`reject-req-btn-${req.id}`}
                                size="sm"
                                variant="outline"
                                onClick={() => handleReject(req)}
                                className="h-7 text-xs border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5"
                              >
                                <X className="w-3.5 h-3.5 mr-1" />
                                Reject
                              </Button>
                            </>
                          ) : (
                            <Button
                              id={`reapprove-req-btn-${req.id}`}
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenApproveDialog(req)}
                              className="h-7 text-xs text-slate-600 hover:text-slate-900 px-2"
                            >
                              Edit Role
                            </Button>
                          )}

                          {isBlocked && (
                            <Button
                              id={`reset-attempts-btn-${req.id}`}
                              variant="ghost"
                              size="sm"
                              onClick={() => handleResetAttempts(req)}
                              title="Reset Lockout Attempts"
                              className="h-7 w-7 p-0 text-amber-600 hover:bg-amber-50"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </Button>
                          )}
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

      {/* Role Approval Modal */}
      <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <UserCheck className="w-5 h-5 text-emerald-600" />
              Approve Access &amp; Assign Role
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Provision authoritative system permissions for this staff member and authorize their hardware device.
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4 py-2 text-xs">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
                <p><strong>Applicant:</strong> {selectedRequest.fullName}</p>
                <p><strong>Email:</strong> {selectedRequest.email}</p>
                <p><strong>Workstation:</strong> {selectedRequest.deviceName} ({selectedRequest.os})</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="assign-role-select" className="text-xs font-semibold text-slate-700">
                  Assign System Role:
                </Label>
                <Select value={assignedRole} onValueChange={setAssignedRole}>
                  <SelectTrigger id="assign-role-select" className="h-9 text-xs">
                    <SelectValue placeholder="Select Role" />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSIGNABLE_ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value} className="text-xs">
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsApproveDialogOpen(false)} className="text-xs">
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={actionLoading}
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {actionLoading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1" />}
              Authorize &amp; Activate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
