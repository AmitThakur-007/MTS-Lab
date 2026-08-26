import React, { useState, useEffect, useMemo, Component, ErrorInfo } from 'react';
import { 
  TrendingUp, 
  ArrowUpRight, 
  Download,
  Calendar as CalendarIcon,
  Filter,
  Search,
  Clock,
  FileText,
  AlertCircle,
  ShieldAlert,
  ArrowLeft,
  RefreshCw,
  Receipt,
  CheckCircle2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
} from 'recharts';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { api } from '@/services/api';
import { format, isValid } from 'date-fns';
import { generateRepairReport } from '@/services/reportService';
import DashboardRefreshButton from '@/components/DashboardRefreshButton';
import { toast } from 'sonner';
import { formatNPR } from '@/lib/format';
import { useRealtimeSync } from '@/services/realtime';
import { useAuthStore } from '@/store/authStore';
import { canViewRevenue } from '@/lib/rbac';
import { useNavigate } from 'react-router-dom';

// Custom Safe Date Formatter
function safeFormatDate(dateVal: any, formatStr: string = 'MMM dd, yyyy'): string {
  if (!dateVal) return '—';
  try {
    const d = new Date(dateVal);
    if (!isValid(d)) return '—';
    return format(d, formatStr);
  } catch {
    return '—';
  }
}

// Error Boundary for Revenue Component
interface RevenueErrorBoundaryProps {
  children: React.ReactNode;
}
interface RevenueErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class RevenueErrorBoundary extends Component<RevenueErrorBoundaryProps, RevenueErrorBoundaryState> {
  constructor(props: RevenueErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): RevenueErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[REVENUE ERROR BOUNDARY]', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 max-w-2xl mx-auto text-center space-y-6">
          <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto border border-red-100 shadow-sm">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-900">Unable to load revenue data</h2>
            <p className="text-sm text-slate-500 font-medium">
              An unexpected error occurred while calculating financial records.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3">
            <Button onClick={this.handleRetry} className="bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl gap-2">
              <RefreshCw className="w-4 h-4" /> Try Again
            </Button>
            <Button variant="outline" onClick={() => window.location.href = '/dashboard'} className="rounded-xl border-slate-200 font-bold">
              Back to Dashboard
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function RevenueContent() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [repairs, setRepairs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'PARTIAL' | 'UNPAID'>('ALL');

  // RBAC Permission Guard
  const isAuthorized = canViewRevenue(user?.role);

  const fetchData = async () => {
    if (!isAuthorized) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.get('/repairs');
      if (Array.isArray(data)) {
        setRepairs(data);
      } else {
        setRepairs([]);
      }
    } catch (err: any) {
      console.error('[REVENUE FETCH ERROR]', err);
      setError(err?.message || 'Unable to load revenue data. Please try again.');
      setRepairs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthorized) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [isAuthorized]);

  // Real-time sync for financial revenue and repair billing
  useRealtimeSync(['repair', 'payment'], () => {
    if (isAuthorized) {
      fetchData();
    }
  });

  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [reportFilters, setReportFilters] = useState({
    status: 'ALL',
    month: safeFormatDate(new Date(), 'yyyy-MM'),
    startDate: '',
    endDate: ''
  });

  const handleAdvancedExport = () => {
    let filtered = repairs;

    if (reportFilters.status !== 'ALL') {
      filtered = filtered.filter(r => r.status === reportFilters.status);
    }

    if (reportFilters.startDate && reportFilters.endDate) {
      const start = new Date(reportFilters.startDate);
      const end = new Date(reportFilters.endDate);
      filtered = filtered.filter(r => {
        const d = new Date(r.createdAt);
        return isValid(d) && d >= start && d <= end;
      });
    } else if (reportFilters.month) {
      filtered = filtered.filter(r => safeFormatDate(r.createdAt, 'yyyy-MM') === reportFilters.month);
    }

    if (filtered.length === 0) {
      return toast.error('No matching records found for these export filters.');
    }

    generateRepairReport(filtered, `FINANCIAL REVENUE REPORT - ${reportFilters.status}`);
    setIsFilterModalOpen(false);
    toast.success('Professional Financial Report generated.');
  };

