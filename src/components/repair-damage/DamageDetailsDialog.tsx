import React from 'react';
import { FileWarning, History, Edit3, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { DamageRecord, getComponentBadgeColor } from './types';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  record: DamageRecord | null;
  loading: boolean;
  canEditOrDelete: boolean;
  onEdit: (record: DamageRecord) => void;
}

export const DamageDetailsDialog: React.FC<Props> = ({
  isOpen,
  onClose,
  record,
  loading,
  canEditOrDelete,
  onEdit,
}) => {
  if (!record && !loading) return null;

  const compBadgeClass = record ? getComponentBadgeColor(record.damagedComponent) : '';
  const deviceName = record ? `${record.deviceBrand || ''} ${record.deviceModel || ''}`.trim() || '—' : '—';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        id="damage-details-dialog"
        className="w-[calc(100vw-1.5rem)] sm:w-full max-w-xl rounded-3xl p-0 border border-slate-200 shadow-2xl overflow-hidden bg-white max-h-[90vh] flex flex-col"
      >
        <DialogHeader className="p-4 sm:p-6 pb-4 bg-slate-900 text-white shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-rose-600/30 border border-rose-400/30 text-rose-400 flex items-center justify-center font-bold shrink-0">
                <FileWarning className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-lg sm:text-xl font-black text-white truncate">
                  Repair Damage Record Details
                </DialogTitle>
                <p className="text-xs text-slate-400 font-mono mt-0.5 truncate">{record?.recordNumber}</p>
              </div>
            </div>

            {record?.status && (
              <Badge className="bg-emerald-600 text-white text-[10px] font-black border-transparent shrink-0">
                {record.status}
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {loading ? (
            <div className="py-12 text-center flex flex-col items-center justify-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              <p className="text-xs text-slate-500 font-medium">Loading record details and audit history...</p>
            </div>
          ) : record ? (
            <>
              {/* Staff & Incident Core */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 sm:p-4 bg-slate-50 rounded-2xl border border-slate-200/60 text-xs">
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Responsible Staff</span>
                  <span className="font-extrabold text-slate-900 text-sm truncate block" title={record.staffName}>
                    {record.staffName}
                  </span>
                  <span className="text-[10px] text-slate-500 block truncate">
                    ({record.staffRole?.replace(/_/g, ' ') || 'Staff'})
                  </span>
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Damaged Component</span>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <Badge className={cn("text-[10px] font-extrabold px-2.5 py-0.5 rounded-lg border", compBadgeClass)}>
                      {record.damagedComponent}
                    </Badge>
                    <span className="text-[10px] text-slate-500">{record.damageType || 'Accidental'}</span>
                  </div>
                </div>
              </div>

              {/* Device & Repair Details */}
              <div className="space-y-1.5 text-xs">
                <h4 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Device & Repair Context</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-white rounded-2xl border border-slate-200">
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-400 font-bold block">Device Model</span>
                    <span className="font-bold text-slate-900 truncate block" title={deviceName}>
                      {deviceName}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-400 font-bold block">Repair Job #</span>
                    <span className="font-mono font-bold text-indigo-600 truncate block">
                      {record.repairNumber ? `#${record.repairNumber}` : 'Unlinked'}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-400 font-bold block">Estimated Cost</span>
                    <span className="font-bold text-emerald-700 truncate block">
                      {record.estimatedCost !== null && record.estimatedCost !== undefined 
                        ? `NPR ${record.estimatedCost.toLocaleString()}` 
                        : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5 text-xs">
                <h4 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Incident Description</h4>
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/70 text-slate-700 font-medium leading-relaxed break-words">
                  {record.damageDescription}
                </div>
              </div>

              {/* Date, Recorded By & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs p-3.5 bg-slate-50 rounded-2xl border border-slate-200/60">
                <div className="min-w-0">
                  <span className="text-[10px] text-slate-400 font-bold block">Date & Time</span>
                  <span className="font-bold text-slate-800 truncate block">
                    {record.damageDate} {record.damageTime ? `• ${record.damageTime}` : ''}
                  </span>
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] text-slate-400 font-bold block">Recorded By</span>
                  <span className="font-bold text-slate-800 truncate block">
                    {record.recordedByName || 'System'} ({record.recordedByRole?.replace(/_/g, ' ') || 'MANAGER'})
                  </span>
                </div>
              </div>

              {record.notes && (
                <div className="space-y-1 text-xs">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Internal Notes</span>
                  <p className="text-slate-600 italic bg-slate-50 p-3 rounded-xl border border-slate-200/50 break-words">
                    "{record.notes}"
                  </p>
                </div>
              )}

              {/* Audit Trail */}
              {record.audits && record.audits.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <h4 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <History className="h-3.5 w-3.5" />
                    <span>Traceable Audit History ({record.audits.length})</span>
                  </h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {record.audits.map((log: any) => (
                      <div key={log.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/60 text-[11px] space-y-0.5">
                        <div className="flex items-center justify-between font-bold text-slate-800 gap-2">
                          <span className="truncate">{log.action}</span>
                          <span className="text-[10px] text-slate-400 font-normal shrink-0">
                            {format(new Date(log.createdAt), 'dd MMM yyyy, HH:mm')}
                          </span>
                        </div>
                        <p className="text-slate-500 break-words">
                          By <b className="text-slate-700">{log.performedByName}</b> ({log.performedByRole?.replace(/_/g, ' ')}) • {log.reason || 'No remarks'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        <DialogFooter className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="rounded-xl text-xs font-bold text-slate-700 cursor-pointer h-10 px-4"
          >
            Close
          </Button>

          {canEditOrDelete && record && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onClose();
                onEdit(record);
              }}
              className="rounded-xl text-xs font-bold text-slate-700 cursor-pointer gap-1.5 h-10 px-4"
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>Edit Record</span>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
