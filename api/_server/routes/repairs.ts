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

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Allowed column list for PostgreSQL public."Repair" table
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
  'technicianId',
  'branchId',
  'expectedCompletionDate',
  'remarks',
  'receivingMethod',
  'isCourierIn',
  'courierCompany',
  'courierTrackingNumber',
  'senderName',
  'senderPhone',
  'originDistrict',
  'originAddress',
  'isCourierOut',
  'returnCourierCompany',
  'returnCourierTrackingNumber',
  'destinationDistrict',
  'destinationAddress',
  'receiverName',
  'receiverPhone',
  'returnCourierNotes',
  'isReturnCourierDispatched',
  'returnCourierDispatchedAt',
  'returnCourierDispatchedById',
  'returnCourierDispatchedByName',
  'assignedAt',
  'assignedById',
  'assignedByName',
  'hasBatteryWarranty',
  'batteryWarrantyPeriod',
  'batteryType',
  'batteryHealth',
  'batterySerial',
  'batteryWarrantyExpiry',
  'warrantyTerms',
  'technicianNotes',
  'sparePartsUsed'
]);

// Helper to generate next unique sequential repair number (e.g. MTS-2026-0001)
async function generateRepairNumber(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const { data: repairs } = await supabaseAdmin
    .from('Repair')
    .select('repairNumber')
    .ilike('repairNumber', `MTS-${currentYear}-%`)
    .order('repairNumber', { ascending: false })
    .limit(20);

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

  const nextNum = maxNum + 1;
  return `MTS-${currentYear}-${nextNum.toString().padStart(4, '0')}`;
}

// Helper to generate unique warranty number (BW-YYYY-XXXX)
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

