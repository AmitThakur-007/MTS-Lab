import { useState, useEffect } from 'react';
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
  FileWarning
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

export default function Overview() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [damageOverview, setDamageOverview] = useState<any>(null);
  const navigate = useNavigate();

  const fetchStats = async () => {
    try {
      const [data, damageData] = await Promise.allSettled([
        api.get('/dashboard/stats'),
        api.get('/repair-damage/overview')
      ]);
      if (data.status === 'fulfilled') setStats(data.value);
      if (damageData.status === 'fulfilled' && damageData.value) setDamageOverview(damageData.value);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  // Instant Real-time updates for dashboard metrics when any repair, payment, product, or staff change occurs
  useRealtimeSync(['repair', 'payment', 'product', 'user', 'sync'], () => {
    fetchStats();
  });

  const chartData = [
    { day: 'Mon', count: 12 },
    { day: 'Tue', count: 18 },
    { day: 'Wed', count: 24 },
    { day: 'Thu', count: 32 },
    { day: 'Fri', count: 28 },
    { day: 'Sat', count: 35 },
    { day: 'Sun', count: 22 },
  ];

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
            <span>across all connected hubs.</span>
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
          <Card className="rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all cursor-pointer bg-white group">
            <CardContent className="p-5 sm:p-6 space-y-4">
              <div className="flex justify-between items-start">
                 <div className="w-11 h-11 bg-indigo-600 rounded-2xl text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
                    <Wrench className="h-5 w-5" />
                 </div>
                 <Badge variant="outline" className="rounded-lg border-indigo-200 bg-indigo-50 text-indigo-700 font-extrabold text-[10px] px-2.5 py-0.5">+12%</Badge>
              </div>
              <div>
                <p className="text-slate-400 font-extrabold uppercase tracking-wider text-[10px] mb-0.5">Active Repairs</p>
                <div className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">{stats?.activeRepairs || 0}</div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all cursor-pointer bg-white group">
            <CardContent className="p-5 sm:p-6 space-y-4">
              <div className="flex justify-between items-start">
                 <div className="w-11 h-11 bg-slate-900 rounded-2xl text-white flex items-center justify-center shadow-md shadow-black/15">
                    <Package className="h-5 w-5" />
                 </div>
                 <Badge variant="outline" className="rounded-lg border-amber-200 bg-amber-50 text-amber-700 font-extrabold text-[10px] px-2.5 py-0.5">Low Stock</Badge>
              </div>
              <div>
                <p className="text-slate-400 font-extrabold uppercase tracking-wider text-[10px] mb-0.5">Inventory Items</p>
                <div className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">{stats?.totalProducts || 0}</div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="rounded-2xl sm:rounded-3xl border border-emerald-600/30 shadow-xs hover:shadow-md bg-emerald-600 text-white transition-all cursor-pointer group">
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
                <p className="text-emerald-100 font-extrabold uppercase tracking-wider text-[10px] mb-0.5">Weekly Growth</p>
                <div className="text-3xl sm:text-4xl font-black tracking-tight text-white">24.8%</div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all cursor-pointer bg-white group">
            <CardContent className="p-5 sm:p-6 space-y-4">
              <div className="flex justify-between items-start">
                 <div className="w-11 h-11 bg-indigo-50 rounded-2xl text-indigo-600 flex items-center justify-center border border-indigo-100">
                    <Users className="h-5 w-5" />
                 </div>
                 <Badge variant="outline" className="rounded-lg border-slate-200 bg-slate-100 text-slate-700 font-extrabold text-[10px] px-2.5 py-0.5">Active</Badge>
              </div>
              <div>
                <p className="text-slate-400 font-extrabold uppercase tracking-wider text-[10px] mb-0.5">Staff Online</p>
                <div className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">{stats?.totalUsers || 0}</div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* User Overview Section: Attendance & Repair Damage Record */}
      <UserOverviewCards />

      {/* Analytics Chart & Side Panels */}
      <div className="grid gap-6 lg:grid-cols-7">
        <Card className="lg:col-span-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden bg-white">
          <CardHeader className="p-5 sm:p-6 pb-2 flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg sm:text-xl font-black tracking-tight text-slate-900">System Intake Analytics</CardTitle>
              <CardDescription className="text-xs font-medium text-slate-500">Daily repair registrations monitored across 7 days.</CardDescription>
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
                       <Zap className="h-4 w-4 fill-white" /> Performance Boost
                    </h4>
                    <p className="text-indigo-100 text-xs font-medium leading-relaxed">
                       Your branch has completed <span className="font-extrabold underline decoration-indigo-300">85%</span> of your target repairs for this month.
                    </p>
                 </div>
                 <Button 
                   onClick={() => navigate('/dashboard/repairs')}
                   className="w-full h-10 bg-white text-indigo-700 font-bold text-xs rounded-xl hover:bg-indigo-50 transition-all gap-1.5 border-none shadow-sm cursor-pointer"
                 >
                    <span>View Productivity</span>
                    <ChevronRight className="h-4 w-4" />
                 </Button>
              </CardContent>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-2xl rounded-full" />
           </Card>

           <Card className="rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs p-5 sm:p-6 flex-1 flex flex-col justify-between space-y-4 bg-white">
              <div className="space-y-4">
                 <div className="flex justify-between items-center">
                    <h5 className="font-black text-slate-900 tracking-tight text-sm sm:text-base">System Logs</h5>
                    <Link to="/dashboard/super-admin" className="font-extrabold text-[10px] text-indigo-600 uppercase tracking-widest hover:underline">
                      History Hub
                    </Link>
                 </div>
                 <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group">
                         <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                           <Smartphone className="h-4 w-4 text-slate-500 group-hover:text-indigo-600" />
                         </div>
                         <div className="min-w-0 flex-1 space-y-0.5">
                            <p className="text-xs font-bold text-slate-900 truncate">Repair #{1000 + i} Status Updated</p>
                            <p className="text-[11px] text-slate-400 font-medium truncate">Diagnostics Complete & QA Passed</p>
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
