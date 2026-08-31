import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Edit3, 
  Loader2, 
  Smartphone, 
  User, 
  Banknote, 
  Calendar, 
  Hash, 
  Phone, 
  Mail, 
  MapPin, 
  ShieldCheck, 
  Zap,
  Layers,
  Check,
  Circle,
  BatteryCharging
} from 'lucide-react';
import { api } from '@/services/api';
import { syncRepairToSupabase as syncRepairToRtdb, syncRepairToSupabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { formatNepalPhone } from '@/lib/format';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export const CONDITION_OPTIONS = [
  "Good (Minor Wear)",
  "Screen Damaged",
  "Back Glass Damaged",
  "Body / Frame Bent",
  "Water / Liquid Damage",
  "Dead / No Power",
  "Logo Stuck / Bootloop",
  "Other Physical Damage"
];

export const ACCESSORY_OPTIONS = [
  "No Accessories",
  "SIM Card",
  "SIM Tray",
  "Memory Card",
  "Cover / Case",
  "Charger Adapter",
  "Charging Cable",
  "Original Box",
  "Other"
];

interface EditRepairModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repair: any;
  onSaved: (updatedRepair: any) => void;
}

export const EditRepairModal: React.FC<EditRepairModalProps> = ({
  open,
  onOpenChange,
  repair,
  onSaved
}) => {
  const [loading, setLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState<any>({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    customerAddress: '',
    deviceBrand: 'apple',
    deviceModel: '',
    imeiNumber: '',
    deviceColor: '',
    problemDescription: '',
    conditionNotes: '',
    remarks: '',
    priority: 'NORMAL',
    estimatedCost: '',
    advancePaid: '0',
    totalPaid: '0',
    paymentStatus: 'UNPAID',
    expectedCompletionDate: ''
  });

  // Battery Warranty State
  const [hasBatteryWarranty, setHasBatteryWarranty] = useState<boolean>(false);
  const [batteryWarrantyPeriod, setBatteryWarrantyPeriod] = useState<string>('6_MONTHS');
  const [batteryType, setBatteryType] = useState<string>('Original Replacement Battery');

  // Condition Pills State
  const [selectedConditions, setSelectedConditions] = useState<string[]>(['Good (Minor Wear)']);
  const [otherConditionText, setOtherConditionText] = useState('');

  // Accessory Pills State
  const [selectedAccessories, setSelectedAccessories] = useState<string[]>(['No Accessories']);
  const [otherAccessoryText, setOtherAccessoryText] = useState('');

  // Initialize form data whenever modal opens with a repair
  useEffect(() => {
    if (!repair || !open) return;

    // Parse Battery Warranty State
    if (repair.batteryWarranty) {
      setHasBatteryWarranty(repair.batteryWarranty.status !== 'CANCELLED');
      setBatteryWarrantyPeriod(repair.batteryWarranty.warrantyPeriod || '6_MONTHS');
      setBatteryType(repair.batteryWarranty.batteryType || 'Original Replacement Battery');
    } else if (repair.id) {
      api.get(`/battery-warranties?search=${repair.repairNumber}`)
        .then((res: any) => {
          const list = Array.isArray(res) ? res : res?.warranties || [];
          const match = list.find((w: any) => w.repairId === repair.id || w.repairNumber === repair.repairNumber);
          if (match && match.status !== 'CANCELLED') {
            setHasBatteryWarranty(true);
            if (match.warrantyPeriod) setBatteryWarrantyPeriod(match.warrantyPeriod);
            if (match.batteryType) setBatteryType(match.batteryType);
          } else {
            setHasBatteryWarranty(false);
          }
        })
        .catch(() => {
          setHasBatteryWarranty(false);
        });
    } else {
      setHasBatteryWarranty(false);
    }

    // Parse Condition
    const rawCond = (repair.deviceCondition || '').trim();
    if (!rawCond) {
      setSelectedConditions(['Good (Minor Wear)']);
      setOtherConditionText('');
    } else {
      const parts = rawCond.split(',').map((s: string) => s.trim()).filter(Boolean);
      const matched: string[] = [];
      let customText = '';

      parts.forEach((p: string) => {
        const lower = p.toLowerCase();
        if (p.startsWith('Other (') && p.endsWith(')')) {
          matched.push('Other Physical Damage');
          customText = p.slice(7, -1).trim();
        } else if (lower.startsWith('other')) {
          matched.push('Other Physical Damage');
          customText = p.replace(/^other\s*[:(]?\s*/i, '').replace(/\)$/, '').trim();
        } else if (lower === 'fair' || lower === 'good' || lower === 'good (minor wear)' || lower === 'normal intake') {
          matched.push('Good (Minor Wear)');
        } else {
          const found = CONDITION_OPTIONS.find(o => o.toLowerCase() === lower);
          if (found) {
            matched.push(found);
          } else {
            // Unrecognized custom condition -> map to Other Physical Damage
            matched.push('Other Physical Damage');
            customText = customText ? `${customText}, ${p}` : p;
          }
        }
      });

      let uniqueMatched = Array.from(new Set(matched));
      // Enforce mutual exclusion: if defect conditions exist, remove Good (Minor Wear)
      if (uniqueMatched.some(c => c !== 'Good (Minor Wear)')) {
        uniqueMatched = uniqueMatched.filter(c => c !== 'Good (Minor Wear)');
      }
      setSelectedConditions(uniqueMatched.length > 0 ? uniqueMatched : ['Good (Minor Wear)']);
      setOtherConditionText(customText);
    }

    // Parse Accessories
    const rawAcc = (repair.accessoriesReceived || '').trim();
    if (!rawAcc || rawAcc.toLowerCase() === 'none' || rawAcc.toLowerCase() === 'no accessories') {
      setSelectedAccessories(['No Accessories']);
      setOtherAccessoryText('');
    } else {
      const parts = rawAcc.split(',').map((s: string) => s.trim()).filter(Boolean);
      const matched: string[] = [];
      let customAccText = '';

      parts.forEach((p: string) => {
        const lower = p.toLowerCase();
        if (p.startsWith('Other (') && p.endsWith(')')) {
          matched.push('Other');
          customAccText = p.slice(7, -1).trim();
        } else if (lower.startsWith('other')) {
          matched.push('Other');
          customAccText = p.replace(/^other\s*[:(]?\s*/i, '').replace(/\)$/, '').trim();
        } else if (lower === 'no accessories' || lower === 'none') {
          matched.push('No Accessories');
        } else {
          const found = ACCESSORY_OPTIONS.find(o => o.toLowerCase() === lower);
          if (found) {
            matched.push(found);
          } else {
            matched.push('Other');
            customAccText = customAccText ? `${customAccText}, ${p}` : p;
          }
        }
      });

      let uniqueMatched = Array.from(new Set(matched));
      // Enforce mutual exclusion: if normal accessories exist, remove No Accessories
      if (uniqueMatched.some(a => a !== 'No Accessories')) {
        uniqueMatched = uniqueMatched.filter(a => a !== 'No Accessories');
      }
      setSelectedAccessories(uniqueMatched.length > 0 ? uniqueMatched : ['No Accessories']);
      setOtherAccessoryText(customAccText);
    }

    // Populate Fields
    setFormData({
      customerName: repair.customerName || '',
      customerPhone: repair.customerPhone || '',
      customerEmail: repair.customerEmail || '',
      customerAddress: repair.customerAddress || '',
      deviceBrand: (repair.deviceBrand || 'apple').toLowerCase(),
      deviceModel: repair.deviceModel || '',
      imeiNumber: repair.imeiNumber || '',
      deviceColor: repair.deviceColor || '',
      problemDescription: repair.problemDescription || '',
      conditionNotes: repair.conditionNotes || '',
      remarks: repair.remarks || '',
      priority: (repair.priority || 'NORMAL').toUpperCase().trim(),
      estimatedCost: repair.estimatedCost !== null && repair.estimatedCost !== undefined ? String(repair.estimatedCost) : '',
      advancePaid: repair.advancePaid !== null && repair.advancePaid !== undefined ? String(repair.advancePaid) : '0',
      totalPaid: repair.totalPaid !== null && repair.totalPaid !== undefined ? String(repair.totalPaid) : '0',
      paymentStatus: repair.paymentStatus || 'UNPAID',
      expectedCompletionDate: repair.expectedCompletionDate 
        ? format(new Date(repair.expectedCompletionDate), 'yyyy-MM-dd') 
        : ''
    });
  }, [repair, open]);

  // Toggle Handlers
  const toggleCondition = (cond: string) => {
    if (cond === "Good (Minor Wear)") {
      if (selectedConditions.includes("Good (Minor Wear)") && selectedConditions.length === 1) {
        // Toggle off
        setSelectedConditions([]);
        setOtherConditionText('');
      } else {
        // Select Good (Minor Wear) and clear all defect conditions
        setSelectedConditions(["Good (Minor Wear)"]);
        setOtherConditionText('');
      }
    } else {
      // User clicked a defect condition
      const withoutGood = selectedConditions.filter(c => c !== "Good (Minor Wear)");
      if (withoutGood.includes(cond)) {
        // Toggle off
        const remaining = withoutGood.filter(c => c !== cond);
        setSelectedConditions(remaining);
        if (cond === "Other Physical Damage") {
          setOtherConditionText('');
        }
      } else {
        // Add this defect condition
        setSelectedConditions([...withoutGood, cond]);
      }
    }
  };

  const toggleAccessory = (acc: string) => {
    if (acc === "No Accessories") {
      if (selectedAccessories.includes("No Accessories") && selectedAccessories.length === 1) {
        // Toggle off
        setSelectedAccessories([]);
        setOtherAccessoryText('');
      } else {
        // Select No Accessories and clear all other accessories
        setSelectedAccessories(["No Accessories"]);
        setOtherAccessoryText('');
      }
    } else {
      // User clicked a normal accessory
      const withoutNo = selectedAccessories.filter(a => a !== "No Accessories");
      if (withoutNo.includes(acc)) {
        // Toggle off
        const remaining = withoutNo.filter(a => a !== acc);
        setSelectedAccessories(remaining);
        if (acc === "Other") {
          setOtherAccessoryText('');
        }
      } else {
        // Add this accessory
        setSelectedAccessories([...withoutNo, acc]);
      }
    }
  };

  const compileConditionString = () => {
    let list = [...selectedConditions];
    if (list.includes("Good (Minor Wear)") && list.length > 1) {
      list = list.filter(c => c !== "Good (Minor Wear)");
    }
    if (list.length === 0) {
      return "Good (Minor Wear)";
    }
    if (list.includes("Other Physical Damage") && otherConditionText.trim()) {
      const idx = list.indexOf("Other Physical Damage");
      list[idx] = `Other (${otherConditionText.trim()})`;
    }
    return list.join(", ");
  };

  const compileAccessoriesString = () => {
    let list = [...selectedAccessories];
    if (list.includes("No Accessories") && list.length > 1) {
      list = list.filter(a => a !== "No Accessories");
    }
    if (list.length === 0 || (list.length === 1 && list[0] === "No Accessories")) {
      return null;
    }
    if (list.includes("Other") && otherAccessoryText.trim()) {
      const idx = list.indexOf("Other");
      list[idx] = `Other (${otherAccessoryText.trim()})`;
    }
    return list.join(", ");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repair) return;

    if (!formData.customerName.trim()) {
      toast.error("Customer Name is required");
      return;
    }
    if (!formData.customerPhone.trim()) {
      toast.error("Customer Phone is required");
      return;
    }
    if (!formData.deviceModel.trim()) {
      toast.error("Device Model is required");
      return;
    }

    setLoading(true);
    try {
      const costStr = String(formData.estimatedCost).trim();
      const advanceStr = String(formData.advancePaid).trim();
      const totalStr = String(formData.totalPaid).trim();

      const payload: any = {
        customerName: formData.customerName.trim(),
        customerPhone: formatNepalPhone(formData.customerPhone),
        customerEmail: formData.customerEmail.trim() || null,
        customerAddress: formData.customerAddress.trim() || null,
        deviceBrand: formData.deviceBrand,
        deviceModel: formData.deviceModel.trim(),
        imeiNumber: formData.imeiNumber.trim() || null,
        deviceColor: formData.deviceColor.trim() || null,
        deviceCondition: compileConditionString() || 'Good (Minor Wear)',
        conditionNotes: formData.conditionNotes.trim() || null,
        problemDescription: formData.problemDescription.trim() || 'Diagnostics & Repair',
        accessoriesReceived: compileAccessoriesString(),
        estimatedCost: costStr === '' ? null : Number(costStr),
        advancePaid: advanceStr === '' ? 0 : Number(advanceStr),
        totalPaid: totalStr === '' ? (advanceStr === '' ? 0 : Number(advanceStr)) : Number(totalStr),
        paymentStatus: formData.paymentStatus || 'UNPAID',
        priority: formData.priority || 'NORMAL',
        remarks: formData.remarks.trim() || null,
        expectedCompletionDate: formData.expectedCompletionDate ? new Date(formData.expectedCompletionDate).toISOString() : null,
        hasBatteryWarranty,
        batteryWarrantyPeriod: hasBatteryWarranty ? batteryWarrantyPeriod : undefined,
        batteryType: hasBatteryWarranty ? (batteryType.trim() || 'Original Replacement Battery') : undefined
      };

      const updated = await api.patch(`/repairs/${repair.id}`, payload);
      await syncRepairToRtdb(updated);

      toast.success(`Repair #${repair.repairNumber} updated successfully.`);
      onSaved(updated);
      onOpenChange(false);
    } catch (err: any) {
      console.error("[EDIT REPAIR ERROR]", err);
      toast.error(err?.message || "Unable to save repair changes. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:w-full sm:max-w-3xl max-h-[88vh] sm:max-h-[90vh] overflow-y-auto rounded-2xl sm:rounded-3xl border-slate-200 shadow-2xl p-4 sm:p-7 bg-white">
        <DialogHeader className="border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center font-bold shrink-0">
              <Edit3 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-xl font-black text-slate-900">
                  Edit Repair — #{repair?.repairNumber}
                </DialogTitle>
                <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700">
                  {repair?.status?.replace(/_/g, ' ')}
                </span>
              </div>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                Update customer details, physical condition, accessories, and financial estimation.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-2">
          
          {/* Section 1: Customer Details */}
          <div className="space-y-3 p-4 rounded-2xl border border-slate-200/90 bg-slate-50/60">
            <div className="flex items-center gap-2 text-xs font-black text-slate-900 uppercase tracking-wider">
              <User className="w-4 h-4 text-blue-600" />
              <span>Customer Identification</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Full Name *</Label>
                <Input
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  placeholder="e.g. Ram Sharma"
                  className="h-10 rounded-xl bg-white border-slate-200 text-xs font-semibold"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Phone Number *</Label>
                <Input
                  value={formData.customerPhone}
                  onChange={(e) => setFormData({ ...formData, customerPhone: formatNepalPhone(e.target.value) })}
                  placeholder="e.g. 9869276668"
                  className="h-10 rounded-xl bg-white border-slate-200 text-xs font-mono font-bold"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Email Address</Label>
                <Input
                  type="email"
                  value={formData.customerEmail}
                  onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                  placeholder="customer@example.com"
                  className="h-10 rounded-xl bg-white border-slate-200 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Address / City</Label>
                <Input
                  value={formData.customerAddress}
                  onChange={(e) => setFormData({ ...formData, customerAddress: e.target.value })}
                  placeholder="e.g. New Road, Kathmandu"
                  className="h-10 rounded-xl bg-white border-slate-200 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Device Specification */}
          <div className="space-y-3 p-4 rounded-2xl border border-slate-200/90 bg-slate-50/60">
            <div className="flex items-center gap-2 text-xs font-black text-slate-900 uppercase tracking-wider">
              <Smartphone className="w-4 h-4 text-indigo-600" />
              <span>Device Specifications</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Brand</Label>
                <Select
                  value={formData.deviceBrand}
                  onValueChange={(v) => setFormData({ ...formData, deviceBrand: v })}
                >
                  <SelectTrigger className="h-10 rounded-xl bg-white border-slate-200 text-xs font-semibold">
                    <SelectValue placeholder="Brand" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="apple">Apple iPhone</SelectItem>
                    <SelectItem value="samsung">Samsung Galaxy</SelectItem>
                    <SelectItem value="xiaomi">Xiaomi / Redmi / Poco</SelectItem>
                    <SelectItem value="oneplus">OnePlus</SelectItem>
                    <SelectItem value="google">Google Pixel</SelectItem>
                    <SelectItem value="nothing">Nothing Phone</SelectItem>
                    <SelectItem value="oppo">Oppo</SelectItem>
                    <SelectItem value="vivo">Vivo</SelectItem>
                    <SelectItem value="realme">Realme</SelectItem>
                    <SelectItem value="other">Other Brand</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs font-bold text-slate-700">Model Name *</Label>
                <Input
                  value={formData.deviceModel}
                  onChange={(e) => setFormData({ ...formData, deviceModel: e.target.value })}
                  placeholder="e.g. iPhone 15 Pro Max"
                  className="h-10 rounded-xl bg-white border-slate-200 text-xs font-semibold"
                  required
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs font-bold text-slate-700">IMEI / Serial (Optional)</Label>
                <Input
                  value={formData.imeiNumber}
                  onChange={(e) => setFormData({ ...formData, imeiNumber: e.target.value })}
                  placeholder="15-digit IMEI"
                  className="h-10 rounded-xl bg-white border-slate-200 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Device Color</Label>
                <Input
                  value={formData.deviceColor}
                  onChange={(e) => setFormData({ ...formData, deviceColor: e.target.value })}
                  placeholder="e.g. Black Titanium"
                  className="h-10 rounded-xl bg-white border-slate-200 text-xs"
                />
              </div>
            </div>

            {/* Problem Description */}
            <div className="space-y-1 pt-1">
              <Label className="text-xs font-bold text-slate-700">Problem Description *</Label>
              <Textarea
                rows={2}
                value={formData.problemDescription}
                onChange={(e) => setFormData({ ...formData, problemDescription: e.target.value })}
                placeholder="Describe fault..."
                className="rounded-xl bg-white border-slate-200 text-xs font-medium"
                required
              />
            </div>
          </div>

          {/* Section 3: Device Physical Condition Checklist */}
          <div className="space-y-3 p-4 rounded-2xl border border-slate-200/90 bg-slate-50/60">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div className="flex items-center gap-2 text-xs font-black text-slate-900 uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Device Physical Condition Upon Intake</span>
              </div>
              <span className="text-[10px] text-slate-500 font-medium">Select all observed conditions (Good is exclusive)</span>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {CONDITION_OPTIONS.map((c) => {
                const isSelected = selectedConditions.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleCondition(c);
                    }}
                    className={cn(
                      "inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all duration-150 cursor-pointer select-none active:scale-[0.98]",
                      isSelected 
                        ? "bg-slate-900 text-white border-slate-900 shadow-sm ring-2 ring-slate-900/10" 
                        : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-100/80 shadow-2xs"
                    )}
                  >
                    {isSelected ? (
                      <Check className="w-3.5 h-3.5 text-white shrink-0 stroke-[2.5] pointer-events-none" />
                    ) : (
                      <Circle className="w-3.5 h-3.5 text-slate-300 shrink-0 stroke-[2] pointer-events-none" />
                    )}
                    <span className="pointer-events-none">{c}</span>
                  </button>
                );
              })}
            </div>

            {selectedConditions.includes("Other Physical Damage") && (
              <Input
                placeholder="Specify other physical damage..."
                value={otherConditionText}
                onChange={(e) => setOtherConditionText(e.target.value)}
                className="h-10 rounded-xl bg-white border-slate-300 text-xs mt-2"
              />
            )}

            <div className="pt-1">
              <Input
                placeholder="Additional Condition Notes (e.g. back camera lens scratched)"
                value={formData.conditionNotes}
                onChange={(e) => setFormData({ ...formData, conditionNotes: e.target.value })}
                className="h-10 rounded-xl bg-white border-slate-200 text-xs"
              />
            </div>
          </div>

          {/* Section 4: Accessories Received Checklist */}
          <div className="space-y-3 p-4 rounded-2xl border border-slate-200/90 bg-slate-50/60">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div className="flex items-center gap-2 text-xs font-black text-slate-900 uppercase tracking-wider">
                <Zap className="w-4 h-4 text-amber-600" />
                <span>Accessories Received with Device</span>
              </div>
              <span className="text-[10px] text-slate-500 font-medium">Recorded for accountability (No Accessories is exclusive)</span>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {ACCESSORY_OPTIONS.map((acc) => {
                const isSelected = selectedAccessories.includes(acc);
                return (
                  <button
                    key={acc}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleAccessory(acc);
                    }}
                    className={cn(
                      "inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all duration-150 cursor-pointer select-none active:scale-[0.98]",
                      isSelected 
                        ? "bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-600/10" 
                        : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-100/80 shadow-2xs"
                    )}
                  >
                    {isSelected ? (
                      <Check className="w-3.5 h-3.5 text-white shrink-0 stroke-[2.5] pointer-events-none" />
                    ) : (
                      <Circle className="w-3.5 h-3.5 text-slate-300 shrink-0 stroke-[2] pointer-events-none" />
                    )}
                    <span className="pointer-events-none">{acc}</span>
                  </button>
                );
              })}
            </div>

            {selectedAccessories.includes("Other") && (
              <Input
                placeholder="Specify other accessory received (e.g. Stylus pen, MagSafe wallet)..."
                value={otherAccessoryText}
                onChange={(e) => setOtherAccessoryText(e.target.value)}
                className="h-10 rounded-xl bg-white border-slate-300 text-xs mt-2"
              />
            )}
          </div>

          {/* Section 5: Financials & Delivery Date */}
          <div className="space-y-3 p-4 rounded-2xl border border-slate-200/90 bg-slate-50/60">
            <div className="flex items-center gap-2 text-xs font-black text-slate-900 uppercase tracking-wider">
              <Banknote className="w-4 h-4 text-emerald-600" />
              <span>Repair Pricing & Financials</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Estimated Cost (Rs.)</Label>
                <Input
                  type="number"
                  placeholder="Leave blank if pending"
                  value={formData.estimatedCost}
                  onChange={(e) => setFormData({ ...formData, estimatedCost: e.target.value })}
                  className="h-10 rounded-xl bg-white border-slate-200 font-mono font-bold text-xs"
                />
                <span className="text-[10px] text-slate-400 block">Blank = Unspecified</span>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Advance Deposit (Rs.)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={formData.advancePaid}
                  onChange={(e) => setFormData({ ...formData, advancePaid: e.target.value })}
                  className="h-10 rounded-xl bg-white border-slate-200 font-mono font-bold text-xs text-emerald-700"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Payment Status</Label>
                <Select
                  value={formData.paymentStatus}
                  onValueChange={(v) => setFormData({ ...formData, paymentStatus: v })}
                >
                  <SelectTrigger className="h-10 rounded-xl bg-white border-slate-200 text-xs font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="UNPAID">UNPAID</SelectItem>
                    <SelectItem value="PARTIAL">PARTIAL</SelectItem>
                    <SelectItem value="PAID">PAID</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Est. Ready Date</Label>
                <Input
                  type="date"
                  value={formData.expectedCompletionDate}
                  onChange={(e) => setFormData({ ...formData, expectedCompletionDate: e.target.value })}
                  className="h-10 rounded-xl bg-white border-slate-200 text-xs"
                />
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-200/80">
              <Label className="text-xs font-black text-slate-800 uppercase tracking-wider">Queue Priority Level</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { value: 'NORMAL', label: 'Normal', emoji: '⚪', color: 'border-slate-300 bg-slate-50 text-slate-700' },
                  { value: 'MEDIUM', label: 'Medium', emoji: '🟡', color: 'border-yellow-300 bg-yellow-50 text-yellow-900' },
                  { value: 'HIGH', label: 'High', emoji: '🟠', color: 'border-amber-300 bg-amber-50 text-amber-900' },
                  { value: 'URGENT', label: 'Urgent', emoji: '🔴', color: 'border-rose-300 bg-rose-50 text-rose-900' },
                ].map((p) => {
                  const isSel = (formData.priority || 'NORMAL') === p.value;
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, priority: p.value })}
                      className={cn(
                        "flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer",
                        p.color,
                        isSel && p.value === 'URGENT' && "bg-rose-600 text-white border-rose-600 shadow-sm ring-2 ring-rose-600/20",
                        isSel && p.value === 'HIGH' && "bg-amber-500 text-slate-950 font-extrabold border-amber-500 shadow-sm ring-2 ring-amber-500/20",
                        isSel && p.value === 'MEDIUM' && "bg-yellow-500 text-slate-950 font-extrabold border-yellow-500 shadow-sm ring-2 ring-yellow-500/20",
                        isSel && p.value === 'NORMAL' && "bg-slate-900 text-white border-slate-900 shadow-sm ring-2 ring-slate-900/20"
                      )}
                    >
                      <span>{p.emoji}</span>
                      <span>{p.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1 pt-1">
              <Label className="text-xs font-bold text-slate-700">Internal Lab Remarks</Label>
              <Input
                placeholder="Optional internal remarks"
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                className="h-10 rounded-xl bg-white border-slate-200 text-xs"
              />
            </div>
          </div>

          {/* Section 6: Battery Warranty Option */}
          <div className="space-y-3 p-4 rounded-2xl border border-slate-200/90 bg-slate-50/60">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div className="flex items-center gap-2 text-xs font-black text-slate-900 uppercase tracking-wider">
                <BatteryCharging className="w-4 h-4 text-emerald-600" />
                <span>Battery Warranty</span>
              </div>
              <span className="text-[10px] text-slate-500 font-medium">Does this repair service include a warranted battery replacement?</span>
            </div>

            <div className="flex flex-wrap gap-2.5 pt-1">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setHasBatteryWarranty(false);
                }}
                className={cn(
                  "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all duration-150 cursor-pointer select-none active:scale-[0.98]",
                  !hasBatteryWarranty 
                    ? "bg-slate-900 text-white border-slate-900 shadow-sm ring-2 ring-slate-900/10" 
                    : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-100/80 shadow-2xs"
                )}
              >
                {!hasBatteryWarranty ? (
                  <Check className="w-3.5 h-3.5 text-white shrink-0 stroke-[2.5] pointer-events-none" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-slate-300 shrink-0 stroke-[2] pointer-events-none" />
                )}
                <span className="pointer-events-none">No Battery Warranty</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setHasBatteryWarranty(true);
                }}
                className={cn(
                  "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all duration-150 cursor-pointer select-none active:scale-[0.98]",
                  hasBatteryWarranty 
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-sm ring-2 ring-emerald-600/10" 
                    : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-100/80 shadow-2xs"
                )}
              >
                {hasBatteryWarranty ? (
                  <Check className="w-3.5 h-3.5 text-white shrink-0 stroke-[2.5] pointer-events-none" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-slate-300 shrink-0 stroke-[2] pointer-events-none" />
                )}
                <span className="pointer-events-none">Battery Replacement Warranty</span>
              </button>
            </div>

            {hasBatteryWarranty && (
              <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in duration-200">
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold text-slate-700">Warranty Duration</Label>
                  <Select
                    value={batteryWarrantyPeriod}
                    onValueChange={(v) => setBatteryWarrantyPeriod(v)}
                  >
                    <SelectTrigger className="h-10 rounded-xl bg-white border-slate-200 text-xs font-semibold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="6_MONTHS">6 Months Replacement Warranty</SelectItem>
                      <SelectItem value="1_YEAR">1 Year Extended Warranty</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-bold text-slate-700">Battery Type</Label>
                  <Input
                    value={batteryType}
                    onChange={(e) => setBatteryType(e.target.value)}
                    placeholder="e.g. Original Replacement Battery"
                    className="h-10 rounded-xl bg-white border-slate-200 text-xs font-medium"
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-slate-100 pt-4 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="rounded-xl h-10 text-xs font-bold border-slate-200"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="rounded-xl h-10 text-xs font-bold bg-slate-900 hover:bg-black text-white px-6 shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>

        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditRepairModal;
