import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { logAudit } from '../services/auditService';
import { broadcastServerChange } from '../services/realtimeSync';

const router = Router();

// ==========================================
// 1. GET /api/couriers (List All Shipments)
// ==========================================
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const {
      type,
      status,
      courierCompany,
      district,
      paymentStatus,
      dateRange,
      startDate,
      endDate,
      search,
      sortBy = 'latest'
    } = req.query;

    let query = supabaseAdmin
      .from('Repair')
      .select('*')
      .or('isCourierIn.eq.true,isCourierOut.eq.true,isReturnCourierDispatched.eq.true');

    if (type === 'INCOMING') {
      query = query.eq('isCourierIn', true);
    } else if (type === 'OUTGOING') {
      query = query.or('isCourierOut.eq.true,isReturnCourierDispatched.eq.true');
    }

    if (status && status !== 'ALL') {
      query = query.or(`courierStatus.eq.${status},courierInStatus.eq.${status},courierOutStatus.eq.${status}`);
    }

    if (courierCompany && courierCompany !== 'ALL') {
      query = query.or(`courierCompany.eq.${courierCompany},returnCourierCompany.eq.${courierCompany}`);
    }

    if (district && district !== 'ALL') {
      query = query.or(`originDistrict.eq.${district},destinationDistrict.eq.${district}`);
    }

    if (paymentStatus && paymentStatus !== 'ALL') {
      query = query.or(`courierInPaymentStatus.eq.${paymentStatus},courierOutPaymentStatus.eq.${paymentStatus}`);
    }

    if (startDate) {
      query = query.gte('createdAt', new Date(String(startDate)).toISOString());
    }
    if (endDate) {
      const end = new Date(String(endDate));
      end.setHours(23, 59, 59, 999);
      query = query.lte('createdAt', end.toISOString());
    }

    if (search) {
      const s = String(search).trim();
      query = query.or(`repairNumber.ilike.%${s}%,courierTrackingNumber.ilike.%${s}%,returnCourierTrackingNumber.ilike.%${s}%,customerName.ilike.%${s}%,customerPhone.ilike.%${s}%,senderName.ilike.%${s}%,receiverName.ilike.%${s}%,senderPhone.ilike.%${s}%,receiverPhone.ilike.%${s}%,imeiNumber.ilike.%${s}%`);
    }

    if (sortBy === 'oldest') {
      query = query.order('createdAt', { ascending: true });
    } else if (sortBy === 'customer') {
      query = query.order('customerName', { ascending: true });
    } else {
      query = query.order('updatedAt', { ascending: false });
    }

    const { data: shipments, error } = await query;

    if (error) {
      console.error('[COURIERS GET ERROR]', error);
      return res.status(500).json({ error: 'Failed to fetch courier shipments.' });
    }

    return res.json({
      success: true,
      shipments: shipments || []
    });
  } catch (err: any) {
    console.error('[COURIERS GET EXCEPTION]', err);
    return res.status(500).json({ error: 'Failed to retrieve courier records.' });
  }
});

