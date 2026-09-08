import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { normalizeRole } from '../middleware/rbac';
import { logAudit } from '../services/auditService';
import { broadcastServerChange } from '../services/realtimeSync';
import { getDamageOverviewMetrics, queryDamageRecords, initializeDamageStorage } from '../services/damageStorage';

const router = Router();

// Allowed roles for full Revenue Hub Analytics
const REVENUE_ANALYTICS_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];
const REVENUE_VIEW_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'LEAD_TECHNICIAN', 'TECHNICIAN', 'RECEPTIONIST'];

/**
 * Calculates authoritative Nepal (NPT / UTC+05:45) calendar dates & date ranges.
 */
export function getNepalDateRange(timeframe: string, customStart?: string, customEnd?: string) {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kathmandu',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const y = parts.find((p) => p.type === 'year')?.value || '2026';
  const m = parts.find((p) => p.type === 'month')?.value || '01';
  const d = parts.find((p) => p.type === 'day')?.value || '01';
  const todayStr = `${y}-${m}-${d}`;
  const currentMonthStr = `${y}-${m}`;

  // Yesterday
  const yDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yParts = formatter.formatToParts(yDate);
  const yy = yParts.find((p) => p.type === 'year')?.value || '2026';
  const ym = yParts.find((p) => p.type === 'month')?.value || '01';
  const yd = yParts.find((p) => p.type === 'day')?.value || '01';
  const yesterdayStr = `${yy}-${ym}-${yd}`;

  // Start of week (Sunday or 7 days back)
  const dayOfWeek = now.getDay(); // 0 is Sunday
  const startOfWeekDate = new Date(now.getTime() - dayOfWeek * 24 * 60 * 60 * 1000);
  const wParts = formatter.formatToParts(startOfWeekDate);
  const wy = wParts.find((p) => p.type === 'year')?.value || y;
  const wm = wParts.find((p) => p.type === 'month')?.value || m;
  const wd = wParts.find((p) => p.type === 'day')?.value || d;
  const startOfWeekStr = `${wy}-${wm}-${wd}`;

  // Last Month
  const currentMonthNum = parseInt(m, 10);
  const currentYearNum = parseInt(y, 10);
  const lastMonthNum = currentMonthNum === 1 ? 12 : currentMonthNum - 1;
  const lastMonthYear = currentMonthNum === 1 ? currentYearNum - 1 : currentYearNum;
  const lastMonthStr = `${lastMonthYear}-${String(lastMonthNum).padStart(2, '0')}`;

  let startDate = `${y}-01-01`;
  let endDate = todayStr;

  switch (timeframe?.toUpperCase()) {
    case 'TODAY':
      startDate = todayStr;
      endDate = todayStr;
      break;
    case 'YESTERDAY':
      startDate = yesterdayStr;
      endDate = yesterdayStr;
      break;
    case 'THIS_WEEK':
      startDate = startOfWeekStr;
      endDate = todayStr;
      break;
    case 'THIS_MONTH':
      startDate = `${currentMonthStr}-01`;
      endDate = todayStr;
      break;
    case 'LAST_MONTH': {
      const daysInLastMonth = new Date(lastMonthYear, lastMonthNum, 0).getDate();
      startDate = `${lastMonthStr}-01`;
      endDate = `${lastMonthStr}-${String(daysInLastMonth).padStart(2, '0')}`;
      break;
    }
    case 'THIS_YEAR':
      startDate = `${y}-01-01`;
      endDate = todayStr;
      break;
    case 'CUSTOM':
      if (customStart) startDate = customStart;
      if (customEnd) endDate = customEnd;
      break;
    case 'ALL':
      startDate = '2020-01-01';
      endDate = '2099-12-31';
      break;
    default:
      startDate = `${currentMonthStr}-01`;
      endDate = todayStr;
      break;
  }

  return {
    todayStr,
    yesterdayStr,
    currentMonthStr,
    startDate,
    endDate,
    year: y,
    month: m,
  };
}

/**
 * Format date to Nepal Date String YYYY-MM-DD
 */
export function toNepalDate(isoString?: string | null): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kathmandu',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch {
    return '';
  }
}

/**
 * Standardize Category from Repair Problem Description / Service
 */
