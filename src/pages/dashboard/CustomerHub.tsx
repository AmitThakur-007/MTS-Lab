import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  User,
  Phone,
  MapPin,
  Clock,
  Plus,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Smartphone,
  History,
  X,
  Filter,
  ArrowUpDown,
  Save,
  UserPlus,
  Archive,
  Edit3,
  RotateCcw,
  Trash2,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Users,
  LayoutGrid,
  Table as TableIcon,
  Copy,
  ExternalLink,
  RefreshCw,
  Eye,
  CheckSquare,
  Square,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { api } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { useDashboardCache } from '@/store/dashboardCache';
import { toast } from 'sonner';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { useRealtimeSync } from '@/services/realtime';
import DashboardRefreshButton from '@/components/DashboardRefreshButton';
import { motion, AnimatePresence } from 'motion/react';

const NEPAL_DISTRICTS = [
  'Kathmandu', 'Lalitpur', 'Bhaktapur', 'Morang', 'Sunsari', 'Jhapa', 'Kaski',
  'Chitwan', 'Rupandehi', 'Dhanusha', 'Parsa', 'Makwanpur', 'Banke', 'Kailali',
  'Kanchanpur', 'Nawalparasi', 'Mahottari', 'Sarlahi', 'Siraha', 'Bara', 'Rautahat',
  'Kavrepalanchok', 'Nuwakot', 'Dhading', 'Sindhupalchok', 'Tanahun', 'Gorkha',
  'Syangja', 'Palpa', 'Gulmi', 'Baglung', 'Dang', 'Surkhet', 'Bardiya',
];

interface CustomerStats {
  totalCustomers: number;
  totalArchived: number;
  totalAll: number;
  addedToday: number;
  addedThisMonth: number;
  withRepairs: number;
  withoutRepairs: number;
  returningCustomers: number;
}

