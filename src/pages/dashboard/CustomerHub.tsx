import { useState, useEffect, useCallback, useRef } from 'react';
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
import { toast } from 'sonner';
import { formatDistanceToNow, parseISO } from 'date-fns';
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

const STATUS_COLOR_MAP: Record<string, string> = {
  DELIVERED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  REPAIRED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  IN_PROCESS: 'bg-blue-100 text-blue-800 border-blue-200',
  RECEIVED: 'bg-slate-100 text-slate-700 border-slate-200',
  DIAGNOSING: 'bg-violet-100 text-violet-800 border-violet-200',
  WAITING_FOR_PARTS: 'bg-amber-100 text-amber-800 border-amber-200',
  CANCELLED: 'bg-rose-100 text-rose-700 border-rose-200',
  CANNOT_REPAIR: 'bg-rose-100 text-rose-700 border-rose-200',
};

const PAGE_SIZE = 24;

function formatLastVisit(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Never';
  try {
    return formatDistanceToNow(parseISO(dateStr), { addSuffix: true });
  } catch {
    return 'Unknown';
  }
}

function CustomerCard({ customer, onView, onNewRepair, onEdit, onRestore, canEdit }: {
  customer: any;
  onView: () => void;
  onNewRepair: () => void;
  onEdit: () => void;
  onRestore: () => void;
  canEdit: boolean;
}) {
  const isReturning = (customer.totalRepairs || 0) >= 2;
  const latestRepair = customer.latestRepair || customer.repairs?.[0];
  const archived = !!customer.archived;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden group flex flex-col",
        archived
          ? "border-dashed border-slate-300 opacity-80"
          : "border-slate-200/80 hover:border-slate-300"
      )}
    >
      <div className="p-4 sm:p-5 flex-1">
        <div className="flex items-start gap-3 sm:gap-4">
          {/* Avatar */}
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-base sm:text-lg shrink-0 shadow-md shadow-slate-900/20 select-none">
            {customer.name?.charAt(0)?.toUpperCase() || 'C'}
          </div>

          {/* Main Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <h3
                    className="font-extrabold text-slate-900 text-sm sm:text-base break-words min-w-0"
                    title={customer.name}
                  >
                    {customer.name}
                  </h3>
                  {isReturning && (
                    <Badge className="text-[9px] px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold rounded-full shrink-0">
                      Returning
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs font-mono text-slate-500 flex items-center gap-1 min-w-0" title={customer.phone}>
                    <Phone className="w-3 h-3 shrink-0" />
                    <span className="truncate max-w-[130px] sm:max-w-none">{customer.phone}</span>
                  </span>
                  {customer.district && (
                    <span className="text-xs text-slate-400 flex items-center gap-1 shrink-0">
                      <MapPin className="w-3 h-3" />
                      <span className="truncate max-w-[80px] sm:max-w-none">{customer.district}</span>
                    </span>
                  )}
                </div>
              </div>
              {/* customerId badge — capped width prevents layout displacement */}
              <span
                className="truncate text-[10px] font-mono text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full font-bold shrink-0 max-w-[110px] sm:max-w-[140px]"
                title={customer.customerId}
              >
                {customer.customerId}
              </span>
            </div>

            {/* Repair Stats Row */}
            <div className="mt-3 flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs">
                <Smartphone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="font-bold text-slate-700">
                  {customer.totalRepairs || 0}
                </span>
                <span className="text-slate-400">
                  {(customer.totalRepairs || 0) === 1 ? 'Repair' : 'Repairs'}
                </span>
              </div>
              {(customer.activeRepairs || 0) > 0 && (
                <Badge className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 font-bold">
                  {customer.activeRepairs} Active
                </Badge>
              )}
              {latestRepair && (
                <span className="text-[11px] text-slate-400 flex items-center gap-1 min-w-0">
                  <Clock className="w-3 h-3 shrink-0" />
                  <span className="truncate">{formatLastVisit(latestRepair.createdAt)}</span>
                </span>
              )}
            </div>

            {/* Latest Repair Chip */}
            {latestRepair && (
              <div className="mt-2.5 px-3 py-2 bg-slate-50 rounded-xl border border-slate-100 text-xs flex items-center gap-2 min-w-0">
                <span className="max-w-[45%] truncate font-mono font-bold text-slate-600 shrink-0" title={latestRepair.repairNumber}>
                  {latestRepair.repairNumber}
                </span>
                <span className="text-slate-400 shrink-0">·</span>
                <span className="font-semibold text-slate-700 truncate min-w-0 flex-1">{latestRepair.deviceBrand} {latestRepair.deviceModel}</span>
                <span className={cn(
                  'ml-auto max-w-[40%] truncate shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-black border whitespace-nowrap',
                  STATUS_COLOR_MAP[latestRepair.status] || 'bg-slate-100 text-slate-600 border-slate-200'
                )}>
                  {latestRepair.status?.replace(/_/g, ' ')}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-auto px-4 sm:px-5 pb-4 sm:pb-5 flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onView}
          className="flex-1 h-9 rounded-xl text-xs font-bold border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer min-w-0"
        >
          <History className="w-3.5 h-3.5 mr-1.5 text-slate-500 shrink-0" />
          <span className="truncate">View</span>
        </Button>

        {archived ? (
          canEdit && (
            <Button
              size="sm"
              onClick={onRestore}
              className="flex-1 h-9 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all cursor-pointer min-w-0"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5 shrink-0" />
              <span className="truncate">Restore</span>
            </Button>
          )
        ) : (
          <>
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={onEdit}
                className="flex-1 h-9 rounded-xl text-xs font-bold border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer min-w-0"
              >
                <Edit3 className="w-3.5 h-3.5 mr-1.5 text-slate-500 shrink-0" />
                <span className="truncate">Edit</span>
              </Button>
            )}
            <Button
              size="sm"
              onClick={onNewRepair}
              className="flex-1 h-9 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition-all cursor-pointer min-w-0"
            >
              <Plus className="w-3.5 h-3.5 mr-1 shrink-0" />
              <span className="truncate">New Repair</span>
            </Button>
          </>
        )}
      </div>
    </motion.div>
  );
}

function CustomerCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-slate-100 animate-pulse shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="h-4 w-2/3 bg-slate-100 rounded animate-pulse" />
            <div className="h-3 w-1/2 bg-slate-100 rounded animate-pulse" />
            <div className="flex gap-3 pt-2">
              <div className="h-3 w-12 bg-slate-100 rounded animate-pulse" />
              <div className="h-3 w-10 bg-slate-100 rounded animate-pulse" />
            </div>
            <div className="h-8 w-full bg-slate-100 rounded-xl animate-pulse mt-2" />
          </div>
        </div>
      </div>
      <div className="px-4 sm:px-5 pb-4 sm:pb-5 flex items-center gap-2">
        <div className="h-9 flex-1 bg-slate-100 rounded-xl animate-pulse" />
        <div className="h-9 flex-1 bg-slate-100 rounded-xl animate-pulse" />
      </div>
    </div>
  );
}

export default function CustomerHub() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [page, setPage] = useState(1);
  const [includeArchived, setIncludeArchived] = useState(false);
  const includeArchivedRef = useRef(false);

  // New Customer dialog
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<any>({
    name: '', phone: '', alternativePhone: '', email: '', district: 'Kathmandu',
    municipality: '', address: '', landmark: '', notes: '',
  });
  const [createSaving, setCreateSaving] = useState(false);

  const canCreateRepair = ['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST', 'MANAGER'].includes(user?.role || '');
  const canCreateCustomer = ['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST'].includes(user?.role || '');
  const canEdit = canCreateCustomer;
  // Results are already one server page; keeping this alias avoids applying a
  // second client-side slice to a paginated response.
  const pagedCustomers = customers;

  const fetchCustomers = useCallback(async (query = '', sort = sortBy, order = sortOrder, requestedPage = page, isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set('search', query);
      params.set('sortBy', sort);
      params.set('sortOrder', order);
      params.set('page', String(requestedPage));
      params.set('limit', String(PAGE_SIZE));
      if (includeArchivedRef.current) params.set('includeArchived', 'true');
      const data = await api.get(`/customers?${params.toString()}`);
      const list = Array.isArray(data) ? data : (Array.isArray(data?.customers) ? data.customers : []);
      setCustomers(list);
      setTotalCount(Array.isArray(data) ? list.length : (data?.pagination?.total ?? list.length));
      setTotalPages(Array.isArray(data) ? 1 : Math.max(1, data?.pagination?.totalPages ?? 1));
    } catch (err: any) {
      toast.error(err.message || 'Failed to load customers');
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [page, sortBy, sortOrder]);

  useEffect(() => {
    fetchCustomers('', sortBy, sortOrder, page, false);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

  // Keep page within range after data changes (e.g. realtime updates / new filter results)
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  // Real-time sync — preserves current page and query without UI flickering
  useRealtimeSync(['customer', 'repair'], () => {
    fetchCustomers(searchQuery, sortBy, sortOrder, page, true);
  });

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    setPage(1);

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    setIsSearching(true);

    searchDebounceRef.current = setTimeout(async () => {
      if (val.trim().length === 0) {
        await fetchCustomers('', sortBy, sortOrder, 1);
      } else if (val.trim().length >= 2) {
        await fetchCustomers(val.trim(), sortBy, sortOrder, 1);
      }
      setIsSearching(false);
    }, 350);
  };

  const clearSearch = () => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    setIsSearching(false);
    setSearchQuery('');
    setPage(1);
    fetchCustomers('', sortBy, sortOrder, 1);
  };

  const toggleArchived = () => {
    const next = !includeArchived;
    setIncludeArchived(next);
    includeArchivedRef.current = next;
    setPage(1);
    fetchCustomers(searchQuery, sortBy, sortOrder, 1);
  };

  const handleEditCustomer = (customer: any) => {
    navigate(`/dashboard/customers/${customer.id}`, { state: { openEdit: true } });
  };

  const handleRestoreCustomer = async (customer: any) => {
    try {
      await api.post(`/customers/${customer.id}/restore`, {});
      toast.success('Customer restored successfully.');
      fetchCustomers(searchQuery, sortBy, sortOrder);
    } catch (err: any) {
      toast.error(err.message || 'Failed to restore customer');
    }
  };

  const handleSortChange = (newSort: string) => {
    setSortBy(newSort);
    setPage(1);
    fetchCustomers(searchQuery, newSort, sortOrder, 1);
  };

  const handleOrderToggle = () => {
    const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    setSortOrder(newOrder);
    setPage(1);
    fetchCustomers(searchQuery, sortBy, newOrder, 1);
  };

  const handleViewCustomer = (customerId: string) => {
    navigate(`/dashboard/customers/${customerId}`);
  };

  const handleNewRepairForCustomer = (customer: any) => {
    if (!canCreateRepair) {
      toast.error('You do not have permission to create repairs.');
      return;
    }
    navigate('/dashboard/repairs/new', {
      state: {
        fromCustomer: {
          id: customer.id,
          customerId: customer.customerId,
          name: customer.name,
          phone: customer.phone,
          alternativePhone: customer.alternativePhone,
          email: customer.email,
          district: customer.district,
          municipality: customer.municipality,
          address: customer.address,
          landmark: customer.landmark,
          notes: customer.notes,
        }
      }
    });
  };

  const openCreateDialog = () => {
    setCreateForm({
      name: '', phone: '', alternativePhone: '', email: '', district: 'Kathmandu',
      municipality: '', address: '', landmark: '', notes: '',
    });
    setIsCreateOpen(true);
  };

  const handleSaveCustomer = async () => {
    if (!createForm.name?.trim() || !createForm.phone?.trim()) {
      toast.error('Name and phone number are required');
      return;
    }
    setCreateSaving(true);
    try {
      const created = await api.post('/customers', {
        name: createForm.name.trim(),
        phone: createForm.phone.trim(),
        alternativePhone: createForm.alternativePhone?.trim() || undefined,
        email: createForm.email?.trim() || undefined,
        district: createForm.district || 'Kathmandu',
        municipality: createForm.municipality?.trim() || undefined,
        address: createForm.address?.trim() || undefined,
        landmark: createForm.landmark?.trim() || undefined,
        notes: createForm.notes?.trim() || undefined,
      });
      toast.success('Customer created successfully');
      setIsCreateOpen(false);
      await fetchCustomers(searchQuery, sortBy, sortOrder);
      if (created?.id) {
        navigate(`/dashboard/customers/${created.id}`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to create customer');
    } finally {
      setCreateSaving(false);
    }
  };

  const returningCount = customers.filter(c => (c.totalRepairs || 0) >= 2).length;
  const activeCount = customers.filter(c => (c.activeRepairs || 0) > 0).length;

  return (
    <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 space-y-6 pb-20">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Customer Hub
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-0.5">
            Search, view, and manage all customer profiles and repair history.
          </p>
        </div>
        {/* Action buttons — wraps into 2 rows on very small screens gracefully */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap sm:justify-end shrink-0">
          {canEdit && (
            <Button
              size="sm"
              onClick={toggleArchived}
              className={cn(
                "h-9 rounded-xl text-xs font-bold shrink-0 cursor-pointer",
                includeArchived
                  ? "bg-slate-900 hover:bg-slate-800 text-white shadow-sm"
                  : "border border-slate-200 hover:bg-slate-50 text-slate-700"
              )}
              title={includeArchived ? 'Hide archived customers' : 'Show archived customers'}
            >
              <Archive className="w-3.5 h-3.5 mr-1.5 shrink-0" />
              <span className="hidden xs:inline truncate">{includeArchived ? 'Hide Archived' : 'Archived'}</span>
              <span className="xs:hidden">{includeArchived ? 'Unarchive' : 'Archived'}</span>
            </Button>
          )}
          {canCreateCustomer && (
            <Button
              size="sm"
              onClick={openCreateDialog}
              className="h-9 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition-all cursor-pointer shrink-0"
            >
              <UserPlus className="w-3.5 h-3.5 mr-1.5 shrink-0" />
              <span className="truncate">New Customer</span>
            </Button>
          )}
          <DashboardRefreshButton
            onRefresh={() => fetchCustomers(searchQuery, sortBy, sortOrder)}
            size="sm"
            label="Refresh"
            variant="outline"
            className="rounded-xl h-9 text-xs shrink-0"
          />
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', sublabel: 'Customers', value: totalCount, color: 'text-slate-900', bg: 'bg-slate-50', border: 'border-slate-200' },
          { label: 'Returning', sublabel: 'Customers', value: returningCount, color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' },
          { label: 'Active', sublabel: 'Repairs', value: activeCount, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
          { label: 'Showing', sublabel: 'Results', value: customers.length, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
        ].map((stat) => (
          <div key={stat.label} className={cn('rounded-2xl border p-3 sm:p-4 min-w-0', stat.bg, stat.border)}>
            <p className={cn('text-xl sm:text-2xl font-black', stat.color)}>{stat.value}</p>
            <p className="text-[11px] text-slate-500 font-bold mt-0.5 leading-tight">
              <span className="block sm:hidden">{stat.label}<br /><span className="text-[10px] opacity-70">{stat.sublabel}</span></span>
              <span className="hidden sm:block">{stat.label} {stat.sublabel}</span>
            </p>
          </div>
        ))}
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-0">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by phone, name, Customer ID, email, address..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="pl-10 h-11 rounded-xl border-slate-200 bg-slate-50 font-medium text-sm focus:bg-white focus:border-indigo-300 transition-all w-full"
            />
            {isSearching && (
              <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 animate-spin" />
            )}
          </div>

          {/* Sort Controls */}
          <div className="flex items-center gap-2 shrink-0">
            <Select value={sortBy} onValueChange={handleSortChange}>
              <SelectTrigger className="h-11 rounded-xl border-slate-200 w-full sm:w-36 text-xs font-bold bg-white cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="updatedAt" className="text-xs font-bold">Last Updated</SelectItem>
                <SelectItem value="createdAt" className="text-xs font-bold">Date Joined</SelectItem>
                <SelectItem value="name" className="text-xs font-bold">Name A–Z</SelectItem>
                <SelectItem value="phone" className="text-xs font-bold">Phone</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={handleOrderToggle}
              className="h-11 w-11 rounded-xl border-slate-200 shrink-0 cursor-pointer"
              title={sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
            >
              <ArrowUpDown className={cn('h-4 w-4 transition-transform', sortOrder === 'asc' ? 'rotate-180' : '')} />
            </Button>
          </div>
        </div>

        {/* Quick filters hint */}
        {!searchQuery && (
          <p className="text-[11px] text-slate-400 font-medium px-1 flex items-start gap-1.5">
            <Filter className="w-3 h-3 shrink-0 mt-0.5" />
            <span className="break-words min-w-0">Tip: Search by phone, name, or Customer ID (e.g. CUS-00101)</span>
          </p>
        )}
        {searchQuery && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-500 font-medium min-w-0 break-all">
              {customers.length} result{customers.length !== 1 ? 's' : ''} for{' '}
              <span className="font-bold text-slate-800 break-words">&ldquo;{searchQuery}&rdquo;</span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSearch}
              className="h-6 px-2 text-xs text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer shrink-0"
            >
              <X className="w-3 h-3 mr-1" />
              Clear
            </Button>
          </div>
        )}
      </div>

      {/* Customer List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <CustomerCardSkeleton key={i} />
          ))}
        </div>
      ) : customers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 sm:py-20 gap-4 bg-slate-50 rounded-3xl border border-dashed border-slate-200 px-4 text-center">
          <div className="w-16 h-16 rounded-3xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
            <User className="h-8 w-8 text-slate-300" />
          </div>
          <div className="space-y-1 max-w-sm">
            <h3 className="font-bold text-slate-700">
              {searchQuery ? 'No customers found' : 'No customers yet'}
            </h3>
            <p className="text-xs text-slate-400">
              {searchQuery ? (
                <>
                  No customers match <span className="font-semibold text-slate-600 break-words">"{searchQuery}"</span>.
                  <br />
                  Try searching by name, phone number, or Repair Job Number.
                </>
              ) : (
                'Customer profiles are automatically created when you register the first repair, or add one manually.'
              )}
            </p>
          </div>
          {searchQuery && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearSearch}
              className="rounded-xl text-xs font-bold cursor-pointer"
            >
              Clear Search
            </Button>
          )}
          {!searchQuery && canCreateCustomer && (
            <Button
              size="sm"
              onClick={openCreateDialog}
              className="rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5 mr-1.5" />
              New Customer
            </Button>
          )}
          {!searchQuery && !canCreateCustomer && canCreateRepair && (
            <Button
              size="sm"
              onClick={() => navigate('/dashboard/repairs/new')}
              className="rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Register First Repair
            </Button>
          )}
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={searchQuery + sortBy + sortOrder + page}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
          >
            {pagedCustomers.map((customer) => (
              <CustomerCard
                key={customer.id}
                customer={customer}
                onView={() => handleViewCustomer(customer.id)}
                onNewRepair={() => handleNewRepairForCustomer(customer)}
                onEdit={() => handleEditCustomer(customer)}
                onRestore={() => handleRestoreCustomer(customer)}
                canEdit={canEdit}
              />
            ))}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Pagination */}
      {!loading && customers.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 pt-1 flex-wrap">
          <p className="text-xs text-slate-400 font-medium min-w-0">
            <span className="hidden sm:inline">
              Showing {pagedCustomers.length} of {totalCount} customer{totalCount !== 1 ? 's' : ''}
              {searchQuery ? <span className="truncate"> matching &ldquo;{searchQuery}&rdquo;</span> : ''}
            </span>
            <span className="sm:hidden">
              {pagedCustomers.length} / {totalCount}
            </span>
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => {
                const nextPage = Math.max(1, page - 1);
                setPage(nextPage);
                fetchCustomers(searchQuery, sortBy, sortOrder, nextPage);
              }}
              className="h-9 rounded-xl text-xs font-bold border-slate-200 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5 mr-1" />
              <span className="hidden xs:inline">Prev</span>
            </Button>
            <span className="text-xs font-bold text-slate-500 whitespace-nowrap">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => {
                const nextPage = Math.min(totalPages, page + 1);
                setPage(nextPage);
                fetchCustomers(searchQuery, sortBy, sortOrder, nextPage);
              }}
              className="h-9 rounded-xl text-xs font-bold border-slate-200 cursor-pointer"
            >
              <span className="hidden xs:inline">Next</span>
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* New Customer Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={(open) => !createSaving && setIsCreateOpen(open)}>
        <DialogContent className="max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] w-[calc(100vw-1.5rem)] sm:w-full max-w-lg rounded-3xl p-0 border border-slate-200 shadow-2xl flex flex-col gap-0 overflow-hidden">
          {/* Header — fixed, never scrolls */}
          <DialogHeader className="px-5 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-950 text-white flex items-center justify-center shrink-0">
                <UserPlus className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base sm:text-lg font-extrabold text-slate-900">New Customer</DialogTitle>
                <DialogDescription className="text-xs text-slate-500 mt-0.5">
                  Add a customer profile manually. Name and phone are required.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Scrollable body */}
          <div className="px-5 sm:px-6 py-4 sm:py-5 space-y-4 flex-1 min-h-0 overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-bold text-slate-700">Full Name *</Label>
                <Input
                  value={createForm.name || ''}
                  onChange={e => setCreateForm((p: any) => ({ ...p, name: e.target.value }))}
                  className="h-10 rounded-xl border-slate-200 text-sm"
                  placeholder="Customer full name"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Phone Number *</Label>
                <Input
                  value={createForm.phone || ''}
                  onChange={e => setCreateForm((p: any) => ({ ...p, phone: e.target.value }))}
                  className="h-10 rounded-xl border-slate-200 text-sm font-mono"
                  placeholder="Primary phone"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Alternative Phone</Label>
                <Input
                  value={createForm.alternativePhone || ''}
                  onChange={e => setCreateForm((p: any) => ({ ...p, alternativePhone: e.target.value }))}
                  className="h-10 rounded-xl border-slate-200 text-sm font-mono"
                  placeholder="Alternative phone"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-bold text-slate-700">Email</Label>
                <Input
                  type="email"
                  value={createForm.email || ''}
                  onChange={e => setCreateForm((p: any) => ({ ...p, email: e.target.value }))}
                  className="h-10 rounded-xl border-slate-200 text-sm"
                  placeholder="Email address"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">District</Label>
                <Select
                  value={createForm.district || 'Kathmandu'}
                  onValueChange={val => setCreateForm((p: any) => ({ ...p, district: val }))}
                >
                  <SelectTrigger className="h-10 rounded-xl border-slate-200 text-sm cursor-pointer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl max-h-52">
                    {NEPAL_DISTRICTS.map(d => (
                      <SelectItem key={d} value={d} className="text-xs font-medium">{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Municipality / Ward</Label>
                <Input
                  value={createForm.municipality || ''}
                  onChange={e => setCreateForm((p: any) => ({ ...p, municipality: e.target.value }))}
                  className="h-10 rounded-xl border-slate-200 text-sm"
                  placeholder="e.g. Thamel, Ward 26"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-bold text-slate-700">Street Address</Label>
                <Input
                  value={createForm.address || ''}
                  onChange={e => setCreateForm((p: any) => ({ ...p, address: e.target.value }))}
                  className="h-10 rounded-xl border-slate-200 text-sm"
                  placeholder="Street / area address"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-bold text-slate-700">Landmark</Label>
                <Input
                  value={createForm.landmark || ''}
                  onChange={e => setCreateForm((p: any) => ({ ...p, landmark: e.target.value }))}
                  className="h-10 rounded-xl border-slate-200 text-sm"
                  placeholder="Near landmark"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-bold text-slate-700">Notes</Label>
                <Textarea
                  value={createForm.notes || ''}
                  onChange={e => setCreateForm((p: any) => ({ ...p, notes: e.target.value }))}
                  className="rounded-xl border-slate-200 text-sm min-h-[70px]"
                  placeholder="Internal notes about this customer..."
                />
              </div>
            </div>
          </div>

          {/* Footer — fixed, never scrolls */}
          <DialogFooter className="mx-0 mb-0 px-5 sm:px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
            <Button
              variant="ghost"
              onClick={() => setIsCreateOpen(false)}
              disabled={createSaving}
              className="rounded-xl text-xs font-bold text-slate-500 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveCustomer}
              disabled={createSaving}
              className="h-10 px-5 sm:px-6 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs shadow-sm cursor-pointer"
            >
              {createSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <Save className="h-4 w-4 mr-1.5" />
              )}
              Create Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