export function classifyRepairCategory(problem: string = '', deviceBrand: string = ''): string {
  const p = (problem || '').toLowerCase();
  if (p.includes('display') || p.includes('screen') || p.includes('touch') || p.includes('glass') || p.includes('oled') || p.includes('lcd') || p.includes('fold') || p.includes('crack')) {
    if (p.includes('glass') || p.includes('oca')) return 'Glass & OCA Replacement';
    return 'Display & Touch Replacement';
  }
  if (p.includes('battery') || p.includes('drain') || p.includes('backup') || p.includes('swollen')) {
    return 'Battery Replacement';
  }
  if (p.includes('charging') || p.includes('port') || p.includes('cc') || p.includes('jack') || p.includes('type c') || p.includes('lightning')) {
    return 'Charging Port / PCB Flex';
  }
  if (p.includes('camera') || p.includes('lens') || p.includes('focus') || p.includes('blur')) {
    return 'Camera & Lens Module';
  }
  if (p.includes('back') || p.includes('housing') || p.includes('panel') || p.includes('body') || p.includes('frame')) {
    return 'Back Panel / Housing';
  }
  if (p.includes('ic') || p.includes('board') || p.includes('motherboard') || p.includes('power ic') || p.includes('cpu') || p.includes('short') || p.includes('restart') || p.includes('dead') || p.includes('audio ic') || p.includes('network ic')) {
    return 'Motherboard & IC Repair';
  }
  if (p.includes('speaker') || p.includes('earpiece') || p.includes('mic') || p.includes('sound') || p.includes('audio') || p.includes('ringer')) {
    return 'Speaker / Mic / Audio';
  }
  if (p.includes('water') || p.includes('liquid') || p.includes('moisture') || p.includes('wash')) {
    return 'Water Damage Restoration';
  }
  if (p.includes('software') || p.includes('flash') || p.includes('unlock') || p.includes('logo') || p.includes('bootloop') || p.includes('frp') || p.includes('imei') || p.includes('update')) {
    return 'Software & OS Servicing';
  }
  return 'Other Specialized Repair';
}

/**
 * Safely parse partsUsed and extract parts cost
 */
export function extractPartsCost(partsUsed: any, estimatedCost: number = 0): { partsCost: number; partsSummary: string } {
  if (!partsUsed) {
    return { partsCost: 0, partsSummary: '' };
  }

  let cost = 0;
  let summary = '';

  if (typeof partsUsed === 'string') {
    try {
      const parsed = JSON.parse(partsUsed);
      if (Array.isArray(parsed)) {
        parsed.forEach((p: any) => {
          const itemCost = Number(p.purchasePrice || p.cost || p.price || 0);
          const qty = Number(p.quantity || 1);
          cost += itemCost * qty;
          summary += summary ? `, ${p.name || p.brand || 'Part'}` : (p.name || p.brand || 'Part');
        });
      } else if (typeof parsed === 'object' && parsed !== null) {
        cost = Number(parsed.cost || parsed.purchasePrice || 0);
        summary = parsed.name || 'Component';
      }
    } catch {
      // String is not JSON, check for numeric hints or use standard benchmark
      summary = partsUsed.trim();
      const match = partsUsed.match(/cost:?\s*Rs\.?\s*(\d+(\.\d+)?)/i) || partsUsed.match(/(\d+)\s*(npr|rs)/i);
      if (match && match[1]) {
        cost = parseFloat(match[1]);
      }
    }
  } else if (Array.isArray(partsUsed)) {
    partsUsed.forEach((p: any) => {
      const itemCost = Number(p.purchasePrice || p.cost || p.price || 0);
      const qty = Number(p.quantity || 1);
      cost += itemCost * qty;
      summary += summary ? `, ${p.name || 'Part'}` : (p.name || 'Part');
    });
  }

  return { partsCost: Math.round(cost * 100) / 100, partsSummary: summary };
}

