import React, { useState, useMemo } from 'react';
import {
  Flame,
  AlertTriangle,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Smartphone,
  Tablet,
  Laptop,
  Tv,
  HelpCircle,
  RefreshCw,
  SlidersHorizontal,
  ChevronRight,
  ShieldAlert,
  Info,
  ArrowUpRight,
  UserCheck
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { RepairItem, TechnicianPerformance, DeviceCategory, PriorityLevel } from './types';
import { STATUS_STYLES, getPriorityMeta } from '@/pages/technician/types';
import { formatTimeAgo } from '@/lib/timeUtils';

interface PriorityManagementTabProps {
  repairs: RepairItem[];
  technicians: TechnicianPerformance[];
  loading: boolean;
  onRefresh: () => void;
  onPrioritySubmit: (data: {
    repairId: string;
    priority: PriorityLevel;
    reason?: string;
  }) => Promise<boolean>;
  initialSelectedRepair?: RepairItem | null;
}

export const PriorityManagementTab: React.FC<PriorityManagementTabProps> = ({
  repairs,
  technicians,
  loading,
  onRefresh,
  onPrioritySubmit,
  initialSelectedRepair = null
}) => {
  // Sub-view: 'urgent_high' (default focus) vs 'all'
  const [activeView, setActiveView] = useState<'urgent_high' | 'all'>('urgent_high');

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<DeviceCategory>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [technicianFilter, setTechnicianFilter] = useState<string>('ALL');

  // Priority Change Modal State
  const [priorityModalOpen, setPriorityModalOpen] = useState(false);
  const [selectedRepair, setSelectedRepair] = useState<RepairItem | null>(initialSelectedRepair);
  const [targetPriority, setTargetPriority] = useState<PriorityLevel>('HIGH');
  const [priorityReason, setPriorityReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync initialSelectedRepair
  React.useEffect(() => {
    if (initialSelectedRepair) {
      handleOpenPriorityModal(initialSelectedRepair);
    }
  }, [initialSelectedRepair]);

  const handleOpenPriorityModal = (repair: RepairItem) => {
    setSelectedRepair(repair);
    setTargetPriority((repair.priority as PriorityLevel) || 'HIGH');
    setPriorityReason('');
    setErrorMessage(null);
    setPriorityModalOpen(true);
  };

  const handleClosePriorityModal = () => {
    setPriorityModalOpen(false);
    setSelectedRepair(null);
    setErrorMessage(null);
  };

  const handleSubmitPriorityChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRepair) return;

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      const success = await onPrioritySubmit({
        repairId: selectedRepair.id,
        priority: targetPriority,
        reason: priorityReason.trim() || undefined
      });

      if (success) {
        handleClosePriorityModal();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update repair priority.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Metric counts
  const urgentCount = useMemo(() => {
    return repairs.filter(r => r.priority === 'URGENT' && r.status !== 'COMPLETED' && r.status !== 'CANCELLED').length;
  }, [repairs]);

  const highCount = useMemo(() => {
    return repairs.filter(r => r.priority === 'HIGH' && r.status !== 'COMPLETED' && r.status !== 'CANCELLED').length;
  }, [repairs]);

  // Filtered repairs
  const filteredRepairs = useMemo(() => {
    return repairs.filter(repair => {
      // Sub-view constraint
      if (activeView === 'urgent_high') {
        const isUrgentOrHigh = repair.priority === 'URGENT' || repair.priority === 'HIGH';
        if (!isUrgentOrHigh) return false;
      }

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesNum = repair.repairNumber?.toLowerCase().includes(q);
        const matchesCust = repair.customerName?.toLowerCase().includes(q) || repair.customerPhone?.includes(q);
        const matchesDevice = (repair.deviceBrand && repair.deviceBrand.toLowerCase().includes(q)) ||
                              (repair.deviceModel && repair.deviceModel.toLowerCase().includes(q));
        const matchesTech = repair.technician?.name.toLowerCase().includes(q);

        if (!matchesNum && !matchesCust && !matchesDevice && !matchesTech) {
          return false;
        }
      }

      // Category
      if (categoryFilter !== 'ALL' && repair.deviceCategory !== categoryFilter) {
        return false;
      }

      // Priority
      if (priorityFilter !== 'ALL' && repair.priority !== priorityFilter) {
        return false;
      }

      // Technician
      if (technicianFilter !== 'ALL') {
        if (technicianFilter === 'UNASSIGNED') {
          if (repair.technicianId) return false;
        } else if (repair.technicianId !== technicianFilter) {
          return false;
        }
      }

      return true;
    });
  }, [repairs, activeView, searchQuery, categoryFilter, priorityFilter, technicianFilter]);

  const getDeviceIcon = (cat: string) => {
    switch (cat) {
      case 'IPHONE':
      case 'SMARTPHONE':
        return <Smartphone className="w-4 h-4 text-sky-500" />;
      case 'IPAD':
      case 'TABLET':
        return <Tablet className="w-4 h-4 text-indigo-500" />;
      case 'LAPTOP':
        return <Laptop className="w-4 h-4 text-emerald-500" />;
      case 'TV':
        return <Tv className="w-4 h-4 text-amber-500" />;
      default:
        return <HelpCircle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const priorityOptions: Array<{ level: PriorityLevel; label: string; desc: string; badge: string; dot: string }> = [
    {
      level: 'URGENT',
      label: 'Urgent',
      desc: 'Immediate emergency escalation. Technician receives urgent alert.',
      badge: 'border-red-500/30 bg-red-500/10 text-red-500 dark:text-red-400',
      dot: 'bg-red-500'
    },
    {
      level: 'HIGH',
      label: 'High',
      desc: 'Expedited turnaround. Prioritized at top of technician queue.',
      badge: 'border-amber-500/30 bg-amber-500/10 text-amber-500 dark:text-amber-400',
      dot: 'bg-amber-500'
    },
    {
      level: 'NORMAL',
      label: 'Normal',
      desc: 'Standard turnaround queue based on arrival order.',
      badge: 'border-blue-500/30 bg-blue-500/10 text-blue-500 dark:text-blue-400',
      dot: 'bg-blue-500'
    },
    {
      level: 'LOW',
      label: 'Low',
      desc: 'Flexible SLA or non-urgent diagnostic/inspection.',
      badge: 'border-slate-500/30 bg-slate-500/10 text-slate-500 dark:text-slate-400',
      dot: 'bg-slate-400'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-card border border-border/80 shadow-sm">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Flame className="w-5 h-5 text-red-500" />
            Priority Management & Expedited Queue
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Monitor expedited workorders and escalate jobs. Technicians receive immediate alerts upon priority escalation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Metric Highlight Banners */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-red-500">Urgent Repairs</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">{urgentCount}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Immediate intervention</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500">
              <Flame className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-500">High Priority</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">{highCount}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Expedited turnaround</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active Workorders</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">
                {repairs.filter(r => r.status !== 'COMPLETED' && r.status !== 'CANCELLED').length}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">In workshop queue</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active Technicians</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">{technicians.length}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Handling active queues</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
              <UserCheck className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sub Tabs: Urgent & High Queue vs All Repairs */}
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <Button
          variant={activeView === 'urgent_high' ? 'default' : 'ghost'}
          onClick={() => setActiveView('urgent_high')}
          className="gap-2 relative"
        >
          <Flame className="w-4 h-4 text-red-400" />
          Urgent & High Priority Queue
          <Badge variant="secondary" className="ml-1 text-xs">
            {urgentCount + highCount}
          </Badge>
        </Button>
        <Button
          variant={activeView === 'all' ? 'default' : 'ghost'}
          onClick={() => setActiveView('all')}
          className="gap-2"
        >
          <SlidersHorizontal className="w-4 h-4" />
          All Priority Levels
          <Badge variant="outline" className="ml-1 text-xs">
            {repairs.length}
          </Badge>
        </Button>
      </div>

      {/* Filter Bar */}
      <Card className="border-border/70">
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search ticket #, customer, device, tech..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>

            {/* Category Filter */}
            <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as DeviceCategory)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Device Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Categories</SelectItem>
                <SelectItem value="IPHONE">iPhones</SelectItem>
                <SelectItem value="SMARTPHONE">Smartphones</SelectItem>
                <SelectItem value="IPAD">iPads</SelectItem>
                <SelectItem value="TABLET">Tablets</SelectItem>
                <SelectItem value="LAPTOP">Laptops</SelectItem>
                <SelectItem value="TV">TVs & Displays</SelectItem>
              </SelectContent>
            </Select>

            {/* Priority Filter (if on all view) */}
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Priority Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Priorities</SelectItem>
                <SelectItem value="URGENT">🔴 Urgent</SelectItem>
                <SelectItem value="HIGH">🟠 High</SelectItem>
                <SelectItem value="NORMAL">🔵 Normal</SelectItem>
                <SelectItem value="LOW">⚪ Low</SelectItem>
              </SelectContent>
            </Select>

            {/* Technician Filter */}
            <Select value={technicianFilter} onValueChange={setTechnicianFilter}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Assigned Technician" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Technicians</SelectItem>
                <SelectItem value="UNASSIGNED">Unassigned Only</SelectItem>
                {technicians.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Repairs Table */}
      {filteredRepairs.length === 0 ? (
        <Card className="border-dashed p-10 text-center">
          <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            </div>
            <h3 className="font-semibold text-lg">No matching repairs</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {activeView === 'urgent_high'
                ? 'No urgent or high priority repairs currently match your filters.'
                : 'Try adjusting your search criteria.'}
            </p>
          </div>
        </Card>
      ) : (
        <div className="border border-border rounded-xl bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-muted/60 text-muted-foreground border-b border-border font-medium">
                <tr>
                  <th className="px-4 py-3">Repair # & Current Priority</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Device & Issue</th>
                  <th className="px-4 py-3">Assigned Technician</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Adjust Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredRepairs.map((repair) => {
                  const pMeta = getPriorityMeta(repair.priority);
                  const sStyle = STATUS_STYLES[repair.status as keyof typeof STATUS_STYLES] || {
                    badge: 'bg-muted text-muted-foreground',
                    label: repair.status
                  };

                  return (
                    <tr key={repair.id} className="hover:bg-muted/30 transition-colors">
                      {/* Ticket # & Current Priority */}
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <span className="font-mono font-semibold text-primary block">
                            {repair.repairNumber}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-xs px-2 py-0.5 font-semibold ${pMeta.badgeClass} flex items-center gap-1 w-fit`}
                          >
                            {pMeta.indicatorText}
                          </Badge>
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{repair.customerName}</div>
                        <div className="text-xs text-muted-foreground">{repair.customerPhone}</div>
                      </td>

                      {/* Device */}
                      <td className="px-4 py-3 max-w-xs">
                        <div className="flex items-center gap-1.5 font-medium text-foreground truncate">
                          {getDeviceIcon(repair.deviceCategory)}
                          <span>
                            {repair.deviceBrand || ''} {repair.deviceModel || 'Unknown Device'}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {repair.problemDescription || 'No description provided'}
                        </p>
                      </td>

                      {/* Assigned Tech */}
                      <td className="px-4 py-3">
                        {repair.technician ? (
                          <div className="flex items-center gap-1.5 font-medium text-foreground">
                            <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                            <span>{repair.technician.name}</span>
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-amber-500 border-amber-500/30 bg-amber-500/10">
                            Unassigned
                          </Badge>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge className={`${sStyle.badge} text-xs font-medium px-3 py-1 rounded-full border-0 whitespace-nowrap inline-flex items-center shrink-0`}>
                          {sStyle.label}
                        </Badge>
                      </td>

                      {/* Adjust Priority Action */}
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenPriorityModal(repair)}
                          className="gap-1.5 h-8 text-xs font-medium"
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
                          Change Priority
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Priority Change Dialog */}
      <Dialog open={priorityModalOpen} onOpenChange={setPriorityModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-primary" />
              Adjust Repair Priority
            </DialogTitle>
            <DialogDescription>
              Escalate or adjust the turnaround urgency. Changes are recorded in audit logs and notify the assigned technician.
            </DialogDescription>
          </DialogHeader>

          {selectedRepair && (
            <form onSubmit={handleSubmitPriorityChange} className="space-y-4 pt-2">
              {/* Repair Reference Card */}
              <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-1.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-primary">{selectedRepair.repairNumber}</span>
                  <Badge variant="outline" className="text-xs">
                    Current: {selectedRepair.priority}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  Customer: <span className="text-foreground font-medium">{selectedRepair.customerName}</span> | Device: <span className="text-foreground font-medium">{selectedRepair.deviceBrand} {selectedRepair.deviceModel}</span>
                </div>
                {selectedRepair.technician && (
                  <div className="text-xs text-muted-foreground">
                    Assigned Tech: <span className="text-foreground font-medium">{selectedRepair.technician.name}</span>
                  </div>
                )}
              </div>

              {/* Priority Option Selector Cards */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Select New Priority Level</Label>
                <div className="grid grid-cols-1 gap-2">
                  {priorityOptions.map((opt) => {
                    const isSelected = targetPriority === opt.level;
                    return (
                      <button
                        key={opt.level}
                        type="button"
                        onClick={() => setTargetPriority(opt.level)}
                        className={`p-3 rounded-lg border text-left transition-all flex items-start gap-3 ${
                          isSelected
                            ? 'border-primary bg-primary/5 ring-1 ring-primary'
                            : 'border-border hover:bg-muted/40'
                        }`}
                      >
                        <span className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${opt.dot}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-sm text-foreground">{opt.label}</span>
                            {isSelected && (
                              <CheckCircle2 className="w-4 h-4 text-primary" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Reason for Priority Change */}
              <div className="space-y-2">
                <Label htmlFor="priority-reason" className="text-sm font-semibold">
                  Reason for Adjustment (Optional)
                </Label>
                <Textarea
                  id="priority-reason"
                  placeholder="e.g., Customer requested urgent turnaround for flight tomorrow, parts ready..."
                  value={priorityReason}
                  onChange={(e) => setPriorityReason(e.target.value)}
                  rows={2}
                  className="text-sm"
                />
              </div>

              {errorMessage && (
                <div className="p-3 text-xs bg-destructive/10 text-destructive border border-destructive/20 rounded-lg flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <DialogFooter className="gap-2 sm:gap-0 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClosePriorityModal}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Update Priority
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
