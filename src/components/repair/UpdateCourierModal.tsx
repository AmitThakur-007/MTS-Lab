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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Truck, Package, Loader2, CheckCircle2, DollarSign, MapPin, Phone, User, FileText } from 'lucide-react';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { syncRepairToSupabase as syncRepairToRtdb } from '@/lib/supabase';

interface UpdateCourierModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repair: any;
  onSuccess: (updatedRepair: any) => void;
}

const NEPAL_COURIER_PARTNERS = [
  'Nepal Can Move (NCM)',
  'Sundar Courier',
  'Pathao Logistics',
  'Aramex Nepal',
  'DHL Express',
  'FedEx / TNT',
  'Gorkha Express',
  'Gaura Courier',
  'Nepal Post / GPO',
  'Other Courier',
];

const NEPAL_DISTRICTS = [
  'Kathmandu',
  'Lalitpur',
  'Bhaktapur',
  'Pokhara (Kaski)',
  'Chitwan',
  'Morang (Biratnagar)',
  'Rupandehi (Butwal/Bhairahawa)',
  'Jhapa',
  'Sunsari (Dharan/Itahari)',
  'Parsa (Birgunj)',
  'Kavrepalanchok',
  'Dhanusha (Janakpur)',
  'Makwanpur (Hetauda)',
  'Banke (Nepalgunj)',
  'Kailali (Dhangadhi)',
  'Dang',
  'Nawalparasi',
  'Surkhet',
  'Other District',
];

