// api/_server/routes/repairs.ts
import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize, normalizeRole } from '../middleware/rbac';
import { logAudit } from '../services/auditService';
import { createExcelBuffer, parseExcelBuffer } from '../services/excelService';
import { broadcastServerChange } from '../services/realtimeSync';
import { createNotification } from '../services/notificationStorage';
import {
  createRepairTransferRequest,
  directTransferRepair,
  getMyTransferRequests,
  getTransferRequestById,
} from '../services/repairTransferService';
import {
  computeRepairDashboardStats,
  getNptIsoBoundsForPreset,
  DateFilterPreset
} from '../services/repairStatsService';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const ALLOWED_REPAIR_COLUMNS = new Set([
  'customerId',
  'customerName',
  'customerPhone',
  'customerEmail',
  'customerAddress',
  'deviceBrand',
  'deviceModel',
  'imeiNumber',
  'deviceColor',
  'deviceCondition',
  'conditionNotes',
  'problemDescription',
  'accessoriesReceived',
  'estimatedCost',
  'advancePaid',
  'totalPaid',
  'paymentStatus',
  'status',
  'priority',
  'priorityUpdatedAt',
  'technicianId',
  'branchId',
  'expectedCompletionDate',
  'remarks',
  'partsUsed',
  'repairImages',
  'managerUpdatedAt',
  'managerUpdatedBy',
  'receivingMethod',
  'isCourierIn',
  'courierCompany',
  'courierTrackingNumber',
  'courierDate',
  'courierReceivedDate',
  'courierInPickupDate',
  'courierInStatus',
  'courierStatus',
  'courierInCharge',
  'courierInPaymentStatus',
  'courierNotes',
  'senderName',
  'senderPhone',
  'senderWhatsapp',
  'originDistrict',
  'originAddress',
  'isCourierOut',
  'returnCourierCompany',
  'returnCourierTrackingNumber',
  'returnCourierDispatchDate',
  'courierOutDeliveredDate',
  'courierOutStatus',
  'courierOutCharge',
  'courierOutPaymentStatus',
  'destinationDistrict',
  'destinationAddress',
  'receiverName',
  'receiverPhone',
  'receiverWhatsapp',
  'returnCourierNotes',
  'isReturnCourierDispatched',
  'returnCourierDispatchedAt',
  'returnCourierDispatchedById',
  'returnCourierDispatchedByName',
  'courierArchived',
  'assignedAt',
  'assignedById',
  'assignedByName',
  'hasBatteryWarranty',
  'batteryWarrantyPeriod',
  'batteryType',
  'batteryHealth',
  'batterySerial',
  'batteryWarrantyExpiry',
  'warrantyTerms'
]);

async function generateRepairNumber(offset: number = 0): Promise<string> {
  const currentYear = new Date().getFullYear();
  const { data: repairs } = await supabaseAdmin
    .from('Repair')
    .select('repairNumber')
    .ilike('repairNumber', `MTS-${currentYear}-%`)
    .order('repairNumber', { ascending: false })
    .limit(30);

  let maxNum = 1000;
  if (repairs && repairs.length > 0) {
    for (const r of repairs) {
      if (!r.repairNumber) continue;
      const match = r.repairNumber.match(/(\d+)$/);
      if (match && match[1]) {
        const parsed = parseInt(match[1], 10);
        if (!isNaN(parsed) && parsed > maxNum) {
          maxNum = parsed;
        }
      }
    }
  }

  const nextNum = maxNum + 1 + offset;
  return `MTS-${currentYear}-${nextNum.toString().padStart(4, '0')}`;
}

async function generateWarrantyNumber(offset: number = 0): Promise<string> {
  const currentYear = new Date().getFullYear();
  const { data: records } = await supabaseAdmin
    .from('BatteryWarranty')
    .select('warrantyNumber')
    .ilike('warrantyNumber', `BW-${currentYear}-%`)
    .order('warrantyNumber', { ascending: false })
    .limit(20);

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

  const nextNum = maxNum + 1 + offset;
  return `BW-${currentYear}-${nextNum.toString().padStart(4, '0')}`;
}

function parseWarrantyDurationMonths(periodStr: any): number {
  const str = String(periodStr || '').toUpperCase().trim();
  if (str.includes('24') || str.includes('2_YEAR') || str.includes('2 YEAR') || str.includes('2YEAR') || str.includes('2_Y') || str === '2Y' || str === '2 YEARS') return 24;
  if (str.includes('12') || str.includes('1_YEAR') || str.includes('1 YEAR') || str.includes('1YEAR') || str.includes('1_Y') || str === '1Y' || str === '1 YEAR') return 12;
  if (str.includes('3')) return 3;
  return 6;
}

async function syncBatteryWarrantyFromRepair(repairData: any, reqUser: any) {
  try {
    if (!repairData || !repairData.id) return;

    const isWarrantyActive =
      repairData.hasBatteryWarranty === true ||
      repairData.hasBatteryWarranty === 'true';

    if (!isWarrantyActive) {
      const { data: existing } = await supabaseAdmin
        .from('BatteryWarranty')
        .select('id')
        .eq('repairId', repairData.id);

      if (existing && existing.length > 0) {
        for (const w of existing) {
          await supabaseAdmin.from('BatteryWarrantyClaim').delete().eq('warrantyId', w.id);
          await supabaseAdmin.from('BatteryWarranty').delete().eq('id', w.id);
          await broadcastServerChange('BatteryWarranty', 'DELETE', w.id);
        }
      }
      return;
    }

    const { data: existing } = await supabaseAdmin
      .from('BatteryWarranty')
      .select('id, registrationDate')
      .eq('repairId', repairData.id)
      .limit(1);

    const months = parseWarrantyDurationMonths(repairData.batteryWarrantyPeriod);
    const periodLabel = months === 24 ? '2 Years' : (months === 12 ? '1 Year' : `${months} Months`);

    const regDate = existing && existing[0]?.registrationDate
      ? new Date(existing[0].registrationDate)
      : new Date(repairData.createdAt || Date.now());

    const expDate = new Date(regDate);
    if (months === 24) {
      expDate.setFullYear(expDate.getFullYear() + 2);
    } else if (months === 12) {
      expDate.setFullYear(expDate.getFullYear() + 1);
    } else {
      expDate.setMonth(expDate.getMonth() + months);
    }

    if (existing && existing.length > 0) {
      await supabaseAdmin
        .from('BatteryWarranty')
        .update({
          customerName: repairData.customerName,
          customerPhone: repairData.customerPhone,
          customerEmail: repairData.customerEmail || null,
          customerAddress: repairData.customerAddress || null,
          deviceBrand: repairData.deviceBrand,
          deviceModel: repairData.deviceModel,
          imeiNumber: repairData.imeiNumber ? String(repairData.imeiNumber).trim() : null,
          batteryType: repairData.batteryType || 'Original Replacement Battery',
          warrantyPeriod: periodLabel,
          expiryDate: expDate.toISOString(),
          status: 'ACTIVE',
          updatedAt: new Date().toISOString(),
        })
        .eq('id', existing[0].id);

      await broadcastServerChange('BatteryWarranty', 'UPDATE', existing[0].id);
    } else {
      const warrantyId = uuidv4();
      const warrantyNumber = await generateWarrantyNumber();
      await supabaseAdmin.from('BatteryWarranty').insert([
        {
          id: warrantyId,
          warrantyNumber,
          repairId: repairData.id,
          repairNumber: repairData.repairNumber,
          customerId: repairData.customerId || null,
          customerName: repairData.customerName,
          customerPhone: repairData.customerPhone,
          customerEmail: repairData.customerEmail || null,
          customerAddress: repairData.customerAddress || null,
          deviceBrand: repairData.deviceBrand,
          deviceModel: repairData.deviceModel,
          imeiNumber: repairData.imeiNumber ? String(repairData.imeiNumber).trim() : null,
          batteryType: repairData.batteryType || 'Original Replacement Battery',
          warrantyPeriod: periodLabel,
          registrationDate: regDate.toISOString(),
          expiryDate: expDate.toISOString(),
          status: 'ACTIVE',
          claimCount: 0,
          createdById: reqUser?.id || null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);

      await broadcastServerChange('BatteryWarranty', 'CREATE', warrantyId);
    }
  } catch (syncErr) {
    console.error('[SYNC BATTERY WARRANTY EXCEPTION]', syncErr);
  }
}

// ----------------------------------------------------
// 1. GET / — List repairs with filtering and search
// ----------------------------------------------------
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const {
      status,
      technicianId,
      branchId,
      priority,
      search,
      receivingMethod,
      isCourierIn,
      isCourierOut,
      startDate,
      endDate,
      preset,
      limit = '2000',
      page = '1',
    } = req.query;

    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = Math.min(parseInt(limit as string, 10) || 2000, 5000);
    const offset = (pageNum - 1) * limitNum;

    let query = supabaseAdmin
      .from('Repair')
      .select('*, customer:Customer(*), technician:User!Repair_technicianId_fkey(id, name, role, email)', { count: 'exact' });

    const role = normalizeRole(req.user!.role);
    const scope = String(req.query.scope || '').toLowerCase();
    const includeCompleted = String(req.query.includeCompleted || '').toLowerCase() === 'true';

    if (role === 'TECHNICIAN') {
      // Technicians strictly see ONLY repairs assigned to them - prevent IDOR
      query = query.eq('technicianId', req.user!.id);

      // On active bench (default or scope=active without explicit status filter), exclude Repaired, Delivered, Cancelled
      if (scope === 'active' || (!status && !includeCompleted)) {
        query = query.not('status', 'in', '("REPAIRED","READY_FOR_PICKUP","READY","READY_FOR_DELIVERY","DELIVERED","COMPLETED","CANNOT_REPAIR","CANCELLED")');
      }
    } else if (technicianId && technicianId !== 'ALL') {
      query = query.eq('technicianId', String(technicianId));
    }

    if (status && status !== 'ALL') {
      if (Array.isArray(status)) {
        query = query.in('status', status as string[]);
      } else {
        query = query.eq('status', String(status));
      }
    }

    if (priority && priority !== 'ALL') {
      query = query.eq('priority', String(priority));
    }

    if (branchId && branchId !== 'ALL') {
      query = query.eq('branchId', String(branchId));
    }

    if (receivingMethod && receivingMethod !== 'ALL') {
      query = query.eq('receivingMethod', String(receivingMethod));
    }

    if (isCourierIn !== undefined) {
      query = query.eq('isCourierIn', isCourierIn === 'true');
    }

    if (isCourierOut !== undefined) {
      query = query.eq('isCourierOut', isCourierOut === 'true');
    }

    // Date filtering: check preset or explicit startDate/endDate
    let effectiveStart = startDate ? String(startDate) : undefined;
    let effectiveEnd = endDate ? String(endDate) : undefined;

    if (preset && preset !== 'ALL' && (!effectiveStart || !effectiveEnd)) {
      const bounds = getNptIsoBoundsForPreset(preset as DateFilterPreset, effectiveStart, effectiveEnd);
      if (bounds.startIso) effectiveStart = bounds.startIso;
      if (bounds.endIso) effectiveEnd = bounds.endIso;
    }

    if (effectiveStart) {
      query = query.gte('createdAt', effectiveStart);
    }

    if (effectiveEnd) {
      query = query.lte('createdAt', effectiveEnd);
    }

    if (search) {
      const s = String(search).trim();
      query = query.or(`repairNumber.ilike.%${s}%,customerName.ilike.%${s}%,customerPhone.ilike.%${s}%,deviceModel.ilike.%${s}%,imeiNumber.ilike.%${s}%`);
    }

    query = query.order('createdAt', { ascending: false }).range(offset, offset + limitNum - 1);

    const { data: repairs, error } = await query;

    if (error) {
      console.error('[REPAIRS GET ERROR]', error);
      return res.status(500).json({ error: 'Failed to retrieve repairs list.' });
    }

    return res.json(repairs || []);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to load repair records.' });
  }
});

