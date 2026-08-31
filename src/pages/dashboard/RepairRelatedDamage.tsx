import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileWarning, 
  Wrench, 
  Smartphone, 
  Search, 
  Filter, 
  Plus, 
  Calendar, 
  Clock, 
  User, 
  Package, 
  Building2, 
  Layers, 
  ChevronRight, 
  ChevronDown, 
  RefreshCw, 
  Download, 
  Eye, 
  Edit3, 
  Trash2, 
  Check, 
  X, 
  AlertTriangle, 
  ShieldAlert, 
  ShieldCheck, 
  Shield,
  Info,
  History, 
  Loader2, 
  ArrowUpRight, 
  Hash, 
  CheckCircle2, 
  DollarSign,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { api } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { useRealtimeSync } from '@/services/realtime';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import DashboardRefreshButton from '@/components/DashboardRefreshButton';

const STANDARD_COMPONENTS = [
  'Display Panel',
  'OCA Glass',
  'Touch Screen Digitizer',
  'AMOLED Display',
  'LCD Screen',
  'Back Glass / Back Panel',
  'Battery',
  'Camera Module (Rear)',
  'Camera Module (Front)',
  'Camera Lens Glass',
  'Charging Port PCB',
  'Speaker / Earpiece',
  'Flex Cable',
  'Motherboard / PCB',
  'Power IC',
  'Audio IC',
  'Other Component'
];

const DAMAGE_TYPES = [
  { value: 'CRACKED', label: 'Cracked / Shattered Glass' },
  { value: 'TORN_FLEX', label: 'Torn Flex Ribbon Cable' },
  { value: 'SHORT_CIRCUIT', label: 'Short Circuit / Electrical Burn' },
  { value: 'HEAT_DAMAGE', label: 'Heat Separation Damage' },
  { value: 'PRESSURE_BLEED', label: 'Pressure / OLED Bleed / Line' },
  { value: 'SCRATCHED', label: 'Scratched / Cosmetic Dent' },
  { value: 'COMPONENT_LOST', label: 'Lost / Displaced Small Part' },
  { value: 'OTHER', label: 'Other Handling Mishap' }
];

