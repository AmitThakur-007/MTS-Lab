import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  UserX,
  UserCheck,
  Edit3,
  Calendar,
  Trash2,
  Lock,
  Sparkles,
  HelpCircle,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  Phone,
  Mail,
  MoreVertical,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface StaffRosterItem {
  userId: string;
  id: string;
  name: string;
  email: string;
  role: string;
  department?: string;
  phone?: string;
  avatarUrl?: string;
  date: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY' | 'PENDING' | 'NOT_MARKED';
  checkInTime?: string;
  checkOutTime?: string;
  notes?: string;
  attendanceId?: string;
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
    department?: string;
    avatarUrl?: string;
  };
  attendance?: {
    id: string;
    status: string;
    checkInTime?: string;
    checkOutTime?: string;
    markedByName?: string;
    markedAt?: string;
    notes?: string;
  };
}

interface TodayRosterViewProps {
  roster: StaffRosterItem[];
  isLoading: boolean;
  selectedDate: string;
  serverDate: string;
  isManager: boolean;
  isWithinWindow: boolean;
  isAdminOrSuperAdmin: boolean;
  isSuperAdmin: boolean;
  currentUserId: string;
  onQuickMark: (userId: string, status: 'PRESENT' | 'LATE' | 'HALF_DAY' | 'ABSENT', staffName: string) => void;
  onOpenEditModal: (staff: StaffRosterItem) => void;
  onOpenStaffHistory: (userId: string, staffName: string) => void;
  onOpenPurgeModal: (userId: string, staffName: string) => void;
}