// ----------------------------------------------------
// 1.5 GET /stats — Aggregated Repair Statistics by Date Filter (Nepal Timezone)
// ----------------------------------------------------
router.get('/stats', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { preset = 'ALL', startDate, endDate, technicianId, branchId } = req.query;
    const stats = await computeRepairDashboardStats({
      preset: preset as DateFilterPreset,
      startDate: startDate ? String(startDate) : undefined,
      endDate: endDate ? String(endDate) : undefined,
      technicianId: technicianId ? String(technicianId) : undefined,
      branchId: branchId ? String(branchId) : undefined,
      userRole: req.user?.role,
      userId: req.user?.id
    });
    return res.json(stats);
  } catch (err: any) {
    console.error('[REPAIRS STATS ERROR]', err);
    return res.status(500).json({ error: 'Failed to compute repair statistics.' });
  }
});

// ----------------------------------------------------
// 2. GET /export — Export repairs to Excel
// ----------------------------------------------------
router.get('/export', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { status, search, startDate, endDate } = req.query;
    let query = supabaseAdmin.from('Repair').select('*, technician:User!Repair_technicianId_fkey(name)');

    if (status && status !== 'ALL') query = query.eq('status', String(status));
    if (startDate) query = query.gte('createdAt', String(startDate));
    if (endDate) query = query.lte('createdAt', String(endDate));
    if (search) {
      const s = String(search).trim();
      query = query.or(`repairNumber.ilike.%${s}%,customerName.ilike.%${s}%,customerPhone.ilike.%${s}%`);
    }

    const { data: repairs } = await query.order('createdAt', { ascending: false });

    const rows = (repairs || []).map((r: any) => ({
      'Repair Number': r.repairNumber,
      'Customer Name': r.customerName,
      'Phone': r.customerPhone,
      'Device Brand': r.deviceBrand,
      'Device Model': r.deviceModel,
      'IMEI': r.imeiNumber || 'N/A',
      'Problem': r.problemDescription,
      'Status': r.status,
      'Priority': r.priority || 'NORMAL',
      'Estimated Cost': r.estimatedCost,
      'Advance Paid': r.advancePaid,
      'Total Paid': r.totalPaid,
      'Technician': r.technician?.name || 'Unassigned',
      'Date': r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : ''
    }));

    const buffer = createExcelBuffer('Repairs', rows);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="MTS_Repairs_${new Date().toISOString().split('T')[0]}.xlsx"`);
    return res.send(buffer);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to export repairs.' });
  }
});

// ----------------------------------------------------
// 3. GET /import/template — Excel Template
// ----------------------------------------------------
router.get('/import/template', authenticate, (_req: Request, res: Response) => {
  const sampleData = [
    {
      'Customer Name': 'Ram Bahadur',
      'Customer Phone': '9841234567',
      'Customer Email': 'ram@example.com',
      'Customer Address': 'New Road, Kathmandu',
      'Device Brand': 'Apple',
      'Device Model': 'iPhone 13 Pro',
      'IMEI / Serial': '354892019283741',
      'Problem Description': 'Broken OLED screen, touch not working',
      'Estimated Cost': 18500,
      'Advance Paid': 5000,
      'Remarks': 'Urgent repair requested by customer'
    }
  ];
  const buffer = createExcelBuffer('Import Template', sampleData);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="MTS_Lab_Repair_Import_Template.xlsx"');
  return res.send(buffer);
});

// ----------------------------------------------------
// 4. POST /import/preview — Excel Upload Preview
// ----------------------------------------------------
router.post('/import/preview', authenticate, upload.single('file') as any, (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No Excel file provided for import preview.' });
    }
    const rows = parseExcelBuffer(req.file.buffer);
    const parsed = rows.map((r: any, idx: number) => ({
      rowIndex: idx + 1,
      customerName: r['Customer Name'] || r['customerName'] || '',
      customerPhone: r['Customer Phone'] || r['customerPhone'] || r['Phone'] || '',
      customerEmail: r['Customer Email'] || r['customerEmail'] || '',
      customerAddress: r['Customer Address'] || r['customerAddress'] || '',
      deviceBrand: r['Device Brand'] || r['deviceBrand'] || 'Apple',
      deviceModel: r['Device Model'] || r['deviceModel'] || '',
      imeiNumber: r['IMEI / Serial'] || r['IMEI'] || r['imeiNumber'] || '',
      problemDescription: r['Problem Description'] || r['problemDescription'] || '',
      estimatedCost: parseFloat(r['Estimated Cost'] || r['estimatedCost'] || '0') || 0,
      advancePaid: parseFloat(r['Advance Paid'] || r['advancePaid'] || '0') || 0,
      remarks: r['Remarks'] || r['remarks'] || '',
      isValid: Boolean((r['Customer Name'] || r['customerName']) && (r['Customer Phone'] || r['customerPhone']) && (r['Device Model'] || r['deviceModel']))
    }));
    return res.json({
      totalRows: parsed.length,
      validRows: parsed.filter((p: any) => p.isValid).length,
      invalidRows: parsed.filter((p: any) => !p.isValid).length,
      preview: parsed
    });
  } catch (err: any) {
    return res.status(400).json({ error: 'Failed to parse Excel file. Ensure valid .xlsx format.' });
  }
});

// ----------------------------------------------------
// 5. POST /import/confirm — Batch Import Confirm
// ----------------------------------------------------
router.post('/import/confirm', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No repair items to import.' });
    }
    const importedRepairs: any[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.customerName || !item.customerPhone || !item.deviceModel) continue;
      const repairNumber = await generateRepairNumber(i);
      const repairId = uuidv4();
      const newRepair = {
        id: repairId,
        repairNumber,
        customerName: item.customerName.trim(),
        customerPhone: item.customerPhone.trim(),
        customerEmail: item.customerEmail ? item.customerEmail.trim() : null,
        customerAddress: item.customerAddress ? item.customerAddress.trim() : null,
        deviceBrand: item.deviceBrand || 'Apple',
        deviceModel: item.deviceModel.trim(),
        imeiNumber: item.imeiNumber ? String(item.imeiNumber).trim() : null,
        problemDescription: item.problemDescription || 'General diagnostic & repair',
        estimatedCost: Number(item.estimatedCost || 0),
        advancePaid: Number(item.advancePaid || 0),
        totalPaid: Number(item.advancePaid || 0),
        paymentStatus: Number(item.advancePaid || 0) > 0 ? (Number(item.advancePaid) >= Number(item.estimatedCost) ? 'PAID' : 'PARTIAL') : 'UNPAID',
        status: 'RECEIVED',
        priority: 'NORMAL',
        remarks: item.remarks || null,
        createdById: req.user!.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const { data: created } = await supabaseAdmin.from('Repair').insert([newRepair]).select('*').single();
      if (created) importedRepairs.push(created);
    }
    return res.json({ success: true, count: importedRepairs.length, message: `Successfully imported ${importedRepairs.length} repairs.` });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to process batch repair import.' });
  }
});

// ----------------------------------------------------
// 6. POST /bulk-delete — Bulk Delete Repairs
// ----------------------------------------------------
router.post('/bulk-delete', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No repair IDs specified.' });
    }
    await supabaseAdmin.from('RepairLog').delete().in('repairId', ids);
    await supabaseAdmin.from('TechnicianNote').delete().in('repairId', ids);
    await supabaseAdmin.from('Payment').delete().in('repairId', ids);
    const { error } = await supabaseAdmin.from('Repair').delete().in('id', ids);
    if (error) {
      return res.status(500).json({ error: 'Failed to bulk delete repairs.' });
    }
    return res.json({ success: true, message: `Successfully deleted ${ids.length} repair records.` });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to bulk delete repairs.' });
  }
});

// ----------------------------------------------------
// 7. GET /:id — Get Single Repair Details
// ----------------------------------------------------
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!id || id === 'undefined' || id === 'null') {
      return res.status(400).json({ error: 'Invalid repair ID.' });
    }

    const { data: repair, error } = await supabaseAdmin
      .from('Repair')
      .select('*, customer:Customer(*), technician:User!Repair_technicianId_fkey(id, name, email, role)')
      .eq('id', id)
      .single();

    if (error || !repair) {
      // Fallback: lookup by repairNumber
      const { data: byNum } = await supabaseAdmin
        .from('Repair')
        .select('*, customer:Customer(*), technician:User!Repair_technicianId_fkey(id, name, email, role)')
        .eq('repairNumber', id)
        .single();

      if (byNum) {
        return res.json(byNum);
      }
      return res.status(404).json({ error: 'Repair ticket not found.' });
    }

    return res.json(repair);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to load repair record.' });
  }
});

// ----------------------------------------------------
// 8. GET /:id/notes — Get Notes for a Repair
// ----------------------------------------------------
router.get('/:id/notes', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { data: notes, error } = await supabaseAdmin
      .from('TechnicianNote')
      .select('*')
      .eq('repairId', id)
      .order('createdAt', { ascending: false });

    if (error) {
      return res.status(500).json({ error: 'Failed to retrieve notes.' });
    }
    return res.json(notes || []);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to load notes.' });
  }
});

// ----------------------------------------------------
// 9. POST / & POST /repair — Single Repair Intake
// ----------------------------------------------------
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const {
      customerId,
      customerName,
      customerPhone,
      customerAlternativePhone,
      customerEmail,
      customerDistrict,
      customerMunicipality,
      customerAddress,
      customerLandmark,
      customerNotes,
      deviceBrand,
      deviceModel,
      imeiNumber,
      deviceColor,
      deviceCondition,
      conditionNotes,
      problemDescription,
      accessoriesReceived,
      estimatedCost,
      advancePaid,
      technicianId,
      branchId,
      priority = 'NORMAL',
      expectedCompletionDate,
      remarks,
      receivingMethod = 'WALK_IN',
      isCourierIn = false,
      courierCompany,
      courierTrackingNumber,
      courierDate,
      courierReceivedDate,
      senderName,
      senderPhone,
      originDistrict,
      originAddress,
      courierNotes,
      hasBatteryWarranty = false,
      batteryWarrantyPeriod,
      batteryType,
      batteryHealth,
      batterySerial,
    } = req.body;

    if (!customerName || !customerPhone || !deviceModel) {
      return res.status(400).json({ error: 'Customer name, phone, and device model are required.' });
    }

    let resolvedCustomerId = customerId;
    if (!resolvedCustomerId) {
      const { data: existingCustomers } = await supabaseAdmin
        .from('Customer')
        .select('id')
        .eq('phone', customerPhone.trim())
        .limit(1);

      if (existingCustomers && existingCustomers.length > 0) {
        resolvedCustomerId = existingCustomers[0].id;
        // Update customer details if provided
        await supabaseAdmin
          .from('Customer')
          .update({
            name: customerName.trim(),
            alternativePhone: customerAlternativePhone ? customerAlternativePhone.trim() : undefined,
            email: customerEmail ? customerEmail.trim() : undefined,
            district: customerDistrict ? customerDistrict.trim() : undefined,
            municipality: customerMunicipality ? customerMunicipality.trim() : undefined,
            address: customerAddress ? customerAddress.trim() : undefined,
            landmark: customerLandmark ? customerLandmark.trim() : undefined,
            notes: customerNotes ? customerNotes.trim() : undefined,
            updatedAt: new Date().toISOString()
          })
          .eq('id', resolvedCustomerId);
      } else {
        const newCusId = uuidv4();
        const { data: createdCus } = await supabaseAdmin
          .from('Customer')
          .insert([
            {
              id: newCusId,
              customerId: `CUS-${Date.now().toString().slice(-5)}`,
              name: customerName.trim(),
              phone: customerPhone.trim(),
              alternativePhone: customerAlternativePhone ? customerAlternativePhone.trim() : null,
              email: customerEmail ? customerEmail.trim() : null,
              district: customerDistrict ? customerDistrict.trim() : null,
              municipality: customerMunicipality ? customerMunicipality.trim() : null,
              address: customerAddress ? customerAddress.trim() : null,
              landmark: customerLandmark ? customerLandmark.trim() : null,
              notes: customerNotes ? customerNotes.trim() : null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ])
          .select('id')
          .single();

        if (createdCus) {
          resolvedCustomerId = createdCus.id;
          await broadcastServerChange('Customer', 'CREATE', newCusId);
        }
      }
    }

    const repairNumber = await generateRepairNumber();
    const repairId = uuidv4();
    const estCostNum = parseFloat(estimatedCost || 0) || 0;
    const advPaidNum = parseFloat(advancePaid || 0) || 0;
    const paymentStatus = advPaidNum >= estCostNum && estCostNum > 0 ? 'PAID' : (advPaidNum > 0 ? 'PARTIAL' : 'UNPAID');

    const isWarrantyExplicit = hasBatteryWarranty === true || hasBatteryWarranty === 'true';

    const newRepair = {
      id: repairId,
      repairNumber,
      customerId: resolvedCustomerId || null,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerEmail: customerEmail ? customerEmail.trim() : null,
      customerAddress: customerAddress ? customerAddress.trim() : null,
      deviceBrand: deviceBrand || 'Apple',
      deviceModel: deviceModel.trim(),
      imeiNumber: imeiNumber ? String(imeiNumber).trim() : null,
      deviceColor: deviceColor || null,
      deviceCondition: deviceCondition || 'FAIR',
      conditionNotes: conditionNotes || null,
      problemDescription: problemDescription || '',
      accessoriesReceived: accessoriesReceived || null,
      estimatedCost: estCostNum,
      advancePaid: advPaidNum,
      totalPaid: advPaidNum,
      paymentStatus,
      status: 'RECEIVED',
      priority,
      technicianId: technicianId || null,
      assignedAt: technicianId ? new Date().toISOString() : null,
      assignedById: technicianId ? req.user!.id : null,
      assignedByName: technicianId ? (req.user!.name || 'Staff') : null,
      branchId: branchId || req.user!.branchId || null,
      expectedCompletionDate: expectedCompletionDate || null,
      remarks: remarks || null,
      receivingMethod,
      isCourierIn: Boolean(isCourierIn),
      courierCompany: courierCompany || null,
      courierTrackingNumber: courierTrackingNumber || null,
      courierDate: courierDate || null,
      courierReceivedDate: courierReceivedDate || null,
      senderName: senderName || null,
      senderPhone: senderPhone || null,
      originDistrict: originDistrict || null,
      originAddress: originAddress || null,
      courierNotes: courierNotes || null,
      hasBatteryWarranty: isWarrantyExplicit,
      batteryWarrantyPeriod: isWarrantyExplicit ? (batteryWarrantyPeriod || '6_MONTHS') : null,
      batteryType: isWarrantyExplicit ? (batteryType || 'Original Replacement Battery') : null,
      batteryHealth: isWarrantyExplicit ? (batteryHealth || null) : null,
      batterySerial: isWarrantyExplicit ? (batterySerial || null) : null,
      createdById: req.user!.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { data: created, error } = await supabaseAdmin.from('Repair').insert([newRepair]).select('*').single();

    if (error) {
      console.error('[REPAIR CREATE ERROR]', error);
      return res.status(500).json({ error: 'Failed to create repair ticket.' });
    }

    if (isWarrantyExplicit) {
      await syncBatteryWarrantyFromRepair(created, req.user);
    }

    let assignedTechName: string | null = null;
    if (created.technicianId) {
      try {
        const { data: techUser } = await supabaseAdmin.from('User').select('name').eq('id', created.technicianId).single();
        if (techUser?.name) assignedTechName = techUser.name;
      } catch (tErr) {
        console.warn('[TECH LOOKUP WARN]', tErr);
      }
    }

    const logId = uuidv4();
    await supabaseAdmin.from('RepairLog').insert([
      {
        id: logId,
        repairId: created.id,
        status: 'RECEIVED',
        message: assignedTechName
          ? `Repair intake recorded by ${req.user!.name || 'Staff'} (Assigned to: ${assignedTechName}).`
          : `Repair intake recorded by ${req.user!.name || 'Staff'}.`,
        createdAt: new Date().toISOString(),
      },
    ]);
    await broadcastServerChange('RepairLog', 'CREATE', logId);

    await logAudit({
      userId: req.user!.id,
      action: 'REPAIR_CREATED',
      resource: 'Repair',
      resourceId: created.id,
      details: { repairNumber: created.repairNumber, customerName: created.customerName },
    });

    // Dispatch realtime notification to assigned technician or role
    if (created.technicianId) {
      try {
        const isUrgent = created.priority === 'URGENT';
        const isHigh = created.priority === 'HIGH';
        const priorityEmoji = isUrgent ? '🔴' : isHigh ? '🟠' : '📋';
        await createNotification({
          userId: created.technicianId,
          title: `${priorityEmoji} ${isUrgent ? 'Urgent Repair Assigned' : 'New Repair Assigned'}: #${created.repairNumber}`,
          message: `${created.deviceBrand || ''} ${created.deviceModel || ''} (${created.customerName || 'Customer'}) assigned by ${req.user!.name}. Problem: ${created.problemDescription || 'Inspection required'}`,
          type: isUrgent ? 'REPAIR_URGENT' : 'REPAIR_ASSIGNED',
          priority: created.priority || 'NORMAL',
          repairId: created.id,
          repairNumber: created.repairNumber,
          senderId: req.user!.id,
          senderName: req.user!.name,
          senderRole: req.user!.role,
        });
      } catch (notifErr) {
        console.warn('[REPAIR INTAKE NOTIF WARN]', notifErr);
      }
    }

    await broadcastServerChange('Repair', 'CREATE', created.id, created);

    return res.status(201).json(created);
  } catch (err: any) {
    console.error('[CREATE REPAIR ERROR]', err);
    return res.status(500).json({ error: 'Failed to register repair ticket.' });
  }
});

