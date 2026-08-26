import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowRightLeft, 
  UserCheck, 
  ShieldAlert, 
  Loader2, 
  AlertCircle,
  Smartphone
} from 'lucide-react';
import { api } from '@/services/api';
import { transferService } from '@/services/transferService';
import { useAuthStore } from '@/store/authStore';
import { canAssignDirectly, normalizeRole, getRoleDisplayName } from '@/lib/rbac';
import { toast } from 'sonner';

interface TransferRepairModalProps {
  isOpen: boolean;
  onClose: () => void;
  repair: any;
  onTransferComplete?: (updatedRepair: any) => void;
}

export default function TransferRepairModal({
  isOpen,
  onClose,
  repair,
  onTransferComplete
}: TransferRepairModalProps) {
  const { user } = useAuthStore();
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [loadingTechs, setLoadingTechs] = useState(false);
  const [selectedTechId, setSelectedTechId] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const currentUserRole = normalizeRole(user?.role);
  const isDirectAssigner = canAssignDirectly(currentUserRole);

  useEffect(() => {
    if (isOpen) {
      setLoadingTechs(true);
      api.get('/users')
        .then((data: any) => {
          if (Array.isArray(data)) {
            // Filter for active technicians and head technicians
            const techList = data.filter((u: any) => {
              const role = normalizeRole(u.role);
              const isActive = u.isActive !== false && u.accountStatus !== 'INACTIVE' && u.accountStatus !== 'SUSPENDED';
              return isActive && (role === 'TECHNICIAN' || role === 'HEAD_TECHNICIAN');
            });
            setTechnicians(techList);
          }
        })
        .catch((err) => {
          console.error('[TRANSFER MODAL] Failed to load technicians:', err);
        })
        .finally(() => {
          setLoadingTechs(false);
        });

      setSelectedTechId('');
      setReason('');
    }
  }, [isOpen]);

  if (!repair) return null;

  const targetTech = technicians.find(t => t.id === selectedTechId);
  const targetRole = normalizeRole(targetTech?.role);

  const isTechnicianToHeadTech = currentUserRole === 'TECHNICIAN' && targetRole === 'HEAD_TECHNICIAN';
  const isTechnicianToTechnician = currentUserRole === 'TECHNICIAN' && targetRole === 'TECHNICIAN';

  const handleConfirmTransfer = async () => {
    if (!selectedTechId) {
      toast.error('Please select a recipient technician');
      return;
    }

    if (selectedTechId === (repair.technicianId || repair.assignedTechnicianId)) {
      toast.error('This repair is already assigned to the selected technician');
      return;
    }

    if (!isDirectAssigner && !reason.trim()) {
      toast.error('Please enter a reason for this transfer request');
      return;
    }

    setSubmitting(true);
    try {
      if (isDirectAssigner) {
        // Direct assignment (Manager, Head Tech, Admin, Super Admin)
        const res = await transferService.directAssignRepair(repair.id, {
          targetTechnicianId: targetTech.id,
          targetTechnicianName: targetTech.name,
          reason: reason.trim() || 'Direct workshop assignment'
        });
        toast.success(`Repair #${repair.repairNumber} directly assigned to ${targetTech.name}.`);
        if (onTransferComplete) onTransferComplete(res);
      } else {
        // Transfer request (Technician -> Technician, Technician -> Head Tech)
        await transferService.requestTransfer(repair.id, {
          targetTechnicianId: targetTech.id,
          reason: reason.trim()
        });
        toast.success(`Transfer request sent to ${targetTech.name}. Awaiting acceptance.`);
        if (onTransferComplete) onTransferComplete(repair);
      }
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete repair transfer');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md rounded-2xl p-6">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <DialogTitle className="text-lg font-bold text-slate-900">
              {isDirectAssigner ? 'Assign / Transfer Repair' : 'Request Repair Transfer'}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-500">
            {isDirectAssigner 
              ? 'Directly assign or transfer this repair ticket to another technician.' 
              : 'Submit a transfer request to another technician. The assignment will update once accepted.'}
          </DialogDescription>
        </DialogHeader>

        {/* Repair Summary Card */}
        <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-500">Repair Ticket</span>
            <span className="font-mono font-bold text-slate-900">{repair.repairNumber}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-500">Device</span>
            <span className="font-medium text-slate-800 flex items-center gap-1">
              <Smartphone className="w-3 h-3 text-slate-400" />
              {repair.deviceBrand || ''} {repair.deviceModel || 'Smartphone'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-500">Current Assignee</span>
            <Badge variant="outline" className="text-[10px] font-bold">
              {repair.technicianName || repair.technician?.name || 'Unassigned'}
            </Badge>
          </div>
        </div>

        {/* Transfer Form */}
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">Select Recipient Specialist</Label>
            {loadingTechs ? (
              <div className="h-10 border rounded-xl flex items-center justify-center text-xs text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading active technicians...
              </div>
            ) : (
              <Select value={selectedTechId} onValueChange={setSelectedTechId}>
                <SelectTrigger className="h-10 text-xs rounded-xl border-slate-200 font-bold">
                  <SelectValue placeholder="Choose technician..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl max-h-56">
                  {technicians
                    .filter(t => t.id !== (repair.technicianId || repair.assignedTechnicianId))
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id} className="text-xs font-medium">
                        <div className="flex items-center justify-between w-full gap-4">
                          <span className="font-bold">{t.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {getRoleDisplayName(t.role)}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Workflow Indicator */}
          {selectedTechId && (
            <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl text-xs space-y-1">
              <div className="font-bold text-indigo-950 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                {isDirectAssigner ? 'Direct Workshop Assignment' : isTechnicianToHeadTech ? 'Head Technician Transfer Request' : 'Peer Technician Transfer Request'}
              </div>
              <p className="text-[11px] text-indigo-800 font-medium">
                {isDirectAssigner 
                  ? `Immediate assignment to ${targetTech?.name}. No recipient acceptance needed.` 
                  : `Requires ${targetTech?.name} to accept before assignment changes.`}
              </p>
            </div>
          )}

          {/* Transfer Reason Input */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">
              Transfer Reason {isDirectAssigner ? '(Optional)' : '(Required)'}
            </Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Specialized motherboard micro-soldering required / Workload balancing..."
              className="text-xs rounded-xl border-slate-200 resize-none min-h-[70px]"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl border-slate-200 text-xs font-bold"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirmTransfer}
            disabled={submitting || !selectedTechId || (!isDirectAssigner && !reason.trim())}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold gap-1.5"
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isDirectAssigner ? 'Confirm Direct Assignment' : 'Submit Transfer Request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
