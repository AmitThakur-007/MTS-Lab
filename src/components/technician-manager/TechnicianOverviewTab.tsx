import React, { useState, useMemo } from 'react';
import {
  Users,
  UserCheck,
  Wrench,
  Clock,
  Flame,
  CheckCircle2,
  Package,
  ArrowRightLeft,
  AlertCircle,
  Search,
  ExternalLink,
  ChevronRight,
  Eye,
  SlidersHorizontal,
  Smartphone,
  Tablet,
  Laptop,
  Tv,
  HelpCircle,
  Activity
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { TechnicianSummary, TechnicianPerformance } from './types';
import { STATUS_STYLES, getPriorityMeta } from '@/pages/technician/types';
import { formatTimeAgo } from '@/lib/timeUtils';

interface TechnicianOverviewTabProps {
  summary: TechnicianSummary | null;
  technicians: TechnicianPerformance[];
  loading: boolean;
  onSelectTechnicianQueue?: (technicianId: string) => void;
  onOpenAssignModal?: (repair: any) => void;
  onOpenPriorityModal?: (repair: any) => void;
  onNavigateToTransfers?: () => void;
  onRefresh?: () => void;
  containerWidth?: number;
}

export const TechnicianOverviewTab: React.FC<TechnicianOverviewTabProps> = ({
  summary,
  technicians,
  loading,
  onSelectTechnicianQueue,
  onOpenAssignModal,
  onOpenPriorityModal,
  onNavigateToTransfers,
  onRefresh,
  containerWidth = 1200,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'AVAILABLE' | 'NORMAL' | 'HEAVY' | 'OVERLOADED'>('ALL');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [selectedTechForModal, setSelectedTechForModal] = useState<TechnicianPerformance | null>(null);

  // Filtered Technicians
  const filteredTechnicians = useMemo(() => {
    return technicians.filter(tech => {
      // 1. Search filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesName = tech.name.toLowerCase().includes(q);
        const matchesEmail = tech.email.toLowerCase().includes(q);
        const matchesPhone = tech.phoneNumber?.toLowerCase().includes(q) || false;
        if (!matchesName && !matchesEmail && !matchesPhone) return false;
      }

      // 2. Workload status filter
      if (statusFilter !== 'ALL' && tech.workloadStatus !== statusFilter) {
        return false;
      }

      // 3. Role filter
      if (roleFilter !== 'ALL' && tech.role !== roleFilter) {
        return false;
      }

      return true;
    });
  }, [technicians, searchTerm, statusFilter, roleFilter]);

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'HEAD_TECHNICIAN':
        return { label: 'Head Technician', class: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800' };
      case 'LEAD_TECHNICIAN':
        return { label: 'Lead Technician', class: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800' };
      case 'TECHNICAL_ASSISTANT':
        return { label: 'Technical Assistant', class: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800' };
      default:
        return { label: 'Technician', class: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800' };
    }
  };

  return (
    <div className="space-y-6">
      {/* ====================================================================
          1. TEN SUMMARY METRIC CARDS
         ==================================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Total Technicians */}
        <Card className="rounded-2xl border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 shadow-xs">
          <CardContent className="p-4 sm:p-4.5">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Total Technicians
              </span>
              <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {loading ? '...' : (summary?.totalTechnicians || 0)}
              </span>
              <span className="text-xs text-slate-400 font-medium">staff</span>
            </div>
          </CardContent>
        </Card>

        {/* Available Technicians */}
        <Card className="rounded-2xl border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 shadow-xs">
          <CardContent className="p-4 sm:p-4.5">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                Available Now
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <UserCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-emerald-700 dark:text-emerald-400 tracking-tight">
                {loading ? '...' : (summary?.availableTechnicians || 0)}
              </span>
              <span className="text-xs text-slate-400 font-medium">ready</span>
            </div>
          </CardContent>
        </Card>

        {/* Technicians Currently Working */}
        <Card className="rounded-2xl border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 shadow-xs">
          <CardContent className="p-4 sm:p-4.5">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                Currently Working
              </span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Activity className="w-4 h-4 animate-pulse" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-blue-700 dark:text-blue-400 tracking-tight">
                {loading ? '...' : (summary?.workingTechnicians || 0)}
              </span>
              <span className="text-xs text-slate-400 font-medium">active</span>
            </div>
          </CardContent>
        </Card>

        {/* Total Assigned Repairs */}
        <Card className="rounded-2xl border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 shadow-xs">
          <CardContent className="p-4 sm:p-4.5">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Assigned Repairs
              </span>
              <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                <Wrench className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-purple-700 dark:text-purple-400 tracking-tight">
                {loading ? '...' : (summary?.totalAssignedRepairs || 0)}
              </span>
              <span className="text-xs text-slate-400 font-medium">devices</span>
            </div>
          </CardContent>
        </Card>

        {/* Pending Repairs */}
        <Card className="rounded-2xl border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 shadow-xs">
          <CardContent className="p-4 sm:p-4.5">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Pending Intake
              </span>
              <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-slate-200 tracking-tight">
                {loading ? '...' : (summary?.pendingRepairsCount || 0)}
              </span>
              <span className="text-xs text-slate-400 font-medium">waiting</span>
            </div>
          </CardContent>
        </Card>

        {/* In Progress Repairs */}
        <Card className="rounded-2xl border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 shadow-xs">
          <CardContent className="p-4 sm:p-4.5">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
                In Progress
              </span>
              <div className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                <Wrench className="w-4 h-4 text-sky-600" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-sky-700 dark:text-sky-300 tracking-tight">
                {loading ? '...' : (summary?.inProgressRepairsCount || 0)}
              </span>
              <span className="text-xs text-slate-400 font-medium">on bench</span>
            </div>
          </CardContent>
        </Card>

        {/* Waiting for Parts */}
        <Card className="rounded-2xl border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 shadow-xs">
          <CardContent className="p-4 sm:p-4.5">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                Waiting for Parts
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Package className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-amber-700 dark:text-amber-400 tracking-tight">
                {loading ? '...' : (summary?.waitingForPartsCount || 0)}
              </span>
              <span className="text-xs text-slate-400 font-medium">on hold</span>
            </div>
          </CardContent>
        </Card>

        {/* Completed Repairs */}
        <Card className="rounded-2xl border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 shadow-xs">
          <CardContent className="p-4 sm:p-4.5">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider">
                Completed
              </span>
              <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-teal-700 dark:text-teal-400 tracking-tight">
                {loading ? '...' : (summary?.completedRepairsCount || 0)}
              </span>
              <span className="text-xs text-slate-400 font-medium">fixed</span>
            </div>
          </CardContent>
        </Card>

        {/* Pending Transfer Requests */}
        <Card 
          onClick={onNavigateToTransfers}
          className="rounded-2xl border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 shadow-xs hover:border-amber-400 dark:hover:border-amber-600 transition-all cursor-pointer group"
        >
          <CardContent className="p-4 sm:p-4.5">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
                <span>Transfer Requests</span>
                <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <ArrowRightLeft className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-amber-700 dark:text-amber-400 tracking-tight">
                {loading ? '...' : (summary?.pendingTransferRequestsCount || 0)}
              </span>
              <span className="text-xs text-slate-400 font-medium">pending</span>
            </div>
          </CardContent>
        </Card>

        {/* High-Priority & Urgent Repairs */}
        <Card className="rounded-2xl border-rose-200/80 dark:border-rose-900/50 bg-rose-50/20 dark:bg-rose-950/20 shadow-xs">
          <CardContent className="p-4 sm:p-4.5">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                High / Urgent
              </span>
              <div className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Flame className="w-4 h-4 animate-bounce" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-rose-700 dark:text-rose-300 tracking-tight">
                {loading ? '...' : (summary?.highPriorityRepairsCount || 0)}
              </span>
              <span className="text-xs text-rose-600/80 font-bold">
                ({summary?.urgentRepairsCount || 0} urgent)
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ====================================================================
          2. FILTERS & SEARCH TOOLBAR
         ==================================================================== */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search technician by name, email, or phone..."
              className="pl-9 h-10 rounded-xl bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-xs sm:text-sm"
            />
          </div>

          {/* Quick Workload Status Filter Chips */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {[
              { key: 'ALL', label: 'All Workloads' },
              { key: 'AVAILABLE', label: '🟢 Available' },
              { key: 'NORMAL', label: '🔵 Normal' },
              { key: 'HEAVY', label: '🟠 Heavy' },
              { key: 'OVERLOADED', label: '🔴 Overloaded' },
            ].map(chip => (
              <button
                key={chip.key}
                type="button"
                onClick={() => setStatusFilter(chip.key as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === chip.key
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ====================================================================
          3. TECHNICIAN PERFORMANCE AND WORKLOAD TABLE & CARDS
         ==================================================================== */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Technician Staff Workload Directory</span>
              <span className="text-xs font-semibold text-slate-400 ml-1">
                ({filteredTechnicians.length} active technician{filteredTechnicians.length !== 1 ? 's' : ''})
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Live capacity calculation based on active repair queues. 0-2 (Available), 3-6 (Normal), 7-9 (Heavy), 10+ (Overloaded).
            </p>
          </div>

          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              className="rounded-xl text-xs font-bold border-slate-200 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Refresh
            </Button>
          )}
        </div>

        {/* Mobile & Tablet Card Layout */}
        <div className="block lg:hidden p-4 space-y-3">
          {filteredTechnicians.length === 0 ? (
            <div className="py-10 text-center text-slate-400">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-semibold">No technicians found matching filter criteria.</p>
            </div>
          ) : (
            filteredTechnicians.map((tech) => {
              const roleBadge = getRoleBadge(tech.role);
              return (
                <Card key={tech.id} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-4 space-y-3">
                  {/* Header: Avatar, Name, Role, Workload Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0">
                        {tech.profileImage ? (
                          <AvatarImage src={tech.profileImage} alt={tech.name} className="object-cover" />
                        ) : null}
                        <AvatarFallback className="bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-black text-xs">
                          {tech.name ? tech.name.substring(0, 2).toUpperCase() : 'TC'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <span className="font-extrabold text-sm text-slate-900 dark:text-white truncate block">
                          {tech.name}
                        </span>
                        <Badge variant="outline" className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md border mt-0.5 ${roleBadge.class}`}>
                          {roleBadge.label}
                        </Badge>
                      </div>
                    </div>

                    <Badge variant="outline" className={`text-[10px] font-black px-2 py-0.5 rounded-lg border shrink-0 inline-flex items-center gap-1 ${tech.workloadBadgeClass}`}>
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${tech.workloadDotColor}`} />
                      <span>{tech.workloadLabel}</span>
                    </Badge>
                  </div>

                  {/* Contact */}
                  <div className="text-xs text-slate-400 truncate">
                    {tech.email} {tech.phoneNumber ? `• ${tech.phoneNumber}` : ''}
                  </div>

                  {/* Workload Metric Chips */}
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-xs pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                    <div className="p-1.5 rounded-lg bg-card">
                      <span className="text-[10px] text-slate-400 block font-medium">Active</span>
                      <span className="font-extrabold text-slate-900 dark:text-white">{tech.activeRepairsCount}</span>
                    </div>
                    <div className="p-1.5 rounded-lg bg-card">
                      <span className="text-[10px] text-slate-400 block font-medium">Pending</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">{tech.pendingCount}</span>
                    </div>
                    <div className="p-1.5 rounded-lg bg-card">
                      <span className="text-[10px] text-slate-400 block font-medium">In Progress</span>
                      <span className="font-bold text-sky-600 dark:text-sky-400">{tech.inProgressCount}</span>
                    </div>
                    <div className="p-1.5 rounded-lg bg-card">
                      <span className="text-[10px] text-slate-400 block font-medium">Waiting Parts</span>
                      <span className="font-bold text-amber-600 dark:text-amber-400">{tech.waitingForPartsCount}</span>
                    </div>
                    <div className="p-1.5 rounded-lg bg-card">
                      <span className="text-[10px] text-slate-400 block font-medium">Done</span>
                      <span className="font-bold text-teal-600 dark:text-teal-400">{tech.completedCount}</span>
                    </div>
                    <div className="p-1.5 rounded-lg bg-card">
                      <span className="text-[10px] text-slate-400 block font-medium">Urgent</span>
                      <span className="font-bold text-rose-600 dark:text-rose-400">{tech.highPriorityCount}</span>
                    </div>
                  </div>

                  {/* Action CTA */}
                  <div className="pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedTechForModal(tech)}
                      className="w-full h-8.5 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 border-slate-200 dark:border-slate-700 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" />
                      <span>View Workload Queue ({tech.activeRepairsCount})</span>
                    </Button>
                  </div>
                </Card>
              );
            })
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden lg:block overflow-x-auto w-full">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4 whitespace-nowrap">Technician</th>
                <th className="py-3 px-3 whitespace-nowrap">Role</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">Workload Status</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">Active Jobs</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">Pending / Diag</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">In Progress</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">Waiting Parts</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">Completed</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">Urgent / High</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredTechnicians.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm font-semibold">No technicians found matching filter criteria.</p>
                  </td>
                </tr>
              ) : (
                filteredTechnicians.map((tech) => {
                  const roleBadge = getRoleBadge(tech.role);
                  return (
                    <tr
                      key={tech.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Name & Avatar */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0 shadow-2xs">
                            {tech.profileImage ? (
                              <AvatarImage src={tech.profileImage} alt={tech.name} className="object-cover" />
                            ) : null}
                            <AvatarFallback className="bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-black text-xs">
                              {tech.name ? tech.name.substring(0, 2).toUpperCase() : 'TC'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <span className="font-extrabold text-slate-900 dark:text-white truncate block max-w-[160px]">
                              {tech.name}
                            </span>
                            <span className="text-[11px] text-slate-400 truncate block max-w-[160px]">
                              {tech.email} {tech.phoneNumber ? `• ${tech.phoneNumber}` : ''}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <Badge variant="outline" className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border shrink-0 ${roleBadge.class}`}>
                          {roleBadge.label}
                        </Badge>
                      </td>

                      {/* Workload Status */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <Badge variant="outline" className={`text-[10px] font-black px-2.5 py-0.5 rounded-lg border inline-flex items-center gap-1.5 shrink-0 ${tech.workloadBadgeClass}`}>
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${tech.workloadDotColor}`} />
                          <span>{tech.workloadLabel}</span>
                        </Badge>
                      </td>

                      {/* Active Jobs & Capacity bar */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <div className="inline-flex flex-col items-center">
                          <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                            {tech.activeRepairsCount}
                          </span>
                          <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-1">
                            <div
                              className={`h-full rounded-full ${
                                tech.activeRepairsCount >= 10
                                  ? 'bg-rose-500'
                                  : tech.activeRepairsCount >= 7
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(100, (tech.activeRepairsCount / 10) * 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Pending / Diagnosing */}
                      <td className="py-3.5 px-3 text-center font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {tech.pendingCount}
                      </td>

                      {/* In Progress */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md font-bold bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/80">
                          {tech.inProgressCount}
                        </span>
                      </td>

                      {/* Waiting for Parts */}
                      <td className="py-3.5 px-3 text-center font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {tech.waitingForPartsCount}
                      </td>

                      {/* Completed */}
                      <td className="py-3.5 px-3 text-center font-semibold text-teal-600 dark:text-teal-400 whitespace-nowrap">
                        {tech.completedCount}
                      </td>

                      {/* Urgent / High */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        {tech.highPriorityCount > 0 ? (
                          <span className="px-2 py-0.5 rounded-md font-extrabold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-center justify-center gap-1 mx-auto max-w-[50px]">
                            <Flame className="w-3 h-3" />
                            {tech.highPriorityCount}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-700">-</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedTechForModal(tech)}
                          className="h-8 rounded-xl px-2.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          <span>View Queue</span>
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ====================================================================
          4. TECHNICIAN ACTIVE QUEUE MODAL
         ==================================================================== */}
      <Dialog open={!!selectedTechForModal} onOpenChange={(open) => !open && setSelectedTechForModal(null)}>
        <DialogContent className="max-w-3xl rounded-3xl p-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 max-h-[85vh] flex flex-col">
          <DialogHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="w-11 h-11 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  {selectedTechForModal?.profileImage ? (
                    <AvatarImage src={selectedTechForModal.profileImage} alt={selectedTechForModal.name} />
                  ) : null}
                  <AvatarFallback className="bg-indigo-600 text-white font-black">
                    {selectedTechForModal?.name ? selectedTechForModal.name.substring(0, 2).toUpperCase() : 'TC'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <DialogTitle className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <span>{selectedTechForModal?.name}</span>
                    <Badge variant="outline" className={`text-[10px] font-bold ${selectedTechForModal?.workloadBadgeClass}`}>
                      {selectedTechForModal?.workloadLabel}
                    </Badge>
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-400">
                    Active Repair Workorders Queue ({selectedTechForModal?.activeRepairs.length || 0} jobs)
                  </DialogDescription>
                </div>
              </div>

              {/* Device category distribution pills */}
              <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-bold">
                {selectedTechForModal && Object.entries(selectedTechForModal.deviceCategories)
                  .filter(([_, count]) => count > 0)
                  .map(([cat, count]) => (
                    <span key={cat} className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {cat}: {count}
                    </span>
                  ))}
              </div>
            </div>
          </DialogHeader>

          {/* Repairs List */}
          <div className="flex-1 overflow-y-auto space-y-2.5 py-4 pr-1 min-h-[250px]">
            {selectedTechForModal?.activeRepairs.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500 opacity-60" />
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Bench Queue is Empty</p>
                <p className="text-xs text-slate-400 mt-1">This technician currently has no active repair tickets assigned.</p>
              </div>
            ) : (
              selectedTechForModal?.activeRepairs.map((repair) => {
                const priorityMeta = getPriorityMeta(repair);
                const statusMeta = STATUS_STYLES[repair.status] || { label: repair.status, badge: 'bg-slate-100 text-slate-700' };

                return (
                  <div
                    key={repair.id}
                    className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 hover:bg-white dark:hover:bg-slate-800 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-black text-xs text-indigo-600 dark:text-indigo-400">
                          #{repair.repairNumber}
                        </span>
                        <Badge variant="outline" className={`text-[9.5px] font-extrabold px-1.5 py-0.2 rounded-md ${priorityMeta.badgeClass}`}>
                          {priorityMeta.indicatorText}
                        </Badge>
                        <Badge variant="outline" className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded-md ${statusMeta.badge}`}>
                          {statusMeta.label}
                        </Badge>
                        <span className="text-[10px] text-slate-400 font-semibold">
                          Category: {repair.category}
                        </span>
                      </div>
                      <p className="font-extrabold text-xs text-slate-900 dark:text-white truncate">
                        {repair.deviceBrand} {repair.deviceModel}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        Customer: <span className="font-semibold text-slate-700 dark:text-slate-300">{repair.customerName}</span> ({repair.customerPhone})
                      </p>
                      {repair.problemDescription && (
                        <p className="text-[11px] text-slate-400 line-clamp-1 italic">
                          "{repair.problemDescription}"
                        </p>
                      )}
                    </div>

                    {/* Management Action Buttons */}
                    <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200 dark:border-slate-700">
                      {onOpenPriorityModal && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedTechForModal(null);
                            onOpenPriorityModal(repair);
                          }}
                          className="h-8 rounded-xl px-2.5 text-xs font-bold border-slate-200 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                        >
                          <Flame className="w-3 h-3 mr-1 text-amber-500" />
                          <span>Priority</span>
                        </Button>
                      )}

                      {onOpenAssignModal && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => {
                            setSelectedTechForModal(null);
                            onOpenAssignModal(repair);
                          }}
                          className="h-8 rounded-xl px-3 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
                        >
                          <ArrowRightLeft className="w-3 h-3 mr-1" />
                          <span>Reassign</span>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
