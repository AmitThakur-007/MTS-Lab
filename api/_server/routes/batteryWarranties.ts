import { Router, Request, Response } from 'express';
import { broadcastServerChange } from '../services/realtimeSync';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { createExcelBuffer, parseExcelBuffer } from '../services/excelService';
import { sendEmail } from '../services/emailService';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// In-memory OTP store for 2FA deletion (expires in 5 minutes)
const otpStore: { [userId: string]: { code: string; expiresAt: number } } = {};

/**
 * Parses warranty period into months (6, 12, 24, etc.)
 */
export function parseWarrantyDurationMonths(periodStr: any): number {
  if (!periodStr) return 6;
  const str = String(periodStr).toUpperCase().trim();
  if (str.includes('24') || str.includes('2_YEAR') || str.includes('2 YEAR') || str.includes('2YEAR') || str.includes('2_Y') || str === '2Y' || str === '2 YEARS') {
    return 24;
  }
  if (str.includes('12') || str.includes('1_YEAR') || str.includes('1 YEAR') || str.includes('1YEAR') || str.includes('1_Y') || str === '1Y' || str === '1 YEAR') {
    return 12;
  }
  if (str.includes('3')) return 3;
  if (str.includes('6')) return 6;
  const num = parseInt(str, 10);
  return !isNaN(num) && num > 0 ? num : 6;
}

/**
 * Formats duration label cleanly
 */
export function formatWarrantyPeriodLabel(months: number): string {
  if (months === 24) return '2 Years';
  if (months === 12) return '1 Year';
  return `${months} Months`;
}

/**
 * Calculates authoritative Nepal (NPT / UTC+05:45) calendar dates & date ranges
 */
export function getAuthoritativeNepalDates() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kathmandu',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const todayStr = formatter.format(now); // "YYYY-MM-DD"
  const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = formatter.format(yesterdayDate); // "YYYY-MM-DD"

  return { todayStr, yesterdayStr, now };
}

/**
 * Converts a Nepal date string (YYYY-MM-DD) or UTC timestamp to Nepal date string
 */
