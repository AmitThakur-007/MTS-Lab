import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import {
  User,
  Phone,
  Mail,
  MapPin,
  Smartphone,
  Clock,
  Plus,
  ChevronLeft,
  Loader2,
  Edit3,
  History,
  BatteryCharging,
  Truck,
  Check,
  ChevronRight,
  AlertCircle,
  Calendar,
  Filter,
  Save,
  X,
  Archive,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
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
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { api } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { formatNPR } from '@/lib/format';
import { useRealtimeSync } from '@/services/realtime';
import DashboardRefreshButton from '@/components/DashboardRefreshButton';
import { motion, AnimatePresence } from 'motion/react';

const NEPAL_DISTRICTS = [
  'Kathmandu', 'Lalitpur', 'Bhaktapur', 'Morang', 'Sunsari', 'Jhapa', 'Kaski',
  'Chitwan', 'Rupandehi', 'Dhanusha', 'Parsa', 'Makwanpur', 'Banke', 'Kailali',
  'Kanchanpur', 'Nawalparasi', 'Mahottari', 'Sarlahi', 'Siraha', 'Bara', 'Rautahat',
  'Kavrepalanchok', 'Nuwakot', 'Dhading', 'Sindhupalchok', 'Tanahun', 'Gorkha',
  'Syangja', 'Palpa', 'Gulmi', 'Baglung', 'Dang', 'Surkhet', 'Bardiya'
];

const STATUS_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  DELIVERED: { label: 'Delivered', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: <Check className="w-3 h-3" /> },
  REPAIRED: { label: 'Repaired', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: <Check className="w-3 h-3" /> },
  IN_PROCESS: { label: 'In Process', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: <Loader2 className="w-3 h-3 animate-spin" /> },
  RECEIVED: { label: 'Received', color: 'bg-slate-100 text-slate-700 border-slate-200', icon: <Clock className="w-3 h-3" /> },
  DIAGNOSING: { label: 'Diagnosing', color: 'bg-violet-100 text-violet-800 border-violet-200', icon: <Smartphone className="w-3 h-3" /> },
  WAITING_FOR_PARTS: { label: 'Waiting Parts', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: <Clock className="w-3 h-3" /> },
  TESTING: { label: 'Testing', color: 'bg-cyan-100 text-cyan-800 border-cyan-200', icon: <Check className="w-3 h-3" /> },
  READY_FOR_PICKUP: { label: 'Ready', color: 'bg-lime-100 text-lime-800 border-lime-200', icon: <Check className="w-3 h-3" /> },
  CANCELLED: { label: 'Cancelled', color: 'bg-rose-100 text-rose-700 border-rose-200', icon: <X className="w-3 h-3" /> },
  CANNOT_REPAIR: { label: 'Cannot Repair', color: 'bg-rose-100 text-rose-700 border-rose-200', icon: <X className="w-3 h-3" /> },
  RE_PROBLEM: { label: 'Re-Problem', color: 'bg-orange-100 text-orange-800 border-orange-200', icon: <AlertCircle className="w-3 h-3" /> },
};

function RepairStatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] || { label: status?.replace(/_/g, ' '), color: 'bg-slate-100 text-slate-700 border-slate-200', icon: null };
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border', meta.color)}>
      {meta.icon}
      {meta.label}
    </span>
  );
}

function isActiveStatus(status: string): boolean {
  return !['DELIVERED', 'CANNOT_REPAIR', 'CANCELLED'].includes(status);
}

