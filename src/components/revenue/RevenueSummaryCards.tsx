import React from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Layers, 
  Clock, 
  Percent, 
  ArrowUpRight, 
  ArrowDownRight, 
  AlertTriangle,
  Receipt,
  Truck,
  CheckCircle2
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatNPR } from '@/lib/format';

interface RevenueSummaryCardsProps {
  summary: {
    grossRevenue: number;
    estimatedBilled: number;
    outstandingReceivables: number;
    totalAdvanceCollected: number;
    totalSettlementCollected: number;
    totalPartsCost: number;
    totalDamageLoss: number;
    grossProfit: number;
    netProfit: number;
    profitMargin: number;
    averageTicket: number;
    totalRepairsCount: number;
    completedRepairsCount: number;
    paidRepairsCount: number;
    partialRepairsCount: number;
    unpaidRepairsCount: number;
    courierInTotal: number;
    courierOutTotal: number;
  };
  timeframeLabel: string;
}

export const RevenueSummaryCards: React.FC<RevenueSummaryCardsProps> = ({
  summary,
  timeframeLabel,
}) => {
  const grossRev = summary?.grossRevenue || 0;
  const billed = summary?.estimatedBilled || 0;
  const netProf = summary?.netProfit || 0;
  const margin = summary?.profitMargin || 0;
  const partsCost = summary?.totalPartsCost || 0;
  const damageLoss = summary?.totalDamageLoss || 0;
  const receivables = summary?.outstandingReceivables || 0;
  const avgTicket = summary?.averageTicket || 0;

  const collectionRate = billed > 0 ? Math.round((grossRev / billed) * 100) : (grossRev > 0 ? 100 : 0);
  const partsCostRatio = grossRev > 0 ? Math.round((partsCost / grossRev) * 100) : 0;

  return (
    <div className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {/* 1. Gross Revenue Card */}
      <Card className="rounded-2xl border-slate-200/80 shadow-xs bg-gradient-to-br from-slate-950 to-slate-900 text-white relative overflow-hidden flex flex-col justify-between">
        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
          <DollarSign className="w-20 h-20 text-white" />
        </div>
        <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">
                Gross Revenue
              </span>
              <Badge className="bg-emerald-500/20 text-emerald-300 border-none text-[10px] font-black px-2 py-0.5">
                {collectionRate}% of Quote
              </Badge>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-white">
                {formatNPR(grossRev)}
              </div>
              <p className="text-[11px] text-slate-400 font-medium mt-1">
                Actual money collected in {timeframeLabel}
              </p>
            </div>
          </div>
          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-300">
            <span className="truncate">Advances: {formatNPR(summary?.totalAdvanceCollected || 0)}</span>
            <span className="font-bold text-emerald-400">+{summary?.paidRepairsCount || 0} Paid</span>
          </div>
        </CardContent>
      </Card>

      {/* 2. Net Operating Profit Card */}
      <Card className="rounded-2xl border-slate-200/80 shadow-xs bg-white flex flex-col justify-between">
        <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500">
                Net Operating Profit
              </span>
              <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                <TrendingUp className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3">
              <div className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${netProf >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                {formatNPR(netProf)}
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-1">
                After parts cost & damage losses
              </p>
            </div>
          </div>
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-semibold">Margin Health:</span>
            <span className={`font-black ${margin >= 40 ? 'text-emerald-600' : margin >= 20 ? 'text-amber-600' : 'text-rose-600'}`}>
              {margin}%
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 3. Parts & COGS Cost Card */}
      <Card className="rounded-2xl border-slate-200/80 shadow-xs bg-white flex flex-col justify-between">
        <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500">
                Parts & Direct Cost
              </span>
              <span className="p-1.5 bg-slate-100 text-slate-700 rounded-lg">
                <Layers className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-slate-900">
                {formatNPR(partsCost)}
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-1">
                {partsCostRatio}% of gross collections
              </p>
            </div>
          </div>
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Direct Parts Used</span>
            <span className="font-bold text-slate-900">{summary?.totalRepairsCount || 0} Tickets</span>
          </div>
        </CardContent>
      </Card>

      {/* 4. Outstanding Receivables Card */}
      <Card className="rounded-2xl border-slate-200/80 shadow-xs bg-white flex flex-col justify-between">
        <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500">
                Pending Receivables
              </span>
              <span className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
                <Clock className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-amber-600">
                {formatNPR(receivables)}
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-1">
                Unpaid balances from customers
              </p>
            </div>
          </div>
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Pending Jobs:</span>
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 font-black text-[10px]">
              {(summary?.partialRepairsCount || 0) + (summary?.unpaidRepairsCount || 0)} Repairs
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* 5. Average Ticket Value Card */}
      <Card className="rounded-2xl border-slate-200/80 shadow-xs bg-white flex flex-col justify-between">
        <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500">
                Average Ticket
              </span>
              <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                <Receipt className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-slate-900">
                {formatNPR(avgTicket)}
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-1">
                Average revenue per repair ticket
              </p>
            </div>
          </div>
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Completed Jobs:</span>
            <span className="font-bold text-slate-900">{summary?.completedRepairsCount || 0} Finished</span>
          </div>
        </CardContent>
      </Card>

      {/* 6. Damage & Losses Card */}
      <Card className="rounded-2xl border-slate-200/80 shadow-xs bg-white flex flex-col justify-between">
        <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500">
                Damage / Losses
              </span>
              <span className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
                <AlertTriangle className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3">
              <div className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${damageLoss > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                {formatNPR(damageLoss)}
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-1">
                Workshop incident deductions
              </p>
            </div>
          </div>
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Deduction Impact</span>
            <span className="font-bold text-rose-600">
              {grossRev > 0 ? `${((damageLoss / grossRev) * 100).toFixed(1)}%` : '0%'}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RevenueSummaryCards;