// ==========================================
// 2. GET /api/couriers/stats
// ==========================================
router.get('/stats', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { data: records, error } = await supabaseAdmin
      .from('Repair')
      .select('isCourierIn, isCourierOut, isReturnCourierDispatched, courierStatus, courierInStatus, courierOutStatus, courierInCharge, courierOutCharge, createdAt')
      .or('isCourierIn.eq.true,isCourierOut.eq.true,isReturnCourierDispatched.eq.true');

    if (error) {
      console.error('[COURIERS STATS ERROR]', error);
    }

    const list = records || [];
    let incomingTotal = 0;
    let outgoingTotal = 0;
    let inTransit = 0;
    let receivedAtLab = 0;
    let readyForDispatch = 0;
    let dispatched = 0;
    let delivered = 0;
    let totalCharges = 0;

    const todayStr = new Date().toISOString().slice(0, 10);
    let incomingToday = 0;
    let outgoingToday = 0;

    list.forEach((r: any) => {
      const isOut = r.isCourierOut || r.isReturnCourierDispatched || r.courierOutStatus;
      const isIn = r.isCourierIn || (!isOut && r.courierInStatus);

      if (isIn) {
        incomingTotal++;
        if (r.createdAt && String(r.createdAt).startsWith(todayStr)) incomingToday++;
      }
      if (isOut) {
        outgoingTotal++;
        if (r.createdAt && String(r.createdAt).startsWith(todayStr)) outgoingToday++;
      }

      const currentStatus = String(r.courierOutStatus || r.courierInStatus || r.courierStatus || '').toUpperCase();

      if (currentStatus === 'IN_TRANSIT') inTransit++;
      else if (currentStatus === 'RECEIVED_AT_LAB' || currentStatus === 'RECEIVED') receivedAtLab++;
      else if (currentStatus === 'READY_FOR_DISPATCH' || currentStatus === 'READY') readyForDispatch++;
      else if (currentStatus === 'DISPATCHED' || currentStatus === 'COURIER_DISPATCHED') dispatched++;
      else if (currentStatus === 'DELIVERED') delivered++;

      if (r.courierInCharge) totalCharges += Number(r.courierInCharge) || 0;
      if (r.courierOutCharge) totalCharges += Number(r.courierOutCharge) || 0;
    });

    return res.json({
      totalShipments: list.length,
      incomingTotal,
      outgoingTotal,
      incomingToday,
      outgoingToday,
      inTransit,
      receivedAtLab,
      readyForDispatch,
      dispatched,
      delivered,
      totalCharges
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to compute courier statistics.' });
  }
});

// ==========================================
// 3. GET /api/couriers/eligible-repairs
// ==========================================
router.get('/eligible-repairs', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { data: repairs, error } = await supabaseAdmin
      .from('Repair')
      .select('id, repairNumber, customerName, customerPhone, customerAddress, deviceBrand, deviceModel, status, totalPaid, estimatedCost, customer:CustomerId(name, phone, address, district)')
      .order('createdAt', { ascending: false })
      .limit(100);

    if (error) {
      console.error('[ELIGIBLE REPAIRS ERROR]', error);
      return res.status(500).json({ error: 'Failed to load eligible repair jobs.' });
    }

    return res.json(repairs || []);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to load eligible repairs.' });
  }
});

// ==========================================
// 4. GET /api/couriers/filters-metadata
// ==========================================
router.get('/filters-metadata', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { data: repairs } = await supabaseAdmin
      .from('Repair')
      .select('courierCompany, returnCourierCompany, originDistrict, destinationDistrict')
      .or('isCourierIn.eq.true,isCourierOut.eq.true,isReturnCourierDispatched.eq.true');

    const companies = new Set<string>();
    const districts = new Set<string>();

    (repairs || []).forEach((r: any) => {
      if (r.courierCompany) companies.add(r.courierCompany);
      if (r.returnCourierCompany) companies.add(r.returnCourierCompany);
      if (r.originDistrict) districts.add(r.originDistrict);
      if (r.destinationDistrict) districts.add(r.destinationDistrict);
    });

    return res.json({
      courierCompanies: Array.from(companies),
      districts: Array.from(districts),
    });
  } catch (err: any) {
    return res.json({ courierCompanies: [], districts: [] });
  }
});

// ==========================================
// 5. GET /api/couriers/search-customers
// ==========================================
router.get('/search-customers', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { query: queryTerm } = req.query;
    if (!queryTerm) return res.json([]);

    const term = String(queryTerm).trim();
    const { data: customers } = await supabaseAdmin
      .from('Customer')
      .select('id, name, phone, alternativePhone, address, district, municipality')
      .or(`phone.ilike.%${term}%,name.ilike.%${term}%,alternativePhone.ilike.%${term}%`)
      .limit(10);

    return res.json(customers || []);
  } catch (err: any) {
    return res.json([]);
  }
});