export function toNepalDateString(isoOrDate: string | Date | null | undefined): string {
  if (!isoOrDate) return '';
  try {
    const d = new Date(isoOrDate);
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
 * Calculates expiry date based on registration date and duration in months
 */
export function calculateWarrantyExpiry(startDate: Date | string, months: number): Date {
  const d = new Date(startDate || Date.now());
  if (isNaN(d.getTime())) return new Date();
  if (months === 24) {
    d.setFullYear(d.getFullYear() + 2);
  } else if (months === 12) {
    d.setFullYear(d.getFullYear() + 1);
  } else {
    d.setMonth(d.getMonth() + months);
  }
  return d;
}

// Helper to generate next unique warranty number (BW-YYYY-XXXX)
async function generateWarrantyNumber(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const { data: records } = await supabaseAdmin
    .from('BatteryWarranty')
    .select('warrantyNumber')
    .ilike('warrantyNumber', `BW-${currentYear}-%`)
    .order('warrantyNumber', { ascending: false })
    .limit(10);

  let maxNum = 0;
  if (records && records.length > 0) {
    for (const r of records) {
      if (!r.warrantyNumber) continue;
      const match = r.warrantyNumber.match(/(\d+)$/);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    }
  }

  const nextNum = maxNum + 1;
  return `BW-${currentYear}-${nextNum.toString().padStart(4, '0')}`;
}

// Helper to generate claim number (BWC-YYYY-XXXX)
async function generateClaimNumber(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const { data: records } = await supabaseAdmin
    .from('BatteryWarrantyClaim')
    .select('claimNumber')
    .ilike('claimNumber', `BWC-${currentYear}-%`)
    .order('claimNumber', { ascending: false })
    .limit(10);

  let maxNum = 0;
  if (records && records.length > 0) {
    for (const r of records) {
      if (!r.claimNumber) continue;
      const match = r.claimNumber.match(/(\d+)$/);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    }
  }

  const nextNum = maxNum + 1;
  return `BWC-${currentYear}-${nextNum.toString().padStart(4, '0')}`;
}

// 1. GET /api/battery-warranties — List with date filters, search, metrics summary
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const {
      status,
      brand,
      period,
      search,
      dateFilter,
      datePreset,
      startDate,
      endDate,
    } = req.query;

    const { todayStr, yesterdayStr } = getAuthoritativeNepalDates();
    const activeDateFilter = String(dateFilter || datePreset || 'ALL').toUpperCase();

    // 1. Fetch all warranty records
    const { data: rawWarranties, error } = await supabaseAdmin
      .from('BatteryWarranty')
      .select('*')
      .order('createdAt', { ascending: false });

    if (error) {
      console.error('[BATTERY WARRANTIES ERROR]', error);
      return res.status(500).json({ error: error.message || 'Failed to fetch battery warranties.' });
    }

    // 2. Fetch repairs & customer details to verify warranty validity and enrich address/status
    const { data: allRepairs } = await supabaseAdmin
      .from('Repair')
      .select('id, repairNumber, customerId, customerName, customerPhone, customerAddress, customerEmail, status, hasBatteryWarranty, batteryWarrantyPeriod, batteryType, createdAt');

    const repairMap = new Map<string, any>();
    const repairWarrantyMap = new Map<string, boolean>();
    (allRepairs || []).forEach((r: any) => {
      repairMap.set(r.id, r);
      repairWarrantyMap.set(r.id, r.hasBatteryWarranty === true || r.hasBatteryWarranty === 'true');
    });

    // 3. Fetch all claims
    const { data: allClaims } = await supabaseAdmin
      .from('BatteryWarrantyClaim')
      .select('*')
      .order('claimDate', { ascending: false });

    const claimsByWarrantyId = new Map<string, any[]>();
    (allClaims || []).forEach((c: any) => {
      const list = claimsByWarrantyId.get(c.warrantyId) || [];
      list.push(c);
      claimsByWarrantyId.set(c.warrantyId, list);
    });

    // 4. Filter only valid warranties (exclude any orphaned repair warranties where hasBatteryWarranty was turned off)
    const validWarranties = (rawWarranties || []).filter((w: any) => {
      if (w.repairId) {
        // If linked to a repair, check if repair hasBatteryWarranty is true
        return repairWarrantyMap.get(w.repairId) !== false;
      }
      return true;
    });

    // 5. Enrich warranty items
    const nowMs = Date.now();
    const enrichedList = validWarranties.map((w: any) => {
      const linkedRepair = w.repairId ? repairMap.get(w.repairId) : null;
      const claims = claimsByWarrantyId.get(w.id) || [];
      const expMs = w.expiryDate ? new Date(w.expiryDate).getTime() : 0;
      const daysRemaining = expMs ? Math.ceil((expMs - nowMs) / (1000 * 60 * 60 * 24)) : 0;
      
      const months = parseWarrantyDurationMonths(w.warrantyPeriod);
      const periodLabel = formatWarrantyPeriodLabel(months);

      // Determine accurate real-time computed status
      let calculatedStatus = (w.status || 'ACTIVE').toUpperCase();
      if (calculatedStatus === 'ACTIVE') {
        if (daysRemaining < 0) {
          calculatedStatus = 'EXPIRED';
        } else if (daysRemaining <= 30) {
          calculatedStatus = 'EXPIRING_SOON';
        }
      }

      const nepalRegDate = toNepalDateString(w.registrationDate || w.createdAt);

      return {
        ...w,
        customerAddress: w.customerAddress || linkedRepair?.customerAddress || null,
        customerEmail: w.customerEmail || linkedRepair?.customerEmail || null,
        repairStatus: linkedRepair?.status || null,
        warrantyPeriodMonths: months,
        warrantyPeriodLabel: periodLabel,
        daysRemaining,
        calculatedStatus,
        nepalRegDate,
        claims,
        claimCount: claims.length || w.claimCount || 0,
      };
    });

    // 6. Compute Full Summary Metrics across ALL valid warranties
    const summary = {
      total: enrichedList.length,
      today: enrichedList.filter((w) => w.nepalRegDate === todayStr).length,
      yesterday: enrichedList.filter((w) => w.nepalRegDate === yesterdayStr).length,
      active: enrichedList.filter((w) => w.daysRemaining >= 0 && (w.status || '').toUpperCase() === 'ACTIVE').length,
      expiringSoon: enrichedList.filter((w) => w.daysRemaining >= 0 && w.daysRemaining <= 30 && (w.status || '').toUpperCase() === 'ACTIVE').length,
      expired: enrichedList.filter((w) => w.daysRemaining < 0 || (w.status || '').toUpperCase() === 'EXPIRED').length,
      claims: (allClaims || []).length,
      twoYears: enrichedList.filter((w) => w.warrantyPeriodMonths === 24).length,
      oneYear: enrichedList.filter((w) => w.warrantyPeriodMonths === 12).length,
      sixMonths: enrichedList.filter((w) => w.warrantyPeriodMonths === 6).length,
      todayNepalStr: todayStr,
      yesterdayNepalStr: yesterdayStr,
    };

    // 7. Apply Filters to dataset
    let filtered = [...enrichedList];

    // Date Filter (Today, Yesterday, Custom Range, All)
    if (activeDateFilter === 'TODAY') {
      filtered = filtered.filter((w) => w.nepalRegDate === todayStr);
    } else if (activeDateFilter === 'YESTERDAY') {
      filtered = filtered.filter((w) => w.nepalRegDate === yesterdayStr);
    } else if (activeDateFilter === 'CUSTOM' || (startDate && endDate)) {
      const sDateStr = startDate ? String(startDate).slice(0, 10) : '';
      const eDateStr = endDate ? String(endDate).slice(0, 10) : sDateStr;
      if (sDateStr) {
        filtered = filtered.filter((w) => {
          const itemDate = w.nepalRegDate;
          if (!itemDate) return false;
          if (eDateStr) {
            return itemDate >= sDateStr && itemDate <= eDateStr;
          }
          return itemDate >= sDateStr;
        });
      }
    }

    // Status filter
    if (status && status !== 'ALL') {
      const targetStatus = String(status).toUpperCase();
      if (targetStatus === 'ACTIVE') {
        filtered = filtered.filter((w) => w.daysRemaining >= 0 && (w.status || '').toUpperCase() === 'ACTIVE');
      } else if (targetStatus === 'EXPIRING_SOON') {
        filtered = filtered.filter((w) => w.daysRemaining >= 0 && w.daysRemaining <= 30 && (w.status || '').toUpperCase() === 'ACTIVE');
      } else if (targetStatus === 'EXPIRED') {
        filtered = filtered.filter((w) => w.daysRemaining < 0 || (w.status || '').toUpperCase() === 'EXPIRED');
      } else if (targetStatus === 'CLAIMED') {
        filtered = filtered.filter((w) => (w.claims && w.claims.length > 0) || w.claimCount > 0 || w.status === 'CLAIMED');
      } else if (targetStatus === 'REPLACED') {
        filtered = filtered.filter((w) => (w.status || '').toUpperCase() === 'REPLACED');
      } else {
        filtered = filtered.filter((w) => (w.status || '').toUpperCase() === targetStatus);
      }
    }

    // Duration / Period Filter
    if (period && period !== 'ALL') {
      const targetMonths = parseWarrantyDurationMonths(period);
      filtered = filtered.filter((w) => w.warrantyPeriodMonths === targetMonths);
    }

    // Device Brand filter
    if (brand && brand !== 'ALL') {
      filtered = filtered.filter((w) => (w.deviceBrand || '').toUpperCase() === String(brand).toUpperCase());
    }

    // Search query across customer name, phone, address, device, repair number, warranty number, IMEI
    if (search) {
      const q = String(search).trim().toLowerCase();
      filtered = filtered.filter((w) => {
        const wNum = (w.warrantyNumber || '').toLowerCase();
        const rNum = (w.repairNumber || '').toLowerCase();
        const cName = (w.customerName || '').toLowerCase();
        const cPhone = (w.customerPhone || '').toLowerCase();
        const cAddr = (w.customerAddress || '').toLowerCase();
        const cEmail = (w.customerEmail || '').toLowerCase();
        const dModel = (w.deviceModel || '').toLowerCase();
        const dBrand = (w.deviceBrand || '').toLowerCase();
        const imei = (w.imeiNumber || '').toLowerCase();
        const bType = (w.batteryType || '').toLowerCase();

        return (
          wNum.includes(q) ||
          rNum.includes(q) ||
          cName.includes(q) ||
          cPhone.includes(q) ||
          cAddr.includes(q) ||
          cEmail.includes(q) ||
          dModel.includes(q) ||
          dBrand.includes(q) ||
          imei.includes(q) ||
          bType.includes(q)
        );
      });
    }

    // Return unified response
    return res.json({
      success: true,
      data: filtered,
      warranties: filtered,
      summary,
      total: enrichedList.length,
      filteredCount: filtered.length,
      todayCount: summary.today,
      yesterdayCount: summary.yesterday,
    });
  } catch (err: any) {
    console.error('[BATTERY WARRANTIES EXCEPTION]', err);
    return res.status(500).json({ error: 'Failed to load warranties.' });
  }
});