export default function CustomerHub() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isAdminOrManager = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(user?.role || '');

  // Core Data State
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [stats, setStats] = useState<CustomerStats>({
    totalCustomers: 0,
    totalArchived: 0,
    totalAll: 0,
    addedToday: 0,
    addedThisMonth: 0,
    withRepairs: 0,
    withoutRepairs: 0,
    returningCustomers: 0,
  });

  // Query & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [districtFilter, setDistrictFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'ARCHIVED' | 'ALL'>('ACTIVE');
  const [timeFilter, setTimeFilter] = useState<'ALL' | 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'WITH_REPAIRS' | 'WITHOUT_REPAIRS'>('ALL');
  const [notificationFilter, setNotificationFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Multi-Selection State for Bulk Actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Search debounce ref
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Dialog States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);

  // Selected item for Edit / Delete
  const [customerToEdit, setCustomerToEdit] = useState<any>(null);
  const [customerToDelete, setCustomerToDelete] = useState<any>(null);

  // Form State for Add / Edit
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    alternativePhone: '',
    email: '',
    district: 'Kathmandu',
    municipality: '',
    address: '',
    landmark: '',
    notes: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [permanentDeleteZeroRepairs, setPermanentDeleteZeroRepairs] = useState(false);

  // Fetch Summary Statistics
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const data: any = await api.get('/customers/stats');
      if (data) {
        setStats({
          totalCustomers: data.totalCustomers || 0,
          totalArchived: data.totalArchived || 0,
          totalAll: data.totalAll || 0,
          addedToday: data.addedToday || 0,
          addedThisMonth: data.addedThisMonth || 0,
          withRepairs: data.withRepairs || 0,
          withoutRepairs: data.withoutRepairs || 0,
          returningCustomers: data.returningCustomers || 0,
        });
      }
    } catch (err) {
      console.error('[STATS FETCH ERROR]', err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Fetch Customers List
  const fetchCustomers = useCallback(
    async (
      query = searchQuery,
      dist = districtFilter,
      stat = statusFilter,
      filter = timeFilter,
      sort = sortBy,
      order = sortOrder,
      requestedPage = page,
      pageLimit = limit,
      isBackground = false,
      notifFilter = notificationFilter
    ) => {
      if (!isBackground) setLoading(true);
      try {
        const params = new URLSearchParams();
        if (query) params.set('search', query);
        if (dist && dist !== 'ALL') params.set('district', dist);
        params.set('status', stat);
        if (filter !== 'ALL') params.set('filter', filter);
        if (notifFilter && notifFilter !== 'ALL') params.set('notificationFilter', notifFilter);
        params.set('sortBy', sort);
        params.set('sortOrder', order);
        params.set('page', String(requestedPage));
        params.set('limit', String(pageLimit));

        const res: any = await api.get(`/customers?${params.toString()}`);
        const list = Array.isArray(res) ? res : (Array.isArray(res?.customers) ? res.customers : []);
        const total = res?.total ?? list.length;
        const totalP = res?.totalPages ?? Math.max(1, Math.ceil(total / pageLimit));
        setCustomers(list);
        setTotalCount(total);
        setTotalPages(totalP);

        // Cache initial or un-filtered view
        if (!query && dist === 'ALL' && stat === 'ACTIVE' && filter === 'ALL' && notifFilter === 'ALL' && requestedPage === 1) {
          useDashboardCache.getState().setCustomers({
            list,
            total,
            totalPages: totalP,
          }, user?.id);
        }
      } catch (err: any) {
        toast.error(err.message || 'Failed to load customers');
      } finally {
        if (!isBackground) setLoading(false);
      }
    },
    [searchQuery, districtFilter, statusFilter, timeFilter, notificationFilter, sortBy, sortOrder, page, limit, user?.id]
  );

  useEffect(() => {
    const cached = useDashboardCache.getState().customers;
    const isCachedValid = cached.userId === user?.id && cached.list && cached.list.length > 0;
    if (isCachedValid) {
      setCustomers(cached.list);
      if (cached.stats) setStats(cached.stats);
      setTotalCount(cached.total);
      setTotalPages(cached.totalPages);
      setLoading(false);
      // Quiet background revalidation if stale
      if (useDashboardCache.getState().isStale('customers', user?.id, 90 * 1000)) {
        fetchStats();
        fetchCustomers(searchQuery, districtFilter, statusFilter, timeFilter, sortBy, sortOrder, page, limit, true);
      }
    } else {
      fetchStats();
      fetchCustomers();
    }
  }, []);

  // Real-time synchronization
  useRealtimeSync(['customer', 'customers', 'repair'], () => {
    fetchStats();
    fetchCustomers(searchQuery, districtFilter, statusFilter, timeFilter, sortBy, sortOrder, page, limit, true);
  });

  // Handle Search Input Change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    setPage(1);

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    searchDebounceRef.current = setTimeout(() => {
      fetchCustomers(val, districtFilter, statusFilter, timeFilter, sortBy, sortOrder, 1, limit);
    }, 350);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setPage(1);
    fetchCustomers('', districtFilter, statusFilter, timeFilter, sortBy, sortOrder, 1, limit);
  };

  // Quick Stat Click (filters list accordingly)
  const handleStatClick = (filterType: 'ALL' | 'TODAY' | 'THIS_MONTH' | 'WITH_REPAIRS' | 'ARCHIVED') => {
    setPage(1);
    if (filterType === 'ARCHIVED') {
      setStatusFilter('ARCHIVED');
      setTimeFilter('ALL');
      fetchCustomers(searchQuery, districtFilter, 'ARCHIVED', 'ALL', sortBy, sortOrder, 1, limit);
    } else {
      setStatusFilter('ACTIVE');
      setTimeFilter(filterType === 'ALL' ? 'ALL' : filterType);
      fetchCustomers(searchQuery, districtFilter, 'ACTIVE', filterType === 'ALL' ? 'ALL' : filterType, sortBy, sortOrder, 1, limit);
    }
  };

  // Selection Logic
  const handleSelectAllOnPage = () => {
    if (selectedIds.size === customers.length && customers.length > 0) {
      setSelectedIds(new Set());
    } else {
      const allIds = new Set(customers.map(c => c.id));
      setSelectedIds(allIds);
    }
  };

  const toggleSelectCustomer = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  // Phone Validation Helper
  const validatePhone = (phoneStr: string): boolean => {
    const cleaned = phoneStr.trim().replace(/[\s\-\(\)\.]/g, '');
    const stripped = cleaned.startsWith('+977') ? cleaned.substring(4) : (cleaned.startsWith('977') && cleaned.length > 10 ? cleaned.substring(3) : cleaned);
    return /^(98|97)\d{8}$/.test(stripped) || /^0\d{7,8}$/.test(stripped);
  };

  // Open Add Dialog
  const handleOpenAdd = () => {
    setFormData({
      name: '',
      phone: '',
      alternativePhone: '',
      email: '',
      district: 'Kathmandu',
      municipality: '',
      address: '',
      landmark: '',
      notes: '',
    });
    setFormErrors({});
    setIsAddOpen(true);
  };

  // Open Edit Dialog
  const handleOpenEdit = (customer: any) => {
    setCustomerToEdit(customer);
    setFormData({
      name: customer.name || '',
      phone: customer.phone || '',
      alternativePhone: customer.alternativePhone || '',
      email: customer.email || '',
      district: customer.district || 'Kathmandu',
      municipality: customer.municipality || '',
      address: customer.address || '',
      landmark: customer.landmark || '',
      notes: customer.notes || '',
    });
    setFormErrors({});
    setIsEditOpen(true);
  };

  // Save New Customer
  const handleSaveNewCustomer = async () => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim() || formData.name.trim().length < 2) {
      errors.name = 'Full name must be at least 2 characters.';
    }
    if (!formData.phone.trim()) {
      errors.phone = 'Phone number is required.';
    } else if (!validatePhone(formData.phone)) {
      errors.phone = 'Invalid Nepal phone. Must be a 10-digit mobile (98/97) or landline (e.g. 01XXXXXXX).';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setSaving(true);
    try {
      const res: any = await api.post('/customers', formData);
      toast.success(`Customer "${res.name}" created successfully (${res.customerId}).`);
      setIsAddOpen(false);
      fetchStats();
      fetchCustomers();
    } catch (err: any) {
      if (err.response?.status === 409 || err.message?.includes('already exists')) {
        toast.error(err.message || 'A customer with this phone number already exists.');
        setFormErrors({ phone: 'A customer with this phone number already exists.' });
      } else {
        toast.error(err.message || 'Failed to create customer');
      }
    } finally {
      setSaving(false);
    }
  };

  // Save Edited Customer
  const handleSaveEditCustomer = async () => {
    if (!customerToEdit) return;
    const errors: Record<string, string> = {};
    if (!formData.name.trim() || formData.name.trim().length < 2) {
      errors.name = 'Full name must be at least 2 characters.';
    }
    if (!formData.phone.trim()) {
      errors.phone = 'Phone number is required.';
    } else if (!validatePhone(formData.phone)) {
      errors.phone = 'Invalid Nepal phone number.';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setSaving(true);
    try {
      const res: any = await api.patch(`/customers/${customerToEdit.id}`, formData);
      toast.success(`Customer "${res.name}" updated successfully.`);
      setIsEditOpen(false);
      fetchCustomers();
    } catch (err: any) {
      if (err.response?.status === 409) {
        toast.error(err.message || 'Phone number conflict with another customer.');
        setFormErrors({ phone: 'Another customer is already using this phone number.' });
      } else {
        toast.error(err.message || 'Failed to update customer');
      }
    } finally {
      setSaving(false);
    }
  };

  // Open Single Delete Dialog
  const handleOpenDelete = (customer: any) => {
    setCustomerToDelete(customer);
    setPermanentDeleteZeroRepairs(false);
    setIsDeleteOpen(true);
  };

  // Execute Single Delete / Archive
  const handleConfirmSingleDelete = async () => {
    if (!customerToDelete) return;
    setDeleting(true);
    try {
      const res: any = await api.delete(`/customers/${customerToDelete.id}`);
      if (res.archived) {
        toast.info(res.message || 'Customer was safely archived to protect warranty & repair records.');
      } else {
        toast.success(res.message || 'Customer deleted successfully.');
      }
      setIsDeleteOpen(false);
      setCustomerToDelete(null);
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(customerToDelete.id);
        return next;
      });
      fetchStats();
      fetchCustomers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to process deletion');
    } finally {
      setDeleting(false);
    }
  };

  // Execute Restore
  const handleRestore = async (customer: any) => {
    try {
      await api.post(`/customers/${customer.id}/restore`, {});
      toast.success(`Customer "${customer.name}" restored successfully.`);
      fetchStats();
      fetchCustomers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to restore customer');
    }
  };

  // Execute Bulk Delete / Archive
  const handleConfirmBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      const res: any = await api.post('/customers/bulk-delete', {
        customerIds: ids,
        permanent: isSuperAdmin && permanentDeleteZeroRepairs,
      });

      toast.success(res.message || `Processed ${ids.length} records.`);
      setIsBulkDeleteOpen(false);
      setSelectedIds(new Set());
      fetchStats();
      fetchCustomers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to process bulk deletion');
    } finally {
      setDeleting(false);
    }
  };

  // Copy Phone Helper
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  // Selected customers breakdown for bulk delete modal
  const selectedCustomersBreakdown = useMemo(() => {
    const selectedList = customers.filter(c => selectedIds.has(c.id));
    const withRepairsCount = selectedList.filter(c => (c.totalRepairs || 0) > 0).length;
    const zeroRepairsCount = selectedList.length - withRepairsCount;
    return { selectedList, withRepairsCount, zeroRepairsCount };
  }, [customers, selectedIds]);

  return (
    <div className="min-h-screen bg-slate-50/60 dark:bg-slate-950 px-3 sm:px-6 py-4 sm:py-6 space-y-6">
      
      {/* Top Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-slate-900 text-white dark:bg-slate-800 dark:text-blue-400 shadow-xs">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Customer Hub
                <Badge variant="outline" className="text-xs font-semibold px-2 py-0.5 rounded-full border-slate-300 dark:border-slate-700">
                  {stats.totalCustomers} Active
                </Badge>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Centralized customer registry, repair histories, Nepal contact verification & audit-protected records.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <DashboardRefreshButton
            onRefresh={() => {
              fetchStats();
              fetchCustomers();
            }}
          />

          {isAdminOrManager && (
            <Button
              onClick={handleOpenAdd}
              className="h-10 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-blue-600 dark:hover:bg-blue-700 font-semibold text-xs sm:text-sm shadow-sm transition-all cursor-pointer flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Customer</span>
            </Button>
          )}
        </div>
      </div>

      {/* Overview Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total Active Customers */}
        <div
          onClick={() => handleStatClick('ALL')}
          className={cn(
            "p-4 rounded-2xl bg-white dark:bg-slate-900 border transition-all cursor-pointer shadow-xs hover:shadow-md",
            statusFilter === 'ACTIVE' && timeFilter === 'ALL'
              ? "border-blue-500 ring-2 ring-blue-500/10 dark:border-blue-500"
              : "border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Customers
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              {statsLoading ? '...' : stats.totalCustomers}
            </span>
            <span className="text-xs text-slate-400">registered</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{stats.returningCustomers}</span> returning clients
          </div>
        </div>

        {/* Card 2: Added Today */}
        <div
          onClick={() => handleStatClick('TODAY')}
          className={cn(
            "p-4 rounded-2xl bg-white dark:bg-slate-900 border transition-all cursor-pointer shadow-xs hover:shadow-md",
            timeFilter === 'TODAY'
              ? "border-emerald-500 ring-2 ring-emerald-500/10 dark:border-emerald-500"
              : "border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Added Today
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              {statsLoading ? '...' : stats.addedToday}
            </span>
            <span className="text-xs text-slate-400">new today</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Intake since 00:00 UTC
          </div>
        </div>

        {/* Card 3: Added This Month */}
        <div
          onClick={() => handleStatClick('THIS_MONTH')}
          className={cn(
            "p-4 rounded-2xl bg-white dark:bg-slate-900 border transition-all cursor-pointer shadow-xs hover:shadow-md",
            timeFilter === 'THIS_MONTH'
              ? "border-purple-500 ring-2 ring-purple-500/10 dark:border-purple-500"
              : "border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Added This Month
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              {statsLoading ? '...' : stats.addedThisMonth}
            </span>
            <span className="text-xs text-slate-400">this month</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Active month customer intake
          </div>
        </div>

        {/* Card 4: Customers With Repairs */}
        <div
          onClick={() => handleStatClick('WITH_REPAIRS')}
          className={cn(
            "p-4 rounded-2xl bg-white dark:bg-slate-900 border transition-all cursor-pointer shadow-xs hover:shadow-md",
            timeFilter === 'WITH_REPAIRS'
              ? "border-amber-500 ring-2 ring-amber-500/10 dark:border-amber-500"
              : "border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              With Repair History
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <History className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              {statsLoading ? '...' : stats.withRepairs}
            </span>
            <span className="text-xs text-slate-400">clients</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            {stats.withoutRepairs} registered with 0 repairs
          </div>
        </div>
      </div>

      {/* Filter & Control Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3.5">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <Input
              type="text"
              placeholder="Search by name, phone (98XXXXXXXX or +977), CUS-ID, or email..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="pl-10 pr-9 h-10 rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-xs sm:text-sm font-medium focus:bg-white dark:focus:bg-slate-900 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* District & Status Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <Select
              value={districtFilter}
              onValueChange={val => {
                setDistrictFilter(val);
                setPage(1);
                fetchCustomers(searchQuery, val, statusFilter, timeFilter, sortBy, sortOrder, 1, limit);
              }}
            >
              <SelectTrigger className="w-[140px] h-10 rounded-xl border-slate-200 dark:border-slate-800 text-xs font-semibold cursor-pointer">
                <MapPin className="w-3.5 h-3.5 mr-1 text-slate-400" />
                <SelectValue placeholder="District" />
              </SelectTrigger>
              <SelectContent className="rounded-xl max-h-56">
                <SelectItem value="ALL" className="text-xs font-semibold">All Districts</SelectItem>
                {NEPAL_DISTRICTS.map(d => (
                  <SelectItem key={d} value={d} className="text-xs font-medium">{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={statusFilter}
              onValueChange={(val: any) => {
                setStatusFilter(val);
                setPage(1);
                fetchCustomers(searchQuery, districtFilter, val, timeFilter, sortBy, sortOrder, 1, limit, false, notificationFilter);
              }}
            >
              <SelectTrigger className="w-[125px] h-10 rounded-xl border-slate-200 dark:border-slate-800 text-xs font-semibold cursor-pointer">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="ACTIVE" className="text-xs font-medium">Active Only</SelectItem>
                <SelectItem value="ARCHIVED" className="text-xs font-medium">Archived Only</SelectItem>
                <SelectItem value="ALL" className="text-xs font-medium">All (Inc. Archived)</SelectItem>
              </SelectContent>
            </Select>

            {/* Notification Filter */}
            <Select
              value={notificationFilter}
              onValueChange={(val: string) => {
                setNotificationFilter(val);
                setPage(1);
                fetchCustomers(searchQuery, districtFilter, statusFilter, timeFilter, sortBy, sortOrder, 1, limit, false, val);
              }}
            >
              <SelectTrigger className="w-[155px] h-10 rounded-xl border-slate-200 dark:border-slate-800 text-xs font-semibold cursor-pointer">
                <SelectValue placeholder="Notification" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="ALL" className="text-xs font-medium">All Messages</SelectItem>
                <SelectItem value="BOTH_SENT" className="text-xs font-medium">Both Sent (SMS+WA)</SelectItem>
                <SelectItem value="SMS_SENT_ONLY" className="text-xs font-medium">SMS Sent Only</SelectItem>
                <SelectItem value="WHATSAPP_SENT_ONLY" className="text-xs font-medium">WhatsApp Sent Only</SelectItem>
                <SelectItem value="AWAITING_CONFIRMATION" className="text-xs font-medium">Awaiting Confirmation</SelectItem>
                <SelectItem value="NEITHER_SENT" className="text-xs font-medium">Neither Sent</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={sortBy}
              onValueChange={val => {
                setSortBy(val);
                setPage(1);
                fetchCustomers(searchQuery, districtFilter, statusFilter, timeFilter, val, sortOrder, 1, limit);
              }}
            >
              <SelectTrigger className="w-[145px] h-10 rounded-xl border-slate-200 dark:border-slate-800 text-xs font-semibold cursor-pointer">
                <ArrowUpDown className="w-3.5 h-3.5 mr-1 text-slate-400" />
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="createdAt" className="text-xs font-medium">Registration Date</SelectItem>
                <SelectItem value="updatedAt" className="text-xs font-medium">Last Activity</SelectItem>
                <SelectItem value="name" className="text-xs font-medium">Name (A-Z)</SelectItem>
                <SelectItem value="totalRepairs" className="text-xs font-medium">Repair Count</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort Order Toggle */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                const nextOrder = sortOrder === 'asc' ? 'desc' : 'asc';
                setSortOrder(nextOrder);
                setPage(1);
                fetchCustomers(searchQuery, districtFilter, statusFilter, timeFilter, sortBy, nextOrder, 1, limit);
              }}
              className="h-10 w-10 rounded-xl border-slate-200 dark:border-slate-800 cursor-pointer"
              title={sortOrder === 'asc' ? 'Ascending (Click for Descending)' : 'Descending (Click for Ascending)'}
            >
              <span className="text-xs font-bold">{sortOrder === 'asc' ? '↑' : '↓'}</span>
            </Button>

            {/* View Mode Toggle */}
            <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-800 p-0.5 bg-slate-50 dark:bg-slate-950">
              <button
                onClick={() => setViewMode('table')}
                className={cn(
                  "p-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer",
                  viewMode === 'table'
                    ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                )}
                title="Table View"
              >
                <TableIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={cn(
                  "p-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer",
                  viewMode === 'cards'
                    ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                )}
                title="Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Quick Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'ALL', label: 'All Records' },
            { id: 'TODAY', label: 'Added Today' },
            { id: 'THIS_WEEK', label: 'Added This Week' },
            { id: 'THIS_MONTH', label: 'Added This Month' },
            { id: 'WITH_REPAIRS', label: 'With Repairs' },
            { id: 'WITHOUT_REPAIRS', label: 'No Repairs (0)' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setTimeFilter(tab.id as any);
                setPage(1);
                fetchCustomers(searchQuery, districtFilter, statusFilter, tab.id as any, sortBy, sortOrder, 1, limit);
              }}
              className={cn(
                "px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all cursor-pointer",
                timeFilter === tab.id
                  ? "bg-slate-900 text-white dark:bg-blue-600 dark:text-white shadow-xs"
                  : "bg-slate-100 hover:bg-slate-200/80 text-slate-600 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-800"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Floating Bulk Action Bar (when records are selected) */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="sticky top-4 z-30 p-3.5 rounded-2xl bg-slate-950 text-white dark:bg-blue-950 border border-slate-800 dark:border-blue-800 shadow-xl flex flex-wrap items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 font-bold text-xs">
                {selectedIds.size}
              </span>
              <span className="text-xs sm:text-sm font-semibold">
                {selectedIds.size} customer{selectedIds.size !== 1 ? 's' : ''} selected
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSelection}
                className="h-8 text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                Clear Selection
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => setIsBulkDeleteOpen(true)}
                className="h-8 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Bulk Archive / Delete</span>
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area: Table View or Cards View */}
      {loading ? (
        <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500 mb-3" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading customer records...</p>
        </div>
      ) : customers.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            {searchQuery ? 'No customers found matching search' : 'No customers in registry yet'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            {searchQuery
              ? `No records found for "${searchQuery}". Try searching by a different name, phone, or customer ID.`
              : 'Add your first customer to track smartphone repairs, warranties, and contact details.'}
          </p>
          {isAdminOrManager && (
            <Button
              onClick={handleOpenAdd}
              className="mt-2 h-9 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Add Customer
            </Button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[840px]">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-3.5 px-4 w-12 text-center">
                    <button
                      onClick={handleSelectAllOnPage}
                      className="cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      title="Select all on current page"
                    >
                      {selectedIds.size === customers.length && customers.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="py-3.5 px-4">Customer ID</th>
                  <th className="py-3.5 px-4">Customer Name</th>
                  <th className="py-3.5 px-4">Phone & Contacts</th>
                  <th className="py-3.5 px-4">Location</th>
                  <th className="py-3.5 px-4 text-center">Repairs</th>
                  <th className="py-3.5 px-4">Notifications</th>
                  <th className="py-3.5 px-4">Registered</th>
                  <th className="py-3.5 px-4">Last Activity</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs text-slate-700 dark:text-slate-300">
                {customers.map((c: any) => {
                  const isSelected = selectedIds.has(c.id);
                  const isArchived = !!c.archived;
                  const totalRepairs = c.totalRepairs || 0;

                  return (
                    <tr
                      key={c.id}
                      className={cn(
                        "transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40",
                        isSelected && "bg-blue-50/50 dark:bg-blue-950/20",
                        isArchived && "opacity-75 bg-slate-50/40 dark:bg-slate-950/30"
                      )}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => toggleSelectCustomer(c.id)}
                          className="cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* Customer ID */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                        <button
                          onClick={() => navigate(`/dashboard/customers/${c.id}`)}
                          className="hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer inline-flex items-center gap-1"
                        >
                          {c.customerId || 'CUS-???'}
                          <ExternalLink className="w-3 h-3 text-slate-400 opacity-60" />
                        </button>
                      </td>

                      {/* Name & Badge */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-[11px] text-slate-700 dark:text-slate-300 shrink-0">
                            {c.name ? c.name.charAt(0).toUpperCase() : 'C'}
                          </div>
                          <div>
                            <span
                              onClick={() => navigate(`/dashboard/customers/${c.id}`)}
                              className="font-bold text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
                            >
                              {c.name}
                            </span>
                            {isArchived && (
                              <span className="ml-1.5 px-1.5 py-0.2 rounded-sm bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 text-[10px] font-bold uppercase">
                                Archived
                              </span>
                            )}
                            {c.email && (
                              <p className="text-[11px] text-slate-400 truncate max-w-[160px]">{c.email}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="py-3.5 px-4 font-medium">
                        <div className="flex items-center gap-1.5">
                          <span>{c.phone}</span>
                          <button
                            onClick={() => copyToClipboard(c.phone, 'Phone number')}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
                            title="Copy phone"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                        {c.alternativePhone && (
                          <span className="text-[10px] text-slate-400 block">Alt: {c.alternativePhone}</span>
                        )}
                      </td>

                      {/* Location */}
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {c.district || 'Kathmandu'}
                        </span>
                        {c.municipality && (
                          <span className="text-[11px] text-slate-400 block truncate max-w-[140px]">
                            {c.municipality}
                          </span>
                        )}
                      </td>

                      {/* Total Repairs Badge */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => navigate(`/dashboard/customers/${c.id}`)}
                          className="cursor-pointer"
                        >
                          <Badge
                            variant="secondary"
                            className={cn(
                              "text-xs font-bold px-2 py-0.5 rounded-full cursor-pointer transition-colors",
                              totalRepairs > 0
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800 hover:bg-emerald-100"
                                : "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                            )}
                          >
                            {totalRepairs} repair{totalRepairs !== 1 ? 's' : ''}
                          </Badge>
                        </button>
                      </td>

                      {/* Notification Status (SMS & WhatsApp) */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex flex-col items-start gap-1">
                          {c.smsStatus === 'SENT' ? (
                            <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 font-bold text-[10px] py-0.5 px-2 gap-1 shadow-2xs">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              <span>SMS: Sent</span>
                            </Badge>
                          ) : c.smsStatus === 'OPENED' ? (
                            <Badge variant="outline" className="bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-700 font-bold text-[10px] py-0.5 px-2 gap-1 shadow-2xs">
                              <Clock className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                              <span>SMS: Awaiting Conf.</span>
                            </Badge>
                          ) : c.smsStatus === 'FAILED' ? (
                            <Badge variant="outline" className="bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-700 font-bold text-[10px] py-0.5 px-2 gap-1 shadow-2xs">
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              <span>SMS: Failed</span>
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 font-bold text-[10px] py-0.5 px-2">
                              <span>SMS: Not Sent</span>
                            </Badge>
                          )}

                          {c.whatsappStatus === 'SENT' ? (
                            <Badge variant="outline" className="bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border-teal-300 dark:border-teal-700 font-bold text-[10px] py-0.5 px-2 gap-1 shadow-2xs">
                              <CheckCircle2 className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                              <span>WhatsApp: Sent</span>
                            </Badge>
                          ) : c.whatsappStatus === 'OPENED' ? (
                            <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700 font-bold text-[10px] py-0.5 px-2 gap-1 shadow-2xs">
                              <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                              <span>WhatsApp: Awaiting Conf.</span>
                            </Badge>
                          ) : c.whatsappStatus === 'FAILED' ? (
                            <Badge variant="outline" className="bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-700 font-bold text-[10px] py-0.5 px-2 gap-1 shadow-2xs">
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              <span>WhatsApp: Failed</span>
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 font-bold text-[10px] py-0.5 px-2">
                              <span>WhatsApp: Not Sent</span>
                            </Badge>
                          )}
                        </div>
                      </td>

                      {/* Registered Date */}
                      <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400">
                        {c.createdAt ? format(parseISO(c.createdAt), 'MMM dd, yyyy') : '—'}
                      </td>

                      {/* Last Activity */}
                      <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400">
                        {c.updatedAt ? formatDistanceToNow(parseISO(c.updatedAt), { addSuffix: true }) : '—'}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/dashboard/customers/${c.id}`)}
                            className="h-8 w-8 rounded-lg text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
                            title="View Profile & Repairs"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>

                          {isAdminOrManager && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenEdit(c)}
                                className="h-8 w-8 rounded-lg text-slate-500 hover:text-amber-600 cursor-pointer"
                                title="Edit Customer"
                              >
                                <Edit3 className="w-4 h-4" />
                              </Button>

                              {isArchived ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRestore(c)}
                                  className="h-8 w-8 rounded-lg text-emerald-600 hover:text-emerald-700 cursor-pointer"
                                  title="Restore Customer"
                                >
                                  <RotateCcw className="w-4 h-4" />
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleOpenDelete(c)}
                                  className="h-8 w-8 rounded-lg text-slate-400 hover:text-rose-600 cursor-pointer"
                                  title="Delete / Archive Customer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* GRID CARDS VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {customers.map((c: any) => {
            const isSelected = selectedIds.has(c.id);
            const isArchived = !!c.archived;
            const totalRepairs = c.totalRepairs || 0;

            return (
              <div
                key={c.id}
                className={cn(
                  "p-4 rounded-2xl bg-white dark:bg-slate-900 border transition-all shadow-xs hover:shadow-md flex flex-col justify-between space-y-3.5",
                  isSelected
                    ? "border-blue-500 ring-2 ring-blue-500/10 dark:border-blue-500"
                    : "border-slate-200/80 dark:border-slate-800"
                )}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={() => toggleSelectCustomer(c.id)}
                        className="cursor-pointer text-slate-400 hover:text-slate-600"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                      <div>
                        <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                          {c.customerId}
                        </span>
                        <h4
                          onClick={() => navigate(`/dashboard/customers/${c.id}`)}
                          className="font-bold text-sm text-slate-900 dark:text-slate-100 hover:text-blue-600 cursor-pointer"
                        >
                          {c.name}
                        </h4>
                      </div>
                    </div>
                    {isArchived ? (
                      <Badge variant="outline" className="text-[10px] bg-rose-50 text-rose-700 border-rose-200">
                        Archived
                      </Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-full",
                          totalRepairs > 0
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300"
                            : "bg-slate-100 text-slate-500"
                        )}
                      >
                        {totalRepairs} repair{totalRepairs !== 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>

                  <div className="mt-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{c.phone}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{c.district || 'Kathmandu'}{c.municipality ? `, ${c.municipality}` : ''}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Reg: {c.createdAt ? format(parseISO(c.createdAt), 'MMM dd, yyyy') : '—'}</span>
                    </div>

                    {/* Notification Status Badges */}
                    <div className="pt-1.5 flex items-center gap-1.5 flex-wrap">
                      {c.smsStatus === 'SENT' ? (
                        <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 font-bold text-[9px] py-0 px-1.5">
                          SMS: Sent
                        </Badge>
                      ) : c.smsStatus === 'OPENED' ? (
                        <Badge variant="outline" className="bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border-sky-300 font-bold text-[9px] py-0 px-1.5">
                          SMS: Awaiting Conf.
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold text-[9px] py-0 px-1.5">
                          SMS: Not Sent
                        </Badge>
                      )}

                      {c.whatsappStatus === 'SENT' ? (
                        <Badge variant="outline" className="bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border-teal-300 font-bold text-[9px] py-0 px-1.5">
                          WA: Sent
                        </Badge>
                      ) : c.whatsappStatus === 'OPENED' ? (
                        <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 font-bold text-[9px] py-0 px-1.5">
                          WA: Awaiting Conf.
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold text-[9px] py-0 px-1.5">
                          WA: Not Sent
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/dashboard/customers/${c.id}`)}
                    className="h-8 rounded-xl text-xs font-semibold flex-1 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 mr-1" /> View Profile
                  </Button>
                  {isAdminOrManager && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenEdit(c)}
                      className="h-8 w-8 rounded-xl text-slate-500 hover:text-amber-600 cursor-pointer"
                      title="Edit"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  {isAdminOrManager && !isArchived && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenDelete(c)}
                      className="h-8 w-8 rounded-xl text-slate-400 hover:text-rose-600 cursor-pointer"
                      title="Delete / Archive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {!loading && customers.length > 0 && (
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Showing <span className="font-semibold text-slate-900 dark:text-slate-100">{(page - 1) * limit + 1}</span> to{' '}
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {Math.min(page * limit, totalCount)}
            </span>{' '}
            of <span className="font-semibold text-slate-900 dark:text-slate-100">{totalCount}</span> customers
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400">Per page:</span>
              <Select
                value={String(limit)}
                onValueChange={val => {
                  const newLimit = parseInt(val, 10);
                  setLimit(newLimit);
                  setPage(1);
                  fetchCustomers(searchQuery, districtFilter, statusFilter, timeFilter, sortBy, sortOrder, 1, newLimit);
                }}
              >
                <SelectTrigger className="w-[75px] h-8 rounded-lg text-xs font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-lg">
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => {
                  const nextP = Math.max(1, page - 1);
                  setPage(nextP);
                  fetchCustomers(searchQuery, districtFilter, statusFilter, timeFilter, sortBy, sortOrder, nextP, limit);
                }}
                className="h-8 px-2.5 rounded-lg text-xs font-semibold cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Prev
              </Button>

              <div className="px-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                {page} / {totalPages}
              </div>

              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => {
                  const nextP = Math.min(totalPages, page + 1);
                  setPage(nextP);
                  fetchCustomers(searchQuery, districtFilter, statusFilter, timeFilter, sortBy, sortOrder, nextP, limit);
                }}
                className="h-8 px-2.5 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* ADD CUSTOMER MODAL */}
      {/* ========================================================= */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-xl p-0 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Register New Customer
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Customer will receive a unique CUS-ID and can be linked to repair workorders.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Full Name */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Full Customer Name <span className="text-rose-500">*</span>
                </Label>
                <Input
                  value={formData.name}
                  onChange={e => {
                    setFormData(p => ({ ...p, name: e.target.value }));
                    if (formErrors.name) setFormErrors(p => ({ ...p, name: '' }));
                  }}
                  placeholder="e.g. Bipin Shrestha"
                  className={cn("h-10 rounded-xl text-xs sm:text-sm", formErrors.name && "border-rose-500")}
                />
                {formErrors.name && <p className="text-[11px] text-rose-500 font-semibold">{formErrors.name}</p>}
              </div>

              {/* Primary Phone */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Primary Nepal Phone <span className="text-rose-500">*</span>
                </Label>
                <Input
                  value={formData.phone}
                  onChange={e => {
                    setFormData(p => ({ ...p, phone: e.target.value }));
                    if (formErrors.phone) setFormErrors(p => ({ ...p, phone: '' }));
                  }}
                  placeholder="98XXXXXXXX or 01XXXXXXX"
                  className={cn("h-10 rounded-xl text-xs sm:text-sm", formErrors.phone && "border-rose-500")}
                />
                {formErrors.phone && <p className="text-[11px] text-rose-500 font-semibold">{formErrors.phone}</p>}
              </div>

              {/* Alternative Phone */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Alternative Phone (Optional)
                </Label>
                <Input
                  value={formData.alternativePhone}
                  onChange={e => setFormData(p => ({ ...p, alternativePhone: e.target.value }))}
                  placeholder="Secondary mobile or office"
                  className="h-10 rounded-xl text-xs sm:text-sm"
                />
              </div>

              {/* Email */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Email Address (Optional)
                </Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                  placeholder="customer@example.com"
                  className="h-10 rounded-xl text-xs sm:text-sm"
                />
              </div>

              {/* District */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  District
                </Label>
                <Select
                  value={formData.district}
                  onValueChange={val => setFormData(p => ({ ...p, district: val }))}
                >
                  <SelectTrigger className="h-10 rounded-xl text-xs font-semibold cursor-pointer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl max-h-56">
                    {NEPAL_DISTRICTS.map(d => (
                      <SelectItem key={d} value={d} className="text-xs font-medium">{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Municipality / Ward */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Municipality / Ward
                </Label>
                <Input
                  value={formData.municipality}
                  onChange={e => setFormData(p => ({ ...p, municipality: e.target.value }))}
                  placeholder="e.g. Kathmandu Metro-22"
                  className="h-10 rounded-xl text-xs sm:text-sm"
                />
              </div>

              {/* Street Address */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Street / Area Address
                </Label>
                <Input
                  value={formData.address}
                  onChange={e => setFormData(p => ({ ...p, address: e.target.value }))}
                  placeholder="e.g. New Road, Pako, House #14"
                  className="h-10 rounded-xl text-xs sm:text-sm"
                />
              </div>

              {/* Landmark */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Landmark
                </Label>
                <Input
                  value={formData.landmark}
                  onChange={e => setFormData(p => ({ ...p, landmark: e.target.value }))}
                  placeholder="e.g. Opposite Peoples Plaza"
                  className="h-10 rounded-xl text-xs sm:text-sm"
                />
              </div>

              {/* Internal Notes */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Internal Staff Notes
                </Label>
                <Textarea
                  value={formData.notes}
                  onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Important preferences, VIP customer notes, communication tags..."
                  rows={2}
                  className="rounded-xl text-xs sm:text-sm"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => setIsAddOpen(false)}
              disabled={saving}
              className="text-xs font-semibold cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveNewCustomer}
              disabled={saving}
              className="h-10 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer flex items-center gap-1.5"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Save Customer</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================= */}
      {/* EDIT CUSTOMER MODAL */}
      {/* ========================================================= */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-xl p-0 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                <Edit3 className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Edit Customer — {customerToEdit?.customerId}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Updates customer contact details without altering historical repair workorders.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Customer Name <span className="text-rose-500">*</span>
                </Label>
                <Input
                  value={formData.name}
                  onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                  className={cn("h-10 rounded-xl text-xs sm:text-sm", formErrors.name && "border-rose-500")}
                />
                {formErrors.name && <p className="text-[11px] text-rose-500 font-semibold">{formErrors.name}</p>}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Primary Phone <span className="text-rose-500">*</span>
                </Label>
                <Input
                  value={formData.phone}
                  onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                  className={cn("h-10 rounded-xl text-xs sm:text-sm", formErrors.phone && "border-rose-500")}
                />
                {formErrors.phone && <p className="text-[11px] text-rose-500 font-semibold">{formErrors.phone}</p>}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Alternative Phone
                </Label>
                <Input
                  value={formData.alternativePhone}
                  onChange={e => setFormData(p => ({ ...p, alternativePhone: e.target.value }))}
                  className="h-10 rounded-xl text-xs sm:text-sm"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Email Address
                </Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                  className="h-10 rounded-xl text-xs sm:text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">District</Label>
                <Select
                  value={formData.district}
                  onValueChange={val => setFormData(p => ({ ...p, district: val }))}
                >
                  <SelectTrigger className="h-10 rounded-xl text-xs font-semibold cursor-pointer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl max-h-56">
                    {NEPAL_DISTRICTS.map(d => (
                      <SelectItem key={d} value={d} className="text-xs font-medium">{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Municipality</Label>
                <Input
                  value={formData.municipality}
                  onChange={e => setFormData(p => ({ ...p, municipality: e.target.value }))}
                  className="h-10 rounded-xl text-xs sm:text-sm"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Street Address</Label>
                <Input
                  value={formData.address}
                  onChange={e => setFormData(p => ({ ...p, address: e.target.value }))}
                  className="h-10 rounded-xl text-xs sm:text-sm"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Landmark</Label>
                <Input
                  value={formData.landmark}
                  onChange={e => setFormData(p => ({ ...p, landmark: e.target.value }))}
                  className="h-10 rounded-xl text-xs sm:text-sm"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Staff Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                  rows={2}
                  className="rounded-xl text-xs sm:text-sm"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => setIsEditOpen(false)}
              disabled={saving}
              className="text-xs font-semibold cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEditCustomer}
              disabled={saving}
              className="h-10 px-5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs cursor-pointer flex items-center gap-1.5"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Save Changes</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================= */}
      {/* SINGLE CUSTOMER DELETE CONFIRMATION MODAL */}
      {/* ========================================================= */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-md p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Delete / Archive Customer
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Verify customer record and audit protection policy.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="my-4 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Customer:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{customerToDelete?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">ID:</span>
              <span className="font-mono font-semibold text-blue-600">{customerToDelete?.customerId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Phone:</span>
              <span>{customerToDelete?.phone}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Total Repairs:</span>
              <span className="font-bold text-emerald-600">{customerToDelete?.totalRepairs || 0}</span>
            </div>
          </div>

          {(customerToDelete?.totalRepairs || 0) > 0 ? (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-200 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <span>Critical Audit & Warranty Protection</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                This customer has <strong>{customerToDelete?.totalRepairs} repair record(s)</strong>. To safeguard warranty eligibility, customer invoices, and financial audits, this record will be <strong>SAFELY ARCHIVED</strong> rather than permanently erased.
              </p>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 space-y-1">
              <p className="text-[11px] leading-relaxed">
                This customer has <strong>0 associated repairs</strong>.
                {isSuperAdmin
                  ? ' As Super Admin, executing this deletion will permanently purge the customer record from the database.'
                  : ' As Admin/Manager, this customer will be safely archived. Permanent deletion requires Super Admin authority.'}
              </p>
            </div>
          )}

          <DialogFooter className="mt-6 flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              onClick={() => setIsDeleteOpen(false)}
              disabled={deleting}
              className="text-xs font-semibold cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmSingleDelete}
              disabled={deleting}
              className="h-10 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer flex items-center gap-1.5"
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              <span>{(customerToDelete?.totalRepairs || 0) > 0 ? 'Archive Record' : 'Confirm Deletion'}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================= */}
      {/* BULK DELETE CONFIRMATION MODAL */}
      {/* ========================================================= */}
      <Dialog open={isBulkDeleteOpen} onOpenChange={setIsBulkDeleteOpen}>
        <DialogContent className="max-w-lg p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Bulk Process {selectedIds.size} Customer Record{selectedIds.size !== 1 ? 's' : ''}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Automated role-enforced deletion with repair history protection.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="my-4 space-y-3">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900">
                <span className="font-bold text-amber-800 dark:text-amber-200 block text-lg">
                  {selectedCustomersBreakdown.withRepairsCount}
                </span>
                <span className="text-amber-700 dark:text-amber-300 font-medium text-[11px]">
                  With repair history (Protected & will be Archived)
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <span className="font-bold text-slate-800 dark:text-slate-200 block text-lg">
                  {selectedCustomersBreakdown.zeroRepairsCount}
                </span>
                <span className="text-slate-600 dark:text-slate-400 font-medium text-[11px]">
                  Zero repairs recorded
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 text-xs text-blue-800 dark:text-blue-200 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <ShieldAlert className="w-4 h-4 text-blue-600" />
                <span>MTS Lab Data Integrity Standard</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Customers with existing repair histories are automatically archived to protect ongoing warranties and financial audit trails.
              </p>
            </div>

            {isSuperAdmin && selectedCustomersBreakdown.zeroRepairsCount > 0 && (
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={permanentDeleteZeroRepairs}
                  onChange={e => setPermanentDeleteZeroRepairs(e.target.checked)}
                  className="mt-0.5 rounded text-rose-600"
                />
                <div className="text-xs">
                  <span className="font-bold text-rose-600 dark:text-rose-400 block">
                    Permanently delete {selectedCustomersBreakdown.zeroRepairsCount} zero-repair customer(s) from database
                  </span>
                  <span className="text-[11px] text-slate-500">
                    If unchecked, all zero-repair records will simply be archived safely.
                  </span>
                </div>
              </label>
            )}
          </div>

          <DialogFooter className="mt-6 flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              onClick={() => setIsBulkDeleteOpen(false)}
              disabled={deleting}
              className="text-xs font-semibold cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmBulkDelete}
              disabled={deleting}
              className="h-10 px-5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer flex items-center gap-1.5"
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              <span>Process {selectedIds.size} Records</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
