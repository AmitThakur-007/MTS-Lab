import React, { useState } from 'react';
import { 
  Users, 
  Radio, 
  Search, 
  Smartphone, 
  ShieldCheck, 
  ShieldAlert, 
  Clock, 
  ExternalLink,
  Laptop,
  CheckCircle2,
  AlertCircle,
  Activity,
  Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDistanceToNow, format } from 'date-fns';

interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: string;
  department?: string;
  profileImage?: string;
  accountStatus: string;
  isActive: boolean;
  twoFactorEnabled?: boolean;
  lastLoginAt?: string;
  lastActiveAt?: string;
  presenceStatus: 'ONLINE' | 'IDLE' | 'OFFLINE';
  devicesCount: number;
  activeDevicesCount: number;
  devices: any[];
  lastIpAddress?: string;
  lastKnownDevice?: string;
}

interface ActiveStaffSurveillanceProps {
  staff: StaffUser[];
  loading: boolean;
  onSelectUserForTimeline?: (userId: string) => void;
  onInspectDevices?: (userId: string) => void;
}

export default function ActiveStaffSurveillance({
  staff,
  loading,
  onSelectUserForTimeline,
  onInspectDevices,
}: ActiveStaffSurveillanceProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ONLINE' | 'IDLE' | 'OFFLINE'>('ALL');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  const filteredStaff = staff.filter((u) => {
    const matchesSearch = 
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.department && u.department.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.lastIpAddress && u.lastIpAddress.includes(searchTerm));

    const matchesStatus = statusFilter === 'ALL' || u.presenceStatus === statusFilter;
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;

    return matchesSearch && matchesStatus && matchesRole;
  });

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return <Badge className="bg-purple-100 text-purple-800 border-purple-200">Super Admin</Badge>;
      case 'ADMIN':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Admin</Badge>;
      case 'MANAGER':
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Manager</Badge>;
      case 'LEAD_TECHNICIAN':
      case 'TECHNICIAN':
        return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Technician</Badge>;
      case 'RECEPTIONIST':
        return <Badge className="bg-sky-100 text-sky-800 border-sky-200">Receptionist</Badge>;
      case 'INVENTORY_MANAGER':
        return <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200">Inventory Mgr</Badge>;
      case 'ACCOUNTANT':
        return <Badge className="bg-teal-100 text-teal-800 border-teal-200">Accountant</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  const getPresenceBadge = (presence: 'ONLINE' | 'IDLE' | 'OFFLINE') => {
    switch (presence) {
      case 'ONLINE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Online Now
          </span>
        );
      case 'IDLE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="h-2 w-2 rounded-full bg-amber-500"></span>
            Idle (&lt;15m)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            <span className="h-2 w-2 rounded-full bg-slate-400"></span>
            Offline
          </span>
        );
    }
  };

  return (
    <Card id="active-staff-surveillance-card" className="border-slate-200/80 shadow-xs bg-white">
      <CardHeader className="p-5 border-b border-slate-100 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              Staff Accounts &amp; Live Presence Surveillance
            </CardTitle>
            <CardDescription className="text-slate-500 text-xs mt-0.5">
              Live heartbeat telemetry tracking staff online activity, authenticated sessions, and hardware associations.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-md border border-slate-200 flex items-center gap-2">
              <span className="font-medium text-slate-700">Online:</span>
              <span className="font-semibold text-emerald-600">
                {staff.filter((s) => s.presenceStatus === 'ONLINE').length}
              </span>
              <span className="text-slate-300">|</span>
              <span className="font-medium text-slate-700">Idle:</span>
              <span className="font-semibold text-amber-600">
                {staff.filter((s) => s.presenceStatus === 'IDLE').length}
              </span>
              <span className="text-slate-300">|</span>
              <span className="font-medium text-slate-700">Total:</span>
              <span className="font-semibold text-slate-900">{staff.length}</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              id="staff-search-input"
              placeholder="Search by name, email, IP, or dept..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 text-sm h-9 bg-slate-50/50"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100/70 p-1 rounded-lg">
            {(['ALL', 'ONLINE', 'IDLE', 'OFFLINE'] as const).map((status) => (
              <button
                key={status}
                id={`filter-presence-${status.toLowerCase()}`}
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

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              id="staff-role-select"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              aria-label="Filter staff by assigned role"
              className="w-full text-xs h-9 bg-slate-50 border border-slate-200 rounded-md px-2.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">All Roles</option>
              <option value="SUPER_ADMIN">Super Admin</option>
              <option value="ADMIN">Admin</option>
              <option value="MANAGER">Manager</option>
              <option value="TECHNICIAN">Technician</option>
              <option value="RECEPTIONIST">Receptionist</option>
              <option value="INVENTORY_MANAGER">Inventory Manager</option>
              <option value="ACCOUNTANT">Accountant</option>
            </select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table id="active-staff-surveillance-table">
            <TableHeader className="bg-slate-50/80">
              <TableRow>
                <TableHead className="w-[280px]">Staff Member</TableHead>
                <TableHead>Role &amp; Security</TableHead>
                <TableHead>Presence Status</TableHead>
                <TableHead>Hardware &amp; Devices</TableHead>
                <TableHead>Connection Telemetry</TableHead>
                <TableHead>Last Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-xs">Gathering real-time staff telemetry...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredStaff.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-slate-500">
                    <p className="text-sm font-medium text-slate-700">No staff members match the selected filters.</p>
                    <p className="text-xs text-slate-400 mt-1">Try adjusting your search query or presence filter.</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredStaff.map((user) => {
                  return (
                    <TableRow key={user.id} id={`staff-row-${user.id}`} className="hover:bg-slate-50/60">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 border border-slate-200">
                            <AvatarImage src={user.profileImage} alt={user.name} />
                            <AvatarFallback className="bg-slate-100 text-slate-700 text-xs font-semibold">
                              {user.name ? user.name.slice(0, 2).toUpperCase() : 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-semibold text-slate-900 truncate">{user.name}</p>
                              {user.accountStatus === 'ACTIVE' && user.isActive ? (
                                <span title="Account Active & Verified">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                </span>
                              ) : (
                                <span title="Account Disabled or Suspended">
                                  <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 truncate">{user.email}</p>
                            {user.department && (
                              <p className="text-[11px] text-slate-400 truncate">Dept: {user.department}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col gap-1 items-start">
                          {getRoleBadge(user.role)}
                          <div className="flex items-center gap-1 mt-0.5">
                            {user.twoFactorEnabled ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-sm border border-emerald-200">
                                <ShieldCheck className="w-3 h-3" /> 2FA Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-sm border border-amber-200">
                                <ShieldAlert className="w-3 h-3" /> 2FA Inactive
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        {getPresenceBadge(user.presenceStatus)}
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-2">
                          <button
                            id={`view-devices-btn-${user.id}`}
                            onClick={() => onInspectDevices?.(user.id)}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50/70 hover:bg-blue-100/70 px-2.5 py-1 rounded-md border border-blue-200 transition-colors"
                          >
                            <Laptop className="w-3.5 h-3.5" />
                            <span>{user.activeDevicesCount} Approved</span>
                            {user.devicesCount > user.activeDevicesCount && (
                              <span className="text-[10px] bg-rose-100 text-rose-700 px-1 rounded-sm font-bold">
                                {user.devicesCount - user.activeDevicesCount} Blocked
                              </span>
                            )}
                          </button>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="text-xs">
                          {user.lastIpAddress ? (
                            <div className="font-mono text-slate-700 bg-slate-100/70 px-2 py-0.5 rounded-sm inline-block border border-slate-200">
                              {user.lastIpAddress}
                            </div>
                          ) : (
                            <span className="text-slate-400">No IP logged</span>
                          )}
                          {user.lastKnownDevice && (
                            <p className="text-[11px] text-slate-500 mt-1 line-clamp-1 truncate max-w-[180px]">
                              {user.lastKnownDevice}
                            </p>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="text-xs text-slate-600">
                          {user.lastActiveAt ? (
                            <div>
                              <p className="font-medium text-slate-800">
                                {formatDistanceToNow(new Date(user.lastActiveAt), { addSuffix: true })}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {format(new Date(user.lastActiveAt), 'MMM d, h:mm a')}
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
                            id={`staff-timeline-btn-${user.id}`}
                            variant="outline"
                            size="sm"
                            onClick={() => onSelectUserForTimeline?.(user.id)}
                            className="h-7 text-xs px-2.5 bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-blue-600"
                          >
                            <Activity className="w-3.5 h-3.5 mr-1" />
                            Activity
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
    </Card>
  );
}
