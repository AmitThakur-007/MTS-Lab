import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowRightLeft, 
  UserCheck, 
  Clock, 
  History, 
  User, 
  CheckCircle2, 
  XCircle, 
  AlertCircle 
} from 'lucide-react';
import { transferService } from '@/services/transferService';
import { RepairAssignmentHistoryItem } from '@/types/transfer';

interface RepairTransferHistoryTimelineProps {
  repairId: string;
}

export default function RepairTransferHistoryTimeline({ repairId }: RepairTransferHistoryTimelineProps) {
  const [history, setHistory] = useState<RepairAssignmentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    if (!repairId) return;
    try {
      const data = await transferService.getRepairTransferHistory(repairId);
      if (Array.isArray(data)) {
        setHistory(data);
      } else {
        setHistory([]);
      }
    } catch (err) {
      console.warn('[TRANSFER HISTORY] Fetch notice:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [repairId]);

  if (loading) {
    return (
      <Card className="rounded-2xl border-slate-200/80 shadow-sm bg-white p-5">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
          <Clock className="w-4 h-4 animate-spin" /> Loading assignment history...
        </div>
      </Card>
    );
  }

  if (history.length === 0) {
    return (
      <Card className="rounded-2xl border-slate-200/80 shadow-sm bg-white p-5">
        <div className="flex items-center gap-2 mb-1">
          <History className="w-4 h-4 text-slate-400" />
          <h4 className="text-xs font-bold text-slate-700">Assignment History</h4>
        </div>
        <p className="text-xs text-slate-400 font-medium">No transfer or reassignment records recorded for this repair.</p>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-slate-200/80 shadow-sm bg-white overflow-hidden">
      <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
            <History className="w-4 h-4" />
          </div>
          <div>
            <CardTitle className="text-sm font-bold text-slate-900">Assignment & Transfer History</CardTitle>
            <CardDescription className="text-xs text-slate-500">Permanent chronological audit trail of workshop handovers.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-5">
        <div className="relative pl-6 space-y-5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
          {history.map((item, idx) => {
            const isDirect = item.transferType?.includes('DIRECT');
            return (
              <div key={item.id || idx} className="relative">
                <div className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full border-2 border-white bg-indigo-600 shadow-sm" />
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-900">{item.newAssigneeName}</span>
                      <Badge className="bg-slate-100 text-slate-700 border-none text-[10px] font-bold">
                        {isDirect ? 'Direct Assignment' : 'Accepted Transfer'}
                      </Badge>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {new Date(item.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 font-medium">
                    {item.previousAssigneeName ? (
                      <>Transferred from <strong className="text-slate-800">{item.previousAssigneeName}</strong> by <strong className="text-slate-800">{item.assignedByName}</strong> ({item.assignedByRole})</>
                    ) : (
                      <>Assigned by <strong className="text-slate-800">{item.assignedByName}</strong> ({item.assignedByRole})</>
                    )}
                  </p>

                  {item.reason && (
                    <p className="text-[11px] text-slate-500 italic bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100 inline-block">
                      Note: "{item.reason}"
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