  // Safe Financial Calculations
  const { totalRevenue, pendingRevenue, totalCostSum, paidCount, partialCount, chartData } = useMemo(() => {
    let rev = 0;
    let pending = 0;
    let costSum = 0;
    let paid = 0;
    let partial = 0;

    const monthlyMap: Record<string, number> = {};
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = new Date().getFullYear();

    // Initialize months for current year
    months.forEach((m) => {
      monthlyMap[m] = 0;
    });

    repairs.forEach((r) => {
      const paidAmt = Number(r.totalPaid || r.advancePaid || 0);
      const costAmt = Number(r.totalCost || r.estimatedCost || 0);

      rev += paidAmt;
      costSum += costAmt;

      if (costAmt > paidAmt) {
        pending += (costAmt - paidAmt);
      }

      if (paidAmt > 0 && paidAmt >= costAmt && costAmt > 0) {
        paid++;
      } else if (paidAmt > 0 && paidAmt < costAmt) {
        partial++;
      }

      // Monthly aggregation
      if (r.createdAt) {
        const d = new Date(r.createdAt);
        if (isValid(d) && d.getFullYear() === currentYear) {
          const mName = months[d.getMonth()];
          if (mName) {
            monthlyMap[mName] = (monthlyMap[mName] || 0) + paidAmt;
          }
        }
      }
    });

    const cData = months.slice(0, new Date().getMonth() + 1).map((m) => ({
      month: m,
      revenue: monthlyMap[m] || 0,
      expenses: Math.round((monthlyMap[m] || 0) * 0.32)
    }));

    return {
      totalRevenue: rev,
      pendingRevenue: pending,
      totalCostSum: costSum,
      paidCount: paid,
      partialCount: partial,
      chartData: cData.length > 0 ? cData : [{ month: 'Current', revenue: rev, expenses: Math.round(rev * 0.32) }]
    };
  }, [repairs]);

  // Filtered Payments Table List
  const filteredRepairs = useMemo(() => {
    return repairs.filter((r) => {
      const matchesSearch = !searchQuery.trim() || 
        (r.repairNumber && r.repairNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.customerName && r.customerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.customerPhone && r.customerPhone.includes(searchQuery));

      const paidAmt = Number(r.totalPaid || r.advancePaid || 0);
      const costAmt = Number(r.totalCost || r.estimatedCost || 0);

      let matchesStatus = true;
      if (statusFilter === 'PAID') {
        matchesStatus = paidAmt > 0 && paidAmt >= costAmt && costAmt > 0;
      } else if (statusFilter === 'PARTIAL') {
        matchesStatus = paidAmt > 0 && paidAmt < costAmt;
      } else if (statusFilter === 'UNPAID') {
        matchesStatus = paidAmt === 0 && costAmt > 0;
      }

      return matchesSearch && matchesStatus;
    });
  }, [repairs, searchQuery, statusFilter]);