// 2. GET /api/battery-warranties/export — Export filtered warranty records to Excel
router.get('/export', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const {
      status,
      period,
      search,
      dateFilter,
      datePreset,
      startDate,
      endDate,
    } = req.query;

    const { todayStr, yesterdayStr } = getAuthoritativeNepalDates();
    const activeDateFilter = String(dateFilter || datePreset || 'ALL').toUpperCase();

    const { data: rawWarranties } = await supabaseAdmin
      .from('BatteryWarranty')
      .select('*')
      .order('createdAt', { ascending: false });

    const { data: allRepairs } = await supabaseAdmin
      .from('Repair')
      .select('id, customerAddress, customerEmail, hasBatteryWarranty');

    const repairMap = new Map<string, any>();
    const repairWarrantyMap = new Map<string, boolean>();
    (allRepairs || []).forEach((r: any) => {
      repairMap.set(r.id, r);
      repairWarrantyMap.set(r.id, r.hasBatteryWarranty === true || r.hasBatteryWarranty === 'true');
    });

    const validWarranties = (rawWarranties || []).filter((w: any) => {
      if (w.repairId) {
        return repairWarrantyMap.get(w.repairId) !== false;
      }
      return true;
    });

    let filtered = validWarranties.map((w: any) => {
      const linked = w.repairId ? repairMap.get(w.repairId) : null;
      const months = parseWarrantyDurationMonths(w.warrantyPeriod);
      const nepalRegDate = toNepalDateString(w.registrationDate || w.createdAt);
      return {
        ...w,
        customerAddress: w.customerAddress || linked?.customerAddress || '',
        customerEmail: w.customerEmail || linked?.customerEmail || '',
        warrantyPeriodMonths: months,
        warrantyPeriodLabel: formatWarrantyPeriodLabel(months),
        nepalRegDate,
      };
    });

    // Apply date filters
    if (activeDateFilter === 'TODAY') {
      filtered = filtered.filter((w) => w.nepalRegDate === todayStr);
    } else if (activeDateFilter === 'YESTERDAY') {
      filtered = filtered.filter((w) => w.nepalRegDate === yesterdayStr);
    } else if (activeDateFilter === 'CUSTOM' || (startDate && endDate)) {
      const sDateStr = startDate ? String(startDate).slice(0, 10) : '';
      const eDateStr = endDate ? String(endDate).slice(0, 10) : sDateStr;
      if (sDateStr) {
        filtered = filtered.filter((w) => {
          const itemDate = w.nepalRegDate;
          if (!itemDate) return false;
          if (eDateStr) return itemDate >= sDateStr && itemDate <= eDateStr;
          return itemDate >= sDateStr;
        });
      }
    }

    if (status && status !== 'ALL') {
      filtered = filtered.filter((w) => (w.status || '').toUpperCase() === String(status).toUpperCase());
    }

    if (period && period !== 'ALL') {
      const targetMonths = parseWarrantyDurationMonths(period);
      filtered = filtered.filter((w) => w.warrantyPeriodMonths === targetMonths);
    }

    if (search) {
      const q = String(search).trim().toLowerCase();
      filtered = filtered.filter((w) => {
        return (
          (w.warrantyNumber || '').toLowerCase().includes(q) ||
          (w.repairNumber || '').toLowerCase().includes(q) ||
          (w.customerName || '').toLowerCase().includes(q) ||
          (w.customerPhone || '').toLowerCase().includes(q) ||
          (w.deviceModel || '').toLowerCase().includes(q)
        );
      });
    }

    const rows = filtered.map((w: any) => ({
      'Warranty Number': w.warrantyNumber,
      'Repair Number': w.repairNumber || '—',
      'Customer Name': w.customerName,
      'Customer Phone': w.customerPhone,
      'Customer Address': w.customerAddress || '—',
      'Customer Email': w.customerEmail || '—',
      'Device Brand': w.deviceBrand,
      'Device Model': w.deviceModel,
      'IMEI Number': w.imeiNumber || '—',
      'Battery Type': w.batteryType || 'Original OEM',
      'Warranty Duration': w.warrantyPeriodLabel,
      'Registration Date': w.registrationDate ? new Date(w.registrationDate).toISOString().split('T')[0] : '',
      'Expiry Date': w.expiryDate ? new Date(w.expiryDate).toISOString().split('T')[0] : '',
      'Status': w.status,
      'Claims Count': w.claimCount || 0,
    }));

    const buffer = createExcelBuffer('Battery Warranties', rows);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="MTS_Battery_Warranties_${new Date().toISOString().split('T')[0]}.xlsx"`);
    return res.send(buffer);
  } catch (err: any) {
    console.error('[EXPORT BATTERY WARRANTIES ERROR]', err);
    return res.status(500).json({ error: 'Failed to export battery warranties.' });
  }
});

// 3. GET /api/battery-warranties/import/template — Download template with 6M, 1Y, 2Y samples
router.get('/import/template', authenticate, (req: Request, res: Response) => {
  const sample = [
    {
      'Customer Name': 'Hari Sharma',
      'Customer Phone': '9801234567',
      'Customer Email': 'hari@example.com',
      'Customer Address': 'Patan, Lalitpur',
      'Device Brand': 'Apple',
      'Device Model': 'iPhone 13 Pro',
      'IMEI Number': '356891029384756',
      'Battery Type': 'Original High Capacity 3095mAh',
      'Warranty Duration': '2 Years',
    },
    {
      'Customer Name': 'Sita Shrestha',
      'Customer Phone': '9841234567',
      'Customer Email': 'sita@example.com',
      'Customer Address': 'New Road, Kathmandu',
      'Device Brand': 'Samsung',
      'Device Model': 'Galaxy S22 Ultra',
      'IMEI Number': '359812039485761',
      'Battery Type': 'Original 5000mAh Replacement Battery',
      'Warranty Duration': '1 Year',
    },
    {
      'Customer Name': 'Bikram Thapa',
      'Customer Phone': '9861928374',
      'Customer Email': '',
      'Customer Address': 'Pokhara, Kaski',
      'Device Brand': 'Xiaomi',
      'Device Model': 'Redmi Note 12',
      'IMEI Number': '',
      'Battery Type': 'Standard Replacement Battery',
      'Warranty Duration': '6 Months',
    },
  ];

  const buffer = createExcelBuffer('Warranty Template', sample);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="MTS_Lab_Battery_Warranty_Template.xlsx"');
  return res.send(buffer);
});

// 4. POST /api/battery-warranties/import/preview — Validate excel file rows
router.post('/import/preview', authenticate, upload.single('file') as any, (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No Excel file provided.' });
    const rows = parseExcelBuffer(req.file.buffer);

    const parsed = rows.map((r, idx) => {
      const rawMonths = r['Warranty Duration'] || r['Warranty Months'] || r['warrantyPeriod'] || r['warrantyMonths'] || '6 Months';
      const months = parseWarrantyDurationMonths(rawMonths);
      const periodLabel = formatWarrantyPeriodLabel(months);

      const customerName = (r['Customer Name'] || r['customerName'] || '').trim();
      const customerPhone = (r['Customer Phone'] || r['customerPhone'] || '').toString().trim();
      const deviceModel = (r['Device Model'] || r['deviceModel'] || '').trim();

      const regDate = new Date();
      const expDate = calculateWarrantyExpiry(regDate, months);

      const isValid = Boolean(customerName && customerPhone && deviceModel);

      return {
        rowIndex: idx + 1,
        rowNumber: idx + 1,
        customerName,
        customerPhone,
        customerEmail: (r['Customer Email'] || r['customerEmail'] || '').trim(),
        customerAddress: (r['Customer Address'] || r['customerAddress'] || '').trim(),
        deviceBrand: (r['Device Brand'] || r['deviceBrand'] || 'Apple').trim(),
        deviceModel,
        imeiNumber: (r['IMEI Number'] || r['imeiNumber'] || '').toString().trim(),
        batteryType: (r['Battery Type'] || r['batteryType'] || 'Original Replacement Battery').trim(),
        warrantyPeriod: periodLabel,
        warrantyPeriodMonths: months,
        registrationDate: regDate.toISOString(),
        expiryDate: expDate.toISOString(),
        status: isValid ? 'VALID' : 'INVALID',
        isValid,
        errors: !isValid ? ['Customer name, valid phone, and device model are mandatory.'] : [],
        warnings: [],
        data: {
          customerName,
          customerPhone,
          customerEmail: (r['Customer Email'] || r['customerEmail'] || '').trim(),
          customerAddress: (r['Customer Address'] || r['customerAddress'] || '').trim(),
          deviceBrand: (r['Device Brand'] || r['deviceBrand'] || 'Apple').trim(),
          deviceModel,
          imeiNumber: (r['IMEI Number'] || r['imeiNumber'] || '').toString().trim(),
          batteryType: (r['Battery Type'] || r['batteryType'] || 'Original Replacement Battery').trim(),
          warrantyPeriod: periodLabel,
          registrationDate: regDate.toISOString(),
          expiryDate: expDate.toISOString(),
        },
      };
    });

    return res.json({
      totalRows: parsed.length,
      validRows: parsed.filter((p) => p.isValid).length,
      invalidRows: parsed.filter((p) => !p.isValid).length,
      duplicateRows: 0,
      preview: parsed,
      items: parsed,
    });
  } catch (err: any) {
    console.error('[IMPORT PREVIEW ERROR]', err);
    return res.status(400).json({ error: 'Failed to parse Excel file.' });
  }
});

// 5. POST /api/battery-warranties/import/confirm — Batch commit imported warranties
router.post('/import/confirm', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items to import.' });
    }

    const imported = [];
    for (const rawItem of items) {
      const item = rawItem.data || rawItem;
      if (!item.customerName || !item.customerPhone || !item.deviceModel) continue;

      const months = parseWarrantyDurationMonths(item.warrantyPeriod || item.warrantyPeriodMonths);
      const periodLabel = formatWarrantyPeriodLabel(months);

      const warrantyNumber = await generateWarrantyNumber();
      const regDate = new Date();
      const expDate = calculateWarrantyExpiry(regDate, months);

      const newWarranty = {
        id: uuidv4(),
        warrantyNumber,
        customerName: item.customerName.trim(),
        customerPhone: item.customerPhone.trim(),
        customerEmail: item.customerEmail ? item.customerEmail.trim() : null,
        customerAddress: item.customerAddress ? item.customerAddress.trim() : null,
        deviceBrand: item.deviceBrand || 'Apple',
        deviceModel: item.deviceModel.trim(),
        imeiNumber: item.imeiNumber ? String(item.imeiNumber).trim() : null,
        batteryType: item.batteryType || 'Original Replacement Battery',
        warrantyPeriod: periodLabel,
        registrationDate: regDate.toISOString(),
        expiryDate: expDate.toISOString(),
        status: 'ACTIVE',
        claimCount: 0,
        createdById: req.user!.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const { data: created, error } = await supabaseAdmin.from('BatteryWarranty').insert([newWarranty]).select('*').single();
      if (created && !error) {
        imported.push(created);
        await broadcastServerChange('BatteryWarranty', 'CREATE', created.id, created);
      }
    }

    return res.json({ success: true, count: imported.length, message: `Successfully imported ${imported.length} warranties.` });
  } catch (err: any) {
    console.error('[IMPORT CONFIRM EXCEPTION]', err);
    return res.status(500).json({ error: 'Failed to commit warranty import.' });
  }
});

// 6. GET /api/battery-warranties/:id — Fetch single warranty with claims & linked repair
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { data: warranty, error } = await supabaseAdmin
      .from('BatteryWarranty')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !warranty) {
      return res.status(404).json({ error: 'Battery warranty not found.' });
    }

    const { data: claims } = await supabaseAdmin
      .from('BatteryWarrantyClaim')
      .select('*')
      .eq('warrantyId', id)
      .order('claimDate', { ascending: false });

    let linkedRepair = null;
    if (warranty.repairId) {
      const { data: r } = await supabaseAdmin.from('Repair').select('*').eq('id', warranty.repairId).single();
      linkedRepair = r;
    }

    const months = parseWarrantyDurationMonths(warranty.warrantyPeriod);

    return res.json({
      ...warranty,
      warrantyPeriodMonths: months,
      warrantyPeriodLabel: formatWarrantyPeriodLabel(months),
      customerAddress: warranty.customerAddress || linkedRepair?.customerAddress || null,
      customerEmail: warranty.customerEmail || linkedRepair?.customerEmail || null,
      repair: linkedRepair,
      claims: claims || [],
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch warranty record.' });
  }
});

// 7. POST /api/battery-warranties — Create standalone / attach warranty
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const {
      repairId,
      repairNumber,
      customerId,
      customerName,
      customerPhone,
      customerEmail,
      customerAddress,
      deviceBrand,
      deviceModel,
      imeiNumber,
      batteryType = 'Original Replacement Battery',
      warrantyPeriod,
      warrantyMonths = 6,
      terms,
    } = req.body;

    if (!customerName || !customerPhone || !deviceModel) {
      return res.status(400).json({ error: 'Customer name, phone, and device model are required.' });
    }

    const months = parseWarrantyDurationMonths(warrantyPeriod || warrantyMonths);
    const periodLabel = formatWarrantyPeriodLabel(months);

    const warrantyNumber = await generateWarrantyNumber();
    const regDate = new Date();
    const expDate = calculateWarrantyExpiry(regDate, months);

    const newWarranty = {
      id: uuidv4(),
      warrantyNumber,
      repairId: repairId || null,
      repairNumber: repairNumber || null,
      customerId: customerId || null,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerEmail: customerEmail ? customerEmail.trim() : null,
      customerAddress: customerAddress ? customerAddress.trim() : null,
      deviceBrand: deviceBrand || 'Apple',
      deviceModel: deviceModel.trim(),
      imeiNumber: imeiNumber ? String(imeiNumber).trim() : null,
      batteryType,
      warrantyPeriod: periodLabel,
      registrationDate: regDate.toISOString(),
      expiryDate: expDate.toISOString(),
      status: 'ACTIVE',
      claimCount: 0,
      terms: terms || null,
      createdById: req.user!.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { data: created, error } = await supabaseAdmin.from('BatteryWarranty').insert([newWarranty]).select('*').single();

    if (error) {
      console.error('[CREATE WARRANTY ERROR]', error);
      return res.status(500).json({ error: 'Failed to issue warranty.' });
    }

    // If linked to repair, update repair record to reflect hasBatteryWarranty = true
    if (repairId) {
      await supabaseAdmin
        .from('Repair')
        .update({
          hasBatteryWarranty: true,
          batteryWarrantyPeriod: periodLabel,
          batteryType,
          updatedAt: new Date().toISOString(),
        })
        .eq('id', repairId);
      await broadcastServerChange('Repair', 'UPDATE', repairId);
    }

    await broadcastServerChange('BatteryWarranty', 'CREATE', created.id, created);

    return res.status(201).json(created);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to register battery warranty.' });
  }
});

// 8. PUT / PATCH /api/battery-warranties/:id (Edit Warranty)
const handleWarrantyUpdate = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { data: existing } = await supabaseAdmin.from('BatteryWarranty').select('*').eq('id', id).single();
    if (!existing) return res.status(404).json({ error: 'Battery warranty not found.' });

    const updateData = { ...req.body };
    delete updateData.id;
    delete updateData.claims;
    delete updateData.repair;
    delete updateData.warrantyPeriodMonths;
    delete updateData.warrantyPeriodLabel;
    delete updateData.daysRemaining;
    delete updateData.calculatedStatus;
    delete updateData.nepalRegDate;

    // Recalculate expiry date if period changed
    if (updateData.warrantyPeriod || updateData.warrantyMonths) {
      const months = parseWarrantyDurationMonths(updateData.warrantyPeriod || updateData.warrantyMonths);
      updateData.warrantyPeriod = formatWarrantyPeriodLabel(months);
      const regDate = new Date(existing.registrationDate || existing.createdAt || Date.now());
      updateData.expiryDate = calculateWarrantyExpiry(regDate, months).toISOString();
    }

    updateData.updatedAt = new Date().toISOString();

    const { data: updated, error } = await supabaseAdmin
      .from('BatteryWarranty')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Also update linked repair if duration or spec changed
    if (existing.repairId && (updateData.warrantyPeriod || updateData.batteryType)) {
      await supabaseAdmin
        .from('Repair')
        .update({
          batteryWarrantyPeriod: updateData.warrantyPeriod || existing.warrantyPeriod,
          batteryType: updateData.batteryType || existing.batteryType,
          updatedAt: new Date().toISOString(),
        })
        .eq('id', existing.repairId);
      await broadcastServerChange('Repair', 'UPDATE', existing.repairId);
    }

    await broadcastServerChange('BatteryWarranty', 'UPDATE', id, updated);

    return res.json({ success: true, data: updated });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update warranty.' });
  }
};

router.put('/:id', authenticate, handleWarrantyUpdate);
router.patch('/:id', authenticate, handleWarrantyUpdate);
router.all('/:id/edit', authenticate, handleWarrantyUpdate);

// 9. POST /api/battery-warranties/:id/claim — File warranty service claim
router.post('/:id/claim', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { issueDescription, actionTaken = 'FREE_REPLACEMENT', notes } = req.body;

    const { data: warranty } = await supabaseAdmin.from('BatteryWarranty').select('*').eq('id', id).single();
    if (!warranty) return res.status(404).json({ error: 'Warranty not found.' });

    const claimNumber = await generateClaimNumber();
    const newClaim = {
      id: uuidv4(),
      claimNumber,
      warrantyId: id,
      repairNumber: warranty.repairNumber || null,
      customerName: warranty.customerName,
      customerPhone: warranty.customerPhone,
      deviceBrand: warranty.deviceBrand,
      deviceModel: warranty.deviceModel,
      claimDate: new Date().toISOString(),
      issueDescription: issueDescription || 'Battery degraded / health dropped below 80%',
      status: 'APPROVED',
      actionTaken,
      notes: notes || null,
      processedById: req.user!.id,
      processedByName: req.user!.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { data: createdClaim, error: claimErr } = await supabaseAdmin
      .from('BatteryWarrantyClaim')
      .insert([newClaim])
      .select('*')
      .single();

    if (claimErr) return res.status(500).json({ error: 'Failed to register warranty claim.' });

    const updatedClaimCount = (warranty.claimCount || 0) + 1;
    await supabaseAdmin
      .from('BatteryWarranty')
      .update({
        claimCount: updatedClaimCount,
        lastClaimDate: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .eq('id', id);

    await broadcastServerChange('BatteryWarrantyClaim', 'CREATE', createdClaim.id, createdClaim);
    await broadcastServerChange('BatteryWarranty', 'UPDATE', id);

    return res.status(201).json({ success: true, message: 'Warranty claim processed successfully.', claim: createdClaim });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to record warranty claim.' });
  }
});

// 10. POST /api/battery-warranties/:id/send-email — Email warranty certificate
router.post('/:id/send-email', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { email } = req.body;

    const { data: warranty } = await supabaseAdmin.from('BatteryWarranty').select('*').eq('id', id).single();
    if (!warranty) return res.status(404).json({ error: 'Warranty not found.' });

    const targetEmail = email || warranty.customerEmail;
    if (!targetEmail) return res.status(400).json({ error: 'No email address available for customer.' });

    await sendEmail({
      to: targetEmail,
      subject: `MTS Lab — Battery Warranty Certificate (${warranty.warrantyNumber})`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #0f172a; margin-top: 0;">MTS LAB — Official Battery Warranty Certificate</h2>
          <p>Dear <strong>${warranty.customerName}</strong>,</p>
          <p>Thank you for choosing MTS Lab. Your battery replacement warranty has been successfully registered.</p>
          <div style="background-color: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0; border: 1px solid #cbd5e1;">
            <p style="margin: 4px 0;"><strong>Warranty ID:</strong> ${warranty.warrantyNumber}</p>
            ${warranty.repairNumber ? `<p style="margin: 4px 0;"><strong>Repair Job:</strong> #${warranty.repairNumber}</p>` : ''}
            <p style="margin: 4px 0;"><strong>Device:</strong> ${warranty.deviceBrand} ${warranty.deviceModel}</p>
            <p style="margin: 4px 0;"><strong>Battery Spec:</strong> ${warranty.batteryType || 'Original Replacement Battery'}</p>
            <p style="margin: 4px 0;"><strong>Warranty Duration:</strong> ${warranty.warrantyPeriod}</p>
            <p style="margin: 4px 0;"><strong>Valid Until:</strong> ${new Date(warranty.expiryDate).toLocaleDateString('en-GB')}</p>
          </div>
          <p style="color: #64748b; font-size: 13px;">Please present this warranty certificate or ID whenever requesting warranty diagnostics or replacement at MTS Lab.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="font-size: 12px; color: #94a3b8; margin: 0;">MTS Lab • New Road, Kathmandu, Nepal • Phone: 986927668, 015364307</p>
        </div>
      `,
    });

    return res.json({ success: true, message: 'Warranty certificate email sent successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to send warranty email.' });
  }
});

// 11. POST /api/battery-warranties/delete-2fa/request — 2FA code generation
router.post('/delete-2fa/request', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const userEmail = req.user!.email || 'mtsmobilelab@gmail.com';

    // Generate random 6-digit OTP code
    const generatedCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes validity

    otpStore[userId] = { code: generatedCode, expiresAt };

    console.log(`[2FA OTP GENERATED] For User: ${userEmail}, OTP: ${generatedCode}`);

    // Mask email for display in UI (e.g. m***b@gmail.com)
    let masked = userEmail;
    if (userEmail.includes('@')) {
      const [name, domain] = userEmail.split('@');
      masked = `${name.slice(0, 2)}***${name.slice(-1)}@${domain}`;
    }

    // Send the OTP email to registered address
    try {
      await sendEmail({
        to: userEmail,
        subject: 'MTS Lab — Super Admin 2FA Deletion Code',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 24px; border: 1px solid #fee2e2; border-radius: 12px; background-color: #fff;">
            <div style="text-align: center; margin-bottom: 20px;">
              <span style="font-size: 24px; font-weight: bold; color: #dc2626;">MTS Lab Security Alert</span>
            </div>
            <p style="color: #374151; font-size: 14px;">A request was made to permanently delete battery warranty records.</p>
            <p style="color: #374151; font-size: 14px;">Your 6-digit verification code is:</p>
            <div style="background-color: #fef2f2; border: 2px dashed #f87171; border-radius: 8px; text-align: center; padding: 16px; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: 900; letter-spacing: 6px; color: #991b1b; font-family: monospace;">${generatedCode}</span>
            </div>
            <p style="color: #6b7280; font-size: 12px; text-align: center;">This code will expire in 5 minutes. If you did not initiate this deletion, please secure your account immediately.</p>
          </div>
        `,
      });
    } catch (emailErr) {
      console.error('[2FA EMAIL SEND WARNING]', emailErr);
    }

    return res.json({
      success: true,
      message: '2FA verification code sent to your registered email.',
      emailMasked: masked,
    });
  } catch (err: any) {
    console.error('[2FA REQUEST ERROR]', err);
    return res.status(500).json({ error: 'Failed to generate 2FA code.' });
  }
});

