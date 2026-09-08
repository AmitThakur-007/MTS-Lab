import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Filter,
  ArrowUpDown,
  Download,
  CreditCard,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Clock,
  CheckCircle,
  AlertCircle,
  Smartphone,
  Layers,
  FileSpreadsheet
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
import { exportToCSV, generateRepairProfitabilityReport } from '@/services/reportService';
import { RecordPaymentModal } from './RecordPaymentModal';
import { toast } from 'sonner';

interface RepairProfitabilityTableProps {
  timeframe: string;
  startDate?: string;
  endDate?: string;
  onDataChanged?: () => void;
  userRole?: string;
}

export const RepairProfitabilityTable: React.FC<RepairProfitabilityTableProps> = ({
  timeframe,
  startDate,
  endDate,
  onDataChanged,
  userRole,
}) => {
  const navigate = useNavigate();
  const [repairs, setRepairs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [brandFilter, setBrandFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [sliceSummary, setSliceSummary] = useState<any>({
    totalFilteredRevenue: 0,
    totalFilteredProfit: 0,
    totalFilteredReceivables: 0,
  });

  // Modal State for Recording Payment
  const [selectedRepairForPayment, setSelectedRepairForPayment] = useState<any | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const fetchRepairs = async () => {
    try {
      setLoading(true);
      const params: any = {
        page,
        limit: 15,
        search,
        timeframe,
        startDate,
        endDate,
        paymentStatus: paymentStatusFilter,
        status: statusFilter,
        brand: brandFilter,
        sortBy,
        sortOrder,
      };

      const res: any = await api.get('/revenue/repairs', { params });
      if (res?.success) {
        setRepairs(res.repairs || []);
        setTotalPages(res.pagination?.totalPages || 1);
        setTotalCount(res.pagination?.totalCount || 0);
        setSliceSummary(res.sliceSummary || {});
      }
    } catch (err: any) {
      console.error('[FETCH REPAIR PROFITABILITY ERROR]', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRepairs();
  }, [page, search, paymentStatusFilter, statusFilter, brandFilter, sortBy, sortOrder, timeframe, startDate, endDate]);

  const handleExportCSV = () => {
    if (repairs.length === 0) {
      return toast.error('No repairs to export');
    }

    const headers = [
      'Job Number',
      'Customer Name',
      'Customer Phone',
      'Device Brand',
      'Device Model',
      'Service Category',
      'Repair Status',
      'Quoted Cost (NPR)',
      'Advance Paid (NPR)',
      'Total Paid (NPR)',
      'Balance Due (NPR)',
      'Parts Cost (NPR)',
      'Damage Loss (NPR)',
      'Gross Profit (NPR)',
      'Profit Margin (%)',
      'Payment Status',
      'Technician',
      'Date',
    ];

    const rows = repairs.map((r) => [
      r.repairNumber,
      r.customerName,
      r.customerPhone,
      r.deviceBrand,
      r.deviceModel,
      r.category,
      r.status,
      r.estimatedCost,
      r.advancePaid,
      r.totalPaid,
      r.balanceDue,
      r.partsCost,
      r.damageCost,
      r.grossProfit,
      r.profitMargin,
      r.paymentStatus,
      r.technicianName,
      r.nepalDate,
    ]);

    exportToCSV(`MTS_LAB_REPAIR_PROFITABILITY_${timeframe}`, headers, rows);
    toast.success('CSV Export downloaded successfully');
  };

  const handleExportPDF = () => {
    if (repairs.length === 0) {
      return toast.error('No repairs to export');
    }
    generateRepairProfitabilityReport(repairs, `Repair Profitability Ledger (${timeframe})`);
    toast.success('PDF Ledger generated');
  };

  return (
    <Card className="rounded-2xl border-slate-200/80 shadow-xs bg-white overflow-hidden">
      <CardHeader className="p-5 pb-4 border-b border-slate-100 bg-slate-50/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-900" />
              Repair-Level Profitability & Billing Ledger
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 font-medium">
              Granular breakdown of quoted charges, customer collections, parts cost, damage deduction, and net ticket margins.
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
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPDF}
              className="rounded-xl border-slate-200 text-xs font-bold h-9 px-3 gap-1.5 cursor-pointer hover:bg-slate-100"
            >
              <Download className="w-3.5 h-3.5 text-indigo-600" />
              Export PDF
            </Button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2.5 pt-4">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search job#, customer, phone, device..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9 h-9 text-xs font-medium rounded-xl border-slate-200 bg-white"
            />
          </div>

          <div>
            <Select
              value={paymentStatusFilter}
              onValueChange={(val) => {
                setPaymentStatusFilter(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 rounded-xl text-xs font-bold border-slate-200 bg-white">
                <SelectValue placeholder="Payment Status" />
              </SelectTrigger>
              <SelectContent className="rounded-xl shadow-xl">
                <SelectItem value="ALL" className="text-xs font-bold">All Payments</SelectItem>
                <SelectItem value="PAID" className="text-xs font-bold text-emerald-700">Fully Paid</SelectItem>
                <SelectItem value="PARTIAL" className="text-xs font-bold text-amber-700">Partial Payment</SelectItem>
                <SelectItem value="UNPAID" className="text-xs font-bold text-rose-700">Unpaid Due</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Select
              value={statusFilter}
              onValueChange={(val) => {
                setStatusFilter(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 rounded-xl text-xs font-bold border-slate-200 bg-white">
                <SelectValue placeholder="Repair Status" />
              </SelectTrigger>
              <SelectContent className="rounded-xl shadow-xl">
                <SelectItem value="ALL" className="text-xs font-bold">All Statuses</SelectItem>
                <SelectItem value="DELIVERED" className="text-xs font-bold">Delivered</SelectItem>
                <SelectItem value="READY_FOR_PICKUP" className="text-xs font-bold">Ready for Pickup</SelectItem>
                <SelectItem value="IN_PROCESS" className="text-xs font-bold">In Process</SelectItem>
                <SelectItem value="RECEIVED" className="text-xs font-bold">Received</SelectItem>
                <SelectItem value="CANNOT_REPAIR" className="text-xs font-bold">Cannot Repair</SelectItem>
                <SelectItem value="CANCELLED" className="text-xs font-bold">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Select
              value={brandFilter}
              onValueChange={(val) => {
                setBrandFilter(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 rounded-xl text-xs font-bold border-slate-200 bg-white">
                <SelectValue placeholder="Brand" />
              </SelectTrigger>
              <SelectContent className="rounded-xl shadow-xl">
                <SelectItem value="ALL" className="text-xs font-bold">All Brands</SelectItem>
                <SelectItem value="Apple" className="text-xs font-bold">Apple</SelectItem>
                <SelectItem value="Samsung" className="text-xs font-bold">Samsung</SelectItem>
                <SelectItem value="Xiaomi" className="text-xs font-bold">Xiaomi / Redmi</SelectItem>
                <SelectItem value="Vivo" className="text-xs font-bold">Vivo</SelectItem>
                <SelectItem value="Oppo" className="text-xs font-bold">Oppo</SelectItem>
                <SelectItem value="OnePlus" className="text-xs font-bold">OnePlus</SelectItem>
                <SelectItem value="Realme" className="text-xs font-bold">Realme</SelectItem>
                <SelectItem value="Other" className="text-xs font-bold">Other Brands</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Select
              value={sortBy}
              onValueChange={(val) => {
                setSortBy(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 rounded-xl text-xs font-bold border-slate-200 bg-white">
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent className="rounded-xl shadow-xl">
                <SelectItem value="createdAt" className="text-xs font-bold">Sort: Date</SelectItem>
                <SelectItem value="totalPaid" className="text-xs font-bold">Sort: Revenue Paid</SelectItem>
                <SelectItem value="estimatedCost" className="text-xs font-bold">Sort: Quoted Amount</SelectItem>
                <SelectItem value="balanceDue" className="text-xs font-bold">Sort: Balance Due</SelectItem>
                <SelectItem value="grossProfit" className="text-xs font-bold">Sort: Profit Margin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-black uppercase tracking-wider text-slate-400">
                <th className="px-5 py-3.5">Job / Date</th>
                <th className="px-4 py-3.5">Customer & Device</th>
                <th className="px-4 py-3.5 text-right">Quoted Bill</th>
                <th className="px-4 py-3.5 text-right">Collected</th>
                <th className="px-4 py-3.5 text-right">Balance Due</th>
                <th className="px-4 py-3.5 text-right">Parts Cost</th>
                <th className="px-4 py-3.5 text-right">Gross Profit</th>
                <th className="px-4 py-3.5 text-center">Margin</th>
                <th className="px-4 py-3.5 text-center">Payment Status</th>
                <th className="px-5 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 text-xs font-medium">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-400" />
                    Calculating repair profitability ledger...
                  </td>
                </tr>
              ) : repairs.length > 0 ? (
                repairs.map((r) => {
                  const isFullyPaid = r.paymentStatus === 'PAID';
                  const isPartial = r.paymentStatus === 'PARTIAL';
                  const isProfitable = r.grossProfit >= 0;

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Job ID & Date */}
                      <td className="px-5 py-3.5">
                        <div className="font-mono font-black text-slate-900">{r.repairNumber}</div>
                        <div className="text-[10px] text-slate-400 font-semibold">{r.nepalDate}</div>
                      </td>

                      {/* Customer & Device */}
                      <td className="px-4 py-3.5">
                        <div className="font-extrabold text-slate-900 truncate max-w-[150px]">{r.customerName}</div>
                        <div className="text-[11px] text-slate-500 font-medium truncate max-w-[170px]">
                          {r.deviceBrand} {r.deviceModel}
                        </div>
                        <div className="text-[10px] text-slate-400">{r.category}</div>
                      </td>

                      {/* Quoted Cost */}
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-800">
                        {formatNPR(r.estimatedCost)}
                      </td>

                      {/* Collected / Total Paid */}
                      <td className="px-4 py-3.5 text-right font-mono font-black text-emerald-700">
                        {formatNPR(r.totalPaid)}
                        {r.advancePaid > 0 && r.advancePaid < r.totalPaid && (
                          <div className="text-[9px] text-slate-400 font-normal">Adv: {formatNPR(r.advancePaid)}</div>
                        )}
                      </td>

                      {/* Balance Due */}
                      <td className="px-4 py-3.5 text-right font-mono font-bold">
                        {r.balanceDue > 0 ? (
                          <span className="text-amber-600">{formatNPR(r.balanceDue)}</span>
                        ) : (
                          <span className="text-slate-300 font-normal">0.00</span>
                        )}
                      </td>

                      {/* Parts Cost */}
                      <td className="px-4 py-3.5 text-right font-mono text-slate-600">
                        {formatNPR(r.partsCost)}
                        {r.damageCost > 0 && (
                          <div className="text-[9px] text-rose-500 font-semibold">+Dmg: {formatNPR(r.damageCost)}</div>
                        )}
                      </td>

                      {/* Gross Profit */}
                      <td className="px-4 py-3.5 text-right font-mono font-black">
                        <span className={isProfitable ? 'text-emerald-700' : 'text-rose-600'}>
                          {formatNPR(r.grossProfit)}
                        </span>
                      </td>

                      {/* Margin % */}
                      <td className="px-4 py-3.5 text-center">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-black px-2 py-0.5 ${
                            r.profitMargin >= 50
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : r.profitMargin > 0
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          {r.profitMargin}%
                        </Badge>
                      </td>

                      {/* Payment Status Badge */}
                      <td className="px-4 py-3.5 text-center">
                        <Badge
                          className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 border-none shadow-none ${
                            isFullyPaid
                              ? 'bg-emerald-100 text-emerald-800'
                              : isPartial
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {r.paymentStatus}
                        </Badge>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {r.balanceDue > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedRepairForPayment(r);
                                setIsPaymentModalOpen(true);
                              }}
                              className="h-7 px-2 text-[11px] font-bold rounded-lg border-emerald-200 bg-emerald-50/50 text-emerald-700 hover:bg-emerald-100 cursor-pointer"
                            >
                              <CreditCard className="w-3 h-3 mr-1" />
                              Pay
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate(`/dashboard/repairs/${r.id}`)}
                            className="h-7 w-7 p-0 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 text-xs">
                    No repair tickets match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination & Filter Statistics Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500 font-medium">
          <div className="flex items-center gap-4">
            <span>
              Showing <strong className="text-slate-900 font-bold">{repairs.length}</strong> of{' '}
              <strong className="text-slate-900 font-bold">{totalCount}</strong> tickets
            </span>
            {sliceSummary && (
              <span className="hidden md:inline-flex items-center gap-3 pl-3 border-l border-slate-200">
                <span>Revenue: <strong className="text-slate-900 font-mono">{formatNPR(sliceSummary.totalFilteredRevenue || 0)}</strong></span>
                <span>Profit: <strong className="text-emerald-700 font-mono">{formatNPR(sliceSummary.totalFilteredProfit || 0)}</strong></span>
                <span>Due: <strong className="text-amber-600 font-mono">{formatNPR(sliceSummary.totalFilteredReceivables || 0)}</strong></span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-8 w-8 p-0 rounded-lg border-slate-200 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs font-bold text-slate-700 px-2">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="h-8 w-8 p-0 rounded-lg border-slate-200 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>

      {/* Record Payment Modal */}
      <RecordPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setSelectedRepairForPayment(null);
        }}
        repair={selectedRepairForPayment}
        onPaymentSuccess={() => {
          fetchRepairs();
          if (onDataChanged) onDataChanged();
        }}
      />
    </Card>
  );
};

export default RepairProfitabilityTable;
