import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import {
  getMyTransferRequests,
  getAllTransferRequests,
  getTransferRequestById,
  respondToTransferRequest,
  cancelTransferRequest,
} from '../services/repairTransferService';

const router = Router();

/**
 * GET /api/repair-transfers/my-requests
 * Returns incoming, outgoing, and pending incoming count for the authenticated technician
 */
router.get('/my-requests', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await getMyTransferRequests(req.user!.id);
    return res.json(result);
  } catch (err: any) {
    console.error('[GET /repair-transfers/my-requests ERROR]', err);
    return res.json({ incoming: [], outgoing: [], pendingIncomingCount: 0 });
  }
});

/**
 * GET /api/repair-transfers/all
 * Management overview of all transfer requests across the system
 */
router.get('/all', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'LEAD_TECHNICIAN']), async (req: AuthRequest, res: Response) => {
  try {
    const requests = await getAllTransferRequests();
    return res.json(requests);
  } catch (err: any) {
    console.error('[GET /repair-transfers/all ERROR]', err);
    return res.status(500).json({ error: 'Failed to retrieve transfer requests.' });
  }
});

/**
 * GET /api/repair-transfers/:id
 * Retrieve a specific transfer request
 */
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const transfer = await getTransferRequestById(req.params.id);
    if (!transfer) {
      return res.status(404).json({ error: 'Transfer request not found.' });
    }
    return res.json(transfer);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch transfer request.' });
  }
});

/**
 * POST /api/repair-transfers/:id/respond
 * Accept or Reject an incoming transfer request
 */
router.post('/:id/respond', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { action, responseNote } = req.body;

    const result = await respondToTransferRequest({
      transferId: id,
      responderId: req.user!.id,
      responderName: req.user!.name,
      responderRole: req.user!.role,
      action: action?.toUpperCase(),
      responseNote,
    });

    if (!result.success) {
      return res.status(result.statusCode || 400).json({ error: result.error });
    }

    return res.json(result.data);
  } catch (err: any) {
    console.error('[POST /repair-transfers/:id/respond ERROR]', err);
    return res.status(500).json({ error: err.message || 'Failed to process transfer response.' });
  }
});

/**
 * POST /api/repair-transfers/:id/accept
 * Direct alias for accepting a transfer request
 */
router.post('/:id/accept', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { responseNote } = req.body || {};

    const result = await respondToTransferRequest({
      transferId: id,
      responderId: req.user!.id,
      responderName: req.user!.name,
      responderRole: req.user!.role,
      action: 'ACCEPT',
      responseNote,
    });

    if (!result.success) {
      return res.status(result.statusCode || 400).json({ error: result.error });
    }

    return res.json(result.data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to accept transfer request.' });
  }
});

/**
 * POST /api/repair-transfers/:id/reject
 * Direct alias for rejecting a transfer request
 */
router.post('/:id/reject', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { responseNote } = req.body || {};

    const result = await respondToTransferRequest({
      transferId: id,
      responderId: req.user!.id,
      responderName: req.user!.name,
      responderRole: req.user!.role,
      action: 'REJECT',
      responseNote,
    });

    if (!result.success) {
      return res.status(result.statusCode || 400).json({ error: result.error });
    }

    return res.json(result.data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to reject transfer request.' });
  }
});

/**
 * POST /api/repair-transfers/:id/cancel
 * Cancel a pending transfer request (by sender or manager)
 */
router.post('/:id/cancel', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await cancelTransferRequest({
      transferId: id,
      userId: req.user!.id,
      userRole: req.user!.role,
    });

    if (!result.success) {
      return res.status(result.statusCode || 400).json({ error: result.error });
    }

    return res.json({ success: true, message: 'Transfer request cancelled successfully.', data: result.data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to cancel transfer request.' });
  }
});

export default router;
