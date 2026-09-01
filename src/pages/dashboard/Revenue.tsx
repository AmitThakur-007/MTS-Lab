import { useState, useEffect } from 'react';
import { 
  CreditCard, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight, 
  Download,
  Calendar as CalendarIcon,
  Filter,
  Search,
  DollarSign,
  PieChart as PieChartIcon,
  Clock,
  FileText,
  AlertCircle
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
  BarChart,
  Bar,
  Legend
} from 'recharts';
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
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { api } from '@/services/api';
import { format, subDays, isAfter, startOfMonth, startOfWeek } from 'date-fns';
import { generateRepairReport } from '@/services/reportService';
import DashboardRefreshButton from '@/components/DashboardRefreshButton';
import { toast } from 'sonner';
import { formatNPR } from '@/lib/format';
import { useRealtimeSync } from '@/services/realtime';

export default function Revenue() {
  const [repairs, setRepairs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const data = await api.get('/repairs');
      setRepairs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Multi-device real-time sync for financial revenue and repair billing
  useRealtimeSync(['repair', 'payment'], () => {
    fetchData();
  });

  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [reportFilters, setReportFilters] = useState({
    status: 'ALL',
    month: format(new Date(), 'yyyy-MM'),
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
        return d >= start && d <= end;
      });
    } else if (reportFilters.month) {
      filtered = filtered.filter(r => format(new Date(r.createdAt), 'yyyy-MM') === reportFilters.month);
    }

    if (filtered.length === 0) {
      return toast.error('No matching records for these filters');
    }

    generateRepairReport(filtered, `ADVANCED FILTERED REPORT - ${reportFilters.status}`);
    setIsFilterModalOpen(false);
    toast.success('Professional report generated');
  };

  const totalRevenue = repairs.reduce((acc, curr) => acc + (curr.totalPaid || 0), 0);
  const pendingRevenue = repairs.reduce((acc, curr) => acc + ((curr.totalCost || 0) - (curr.totalPaid || 0)), 0);

  const chartData = [
    { month: 'Jan', revenue: 4500, expenses: 2100 },
    { month: 'Feb', revenue: 5200, expenses: 2300 },
    { month: 'Mar', revenue: 4800, expenses: 2400 },
    { month: 'Apr', revenue: 6100, expenses: 2800 },
    { month: 'May', revenue: totalRevenue || 5500, expenses: 2500 },
  ];

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Accounts & Revenue</h2>
          <p className="text-muted-foreground font-medium">Financial overview and revenue tracking for your lab.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DashboardRefreshButton
            onRefresh={fetchData}
            size="default"
            label="Refresh Revenue"
          />
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" className="rounded-xl border-slate-200" />}>
              <Download className="mr-2 h-4 w-4" /> Export Report
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl w-64 p-2 shadow-2xl">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-500">Professional Reports</DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => { setReportFilters({...reportFilters, status: 'ALL', month: format(new Date(), 'yyyy-MM')}); handleAdvancedExport(); }} className="h-12 rounded-xl gap-3 font-bold px-4">
                <FileText className="h-4 w-4 text-indigo-600" /> Current Month (All)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsFilterModalOpen(true)} className="h-12 rounded-xl gap-3 font-bold px-4">
                <Filter className="h-4 w-4 text-emerald-600" /> Advanced Filters
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button className="rounded-xl bg-black hover:bg-slate-800 font-bold">
            <CalendarIcon className="mr-2 h-4 w-4" /> This Month
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-[24px] border-none shadow-sm bg-gradient-to-br from-indigo-600 to-indigo-700 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-indigo-100 uppercase tracking-wider">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono">{formatNPR(totalRevenue)}</div>
            <div className="flex items-center text-xs mt-2 text-indigo-200">
              <ArrowUpRight className="h-3 w-3 mr-1" />
              <span>+14.2% from last month</span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[24px] border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Outstanding Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900 font-mono">{formatNPR(pendingRevenue)}</div>
            <div className="flex items-center text-xs mt-2 text-amber-600 font-bold">
              <Clock className="h-3 w-3 mr-1" />
              <span>Pending from {repairs.filter(r => r.totalPaid < r.totalCost).length} repairs</span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[24px] border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Average Ticket</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900 font-mono">{formatNPR(totalRevenue / (repairs.length || 1))}</div>
            <div className="flex items-center text-xs mt-2 text-emerald-600 font-bold">
              <ArrowUpRight className="h-3 w-3 mr-1" />
              <span>+5.1% efficiency</span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[24px] border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Profit Margin</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900 font-mono">68.4%</div>
            <div className="flex items-center text-xs mt-2 text-slate-400 font-medium">
              <span>After components cost</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-7">
        <Card className="lg:col-span-5 rounded-[24px] border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Revenue Analytics</CardTitle>
                <CardDescription>Monthly revenue vs operational expenses.</CardDescription>
              </div>
              <div className="flex gap-2">
                 <Badge variant="outline" className="bg-white border-slate-200 text-indigo-600 font-bold px-3 py-1">Revenue</Badge>
                 <Badge variant="outline" className="bg-white border-slate-200 text-slate-400 font-bold px-3 py-1">Expenses</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="h-[400px] pt-8 min-w-0 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={300}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip 
                   contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                <Area type="monotone" dataKey="expenses" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 rounded-[24px] border-slate-200 shadow-sm flex flex-col">
          <CardHeader>
            <CardTitle>Repair Categories</CardTitle>
            <CardDescription>Revenue by service type.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-6">
             <div className="space-y-4">
               {[
                 { label: 'Screen Repair', count: '45%', color: 'bg-indigo-600' },
                 { label: 'Battery Swap', count: '28%', color: 'bg-blue-500' },
                 { label: 'Motherboard', count: '15%', color: 'bg-emerald-500' },
                 { label: 'Accessories', count: '12%', color: 'bg-slate-400' },
               ].map((item, i) => (
                 <div key={i} className="space-y-1.5">
                   <div className="flex justify-between text-xs font-bold">
                     <span className="text-slate-600">{item.label}</span>
                     <span>{item.count}</span>
                   </div>
                   <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                     <div className={`h-full ${item.color}`} style={{ width: item.count }} />
                   </div>
                 </div>
               ))}
             </div>
             <div className="mt-8 p-4 bg-slate-50 rounded-2xl border border-slate-100">
               <div className="flex items-start gap-4">
                 <div className="p-2 bg-indigo-100 rounded-xl text-indigo-600">
                   <TrendingUp className="h-5 w-5" />
                 </div>
                 <div>
                   <p className="text-sm font-bold text-slate-900">Highest Earner</p>
                   <p className="text-xs text-slate-500">iPhone 15 Pro Display replacements generated ₹85k this week.</p>
                 </div>
               </div>
             </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[24px] border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b">
           <div className="flex flex-col sm:flex-row justify-between gap-4">
             <div>
               <CardTitle>Recent Payments</CardTitle>
               <CardDescription>Monitor inflow from customers.</CardDescription>
             </div>
             <div className="relative">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
               <Input placeholder="Search invoice..." className="pl-10 h-10 w-full sm:w-64 rounded-xl text-sm" />
             </div>
           </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
               <thead>
                 <tr className="border-b bg-slate-50/50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                   <th className="px-6 py-4">Receipt #</th>
                   <th className="px-6 py-4">Customer</th>
                   <th className="px-6 py-4">Status</th>
                   <th className="px-6 py-4">Date</th>
                   <th className="px-6 py-4 text-right">Amount</th>
                 </tr>
               </thead>
               <tbody className="text-sm">
                 {repairs.slice(0, 8).map((r) => (
                   <tr key={r.id} className="border-b last:border-0 hover:bg-slate-50/50 transition-colors">
                     <td className="px-6 py-4 font-mono font-bold text-slate-900">{r.repairNumber}</td>
                     <td className="px-6 py-4">
                       <div className="font-bold text-slate-900">{r.customerName}</div>
                       <div className="text-xs text-slate-500 font-medium">{r.customerPhone}</div>
                     </td>
                     <td className="px-6 py-4">
                       <Badge className={r.totalPaid >= r.totalCost ? "bg-emerald-100 text-emerald-700 border-none font-bold" : "bg-amber-100 text-amber-700 border-none font-bold"}>
                         {r.totalPaid >= r.totalCost ? "PAID" : "PARTIAL"}
                       </Badge>
                     </td>
                     <td className="px-6 py-4 text-slate-500 font-medium">
                       {format(new Date(r.createdAt), 'MMM dd, yyyy')}
                     </td>
                     <td className="px-6 py-4 text-right font-bold text-slate-900">
                        ₹{r.totalPaid.toLocaleString()}
                     </td>
                   </tr>
                 ))}
               </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      <Dialog open={isFilterModalOpen} onOpenChange={setIsFilterModalOpen}>
        <DialogContent className="rounded-[40px] sm:max-w-lg p-0 overflow-hidden border-none shadow-2xl">
           <DialogHeader className="bg-slate-900 text-white p-10">
              <div className="flex items-center gap-4">
                 <div className="p-3 bg-indigo-600 rounded-2xl">
                   <Filter className="h-6 w-6" />
                 </div>
                 <div>
                    <DialogTitle className="text-2xl font-black">Report Architect</DialogTitle>
                    <DialogDescription className="text-slate-400 font-bold">Configure granular PDF export parameters.</DialogDescription>
                 </div>
              </div>
           </DialogHeader>
           <div className="p-10 space-y-8 bg-white">
              <div className="grid grid-cols-2 gap-6">
                 <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Repair Status</Label>
                    <Select value={reportFilters.status} onValueChange={(v) => setReportFilters({...reportFilters, status: v})}>
                       <SelectTrigger className="h-12 rounded-2xl border-slate-200 bg-slate-50 font-bold">
                          <SelectValue placeholder="All Statuses" />
                       </SelectTrigger>
                       <SelectContent className="rounded-xl">
                          <SelectItem value="ALL">All Statuses</SelectItem>
                          <SelectItem value="RECEIVED">Received</SelectItem>
                          <SelectItem value="DIAGNOSING">Diagnosing</SelectItem>
                          <SelectItem value="IN_PROCESS">In Progress</SelectItem>
                          <SelectItem value="TESTING">Testing</SelectItem>
                          <SelectItem value="READY_FOR_PICKUP">Ready for Pickup</SelectItem>
                          <SelectItem value="DELIVERED">Returned</SelectItem>
                          <SelectItem value="REPROBLEM_FIXED">Re-problem Fixed</SelectItem>
                       </SelectContent>
                    </Select>
                 </div>
                 <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Select Month</Label>
                    <Input 
                      type="month" 
                      value={reportFilters.month} 
                      onChange={(e) => setReportFilters({...reportFilters, month: e.target.value})}
                      className="h-12 rounded-2xl border-slate-200 bg-slate-50 font-bold"
                    />
                 </div>
              </div>

              <div className="relative">
                 <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-slate-100" />
                 </div>
                 <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-4 text-slate-300 font-bold">OR Specific Range</span>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                 <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Start Date</Label>
                    <Input 
                      type="date" 
                      value={reportFilters.startDate} 
                      onChange={(e) => setReportFilters({...reportFilters, startDate: e.target.value})}
                      className="h-12 rounded-2xl border-slate-200 bg-slate-50 font-bold"
                    />
                 </div>
                 <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">End Date</Label>
                    <Input 
                      type="date" 
                      value={reportFilters.endDate} 
                      onChange={(e) => setReportFilters({...reportFilters, endDate: e.target.value})}
                      className="h-12 rounded-2xl border-slate-200 bg-slate-50 font-bold"
                    />
                 </div>
              </div>

              <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 flex gap-3">
                 <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
                 <p className="text-xs text-amber-700 font-medium leading-relaxed">
                   Generating multi-page reports may take a few seconds. Do not close this window during the rendering process.
                 </p>
              </div>
           </div>
           <DialogFooter className="p-10 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row gap-4">
              <Button variant="ghost" className="h-14 rounded-2xl font-bold flex-1" onClick={() => setIsFilterModalOpen(false)}>
                Cancel
              </Button>
              <Button 
                className="h-14 rounded-[20px] bg-black hover:bg-slate-800 text-white font-black flex-1 gap-2 shadow-2xl shadow-black/20"
                onClick={handleAdvancedExport}
              >
                <FileText className="h-5 w-5" /> Generate PDF Report
              </Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
