import { useState, useEffect } from 'react';
import { CreditCard, TrendingUp, ArrowUpRight, ArrowDownRight, Download, Calendar as CalendarIcon, Filter, Search, DollarSign, PieChart as PieChartIcon, Clock, FileText, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuGroup } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/services/api';
import { format, subDays } from 'date-fns';
import { generateRepairReport } from '@/services/reportService';
import DashboardRefreshButton from '@/components/DashboardRefreshButton';
import { toast } from 'sonner';
import { formatNPR } from '@/lib/format';
import { useRealtimeSync } from '@/services/realtime';

export default function Revenue() {
  const [repairs, setRepairs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [reportFilters, setReportFilters] = useState({ status: 'ALL', month: format(new Date(), 'yyyy-MM'), startDate: '', endDate: '' });

  const fetchData = async () => {
    try {
      const data = await api.get('/repairs');
      setRepairs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setRepairs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);
  useRealtimeSync(['repair', 'payment'], fetchData);

  const handleAdvancedExport = () => {
    let filtered = repairs;
    if (reportFilters.status !== 'ALL') filtered = filtered.filter(r => r.status === reportFilters.status);
    if (reportFilters.startDate && reportFilters.endDate) {
      const start = new Date(reportFilters.startDate);
      const end = new Date(reportFilters.endDate);
      filtered = filtered.filter(r => { const d = new Date(r.createdAt); return d >= start && d <= end; });
    } else if (reportFilters.month) {
      filtered = filtered.filter(r => format(new Date(r.createdAt), 'yyyy-MM') === reportFilters.month);
    }
    if (!filtered.length) return toast.error('No matching records for these filters');
    generateRepairReport(filtered, `ADVANCED FILTERED REPORT - ${reportFilters.status}`);
    setIsFilterModalOpen(false);
    toast.success('Professional report generated');
  };

  const totalRevenue = repairs.reduce((acc, curr) => acc + Number(curr.totalPaid || curr.advancePaid || 0), 0);
  const pendingRevenue = repairs.reduce((acc, curr) => acc + Math.max(Number(curr.estimatedCost ?? curr.totalCost ?? 0) - Number(curr.totalPaid || 0), 0), 0);
  const pendingCount = repairs.filter(r => Number(r.totalPaid || 0) < Number(r.estimatedCost ?? r.totalCost ?? 0)).length;
  const averageTicket = repairs.length ? totalRevenue / repairs.length : 0;

  const chartData = Array.from({ length: 6 }, (_, index) => {
    const date = subDays(new Date(), 5 - index);
    const key = format(date, 'yyyy-MM-dd');
    const revenue = repairs.reduce((sum, repair) => {
      if (!repair.createdAt || format(new Date(repair.createdAt), 'yyyy-MM-dd') !== key) return sum;
      return sum + Number(repair.totalPaid || 0);
    }, 0);
    return { month: format(date, 'MMM d'), revenue };
  });

  const growth = (() => {
    const now = new Date();
    const currentStart = subDays(now, 7);
    const previousStart = subDays(now, 14);
    let current = 0, previous = 0;
    repairs.forEach(repair => {
      if (!repair.createdAt) return;
      const date = new Date(repair.createdAt);
      const amount = Number(repair.totalPaid || 0);
      if (date >= currentStart) current += amount;
      else if (date >= previousStart) previous += amount;
    });
    return previous === 0 ? (current > 0 ? 100 : 0) : ((current - previous) / previous) * 100;
  })();

  if (loading) return <div className="min-h-[400px] flex items-center justify-center text-sm font-bold text-slate-500">Loading revenue data...</div>;

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div><h2 className="text-3xl font-bold tracking-tight">Accounts & Revenue</h2><p className="text-muted-foreground font-medium">Financial overview based on recorded repair payments.</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <DashboardRefreshButton onRefresh={fetchData} size="default" label="Refresh Revenue" />
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" className="rounded-xl border-slate-200" />}><Download className="mr-2 h-4 w-4" /> Export Report</DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl w-64 p-2 shadow-2xl">
              <DropdownMenuGroup><DropdownMenuLabel className="px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-500">Professional Reports</DropdownMenuLabel></DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => { setReportFilters({...reportFilters, status: 'ALL', month: format(new Date(), 'yyyy-MM')}); handleAdvancedExport(); }} className="h-12 rounded-xl gap-3 font-bold px-4"><FileText className="h-4 w-4 text-indigo-600" /> Current Month (All)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsFilterModalOpen(true)} className="h-12 rounded-xl gap-3 font-bold px-4"><Filter className="h-4 w-4 text-emerald-600" /> Advanced Filters</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button className="rounded-xl bg-black hover:bg-slate-800 font-bold"><CalendarIcon className="mr-2 h-4 w-4" /> This Month</Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-[24px] border-none shadow-sm bg-gradient-to-br from-indigo-600 to-indigo-700 text-white"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-indigo-100 uppercase tracking-wider">Total Revenue</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold font-mono">{formatNPR(totalRevenue)}</div><div className="flex items-center text-xs mt-2 text-indigo-200">{growth >= 0 ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}<span>{growth >= 0 ? '+' : ''}{growth.toFixed(1)}% vs previous 7 days</span></div></CardContent></Card>
        <Card className="rounded-[24px] border-none shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Outstanding Payments</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold text-slate-900 font-mono">{formatNPR(pendingRevenue)}</div><div className="flex items-center text-xs mt-2 text-amber-600 font-bold"><Clock className="h-3 w-3 mr-1" /><span>Pending from {pendingCount} repairs</span></div></CardContent></Card>
        <Card className="rounded-[24px] border-none shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Average Ticket</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold text-slate-900 font-mono">{formatNPR(averageTicket)}</div><div className="flex items-center text-xs mt-2 text-slate-500 font-medium"><CreditCard className="h-3 w-3 mr-1" /> Based on recorded payments</div></CardContent></Card>
        <Card className="rounded-[24px] border-none shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Profit Margin</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-slate-900">Not available</div><div className="flex items-center text-xs mt-2 text-slate-400 font-medium"><AlertCircle className="h-3 w-3 mr-1" /><span>No verified expense source</span></div></CardContent></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-7">
        <Card className="lg:col-span-5 rounded-[24px] border-slate-200 shadow-sm overflow-hidden"><CardHeader className="bg-slate-50/50 border-b"><div><CardTitle>Revenue Analytics</CardTitle><CardDescription>Recorded repair payments for the last 6 days.</CardDescription></div></CardHeader><CardContent className="h-[400px] min-h-[400px] pt-8"><div className="h-full min-h-[320px] min-w-0"><ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={320}><AreaChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" axisLine={false} tickLine={false} /><YAxis axisLine={false} tickLine={false} allowDecimals={false} /><Tooltip formatter={(value) => formatNPR(Number(value || 0))} /><Area type="monotone" dataKey="revenue" strokeWidth={3} fillOpacity={0.12} /></AreaChart></ResponsiveContainer></div></CardContent></Card>
        <Card className="lg:col-span-2 rounded-[24px] border-slate-200 shadow-sm flex flex-col"><CardHeader><CardTitle>Repair Categories</CardTitle><CardDescription>Category analytics unavailable because no verified category revenue source is configured.</CardDescription></CardHeader><CardContent className="flex-1"><div className="p-4 bg-slate-50 rounded-2xl border border-slate-100"><div className="flex items-start gap-4"><div className="p-2 bg-slate-100 rounded-xl text-slate-500"><AlertCircle className="h-5 w-5" /></div><div><p className="text-sm font-bold text-slate-900">No category breakdown</p><p className="text-xs text-slate-500">The system will not invent service percentages. Add a verified service/category revenue source to enable this report.</p></div></div></div></CardContent></Card>
      </div>

      <Card className="rounded-[24px] border-slate-200 shadow-sm overflow-hidden"><CardHeader className="bg-slate-50/50 border-b"><div className="flex flex-col sm:flex-row justify-between gap-4"><div><CardTitle>Recent Payments</CardTitle><CardDescription>Monitor recorded customer payments.</CardDescription></div><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><Input placeholder="Search invoice..." className="pl-10 h-10 w-full sm:w-64 rounded-xl text-sm" /></div></div></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-left"><thead><tr className="border-b bg-slate-50/50 text-slate-500 text-xs font-bold uppercase tracking-wider"><th className="px-6 py-4">Receipt #</th><th className="px-6 py-4">Customer</th><th className="px-6 py-4">Status</th><th className="px-6 py-4">Date</th><th className="px-6 py-4 text-right">Amount</th></tr></thead><tbody className="text-sm">{repairs.slice(0, 8).map((r) => { const paid = Number(r.totalPaid || r.advancePaid || 0); const due = Number(r.estimatedCost ?? r.totalCost ?? 0); return <tr key={r.id} className="border-b last:border-0 hover:bg-slate-50/50 transition-colors"><td className="px-6 py-4 font-mono font-bold text-slate-900">{r.repairNumber}</td><td className="px-6 py-4"><div className="font-bold text-slate-900">{r.customerName}</div><div className="text-xs text-slate-500 font-medium">{r.customerPhone}</div></td><td className="px-6 py-4"><Badge className={paid >= due ? "bg-emerald-100 text-emerald-700 border-none font-bold" : "bg-amber-100 text-amber-700 border-none font-bold"}>{paid >= due ? "PAID" : "PARTIAL"}</Badge></td><td className="px-6 py-4 text-slate-500 font-medium">{r.createdAt ? format(new Date(r.createdAt), 'MMM dd, yyyy') : '—'}</td><td className="px-6 py-4 text-right font-bold text-slate-900">{formatNPR(paid)}</td></tr>; })}</tbody></table></div></CardContent></Card>

      <Dialog open={isFilterModalOpen} onOpenChange={setIsFilterModalOpen}><DialogContent className="rounded-[40px] sm:max-w-lg p-0 overflow-hidden border-none shadow-2xl"><DialogHeader className="bg-slate-900 text-white p-10"><div className="flex items-center gap-4"><div className="p-3 bg-indigo-600 rounded-2xl"><Filter className="h-6 w-6" /></div><div><DialogTitle className="text-2xl font-black">Report Architect</DialogTitle><DialogDescription className="text-slate-400 font-bold">Configure granular PDF export parameters.</DialogDescription></div></div></DialogHeader><div className="p-10 space-y-8 bg-white"><div className="grid grid-cols-2 gap-6"><div className="space-y-3"><Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Repair Status</Label><Select value={reportFilters.status} onValueChange={(v) => setReportFilters({...reportFilters, status: v})}><SelectTrigger className="h-12 rounded-2xl border-slate-200 bg-slate-50 font-bold"><SelectValue placeholder="All Statuses" /></SelectTrigger><SelectContent className="rounded-xl"><SelectItem value="ALL">All Statuses</SelectItem><SelectItem value="RECEIVED">Received</SelectItem><SelectItem value="DIAGNOSING">Diagnosing</SelectItem><SelectItem value="IN_PROCESS">In Progress</SelectItem><SelectItem value="TESTING">Testing</SelectItem><SelectItem value="READY_FOR_PICKUP">Ready for Pickup</SelectItem><SelectItem value="DELIVERED">Returned</SelectItem><SelectItem value="REPROBLEM_FIXED">Re-problem Fixed</SelectItem></SelectContent></Select></div><div className="space-y-3"><Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Select Month</Label><Input type="month" value={reportFilters.month} onChange={(e) => setReportFilters({...reportFilters, month: e.target.value})} className="h-12 rounded-2xl border-slate-200 bg-slate-50 font-bold" /></div></div><div className="relative"><div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-100" /></div><div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-4 text-slate-300 font-bold">OR Specific Range</span></div></div><div className="grid grid-cols-2 gap-6"><div className="space-y-3"><Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Start Date</Label><Input type="date" value={reportFilters.startDate} onChange={(e) => setReportFilters({...reportFilters, startDate: e.target.value})} className="h-12 rounded-2xl border-slate-200 bg-slate-50 font-bold" /></div><div className="space-y-3"><Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">End Date</Label><Input type="date" value={reportFilters.endDate} onChange={(e) => setReportFilters({...reportFilters, endDate: e.target.value})} className="h-12 rounded-2xl border-slate-200 bg-slate-50 font-bold" /></div></div><div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 flex gap-3"><AlertCircle className="h-5 w-5 text-amber-600 shrink-0" /><p className="text-xs text-amber-700 font-medium leading-relaxed">Generating multi-page reports may take a few seconds. Do not close this window during the rendering process.</p></div></div><DialogFooter className="p-10 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row gap-4"><Button variant="ghost" className="h-14 rounded-2xl font-bold flex-1" onClick={() => setIsFilterModalOpen(false)}>Cancel</Button><Button className="h-14 rounded-[20px] bg-black hover:bg-slate-800 text-white font-black flex-1 gap-2 shadow-2xl shadow-black/20" onClick={handleAdvancedExport}><FileText className="h-5 w-5" /> Generate PDF Report</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}