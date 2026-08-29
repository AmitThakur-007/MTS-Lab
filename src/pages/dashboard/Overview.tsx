import { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, 
  Users, 
  Package, 
  Wrench, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight,
  Plus,
  Search,
  MoreVertical,
  Smartphone,
  Calendar,
  Clock,
  ChevronRight,
  Zap,
  MousePointer2,
  Filter,
  FileWarning,
  CheckCircle2,
  AlertCircle,
  Truck,
  ExternalLink,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  Cell
} from 'recharts';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { useRealtimeSync } from '@/services/realtime';
import DashboardRefreshButton from '@/components/DashboardRefreshButton';
import UserOverviewCards from '@/components/dashboard/UserOverviewCards';
import { formatTimeAgo, formatShortTimeAgo } from '@/lib/timeUtils';
import { format, subDays, isSameDay } from 'date-fns';

const statusConfig: Record<string, { label: string; badge: string; bgSoft: string; textClass: string }> = {
  PENDING: { label: 'Pending', badge: 'bg-slate-100 text-slate-700 border-slate-300', bgSoft: 'bg-slate-50', textClass: 'text-slate-700' },
  RECEIVED: { label: 'Received', badge: 'bg-amber-100 text-amber-900 border-amber-300', bgSoft: 'bg-amber-50', textClass: 'text-amber-800' },
  DIAGNOSING: { label: 'Diagnosing', badge: 'bg-blue-100 text-blue-900 border-blue-300', bgSoft: 'bg-blue-50', textClass: 'text-blue-800' },
  IN_PROCESS: { label: 'In Progress', badge: 'bg-indigo-100 text-indigo-900 border-indigo-300', bgSoft: 'bg-indigo-50', textClass: 'text-indigo-800' },
  WAITING_FOR_PARTS: { label: 'Parts Pending', badge: 'bg-purple-100 text-purple-900 border-purple-300', bgSoft: 'bg-purple-50', textClass: 'text-purple-800' },
  TESTING: { label: 'Testing QA', badge: 'bg-orange-100 text-orange-900 border-orange-300', bgSoft: 'bg-orange-50', textClass: 'text-orange-800' },
  REPAIRED: { label: 'Repaired', badge: 'bg-teal-100 text-teal-900 border-teal-300', bgSoft: 'bg-teal-50', textClass: 'text-teal-800' },
  READY_FOR_PICKUP: { label: 'Ready for Pickup', badge: 'bg-emerald-600 text-white border-transparent', bgSoft: 'bg-emerald-50', textClass: 'text-emerald-800' },
  DELIVERED: { label: 'Delivered', badge: 'bg-slate-200 text-slate-800 border-slate-300', bgSoft: 'bg-slate-50', textClass: 'text-slate-700' },
  RE_PROBLEM: { label: 'Re-Problem (Warranty)', badge: 'bg-rose-100 text-rose-800 border-rose-300 font-bold', bgSoft: 'bg-rose-50', textClass: 'text-rose-800' },
  REPROBLEM: { label: 'Re-Problem (Warranty)', badge: 'bg-rose-100 text-rose-800 border-rose-300 font-bold', bgSoft: 'bg-rose-50', textClass: 'text-rose-800' },
  CANNOT_REPAIR: { label: 'Cannot Repair', badge: 'bg-rose-100 text-rose-800 border-rose-300', bgSoft: 'bg-rose-50', textClass: 'text-rose-800' },
  CANCELLED: { label: 'Cancelled', badge: 'bg-slate-100 text-slate-600 border-slate-200', bgSoft: 'bg-slate-50', textClass: 'text-slate-600' }
};

