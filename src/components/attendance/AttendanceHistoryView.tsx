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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-3 bg-white p-3 sm:p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs w-full min-w-0">
            {/* Search */}
            <div className="relative sm:col-span-2 lg:col-span-2 min-w-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 shrink-0" />
              <Input
                placeholder="Search by staff name, email, notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs bg-slate-50/50 border-slate-200 rounded-xl w-full"
              />
            </div>

            {/* Staff Filter */}
            <div className="min-w-0">
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="h-9 text-xs bg-slate-50/50 border-slate-200 rounded-xl w-full">
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
            </div>

            {/* Status Filter */}
            <div className="min-w-0">
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="h-9 text-xs bg-slate-50/50 border-slate-200 rounded-xl w-full">
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
            </div>

            {/* Date Range Clear / Reset */}
            <div className="flex items-center gap-1.5 min-w-0 w-full">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="From Date"
                className="h-9 text-xs bg-slate-50/50 border-slate-200 rounded-xl px-2 flex-1 min-w-0"
              />
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder="To Date"
                className="h-9 text-xs bg-slate-50/50 border-slate-200 rounded-xl px-2 flex-1 min-w-0"
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
                  className="h-9 px-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl shrink-0"
                  title="Clear All Filters"
                >
                  Clear
                </Button>
              )}
            </div>
          </div>

          {/* Records Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden w-full min-w-0">
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
              <>
                {/* Desktop & Tablet Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[860px]">
                    <thead>
                      <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500 select-none">
                        <th className="py-3.5 pl-5 pr-3 w-[15%] min-w-[110px]">Date</th>
                        <th className="py-3.5 px-3 w-[25%] min-w-[200px]">Staff Member</th>
                        <th className="py-3.5 px-3 w-[16%] min-w-[130px]">Status</th>
                        <th className="py-3.5 px-3 w-[18%] min-w-[150px]">Time & Method</th>
                        <th className="py-3.5 px-3 w-[16%] min-w-[140px]">Recorded By / Notes</th>
                        <th className="py-3.5 pl-3 pr-5 w-[10%] min-w-[90px] text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredRecords.map((rec) => {
                        const staffUser = rec.user;
                        return (
                          <tr
                            key={rec.id}
                            className="hover:bg-slate-50/70 transition-colors group"
                          >
                            {/* Date */}
                            <td className="py-3.5 pl-5 pr-3 align-middle font-mono font-bold text-slate-800">
                              {rec.date}
                            </td>

                            {/* Staff Member */}
                            <td className="py-3.5 px-3 align-middle">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <Avatar className="w-8 h-8 rounded-lg bg-indigo-50 border border-slate-200 shrink-0">
                                  <AvatarImage src={staffUser?.avatarUrl} />
                                  <AvatarFallback className="text-[10px] font-black text-indigo-700">
                                    {(staffUser?.name || 'Staff').slice(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-bold text-slate-900 truncate max-w-[160px]" title={staffUser?.name}>
                                    {staffUser?.name || 'Staff Member'}
                                  </div>
                                  <div className="text-[10px] text-slate-400 truncate max-w-[160px]">
                                    {staffUser?.role || 'Staff'}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Status */}
                            <td className="py-3.5 px-3 align-middle">
                              {getStatusBadge(rec.status)}
                            </td>

                            {/* Time & Method */}
                            <td className="py-3.5 px-3 align-middle">
                              <div className="flex flex-col gap-0.5">
                                <div className="text-xs font-mono font-bold text-slate-800 flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span>{rec.checkInTime || '—'}</span>
                                </div>
                                <div className="text-[10px] text-slate-400 uppercase font-semibold">
                                  {rec.method || 'VERIFIED'}
                                </div>
                              </div>
                            </td>

                            {/* Recorded By & Notes */}
                            <td className="py-3.5 px-3 align-middle">
                              <div className="flex flex-col gap-0.5 min-w-0">
                                <div className="text-xs text-slate-700 font-medium truncate max-w-[130px]" title={rec.markedByName || 'System Auto'}>
                                  {rec.markedByName || 'System Auto'}
                                </div>
                                {rec.notes && (
                                  <div className="text-[10px] text-slate-500 italic truncate max-w-[130px]" title={rec.notes}>
                                    "{rec.notes}"
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Actions */}
                            <td className="py-3.5 pl-3 pr-5 align-middle text-right">
                              <div className="inline-flex items-center justify-end gap-1 shrink-0">
                                {isAdminOrSuperAdmin && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onOpenEditModal(rec)}
                                    className="h-8 w-8 p-0 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg shrink-0"
                                    title="Edit / Correct Record"
                                    aria-label="Edit record"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                                {isSuperAdmin && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onDeleteRecord(rec.id)}
                                    className="h-8 w-8 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg shrink-0"
                                    title="Delete this Attendance Entry"
                                    aria-label="Delete entry"
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

                {/* Mobile Cards */}
                <div className="md:hidden divide-y divide-slate-100">
                  {filteredRecords.map((rec) => {
                    const staffUser = rec.user;
                    return (
                      <div key={rec.id} className="p-4 space-y-2.5 bg-white">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
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
                              <div className="text-[10px] text-slate-400">
                                {staffUser?.role || 'Staff'} • <span className="font-mono font-bold text-slate-600">{rec.date}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {isAdminOrSuperAdmin && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onOpenEditModal(rec)}
                                className="h-7 w-7 p-0 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                                title="Edit Record"
                                aria-label="Edit record"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {isSuperAdmin && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onDeleteRecord(rec.id)}
                                className="h-7 w-7 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg"
                                title="Delete Entry"
                                aria-label="Delete entry"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200/60">
                          {getStatusBadge(rec.status)}
                          <div className="text-xs font-mono font-bold text-slate-700 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {rec.checkInTime || '—'}
                          </div>
                        </div>

                        {(rec.markedByName || rec.notes) && (
                          <div className="text-[11px] text-slate-500 space-y-0.5">
                            {rec.markedByName && <div>Recorded by: <span className="font-medium text-slate-700">{rec.markedByName}</span></div>}
                            {rec.notes && <div className="italic text-slate-400">"{rec.notes}"</div>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </>
      ) : (
        /* Audit Trail Table */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          {auditLogs.length === 0 ? (
            <div className="p-12 text-center text-slate-400 font-medium">
              No audit log entries recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-slate-900 text-white text-[11px] font-bold uppercase tracking-wider select-none">
                    <th className="py-3.5 pl-5 pr-3 w-[25%]">Timestamp (NPT)</th>
                    <th className="py-3.5 px-3 w-[20%]">Action</th>
                    <th className="py-3.5 px-3 w-[25%]">Modified By</th>
                    <th className="py-3.5 pl-3 pr-5 w-[30%]">Audit Details / Changes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 pl-5 pr-3 align-top font-mono font-medium text-slate-600">
                        <div>{log.timeNPT || log.timestamp}</div>
                        <div className="text-[10px] text-slate-400">Target Date: {log.targetDate}</div>
                      </td>

                      <td className="py-3.5 px-3 align-top">
                        <Badge className="bg-slate-100 text-slate-800 border border-slate-200 text-[10px] font-bold">
                          {log.action}
                        </Badge>
                      </td>

                      <td className="py-3.5 px-3 align-top">
                        <div className="font-bold text-slate-900">{log.performedByName}</div>
                        <div className="text-[10px] text-slate-400 font-semibold">{log.performedByRole}</div>
                      </td>

                      <td className="py-3.5 pl-3 pr-5 align-top">
                        <div className="font-mono text-[11px] text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-200/60 overflow-x-auto max-h-24">
                          {JSON.stringify(log.details)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
