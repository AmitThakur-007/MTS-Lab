import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRightLeft,
  Search,
  Check,
  X,
  Clock,
  CircleCheck,
  AlertCircle,
  Plus,
  Loader2,
  Eye,
  Filter,
  User,
  History,
  Send,
  Inbox,
  ShieldCheck,
  RotateCcw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { api } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { useRealtimeSync } from '@/services/realtime';
import { formatTimeAgo } from '@/lib/timeUtils';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import TechnicianHeader from './TechnicianHeader';
import { TechnicianTransfersSkeleton } from './TechnicianSkeletons';

export type TransferTab = 'INCOMING' | 'OUTGOING' | 'HISTORY';

export default function TechnicianTransfers() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<TransferTab>('INCOMING');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Transfer data
  const [incomingTransfers, setIncomingTransfers] = useState<any[]>([]);
  const [outgoingTransfers, setOutgoingTransfers] = useState<any[]>([]);
  const [historyTransfers, setHistoryTransfers] = useState<any[]>([]);
  const [pendingIncomingCount, setPendingIncomingCount] = useState(0);

  // Active repairs eligible for transfer
  const [myRepairs, setMyRepairs] = useState<any[]>([]);
  const [colleagueTechnicians, setColleagueTechnicians] = useState<any[]>([]);

  // Action states
  const [actionProcessingId, setActionProcessingId] = useState<string | null>(null);

  // New Transfer Modal
  const [isNewTransferOpen, setIsNewTransferOpen] = useState(false);
  const [transferForm, setTransferForm] = useState({
    repairId: '',
    targetTechnicianId: '',
    reason: '',
  });
  const [submittingTransfer, setSubmittingTransfer] = useState(false);

  // Fetch Transfers
  const fetchTransferData = useCallback(async (isBackground = false) => {
    if (!user?.id) return;
    try {
      if (!isBackground) setLoading(true);

      const [myRequestsRes, repairsRes, staffRes] = await Promise.allSettled([
        api.get('/repair-transfers/my-requests'),
        api.get('/repairs', { params: { assignedToMe: 'true' } }),
        api.get('/users/staff'),
      ]);

      if (myRequestsRes.status === 'fulfilled' && myRequestsRes.value) {
        const data = myRequestsRes.value;
        const inc = data.incoming || [];
        const out = data.outgoing || [];
        setIncomingTransfers(inc);
        setOutgoingTransfers(out);
        setPendingIncomingCount(typeof data.pendingIncomingCount === 'number' ? data.pendingIncomingCount : inc.filter((t: any) => t.status === 'PENDING').length);

        // Build unified history
        const combined = [...inc, ...out].sort(
          (a, b) => new Date(b.createdAt || b.requestDate).getTime() - new Date(a.createdAt || a.requestDate).getTime()
        );
        setHistoryTransfers(combined);
      }

      if (repairsRes.status === 'fulfilled') {
        const raw = repairsRes.value;
        const list = Array.isArray(raw) ? raw : (raw?.repairs || raw?.data || []);
        // Active repairs eligible to be handed off
        const active = list.filter((r: any) =>
          (r.technicianId === user.id || r.assignedTechnicianId === user.id) &&
          !['REPAIRED', 'READY_FOR_PICKUP', 'DELIVERED', 'CANNOT_REPAIR', 'CANCELLED'].includes(r.status)
        );
        setMyRepairs(active);
      }

      if (staffRes.status === 'fulfilled') {
        const staff = Array.isArray(staffRes.value) ? staffRes.value : [];
        setColleagueTechnicians(
          staff.filter((s: any) =>
            ['TECHNICIAN', 'LEAD_TECHNICIAN', 'HEAD_TECHNICIAN'].includes(s.role) &&
            s.id !== user.id &&
            s.isActive !== false
          )
        );
      }
    } catch (err: any) {
      console.error('[FETCH TRANSFERS ERROR]', err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchTransferData();
  }, [fetchTransferData]);

  // Real-time synchronization
  useRealtimeSync(['repair_transfer', 'repair'], () => {
    fetchTransferData(true);
  });

  // Respond to transfer (Accept / Reject)
  const handleRespond = async (transferId: string, action: 'ACCEPT' | 'REJECT') => {
    setActionProcessingId(transferId);
    try {
      await api.post(`/repair-transfers/${transferId}/respond`, { action });
      toast.success(action === 'ACCEPT' ? 'Transfer accepted into your active bench.' : 'Transfer request declined.');
      fetchTransferData(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Failed to respond to transfer.');
    } finally {
      setActionProcessingId(null);
    }
  };

  // Cancel outgoing pending transfer
  const handleCancelOutgoing = async (transferId: string) => {
    setActionProcessingId(transferId);
    try {
      await api.post(`/repair-transfers/${transferId}/cancel`, {});
      toast.success('Transfer request successfully cancelled.');
      fetchTransferData(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Failed to cancel transfer.');
    } finally {
      setActionProcessingId(null);
    }
  };

  // Submit new transfer request
  const handleCreateTransfer = async () => {
    if (!transferForm.repairId || !transferForm.targetTechnicianId || !transferForm.reason.trim() || submittingTransfer) {
      toast.error('Please select a repair, a recipient technician, and specify the reason.');
      return;
    }
    setSubmittingTransfer(true);
    try {
      await api.post(`/repairs/${transferForm.repairId}/transfer`, {
        targetTechnicianId: transferForm.targetTechnicianId,
        reason: transferForm.reason.trim(),
      });
      toast.success('Transfer request dispatched to technician.');
      setIsNewTransferOpen(false);
      setTransferForm({ repairId: '', targetTechnicianId: '', reason: '' });
      fetchTransferData(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Failed to initiate transfer.');
    } finally {
      setSubmittingTransfer(false);
    }
  };

  // Filter transfers based on search
  const filteredItems = useMemo(() => {
    let sourceList: any[] = [];
    if (activeTab === 'INCOMING') sourceList = incomingTransfers;
    else if (activeTab === 'OUTGOING') sourceList = outgoingTransfers;
    else sourceList = historyTransfers;

    if (!searchQuery.trim()) return sourceList;
    const q = searchQuery.toLowerCase().trim();
    return sourceList.filter(t => {
      const num = String(t.repairNumber || '').toLowerCase();
      const reason = String(t.reason || '').toLowerCase();
      const sender = String(t.senderTechnicianName || '').toLowerCase();
      const receiver = String(t.targetTechnicianName || '').toLowerCase();
      const status = String(t.status || '').toLowerCase();
      return num.includes(q) || reason.includes(q) || sender.includes(q) || receiver.includes(q) || status.includes(q);
    });
  }, [activeTab, incomingTransfers, outgoingTransfers, historyTransfers, searchQuery]);

  if (loading && incomingTransfers.length === 0 && outgoingTransfers.length === 0 && historyTransfers.length === 0) {
    return <TechnicianTransfersSkeleton />;
  }

  return (
    <div className="space-y-6 pb-24 max-w-7xl mx-auto px-2 sm:px-4">
      {/* 1. Dedicated Header */}
      <TechnicianHeader
        title="Device Transfers Hub"
        subtitle="Technician-to-technician repair handoffs, bench transfers, and approval workflows."
        badgeText={pendingIncomingCount > 0 ? `${pendingIncomingCount} Action Required` : 'Bench Connected'}
        onRefresh={() => fetchTransferData(true)}
        isRefreshing={loading}
        actions={
          <Button
            onClick={() => setIsNewTransferOpen(true)}
            className="rounded-xl bg-amber-600 hover:bg-amber-700 text-slate-950 font-bold text-xs h-9 px-3.5 shadow-sm cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            <span>Initiate Transfer</span>
          </Button>
        }
      />

      {/* 2. Transfer Statistics Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {/* Pending Incoming */}
        <div
          onClick={() => setActiveTab('INCOMING')}
          className={cn(
            "p-4 rounded-2xl border text-left flex flex-col justify-between gap-3 shadow-sm transition-all cursor-pointer group",
            pendingIncomingCount > 0
              ? "bg-amber-50/60 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 ring-2 ring-amber-400/20"
              : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800"
          )}
        >
          <div className="flex items-center justify-between">
            <div className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center shadow-xs",
              pendingIncomingCount > 0 ? "bg-amber-500 text-slate-950" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
            )}>
              <Inbox className="h-4 w-4" />
            </div>
            <Badge variant="outline" className={cn(
              "text-[10px] font-bold border",
              pendingIncomingCount > 0
                ? "bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 border-amber-300 animate-pulse"
                : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200"
            )}>
              {pendingIncomingCount > 0 ? 'Action Required' : 'Incoming'}
            </Badge>
          </div>
          <div>
            <div className={cn(
              "text-2xl sm:text-3xl font-black",
              pendingIncomingCount > 0 ? "text-amber-700 dark:text-amber-400" : "text-slate-900 dark:text-white"
            )}>
              {pendingIncomingCount}
            </div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Incoming Requests</div>
          </div>
        </div>

        {/* Outgoing Pending */}
        <div
          onClick={() => setActiveTab('OUTGOING')}
          className="p-4 rounded-2xl border text-left flex flex-col justify-between gap-3 shadow-sm bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-400 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-xs">
              <Send className="h-4 w-4" />
            </div>
            <Badge variant="outline" className="text-[10px] font-bold bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700">
              Dispatched
            </Badge>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              {outgoingTransfers.filter(t => t.status === 'PENDING').length}
            </div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Awaiting Colleague</div>
          </div>
        </div>

        {/* Accepted / Completed */}
        <div
          onClick={() => setActiveTab('HISTORY')}
          className="p-4 rounded-2xl border text-left flex flex-col justify-between gap-3 shadow-sm bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-400 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs">
              <CircleCheck className="h-4 w-4" />
            </div>
            <Badge variant="outline" className="text-[10px] font-bold bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700">
              Completed
            </Badge>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              {historyTransfers.filter(t => t.status === 'ACCEPTED').length}
            </div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Accepted Handoffs</div>
          </div>
        </div>

        {/* Rejected / Cancelled */}
        <div
          onClick={() => setActiveTab('HISTORY')}
          className="p-4 rounded-2xl border text-left flex flex-col justify-between gap-3 shadow-sm bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-400 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center shadow-xs">
              <History className="h-4 w-4" />
            </div>
            <Badge variant="outline" className="text-[10px] font-bold bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200">
              All Records
            </Badge>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              {historyTransfers.length}
            </div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Transfer Log</div>
          </div>
        </div>
      </div>

      {/* 3. Tab Bar & Search Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3.5 transition-colors">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 min-w-0">
          {/* Responsive Horizontally Scrollable Tabs without Page Blowout */}
          <div className="w-full sm:w-auto overflow-x-auto no-scrollbar scroll-smooth -mx-1 sm:mx-0 px-1 sm:px-0">
            <div className="inline-flex items-center gap-1.5 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 min-w-max">
              <button
                type="button"
                onClick={() => setActiveTab('INCOMING')}
                className={cn(
                  "px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer",
                  activeTab === 'INCOMING'
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                <Inbox className="h-3.5 w-3.5" />
                <span>Incoming Transfers</span>
                <span className={cn(
                  "text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold",
                  pendingIncomingCount > 0 ? "bg-amber-500 text-slate-950" : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                )}>
                  {incomingTransfers.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('OUTGOING')}
                className={cn(
                  "px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer",
                  activeTab === 'OUTGOING'
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                <Send className="h-3.5 w-3.5" />
                <span>Outgoing Requests</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                  {outgoingTransfers.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('HISTORY')}
                className={cn(
                  "px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer",
                  activeTab === 'HISTORY'
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                <History className="h-3.5 w-3.5" />
                <span>Transfer Audit Log</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                  {historyTransfers.length}
                </span>
              </button>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search transfers by Repair #, technician, reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
            />
          </div>
        </div>
      </div>

      {/* 4. Content Area */}
      {filteredItems.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 p-12 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-3">
          <ArrowRightLeft className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-600" />
          <h3 className="font-black text-slate-800 dark:text-slate-200 text-lg">
            {activeTab === 'INCOMING' && 'No incoming transfer requests'}
            {activeTab === 'OUTGOING' && 'No outgoing transfer requests'}
            {activeTab === 'HISTORY' && 'No transfer history records'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            {activeTab === 'INCOMING' && 'When another technician transfers a workorder for micro-soldering or board assistance, it will appear here.'}
            {activeTab === 'OUTGOING' && 'You have not initiated any pending handoff requests to other specialists.'}
            {activeTab === 'HISTORY' && 'No historical transfer handoffs have been recorded on your bench yet.'}
          </p>
          {myRepairs.length > 0 && (
            <Button
              size="sm"
              onClick={() => setIsNewTransferOpen(true)}
              className="rounded-xl bg-amber-600 hover:bg-amber-700 text-slate-950 font-bold text-xs h-9 px-4 mt-2"
            >
              Initiate New Transfer
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((transfer) => {
            const isPending = transfer.status === 'PENDING';
            const isIncoming = activeTab === 'INCOMING' || (activeTab === 'HISTORY' && transfer.targetTechnicianId === user?.id);

            return (
              <Card
                key={transfer.id}
                className={cn(
                  "rounded-3xl border shadow-sm transition-all bg-white dark:bg-slate-900 flex flex-col justify-between overflow-hidden",
                  isPending && isIncoming
                    ? "border-amber-300 dark:border-amber-700 ring-2 ring-amber-400/20"
                    : "border-slate-200/80 dark:border-slate-800"
                )}
              >
                <CardHeader className="p-4 pb-3 border-b border-slate-100 dark:border-slate-800/80 space-y-0">
                  <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
                    <span className="font-mono font-bold text-xs bg-slate-950 dark:bg-white text-white dark:text-slate-950 px-2.5 py-1 rounded-lg shrink-0 shadow-xs">
                      #{transfer.repairNumber}
                    </span>
                    <Badge className={cn(
                      "text-[10px] font-bold px-3 py-1 rounded-full border whitespace-nowrap inline-flex items-center shrink-0 shadow-2xs",
                      isPending ? "bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 border-amber-300" :
                      transfer.status === 'ACCEPTED' ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300" :
                      "bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border-rose-300"
                    )}>
                      {transfer.status}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="p-4 sm:p-5 space-y-3.5 flex-1 flex flex-col justify-between min-w-0">
                  <div className="space-y-2.5 min-w-0">
                    <div className="text-xs text-slate-500 dark:text-slate-400 min-w-0 truncate" title={isIncoming ? (transfer.senderTechnicianName || 'Technician') : (transfer.targetTechnicianName || 'Specialist')}>
                      {isIncoming ? (
                        <>
                          <span className="font-semibold text-slate-400">From Colleague:</span>{' '}
                          <strong className="text-slate-900 dark:text-white">{transfer.senderTechnicianName || 'Technician'}</strong>
                        </>
                      ) : (
                        <>
                          <span className="font-semibold text-slate-400">Sent to:</span>{' '}
                          <strong className="text-slate-900 dark:text-white">{transfer.targetTechnicianName || 'Specialist'}</strong>
                        </>
                      )}
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 text-xs min-w-0">
                      <span className="font-bold text-slate-400 uppercase text-[10px] block mb-0.5">Transfer Reason</span>
                      <p className="text-slate-700 dark:text-slate-300 break-words leading-relaxed">{transfer.reason}</p>
                    </div>

                    {transfer.responseNote && (
                      <div className="p-2.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-800/40 text-xs min-w-0">
                        <span className="font-bold text-indigo-700 dark:text-indigo-300 uppercase text-[10px] block mb-0.5">Response Note</span>
                        <p className="text-slate-700 dark:text-slate-300 break-words leading-relaxed">{transfer.responseNote}</p>
                      </div>
                    )}

                    <div className="text-[11px] font-mono text-slate-400">
                      Requested: {transfer.createdAt ? format(new Date(transfer.createdAt), 'dd MMM yyyy, hh:mm a') : '—'}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                    {isPending && isIncoming ? (
                      <>
                        <Button
                          size="sm"
                          disabled={actionProcessingId === transfer.id}
                          onClick={() => handleRespond(transfer.id, 'ACCEPT')}
                          className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 cursor-pointer"
                        >
                          {actionProcessingId === transfer.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                          Accept Job
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={actionProcessingId === transfer.id}
                          onClick={() => handleRespond(transfer.id, 'REJECT')}
                          className="flex-1 rounded-xl border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-950 font-bold text-xs h-9 cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5 mr-1" />
                          Decline
                        </Button>
                      </>
                    ) : isPending && !isIncoming ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionProcessingId === transfer.id}
                        onClick={() => handleCancelOutgoing(transfer.id)}
                        className="w-full rounded-xl border-slate-200 dark:border-slate-700 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 font-bold text-xs h-9 cursor-pointer"
                      >
                        Cancel Request
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate(`/dashboard/repairs/${transfer.repairId}`)}
                        className="w-full rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold h-9 cursor-pointer"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1.5" />
                        <span>View Workorder Details</span>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* New Transfer Modal */}
      <Dialog open={isNewTransferOpen} onOpenChange={setIsNewTransferOpen}>
        <DialogContent className="max-w-md w-full rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white space-y-4">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-amber-500" />
              <span>Initiate Repair Handoff</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
              Transfer one of your active repair tickets to a technician colleague.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Repair Selection */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Select Active Repair</Label>
              <Select
                value={transferForm.repairId}
                onValueChange={(val) => setTransferForm(prev => ({ ...prev, repairId: val }))}
              >
                <SelectTrigger className="h-11 rounded-2xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold">
                  <SelectValue placeholder="Choose a repair from your bench" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl dark:bg-slate-900 dark:border-slate-800">
                  {myRepairs.map(r => (
                    <SelectItem key={r.id} value={r.id} className="text-xs font-bold py-2">
                      #{r.repairNumber} — {r.deviceBrand} {r.deviceModel} ({r.problemDescription?.substring(0, 30) || 'Active'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Colleague Selection */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Target Specialist</Label>
              <Select
                value={transferForm.targetTechnicianId}
                onValueChange={(val) => setTransferForm(prev => ({ ...prev, targetTechnicianId: val }))}
              >
                <SelectTrigger className="h-11 rounded-2xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold">
                  <SelectValue placeholder="Select Recipient Colleague" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl dark:bg-slate-900 dark:border-slate-800">
                  {colleagueTechnicians.map(t => (
                    <SelectItem key={t.id} value={t.id} className="text-xs font-bold py-2">
                      {t.name} ({t.role?.replace(/_/g, ' ')})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Reason */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Transfer Reason</Label>
              <Textarea
                placeholder="Explain the handoff reason (e.g. requires BGA rework, micro-soldering, shift handover)..."
                value={transferForm.reason}
                onChange={e => setTransferForm(prev => ({ ...prev, reason: e.target.value }))}
                className="rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs min-h-[90px]"
              />
            </div>
          </div>

          <DialogFooter className="flex items-center gap-2 pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsNewTransferOpen(false)}
              className="rounded-xl border-slate-200 dark:border-slate-700 text-xs font-bold h-10"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={submittingTransfer || !transferForm.repairId || !transferForm.targetTechnicianId || !transferForm.reason.trim()}
              onClick={handleCreateTransfer}
              className="rounded-xl bg-amber-600 hover:bg-amber-700 text-slate-950 font-bold text-xs h-10"
            >
              {submittingTransfer ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Dispatch Transfer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