// ----------------------------------------------------
// 10. POST /batch & POST /repairs/batch & POST /repair/batch — Multi-device Batch Registration
// ----------------------------------------------------
const handleBatchRepairIntake = async (req: AuthRequest, res: Response) => {
  const createdRepairs: any[] = [];
  try {
    const rawCustomer = req.body.customer || {};
    const customer = {
      id: rawCustomer.id || req.body.customerId,
      name: (rawCustomer.name || req.body.customerName || '').trim(),
      phone: (rawCustomer.phone || req.body.customerPhone || '').trim(),
      email: (rawCustomer.email || req.body.customerEmail || '').trim() || null,
      district: (rawCustomer.district || req.body.customerDistrict || '').trim() || null,
      municipality: (rawCustomer.municipality || req.body.customerMunicipality || '').trim() || null,
      address: (rawCustomer.address || req.body.customerAddress || '').trim() || null,
      landmark: (rawCustomer.landmark || req.body.customerLandmark || '').trim() || null,
      alternativePhone: (rawCustomer.alternativePhone || req.body.customerAlternativePhone || '').trim() || null,
      notes: (rawCustomer.notes || req.body.customerNotes || '').trim() || null,
    };
    const devices = req.body.devices || [];

    if (!customer.name || !customer.phone) {
      return res.status(400).json({ error: 'Customer name and phone number are required.' });
    }

    if (!Array.isArray(devices) || devices.length === 0) {
      return res.status(400).json({ error: 'At least one device must be included in batch intake.' });
    }

    // Validate that all devices have a device model
    for (let i = 0; i < devices.length; i++) {
      const dev = devices[i];
      if (!dev || !dev.deviceModel || !dev.deviceModel.trim()) {
        return res.status(400).json({ error: `Device #${i + 1} is missing a valid device model.` });
      }
    }

    // 1. Resolve or Create Customer
    let resolvedCustomerId = customer.id;
    let resolvedCustomerObj: any = null;

    if (resolvedCustomerId) {
      const { data: existingCus } = await supabaseAdmin
        .from('Customer')
        .select('*')
        .eq('id', resolvedCustomerId)
        .single();

      if (existingCus) {
        resolvedCustomerObj = existingCus;
        // Update customer details if provided
        const { data: updatedCus } = await supabaseAdmin
          .from('Customer')
          .update({
            name: customer.name.trim(),
            phone: customer.phone.trim(),
            alternativePhone: customer.alternativePhone ? customer.alternativePhone.trim() : existingCus.alternativePhone,
            email: customer.email ? customer.email.trim() : existingCus.email,
            district: customer.district ? customer.district.trim() : existingCus.district,
            municipality: customer.municipality ? customer.municipality.trim() : existingCus.municipality,
            address: customer.address ? customer.address.trim() : existingCus.address,
            landmark: customer.landmark ? customer.landmark.trim() : existingCus.landmark,
            notes: customer.notes ? customer.notes.trim() : existingCus.notes,
            updatedAt: new Date().toISOString()
          })
          .eq('id', resolvedCustomerId)
          .select('*')
          .single();
        if (updatedCus) resolvedCustomerObj = updatedCus;
      }
    }

    if (!resolvedCustomerObj) {
      const { data: existingByPhone } = await supabaseAdmin
        .from('Customer')
        .select('*')
        .eq('phone', customer.phone.trim())
        .limit(1);

      if (existingByPhone && existingByPhone.length > 0) {
        resolvedCustomerId = existingByPhone[0].id;
        resolvedCustomerObj = existingByPhone[0];
        // Update customer details if provided
        const { data: updatedCus } = await supabaseAdmin
          .from('Customer')
          .update({
            name: customer.name.trim(),
            alternativePhone: customer.alternativePhone ? customer.alternativePhone.trim() : existingByPhone[0].alternativePhone,
            email: customer.email ? customer.email.trim() : existingByPhone[0].email,
            district: customer.district ? customer.district.trim() : existingByPhone[0].district,
            municipality: customer.municipality ? customer.municipality.trim() : existingByPhone[0].municipality,
            address: customer.address ? customer.address.trim() : existingByPhone[0].address,
            landmark: customer.landmark ? customer.landmark.trim() : existingByPhone[0].landmark,
            notes: customer.notes ? customer.notes.trim() : existingByPhone[0].notes,
            updatedAt: new Date().toISOString()
          })
          .eq('id', resolvedCustomerId)
          .select('*')
          .single();
        if (updatedCus) resolvedCustomerObj = updatedCus;
      } else {
        const newCusId = uuidv4();
        const newCustomerNumber = `CUS-${Date.now().toString().slice(-5)}`;
        const { data: createdCus, error: cusErr } = await supabaseAdmin
          .from('Customer')
          .insert([
            {
              id: newCusId,
              customerId: newCustomerNumber,
              name: customer.name.trim(),
              phone: customer.phone.trim(),
              alternativePhone: customer.alternativePhone ? customer.alternativePhone.trim() : null,
              email: customer.email ? customer.email.trim() : null,
              district: customer.district ? customer.district.trim() : null,
              municipality: customer.municipality ? customer.municipality.trim() : null,
              address: customer.address ? customer.address.trim() : null,
              landmark: customer.landmark ? customer.landmark.trim() : null,
              notes: customer.notes ? customer.notes.trim() : null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ])
          .select('*')
          .single();

        if (cusErr) {
          console.error('[CUSTOMER CREATE BATCH ERROR]', cusErr);
        }
        if (createdCus) {
          resolvedCustomerId = createdCus.id;
          resolvedCustomerObj = createdCus;
          await broadcastServerChange('Customer', 'CREATE', newCusId, createdCus);
        }
      }
    }

    // 2. Iterate through devices and perform atomic creation
    for (let i = 0; i < devices.length; i++) {
      const dev = devices[i];
      const repairNumber = await generateRepairNumber(i);
      const repairId = uuidv4();
      const estCostNum = parseFloat(dev.estimatedCost || 0) || 0;
      const advPaidNum = parseFloat(dev.advancePaid || 0) || 0;
      const paymentStatus = advPaidNum >= estCostNum && estCostNum > 0 ? 'PAID' : (advPaidNum > 0 ? 'PARTIAL' : 'UNPAID');
      const isWarrantyExplicit = dev.hasBatteryWarranty === true || dev.hasBatteryWarranty === 'true';

      const newRepair = {
        id: repairId,
        repairNumber,
        customerId: resolvedCustomerId || null,
        customerName: customer.name.trim(),
        customerPhone: customer.phone.trim(),
        customerEmail: customer.email ? customer.email.trim() : null,
        customerAddress: customer.address ? customer.address.trim() : null,
        deviceBrand: dev.deviceBrand || 'Apple',
        deviceModel: dev.deviceModel.trim(),
        imeiNumber: dev.imeiNumber ? String(dev.imeiNumber).trim() : null,
        deviceColor: dev.deviceColor || null,
        deviceCondition: dev.deviceCondition || 'FAIR',
        conditionNotes: dev.conditionNotes || null,
        problemDescription: dev.problemDescription || '',
        accessoriesReceived: dev.accessoriesReceived || null,
        estimatedCost: estCostNum,
        advancePaid: advPaidNum,
        totalPaid: advPaidNum,
        paymentStatus,
        status: dev.status || 'RECEIVED',
        priority: dev.priority || 'NORMAL',
        technicianId: dev.technicianId || null,
        assignedAt: dev.technicianId ? new Date().toISOString() : null,
        assignedById: dev.technicianId ? req.user!.id : null,
        assignedByName: dev.technicianId ? (req.user!.name || 'Staff') : null,
        branchId: req.user!.branchId || null,
        expectedCompletionDate: dev.expectedCompletionDate || null,
        remarks: dev.remarks || null,
        receivingMethod: dev.receivingMethod || 'WALK_IN',
        isCourierIn: Boolean(dev.isCourierIn),
        courierCompany: dev.courierCompany || null,
        courierTrackingNumber: dev.courierTrackingNumber || null,
        courierDate: dev.courierDate || null,
        courierReceivedDate: dev.courierReceivedDate || null,
        senderName: dev.senderName || null,
        senderPhone: dev.senderPhone || null,
        originDistrict: dev.originDistrict || null,
        originAddress: dev.originAddress || null,
        courierNotes: dev.courierNotes || null,
        hasBatteryWarranty: isWarrantyExplicit,
        batteryWarrantyPeriod: isWarrantyExplicit ? (dev.batteryWarrantyPeriod || '6_MONTHS') : null,
        batteryType: isWarrantyExplicit ? (dev.batteryType || 'Original Replacement Battery') : null,
        batteryHealth: isWarrantyExplicit ? (dev.batteryHealth || null) : null,
        batterySerial: isWarrantyExplicit ? (dev.batterySerial || null) : null,
        createdById: req.user!.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const { data: created, error: insertErr } = await supabaseAdmin.from('Repair').insert([newRepair]).select('*').single();

      if (insertErr || !created) {
        console.error(`[BATCH REPAIR DEVICE ${i + 1} INSERT ERROR]`, insertErr);
        // Rollback any repairs created in this transaction
        if (createdRepairs.length > 0) {
          const insertedIds = createdRepairs.map((r: any) => r.id);
          await supabaseAdmin.from('RepairLog').delete().in('repairId', insertedIds);
          await supabaseAdmin.from('Repair').delete().in('id', insertedIds);
        }
        return res.status(500).json({ error: `Failed to create repair ticket for device #${i + 1} (${dev.deviceModel}). Batch rolled back.` });
      }

      if (isWarrantyExplicit) {
        await syncBatteryWarrantyFromRepair(created, req.user);
      }

      let assignedBatchTechName: string | null = null;
      if (created.technicianId) {
        try {
          const { data: techUser } = await supabaseAdmin.from('User').select('name').eq('id', created.technicianId).single();
          if (techUser?.name) assignedBatchTechName = techUser.name;
        } catch (tErr) {
          console.warn('[TECH BATCH LOOKUP WARN]', tErr);
        }
      }

      const logId = uuidv4();
      await supabaseAdmin.from('RepairLog').insert([
        {
          id: logId,
          repairId: created.id,
          status: 'RECEIVED',
          message: assignedBatchTechName
            ? `Multi-device intake recorded by ${req.user!.name || 'Staff'} (Device ${i + 1} of ${devices.length}, Assigned to: ${assignedBatchTechName}).`
            : `Multi-device intake recorded by ${req.user!.name || 'Staff'} (Device ${i + 1} of ${devices.length}).`,
          createdAt: new Date().toISOString(),
        },
      ]);
      await broadcastServerChange('RepairLog', 'CREATE', logId);

      if (created.technicianId) {
        try {
          const isUrgent = created.priority === 'URGENT';
          const isHigh = created.priority === 'HIGH';
          const priorityEmoji = isUrgent ? '🔴' : isHigh ? '🟠' : '📋';
          await createNotification({
            userId: created.technicianId,
            title: `${priorityEmoji} ${isUrgent ? 'Urgent Repair Assigned' : 'New Repair Assigned'}: #${created.repairNumber}`,
            message: `${created.deviceBrand || ''} ${created.deviceModel || ''} (${created.customerName || 'Customer'}) assigned by ${req.user!.name}. Problem: ${created.problemDescription || 'Inspection required'}`,
            type: isUrgent ? 'REPAIR_URGENT' : 'REPAIR_ASSIGNED',
            priority: created.priority || 'NORMAL',
            repairId: created.id,
            repairNumber: created.repairNumber,
            senderId: req.user!.id,
            senderName: req.user!.name,
            senderRole: req.user!.role,
          });
        } catch (notifErr) {
          console.warn('[BATCH REPAIR NOTIF WARN]', notifErr);
        }
      }

      await broadcastServerChange('Repair', 'CREATE', created.id, created);

      await logAudit({
        userId: req.user!.id,
        action: 'REPAIR_CREATED',
        resource: 'Repair',
        resourceId: created.id,
        details: {
          repairNumber: created.repairNumber,
          customerName: created.customerName,
          deviceModel: created.deviceModel,
          batchIndex: i + 1,
          totalDevices: devices.length
        },
      });

      createdRepairs.push(created);
    }

    return res.status(201).json({
      success: true,
      totalRegistered: createdRepairs.length,
      count: createdRepairs.length,
      repairs: createdRepairs,
      customer: resolvedCustomerObj || customer
    });
  } catch (batchErr: any) {
    console.error('[BATCH REPAIR INTAKE EXCEPTION]', batchErr);
    // Cleanup any partially created repairs
    if (createdRepairs.length > 0) {
      try {
        const insertedIds = createdRepairs.map((r: any) => r.id);
        await supabaseAdmin.from('RepairLog').delete().in('repairId', insertedIds);
        await supabaseAdmin.from('Repair').delete().in('id', insertedIds);
      } catch (rollbackErr) {
        console.error('[ROLLBACK EXCEPTION]', rollbackErr);
      }
    }
    return res.status(500).json({ error: 'Failed to process batch repair intake: ' + (batchErr?.message || 'Server error') });
  }
};

// Register batch endpoint under multiple matching routes for zero-failure resilience
router.post('/batch', authenticate, handleBatchRepairIntake);
router.post('/repairs/batch', authenticate, handleBatchRepairIntake);
router.post('/repair/batch', authenticate, handleBatchRepairIntake);

// ----------------------------------------------------
// 11. PATCH /:id & PUT /:id — Update Repair
// ----------------------------------------------------
const handleRepairUpdate = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const rawBody = req.body || {};

    const role = normalizeRole(req.user!.role);

    // Fetch existing repair first to verify permissions and assignments
    const { data: existingRepair, error: preFetchErr } = await supabaseAdmin
      .from('Repair')
      .select('*')
      .eq('id', id)
      .single();

    if (preFetchErr || !existingRepair) {
      return res.status(404).json({ error: 'Repair ticket not found.' });
    }

    // Role-based authorization: Technicians can ONLY update repairs assigned to them
    if (role === 'TECHNICIAN') {
      if (existingRepair.technicianId !== req.user!.id) {
        return res.status(403).json({ error: 'Access denied: You can only modify repairs assigned to you.' });
      }

      const FORBIDDEN_TECHNICIAN_STATUSES = [
        'DELIVERED',
        'READY_FOR_PICKUP',
        'READY',
        'READY_FOR_DELIVERY',
        'RE_PROBLEM',
        'REPROBLEM'
      ];
      if (rawBody.status && FORBIDDEN_TECHNICIAN_STATUSES.includes(String(rawBody.status).toUpperCase().trim())) {
        return res.status(403).json({
          error: `Access denied: Technicians cannot set status "${rawBody.status}". Only Managers, Admins, and Receptionists can mark repairs as Delivered, Ready for Pickup, or Re-Problem (Warranty).`
        });
      }
    }

    const updateData: Record<string, any> = {};
    for (const key of Object.keys(rawBody)) {
      if (ALLOWED_REPAIR_COLUMNS.has(key)) {
        updateData[key] = rawBody[key];
      }
    }

    if (updateData.estimatedCost !== undefined) updateData.estimatedCost = parseFloat(updateData.estimatedCost) || 0;
    if (updateData.advancePaid !== undefined) updateData.advancePaid = parseFloat(updateData.advancePaid) || 0;
    if (updateData.totalPaid !== undefined) updateData.totalPaid = parseFloat(updateData.totalPaid) || 0;

    if (rawBody.hasBatteryWarranty !== undefined) {
      const isWarranty = rawBody.hasBatteryWarranty === true || rawBody.hasBatteryWarranty === 'true';
      updateData.hasBatteryWarranty = isWarranty;
      if (!isWarranty) {
        updateData.batteryWarrantyPeriod = null;
        updateData.batteryType = null;
      }
    }

    updateData.updatedAt = new Date().toISOString();

    const { data: updated, error } = await supabaseAdmin
      .from('Repair')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error('[REPAIR UPDATE ERROR]', error);
      return res.status(400).json({ error: error.message });
    }

    if (rawBody.hasBatteryWarranty !== undefined || updated.hasBatteryWarranty !== undefined) {
      await syncBatteryWarrantyFromRepair({ ...updated, ...rawBody, id, repairNumber: updated.repairNumber }, req.user);
    }

    if (rawBody.status) {
      const logId = uuidv4();
      try {
        await supabaseAdmin.from('RepairLog').insert([
          {
            id: logId,
            repairId: id,
            status: rawBody.status,
            message: rawBody.remarks || `Status updated to ${rawBody.status} by ${req.user!.name || 'Staff'}`,
            createdAt: new Date().toISOString(),
          },
        ]);
        await broadcastServerChange('RepairLog', 'CREATE', logId);
      } catch (logErr) {
        console.warn('[REPAIR LOG NON FATAL]', logErr);
      }
    }

    // Priority alert dispatch if priority was changed
    const oldPriority = (existingRepair.priority || 'NORMAL').toUpperCase().trim();
    const newPriority = rawBody.priority ? String(rawBody.priority).toUpperCase().trim() : undefined;
    if (newPriority && newPriority !== oldPriority && updated.technicianId) {
      if (['URGENT', 'HIGH', 'MEDIUM'].includes(newPriority)) {
        const priorityEmoji: Record<string, string> = {
          URGENT: '🔴',
          HIGH: '🟠',
          MEDIUM: '🟡'
        };
        const emoji = priorityEmoji[newPriority] || '🔔';
        try {
          await createNotification({
            userId: updated.technicianId,
            title: `${emoji} ${newPriority} Priority Assigned: Job #${updated.repairNumber}`,
            message: `Priority was updated to ${newPriority} by ${req.user!.name || 'Staff'}.`,
            type: newPriority === 'URGENT' ? 'REPAIR_URGENT' : 'REPAIR_ALERT',
            priority: newPriority as any,
            repairId: id,
            repairNumber: updated.repairNumber,
            senderId: req.user!.id,
            senderName: req.user!.name,
            senderRole: req.user!.role
          });
        } catch (pNotifErr) {
          console.warn('[PRIORITY NOTIFICATION NON-FATAL]', pNotifErr);
        }
      }
    }

    await broadcastServerChange('Repair', 'UPDATE', id, updated);

    return res.json(updated);
  } catch (err: any) {
    console.error('[REPAIR UPDATE EXCEPTION]', err);
    return res.status(500).json({ error: 'Failed to update repair.' });
  }
};