// ============================================================================
// 1. GET /api/revenue/overview — Authoritative Financial Overview & Intelligence
// ============================================================================
router.get('/overview', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const currentUser = req.user;
    if (!currentUser) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userRole = normalizeRole(currentUser.role || 'RECEPTIONIST');
    if (!REVENUE_VIEW_ROLES.includes(userRole)) {
      return res.status(403).json({ error: 'Forbidden: Access denied to financial hub.' });
    }

    const timeframe = (req.query.timeframe as string) || 'THIS_MONTH';
    const customStart = req.query.startDate as string;
    const customEnd = req.query.endDate as string;
    const branchFilter = req.query.branchId as string;
    const technicianFilter = req.query.technicianId as string;
    const brandFilter = req.query.deviceBrand as string;
    const statusFilter = req.query.status as string;
    const paymentStatusFilter = req.query.paymentStatus as string;

    const { startDate, endDate, todayStr, currentMonthStr } = getNepalDateRange(timeframe, customStart, customEnd);

    // 1. Fetch All Repairs with full financial and technician details
    let query = supabaseAdmin
      .from('Repair')
      .select(`
        id,
        repairNumber,
        customerId,
        customerName,
        customerPhone,
        customerEmail,
        deviceBrand,
        deviceModel,
        problemDescription,
        status,
        priority,
        estimatedCost,
        advancePaid,
        totalPaid,
        paymentStatus,
        technicianId,
        branchId,
        partsUsed,
        receivingMethod,
        isCourierIn,
        courierInCharge,
        courierInPaymentStatus,
        isCourierOut,
        courierOutCharge,
        courierOutPaymentStatus,
        createdAt,
        updatedAt
      `)
      .order('createdAt', { ascending: false });

    // Branch and role scoping
    if (userRole === 'TECHNICIAN') {
      query = query.eq('technicianId', currentUser.id);
    } else if (technicianFilter && technicianFilter !== 'ALL') {
      query = query.eq('technicianId', technicianFilter);
    }

    if (branchFilter && branchFilter !== 'ALL') {
      query = query.eq('branchId', branchFilter);
    }

    const { data: repairsData, error: repairsErr } = await query;
    if (repairsErr) {
      console.error('[REVENUE REPAIRS QUERY ERROR]', repairsErr);
      return res.status(500).json({ error: 'Failed to retrieve repair financial records' });
    }

    const allRepairs = Array.isArray(repairsData) ? repairsData : [];

    // 2. Fetch Payments Ledger in timeframe if table populated
    const { data: paymentsData } = await supabaseAdmin
      .from('Payment')
      .select('id, repairId, amount, method, reference, createdAt')
      .order('createdAt', { ascending: false });

    const paymentsList = Array.isArray(paymentsData) ? paymentsData : [];

    // 3. Fetch Damage Records for loss calculation
    await initializeDamageStorage();
    const damageResult = await queryDamageRecords({
      includeArchived: false,
      startDate,
      endDate
    });
    const damageRecords = Array.isArray(damageResult) ? damageResult : (damageResult?.records || []);

    // 4. Fetch Users (Staff Directory) for technician names
    const { data: usersData } = await supabaseAdmin
      .from('User')
      .select('id, name, email, role, department')
      .eq('isActive', true);

    const staffMap = new Map<string, any>();
    (usersData || []).forEach(u => staffMap.set(u.id, u));

    // 5. Fetch Inventory Items for parts valuation benchmarking
    const { data: inventoryItems } = await supabaseAdmin
      .from('InventoryItem')
      .select('id, name, brand, model, purchasePrice, sellingPrice, category');

    const inventoryMap = new Map<string, any>();
    (inventoryItems || []).forEach(item => inventoryMap.set(item.id, item));

    // =========================================================================
    // Filter Repairs according to Date Range & Additional Query Filters
    // =========================================================================
    const filteredRepairs = allRepairs.filter((r) => {
      const createdNepalDate = toNepalDate(r.createdAt);
      if (startDate && createdNepalDate < startDate) return false;
      if (endDate && createdNepalDate > endDate) return false;

      if (brandFilter && brandFilter !== 'ALL' && (r.deviceBrand || '').toLowerCase() !== brandFilter.toLowerCase()) {
        return false;
      }
      if (statusFilter && statusFilter !== 'ALL' && r.status !== statusFilter) {
        return false;
      }
      if (paymentStatusFilter && paymentStatusFilter !== 'ALL' && r.paymentStatus !== paymentStatusFilter) {
        return false;
      }
      return true;
    });

    // Damage map by repairId or repairNumber
    const repairDamageMap = new Map<string, number>();
    let totalDamageLoss = 0;
    damageRecords.forEach((d: any) => {
      const cost = Number(d.estimatedCost || 0);
      totalDamageLoss += cost;
      if (d.repairId) {
        repairDamageMap.set(d.repairId, (repairDamageMap.get(d.repairId) || 0) + cost);
      }
      if (d.repairNumber) {
        repairDamageMap.set(d.repairNumber, (repairDamageMap.get(d.repairNumber) || 0) + cost);
      }
    });

    // =========================================================================
    // Aggregation Metrics
    // =========================================================================
    let grossRevenue = 0; // Total actual collected money
    let estimatedBilled = 0; // Total quoted ticket value
    let outstandingReceivables = 0; // Money still owed by customers
    let totalAdvanceCollected = 0;
    let totalSettlementCollected = 0;
    let totalPartsCost = 0;
    let completedRepairsCount = 0;
    let paidRepairsCount = 0;
    let partialRepairsCount = 0;
    let unpaidRepairsCount = 0;
    let courierInTotal = 0;
    let courierOutTotal = 0;

    const brandStatsMap = new Map<string, { brand: string; revenue: number; cost: number; profit: number; count: number }>();
    const categoryStatsMap = new Map<string, { category: string; revenue: number; cost: number; profit: number; count: number }>();
    const technicianStatsMap = new Map<string, { id: string; name: string; role: string; revenue: number; cost: number; profit: number; completedCount: number; activeCount: number }>();
    const dateTrendMap = new Map<string, { date: string; label: string; revenue: number; partsCost: number; damageCost: number; profit: number; count: number }>();

    filteredRepairs.forEach((r) => {
      const paid = Math.max(0, Number(r.totalPaid || 0));
      const est = Math.max(0, Number(r.estimatedCost || 0));
      const adv = Math.max(0, Number(r.advancePaid || 0));
      const status = r.status || 'RECEIVED';
      const isCancelled = status === 'CANCELLED' || status === 'CANNOT_REPAIR';

      grossRevenue += paid;
      estimatedBilled += est;
      totalAdvanceCollected += adv;
      if (paid > adv) {
        totalSettlementCollected += (paid - adv);
      }

      if (!isCancelled && est > paid) {
        outstandingReceivables += (est - paid);
      }

      // Courier revenue
      if (r.isCourierIn && r.courierInPaymentStatus === 'PAID') {
        courierInTotal += Number(r.courierInCharge || 0);
      }
      if (r.isCourierOut && r.courierOutPaymentStatus === 'PAID') {
        courierOutTotal += Number(r.courierOutCharge || 0);
      }

      // Parts Cost Calculation
      const { partsCost } = extractPartsCost(r.partsUsed, est);
      totalPartsCost += partsCost;

      // Status Counters
      if (status === 'DELIVERED' || status === 'READY_FOR_PICKUP' || status === 'REPAIRED') {
        completedRepairsCount++;
      }

      if (paid >= est && est > 0) {
        paidRepairsCount++;
      } else if (paid > 0) {
        partialRepairsCount++;
      } else {
        unpaidRepairsCount++;
      }

      // Brand Stats
      const rawBrand = (r.deviceBrand || 'Other').trim();
      const brandKey = rawBrand ? rawBrand.charAt(0).toUpperCase() + rawBrand.slice(1).toLowerCase() : 'Other';
      const bStat = brandStatsMap.get(brandKey) || { brand: brandKey, revenue: 0, cost: 0, profit: 0, count: 0 };
      bStat.revenue += paid;
      bStat.cost += partsCost;
      bStat.profit += (paid - partsCost);
      bStat.count += 1;
      brandStatsMap.set(brandKey, bStat);

      // Category Stats
      const categoryKey = classifyRepairCategory(r.problemDescription, r.deviceBrand);
      const cStat = categoryStatsMap.get(categoryKey) || { category: categoryKey, revenue: 0, cost: 0, profit: 0, count: 0 };
      cStat.revenue += paid;
      cStat.cost += partsCost;
      cStat.profit += (paid - partsCost);
      cStat.count += 1;
      categoryStatsMap.set(categoryKey, cStat);

      // Technician Stats
      const techId = r.technicianId || 'UNASSIGNED';
      const techUser = staffMap.get(techId);
      const techName = techUser ? techUser.name : (techId === 'UNASSIGNED' ? 'Unassigned' : 'Former Staff');
      const techRole = techUser ? techUser.role : 'STAFF';

      const tStat = technicianStatsMap.get(techId) || {
        id: techId,
        name: techName,
        role: techRole,
        revenue: 0,
        cost: 0,
        profit: 0,
        completedCount: 0,
        activeCount: 0,
      };

      tStat.revenue += paid;
      tStat.cost += partsCost;
      tStat.profit += (paid - partsCost);
      if (status === 'DELIVERED' || status === 'READY_FOR_PICKUP' || status === 'REPAIRED') {
        tStat.completedCount += 1;
      } else if (!isCancelled) {
        tStat.activeCount += 1;
      }
      technicianStatsMap.set(techId, tStat);

      // Time-series Trend aggregation
      const dateKey = toNepalDate(r.createdAt);
      if (dateKey) {
        const dStat = dateTrendMap.get(dateKey) || {
          date: dateKey,
          label: dateKey.slice(5), // MM-DD
          revenue: 0,
          partsCost: 0,
          damageCost: 0,
          profit: 0,
          count: 0,
        };
        dStat.revenue += paid;
        dStat.partsCost += partsCost;
        dStat.profit += (paid - partsCost);
        dStat.count += 1;
        dateTrendMap.set(dateKey, dStat);
      }
    });

    // Populate damage cost into date trends
    damageRecords.forEach((d: any) => {
      const dDate = d.damageDate;
      if (dDate) {
        const dStat = dateTrendMap.get(dDate) || {
          date: dDate,
          label: dDate.slice(5),
          revenue: 0,
          partsCost: 0,
          damageCost: 0,
          profit: 0,
          count: 0,
        };
        const cost = Number(d.estimatedCost || 0);
        dStat.damageCost += cost;
        dStat.profit -= cost;
        dateTrendMap.set(dDate, dStat);
      }
    });

    // Format Trend array sorted chronologically
    const trend = Array.from(dateTrendMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    // If trend is empty or single day, generate date points for visualization
    if (trend.length === 0 && startDate && endDate) {
      trend.push({
        date: startDate,
        label: startDate.slice(5),
        revenue: 0,
        partsCost: 0,
        damageCost: 0,
        profit: 0,
        count: 0,
      });
    }

    // Profit Calculations
    const grossProfit = Math.round((grossRevenue - totalPartsCost - totalDamageLoss) * 100) / 100;
    const operatingExpenses = 0; // extensible for custom overhead
    const netProfit = Math.round((grossProfit - operatingExpenses) * 100) / 100;
    const profitMargin = grossRevenue > 0 ? Math.round(((netProfit / grossRevenue) * 100) * 10) / 10 : 0;
    const averageTicket = filteredRepairs.length > 0 ? Math.round(grossRevenue / filteredRepairs.length) : 0;

    // Convert Breakdown Maps to sorted Arrays
    const categoryBreakdown = Array.from(categoryStatsMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .map((c) => ({
        ...c,
        percentage: grossRevenue > 0 ? Math.round((c.revenue / grossRevenue) * 100) : 0,
        margin: c.revenue > 0 ? Math.round(((c.profit / c.revenue) * 100) * 10) / 10 : 0,
      }));

    const brandBreakdown = Array.from(brandStatsMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .map((b) => ({
        ...b,
        percentage: grossRevenue > 0 ? Math.round((b.revenue / grossRevenue) * 100) : 0,
      }));

    const technicianPerformance = Array.from(technicianStatsMap.values())
      .sort((a, b) => b.revenue - a.revenue);

    // Strategic Insights
    const mostProfitableCategory = categoryBreakdown.length > 0 ? categoryBreakdown[0] : null;
    const lowestProfitCategory = categoryBreakdown.length > 1 ? categoryBreakdown[categoryBreakdown.length - 1] : null;
    const topPerformingTechnician = technicianPerformance.length > 0 ? technicianPerformance[0] : null;

    return res.json({
      success: true,
      timeframe,
      dateRange: { startDate, endDate },
      role: userRole,
      summary: {
        grossRevenue,
        estimatedBilled,
        outstandingReceivables,
        totalAdvanceCollected,
        totalSettlementCollected,
        totalPartsCost,
        totalDamageLoss,
        grossProfit,
        netProfit,
        profitMargin,
        averageTicket,
        totalRepairsCount: filteredRepairs.length,
        completedRepairsCount,
        paidRepairsCount,
        partialRepairsCount,
        unpaidRepairsCount,
        courierInTotal,
        courierOutTotal,
      },
      trend,
      categoryBreakdown,
      brandBreakdown,
      technicianPerformance,
      insights: {
        mostProfitableCategory,
        lowestProfitCategory,
        topPerformingTechnician,
        damageLossImpact: totalDamageLoss,
        partsCostRatio: grossRevenue > 0 ? Math.round((totalPartsCost / grossRevenue) * 100) : 0,
      },
    });
  } catch (err: any) {
    console.error('[REVENUE OVERVIEW ERROR]', err);
    return res.status(500).json({ error: 'Internal financial calculation failure: ' + (err.message || err) });
  }
});

// ============================================================================
// 2. GET /api/revenue/repairs — Granular Repair Profitability Ledger
// ============================================================================
router.get('/repairs', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const currentUser = req.user;
    if (!currentUser) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userRole = normalizeRole(currentUser.role || 'RECEPTIONIST');
    if (!REVENUE_VIEW_ROLES.includes(userRole)) {
      return res.status(403).json({ error: 'Forbidden: Access denied.' });
    }

    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(100, Math.max(5, parseInt((req.query.limit as string) || '20', 10)));
    const search = ((req.query.search as string) || '').trim().toLowerCase();
    const timeframe = (req.query.timeframe as string) || 'ALL';
    const customStart = req.query.startDate as string;
    const customEnd = req.query.endDate as string;
    const statusFilter = req.query.status as string;
    const paymentStatusFilter = req.query.paymentStatus as string;
    const brandFilter = req.query.brand as string;
    const techFilter = req.query.technicianId as string;
    const sortBy = (req.query.sortBy as string) || 'createdAt';
    const sortOrder = (req.query.sortOrder as string) === 'asc' ? 'asc' : 'desc';

    const { startDate, endDate } = getNepalDateRange(timeframe, customStart, customEnd);

    // Query repairs from Supabase
    let query = supabaseAdmin
      .from('Repair')
      .select(`
        id,
        repairNumber,
        customerId,
        customerName,
        customerPhone,
        customerEmail,
        deviceBrand,
        deviceModel,
        problemDescription,
        status,
        priority,
        estimatedCost,
        advancePaid,
        totalPaid,
        paymentStatus,
        technicianId,
        branchId,
        partsUsed,
        receivingMethod,
        isCourierIn,
        courierInCharge,
        courierInPaymentStatus,
        isCourierOut,
        courierOutCharge,
        courierOutPaymentStatus,
        createdAt,
        updatedAt
      `)
      .order('createdAt', { ascending: false });

    if (userRole === 'TECHNICIAN') {
      query = query.eq('technicianId', currentUser.id);
    } else if (techFilter && techFilter !== 'ALL') {
      query = query.eq('technicianId', techFilter);
    }

    const { data: repairsData, error } = await query;
    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const rawList = Array.isArray(repairsData) ? repairsData : [];

    // Fetch Staff Directory for names
    const { data: usersData } = await supabaseAdmin
      .from('User')
      .select('id, name, email, role');
    const staffMap = new Map<string, any>();
    (usersData || []).forEach((u) => staffMap.set(u.id, u));

    // Fetch Damage Records for repair-level damage deduction
    await initializeDamageStorage();
    const damageResult = await queryDamageRecords({ includeArchived: false });
    const damageRecords = Array.isArray(damageResult) ? damageResult : (damageResult?.records || []);
    const damageByRepair = new Map<string, number>();
    damageRecords.forEach((d: any) => {
      const cost = Number(d.estimatedCost || 0);
      if (d.repairId) damageByRepair.set(d.repairId, (damageByRepair.get(d.repairId) || 0) + cost);
      if (d.repairNumber) damageByRepair.set(d.repairNumber, (damageByRepair.get(d.repairNumber) || 0) + cost);
    });

    // Transform and calculate repair-level profitability
    let enrichedList = rawList.map((r) => {
      const paid = Math.max(0, Number(r.totalPaid || 0));
      const est = Math.max(0, Number(r.estimatedCost || 0));
      const adv = Math.max(0, Number(r.advancePaid || 0));
      const balanceDue = Math.max(0, est - paid);
      const { partsCost, partsSummary } = extractPartsCost(r.partsUsed, est);
      const damageCost = damageByRepair.get(r.id) || damageByRepair.get(r.repairNumber) || 0;
      const totalDirectCost = partsCost + damageCost;
      const grossProfit = Math.round((paid - totalDirectCost) * 100) / 100;
      const profitMargin = paid > 0 ? Math.round(((grossProfit / paid) * 100) * 10) / 10 : 0;
      const technician = r.technicianId ? staffMap.get(r.technicianId)?.name || 'Former Staff' : 'Unassigned';

      return {
        id: r.id,
        repairNumber: r.repairNumber,
        customerId: r.customerId,
        customerName: r.customerName,
        customerPhone: r.customerPhone,
        customerEmail: r.customerEmail,
        deviceBrand: r.deviceBrand,
        deviceModel: r.deviceModel,
        problemDescription: r.problemDescription,
        category: classifyRepairCategory(r.problemDescription, r.deviceBrand),
        status: r.status,
        priority: r.priority,
        technicianId: r.technicianId,
        technicianName: technician,
        estimatedCost: est,
        advancePaid: adv,
        totalPaid: paid,
        balanceDue,
        paymentStatus: r.paymentStatus || (paid >= est && est > 0 ? 'PAID' : (paid > 0 ? 'PARTIAL' : 'UNPAID')),
        partsUsed: r.partsUsed,
        partsSummary,
        partsCost,
        damageCost,
        totalDirectCost,
        grossProfit,
        profitMargin,
        receivingMethod: r.receivingMethod,
        isCourierIn: r.isCourierIn,
        courierInCharge: r.courierInCharge,
        courierInPaymentStatus: r.courierInPaymentStatus,
        isCourierOut: r.isCourierOut,
        courierOutCharge: r.courierOutCharge,
        courierOutPaymentStatus: r.courierOutPaymentStatus,
        createdAt: r.createdAt,
        nepalDate: toNepalDate(r.createdAt),
      };
    });

    // Apply In-Memory Filtering
    enrichedList = enrichedList.filter((item) => {
      if (timeframe !== 'ALL') {
        if (startDate && item.nepalDate < startDate) return false;
        if (endDate && item.nepalDate > endDate) return false;
      }
      if (statusFilter && statusFilter !== 'ALL' && item.status !== statusFilter) {
        return false;
      }
      if (paymentStatusFilter && paymentStatusFilter !== 'ALL' && item.paymentStatus !== paymentStatusFilter) {
        return false;
      }
      if (brandFilter && brandFilter !== 'ALL' && (item.deviceBrand || '').toLowerCase() !== brandFilter.toLowerCase()) {
        return false;
      }
      if (search) {
        const matchSearch =
          (item.repairNumber || '').toLowerCase().includes(search) ||
          (item.customerName || '').toLowerCase().includes(search) ||
          (item.customerPhone || '').toLowerCase().includes(search) ||
          (item.deviceBrand || '').toLowerCase().includes(search) ||
          (item.deviceModel || '').toLowerCase().includes(search) ||
          (item.problemDescription || '').toLowerCase().includes(search) ||
          (item.technicianName || '').toLowerCase().includes(search);
        if (!matchSearch) return false;
      }
      return true;
    });

    // Sort
    enrichedList.sort((a: any, b: any) => {
      let valA = a[sortBy];
      let valB = b[sortBy];
      if (typeof valA === 'string') {
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      valA = Number(valA || 0);
      valB = Number(valB || 0);
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });

    const totalCount = enrichedList.length;
    const startIndex = (page - 1) * limit;
    const paginatedList = enrichedList.slice(startIndex, startIndex + limit);

    // Summary of this filtered slice
    const totalFilteredRevenue = enrichedList.reduce((sum, item) => sum + item.totalPaid, 0);
    const totalFilteredProfit = enrichedList.reduce((sum, item) => sum + item.grossProfit, 0);
    const totalFilteredReceivables = enrichedList.reduce((sum, item) => sum + item.balanceDue, 0);

    return res.json({
      success: true,
      repairs: paginatedList,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit) || 1,
      },
      sliceSummary: {
        totalFilteredRevenue,
        totalFilteredProfit,
        totalFilteredReceivables,
      },
    });
  } catch (err: any) {
    console.error('[REVENUE REPAIRS ERROR]', err);
    return res.status(500).json({ error: 'Failed to retrieve repair profitability ledger.' });
  }
});

