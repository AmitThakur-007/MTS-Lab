import { Router, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { broadcastServerChange } from '../services/realtimeSync';

const router = Router();

const TECHNICIAN_ROLES = ['TECHNICIAN', 'LEAD_TECHNICIAN', 'HEAD_TECHNICIAN'];

function normalizedRole(role?: string) {
  return String(role || '').toUpperCase().replace(/\s+/g, '_').trim();
}

function mapTransfer(row: any) {
  return {
    ...row,
    senderTechnicianName: row.senderTechnicianName || row.senderName || 'Technician',
    targetTechnicianName: row.targetTechnicianName || row.receiverName || 'Technician',
    senderId: row.senderTechnicianId || row.senderId,
    receiverId: row.targetTechnicianId || row.receiverId,
  };
}

function rpcErrorStatus(error: any) {
  const message = String(error?.message || '');
  if (error?.code === '23505' || /already (been )?processed|already pending|assignment changed/i.test(message)) return 409;
  if (/not authorized|only technicians|only pending|can only transfer|same technician|different branch|inactive|unavailable|current status/i.test(message)) return 403;
  if (/not found/i.test(message)) return 404;
  return 400;
}

// POST /api/repairs/:repairId/transfer-request
// The sender is always taken from the authenticated session; senderId is never trusted from the client.
router.post('/:repairId/transfer-request', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { repairId } = req.params;
    const { targetTechnicianId, reason } = req.body || {};

    if (!repairId || !targetTechnicianId || typeof targetTechnicianId !== 'string') {
      return res.status(400).json({ error: 'Repair ID and target technician are required.' });
    }
    if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
      return res.status(400).json({ error: 'Transfer reason must contain at least 3 characters.' });
    }

    const senderRole = normalizedRole(req.user?.role);
    if (!TECHNICIAN_ROLES.includes(senderRole)) {
      return res.status(403).json({ error: 'You are not authorized to transfer repair work.' });
    }

    const { data, error } = await supabaseAdmin.rpc('create_repair_transfer_request', {
      p_repair_id: repairId,
      p_target_technician_id: targetTechnicianId,
      p_reason: reason.trim(),
      p_sender_technician_id: req.user!.id,
    });

    if (error) {
      console.error('[TRANSFER REQUEST ERROR]', error);
      return res.status(rpcErrorStatus(error)).json({
        error: error.message || 'Unable to create transfer request.'
      });
    }

    const transfer = mapTransfer(data);
    await broadcastServerChange('RepairTransfer', 'CREATE', transfer.id, transfer);
    await broadcastServerChange('Notification', 'CREATE', transfer.id, {
      type: 'TRANSFER_REQUEST',
      userId: transfer.targetTechnicianId,
      repairId: transfer.repairId,
      transferRequestId: transfer.id,
    });

    return res.status(201).json({ success: true, transferRequest: transfer });
  } catch (error: any) {
    console.error('[TRANSFER REQUEST EXCEPTION]', error);
    return res.status(500).json({ error: 'Unable to create transfer request.' });
  }
});

// GET /api/repair-transfers/my-requests
router.get('/my-requests', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { data: requests, error } = await supabaseAdmin
      .from('RepairTransferRequest')
      .select('*')
      .or(`senderTechnicianId.eq.${req.user!.id},targetTechnicianId.eq.${req.user!.id}`)
      .order('createdAt', { ascending: false });

    if (error) {
      console.error('[TRANSFER LIST ERROR]', error);
      return res.status(500).json({ error: 'Failed to fetch transfer requests.' });
    }

    const mapped = (requests || []).map(mapTransfer);
    return res.json({
      incoming: mapped.filter((r: any) => r.receiverId === req.user!.id),
      outgoing: mapped.filter((r: any) => r.senderId === req.user!.id),
      pendingIncomingCount: mapped.filter((r: any) => r.receiverId === req.user!.id && r.status === 'PENDING').length,
    });
  } catch (error: any) {
    console.error('[TRANSFER LIST EXCEPTION]', error);
    return res.status(500).json({ error: 'Failed to retrieve transfer requests.' });
  }
});

// GET /api/repair-transfers/:id
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { data: request, error } = await supabaseAdmin
      .from('RepairTransferRequest')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !request) return res.status(404).json({ error: 'Transfer request not found.' });

    if (request.senderTechnicianId !== req.user!.id && request.targetTechnicianId !== req.user!.id) {
      return res.status(403).json({ error: 'You are not authorized to view this transfer request.' });
    }

    return res.json(mapTransfer(request));
  } catch {
    return res.status(500).json({ error: 'Failed to retrieve transfer request.' });
  }
});

// POST /api/repair-transfers/:id/respond
router.post('/:id/respond', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { action, responseNote } = req.body || {};
    const normalizedAction = String(action || '').toUpperCase();
    const receiverRole = normalizedRole(req.user?.role);

    if (!TECHNICIAN_ROLES.includes(receiverRole)) {
      return res.status(403).json({ error: 'Only technicians can respond to repair transfer requests.' });
    }
    if (!['ACCEPT', 'REJECT'].includes(normalizedAction)) {
      return res.status(400).json({ error: 'Action must be ACCEPT or REJECT.' });
    }

    const { data, error } = await supabaseAdmin.rpc('respond_repair_transfer_request', {
      p_request_id: req.params.id,
      p_receiver_technician_id: req.user!.id,
      p_action: normalizedAction,
      p_response_note: typeof responseNote === 'string' ? responseNote.trim() || null : null,
    });

    if (error) {
      console.error('[TRANSFER RESPONSE ERROR]', error);
      return res.status(rpcErrorStatus(error)).json({
        error: error.message || 'Unable to process transfer request.'
      });
    }

    const result = mapTransfer(data);
    await broadcastServerChange('RepairTransfer', 'UPDATE', result.id, result);
    if (normalizedAction === 'ACCEPT') {
      await broadcastServerChange('Repair', 'UPDATE', result.repairId, {
        repairId: result.repairId,
        technicianId: req.user!.id,
        transferStatus: result.status,
      });
    }
    await broadcastServerChange('Notification', 'CREATE', result.id, {
      type: normalizedAction === 'ACCEPT' ? 'TRANSFER_ACCEPTED' : 'TRANSFER_REJECTED',
      userId: result.senderTechnicianId,
      repairId: result.repairId,
      transferRequestId: result.id,
    });

    return res.json({ success: true, transferRequest: result });
  } catch (error: any) {
    console.error('[TRANSFER RESPONSE EXCEPTION]', error);
    return res.status(500).json({ error: 'Unable to process transfer request.' });
  }
});

// POST /api/repair-transfers/:id/cancel
router.post('/:id/cancel', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const senderRole = normalizedRole(req.user?.role);
    if (!TECHNICIAN_ROLES.includes(senderRole)) {
      return res.status(403).json({ error: 'Only technicians can cancel transfer requests.' });
    }

    const { data, error } = await supabaseAdmin.rpc('cancel_repair_transfer_request', {
      p_request_id: req.params.id,
      p_sender_technician_id: req.user!.id,
    });

    if (error) {
      return res.status(rpcErrorStatus(error)).json({ error: error.message || 'Unable to cancel transfer request.' });
    }

    const result = mapTransfer(data);
    await broadcastServerChange('RepairTransfer', 'UPDATE', result.id, result);
    return res.json({ success: true, transferRequest: result });
  } catch {
    return res.status(500).json({ error: 'Unable to cancel transfer request.' });
  }
});

export default router;