router.patch('/:id', authenticate, handleRepairUpdate);
router.put('/:id', authenticate, handleRepairUpdate);

// ----------------------------------------------------
// 12. PATCH /:id/technician-update — Technician Progress
// ----------------------------------------------------
router.patch('/:id/technician-update', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      status,
      estimatedDeliveryDate,
      expectedCompletionDate,
      sparePartsUsed,
      partsUsed,
      technicianNotes,
      note,
      remarks
    } = req.body;

    const { data: existingRepair, error: fetchErr } = await supabaseAdmin
      .from('Repair')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !existingRepair) {
      return res.status(404).json({ error: 'Repair job not found.' });
    }

    const role = normalizeRole(req.user!.role);
    if (role === 'TECHNICIAN') {
      // 1. Ownership check: Must be assigned to this technician
      if (existingRepair.technicianId !== req.user!.id) {
        return res.status(403).json({ error: 'Access denied: You can only update repairs assigned to you.' });
      }

      // 2. Status restrictions: Delivered, Ready for Pickup, Re-Problem (Warranty) cannot be set by technicians
      const FORBIDDEN_TECHNICIAN_STATUSES = [
        'DELIVERED',
        'READY_FOR_PICKUP',
        'READY',
        'READY_FOR_DELIVERY',
        'RE_PROBLEM',
        'REPROBLEM'
      ];
      if (status && FORBIDDEN_TECHNICIAN_STATUSES.includes(String(status).toUpperCase().trim())) {
        return res.status(403).json({
          error: `Access denied: Technicians cannot set status "${status}". Only Managers, Admins, and Receptionists can mark repairs as Delivered, Ready for Pickup, or Re-Problem (Warranty).`
        });
      }
    }

    const updatePayload: any = {
      updatedAt: new Date().toISOString()
    };

    if (status) updatePayload.status = status;
    const resolvedDueDate = expectedCompletionDate || estimatedDeliveryDate;
    if (resolvedDueDate) updatePayload.expectedCompletionDate = resolvedDueDate;
    const resolvedParts = partsUsed !== undefined ? partsUsed : sparePartsUsed;
    if (resolvedParts !== undefined) updatePayload.partsUsed = resolvedParts;
    const resolvedRemarks = technicianNotes !== undefined ? technicianNotes : (note !== undefined ? note : remarks);
    if (resolvedRemarks !== undefined) updatePayload.remarks = resolvedRemarks;

    const { data: updatedRepair, error: updateErr } = await supabaseAdmin
      .from('Repair')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (updateErr) {
      console.error('[TECHNICIAN UPDATE ERROR]', updateErr);
      return res.status(500).json({ error: 'Failed to update repair progress.' });
    }

    // Insert RepairLog entry for audit history
    if (status && status !== existingRepair.status) {
      const logId = uuidv4();
      try {
        await supabaseAdmin.from('RepairLog').insert([
          {
            id: logId,
            repairId: id,
            status: status,
            message: resolvedRemarks ? `Status updated to ${status}. Note: ${resolvedRemarks}` : `Status updated to ${status} by ${req.user?.name || 'Technician'}`,
            createdAt: new Date().toISOString(),
          },
        ]);
        await broadcastServerChange('RepairLog', 'CREATE', logId);
      } catch (logErr) {
        console.warn('[REPAIR LOG NON FATAL]', logErr);
      }
    }

    // Dispatch notification to repair creator / manager
    try {
      if (existingRepair.createdById && existingRepair.createdById !== req.user?.id) {
        await createNotification({
          userId: existingRepair.createdById,
          title: `Repair Progress: #${updatedRepair.repairNumber || id.slice(0, 8)}`,
          message: `${req.user?.name || 'Technician'} updated repair status to ${status || existingRepair.status}. Note: ${resolvedRemarks || 'No notes added'}`,
          type: 'REPAIR_STATUS',
          priority: 'NORMAL',
          repairId: id,
          repairNumber: updatedRepair.repairNumber,
          senderId: req.user?.id,
          senderName: req.user?.name,
          senderRole: req.user?.role,
        });
      }
    } catch (notifErr) {
      console.warn('[NOTIFICATION DISPATCH WARN - NON FATAL]', notifErr);
    }

    await broadcastServerChange('Repair', 'UPDATE', id, updatedRepair);

    return res.json({
      success: true,
      message: 'Repair progress updated successfully.',
      ...updatedRepair,
      repair: updatedRepair
    });
  } catch (err: any) {
    console.error('[TECHNICIAN UPDATE EXCEPTION]', err);
    return res.status(500).json({ error: err?.message || 'Server error updating repair.' });
  }
});