export default function UpdateCourierModal({
  open,
  onOpenChange,
  repair,
  onSuccess,
}: UpdateCourierModalProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    returnCourierCompany: 'Nepal Can Move (NCM)',
    customCourierCompany: '',
    returnCourierTrackingNumber: '',
    returnCourierDispatchDate: format(new Date(), 'yyyy-MM-dd'),
    destinationDistrict: 'Kathmandu',
    customDestinationDistrict: '',
    destinationAddress: '',
    receiverName: '',
    receiverPhone: '',
    receiverWhatsapp: '',
    courierOutCharge: '',
    courierOutPaymentStatus: 'UNPAID',
    courierOutStatus: 'DISPATCHED',
    returnCourierNotes: '',
  });

  useEffect(() => {
    if (repair && open) {
      const company = repair.returnCourierCompany || repair.courierCompany || 'Nepal Can Move (NCM)';
      const isCustomCompany = !NEPAL_COURIER_PARTNERS.includes(company) && company !== '';
      
      const district = repair.destinationDistrict || repair.originDistrict || repair.customer?.district || 'Kathmandu';
      const isCustomDistrict = !NEPAL_DISTRICTS.includes(district) && district !== '';

      let dispatchDate = format(new Date(), 'yyyy-MM-dd');
      if (repair.returnCourierDispatchDate) {
        try {
          dispatchDate = format(new Date(repair.returnCourierDispatchDate), 'yyyy-MM-dd');
        } catch (_) {
          dispatchDate = repair.returnCourierDispatchDate.split('T')[0] || dispatchDate;
        }
      }

      setForm({
        returnCourierCompany: isCustomCompany ? 'Other Courier' : company,
        customCourierCompany: isCustomCompany ? company : '',
        returnCourierTrackingNumber: repair.returnCourierTrackingNumber || repair.courierTrackingNumber || '',
        returnCourierDispatchDate: dispatchDate,
        destinationDistrict: isCustomDistrict ? 'Other District' : district,
        customDestinationDistrict: isCustomDistrict ? district : '',
        destinationAddress: repair.destinationAddress || repair.originAddress || repair.customerAddress || repair.customer?.address || '',
        receiverName: repair.receiverName || repair.senderName || repair.customerName || repair.customer?.name || '',
        receiverPhone: repair.receiverPhone || repair.senderPhone || repair.customerPhone || repair.customer?.phone || '',
        receiverWhatsapp: repair.receiverWhatsapp || repair.senderWhatsapp || '',
        courierOutCharge: repair.courierOutCharge != null ? String(repair.courierOutCharge) : '',
        courierOutPaymentStatus: repair.courierOutPaymentStatus || 'UNPAID',
        courierOutStatus: repair.courierOutStatus || 'DISPATCHED',
        returnCourierNotes: repair.returnCourierNotes || repair.courierNotes || '',
      });
    }
  }, [repair, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repair?.id) return;

    const resolvedCompany =
      form.returnCourierCompany === 'Other Courier'
        ? form.customCourierCompany.trim()
        : form.returnCourierCompany.trim();

    if (!resolvedCompany) {
      toast.error('Please specify the courier company name');
      return;
    }

    if (!form.returnCourierTrackingNumber.trim()) {
      toast.error('Tracking / Consignment (AWB) number is required');
      return;
    }

    const resolvedDistrict =
      form.destinationDistrict === 'Other District'
        ? form.customDestinationDistrict.trim() || 'Kathmandu'
        : form.destinationDistrict.trim();

    setLoading(true);
    try {
      const payload = {
        courierCompany: resolvedCompany,
        returnCourierCompany: resolvedCompany,
        trackingNumber: form.returnCourierTrackingNumber.trim(),
        returnCourierTrackingNumber: form.returnCourierTrackingNumber.trim(),
        returnCourierDispatchDate: form.returnCourierDispatchDate,
        destinationDistrict: resolvedDistrict,
        destinationAddress: form.destinationAddress.trim(),
        receiverName: form.receiverName.trim() || repair.customerName || 'Customer',
        receiverPhone: form.receiverPhone.trim() || repair.customerPhone || '',
        receiverWhatsapp: form.receiverWhatsapp.trim(),
        courierOutCharge: form.courierOutCharge ? Number(form.courierOutCharge) : null,
        courierOutPaymentStatus: form.courierOutPaymentStatus,
        courierOutStatus: form.courierOutStatus,
        notes: form.returnCourierNotes.trim(),
        returnCourierNotes: form.returnCourierNotes.trim(),
      };

      const res = await api.post(`/repairs/${repair.id}/courier-dispatch`, payload);
      const updated = res?.repair || res;

      if (updated) {
        await syncRepairToRtdb(updated);
        onSuccess(updated);
      }

      toast.success(
        repair.isReturnCourierDispatched
          ? `Courier details updated (${resolvedCompany} #${form.returnCourierTrackingNumber})`
          : `Device dispatched via ${resolvedCompany} (AWB #${form.returnCourierTrackingNumber})`
      );
      onOpenChange(false);
    } catch (err: any) {
      console.error('[COURIER DISPATCH ERROR]', err);
      toast.error(err.message || 'Failed to save courier details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl w-full max-h-[90vh] overflow-y-auto rounded-3xl p-6 sm:p-8 border border-slate-200 bg-white shadow-2xl space-y-5">
        <form onSubmit={handleSubmit} className="space-y-5">
          <DialogHeader className="space-y-1.5 text-left border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center border border-blue-100 shadow-xs shrink-0">
                <Truck className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-xl font-extrabold text-slate-900 tracking-tight">
                  {repair?.isReturnCourierDispatched ? 'Update Courier Logistics' : 'Dispatch via Courier'}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 font-medium truncate">
                  Job <span className="font-mono font-bold text-slate-900">#{repair?.repairNumber}</span> • {repair?.deviceBrand} {repair?.deviceModel}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            {/* Courier Partner & Tracking */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5 text-blue-600" />
                  Courier Partner *
                </Label>
                <Select
                  value={form.returnCourierCompany}
                  onValueChange={(val) => setForm((prev) => ({ ...prev, returnCourierCompany: val }))}
                >
                  <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-slate-50 text-xs font-semibold">
                    <SelectValue placeholder="Select Courier" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl shadow-xl max-h-64">
                    {NEPAL_COURIER_PARTNERS.map((c) => (
                      <SelectItem key={c} value={c} className="text-xs font-medium">
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {form.returnCourierCompany === 'Other Courier' && (
                  <Input
                    placeholder="Specify Courier Partner Name"
                    value={form.customCourierCompany}
                    onChange={(e) => setForm((prev) => ({ ...prev, customCourierCompany: e.target.value }))}
                    className="h-9 rounded-xl border-slate-200 text-xs mt-1.5 bg-white"
                    required
                  />
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Tracking / AWB Number *</Label>
                <Input
                  placeholder="e.g. NCM-882910, TRK-99231"
                  value={form.returnCourierTrackingNumber}
                  onChange={(e) => setForm((prev) => ({ ...prev, returnCourierTrackingNumber: e.target.value }))}
                  className="h-10 rounded-xl border-slate-200 bg-slate-50 font-mono text-xs font-bold text-slate-900"
                  required
                />
              </div>
            </div>

            {/* Dispatch Date & Destination District */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Dispatch Date *</Label>
                <Input
                  type="date"
                  value={form.returnCourierDispatchDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, returnCourierDispatchDate: e.target.value }))}
                  className="h-10 rounded-xl border-slate-200 bg-slate-50 text-xs font-medium"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-rose-500" />
                  Destination District *
                </Label>
                <Select
                  value={form.destinationDistrict}
                  onValueChange={(val) => setForm((prev) => ({ ...prev, destinationDistrict: val }))}
                >
                  <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-slate-50 text-xs font-semibold">
                    <SelectValue placeholder="Select District" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl shadow-xl max-h-64">
                    {NEPAL_DISTRICTS.map((d) => (
                      <SelectItem key={d} value={d} className="text-xs font-medium">
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {form.destinationDistrict === 'Other District' && (
                  <Input
                    placeholder="Specify District Name"
                    value={form.customDestinationDistrict}
                    onChange={(e) => setForm((prev) => ({ ...prev, customDestinationDistrict: e.target.value }))}
                    className="h-9 rounded-xl border-slate-200 text-xs mt-1.5 bg-white"
                    required
                  />
                )}
              </div>
            </div>

            {/* Destination Address */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Delivery Address / Landmark</Label>
              <Input
                placeholder="e.g. Ward No. 4, Near Lions Club Chowk"
                value={form.destinationAddress}
                onChange={(e) => setForm((prev) => ({ ...prev, destinationAddress: e.target.value }))}
                className="h-10 rounded-xl border-slate-200 bg-slate-50 text-xs font-medium"
              />
            </div>

            {/* Receiver Name & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-slate-500" />
                  Receiver Name
                </Label>
                <Input
                  placeholder="Full name of person receiving"
                  value={form.receiverName}
                  onChange={(e) => setForm((prev) => ({ ...prev, receiverName: e.target.value }))}
                  className="h-10 rounded-xl border-slate-200 bg-slate-50 text-xs font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-slate-500" />
                  Receiver Phone
                </Label>
                <Input
                  placeholder="e.g. 98XXXXXXXX"
                  value={form.receiverPhone}
                  onChange={(e) => setForm((prev) => ({ ...prev, receiverPhone: e.target.value }))}
                  className="h-10 rounded-xl border-slate-200 bg-slate-50 font-mono text-xs font-bold"
                />
              </div>
            </div>

            {/* Courier Charges & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
                  Delivery Charge (NPR)
                </Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="0.00"
                  value={form.courierOutCharge}
                  onChange={(e) => setForm((prev) => ({ ...prev, courierOutCharge: e.target.value }))}
                  className="h-10 rounded-xl border-slate-200 bg-slate-50 font-mono text-xs font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Courier Payment</Label>
                <Select
                  value={form.courierOutPaymentStatus}
                  onValueChange={(val) => setForm((prev) => ({ ...prev, courierOutPaymentStatus: val }))}
                >
                  <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-slate-50 text-xs font-semibold">
                    <SelectValue placeholder="Payment" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl shadow-xl">
                    <SelectItem value="UNPAID" className="text-xs font-medium">UNPAID / COD</SelectItem>
                    <SelectItem value="PAID" className="text-xs font-medium">PAID (Prepaid)</SelectItem>
                    <SelectItem value="COLLECT_ON_DELIVERY" className="text-xs font-medium">Collect On Delivery</SelectItem>
                    <SelectItem value="TO_PAY" className="text-xs font-medium">To-Pay by Client</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Shipment Status</Label>
                <Select
                  value={form.courierOutStatus}
                  onValueChange={(val) => setForm((prev) => ({ ...prev, courierOutStatus: val }))}
                >
                  <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-slate-50 text-xs font-semibold">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl shadow-xl">
                    <SelectItem value="DISPATCHED" className="text-xs font-medium">Dispatched</SelectItem>
                    <SelectItem value="IN_TRANSIT" className="text-xs font-medium">In Transit</SelectItem>
                    <SelectItem value="OUT_FOR_DELIVERY" className="text-xs font-medium">Out for Delivery</SelectItem>
                    <SelectItem value="DELIVERED" className="text-xs font-medium">Delivered</SelectItem>
                    <SelectItem value="RETURNED" className="text-xs font-medium">Returned</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Courier Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-slate-500" />
                Courier Logistics Notes / Fragile Instructions
              </Label>
              <Textarea
                rows={2}
                placeholder="e.g. Fragile glass sticker affixed, bubble wrap protective layers, client requested evening drop."
                value={form.returnCourierNotes}
                onChange={(e) => setForm((prev) => ({ ...prev, returnCourierNotes: e.target.value }))}
                className="rounded-xl border-slate-200 bg-slate-50 text-xs font-medium"
              />
            </div>
          </div>

          <DialogFooter className="pt-3 border-t border-slate-100 flex flex-row items-center gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="flex-1 rounded-xl h-11 border-slate-200 font-bold text-xs hover:bg-slate-50"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-xl h-11 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  <span>Saving Logistics...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-1.5" />
                  <span>{repair?.isReturnCourierDispatched ? 'Save Updates' : 'Confirm Dispatch'}</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