// ============================================================================
// 3. POST /api/revenue/payments — Record Repair Payment or Settlement
// ============================================================================
router.post('/payments', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const currentUser = req.user;
    if (!currentUser) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { repairId, amount, method, reference, notes, type } = req.body;

    if (!repairId) {
      return res.status(400).json({ error: 'Repair ID is required.' });
    }

    const payAmount = parseFloat(amount);
    if (isNaN(payAmount) || payAmount <= 0) {
      return res.status(400).json({ error: 'Payment amount must be a positive number.' });
    }

    // 1. Fetch current repair
    const { data: repair, error: fetchErr } = await supabaseAdmin
      .from('Repair')
      .select('*')
      .eq('id', repairId)
      .single();

    if (fetchErr || !repair) {
      return res.status(404).json({ error: 'Repair record not found.' });
    }

    const currentTotalPaid = Number(repair.totalPaid || 0);
    const currentEstCost = Number(repair.estimatedCost || 0);
    const newTotalPaid = Math.round((currentTotalPaid + payAmount) * 100) / 100;
    const newPaymentStatus = newTotalPaid >= currentEstCost && currentEstCost > 0 ? 'PAID' : (newTotalPaid > 0 ? 'PARTIAL' : 'UNPAID');

    // 2. Insert into Payment table
    const paymentId = uuidv4();
    const { error: payInsertErr } = await supabaseAdmin
      .from('Payment')
      .insert({
        id: paymentId,
        repairId,
        amount: payAmount,
        method: method || 'CASH',
        reference: reference || null,
        createdAt: new Date().toISOString(),
      });

    if (payInsertErr) {
      console.warn('[PAYMENT INSERT WARN]', payInsertErr);
    }

    // 3. Update Repair table
    const updatePayload: any = {
      totalPaid: newTotalPaid,
      paymentStatus: newPaymentStatus,
      updatedAt: new Date().toISOString(),
    };

    if (type === 'ADVANCE' && Number(repair.advancePaid || 0) === 0) {
      updatePayload.advancePaid = payAmount;
    }

    const { error: repairUpdateErr } = await supabaseAdmin
      .from('Repair')
      .update(updatePayload)
      .eq('id', repairId);

    if (repairUpdateErr) {
      return res.status(500).json({ error: 'Failed to update repair payment status: ' + repairUpdateErr.message });
    }

    // 4. Audit Log
    await logAudit({
      userId: currentUser.id,
      action: 'PAYMENT_RECORDED',
      resource: 'Repair',
      resourceId: repairId,
      details: {
        repairNumber: repair.repairNumber,
        customerName: repair.customerName,
        paymentAmount: payAmount,
        previousTotalPaid: currentTotalPaid,
        newTotalPaid,
        method: method || 'CASH',
        paymentStatus: newPaymentStatus,
      },
    });

    // 5. Broadcast real-time change
    broadcastServerChange('repair', 'UPDATE', repairId, {
      totalPaid: newTotalPaid,
      paymentStatus: newPaymentStatus,
    });

    return res.json({
      success: true,
      message: `Payment of Rs. ${payAmount.toLocaleString()} recorded successfully for ${repair.repairNumber}.`,
      payment: {
        id: paymentId,
        repairId,
        amount: payAmount,
        method: method || 'CASH',
        newTotalPaid,
        paymentStatus: newPaymentStatus,
      },
    });
  } catch (err: any) {
    console.error('[RECORD PAYMENT ERROR]', err);
    return res.status(500).json({ error: 'Failed to record payment.' });
  }
});