// ----------------------------------------------------
// 13. POST /:id/alert — Urgent Alert & Priority Escalation
// ----------------------------------------------------
router.post('/:id/alert', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'LEAD_TECHNICIAN']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { priority, message } = req.body;

    const VALID_PRIORITIES = ['NORMAL', 'MEDIUM', 'HIGH', 'URGENT'];
    const resolvedPriority = priority ? String(priority).toUpperCase().trim() : 'NORMAL';

    if (!VALID_PRIORITIES.includes(resolvedPriority)) {
      return res.status(400).json({ error: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}` });
    }

    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: 'Alert message is required.' });
    }

    const { data: existingRepair, error: fetchErr } = await supabaseAdmin
      .from('Repair')
      .select('*, technician:User!Repair_technicianId_fkey(id, name)')
      .eq('id', id)
      .single();

    if (fetchErr || !existingRepair) {
      return res.status(404).json({ error: 'Repair not found.' });
    }

    if (!existingRepair.technicianId) {
      return res.status(400).json({ error: 'Cannot alert technician — no technician is assigned to this repair.' });
    }

    const { data: updatedRepair, error: updateErr } = await supabaseAdmin
      .from('Repair')
      .update({
        priority: resolvedPriority,
        priorityUpdatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      .eq('id', id)
      .select('*')
      .single();

    if (updateErr) {
      console.error('[ALERT PRIORITY DB UPDATE ERROR]', updateErr);
      return res.status(500).json({ error: 'Failed to update repair priority.' });
    }

    const logId = uuidv4();
    try {
      await supabaseAdmin.from('RepairLog').insert([
        {
          id: logId,
          repairId: id,
          status: updatedRepair.status,
          message: `[Priority Alert] ${resolvedPriority} — ${String(message).trim()} (Dispatched by ${req.user!.name || 'Staff'})`,
          createdAt: new Date().toISOString()
        }
      ]);
      await broadcastServerChange('RepairLog', 'CREATE', logId);
    } catch (logErr) {
      console.warn('[REPAIR LOG NON FATAL]', logErr);
    }

    const priorityEmoji: Record<string, string> = {
      URGENT: '🔴',
      HIGH: '🟠',
      MEDIUM: '🟡',
      NORMAL: '⚪'
    };
    const emoji = priorityEmoji[resolvedPriority] || '🔔';
    const notifTitle = `${emoji} ${resolvedPriority} Alert: Job #${updatedRepair.repairNumber}`;
    const notifMessage = String(message).trim() || `Priority alert from ${req.user!.name}`;

    await createNotification({
      userId: updatedRepair.technicianId,
      title: notifTitle,
      message: notifMessage,
      type: resolvedPriority === 'URGENT' ? 'REPAIR_URGENT' : 'REPAIR_ALERT',
      priority: resolvedPriority as any,
      repairId: id,
      repairNumber: updatedRepair.repairNumber,
      senderId: req.user!.id,
      senderName: req.user!.name,
      senderRole: req.user!.role,
    });

    await broadcastServerChange('Repair', 'UPDATE', id, updatedRepair);

    return res.json({
      success: true,
      message: `${resolvedPriority} priority alert dispatched to ${existingRepair.technician?.name || 'assigned technician'}.`,
      repair: updatedRepair
    });
  } catch (err: any) {
    console.error('[ALERT TECHNICIAN EXCEPTION]', err);
    return res.status(500).json({ error: 'Failed to dispatch alert.' });
  }
});

