import React, { useState, useEffect, useMemo } from 'react';
import { 
  Trash2, 
  ShieldAlert, 
  Search, 
  Loader2, 
  KeyRound, 
  AlertTriangle, 
  CheckSquare, 
  Square, 
  Smartphone, 
  BatteryCharging, 
  X, 
  RefreshCw,
  ShieldCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { formatNPR } from '@/lib/format';
import { useAuthStore } from '@/store/authStore';
import { useRealtimeSync } from '@/services/realtime';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';

export default function PermanentDeletionHub() {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  // Sub-tabs: REPAIRS vs WARRANTIES
  const [activeSection, setActiveSection] = useState<'REPAIRS' | 'WARRANTIES'>('REPAIRS');

  // ==========================================
  // SECTION 1: REPAIRS & CUSTOMERS (NO 2FA)
  // ==========================================
  const [repairs, setRepairs] = useState<any[]>([]);
  const [repairLoading, setRepairLoading] = useState(true);
  const [repairSearch, setRepairSearch] = useState('');
  const [repairStatusFilter, setRepairStatusFilter] = useState('ALL');
  const [selectedRepairIds, setSelectedRepairIds] = useState<string[]>([]);
  
  // Repair Delete Dialog State
  const [isRepairDeleteDialogOpen, setIsRepairDeleteDialogOpen] = useState(false);
  const [targetDeleteRepairs, setTargetDeleteRepairs] = useState<any[]>([]);
  const [repairDeleting, setRepairDeleting] = useState(false);

  // ==========================================
  // SECTION 2: BATTERY WARRANTIES (2FA REQUIRED)
  // ==========================================
  const [warranties, setWarranties] = useState<any[]>([]);
  const [warrantyLoading, setWarrantyLoading] = useState(true);
  const [warrantySearch, setWarrantySearch] = useState('');
  const [warrantyStatusFilter, setWarrantyStatusFilter] = useState('ALL');
  const [selectedWarrantyIds, setSelectedWarrantyIds] = useState<string[]>([]);

  // Warranty 2FA Delete Dialog State
  const [isWarrantyDeleteDialogOpen, setIsWarrantyDeleteDialogOpen] = useState(false);
  const [targetDeleteWarranties, setTargetDeleteWarranties] = useState<any[]>([]);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState('');
  const [warrantyDeleting, setWarrantyDeleting] = useState(false);

  // Fetch Data
  const fetchRepairs = async (silent = false) => {
    if (!silent) setRepairLoading(true);
    try {
      const res = await api.get('/repairs');
      setRepairs(Array.isArray(res) ? res : (res?.repairs || []));
    } catch (err: any) {
      console.error("[FETCH REPAIRS ERROR]", err);
      toast.error(err.message || "Failed to load repair records.");
    } finally {
      if (!silent) setRepairLoading(false);
    }
  };

  const fetchWarranties = async (silent = false) => {
    if (!silent) setWarrantyLoading(true);
    try {
      const res = await api.get('/battery-warranties');
      setWarranties(res?.warranties || (Array.isArray(res) ? res : []));
    } catch (err: any) {
      console.error("[FETCH WARRANTIES ERROR]", err);
      toast.error(err.message || "Failed to load battery warranty records.");
    } finally {
      if (!silent) setWarrantyLoading(false);
    }
  };

  useEffect(() => {
    fetchRepairs();
    fetchWarranties();
  }, []);

  // Real-time synchronization
  useRealtimeSync(['repair', 'batteryWarranty', 'customer'], () => {
    fetchRepairs(true);
    fetchWarranties(true);
  });

  // Filtered Repairs
  const filteredRepairs = useMemo(() => {
    return repairs.filter(r => {
      if (repairStatusFilter !== 'ALL' && r.status !== repairStatusFilter) return false;
      if (repairSearch.trim()) {
        const q = repairSearch.toLowerCase().trim();
        const match = 
          (r.repairNumber && String(r.repairNumber).toLowerCase().includes(q)) ||
          (r.customerName && r.customerName.toLowerCase().includes(q)) ||
          (r.customerPhone && r.customerPhone.includes(q)) ||
          (r.deviceBrand && r.deviceBrand.toLowerCase().includes(q)) ||
          (r.deviceModel && r.deviceModel.toLowerCase().includes(q)) ||
          (r.problemDescription && r.problemDescription.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
  }, [repairs, repairStatusFilter, repairSearch]);

  // Filtered Warranties
  const filteredWarranties = useMemo(() => {
    return warranties.filter(w => {
      if (warrantyStatusFilter !== 'ALL' && w.status !== warrantyStatusFilter) return false;
      if (warrantySearch.trim()) {
        const q = warrantySearch.toLowerCase().trim();
        const match = 
          (w.warrantyNumber && String(w.warrantyNumber).toLowerCase().includes(q)) ||
          (w.repairNumber && String(w.repairNumber).toLowerCase().includes(q)) ||
          (w.customerName && w.customerName.toLowerCase().includes(q)) ||
          (w.customerPhone && w.customerPhone.includes(q)) ||
          (w.deviceBrand && w.deviceBrand.toLowerCase().includes(q)) ||
          (w.deviceModel && w.deviceModel.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
  }, [warranties, warrantyStatusFilter, warrantySearch]);

  // ----------------------------------------------------
  // REPAIR SELECTION & DELETION HANDLERS (NO 2FA)
  // ----------------------------------------------------
  const handleToggleSelectAllRepairs = () => {
    const visibleIds = filteredRepairs.map(r => r.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedRepairIds.includes(id));
    if (allSelected) {
      setSelectedRepairIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedRepairIds(prev => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleToggleSelectRepair = (id: string) => {
    setSelectedRepairIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleOpenRepairDeleteDialog = (repairToDel?: any) => {
    if (!isSuperAdmin) {
      toast.error("Access denied: Only SUPER_ADMIN can permanently delete records.");
      return;
    }
    const targets = repairToDel 
      ? [repairToDel] 
      : repairs.filter(r => selectedRepairIds.includes(r.id));

    if (targets.length === 0) {
      toast.error("Please select at least one repair record to delete.");
      return;
    }

    setTargetDeleteRepairs(targets);
    setIsRepairDeleteDialogOpen(true);
  };

  const handleExecuteRepairDelete = async () => {
    if (!isSuperAdmin || targetDeleteRepairs.length === 0) return;
    setRepairDeleting(true);
    const idsToDelete = targetDeleteRepairs.map(r => r.id);

    try {
      const res: any = await api.post('/repairs/bulk-delete', { ids: idsToDelete });
      toast.success(res?.message || `Successfully permanently deleted ${idsToDelete.length} repair record(s).`);
      setIsRepairDeleteDialogOpen(false);
      setSelectedRepairIds(prev => prev.filter(id => !idsToDelete.includes(id)));
      setTargetDeleteRepairs([]);
      fetchRepairs();
    } catch (err: any) {
      console.error("[PERMANENT DELETE REPAIRS ERROR]", err);
      toast.error(err.message || "Failed to delete repair records.");
    } finally {
      setRepairDeleting(false);
    }
  };

  // ----------------------------------------------------
  // WARRANTY SELECTION & 2FA DELETION HANDLERS (2FA REQUIRED)
  // ----------------------------------------------------
  const handleToggleSelectAllWarranties = () => {
    const visibleIds = filteredWarranties.map(w => w.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedWarrantyIds.includes(id));
    if (allSelected) {
      setSelectedWarrantyIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedWarrantyIds(prev => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleToggleSelectWarranty = (id: string) => {
    setSelectedWarrantyIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleOpenWarrantyDeleteDialog = (warrantyToDel?: any) => {
    if (!isSuperAdmin) {
      toast.error("Access denied: Only SUPER_ADMIN can permanently delete records.");
      return;
    }
    const targets = warrantyToDel 
      ? [warrantyToDel] 
      : warranties.filter(w => selectedWarrantyIds.includes(w.id));

    if (targets.length === 0) {
      toast.error("Please select at least one battery warranty record to delete.");
      return;
    }

    setTargetDeleteWarranties(targets);
    setTwoFactorCode('');
    setOtpSent(false);
    setIsWarrantyDeleteDialogOpen(true);
    handleRequestWarranty2FACode();
  };

  const handleRequestWarranty2FACode = async () => {
    setSendingOtp(true);
    try {
      const res: any = await api.post('/battery-warranties/delete-2fa/request', {});
      if (res?.success) {
        setOtpSent(true);
        setMaskedEmail(res.emailMasked || user?.email || '');
        toast.success(res.message || "2FA verification code sent to your registered email.");
      } else {
        toast.error(res?.message || "Failed to dispatch 2FA verification code.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to request 2FA verification code.");
    } finally {
      setSendingOtp(false);
    }
  };

  const handleExecuteWarrantyDelete = async () => {
    if (!twoFactorCode.trim() || twoFactorCode.trim().length < 6) {
      toast.error("Please enter the complete 6-digit verification code.");
      return;
    }

    setWarrantyDeleting(true);
    const idsToDelete = targetDeleteWarranties.map(w => w.id);

    try {
      const res: any = await api.post('/battery-warranties/bulk-delete', {
        ids: idsToDelete,
        code: twoFactorCode.trim()
      });

      if (res?.success) {
        toast.success(res.message || "Battery warranty records permanently deleted.");
        setIsWarrantyDeleteDialogOpen(false);
        setSelectedWarrantyIds(prev => prev.filter(id => !idsToDelete.includes(id)));
        setTargetDeleteWarranties([]);
        setTwoFactorCode('');
        fetchWarranties();
      } else {
        toast.error(res?.error || res?.message || "Failed to delete battery warranties.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "2FA verification failed or expired. Please try again.");
    } finally {
      setWarrantyDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner Alert */}
      <div className="bg-slate-900 text-white p-6 sm:p-7 rounded-3xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge className="bg-rose-600 text-white font-bold text-[10px] uppercase tracking-wider">
              SUPER ADMIN PRIVILEGE
            </Badge>
            <Badge variant="outline" className="border-slate-700 text-slate-300 text-[10px]">
              STRICT IMMUTABLE POLICY
            </Badge>
          </div>
          <h2 className="text-2xl font-black text-white mt-2 flex items-center gap-2.5">
            <ShieldAlert className="w-7 h-7 text-rose-500" />
            <span>Permanent Deletion Control Center</span>
          </h2>
          <p className="text-xs text-slate-400 max-w-2xl mt-1 leading-relaxed">
            Role-enforced permanent deletion management for repairs, customers, and Battery Warranty Hub records. 
            All actions create permanent audit log trails.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchRepairs();
              fetchWarranties();
            }}
            className="h-10 px-4 rounded-xl border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-white font-bold text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Refresh Records
          </Button>
        </div>
      </div>

      {/* Section Switcher Tabs */}
      <Tabs value={activeSection} onValueChange={(v: any) => setActiveSection(v)} className="space-y-6">
        <TabsList className="bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200 w-full sm:w-auto flex flex-wrap sm:inline-flex gap-1.5 h-auto">
          <TabsTrigger value="REPAIRS" className="flex-1 sm:flex-initial rounded-xl py-2 px-4 sm:px-5 font-bold text-xs data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm">
            <Smartphone className="h-4 w-4 mr-2 text-indigo-600 shrink-0" />
            <span>Customer & Repair Records</span>
            <span className="ml-1.5 text-[10px] font-mono font-black bg-slate-200/80 text-slate-700 px-1.5 py-0.5 rounded-md">{repairs.length}</span>
          </TabsTrigger>
          <TabsTrigger value="WARRANTIES" className="flex-1 sm:flex-initial rounded-xl py-2 px-4 sm:px-5 font-bold text-xs data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm">
            <BatteryCharging className="h-4 w-4 mr-2 text-emerald-600 shrink-0" />
            <span>Battery Warranty Hub</span>
            <span className="ml-1.5 text-[10px] font-mono font-black bg-slate-200/80 text-slate-700 px-1.5 py-0.5 rounded-md">{warranties.length}</span>
            <Badge className="ml-2 bg-rose-100 text-rose-800 text-[9px] font-extrabold border-rose-300">2FA</Badge>
          </TabsTrigger>
        </TabsList>

        {/* ========================================================================= */}
        {/* SUBTAB 1: REPAIRS & CUSTOMER RECORDS DELETION (NO 2FA) */}
        {/* ========================================================================= */}
        <TabsContent value="REPAIRS" className="space-y-4">
          
          {/* Action Bar & Search Toolbar */}
          <Card className="rounded-2xl border border-slate-200 shadow-xs bg-white">
            <CardContent className="p-4 sm:p-5 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                
                {/* Search */}
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search repair #, customer name, phone, device model..."
                    value={repairSearch}
                    onChange={(e) => setRepairSearch(e.target.value)}
                    className="pl-10 h-11 rounded-xl border-slate-200 text-xs font-semibold"
                  />
                  {repairSearch && (
                    <button
                      type="button"
                      onClick={() => setRepairSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Filter */}
                <div className="flex items-center gap-2">
                  <Label className="text-xs font-bold text-slate-500">Status:</Label>
                  <Select value={repairStatusFilter} onValueChange={setRepairStatusFilter}>
                    <SelectTrigger className="h-11 rounded-xl border-slate-200 text-xs font-semibold w-40">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="ALL">All Status</SelectItem>
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="RECEIVED">Received</SelectItem>
                      <SelectItem value="IN_PROCESS">In Progress</SelectItem>
                      <SelectItem value="REPAIRED">Repaired</SelectItem>
                      <SelectItem value="READY_FOR_PICKUP">Ready for Pickup</SelectItem>
                      <SelectItem value="DELIVERED">Delivered</SelectItem>
                      <SelectItem value="RE_PROBLEM">Re-Problem</SelectItem>
                      <SelectItem value="CANNOT_REPAIR">Cannot Repair</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

              </div>
            </CardContent>
          </Card>

          {/* Selection Banner */}
          {selectedRepairIds.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900 text-white p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center font-black text-sm shrink-0">
                  {selectedRepairIds.length}
                </div>
                <div>
                  <p className="text-sm font-black text-white">
                    {selectedRepairIds.length} Repair Record{selectedRepairIds.length > 1 ? 's' : ''} Selected
                  </p>
                  <p className="text-xs text-slate-400">
                    Will permanently purge related notes, logs, and payments. Confirmation required.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedRepairIds([])}
                  className="rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-bold"
                >
                  Deselect All
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleOpenRepairDeleteDialog()}
                  className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs gap-1.5 shadow-sm"
                >
                  <Trash2 className="w-4 h-4" />
                  Permanently Delete Selected ({selectedRepairIds.length})
                </Button>
              </div>
            </motion.div>
          )}

          {/* Repairs Table */}
          <Card className="rounded-2xl border border-slate-200 shadow-sm bg-white overflow-hidden">
            <CardHeader className="bg-slate-900 text-white px-6 py-4 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-extrabold text-white flex items-center gap-2">
                  <span>Repair Database Records</span>
                  <Badge variant="outline" className="border-slate-700 text-slate-300 text-xs font-semibold">
                    {filteredRepairs.length} Matches
                  </Badge>
                </CardTitle>
                <CardDescription className="text-slate-400 text-xs mt-0.5">
                  Permanent deletion requires Super Admin auth and confirmation dialog (No 2FA required).
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {repairLoading ? (
                <div className="p-16 flex flex-col items-center justify-center gap-3 text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin text-rose-600" />
                  <p className="text-xs font-semibold text-slate-500">Loading repair records...</p>
                </div>
              ) : filteredRepairs.length === 0 ? (
                <div className="p-16 text-center text-slate-500 text-xs font-medium">
                  No repairs found matching your criteria.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                        <th className="py-3.5 pl-4 pr-2 w-10">
                          <button
                            type="button"
                            onClick={handleToggleSelectAllRepairs}
                            className="text-slate-400 hover:text-slate-700 cursor-pointer flex items-center"
                          >
                            {filteredRepairs.length > 0 && filteredRepairs.every(r => selectedRepairIds.includes(r.id)) ? (
                              <CheckSquare className="w-4 h-4 text-rose-600" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </th>
                        <th className="py-3.5 px-4">Repair Job #</th>
                        <th className="py-3.5 px-4">Customer</th>
                        <th className="py-3.5 px-4">Device</th>
                        <th className="py-3.5 px-4">Status</th>
                        <th className="py-3.5 px-4">Cost / Advance</th>
                        <th className="py-3.5 px-4">Created Date</th>
                        <th className="py-3.5 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                      {filteredRepairs.map((r) => {
                        const isSelected = selectedRepairIds.includes(r.id);
                        return (
                          <tr key={r.id} className={cn("transition-colors", isSelected ? "bg-rose-50/60" : "hover:bg-slate-50/60")}>
                            <td className="py-4 pl-4 pr-2">
                              <button
                                type="button"
                                onClick={() => handleToggleSelectRepair(r.id)}
                                className="text-slate-400 hover:text-rose-600 cursor-pointer flex items-center"
                              >
                                {isSelected ? (
                                  <CheckSquare className="w-4 h-4 text-rose-600" />
                                ) : (
                                  <Square className="w-4 h-4" />
                                )}
                              </button>
                            </td>

                            <td className="py-4 px-4 font-black font-mono text-slate-900">
                              #{r.repairNumber}
                            </td>

                            <td className="py-4 px-4">
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-900">{r.customerName}</span>
                                <span className="text-[11px] text-slate-500 font-mono">{r.customerPhone}</span>
                              </div>
                            </td>

                            <td className="py-4 px-4">
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-800">{r.deviceBrand?.toUpperCase()} {r.deviceModel}</span>
                                <span className="text-[10px] text-slate-400 truncate max-w-[160px]">{r.problemDescription}</span>
                              </div>
                            </td>

                            <td className="py-4 px-4">
                              <Badge variant="outline" className="font-bold text-[10px]">
                                {r.status?.replace(/_/g, ' ')}
                              </Badge>
                            </td>

                            <td className="py-4 px-4 font-mono">
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-900">{formatNPR(r.estimatedCost || 0)}</span>
                                <span className="text-[10px] text-emerald-600 font-semibold">Adv: {formatNPR(r.advancePaid || 0)}</span>
                              </div>
                            </td>

                            <td className="py-4 px-4 text-[11px] text-slate-500">
                              {r.createdAt ? format(new Date(r.createdAt), 'dd MMM yyyy') : '-'}
                            </td>

                            <td className="py-4 px-4 text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenRepairDeleteDialog(r)}
                                className="h-8 px-2.5 rounded-lg text-rose-600 hover:bg-rose-100 hover:text-rose-700 text-xs font-bold gap-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete</span>
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

        </TabsContent>

        {/* ========================================================================= */}
        {/* SUBTAB 2: BATTERY WARRANTY HUB DELETION (2FA REQUIRED) */}
        {/* ========================================================================= */}
        <TabsContent value="WARRANTIES" className="space-y-4">
          
          {/* Action Bar & Search Toolbar */}
          <Card className="rounded-2xl border border-slate-200 shadow-xs bg-white">
            <CardContent className="p-4 sm:p-5 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                
                {/* Search */}
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search warranty #, repair #, customer, phone..."
                    value={warrantySearch}
                    onChange={(e) => setWarrantySearch(e.target.value)}
                    className="pl-10 h-11 rounded-xl border-slate-200 text-xs font-semibold"
                  />
                  {warrantySearch && (
                    <button
                      type="button"
                      onClick={() => setWarrantySearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Filter */}
                <div className="flex items-center gap-2">
                  <Label className="text-xs font-bold text-slate-500">Status:</Label>
                  <Select value={warrantyStatusFilter} onValueChange={setWarrantyStatusFilter}>
                    <SelectTrigger className="h-11 rounded-xl border-slate-200 text-xs font-semibold w-40">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="ALL">All Status</SelectItem>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="EXPIRING_SOON">Expiring Soon</SelectItem>
                      <SelectItem value="EXPIRED">Expired</SelectItem>
                      <SelectItem value="CLAIMED">Claimed</SelectItem>
                      <SelectItem value="REPLACED">Replaced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

              </div>
            </CardContent>
          </Card>

          {/* Selection Banner */}
          {selectedWarrantyIds.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-rose-50 border-2 border-rose-200 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-sm">
                  {selectedWarrantyIds.length}
                </div>
                <div>
                  <p className="text-sm font-black text-rose-950 flex items-center gap-2">
                    <span>{selectedWarrantyIds.length} Warranty Record{selectedWarrantyIds.length > 1 ? 's' : ''} Selected</span>
                    <Badge className="bg-rose-200 text-rose-900 border-rose-300 text-[10px] font-bold">2FA PROTECTED</Badge>
                  </p>
                  <p className="text-xs text-rose-700 font-semibold">
                    Permanent deletion will purge all associated warranty claims and service histories.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedWarrantyIds([])}
                  className="rounded-xl border-rose-200 text-rose-800 hover:bg-rose-100 text-xs font-bold"
                >
                  Deselect All
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleOpenWarrantyDeleteDialog()}
                  className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs gap-1.5 shadow-sm"
                >
                  <Trash2 className="w-4 h-4" />
                  Permanently Delete Selected (2FA)
                </Button>
              </div>
            </motion.div>
          )}

          {/* Warranties Table */}
          <Card className="rounded-2xl border border-slate-200 shadow-sm bg-white overflow-hidden">
            <CardHeader className="bg-slate-900 text-white px-6 py-4 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-extrabold text-white flex items-center gap-2">
                  <span>Battery Warranty Hub Records</span>
                  <Badge variant="outline" className="border-slate-700 text-slate-300 text-xs font-semibold">
                    {filteredWarranties.length} Matches
                  </Badge>
                  <Badge className="bg-rose-600/30 text-rose-300 border-rose-500/40 text-[10px] font-bold">
                    EMAIL 2FA MANDATORY
                  </Badge>
                </CardTitle>
                <CardDescription className="text-slate-400 text-xs mt-0.5">
                  Permanent deletion strictly requires 2FA Email verification code before purge.
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {warrantyLoading ? (
                <div className="p-16 flex flex-col items-center justify-center gap-3 text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                  <p className="text-xs font-semibold text-slate-500">Loading battery warranty records...</p>
                </div>
              ) : filteredWarranties.length === 0 ? (
                <div className="p-16 text-center text-slate-500 text-xs font-medium">
                  No battery warranty records found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                        <th className="py-3.5 pl-4 pr-2 w-10">
                          <button
                            type="button"
                            onClick={handleToggleSelectAllWarranties}
                            className="text-slate-400 hover:text-slate-700 cursor-pointer flex items-center"
                          >
                            {filteredWarranties.length > 0 && filteredWarranties.every(w => selectedWarrantyIds.includes(w.id)) ? (
                              <CheckSquare className="w-4 h-4 text-rose-600" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </th>
                        <th className="py-3.5 px-4">Warranty ID & Job #</th>
                        <th className="py-3.5 px-4">Customer</th>
                        <th className="py-3.5 px-4">Device</th>
                        <th className="py-3.5 px-4">Duration & Expiry</th>
                        <th className="py-3.5 px-4">Status</th>
                        <th className="py-3.5 px-4">Claims</th>
                        <th className="py-3.5 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                      {filteredWarranties.map((w) => {
                        const isSelected = selectedWarrantyIds.includes(w.id);
                        return (
                          <tr key={w.id} className={cn("transition-colors", isSelected ? "bg-rose-50/60" : "hover:bg-slate-50/60")}>
                            <td className="py-4 pl-4 pr-2">
                              <button
                                type="button"
                                onClick={() => handleToggleSelectWarranty(w.id)}
                                className="text-slate-400 hover:text-rose-600 cursor-pointer flex items-center"
                              >
                                {isSelected ? (
                                  <CheckSquare className="w-4 h-4 text-rose-600" />
                                ) : (
                                  <Square className="w-4 h-4" />
                                )}
                              </button>
                            </td>

                            <td className="py-4 px-4 font-black font-mono text-slate-900">
                              <div className="flex flex-col">
                                <span className="flex items-center gap-1">
                                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  {w.warrantyNumber}
                                </span>
                                <span className="text-[11px] text-blue-600 font-semibold">Job #{w.repairNumber}</span>
                              </div>
                            </td>

                            <td className="py-4 px-4">
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-900">{w.customerName}</span>
                                <span className="text-[11px] text-slate-500 font-mono">{w.customerPhone}</span>
                              </div>
                            </td>

                            <td className="py-4 px-4">
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-800">{w.deviceBrand?.toUpperCase()} {w.deviceModel}</span>
                                <span className="text-[10px] text-slate-400">{w.batteryType || 'Replacement Battery'}</span>
                              </div>
                            </td>

                            <td className="py-4 px-4">
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-800">{w.warrantyPeriod === '1_YEAR' ? '1 Year' : '6 Months'}</span>
                                <span className="text-[11px] text-slate-500">Exp: {w.expiryDate ? format(new Date(w.expiryDate), 'dd MMM yyyy') : '-'}</span>
                              </div>
                            </td>

                            <td className="py-4 px-4">
                              <Badge variant="outline" className="font-bold text-[10px]">
                                {w.status}
                              </Badge>
                            </td>

                            <td className="py-4 px-4">
                              <span className="font-bold text-slate-700">{w.claimCount || 0} Claim(s)</span>
                            </td>

                            <td className="py-4 px-4 text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenWarrantyDeleteDialog(w)}
                                className="h-8 px-2.5 rounded-lg text-rose-600 hover:bg-rose-100 hover:text-rose-700 text-xs font-bold gap-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete (2FA)</span>
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

        </TabsContent>
      </Tabs>

      {/* ========================================================================= */}
      {/* 1. REPAIR PERMANENT DELETION CONFIRMATION DIALOG (NO 2FA) */}
      {/* ========================================================================= */}
      <Dialog open={isRepairDeleteDialogOpen} onOpenChange={setIsRepairDeleteDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 border-rose-200">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-md shrink-0">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg font-black text-rose-950">
                  Permanently Delete Repair Records
                </DialogTitle>
                <DialogDescription className="text-xs text-rose-700 font-semibold">
                  Super Admin authorization confirmation
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-950 space-y-2">
              <p className="font-black text-sm text-rose-900">
                Are you sure you want to permanently delete {targetDeleteRepairs.length} repair record(s)?
              </p>
              <p className="text-rose-800 text-xs leading-relaxed">
                This action will permanently purge all technician notes, logs, payment records, and notification history. This action cannot be undone.
              </p>
              <div className="max-h-28 overflow-y-auto bg-white/80 rounded-xl p-2.5 border border-rose-100 text-[11px] font-mono space-y-1">
                {targetDeleteRepairs.map((r, idx) => (
                  <div key={r.id || idx} className="text-slate-800 flex justify-between">
                    <span className="font-bold">#{r.repairNumber}</span>
                    <span className="text-slate-600">{r.customerName} ({r.deviceBrand} {r.deviceModel})</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-slate-100 pt-4 flex sm:justify-between items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsRepairDeleteDialogOpen(false);
                setTargetDeleteRepairs([]);
              }}
              disabled={repairDeleting}
              className="rounded-xl text-xs font-semibold"
            >
              Cancel
            </Button>

            <Button
              size="sm"
              onClick={handleExecuteRepairDelete}
              disabled={repairDeleting}
              className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
            >
              {repairDeleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Deleting Records...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Confirm Permanent Deletion</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 2. BATTERY WARRANTY 2FA PERMANENT DELETION DIALOG (2FA REQUIRED) */}
      {/* ========================================================================= */}
      <Dialog open={isWarrantyDeleteDialogOpen} onOpenChange={setIsWarrantyDeleteDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 border-rose-200">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-md shrink-0">
                <ShieldAlert className="w-6 h-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg font-black text-rose-950">
                  Permanent Deletion (2FA Protected)
                </DialogTitle>
                <DialogDescription className="text-xs text-rose-700 font-semibold">
                  Battery Warranty Hub • Email 2FA Code Required
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-1.5">
              <p className="font-bold text-rose-950 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                Destructive action on Battery Warranty Hub:
              </p>
              <p className="text-[11px] text-rose-800">
                You are about to permanently delete <strong>{targetDeleteWarranties.length}</strong> battery warranty record(s) and their claim histories:
              </p>
              <div className="max-h-24 overflow-y-auto bg-white/70 rounded-xl p-2 border border-rose-100 text-[11px] font-mono space-y-1">
                {targetDeleteWarranties.map((w, idx) => (
                  <div key={w.id || idx} className="text-slate-800 flex justify-between">
                    <span className="font-bold">#{w.warrantyNumber}</span>
                    <span className="text-slate-500">{w.customerName}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 2FA Input Section */}
            <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-3 shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-200">Email 2FA Verification</span>
                </div>
                {otpSent && (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full">
                    CODE SENT
                  </span>
                )}
              </div>

              <p className="text-[11px] text-slate-300 leading-relaxed">
                {maskedEmail 
                  ? `Enter the 6-digit verification code sent to your registered email (${maskedEmail}):` 
                  : "A 6-digit security code has been dispatched to your Super Admin email address."}
              </p>

              <div className="space-y-2">
                <Input
                  type="text"
                  maxLength={6}
                  placeholder="0 0 0 0 0 0"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="text-center font-mono text-xl tracking-[0.4em] font-black h-12 bg-slate-800 border-slate-700 text-white rounded-xl focus:border-rose-500"
                />
                
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                  <span>Code expires in 5 minutes</span>
                  <button
                    type="button"
                    onClick={handleRequestWarranty2FACode}
                    disabled={sendingOtp}
                    className="text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer disabled:opacity-50"
                  >
                    {sendingOtp ? "Sending Code..." : "Resend 2FA Code"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-slate-100 pt-4 flex sm:justify-between items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsWarrantyDeleteDialogOpen(false);
                setTwoFactorCode('');
                setTargetDeleteWarranties([]);
              }}
              disabled={warrantyDeleting}
              className="rounded-xl text-xs font-semibold"
            >
              Cancel
            </Button>

            <Button
              size="sm"
              onClick={handleExecuteWarrantyDelete}
              disabled={warrantyDeleting || twoFactorCode.trim().length < 6}
              className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
            >
              {warrantyDeleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Deleting Records...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Confirm Permanent Deletion</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
