import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { logAudit } from '../services/auditService';

const router = Router();

// 1. GET /api/couriers
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { type, status, company, district, search, startDate, endDate } = req.query;

    let query = supabaseAdmin
      .from('Repair')
      .select('id, repairNumber, customerName, customerPhone, deviceBrand, deviceModel, status, receivingMethod, isCourierIn, courierCompany, courierTrackingNumber, courierDate, courierReceivedDate, senderName, senderPhone, originDistrict, originAddress, courierNotes, courierStatus, isCourierOut, returnCourierCompany, returnCourierTrackingNumber, returnCourierDispatchDate, destinationDistrict, destinationAddress, receiverName, receiverPhone, returnCourierNotes, isReturnCourierDispatched, returnCourierDispatchedAt, createdAt')
      .or('isCourierIn.eq.true,isCourierOut.eq.true');

    if (type === 'INCOMING') {
      query = query.eq('isCourierIn', true);
    } else if (type === 'OUTGOING') {
      query = query.eq('isCourierOut', true);
    }

    if (status && status !== 'ALL') {
      query = query.eq('courierStatus', String(status));
    }

    if (company && company !== 'ALL') {
      query = query.or(`courierCompany.eq.${company},returnCourierCompany.eq.${company}`);
    }

    if (district && district !== 'ALL') {
      query = query.or(`originDistrict.eq.${district},destinationDistrict.eq.${district}`);
    }

    if (search) {
      const s = String(search).trim();
      query = query.or(`repairNumber.ilike.%${s}%,courierTrackingNumber.ilike.%${s}%,returnCourierTrackingNumber.ilike.%${s}%,senderName.ilike.%${s}%,receiverName.ilike.%${s}%,senderPhone.ilike.%${s}%,receiverPhone.ilike.%${s}%`);
    }

    const { data: shipments, error } = await query.order('createdAt', { ascending: false });

    if (error) {
      console.error('[COURIERS GET ERROR]', error);
      return res.status(500).json({ error: 'Failed to fetch courier shipments.' });
    }

    return res.json(shipments || []);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve courier records.' });
  }
});

// 2. GET /api/couriers/stats
router.get('/stats', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { data: records } = await supabaseAdmin
      .from('Repair')
      .select('isCourierIn, isCourierOut, courierStatus, isReturnCourierDispatched')
      .or('isCourierIn.eq.true,isCourierOut.eq.true');

    let totalIncoming = 0;
    let totalOutgoing = 0;
    let inTransit = 0;
    let delivered = 0;
    let pendingIntake = 0;

    (records || []).forEach((r: any) => {
      if (r.isCourierIn) totalIncoming++;
      if (r.isCourierOut) totalOutgoing++;
      if (r.courierStatus === 'IN_TRANSIT' || r.courierStatus === 'DISPATCHED') inTransit++;
      if (r.courierStatus === 'DELIVERED' || r.courierStatus === 'RECEIVED') delivered++;
      if (r.courierStatus === 'PENDING') pendingIntake++;
    });

    return res.json({
      totalIncoming,
      totalOutgoing,
      inTransit,
      delivered,
      pendingIntake,
      totalShipments: (records || []).length,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to compute courier statistics.' });
  }
});

// 3. GET /api/couriers/eligible-repairs
router.get('/eligible-repairs', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { data: repairs } = await supabaseAdmin
      .from('Repair')
      .select('id, repairNumber, customerName, customerPhone, customerAddress, deviceBrand, deviceModel, status, totalPaid, estimatedCost')
      .in('status', ['COMPLETED', 'READY_FOR_DELIVERY', 'REPAIRED', 'READY'])
      .eq('isCourierOut', false)
      .order('createdAt', { ascending: false })
      .limit(30);

    return res.json(repairs || []);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to load eligible repairs.' });
  }
});

// 4. GET /api/couriers/filters-metadata
router.get('/filters-metadata', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { data: repairs } = await supabaseAdmin
      .from('Repair')
      .select('courierCompany, returnCourierCompany, originDistrict, destinationDistrict')
      .or('isCourierIn.eq.true,isCourierOut.eq.true');

    const companies = new Set<string>();
    const districts = new Set<string>();

    (repairs || []).forEach((r: any) => {
      if (r.courierCompany) companies.add(r.courierCompany);
      if (r.returnCourierCompany) companies.add(r.returnCourierCompany);
      if (r.originDistrict) districts.add(r.originDistrict);
      if (r.destinationDistrict) districts.add(r.destinationDistrict);
    });

    return res.json({
      companies: Array.from(companies),
      districts: Array.from(districts),
    });
  } catch (err: any) {
    return res.json({ companies: [], districts: [] });
  }
});

// 5. GET /api/couriers/search-customers
router.get('/search-customers', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { query: queryTerm } = req.query;
    if (!queryTerm) return res.json([]);

    const term = String(queryTerm).trim();
    const { data: customers } = await supabaseAdmin
      .from('Customer')
      .select('name, phone, address, district, municipality')
      .or(`phone.ilike.%${term}%,name.ilike.%${term}%`)
      .limit(10);

    return res.json(customers || []);
  } catch (err: any) {
    return res.json([]);
  }
});