export const TodayRosterView: React.FC<TodayRosterViewProps> = ({
  roster,
  isLoading,
  selectedDate,
  serverDate,
  isManager,
  isWithinWindow,
  isAdminOrSuperAdmin,
  isSuperAdmin,
  currentUserId,
  onQuickMark,
  onOpenEditModal,
  onOpenStaffHistory,
  onOpenPurgeModal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Can the user mark attendance right now?
  const canMark = isAdminOrSuperAdmin || (isManager && isWithinWindow);

  // Filter roster items
  const filteredRoster = useMemo(() => {
    return roster.filter((item) => {
      const nameMatch = (item.name || '').toLowerCase().includes(searchQuery.toLowerCase());
      const emailMatch = (item.email || '').toLowerCase().includes(searchQuery.toLowerCase());
      const deptMatch = (item.department || '').toLowerCase().includes(searchQuery.toLowerCase());
      const roleMatch = (item.role || '').toLowerCase().includes(searchQuery.toLowerCase());
      const queryMatch = nameMatch || emailMatch || deptMatch || roleMatch;

      const matchesRole = roleFilter === 'ALL' || item.role === roleFilter;
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'NOT_MARKED'
          ? item.status === 'NOT_MARKED' || item.status === 'PENDING'
          : item.status === statusFilter);

      return queryMatch && matchesRole && matchesStatus;
    });
  }, [roster, searchQuery, roleFilter, statusFilter]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PRESENT':
        return (
          <Badge className="bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 text-xs font-bold gap-1 px-2 py-0.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            PRESENT
          </Badge>
        );
      case 'LATE':
        return (
          <Badge className="bg-amber-500/10 text-amber-700 border border-amber-500/20 text-xs font-bold gap-1 px-2 py-0.5">
            <Clock className="w-3.5 h-3.5" />
            LATE
          </Badge>
        );
      case 'HALF_DAY':
        return (
          <Badge className="bg-sky-500/10 text-sky-700 border border-sky-500/20 text-xs font-bold gap-1 px-2 py-0.5">
            <Clock className="w-3.5 h-3.5" />
            HALF DAY
          </Badge>
        );
      case 'ABSENT':
        return (
          <Badge className="bg-rose-500/10 text-rose-700 border border-rose-500/20 text-xs font-bold gap-1 px-2 py-0.5">
            <XCircle className="w-3.5 h-3.5" />
            ABSENT
          </Badge>
        );
      case 'PENDING':
        return (
          <Badge className="bg-purple-500/10 text-purple-700 border border-purple-500/20 text-xs font-bold gap-1 px-2 py-0.5">
            <HelpCircle className="w-3.5 h-3.5" />
            PENDING
          </Badge>
        );
      default:
        return (
          <Badge className="bg-slate-100 text-slate-600 border border-slate-200 text-xs font-bold gap-1 px-2 py-0.5">
            <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
            NOT MARKED
          </Badge>
        );
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return <Badge className="bg-purple-600 text-white text-[10px] font-bold">SUPER ADMIN</Badge>;
      case 'ADMIN':
        return <Badge className="bg-indigo-600 text-white text-[10px] font-bold">ADMIN</Badge>;
      case 'MANAGER':
        return <Badge className="bg-blue-600 text-white text-[10px] font-bold">MANAGER</Badge>;
      case 'HEAD_TECHNICIAN':
        return <Badge className="bg-teal-600 text-white text-[10px] font-bold">HEAD TECH</Badge>;
      case 'TECHNICIAN':
        return <Badge className="bg-emerald-600 text-white text-[10px] font-bold">TECH</Badge>;
      case 'RECEPTIONIST':
        return <Badge className="bg-amber-600 text-white text-[10px] font-bold">RECEPTIONIST</Badge>;
      default:
        return <Badge className="bg-slate-600 text-white text-[10px] font-bold">{role || 'STAFF'}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Search staff by name, email, department, or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs bg-slate-50/50 border-slate-200 rounded-xl"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Role Filter */}
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="h-9 w-36 text-xs bg-slate-50/50 border-slate-200 rounded-xl">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Roles</SelectItem>
              <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
              <SelectItem value="ADMIN">Admin</SelectItem>
              <SelectItem value="MANAGER">Manager</SelectItem>
              <SelectItem value="HEAD_TECHNICIAN">Head Tech</SelectItem>
              <SelectItem value="TECHNICIAN">Technician</SelectItem>
              <SelectItem value="RECEPTIONIST">Receptionist</SelectItem>
              <SelectItem value="STAFF">General Staff</SelectItem>
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-36 text-xs bg-slate-50/50 border-slate-200 rounded-xl">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="PRESENT">Present</SelectItem>
              <SelectItem value="LATE">Late</SelectItem>
              <SelectItem value="HALF_DAY">Half Day</SelectItem>
              <SelectItem value="ABSENT">Absent</SelectItem>
              <SelectItem value="NOT_MARKED">Not Marked</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Manager Outside-Window Banner */}
      {isManager && !isWithinWindow && (
        <div className="flex items-center gap-3 p-3.5 bg-amber-50 border border-amber-200/80 rounded-xl text-amber-800 text-xs">
          <Lock className="w-4 h-4 text-amber-600 shrink-0" />
          <div className="flex-1">
            <strong>Attendance Window Closed:</strong> Staff marking controls are enabled exclusively between{' '}
            <span className="font-bold underline">10:00 AM and 10:35 AM NPT</span> (Asia/Kathmandu). You can still view all roster data, history, and monthly reports.
          </div>
        </div>
      )}

      {/* Roster List / Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {/* Table Header */}
        <div className="hidden lg:grid grid-cols-12 gap-4 px-5 py-3.5 bg-slate-50/90 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
          <div className="col-span-4">Staff Member</div>
          <div className="col-span-2">Department / Role</div>
          <div className="col-span-2">Status & Check-In</div>
          <div className="col-span-3 text-center">Fast Attendance Action</div>
          <div className="col-span-1 text-right">Options</div>
        </div>

        {/* List Content */}
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-sm font-medium">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading attendance roster...
          </div>
        ) : filteredRoster.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <UserX className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <div className="text-sm font-bold text-slate-800">No staff members found</div>
            <div className="text-xs text-slate-400 mt-1">
              Try adjusting your search query or filter selection.
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredRoster.map((staff) => {
              const initials = (staff.name || 'Staff')
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase();

              const checkInTime =
                staff.checkInTime ||
                staff.attendance?.checkInTime ||
                (staff.status === 'PRESENT' ? '10:05 AM' : null);

              const markedBy = staff.attendance?.markedByName;
              const notes = staff.notes || staff.attendance?.notes;

              return (
                <div
                  key={staff.userId || staff.id}
                  className="p-4 lg:px-5 lg:py-3.5 hover:bg-slate-50/70 transition-colors flex flex-col lg:grid lg:grid-cols-12 gap-3 lg:gap-4 items-stretch lg:items-center"
                >
                  {/* Column 1: Staff Info */}
                  <div className="lg:col-span-4 flex items-center gap-3">
                    <Avatar className="w-10 h-10 rounded-xl border border-slate-200 shadow-2xs shrink-0 bg-indigo-50">
                      <AvatarImage src={staff.avatarUrl || staff.user?.avatarUrl} />
                      <AvatarFallback className="text-xs font-black text-indigo-700 bg-indigo-100 rounded-xl">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 truncate">
                          {staff.name}
                        </span>
                        {staff.userId === currentUserId && (
                          <Badge className="bg-slate-900 text-white text-[9px] font-bold px-1.5 py-0">
                            YOU
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 truncate flex items-center gap-2">
                        <span className="truncate">{staff.email}</span>
                      </div>
                    </div>
                  </div>

                  {/* Column 2: Department & Role */}
                  <div className="lg:col-span-2 flex flex-wrap items-center gap-1.5">
                    {getRoleBadge(staff.role)}
                    <span className="text-xs font-semibold text-slate-500">
                      {staff.department || 'Lab'}
                    </span>
                  </div>

                  {/* Column 3: Current Status & Check-In */}
                  <div className="lg:col-span-2 flex flex-col gap-1">
                    <div className="flex items-center gap-1.5">
                      {getStatusBadge(staff.status)}
                    </div>
                    {checkInTime && staff.status !== 'NOT_MARKED' && (
                      <div className="text-[11px] font-mono font-medium text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {checkInTime}
                        {markedBy && (
                          <span className="text-[10px] text-slate-400 font-sans truncate">
                            ({markedBy.split(' ')[0]})
                          </span>
                        )}
                      </div>
                    )}
                    {notes && (
                      <div className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded italic truncate max-w-[180px]">
                        "{notes}"
                      </div>
                    )}
                  </div>

                  {/* Column 4: Quick Action Buttons */}
                  <div className="lg:col-span-3 flex items-center justify-center gap-1 sm:gap-1.5">
                    {/* Mark Present */}
                    <Button
                      size="sm"
                      variant={staff.status === 'PRESENT' ? 'default' : 'outline'}
                      onClick={() => onQuickMark(staff.userId, 'PRESENT', staff.name)}
                      disabled={!canMark}
                      className={cn(
                        'h-8 px-2 sm:px-2.5 text-xs font-bold rounded-lg gap-1 transition-all',
                        staff.status === 'PRESENT'
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                          : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                      )}
                      title={!canMark ? 'Attendance marking window is closed for Managers (10:00–10:35 AM NPT)' : 'Mark as Present'}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Present</span>
                    </Button>

                    {/* Mark Late */}
                    <Button
                      size="sm"
                      variant={staff.status === 'LATE' ? 'default' : 'outline'}
                      onClick={() => onQuickMark(staff.userId, 'LATE', staff.name)}
                      disabled={!canMark}
                      className={cn(
                        'h-8 px-2 text-xs font-bold rounded-lg gap-1 transition-all',
                        staff.status === 'LATE'
                          ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs'
                          : 'border-amber-200 text-amber-700 hover:bg-amber-50'
                      )}
                      title={!canMark ? 'Attendance marking window is closed for Managers (10:00–10:35 AM NPT)' : 'Mark as Late'}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>Late</span>
                    </Button>

                    {/* Mark Absent */}
                    <Button
                      size="sm"
                      variant={staff.status === 'ABSENT' ? 'default' : 'outline'}
                      onClick={() => onQuickMark(staff.userId, 'ABSENT', staff.name)}
                      disabled={!canMark}
                      className={cn(
                        'h-8 px-2 text-xs font-bold rounded-lg gap-1 transition-all',
                        staff.status === 'ABSENT'
                          ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs'
                          : 'border-rose-200 text-rose-700 hover:bg-rose-50'
                      )}
                      title={!canMark ? 'Attendance marking window is closed for Managers (10:00–10:35 AM NPT)' : 'Mark as Absent'}
                    >
                      <UserX className="w-3.5 h-3.5" />
                      <span>Absent</span>
                    </Button>
                  </div>

                  {/* Column 5: Options (Edit / History / Purge) */}
                  <div className="lg:col-span-1 flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onOpenEditModal(staff)}
                      className="h-8 w-8 p-0 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                      title="Edit / Correct Record with Notes"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onOpenStaffHistory(staff.userId, staff.name)}
                      className="h-8 w-8 p-0 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                      title="View Staff Monthly Calendar & Logs"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                    </Button>

                    {isSuperAdmin && staff.userId !== currentUserId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onOpenPurgeModal(staff.userId, staff.name)}
                        className="h-8 w-8 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg"
                        title="Permanent Staff Deletion (Super Admin Only)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