// ----------------------------------------------------
// 14. POST /:id/assign — Assign Technician
// ----------------------------------------------------
router.post('/:id/assign', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'LEAD_TECHNICIAN', 'RECEPTIONIST']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { technicianId } = req.body;

    const { data: tech } = await supabaseAdmin.from('User').select('name').eq('id', technicianId).single();

    const { data: updated, error } = await supabaseAdmin
      .from('Repair')
      .update({
        technicianId: technicianId || null,
        assignedAt: new Date().toISOString(),
        assignedById: req.user!.id,
        assignedByName: req.user!.name,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to assign technician.' });
    }

    const logId = uuidv4();
    try {
      await supabaseAdmin.from('RepairLog').insert([
        {
          id: logId,
          repairId: id,
          status: updated.status,
          message: `Assigned to technician: ${tech?.name || 'Unassigned'} by ${req.user!.name || 'Staff'}`,
          createdAt: new Date().toISOString(),
        },
      ]);
      await broadcastServerChange('RepairLog', 'CREATE', logId);
    } catch (logErr) {
      console.warn('[REPAIR LOG NON FATAL]', logErr);
    }

    // Dispatch realtime notification to newly assigned technician
    if (technicianId) {
      try {
        const isUrgent = updated.priority === 'URGENT';
        const isHigh = updated.priority === 'HIGH';
        const priorityEmoji = isUrgent ? '🔴' : isHigh ? '🟠' : '📋';
        await createNotification({
          userId: technicianId,
          title: `${priorityEmoji} ${isUrgent ? 'Urgent Repair Assigned' : 'Repair Assigned'}: #${updated.repairNumber}`,
          message: `${updated.deviceBrand || ''} ${updated.deviceModel || ''} (${updated.customerName || 'Customer'}) assigned to you by ${req.user!.name}. Priority: ${updated.priority || 'NORMAL'}.`,
          type: isUrgent ? 'REPAIR_URGENT' : 'REPAIR_ASSIGNED',
          priority: updated.priority || 'NORMAL',
          repairId: updated.id,
          repairNumber: updated.repairNumber,
          senderId: req.user!.id,
          senderName: req.user!.name,
          senderRole: req.user!.role,
        });
      } catch (notifErr) {
        console.warn('[ASSIGN NOTIF WARN]', notifErr);
      }
    }

    await broadcastServerChange('Repair', 'UPDATE', id, updated);

    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to assign technician.' });
  }
});

