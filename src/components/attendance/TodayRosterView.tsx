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
    <div className="space-y-3 sm:space-y-4 w-full min-w-0">
      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 bg-white p-3 sm:p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs w-full min-w-0">
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 shrink-0" />
          <Input
            placeholder="Search staff by name, email, department, or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs bg-slate-50/50 border-slate-200 rounded-xl w-full"
          />
        </div>

        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto shrink-0">
          {/* Role Filter */}
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="h-9 w-full sm:w-36 text-xs bg-slate-50/50 border-slate-200 rounded-xl">
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
            <SelectTrigger className="h-9 w-full sm:w-36 text-xs bg-slate-50/50 border-slate-200 rounded-xl">
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
        <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 p-3 sm:p-3.5 bg-amber-50 border border-amber-200/80 rounded-xl text-amber-800 text-xs w-full min-w-0">
          <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
          <div className="flex-1 min-w-0 leading-relaxed">
            <strong>Attendance Window Closed:</strong> Staff marking controls are enabled exclusively between{' '}
            <span className="font-bold underline">10:00 AM and 10:45 AM NPT</span> (Asia/Kathmandu). You can still view all roster data, history, and monthly reports.
          </div>
        </div>
      )}

      {/* Roster List / Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden w-full min-w-0">
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
          <>
            {/* Desktop & Tablet Table View (horizontal scrollable wrapper if viewport is constricted) */}
            <div className="hidden md:block overflow-x-auto w-full min-w-0">
              <table className="w-full text-left border-collapse min-w-[940px]">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500 select-none">
                    <th className="py-3.5 pl-5 pr-3 w-[26%] min-w-[240px]">Staff Member</th>
                    <th className="py-3.5 px-3 w-[16%] min-w-[140px]">Department / Role</th>
                    <th className="py-3.5 px-3 w-[18%] min-w-[160px]">Status & Check-In</th>
                    <th className="py-3.5 px-3 w-[28%] min-w-[270px] text-center">Fast Attendance Action</th>
                    <th className="py-3.5 pl-3 pr-5 w-[12%] min-w-[110px] text-right">Options</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
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

                    const staffId = staff.userId || staff.id;
                    const isSelfManager = isManager && staffId === currentUserId;
                    const canMarkThisStaff = isAdminOrSuperAdmin || (isManager && isWithinWindow && !isSelfManager);

                    let markTooltip = '';
                    if (isSelfManager) {
                      markTooltip = 'Managers cannot record their own attendance. Admin/Super Admin must mark Manager attendance.';
                    } else if (isManager && !isWithinWindow) {
                      markTooltip = 'Attendance marking window is closed for Managers (10:00–10:45 AM NPT)';
                    } else if (!isAdminOrSuperAdmin && !isManager) {
                      markTooltip = 'Only Management can record attendance';
                    }

                    return (
                      <tr
                        key={staffId}
                        className="hover:bg-slate-50/70 transition-colors group"
                      >
                        {/* Column 1: Staff Info */}
                        <td className="py-3.5 pl-5 pr-3 align-middle">
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar className="w-9 h-9 rounded-xl border border-slate-200 shadow-2xs shrink-0 bg-indigo-50">
                              <AvatarImage src={staff.avatarUrl || staff.user?.avatarUrl} />
                              <AvatarFallback className="text-xs font-black text-indigo-700 bg-indigo-100 rounded-xl">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="text-sm font-bold text-slate-900 truncate max-w-[180px]"
                                  title={staff.name}
                                >
                                  {staff.name}
                                </span>
                                {staffId === currentUserId && (
                                  <Badge className="bg-slate-900 text-white text-[9px] font-bold px-1.5 py-0 shrink-0">
                                    YOU
                                  </Badge>
                                )}
                              </div>
                              <div
                                className="text-xs text-slate-500 truncate max-w-[200px]"
                                title={staff.email}
                              >
                                {staff.email}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Column 2: Department & Role */}
                        <td className="py-3.5 px-3 align-middle">
                          <div className="flex flex-col items-start gap-1 min-w-0">
                            {getRoleBadge(staff.role)}
                            <span
                              className="text-xs font-semibold text-slate-500 truncate max-w-[130px]"
                              title={staff.department || 'All Repair'}
                            >
                              {staff.department || 'All Repair'}
                            </span>
                          </div>
                        </td>

                        {/* Column 3: Current Status & Check-In */}
                        <td className="py-3.5 px-3 align-middle">
                          <div className="flex flex-col gap-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              {getStatusBadge(staff.status)}
                            </div>
                            {checkInTime && staff.status !== 'NOT_MARKED' && (
                              <div className="text-[11px] font-mono font-medium text-slate-500 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>{checkInTime}</span>
                                {markedBy && (
                                  <span
                                    className="text-[10px] text-slate-400 font-sans truncate max-w-[80px]"
                                    title={`Marked by ${markedBy}`}
                                  >
                                    ({markedBy.split(' ')[0]})
                                  </span>
                                )}
                              </div>
                            )}
                            {notes && (
                              <div
                                className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded italic truncate max-w-[150px]"
                                title={notes}
                              >
                                "{notes}"
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Column 4: Quick Action Buttons */}
                        <td className="py-3.5 px-3 align-middle text-center">
                          <div className="inline-flex items-center justify-center gap-1.5 flex-nowrap">
                            {/* Mark Present */}
                            <Button
                              size="sm"
                              variant={staff.status === 'PRESENT' ? 'default' : 'outline'}
                              onClick={() => onQuickMark(staffId, 'PRESENT', staff.name)}
                              disabled={!canMarkThisStaff}
                              className={cn(
                                'h-8 px-2.5 text-xs font-bold rounded-lg gap-1.5 shrink-0 whitespace-nowrap transition-all select-none',
                                staff.status === 'PRESENT'
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs font-black'
                                  : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300',
                                !canMarkThisStaff && 'opacity-60 cursor-not-allowed'
                              )}
                              title={markTooltip || 'Mark as Present'}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span>Present</span>
                            </Button>

                            {/* Mark Late */}
                            <Button
                              size="sm"
                              variant={staff.status === 'LATE' ? 'default' : 'outline'}
                              onClick={() => onQuickMark(staffId, 'LATE', staff.name)}
                              disabled={!canMarkThisStaff}
                              className={cn(
                                'h-8 px-2.5 text-xs font-bold rounded-lg gap-1.5 shrink-0 whitespace-nowrap transition-all select-none',
                                staff.status === 'LATE'
                                  ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-2xs font-black'
                                  : 'border-amber-200 text-amber-700 hover:bg-amber-50 hover:border-amber-300',
                                !canMarkThisStaff && 'opacity-60 cursor-not-allowed'
                              )}
                              title={markTooltip || 'Mark as Late'}
                            >
                              <Clock className="w-3.5 h-3.5 shrink-0" />
                              <span>Late</span>
                            </Button>

                            {/* Mark Absent */}
                            <Button
                              size="sm"
                              variant={staff.status === 'ABSENT' ? 'default' : 'outline'}
                              onClick={() => onQuickMark(staffId, 'ABSENT', staff.name)}
                              disabled={!canMarkThisStaff}
                              className={cn(
                                'h-8 px-2.5 text-xs font-bold rounded-lg gap-1.5 shrink-0 whitespace-nowrap transition-all select-none',
                                staff.status === 'ABSENT'
                                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-2xs font-black'
                                  : 'border-rose-200 text-rose-700 hover:bg-rose-50 hover:border-rose-300',
                                !canMarkThisStaff && 'opacity-60 cursor-not-allowed'
                              )}
                              title={markTooltip || 'Mark as Absent'}
                            >
                              <UserX className="w-3.5 h-3.5 shrink-0" />
                              <span>Absent</span>
                            </Button>
                          </div>
                        </td>

                        {/* Column 5: Options (Edit / History / Purge) */}
                        <td className="py-3.5 pl-3 pr-5 align-middle text-right">
                          <div className="inline-flex items-center justify-end gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onOpenEditModal(staff)}
                              disabled={isSelfManager}
                              className={cn(
                                "h-8 w-8 p-0 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg shrink-0",
                                isSelfManager && "opacity-40 cursor-not-allowed"
                              )}
                              title={isSelfManager ? "Managers cannot edit their own attendance records" : "Edit / Correct Record with Notes"}
                              aria-label="Edit record"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onOpenStaffHistory(staffId, staff.name)}
                              className="h-8 w-8 p-0 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg shrink-0"
                              title="View Staff Monthly Calendar & Logs"
                              aria-label="View staff calendar"
                            >
                              <Calendar className="w-3.5 h-3.5" />
                            </Button>

                            {isSuperAdmin && staffId !== currentUserId && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onOpenPurgeModal(staffId, staff.name)}
                                className="h-8 w-8 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg shrink-0"
                                title="Permanent Staff Deletion (Super Admin Only)"
                                aria-label="Delete staff"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card Layout (Screen < 768px) */}
            <div className="md:hidden divide-y divide-slate-100">
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

                const staffId = staff.userId || staff.id;
                const isSelfManager = isManager && staffId === currentUserId;
                const canMarkThisStaff = isAdminOrSuperAdmin || (isManager && isWithinWindow && !isSelfManager);

                let markTooltip = '';
                if (isSelfManager) {
                  markTooltip = 'Managers cannot record their own attendance. Admin/Super Admin must mark Manager attendance.';
                } else if (isManager && !isWithinWindow) {
                  markTooltip = 'Attendance marking window is closed for Managers (10:00–10:45 AM NPT)';
                } else if (!isAdminOrSuperAdmin && !isManager) {
                  markTooltip = 'Only Management can record attendance';
                }

                return (
                  <div key={staffId} className="p-3.5 sm:p-4 space-y-3 bg-white min-w-0">
                    {/* Header: Avatar, Name, Role, Options */}
                    <div className="flex items-start justify-between gap-2 min-w-0">
                      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                        <Avatar className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-slate-200 shadow-2xs shrink-0 bg-indigo-50">
                          <AvatarImage src={staff.avatarUrl || staff.user?.avatarUrl} />
                          <AvatarFallback className="text-xs font-black text-indigo-700 bg-indigo-100 rounded-xl">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-bold text-slate-900 truncate" title={staff.name}>
                              {staff.name}
                            </span>
                            {staffId === currentUserId && (
                              <Badge className="bg-slate-900 text-white text-[9px] font-bold px-1.5 py-0 shrink-0">
                                YOU
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 truncate" title={staff.email}>
                            {staff.email}
                          </div>
                        </div>
                      </div>

                      {/* Options on Mobile */}
                      <div className="flex items-center gap-0.5 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onOpenEditModal(staff)}
                          disabled={isSelfManager}
                          className={cn(
                            "h-8 w-8 p-0 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg",
                            isSelfManager && "opacity-40 cursor-not-allowed"
                          )}
                          title={isSelfManager ? "Managers cannot edit their own attendance" : "Edit Record"}
                          aria-label="Edit record"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onOpenStaffHistory(staffId, staff.name)}
                          className="h-8 w-8 p-0 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                          title="View Calendar"
                          aria-label="View staff calendar"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                        </Button>
                        {isSuperAdmin && staffId !== currentUserId && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onOpenPurgeModal(staffId, staff.name)}
                            className="h-8 w-8 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg"
                            title="Delete Staff"
                            aria-label="Delete staff"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Department & Current Status Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200/60 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                        {getRoleBadge(staff.role)}
                        <span className="text-[11px] font-medium text-slate-600 truncate max-w-[130px]" title={staff.department || 'All Repair'}>
                          {staff.department || 'All Repair'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {getStatusBadge(staff.status)}
                        {checkInTime && staff.status !== 'NOT_MARKED' && (
                          <span className="text-[10px] sm:text-[11px] font-mono font-bold text-slate-600">
                            {checkInTime}
                          </span>
                        )}
                      </div>
                    </div>

                    {notes && (
                      <div className="text-[11px] text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg italic break-words">
                        "{notes}"
                      </div>
                    )}

                    {/* Fast Attendance Actions Grid */}
                    <div className="grid grid-cols-3 gap-1.5 sm:gap-2 pt-0.5">
                      <Button
                        size="sm"
                        variant={staff.status === 'PRESENT' ? 'default' : 'outline'}
                        onClick={() => onQuickMark(staffId, 'PRESENT', staff.name)}
                        disabled={!canMarkThisStaff}
                        className={cn(
                          'h-9 px-1.5 sm:px-2 text-xs font-bold rounded-xl gap-1 sm:gap-1.5 transition-all select-none w-full justify-center',
                          staff.status === 'PRESENT'
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs font-black'
                            : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50',
                          !canMarkThisStaff && 'opacity-60 cursor-not-allowed'
                        )}
                        title={markTooltip || 'Mark Present'}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">Present</span>
                      </Button>

                      <Button
                        size="sm"
                        variant={staff.status === 'LATE' ? 'default' : 'outline'}
                        onClick={() => onQuickMark(staffId, 'LATE', staff.name)}
                        disabled={!canMarkThisStaff}
                        className={cn(
                          'h-9 px-1.5 sm:px-2 text-xs font-bold rounded-xl gap-1 sm:gap-1.5 transition-all select-none w-full justify-center',
                          staff.status === 'LATE'
                            ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-2xs font-black'
                            : 'border-amber-200 text-amber-700 hover:bg-amber-50',
                          !canMarkThisStaff && 'opacity-60 cursor-not-allowed'
                        )}
                        title={markTooltip || 'Mark Late'}
                      >
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">Late</span>
                      </Button>

                      <Button
                        size="sm"
                        variant={staff.status === 'ABSENT' ? 'default' : 'outline'}
                        onClick={() => onQuickMark(staffId, 'ABSENT', staff.name)}
                        disabled={!canMarkThisStaff}
                        className={cn(
                          'h-9 px-1.5 sm:px-2 text-xs font-bold rounded-xl gap-1 sm:gap-1.5 transition-all select-none w-full justify-center',
                          staff.status === 'ABSENT'
                            ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-2xs font-black'
                            : 'border-rose-200 text-rose-700 hover:bg-rose-50',
                          !canMarkThisStaff && 'opacity-60 cursor-not-allowed'
                        )}
                        title={markTooltip || 'Mark Absent'}
                      >
                        <UserX className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">Absent</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
