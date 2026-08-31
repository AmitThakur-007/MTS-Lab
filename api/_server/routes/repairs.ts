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

async function syncBatteryWarrantyFromRepair(repairData: any, reqUser: any) {
  try {
    const isWarrantyActive =
      repairData.hasBatteryWarranty === true ||
      repairData.hasBatteryWarranty === 'true' ||
      Boolean(repairData.batteryWarrantyPeriod);

    if (!isWarrantyActive) return;

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
      // Allow technicians to view their own assigned jobs OR any urgent/high priority tickets globally
      query = query.or(`technicianId.eq.${req.user!.id},priority.eq.URGENT,priority.eq.HIGH`);
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
        notes: `Repair intake recorded by ${req.user!.name}.`,
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

const handleRepairUpdate = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const rawBody = req.body || {};

    const updateData: Record<string, any> = {};
    for (const key of Object.keys(rawBody)) {
      if (ALLOWED_REPAIR_COLUMNS.has(key)) {
        updateData[key] = rawBody[key];
      }
    }

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

// Technician Progress Update Route - Broadcasts change instantly to all roles
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

// Urgent Alert & Priority Escalation Endpoint (Explicitly updates priority field)
router.post('/:id/alert', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'LEAD_TECHNICIAN']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { priority, message } = req.body;

    // Strict priority validation
    const VALID_PRIORITIES = ['NORMAL', 'MEDIUM', 'HIGH', 'URGENT'];
    const resolvedPriority = priority ? String(priority).toUpperCase().trim() : '';

    if (!resolvedPriority || !VALID_PRIORITIES.includes(resolvedPriority)) {
      return res.status(400).json({ error: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}` });
    }

    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: 'Alert message is required.' });
    }

    // Verify repair exists
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

    // Update repair priority
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
      return res.status(500).json({ error: 'Failed to update repair priority.' });
    }

    // Create repair log
    const logId = uuidv4();
    await supabaseAdmin.from('RepairLog').insert([
      {
        id: logId,
        repairId: id,
        userId: req.user!.id,
        action: 'PRIORITY_ALERT_DISPATCHED',
        status: updatedRepair.status,
        notes: `[Priority Alert] ${resolvedPriority} — ${String(message).trim()} (Dispatched by ${req.user!.name})`,
        createdAt: new Date().toISOString()
      }
    ]);
    await broadcastServerChange('RepairLog', 'CREATE', logId);

    // Build priority-aware notification
    const priorityEmoji: Record<string, string> = {
      URGENT: '🔴',
      HIGH: '🟠',
      MEDIUM: '🟡',
      NORMAL: '⚪'
    };
    const emoji = priorityEmoji[resolvedPriority] || '🔔';
    const notifTitle = `${emoji} ${resolvedPriority} Alert: Job #${updatedRepair.repairNumber}`;
    const notifMessage = String(message).trim() || `Priority alert from ${req.user!.name}`;

    // Create notification with priority field
    const notifId = uuidv4();
    await supabaseAdmin.from('Notification').insert([
      {
        id: notifId,
        title: notifTitle,
        message: notifMessage,
        type: 'REPAIR_ALERT',
        priority: resolvedPriority,
        userId: updatedRepair.technicianId,
        repairId: id,
        repairNumber: updatedRepair.repairNumber,
        senderId: req.user!.id,
        senderName: req.user!.name,
        isRead: false,
        createdAt: new Date().toISOString()
      }
    ]);
    await broadcastServerChange('Notification', 'CREATE', notifId);
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
      return res.status(500).json({ error: 'Test dispatch failure.' });
    }

    await broadcastServerChange('Repair', 'UPDATE', id, updated);

    return res.json({ success: true, message: 'Repair successfully dispatched with courier tracking.', repair: updated });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to record courier dispatch.' });
  }
});

router.post('/:id/re-problem', authenticate, async (req, res) => {
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

export default router;