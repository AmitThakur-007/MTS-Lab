import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  Download,
  ChevronRight,
  User,
  Smartphone,
  Calendar,
  Clock,
  CircleCheck as CheckCircle2,
  AlertCircle,
  Truck,
  PackageCheck,
  Zap,
  Trash2,
  FileText,
  Loader2,
  Banknote,
  Wrench,
  Edit3,
  Phone,
  Mail,
  MapPin,
  RefreshCw,
  ArrowUpDown,
  Check,
  X,
  Eye,
  Layers,
  History,
  ShieldAlert,
  Printer,
  ChevronDown,
  Minus,
  FileSpreadsheet,
  Upload,
  FileDown,
  FileCheck2,
  RotateCcw,
  MessageSquare,
  Ban,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import {
  format,
  isToday,
  isYesterday,
  isThisWeek,
  isThisMonth,
  parseISO,
  startOfDay,
  endOfDay,
  subDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth
} from 'date-fns';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { api } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { useRepairCache } from '@/store/repairCache';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { generateRepairReport } from '@/services/reportService';
import { formatNPR, formatRepairCost, formatNepalPhone } from '@/lib/format';
import { useRealtimeSync } from '@/services/realtime';
import {
  isPendingStatus,
  isReceivedStatus,
  isInProgressStatus,
  isRepairedOrReadyStatus,
  isDeliveredStatus,
  isReProblemStatus,
  isCancelledStatus,
  calculateRepairMetrics,
  RepairDashboardMetrics
} from '@/lib/repairStatus';
import {
  matchesDatePreset,
  getNepalCalendarInfo,
  DateFilterPreset,
  toNepalDateString
} from '@/lib/nepalDate';
import DashboardRefreshButton from '@/components/DashboardRefreshButton';
import ServiceSlipModal from '@/components/repair/ServiceSlipModal';
import EditRepairModal from '@/components/repair/EditRepairModal';
import SendSmsModal from '@/components/repair/SendSmsModal';
import { Pagination } from '@/components/common/Pagination';
import { REPAIRS_PER_PAGE } from '@/lib/pagination';


