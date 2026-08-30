import { Router, Request, Response } from 'express';
import { broadcastServerChange } from '../services/realtimeSync';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// 1. GET /api/notifications
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { data: notifications, error } = await supabaseAdmin
      .from('Notification')
      .select('*')
      .or(`userId.eq.${req.user!.id},userId.is.null`)
      .order('createdAt', { ascending: false })
      .limit(50);

    if (error) return res.status(500).json({ error: 'Failed to fetch notifications.' });

    return res.json(notifications || []);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve notifications.' });
  }
});

// 2. POST /api/notifications/:id/read
router.post('/:id/read', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin
      .from('Notification')
      .update({ isRead: true, readAt: new Date().toISOString() })
      .eq('id', id);

    if (error) return res.status(500).json({ error: 'Failed to mark notification as read.' });

    await broadcastServerChange('Notification', 'UPDATE', id);

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update notification status.' });
  }
});

// 3. POST /api/notifications/mark-all-read
router.post('/mark-all-read', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { error } = await supabaseAdmin
      .from('Notification')
      .update({ isRead: true, readAt: new Date().toISOString() })
      .or(`userId.eq.${req.user!.id},userId.is.null`);

    if (error) return res.status(500).json({ error: 'Failed to mark all notifications as read.' });

    await broadcastServerChange('Notification', 'UPDATE', 'bulk');

    return res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to process mark all read.' });
  }
});

export default router;
