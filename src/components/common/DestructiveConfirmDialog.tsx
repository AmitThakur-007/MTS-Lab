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
import { AlertTriangle, Trash2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DestructiveConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  itemName?: string;
  itemCount?: number;
  confirmWord?: string; // If set, user must type this word (e.g., 'DELETE')
  onConfirm: () => Promise<void> | void;
  confirmButtonText?: string;
  destructiveActionLabel?: string;
}

export function DestructiveConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  itemName,
  itemCount,
  confirmWord,
  onConfirm,
  confirmButtonText = 'Confirm Deletion',
  destructiveActionLabel = 'Permanent Action',
}: DestructiveConfirmDialogProps) {
  const [typedConfirm, setTypedConfirm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!open) {
      setTypedConfirm('');
      setIsProcessing(false);
    }
  }, [open]);

  const canConfirm = confirmWord
    ? typedConfirm.trim().toUpperCase() === confirmWord.trim().toUpperCase()
    : true;

  const handleExecute = async () => {
    if (!canConfirm || isProcessing) return;
    setIsProcessing(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      // Error handled by caller
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !isProcessing && onOpenChange(val)}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden rounded-3xl border border-rose-200 dark:border-rose-900 bg-white dark:bg-slate-900 shadow-2xl">
        <div className="bg-rose-50 dark:bg-rose-950/40 p-5 sm:p-6 border-b border-rose-100 dark:border-rose-900/50 flex items-start gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-rose-100 dark:bg-rose-900/60 border border-rose-200 dark:border-rose-800 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
            <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">
              {destructiveActionLabel}
            </span>
            <DialogTitle className="text-lg font-black text-slate-900 dark:text-white leading-tight">
              {title}
            </DialogTitle>
          </div>
        </div>

        <div className="p-5 sm:p-6 space-y-4 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          <DialogDescription className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm">
            {description}
          </DialogDescription>

          {(itemName || typeof itemCount === 'number') && (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-1 font-mono text-xs">
              {itemName && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-sans">Target:</span>
                  <span className="font-bold text-slate-900 dark:text-white truncate max-w-[200px]">
                    {itemName}
                  </span>
                </div>
              )}
              {typeof itemCount === 'number' && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-sans">Affected Count:</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">
                    {itemCount} record{itemCount !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>
          )}

          {confirmWord && (
            <div className="space-y-2 pt-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                To confirm, type <span className="font-mono text-rose-600 dark:text-rose-400 font-black">{confirmWord}</span> below:
              </label>
              <Input
                value={typedConfirm}
                onChange={(e) => setTypedConfirm(e.target.value)}
                placeholder={`Type "${confirmWord}" to enable`}
                className="font-mono text-xs h-10 rounded-xl uppercase tracking-wider"
                disabled={isProcessing}
                autoFocus
              />
            </div>
          )}
        </div>

        <DialogFooter className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-2 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
            className="rounded-xl text-xs sm:text-sm font-bold border-slate-300 dark:border-slate-700 cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleExecute}
            disabled={!canConfirm || isProcessing}
            className={cn(
              'rounded-xl text-xs sm:text-sm font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer shadow-sm',
              (!canConfirm || isProcessing) && 'opacity-50 cursor-not-allowed'
            )}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-1.5" />
                {confirmButtonText}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
