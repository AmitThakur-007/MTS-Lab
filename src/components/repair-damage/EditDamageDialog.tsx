import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from '@/components/ui/dialog';
import { DamageRecord, STANDARD_COMPONENTS, DAMAGE_TYPES } from './types';
import { api } from '@/services/api';
import { toast } from 'sonner';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  record: DamageRecord | null;
}

export const EditDamageDialog: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
  record,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [editFormData, setEditFormData] = useState({
    damagedComponent: 'Display Panel',
    damageType: 'CRACKED',
    damageDescription: '',
    damageDate: '',
    damageTime: '',
    quantity: 1,
    estimatedCost: '',
    notes: '',
    status: 'ACTIVE',
    auditReason: '',
  });

  useEffect(() => {
    if (record) {
      setEditFormData({
        damagedComponent: record.damagedComponent || 'Display Panel',
        damageType: record.damageType || 'CRACKED',
        damageDescription: record.damageDescription || '',
        damageDate: record.damageDate || '',
        damageTime: record.damageTime || '',
        quantity: record.quantity || 1,
        estimatedCost: record.estimatedCost !== null && record.estimatedCost !== undefined ? String(record.estimatedCost) : '',
        notes: record.notes || '',
        status: record.status || 'ACTIVE',
        auditReason: '',
      });
    }
  }, [record]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!record) return;
    if (!editFormData.damageDescription.trim()) {
      toast.error('Description cannot be empty.');
      return;
    }
    if (!editFormData.auditReason.trim()) {
      toast.error('Please provide an audit change reason.');
      return;
    }

    setSubmitting(true);
    try {
      await api.patch(`/repair-damage/${record.id}`, {
        ...editFormData,
        quantity: Number(editFormData.quantity) || 1,
        estimatedCost: editFormData.estimatedCost ? parseFloat(editFormData.estimatedCost) : null,
      });
      toast.success('Damage record updated with audit log.');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('[UPDATE DAMAGE ERROR]', err);
      toast.error(err?.message || 'Failed to update damage record.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        id="edit-damage-dialog"
        className="w-[calc(100vw-1.5rem)] sm:w-full max-w-xl rounded-3xl p-0 border border-slate-200 shadow-2xl overflow-hidden bg-white max-h-[90vh] flex flex-col"
      >
        <DialogHeader className="p-4 sm:p-6 pb-4 bg-slate-900 text-white shrink-0">
          <DialogTitle className="text-lg sm:text-xl font-black text-white">
            Edit Repair-Related Damage Record
          </DialogTitle>
          <DialogDescription className="font-medium text-slate-400 text-xs mt-0.5">
            Modify record parameters with mandatory audit tracking
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
              <div className="space-y-1.5 min-w-0">
                <Label className="text-xs font-bold text-slate-700">Damaged Component</Label>
                <Select value={editFormData.damagedComponent} onValueChange={v => setEditFormData({ ...editFormData, damagedComponent: v })}>
                  <SelectTrigger className="h-10 rounded-xl border-slate-200 text-xs font-bold">
                    <SelectValue placeholder="Component" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl max-h-56">
                    {STANDARD_COMPONENTS.map(c => (
                      <SelectItem key={c} value={c} className="text-xs font-bold">{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 min-w-0">
                <Label className="text-xs font-bold text-slate-700">Damage Classification</Label>
                <Select value={editFormData.damageType} onValueChange={v => setEditFormData({ ...editFormData, damageType: v })}>
                  <SelectTrigger className="h-10 rounded-xl border-slate-200 text-xs font-bold">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {DAMAGE_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value} className="text-xs font-medium">{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5 min-w-0">
              <Label className="text-xs font-bold text-slate-700">Damage Description *</Label>
              <Textarea 
                rows={3}
                value={editFormData.damageDescription}
                onChange={e => setEditFormData({ ...editFormData, damageDescription: e.target.value })}
                className="rounded-xl border-slate-200 text-xs font-medium resize-none"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 min-w-0">
                <Label className="text-xs font-bold text-slate-700">Date</Label>
                <Input 
                  type="date"
                  value={editFormData.damageDate}
                  onChange={e => setEditFormData({ ...editFormData, damageDate: e.target.value })}
                  className="h-10 rounded-xl border-slate-200 text-xs font-medium"
                />
              </div>
              <div className="space-y-1.5 min-w-0">
                <Label className="text-xs font-bold text-slate-700">Time</Label>
                <Input 
                  type="time"
                  value={editFormData.damageTime}
                  onChange={e => setEditFormData({ ...editFormData, damageTime: e.target.value })}
                  className="h-10 rounded-xl border-slate-200 text-xs font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 min-w-0">
                <Label className="text-xs font-bold text-slate-700">Est. Cost (NPR)</Label>
                <Input 
                  type="number"
                  value={editFormData.estimatedCost}
                  onChange={e => setEditFormData({ ...editFormData, estimatedCost: e.target.value })}
                  className="h-10 rounded-xl border-slate-200 text-xs font-medium"
                />
              </div>
              <div className="space-y-1.5 min-w-0">
                <Label className="text-xs font-bold text-slate-700">Status</Label>
                <Select value={editFormData.status} onValueChange={v => setEditFormData({ ...editFormData, status: v })}>
                  <SelectTrigger className="h-10 rounded-xl border-slate-200 text-xs font-bold">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="ACTIVE" className="text-xs font-bold">ACTIVE</SelectItem>
                    <SelectItem value="RESOLVED" className="text-xs font-bold">RESOLVED</SelectItem>
                    <SelectItem value="REPLACED" className="text-xs font-bold">REPLACED</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5 min-w-0">
              <Label className="text-xs font-bold text-slate-700">Audit Change Reason *</Label>
              <Input 
                placeholder="Reason for modifying this damage record (mandatory audit note)..."
                value={editFormData.auditReason}
                onChange={e => setEditFormData({ ...editFormData, auditReason: e.target.value })}
                className="h-10 rounded-xl border-slate-200 text-xs font-medium"
                required
              />
            </div>
          </div>

          <DialogFooter className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="rounded-xl text-xs font-bold text-slate-500 cursor-pointer h-10 px-4"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="rounded-xl h-10 px-5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md cursor-pointer"
              disabled={submitting}
            >
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
