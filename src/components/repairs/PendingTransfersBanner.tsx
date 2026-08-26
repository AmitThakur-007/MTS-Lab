import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowRightLeft, 
  Check, 
  X, 
  Clock, 
  User, 
  Smartphone,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { transferService } from '@/services/transferService';
import { RepairTransferRecord } from '@/types/transfer';
import { useAuthStore } from '@/store/authStore';
import { useRealtimeSync } from '@/services/realtime';
import { toast } from 'sonner';

interface PendingTransfersBannerProps {
  onTransferResolved?: () => void;
}

export default function PendingTransfersBanner({ onTransferResolved }: PendingTransfersBannerProps) {
  const { user } = useAuthStore();
  const [pendingTransfers, setPendingTransfers] = useState<RepairTransferRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // Reject modal state
  const [rejectingTransfer, setRejectingTransfer] = useState<RepairTransferRecord | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchPendingTransfers = async () => {
    if (!user?.id) return;
    try {
      const data = await transferService.getTransfers({
        status: 'PENDING',
        targetTechnicianId: user.id
      });
      if (Array.isArray(data)) {
        setPendingTransfers(data);
      } else {
        setPendingTransfers([]);
      }
    } catch (err) {
      console.warn('[PENDING TRANSFERS] Fetch notice:', err);
    }
  };

  useEffect(() => {
    fetchPendingTransfers();
  }, [user?.id]);

  // Sync on transfer updates
  useRealtimeSync(['repair', 'notification'], () => {
    fetchPendingTransfers();
  });

  const handleAccept = async (transfer: RepairTransferRecord) => {
    setActionLoading(true);
    try {
      await transferService.acceptTransfer(transfer.id);
      toast.success(`Transfer for Repair #${transfer.repairNumber} accepted!`);
      setPendingTransfers(prev => prev.filter(t => t.id !== transfer.id));
      if (onTransferResolved) onTransferResolved();
    } catch (err: any) {
      toast.error(err.message || 'Failed to accept transfer');
      fetchPendingTransfers();
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingTransfer) return;
    setActionLoading(true);
    try {
      await transferService.rejectTransfer(rejectingTransfer.id, rejectionReason.trim());
      toast.info(`Transfer request for Repair #${rejectingTransfer.repairNumber} declined.`);
      setPendingTransfers(prev => prev.filter(t => t.id !== rejectingTransfer.id));
      setRejectingTransfer(null);
      setRejectionReason('');
      if (onTransferResolved) onTransferResolved();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject transfer');
    } finally {
      setActionLoading(false);
    }
  };

  if (pendingTransfers.length === 0) return null;

  return (
    <>
      <div className="space-y-3 mb-6">
        {pendingTransfers.map((transfer) => (
          <Card 
            key={transfer.id}
            className="rounded-2xl border border-indigo-200/90 bg-gradient-to-r from-indigo-50/90 via-purple-50/50 to-white shadow-sm overflow-hidden"
          >
            <CardContent className="p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-sm shrink-0 mt-0.5">
                  <ArrowRightLeft className="w-5 h-5 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      #{transfer.repairNumber}
                    </span>
                    <Badge className="bg-indigo-100 text-indigo-800 border-none text-[10px] font-bold">
                      Incoming Transfer Request
                    </Badge>
                    <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(transfer.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 font-medium">
                    <strong className="text-slate-900">{transfer.senderName}</strong> ({transfer.senderRole}) requested to transfer this repair to you.
                  </p>

                  {transfer.reason && (
                    <p className="text-[11px] text-slate-500 italic bg-white/70 px-2.5 py-1 rounded-lg border border-slate-200/60 inline-block">
                      Reason: "{transfer.reason}"
                    </p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 w-full md:w-auto justify-end pt-2 md:pt-0 border-t md:border-t-0 border-slate-200/60">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRejectingTransfer(transfer)}
                  disabled={actionLoading}
                  className="rounded-xl border-slate-200 text-red-600 hover:bg-red-50 hover:border-red-200 font-bold text-xs h-9 px-3.5 gap-1.5"
                >
                  <X className="w-3.5 h-3.5" /> Decline
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleAccept(transfer)}
                  disabled={actionLoading}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 px-4 gap-1.5 shadow-sm"
                >
                  {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Accept Transfer
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Reject Modal */}
      <Dialog open={Boolean(rejectingTransfer)} onOpenChange={() => setRejectingTransfer(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Decline Transfer Request
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Decline transfer for Repair #{rejectingTransfer?.repairNumber} from {rejectingTransfer?.senderName}. The repair will remain assigned to the original technician.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-3">
            <Label className="text-xs font-bold text-slate-700">Reason for Declining (Optional)</Label>
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Schedule at full capacity / Specialized parts pending..."
              className="text-xs rounded-xl border-slate-200 resize-none min-h-[70px]"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRejectingTransfer(null)}
              className="rounded-xl border-slate-200 text-xs font-bold"
            >
              Back
            </Button>
            <Button
              type="button"
              onClick={handleConfirmReject}
              disabled={actionLoading}
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold"
            >
              {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
              Confirm Decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
