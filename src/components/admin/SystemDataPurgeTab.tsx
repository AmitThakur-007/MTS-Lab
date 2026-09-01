import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Trash2, 
  AlertTriangle, 
  Calendar, 
  Lock, 
  Loader2, 
  History, 
  CheckCircle2, 
  Info, 
  Layers, 
  RefreshCw, 
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from '@/components/ui/dialog';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useAuthStore } from '@/store/authStore';

export default function SystemDataPurgeTab() {
  const { user } = useAuthStore();
  const [category, setCategory] = useState('repairs');
  const [timeframe, setTimeframe] = useState<'ALL' | 'DATE' | 'MONTH' | 'YEAR' | 'RANGE'>('ALL');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [selectedYear, setSelectedYear] = useState(format(new Date(), 'yyyy'));
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Preview count state
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewBreakdown, setPreviewBreakdown] = useState<Record<string, number> | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Deletion execution dialog
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [purging, setPurging] = useState(false);

  // Purge history
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchPreview = async () => {
    setPreviewLoading(true);
    try {
      const res: any = await api.post('/admin/system-purge/preview', {
        category,
        timeframe,
        selectedDate,
        selectedMonth,
        selectedYear,
        startDate,
        endDate,
      });

      if (res && res.success) {
        setPreviewCount(res.count);
        setPreviewBreakdown(res.breakdown || null);
      }
    } catch (err: any) {
      console.error('[PURGE PREVIEW ERROR]', err);
      setPreviewCount(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const data: any = await api.get('/admin/deletion-history');
      setHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[DELETION HISTORY ERROR]', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchPreview();
  }, [category, timeframe, selectedDate, selectedMonth, selectedYear, startDate, endDate]);

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleExecutePurge = async () => {
    if (confirmText !== 'DELETE') {
      toast.error('Type DELETE in all uppercase to confirm.');
      return;
    }
    if (!password) {
      toast.error('Super Admin master password is required.');
      return;
    }

    setPurging(true);
    try {
      const res: any = await api.post('/admin/system-purge/execute', {
        category,
        timeframe,
        selectedDate,
        selectedMonth,
        selectedYear,
        startDate,
        endDate,
        password,
        confirmationText: confirmText,
      });

      if (res && res.success) {
        toast.success(res.message || 'System data purge completed successfully.');
        setIsConfirmOpen(false);
        setPassword('');
        setConfirmText('');
        fetchPreview();
        fetchHistory();
      } else {
        toast.error(res?.error || 'Purge failed.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Purge failed. Verify your master password.');
    } finally {
      setPurging(false);
    }
  };

  const categories = [
    { id: 'repairs', name: 'Repair Orders & Logs', desc: 'All diagnostic jobs, statuses, technician assignments & history.' },
    { id: 'customers', name: 'Customer Profiles', desc: 'Customer phone records, addresses, and CRM contact details.' },
    { id: 'inventory', name: 'Parts & Stock Inventory', desc: 'Catalog items, quantities, minimum stock alerts, and unit prices.' },
    { id: 'attendance', name: 'Attendance & Clock-ins', desc: 'Staff clock-in/out stamps, break timers, and attendance history.' },
    { id: 'damages', name: 'Repair-Related Damage', desc: 'Damage incident logs, compensation amounts, and proof records.' },
    { id: 'warranties', name: 'Battery Warranty Cards', desc: 'Battery serial registrations, warranty terms, and claim histories.' },
    { id: 'couriers', name: 'Couriers & Dispatches', desc: 'External package dispatches, tracking numbers, and handover records.' },
    { id: 'notifications', name: 'Notifications & Alerts', desc: 'Read/unread alert notifications and activity reminders.' },
    { id: 'all_data', name: 'Full Operational System Purge', desc: 'Wipes all above operational tables. Staff accounts & audit logs remain intact.', danger: true },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Purge Configuration */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="rounded-3xl border border-slate-200/80 shadow-xs bg-white overflow-hidden">
            <CardHeader className="p-6 bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/30 text-[10px] font-bold">
                  DANGER ZONE — RESTRICTED
                </Badge>
              </div>
              <CardTitle className="text-xl font-black mt-2">Controlled System Data Purge</CardTitle>
              <CardDescription className="text-slate-400 text-xs font-semibold">
                Select specific database categories and date boundaries to safely purge operational records.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              {/* Category Selector Grid */}
              <div className="space-y-2">
                <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block">
                  1. Target Database Category
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      className={`p-3.5 rounded-2xl text-left border transition-all cursor-pointer ${
                        category === cat.id
                          ? cat.danger 
                            ? 'bg-rose-50/80 border-rose-400 ring-2 ring-rose-400/30' 
                            : 'bg-indigo-50/80 border-indigo-400 ring-2 ring-indigo-400/30'
                          : 'bg-white hover:bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`font-bold text-xs ${category === cat.id ? (cat.danger ? 'text-rose-900' : 'text-indigo-950') : 'text-slate-800'}`}>
                          {cat.name}
                        </span>
                        {cat.danger && (
                          <Badge className="bg-rose-600 text-white text-[9px] font-bold">CRITICAL</Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 leading-snug">{cat.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Timeframe Scope Selector (hidden if full purge) */}
              {category !== 'all_data' && (
                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block">
                    2. Timeframe Boundary
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {[
                      { id: 'ALL', label: 'All Time' },
                      { id: 'DATE', label: 'Single Date' },
                      { id: 'MONTH', label: 'Specific Month' },
                      { id: 'YEAR', label: 'Specific Year' },
                      { id: 'RANGE', label: 'Custom Range' },
                    ].map((t) => (
                      <Button
                        key={t.id}
                        type="button"
                        variant={timeframe === t.id ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setTimeframe(t.id as any)}
                        className={`rounded-xl text-xs font-bold ${timeframe === t.id ? 'bg-slate-900 text-white' : 'border-slate-200 text-slate-600'}`}
                      >
                        {t.label}
                      </Button>
                    ))}
                  </div>

                  {/* Dynamic Date Inputs */}
                  {timeframe === 'DATE' && (
                    <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
                      <Label className="text-xs font-bold text-slate-700 block mb-1">Target Date</Label>
                      <Input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="bg-white rounded-xl h-10 text-xs font-semibold"
                      />
                    </div>
                  )}

                  {timeframe === 'MONTH' && (
                    <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
                      <Label className="text-xs font-bold text-slate-700 block mb-1">Target Month</Label>
                      <Input
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="bg-white rounded-xl h-10 text-xs font-semibold"
                      />
                    </div>
                  )}

                  {timeframe === 'YEAR' && (
                    <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
                      <Label className="text-xs font-bold text-slate-700 block mb-1">Target Year</Label>
                      <Input
                        type="number"
                        min="2020"
                        max="2035"
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(e.target.value)}
                        className="bg-white rounded-xl h-10 text-xs font-semibold"
                      />
                    </div>
                  )}

                  {timeframe === 'RANGE' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
                      <div>
                        <Label className="text-xs font-bold text-slate-700 block mb-1">Start Date</Label>
                        <Input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="bg-white rounded-xl h-10 text-xs font-semibold"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-bold text-slate-700 block mb-1">End Date</Label>
                        <Input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="bg-white rounded-xl h-10 text-xs font-semibold"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Impact Preview Card */}
              <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    Impact Analysis
                  </div>
                  {previewLoading ? (
                    <span className="text-[11px] font-bold text-amber-700 flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> Counting records...
                    </span>
                  ) : (
                    <Badge className="bg-amber-600 text-white font-extrabold text-xs">
                      {previewCount !== null ? `${previewCount.toLocaleString()} Records Target` : '—'}
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                  {category === 'all_data'
                    ? 'Caution: This will permanently erase all operational database tables. User accounts and audit logs will be securely preserved.'
                    : `Purging will irreversibly remove matching records from the active database. Deletion is logged in the permanent audit trail.`}
                </p>

                {previewBreakdown && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-amber-200/60 text-[10px]">
                    {Object.entries(previewBreakdown).map(([k, v]) => (
                      <div key={k} className="bg-white/80 p-2 rounded-lg border border-amber-200/60 font-semibold text-slate-700">
                        <span className="text-slate-400 capitalize block">{k}:</span>
                        <span className="text-slate-900 font-bold">{v}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>

            <CardFooter className="p-6 bg-slate-50 border-t border-slate-200/80 flex flex-col sm:flex-row justify-between items-center gap-3">
              <div className="text-[11px] text-slate-500 font-semibold">
                Super Admin authentication required to authorize purge.
              </div>
              <Button
                variant="destructive"
                onClick={() => {
                  setPassword('');
                  setConfirmText('');
                  setIsConfirmOpen(true);
                }}
                disabled={previewCount === 0}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl h-10 px-5 shadow-xs w-full sm:w-auto cursor-pointer"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Configure &amp; Authorize Purge
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Right Col: Purge History & Safeguards */}
        <div className="space-y-6">
          <Card className="rounded-3xl border border-slate-200/80 shadow-xs bg-white overflow-hidden">
            <CardHeader className="p-5 bg-slate-100/80 border-b border-slate-200/80 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                  <History className="h-4 w-4 text-slate-700" />
                  Recent Purge Records
                </CardTitle>
                <CardDescription className="text-[10px] text-slate-500 font-semibold mt-0.5">
                  Immutable ledger of administrative purges.
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchHistory}
                className="h-7 w-7 p-0 rounded-lg text-slate-500 hover:text-slate-900"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${historyLoading ? 'animate-spin' : ''}`} />
              </Button>
            </CardHeader>

            <CardContent className="p-4 space-y-3 max-h-[460px] overflow-y-auto">
              {history.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <ShieldCheck className="h-7 w-7 mx-auto mb-1 text-slate-300" />
                  <p className="text-xs font-bold text-slate-600">No Purge Records Logged</p>
                  <p className="text-[10px] text-slate-400">Database is operating in normal state.</p>
                </div>
              ) : (
                history.map((h) => (
                  <div key={h.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{h.action}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {h.createdAt ? format(new Date(h.createdAt), 'MMM dd, HH:mm') : 'N/A'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 font-medium">{h.details}</p>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-200/50">
                      <span>By: {h.userName || h.userEmail || 'Super Admin'}</span>
                      <span className="font-bold text-emerald-600">{h.status || 'SUCCESS'}</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Confirmation & Master Password Dialog */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 bg-white">
          <DialogHeader>
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mx-auto mb-2 shadow-2xs">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <DialogTitle className="text-center text-lg font-black text-slate-900">
              Confirm Permanent System Purge
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-slate-500">
              You are about to permanently delete records from <strong className="text-slate-900">{category.toUpperCase()}</strong>. This action cannot be reversed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl space-y-1 text-rose-900">
              <div className="font-bold text-[11px] flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                Target Volume: {previewCount !== null ? `${previewCount.toLocaleString()} items` : 'Multiple items'}
              </div>
              <p className="text-[11px] text-rose-700">
                Staff accounts and audit trail will remain completely untouched.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">
                Type <span className="font-black text-rose-600">DELETE</span> to confirm:
              </Label>
              <Input
                placeholder="DELETE"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="rounded-xl h-10 text-xs font-bold font-mono tracking-wider border-slate-300"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">
                Super Admin Master Password:
              </Label>
              <Input
                type="password"
                placeholder="Enter password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-xl h-10 text-xs font-semibold border-slate-300"
              />
            </div>
          </div>

          <DialogFooter className="grid grid-cols-2 gap-2 mt-2">
            <Button
              variant="outline"
              onClick={() => setIsConfirmOpen(false)}
              disabled={purging}
              className="rounded-xl font-bold text-xs h-10"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleExecutePurge}
              disabled={purging || confirmText !== 'DELETE' || !password}
              className="rounded-xl font-bold text-xs h-10 bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
            >
              {purging ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Purging...
                </>
              ) : (
                'Execute Purge'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