export default function CustomerProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();

  const [customer, setCustomer] = useState<any>(null);
  const [repairs, setRepairs] = useState<any[]>([]);
  const [pagination, setPagination] = useState<any>({ total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [repairsLoading, setRepairsLoading] = useState(false);

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);

  // Edit Customer Dialog
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [editInitial, setEditInitial] = useState<any>({});
  const [editSaving, setEditSaving] = useState(false);

  // Archive / Restore / Discard
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [isDiscardOpen, setIsDiscardOpen] = useState(false);

  const canEdit = ['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST'].includes(user?.role || '');
  const canCreateRepair = ['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST', 'MANAGER'].includes(user?.role || '');
  const canHardDelete = user?.role === 'SUPER_ADMIN';

  const editDirty = JSON.stringify(editForm) !== JSON.stringify(editInitial);

  const openEdit = () => {
    setEditInitial(JSON.parse(JSON.stringify(editForm)));
    setIsEditOpen(true);
  };

  const requestCloseEdit = () => {
    if (editDirty) {
      setIsDiscardOpen(true);
    } else {
      setIsEditOpen(false);
    }
  };

  const fetchCustomer = useCallback(async () => {
    if (!id) return;
    try {
      const data = await api.get(`/customers/${id}`);
      setCustomer(data);
      setEditForm({
        name: data.name || '',
        phone: data.phone || '',
        alternativePhone: data.alternativePhone || '',
        email: data.email || '',
        district: data.district || 'Kathmandu',
        municipality: data.municipality || '',
        address: data.address || '',
        landmark: data.landmark || '',
        notes: data.notes || '',
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to load customer');
      navigate('/dashboard/customers');
    }
  }, [id]);

  const fetchRepairs = useCallback(async (page = 1, status = statusFilter, dateRange = dateFilter) => {
    if (!id) return;
    setRepairsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '15');
      if (status !== 'ALL') params.set('status', status);

      // Date filter
      if (dateRange === 'TODAY') {
        const today = new Date();
        params.set('dateFrom', format(today, 'yyyy-MM-dd'));
        params.set('dateTo', format(today, 'yyyy-MM-dd'));
      } else if (dateRange === 'THIS_MONTH') {
        const now = new Date();
        params.set('dateFrom', format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd'));
        params.set('dateTo', format(new Date(now.getFullYear(), now.getMonth() + 1, 0), 'yyyy-MM-dd'));
      } else if (dateRange === 'LAST_3_MONTHS') {
        const now = new Date();
        const threeMonthsAgo = new Date(now);
        threeMonthsAgo.setMonth(now.getMonth() - 3);
        params.set('dateFrom', format(threeMonthsAgo, 'yyyy-MM-dd'));
      } else if (dateRange === 'THIS_YEAR') {
        const year = new Date().getFullYear();
        params.set('dateFrom', `${year}-01-01`);
        params.set('dateTo', `${year}-12-31`);
      }

      const data = await api.get(`/customers/${id}/repairs?${params.toString()}`);
      setRepairs(data.repairs || []);
      setPagination(data.pagination || {});
    } catch (err: any) {
      toast.error(err.message || 'Failed to load repair history');
    } finally {
      setRepairsLoading(false);
    }
  }, [id, statusFilter, dateFilter]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchCustomer(), fetchRepairs(1)]);
      setLoading(false);
    };
    load();
  }, [id]);

  // Auto-open the edit dialog when navigated from the Customer Hub "Edit" action
  useEffect(() => {
    if ((location.state as any)?.openEdit && canEdit && customer && !loading) {
      openEdit();
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, canEdit, customer, loading, openEdit]);

  useRealtimeSync(['repair', 'customer'], () => {
    fetchCustomer();
    fetchRepairs(currentPage, statusFilter, dateFilter);
  });

  useEffect(() => {
    if (pagination.totalPages && currentPage > pagination.totalPages) {
      setCurrentPage(1);
      fetchRepairs(1, statusFilter, dateFilter);
    }
  }, [pagination.totalPages, currentPage, statusFilter, dateFilter, fetchRepairs]);

  const handleStatusFilterChange = (val: string) => {
    setStatusFilter(val);
    setCurrentPage(1);
    fetchRepairs(1, val, dateFilter);
  };

  const handleDateFilterChange = (val: string) => {
    setDateFilter(val);
    setCurrentPage(1);
    fetchRepairs(1, statusFilter, val);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchRepairs(page, statusFilter, dateFilter);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveEdit = async () => {
    if (!editForm.name?.trim() || !editForm.phone?.trim()) {
      toast.error('Customer name and phone number are required.');
      return;
    }
    const norm = (editForm.phone || '').replace(/\D/g, '');
    if (norm.length < 7 || norm.length > 15) {
      toast.error('Please enter a valid phone number (7–15 digits).');
      return;
    }
    setEditSaving(true);
    try {
      const updated = await api.patch(`/customers/${customer.id}`, editForm);
      setCustomer((prev: any) => ({ ...prev, ...updated }));
      setEditInitial(JSON.parse(JSON.stringify(editForm)));
      toast.success('Customer details updated successfully.');
      setIsEditOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update customer');
    } finally {
      setEditSaving(false);
    }
  };

  const confirmArchive = async () => {
    if (!customer) return;
    setArchiveBusy(true);
    try {
      await api.post(`/customers/${customer.id}/archive`, {});
      toast.success('Customer archived successfully.');
      setIsArchiveOpen(false);
      navigate('/dashboard/customers');
    } catch (err: any) {
      toast.error(err.message || 'Failed to archive customer');
    } finally {
      setArchiveBusy(false);
    }
  };

  const confirmRestore = async () => {
    if (!customer) return;
    setArchiveBusy(true);
    try {
      await api.post(`/customers/${customer.id}/restore`, {});
      toast.success('Customer restored successfully.');
      setCustomer((prev: any) => ({ ...prev, archived: false }));
      setIsArchiveOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to restore customer');
    } finally {
      setArchiveBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!customer) return;
    setArchiveBusy(true);
    try {
      await api.delete(`/customers/${customer.id}`);
      toast.success('Customer permanently deleted.');
      setIsArchiveOpen(false);
      navigate('/dashboard/customers');
    } catch (err: any) {
      const msg = err?.message || 'Failed to delete customer';
      toast.error(msg);
      if (msg.toLowerCase().includes('archive')) {
        setIsArchiveOpen(false);
      }
    } finally {
      setArchiveBusy(false);
    }
  };

  const handleNewRepair = () => {
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

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-12 w-12 text-slate-300 animate-spin" />
        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Loading Customer Profile...</p>
      </div>
    );
  }

  if (!customer) return null;

  const isReturning = (customer.totalRepairs || 0) >= 2;
  const lastVisitStr = customer.latestRepair?.createdAt
    ? format(parseISO(customer.latestRepair.createdAt), 'dd MMM yyyy')
    : 'Never';

  return (
    <div className="w-full max-w-[1400px] mx-auto px-3 sm:px-5 lg:px-8 pb-24 space-y-6">

      {/* Top Nav */}
      <div className="flex items-center gap-2 sm:gap-3 pt-2 flex-wrap">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate('/dashboard/customers')}
          className="rounded-full h-10 w-10 border-slate-200 hover:bg-slate-50 shrink-0 cursor-pointer"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium flex-wrap min-w-0">
          <Link to="/dashboard/customers" className="hover:text-slate-700 transition-colors whitespace-nowrap">Customers</Link>
          <ChevronRight className="h-3 w-3 shrink-0" />
          <span className="text-slate-700 font-bold truncate max-w-[160px] xs:max-w-[220px] sm:max-w-xs" title={customer.name}>{customer.name}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {canEdit && !customer.archived && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsArchiveOpen(true)}
              className="h-9 rounded-xl text-xs font-bold border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer shrink-0"
            >
              <Archive className="w-3.5 h-3.5 mr-1.5 shrink-0" />
              <span className="truncate">Archive</span>
            </Button>
          )}
          {canEdit && customer.archived && (
            <Button
              size="sm"
              onClick={() => setIsArchiveOpen(true)}
              className="h-9 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm cursor-pointer shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5 shrink-0" />
              <span className="truncate">Restore</span>
            </Button>
          )}
          <DashboardRefreshButton
            onRefresh={async () => { await fetchCustomer(); await fetchRepairs(currentPage, statusFilter, dateFilter); }}
            size="sm"
            label="Refresh"
            variant="outline"
            className="rounded-xl h-9 text-xs"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">

        {/* LEFT — Customer Profile Card */}
        <div className="space-y-4">
          {/* Profile Card */}
          <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
            {/* Dark header */}
            <div className="bg-slate-950 text-white p-5 sm:p-7">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-14 h-14 rounded-2xl bg-white/10 text-white flex items-center justify-center font-black text-2xl shrink-0 border border-white/10">
                    {customer.name?.charAt(0)?.toUpperCase() || 'C'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg sm:text-xl font-extrabold tracking-tight break-words" title={customer.name}>{customer.name}</h2>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs font-mono text-white/60">{customer.customerId}</span>
                      {isReturning && (
                        <Badge className="text-[9px] px-1.5 py-0.5 bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 font-bold">
                          Returning Customer
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={openEdit}
                    className="h-9 w-9 rounded-xl text-white/60 hover:text-white hover:bg-white/10 shrink-0 cursor-pointer"
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <CardContent className="p-5 sm:p-6 space-y-4">
              {/* Contact Info */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <Phone className="h-3.5 w-3.5 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Phone</p>
                    <p className="text-sm font-bold text-slate-900 font-mono">{customer.phone}</p>
                  </div>
                </div>
                {customer.alternativePhone && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                      <Phone className="h-3.5 w-3.5 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Alt. Phone</p>
                      <p className="text-sm font-bold text-slate-700 font-mono">{customer.alternativePhone}</p>
                    </div>
                  </div>
                )}
                {customer.email && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                      <Mail className="h-3.5 w-3.5 text-slate-600" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email</p>
                      <p className="text-sm font-bold text-slate-700 break-all">{customer.email}</p>
                    </div>
                  </div>
                )}
                {(customer.address || customer.district || customer.municipality) && (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                      <MapPin className="h-3.5 w-3.5 text-slate-600" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Location</p>
                      <p className="text-sm font-bold text-slate-700">
                        {[customer.address, customer.municipality, customer.district].filter(Boolean).join(', ')}
                      </p>
                      {customer.landmark && (
                        <p className="text-[11px] text-slate-400 mt-0.5">Near: {customer.landmark}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                  <p className="text-2xl font-black text-slate-900">{customer.totalRepairs || 0}</p>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wide leading-tight mt-0.5">Total Repairs</p>
                </div>
                <div className="p-3 bg-amber-50 rounded-2xl border border-amber-100 text-center">
                  <p className="text-2xl font-black text-amber-700">{customer.activeRepairsCount || 0}</p>
                  <p className="text-xs font-bold text-amber-400 uppercase tracking-wide leading-tight mt-0.5">Active</p>
                </div>
                <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100 text-center">
                  <p className="text-2xl font-black text-emerald-700">{customer.completedRepairs || 0}</p>
                  <p className="text-xs font-bold text-emerald-400 uppercase tracking-wide leading-tight mt-0.5">Completed</p>
                </div>
                <div className="p-3 bg-rose-50 rounded-2xl border border-rose-100 text-center">
                  <p className="text-2xl font-black text-rose-600">{customer.cancelledRepairs || 0}</p>
                  <p className="text-xs font-bold text-rose-300 uppercase tracking-wide leading-tight mt-0.5">Cancelled</p>
                </div>
              </div>

              {/* Last Visit */}
              <div className="flex items-center justify-between text-xs p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="font-bold text-slate-500 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Last Visit
                </span>
                <span className="font-bold text-slate-800">{lastVisitStr}</span>
              </div>

              <div className="flex items-center justify-between text-xs p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="font-bold text-slate-500 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Customer Since
                </span>
                <span className="font-bold text-slate-800">
                  {customer.createdAt ? format(parseISO(customer.createdAt), 'dd MMM yyyy') : 'Unknown'}
                </span>
              </div>

              {/* New Repair Button */}
              {canCreateRepair && (
                <Button
                  onClick={handleNewRepair}
                  className="w-full h-11 rounded-2xl bg-slate-950 hover:bg-slate-800 text-white font-extrabold text-sm shadow-lg shadow-slate-900/15 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  + New Repair
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT — Repair History */}
        <div className="space-y-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                <History className="w-5 h-5 text-slate-400" />
                Repair History
              </h3>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                {pagination.total || 0} total repair{(pagination.total || 0) !== 1 ? 's' : ''} on record
              </p>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
                <SelectTrigger className="h-9 rounded-xl border-slate-200 w-36 text-xs font-bold bg-white cursor-pointer">
                  <Filter className="w-3 h-3 mr-1.5" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="ALL" className="text-xs font-bold">All Repairs</SelectItem>
                  <SelectItem value="ACTIVE" className="text-xs font-bold text-amber-600">Active</SelectItem>
                  <SelectItem value="COMPLETED" className="text-xs font-bold text-emerald-600">Completed</SelectItem>
                  <SelectItem value="CANCELLED" className="text-xs font-bold text-rose-600">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              <Select value={dateFilter} onValueChange={handleDateFilterChange}>
                <SelectTrigger className="h-9 rounded-xl border-slate-200 w-36 text-xs font-bold bg-white cursor-pointer">
                  <Calendar className="w-3 h-3 mr-1.5" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="ALL" className="text-xs font-bold">All Time</SelectItem>
                  <SelectItem value="TODAY" className="text-xs font-bold">Today</SelectItem>
                  <SelectItem value="THIS_MONTH" className="text-xs font-bold">This Month</SelectItem>
                  <SelectItem value="LAST_3_MONTHS" className="text-xs font-bold">Last 3 Months</SelectItem>
                  <SelectItem value="THIS_YEAR" className="text-xs font-bold">This Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Repairs List */}
          {repairsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-pulse">
                  <div className="p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 shrink-0" />
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="h-3 w-20 bg-slate-100 rounded" />
                          <div className="h-4 w-16 bg-slate-100 rounded-full" />
                        </div>
                        <div className="h-4 w-40 bg-slate-100 rounded" />
                        <div className="h-3 w-32 bg-slate-100 rounded" />
                        <div className="flex gap-3 pt-1">
                          <div className="h-3 w-20 bg-slate-100 rounded" />
                          <div className="h-3 w-16 bg-slate-100 rounded" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : repairs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
              <Smartphone className="h-10 w-10 text-slate-200" />
              <p className="text-sm font-bold text-slate-400">No repairs found</p>
              <p className="text-xs text-slate-400">
                {statusFilter !== 'ALL' || dateFilter !== 'ALL' ? 'Try changing the filters above.' : 'No repairs registered yet for this customer.'}
              </p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={`${statusFilter}-${dateFilter}-${currentPage}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                {repairs.map((repair, idx) => (
                  <motion.div
                    key={repair.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className={cn(
                      'bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden cursor-pointer group',
                      isActiveStatus(repair.status) ? 'border-amber-200 hover:border-amber-300' : 'border-slate-200 hover:border-slate-300'
                    )}
                    onClick={() => navigate(`/dashboard/repairs/${repair.id}`)}
                  >
                    <div className="p-4 sm:p-5">
                      <div className="flex items-start gap-3">
                        {/* Device Icon */}
                        <div className={cn(
                          'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                          isActiveStatus(repair.status) ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-slate-100 text-slate-500'
                        )}>
                          <Smartphone className="w-5 h-5" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono font-black text-xs text-slate-600">{repair.repairNumber}</span>
                                <RepairStatusBadge status={repair.status} />
                                {repair.priority === 'URGENT' && (
                                  <Badge className="text-[9px] px-1.5 py-0.5 bg-rose-600 text-white font-bold animate-pulse">URGENT</Badge>
                                )}
                                {repair.priority === 'HIGH' && (
                                  <Badge className="text-[9px] px-1.5 py-0.5 bg-amber-500 text-white font-bold">HIGH</Badge>
                                )}
                              </div>
                              <h4 className="font-extrabold text-slate-900 mt-1">
                                {repair.deviceBrand} {repair.deviceModel}
                              </h4>
                              <p className="text-xs text-slate-500 font-medium mt-0.5 line-clamp-1">
                                {repair.problemDescription}
                              </p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 transition-colors shrink-0 mt-1" />
                          </div>

                          {/* Meta row */}
                          <div className="mt-3 flex items-center gap-3 flex-wrap text-[11px] text-slate-400 font-medium">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {repair.createdAt ? format(parseISO(repair.createdAt), 'dd MMM yyyy') : '—'}
                            </span>
                            {repair.technician && (
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {repair.technician.name}
                              </span>
                            )}
                            {repair.estimatedCost && (
                              <span className="font-bold text-slate-600">
                                {formatNPR(repair.estimatedCost)}
                              </span>
                            )}
                            {repair.imeiNumber && (
                              <span className="font-mono text-[10px]">IMEI: {repair.imeiNumber}</span>
                            )}
                          </div>

                          {/* Battery Warranty chip + Courier chip — wrapped to prevent overflow */}
                          {(repair.batteryWarranty || repair.isCourierIn || repair.isReturnCourierDispatched) && (
                            <div className="mt-2.5 flex flex-wrap gap-1.5">
                              {repair.batteryWarranty && (
                                <div className={cn(
                                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border max-w-full',
                                  repair.batteryWarranty.status === 'ACTIVE'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : repair.batteryWarranty.status === 'EXPIRED'
                                    ? 'bg-slate-100 text-slate-500 border-slate-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                )}>
                                  <BatteryCharging className="w-3 h-3 shrink-0" />
                                  <span className="truncate">Battery Warranty</span>
                                  <span className="shrink-0">• {repair.batteryWarranty.warrantyNumber}</span>
                                  {repair.batteryWarranty.expiryDate && (
                                    <span className="font-normal opacity-70 shrink-0">
                                      {' '}· Exp {format(parseISO(repair.batteryWarranty.expiryDate), 'dd MMM yyyy')}
                                    </span>
                                  )}
                                </div>
                              )}
                              {(repair.isCourierIn || repair.isReturnCourierDispatched) && (
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                  <Truck className="w-3 h-3 shrink-0" />
                                  Courier
                                  {repair.courierCompany && <span className="truncate max-w-[80px]">· {repair.courierCompany}</span>}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </AnimatePresence>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!pagination.hasPrev}
                onClick={() => handlePageChange(currentPage - 1)}
                className="h-9 rounded-xl text-xs font-bold border-slate-200 cursor-pointer"
              >
                 <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                 Previous
              </Button>
              <span className="text-xs font-bold text-slate-500">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={!pagination.hasNext}
                onClick={() => handlePageChange(currentPage + 1)}
                className="h-9 rounded-xl text-xs font-bold border-slate-200 cursor-pointer"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ── Edit Customer Dialog ── Built on @base-ui primitives directly
           to avoid the shadcn DialogContent base-class conflicts:
           (grid gap-4 p-6 overflow-y-auto + absolute XIcon at top-2 right-2
           + DialogFooter -mx-4 -mb-4 negative margins).
      */}
      <DialogPrimitive.Root
        open={isEditOpen}
        onOpenChange={(open: boolean) => { if (open) setIsEditOpen(true); else requestCloseEdit(); }}
      >
        <DialogPrimitive.Portal>
          {/* Backdrop */}
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 duration-150" />

          {/* Popup — full control over sizing, flex, scroll */}
          <DialogPrimitive.Popup
            className={cn(
              // Positioning
              'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50',
              // Sizing — responsive
              'w-[calc(100vw-1.5rem)] sm:w-[min(90vw,32rem)] max-w-[32rem]',
              'max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh]',
              // Layout — flex column so header/footer are fixed, body scrolls
              'flex flex-col',
              // Appearance
              'bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl overflow-hidden',
              // Animation
              'outline-none duration-150',
              'data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95',
              'data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
            )}
          >
            {/* ── HEADER — never scrolls ── */}
            <div className="flex items-center gap-3 px-5 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-slate-100 shrink-0">
              {/* Icon */}
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-950 text-white flex items-center justify-center shrink-0">
                <Edit3 className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              {/* Title + description */}
              <div className="min-w-0 flex-1">
                <DialogPrimitive.Title className="text-sm sm:text-base font-extrabold text-slate-900 leading-tight">
                  Edit Customer Profile
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="text-[11px] sm:text-xs text-slate-500 mt-0.5 leading-snug">
                  Update contact and address information.
                </DialogPrimitive.Description>
              </div>
              {/* X Close button — explicit, always visible, touch-friendly */}
              <DialogPrimitive.Close
                aria-label="Close Edit Customer Profile"
                className={cn(
                  'shrink-0 flex items-center justify-center',
                  'w-8 h-8 sm:w-9 sm:h-9 rounded-xl',
                  'text-slate-400 hover:text-slate-700 hover:bg-slate-100',
                  'transition-colors cursor-pointer outline-none',
                  'focus-visible:ring-2 focus-visible:ring-slate-300',
                )}
              >
                <X className="w-4 h-4" />
              </DialogPrimitive.Close>
            </div>

            {/* ── SCROLLABLE BODY ── */}
            <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 py-4 sm:py-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">

                {/* Full Name */}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-bold text-slate-700">Full Name *</Label>
                  <Input
                    value={editForm.name || ''}
                    onChange={e => setEditForm((p: any) => ({ ...p, name: e.target.value }))}
                    className="h-10 rounded-xl border-slate-200 text-sm w-full"
                    placeholder="Customer full name"
                    autoComplete="off"
                  />
                </div>

                {/* Phone */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Phone Number *</Label>
                  <Input
                    value={editForm.phone || ''}
                    onChange={e => setEditForm((p: any) => ({ ...p, phone: e.target.value }))}
                    className="h-10 rounded-xl border-slate-200 text-sm font-mono w-full"
                    placeholder="Primary phone"
                    inputMode="tel"
                  />
                </div>

                {/* Alt Phone */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Alternative Phone</Label>
                  <Input
                    value={editForm.alternativePhone || ''}
                    onChange={e => setEditForm((p: any) => ({ ...p, alternativePhone: e.target.value }))}
                    className="h-10 rounded-xl border-slate-200 text-sm font-mono w-full"
                    placeholder="Alternative phone"
                    inputMode="tel"
                  />
                </div>

                {/* Email */}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-bold text-slate-700">Email</Label>
                  <Input
                    type="email"
                    value={editForm.email || ''}
                    onChange={e => setEditForm((p: any) => ({ ...p, email: e.target.value }))}
                    className="h-10 rounded-xl border-slate-200 text-sm w-full"
                    placeholder="Email address"
                    autoComplete="off"
                  />
                </div>

                {/* District */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">District</Label>
                  <Select
                    value={editForm.district || 'Kathmandu'}
                    onValueChange={val => setEditForm((p: any) => ({ ...p, district: val }))}
                  >
                    <SelectTrigger className="h-10 rounded-xl border-slate-200 text-sm cursor-pointer w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl max-h-52">
                      {NEPAL_DISTRICTS.map(d => (
                        <SelectItem key={d} value={d} className="text-xs font-medium">{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Municipality */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Municipality / Ward</Label>
                  <Input
                    value={editForm.municipality || ''}
                    onChange={e => setEditForm((p: any) => ({ ...p, municipality: e.target.value }))}
                    className="h-10 rounded-xl border-slate-200 text-sm w-full"
                    placeholder="e.g. Thamel, Ward 26"
                  />
                </div>

                {/* Street Address */}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-bold text-slate-700">Street Address</Label>
                  <Input
                    value={editForm.address || ''}
                    onChange={e => setEditForm((p: any) => ({ ...p, address: e.target.value }))}
                    className="h-10 rounded-xl border-slate-200 text-sm w-full"
                    placeholder="Street / area address"
                  />
                </div>

                {/* Landmark */}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-bold text-slate-700">Landmark</Label>
                  <Input
                    value={editForm.landmark || ''}
                    onChange={e => setEditForm((p: any) => ({ ...p, landmark: e.target.value }))}
                    className="h-10 rounded-xl border-slate-200 text-sm w-full"
                    placeholder="Near landmark"
                  />
                </div>

                {/* Notes */}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-bold text-slate-700">Notes</Label>
                  <Textarea
                    value={editForm.notes || ''}
                    onChange={e => setEditForm((p: any) => ({ ...p, notes: e.target.value }))}
                    className="rounded-xl border-slate-200 text-sm min-h-[70px] w-full resize-none"
                    placeholder="Internal notes about this customer..."
                  />
                </div>

              </div>
            </div>

            {/* ── FOOTER — never scrolls ── */}
            <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-t border-slate-100 shrink-0 bg-white">
              <Button
                variant="ghost"
                onClick={requestCloseEdit}
                disabled={editSaving}
                className="rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={editSaving}
                className="h-10 px-5 sm:px-6 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs shadow-sm cursor-pointer min-w-[120px] justify-center"
              >
                {editSaving ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-1.5 shrink-0" />Saving...</>
                ) : (
                  <><Save className="h-4 w-4 mr-1.5 shrink-0" />Save Changes</>
                )}
              </Button>
            </div>

          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* Archive / Restore confirmation */}
      <Dialog open={isArchiveOpen} onOpenChange={(open) => { if (!open) setIsArchiveOpen(false); }}>
        <DialogContent showCloseButton={false} className="w-[calc(100vw-1.5rem)] sm:w-full max-w-md rounded-2xl sm:rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-2xl">
          <div className="flex items-start gap-4">
            <div className={cn(
              "w-11 h-11 rounded-2xl flex items-center justify-center shrink-0",
              customer?.archived ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
            )}>
              {customer?.archived ? <RotateCcw className="w-5 h-5" /> : <Archive className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base font-extrabold text-slate-900">
                {customer?.archived ? 'Restore Customer?' : 'Archive Customer?'}
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-500 mt-1.5 break-words">
                {customer?.archived
                  ? `This will make ${customer?.name} visible in the Customer Hub again. All historical repair, warranty, and courier records remain intact.`
                  : `This will hide ${customer?.name} from the Customer Hub while keeping all repair, warranty, and courier history intact. You can restore it later from the "Archived" view.`}
              </DialogDescription>
            </div>
          </div>

          {!customer?.archived && canHardDelete && (customer?.totalRepairs || 0) === 0 && (
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-rose-50 border border-rose-100 p-3 text-xs text-rose-700">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>This customer has no repair or warranty history, so it can also be permanently deleted. Archiving is recommended to avoid accidental data loss.</span>
            </div>
          )}

          <div className="mt-5 sm:mt-6 flex items-center justify-end gap-2 flex-wrap">
            <Button
              variant="ghost"
              onClick={() => setIsArchiveOpen(false)}
              className="rounded-xl text-xs font-bold text-slate-500 cursor-pointer"
            >
              Cancel
            </Button>
            {!customer?.archived && canHardDelete && (customer?.totalRepairs || 0) === 0 && (
              <Button
                onClick={confirmDelete}
                disabled={archiveBusy}
                className="rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
              >
                {archiveBusy ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <X className="w-4 h-4 mr-1.5" />}
                Delete Permanently
              </Button>
            )}
            {customer?.archived ? (
              <Button
                onClick={confirmRestore}
                disabled={archiveBusy}
                className="rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
              >
                {archiveBusy ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <RotateCcw className="w-4 h-4 mr-1.5" />}
                Restore Customer
              </Button>
            ) : (
              <Button
                onClick={confirmArchive}
                disabled={archiveBusy}
                className="rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
              >
                {archiveBusy ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Archive className="w-4 h-4 mr-1.5" />}
                Archive Customer
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Discard unsaved changes */}
      <Dialog open={isDiscardOpen} onOpenChange={(open) => { if (!open) setIsDiscardOpen(false); }}>
        <DialogContent showCloseButton={false} className="w-[calc(100vw-1.5rem)] sm:w-full max-w-sm rounded-2xl sm:rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-2xl">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base font-extrabold text-slate-900">Discard changes?</DialogTitle>
              <DialogDescription className="text-sm text-slate-500 mt-1.5 break-words">
                You have unsaved changes to this customer. If you leave now, your changes will be lost.
              </DialogDescription>
            </div>
          </div>
          <div className="mt-5 sm:mt-6 flex items-center justify-end gap-2 flex-wrap">
            <Button
              variant="ghost"
              onClick={() => setIsDiscardOpen(false)}
              className="rounded-xl text-xs font-bold text-slate-600 cursor-pointer"
            >
              Continue Editing
            </Button>
            <Button
              onClick={() => { setIsDiscardOpen(false); setIsEditOpen(false); }}
              className="rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
            >
              Discard Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