// Status badge styling
const statusConfig: Record<string, { label: string; badgeClass: string; bgSoft: string; textClass: string }> = {
  PENDING: { label: 'Pending', badgeClass: 'bg-slate-100 text-slate-700 border-slate-300', bgSoft: 'bg-slate-50', textClass: 'text-slate-700' },
  RECEIVED: { label: 'Received', badgeClass: 'bg-amber-100 text-amber-800 border-amber-300', bgSoft: 'bg-amber-50', textClass: 'text-amber-700' },
  DIAGNOSING: { label: 'Diagnosing', badgeClass: 'bg-sky-100 text-sky-800 border-sky-300', bgSoft: 'bg-sky-50', textClass: 'text-sky-700' },
  IN_PROCESS: { label: 'In Progress', badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-300', bgSoft: 'bg-indigo-50', textClass: 'text-indigo-700' },
  WAITING_FOR_PARTS: { label: 'Waiting for Parts', badgeClass: 'bg-purple-100 text-purple-800 border-purple-300', bgSoft: 'bg-purple-50', textClass: 'text-purple-700' },
  TESTING: { label: 'Testing QA', badgeClass: 'bg-orange-100 text-orange-800 border-orange-300', bgSoft: 'bg-orange-50', textClass: 'text-orange-700' },
  REPAIRED: { label: 'Repaired', badgeClass: 'bg-teal-100 text-teal-800 border-teal-300', bgSoft: 'bg-teal-50', textClass: 'text-teal-700' },
  READY_FOR_PICKUP: { label: 'Ready for Pickup', badgeClass: 'bg-emerald-600 text-white border-transparent', bgSoft: 'bg-emerald-50', textClass: 'text-emerald-700' },
  DELIVERED: { label: 'Delivered', badgeClass: 'bg-slate-200 text-slate-800 border-slate-300', bgSoft: 'bg-slate-100', textClass: 'text-slate-800' },
  RE_PROBLEM: { label: 'Re-Problem (Warranty)', badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 font-bold', bgSoft: 'bg-rose-50', textClass: 'text-rose-700' },
  REPROBLEM: { label: 'Re-Problem (Warranty)', badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 font-bold', bgSoft: 'bg-rose-50', textClass: 'text-rose-700' },
  CANNOT_REPAIR: { label: 'Cannot Repair', badgeClass: 'bg-rose-100 text-rose-800 border-rose-300', bgSoft: 'bg-rose-50', textClass: 'text-rose-700' },
  CANCELLED: { label: 'Cancelled', badgeClass: 'bg-slate-200 text-slate-700 border-slate-300 font-bold', bgSoft: 'bg-slate-100', textClass: 'text-slate-700' }
};

type StatusTabKey = 'ALL' | 'PENDING' | 'RECEIVED' | 'IN_PROGRESS' | 'REPAIRED' | 'DELIVERED' | 'RE_PROBLEM' | 'CANCELLED';

export default function Repairs() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const cachedUserId = useRepairCache((state) => state.userId);
  const cachedRepairs = useRepairCache((state) => state.repairs);
  const cachedStaffList = useRepairCache((state) => state.staffList);
  const cachedFilters = useRepairCache((state) => state.filters);
  const setCachedRepairs = useRepairCache((state) => state.setRepairs);
  const setCachedStaffList = useRepairCache((state) => state.setStaffList);
  const setCachedFilters = useRepairCache((state) => state.setFilters);
  const isCacheStale = useRepairCache((state) => state.isStale);

  const isCacheValidForUser = Boolean(
    user?.id && cachedUserId === user.id && cachedRepairs && cachedRepairs.length > 0
  );

  const [repairs, setRepairs] = useState<any[]>(() => {
    return isCacheValidForUser ? cachedRepairs : [];
  });
  const [staffList, setStaffList] = useState<any[]>(() => {
    return isCacheValidForUser && cachedStaffList ? cachedStaffList : [];
  });
  const [loading, setLoading] = useState(() => {
    return !isCacheValidForUser;
  });

  // Filters state - preserve previous page state across navigation
  const [search, setSearch] = useState(() => (isCacheValidForUser ? cachedFilters.search : ''));
  const [activeStatusTab, setActiveStatusTab] = useState<StatusTabKey>(() =>
    isCacheValidForUser ? (cachedFilters.activeStatusTab as StatusTabKey) : 'ALL'
  );
  const [dateFilterPreset, setDateFilterPreset] = useState<DateFilterPreset>(() =>
    isCacheValidForUser ? (cachedFilters.dateFilterPreset as DateFilterPreset) : 'ALL'
  );
  const [customStartDate, setCustomStartDate] = useState(() =>
    isCacheValidForUser ? cachedFilters.customStartDate : ''
  );
  const [customEndDate, setCustomEndDate] = useState(() =>
    isCacheValidForUser ? cachedFilters.customEndDate : ''
  );
  const [selectedTechnicianFilter, setSelectedTechnicianFilter] = useState(() =>
    isCacheValidForUser ? cachedFilters.selectedTechnicianFilter : 'ALL'
  );
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'updated' | 'repairNumber' | 'customerName' | 'status'>(() =>
    isCacheValidForUser ? (cachedFilters.sortBy as any) : 'newest'
  );

  // Authoritative 40-record page state
  const [currentPage, setCurrentPage] = useState(() => (isCacheValidForUser ? cachedFilters.currentPage || 1 : 1));

  // Sync active filters to cache
  useEffect(() => {
    setCachedFilters({
      search,
      activeStatusTab,
      dateFilterPreset,
      customStartDate,
      customEndDate,
      selectedTechnicianFilter,
      sortBy,
      currentPage,
    });
  }, [
    search,
    activeStatusTab,
    dateFilterPreset,
    customStartDate,
    customEndDate,
    selectedTechnicianFilter,
    sortBy,
    currentPage,
    setCachedFilters,
  ]);

  // Reset pagination to page 1 ONLY when user actively changes filter or search (skip on initial mount)
  const isInitialFilterMount = React.useRef(true);
  useEffect(() => {
    if (isInitialFilterMount.current) {
      isInitialFilterMount.current = false;
      return;
    }
    setCurrentPage(1);
  }, [activeStatusTab, selectedTechnicianFilter, dateFilterPreset, customStartDate, customEndDate, search, sortBy]);

  // Navigate to repair details while preserving scroll position
  const navigateToRepair = (repairId: string) => {
    useRepairCache.getState().setScrollY(window.scrollY);
    navigate(`/dashboard/repairs/${repairId}`);
  };

  // Selection & Bulk Actions State
  const [selectedRepairIds, setSelectedRepairIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);

  // Modal states
  const [deleteRepairData, setDeleteRepairData] = useState<any | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [statusModalRepair, setStatusModalRepair] = useState<any | null>(null);
  const [newStatusValue, setNewStatusValue] = useState('');
  const [statusUpdateNote, setStatusUpdateNote] = useState('');
  const [statusUpdateLoading, setStatusUpdateLoading] = useState(false);

  const [assignModalRepair, setAssignModalRepair] = useState<any | null>(null);
  const [selectedTechId, setSelectedTechId] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);

  const [quickEditRepair, setQuickEditRepair] = useState<any | null>(null);
  const [editFormData, setEditFormData] = useState<any>({});
  const [editLoading, setEditLoading] = useState(false);

  const [viewDetailsModalRepair, setViewDetailsModalRepair] = useState<any | null>(null);
  const [selectedSlipRepair, setSelectedSlipRepair] = useState<any | null>(null);
  const [isSlipModalOpen, setIsSlipModalOpen] = useState(false);

  // Courier Dispatch & Re-Problem Modal States
  const [courierDispatchModalRepair, setCourierDispatchModalRepair] = useState<any | null>(null);
  const [courierDispatchForm, setCourierDispatchForm] = useState<any>({
    returnCourierCompany: 'Nepal Can Move (NCM)',
    customCourierCompany: '',
    returnCourierTrackingNumber: '',
    returnCourierDispatchDate: format(new Date(), 'yyyy-MM-dd'),
    destinationDistrict: 'Kathmandu',
    destinationAddress: '',
    receiverName: '',
    receiverPhone: '',
    returnCourierNotes: ''
  });
  const [courierDispatchLoading, setCourierDispatchLoading] = useState(false);

  const [reProblemModalRepair, setReProblemModalRepair] = useState<any | null>(null);
  const [reProblemReason, setReProblemReason] = useState('Customer reported recurring fault');
  const [reProblemDescription, setReProblemDescription] = useState('');
  const [reProblemLoading, setReProblemLoading] = useState(false);

  // Role permissions - Permanent deletion strictly restricted to SUPER_ADMIN ONLY
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isAdmin = user?.role === 'ADMIN' || isSuperAdmin;
  const isManager = user?.role === 'MANAGER';
  const isReceptionist = user?.role === 'RECEPTIONIST';
  const canDelete = isSuperAdmin;
  const canAssign = isSuperAdmin || isAdmin || isManager || isReceptionist;
  const canEdit = isSuperAdmin || isAdmin || isManager || isReceptionist;
  const canCreate = isSuperAdmin || isAdmin || isManager || isReceptionist;
  const canManageExcel = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST'].includes(user?.role || '');
  const canSendSms = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST'].includes(user?.role || '');
  const canCancel = isSuperAdmin || isAdmin || isManager || isReceptionist;

  // Cancellation Modal state
  const [cancelModalRepair, setCancelModalRepair] = useState<any | null>(null);
  const [cancellationReasonPreset, setCancellationReasonPreset] = useState('Customer cancelled / withdrew repair');
  const [cancellationCustomNotes, setCancellationCustomNotes] = useState('');
  const [cancellationLoading, setCancellationLoading] = useState(false);

  // Send Customer SMS Modal (Google Messages for Web)
  const [smsModalRepair, setSmsModalRepair] = useState<any | null>(null);
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);

  // Instant update handler for SMS status without needing page reload
  const handleSmsSuccess = (record?: any) => {
    if (!record) {
      fetchData(true);
      return;
    }
    const repairId = record.repairId;
    const repairNum = record.repairNumber;
    setRepairs((prev) =>
      prev.map((r) => {
        if (r.id === repairId || r.repairNumber === repairNum) {
          const prevSummary = r.smsSummary || { count: 0, totalAttempts: 0 };
          const isSent = record.status === 'SENT';
          const newSentCount = isSent
            ? (prevSummary.status === 'SENT' ? (prevSummary.count || 0) : (prevSummary.count || 0) + 1)
            : (prevSummary.count || 0);

          return {
            ...r,
            smsSummary: {
              ...prevSummary,
              repairId: r.id,
              repairNumber: r.repairNumber,
              status: isSent ? 'SENT' : (prevSummary.status === 'SENT' ? 'SENT' : 'INITIATED'),
              count: newSentCount,
              totalAttempts: (prevSummary.totalAttempts || 0) + 1,
              lastSentAt: record.sentAt || record.confirmedAt || record.createdAt || new Date().toISOString(),
              lastChannel: record.channel,
              lastStaffName: record.senderStaffName,
              lastRecordId: record.id,
            },
          };
        }
        return r;
      })
    );
  };

  // Excel Import / Export state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [confirmingImport, setConfirmingImport] = useState(false);

  // Technicians list for assignment
  const technicians = useMemo(() => {
    return staffList.filter((s: any) => s.role === 'TECHNICIAN' && s.isActive !== false);
  }, [staffList]);

  // Export Repairs Excel Handler
  const handleExportExcel = async () => {
    if (!canManageExcel) {
      toast.error("You are not authorized to export repair records.");
      return;
    }

    setExportingExcel(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.append('search', search.trim());
      if (activeStatusTab !== 'ALL') params.append('status', activeStatusTab);
      if (selectedTechnicianFilter !== 'ALL') params.append('technicianId', selectedTechnicianFilter);
      if (dateFilterPreset !== 'ALL') {
        params.append('preset', dateFilterPreset);
        if (dateFilterPreset === 'CUSTOM') {
          if (customStartDate) params.append('startDate', customStartDate);
          if (customEndDate) params.append('endDate', customEndDate);
        }
      }

      const filename = `MTS_Lab_Repairs_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      await api.download(`/repairs/export?${params.toString()}`, filename);

      toast.success("Excel repair records exported successfully.");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to export repair records.");
    } finally {
      setExportingExcel(false);
    }
  };

  // Download Template Handler
  const handleDownloadTemplate = async () => {
    if (!canManageExcel) {
      toast.error("You are not authorized to download repair template.");
      return;
    }

    setDownloadingTemplate(true);
    try {
      await api.download('/repairs/import/template', 'MTS_Lab_Repair_Import_Template.xlsx');
      toast.success("Blank repair Excel template downloaded.");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to download repair template.");
    } finally {
      setDownloadingTemplate(false);
    }
  };

  // File Select and Generate Preview Handler
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error("Please upload a valid Excel (.xlsx) file.");
      return;
    }

    setImportFile(file);
    await handleGeneratePreview(file);
  };

  const handleGeneratePreview = async (file: File) => {
    setPreviewLoading(true);
    setPreviewData(null);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res: any = await api.post('/repairs/import/preview', formData);
      if (!res || (!res.success && !res.items)) {
        throw new Error(res?.error || 'Failed to analyze Excel file');
      }

      setPreviewData(res);
      toast.info(`Analyzed ${res.totalRows} rows: ${res.validRows} valid, ${res.invalidRows} invalid, ${res.duplicateRows} duplicate.`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to analyze Excel file.");
    } finally {
      setPreviewLoading(false);
    }
  };

  // Confirm and Execute Import Handler
  const handleExecuteConfirmImport = async () => {
    if (!previewData || !previewData.items || previewData.validRows === 0) {
      toast.error("No valid records available to import.");
      return;
    }

    const validItems = previewData.items.filter((i: any) => i.status === 'VALID');
    if (validItems.length === 0) {
      toast.error("No valid records to import.");
      return;
    }

    setConfirmingImport(true);
    try {
      const res: any = await api.post('/repairs/import/confirm', {
        items: validItems
      });

      toast.success(res.message || `Successfully imported ${res.importedCount} repair records.`);
      setIsImportModalOpen(false);
      setImportFile(null);
      setPreviewData(null);
      await fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to import repair records.");
    } finally {
      setConfirmingImport(false);
    }
  };

  // Fetch all repair records and staff from the real database with SWR background revalidation
  const fetchData = useCallback(async (isBackground = false) => {
    const hasCached = isCacheValidForUser || (cachedRepairs && cachedRepairs.length > 0);
    if (!isBackground && !hasCached) {
      setLoading(true);
    }
    try {
      const [repairRes, staffRes] = await Promise.all([
        api.get('/repairs'),
        api.get('/staff').catch(() => [])
      ]);
      const repairList = Array.isArray(repairRes) ? repairRes : [];
      const staffListData = Array.isArray(staffRes) ? staffRes : [];
      setRepairs(repairList);
      setStaffList(staffListData);
      setCachedRepairs(repairList, user?.id || null);
      setCachedStaffList(staffListData);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch repair records');
      console.error(err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [isCacheValidForUser, cachedRepairs, setCachedRepairs, setCachedStaffList, user?.id]);

  useEffect(() => {
    if (!isCacheValidForUser) {
      fetchData(false);
    } else if (isCacheStale(user?.id, 3 * 60 * 1000)) {
      fetchData(true);
    }
  }, [fetchData, isCacheValidForUser, isCacheStale, user?.id]);

  // Real-Time Event Sync across all user roles via singleton realtime hook
  useRealtimeSync(
    ['repair', 'repairs', 'repairlog', 'techniciannote', 'payment', 'repairtransferrequest'],
    () => {
      fetchData(true);
    }
  );

  // Authoritative Nepal Standard Time (Asia/Kathmandu) calendar bounds
  const nepalCalInfo = useMemo(() => getNepalCalendarInfo(), []);

  // Validation for custom date range
  const customRangeError = useMemo(() => {
    if (dateFilterPreset !== 'CUSTOM') return null;
    if (customStartDate && customEndDate && customStartDate > customEndDate) {
      return `Start date (${customStartDate}) cannot be after end date (${customEndDate}). Please adjust your date range.`;
    }
    return null;
  }, [dateFilterPreset, customStartDate, customEndDate]);

  // Date filtering logic strictly calculated using Nepal Standard Time (Asia/Kathmandu)
  const dateFilteredRepairs = useMemo(() => {
    if (customRangeError) return [];
    if (dateFilterPreset === 'ALL') return repairs;
    return repairs.filter(r => matchesDatePreset(r.createdAt, dateFilterPreset, customStartDate, customEndDate, nepalCalInfo));
  }, [repairs, dateFilterPreset, customStartDate, customEndDate, nepalCalInfo, customRangeError]);

  // Summary Metrics strictly derived from the currently active date filter
  const metrics = useMemo(() => {
    return calculateRepairMetrics(dateFilteredRepairs);
  }, [dateFilteredRepairs]);

  // Status Tab filtering logic
  const statusFilteredRepairs = useMemo(() => {
    // All Jobs view strictly excludes cancelled devices
    if (activeStatusTab === 'ALL') {
      return dateFilteredRepairs.filter(r => !isCancelledStatus(r.status));
    }
    if (activeStatusTab === 'PENDING') {
      return dateFilteredRepairs.filter(r => isPendingStatus(r.status));
    }
    if (activeStatusTab === 'RECEIVED') {
      return dateFilteredRepairs.filter(r => isReceivedStatus(r.status));
    }
    if (activeStatusTab === 'IN_PROGRESS') {
      return dateFilteredRepairs.filter(r => isInProgressStatus(r.status));
    }
    if (activeStatusTab === 'REPAIRED') {
      return dateFilteredRepairs.filter(r => isRepairedOrReadyStatus(r.status));
    }
    if (activeStatusTab === 'DELIVERED') {
      return dateFilteredRepairs.filter(r => isDeliveredStatus(r.status));
    }
    if (activeStatusTab === 'RE_PROBLEM') {
      return dateFilteredRepairs.filter(r => isReProblemStatus(r.status));
    }
    if (activeStatusTab === 'CANCELLED') {
      return dateFilteredRepairs.filter(r => isCancelledStatus(r.status));
    }
    return dateFilteredRepairs.filter(r => !isCancelledStatus(r.status));
  }, [dateFilteredRepairs, activeStatusTab]);

  // Technician filtering logic
  const technicianFilteredRepairs = useMemo(() => {
    if (selectedTechnicianFilter === 'ALL') return statusFilteredRepairs;
    if (selectedTechnicianFilter === 'UNASSIGNED') {
      return statusFilteredRepairs.filter(r => !r.technicianId && !r.technician);
    }
    return statusFilteredRepairs.filter(r => r.technicianId === selectedTechnicianFilter || r.technician?.id === selectedTechnicianFilter);
  }, [statusFilteredRepairs, selectedTechnicianFilter]);

  // Search & Sorting filter
  const finalFilteredRepairs = useMemo(() => {
    let result = [...technicianFilteredRepairs];

    // Fast search across repair number, customer name, phone, device model, brand, problem, technician
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(r =>
        (r.repairNumber && String(r.repairNumber).toLowerCase().includes(q)) ||
        (r.customerId && String(r.customerId).toLowerCase().includes(q)) ||
        (r.customer?.customerId && String(r.customer.customerId).toLowerCase().includes(q)) ||
        (r.customerName && r.customerName.toLowerCase().includes(q)) ||
        (r.customerPhone && r.customerPhone.includes(q)) ||
        (r.customerEmail && r.customerEmail.toLowerCase().includes(q)) ||
        (r.deviceBrand && r.deviceBrand.toLowerCase().includes(q)) ||
        (r.deviceModel && r.deviceModel.toLowerCase().includes(q)) ||
        (r.problemDescription && r.problemDescription.toLowerCase().includes(q)) ||
        (r.technician?.name && r.technician.name.toLowerCase().includes(q))
      );
    }

    // Sort order
    result.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }
      if (sortBy === 'oldest') {
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      }
      if (sortBy === 'updated') {
        return new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime();
      }
      if (sortBy === 'repairNumber') {
        return String(b.repairNumber || '').localeCompare(String(a.repairNumber || ''), undefined, { numeric: true });
      }
      if (sortBy === 'customerName') {
        return (a.customerName || '').localeCompare(b.customerName || '');
      }
      if (sortBy === 'status') {
        return (a.status || '').localeCompare(b.status || '');
      }
      return 0;
    });

    return result;
  }, [technicianFilteredRepairs, search, sortBy]);

  // Global 40-record page bounds calculation
  const totalFilteredCount = finalFilteredRepairs.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredCount / REPAIRS_PER_PAGE));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedRepairs = useMemo(() => {
    const start = (safeCurrentPage - 1) * REPAIRS_PER_PAGE;
    return finalFilteredRepairs.slice(start, start + REPAIRS_PER_PAGE);
  }, [finalFilteredRepairs, safeCurrentPage]);

  // Visible / displayed repair IDs on the currently active page
  const visibleRepairIds = useMemo(() => paginatedRepairs.map(r => r.id), [paginatedRepairs]);
  const isAllVisibleSelected = visibleRepairIds.length > 0 && visibleRepairIds.every(id => selectedRepairIds.has(id));
  const isSomeVisibleSelected = visibleRepairIds.some(id => selectedRepairIds.has(id));

  // Selected repairs list for confirmation modal display
  const selectedRepairsList = useMemo(() => {
    return repairs.filter(r => selectedRepairIds.has(r.id));
  }, [repairs, selectedRepairIds]);


  // Selection Handlers
  const handleToggleSelectRepair = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedRepairIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (isAllVisibleSelected) {
      setSelectedRepairIds(prev => {
        const next = new Set(prev);
        visibleRepairIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelectedRepairIds(prev => {
        const next = new Set(prev);
        visibleRepairIds.forEach(id => next.add(id));
        return next;
      });
    }
  };

  const handleClearSelection = () => {
    setSelectedRepairIds(new Set());
  };

  // Handlers for Modals & Actions

  // 1. Single Delete Repair (Authorized for SUPER_ADMIN, ADMIN & RECEPTIONIST)
  const handleDeleteRepair = async () => {
    if (!deleteRepairData || !canDelete) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/repairs/${deleteRepairData.id}`);
      toast.success(`Repair #${deleteRepairData.repairNumber} deleted successfully.`);
      setRepairs(prev => prev.filter(r => r.id !== deleteRepairData.id));
      setSelectedRepairIds(prev => {
        const next = new Set(prev);
        next.delete(deleteRepairData.id);
        return next;
      });
      setDeleteRepairData(null);
    } catch (err: any) {
      console.error('[DELETE ERROR]', err);
      toast.error(err.message || 'Unable to delete the selected repair. Please try again.');
    } finally {
      setDeleteLoading(false);
    }
  };

  // 2. Bulk Delete Execution (Authorized for SUPER_ADMIN, ADMIN & RECEPTIONIST)
  const handleBulkDeleteRepairs = async () => {
    if (selectedRepairIds.size === 0 || !canDelete) return;
    setBulkDeleteLoading(true);
    const idsToDelete = Array.from(selectedRepairIds);

    try {
      const res = await api.post('/repairs/bulk-delete', { ids: idsToDelete });

      toast.success(res?.message || `Successfully deleted ${idsToDelete.length} repair record(s).`);
      setRepairs(prev => prev.filter(r => !selectedRepairIds.has(r.id)));
      setSelectedRepairIds(new Set());
      setIsBulkDeleteModalOpen(false);
    } catch (err: any) {
      console.error('[BULK DELETE ERROR]', err);
      toast.error(err?.message || 'Unable to delete the selected repair(s). Please try again.');
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  // 2. Status Update
  const handleOpenStatusModal = (repair: any) => {
    setStatusModalRepair(repair);
    setNewStatusValue(repair.status || 'RECEIVED');
    setStatusUpdateNote('');
  };

  const handleOpenCancelModal = (repair: any) => {
    setCancelModalRepair(repair);
    setCancellationReasonPreset('Customer cancelled / withdrew repair');
    setCancellationCustomNotes('');
  };

  const handleConfirmCancellation = async () => {
    if (!cancelModalRepair) return;
    setCancellationLoading(true);
    try {
      const response: any = await api.post(`/repairs/${cancelModalRepair.id}/cancel`, {
        reason: cancellationReasonPreset,
        remarks: cancellationCustomNotes.trim()
      });

      const updated = response?.repair || response;
      toast.success(`Repair #${cancelModalRepair.repairNumber} marked as Cancelled`);
      setRepairs(prev => prev.map(r => r.id === cancelModalRepair.id ? { ...r, ...updated, status: 'CANCELLED' } : r));
      setCancelModalRepair(null);
    } catch (err: any) {
      console.error('[CANCEL REPAIR ERROR]', err);
      toast.error(err?.message || 'Failed to cancel repair');
    } finally {
      setCancellationLoading(false);
    }
  };

  const handleReopenCancelledRepair = async (repair: any) => {
    try {
      const response: any = await api.post(`/repairs/${repair.id}/reopen`, {
        targetStatus: 'PENDING',
        note: 'Restored from Cancelled list'
      });
      const updated = response?.repair || response;
      toast.success(`Repair #${repair.repairNumber} restored to Pending`);
      setRepairs(prev => prev.map(r => r.id === repair.id ? { ...r, ...updated, status: 'PENDING' } : r));
    } catch (err: any) {
      toast.error(err?.message || 'Failed to restore repair');
    }
  };

  const handleSaveStatusUpdate = async () => {
    if (!statusModalRepair || !newStatusValue) return;

    // Intercept CANCELLED to invoke the professional cancellation dialog
    if (newStatusValue === 'CANCELLED') {
      const targetRepair = statusModalRepair;
      setStatusModalRepair(null);
      handleOpenCancelModal(targetRepair);
      return;
    }

    setStatusUpdateLoading(true);
    try {
      const payload: any = { status: newStatusValue };
      if (statusUpdateNote.trim()) {
        payload.note = statusUpdateNote.trim();
      }
      const updated = await api.patch(`/repairs/${statusModalRepair.id}`, payload);
      toast.success(`Status updated to ${newStatusValue.replace(/_/g, ' ')}`);
      setRepairs(prev => prev.map(r => r.id === statusModalRepair.id ? { ...r, ...updated } : r));
      setStatusModalRepair(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update repair status');
    } finally {
      setStatusUpdateLoading(false);
    }
  };

  // 3. Assign / Reassign Technician
  const handleOpenAssignModal = (repair: any) => {
    setAssignModalRepair(repair);
    setSelectedTechId(repair.technicianId || repair.technician?.id || 'UNASSIGNED');
  };

  const handleSaveTechnicianAssignment = async () => {
    if (!assignModalRepair) return;
    setAssignLoading(true);
    try {
      const techId = selectedTechId === 'UNASSIGNED' ? null : selectedTechId;
      const updated = await api.post(`/repairs/${assignModalRepair.id}/assign`, { technicianId: techId });
      toast.success(techId ? 'Technician assigned successfully' : 'Technician unassigned');
      setRepairs(prev => prev.map(r => r.id === assignModalRepair.id ? { ...r, ...updated } : r));
      setAssignModalRepair(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign technician');
    } finally {
      setAssignLoading(false);
    }
  };

  // 4. Quick Edit Repair Modal
  const handleOpenQuickEdit = (repair: any) => {
    setQuickEditRepair(repair);
  };

  // 5. Courier Return Dispatch Handlers
  const handleOpenCourierDispatch = (repair: any) => {
    setCourierDispatchModalRepair(repair);
    setCourierDispatchForm({
      returnCourierCompany: repair.returnCourierCompany || repair.courierCompany || 'Sundar Courier',
      customCourierCompany: '',
      returnCourierTrackingNumber: repair.returnCourierTrackingNumber || '',
      returnCourierDispatchDate: format(new Date(), 'yyyy-MM-dd'),
      destinationDistrict: repair.destinationDistrict || repair.originDistrict || repair.customer?.district || 'Kathmandu',
      destinationAddress: repair.destinationAddress || repair.originAddress || repair.customerAddress || '',
      receiverName: repair.receiverName || repair.senderName || repair.customerName || '',
      receiverPhone: repair.receiverPhone || repair.senderPhone || repair.customerPhone || '',
      returnCourierNotes: repair.returnCourierNotes || ''
    });
  };

  const handleSaveCourierDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courierDispatchModalRepair) return;

    const company = courierDispatchForm.returnCourierCompany === 'Other Courier'
      ? courierDispatchForm.customCourierCompany
      : courierDispatchForm.returnCourierCompany;

    if (!company?.trim()) {
      toast.error('Courier Company is required');
      return;
    }
    if (!courierDispatchForm.returnCourierTrackingNumber?.trim()) {
      toast.error('Consignment / Tracking Number is required');
      return;
    }

    setCourierDispatchLoading(true);
    try {
      const res = await api.post(`/repairs/${courierDispatchModalRepair.id}/courier-dispatch`, {
        returnCourierCompany: company.trim(),
        returnCourierTrackingNumber: courierDispatchForm.returnCourierTrackingNumber.trim(),
        returnCourierDispatchDate: courierDispatchForm.returnCourierDispatchDate,
        destinationDistrict: courierDispatchForm.destinationDistrict.trim(),
        destinationAddress: courierDispatchForm.destinationAddress.trim(),
        receiverName: courierDispatchForm.receiverName.trim(),
        receiverPhone: courierDispatchForm.receiverPhone.trim(),
        returnCourierNotes: courierDispatchForm.returnCourierNotes.trim()
      });

      const updated = res.repair || res;
      toast.success(`Repaired device dispatched via ${company} (Tracking #${courierDispatchForm.returnCourierTrackingNumber.trim()})`);
      setRepairs(prev => prev.map(r => r.id === courierDispatchModalRepair.id ? { ...r, ...updated } : r));
      setCourierDispatchModalRepair(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to dispatch courier return');
    } finally {
      setCourierDispatchLoading(false);
    }
  };

  // 6. Re-Problem Intake Handlers
  const handleOpenReProblem = (repair: any) => {
    setReProblemModalRepair(repair);
    setReProblemReason('Customer reported recurring fault');
    setReProblemDescription('');
  };

  const handleSaveReProblem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reProblemModalRepair) return;

    setReProblemLoading(true);
    try {
      const res = await api.post(`/repairs/${reProblemModalRepair.id}/re-problem`, {
        problemReason: reProblemReason.trim(),
        description: reProblemDescription.trim()
      });

      const updated = res.repair || res;
      toast.success(`Re-Problem recorded for Repair #${reProblemModalRepair.repairNumber}. Status updated to RE_PROBLEM.`);
      setRepairs(prev => prev.map(r => r.id === reProblemModalRepair.id ? { ...r, ...updated } : r));
      setReProblemModalRepair(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to record re-problem');
    } finally {
      setReProblemLoading(false);
    }
  };

  // Helper to format dates
  const formatDateSafe = (dateString?: string, formatStr = 'MMM dd, yyyy') => {
    if (!dateString) return '—';
    try {
      const d = new Date(dateString);
      return isNaN(d.getTime()) ? '—' : format(d, formatStr);
    } catch {
      return '—';
    }
  };

  return (
    <div className="space-y-6 pb-28">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">Repair Management</h1>
            <Badge variant="outline" className="font-semibold text-xs border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {user?.role?.replace(/_/g, ' ')}
            </Badge>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Real-time multi-brand repair records, instant assignment, status transitions, and payments.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <DashboardRefreshButton
            onRefresh={fetchData}
            size="default"
            label="Refresh"
          />

          <Button
            variant="outline"
            onClick={() => generateRepairReport(finalFilteredRepairs, `REPAIR REPORT (${dateFilterPreset})`)}
            className="h-10 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold gap-2 shadow-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
            disabled={finalFilteredRepairs.length === 0}
          >
            <Download className="h-4 w-4" /> Print Report
          </Button>

          {canManageExcel && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadTemplate}
                disabled={downloadingTemplate}
                className="h-10 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 gap-2 shadow-sm text-xs"
                title="Download blank standard Excel template for repairs"
              >
                {downloadingTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4 text-slate-500 dark:text-slate-400" />}
                <span className="hidden sm:inline">Download</span> Template
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setImportFile(null);
                  setPreviewData(null);
                  setIsImportModalOpen(true);
                }}
                className="h-10 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 gap-2 shadow-sm text-xs"
              >
                <Upload className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                Import Excel
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                disabled={exportingExcel || repairs.length === 0}
                className="h-10 rounded-xl border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 font-semibold gap-2 shadow-sm text-xs"
              >
                {exportingExcel ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
                Export Excel
              </Button>
            </>
          )}

          {canCreate && (
            <Link to="/dashboard/repairs/new">
              <Button className="h-10 rounded-xl bg-slate-900 hover:bg-black text-white font-semibold shadow-md gap-2 px-4">
                <Plus className="h-4 w-4" /> Register Repair
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* 1. Dashboard Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Total Repairs */}
        <Card
          onClick={() => setActiveStatusTab('ALL')}
          className={`cursor-pointer transition-all duration-200 border rounded-2xl p-4 shadow-sm hover:shadow-md ${activeStatusTab === 'ALL' ? 'border-slate-900 bg-slate-900 text-white dark:border-indigo-500 dark:bg-indigo-600' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100'
            }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold uppercase tracking-wider ${activeStatusTab === 'ALL' ? 'text-slate-300 dark:text-indigo-100' : 'text-slate-500 dark:text-slate-400'}`}>
              Total Repairs
            </span>
            <Layers className={`h-4 w-4 ${activeStatusTab === 'ALL' ? 'text-slate-300 dark:text-indigo-100' : 'text-slate-400 dark:text-slate-500'}`} />
          </div>
          <div className="mt-2 text-2xl font-black">{metrics.total}</div>
          <div className={`text-[11px] mt-1 font-medium ${activeStatusTab === 'ALL' ? 'text-slate-300 dark:text-indigo-100' : 'text-slate-400 dark:text-slate-500'}`}>
            Est. {formatNPR(metrics.estimatedTotalSum)}
          </div>
        </Card>

        {/* Pending */}
        <Card
          onClick={() => setActiveStatusTab('PENDING')}
          className={`cursor-pointer transition-all duration-200 border rounded-2xl p-4 shadow-sm hover:shadow-md ${activeStatusTab === 'PENDING' ? 'border-amber-500 bg-amber-500 text-white' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100'
            }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold uppercase tracking-wider ${activeStatusTab === 'PENDING' ? 'text-amber-100' : 'text-amber-700 dark:text-amber-400'}`}>
              Pending
            </span>
            <AlertCircle className={`h-4 w-4 ${activeStatusTab === 'PENDING' ? 'text-amber-100' : 'text-amber-500 dark:text-amber-400'}`} />
          </div>
          <div className="mt-2 text-2xl font-black">{metrics.pending}</div>
          <div className={`text-[11px] mt-1 font-medium ${activeStatusTab === 'PENDING' ? 'text-amber-100' : 'text-slate-400 dark:text-slate-500'}`}>
            Awaiting triage
          </div>
        </Card>

        {/* Received */}
        <Card
          onClick={() => setActiveStatusTab('RECEIVED')}
          className={`cursor-pointer transition-all duration-200 border rounded-2xl p-4 shadow-sm hover:shadow-md ${activeStatusTab === 'RECEIVED' ? 'border-sky-600 bg-sky-600 text-white' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100'
            }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold uppercase tracking-wider ${activeStatusTab === 'RECEIVED' ? 'text-sky-100' : 'text-sky-700 dark:text-sky-400'}`}>
              Received
            </span>
            <Smartphone className={`h-4 w-4 ${activeStatusTab === 'RECEIVED' ? 'text-sky-100' : 'text-sky-500 dark:text-sky-400'}`} />
          </div>
          <div className="mt-2 text-2xl font-black">{metrics.received}</div>
          <div className={`text-[11px] mt-1 font-medium ${activeStatusTab === 'RECEIVED' ? 'text-sky-100' : 'text-slate-400 dark:text-slate-500'}`}>
            Checked in at desk
          </div>
        </Card>

        {/* In Progress */}
        <Card
          onClick={() => setActiveStatusTab('IN_PROGRESS')}
          className={`cursor-pointer transition-all duration-200 border rounded-2xl p-4 shadow-sm hover:shadow-md ${activeStatusTab === 'IN_PROGRESS' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100'
            }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold uppercase tracking-wider ${activeStatusTab === 'IN_PROGRESS' ? 'text-indigo-100' : 'text-indigo-700 dark:text-indigo-400'}`}>
              In Progress
            </span>
            <Wrench className={`h-4 w-4 ${activeStatusTab === 'IN_PROGRESS' ? 'text-indigo-100' : 'text-indigo-500 dark:text-indigo-400'}`} />
          </div>
          <div className="mt-2 text-2xl font-black">{metrics.inProgress}</div>
          <div className={`text-[11px] mt-1 font-medium ${activeStatusTab === 'IN_PROGRESS' ? 'text-indigo-100' : 'text-slate-400 dark:text-slate-500'}`}>
            On bench / Diagnosing
          </div>
        </Card>

        {/* Repaired */}
        <Card
          onClick={() => setActiveStatusTab('REPAIRED')}
          className={`cursor-pointer transition-all duration-200 border rounded-2xl p-4 shadow-sm hover:shadow-md col-span-2 sm:col-span-1 ${activeStatusTab === 'REPAIRED' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100'
            }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold uppercase tracking-wider ${activeStatusTab === 'REPAIRED' ? 'text-emerald-100' : 'text-emerald-700 dark:text-emerald-400'}`}>
              Repaired / Ready
            </span>
            <CheckCircle2 className={`h-4 w-4 ${activeStatusTab === 'REPAIRED' ? 'text-emerald-100' : 'text-emerald-500 dark:text-emerald-400'}`} />
          </div>
          <div className="mt-2 text-2xl font-black">{metrics.repaired}</div>
          <div className={`text-[11px] mt-1 font-medium ${activeStatusTab === 'REPAIRED' ? 'text-emerald-100' : 'text-slate-400 dark:text-slate-500'}`}>
            Ready for customer
          </div>
        </Card>
      </div>

      {/* 2. Filter Toolbar: Date Filter & Status Views */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm space-y-4">
        {/* Status Tabs Navigation */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          {[
            { key: 'ALL', label: 'All Jobs', count: metrics.total },
            { key: 'PENDING', label: 'Pending', count: metrics.pending },
            { key: 'RECEIVED', label: 'Received', count: metrics.received },
            { key: 'IN_PROGRESS', label: 'In Progress', count: metrics.inProgress },
            { key: 'REPAIRED', label: 'Repaired', count: metrics.repaired },
            { key: 'DELIVERED', label: 'Delivered', count: metrics.delivered },
            { key: 'RE_PROBLEM', label: 'Re-Problem', count: metrics.reProblem },
            { key: 'CANCELLED', label: 'Cancelled', count: metrics.cancelled },
          ].map((tab) => {
            const isActive = activeStatusTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveStatusTab(tab.key as StatusTabKey)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${isActive
                  ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100/80 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
              >
                <span>{tab.label}</span>
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${isActive ? 'bg-slate-800 dark:bg-indigo-700 text-slate-200' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Date Filter & Search Controls */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Search Box */}
          <div className="md:col-span-4 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
            <Input
              placeholder="Search repair #, customer, phone, model, tech..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 pl-9 rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 text-sm text-slate-900 dark:text-white"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Date Filter Presets */}
          <div className="md:col-span-5 flex flex-wrap items-center gap-1.5">
            <div className="flex items-center gap-1 mr-1">
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Date:</span>
              <span className="text-[10px] font-medium text-slate-400 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded" title="All filters calibrated to Nepal Standard Time (UTC+5:45)">NPT</span>
            </div>
            {[
              { key: 'ALL', label: 'All' },
              { key: 'TODAY', label: 'Today' },
              { key: 'YESTERDAY', label: 'Yesterday' },
              { key: 'THIS_WEEK', label: 'This Week' },
              { key: 'THIS_MONTH', label: 'This Month' },
              { key: 'CUSTOM', label: 'Custom' }
            ].map(preset => {
              const isSelected = dateFilterPreset === preset.key;
              return (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => setDateFilterPreset(preset.key as DateFilterPreset)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${isSelected
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          {/* Sort & Technician Filter Dropdowns */}
          <div className="md:col-span-3 flex items-center gap-2 justify-end">
            <Select value={selectedTechnicianFilter} onValueChange={setSelectedTechnicianFilter}>
              <SelectTrigger className="h-10 rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-slate-100 w-full sm:w-36">
                <SelectValue placeholder="Technician" />
              </SelectTrigger>
              <SelectContent className="rounded-xl dark:bg-slate-900 dark:border-slate-800">
                <SelectItem value="ALL">All Technicians</SelectItem>
                <SelectItem value="UNASSIGNED">Unassigned</SelectItem>
                {technicians.map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(val: any) => setSortBy(val)}>
              <SelectTrigger className="h-10 rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-slate-100 w-full sm:w-32">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent className="rounded-xl dark:bg-slate-900 dark:border-slate-800">
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="updated">Recently Updated</SelectItem>
                <SelectItem value="repairNumber">Job Number</SelectItem>
                <SelectItem value="customerName">Customer (A-Z)</SelectItem>
                <SelectItem value="status">Status</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Custom Date Range Picker (shown when CUSTOM preset selected) */}
        {dateFilterPreset === 'CUSTOM' && (
          <div className="flex flex-col gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300">From:</Label>
                <Input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="h-9 w-40 rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300">To:</Label>
                <Input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="h-9 w-40 rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>
              {(customStartDate || customEndDate) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCustomStartDate('');
                    setCustomEndDate('');
                  }}
                  className="h-9 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl cursor-pointer"
                >
                  Clear Range
                </Button>
              )}
            </div>

            {customRangeError && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-medium">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <span>{customRangeError}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Professional Repair Table & Responsive Cards */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 gap-3 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
          <Loader2 className="h-10 w-10 text-slate-400 dark:text-slate-500 animate-spin" />
          <p className="text-slate-500 dark:text-slate-400 font-semibold text-sm">Loading authorized repair records...</p>
        </div>
      ) : finalFilteredRepairs.length === 0 ? (
        <div className="text-center py-24 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Smartphone className="h-8 w-8 text-slate-400 dark:text-slate-500" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            {customRangeError
              ? "Invalid Date Range"
              : dateFilteredRepairs.length === 0 && dateFilterPreset !== 'ALL'
                ? `No repairs found for ${dateFilterPreset.replace('_', ' ')}`
                : "No repair records found"}
          </h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm mx-auto mt-1">
            {customRangeError
              ? "The selected start date is after the end date. Please adjust your dates."
              : dateFilteredRepairs.length === 0 && dateFilterPreset !== 'ALL'
                ? `There are 0 repair tickets recorded for the selected date window in Nepal time (UTC+5:45).`
                : "Try adjusting your search criteria, date filter, or status tab."}
          </p>
          <div className="flex items-center justify-center gap-2 mt-4">
            {dateFilterPreset !== 'ALL' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDateFilterPreset('ALL');
                  setCustomStartDate('');
                  setCustomEndDate('');
                }}
                className="rounded-xl border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium cursor-pointer"
              >
                Show All Repairs
              </Button>
            )}
            {canCreate && (
              <Link to="/dashboard/repairs/new">
                <Button size="sm" className="rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white font-semibold cursor-pointer">
                  <Plus className="h-4 w-4 mr-1" /> Register New Repair
                </Button>
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Sticky Bulk Action Bar */}
          {canDelete && selectedRepairIds.size > 0 && (
            <div className="sticky top-20 z-30 bg-slate-900 text-white px-4 sm:px-6 py-3 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-3 border border-slate-800 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors cursor-pointer ${isAllVisibleSelected
                    ? 'bg-white border-white text-slate-900'
                    : isSomeVisibleSelected
                      ? 'bg-slate-700 border-slate-500 text-white'
                      : 'border-slate-600 bg-slate-800 text-white hover:bg-slate-700'
                    }`}
                  title={isAllVisibleSelected ? "Deselect all visible repairs" : "Select all visible repairs"}
                >
                  {isAllVisibleSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  {!isAllVisibleSelected && isSomeVisibleSelected && <Minus className="w-3.5 h-3.5 stroke-[3]" />}
                </button>

                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-sm text-white">
                    {selectedRepairIds.size} {selectedRepairIds.size === 1 ? 'Repair' : 'Repairs'} Selected
                  </span>
                  <span className="text-xs text-slate-400 hidden sm:inline">
                    (out of {finalFilteredRepairs.length} displayed)
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClearSelection}
                  className="h-8 px-3 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold cursor-pointer"
                >
                  Clear Selection
                </Button>

                <Button
                  type="button"
                  onClick={() => setIsBulkDeleteModalOpen(true)}
                  className="h-8 px-3.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Selected ({selectedRepairIds.size})</span>
                </Button>
              </div>
            </div>
          )}

          {/* Desktop Table View */}
          <div className="hidden lg:block bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700 dark:text-slate-200">
                <thead className="bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                  <tr>
                    {canDelete && (
                      <th className="py-3.5 px-4 w-10 text-center">
                        <button
                          type="button"
                          onClick={handleToggleSelectAll}
                          className={`w-4 h-4 rounded border flex items-center justify-center transition-colors cursor-pointer mx-auto ${isAllVisibleSelected
                            ? 'bg-slate-900 dark:bg-indigo-600 border-slate-900 dark:border-indigo-600 text-white'
                            : isSomeVisibleSelected
                              ? 'bg-slate-200 dark:bg-slate-700 border-slate-400 dark:border-slate-600 text-slate-800 dark:text-slate-200'
                              : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-600'
                            }`}
                          title={isAllVisibleSelected ? "Deselect all visible repairs" : "Select all visible repairs"}
                          aria-label={isAllVisibleSelected ? "Deselect all visible repairs" : "Select all visible repairs"}
                        >
                          {isAllVisibleSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          {!isAllVisibleSelected && isSomeVisibleSelected && <Minus className="w-3 h-3 stroke-[3]" />}
                        </button>
                      </th>
                    )}
                    <th className="py-3.5 px-4">Repair #</th>
                    <th className="py-3.5 px-4">Date</th>
                    <th className="py-3.5 px-4">Customer</th>
                    <th className="py-3.5 px-4">Device / Model</th>
                    <th className="py-3.5 px-4">Problem</th>
                    <th className="py-3.5 px-4">Technician</th>
                    <th className="py-3.5 px-4">Status</th>
                    {activeStatusTab === 'REPAIRED' && (
                      <th className="py-3.5 px-4">Customer SMS</th>
                    )}
                    <th className="py-3.5 px-4">Payment</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {paginatedRepairs.map((repair) => {
                    const statusInfo = statusConfig[repair.status] || {

                      label: repair.status?.replace(/_/g, ' ') || 'Unknown',
                      badgeClass: 'bg-slate-100 text-slate-700',
                      bgSoft: 'bg-slate-50',
                      textClass: 'text-slate-700'
                    };

                    const smsSummary = repair.smsSummary || {
                      status: 'NOT_SENT',
                      count: 0,
                      totalAttempts: 0,
                      lastSentAt: null,
                    };

                    const isUnpaid = !repair.paymentStatus || repair.paymentStatus === 'UNPAID';
                    const isPartial = repair.paymentStatus === 'PARTIAL';
                    const isPaid = repair.paymentStatus === 'PAID';
                    const isSelected = selectedRepairIds.has(repair.id);

                    return (
                      <tr key={repair.id} className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/60 transition-colors ${isSelected ? 'bg-indigo-50/40 dark:bg-indigo-950/40' : ''}`}>
                        {/* Row Selection Checkbox */}
                        {canDelete && (
                          <td className="py-3.5 px-4 w-10 text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={(e) => handleToggleSelectRepair(repair.id, e)}
                              className={`w-4 h-4 rounded border flex items-center justify-center transition-colors cursor-pointer mx-auto ${isSelected
                                ? 'bg-slate-900 dark:bg-indigo-600 border-slate-900 dark:border-indigo-600 text-white shadow-2xs'
                                : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-600'
                                }`}
                              aria-label={`Select repair #${repair.repairNumber}`}
                            >
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </button>
                          </td>
                        )}

                        {/* Repair No */}
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => navigate(`/dashboard/repairs/${repair.id}`)}
                              className="hover:underline text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 cursor-pointer"
                            >
                              <span>#{repair.repairNumber}</span>
                            </button>
                            {(repair.receivingMethod === 'COURIER' || repair.isCourierIn) && (
                              <Badge className="bg-amber-500 text-white font-bold text-[9px] px-1.5 py-0.5 shadow-xs flex items-center gap-0.5">
                                <Truck className="w-2.5 h-2.5" />
                                <span>COURIER</span>
                              </Badge>
                            )}
                            {repair.priority === 'URGENT' && (
                              <Badge className="bg-rose-600 text-white font-black text-[9px] px-1.5 py-0.5 animate-pulse shadow-xs">
                                URGENT
                              </Badge>
                            )}
                            {repair.priority === 'HIGH' && (
                              <Badge className="bg-amber-500 text-white font-bold text-[9px] px-1.5 py-0.5 shadow-xs">
                                HIGH
                              </Badge>
                            )}
                            {repair.priority === 'MEDIUM' && (
                              <Badge className="bg-yellow-500 text-slate-950 font-bold text-[9px] px-1.5 py-0.5 shadow-xs">
                                MEDIUM
                              </Badge>
                            )}
                          </div>
                        </td>

                        {/* Date Created */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-600 dark:text-slate-300">
                          <div>{formatDateSafe(repair.createdAt, 'MMM dd, yyyy')}</div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500">{formatDateSafe(repair.createdAt, 'hh:mm a')}</div>
                        </td>

                        {/* Customer */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[140px]">{repair.customerName}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1">
                            <Phone className="h-3 w-3 text-slate-400 dark:text-slate-500 inline" />
                            <span>{repair.customerPhone}</span>
                          </div>
                        </td>

                        {/* Device / Model */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[150px]">
                            {repair.deviceBrand} {repair.deviceModel}
                          </div>
                          {repair.imeiNumber && (
                            <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono truncate max-w-[120px]">
                              IMEI: {repair.imeiNumber}
                            </div>
                          )}
                        </td>

                        {/* Problem */}
                        <td className="py-3.5 px-4">
                          <div className="text-xs text-slate-600 dark:text-slate-300 truncate max-w-[160px]" title={repair.problemDescription}>
                            {repair.problemDescription || 'No description'}
                          </div>
                        </td>

                        {/* Technician */}
                        <td className="py-3.5 px-4">
                          {repair.technician?.name ? (
                            <div className="flex items-center gap-1.5">
                              <div className="w-6 h-6 rounded-full bg-slate-900 dark:bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold uppercase">
                                {repair.technician.name.charAt(0)}
                              </div>
                              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[100px]">
                                {repair.technician.name}
                              </span>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleOpenAssignModal(repair)}
                              className="text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 px-2 py-1 rounded-lg border border-amber-200 dark:border-amber-800 inline-flex items-center gap-1 cursor-pointer"
                            >
                              <User className="h-3 w-3" /> Assign
                            </button>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <Badge
                            onClick={() => handleOpenStatusModal(repair)}
                            className={`cursor-pointer font-bold text-[11px] px-2.5 py-0.5 rounded-lg border shadow-none ${statusInfo.badgeClass}`}
                          >
                            {statusInfo.label}
                          </Badge>
                        </td>

                        {/* Customer SMS Status (Repaired Tab) */}
                        {activeStatusTab === 'REPAIRED' && (
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex flex-col items-start gap-1">
                              {smsSummary.status === 'SENT' ? (
                                <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 font-bold text-[10px] py-0.5 px-2 gap-1 shadow-2xs">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                  <span>SMS: Sent</span>
                                </Badge>
                              ) : smsSummary.status === 'INITIATED' ? (
                                <Badge variant="outline" className="bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-700 font-bold text-[10px] py-0.5 px-2 gap-1 shadow-2xs">
                                  <Clock className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                                  <span>SMS: Initiated</span>
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 font-bold text-[10px] py-0.5 px-2 shadow-2xs">
                                  SMS: Not Sent
                                </Badge>
                              )}

                              {smsSummary.count > 0 ? (
                                <span className="text-[11px] text-slate-700 dark:text-slate-300 font-medium">
                                  Messages Sent: <strong className="text-slate-900 dark:text-white font-bold">{smsSummary.count}</strong>
                                </span>
                              ) : smsSummary.totalAttempts > 0 ? (
                                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                  Initiated: {smsSummary.totalAttempts}
                                </span>
                              ) : null}

                              {smsSummary.lastSentAt && (
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                                  Last: {formatDateSafe(smsSummary.lastSentAt, 'dd MMM, h:mm a')}
                                </span>
                              )}
                            </div>
                          </td>
                        )}

                        {/* Payment */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
                            {formatRepairCost(repair.totalCost ?? repair.estimatedCost)}
                          </div>
                          <Badge
                            variant="secondary"
                            className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded ${isPaid ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' :
                              isPartial ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800' :
                                'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                              }`}
                          >
                            {repair.paymentStatus || 'UNPAID'}
                          </Badge>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigateToRepair(repair.id)}
                              className="h-8 px-2.5 rounded-lg text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer"
                            >
                              <Eye className="h-3.5 w-3.5 mr-1" /> View
                            </Button>

                            {/* Send Customer SMS button if Repaired */}
                            {canSendSms && isRepairedOrReadyStatus(repair.status) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSmsModalRepair(repair);
                                  setIsSmsModalOpen(true);
                                }}
                                className={`h-8 px-2.5 rounded-xl font-bold text-xs gap-1.5 shadow-2xs cursor-pointer ${
                                  smsSummary.status === 'SENT'
                                    ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300'
                                    : 'border-teal-300 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900/60 text-teal-800 dark:text-teal-300'
                                }`}
                                title={
                                  smsSummary.status === 'SENT'
                                    ? `Sent ${smsSummary.count} SMS. Click to send again.`
                                    : 'Send Customer SMS (Google Messages for Web)'
                                }
                              >
                                <MessageSquare className={`h-3.5 w-3.5 ${smsSummary.status === 'SENT' ? 'text-emerald-600 dark:text-emerald-400' : 'text-teal-600 dark:text-teal-400'}`} />
                                <span className="hidden xl:inline">
                                  {smsSummary.status === 'SENT' ? 'Send SMS Again' : 'Send SMS'}
                                </span>
                              </Button>
                            )}

                            <DropdownMenu>
                              <DropdownMenuTrigger render={
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" />
                              }>
                                <MoreVertical className="h-4 w-4" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="rounded-2xl w-48 shadow-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-1.5">
                                <DropdownMenuItem
                                  onClick={() => navigate(`/dashboard/repairs/${repair.id}`)}
                                  className="h-9 px-3 rounded-xl font-medium text-xs cursor-pointer gap-2"
                                >
                                  <Eye className="h-3.5 w-3.5" /> Full Details Page
                                </DropdownMenuItem>

                                <DropdownMenuItem
                                  onClick={() => handleOpenQuickEdit(repair)}
                                  className="h-9 px-3 rounded-xl font-medium text-xs cursor-pointer gap-2"
                                >
                                  <Edit3 className="h-3.5 w-3.5" /> Edit Repair Info
                                </DropdownMenuItem>

                                <DropdownMenuItem
                                  onClick={() => handleOpenStatusModal(repair)}
                                  className="h-9 px-3 rounded-xl font-medium text-xs cursor-pointer gap-2"
                                >
                                  <PackageCheck className="h-3.5 w-3.5" /> Update Status
                                </DropdownMenuItem>

                                {canAssign && (
                                  <DropdownMenuItem
                                    onClick={() => handleOpenAssignModal(repair)}
                                    className="h-9 px-3 rounded-xl font-medium text-xs cursor-pointer gap-2"
                                  >
                                    <User className="h-3.5 w-3.5" /> Assign Specialist
                                  </DropdownMenuItem>
                                )}

                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedSlipRepair(repair);
                                    setIsSlipModalOpen(true);
                                  }}
                                  className="h-9 px-3 rounded-xl font-semibold text-xs cursor-pointer gap-2 text-slate-800"
                                >
                                  <FileText className="h-3.5 w-3.5 text-emerald-600" /> Print Service Slip
                                </DropdownMenuItem>

                                <DropdownMenuItem
                                  onClick={() => generateRepairReport([repair], `REPAIR JOB #${repair.repairNumber}`)}
                                  className="h-9 px-3 rounded-xl font-medium text-xs cursor-pointer gap-2"
                                >
                                  <Printer className="h-3.5 w-3.5" /> Print Job Sheet
                                </DropdownMenuItem>

                                {/* Send SMS Option */}
                                {canSendSms && isRepairedOrReadyStatus(repair.status) && (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSmsModalRepair(repair);
                                      setIsSmsModalOpen(true);
                                    }}
                                    className="h-9 px-3 rounded-xl font-bold text-xs cursor-pointer gap-2 text-teal-700 hover:bg-teal-50"
                                  >
                                    <MessageSquare className="h-3.5 w-3.5 text-teal-600" /> Send Customer SMS
                                  </DropdownMenuItem>
                                )}

                                {/* Courier Dispatch Option */}
                                {['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST'].includes(user?.role || '') && (
                                  <DropdownMenuItem
                                    onClick={() => handleOpenCourierDispatch(repair)}
                                    className="h-9 px-3 rounded-xl font-medium text-xs cursor-pointer gap-2 text-blue-700 hover:bg-blue-50"
                                  >
                                    <Truck className="h-3.5 w-3.5 text-blue-600" /> Dispatch Courier Return
                                  </DropdownMenuItem>
                                )}

                                {/* Re-Problem Option */}
                                <DropdownMenuItem
                                  onClick={() => handleOpenReProblem(repair)}
                                  className="h-9 px-3 rounded-xl font-medium text-xs cursor-pointer gap-2 text-rose-700 hover:bg-rose-50"
                                >
                                  <RotateCcw className="h-3.5 w-3.5 text-rose-600" /> Report Re-Problem
                                </DropdownMenuItem>

                                {/* Cancel Device Option */}
                                {canCancel && !isCancelledStatus(repair.status) && (
                                  <DropdownMenuItem
                                    onClick={() => handleOpenCancelModal(repair)}
                                    className="h-9 px-3 rounded-xl font-medium text-xs cursor-pointer gap-2 text-rose-700 hover:bg-rose-50"
                                  >
                                    <Ban className="h-3.5 w-3.5 text-rose-600" /> Cancel Device / Repair
                                  </DropdownMenuItem>
                                )}

                                {/* Restore Cancelled Device Option */}
                                {canCancel && isCancelledStatus(repair.status) && (
                                  <DropdownMenuItem
                                    onClick={() => handleReopenCancelledRepair(repair)}
                                    className="h-9 px-3 rounded-xl font-medium text-xs cursor-pointer gap-2 text-indigo-700 hover:bg-indigo-50"
                                  >
                                    <RotateCcw className="h-3.5 w-3.5 text-indigo-600" /> Re-open / Restore
                                  </DropdownMenuItem>
                                )}

                                {canDelete && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => setDeleteRepairData(repair)}
                                      className="h-9 px-3 rounded-xl font-semibold text-xs text-rose-600 hover:bg-rose-50 cursor-pointer gap-2"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" /> Delete Record
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile / Tablet Responsive Cards Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:hidden gap-3">
            {paginatedRepairs.map((repair) => {
              const statusInfo = statusConfig[repair.status] || {

                label: repair.status?.replace(/_/g, ' ') || 'Unknown',
                badgeClass: 'bg-slate-100 text-slate-700',
                bgSoft: 'bg-slate-50',
                textClass: 'text-slate-700'
              };
              const smsSummary = repair.smsSummary || {
                status: 'NOT_SENT',
                count: 0,
                totalAttempts: 0,
                lastSentAt: null,
              };
              const isSelected = selectedRepairIds.has(repair.id);

              return (
                <Card
                  key={repair.id}
                  className={`rounded-2xl border bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3 hover:border-slate-300 dark:hover:border-slate-700 transition-all ${isSelected ? 'border-indigo-400 bg-indigo-50/30 dark:bg-indigo-950/40 ring-1 ring-indigo-400/50' : 'border-slate-200 dark:border-slate-800'
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {canDelete && (
                        <button
                          type="button"
                          onClick={(e) => handleToggleSelectRepair(repair.id, e)}
                          className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors cursor-pointer mr-0.5 ${isSelected
                            ? 'bg-slate-900 border-slate-900 text-white shadow-2xs'
                            : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-600'
                            }`}
                          aria-label={`Select repair #${repair.repairNumber}`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </button>
                      )}
                      <span className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100">
                        #{repair.repairNumber}
                      </span>
                      {(repair.receivingMethod === 'COURIER' || repair.isCourierIn) && (
                        <Badge className="bg-amber-500 text-white font-bold text-[9px] px-1.5 py-0.5 shadow-xs flex items-center gap-0.5">
                          <Truck className="w-2.5 h-2.5" />
                          <span>COURIER</span>
                        </Badge>
                      )}
                      {repair.priority === 'URGENT' && (
                        <Badge className="bg-rose-600 text-white font-black text-[9px] px-1.5 py-0.5 animate-pulse shadow-xs">
                          URGENT
                        </Badge>
                      )}
                      {repair.priority === 'HIGH' && (
                        <Badge className="bg-amber-500 text-white font-bold text-[9px] px-1.5 py-0.5 shadow-xs">
                          HIGH
                        </Badge>
                      )}
                      {repair.priority === 'MEDIUM' && (
                        <Badge className="bg-yellow-500 text-slate-950 font-bold text-[9px] px-1.5 py-0.5 shadow-xs">
                          MEDIUM
                        </Badge>
                      )}
                      <Badge className={`font-bold text-[10px] px-2 py-0.5 rounded-md ${statusInfo.badgeClass}`}>
                        {statusInfo.label}
                      </Badge>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger render={
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" />
                      }>
                        <MoreVertical className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-2xl w-48 shadow-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5">
                        <DropdownMenuItem onClick={() => navigate(`/dashboard/repairs/${repair.id}`)} className="h-9 px-3 rounded-xl font-medium text-xs cursor-pointer gap-2 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">
                          <Eye className="h-3.5 w-3.5" /> View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleOpenQuickEdit(repair)} className="h-9 px-3 rounded-xl font-medium text-xs cursor-pointer gap-2 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">
                          <Edit3 className="h-3.5 w-3.5" /> Edit Info
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleOpenStatusModal(repair)} className="h-9 px-3 rounded-xl font-medium text-xs cursor-pointer gap-2 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">
                          <PackageCheck className="h-3.5 w-3.5" /> Update Status
                        </DropdownMenuItem>
                        {canSendSms && isRepairedOrReadyStatus(repair.status) && (
                          <DropdownMenuItem
                            onClick={() => {
                              setSmsModalRepair(repair);
                              setIsSmsModalOpen(true);
                            }}
                            className="h-9 px-3 rounded-xl font-bold text-xs cursor-pointer gap-2 text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/40"
                          >
                            <MessageSquare className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" /> Send Customer SMS
                          </DropdownMenuItem>
                        )}
                        {['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST'].includes(user?.role || '') && (
                          <DropdownMenuItem onClick={() => handleOpenCourierDispatch(repair)} className="h-9 px-3 rounded-xl font-medium text-xs cursor-pointer gap-2 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40">
                            <Truck className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" /> Dispatch Courier
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => handleOpenReProblem(repair)} className="h-9 px-3 rounded-xl font-medium text-xs cursor-pointer gap-2 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40">
                          <RotateCcw className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" /> Re-Problem Intake
                        </DropdownMenuItem>
                        {canCancel && !isCancelledStatus(repair.status) && (
                          <DropdownMenuItem onClick={() => handleOpenCancelModal(repair)} className="h-9 px-3 rounded-xl font-medium text-xs cursor-pointer gap-2 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40">
                            <Ban className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" /> Cancel Device / Repair
                          </DropdownMenuItem>
                        )}
                        {canCancel && isCancelledStatus(repair.status) && (
                          <DropdownMenuItem onClick={() => handleReopenCancelledRepair(repair)} className="h-9 px-3 rounded-xl font-medium text-xs cursor-pointer gap-2 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40">
                            <RotateCcw className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" /> Re-open / Restore
                          </DropdownMenuItem>
                        )}
                        {canAssign && (
                          <DropdownMenuItem onClick={() => handleOpenAssignModal(repair)} className="h-9 px-3 rounded-xl font-medium text-xs cursor-pointer gap-2 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">
                            <User className="h-3.5 w-3.5" /> Assign Tech
                          </DropdownMenuItem>
                        )}
                        {canDelete && (
                          <>
                            <DropdownMenuSeparator className="bg-slate-100 dark:bg-slate-800" />
                            <DropdownMenuItem onClick={() => setDeleteRepairData(repair)} className="h-9 px-3 rounded-xl font-semibold text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer gap-2">
                              <Trash2 className="h-3.5 w-3.5" /> Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-bold text-slate-900 dark:text-slate-100 text-base">{repair.deviceBrand} {repair.deviceModel}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{repair.problemDescription || 'No description provided'}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase block">Customer</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100 block truncate">{repair.customerName}</span>
                      <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">{repair.customerPhone}</span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase block">Specialist</span>
                      {repair.technician?.name ? (
                        <span className="font-semibold text-slate-900 dark:text-slate-100 block truncate">{repair.technician.name}</span>
                      ) : (
                        <button
                          onClick={() => handleOpenAssignModal(repair)}
                          className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 underline"
                        >
                          Assign Specialist
                        </button>
                      )}
                      <span className="text-slate-400 dark:text-slate-500 text-[10px] block">{formatDateSafe(repair.createdAt, 'MMM dd, yyyy')}</span>
                    </div>
                  </div>

                  {/* SMS Status & Action Box for Repaired devices */}
                  {isRepairedOrReadyStatus(repair.status) && (
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/90 dark:border-slate-700/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          {smsSummary.status === 'SENT' ? (
                            <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 font-bold text-[10px] py-0.5 px-2 gap-1 shadow-2xs">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              <span>SMS: Sent</span>
                            </Badge>
                          ) : smsSummary.status === 'INITIATED' ? (
                            <Badge variant="outline" className="bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-700 font-bold text-[10px] py-0.5 px-2 gap-1 shadow-2xs">
                              <Clock className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                              <span>SMS: Initiated</span>
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 font-bold text-[10px] py-0.5 px-2 shadow-2xs">
                              SMS: Not Sent
                            </Badge>
                          )}
                          {smsSummary.count > 0 ? (
                            <span className="text-[11px] text-slate-700 dark:text-slate-300 font-medium">
                              Messages Sent: <strong className="text-slate-900 dark:text-slate-100 font-bold">{smsSummary.count}</strong>
                            </span>
                          ) : smsSummary.totalAttempts > 0 ? (
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">
                              Initiated: {smsSummary.totalAttempts}
                            </span>
                          ) : null}
                        </div>
                        {smsSummary.lastSentAt && (
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                            Last Sent: {formatDateSafe(smsSummary.lastSentAt, 'dd MMM yyyy, h:mm a')}
                          </p>
                        )}
                      </div>

                      {canSendSms && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSmsModalRepair(repair);
                            setIsSmsModalOpen(true);
                          }}
                          className={`h-7 px-2.5 rounded-lg text-xs font-bold gap-1 cursor-pointer shadow-xs ${
                            smsSummary.status === 'SENT'
                              ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300'
                              : 'border-teal-300 dark:border-teal-700 bg-teal-50 dark:bg-teal-950/40 hover:bg-teal-100 dark:hover:bg-teal-900/60 text-teal-800 dark:text-teal-300'
                          }`}
                        >
                          <MessageSquare className={`h-3 w-3 ${smsSummary.status === 'SENT' ? 'text-emerald-600 dark:text-emerald-400' : 'text-teal-600 dark:text-teal-400'}`} />
                          <span>{smsSummary.status === 'SENT' ? 'Send SMS Again' : 'Send SMS'}</span>
                        </Button>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold block">Cost / Paid</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">
                        {formatRepairCost(repair.totalCost ?? repair.estimatedCost)}
                      </span>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => navigateToRepair(repair.id)}
                      className="h-8 rounded-xl bg-slate-900 hover:bg-black dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-white text-xs font-semibold px-3"
                    >
                      Manage Job <ChevronRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Global 40-item Repair Pagination Control */}
          <Pagination
            currentPage={safeCurrentPage}
            totalItems={totalFilteredCount}
            pageSize={REPAIRS_PER_PAGE}
            onPageChange={setCurrentPage}
            className="mt-6"
            itemLabel="repair"
            itemsLabel="repairs"
          />
        </div>
      )}


      {/* ========================================================================= */}
      {/* MODAL 1: SINGLE DELETE CONFIRMATION (SUPER_ADMIN, ADMIN & RECEPTIONIST)   */}
      {/* ========================================================================= */}
      <Dialog open={!!deleteRepairData} onOpenChange={(open) => !open && setDeleteRepairData(null)}>
        <DialogContent className="rounded-3xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-6 sm:p-8 max-w-md">
          <DialogHeader>
            <div className="w-14 h-14 bg-rose-100 dark:bg-rose-950/60 rounded-2xl flex items-center justify-center mb-4 mx-auto sm:mx-0">
              <Trash2 className="h-7 w-7 text-rose-600 dark:text-rose-400" />
            </div>
            <DialogTitle className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
              Delete Repair Record?
            </DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400 text-sm pt-2 leading-relaxed">
              Are you sure you want to delete this repair record? This action will permanently remove its associated logs, notes, and payment records. Customer accounts will not be affected.
            </DialogDescription>
          </DialogHeader>

          {deleteRepairData && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 text-xs space-y-1 my-2">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Job Number:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">#{deleteRepairData.repairNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Customer:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{deleteRepairData.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Device:</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{deleteRepairData.deviceBrand} {deleteRepairData.deviceModel}</span>
              </div>
            </div>
          )}

          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeleteRepairData(null)}
              disabled={deleteLoading}
              className="h-11 rounded-xl border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 font-bold"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteRepair}
              disabled={deleteLoading}
              className="h-11 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold px-6 shadow-sm"
            >
              {deleteLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting...
                </span>
              ) : 'Confirm Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 1B: BULK DELETE CONFIRMATION (SUPER_ADMIN, ADMIN & RECEPTIONIST)    */}
      {/* ========================================================================= */}
      <Dialog open={isBulkDeleteModalOpen} onOpenChange={setIsBulkDeleteModalOpen}>
        <DialogContent className="rounded-3xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-6 sm:p-8 max-w-md">
          <DialogHeader>
            <div className="w-14 h-14 bg-rose-100 dark:bg-rose-950/60 rounded-2xl flex items-center justify-center mb-4 mx-auto sm:mx-0">
              <Trash2 className="h-7 w-7 text-rose-600 dark:text-rose-400" />
            </div>
            <DialogTitle className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
              Delete Selected Repairs?
            </DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400 text-sm pt-2 leading-relaxed">
              You are about to permanently delete <strong>{selectedRepairIds.size}</strong> repair record(s). This action will remove all associated logs, notes, and payment records. Customer accounts will not be affected.
            </DialogDescription>
          </DialogHeader>

          {selectedRepairsList.length > 0 && (
            <div className="max-h-44 overflow-y-auto p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1.5 my-2">
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                Selected Repairs ({selectedRepairsList.length}):
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selectedRepairsList.map(rep => (
                  <Badge key={rep.id} variant="secondary" className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono text-xs py-0.5 px-2 font-bold shadow-2xs">
                    #{rep.repairNumber} — {rep.deviceBrand} {rep.deviceModel}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsBulkDeleteModalOpen(false)}
              disabled={bulkDeleteLoading}
              className="h-11 rounded-xl border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 font-bold"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleBulkDeleteRepairs}
              disabled={bulkDeleteLoading}
              className="h-11 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold px-6 shadow-sm"
            >
              {bulkDeleteLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting...
                </span>
              ) : (
                `Delete Repairs (${selectedRepairIds.size})`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 2: UPDATE STATUS MODAL                                              */}
      {/* ========================================================================= */}
      <Dialog open={!!statusModalRepair} onOpenChange={(open) => !open && setStatusModalRepair(null)}>
        <DialogContent className="rounded-3xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-6 sm:p-8 max-w-md">
          <DialogHeader>
            <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/60 rounded-2xl flex items-center justify-center mb-3">
              <PackageCheck className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <DialogTitle className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
              Update Repair Status
            </DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400 text-xs">
              Job #{statusModalRepair?.repairNumber} — {statusModalRepair?.deviceBrand} {statusModalRepair?.deviceModel}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-3">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Select New Status</Label>
              <Select value={newStatusValue} onValueChange={setNewStatusValue}>
                <SelectTrigger className="h-11 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-semibold">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  {Object.keys(statusConfig).map((stKey) => (
                    <SelectItem key={stKey} value={stKey} className="text-slate-800 dark:text-slate-200 focus:bg-slate-100 dark:focus:bg-slate-800">
                      {statusConfig[stKey].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Status Update Note (Optional)</Label>
              <Textarea
                placeholder="Reason or technical remarks for this status transition..."
                value={statusUpdateNote}
                onChange={(e) => setStatusUpdateNote(e.target.value)}
                className="rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs min-h-[80px]"
              />
            </div>
          </div>

          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setStatusModalRepair(null)}
              disabled={statusUpdateLoading}
              className="h-10 rounded-xl border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 font-bold text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveStatusUpdate}
              disabled={statusUpdateLoading}
              className="h-10 rounded-xl bg-slate-900 hover:bg-black dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white font-bold text-xs px-5 shadow-sm"
            >
              {statusUpdateLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Status'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 3: ASSIGN / REASSIGN TECHNICIAN                                     */}
      {/* ========================================================================= */}
      <Dialog open={!!assignModalRepair} onOpenChange={(open) => !open && setAssignModalRepair(null)}>
        <DialogContent className="rounded-3xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-6 sm:p-8 max-w-md">
          <DialogHeader>
            <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950/60 rounded-2xl flex items-center justify-center mb-3">
              <User className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <DialogTitle className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
              Assign Repair Specialist
            </DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400 text-xs">
              Job #{assignModalRepair?.repairNumber} ({assignModalRepair?.customerName})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 my-3">
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Choose Specialist</Label>
            <Select value={selectedTechId} onValueChange={setSelectedTechId}>
              <SelectTrigger className="h-11 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-medium">
                <SelectValue placeholder="Select technician" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <SelectItem value="UNASSIGNED" className="text-slate-800 dark:text-slate-200 focus:bg-slate-100 dark:focus:bg-slate-800">— Unassigned —</SelectItem>
                {technicians.map((tech: any) => (
                  <SelectItem key={tech.id} value={tech.id} className="text-slate-800 dark:text-slate-200 focus:bg-slate-100 dark:focus:bg-slate-800">
                    {tech.name} ({tech.email || 'Technician'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setAssignModalRepair(null)}
              disabled={assignLoading}
              className="h-10 rounded-xl border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 font-bold text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveTechnicianAssignment}
              disabled={assignLoading}
              className="h-10 rounded-xl bg-slate-900 hover:bg-black dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white font-bold text-xs px-5 shadow-sm"
            >
              {assignLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm Assignment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 4: EDIT REPAIR INFORMATION                                          */}
      {/* ========================================================================= */}
      {quickEditRepair && (
        <EditRepairModal
          open={!!quickEditRepair}
          onOpenChange={(open) => !open && setQuickEditRepair(null)}
          repair={quickEditRepair}
          onSaved={(updated) => {
            setRepairs(prev => prev.map(r => r.id === updated.id ? { ...r, ...updated } : r));
            setQuickEditRepair(null);
          }}
        />
      )}

      {/* Service Slip Modal */}
      {selectedSlipRepair && (
        <ServiceSlipModal
          open={isSlipModalOpen}
          onOpenChange={setIsSlipModalOpen}
          repairs={[selectedSlipRepair]}
          customer={selectedSlipRepair.customer || {
            name: selectedSlipRepair.customerName,
            phone: selectedSlipRepair.customerPhone,
            email: selectedSlipRepair.customerEmail,
            address: selectedSlipRepair.customerAddress
          }}
        />
      )}

      {/* Excel Import & Preview Modal */}
      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 shadow-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-black text-slate-900 dark:text-slate-100">
                  Import Repair Records (Excel .xlsx)
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Upload standard spreadsheet data to bulk register repairs. Existing customers are matched automatically.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-5 my-2">
            {/* File Upload Box */}
            <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 bg-slate-50/60 dark:bg-slate-800/40 rounded-2xl p-6 text-center transition-all">
              <input
                type="file"
                id="repair-excel-upload"
                accept=".xlsx, .xls"
                className="hidden"
                onChange={handleFileSelect}
                disabled={previewLoading || confirmingImport}
              />
              <label
                htmlFor="repair-excel-upload"
                className="cursor-pointer flex flex-col items-center justify-center gap-2"
              >
                <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700">
                  {previewLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <Upload className="h-6 w-6" />
                  )}
                </div>
                <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {importFile ? importFile.name : "Click to choose or drag & drop Excel (.xlsx) file"}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Compatible with Microsoft Excel, Apple Numbers, LibreOffice & Google Sheets export
                </div>
              </label>

              <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>Need the official template?</span>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  disabled={downloadingTemplate}
                  className="font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 underline flex items-center gap-1"
                >
                  <FileDown className="h-3.5 w-3.5" /> Download Blank Template
                </button>
              </div>
            </div>

            {/* Preview Statistics & Results */}
            {previewData && (
              <div className="space-y-4">
                {/* Stats row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-100 dark:bg-slate-800/80 rounded-2xl p-3 text-center border border-slate-200/50 dark:border-slate-700">
                    <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Total Rows</div>
                    <div className="text-2xl font-black text-slate-900 dark:text-slate-100">{previewData.totalRows}</div>
                  </div>
                  <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-2xl p-3 text-center">
                    <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase">Valid to Import</div>
                    <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300">{previewData.validRows}</div>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-2xl p-3 text-center">
                    <div className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase">Duplicates (Skipped)</div>
                    <div className="text-2xl font-black text-amber-700 dark:text-amber-300">{previewData.duplicateRows}</div>
                  </div>
                  <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 rounded-2xl p-3 text-center">
                    <div className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase">Invalid Rows</div>
                    <div className="text-2xl font-black text-rose-700 dark:text-rose-300">{previewData.invalidRows}</div>
                  </div>
                </div>

                {/* Items Preview Table */}
                <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
                  <div className="bg-slate-100 dark:bg-slate-800 px-4 py-2.5 font-bold text-xs text-slate-700 dark:text-slate-300 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
                    <span>Spreadsheet Row Analysis</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
                      Showing {previewData.items?.length || 0} parsed records
                    </span>
                  </div>

                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {previewData.items?.map((item: any, idx: number) => (
                      <div
                        key={idx}
                        className={`p-3 transition-colors ${item.status === 'VALID'
                          ? 'bg-white dark:bg-slate-900 hover:bg-slate-50/80 dark:hover:bg-slate-800/60'
                          : item.status === 'DUPLICATE'
                            ? 'bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-50/70 dark:hover:bg-amber-950/40'
                            : 'bg-rose-50/40 dark:bg-rose-950/20 hover:bg-rose-50/70 dark:hover:bg-rose-950/40'
                          }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-slate-400 dark:text-slate-500 font-bold">Row {item.rowNumber}</span>
                            {item.status === 'VALID' && (
                              <Badge className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 text-[10px]">
                                READY TO IMPORT
                              </Badge>
                            )}
                            {item.status === 'DUPLICATE' && (
                              <Badge className="bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700 text-[10px]">
                                DUPLICATE REPAIR
                              </Badge>
                            )}
                            {item.status === 'INVALID' && (
                              <Badge className="bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-700 text-[10px]">
                                INVALID DATA
                              </Badge>
                            )}
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {item.data?.customerName || 'No Name'}
                            </span>
                            <span className="text-slate-500 dark:text-slate-400 font-mono">
                              ({item.data?.customerPhone || 'No Phone'})
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {item.data?.deviceBrand} {item.data?.deviceModel}
                            </span>
                            <Badge variant="outline" className="text-[10px] font-mono border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                              {item.data?.status || 'PENDING'}
                            </Badge>
                          </div>
                        </div>

                        <div className="mt-1.5 flex flex-wrap items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 gap-2">
                          <div>
                            <span className="font-medium text-slate-700 dark:text-slate-300">Problem:</span> {item.data?.problemDescription || '—'}
                          </div>
                          <div>
                            <span className="font-medium text-slate-700 dark:text-slate-300">Est. Cost:</span> {formatNPR(item.data?.estimatedCost || 0)}
                          </div>
                        </div>

                        {/* Error & Warning Messages */}
                        {item.errors && item.errors.length > 0 && (
                          <div className="mt-2 text-rose-600 dark:text-rose-400 font-medium space-y-0.5 text-[11px] bg-rose-100/60 dark:bg-rose-950/40 p-2 rounded-xl border border-rose-200 dark:border-rose-800">
                            {item.errors.map((err: string, eIdx: number) => (
                              <div key={eIdx} className="flex items-center gap-1.5">
                                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                                <span>{err}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {item.warnings && item.warnings.length > 0 && (
                          <div className="mt-1.5 text-amber-700 dark:text-amber-400 font-medium space-y-0.5 text-[11px] bg-amber-100/60 dark:bg-amber-950/40 p-1.5 rounded-xl border border-amber-200 dark:border-amber-800">
                            {item.warnings.map((warn: string, wIdx: number) => (
                              <div key={wIdx} className="flex items-center gap-1.5">
                                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                                <span>{warn}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsImportModalOpen(false);
                setImportFile(null);
                setPreviewData(null);
              }}
              disabled={confirmingImport}
              className="rounded-xl border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 font-bold text-xs"
            >
              Cancel
            </Button>

            <Button
              type="button"
              onClick={handleExecuteConfirmImport}
              disabled={confirmingImport || !previewData || previewData.validRows === 0}
              className="rounded-xl bg-slate-900 hover:bg-black dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white font-bold text-xs px-6 shadow-md gap-2"
            >
              {confirmingImport ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importing Records...
                </>
              ) : (
                <>
                  <FileCheck2 className="h-4 w-4" />
                  Confirm & Import ({previewData?.validRows || 0} Records)
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 6: COURIER RETURN DISPATCH MODAL                                    */}
      {/* ========================================================================= */}
      <Dialog open={!!courierDispatchModalRepair} onOpenChange={(open) => !open && setCourierDispatchModalRepair(null)}>
        <DialogContent className="rounded-3xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xl p-6 sm:p-8 max-w-lg">
          <form onSubmit={handleSaveCourierDispatch}>
            <DialogHeader>
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 rounded-2xl flex items-center justify-center mb-3">
                <Truck className="h-6 w-6" />
              </div>
              <DialogTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Dispatch Repaired Device via Courier
              </DialogTitle>
              <DialogDescription className="text-slate-500 dark:text-slate-400 text-xs">
                Hand over job <strong>#{courierDispatchModalRepair?.repairNumber}</strong> ({courierDispatchModalRepair?.deviceBrand} {courierDispatchModalRepair?.deviceModel}) to courier logistics for return delivery.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 my-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">

                {/* Courier Partner */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Courier Partner *</Label>
                  <Select
                    value={courierDispatchForm.returnCourierCompany}
                    onValueChange={(v) => setCourierDispatchForm((prev: any) => ({ ...prev, returnCourierCompany: v }))}
                  >
                    <SelectTrigger className="h-10 rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-semibold">
                      <SelectValue placeholder="Select Courier" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl">
                      {[
                        "Nepal Can Move (NCM)",
                        "Sundar Courier",
                        "Nepal Post / GPO",
                        "Pathao Logistics",
                        "Aramex Nepal",
                        "DHL Express",
                        "FedEx / TNT",
                        "Gorkha Express",
                        "Gaura Courier",
                        "Other Courier"
                      ].map(c => (
                        <SelectItem key={c} value={c} className="text-slate-800 dark:text-slate-200 focus:bg-slate-100 dark:focus:bg-slate-800">{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {courierDispatchForm.returnCourierCompany === 'Other Courier' && (
                    <Input
                      placeholder="Specify Courier Name"
                      value={courierDispatchForm.customCourierCompany}
                      onChange={(e) => setCourierDispatchForm((prev: any) => ({ ...prev, customCourierCompany: e.target.value }))}
                      className="h-9 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs mt-1"
                      required
                    />
                  )}
                </div>

                {/* Tracking / Consignment Number */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Tracking / Consignment # *</Label>
                  <Input
                    placeholder="e.g. SCN-982341, TRK-10293"
                    value={courierDispatchForm.returnCourierTrackingNumber}
                    onChange={(e) => setCourierDispatchForm((prev: any) => ({ ...prev, returnCourierTrackingNumber: e.target.value }))}
                    className="h-10 rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-xs font-bold"
                    required
                  />
                </div>

                {/* Dispatch Date */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Dispatch Date *</Label>
                  <Input
                    type="date"
                    value={courierDispatchForm.returnCourierDispatchDate}
                    onChange={(e) => setCourierDispatchForm((prev: any) => ({ ...prev, returnCourierDispatchDate: e.target.value }))}
                    className="h-10 rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs"
                    required
                  />
                </div>

                {/* Destination District */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Destination District</Label>
                  <Input
                    placeholder="e.g. Pokhara, Morang"
                    value={courierDispatchForm.destinationDistrict}
                    onChange={(e) => setCourierDispatchForm((prev: any) => ({ ...prev, destinationDistrict: e.target.value }))}
                    className="h-10 rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs"
                  />
                </div>

                {/* Receiver Name */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Receiver Name</Label>
                  <Input
                    placeholder="Receiver Full Name"
                    value={courierDispatchForm.receiverName}
                    onChange={(e) => setCourierDispatchForm((prev: any) => ({ ...prev, receiverName: e.target.value }))}
                    className="h-10 rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs"
                  />
                </div>

                {/* Receiver Phone */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Receiver Phone</Label>
                  <Input
                    placeholder="Receiver Phone Number"
                    value={courierDispatchForm.receiverPhone}
                    onChange={(e) => setCourierDispatchForm((prev: any) => ({ ...prev, receiverPhone: e.target.value }))}
                    className="h-10 rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-mono"
                  />
                </div>

              </div>

              {/* Destination Address */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Delivery Address</Label>
                <Input
                  placeholder="Full delivery location / address"
                  value={courierDispatchForm.destinationAddress}
                  onChange={(e) => setCourierDispatchForm((prev: any) => ({ ...prev, destinationAddress: e.target.value }))}
                  className="h-10 rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs"
                />
              </div>

              {/* Courier Notes */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Courier Return Notes</Label>
                <Textarea
                  rows={2}
                  placeholder="e.g. Fragile glass sticker attached, bubble wrap 3-layers"
                  value={courierDispatchForm.returnCourierNotes}
                  onChange={(e) => setCourierDispatchForm((prev: any) => ({ ...prev, returnCourierNotes: e.target.value }))}
                  className="rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-medium"
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCourierDispatchModalRepair(null)}
                disabled={courierDispatchLoading}
                className="h-10 rounded-xl border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={courierDispatchLoading}
                className="h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 shadow-sm flex items-center gap-1.5"
              >
                {courierDispatchLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Dispatching...</span>
                  </>
                ) : (
                  <>
                    <Truck className="h-3.5 w-3.5" />
                    <span>Confirm Courier Dispatch</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 7: RE-PROBLEM / WARRANTY INTAKE MODAL                                 */}
      {/* ========================================================================= */}
      <Dialog open={!!reProblemModalRepair} onOpenChange={(open) => !open && setReProblemModalRepair(null)}>
        <DialogContent className="rounded-3xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xl p-6 sm:p-8 max-w-md">
          <form onSubmit={handleSaveReProblem}>
            <DialogHeader>
              <div className="w-12 h-12 bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 rounded-2xl flex items-center justify-center mb-3">
                <RotateCcw className="h-6 w-6" />
              </div>
              <DialogTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Log Re-Problem / Warranty Intake
              </DialogTitle>
              <DialogDescription className="text-slate-500 dark:text-slate-400 text-xs">
                Reopen job <strong>#{reProblemModalRepair?.repairNumber}</strong> ({reProblemModalRepair?.deviceBrand} {reProblemModalRepair?.deviceModel}) for priority warranty re-inspection.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 my-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Problem Category / Reason *</Label>
                <Input
                  placeholder="e.g. Touch stopped working after 4 days"
                  value={reProblemReason}
                  onChange={(e) => setReProblemReason(e.target.value)}
                  className="h-10 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-medium"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Diagnostic Details & Customer Description</Label>
                <Textarea
                  rows={3}
                  placeholder="Describe the issue reported by the customer for priority engineering review..."
                  value={reProblemDescription}
                  onChange={(e) => setReProblemDescription(e.target.value)}
                  className="rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-medium"
                />
              </div>

              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-900 dark:text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <span>
                  This will reopen the repair with <strong>HIGH PRIORITY</strong> and update the customer tracking timeline for warranty inspection.
                </span>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setReProblemModalRepair(null)}
                disabled={reProblemLoading}
                className="h-10 rounded-xl border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={reProblemLoading}
                className="h-10 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-5 shadow-sm flex items-center gap-1.5"
              >
                {reProblemLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Logging...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Submit Re-Problem Intake</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 7: SEND CUSTOMER SMS MODAL (GOOGLE MESSAGES FOR WEB)                */}
      {/* ========================================================================= */}
      {smsModalRepair && (
        <SendSmsModal
          open={isSmsModalOpen}
          onOpenChange={setIsSmsModalOpen}
          repair={smsModalRepair}
          onSuccess={() => {
            fetchData(true);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 8: CANCEL REPAIR CONFIRMATION MODAL                                  */}
      {/* ========================================================================= */}
      <Dialog open={!!cancelModalRepair} onOpenChange={(open) => !open && setCancelModalRepair(null)}>
        <DialogContent className="rounded-3xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xl p-6 sm:p-8 max-w-lg">
          <DialogHeader>
            <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-2xl flex items-center justify-center mb-3">
              <Ban className="h-6 w-6 text-rose-600 dark:text-rose-400" />
            </div>
            <DialogTitle className="text-xl font-black text-slate-900 dark:text-slate-100">
              Cancel Repair Service?
            </DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400 text-xs mt-1">
              Job #{cancelModalRepair?.repairNumber} — {cancelModalRepair?.deviceBrand} {cancelModalRepair?.deviceModel} ({cancelModalRepair?.customerName || 'Customer'})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-3">
            <div className="p-3.5 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-2xl text-xs text-amber-900 dark:text-amber-300 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1 leading-relaxed">
                <p className="font-bold text-amber-950 dark:text-amber-200">Active Queue Removal</p>
                <p>
                  This repair ticket will be marked as <strong>CANCELLED</strong> and removed from active repair queues and technician benches. Customer history, hardware notes, and diagnostic records remain securely preserved in the database.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Reason for Cancellation</Label>
              <Select value={cancellationReasonPreset} onValueChange={setCancellationReasonPreset}>
                <SelectTrigger className="h-11 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-semibold">
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <SelectItem value="Customer cancelled / withdrew repair" className="text-slate-800 dark:text-slate-200 focus:bg-slate-100 dark:focus:bg-slate-800">Customer cancelled / withdrew repair</SelectItem>
                  <SelectItem value="Customer did not approve estimate / quote" className="text-slate-800 dark:text-slate-200 focus:bg-slate-100 dark:focus:bg-slate-800">Customer did not approve estimate / quote</SelectItem>
                  <SelectItem value="Device collected unrepaired" className="text-slate-800 dark:text-slate-200 focus:bg-slate-100 dark:focus:bg-slate-800">Device collected unrepaired</SelectItem>
                  <SelectItem value="Duplicate repair entry" className="text-slate-800 dark:text-slate-200 focus:bg-slate-100 dark:focus:bg-slate-800">Duplicate repair entry</SelectItem>
                  <SelectItem value="Parts unavailable / repair unfeasible" className="text-slate-800 dark:text-slate-200 focus:bg-slate-100 dark:focus:bg-slate-800">Parts unavailable / repair unfeasible</SelectItem>
                  <SelectItem value="Incorrect entry / wrong ticket" className="text-slate-800 dark:text-slate-200 focus:bg-slate-100 dark:focus:bg-slate-800">Incorrect entry / wrong ticket</SelectItem>
                  <SelectItem value="Other reason" className="text-slate-800 dark:text-slate-200 focus:bg-slate-100 dark:focus:bg-slate-800">Other reason</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Additional Remarks & Explanation (Optional)</Label>
              <Textarea
                rows={3}
                placeholder="Specific customer feedback, parts context, or cancellation details..."
                value={cancellationCustomNotes}
                onChange={(e) => setCancellationCustomNotes(e.target.value)}
                className="rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-medium"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCancelModalRepair(null)}
              disabled={cancellationLoading}
              className="h-10 rounded-xl border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 text-xs font-bold"
            >
              Cancel Action
            </Button>
            <Button
              type="button"
              onClick={handleConfirmCancellation}
              disabled={cancellationLoading}
              className="h-10 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-5 shadow-sm flex items-center gap-1.5"
            >
              {cancellationLoading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Ban className="h-3.5 w-3.5" />
                  <span>Confirm Cancellation</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}