// ============================================================================
// 4. GET /api/revenue/transactions — Financial Transaction Journal
// ============================================================================
router.get('/transactions', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const currentUser = req.user;
    if (!currentUser) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userRole = normalizeRole(currentUser.role || 'RECEPTIONIST');
    if (!REVENUE_VIEW_ROLES.includes(userRole)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Fetch payments and recent repairs
    const { data: payments } = await supabaseAdmin
      .from('Payment')
      .select('*')
      .order('createdAt', { ascending: false })
      .limit(200);

    const { data: repairs } = await supabaseAdmin
      .from('Repair')
      .select('id, repairNumber, customerName, customerPhone, deviceBrand, deviceModel, totalPaid, advancePaid, estimatedCost, paymentStatus, createdAt, createdById')
      .order('createdAt', { ascending: false })
      .limit(200);

    const repairMap = new Map<string, any>();
    (repairs || []).forEach(r => repairMap.set(r.id, r));

    // Construct unified ledger
    const ledger: any[] = [];

    // Payments
    (payments || []).forEach(p => {
      const rep = repairMap.get(p.repairId);
      ledger.push({
        id: p.id,
        date: p.createdAt,
        nepalDate: toNepalDate(p.createdAt),
        type: 'PAYMENT_RECEIVED',
        repairNumber: rep ? rep.repairNumber : 'REPAIR-DIRECT',
        customerName: rep ? rep.customerName : 'Walk-in Customer',
        customerPhone: rep ? rep.customerPhone : '',
        description: `Customer payment for ${rep ? `${rep.deviceBrand} ${rep.deviceModel}` : 'Repair Service'}`,
        amount: Number(p.amount || 0),
        method: p.method || 'CASH',
        reference: p.reference || 'N/A',
        status: 'COMPLETED',
      });
    });

    // If explicit Payment rows are few, add repair advance / intake transactions to complete ledger
    (repairs || []).forEach(r => {
      if (Number(r.totalPaid || 0) > 0 && !ledger.some(l => l.repairNumber === r.repairNumber)) {
        ledger.push({
          id: `tx-${r.id}`,
          date: r.createdAt,
          nepalDate: toNepalDate(r.createdAt),
          type: 'INTAKE_COLLECTION',
          repairNumber: r.repairNumber,
          customerName: r.customerName,
          customerPhone: r.customerPhone,
          description: `Repair collection for ${r.deviceBrand} ${r.deviceModel}`,
          amount: Number(r.totalPaid || 0),
          method: 'CASH / DIRECT',
          reference: r.repairNumber,
          status: 'COMPLETED',
        });
      }
    });

    ledger.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return res.json({
      success: true,
      transactions: ledger,
      count: ledger.length,
    });
  } catch (err: any) {
    console.error('[TRANSACTIONS ERROR]', err);
    return res.status(500).json({ error: 'Failed to retrieve transaction journal.' });
  }
});

export default router;
