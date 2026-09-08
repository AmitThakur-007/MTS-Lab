import React, { useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { formatNPR } from '@/lib/format';
import { CreditCard, DollarSign, Receipt, CheckCircle2, Loader2 } from 'lucide-react';

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  repair: any | null;
  onPaymentSuccess: () => void;
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  isOpen,
  onClose,
  repair,
  onPaymentSuccess,
}) => {
  const [amount, setAmount] = useState<string>('');
  const [method, setMethod] = useState<string>('CASH');
  const [reference, setReference] = useState<string>('');
  const [paymentType, setPaymentType] = useState<'SETTLEMENT' | 'ADVANCE' | 'PARTIAL'>('SETTLEMENT');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!repair) return null;

  const estimatedCost = Number(repair.estimatedCost || 0);
  const totalPaid = Number(repair.totalPaid || 0);
  const balanceDue = Math.max(0, estimatedCost - totalPaid);

  const handleQuickFillDue = () => {
    setAmount(String(balanceDue));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return toast.error('Please enter a valid positive payment amount.');
    }

    try {
      setIsSubmitting(true);
      const res: any = await api.post('/revenue/payments', {
        repairId: repair.id,
        amount: numAmount,
        method,
        reference: reference || null,
        type: paymentType,
      });

      toast.success(res?.message || 'Payment recorded successfully');
      onPaymentSuccess();
      onClose();
    } catch (err: any) {
      console.error('[RECORD PAYMENT ERROR]', err);
      toast.error(err?.response?.data?.error || err?.message || 'Failed to record payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px] rounded-2xl p-6 shadow-2xl border-slate-200">
        <DialogHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-slate-900" />
              Record Customer Payment
            </DialogTitle>
            <Badge variant="outline" className="font-mono font-bold text-xs bg-slate-50 border-slate-200">
              {repair.repairNumber}
            </Badge>
          </div>
          <DialogDescription className="text-xs text-slate-500 font-medium">
            Collect advance, partial installment, or final settlement for this smartphone repair.
          </DialogDescription>
        </DialogHeader>

        {/* Repair Summary Snapshot */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">Customer:</span>
            <span className="font-extrabold text-slate-900">{repair.customerName} ({repair.customerPhone})</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">Device:</span>
            <span className="font-bold text-slate-800">{repair.deviceBrand} {repair.deviceModel}</span>
          </div>
          <div className="pt-2 border-t border-slate-200/60 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase">Quoted Cost</p>
              <p className="font-mono font-black text-slate-900 text-sm">{formatNPR(estimatedCost)}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase">Already Paid</p>
              <p className="font-mono font-black text-emerald-700 text-sm">{formatNPR(totalPaid)}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase">Balance Due</p>
              <p className="font-mono font-black text-amber-600 text-sm">{formatNPR(balanceDue)}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-slate-700">Payment Amount (NPR)</Label>
              {balanceDue > 0 && (
                <button
                  type="button"
                  onClick={handleQuickFillDue}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                >
                  Pay Full Balance ({formatNPR(balanceDue)})
                </button>
              )}
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-bold text-sm">
                Rs.
              </span>
              <Input
                type="number"
                step="any"
                required
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-11 h-11 text-base font-mono font-bold rounded-xl border-slate-200 focus-visible:ring-slate-950"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Payment Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger className="h-10 rounded-xl text-xs font-bold border-slate-200">
                  <SelectValue placeholder="Method" />
                </SelectTrigger>
                <SelectContent className="rounded-xl shadow-xl">
                  <SelectItem value="CASH" className="text-xs font-bold">Cash at Counter</SelectItem>
                  <SelectItem value="ESEWA" className="text-xs font-bold">eSewa Wallet / QR</SelectItem>
                  <SelectItem value="KHALTI" className="text-xs font-bold">Khalti Digital Wallet</SelectItem>
                  <SelectItem value="BANK_TRANSFER" className="text-xs font-bold">Bank Transfer / FonePay</SelectItem>
                  <SelectItem value="CARD" className="text-xs font-bold">Credit / Debit Card</SelectItem>
                  <SelectItem value="OTHER" className="text-xs font-bold">Other Payment</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Transaction Type</Label>
              <Select value={paymentType} onValueChange={(val: any) => setPaymentType(val)}>
                <SelectTrigger className="h-10 rounded-xl text-xs font-bold border-slate-200">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent className="rounded-xl shadow-xl">
                  <SelectItem value="SETTLEMENT" className="text-xs font-bold">Full Settlement</SelectItem>
                  <SelectItem value="PARTIAL" className="text-xs font-bold">Partial Installment</SelectItem>
                  <SelectItem value="ADVANCE" className="text-xs font-bold">Intake Advance</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">Transaction Ref / Cheque / Note (Optional)</Label>
            <Input
              placeholder="e.g. eSewa TxID: 981273948"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="h-10 text-xs rounded-xl border-slate-200"
            />
          </div>

          <DialogFooter className="pt-3 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-xl border-slate-200 font-bold text-xs h-10"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-slate-950 hover:bg-slate-900 text-white font-black text-xs h-10 px-5 shadow-lg shadow-black/10 cursor-pointer"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Recording...
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Confirm & Record Payment
                </span>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default RecordPaymentModal;