// ==========================================
// 6. POST /api/couriers/check-duplicate-awb
// ==========================================
router.post('/check-duplicate-awb', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { trackingNumber } = req.body;
    if (!trackingNumber) return res.json({ exists: false });

    const awb = String(trackingNumber).trim();
    const { data: existing } = await supabaseAdmin
      .from('Repair')
      .select('id, repairNumber, customerName')
      .or(`courierTrackingNumber.eq.${awb},returnCourierTrackingNumber.eq.${awb}`)
      .limit(1);

    return res.json({
      exists: Boolean(existing && existing.length > 0),
      duplicateRepair: existing?.[0] || null,
    });
  } catch (err: any) {
    return res.json({ exists: false });
  }
});

// ==========================================
// 7. POST /api/couriers/incoming (Inbound Package)
// ==========================================
router.post('/incoming', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const {
      existingRepairId,
      courierCompany,
      courierTrackingNumber,
      originDistrict = 'Kathmandu',
      originAddress,
      senderName,
      senderPhone,
      senderWhatsapp,
      courierInCharge,
      courierInPaymentStatus = 'UNPAID',
      courierDate,
      courierReceivedDate,
      courierNotes,
      customerName,
      customerPhone,
      customerWhatsapp,
      customerDistrict,
      customerMunicipality,
      customerAddress,
      deviceBrand,
      deviceModel,
      imeiNumber,
      deviceCondition,
      problemDescription,
      accessoriesReceived
    } = req.body;

    if (!courierCompany || !courierTrackingNumber) {
      return res.status(400).json({ error: 'Courier partner and tracking number are required.' });
    }

    const userId = req.user?.id || 'system';
    const userName = req.user?.name || 'Staff';
    const now = new Date().toISOString();

    // SCENARIO 1: LINK TO EXISTING REPAIR WORKORDER
    if (existingRepairId) {
      const { data: existingRepair, error: fetchErr } = await supabaseAdmin
        .from('Repair')
        .select('*')
        .eq('id', existingRepairId)
        .single();

      if (fetchErr || !existingRepair) {
        return res.status(404).json({ error: 'Selected repair ticket was not found.' });
      }

      const updatePayload: any = {
        isCourierIn: true,
        courierCompany: courierCompany.trim(),
        courierTrackingNumber: courierTrackingNumber.trim(),
        courierInStatus: 'RECEIVED_AT_LAB',
        courierStatus: 'RECEIVED_AT_LAB',
        originDistrict: originDistrict || existingRepair.originDistrict || 'Kathmandu',
        originAddress: originAddress || existingRepair.originAddress || null,
        senderName: senderName || existingRepair.customerName || 'Customer',
        senderPhone: senderPhone || existingRepair.customerPhone || '',
        senderWhatsapp: senderWhatsapp || null,
        courierInPaymentStatus: courierInPaymentStatus || 'UNPAID',
        courierDate: courierDate || now,
        courierReceivedDate: courierReceivedDate || now,
        courierNotes: courierNotes || null,
        updatedAt: now
      };

      if (courierInCharge !== undefined && courierInCharge !== null && courierInCharge !== '') {
        updatePayload.courierInCharge = Number(courierInCharge);
      }

      const { data: updatedRepair, error: updateErr } = await supabaseAdmin
        .from('Repair')
        .update(updatePayload)
        .eq('id', existingRepairId)
        .select('*')
        .single();

      if (updateErr) {
        console.error('[COURIER INCOMING UPDATE ERROR]', updateErr);
        return res.status(500).json({ error: updateErr.message || 'Failed to update repair courier details.' });
      }

      try {
        await supabaseAdmin.from('RepairLog').insert([
          {
            id: uuidv4(),
            repairId: existingRepairId,
            message: `Inbound courier shipment received via ${courierCompany} (AWB #${courierTrackingNumber}).`,
            action: 'COURIER_INBOUND_RECEIVED',
            performedById: userId,
            performedByName: userName,
            createdAt: now
          }
        ]);
      } catch (logErr) {
        console.warn('[REPAIR LOG FAILED - NON FATAL]', logErr);
      }

      await broadcastServerChange('Repair', 'UPDATE', existingRepairId, updatedRepair);

      return res.json({
        success: true,
        message: `Inbound shipment linked to Repair #${existingRepair.repairNumber} successfully.`,
        repair: updatedRepair
      });
    }

    // SCENARIO 2: NEW INTAKE TICKET VIA COURIER
    if (!customerName || !customerPhone || !deviceModel) {
      return res.status(400).json({ error: 'Customer Name, Phone, and Device Model are required for new intake.' });
    }

    let customerId = req.body.customerId;
    if (!customerId) {
      const { data: existingCust } = await supabaseAdmin
        .from('Customer')
        .select('id')
        .eq('phone', customerPhone.trim())
        .maybeSingle();

      if (existingCust) {
        customerId = existingCust.id;
      } else {
        const newCustomerId = uuidv4();
        const { data: newCust, error: custErr } = await supabaseAdmin
          .from('Customer')
          .insert([
            {
              id: newCustomerId,
              name: customerName.trim(),
              phone: customerPhone.trim(),
              alternativePhone: customerWhatsapp || null,
              district: customerDistrict || originDistrict || 'Kathmandu',
              municipality: customerMunicipality || null,
              address: customerAddress || originAddress || null,
              createdAt: now,
              updatedAt: now
            }
          ])
          .select('id')
          .single();

        customerId = (!custErr && newCust) ? newCust.id : newCustomerId;
      }
    }

    const generatedRepairNumber = `MTS-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
    const newRepairId = uuidv4();

    const newRepairPayload: any = {
      id: newRepairId,
      repairNumber: generatedRepairNumber,
      customerId: customerId || null,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      deviceBrand: (deviceBrand || 'apple').toLowerCase(),
      deviceModel: deviceModel.trim(),
      imeiNumber: imeiNumber || null,
      deviceCondition: deviceCondition || 'Good (Minor Wear)',
      problemDescription: problemDescription || 'Courier Intake - Diagnostics & Repair',
      accessoriesReceived: accessoriesReceived || null,
      status: 'RECEIVED',
      priority: 'MEDIUM',
      paymentStatus: 'UNPAID',
      receivingMethod: 'COURIER',
      isCourierIn: true,
      courierCompany: courierCompany.trim(),
      courierTrackingNumber: courierTrackingNumber.trim(),
      courierInStatus: 'RECEIVED_AT_LAB',
      courierStatus: 'RECEIVED_AT_LAB',
      originDistrict: originDistrict || customerDistrict || 'Kathmandu',
      originAddress: originAddress || customerAddress || null,
      senderName: senderName || customerName.trim(),
      senderPhone: senderPhone || customerPhone.trim(),
      senderWhatsapp: senderWhatsapp || null,
      courierInPaymentStatus: courierInPaymentStatus || 'UNPAID',
      courierDate: courierDate || now,
      courierReceivedDate: courierReceivedDate || now,
      courierNotes: courierNotes || null,
      createdById: userId,
      createdAt: now,
      updatedAt: now
    };

    if (courierInCharge !== undefined && courierInCharge !== null && courierInCharge !== '') {
      newRepairPayload.courierInCharge = Number(courierInCharge);
    }

    const { data: createdRepair, error: createErr } = await supabaseAdmin
      .from('Repair')
      .insert([newRepairPayload])
      .select('*')
      .single();

    if (createErr) {
      console.error('[COURIER INCOMING CREATE ERROR]', createErr);
      return res.status(500).json({ error: createErr.message || 'Failed to create repair from courier intake.' });
    }

    try {
      await supabaseAdmin.from('RepairLog').insert([
        {
          id: uuidv4(),
          repairId: newRepairId,
          message: `Device intake registered via courier (${courierCompany}, AWB #${courierTrackingNumber}).`,
          action: 'COURIER_INBOUND_CREATED',
          performedById: userId,
          performedByName: userName,
          createdAt: now
        }
      ]);
    } catch (logErr) {
      console.warn('[REPAIR LOG FAILED - NON FATAL]', logErr);
    }

    await broadcastServerChange('Repair', 'CREATE', newRepairId, createdRepair);

    return res.status(201).json({
      success: true,
      message: `Inbound courier registered under Repair Job #${generatedRepairNumber}`,
      repair: createdRepair
    });

  } catch (err: any) {
    console.error('[COURIER INCOMING EXCEPTION]', err);
    return res.status(500).json({ error: err?.message || 'Server error recording incoming courier parcel.' });
  }
});