  // Unauthorized Access Guard UI
  if (!isAuthorized) {
    return (
      <div className="p-8 sm:p-12 max-w-2xl mx-auto text-center space-y-6">
        <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto border border-amber-200 shadow-sm">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-slate-900">Access Denied</h2>
          <p className="text-sm text-slate-500 font-medium max-w-md mx-auto">
            You do not have authorization to view financial accounts and revenue analytics. This section is restricted to Super Admins, Administrators, and Operations Managers.
          </p>
        </div>
        <Button onClick={() => navigate('/dashboard')} className="rounded-xl bg-slate-900 text-white font-bold gap-2">
          <ArrowLeft className="w-4 h-4" /> Return to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Accounts & Revenue Hub</h2>
          <p className="text-slate-500 font-medium text-xs sm:text-sm mt-0.5">
            Real-time financial performance, cash inflow, and repair settlement tracking.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <DashboardRefreshButton
            onRefresh={fetchData}
            size="default"
            label="Refresh Revenue"
          />
          <Button
            variant="outline"
            onClick={() => setIsFilterModalOpen(true)}
            className="rounded-xl border-slate-200 text-slate-700 font-bold text-xs sm:text-sm h-10 px-4 gap-2 hover:bg-slate-50"
          >
            <Filter className="h-4 w-4 text-slate-600" /> Export Reports
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="p-12 text-center space-y-4">
          <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-500 font-bold text-sm">Loading financial accounts & revenue data...</p>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="p-8 bg-red-50/70 border border-red-200 rounded-2xl text-center space-y-4 max-w-xl mx-auto">
          <AlertCircle className="w-8 h-8 text-red-600 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-base font-bold text-red-900">Unable to load revenue records</h3>
            <p className="text-xs text-red-700 font-medium">{error}</p>
          </div>
          <Button onClick={fetchData} className="bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs h-9 px-4 gap-2">
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </Button>
        </div>
      )}

