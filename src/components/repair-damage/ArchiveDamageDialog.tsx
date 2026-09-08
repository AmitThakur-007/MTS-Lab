import React, { useState } from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from '@/components/ui/alert-dialog';
import { DamageRecord } from './types';
import { api } from '@/services/api';
import { toast } from 'sonner';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  record: DamageRecord | null;
}

export const ArchiveDamageDialog: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
  record,
}) => {
  const [submitting, setSubmitting] = useState(false);

  const handleDeleteDamage = async () => {
    if (!record) return;
    setSubmitting(true);
    try {
      await api.delete(`/repair-damage/${record.id}`);
      toast.success('Damage record safely archived.');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('[DELETE DAMAGE ERROR]', err);
      toast.error(err?.message || 'Failed to archive damage record.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent 
        id="archive-damage-dialog"
        className="w-[calc(100vw-1.5rem)] sm:w-full max-w-md rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-2xl bg-white space-y-4"
      >
        <AlertDialogHeader>
          <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shadow-2xs shrink-0">
            <Trash2 className="h-5 w-5" />
          </div>
          <AlertDialogTitle className="text-lg font-bold text-slate-900">
            Archive Damage Record?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-xs text-slate-500 leading-relaxed">
            This record (<span className="font-mono font-bold text-slate-800">{record?.recordNumber}</span>) will be safely removed from active views and archived with an immutable audit log.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="flex items-center justify-between gap-2 pt-2">
          <AlertDialogCancel 
            onClick={onClose}
            className="rounded-xl text-xs font-bold text-slate-600 border-slate-200 cursor-pointer h-10 px-4"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={submitting}
            onClick={handleDeleteDamage}
            className="rounded-xl text-xs font-bold h-10 px-5 bg-rose-600 hover:bg-rose-700 text-white shadow-md cursor-pointer"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
            Confirm Archival
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