export default function Overview() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<any>(null);
  const [repairs, setRepairs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [damageOverview, setDamageOverview] = useState<any>(null);
  const navigate = useNavigate();

  const fetchStats = async () => {
    try {
      const [statsData, repairsData, damageData] = await Promise.allSettled([
        api.get('/dashboard/stats'),
        api.get('/repairs'),
        api.get('/repair-damage/overview')
      ]);
      if (statsData.status === 'fulfilled') setStats(statsData.value);
      if (repairsData.status === 'fulfilled' && Array.isArray(repairsData.value)) {
        setRepairs(repairsData.value);
      }
      if (damageData.status === 'fulfilled' && damageData.value) {
        setDamageOverview(damageData.value);
      }
    } catch (err: any) {
      console.error('[OVERVIEW FETCH ERROR]', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  // Instant Real-time updates for dashboard metrics when any repair, payment, product, or staff change occurs
  useRealtimeSync(['repair', 'repairLog', 'payment', 'product', 'user', 'sync'], () => {
    fetchStats();
  });

  // Dynamic 7-day intake analytics computed from real database records
  const chartData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = subDays(new Date(), 6 - i);
      return {
        date: d,
        day: format(d, 'EEE'),
        count: 0
      };
    });

    repairs.forEach((r) => {
      if (!r.createdAt) return;
      const created = new Date(r.createdAt);
      if (isNaN(created.getTime())) return;
      const entry = last7Days.find(d => isSameDay(d.date, created));
      if (entry) {
        entry.count++;
      }
    });

    return last7Days.map(d => ({ day: d.day, count: d.count }));
  }, [repairs]);

  // Recent 8 repairs sorted strictly newest first
  const recentRepairs = useMemo(() => {
    return [...repairs]
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 8);
  }, [repairs]);

  if (loading) return (
    <div className="h-full flex flex-col items-center justify-center py-24 sm:py-32 gap-3">
      <Zap className="h-10 w-10 text-indigo-500 animate-pulse" />
      <p className="text-slate-500 font-extrabold uppercase tracking-widest text-[11px]">Synchronizing Core Systems...</p>
    </div>
  );

  return (
    <div className="space-y-6 sm:space-y-8 pb-20 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-slate-900">
            Welcome back, <span className="text-indigo-600">{user?.name}</span>
          </h2>
          <p className="text-slate-500 font-medium text-xs sm:text-sm flex items-center gap-2">
            <span>System status is</span>
            <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-200 font-extrabold text-[10px] px-2 py-0.2 rounded-md">
              Optimal
            </Badge>
            <span>across all connected hubs. Total registered repairs: <strong className="text-slate-900 font-bold">{repairs.length}</strong></span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
           <DashboardRefreshButton 
             onRefresh={fetchStats}
             size="sm"
             variant="outline"
             className="h-10 sm:h-11 rounded-xl text-xs font-bold px-3.5"
             label="Refresh Metrics"
           />
           <Link to="/dashboard/repairs/new">
             <Button className="rounded-xl h-10 sm:h-11 px-5 bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm shadow-md shadow-slate-900/10 cursor-pointer flex items-center gap-1.5">
               <Plus className="h-4 w-4" /> Create Repair
             </Button>
           </Link>
        </div>
      </div>

      {/* 4 Stat Summary Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all cursor-pointer bg-white group" onClick={() => navigate('/dashboard/repairs')}>
            <CardContent className="p-5 sm:p-6 space-y-4">
              <div className="flex justify-between items-start">
                 <div className="w-11 h-11 bg-indigo-600 rounded-2xl text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
                    <Wrench className="h-5 w-5" />
                 </div>
                 <Badge variant="outline" className="rounded-lg border-indigo-200 bg-indigo-50 text-indigo-700 font-extrabold text-[10px] px-2.5 py-0.5">Live</Badge>
              </div>
              <div>
                <p className="text-slate-400 font-extrabold uppercase tracking-wider text-[10px] mb-0.5">Active Repairs</p>
                <div className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">{stats?.activeRepairs ?? repairs.length}</div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all cursor-pointer bg-white group" onClick={() => navigate('/dashboard/inventory')}>
            <CardContent className="p-5 sm:p-6 space-y-4">
              <div className="flex justify-between items-start">
                 <div className="w-11 h-11 bg-slate-900 rounded-2xl text-white flex items-center justify-center shadow-md shadow-black/15">
                    <Package className="h-5 w-5" />
                 </div>
                 <Badge variant="outline" className="rounded-lg border-slate-200 bg-slate-50 text-slate-700 font-extrabold text-[10px] px-2.5 py-0.5">Stock</Badge>
              </div>
              <div>
                <p className="text-slate-400 font-extrabold uppercase tracking-wider text-[10px] mb-0.5">Inventory Items</p>
                <div className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">{stats?.totalProducts || 0}</div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="rounded-2xl sm:rounded-3xl border border-emerald-600/30 shadow-xs hover:shadow-md bg-emerald-600 text-white transition-all cursor-pointer group" onClick={() => navigate('/dashboard/revenue')}>
            <CardContent className="p-5 sm:p-6 space-y-4">
              <div className="flex justify-between items-start">
                 <div className="w-11 h-11 bg-white/20 backdrop-blur-xs rounded-2xl text-white flex items-center justify-center">
                    <BarChart3 className="h-5 w-5" />
                 </div>
                 <div className="p-1.5 bg-emerald-500/60 rounded-lg">
                    <ArrowUpRight className="h-4 w-4 text-white" />
                 </div>
              </div>
              <div>
                <p className="text-emerald-100 font-extrabold uppercase tracking-wider text-[10px] mb-0.5">Total System Intake</p>
                <div className="text-3xl sm:text-4xl font-black tracking-tight text-white">{repairs.length} Jobs</div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all cursor-pointer bg-white group" onClick={() => navigate('/dashboard/staff')}>
            <CardContent className="p-5 sm:p-6 space-y-4">
              <div className="flex justify-between items-start">
                 <div className="w-11 h-11 bg-indigo-50 rounded-2xl text-indigo-600 flex items-center justify-center border border-indigo-100">
                    <Users className="h-5 w-5" />
                 </div>
                 <Badge variant="outline" className="rounded-lg border-slate-200 bg-slate-100 text-slate-700 font-extrabold text-[10px] px-2.5 py-0.5">Staff</Badge>
              </div>
              <div>
                <p className="text-slate-400 font-extrabold uppercase tracking-wider text-[10px] mb-0.5">Staff Registered</p>
                <div className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">{stats?.totalUsers || 0}</div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* User Overview Section: Attendance & Repair Damage Record */}
      <UserOverviewCards />

      {/* Live Recent Repairs Section */}
      <Card className="rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden bg-white">
        <CardHeader className="p-5 sm:p-6 pb-4 flex flex-row items-center justify-between border-b border-slate-100">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg sm:text-xl font-black tracking-tight text-slate-900">
                Recent Repair Intakes
              </CardTitle>
              <Badge className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-black">
                {repairs.length} Total
              </Badge>
            </div>
            <CardDescription className="text-xs font-medium text-slate-500">
              Live updates directly from lab intake & service operations.
            </CardDescription>
          </div>
          <Link to="/dashboard/repairs">
            <Button variant="outline" size="sm" className="rounded-xl h-9 text-xs font-bold gap-1.5 border-slate-200 hover:bg-slate-50">
              <span>View All Repairs</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {recentRepairs.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <Wrench className="h-6 w-6" />
              </div>
              <p className="text-sm font-bold text-slate-800">No repairs registered yet</p>
              <p className="text-xs text-slate-400">Click below to create your first repair order</p>
              <Link to="/dashboard/repairs/new">
                <Button size="sm" className="mt-2 rounded-xl bg-slate-950 text-white font-bold text-xs">
                  <Plus className="h-3.5 w-3.5 mr-1" /> New Repair
                </Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 overflow-x-auto">
              {recentRepairs.map((repair) => {
                const statusStyle = statusConfig[repair.status] || {
                  label: repair.status,
                  badge: 'bg-slate-100 text-slate-800 border-slate-300',
                  bgSoft: 'bg-slate-50',
                  textClass: 'text-slate-700'
                };
                const isUrgent = repair.priority === 'URGENT';
                const isHigh = repair.priority === 'HIGH';

                return (
                  <div 
                    key={repair.id} 
                    onClick={() => navigate(`/dashboard/repairs/${repair.id}`)}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100 group-hover:bg-indigo-600 group-hover:text-white transition-colors shadow-xs">
                        <Smartphone className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-xs text-indigo-700 bg-indigo-50/80 px-2 py-0.5 rounded-md border border-indigo-100">
                            #{repair.repairNumber}
                          </span>
                          <span className="font-extrabold text-sm text-slate-900 truncate">
                            {repair.deviceBrand} {repair.deviceModel}
                          </span>
                          {isUrgent && (
                            <Badge className="bg-rose-500 text-white text-[10px] font-black uppercase px-1.5 py-0">
                              Urgent
                            </Badge>
                          )}
                          {isHigh && (
                            <Badge className="bg-amber-500 text-white text-[10px] font-black uppercase px-1.5 py-0">
                              High Priority
                            </Badge>
                          )}
                          {repair.batteryWarranty && (
                            <Badge className="bg-teal-50 text-teal-700 border border-teal-200 text-[10px] font-bold">
                              Warranty: {repair.batteryWarranty.warrantyNumber}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-700">{repair.customerName}</span>
                          <span>•</span>
                          <span>{repair.customerPhone}</span>
                          {repair.problemDescription && (
                            <>
                              <span>•</span>
                              <span className="truncate max-w-[200px] sm:max-w-[300px] text-slate-400">
                                {repair.problemDescription}
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                      <div className="text-right hidden md:block">
                        <p className="text-xs font-semibold text-slate-700">
                          {repair.technician?.name ? (
                            <span className="flex items-center gap-1 text-slate-800">
                              <UserCheck className="h-3.5 w-3.5 text-indigo-500" />
                              {repair.technician.name}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">Unassigned</span>
                          )}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {formatShortTimeAgo(repair.createdAt)}
                        </p>
                      </div>
                      <Badge className={cn("text-xs font-bold border px-2.5 py-1 rounded-lg", statusStyle.badge)}>
                        {statusStyle.label}
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-900 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analytics Chart & Side Panels */}
      <div className="grid gap-6 lg:grid-cols-7">
        <Card className="lg:col-span-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden bg-white">
          <CardHeader className="p-5 sm:p-6 pb-2 flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg sm:text-xl font-black tracking-tight text-slate-900">System Intake Analytics</CardTitle>
              <CardDescription className="text-xs font-medium text-slate-500">Live repair intake volume over the past 7 days.</CardDescription>
            </div>
            <div className="flex gap-1.5">
               <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9 text-slate-400 hover:text-slate-700 cursor-pointer">
                  <Filter className="h-4 w-4" />
               </Button>
            </div>
          </CardHeader>
          <CardContent className="h-[280px] sm:h-[340px] lg:h-[380px] p-4 sm:p-6 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="day" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }}
                  dy={10}
                />
                <YAxis 
                   axisLine={false} 
                   tickLine={false} 
                   tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }}
                   dx={-10}
                   allowDecimals={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: '1px solid #e2e8f0', 
                    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
                    padding: '12px' 
                  }}
                  itemStyle={{ fontWeight: 800, color: '#1e293b', fontSize: '12px' }}
                  labelStyle={{ fontWeight: 700, color: '#64748b', fontSize: '11px', marginBottom: '2px' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#6366f1" 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#colorCount)" 
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Side Column */}
        <div className="lg:col-span-2 space-y-6 flex flex-col">
           <Card className="rounded-2xl sm:rounded-3xl border border-indigo-500/30 shadow-xs bg-indigo-600 text-white overflow-hidden relative">
              <CardContent className="p-5 sm:p-6 space-y-4 relative z-10">
                 <div className="space-y-2">
                    <h4 className="text-base font-bold flex items-center gap-2">
                       <Zap className="h-4 w-4 fill-white" /> Performance Hub
                    </h4>
                    <p className="text-indigo-100 text-xs font-medium leading-relaxed">
                       Kathmandu Central Lab has registered <span className="font-extrabold underline decoration-indigo-300">{repairs.length} repairs</span> across all devices.
                    </p>
                 </div>
                 <Button 
                   onClick={() => navigate('/dashboard/repairs')}
                   className="w-full h-10 bg-white text-indigo-700 font-bold text-xs rounded-xl hover:bg-indigo-50 transition-all gap-1.5 border-none shadow-sm cursor-pointer"
                 >
                    <span>View All Repairs</span>
                    <ChevronRight className="h-4 w-4" />
                 </Button>
              </CardContent>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-2xl rounded-full" />
           </Card>

           <Card className="rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs p-5 sm:p-6 flex-1 flex flex-col justify-between space-y-4 bg-white">
              <div className="space-y-4">
                 <div className="flex justify-between items-center">
                    <h5 className="font-black text-slate-900 tracking-tight text-sm sm:text-base">Recent Activity</h5>
                    <Link to="/dashboard/repairs" className="font-extrabold text-[10px] text-indigo-600 uppercase tracking-widest hover:underline">
                      Repairs Hub
                    </Link>
                 </div>
                 <div className="space-y-3">
                    {recentRepairs.slice(0, 4).map((r) => (
                      <div 
                        key={r.id} 
                        onClick={() => navigate(`/dashboard/repairs/${r.id}`)}
                        className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group"
                      >
                         <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                           <Smartphone className="h-4 w-4 text-slate-500 group-hover:text-indigo-600" />
                         </div>
                         <div className="min-w-0 flex-1 space-y-0.5">
                            <p className="text-xs font-bold text-slate-900 truncate">#{r.repairNumber} - {r.deviceBrand} {r.deviceModel}</p>
                            <p className="text-[11px] text-slate-400 font-medium truncate">{r.customerName} • {r.status}</p>
                         </div>
                      </div>
                    ))}
                 </div>
              </div>
           </Card>
        </div>
      </div>
    </div>
  );
}