// ==========================================
// 8. POST /api/couriers/outgoing (Outbound Dispatch)
// ==========================================
router.post('/outgoing', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const {
      repairId,
      receiverName,
      receiverPhone,
      receiverWhatsapp,
      destinationDistrict,
      destinationAddress,
      returnCourierCompany,
      returnCourierTrackingNumber,
      returnCourierDispatchDate,
      courierOutCharge,
      courierOutPaymentStatus = 'UNPAID',
      returnCourierNotes,
    } = req.body;

    if (!repairId) {
      return res.status(400).json({ error: 'Repair ID is required for outgoing dispatch.' });
    }

    const now = new Date().toISOString();
    const userId = req.user?.id || 'system';
    const userName = req.user?.name || 'Staff';

    const updatePayload: any = {
      isCourierOut: true,
      receiverName: receiverName || null,
      receiverPhone: receiverPhone || null,
      receiverWhatsapp: receiverWhatsapp || null,
      destinationDistrict: destinationDistrict || null,
      destinationAddress: destinationAddress || null,
      returnCourierCompany: returnCourierCompany ? returnCourierCompany.trim() : null,
      returnCourierTrackingNumber: returnCourierTrackingNumber ? returnCourierTrackingNumber.trim() : null,
      returnCourierNotes: returnCourierNotes || null,
      returnCourierDispatchDate: returnCourierDispatchDate || now,
      isReturnCourierDispatched: true,
      returnCourierDispatchedAt: now,
      returnCourierDispatchedById: userId,
      returnCourierDispatchedByName: userName,
      courierOutPaymentStatus: courierOutPaymentStatus || 'UNPAID',
      courierOutStatus: 'DISPATCHED',
      courierStatus: 'DISPATCHED',
      status: 'DISPATCHED_VIA_COURIER',
      updatedAt: now,
    };

    if (courierOutCharge !== undefined && courierOutCharge !== null && courierOutCharge !== '') {
      updatePayload.courierOutCharge = Number(courierOutCharge);
    }

    const { data: updated, error } = await supabaseAdmin
      .from('Repair')
      .update(updatePayload)
      .eq('id', repairId)
      .select('*')
      .single();

    if (error) {
      console.error('[COURIER OUTGOING ERROR]', error);
      return res.status(500).json({ error: error.message || 'Failed to dispatch courier.' });
    }

    try {
      await supabaseAdmin.from('RepairLog').insert([
        {
          id: uuidv4(),
          repairId,
          message: `Device dispatched to customer via ${returnCourierCompany} (AWB #${returnCourierTrackingNumber}).`,
          action: 'COURIER_OUTBOUND_DISPATCHED',
          performedById: userId,
          performedByName: userName,
          createdAt: now
        }
      ]);
    } catch (logErr) {
      console.warn('[REPAIR LOG FAILED - NON FATAL]', logErr);
    }

    await broadcastServerChange('Repair', 'UPDATE', repairId, updated);

    return res.json({
      success: true,
      message: 'Shipment dispatched successfully.',
      repair: updated
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to record outgoing dispatch.' });
  }
});

