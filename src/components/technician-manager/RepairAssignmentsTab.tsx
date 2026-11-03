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
  Sparkles,
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
}

export const RepairAssignmentsTab: React.FC<RepairAssignmentsTabProps> = ({
  repairs,
  technicians,
  loading,
  onRefresh,
  onAssignSubmit,
  initialSelectedRepair = null
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

  return (
    <div className="space-y-6">
      {/* Top Banner / Guidance */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-card border border-border/80 shadow-sm">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-primary" />
            Repair Assignments & Workload Balancing
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Assign incoming workorders to qualified technicians or reassign jobs to balance workshop capacity.
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

      {/* Sub Tabs: Unassigned Queue vs All Repairs */}
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <Button
          variant={activeSubTab === 'unassigned' ? 'default' : 'ghost'}
          onClick={() => setActiveSubTab('unassigned')}
          className="gap-2 relative"
        >
          <AlertTriangle className="w-4 h-4" />
          Unassigned Queue
          {unassignedCount > 0 && (
            <Badge variant="destructive" className="ml-1 text-xs px-2 py-0.5 animate-pulse">
              {unassignedCount} Urgent
            </Badge>
          )}
        </Button>
        <Button
          variant={activeSubTab === 'all' ? 'default' : 'ghost'}
          onClick={() => setActiveSubTab('all')}
          className="gap-2"
        >
          <Wrench className="w-4 h-4" />
          All Workshop Repairs
          <Badge variant="secondary" className="ml-1 text-xs">
            {repairs.length}
          </Badge>
        </Button>
      </div>

      {/* Filter Bar */}
      <Card className="border-border/70">
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Search */}
            <div className="relative lg:col-span-2">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search ticket #, customer, model, IMEI, tech..."
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

            {/* Priority Filter */}
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Priority" />
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
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Technician" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Technicians</SelectItem>
                  <SelectItem value="UNASSIGNED">Unassigned Only</SelectItem>
                  {technicians.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({t.activeRepairsCount} active)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Status" />
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
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/50">
              <span className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-primary" />
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

      {/* Repairs List / Table */}
      {filteredRepairs.length === 0 ? (
        <Card className="border-dashed p-10 text-center">
          <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              {activeSubTab === 'unassigned' ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              ) : (
                <Wrench className="w-6 h-6 text-muted-foreground" />
              )}
            </div>
            <h3 className="font-semibold text-lg">
              {activeSubTab === 'unassigned' ? 'Unassigned Queue is Clear' : 'No repairs found'}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {activeSubTab === 'unassigned'
                ? 'All current repair tickets are actively assigned to workshop technicians.'
                : 'Try adjusting your search criteria or filter selections.'}
            </p>
          </div>
        </Card>
      ) : (
        <div className="border border-border rounded-xl bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-muted/60 text-muted-foreground border-b border-border font-medium">
                <tr>
                  <th className="px-4 py-3">Repair # & Priority</th>
                  <th className="px-4 py-3">Customer & Contact</th>
                  <th className="px-4 py-3">Device & Issue</th>
                  <th className="px-4 py-3">Current Assignment</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
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

                      {/* Device & Issue */}
                      <td className="px-4 py-3 max-w-xs">
                        <div className="flex items-center gap-1.5 font-medium text-foreground truncate">
                          {getDeviceIcon(repair.deviceCategory)}
                          <span>
                            {repair.deviceBrand || ''} {repair.deviceModel || 'Unknown Device'}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5" title={repair.problemDescription || ''}>
                          {repair.problemDescription || 'No description provided'}
                        </p>
                      </td>

                      {/* Assigned Tech */}
                      <td className="px-4 py-3">
                        {repair.technician ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 font-medium text-foreground">
                              <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                              <span>{repair.technician.name}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {repair.assignedAt ? `Assigned ${formatTimeAgo(repair.assignedAt)}` : 'Assigned'}
                            </div>
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-amber-500 border-amber-500/30 bg-amber-500/10 gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Unassigned
                          </Badge>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <Badge className={`${sStyle.badge} text-xs font-normal border-0`}>
                          {sStyle.label}
                        </Badge>
                        <div className="text-xs text-muted-foreground mt-1">
                          Created {formatTimeAgo(repair.createdAt)}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant={repair.technicianId ? 'outline' : 'default'}
                          onClick={() => handleOpenAssign(repair)}
                          className="gap-1.5 h-8 text-xs font-medium"
                        >
                          {repair.technicianId ? (
                            <>
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                              Reassign
                            </>
                          ) : (
                            <>
                              <UserPlus className="w-3.5 h-3.5" />
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
      )}

      {/* Assignment / Reassignment Dialog */}
      <Dialog open={assignModalOpen} onOpenChange={setAssignModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-primary" />
              {selectedRepair?.technicianId ? 'Reassign Repair Workorder' : 'Assign Repair Workorder'}
            </DialogTitle>
            <DialogDescription>
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