// ----------------------------------------------------
// 15. POST /:id/notes — Add Technician Note
// ----------------------------------------------------
router.post('/:id/notes', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { note, isInternal = true } = req.body;

    if (!note) {
      return res.status(400).json({ error: 'Note text is required.' });
    }

    const noteId = uuidv4();
    const newNote = {
      id: noteId,
      repairId: id,
      technicianId: req.user!.id,
      authorName: req.user!.name,
      authorRole: req.user!.role,
      note: note.trim(),
      isInternal: Boolean(isInternal),
      createdAt: new Date().toISOString(),
    };

    const { data: created, error } = await supabaseAdmin.from('TechnicianNote').insert([newNote]).select('*').single();

    if (error) {
      return res.status(500).json({ error: 'Failed to save note.' });
    }

    // Notify assigned technician or managers if note is from another user
    try {
      const { data: repairRec } = await supabaseAdmin.from('Repair').select('repairNumber, technicianId, createdById').eq('id', id).single();
      if (repairRec) {
        const targetUser = repairRec.technicianId !== req.user!.id ? repairRec.technicianId : repairRec.createdById;
        if (targetUser && targetUser !== req.user!.id) {
          await createNotification({
            userId: targetUser,
            title: `New Note on Repair #${repairRec.repairNumber}`,
            message: `${req.user!.name} (${req.user!.role}) added a note: "${note.slice(0, 100)}${note.length > 100 ? '...' : ''}"`,
            type: 'REPAIR_NOTE',
            priority: 'NORMAL',
            repairId: id,
            repairNumber: repairRec.repairNumber,
            senderId: req.user!.id,
            senderName: req.user!.name,
            senderRole: req.user!.role,
          });
        }
      }
    } catch (notifErr) {
      console.warn('[REPAIR NOTE NOTIF WARN]', notifErr);
    }

    await broadcastServerChange('TechnicianNote', 'CREATE', noteId, created);

    return res.status(201).json(created);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to add repair note.' });
  }
});

