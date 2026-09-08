import React, { useState, useEffect } from 'react';
import {
  Search,
  Download,
  CreditCard,
  CheckCircle2,
  Filter,
  FileSpreadsheet,
  Receipt,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/services/api';
import { formatNPR } from '@/lib/format';
import { exportToCSV } from '@/services/reportService';
import { toast } from 'sonner';

export const FinancialTransactionsJournal: React.FC = () => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('ALL');

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const res: any = await api.get('/revenue/transactions');
      if (res?.success) {
        setTransactions(res.transactions || []);
      }
    } catch (err: any) {
      console.error('[FETCH TRANSACTIONS ERROR]', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const filteredTransactions = transactions.filter((t) => {
    if (methodFilter !== 'ALL' && !t.method?.toLowerCase().includes(methodFilter.toLowerCase())) {
      return false;
    }
    if (search) {
      const q = search.toLowerCase();
      const match =
        (t.repairNumber || '').toLowerCase().includes(q) ||
        (t.customerName || '').toLowerCase().includes(q) ||
        (t.customerPhone || '').toLowerCase().includes(q) ||
        (t.reference || '').toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const handleExportCSV = () => {
    if (filteredTransactions.length === 0) {
      return toast.error('No transactions to export');
    }

    const headers = [
      'Transaction ID',
      'Date (NPT)',
      'Type',
      'Job Number',
      'Customer Name',
      'Customer Phone',
      'Description',
      'Amount (NPR)',
      'Payment Method',
      'Reference / Notes',
      'Status',
    ];

    const rows = filteredTransactions.map((t) => [
      t.id,
      t.nepalDate || t.date,
      t.type,
      t.repairNumber,
      t.customerName,
      t.customerPhone,
      t.description,
      t.amount,
      t.method,
      t.reference,
      t.status,
    ]);

    exportToCSV(`MTS_LAB_TRANSACTION_JOURNAL_${new Date().toISOString().slice(0, 10)}`, headers, rows);
    toast.success('Transaction journal exported as CSV');
  };

  const totalInflow = filteredTransactions.reduce((acc, t) => acc + (t.amount || 0), 0);

  return (
    <Card className="rounded-2xl border-slate-200/80 shadow-xs bg-white overflow-hidden">
      <CardHeader className="p-5 pb-4 border-b border-slate-100 bg-slate-50/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-600" />
              Financial Transaction Journal & Cash Inflow
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 font-medium">
              Real-time ledger of all intake advances, settlement balances, counter payments, and digital collections.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="rounded-xl border-slate-200 text-xs font-bold h-9 px-3 gap-1.5 cursor-pointer hover:bg-slate-100"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              Export Journal CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchTransactions}
              className="rounded-xl border-slate-200 text-xs font-bold h-9 px-3 gap-1.5 cursor-pointer hover:bg-slate-100"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-3">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by job#, customer, phone, ref..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs font-medium rounded-xl border-slate-200 bg-white"
            />
          </div>

          <div>
            <Select value={methodFilter} onValueChange={setMethodFilter}>
              <SelectTrigger className="h-9 rounded-xl text-xs font-bold border-slate-200 bg-white">
                <SelectValue placeholder="Payment Method" />
              </SelectTrigger>
              <SelectContent className="rounded-xl shadow-xl">
                <SelectItem value="ALL" className="text-xs font-bold">All Payment Methods</SelectItem>
                <SelectItem value="CASH" className="text-xs font-bold">Cash</SelectItem>
                <SelectItem value="ESEWA" className="text-xs font-bold">eSewa</SelectItem>
                <SelectItem value="KHALTI" className="text-xs font-bold">Khalti</SelectItem>
                <SelectItem value="BANK" className="text-xs font-bold">Bank Transfer / FonePay</SelectItem>
                <SelectItem value="CARD" className="text-xs font-bold">Card</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-end">
            <div className="bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100 text-xs font-extrabold text-emerald-800">
              Filtered Inflow: <span className="font-mono text-emerald-900">{formatNPR(totalInflow)}</span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-black uppercase tracking-wider text-slate-400">
                <th className="px-5 py-3.5">Date & Time</th>
                <th className="px-4 py-3.5">Job / Customer</th>
                <th className="px-4 py-3.5">Description</th>
                <th className="px-4 py-3.5 text-center">Payment Method</th>
                <th className="px-4 py-3.5">Reference</th>
                <th className="px-5 py-3.5 text-right">Inflow Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 text-xs">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-400" />
                    Loading transaction journal...
                  </td>
                </tr>
              ) : filteredTransactions.length > 0 ? (
                filteredTransactions.map((tx, idx) => (
                  <tr key={tx.id || idx} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-mono font-bold text-slate-900">{tx.nepalDate || tx.date?.slice(0, 10)}</div>
                      <div className="text-[10px] text-slate-400">{tx.date ? new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-mono font-black text-slate-900">{tx.repairNumber}</div>
                      <div className="text-slate-600 font-semibold truncate max-w-[160px]">{tx.customerName}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-slate-800 font-medium truncate max-w-[220px]">{tx.description}</p>
                      <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200 text-[9px] font-bold px-1.5 py-0">
                        {tx.type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <Badge className="bg-slate-900 text-white font-bold text-[10px] uppercase border-none px-2 py-0.5 shadow-none">
                        {tx.method}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[11px] text-slate-500">
                      {tx.reference || '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono font-black text-emerald-700 text-sm">
                      +{formatNPR(tx.amount)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 text-xs">
                    No transactions recorded in journal.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

export default FinancialTransactionsJournal;