// 12. POST /api/battery-warranties/bulk-delete — 2FA protected permanent deletion
router.post('/bulk-delete', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { ids, code } = req.body;
    const userId = req.user!.id;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No warranty IDs provided for deletion.' });
    }

    const trimmedCode = String(code || '').trim();
    const storedOtp = otpStore[userId];

    // Verification check: accept live OTP or Super Admin emergency bypass PIN (007007)
    const isMasterBypass = trimmedCode === '007007';
    const isOtpValid = storedOtp && storedOtp.code === trimmedCode && storedOtp.expiresAt > Date.now();

    if (!isOtpValid && !isMasterBypass) {
      return res.status(401).json({ error: 'Invalid or expired 2FA code. Please request a new code or use backup PIN.' });
    }

    // Clear used OTP
    delete otpStore[userId];

    // Delete associated claims first
    await supabaseAdmin.from('BatteryWarrantyClaim').delete().in('warrantyId', ids);

    // Delete the warranties
    const { error } = await supabaseAdmin.from('BatteryWarranty').delete().in('id', ids);

    if (error) {
      console.error('[BULK DELETE ERROR]', error);
      return res.status(500).json({ error: error.message || 'Failed to delete warranty records.' });
    }

    for (const id of ids) {
      await broadcastServerChange('BatteryWarranty', 'DELETE', id);
    }

    return res.json({
      success: true,
      message: `Successfully and permanently deleted ${ids.length} warranty record(s).`,
    });
  } catch (err: any) {
    console.error('[BULK DELETE EXCEPTION]', err);
    return res.status(500).json({ error: 'Failed to execute bulk deletion.' });
  }
});

// 13. DELETE /api/battery-warranties/:id — Delete single warranty
router.delete('/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await supabaseAdmin.from('BatteryWarrantyClaim').delete().eq('warrantyId', id);
    const { error } = await supabaseAdmin.from('BatteryWarranty').delete().eq('id', id);

    if (error) return res.status(500).json({ error: 'Failed to delete warranty.' });

    await broadcastServerChange('BatteryWarranty', 'DELETE', id);

    return res.json({ success: true, message: 'Warranty deleted successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete warranty.' });
  }
});

export default router;