      {/* Main Content */}
      {!loading && !error && (
        <>
          {/* Key Metrics Cards */}
          <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="rounded-2xl border-none shadow-md bg-gradient-to-br from-indigo-600 to-indigo-700 text-white p-5">
              <CardHeader className="p-0 pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-indigo-200 flex items-center justify-between">
                  <span>Total Collected</span>
                  <Receipt className="w-4 h-4 text-indigo-300" />
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight">{formatNPR(totalRevenue)}</div>
                <div className="flex items-center text-xs mt-2 text-indigo-200 font-medium">
                  <ArrowUpRight className="h-3.5 w-3.5 mr-1 text-emerald-300" />
                  <span>Realized cash inflow</span>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-slate-200/80 shadow-sm p-5 bg-white">
              <CardHeader className="p-0 pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                  <span>Pending Balances</span>
                  <Clock className="w-4 h-4 text-amber-500" />
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="text-2xl sm:text-3xl font-black text-amber-600 font-mono tracking-tight">{formatNPR(pendingRevenue)}</div>
                <div className="flex items-center text-xs mt-2 text-slate-500 font-medium">
                  <span>Across {repairs.filter(r => (Number(r.totalCost || r.estimatedCost || 0) > Number(r.totalPaid || r.advancePaid || 0))).length} active repairs</span>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-slate-200/80 shadow-sm p-5 bg-white">
              <CardHeader className="p-0 pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                  <span>Average Ticket Value</span>
                  <TrendingUp className="w-4 h-4 text-indigo-500" />
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tracking-tight">
                  {formatNPR(repairs.length > 0 ? Math.round(totalRevenue / repairs.length) : 0)}
                </div>
                <div className="flex items-center text-xs mt-2 text-emerald-600 font-bold">
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  <span>{repairs.length} total repair orders</span>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-slate-200/80 shadow-sm p-5 bg-white">
              <CardHeader className="p-0 pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                  <span>Settlement Rate</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tracking-tight">
                  {totalCostSum > 0 ? `${Math.round((totalRevenue / totalCostSum) * 100)}%` : '100%'}
                </div>
                <div className="flex items-center text-xs mt-2 text-slate-500 font-medium">
                  <span>{paidCount} fully paid · {partialCount} partial</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Chart Section */}
          <div className="grid gap-6 grid-cols-1 lg:grid-cols-7">
            <Card className="lg:col-span-5 rounded-2xl border-slate-200/80 shadow-sm overflow-hidden bg-white">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900">Revenue Flow & Trend</CardTitle>
                    <CardDescription className="text-xs text-slate-500">Monthly realized billing vs estimated workshop overhead.</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-indigo-50 border-indigo-200 text-indigo-700 font-bold text-[11px] px-2.5 py-0.5">Collected Inflow</Badge>
                    <Badge variant="outline" className="bg-slate-50 border-slate-200 text-slate-500 font-bold text-[11px] px-2.5 py-0.5">Estimated Overhead</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-5 pt-8">
                <div className="h-[280px] sm:h-[340px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(val) => `₹${val >= 1000 ? `${Math.round(val / 1000)}k` : val}`} />
                      <Tooltip 
                        formatter={(val: any) => [formatNPR(Number(val)), 'Amount']}
                        contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.08)' }}
                      />
                      <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" name="Revenue" />
                      <Area type="monotone" dataKey="expenses" stroke="#94a3b8" strokeWidth={2} strokeDasharray="4 4" fill="transparent" name="Expenses" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Revenue Distribution Card */}
            <Card className="lg:col-span-2 rounded-2xl border-slate-200/80 shadow-sm bg-white p-5 flex flex-col justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900">Settlement Breakdown</CardTitle>
                <CardDescription className="text-xs text-slate-500 mb-4">Payment status distribution across workshop.</CardDescription>
                
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span className="text-slate-700">Fully Settled</span>
                      <span className="text-emerald-700 font-mono">{paidCount} ({repairs.length > 0 ? Math.round((paidCount / repairs.length) * 100) : 0}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${repairs.length > 0 ? (paidCount / repairs.length) * 100 : 0}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span className="text-slate-700">Partial Payments</span>
                      <span className="text-amber-700 font-mono">{partialCount} ({repairs.length > 0 ? Math.round((partialCount / repairs.length) * 100) : 0}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full" style={{ width: `${repairs.length > 0 ? (partialCount / repairs.length) * 100 : 0}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span className="text-slate-700">Unpaid / In Intake</span>
                      <span className="text-slate-700 font-mono">
                        {repairs.length - paidCount - partialCount} ({repairs.length > 0 ? Math.round(((repairs.length - paidCount - partialCount) / repairs.length) * 100) : 0}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="h-full bg-slate-400 rounded-full" style={{ width: `${repairs.length > 0 ? ((repairs.length - paidCount - partialCount) / repairs.length) * 100 : 0}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-3.5 bg-indigo-50/60 rounded-xl border border-indigo-100 flex items-center gap-3">
                <TrendingUp className="w-5 h-5 text-indigo-600 shrink-0" />
                <div className="text-xs">
                  <p className="font-bold text-indigo-950">Settlement Health</p>
                  <p className="text-indigo-800 font-medium">Automatic two-way sync maintains invoice alignment.</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Recent Payments Table Card */}
          <Card className="rounded-2xl border-slate-200/80 shadow-sm overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900">Repair Settlements & Payments</CardTitle>
                  <CardDescription className="text-xs text-slate-500">Chronological view of customer payments and balances.</CardDescription>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 sm:w-60">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <Input 
                      placeholder="Search repair / customer..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-9 text-xs rounded-xl bg-white border-slate-200" 
                    />
                  </div>

                  <Select value={statusFilter} onValueChange={(val: any) => setStatusFilter(val)}>
                    <SelectTrigger className="h-9 text-xs rounded-xl border-slate-200 bg-white font-bold w-28">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="ALL">All Statuses</SelectItem>
                      <SelectItem value="PAID">Fully Paid</SelectItem>
                      <SelectItem value="PARTIAL">Partial</SelectItem>
                      <SelectItem value="UNPAID">Unpaid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredRepairs.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <Receipt className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-sm font-bold text-slate-700">No payment records found</p>
                  <p className="text-xs text-slate-400 font-medium">Try adjusting your search query or filter selection.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                        <th className="px-5 py-3.5">Repair #</th>
                        <th className="px-5 py-3.5">Customer</th>
                        <th className="px-5 py-3.5">Device</th>
                        <th className="px-5 py-3.5">Date</th>
                        <th className="px-5 py-3.5 text-right">Total Cost</th>
                        <th className="px-5 py-3.5 text-right">Amount Paid</th>
                        <th className="px-5 py-3.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs divide-y divide-slate-100">
                      {filteredRepairs.slice(0, 15).map((r) => {
                        const paidAmt = Number(r.totalPaid || r.advancePaid || 0);
                        const costAmt = Number(r.totalCost || r.estimatedCost || 0);
                        const isFullyPaid = paidAmt > 0 && paidAmt >= costAmt && costAmt > 0;
                        const isPartial = paidAmt > 0 && paidAmt < costAmt;

                        return (
                          <tr key={r.id || r.repairNumber} className="hover:bg-slate-50/60 transition-colors">
                            <td className="px-5 py-3.5 font-mono font-bold text-slate-900">{r.repairNumber || '—'}</td>
                            <td className="px-5 py-3.5">
                              <div className="font-bold text-slate-900">{r.customerName || 'Walk-in Customer'}</div>
                              <div className="text-[11px] text-slate-500 font-mono">{r.customerPhone || '—'}</div>
                            </td>
                            <td className="px-5 py-3.5 font-medium text-slate-700">
                              {r.deviceBrand || ''} {r.deviceModel || 'Device'}
                            </td>
                            <td className="px-5 py-3.5 text-slate-500 font-medium">
                              {safeFormatDate(r.createdAt)}
                            </td>
                            <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-700">
                              {formatNPR(costAmt)}
                            </td>
                            <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-900">
                              {formatNPR(paidAmt)}
                            </td>
                            <td className="px-5 py-3.5 text-center">
                              {isFullyPaid ? (
                                <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px] px-2 py-0.5">
                                  PAID
                                </Badge>
                              ) : isPartial ? (
                                <Badge className="bg-amber-50 text-amber-700 border border-amber-200 font-bold text-[10px] px-2 py-0.5">
                                  PARTIAL
                                </Badge>
                              ) : (
                                <Badge className="bg-slate-100 text-slate-600 border-none font-bold text-[10px] px-2 py-0.5">
                                  UNPAID
                                </Badge>
                              )}
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
        </>
      )}

      {/* Advanced Filter Export Dialog */}
      <Dialog open={isFilterModalOpen} onOpenChange={setIsFilterModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">Export Financial Report</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Select date ranges and status filters to generate a professional PDF report.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Filter by Month</Label>
              <Input
                type="month"
                value={reportFilters.month}
                onChange={(e) => setReportFilters({ ...reportFilters, month: e.target.value, startDate: '', endDate: '' })}
                className="h-10 text-xs rounded-xl border-slate-200 font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">From Date</Label>
                <Input
                  type="date"
                  value={reportFilters.startDate}
                  onChange={(e) => setReportFilters({ ...reportFilters, startDate: e.target.value, month: '' })}
                  className="h-10 text-xs rounded-xl border-slate-200 font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">To Date</Label>
                <Input
                  type="date"
                  value={reportFilters.endDate}
                  onChange={(e) => setReportFilters({ ...reportFilters, endDate: e.target.value, month: '' })}
                  className="h-10 text-xs rounded-xl border-slate-200 font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Repair Status Filter</Label>
              <Select
                value={reportFilters.status}
                onValueChange={(val) => setReportFilters({ ...reportFilters, status: val })}
              >
                <SelectTrigger className="h-10 text-xs rounded-xl border-slate-200 font-bold">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="ALL">All Repair Statuses</SelectItem>
                  <SelectItem value="REPAIRED">Repaired Only</SelectItem>
                  <SelectItem value="DELIVERED">Delivered Only</SelectItem>
                  <SelectItem value="IN_PROCESS">In Progress Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsFilterModalOpen(false)} className="rounded-xl border-slate-200 text-xs font-bold">
              Cancel
            </Button>
            <Button onClick={handleAdvancedExport} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold gap-2">
              <Download className="w-3.5 h-3.5" /> Export PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Revenue() {
  return (
    <RevenueErrorBoundary>
      <RevenueContent />
    </RevenueErrorBoundary>
  );
}
