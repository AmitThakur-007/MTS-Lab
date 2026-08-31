import { useState, useEffect, useMemo } from 'react';
import { BarChart3, Users, Package, Wrench, TrendingUp, ArrowUpRight, Plus, Smartphone, ChevronRight, Zap, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/services/api';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useRealtimeSync } from '@/services/realtime';
import DashboardRefreshButton from '@/components/DashboardRefreshButton';
import UserOverviewCards from '@/components/dashboard/UserOverviewCards';

const unwrap = (response: any) => response?.data?.data ?? response?.data ?? response;

export default function Overview() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchStats = async () => {
    try {
      const response = await api.get('/dashboard/stats');
      setStats(unwrap(response));
    } catch (error) {
      console.error('[OVERVIEW STATS]', error);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStats(); }, []);
  useRealtimeSync(['repair', 'payment', 'product', 'user', 'sync'], fetchStats);

  const chartData = useMemo(() => {
    if (Array.isArray(stats?.dailyRepairIntake) && stats.dailyRepairIntake.length) return stats.dailyRepairIntake;
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));
      return { day: date.toLocaleDateString(undefined, { weekday: 'short' }), count: 0 };
    });
  }, [stats]);

  const growth = Number(stats?.revenueGrowth ?? 0);
  const growthLabel = `${growth > 0 ? '+' : ''}${growth.toFixed(1)}%`;
  const targetConfigured = Number(stats?.monthlyRepairTarget) > 0;
  const targetCompletion = targetConfigured
    ? Math.min(100, (Number(stats?.completedRepairs || 0) / Number(stats.monthlyRepairTarget)) * 100)
    : null;

  if (loading) return <div className="h-full flex flex-col items-center justify-center py-24 gap-3"><Zap className="h-10 w-10 text-indigo-500 animate-pulse" /><p className="text-slate-500 font-extrabold uppercase tracking-widest text-[11px]">Synchronizing Core Systems...</p></div>;

  return (
    <div className="space-y-6 sm:space-y-8 pb-20 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div><h2 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-slate-900">Welcome back, <span className="text-indigo-600">{user?.name}</span></h2><p className="text-slate-500 font-medium text-xs sm:text-sm">Live metrics from your authorized data.</p></div>
        <div className="flex flex-wrap items-center gap-2.5"><DashboardRefreshButton onRefresh={fetchStats} size="sm" variant="outline" className="h-10 sm:h-11 rounded-xl text-xs font-bold px-3.5" label="Refresh Metrics" /><Link to="/dashboard/repairs/new"><Button className="rounded-xl h-10 sm:h-11 px-5 bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm"><Plus className="h-4 w-4" /> Create Repair</Button></Link></div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}><Card><CardContent className="p-5 sm:p-6 space-y-4"><div className="w-11 h-11 bg-indigo-600 rounded-2xl text-white flex items-center justify-center"><Wrench className="h-5 w-5" /></div><div><p className="text-slate-400 font-extrabold uppercase tracking-wider text-[10px]">Active Repairs</p><div className="text-3xl sm:text-4xl font-black">{stats?.activeRepairs ?? 0}</div></div></CardContent></Card></motion.div>
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}><Card><CardContent className="p-5 sm:p-6 space-y-4"><div className="w-11 h-11 bg-slate-900 rounded-2xl text-white flex items-center justify-center"><Package className="h-5 w-5" /></div><div><p className="text-slate-400 font-extrabold uppercase tracking-wider text-[10px]">Inventory Items</p><div className="text-3xl sm:text-4xl font-black">{stats?.totalProducts ?? 0}</div></div></CardContent></Card></motion.div>
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}><Card className="bg-emerald-600 text-white"><CardContent className="p-5 sm:p-6 space-y-4"><div className="flex justify-between"><div className="w-11 h-11 bg-white/20 rounded-2xl flex items-center justify-center"><BarChart3 className="h-5 w-5" /></div><ArrowUpRight className="h-5 w-5" /></div><div><p className="text-emerald-100 font-extrabold uppercase tracking-wider text-[10px]">Weekly Growth</p><div className="text-3xl sm:text-4xl font-black">{growthLabel}</div></div></CardContent></Card></motion.div>
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}><Card><CardContent className="p-5 sm:p-6 space-y-4"><div className="w-11 h-11 bg-indigo-50 rounded-2xl text-indigo-600 flex items-center justify-center"><Users className="h-5 w-5" /></div><div><p className="text-slate-400 font-extrabold uppercase tracking-wider text-[10px]">Staff Online</p><div className="text-3xl sm:text-4xl font-black">{stats?.totalStaff ?? 0}</div></div></CardContent></Card></motion.div>
      </div>

      <UserOverviewCards />

      <div className="grid gap-6 lg:grid-cols-7">
        <Card className="lg:col-span-5 rounded-2xl sm:rounded-3xl overflow-hidden bg-white">
          <CardHeader className="p-5 sm:p-6 pb-2 flex flex-row items-center justify-between"><div><CardTitle className="text-lg sm:text-xl font-black">System Intake Analytics</CardTitle><CardDescription className="text-xs font-medium">Daily repair registrations for the last 7 days.</CardDescription></div><Button variant="ghost" size="icon"><Filter className="h-4 w-4" /></Button></CardHeader>
          <CardContent className="h-[280px] sm:h-[340px] lg:h-[380px] min-h-[280px] p-4 sm:p-6 pt-4"><div className="h-full min-h-[240px] min-w-0"><ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240}><AreaChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="day" axisLine={false} tickLine={false} /><YAxis axisLine={false} tickLine={false} allowDecimals={false} /><Tooltip /><Area type="monotone" dataKey="count" strokeWidth={3} fillOpacity={0.12} /></AreaChart></ResponsiveContainer></div></CardContent>
        </Card>
        <div className="lg:col-span-2 space-y-6 flex flex-col">
          <Card className="bg-indigo-600 text-white"><CardContent className="p-5 sm:p-6 space-y-4"><h4 className="text-base font-bold flex items-center gap-2"><Zap className="h-4 w-4 fill-white" /> Performance</h4><p className="text-indigo-100 text-xs font-medium leading-relaxed">{targetCompletion === null ? 'Monthly repair target is not configured.' : `Completed ${targetCompletion.toFixed(1)}% of the configured monthly repair target.`}</p><Button onClick={() => navigate('/dashboard/repairs')} className="w-full h-10 bg-white text-indigo-700 font-bold text-xs rounded-xl">View Productivity <ChevronRight className="h-4 w-4" /></Button></CardContent></Card>
          <Card className="flex-1 bg-white"><CardContent className="p-5 sm:p-6"><h5 className="font-black text-slate-900 mb-4">System Logs</h5><div className="flex items-center gap-3 text-xs text-slate-500"><Smartphone className="h-4 w-4" /> Live system activity is available in History Hub.</div></CardContent></Card>
        </div>
      </div>
    </div>
  );
}