// ==========================================
// 9. PATCH /api/couriers/:id/status
// ==========================================
router.patch('/:id/status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, courierType, notes } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required.' });
    }

    const now = new Date().toISOString();
    const updatePayload: any = {
      courierStatus: status,
      updatedAt: now
    };

    if (courierType === 'INCOMING') {
      updatePayload.courierInStatus = status;
    } else {
      updatePayload.courierOutStatus = status;
      if (status === 'DELIVERED') {
        updatePayload.status = 'DELIVERED';
      }
    }

    const { data: updated, error } = await supabaseAdmin
      .from('Repair')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: 'Failed to update status.' });

    try {
      await supabaseAdmin.from('RepairLog').insert([
        {
          id: uuidv4(),
          repairId: id,
          message: `Logistics status updated to ${status}${notes ? `: ${notes}` : ''}`,
          action: 'COURIER_STATUS_UPDATED',
          performedById: req.user?.id || 'system',
          performedByName: req.user?.name || 'Staff',
          createdAt: now
        }
      ]);
    } catch (logErr) {
      console.warn('[REPAIR LOG FAILED - NON FATAL]', logErr);
    }

    await broadcastServerChange('Repair', 'UPDATE', id, updated);

    return res.json({
      success: true,
      message: 'Courier status updated.',
      repair: updated
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update courier status.' });
  }
});