// 6. POST /api/couriers/check-duplicate-awb
router.post('/check-duplicate-awb', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { trackingNumber } = req.body;
    if (!trackingNumber) return res.json({ exists: false });

    const awb = trackingNumber.trim();
    const { data: existing } = await supabaseAdmin
      .from('Repair')
      .select('id, repairNumber')
      .or(`courierTrackingNumber.eq.${awb},returnCourierTrackingNumber.eq.${awb}`)
      .limit(1);

    return res.json({
      exists: Boolean(existing && existing.length > 0),
      repair: existing?.[0] || null,
    });
  } catch (err: any) {
    return res.json({ exists: false });
  }
});

// 7. POST /api/couriers/incoming
router.post('/incoming', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const {
      senderName,
      senderPhone,
      originDistrict,
      originAddress,
      courierCompany,
      courierTrackingNumber,
      deviceBrand = 'Apple',
      deviceModel,
      problemDescription,
      notes,
    } = req.body;

    const repairId = uuidv4();
    const repairNumber = `MTS-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;

    const newRepair = {
      id: repairId,
      repairNumber,
      customerName: senderName || 'Courier Customer',
      customerPhone: senderPhone || 'N/A',
      customerAddress: originAddress || originDistrict || null,
      deviceBrand,
      deviceModel: deviceModel || 'Device via Courier',
      problemDescription: problemDescription || 'Received via incoming courier shipment',
      receivingMethod: 'COURIER',
      isCourierIn: true,
      courierCompany,
      courierTrackingNumber,
      courierDate: new Date().toISOString(),
      senderName,
      senderPhone,
      originDistrict,
      originAddress,
      courierNotes: notes,
      courierStatus: 'RECEIVED',
      status: 'RECEIVED',
      priority: 'MEDIUM',
      createdById: req.user!.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { data: created, error } = await supabaseAdmin.from('Repair').insert([newRepair]).select('*').single();

    if (error) {
      console.error('[INCOMING COURIER ERROR]', error);
      return res.status(500).json({ error: 'Failed to record incoming courier parcel.' });
    }

    return res.status(201).json({ success: true, message: 'Incoming shipment recorded successfully.', repair: created });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to save incoming parcel.' });
  }
});

// 8. POST /api/couriers/outgoing
router.post('/outgoing', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const {
      repairId,
      receiverName,
      receiverPhone,
      destinationDistrict,
      destinationAddress,
      returnCourierCompany,
      returnCourierTrackingNumber,
      notes,
    } = req.body;

    if (!repairId) {
      return res.status(400).json({ error: 'Repair ID is required for outgoing dispatch.' });
    }

    const { data: updated, error } = await supabaseAdmin
      .from('Repair')
      .update({
        isCourierOut: true,
        receiverName,
        receiverPhone,
        destinationDistrict,
        destinationAddress,
        returnCourierCompany,
        returnCourierTrackingNumber,
        returnCourierNotes: notes,
        returnCourierDispatchDate: new Date().toISOString(),
        isReturnCourierDispatched: true,
        returnCourierDispatchedAt: new Date().toISOString(),
        returnCourierDispatchedById: req.user!.id,
        returnCourierDispatchedByName: req.user!.name,
        courierStatus: 'DISPATCHED',
        status: 'DISPATCHED_VIA_COURIER',
        updatedAt: new Date().toISOString(),
      })
      .eq('id', repairId)
      .select('*')
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to dispatch courier.' });
    }

    return res.json({ success: true, message: 'Shipment dispatched successfully.', repair: updated });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to record outgoing dispatch.' });
  }
});

// 9. PATCH /api/couriers/:id/status
router.patch('/:id/status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const { data: updated, error } = await supabaseAdmin
      .from('Repair')
      .update({
        courierStatus: status,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: 'Failed to update status.' });

    return res.json({ success: true, message: 'Courier status updated.', repair: updated });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update courier status.' });
  }
});

// 10. POST /api/couriers/bulk-status
router.post('/bulk-status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { ids, status } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No shipment IDs provided.' });
    }

    const { error } = await supabaseAdmin
      .from('Repair')
      .update({ courierStatus: status, updatedAt: new Date().toISOString() })
      .in('id', ids);

    if (error) return res.status(500).json({ error: 'Failed to bulk update status.' });

    return res.json({ success: true, message: `Updated ${ids.length} shipments.` });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to perform bulk status update.' });
  }
});

// 11. POST /api/couriers/bulk-archive
router.post('/bulk-archive', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: 'No IDs provided.' });

    const { error } = await supabaseAdmin
      .from('Repair')
      .update({ courierStatus: 'ARCHIVED', updatedAt: new Date().toISOString() })
      .in('id', ids);

    if (error) return res.status(500).json({ error: 'Failed to archive shipments.' });

    return res.json({ success: true, message: `Archived ${ids.length} courier records.` });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to archive shipments.' });
  }
});

// 12. DELETE /api/couriers/:id
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin
      .from('Repair')
      .update({ isCourierIn: false, isCourierOut: false, courierStatus: 'DELETED' })
      .eq('id', id);

    if (error) return res.status(500).json({ error: 'Failed to remove courier shipment.' });

    return res.json({ success: true, message: 'Courier record deleted.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete shipment.' });
  }
});

export default router;
