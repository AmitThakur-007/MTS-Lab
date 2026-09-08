import React, { useState } from 'react';
import { FileWarning, Check, Loader2, Package, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { STANDARD_COMPONENTS, DAMAGE_TYPES } from './types';
import { api } from '@/services/api';
import { toast } from 'sonner';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  staffList: any[];
  inventoryItems: any[];
}

export const RecordDamageDialog: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
  staffList,
  inventoryItems,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    staffId: '',
    damagedComponent: 'Display Panel',
    damageType: 'CRACKED',
    damageDescription: '',
    repairNumber: '',
    repairId: '',
    customerId: '',
    customerName: '',
    deviceBrand: '',
    deviceModel: '',
    damageDate: new Date().toISOString().split('T')[0],
    damageTime: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    quantity: 1,
    estimatedCost: '',
    notes: '',
    inventoryItemId: '',
    deductInventory: false,
  });

  // Repair search
  const [repairSearchQuery, setRepairSearchQuery] = useState('');
  const [repairSearchResults, setRepairSearchResults] = useState<any[]>([]);
  const [searchingRepairs, setSearchingRepairs] = useState(false);

  const handleSearchRepairs = async (q: string) => {
    setRepairSearchQuery(q);
    if (!q || q.trim().length < 2) {
      setRepairSearchResults([]);
      return;
    }
    setSearchingRepairs(true);
    try {
      const res = await api.get(`/repairs?search=${encodeURIComponent(q.trim())}&limit=6`);
      const items = Array.isArray(res) ? res : (res?.repairs || []);
      setRepairSearchResults(items);
    } catch (err) {
      setRepairSearchResults([]);
    } finally {
      setSearchingRepairs(false);
    }
  };

  const selectRepair = (repair: any) => {
    setFormData(prev => ({
      ...prev,
      repairId: repair.id,
      repairNumber: repair.repairNumber,
      customerId: repair.customerId || '',
      customerName: repair.customerName || '',
      deviceBrand: repair.deviceBrand || '',
      deviceModel: repair.deviceModel || '',
      staffId: prev.staffId || repair.technicianId || '',
    }));
    setRepairSearchResults([]);
    setRepairSearchQuery('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.staffId) {
      toast.error('Please select the responsible staff member.');
      return;
    }
    if (!formData.damagedComponent || !formData.damagedComponent.trim()) {
      toast.error('Please select the damaged component.');
      return;
    }
    if (!formData.damageDescription || formData.damageDescription.trim().length < 3) {
      toast.error('Please provide a detailed damage description (minimum 3 characters).');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/repair-damage', {
        ...formData,
        quantity: Number(formData.quantity) || 1,
        estimatedCost: formData.estimatedCost ? parseFloat(formData.estimatedCost) : undefined,
      });
      toast.success('Repair-related damage record logged successfully.');
      onSuccess();
      onClose();
      // Reset form
      setFormData({
        staffId: '',
        damagedComponent: 'Display Panel',
        damageType: 'CRACKED',
        damageDescription: '',
        repairNumber: '',
        repairId: '',
        customerId: '',
        customerName: '',
        deviceBrand: '',
        deviceModel: '',
        damageDate: new Date().toISOString().split('T')[0],
        damageTime: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        quantity: 1,
        estimatedCost: '',
        notes: '',
        inventoryItemId: '',
        deductInventory: false,
      });
    } catch (err: any) {
      console.error('[CREATE DAMAGE ERROR]', err);
      toast.error(err?.message || 'Failed to record repair-related damage.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        id="record-damage-dialog"
        className="w-[calc(100vw-1.5rem)] sm:w-full max-w-2xl rounded-3xl p-0 border border-slate-200 shadow-2xl overflow-hidden bg-white max-h-[90vh] flex flex-col"
      >
        <DialogHeader className="p-4 sm:p-6 pb-4 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600/30 border border-rose-400/30 text-rose-400 flex items-center justify-center shrink-0">
              <FileWarning className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-lg sm:text-xl font-black text-white truncate">
                Record Repair-Related Damage
              </DialogTitle>
              <DialogDescription className="font-medium text-slate-400 text-xs mt-0.5 truncate">
                Document component or device damage incident occurring during repair
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
            {/* Staff Selector */}
            <div className="space-y-1.5 min-w-0">
              <Label className="text-xs font-bold text-slate-700">Staff Member *</Label>
              <Select value={formData.staffId} onValueChange={v => setFormData({ ...formData, staffId: v })}>
                <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-slate-50 text-xs font-bold">
                  <SelectValue placeholder="Select Technician / Receptionist / Staff" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl shadow-xl max-h-64">
                  {staffList.map(s => (
                    <SelectItem key={s.id} value={s.id} className="text-xs py-2">
                      <div className="font-bold text-slate-900">{s.name}</div>
                      <div className="text-[10px] text-slate-400">{s.role?.replace(/_/g, ' ')} • {s.email}</div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Repair Job Live Link (Optional) */}
            <div className="space-y-1.5 relative min-w-0">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <Label className="text-xs font-bold text-slate-700">Associated Repair Job (Optional)</Label>
                {formData.repairNumber && (
                  <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                    <Check className="h-3 w-3" /> Linked to #{formData.repairNumber}
                  </span>
                )}
              </div>
              <div className="relative">
                <Input 
                  type="text"
                  placeholder="Search by Repair # (e.g. MTS-2026-0001) or customer phone..."
                  value={repairSearchQuery}
                  onChange={e => handleSearchRepairs(e.target.value)}
                  className="h-11 rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-xs font-medium pr-8"
                />
                {searchingRepairs && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-400" />
                )}
              </div>

              {/* Repair Results Dropdown */}
              {repairSearchResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 overflow-hidden divide-y divide-slate-100 max-h-52 overflow-y-auto">
                  {repairSearchResults.map(r => (
                    <div 
                      key={r.id}
                      onClick={() => selectRepair(r)}
                      className="p-3 hover:bg-slate-50 cursor-pointer flex items-center justify-between text-xs gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-900 font-mono truncate">#{r.repairNumber} • {r.deviceBrand} {r.deviceModel}</p>
                        <p className="text-[10px] text-slate-500 truncate">{r.customerName} ({r.customerPhone})</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-bold shrink-0">Select</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Device specs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
              <div className="space-y-1.5 min-w-0">
                <Label className="text-xs font-bold text-slate-700">Device Brand</Label>
                <Input 
                  placeholder="e.g. Samsung, Apple, Xiaomi"
                  value={formData.deviceBrand}
                  onChange={e => setFormData({ ...formData, deviceBrand: e.target.value })}
                  className="h-11 rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-xs font-medium"
                />
              </div>
              <div className="space-y-1.5 min-w-0">
                <Label className="text-xs font-bold text-slate-700">Device Model</Label>
                <Input 
                  placeholder="e.g. Galaxy S23 Ultra, iPhone 15 Pro"
                  value={formData.deviceModel}
                  onChange={e => setFormData({ ...formData, deviceModel: e.target.value })}
                  className="h-11 rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-xs font-medium"
                />
              </div>
            </div>

            {/* Component & Damage Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
              <div className="space-y-1.5 min-w-0">
                <Label className="text-xs font-bold text-slate-700">Damaged Component *</Label>
                <Select value={formData.damagedComponent} onValueChange={v => setFormData({ ...formData, damagedComponent: v })}>
                  <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-slate-50 text-xs font-bold">
                    <SelectValue placeholder="Select Damaged Component" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl shadow-xl max-h-56">
                    {STANDARD_COMPONENTS.map(c => (
                      <SelectItem key={c} value={c} className="text-xs font-bold">{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 min-w-0">
                <Label className="text-xs font-bold text-slate-700">Damage Classification</Label>
                <Select value={formData.damageType} onValueChange={v => setFormData({ ...formData, damageType: v })}>
                  <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-slate-50 text-xs font-bold">
                    <SelectValue placeholder="Select Damage Type" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl shadow-xl">
                    {DAMAGE_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value} className="text-xs font-medium">{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Incident Detailed Description */}
            <div className="space-y-1.5 min-w-0">
              <Label className="text-xs font-bold text-slate-700">Damage Incident Description *</Label>
              <Textarea 
                rows={3}
                placeholder="Explain exactly how the component was damaged during handling, repair separation, soldering, or reassembly..."
                value={formData.damageDescription}
                onChange={e => setFormData({ ...formData, damageDescription: e.target.value })}
                className="rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-xs font-medium resize-none"
                required
              />
            </div>

            {/* Date, Time, Quantity, Est Cost */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1.5 min-w-0">
                <Label className="text-xs font-bold text-slate-700">Damage Date *</Label>
                <Input 
                  type="date"
                  value={formData.damageDate}
                  onChange={e => setFormData({ ...formData, damageDate: e.target.value })}
                  className="h-10 rounded-xl border-slate-200 bg-slate-50 text-xs font-medium"
                  required
                />
              </div>
              <div className="space-y-1.5 min-w-0">
                <Label className="text-xs font-bold text-slate-700">Damage Time</Label>
                <Input 
                  type="time"
                  value={formData.damageTime}
                  onChange={e => setFormData({ ...formData, damageTime: e.target.value })}
                  className="h-10 rounded-xl border-slate-200 bg-slate-50 text-xs font-medium"
                />
              </div>
              <div className="space-y-1.5 min-w-0">
                <Label className="text-xs font-bold text-slate-700">Quantity</Label>
                <Input 
                  type="number"
                  min={1}
                  value={formData.quantity}
                  onChange={e => setFormData({ ...formData, quantity: parseInt(e.target.value, 10) || 1 })}
                  className="h-10 rounded-xl border-slate-200 bg-slate-50 text-xs font-medium"
                />
              </div>
              <div className="space-y-1.5 min-w-0">
                <Label className="text-xs font-bold text-slate-700">Est. Cost (NPR)</Label>
                <Input 
                  type="number"
                  min={0}
                  placeholder="e.g. 4500"
                  value={formData.estimatedCost}
                  onChange={e => setFormData({ ...formData, estimatedCost: e.target.value })}
                  className="h-10 rounded-xl border-slate-200 bg-slate-50 text-xs font-medium"
                />
              </div>
            </div>

            {/* Inventory Integration Option */}
            <div className="p-3.5 sm:p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-indigo-600 shrink-0" />
                  <span className="text-xs font-bold text-slate-900">Inventory Hub Integration</span>
                </div>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={formData.deductInventory}
                    onChange={e => setFormData({ ...formData, deductInventory: e.target.checked })}
                    className="rounded text-indigo-600 h-4 w-4"
                  />
                  <span>Deduct Damaged Spare Part (-1)</span>
                </label>
              </div>

              {formData.deductInventory && (
                <div className="space-y-1.5 pt-1 min-w-0">
                  <Label className="text-[11px] font-bold text-slate-600">Select Inventory Spare Part Item</Label>
                  <Select value={formData.inventoryItemId} onValueChange={v => setFormData({ ...formData, inventoryItemId: v })}>
                    <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white text-xs font-medium">
                      <SelectValue placeholder="Choose inventory item to record stock deduction" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl shadow-xl max-h-56">
                      {inventoryItems.map(item => (
                        <SelectItem key={item.id} value={item.id} className="text-xs">
                          <span className="font-bold">{item.name}</span>
                          <span className="text-[10px] text-slate-400 ml-1.5">(Stock: {item.currentStock} {item.unit || 'pcs'})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Remarks & Notes */}
            <div className="space-y-1.5 min-w-0">
              <Label className="text-xs font-bold text-slate-700">Internal Remarks / Notes</Label>
              <Input 
                placeholder="Additional supervisor notes or replacement arrangement details..."
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                className="h-10 rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-xs font-medium"
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
              className="rounded-xl h-10 sm:h-11 px-5 sm:px-6 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm shadow-md cursor-pointer"
              disabled={submitting}
            >
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileWarning className="mr-2 h-4 w-4 text-rose-400" />}
              Submit Damage Record
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