export default function RepairRelatedDamage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const userRole = user?.role || 'TECHNICIAN';
  const isSuperAdmin = userRole === 'SUPER_ADMIN';
  const isAdmin = userRole === 'ADMIN';
  const isManager = userRole === 'MANAGER';
  const isElevated = isSuperAdmin || isAdmin || isManager;
  const canRecordDamage = isSuperAdmin || isAdmin || isManager;
  const canEditOrDelete = isSuperAdmin || isAdmin;

  // Overview Stats
  const [overviewStats, setOverviewStats] = useState<any>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);

  // Records list
  const [records, setRecords] = useState<any[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [totalRecordsCount, setTotalRecordsCount] = useState(0);

  // Staff members & inventory items
  const [staffList, setStaffList] = useState<any[]>([]);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStaffFilter, setSelectedStaffFilter] = useState('ALL');
  const [selectedComponentFilter, setSelectedComponentFilter] = useState('ALL');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('ALL');
  const [periodTab, setPeriodTab] = useState<'ALL' | 'TODAY' | 'THIS_MONTH' | 'THIS_YEAR' | 'CUSTOM'>('ALL');
  const [customDate, setCustomDate] = useState('');
  const [customMonth, setCustomMonth] = useState('');
  const [customYear, setCustomYear] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [recordDetailsLoading, setRecordDetailsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Form State: Create Damage Record
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
    deductInventory: false
  });

  // Repair search autocomplete
  const [repairSearchQuery, setRepairSearchQuery] = useState('');
  const [repairSearchResults, setRepairSearchResults] = useState<any[]>([]);
  const [searchingRepairs, setSearchingRepairs] = useState(false);

  // Form State: Edit Record
  const [editFormData, setEditFormData] = useState({
    damagedComponent: '',
    damageType: '',
    damageDescription: '',
    damageDate: '',
    damageTime: '',
    quantity: 1,
    estimatedCost: '',
    notes: '',
    status: 'ACTIVE',
    deviceBrand: '',
    deviceModel: '',
    repairNumber: '',
    auditReason: ''
  });

  // Fetch Overview Stats
  const fetchOverviewStats = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoadingOverview(true);
    try {
      const params = new URLSearchParams();
      if (isElevated && selectedStaffFilter !== 'ALL') {
        params.append('staffId', selectedStaffFilter);
      }
      const data = await api.get(`/repair-damage/overview?${params.toString()}`);
      setOverviewStats(data);
    } catch (err: any) {
      console.error('[FETCH DAMAGE OVERVIEW ERROR]', err);
    } finally {
      if (!isBackground) setLoadingOverview(false);
    }
  }, [isElevated, selectedStaffFilter]);

  // Fetch Records with applied filters
  const fetchRecords = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoadingRecords(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (isElevated && selectedStaffFilter !== 'ALL') {
        params.append('staffId', selectedStaffFilter);
      }
      if (selectedComponentFilter !== 'ALL') params.append('component', selectedComponentFilter);
      if (selectedTypeFilter !== 'ALL') params.append('damageType', selectedTypeFilter);

      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const currentYearStr = String(now.getFullYear());

      if (periodTab === 'TODAY') {
        params.append('date', todayStr);
      } else if (periodTab === 'THIS_MONTH') {
        params.append('month', currentMonthStr);
      } else if (periodTab === 'THIS_YEAR') {
        params.append('year', currentYearStr);
      } else if (periodTab === 'CUSTOM') {
        if (customDate) params.append('date', customDate);
        else if (customMonth) params.append('month', customMonth);
        else if (customYear) params.append('year', customYear);
        else if (startDate || endDate) {
          if (startDate) params.append('startDate', startDate);
          if (endDate) params.append('endDate', endDate);
        }
      }

      params.append('limit', '100');

      const res = await api.get(`/repair-damage?${params.toString()}`);
      if (res && Array.isArray(res.records)) {
        setRecords(res.records);
        setTotalRecordsCount(res.pagination?.total || res.records.length);
      } else if (Array.isArray(res)) {
        setRecords(res);
        setTotalRecordsCount(res.length);
      } else {
        setRecords([]);
        setTotalRecordsCount(0);
      }
    } catch (err: any) {
      console.error('[FETCH DAMAGE RECORDS ERROR]', err);
      toast.error(err?.message || 'Failed to load repair-related damage records.');
    } finally {
      if (!isBackground) setLoadingRecords(false);
    }
  }, [searchQuery, isElevated, selectedStaffFilter, selectedComponentFilter, selectedTypeFilter, periodTab, customDate, customMonth, customYear, startDate, endDate]);

  // Fetch Staff List & Inventory items for form selectors
  const fetchSupportingData = async () => {
    try {
      const [usersRes, invRes] = await Promise.allSettled([
        api.get('/users'),
        api.get('/inventory?limit=200')
      ]);

      if (usersRes.status === 'fulfilled') {
        const uList = Array.isArray(usersRes.value) ? usersRes.value : (usersRes.value?.users || []);
        const filteredStaff = uList.filter((u: any) => u.isActive && u.accountStatus !== 'PENDING');
        setStaffList(filteredStaff);
      }

      if (invRes.status === 'fulfilled') {
        const iList = Array.isArray(invRes.value) ? invRes.value : (invRes.value?.items || invRes.value?.data || []);
        setInventoryItems(iList);
      }
    } catch (err) {
      console.error('[FETCH SUPPORTING DATA ERROR]', err);
    }
  };

  useEffect(() => {
    fetchOverviewStats(false);
    if (isElevated) {
      fetchSupportingData();
    }
  }, [fetchOverviewStats, isElevated]);

  useEffect(() => {
    fetchRecords(false);
  }, [fetchRecords]);

  // Real-time synchronization
  useRealtimeSync(['repairRelatedDamage', 'repair', 'inventory', 'user'], () => {
    fetchOverviewStats(true);
    fetchRecords(true);
  });

  // Repair Live Search
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

  const selectRepairForDamage = (repair: any) => {
    setFormData(prev => ({
      ...prev,
      repairId: repair.id,
      repairNumber: repair.repairNumber,
      customerId: repair.customerId || '',
      customerName: repair.customerName || '',
      deviceBrand: repair.deviceBrand || '',
      deviceModel: repair.deviceModel || '',
      staffId: prev.staffId || repair.technicianId || ''
    }));
    setRepairSearchResults([]);
    setRepairSearchQuery('');
  };

  // Open Details Modal with Full Audit Log
  const handleOpenDetails = async (record: any) => {
    setSelectedRecord(record);
    setIsDetailsModalOpen(true);
    setRecordDetailsLoading(true);
    try {
      const fullRecord = await api.get(`/repair-damage/${record.id}`);
      setSelectedRecord(fullRecord);
    } catch (err: any) {
      console.error('[FETCH DAMAGE DETAILS ERROR]', err);
    } finally {
      setRecordDetailsLoading(false);
    }
  };

  // Open Edit Modal (Super Admin / Admin Only)
  const handleOpenEdit = (record: any) => {
    if (!canEditOrDelete) {
      toast.error('Permission Denied: Only Admins can modify records.');
      return;
    }
    setSelectedRecord(record);
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
      deviceBrand: record.deviceBrand || '',
      deviceModel: record.deviceModel || '',
      repairNumber: record.repairNumber || '',
      auditReason: ''
    });
    setIsEditModalOpen(true);
  };

  // Open Delete / Archive Modal (Super Admin / Admin Only)
  const handleOpenDelete = (record: any) => {
    if (!canEditOrDelete) {
      toast.error('Permission Denied: Only Admins can archive records.');
      return;
    }
    setSelectedRecord(record);
    setIsDeleteModalOpen(true);
  };

  // Submit Create Damage Record
  const handleCreateDamage = async (e: React.FormEvent) => {
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
      toast.error('Please provide a detailed damage description (at least 3 characters).');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/repair-damage', {
        ...formData,
        quantity: Number(formData.quantity) || 1,
        estimatedCost: formData.estimatedCost ? parseFloat(formData.estimatedCost) : undefined
      });
      toast.success('Repair-related damage record logged successfully.');
      setIsRecordModalOpen(false);
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
        deductInventory: false
      });
      fetchOverviewStats();
      fetchRecords();
    } catch (err: any) {
      console.error('[CREATE DAMAGE ERROR]', err);
      toast.error(err?.message || 'Failed to record repair-related damage.');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Edit Damage Record
  const handleUpdateDamage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;
    if (!editFormData.damageDescription.trim()) {
      toast.error('Description cannot be empty.');
      return;
    }

    setSubmitting(true);
    try {
      await api.patch(`/repair-damage/${selectedRecord.id}`, {
        ...editFormData,
        quantity: Number(editFormData.quantity) || 1,
        estimatedCost: editFormData.estimatedCost ? parseFloat(editFormData.estimatedCost) : null
      });
      toast.success('Damage record updated with audit log.');
      setIsEditModalOpen(false);
      fetchOverviewStats();
      fetchRecords();
    } catch (err: any) {
      console.error('[UPDATE DAMAGE ERROR]', err);
      toast.error(err?.message || 'Failed to update damage record.');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Delete / Archive Record
  const handleDeleteDamage = async () => {
    if (!selectedRecord) return;
    setSubmitting(true);
    try {
      await api.delete(`/repair-damage/${selectedRecord.id}`);
      toast.success('Damage record safely archived.');
      setIsDeleteModalOpen(false);
      fetchOverviewStats();
      fetchRecords();
    } catch (err: any) {
      console.error('[DELETE DAMAGE ERROR]', err);
      toast.error(err?.message || 'Failed to archive damage record.');
    } finally {
      setSubmitting(false);
    }
  };

  // Export to Excel
  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (isElevated && selectedStaffFilter !== 'ALL') {
        params.append('staffId', selectedStaffFilter);
      }
      if (selectedComponentFilter !== 'ALL') params.append('component', selectedComponentFilter);
      if (selectedTypeFilter !== 'ALL') params.append('damageType', selectedTypeFilter);
      if (periodTab === 'CUSTOM') {
        if (customMonth) params.append('month', customMonth);
        else if (customYear) params.append('year', customYear);
        else if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
      }
      await api.download(`/repair-damage/export?${params.toString()}`, `MTS_Repair_Related_Damage_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Damage records exported successfully.');
    } catch (err: any) {
      console.error('[EXPORT DAMAGE ERROR]', err);
      toast.error(err?.message || 'Failed to export damage records.');
    } finally {
      setExporting(false);
    }
  };

  // Helper for component badge colors
  const getComponentBadgeColor = (comp: string) => {
    if (comp?.includes('Display') || comp?.includes('Screen') || comp?.includes('OLED')) {
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    }
    if (comp?.includes('Glass') || comp?.includes('Housing') || comp?.includes('Panel')) {
      return 'bg-purple-50 text-purple-700 border-purple-200';
    }
    if (comp?.includes('Battery')) {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    if (comp?.includes('Camera')) {
      return 'bg-sky-50 text-sky-700 border-sky-200';
    }
    if (comp?.includes('Charging') || comp?.includes('Port')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (comp?.includes('Speaker') || comp?.includes('Audio')) {
      return 'bg-cyan-50 text-cyan-700 border-cyan-200';
    }
    if (comp?.includes('Flex') || comp?.includes('Connector')) {
      return 'bg-orange-50 text-orange-700 border-orange-200';
    }
    if (comp?.includes('IC') || comp?.includes('Board') || comp?.includes('Motherboard')) {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
    return 'bg-slate-50 text-slate-700 border-slate-200';
  };

  return (
    <div className="space-y-6 sm:space-y-8 pb-20 max-w-7xl mx-auto">
      {/* ========================================================================= */}
      {/* 1. HEADER SECTION & ROLE BADGE */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 sm:p-7 rounded-3xl border border-slate-200/70 shadow-xs">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100 shadow-2xs shrink-0">
              <FileWarning className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-slate-900 truncate">
                  {isElevated ? 'Repair-Related Damage Hub' : 'My Repair-Related Damage'}
                </h1>
                <Badge variant="outline" className={cn(
                  "text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border",
                  isSuperAdmin ? "bg-purple-50 text-purple-700 border-purple-200" :
                  isAdmin ? "bg-indigo-50 text-indigo-700 border-indigo-200" :
                  isManager ? "bg-amber-50 text-amber-700 border-amber-200" :
                  "bg-slate-100 text-slate-700 border-slate-200"
                )}>
                  {userRole.replace(/_/g, ' ')}
                </Badge>
              </div>
              <p className="text-xs sm:text-sm font-medium text-slate-500 truncate mt-0.5">
                {isSuperAdmin || isAdmin 
                  ? 'Complete oversight, audit trails, and administrative damage record control' 
                  : isManager 
                  ? 'Log repair component damage and monitor team incident reports' 
                  : 'Personal log of component damage reports associated with your repair jobs'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap w-full sm:w-auto shrink-0">
          <DashboardRefreshButton 
            onRefresh={async () => {
              await fetchOverviewStats();
              await fetchRecords();
            }} 
          />

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            disabled={exporting || records.length === 0}
            className="rounded-xl border-slate-200 font-bold text-xs h-10 px-3.5 gap-1.5 hover:bg-slate-50 cursor-pointer shadow-2xs"
          >
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 text-slate-600" />}
            <span>Export</span>
          </Button>

          {canRecordDamage && (
            <Button
              onClick={() => setIsRecordModalOpen(true)}
              className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs sm:text-sm h-10 sm:h-11 px-4 sm:px-5 gap-2 shadow-md cursor-pointer flex-1 sm:flex-initial"
            >
              <Plus className="h-4 w-4 text-rose-400 shrink-0" />
              <span>Record Damage</span>
            </Button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ROLE INFORMATIONAL BANNER FOR MANAGERS */}
      {/* ========================================================================= */}
      {isManager && (
        <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-2xl flex items-start gap-3 text-xs text-amber-900">
          <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold">Manager Workspace Policy:</span>
            <p className="text-amber-800 leading-relaxed font-medium">
              You are authorized to log new repair damage incidents and inspect team records. In accordance with MTS strict audit guidelines, modifying or deleting existing records is reserved exclusively for Super Admin and Admin roles.
            </p>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. OVERVIEW METRIC CARDS */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Total Records */}
        <Card className="rounded-3xl border border-slate-200/70 shadow-xs bg-white overflow-hidden p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 shadow-2xs">
            <FileWarning className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">
              {isElevated ? 'Total Damage Records' : 'My Total Incidents'}
            </p>
            <p className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">
              {loadingOverview ? <Loader2 className="h-6 w-6 animate-spin text-slate-400" /> : (overviewStats?.totalRecords ?? 0)}
            </p>
            <p className="text-[11px] font-medium text-slate-500 mt-0.5 truncate">
              {isElevated ? 'Active logged incidents' : 'Associated with your work'}
            </p>
          </div>
        </Card>

        {/* This Month */}
        <Card className="rounded-3xl border border-slate-200/70 shadow-xs bg-white overflow-hidden p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0 shadow-2xs">
            <Calendar className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">
              {isElevated ? 'This Month' : 'My Month Incidents'}
            </p>
            <p className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">
              {loadingOverview ? <Loader2 className="h-6 w-6 animate-spin text-slate-400" /> : (overviewStats?.thisMonthRecords ?? 0)}
            </p>
            <p className="text-[11px] font-medium text-slate-500 mt-0.5 truncate">
              {overviewStats?.currentMonth || format(new Date(), 'MMM yyyy')}
            </p>
          </div>
        </Card>

        {/* Today */}
        <Card className="rounded-3xl border border-slate-200/70 shadow-xs bg-white overflow-hidden p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0 shadow-2xs">
            <Clock className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">
              {isElevated ? "Today's Incidents" : "My Today Incidents"}
            </p>
            <p className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">
              {loadingOverview ? <Loader2 className="h-6 w-6 animate-spin text-slate-400" /> : (overviewStats?.todayRecords ?? 0)}
            </p>
            <p className="text-[11px] font-medium text-slate-500 mt-0.5 truncate">
              Authoritative Nepal date
            </p>
          </div>
        </Card>

        {/* Estimated Cost */}
        <Card className="rounded-3xl border border-slate-200/70 shadow-xs bg-white overflow-hidden p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 shadow-2xs">
            <DollarSign className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">
              {isElevated ? 'Total Est. Cost' : 'My Total Est. Cost'}
            </p>
            <p className="text-2xl font-black text-slate-900 tracking-tight mt-0.5 truncate">
              {loadingOverview ? <Loader2 className="h-6 w-6 animate-spin text-slate-400" /> : `NPR ${(overviewStats?.totalEstimatedCost || 0).toLocaleString()}`}
            </p>
            <p className="text-[11px] font-medium text-slate-500 mt-0.5 truncate">
              Cumulative component value
            </p>
          </div>
        </Card>
      </div>

      {/* ========================================================================= */}
      {/* 3. COMPONENT BREAKDOWN SUMMARY CHIPS */}
      {/* ========================================================================= */}
      {overviewStats?.componentBreakdown && Object.keys(overviewStats.componentBreakdown).length > 0 && (
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/70 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-slate-400" />
              Component Breakdown Summary
            </h3>
            <span className="text-[11px] font-semibold text-slate-400">
              {(Object.values(overviewStats.componentBreakdown) as number[]).reduce((a, b) => a + b, 0)} total incidents
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {Object.entries(overviewStats.componentBreakdown).map(([compName, count]: [string, any]) => {
              if (count === 0 && selectedComponentFilter !== compName) return null;
              const isSelected = selectedComponentFilter === compName;
              return (
                <button
                  key={compName}
                  type="button"
                  onClick={() => setSelectedComponentFilter(isSelected ? 'ALL' : compName)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border shrink-0 flex items-center gap-2 cursor-pointer shadow-2xs",
                    isSelected 
                      ? "bg-slate-900 text-white border-slate-900" 
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  )}
                >
                  <span>{compName}</span>
                  <span className={cn(
                    "px-1.5 py-0.2 rounded-md text-[10px] font-black",
                    isSelected ? "bg-white text-slate-900" : "bg-slate-200 text-slate-700"
                  )}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. FILTERS & SEARCH CONTROLS */}
      {/* ========================================================================= */}
      <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200/70 shadow-xs space-y-4">
        {/* Quick Period Tabs */}
        <div className="flex items-center justify-between gap-2 flex-wrap pb-1 border-b border-slate-100">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mr-1 hidden sm:inline">Period:</span>
            {[
              { id: 'ALL', label: 'All Records' },
              { id: 'TODAY', label: 'Today' },
              { id: 'THIS_MONTH', label: 'This Month' },
              { id: 'THIS_YEAR', label: 'This Year' },
              { id: 'CUSTOM', label: 'Custom Range' }
            ].map(tab => (
              <Button
                key={tab.id}
                variant="ghost"
                size="sm"
                onClick={() => setPeriodTab(tab.id as any)}
                className={cn(
                  "rounded-xl text-xs font-bold h-8 px-3 cursor-pointer transition-all",
                  periodTab === tab.id 
                    ? "bg-slate-900 text-white hover:bg-slate-800 shadow-xs" 
                    : "text-slate-600 hover:bg-slate-100"
                )}
              >
                {tab.label}
              </Button>
            ))}
          </div>

          <div className="text-xs font-bold text-slate-500">
            Showing <span className="text-slate-900 font-extrabold">{records.length}</span> of {totalRecordsCount} records
          </div>
        </div>

        {/* Custom Date / Month / Range Row if periodTab === 'CUSTOM' */}
        {periodTab === 'CUSTOM' && (
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/60 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-in fade-in duration-200">
            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-slate-600">Specific Date</Label>
              <Input 
                type="date"
                value={customDate}
                onChange={e => {
                  setCustomDate(e.target.value);
                  setCustomMonth('');
                  setCustomYear('');
                  setStartDate('');
                  setEndDate('');
                }}
                className="h-9 text-xs rounded-xl bg-white border-slate-200 font-medium"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-slate-600">Specific Month</Label>
              <Input 
                type="month"
                value={customMonth}
                onChange={e => {
                  setCustomMonth(e.target.value);
                  setCustomDate('');
                  setCustomYear('');
                  setStartDate('');
                  setEndDate('');
                }}
                className="h-9 text-xs rounded-xl bg-white border-slate-200 font-medium"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-slate-600">Start Date</Label>
              <Input 
                type="date"
                value={startDate}
                onChange={e => {
                  setStartDate(e.target.value);
                  setCustomDate('');
                  setCustomMonth('');
                  setCustomYear('');
                }}
                className="h-9 text-xs rounded-xl bg-white border-slate-200 font-medium"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-slate-600">End Date</Label>
              <Input 
                type="date"
                value={endDate}
                onChange={e => {
                  setEndDate(e.target.value);
                  setCustomDate('');
                  setCustomMonth('');
                  setCustomYear('');
                }}
                className="h-9 text-xs rounded-xl bg-white border-slate-200 font-medium"
              />
            </div>
          </div>
        )}

        {/* Filter Selectors Bar */}
        <div className={cn("grid gap-3", isElevated ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-3")}>
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder={isElevated ? "Search staff, repair #, device, component..." : "Search repair #, device, component..."}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-10 pl-9 rounded-xl border-slate-200 bg-slate-50/70 focus:bg-white text-xs font-medium"
            />
            {searchQuery && (
              <button 
                type="button" 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Staff Filter (Elevated Roles Only) */}
          {isElevated && (
            <div>
              <Select value={selectedStaffFilter} onValueChange={setSelectedStaffFilter}>
                <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-slate-50/70 text-xs font-bold">
                  <SelectValue placeholder="All Staff Members" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl shadow-xl max-h-60">
                  <SelectItem value="ALL" className="text-xs font-bold">All Staff Members</SelectItem>
                  {staffList.map(s => (
                    <SelectItem key={s.id} value={s.id} className="text-xs">
                      <span className="font-bold">{s.name}</span>
                      <span className="text-[10px] text-slate-400 ml-1.5">({s.role?.replace(/_/g, ' ')})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Component Filter */}
          <div>
            <Select value={selectedComponentFilter} onValueChange={setSelectedComponentFilter}>
              <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-slate-50/70 text-xs font-bold">
                <SelectValue placeholder="All Components" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl shadow-xl max-h-60">
                <SelectItem value="ALL" className="text-xs font-bold">All Components</SelectItem>
                {STANDARD_COMPONENTS.map(c => (
                  <SelectItem key={c} value={c} className="text-xs font-medium">{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Damage Type Filter */}
          <div>
            <Select value={selectedTypeFilter} onValueChange={setSelectedTypeFilter}>
              <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-slate-50/70 text-xs font-bold">
                <SelectValue placeholder="All Damage Types" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl shadow-xl max-h-60">
                <SelectItem value="ALL" className="text-xs font-bold">All Damage Types</SelectItem>
                {DAMAGE_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value} className="text-xs font-medium">{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Active Filter Badges */}
        {(searchQuery || selectedStaffFilter !== 'ALL' || selectedComponentFilter !== 'ALL' || selectedTypeFilter !== 'ALL' || periodTab !== 'ALL') && (
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <span className="text-[11px] font-bold text-slate-400">Active filters:</span>
            {searchQuery && (
              <Badge variant="secondary" className="text-[10px] font-bold gap-1 rounded-lg">
                Search: {searchQuery}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setSearchQuery('')} />
              </Badge>
            )}
            {selectedStaffFilter !== 'ALL' && (
              <Badge variant="secondary" className="text-[10px] font-bold gap-1 rounded-lg">
                Staff: {staffList.find(s => s.id === selectedStaffFilter)?.name || selectedStaffFilter}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedStaffFilter('ALL')} />
              </Badge>
            )}
            {selectedComponentFilter !== 'ALL' && (
              <Badge variant="secondary" className="text-[10px] font-bold gap-1 rounded-lg">
                Component: {selectedComponentFilter}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedComponentFilter('ALL')} />
              </Badge>
            )}
            {selectedTypeFilter !== 'ALL' && (
              <Badge variant="secondary" className="text-[10px] font-bold gap-1 rounded-lg">
                Type: {DAMAGE_TYPES.find(t => t.value === selectedTypeFilter)?.label || selectedTypeFilter}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedTypeFilter('ALL')} />
              </Badge>
            )}
            {periodTab !== 'ALL' && (
              <Badge variant="secondary" className="text-[10px] font-bold gap-1 rounded-lg">
                Period: {periodTab}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setPeriodTab('ALL')} />
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setSelectedStaffFilter('ALL');
                setSelectedComponentFilter('ALL');
                setSelectedTypeFilter('ALL');
                setPeriodTab('ALL');
                setCustomDate('');
                setCustomMonth('');
                setCustomYear('');
                setStartDate('');
                setEndDate('');
              }}
              className="h-6 text-[10px] font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 rounded-lg cursor-pointer"
            >
              Reset all filters
            </Button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 5. RECORDS LIST (RESPONSIVE CARDS) */}
      {/* ========================================================================= */}
      {loadingRecords ? (
        <div className="bg-white rounded-3xl border border-slate-200/70 p-12 text-center flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
          <p className="text-xs font-bold text-slate-500">Retrieving repair-related damage records...</p>
        </div>
      ) : records.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/70 p-12 text-center flex flex-col items-center justify-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shadow-2xs">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            {isElevated ? 'No Repair-Related Damage Records' : 'Zero Damage Incidents Recorded'}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm">
            {isElevated 
              ? 'No component or device damage reports found matching your current filter criteria.'
              : 'You have a clean repair record with no logged damage incidents matching current filters.'}
          </p>
          {canRecordDamage && (
            <Button
              onClick={() => setIsRecordModalOpen(true)}
              className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs h-9 px-4 mt-2 gap-1.5 shadow-md cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5 text-rose-400" />
              Record First Incident
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Responsive Card Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 sm:gap-4">
            {records.map((rec) => {
              const compBadgeClass = getComponentBadgeColor(rec.damagedComponent);
              return (
                <div 
                  key={rec.id}
                  className="bg-white rounded-3xl border border-slate-200/70 p-4 sm:p-5 hover:border-slate-300 hover:shadow-lg transition-all flex flex-col justify-between min-w-0 overflow-hidden group shadow-2xs space-y-4"
                >
                  {/* Top Bar: Record # & Date */}
                  <div className="flex items-start justify-between gap-2 min-w-0 pb-3 border-b border-slate-100">
                    <div className="min-w-0">
                      <span className="text-[11px] font-black tracking-wider text-slate-900 uppercase block font-mono truncate">
                        {rec.recordNumber}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3 text-slate-400 shrink-0" />
                        <span>{rec.damageDate} {rec.damageTime ? `• ${rec.damageTime}` : ''}</span>
                      </span>
                    </div>
                    
                    <Badge className={cn("text-[10px] font-extrabold px-2.5 py-0.5 rounded-lg shrink-0 border", compBadgeClass)}>
                      {rec.damagedComponent}
                    </Badge>
                  </div>

                  {/* Middle Content */}
                  <div className="space-y-2.5 min-w-0">
                    {/* Staff Person (Shown prominently for Elevated roles, or compact for personal) */}
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200/60 flex items-center justify-center text-slate-700 font-bold text-xs shrink-0">
                        {rec.staffName ? rec.staffName[0].toUpperCase() : 'S'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-extrabold text-slate-900 truncate" title={rec.staffName}>
                          {rec.staffName}
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">
                          {rec.staffRole?.replace(/_/g, ' ')}
                        </p>
                      </div>
                    </div>

                    {/* Device & Repair Reference */}
                    <div className="p-2.5 bg-slate-50/80 rounded-2xl border border-slate-200/60 space-y-1">
                      <div className="flex items-center justify-between text-xs min-w-0 gap-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Device:</span>
                        <span className="font-bold text-slate-800 truncate" title={`${rec.deviceBrand || ''} ${rec.deviceModel || ''}`.trim() || '—'}>
                          {rec.deviceBrand || rec.deviceModel ? `${rec.deviceBrand || ''} ${rec.deviceModel || ''}`.trim() : 'Unspecified Device'}
                        </span>
                      </div>
                      
                      {rec.repairNumber && (
                        <div className="flex items-center justify-between text-xs min-w-0 gap-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Repair:</span>
                          <span className="font-mono font-bold text-indigo-600 truncate">
                            #{rec.repairNumber}
                          </span>
                        </div>
                      )}

                      {rec.estimatedCost !== null && rec.estimatedCost !== undefined && (
                        <div className="flex items-center justify-between text-xs min-w-0 gap-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Est. Cost:</span>
                          <span className="font-extrabold text-emerald-700 truncate">
                            NPR {rec.estimatedCost.toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Incident Summary */}
                    <p className="text-xs text-slate-600 font-medium line-clamp-2 leading-relaxed bg-white" title={rec.damageDescription}>
                      {rec.damageDescription}
                    </p>
                  </div>

                  {/* Bottom Actions Bar */}
                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 shrink-0">
                    <div className="min-w-0 flex items-center gap-1 text-[10px] text-slate-400 truncate">
                      <span className="truncate">By: <b className="text-slate-600">{rec.recordedByName || 'Manager'}</b></span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenDetails(rec)}
                        className="h-8 px-2.5 rounded-xl text-xs font-bold text-indigo-600 hover:bg-indigo-50 cursor-pointer gap-1"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Details</span>
                      </Button>

                      {canEditOrDelete && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(rec)}
                            className="h-8 w-8 p-0 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                            title="Edit Record"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDelete(rec)}
                            className="h-8 w-8 p-0 rounded-xl text-rose-500 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                            title="Archive Record"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. RECORD DAMAGE DIALOG (MANAGER / ADMIN / SUPER ADMIN) */}
      {/* ========================================================================= */}
      <Dialog open={isRecordModalOpen} onOpenChange={setIsRecordModalOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:w-full max-w-2xl rounded-3xl p-0 border border-slate-200 shadow-2xl overflow-hidden bg-white max-h-[90vh] flex flex-col">
          <DialogHeader className="p-6 pb-4 bg-slate-900 text-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-600/30 border border-rose-400/30 text-rose-400 flex items-center justify-center">
                <FileWarning className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl sm:text-2xl font-black text-white">Record Repair-Related Damage</DialogTitle>
                <DialogDescription className="font-medium text-slate-400 text-xs mt-0.5">
                  Document component or device damage incident occurring during repair handling
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleCreateDamage} className="flex flex-col flex-1 overflow-hidden">
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Staff Selector */}
              <div className="space-y-1.5">
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
              <div className="space-y-1.5 relative">
                <div className="flex items-center justify-between">
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
                    className="h-11 rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-xs font-medium"
                  />
                  {searchingRepairs && (
                    <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-400" />
                  )}
                </div>

                {/* Repair Results Dropdown */}
                {repairSearchResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 overflow-hidden divide-y divide-slate-100 max-h-52 overflow-y-auto">
                    {repairSearchResults.map(r => (
                      <div 
                        key={r.id}
                        onClick={() => selectRepairForDamage(r)}
                        className="p-3 hover:bg-slate-50 cursor-pointer flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-bold text-slate-900 font-mono">#{r.repairNumber} • {r.deviceBrand} {r.deviceModel}</p>
                          <p className="text-[10px] text-slate-500">{r.customerName} ({r.customerPhone})</p>
                        </div>
                        <Badge variant="outline" className="text-[10px] font-bold">Select</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Device Auto-Filled / Manual specs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Device Brand</Label>
                  <Input 
                    placeholder="e.g. Samsung, Apple, Xiaomi"
                    value={formData.deviceBrand}
                    onChange={e => setFormData({ ...formData, deviceBrand: e.target.value })}
                    className="h-11 rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-xs font-medium"
                  />
                </div>
                <div className="space-y-1.5">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
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

                <div className="space-y-1.5">
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
              <div className="space-y-1.5">
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
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Damage Date *</Label>
                  <Input 
                    type="date"
                    value={formData.damageDate}
                    onChange={e => setFormData({ ...formData, damageDate: e.target.value })}
                    className="h-10 rounded-xl border-slate-200 bg-slate-50 text-xs font-medium"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Damage Time</Label>
                  <Input 
                    type="time"
                    value={formData.damageTime}
                    onChange={e => setFormData({ ...formData, damageTime: e.target.value })}
                    className="h-10 rounded-xl border-slate-200 bg-slate-50 text-xs font-medium"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Quantity</Label>
                  <Input 
                    type="number"
                    min={1}
                    value={formData.quantity}
                    onChange={e => setFormData({ ...formData, quantity: parseInt(e.target.value, 10) || 1 })}
                    className="h-10 rounded-xl border-slate-200 bg-slate-50 text-xs font-medium"
                  />
                </div>
                <div className="space-y-1.5">
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
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-indigo-600" />
                    <span className="text-xs font-bold text-slate-900">Inventory Hub Integration</span>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={formData.deductInventory}
                      onChange={e => setFormData({ ...formData, deductInventory: e.target.checked })}
                      className="rounded text-indigo-600"
                    />
                    <span>Deduct Damaged Spare Part (-1)</span>
                  </label>
                </div>

                {formData.deductInventory && (
                  <div className="space-y-1.5 pt-1">
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
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Internal Remarks / Notes</Label>
                <Input 
                  placeholder="Additional supervisor notes or replacement arrangement details..."
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className="h-10 rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-xs font-medium"
                />
              </div>
            </div>

            <DialogFooter className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsRecordModalOpen(false)}
                className="rounded-xl text-xs font-bold text-slate-500 cursor-pointer"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="rounded-xl h-11 px-6 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-md cursor-pointer"
                disabled={submitting}
              >
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileWarning className="mr-2 h-4 w-4 text-rose-400" />}
                Submit Damage Record
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 7. VIEW DAMAGE DETAILS MODAL */}
      {/* ========================================================================= */}
      <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:w-full max-w-xl rounded-3xl p-0 border border-slate-200 shadow-2xl overflow-hidden bg-white max-h-[90vh] flex flex-col">
          <DialogHeader className="p-6 pb-4 bg-slate-900 text-white shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-600/30 border border-rose-400/30 text-rose-400 flex items-center justify-center font-bold">
                  <FileWarning className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-black text-white">Repair-Related Damage Details</DialogTitle>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{selectedRecord?.recordNumber}</p>
                </div>
              </div>

              {selectedRecord?.status && (
                <Badge className="bg-emerald-600 text-white text-[10px] font-black border-transparent">
                  {selectedRecord.status}
                </Badge>
              )}
            </div>
          </DialogHeader>

          <div className="p-6 space-y-5 overflow-y-auto flex-1">
            {recordDetailsLoading ? (
              <div className="py-12 text-center flex flex-col items-center justify-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                <p className="text-xs text-slate-500 font-medium">Loading record details and audit history...</p>
              </div>
            ) : selectedRecord ? (
              <>
                {/* Staff & Incident Core */}
                <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200/60 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Responsible Staff</span>
                    <span className="font-extrabold text-slate-900 text-sm">{selectedRecord.staffName}</span>
                    <span className="text-[10px] text-slate-500 block">({selectedRecord.staffRole?.replace(/_/g, ' ')})</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Damaged Component</span>
                    <span className="font-extrabold text-rose-600 text-sm">{selectedRecord.damagedComponent}</span>
                    <span className="text-[10px] text-slate-500 block">{selectedRecord.damageType || 'Incident'}</span>
                  </div>
                </div>

                {/* Device & Repair Details */}
                <div className="space-y-2 text-xs">
                  <h4 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Device & Repair Context</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 bg-white rounded-2xl border border-slate-200">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block">Device Model</span>
                      <span className="font-bold text-slate-900">
                        {selectedRecord.deviceBrand || selectedRecord.deviceModel 
                          ? `${selectedRecord.deviceBrand || ''} ${selectedRecord.deviceModel || ''}`.trim() 
                          : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block">Repair Job #</span>
                      <span className="font-mono font-bold text-indigo-600">
                        {selectedRecord.repairNumber ? `#${selectedRecord.repairNumber}` : 'Unlinked'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block">Estimated Cost</span>
                      <span className="font-bold text-emerald-700">
                        {selectedRecord.estimatedCost !== null && selectedRecord.estimatedCost !== undefined ? `NPR ${selectedRecord.estimatedCost.toLocaleString()}` : '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5 text-xs">
                  <h4 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Incident Description</h4>
                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/70 text-slate-700 font-medium leading-relaxed">
                    {selectedRecord.damageDescription}
                  </div>
                </div>

                {/* Date, Recorded By & Notes */}
                <div className="grid grid-cols-2 gap-3 text-xs p-3.5 bg-slate-50 rounded-2xl border border-slate-200/60">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block">Date & Time</span>
                    <span className="font-bold text-slate-800">
                      {selectedRecord.damageDate} {selectedRecord.damageTime ? `• ${selectedRecord.damageTime}` : ''}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block">Recorded By</span>
                    <span className="font-bold text-slate-800">
                      {selectedRecord.recordedByName} ({selectedRecord.recordedByRole?.replace(/_/g, ' ')})
                    </span>
                  </div>
                </div>

                {selectedRecord.notes && (
                  <div className="space-y-1 text-xs">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Internal Notes</span>
                    <p className="text-slate-600 italic bg-slate-50 p-3 rounded-xl border border-slate-200/50">
                      "{selectedRecord.notes}"
                    </p>
                  </div>
                )}

                {/* Audit Trail */}
                {selectedRecord.audits && selectedRecord.audits.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <h4 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <History className="h-3.5 w-3.5" />
                      Traceable Audit History
                    </h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {selectedRecord.audits.map((log: any) => (
                        <div key={log.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/60 text-[11px] space-y-0.5">
                          <div className="flex items-center justify-between font-bold text-slate-800">
                            <span>{log.action}</span>
                            <span className="text-[10px] text-slate-400 font-normal">
                              {format(new Date(log.createdAt), 'dd MMM yyyy, HH:mm')}
                            </span>
                          </div>
                          <p className="text-slate-500">
                            By <b className="text-slate-700">{log.performedByName}</b> ({log.performedByRole?.replace(/_/g, ' ')}) • {log.reason || 'No remarks'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>

          <DialogFooter className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDetailsModalOpen(false)}
              className="rounded-xl text-xs font-bold text-slate-700 cursor-pointer"
            >
              Close
            </Button>

            {canEditOrDelete && selectedRecord && (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDetailsModalOpen(false);
                    handleOpenEdit(selectedRecord);
                  }}
                  className="rounded-xl text-xs font-bold text-slate-700 cursor-pointer gap-1.5"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Edit
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 8. EDIT DAMAGE RECORD MODAL (ADMIN / SUPER ADMIN ONLY) */}
      {/* ========================================================================= */}
      {canEditOrDelete && (
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="w-[calc(100vw-1.5rem)] sm:w-full max-w-xl rounded-3xl p-0 border border-slate-200 shadow-2xl overflow-hidden bg-white max-h-[90vh] flex flex-col">
            <DialogHeader className="p-6 pb-4 bg-slate-900 text-white shrink-0">
              <DialogTitle className="text-xl font-black text-white">Edit Repair-Related Damage Record</DialogTitle>
              <DialogDescription className="font-medium text-slate-400 text-xs mt-0.5">
                Modify record parameters with mandatory audit tracking
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleUpdateDamage} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
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

                  <div className="space-y-1.5">
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

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Damage Description *</Label>
                  <Textarea 
                    rows={3}
                    value={editFormData.damageDescription}
                    onChange={e => setEditFormData({ ...editFormData, damageDescription: e.target.value })}
                    className="rounded-xl border-slate-200 text-xs font-medium resize-none"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">Date</Label>
                    <Input 
                      type="date"
                      value={editFormData.damageDate}
                      onChange={e => setEditFormData({ ...editFormData, damageDate: e.target.value })}
                      className="h-10 rounded-xl border-slate-200 text-xs font-medium"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">Time</Label>
                    <Input 
                      type="time"
                      value={editFormData.damageTime}
                      onChange={e => setEditFormData({ ...editFormData, damageTime: e.target.value })}
                      className="h-10 rounded-xl border-slate-200 text-xs font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">Est. Cost (NPR)</Label>
                    <Input 
                      type="number"
                      value={editFormData.estimatedCost}
                      onChange={e => setEditFormData({ ...editFormData, estimatedCost: e.target.value })}
                      className="h-10 rounded-xl border-slate-200 text-xs font-medium"
                    />
                  </div>
                  <div className="space-y-1.5">
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

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Audit Change Reason *</Label>
                  <Input 
                    placeholder="Reason for modifying this damage record (mandatory audit note)..."
                    value={editFormData.auditReason}
                    onChange={e => setEditFormData({ ...editFormData, auditReason: e.target.value })}
                    className="h-10 rounded-xl border-slate-200 text-xs font-medium"
                  />
                </div>
              </div>

              <DialogFooter className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsEditModalOpen(false)}
                  className="rounded-xl text-xs font-bold text-slate-500 cursor-pointer"
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
      )}

      {/* ========================================================================= */}
      {/* 9. DELETE / ARCHIVE CONFIRMATION DIALOG (ADMIN / SUPER ADMIN ONLY) */}
      {/* ========================================================================= */}
      {canEditOrDelete && (
        <AlertDialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
          <AlertDialogContent className="w-[calc(100vw-1.5rem)] sm:w-full max-w-md rounded-3xl p-6 border border-slate-200 shadow-2xl bg-white space-y-4">
            <AlertDialogHeader>
              <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shadow-2xs shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <AlertDialogTitle className="text-lg font-bold text-slate-900">
                Archive Damage Record?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-slate-500 leading-relaxed">
                This record (<span className="font-mono font-bold text-slate-800">{selectedRecord?.recordNumber}</span>) will be safely removed from active views and archived with an immutable audit log.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <AlertDialogFooter className="flex items-center justify-between gap-2 pt-2">
              <AlertDialogCancel className="rounded-xl text-xs font-bold text-slate-600 border-slate-200 cursor-pointer">
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
      )}
    </div>
  );
}
