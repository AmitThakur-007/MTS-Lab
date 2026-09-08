import React from 'react';
import { Eye, Edit3, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DamageRecord, getComponentBadgeColor } from './types';
import { cn } from '@/lib/utils';

interface Props {
  records: DamageRecord[];
  canEditOrDelete: boolean;
  onViewDetails: (record: DamageRecord) => void;
  onEdit: (record: DamageRecord) => void;
  onDelete: (record: DamageRecord) => void;
}

export const DamageTableView: React.FC<Props> = ({
  records,
  canEditOrDelete,
  onViewDetails,
  onEdit,
  onDelete,
}) => {
  return (
    <div className="bg-white rounded-3xl border border-slate-200/70 shadow-xs overflow-hidden" id="damage-table-container">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse min-w-[760px]">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200/70 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              <th className="py-3.5 px-4 font-black">Record #</th>
              <th className="py-3.5 px-4 font-black">Staff Member</th>
              <th className="py-3.5 px-4 font-black">Damaged Component</th>
              <th className="py-3.5 px-4 font-black">Device & Repair</th>
              <th className="py-3.5 px-4 font-black">Date & Time</th>
              <th className="py-3.5 px-4 font-black text-right">Est. Cost</th>
              <th className="py-3.5 px-4 font-black text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
            {records.map((rec) => {
              const compBadgeClass = getComponentBadgeColor(rec.damagedComponent);
              const deviceName = `${rec.deviceBrand || ''} ${rec.deviceModel || ''}`.trim() || '—';

              return (
                <tr key={rec.id} className="hover:bg-slate-50/70 transition-colors">
                  {/* Record # */}
                  <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                    {rec.recordNumber}
                  </td>

                  {/* Staff Member */}
                  <td className="py-3 px-4">
                    <div className="min-w-0 max-w-[160px]">
                      <div className="font-extrabold text-slate-900 truncate" title={rec.staffName}>
                        {rec.staffName}
                      </div>
                      <div className="text-[10px] text-slate-400 uppercase tracking-wider truncate">
                        {rec.staffRole?.replace(/_/g, ' ') || 'Staff'}
                      </div>
                    </div>
                  </td>

                  {/* Damaged Component */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge className={cn("text-[10px] font-extrabold px-2.5 py-0.5 rounded-lg border shrink-0", compBadgeClass)}>
                        {rec.damagedComponent}
                      </Badge>
                      {rec.damageType && (
                        <span className="text-[10px] text-slate-400">({rec.damageType})</span>
                      )}
                    </div>
                  </td>

                  {/* Device & Repair */}
                  <td className="py-3 px-4">
                    <div className="min-w-0 max-w-[180px]">
                      <div className="font-bold text-slate-800 truncate" title={deviceName}>
                        {deviceName}
                      </div>
                      {rec.repairNumber ? (
                        <span className="font-mono text-[11px] font-bold text-indigo-600">
                          #{rec.repairNumber}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">Unlinked</span>
                      )}
                    </div>
                  </td>

                  {/* Date & Time */}
                  <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                    <div>{rec.damageDate}</div>
                    {rec.damageTime && <div className="text-[10px] text-slate-400">{rec.damageTime}</div>}
                  </td>

                  {/* Est. Cost */}
                  <td className="py-3 px-4 text-right font-extrabold text-emerald-700 whitespace-nowrap">
                    {rec.estimatedCost !== null && rec.estimatedCost !== undefined ? (
                      `NPR ${rec.estimatedCost.toLocaleString()}`
                    ) : (
                      <span className="text-slate-400 font-normal">—</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onViewDetails(rec)}
                        className="h-8 px-2.5 rounded-xl text-xs font-bold text-indigo-600 hover:bg-indigo-50 cursor-pointer gap-1"
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
                            onClick={() => onEdit(rec)}
                            className="h-8 w-8 p-0 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                            title="Edit Record"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => onDelete(rec)}
                            className="h-8 w-8 p-0 rounded-xl text-rose-500 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                            title="Archive Record"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
