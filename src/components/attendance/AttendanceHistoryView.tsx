import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Calendar,
  Clock,
  UserCheck,
  UserX,
  Edit3,
  Trash2,
  Download,
  History,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  HelpCircle,
  Eye,
  FileText,
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
import { StaffRosterItem } from './TodayRosterView';

export interface AttendanceHistoryRecord {
  id: string;
  userId: string;
  date: string;
  status: string;
  checkInTime?: string;
  checkOutTime?: string;
  markedById?: string;
  markedByName?: string;
  method?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
    department?: string;
    avatarUrl?: string;
  };
}

export interface AuditLogItem {
  id: string;
  action: string;
  targetId: string;
  targetDate: string;
  performedById: string;
  performedByName: string;
  performedByRole: string;
  timestamp: string;
  timeNPT: string;
  details: any;
}

interface AttendanceHistoryViewProps {
  records: AttendanceHistoryRecord[];
  auditLogs: AuditLogItem[];
  staffList: StaffRosterItem[];
  isLoading: boolean;
  isAdminOrSuperAdmin: boolean;
  isSuperAdmin: boolean;
  onOpenEditModal: (record: AttendanceHistoryRecord) => void;
  onDeleteRecord: (id: string) => void;
  onRefresh: () => void;
}

export const AttendanceHistoryView: React.FC<AttendanceHistoryViewProps> = ({
  records,
  auditLogs,
  staffList,
  isLoading,
  isAdminOrSuperAdmin,
  isSuperAdmin,
  onOpenEditModal,
  onDeleteRecord,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showAuditLogs, setShowAuditLogs] = useState(false);

  // Filter records
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const userName = (r.user?.name || r.markedByName || '').toLowerCase();
      const userEmail = (r.user?.email || '').toLowerCase();
      const notes = (r.notes || '').toLowerCase();
      const dateStr = r.date || '';

      const matchesSearch =
        userName.includes(searchQuery.toLowerCase()) ||
        userEmail.includes(searchQuery.toLowerCase()) ||
        notes.includes(searchQuery.toLowerCase()) ||
        dateStr.includes(searchQuery);

      const matchesUser = selectedUser === 'ALL' || r.userId === selectedUser;
      const matchesStatus = selectedStatus === 'ALL' || r.status === selectedStatus;
      const matchesStart = !startDate || r.date >= startDate;
      const matchesEnd = !endDate || r.date <= endDate;

      return matchesSearch && matchesUser && matchesStatus && matchesStart && matchesEnd;
    });
  }, [records, searchQuery, selectedUser, selectedStatus, startDate, endDate]);

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
      default:
        return (
          <Badge className="bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold gap-1 px-2 py-0.5">
            <HelpCircle className="w-3.5 h-3.5" />
            {status}
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Header and View Mode Switcher */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
            <History className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900">
              {showAuditLogs ? 'Security & Audit Changelog' : 'Complete Attendance Logs'}
            </div>
            <div className="text-xs text-slate-500">
              {showAuditLogs
                ? 'Immutable record of all creations, manual edits, and status corrections'
                : 'Historical record of all staff attendances with date filters and search'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isAdminOrSuperAdmin && (
            <Button
              variant={showAuditLogs ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowAuditLogs(!showAuditLogs)}
              className={cn(
                'h-9 px-3 text-xs font-bold rounded-xl gap-1.5 transition-all',
                showAuditLogs
                  ? 'bg-slate-900 text-white hover:bg-slate-800'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-50'
              )}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{showAuditLogs ? 'View Attendance Records' : 'Audit Trail'}</span>
            </Button>
          )}
        </div>
      </div>

      {!showAuditLogs ? (
        <>
          {/* Filter Toolbar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
            {/* Search */}
            <div className="relative sm:col-span-2 lg:col-span-2">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Search by staff name, email, notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs bg-slate-50/50 border-slate-200 rounded-xl"
              />
            </div>

            {/* Staff Filter */}
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger className="h-9 text-xs bg-slate-50/50 border-slate-200 rounded-xl">
                <SelectValue placeholder="All Staff Members" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Staff Members</SelectItem>
                {staffList.map((s) => (
                  <SelectItem key={s.userId || s.id} value={s.userId || s.id}>
                    {s.name} ({s.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="h-9 text-xs bg-slate-50/50 border-slate-200 rounded-xl">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="PRESENT">Present</SelectItem>
                <SelectItem value="LATE">Late</SelectItem>
                <SelectItem value="HALF_DAY">Half Day</SelectItem>
                <SelectItem value="ABSENT">Absent</SelectItem>
              </SelectContent>
            </Select>

            {/* Date Range Clear / Reset */}
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="From Date"
                className="h-9 text-xs bg-slate-50/50 border-slate-200 rounded-xl px-2"
              />
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder="To Date"
                className="h-9 text-xs bg-slate-50/50 border-slate-200 rounded-xl px-2"
              />
              {(startDate || endDate || selectedUser !== 'ALL' || selectedStatus !== 'ALL' || searchQuery) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedUser('ALL');
                    setSelectedStatus('ALL');
                    setStartDate('');
                    setEndDate('');
                  }}
                  className="h-9 px-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl"
                  title="Clear All Filters"
                >
                  Clear
                </Button>
              )}
            </div>
          </div>

          {/* Records Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="hidden md:grid grid-cols-12 gap-4 px-5 py-3.5 bg-slate-50/90 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <div className="col-span-2">Date</div>
              <div className="col-span-3">Staff Member</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Time & Method</div>
              <div className="col-span-2">Recorded By / Notes</div>
              <div className="col-span-1 text-right">Actions</div>
            </div>

            {isLoading ? (
              <div className="p-12 text-center text-slate-400 font-medium">
                <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                Loading attendance history logs...
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="p-12 text-center text-slate-400 font-medium">
                No matching attendance history records found.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredRecords.map((rec) => {
                  const staffUser = rec.user;
                  return (
                    <div
                      key={rec.id}
                      className="p-4 md:px-5 md:py-3.5 hover:bg-slate-50/70 transition-colors flex flex-col md:grid md:grid-cols-12 gap-3 md:gap-4 items-stretch md:items-center"
                    >
                      {/* Date */}
                      <div className="md:col-span-2 font-mono font-bold text-slate-800 text-xs">
                        {rec.date}
                      </div>

                      {/* Staff Member */}
                      <div className="md:col-span-3 flex items-center gap-2.5">
                        <Avatar className="w-8 h-8 rounded-lg bg-indigo-50 border border-slate-200 shrink-0">
                          <AvatarImage src={staffUser?.avatarUrl} />
                          <AvatarFallback className="text-[10px] font-black text-indigo-700">
                            {(staffUser?.name || 'Staff').slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate">
                            {staffUser?.name || 'Staff Member'}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {staffUser?.role || 'Staff'}
                          </div>
                        </div>
                      </div>

                      {/* Status */}
                      <div className="md:col-span-2">{getStatusBadge(rec.status)}</div>

                      {/* Time & Method */}
                      <div className="md:col-span-2">
                        <div className="text-xs font-mono font-bold text-slate-800 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {rec.checkInTime || '—'}
                        </div>
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">
                          {rec.method || 'VERIFIED'}
                        </div>
                      </div>

                      {/* Recorded By & Notes */}
                      <div className="md:col-span-2 min-w-0">
                        <div className="text-xs text-slate-700 font-medium truncate">
                          {rec.markedByName || 'System Auto'}
                        </div>
                        {rec.notes && (
                          <div className="text-[10px] text-slate-500 italic truncate" title={rec.notes}>
                            "{rec.notes}"
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="md:col-span-1 flex items-center justify-end gap-1">
                        {isAdminOrSuperAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onOpenEditModal(rec)}
                            className="h-8 w-8 p-0 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                            title="Edit / Correct Record"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {isSuperAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDeleteRecord(rec.id)}
                            className="h-8 w-8 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg"
                            title="Delete this Attendance Entry"
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
        </>
      ) : (
        /* Audit Trail Table */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="hidden md:grid grid-cols-12 gap-4 px-5 py-3.5 bg-slate-900 text-white text-[11px] font-bold uppercase tracking-wider">
            <div className="col-span-3">Timestamp (NPT)</div>
            <div className="col-span-2">Action</div>
            <div className="col-span-3">Modified By</div>
            <div className="col-span-4">Audit Details / Changes</div>
          </div>

          {auditLogs.length === 0 ? (
            <div className="p-12 text-center text-slate-400 font-medium">
              No audit log entries recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-4 md:px-5 md:py-3.5 hover:bg-slate-50/70 transition-colors flex flex-col md:grid md:grid-cols-12 gap-2 md:gap-4 items-stretch md:items-center text-xs"
                >
                  <div className="md:col-span-3 font-mono font-medium text-slate-600">
                    <div>{log.timeNPT || log.timestamp}</div>
                    <div className="text-[10px] text-slate-400">Target Date: {log.targetDate}</div>
                  </div>

                  <div className="md:col-span-2">
                    <Badge className="bg-slate-100 text-slate-800 border border-slate-200 text-[10px] font-bold">
                      {log.action}
                    </Badge>
                  </div>

                  <div className="md:col-span-3">
                    <div className="font-bold text-slate-900">{log.performedByName}</div>
                    <div className="text-[10px] text-slate-400 font-semibold">{log.performedByRole}</div>
                  </div>

                  <div className="md:col-span-4 font-mono text-[11px] text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-200/60 overflow-x-auto">
                    {JSON.stringify(log.details)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