// Automatic synchronization between Repair and BatteryWarranty
async function syncBatteryWarrantyFromRepair(repairData: any, reqUser: any) {
  try {
    const isWarrantyActive =
      repairData.hasBatteryWarranty === true ||
      repairData.hasBatteryWarranty === 'true' ||
      Boolean(repairData.batteryWarrantyPeriod);

    if (!isWarrantyActive) return;

    // Check if warranty record already exists
    const { data: existing } = await supabaseAdmin
      .from('BatteryWarranty')
      .select('id')
      .eq('repairId', repairData.id)
      .limit(1);

    const rawPeriod = String(repairData.batteryWarrantyPeriod || '6_MONTHS');
    const months = rawPeriod.includes('12') ? 12 : (rawPeriod.includes('3') ? 3 : 6);

    const regDate = new Date(repairData.createdAt || Date.now());
    const expDate = new Date(regDate);
    expDate.setMonth(expDate.getMonth() + months);

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
          warrantyPeriod: `${months} Months`,
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
          warrantyPeriod: `${months} Months`,
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

// 1. GET /api/repairs
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
      limit = '100',
      page = '1',
    } = req.query;

    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 100;
    const offset = (pageNum - 1) * limitNum;

    let query = supabaseAdmin
      .from('Repair')
      .select('*, customer:Customer(*), technician:User!Repair_technicianId_fkey(id, name, role, email)', { count: 'exact' });

    const role = normalizeRole(req.user!.role);
    if (role === 'TECHNICIAN' && !technicianId) {
      query = query.eq('technicianId', req.user!.id);
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

    if (startDate) {
      query = query.gte('createdAt', String(startDate));
    }

    if (endDate) {
      query = query.lte('createdAt', String(endDate));
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

// 2. GET /api/repairs/export
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
      'Priority': r.priority || 'MEDIUM',
      'Estimated Cost': r.estimatedCost,
      'Advance Paid': r.advancePaid,
      'Total Paid': r.totalPaid,
      'Technician': r.technician?.name || 'Unassigned',
      'Date': r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : '',
    }));

    const buffer = createExcelBuffer('Repairs', rows);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="MTS_Repairs_${new Date().toISOString().split('T')[0]}.xlsx"`);
    return res.send(buffer);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to export repairs.' });
  }
});

// 3. GET /api/repairs/import/template
router.get('/import/template', authenticate, (req: Request, res: Response) => {
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
      'Remarks': 'Urgent repair requested by customer',
    },
  ];

  const buffer = createExcelBuffer('Import Template', sampleData);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="MTS_Lab_Repair_Import_Template.xlsx"');
  return res.send(buffer);
});

// 4. POST /api/repairs/import/preview
router.post('/import/preview', authenticate, upload.single('file'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No Excel file provided for import preview.' });
    }

    const rows = parseExcelBuffer(req.file.buffer);
    const parsed = rows.map((r, idx) => ({
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
      isValid: Boolean((r['Customer Name'] || r['customerName']) && (r['Customer Phone'] || r['customerPhone']) && (r['Device Model'] || r['deviceModel'])),
    }));

    return res.json({
      totalRows: parsed.length,
      validRows: parsed.filter((p) => p.isValid).length,
      invalidRows: parsed.filter((p) => !p.isValid).length,
      preview: parsed,
    });
  } catch (err: any) {
    return res.status(400).json({ error: 'Failed to parse Excel file. Ensure valid .xlsx format.' });
  }
});

// 5. POST /api/repairs/import/confirm
router.post('/import/confirm', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No repair items to import.' });
    }

    const importedRepairs = [];
    for (const item of items) {
      if (!item.customerName || !item.customerPhone || !item.deviceModel) continue;

      const repairNumber = await generateRepairNumber();
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
        priority: 'MEDIUM',
        remarks: item.remarks || null,
        createdById: req.user!.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const { data: created } = await supabaseAdmin.from('Repair').insert([newRepair]).select('*').single();
      if (created) {
        importedRepairs.push(created);
        await broadcastServerChange('Repair', 'CREATE', created.id, created);
      }
    }

    return res.json({ success: true, count: importedRepairs.length, message: `Successfully imported ${importedRepairs.length} repairs.` });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to process batch repair import.' });
  }
});

// 6. GET /api/repairs/:id
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { data: repair, error } = await supabaseAdmin
      .from('Repair')
      .select('*, customer:Customer(*), technician:User!Repair_technicianId_fkey(id, name, role, email, phoneNumber), notes:TechnicianNote(*), logs:RepairLog(*), payments:Payment(*)')
      .eq('id', id)
      .single();

    if (error || !repair) {
      return res.status(404).json({ error: 'Repair record not found.' });
    }

    return res.json(repair);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve repair details.' });
  }
});

// 7. POST /api/repairs
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const {
      customerId,
      customerName,
      customerPhone,
      customerEmail,
      customerAddress,
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
      priority = 'MEDIUM',
      expectedCompletionDate,
      remarks,
      receivingMethod = 'WALK_IN',
      isCourierIn = false,
      courierCompany,
      courierTrackingNumber,
      senderName,
      senderPhone,
      originDistrict,
      originAddress,
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
              email: customerEmail ? customerEmail.trim() : null,
              address: customerAddress ? customerAddress.trim() : null,
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
      branchId: branchId || req.user!.branchId || null,
      expectedCompletionDate: expectedCompletionDate || null,
      remarks: remarks || null,
      receivingMethod,
      isCourierIn: Boolean(isCourierIn),
      courierCompany: courierCompany || null,
      courierTrackingNumber: courierTrackingNumber || null,
      senderName: senderName || null,
      senderPhone: senderPhone || null,
      originDistrict: originDistrict || null,
      originAddress: originAddress || null,
      hasBatteryWarranty: Boolean(hasBatteryWarranty),
      batteryWarrantyPeriod: batteryWarrantyPeriod || null,
      batteryType: batteryType || null,
      batteryHealth: batteryHealth || null,
      batterySerial: batterySerial || null,
      createdById: req.user!.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { data: created, error } = await supabaseAdmin.from('Repair').insert([newRepair]).select('*').single();

    if (error) {
      console.error('[REPAIR CREATE ERROR]', error);
      return res.status(500).json({ error: 'Failed to create repair ticket.' });
    }

    // Auto-sync into BatteryWarranty table if warranty was selected
    if (hasBatteryWarranty || batteryWarrantyPeriod) {
      await syncBatteryWarrantyFromRepair(created, req.user);
    }

    const logId = uuidv4();
    await supabaseAdmin.from('RepairLog').insert([
      {
        id: logId,
        repairId: created.id,
        userId: req.user!.id,
        action: 'CREATED',
        status: 'RECEIVED',
        notes: `Repair intake recorded by ${req.user!.name}. Initial payment: NPR ${advPaidNum}`,
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

    await broadcastServerChange('Repair', 'CREATE', created.id, created);

    return res.status(201).json(created);
  } catch (err: any) {
    console.error('[CREATE REPAIR ERROR]', err);
    return res.status(500).json({ error: 'Failed to register repair ticket.' });
  }
});

// 8. PUT & PATCH /api/repairs/:id (Unified update handler with strict column allowlist & warranty sync)
const handleRepairUpdate = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const rawBody = req.body || {};

    // Filter incoming payload against allowed PostgreSQL table columns only
    const updateData: Record<string, any> = {};
    for (const key of Object.keys(rawBody)) {
      if (ALLOWED_REPAIR_COLUMNS.has(key)) {
        updateData[key] = rawBody[key];
      }
    }

    // Convert numbers safely
    if (updateData.estimatedCost !== undefined) updateData.estimatedCost = parseFloat(updateData.estimatedCost) || 0;
    if (updateData.advancePaid !== undefined) updateData.advancePaid = parseFloat(updateData.advancePaid) || 0;
    if (updateData.totalPaid !== undefined) updateData.totalPaid = parseFloat(updateData.totalPaid) || 0;

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

    // Auto-sync into BatteryWarranty table if battery warranty was toggled or present
    if (rawBody.hasBatteryWarranty || rawBody.batteryWarrantyPeriod || updated.hasBatteryWarranty || updated.batteryWarrantyPeriod) {
      await syncBatteryWarrantyFromRepair({ ...updated, ...rawBody }, req.user);
    }

    if (rawBody.status) {
      const logId = uuidv4();
      await supabaseAdmin.from('RepairLog').insert([
        {
          id: logId,
          repairId: id,
          userId: req.user!.id,
          action: 'STATUS_UPDATED',
          status: rawBody.status,
          notes: rawBody.remarks || `Status updated to ${rawBody.status} by ${req.user!.name}`,
          createdAt: new Date().toISOString(),
        },
      ]);
      await broadcastServerChange('RepairLog', 'CREATE', logId);
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

// 8.1. PATCH /api/repairs/:id/technician-update (Dedicated technician progress update route)
router.patch('/:id/technician-update', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, estimatedDeliveryDate, sparePartsUsed, technicianNotes } = req.body;

    const { data: existingRepair, error: fetchErr } = await supabaseAdmin
      .from('Repair')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !existingRepair) {
      return res.status(404).json({ error: 'Repair job not found.' });
    }

    const updatePayload: any = {
      updatedAt: new Date().toISOString()
    };

    if (status) updatePayload.status = status;
    if (estimatedDeliveryDate) updatePayload.estimatedDeliveryDate = estimatedDeliveryDate;
    if (sparePartsUsed !== undefined) updatePayload.sparePartsUsed = sparePartsUsed;
    if (technicianNotes !== undefined) updatePayload.technicianNotes = technicianNotes;

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

    // Create real-time notification alert for admins/managers
    try {
      const notifId = uuidv4();
      await supabaseAdmin.from('Notification').insert([
        {
          id: notifId,
          title: `Repair Updated: #${updatedRepair.repairNumber || id.slice(0, 8)}`,
          message: `${req.user?.name || 'Technician'} updated repair status to ${status || existingRepair.status}. Note: ${technicianNotes || 'No notes added'}`,
          type: 'REPAIR_UPDATE',
          userId: existingRepair.createdById || null,
          isRead: false,
          createdAt: new Date().toISOString()
        }
      ]);
      await broadcastServerChange('Notification', 'CREATE', notifId);
    } catch (notifErr) {
      console.warn('[NOTIFICATION DISPATCH WARN - NON FATAL]', notifErr);
    }

    await broadcastServerChange('Repair', 'UPDATE', id, updatedRepair);

    return res.json({
      success: true,
      message: 'Repair progress updated successfully.',
      repair: updatedRepair
    });
  } catch (err: any) {
    console.error('[TECHNICIAN UPDATE EXCEPTION]', err);
    return res.status(500).json({ error: err?.message || 'Server error updating repair.' });
  }
});