// ----------------------------------------------------
// 16. POST /:id/courier-dispatch — Courier Dispatch & Outbound Logistics
// ----------------------------------------------------
router.post('/:id/courier-dispatch', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      courierCompany,
      returnCourierCompany,
      trackingNumber,
      returnCourierTrackingNumber,
      returnCourierDispatchDate,
      destinationDistrict,
      destinationAddress,
      receiverName,
      receiverPhone,
      receiverWhatsapp,
      courierOutCharge,
      courierOutPaymentStatus,
      courierOutStatus,
      notes,
      returnCourierNotes,
      status
    } = req.body;

    const company = (returnCourierCompany || courierCompany || '').trim();
    const tracking = (returnCourierTrackingNumber || trackingNumber || '').trim();
    const now = new Date().toISOString();
    const userId = req.user?.id || 'system';
    const userName = req.user?.name || 'Staff';

    const updatePayload: any = {
      isCourierOut: true,
      returnCourierCompany: company || null,
      returnCourierTrackingNumber: tracking || null,
      returnCourierDispatchDate: returnCourierDispatchDate || now.split('T')[0],
      destinationDistrict: destinationDistrict ? String(destinationDistrict).trim() : null,
      destinationAddress: destinationAddress ? String(destinationAddress).trim() : null,
      receiverName: receiverName ? String(receiverName).trim() : null,
      receiverPhone: receiverPhone ? String(receiverPhone).trim() : null,
      receiverWhatsapp: receiverWhatsapp ? String(receiverWhatsapp).trim() : null,
      returnCourierNotes: returnCourierNotes || notes || null,
      isReturnCourierDispatched: true,
      returnCourierDispatchedAt: now,
      returnCourierDispatchedById: userId,
      returnCourierDispatchedByName: userName,
      courierOutStatus: courierOutStatus || 'DISPATCHED',
      courierStatus: 'DISPATCHED',
      courierOutPaymentStatus: courierOutPaymentStatus || 'UNPAID',
      updatedAt: now,
    };

    if (courierOutCharge !== undefined && courierOutCharge !== null && courierOutCharge !== '') {
      updatePayload.courierOutCharge = Number(courierOutCharge);
    }

    if (status) {
      updatePayload.status = status;
    } else {
      updatePayload.status = 'DISPATCHED_VIA_COURIER';
    }

    const { data: updated, error } = await supabaseAdmin
      .from('Repair')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error('[COURIER DISPATCH UPDATE ERROR]', error);
      return res.status(500).json({ error: error.message || 'Failed to record courier dispatch.' });
    }

    try {
      const logId = uuidv4();
      await supabaseAdmin.from('RepairLog').insert([
        {
          id: logId,
          repairId: id,
          status: updatePayload.status || updated.status,
          message: `Courier logistics updated: ${company || 'Courier'} (AWB #${tracking || 'N/A'}) by ${userName || 'Staff'}`,
          createdAt: now
        }
      ]);
      broadcastServerChange('RepairLog', 'CREATE', logId);
    } catch (logErr) {
      console.warn('[REPAIR LOG NON FATAL]', logErr);
    }

    await broadcastServerChange('Repair', 'UPDATE', id, updated);

    return res.json({ success: true, message: 'Repair courier logistics updated successfully.', repair: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to record courier dispatch.' });
  }
});

// ----------------------------------------------------
// 17. POST /:id/re-problem — Mark Re-problem
// ----------------------------------------------------
router.post('/:id/re-problem', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { description } = req.body;

    const { data: updated, error } = await supabaseAdmin
      .from('Repair')
      .update({
        status: 'RE_PROBLEM',
        remarks: `Warranty recurring problem: ${description}`,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to register re-problem status.' });
    }

    await broadcastServerChange('Repair', 'UPDATE', id, updated);

    return res.json({ success: true, message: 'Repair marked as Re-Problem under warranty.', repair: updated });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update re-problem.' });
  }
});

// ----------------------------------------------------
// 18. DELETE /:id — Delete Repair
// ----------------------------------------------------
router.delete('/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await supabaseAdmin.from('RepairLog').delete().eq('repairId', id);
    await supabaseAdmin.from('TechnicianNote').delete().eq('repairId', id);
    await supabaseAdmin.from('Payment').delete().eq('repairId', id);
    const { error } = await supabaseAdmin.from('Repair').delete().eq('id', id);

    if (error) {
      return res.status(500).json({ error: 'Failed to delete repair.' });
    }

    await broadcastServerChange('Repair', 'DELETE', id);

    return res.json({ success: true, message: 'Repair deleted successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete repair record.' });
  }
});

// ----------------------------------------------------
// 19. POST /:id/transfer-request — Technician Transfer Request
// ----------------------------------------------------
router.post('/:id/transfer-request', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { targetTechnicianId, reason } = req.body;

    const result = await createRepairTransferRequest({
      repairId: id,
      senderId: req.user!.id,
      senderName: req.user!.name,
      senderRole: req.user!.role,
      targetTechnicianId,
      reason,
    });

    if (!result.success) {
      return res.status(result.statusCode || 400).json({ error: result.error });
    }

    return res.status(201).json({
      success: true,
      message: 'Transfer request submitted successfully.',
      transferRequest: result.data,
    });
  } catch (err: any) {
    console.error('[POST /repairs/:id/transfer-request ERROR]', err);
    return res.status(500).json({ error: err.message || 'Failed to submit transfer request.' });
  }
});

// ----------------------------------------------------
// 20. POST /:id/transfer — Manager Direct Transfer / Reassignment
// ----------------------------------------------------
router.post('/:id/transfer', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'LEAD_TECHNICIAN']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { targetTechnicianId, reason, priority } = req.body;

    const result = await directTransferRepair({
      repairId: id,
      actorId: req.user!.id,
      actorName: req.user!.name,
      actorRole: req.user!.role,
      targetTechnicianId,
      reason: reason || 'Direct management reassignment',
      priority,
    });

    if (!result.success) {
      return res.status(result.statusCode || 400).json({ error: result.error });
    }

    return res.json(result.data);
  } catch (err: any) {
    console.error('[POST /repairs/:id/transfer ERROR]', err);
    return res.status(500).json({ error: err.message || 'Failed to transfer repair.' });
  }
});

export default router;
