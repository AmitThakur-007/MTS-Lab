import React, { useState, useMemo } from 'react';
import {
  Wrench,
  Search,
  Filter,
  UserCheck,
  UserPlus,
  AlertTriangle,
  Flame,
  CheckCircle2,
  Clock,
  Smartphone,
  Tablet,
  Laptop,
  Tv,
  ArrowRightLeft,
  ChevronRight,
  ShieldAlert,
  HelpCircle,
  RefreshCw,
  ExternalLink,
  MessageSquare,
  Info
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

interface RepairAssignmentsTabProps {
  repairs: RepairItem[];
  technicians: TechnicianPerformance[];
  loading: boolean;
  onRefresh: () => void;
  onAssignSubmit: (data: {
    repairId: string;
    technicianId: string;
    priority?: string;
    assignmentNotes?: string;
  }) => Promise<boolean>;
  initialSelectedRepair?: RepairItem | null;
  containerWidth?: number;
}

export const RepairAssignmentsTab: React.FC<RepairAssignmentsTabProps> = ({
  repairs,
  technicians,
  loading,
  onRefresh,
  onAssignSubmit,
  initialSelectedRepair = null,
  containerWidth = 1200
}) => {
  // Tabs: 'unassigned' | 'all'
  const [activeSubTab, setActiveSubTab] = useState<'unassigned' | 'all'>('unassigned');
  
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<DeviceCategory>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [technicianFilter, setTechnicianFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Assignment Modal State
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedRepair, setSelectedRepair] = useState<RepairItem | null>(initialSelectedRepair);
  const [targetTechId, setTargetTechId] = useState<string>('');
  const [selectedPriority, setSelectedPriority] = useState<PriorityLevel>('NORMAL');
  const [assignmentNotes, setAssignmentNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync initialSelectedRepair if provided
  React.useEffect(() => {
    if (initialSelectedRepair) {
      handleOpenAssign(initialSelectedRepair);
    }
  }, [initialSelectedRepair]);

  const handleOpenAssign = (repair: RepairItem) => {
    setSelectedRepair(repair);
    setTargetTechId(repair.technicianId || '');
    setSelectedPriority((repair.priority as PriorityLevel) || 'NORMAL');
    setAssignmentNotes('');
    setErrorMessage(null);
    setAssignModalOpen(true);
  };

  const handleCloseAssign = () => {
    setAssignModalOpen(false);
    setSelectedRepair(null);
    setErrorMessage(null);
  };

  const handleSubmitAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRepair || !targetTechId) {
      setErrorMessage('Please select a technician for this repair assignment.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      const success = await onAssignSubmit({
        repairId: selectedRepair.id,
        technicianId: targetTechId,
        priority: selectedPriority,
        assignmentNotes: assignmentNotes.trim() || undefined
      });

      if (success) {
        handleCloseAssign();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to complete assignment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Unassigned Count
  const unassignedCount = useMemo(() => {
    return repairs.filter(r => !r.technicianId).length;
  }, [repairs]);

  // Filtered Repairs
  const filteredRepairs = useMemo(() => {
    return repairs.filter(repair => {
      // Sub-tab: unassigned vs all
      if (activeSubTab === 'unassigned' && repair.technicianId) {
        return false;
      }

      // Search query (repairNumber, customer, device, imei)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesNum = repair.repairNumber?.toLowerCase().includes(q);
        const matchesCust = repair.customerName?.toLowerCase().includes(q) || repair.customerPhone?.includes(q);
        const matchesDevice = (repair.deviceBrand && repair.deviceBrand.toLowerCase().includes(q)) ||
                              (repair.deviceModel && repair.deviceModel.toLowerCase().includes(q));
        const matchesTech = repair.technician?.name.toLowerCase().includes(q);
        const matchesImei = repair.imeiNumber?.toLowerCase().includes(q);

        if (!matchesNum && !matchesCust && !matchesDevice && !matchesTech && !matchesImei) {
          return false;
        }
      }

      // Device Category
      if (categoryFilter !== 'ALL' && repair.deviceCategory !== categoryFilter) {
        return false;
      }

      // Priority
      if (priorityFilter !== 'ALL' && repair.priority !== priorityFilter) {
        return false;
      }

      // Status
      if (statusFilter !== 'ALL' && repair.status !== statusFilter) {
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
  }, [repairs, activeSubTab, searchQuery, categoryFilter, priorityFilter, statusFilter, technicianFilter]);

  // Selected Target Technician Details
  const selectedTargetTech = useMemo(() => {
    return technicians.find(t => t.id === targetTechId);
  }, [technicians, targetTechId]);

  const getDeviceIcon = (cat: string) => {
    switch (cat) {
      case 'IPHONE':
      case 'SMARTPHONE':
        return <Smartphone className="w-4 h-4 text-sky-500 shrink-0" />;
      case 'IPAD':
      case 'TABLET':
        return <Tablet className="w-4 h-4 text-indigo-500 shrink-0" />;
      case 'LAPTOP':
        return <Laptop className="w-4 h-4 text-emerald-500 shrink-0" />;
      case 'TV':
        return <Tv className="w-4 h-4 text-amber-500 shrink-0" />;
      default:
        return <HelpCircle className="w-4 h-4 text-muted-foreground shrink-0" />;
    }
  };

  return (
    <div className="space-y-6 w-full min-w-0">
      {/* Top Banner / Guidance */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-card border border-border/80 shadow-sm min-w-0">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg sm:text-xl font-bold tracking-tight flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-primary shrink-0" />
            <span className="truncate">Repair Assignments & Workload Balancing</span>
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Assign incoming workorders to qualified technicians or reassign jobs to balance workshop capacity.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 self-stretch sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            className="gap-2 shrink-0 w-full sm:w-auto h-9"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Sub Tabs: Unassigned Queue vs All Workshop Repairs - Guaranteed zero clipping */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-2.5 min-w-0">
        <Button
          variant={activeSubTab === 'unassigned' ? 'default' : 'ghost'}
          onClick={() => setActiveSubTab('unassigned')}
          className="gap-2 shrink-0 cursor-pointer min-h-[38px] text-xs sm:text-sm font-semibold"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
          <span>Unassigned Queue</span>
          {unassignedCount > 0 && (
            <Badge variant="destructive" className="ml-1 text-[11px] px-1.5 py-0.2 shrink-0 animate-pulse">
              {unassignedCount} Urgent
            </Badge>
          )}
        </Button>
        <Button
          variant={activeSubTab === 'all' ? 'default' : 'ghost'}
          onClick={() => setActiveSubTab('all')}
          className="gap-2 shrink-0 cursor-pointer min-h-[38px] text-xs sm:text-sm font-semibold"
        >
          <Wrench className="w-4 h-4 shrink-0 text-primary" />
          <span>All Workshop Repairs</span>
          <Badge variant="secondary" className="ml-1 text-[11px] px-1.5 py-0.2 shrink-0 font-bold">
            {repairs.length}
          </Badge>
        </Button>
      </div>

      {/* Filter Bar with adaptive multi-row wrapping */}
      <Card className="border-border/70 min-w-0">
        <CardContent className="p-3.5 sm:p-4 space-y-3 min-w-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2.5 sm:gap-3">
            {/* Search */}
            <div className="relative sm:col-span-2 lg:col-span-3 xl:col-span-2 min-w-0">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground shrink-0" />
              <Input
                placeholder="Search ticket #, customer, model, IMEI, tech..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs sm:text-sm w-full"
              />
            </div>

            {/* Category Filter */}
            <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as DeviceCategory)}>
              <SelectTrigger className="h-9 text-xs sm:text-sm w-full min-w-0">
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

            {/* Priority Filter */}
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="h-9 text-xs sm:text-sm w-full min-w-0">
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

            {/* Technician Filter (only shown in 'all' subtab) */}
            {activeSubTab === 'all' ? (
              <Select value={technicianFilter} onValueChange={setTechnicianFilter}>
                <SelectTrigger className="h-9 text-xs sm:text-sm w-full min-w-0">
                  <SelectValue placeholder="All Technicians" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Technicians</SelectItem>
                  <SelectItem value="UNASSIGNED">Unassigned Only</SelectItem>
                  {technicians.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="truncate">{t.name}</span>
                        <span className="text-muted-foreground text-xs shrink-0">({t.activeRepairsCount} active)</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 text-xs sm:text-sm w-full min-w-0">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="WAITING_FOR_PARTS">Waiting for Parts</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Quick Active Filter Indicators */}
          {(searchQuery || categoryFilter !== 'ALL' || priorityFilter !== 'ALL' || technicianFilter !== 'ALL' || statusFilter !== 'ALL') && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground pt-1.5 border-t border-border/50">
              <span className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-primary shrink-0" />
                Showing {filteredRepairs.length} of {repairs.length} repairs
              </span>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs text-primary"
                onClick={() => {
                  setSearchQuery('');
                  setCategoryFilter('ALL');
                  setPriorityFilter('ALL');
                  setTechnicianFilter('ALL');
                  setStatusFilter('ALL');
                }}
              >
                Reset Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Repairs List: Card View for Mobile/Tablet + Structured Table for Desktop */}
      {filteredRepairs.length === 0 ? (
        <Card className="border-dashed p-8 sm:p-10 text-center">
          <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3 shrink-0">
              {activeSubTab === 'unassigned' ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              ) : (
                <Wrench className="w-6 h-6 text-muted-foreground" />
              )}
            </div>
            <h3 className="font-semibold text-base sm:text-lg">
              {activeSubTab === 'unassigned' ? 'Unassigned Queue is Clear' : 'No repairs found'}
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              {activeSubTab === 'unassigned'
                ? 'All current repair tickets are actively assigned to workshop technicians.'
                : 'Try adjusting your search criteria or filter selections.'}
            </p>
          </div>
        </Card>
      ) : (
        <div className="w-full min-w-0 space-y-3">
          {/* 1. Mobile & Small Tablet Card Layout (Guarantees zero horizontal cutoff on narrow screens) */}
          <div className="block lg:hidden space-y-3">
            {filteredRepairs.map((repair) => {
              const pMeta = getPriorityMeta(repair.priority);
              const sStyle = STATUS_STYLES[repair.status as keyof typeof STATUS_STYLES] || {
                badge: 'bg-muted text-muted-foreground',
                label: repair.status
              };

              return (
                <Card key={repair.id} className="border-border/80 shadow-xs hover:border-primary/40 transition-colors overflow-hidden">
                  <CardContent className="p-4 space-y-3">
                    {/* Top Row: Ticket Number, Priority Badge, Status */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-primary">
                          {repair.repairNumber}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[11px] px-2 py-0.5 font-semibold ${pMeta.badgeClass} flex items-center gap-1 shrink-0`}
                        >
                          {pMeta.indicatorText}
                        </Badge>
                      </div>
                      <Badge className={`${sStyle.badge} text-[11px] font-medium px-2.5 py-0.5 rounded-full border-0 shrink-0`}>
                        {sStyle.label}
                      </Badge>
                    </div>

                    {/* Middle Section: Device & Customer */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1 border-t border-border/50">
                      <div>
                        <span className="text-muted-foreground">Device: </span>
                        <span className="font-semibold text-foreground inline-flex items-center gap-1">
                          {getDeviceIcon(repair.deviceCategory)}
                          {repair.deviceBrand || ''} {repair.deviceModel || 'Unknown Device'}
                        </span>
                        {repair.problemDescription && (
                          <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5" title={repair.problemDescription}>
                            {repair.problemDescription}
                          </p>
                        )}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Customer: </span>
                        <span className="font-medium text-foreground">{repair.customerName}</span>
                        {repair.customerPhone && (
                          <span className="text-muted-foreground block text-[11px]">{repair.customerPhone}</span>
                        )}
                      </div>
                    </div>

                    {/* Bottom Row: Technician Assignment & Action Button */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-border/50">
                      <div className="text-xs">
                        <span className="text-muted-foreground block sm:inline">Technician: </span>
                        {repair.technician ? (
                          <span className="font-semibold text-foreground inline-flex items-center gap-1.5 mt-0.5 sm:mt-0">
                            <UserCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            {repair.technician.name}
                          </span>
                        ) : (
                          <Badge variant="outline" className="text-amber-500 border-amber-500/30 bg-amber-500/10 text-[11px] px-1.5 py-0.2 shrink-0">
                            Unassigned
                          </Badge>
                        )}
                      </div>

                      <Button
                        size="sm"
                        variant={repair.technicianId ? 'outline' : 'default'}
                        onClick={() => handleOpenAssign(repair)}
                        className="gap-1.5 h-9 text-xs font-semibold w-full sm:w-auto shrink-0 cursor-pointer"
                      >
                        {repair.technicianId ? (
                          <>
                            <ArrowRightLeft className="w-3.5 h-3.5 shrink-0" />
                            Reassign Tech
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-3.5 h-3.5 shrink-0" />
                            Assign Tech
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* 2. Desktop Table Layout (for screens lg and above or spacious containers) */}
          <div className="hidden lg:block border border-border rounded-xl bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-muted/60 text-muted-foreground border-b border-border font-medium">
                  <tr>
                    <th className="px-4 py-3 whitespace-nowrap">Repair # & Priority</th>
                    <th className="px-4 py-3 whitespace-nowrap">Customer & Contact</th>
                    <th className="px-4 py-3 whitespace-nowrap">Device & Issue</th>
                    <th className="px-4 py-3 whitespace-nowrap">Current Assignment</th>
                    <th className="px-4 py-3 whitespace-nowrap">Status</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">Actions</th>
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
                        {/* Repair Ticket & Priority */}
                        <td className="px-4 py-3 align-middle">
                          <div className="space-y-1">
                            <span className="font-mono font-semibold text-primary block text-xs sm:text-sm">
                              {repair.repairNumber}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-[11px] px-2 py-0.5 font-semibold ${pMeta.badgeClass} flex items-center gap-1 w-fit shrink-0`}
                            >
                              {pMeta.indicatorText}
                            </Badge>
                          </div>
                        </td>

                        {/* Customer */}
                        <td className="px-4 py-3 align-middle">
                          <div className="font-medium text-foreground text-xs sm:text-sm truncate max-w-[160px]">{repair.customerName}</div>
                          <div className="text-xs text-muted-foreground">{repair.customerPhone}</div>
                        </td>

                        {/* Device & Issue */}
                        <td className="px-4 py-3 align-middle max-w-xs">
                          <div className="flex items-center gap-1.5 font-medium text-foreground truncate text-xs sm:text-sm">
                            {getDeviceIcon(repair.deviceCategory)}
                            <span className="truncate">
                              {repair.deviceBrand || ''} {repair.deviceModel || 'Unknown Device'}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5" title={repair.problemDescription || ''}>
                            {repair.problemDescription || 'No description provided'}
                          </p>
                        </td>

                        {/* Assigned Tech */}
                        <td className="px-4 py-3 align-middle">
                          {repair.technician ? (
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5 font-medium text-foreground text-xs sm:text-sm truncate max-w-[150px]">
                                <UserCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                <span className="truncate">{repair.technician.name}</span>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {repair.assignedAt ? `Assigned ${formatTimeAgo(repair.assignedAt)}` : 'Assigned'}
                              </div>
                            </div>
                          ) : (
                            <Badge variant="outline" className="text-amber-500 border-amber-500/30 bg-amber-500/10 gap-1 text-[11px] px-2 py-0.5 shrink-0">
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              Unassigned
                            </Badge>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3 whitespace-nowrap align-middle">
                          <Badge className={`${sStyle.badge} text-xs font-medium px-2.5 py-0.5 rounded-full border-0 whitespace-nowrap inline-flex items-center shrink-0`}>
                            {sStyle.label}
                          </Badge>
                          <div className="text-xs text-muted-foreground mt-1">
                            {formatTimeAgo(repair.createdAt)}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-right whitespace-nowrap align-middle">
                          <Button
                            size="sm"
                            variant={repair.technicianId ? 'outline' : 'default'}
                            onClick={() => handleOpenAssign(repair)}
                            className="gap-1.5 h-8 text-xs font-medium shrink-0 cursor-pointer"
                          >
                            {repair.technicianId ? (
                              <>
                                <ArrowRightLeft className="w-3.5 h-3.5 shrink-0" />
                                Reassign
                              </>
                            ) : (
                              <>
                                <UserPlus className="w-3.5 h-3.5 shrink-0" />
                                Assign Tech
                              </>
                            )}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Assignment / Reassignment Dialog */}
      <Dialog open={assignModalOpen} onOpenChange={setAssignModalOpen}>
        <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <UserCheck className="w-5 h-5 text-primary shrink-0" />
              <span>{selectedRepair?.technicianId ? 'Reassign Repair Workorder' : 'Assign Repair Workorder'}</span>
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Select a technician and assign the repair. The technician will receive an instant notification.
            </DialogDescription>
          </DialogHeader>

          {selectedRepair && (
            <form onSubmit={handleSubmitAssignment} className="space-y-4 pt-2">
              {/* Repair Summary Box */}
              <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-primary">{selectedRepair.repairNumber}</span>
                  <Badge variant="outline" className="text-xs">
                    {selectedRepair.deviceCategory}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Customer: </span>
                    <span className="font-medium text-foreground">{selectedRepair.customerName}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Device: </span>
                    <span className="font-medium text-foreground">
                      {selectedRepair.deviceBrand} {selectedRepair.deviceModel}
                    </span>
                  </div>
                </div>
                {selectedRepair.technician && (
                  <div className="text-xs pt-1 border-t border-border/50 text-muted-foreground">
                    Currently assigned to:{' '}
                    <span className="font-medium text-foreground">{selectedRepair.technician.name}</span>
                  </div>
                )}
              </div>

              {/* Technician Selector with Live Capacity Status */}
              <div className="space-y-2">
                <Label htmlFor="technician-select" className="text-sm font-semibold flex items-center justify-between">
                  <span>Assign To Technician <span className="text-destructive">*</span></span>
                  {selectedTargetTech && (
                    <span className="text-xs font-normal text-muted-foreground">
                      Current: {selectedTargetTech.activeRepairsCount} active jobs
                    </span>
                  )}
                </Label>
                <Select value={targetTechId} onValueChange={setTargetTechId}>
                  <SelectTrigger id="technician-select" className="w-full">
                    <SelectValue placeholder="Select technician..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {technicians.map((tech) => (
                      <SelectItem key={tech.id} value={tech.id}>
                        <div className="flex items-center gap-2 py-0.5">
                          <span className={`w-2 h-2 rounded-full ${tech.workloadDotColor}`} />
                          <span className="font-medium">{tech.name}</span>
                          <span className="text-xs text-muted-foreground">
                            ({tech.workloadLabel} - {tech.activeRepairsCount} active)
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedTargetTech && selectedTargetTech.workloadStatus === 'OVERLOADED' && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-500 bg-amber-500/10 p-2 rounded border border-amber-500/20">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Warning: This technician currently has a heavy workload ({selectedTargetTech.activeRepairsCount} active jobs).</span>
                  </div>
                )}
              </div>

              {/* Priority Selector */}
              <div className="space-y-2">
                <Label htmlFor="priority-select" className="text-sm font-semibold">
                  Job Priority
                </Label>
                <Select value={selectedPriority} onValueChange={(v) => setSelectedPriority(v as PriorityLevel)}>
                  <SelectTrigger id="priority-select" className="w-full">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">⚪ Low - Standard queue</SelectItem>
                    <SelectItem value="NORMAL">🔵 Normal - Standard turnaround</SelectItem>
                    <SelectItem value="HIGH">🟠 High - Expedited turnaround</SelectItem>
                    <SelectItem value="URGENT">🔴 Urgent - Immediate attention required</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Assignment Notes */}
              <div className="space-y-2">
                <Label htmlFor="assignment-notes" className="text-sm font-semibold">
                  Manager Instructions / Notes (Optional)
                </Label>
                <Textarea
                  id="assignment-notes"
                  placeholder="e.g., Customer requested urgent screen testing before noon, inspect motherboard closely..."
                  value={assignmentNotes}
                  onChange={(e) => setAssignmentNotes(e.target.value)}
                  rows={3}
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
                  onClick={handleCloseAssign}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || !targetTechId}
                  className="gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-4 h-4" />
                      Confirm Assignment
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
