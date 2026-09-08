import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Calendar,
  User,
  ShieldAlert,
  Loader2,
  HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { StaffRosterItem } from './TodayRosterView';

// 1. Edit / Correct Record Modal
interface EditRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: any | null;
  onSave: (payload: {
    userId: string;
    date: string;
    status: string;
    checkInTime?: string;
    notes?: string;
    reason?: string;
  }) => Promise<void>;
}

export const EditRecordModal: React.FC<EditRecordModalProps> = ({
  isOpen,
  onClose,
  record,
  onSave,
}) => {
  const [status, setStatus] = useState('PRESENT');
  const [checkInTime, setCheckInTime] = useState('');
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (record) {
      setStatus(record.status === 'NOT_MARKED' || record.status === 'PENDING' ? 'PRESENT' : record.status);
      setCheckInTime(record.checkInTime || record.time || '10:05:00');
      setNotes(record.notes || '');
      setReason('');
    }
  }, [record]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!record) return;
    setIsSubmitting(true);
    try {
      await onSave({
        userId: record.userId || record.id,
        date: record.date,
        status,
        checkInTime,
        notes,
        reason,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!record) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-600" />
            Edit / Correct Attendance Record
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Authoritative update for{' '}
            <strong className="text-slate-800">{record.name || record.user?.name || 'Staff Member'}</strong>{' '}
            on <strong className="text-slate-800">{record.date}</strong>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Status Selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">Attendance Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9 text-xs bg-slate-50 border-slate-200 rounded-xl">
                <SelectValue placeholder="Select Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PRESENT">PRESENT (On-time presence)</SelectItem>
                <SelectItem value="LATE">LATE (Arrived after business start)</SelectItem>
                <SelectItem value="HALF_DAY">HALF DAY (Partial shift)</SelectItem>
                <SelectItem value="ABSENT">ABSENT (Not present)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Check-In Time */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">Check-In Time (NPT)</Label>
            <Input
              type="text"
              value={checkInTime}
              onChange={(e) => setCheckInTime(e.target.value)}
              placeholder="e.g. 10:12:00 or 10:15 AM"
              className="h-9 text-xs bg-slate-50 border-slate-200 rounded-xl font-mono"
            />
          </div>

          {/* Notes / Remarks */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">Internal Notes (Optional)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Approved remote diagnostic shift"
              className="h-9 text-xs bg-slate-50 border-slate-200 rounded-xl"
            />
          </div>

          {/* Correction Reason */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">Correction Reason (For Audit Log)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this record is being updated..."
              rows={2}
              className="text-xs bg-slate-50 border-slate-200 rounded-xl resize-none"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="h-9 rounded-xl border-slate-200 text-xs font-bold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// 2. Staff Monthly Calendar Detail Modal
interface StaffHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffName: string;
  userId: string;
  dailyLogs: any[];
  stats: {
    presentCount: number;
    absentCount: number;
    attendanceRate: number | null;
  };
  isLoading: boolean;
  selectedMonth: string;
  onMonthChange: (m: string) => void;
}

export const StaffHistoryModal: React.FC<StaffHistoryModalProps> = ({
  isOpen,
  onClose,
  staffName,
  userId,
  dailyLogs,
  stats,
  isLoading,
  selectedMonth,
  onMonthChange,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col rounded-3xl p-0 overflow-hidden">
        <DialogHeader className="p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between gap-4">
            <div>
              <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
                <User className="w-5 h-5 text-indigo-600" />
                {staffName} — Monthly Attendance
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                Complete daily breakdown for {selectedMonth}.
              </DialogDescription>
            </div>

            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => onMonthChange(e.target.value)}
              className="h-8 px-2 text-xs font-bold bg-white border border-slate-200 rounded-lg shadow-2xs"
            />
          </div>
        </DialogHeader>

        {/* Quick KPI Bar */}
        <div className="grid grid-cols-3 gap-3 p-4 bg-white border-b border-slate-100 text-center">
          <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-100">
            <div className="text-[10px] font-bold text-emerald-800 uppercase">Days Present</div>
            <div className="text-lg font-black text-emerald-950">{stats.presentCount}</div>
          </div>
          <div className="p-2 bg-rose-50 rounded-xl border border-rose-100">
            <div className="text-[10px] font-bold text-rose-800 uppercase">Days Absent</div>
            <div className="text-lg font-black text-rose-950">{stats.absentCount}</div>
          </div>
          <div className="p-2 bg-indigo-50 rounded-xl border border-indigo-100">
            <div className="text-[10px] font-bold text-indigo-800 uppercase">Monthly Rate</div>
            <div className="text-lg font-black text-indigo-950">
              {stats.attendanceRate !== null ? `${stats.attendanceRate}%` : '100%'}
            </div>
          </div>
        </div>

        {/* Log List */}
        <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-100">
          {isLoading ? (
            <div className="p-8 text-center text-slate-400 text-xs font-medium">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
              Loading staff calendar...
            </div>
          ) : dailyLogs.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs font-medium">
              No daily logs recorded for this month.
            </div>
          ) : (
            dailyLogs.map((log) => {
              const isSat = log.dayOfWeek === 'Sat';
              return (
                <div key={log.date} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        'w-8 h-8 rounded-lg flex flex-col items-center justify-center font-mono font-bold text-[10px]',
                        isSat ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-700'
                      )}
                    >
                      <span>{log.dayOfWeek}</span>
                      <span>{log.date.split('-')[2]}</span>
                    </span>
                    <div>
                      <div className="font-bold text-slate-800">{log.date}</div>
                      {log.record?.formattedCheckInTime && (
                        <div className="text-[10px] text-slate-400 font-mono">
                          Check-in: {log.record.formattedCheckInTime}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    {log.status === 'PRESENT' && (
                      <Badge className="bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 text-[11px] font-bold">
                        PRESENT
                      </Badge>
                    )}
                    {log.status === 'LATE' && (
                      <Badge className="bg-amber-500/10 text-amber-700 border border-amber-500/20 text-[11px] font-bold">
                        LATE
                      </Badge>
                    )}
                    {log.status === 'HALF_DAY' && (
                      <Badge className="bg-sky-500/10 text-sky-700 border border-sky-500/20 text-[11px] font-bold">
                        HALF DAY
                      </Badge>
                    )}
                    {log.status === 'ABSENT' && (
                      <Badge className="bg-rose-500/10 text-rose-700 border border-rose-500/20 text-[11px] font-bold">
                        ABSENT
                      </Badge>
                    )}
                    {log.status === 'NOT_MARKED' && !log.isFuture && (
                      <Badge className="bg-slate-100 text-slate-500 border border-slate-200 text-[11px] font-bold">
                        NOT MARKED
                      </Badge>
                    )}
                    {log.isFuture && (
                      <span className="text-slate-400 text-[11px] italic">Upcoming</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <DialogFooter className="p-4 border-t border-slate-100 bg-slate-50/50">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-9 px-4 rounded-xl border-slate-200 text-xs font-bold"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// 3. Bulk Mark Modal
interface BulkMarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalStaff: number;
  targetDate: string;
  onConfirm: () => Promise<void>;
  isSubmitting: boolean;
}

export const BulkMarkModal: React.FC<BulkMarkModalProps> = ({
  isOpen,
  onClose,
  totalStaff,
  targetDate,
  onConfirm,
  isSubmitting,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            Mark All Staff Present
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            This will record attendance as <strong className="text-emerald-700">PRESENT</strong> for all{' '}
            <strong className="text-slate-800">{totalStaff} active staff members</strong> for{' '}
            <strong className="text-slate-800">{targetDate}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 space-y-1">
          <div className="font-bold flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Instant Batch Attendance Confirmation
          </div>
          <p className="text-[11px] leading-relaxed">
            Existing records for today will be updated to PRESENT. Individual exceptions (Late/Absent) can still be adjusted individually afterwards.
          </p>
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-9 rounded-xl border-slate-200 text-xs font-bold"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold gap-1.5"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing...
              </>
            ) : (
              'Confirm Mark All'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// 4. Purge Staff Modal (Super Admin only)
interface PurgeStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffName: string;
  userId: string;
  onConfirm: () => Promise<void>;
  isSubmitting: boolean;
}

export const PurgeStaffModal: React.FC<PurgeStaffModalProps> = ({
  isOpen,
  onClose,
  staffName,
  userId,
  onConfirm,
  isSubmitting,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md rounded-2xl border-rose-200">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-rose-900 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-600" />
            Permanent Staff Removal (Super Admin)
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Permanently delete <strong className="text-slate-800">{staffName}</strong> and all associated attendance history records.
          </DialogDescription>
        </DialogHeader>

        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1">
          <div className="font-bold flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            Irreversible Action
          </div>
          <p className="text-[11px] leading-relaxed">
            This operation completely cleanses the employee from Staff rosters and all historical attendance databases.
          </p>
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-9 rounded-xl border-slate-200 text-xs font-bold"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="h-9 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold gap-1.5"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Purging...
              </>
            ) : (
              'Permanently Delete'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
