import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { formatNPR } from '@/lib/format';
import { TrendingUp, Award, Smartphone, Wrench, BarChart3, Layers } from 'lucide-react';

interface RevenueChartsProps {
  trend: Array<{
    date: string;
    label: string;
    revenue: number;
    partsCost: number;
    damageCost: number;
    profit: number;
    count: number;
  }>;
  categoryBreakdown: Array<{
    category: string;
    revenue: number;
    cost: number;
    profit: number;
    count: number;
    percentage: number;
    margin: number;
  }>;
  brandBreakdown: Array<{
    brand: string;
    revenue: number;
    cost: number;
    profit: number;
    count: number;
    percentage: number;
  }>;
  technicianPerformance: Array<{
    id: string;
    name: string;
    role: string;
    revenue: number;
    cost: number;
    profit: number;
    completedCount: number;
    activeCount: number;
  }>;
  grossRevenue: number;
}

const BRAND_COLORS = ['#0f172a', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#64748b'];

export const RevenueCharts: React.FC<RevenueChartsProps> = ({
  trend,
  categoryBreakdown,
  brandBreakdown,
  technicianPerformance,
  grossRevenue,
}) => {
  const [activeChartTab, setActiveChartTab] = useState<'area' | 'bar'>('area');

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-950 text-white p-3.5 rounded-xl shadow-2xl border border-slate-800 text-xs space-y-1.5 min-w-[170px]">
          <p className="font-extrabold text-slate-400 border-b border-slate-800 pb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={`item-${index}`} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                {entry.name}:
              </span>
              <span className="font-mono font-black text-white">
                {formatNPR(entry.value)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* 1. Main Financial Performance Chart & Category Mix */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Interactive Trend Graph */}
        <Card className="lg:col-span-8 rounded-2xl border-slate-200/80 shadow-xs bg-white flex flex-col justify-between overflow-hidden">
          <CardHeader className="p-5 pb-3 border-b border-slate-100 bg-slate-50/40">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-slate-900" />
                  Financial Inflow & Profitability Trend
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 font-medium">
                  Authoritative daily/monthly timeline of collections, parts costs, and net workshop profit.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                  <button
                    onClick={() => setActiveChartTab('area')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      activeChartTab === 'area' ? 'bg-white text-slate-950 shadow-xs font-black' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Smooth Flow
                  </button>
                  <button
                    onClick={() => setActiveChartTab('bar')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      activeChartTab === 'bar' ? 'bg-white text-slate-950 shadow-xs font-black' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Bar Comparison
                  </button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 flex-1 min-h-[340px]">
            {trend && trend.length > 0 ? (
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {activeChartTab === 'area' ? (
                    <AreaChart data={trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0f172a" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#0f172a" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="gradProf" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="gradCost" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(val) => `Rs.${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                      <Area type="monotone" dataKey="revenue" name="Gross Revenue" stroke="#0f172a" strokeWidth={2.5} fill="url(#gradRev)" />
                      <Area type="monotone" dataKey="profit" name="Net Profit" stroke="#10b981" strokeWidth={2.5} fill="url(#gradProf)" />
                      <Area type="monotone" dataKey="partsCost" name="Parts Cost" stroke="#f59e0b" strokeWidth={2} fill="url(#gradCost)" strokeDasharray="4 4" />
                    </AreaChart>
                  ) : (
                    <BarChart data={trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(val) => `Rs.${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                      <Bar dataKey="revenue" name="Gross Revenue" fill="#0f172a" radius={[6, 6, 0, 0]} maxBarSize={30} />
                      <Bar dataKey="profit" name="Net Profit" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={30} />
                      <Bar dataKey="partsCost" name="Parts Cost" fill="#f59e0b" radius={[6, 6, 0, 0]} maxBarSize={30} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[320px] flex items-center justify-center text-slate-400 text-sm font-medium">
                No financial transactions recorded for this timeframe.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column: Service & Repair Categories */}
        <Card className="lg:col-span-4 rounded-2xl border-slate-200/80 shadow-xs bg-white flex flex-col justify-between overflow-hidden">
          <CardHeader className="p-5 pb-3 border-b border-slate-100 bg-slate-50/40">
            <CardTitle className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              Service Category Breakdown
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 font-medium">
              Revenue distribution and profit margins by problem domain.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 flex-1 overflow-y-auto max-h-[380px] space-y-4">
            {categoryBreakdown && categoryBreakdown.length > 0 ? (
              categoryBreakdown.map((item, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-extrabold text-slate-800 truncate max-w-[180px]">
                      {item.category}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-slate-900">
                        {formatNPR(item.revenue)}
                      </span>
                      <Badge variant="outline" className="bg-slate-50 text-[10px] font-bold text-slate-600 border-slate-200 px-1.5 py-0">
                        {item.percentage}%
                      </Badge>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-slate-900 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(5, item.percentage))}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>{item.count} tickets</span>
                    <span className="font-bold text-emerald-600">Margin: {item.margin}% (Profit: {formatNPR(item.profit)})</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-slate-400 text-xs font-medium">
                No categorized repairs in this timeframe.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 2. Device Brand Mix & Technician Performance Leaderboard */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Brand Distribution */}
        <Card className="lg:col-span-5 rounded-2xl border-slate-200/80 shadow-xs bg-white overflow-hidden flex flex-col justify-between">
          <CardHeader className="p-5 pb-3 border-b border-slate-100 bg-slate-50/40">
            <CardTitle className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-emerald-600" />
              Device Brand Share
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 font-medium">
              Market revenue distribution across smartphone manufacturers.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 flex-1">
            {brandBreakdown && brandBreakdown.length > 0 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {brandBreakdown.slice(0, 6).map((b, i) => (
                    <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-xs text-slate-900">{b.brand}</span>
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-white text-slate-700 shadow-xs">
                          {b.percentage}%
                        </span>
                      </div>
                      <div className="mt-2 flex items-baseline justify-between">
                        <span className="text-sm font-black font-mono text-slate-900">{formatNPR(b.revenue)}</span>
                        <span className="text-[10px] text-slate-400 font-medium">{b.count} jobs</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 text-xs font-medium">
                No brand data available.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Technician Financial Performance */}
        <Card className="lg:col-span-7 rounded-2xl border-slate-200/80 shadow-xs bg-white overflow-hidden flex flex-col justify-between">
          <CardHeader className="p-5 pb-3 border-b border-slate-100 bg-slate-50/40">
            <CardTitle className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              Technician Financial Contribution
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 font-medium">
              Direct revenue, parts cost management, and profit generated per staff technician.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <th className="px-5 py-3">Technician</th>
                  <th className="px-4 py-3 text-center">Jobs Done</th>
                  <th className="px-4 py-3 text-right">Revenue</th>
                  <th className="px-4 py-3 text-right">Parts Cost</th>
                  <th className="px-5 py-3 text-right">Net Contribution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {technicianPerformance && technicianPerformance.length > 0 ? (
                  technicianPerformance.map((tech, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-slate-950 text-white font-black text-[10px] flex items-center justify-center shrink-0">
                            {tech.name ? tech.name.charAt(0).toUpperCase() : 'T'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-extrabold text-slate-900 truncate">{tech.name}</p>
                            <p className="text-[10px] text-slate-400 uppercase font-semibold">{tech.role?.replace(/_/g, ' ')}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <Badge variant="outline" className="bg-slate-50 text-slate-700 font-black border-slate-200 text-[10px]">
                          {tech.completedCount} finished
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-900">
                        {formatNPR(tech.revenue)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-slate-500">
                        {formatNPR(tech.cost)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-black text-emerald-700">
                        {formatNPR(tech.profit)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 text-xs">
                      No technician contributions in this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RevenueCharts;
