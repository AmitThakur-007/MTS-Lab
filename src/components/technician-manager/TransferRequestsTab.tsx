import React, { useState, useMemo } from 'react';
import {
  ArrowRightLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  Calendar,
  User,
  Smartphone,
  Tablet,
  Laptop,
  Tv,
  HelpCircle,
  Send,
  AlertTriangle,
  RotateCcw,
  ChevronRight,
  ShieldCheck,
  Check,
  X
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EnrichedTransferRequest, TechnicianPerformance, TransferStatus } from './types';
import { formatTimeAgo } from '@/lib/timeUtils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { api } from '@/services/api';

interface TransferRequestsTabProps {
  transfers: EnrichedTransferRequest[];
  technicians: TechnicianPerformance[];
  loading: boolean;
  onRefresh: () => void;
  onSelectRepair?: (repairId: string) => void;
  containerWidth?: number;
}

export const TransferRequestsTab: React.FC<TransferRequestsTabProps> = ({
  transfers,
  technicians,
  loading,
  onRefresh,
  onSelectRepair,
  containerWidth = 1200,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<TransferStatus>('ALL');
  const [datePreset, setDatePreset] = useState<'ALL' | 'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'THIS_MONTH'>('ALL');

  // Approval modal state
  const [approvingTransfer, setApprovingTransfer] = useState<EnrichedTransferRequest | null>(null);
  const [approvalNote, setApprovalNote] = useState('');
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);

  // Rejection modal state
  const [rejectingTransfer, setRejectingTransfer] = useState<EnrichedTransferRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmittingRejection, setIsSubmittingRejection] = useState(false);

  // Direct Management Transfer modal state
  const [isDirectTransferOpen, setIsDirectTransferOpen] = useState(false);
  const [directRepairSearch, setDirectRepairSearch] = useState('');
  const [directRepairSearchResults, setDirectRepairSearchResults] = useState<any[]>([]);
  const [selectedDirectRepair, setSelectedDirectRepair] = useState<any | null>(null);
  const [selectedTargetTechId, setSelectedTargetTechId] = useState('');
  const [directTransferReason, setDirectTransferReason] = useState('');
  const [directPriority, setDirectPriority] = useState('');
  const [isSearchingRepairs, setIsSearchingRepairs] = useState(false);
  const [isSubmittingDirect, setIsSubmittingDirect] = useState(false);

  // Filter transfers
  const filteredTransfers = useMemo(() => {
    return transfers.filter((t) => {
      // 1. Status Filter
      if (statusFilter !== 'ALL' && t.status !== statusFilter) {
        return false;
      }

      // 2. Search Query
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesRepairNumber = t.repairNumber?.toLowerCase().includes(q) || false;
        const matchesCustomer = t.customerName?.toLowerCase().includes(q) || false;
        const matchesSender = t.senderTechnicianName?.toLowerCase().includes(q) || false;
        const matchesTarget = t.targetTechnicianName?.toLowerCase().includes(q) || false;
        const matchesModel = t.deviceModel?.toLowerCase().includes(q) || false;
        const matchesReason = t.reason?.toLowerCase().includes(q) || false;

        if (!matchesRepairNumber && !matchesCustomer && !matchesSender && !matchesTarget && !matchesModel && !matchesReason) {
          return false;
        }
      }

      return true;
    });
  }, [transfers, statusFilter, searchTerm]);

  // Statistics
  const pendingCount = useMemo(() => transfers.filter(t => t.status === 'PENDING').length, [transfers]);
  const acceptedCount = useMemo(() => transfers.filter(t => t.status === 'ACCEPTED').length, [transfers]);
  const rejectedCount = useMemo(() => transfers.filter(t => t.status === 'REJECTED').length, [transfers]);

  // Approve Transfer Handler
  const handleApprove = async () => {
    if (!approvingTransfer) return;
    setIsSubmittingApproval(true);
    try {
      const res: any = await api.post(`/technician-manager/transfers/${approvingTransfer.id}/respond`, {
        action: 'ACCEPT',
        responseNote: approvalNote.trim() || 'Approved by Manager',
      });

      toast.success(res?.message || `Transfer for repair #${approvingTransfer.repairNumber} approved.`);
      setApprovingTransfer(null);
      setApprovalNote('');
      onRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to approve transfer request.');
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  // Reject Transfer Handler
  const handleReject = async () => {
    if (!rejectingTransfer) return;
    if (!rejectionReason.trim() || rejectionReason.trim().length < 2) {
      toast.error('Please provide a reason for rejecting the transfer request.');
      return;
    }

    setIsSubmittingRejection(true);
    try {
      const res: any = await api.post(`/technician-manager/transfers/${rejectingTransfer.id}/respond`, {
        action: 'REJECT',
        responseNote: rejectionReason.trim(),
      });

      toast.success(res?.message || `Transfer for repair #${rejectingTransfer.repairNumber} rejected.`);
      setRejectingTransfer(null);
      setRejectionReason('');
      onRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to reject transfer request.');
    } finally {
      setIsSubmittingRejection(false);
    }
  };

  // Search repairs for direct management transfer
  const searchRepairsForDirect = async (query: string) => {
    setDirectRepairSearch(query);
    if (!query || query.trim().length < 2) {
      setDirectRepairSearchResults([]);
      return;
    }

    setIsSearchingRepairs(true);
    try {
      const res: any = await api.get(`/technician-manager/repairs?search=${encodeURIComponent(query.trim())}&limit=8`);
      setDirectRepairSearchResults(res?.repairs || []);
    } catch {
      setDirectRepairSearchResults([]);
    } finally {
      setIsSearchingRepairs(false);
    }
  };

  // Execute Direct Management Transfer
  const handleDirectTransfer = async () => {
    if (!selectedDirectRepair) {
      toast.error('Please select a repair workorder to transfer.');
      return;
    }
    if (!selectedTargetTechId) {
      toast.error('Please choose a destination technician.');
      return;
    }
    if (!directTransferReason.trim() || directTransferReason.trim().length < 2) {
      toast.error('Please provide a transfer reason or managerial instruction.');
      return;
    }

    setIsSubmittingDirect(true);
    try {
      const res: any = await api.post('/technician-manager/direct-transfer', {
        repairId: selectedDirectRepair.id,
        targetTechnicianId: selectedTargetTechId,
        reason: directTransferReason.trim(),
        priority: directPriority || undefined,
      });

      toast.success(res?.message || `Repair #${selectedDirectRepair.repairNumber} successfully reassigned.`);
      setIsDirectTransferOpen(false);
      setSelectedDirectRepair(null);
      setDirectRepairSearch('');
      setSelectedTargetTechId('');
      setDirectTransferReason('');
      setDirectPriority('');
      onRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to execute direct transfer.');
    } finally {
      setIsSubmittingDirect(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return {
          label: 'Pending Approval',
          class: 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 animate-pulse font-extrabold',
          icon: Clock
        };
      case 'ACCEPTED':
        return {
          label: 'Transfer Approved',
          class: 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 font-bold',
          icon: CheckCircle2
        };
      case 'REJECTED':
        return {
          label: 'Declined / Rejected',
          class: 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800 font-semibold',
          icon: XCircle
        };
      case 'CANCELLED':
        return {
          label: 'Cancelled',
          class: 'bg-slate-100 text-slate-500 border-slate-300 dark:bg-slate-800 dark:text-slate-400 font-medium',
          icon: RotateCcw
        };
      default:
        return {
          label: status,
          class: 'bg-slate-100 text-slate-700 border-slate-200',
          icon: HelpCircle
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* ====================================================================
          1. HEADER WITH ACTIONS & STATUS PILLS
         ==================================================================== */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white flex items-center gap-2.5">
            <ArrowRightLeft className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span>Repair Job Transfer Requests</span>
            {pendingCount > 0 && (
              <Badge className="bg-amber-500 text-white font-extrabold px-2 py-0.5 rounded-full text-xs">
                {pendingCount} Pending Approval
              </Badge>
            )}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Review, approve, or reject technician repair transfers, or execute immediate management reassignments across technician benches.
          </p>
        </div>

        {/* Direct Transfer CTA */}
        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
          <Button
            onClick={() => setIsDirectTransferOpen(true)}
            className="rounded-xl h-10 px-4 font-extrabold text-xs bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 cursor-pointer w-full sm:w-auto"
          >
            <span>Direct Management Transfer</span>
          </Button>
        </div>
      </div>

      {/* ====================================================================
          2. SEARCH & FILTER CONTROLS
         ==================================================================== */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by repair #, customer, model, technician, reason..."
              className="pl-9 h-10 rounded-xl bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-xs sm:text-sm"
            />
          </div>

          {/* Status Filter Chips */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {[
              { key: 'ALL', label: `All (${transfers.length})` },
              { key: 'PENDING', label: `Pending (${pendingCount})` },
              { key: 'ACCEPTED', label: `Approved (${acceptedCount})` },
              { key: 'REJECTED', label: `Rejected (${rejectedCount})` },
            ].map((chip) => (
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
          3. TRANSFER REQUESTS TABLE & MOBILE CARDS
         ==================================================================== */}
      {filteredTransfers.length === 0 ? (
        <Card className="rounded-2xl border border-slate-200/80 dark:border-slate-800 p-8 sm:p-12 text-center bg-white dark:bg-slate-900 shadow-xs">
          <ArrowRightLeft className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">No transfer requests found matching filter criteria.</p>
        </Card>
      ) : (
        <div className="w-full min-w-0 space-y-3">
          {/* Mobile & Tablet Card Layout */}
          <div className="block lg:hidden space-y-3">
            {filteredTransfers.map((t) => {
              const statusMeta = getStatusBadge(t.status);
              const StatusIcon = statusMeta.icon;

              return (
                <Card key={t.id} className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
                  <CardContent className="p-4 space-y-3">
                    {/* Header: Ticket & Status */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-mono font-black text-xs text-indigo-600 dark:text-indigo-400">
                        #{t.repairNumber}
                      </span>
                      <Badge variant="outline" className={`text-[10px] px-2.5 py-0.5 rounded-lg border inline-flex items-center gap-1.5 ${statusMeta.class}`}>
                        <StatusIcon className="w-3 h-3 shrink-0" />
                        <span>{statusMeta.label}</span>
                      </Badge>
                    </div>

                    {/* Device & Customer */}
                    <div className="space-y-0.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                      <span className="font-extrabold text-xs text-slate-900 dark:text-white block">
                        {t.deviceBrand} {t.deviceModel}
                      </span>
                      <span className="text-[11px] text-slate-400 block">
                        {t.customerName} {t.customerPhone ? `(${t.customerPhone})` : ''}
                      </span>
                    </div>

                    {/* Sender -> Target Technicians */}
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs gap-2">
                      <div className="min-w-0">
                        <span className="text-[10px] text-slate-400 block uppercase font-bold">From</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">{t.senderTechnicianName}</span>
                      </div>
                      <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-500 shrink-0 mx-1" />
                      <div className="min-w-0 text-right">
                        <span className="text-[10px] text-slate-400 block uppercase font-bold">To</span>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400 truncate block">{t.targetTechnicianName}</span>
                      </div>
                    </div>

                    {/* Reason */}
                    {t.reason && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 italic bg-muted/40 p-2 rounded-lg">
                        "{t.reason}"
                      </p>
                    )}

                    {/* Timestamp & Actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                      <span className="text-slate-400">
                        {formatTimeAgo(t.createdAt)}
                      </span>

                      {t.status === 'PENDING' ? (
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <Button
                            size="sm"
                            onClick={() => {
                              setApprovingTransfer(t);
                              setApprovalNote('');
                            }}
                            className="flex-1 sm:flex-none h-8.5 rounded-xl px-3 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5 mr-1" />
                            <span>Approve</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setRejectingTransfer(t);
                              setRejectionReason('');
                            }}
                            className="flex-1 sm:flex-none h-8.5 rounded-xl px-3 text-xs font-bold text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-900/50 dark:hover:bg-rose-950/40 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5 mr-1" />
                            <span>Reject</span>
                          </Button>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Completed</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4 whitespace-nowrap">Repair Workorder</th>
                    <th className="py-3 px-3 whitespace-nowrap">Current Technician</th>
                    <th className="py-3 px-3 whitespace-nowrap">Target Technician</th>
                    <th className="py-3 px-3 whitespace-nowrap">Reason / Details</th>
                    <th className="py-3 px-3 text-center whitespace-nowrap">Status</th>
                    <th className="py-3 px-3 whitespace-nowrap">Requested At</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Manager Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredTransfers.map((t) => {
                    const statusMeta = getStatusBadge(t.status);
                    const StatusIcon = statusMeta.icon;

                    return (
                      <tr
                        key={t.id}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        {/* Repair Workorder info */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-0.5">
                            <span className="font-mono font-black text-xs text-indigo-600 dark:text-indigo-400 block">
                              #{t.repairNumber}
                            </span>
                            <span className="font-extrabold text-slate-900 dark:text-white truncate block max-w-[180px]">
                              {t.deviceBrand} {t.deviceModel}
                            </span>
                            <span className="text-[11px] text-slate-400 truncate block max-w-[180px]">
                              {t.customerName} {t.customerPhone ? `(${t.customerPhone})` : ''}
                            </span>
                          </div>
                        </td>

                        {/* Current Technician */}
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[130px]">{t.senderTechnicianName}</span>
                          </div>
                        </td>

                        {/* Target Technician */}
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-1.5 font-bold text-indigo-600 dark:text-indigo-400">
                            <ArrowRightLeft className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate max-w-[130px]">{t.targetTechnicianName}</span>
                          </div>
                        </td>

                        {/* Reason */}
                        <td className="py-3.5 px-3 max-w-[220px]">
                          <p className="text-slate-700 dark:text-slate-300 font-medium line-clamp-2">
                            "{t.reason}"
                          </p>
                          {t.responseNote && (
                            <p className="text-[10px] text-slate-400 italic mt-0.5 line-clamp-1">
                              Response: {t.responseNote}
                            </p>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          <Badge variant="outline" className={`text-[10px] px-2.5 py-0.5 rounded-lg border inline-flex items-center gap-1.5 shrink-0 ${statusMeta.class}`}>
                            <StatusIcon className="w-3 h-3 shrink-0" />
                            <span>{statusMeta.label}</span>
                          </Badge>
                        </td>

                        {/* Timestamp */}
                        <td className="py-3.5 px-3 text-slate-500 dark:text-slate-400 text-[11px] whitespace-nowrap">
                          <span>{formatTimeAgo(t.createdAt)}</span>
                          <span className="block text-[10px] text-slate-400 font-mono">
                            {format(new Date(t.createdAt), 'yyyy-MM-dd HH:mm')}
                          </span>
                        </td>

                        {/* Manager Actions */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          {t.status === 'PENDING' ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                onClick={() => {
                                  setApprovingTransfer(t);
                                  setApprovalNote('');
                                }}
                                className="h-8 rounded-xl px-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5 mr-1" />
                                <span>Approve</span>
                              </Button>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setRejectingTransfer(t);
                                  setRejectionReason('');
                                }}
                                className="h-8 rounded-xl px-2.5 text-xs font-bold text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-900/50 dark:hover:bg-rose-950/40 cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5 mr-1" />
                                <span>Reject</span>
                              </Button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">
                              Completed
                            </span>
                          )}
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

      {/* ====================================================================
          4. APPROVE CONFIRMATION MODAL
         ==================================================================== */}
      <Dialog open={!!approvingTransfer} onOpenChange={(open) => !open && setApprovingTransfer(null)}>
        <DialogContent className="max-w-md rounded-3xl p-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
              <span>Approve Repair Transfer</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Reassign repair workorder to destination technician and notify both parties.
            </DialogDescription>
          </DialogHeader>

          {approvingTransfer && (
            <div className="space-y-4 py-2 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    #{approvingTransfer.repairNumber}
                  </span>
                  <span className="text-slate-500 font-semibold">
                    {approvingTransfer.deviceBrand} {approvingTransfer.deviceModel}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 font-bold pt-1 border-t border-slate-200/80 dark:border-slate-700/80">
                  <span>From: {approvingTransfer.senderTechnicianName}</span>
                  <span className="text-emerald-600 dark:text-emerald-400">To: {approvingTransfer.targetTechnicianName}</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 italic pt-1">
                  Reason: "{approvingTransfer.reason}"
                </p>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Manager Approval Note (Optional):
                </label>
                <Input
                  value={approvalNote}
                  onChange={(e) => setApprovalNote(e.target.value)}
                  placeholder="e.g. Approved. Priority parts already sourced."
                  className="rounded-xl h-10 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-xs"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="outline"
              onClick={() => setApprovingTransfer(null)}
              className="rounded-xl text-xs font-bold border-slate-200"
            >
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={isSubmittingApproval}
              className="rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            >
              {isSubmittingApproval ? 'Approving...' : 'Confirm Approval & Reassign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====================================================================
          5. REJECT MODAL (MANDATORY REASON)
         ==================================================================== */}
      <Dialog open={!!rejectingTransfer} onOpenChange={(open) => !open && setRejectingTransfer(null)}>
        <DialogContent className="max-w-md rounded-3xl p-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-rose-600 dark:text-rose-400 flex items-center gap-2">
              <XCircle className="w-5 h-5" />
              <span>Reject Transfer Request</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              The repair will remain in the current technician's active queue. A reason is required.
            </DialogDescription>
          </DialogHeader>

          {rejectingTransfer && (
            <div className="space-y-4 py-2 text-xs">
              <div className="p-3.5 rounded-2xl bg-rose-50/50 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/60 space-y-1">
                <span className="font-mono font-bold text-rose-700 dark:text-rose-300">
                  #{rejectingTransfer.repairNumber} • {rejectingTransfer.deviceBrand} {rejectingTransfer.deviceModel}
                </span>
                <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                  Requested from: <strong>{rejectingTransfer.senderTechnicianName}</strong> to <strong>{rejectingTransfer.targetTechnicianName}</strong>
                </p>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Reason for Rejection (Mandatory):
                </label>
                <Textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="State why this transfer is not approved (e.g. Target technician is currently overloaded)..."
                  className="rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-xs"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="outline"
              onClick={() => setRejectingTransfer(null)}
              className="rounded-xl text-xs font-bold border-slate-200"
            >
              Cancel
            </Button>
            <Button
              onClick={handleReject}
              disabled={isSubmittingRejection || !rejectionReason.trim()}
              className="rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white"
            >
              {isSubmittingRejection ? 'Rejecting...' : 'Confirm Rejection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====================================================================
          6. DIRECT MANAGEMENT TRANSFER MODAL
         ==================================================================== */}
      <Dialog open={isDirectTransferOpen} onOpenChange={setIsDirectTransferOpen}>
        <DialogContent className="max-w-lg rounded-3xl p-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span>Direct Management Transfer</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Immediately reassign any device workorder to another technician bench with instructions.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Step 1: Select Repair */}
            <div>
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                1. Select Repair Workorder:
              </label>

              {selectedDirectRepair ? (
                <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 flex items-center justify-between">
                  <div>
                    <span className="font-mono font-black text-indigo-700 dark:text-indigo-300">
                      #{selectedDirectRepair.repairNumber}
                    </span>
                    <p className="font-bold text-slate-900 dark:text-white text-xs">
                      {selectedDirectRepair.deviceBrand} {selectedDirectRepair.deviceModel}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Current Tech: {selectedDirectRepair.assignedByName || 'Unassigned'} • Customer: {selectedDirectRepair.customerName}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedDirectRepair(null)}
                    className="h-7 text-xs text-slate-500 hover:text-rose-600 cursor-pointer"
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={directRepairSearch}
                    onChange={(e) => searchRepairsForDirect(e.target.value)}
                    placeholder="Search repair by ticket #, customer, or phone..."
                    className="pl-9 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-xs"
                  />
                  {/* Results Dropdown */}
                  {directRepairSearchResults.length > 0 && (
                    <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                      {directRepairSearchResults.map((r) => (
                        <div
                          key={r.id}
                          onClick={() => {
                            setSelectedDirectRepair(r);
                            setDirectRepairSearchResults([]);
                          }}
                          className="p-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer flex items-center justify-between"
                        >
                          <div>
                            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs">
                              #{r.repairNumber}
                            </span>
                            <span className="ml-2 font-semibold text-slate-900 dark:text-white">
                              {r.deviceBrand} {r.deviceModel}
                            </span>
                            <span className="block text-[10px] text-slate-400">
                              Customer: {r.customerName} • Current: {r.assignedByName || 'Unassigned'}
                            </span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Step 2: Target Technician */}
            <div>
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                2. Destination Technician:
              </label>
              <Select value={selectedTargetTechId} onValueChange={setSelectedTargetTechId}>
                <SelectTrigger className="h-10 rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-xs">
                  <SelectValue placeholder="Choose eligible destination technician..." />
                </SelectTrigger>
                <SelectContent className="rounded-2xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                  {technicians.map((tech) => (
                    <SelectItem key={tech.id} value={tech.id} className="text-xs font-semibold py-2">
                      <div className="flex items-center justify-between w-full gap-4">
                        <span>{tech.name} ({tech.role.replace(/_/g, ' ')})</span>
                        <Badge variant="outline" className={`text-[9.5px] px-1.5 py-0 ${tech.workloadBadgeClass}`}>
                          {tech.workloadLabel} ({tech.activeRepairsCount})
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Step 3: Priority Update (Optional) */}
            <div>
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                3. Update Priority (Optional):
              </label>
              <Select value={directPriority} onValueChange={setDirectPriority}>
                <SelectTrigger className="h-10 rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-xs">
                  <SelectValue placeholder="Keep existing priority or select new..." />
                </SelectTrigger>
                <SelectContent className="rounded-2xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                  <SelectItem value="URGENT" className="text-xs font-bold text-rose-600">🔴 URGENT Priority</SelectItem>
                  <SelectItem value="HIGH" className="text-xs font-bold text-amber-600">🟠 HIGH Priority</SelectItem>
                  <SelectItem value="NORMAL" className="text-xs font-semibold">🔵 NORMAL Priority</SelectItem>
                  <SelectItem value="LOW" className="text-xs">⚪ LOW Priority</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Step 4: Transfer Instructions */}
            <div>
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                4. Instructions / Reason for Transfer:
              </label>
              <Textarea
                rows={2}
                value={directTransferReason}
                onChange={(e) => setDirectTransferReason(e.target.value)}
                placeholder="e.g. Workload rebalancing; requires chip-level soldering microscope..."
                className="rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="outline"
              onClick={() => setIsDirectTransferOpen(false)}
              className="rounded-xl text-xs font-bold border-slate-200"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDirectTransfer}
              disabled={isSubmittingDirect || !selectedDirectRepair || !selectedTargetTechId}
              className="rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
            >
              {isSubmittingDirect ? 'Transferring...' : 'Execute Management Transfer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
