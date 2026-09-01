import React, { useState, useEffect, useCallback } from 'react';
import { 
  FileWarning, 
  Plus, 
  Download, 
  Info,
  Loader2, 
  CheckCircle2, 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { useRealtimeSync } from '@/services/realtime';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import DashboardRefreshButton from '@/components/DashboardRefreshButton';

import { DamageRecord, DamageOverviewStats } from '@/components/repair-damage/types';
import { DamageOverviewCards } from '@/components/repair-damage/DamageOverviewCards';
import { DamageFilters } from '@/components/repair-damage/DamageFilters';
import { DamageCard } from '@/components/repair-damage/DamageCard';
import { DamageTableView } from '@/components/repair-damage/DamageTableView';
import { RecordDamageDialog } from '@/components/repair-damage/RecordDamageDialog';
import { DamageDetailsDialog } from '@/components/repair-damage/DamageDetailsDialog';
import { EditDamageDialog } from '@/components/repair-damage/EditDamageDialog';
import { ArchiveDamageDialog } from '@/components/repair-damage/ArchiveDamageDialog';

export default function RepairRelatedDamage() {
  const { user } = useAuthStore();

  const userRole = user?.role || 'TECHNICIAN';
  const isSuperAdmin = userRole === 'SUPER_ADMIN';
  const isAdmin = userRole === 'ADMIN';
  const isManager = userRole === 'MANAGER';
  const isElevated = isSuperAdmin || isAdmin || isManager;
  const canRecordDamage = isSuperAdmin || isAdmin || isManager;
  const canEditOrDelete = isSuperAdmin || isAdmin;

  // Overview Stats
  const [overviewStats, setOverviewStats] = useState<DamageOverviewStats | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);

  // Records list
  const [records, setRecords] = useState<DamageRecord[]>([]);
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

  // View Mode: 'grid' or 'table'
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Modals
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const [selectedRecord, setSelectedRecord] = useState<DamageRecord | null>(null);
  const [recordDetailsLoading, setRecordDetailsLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

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

  // Open Details Modal with Full Audit Log
  const handleOpenDetails = async (record: DamageRecord) => {
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
  const handleOpenEdit = (record: DamageRecord) => {
    if (!canEditOrDelete) {
      toast.error('Permission Denied: Only Admins can modify records.');
      return;
    }
    setSelectedRecord(record);
    setIsEditModalOpen(true);
  };

  // Open Delete / Archive Modal (Super Admin / Admin Only)
  const handleOpenDelete = (record: DamageRecord) => {
    if (!canEditOrDelete) {
      toast.error('Permission Denied: Only Admins can archive records.');
      return;
    }
    setSelectedRecord(record);
    setIsDeleteModalOpen(true);
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

  return (
    <div className="space-y-6 sm:space-y-8 pb-20 max-w-7xl mx-auto px-1 sm:px-2" id="repair-damage-dashboard">
      {/* ========================================================================= */}
      {/* 1. HEADER SECTION & ROLE BADGE */}
      {/* ========================================================================= */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 sm:p-6 lg:p-7 rounded-3xl border border-slate-200/70 shadow-xs">
        <div className="space-y-1.5 min-w-0 flex-1">
          <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100 shadow-2xs shrink-0">
              <FileWarning className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-slate-900 truncate">
                  {isElevated ? 'Repair-Related Damage Hub' : 'My Repair-Related Damage'}
                </h1>
                <Badge variant="outline" className={cn(
                  "text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border shrink-0",
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

        <div className="flex items-center gap-2.5 flex-wrap w-full md:w-auto shrink-0 justify-start sm:justify-end">
          <DashboardRefreshButton 
            onRefresh={async () => {
              await fetchOverviewStats();
              await fetchRecords();
            }} 
          />

          <Button
            type="button"
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
              type="button"
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
          <div className="space-y-0.5 min-w-0 flex-1">
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
      <DamageOverviewCards 
        stats={overviewStats} 
        loading={loadingOverview} 
        isElevated={isElevated} 
      />

      {/* ========================================================================= */}
      {/* 3. FILTERS, CHIPS & SEARCH */}
      {/* ========================================================================= */}
      <DamageFilters 
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedStaffFilter={selectedStaffFilter}
        setSelectedStaffFilter={setSelectedStaffFilter}
        selectedComponentFilter={selectedComponentFilter}
        setSelectedComponentFilter={setSelectedComponentFilter}
        selectedTypeFilter={selectedTypeFilter}
        setSelectedTypeFilter={setSelectedTypeFilter}
        periodTab={periodTab}
        setPeriodTab={setPeriodTab}
        customDate={customDate}
        setCustomDate={setCustomDate}
        customMonth={customMonth}
        setCustomMonth={setCustomMonth}
        customYear={customYear}
        setCustomYear={setCustomYear}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        staffList={staffList}
        isElevated={isElevated}
        totalRecordsCount={totalRecordsCount}
        filteredCount={records.length}
        componentBreakdown={overviewStats?.componentBreakdown}
        viewMode={viewMode}
        setViewMode={setViewMode}
      />

      {/* ========================================================================= */}
      {/* 4. RECORDS LIST (GRID OR TABLE VIEW) */}
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
              type="button"
              onClick={() => setIsRecordModalOpen(true)}
              className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs h-9 px-4 mt-2 gap-1.5 shadow-md cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5 text-rose-400" />
              Record First Incident
            </Button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        <DamageTableView 
          records={records}
          canEditOrDelete={canEditOrDelete}
          onViewDetails={handleOpenDetails}
          onEdit={handleOpenEdit}
          onDelete={handleOpenDelete}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 sm:gap-4" id="damage-cards-grid">
          {records.map((rec) => (
            <DamageCard 
              key={rec.id}
              record={rec}
              canEditOrDelete={canEditOrDelete}
              onViewDetails={handleOpenDetails}
              onEdit={handleOpenEdit}
              onDelete={handleOpenDelete}
            />
          ))}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. DIALOGS */}
      {/* ========================================================================= */}
      <RecordDamageDialog 
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        onSuccess={() => {
          fetchOverviewStats();
          fetchRecords();
        }}
        staffList={staffList}
        inventoryItems={inventoryItems}
      />

      <DamageDetailsDialog 
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        record={selectedRecord}
        loading={recordDetailsLoading}
        canEditOrDelete={canEditOrDelete}
        onEdit={handleOpenEdit}
      />

      {canEditOrDelete && (
        <>
          <EditDamageDialog 
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            onSuccess={() => {
              fetchOverviewStats();
              fetchRecords();
            }}
            record={selectedRecord}
          />

          <ArchiveDamageDialog 
            isOpen={isDeleteModalOpen}
            onClose={() => setIsDeleteModalOpen(false)}
            onSuccess={() => {
              fetchOverviewStats();
              fetchRecords();
            }}
            record={selectedRecord}
          />
        </>
      )}
    </div>
  );
}