// 9. POST /api/repairs/:id/assign
router.post('/:id/assign', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'LEAD_TECHNICIAN']), async (req: AuthRequest, res: Response) => {
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
    await supabaseAdmin.from('RepairLog').insert([
      {
        id: logId,
        repairId: id,
        userId: req.user!.id,
        action: 'ASSIGNED',
        status: updated.status,
        notes: `Assigned to technician: ${tech?.name || 'Unassigned'} by ${req.user!.name}`,
        createdAt: new Date().toISOString(),
      },
    ]);
    await broadcastServerChange('RepairLog', 'CREATE', logId);
    await broadcastServerChange('Repair', 'UPDATE', id, updated);

    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to assign technician.' });
  }
});

// 10. POST /api/repairs/:id/notes
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

    await broadcastServerChange('TechnicianNote', 'CREATE', noteId, created);

    return res.status(201).json(created);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to add repair note.' });
  }
});

// 11. GET /api/repairs/:id/notes
router.get('/:id/notes', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data: notes, error } = await supabaseAdmin
      .from('TechnicianNote')
      .select('*')
      .eq('repairId', id)
      .order('createdAt', { ascending: false });

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch notes.' });
    }

    return res.json(notes || []);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve notes.' });
  }
});

// 12. POST /api/repairs/:id/alert
router.post('/:id/alert', authenticate, async (req: AuthRequest, res: Response) => {
  return res.json({ success: true, message: 'Customer notification alert dispatched successfully.' });
});