// ==========================================
// 10. POST /api/couriers/bulk-status
// ==========================================
router.post('/bulk-status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { repairIds, ids, status, courierType, notes } = req.body;
    const targetIds = repairIds || ids;

    if (!targetIds || !Array.isArray(targetIds) || targetIds.length === 0) {
      return res.status(400).json({ error: 'No shipment IDs provided.' });
    }

    const now = new Date().toISOString();
    const updatePayload: any = {
      courierStatus: status,
      updatedAt: now
    };

    if (courierType === 'INCOMING') {
      updatePayload.courierInStatus = status;
    } else {
      updatePayload.courierOutStatus = status;
    }

    const { error } = await supabaseAdmin
      .from('Repair')
      .update(updatePayload)
      .in('id', targetIds);

    if (error) return res.status(500).json({ error: 'Failed to bulk update status.' });

    for (const id of targetIds) {
      await broadcastServerChange('Repair', 'UPDATE', id);
    }

    return res.json({
      success: true,
      message: `Updated ${targetIds.length} shipments.`
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to perform bulk status update.' });
  }
});

// ==========================================
// 11. POST /api/couriers/bulk-archive
// ==========================================
router.post('/bulk-archive', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { repairIds, ids } = req.body;
    const targetIds = repairIds || ids;

    if (!targetIds || !Array.isArray(targetIds) || targetIds.length === 0) {
      return res.status(400).json({ error: 'No IDs provided.' });
    }

    const { error } = await supabaseAdmin
      .from('Repair')
      .update({
        courierStatus: 'ARCHIVED',
        updatedAt: new Date().toISOString()
      })
      .in('id', targetIds);

    if (error) return res.status(500).json({ error: 'Failed to archive shipments.' });

    for (const id of targetIds) {
      await broadcastServerChange('Repair', 'UPDATE', id);
    }

    return res.json({
      success: true,
      message: `Archived ${targetIds.length} courier records.`
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to archive shipments.' });
  }
});

// ==========================================
// 12. DELETE /api/couriers/:id
// ==========================================
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin
      .from('Repair')
      .update({
        isCourierIn: false,
        isCourierOut: false,
        isReturnCourierDispatched: false,
        courierStatus: 'ARCHIVED',
        updatedAt: new Date().toISOString()
      })
      .eq('id', id);

    if (error) return res.status(500).json({ error: 'Failed to remove courier shipment.' });

    await broadcastServerChange('Repair', 'UPDATE', id);

    return res.json({ success: true, message: 'Courier record archived successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete shipment.' });
  }
});

export default router;