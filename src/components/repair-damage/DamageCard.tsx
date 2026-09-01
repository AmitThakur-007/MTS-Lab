import React from 'react';
import { Clock, Eye, Edit3, Trash2, Smartphone, Hash, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DamageRecord, getComponentBadgeColor } from './types';
import { cn } from '@/lib/utils';

interface Props {
  record: DamageRecord;
  canEditOrDelete: boolean;
  onViewDetails: (record: DamageRecord) => void;
  onEdit: (record: DamageRecord) => void;
  onDelete: (record: DamageRecord) => void;
}

export const DamageCard: React.FC<Props> = ({
  record,
  canEditOrDelete,
  onViewDetails,
  onEdit,
  onDelete,
}) => {
  const compBadgeClass = getComponentBadgeColor(record.damagedComponent);
  const deviceName = `${record.deviceBrand || ''} ${record.deviceModel || ''}`.trim() || 'Unspecified Device';

  return (
    <div 
      className="bg-white rounded-3xl border border-slate-200/70 p-4 sm:p-5 hover:border-slate-300 hover:shadow-lg transition-all flex flex-col justify-between min-w-0 overflow-hidden group shadow-2xs space-y-3.5"
      id={`damage-card-${record.id}`}
    >
      {/* Top Bar: Record #, Date & Component Badge */}
      <div className="flex items-start justify-between gap-2 min-w-0 pb-3 border-b border-slate-100">
        <div className="min-w-0 flex-1">
          <span className="text-[11px] font-black tracking-wider text-slate-900 uppercase block font-mono truncate">
            {record.recordNumber}
          </span>
          <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1 mt-0.5 truncate">
            <Clock className="h-3 w-3 text-slate-400 shrink-0" />
            <span className="truncate">{record.damageDate} {record.damageTime ? `• ${record.damageTime}` : ''}</span>
          </span>
        </div>
        
        <Badge className={cn("text-[10px] font-extrabold px-2.5 py-0.5 rounded-lg shrink-0 border truncate max-w-[140px]", compBadgeClass)}>
          {record.damagedComponent}
        </Badge>
      </div>

      {/* Middle Content: Staff Info & Device Box */}
      <div className="space-y-2.5 min-w-0">
        {/* Staff Person */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200/60 flex items-center justify-center text-slate-700 font-bold text-xs shrink-0">
            {record.staffName ? record.staffName[0].toUpperCase() : 'S'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-extrabold text-slate-900 truncate" title={record.staffName}>
              {record.staffName}
            </p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">
              {record.staffRole?.replace(/_/g, ' ') || 'Staff Member'}
            </p>
          </div>
        </div>

        {/* Device & Repair Reference Box */}
        <div className="p-2.5 bg-slate-50/80 rounded-2xl border border-slate-200/60 space-y-1.5 min-w-0">
          <div className="flex items-center justify-between text-xs min-w-0 gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
              <Smartphone className="h-3 w-3 text-slate-400 shrink-0" />
              <span>Device</span>
            </span>
            <span className="font-bold text-slate-800 truncate text-right" title={deviceName}>
              {deviceName}
            </span>
          </div>
          
          {record.repairNumber && (
            <div className="flex items-center justify-between text-xs min-w-0 gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
                <Hash className="h-3 w-3 text-slate-400 shrink-0" />
                <span>Repair</span>
              </span>
              <span className="font-mono font-bold text-indigo-600 truncate text-right">
                #{record.repairNumber}
              </span>
            </div>
          )}

          {record.estimatedCost !== null && record.estimatedCost !== undefined && (
            <div className="flex items-center justify-between text-xs min-w-0 gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
                <DollarSign className="h-3 w-3 text-slate-400 shrink-0" />
                <span>Est. Cost</span>
              </span>
              <span className="font-extrabold text-emerald-700 truncate text-right">
                NPR {record.estimatedCost.toLocaleString()}
              </span>
            </div>
          )}
        </div>

        {/* Incident Summary text */}
        <p className="text-xs text-slate-600 font-medium line-clamp-2 leading-relaxed bg-white break-words" title={record.damageDescription}>
          {record.damageDescription}
        </p>
      </div>

      {/* Bottom Actions Bar */}
      <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 shrink-0 min-w-0">
        <div className="min-w-0 flex-1 text-[10px] text-slate-400 truncate">
          <span className="truncate block">By: <b className="text-slate-600 font-bold">{record.recordedByName || 'Manager'}</b></span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onViewDetails(record)}
            className="h-8 px-2.5 rounded-xl text-xs font-bold text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer gap-1"
          >
            <Eye className="h-3.5 w-3.5" />
            <span>Details</span>
          </Button>

          {canEditOrDelete && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onEdit(record)}
                className="h-8 w-8 p-0 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                title="Edit Record"
              >
                <Edit3 className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onDelete(record)}
                className="h-8 w-8 p-0 rounded-xl text-rose-500 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                title="Archive Record"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
