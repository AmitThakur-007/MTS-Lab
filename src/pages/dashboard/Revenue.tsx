import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  TrendingUp,
  Calendar as CalendarIcon,
  Download,
  Filter,
  RefreshCw,
  FileText,
  FileSpreadsheet,
  Layers,
  Receipt,
  PieChart,
  ShieldCheck,
  AlertTriangle,
  Award,
  Sparkles
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { api } from '@/services/api';
import { formatNPR } from '@/lib/format';
import { useAuthStore } from '@/store/authStore';
import { useRealtimeSync } from '@/services/realtime';
import { generateFinancialPLReport, generateRepairProfitabilityReport, exportToCSV } from '@/services/reportService';
import DashboardRefreshButton from '@/components/DashboardRefreshButton';
import { toast } from 'sonner';

// Child components
import RevenueSummaryCards from '@/components/revenue/RevenueSummaryCards';
import RevenueCharts from '@/components/revenue/RevenueCharts';
import RepairProfitabilityTable from '@/components/revenue/RepairProfitabilityTable';
import FinancialTransactionsJournal from '@/components/revenue/FinancialTransactionsJournal';

export default function Revenue() {
  const user = useAuthStore((state) => state.user);
  const [timeframe, setTimeframe] = useState<string>('THIS_MONTH');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'repairs' | 'journal' | 'intelligence'>('repairs');

  // Filter States
  const [technicianFilter, setTechnicianFilter] = useState<string>('ALL');
  const [brandFilter, setBrandFilter] = useState<string>('ALL');
  const [staffList, setStaffList] = useState<any[]>([]);

  // Overview Data
  const [overviewData, setOverviewData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);

  // Fetch Staff List for Filters
  const fetchStaff = async () => {
    try {
      const res: any = await api.get('/staff');
      const list = Array.isArray(res) ? res : (res?.staff || res?.users || []);
      setStaffList(list);
    } catch {
      // ignore
    }
  };

  // Fetch Authoritative Financial Overview
  const fetchOverview = async () => {
    try {
      setLoading(true);
      const params: any = {
        timeframe,
        technicianId: technicianFilter,
        deviceBrand: brandFilter,
      };

      if (timeframe === 'CUSTOM') {
        if (customStartDate) params.startDate = customStartDate;
        if (customEndDate) params.endDate = customEndDate;
      }

      const res: any = await api.get('/revenue/overview', { params });
      if (res?.success) {
        setOverviewData(res);
      }
    } catch (err: any) {
      console.error('[FETCH REVENUE OVERVIEW ERROR]', err);
      toast.error('Failed to load financial overview');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [timeframe, customStartDate, customEndDate, technicianFilter, brandFilter]);

  // Real-Time Synchronization across workshop bench and reception devices
  useRealtimeSync(['repair', 'payment', 'revenue', 'damage'], () => {
    fetchOverview();
  });

  const getTimeframeLabel = (tf: string) => {
    switch (tf) {
      case 'TODAY': return 'Today';
      case 'YESTERDAY': return 'Yesterday';
      case 'THIS_WEEK': return 'This Week';
      case 'THIS_MONTH': return 'This Month';
      case 'LAST_MONTH': return 'Last Month';
      case 'THIS_YEAR': return 'This Year (2026)';
      case 'CUSTOM': return `${customStartDate || 'Start'} to ${customEndDate || 'End'}`;
      case 'ALL': return 'All Time';
      default: return 'This Month';
    }
  };

  // Export Executive PDF P&L Statement
  const handleExportPDF = () => {
    if (!overviewData?.summary) {
      return toast.error('No financial data available to export');
    }

    generateFinancialPLReport(
      overviewData.summary,
      overviewData.categoryBreakdown || [],
      overviewData.brandBreakdown || [],
      overviewData.technicianPerformance || [],
      getTimeframeLabel(timeframe)
    );
    toast.success('Official Financial Statement PDF downloaded');
  };

  // Export Financial Summary CSV
  const handleExportSummaryCSV = () => {
    if (!overviewData?.summary) {
      return toast.error('No financial data available');
    }

    const s = overviewData.summary;
    const headers = ['Financial Metric', 'Authoritative Value (NPR / Count)', 'Notes'];
    const rows = [
      ['Gross Revenue (Actual Collections)', s.grossRevenue, 'Cash and digital money collected'],
      ['Total Estimated Billing', s.estimatedBilled, 'Total quoted ticket value'],
      ['Outstanding Receivables', s.outstandingReceivables, 'Pending balances from customers'],
      ['Total Advances Collected', s.totalAdvanceCollected, 'Intake advance collections'],
      ['Total Settlements Collected', s.totalSettlementCollected, 'Post-repair delivery settlements'],
      ['Parts & Inventory Cost (COGS)', s.totalPartsCost, 'Consumed components'],
      ['Workshop Damage Deductions', s.totalDamageLoss, 'Repair incident write-offs'],
      ['Gross Operating Profit', s.grossProfit, 'Gross Revenue minus parts & damage'],
      ['Net Operating Profit', s.netProfit, 'Net bottom-line profit'],
      ['Profit Margin (%)', `${s.profitMargin}%`, 'Overall workshop efficiency'],
      ['Average Ticket Value', s.averageTicket, 'Average collected per repair'],
      ['Total Repairs Count', s.totalRepairsCount, 'All jobs recorded'],
      ['Completed Repairs Count', s.completedRepairsCount, 'Delivered or ready for pickup'],
      ['Fully Paid Repairs Count', s.paidRepairsCount, 'Fully settled tickets'],
      ['Partially Paid Repairs Count', s.partialRepairsCount, 'Partial intake advances'],
      ['Unpaid Repairs Count', s.unpaidRepairsCount, 'No payment recorded yet'],
    ];

    exportToCSV(`MTS_LAB_FINANCIAL_SUMMARY_${timeframe}`, headers, rows);
    toast.success('Financial Summary CSV downloaded');
  };

  const summary = overviewData?.summary || {
    grossRevenue: 0,
    estimatedBilled: 0,
    outstandingReceivables: 0,
    totalAdvanceCollected: 0,
    totalSettlementCollected: 0,
    totalPartsCost: 0,
    totalDamageLoss: 0,
    grossProfit: 0,
    netProfit: 0,
    profitMargin: 0,
    averageTicket: 0,
    totalRepairsCount: 0,
    completedRepairsCount: 0,
    paidRepairsCount: 0,
    partialRepairsCount: 0,
    unpaidRepairsCount: 0,
    courierInTotal: 0,
    courierOutTotal: 0,
  };

  return (
    <div className="space-y-6 sm:space-y-8 pb-20 font-sans">
      {/* Top Header & Operational Control Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
              Revenue & Financial Hub
            </h1>
            <Badge className="bg-slate-900 text-white text-[10px] font-black uppercase px-2 py-0.5 shadow-xs">
              NPT Authoritative
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
            Real-time smartphone repair financial intelligence, parts COGS accounting, and profit ledger.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <DashboardRefreshButton
            onRefresh={fetchOverview}
            size="default"
            label="Sync Data"
          />

          {/* Timeframe Dropdown */}
          <Select value={timeframe} onValueChange={(val) => setTimeframe(val)}>
            <SelectTrigger className="h-10 rounded-xl text-xs font-bold border-slate-200 bg-white min-w-[150px] shadow-xs">
              <CalendarIcon className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent className="rounded-xl shadow-2xl">
              <SelectItem value="TODAY" className="text-xs font-bold">Today</SelectItem>
              <SelectItem value="YESTERDAY" className="text-xs font-bold">Yesterday</SelectItem>
              <SelectItem value="THIS_WEEK" className="text-xs font-bold">This Week</SelectItem>
              <SelectItem value="THIS_MONTH" className="text-xs font-bold">This Month</SelectItem>
              <SelectItem value="LAST_MONTH" className="text-xs font-bold">Last Month</SelectItem>
              <SelectItem value="THIS_YEAR" className="text-xs font-bold">This Year (2026)</SelectItem>
              <SelectItem value="CUSTOM" className="text-xs font-bold">Custom Range</SelectItem>
              <SelectItem value="ALL" className="text-xs font-bold">All Time</SelectItem>
            </SelectContent>
          </Select>

          {/* Export Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" className="rounded-xl border-slate-200 text-xs font-bold h-10 px-3.5 gap-2 shadow-xs cursor-pointer bg-white" />}>
              <Download className="w-4 h-4 text-slate-700" />
              <span>Export Statements</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-2xl w-64 p-2 shadow-2xl border-slate-200">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Official Documents
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleExportPDF}
                className="h-11 rounded-xl gap-2.5 font-bold px-3.5 text-xs text-slate-800 hover:bg-slate-50 cursor-pointer"
              >
                <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Executive P&L Statement (PDF)</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleExportSummaryCSV}
                className="h-11 rounded-xl gap-2.5 font-bold px-3.5 text-xs text-slate-800 hover:bg-slate-50 cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Financial Metrics (CSV)</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Custom Date Pickers when CUSTOM is active */}
      {timeframe === 'CUSTOM' && (
        <Card className="rounded-2xl border-slate-200/80 shadow-xs bg-white p-4">
          <div className="flex flex-wrap items-center gap-4 text-xs font-bold">
            <span className="text-slate-600 flex items-center gap-1.5">
              <CalendarIcon className="w-4 h-4 text-slate-500" /> Custom Date Range:
            </span>
            <div className="flex items-center gap-2">
              <Label className="text-slate-500 text-xs">Start:</Label>
              <Input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="h-9 w-40 text-xs rounded-xl border-slate-200 bg-white"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-slate-500 text-xs">End:</Label>
              <Input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="h-9 w-40 text-xs rounded-xl border-slate-200 bg-white"
              />
            </div>
            <Button
              size="sm"
              onClick={fetchOverview}
              className="h-9 rounded-xl bg-slate-950 text-white font-bold text-xs px-4 cursor-pointer"
            >
              Apply Filter
            </Button>
          </div>
        </Card>
      )}

      {/* 1. Authoritative Summary KPI Cards */}
      <RevenueSummaryCards
        summary={summary}
        timeframeLabel={getTimeframeLabel(timeframe)}
      />

      {/* 2. Visual Charts & Category Intelligence */}
      <RevenueCharts
        trend={overviewData?.trend || []}
        categoryBreakdown={overviewData?.categoryBreakdown || []}
        brandBreakdown={overviewData?.brandBreakdown || []}
        technicianPerformance={overviewData?.technicianPerformance || []}
        grossRevenue={summary.grossRevenue}
      />

      {/* 3. Operational Navigation Tabs (Repairs Ledger / Transactions Journal / Intelligence Insights) */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-200/80 pb-3">
          <button
            onClick={() => setActiveTab('repairs')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'repairs'
                ? 'bg-slate-950 text-white shadow-md shadow-black/10'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Repair Profitability Ledger</span>
          </button>
          <button
            onClick={() => setActiveTab('journal')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'journal'
                ? 'bg-slate-950 text-white shadow-md shadow-black/10'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Transaction Journal</span>
          </button>
          <button
            onClick={() => setActiveTab('intelligence')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'intelligence'
                ? 'bg-slate-950 text-white shadow-md shadow-black/10'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Loss & Margin Intelligence</span>
          </button>
        </div>

        {/* Tab 1: Repair Profitability Table */}
        {activeTab === 'repairs' && (
          <RepairProfitabilityTable
            timeframe={timeframe}
            startDate={customStartDate}
            endDate={customEndDate}
            onDataChanged={fetchOverview}
            userRole={user?.role}
          />
        )}

        {/* Tab 2: Financial Transactions Journal */}
        {activeTab === 'journal' && (
          <FinancialTransactionsJournal />
        )}

        {/* Tab 3: Financial & Loss Intelligence */}
        {activeTab === 'intelligence' && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Top Profit Service */}
            <Card className="rounded-2xl border-slate-200/80 shadow-xs bg-white p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Top Service Earner</span>
                <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                  <Award className="w-4 h-4" />
                </span>
              </div>
              <div>
                <h4 className="text-lg font-black text-slate-900">
                  {overviewData?.insights?.mostProfitableCategory?.category || 'Display & Glass Restoration'}
                </h4>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  Generated {formatNPR(overviewData?.insights?.mostProfitableCategory?.revenue || 0)} with {overviewData?.insights?.mostProfitableCategory?.margin || 0}% margin.
                </p>
              </div>
            </Card>

            {/* Damage Loss Deductions */}
            <Card className="rounded-2xl border-slate-200/80 shadow-xs bg-white p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Workshop Incident Impact</span>
                <span className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
                  <AlertTriangle className="w-4 h-4" />
                </span>
              </div>
              <div>
                <h4 className="text-lg font-black text-rose-600 font-mono">
                  {formatNPR(overviewData?.insights?.damageLossImpact || 0)}
                </h4>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  Total workshop repair damages deducted from gross revenue in {getTimeframeLabel(timeframe)}.
                </p>
              </div>
            </Card>

            {/* Parts Cost Efficiency Ratio */}
            <Card className="rounded-2xl border-slate-200/80 shadow-xs bg-white p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">COGS Parts Ratio</span>
                <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Layers className="w-4 h-4" />
                </span>
              </div>
              <div>
                <h4 className="text-lg font-black text-slate-900 font-mono">
                  {overviewData?.insights?.partsCostRatio || 0}% of Inflow
                </h4>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  Healthy target is below 45% for smartphone hardware restoration operations.
                </p>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