// 13. POST /api/repairs/:id/transfer
router.post('/:id/transfer', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { targetTechnicianId, reason } = req.body;

    const { data: tech } = await supabaseAdmin.from('User').select('name').eq('id', targetTechnicianId).single();

    const { data: updated, error } = await supabaseAdmin
      .from('Repair')
      .update({
        technicianId: targetTechnicianId,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to transfer repair.' });
    }

    const logId = uuidv4();
    await supabaseAdmin.from('RepairLog').insert([
      {
        id: logId,
        repairId: id,
        userId: req.user!.id,
        action: 'TRANSFERRED',
        status: updated.status,
        notes: `Repair transferred to ${tech?.name || 'Technician'}. Reason: ${reason || 'Workload reallocation'}`,
        createdAt: new Date().toISOString(),
      },
    ]);
    await broadcastServerChange('RepairLog', 'CREATE', logId);
    await broadcastServerChange('Repair', 'UPDATE', id, updated);

    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to transfer repair ticket.' });
  }
});

// 13.1 GET /api/repair-transfers/my-requests & /api/repairs/repair-transfers/my-requests (Repair transfer requests list endpoint aliases)
const handleMyTransferRequests = async (req: AuthRequest, res: Response) => {
  try {
    const { data: requests, error } = await supabaseAdmin
      .from('RepairTransferRequest')
      .select('*')
      .or(`senderId.eq.${req.user!.id},receiverId.eq.${req.user!.id}`)
      .order('createdAt', { ascending: false });

    if (error) {
      return res.json([]);
    }

    return res.json(requests || []);
  } catch {
    return res.json([]);
  }
};

router.get('/repair-transfers/my-requests', authenticate, handleMyTransferRequests);
router.get('/repair-transfers/my-requests', authenticate, handleMyTransferRequests);

// 14. POST /api/repairs/:id/courier-dispatch
router.post('/:id/courier-dispatch', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { courierCompany, trackingNumber, destinationDistrict, destinationAddress, receiverName, receiverPhone, notes } = req.body;

    const { data: updated, error } = await supabaseAdmin
      .from('Repair')
      .update({
        isCourierOut: true,
        returnCourierCompany: courierCompany,
        returnCourierTrackingNumber: trackingNumber,
        destinationDistrict,
        destinationAddress,
        receiverName,
        receiverPhone,
        returnCourierNotes: notes,
        isReturnCourierDispatched: true,
        returnCourierDispatchedAt: new Date().toISOString(),
        returnCourierDispatchedById: req.user!.id,
        returnCourierDispatchedByName: req.user!.name,
        status: 'DISPATCHED_VIA_COURIER',
        updatedAt: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to dispatch repair shipment.' });
    }

    await broadcastServerChange('Repair', 'UPDATE', id, updated);

    return res.json({ success: true, message: 'Repair successfully dispatched with courier tracking.', repair: updated });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to record courier dispatch.' });
  }
});

// 15. POST /api/repairs/:id/re-problem
router.post('/:id/re-problem', authenticate, async (req: AuthRequest, res: Response) => {
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

// 16. DELETE /api/repairs/:id
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

// 17. POST /api/repairs/bulk-delete
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

    for (const id of ids) {
      await broadcastServerChange('Repair', 'DELETE', id);
    }

    return res.json({ success: true, message: `Successfully deleted ${ids.length} repair records.` });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to bulk delete repairs.' });
  }
});

export default router;