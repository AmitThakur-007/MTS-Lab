import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import {
  getUserNotifications,
  createNotification,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from '../services/notificationStorage';

const router = Router();

// 1. GET /api/notifications — Retrieve user notifications
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const unreadOnly = req.query.unreadOnly === 'true';
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const type = req.query.type as string;

    const { notifications, unreadCount } = await getUserNotifications(
      { id: req.user!.id, role: req.user!.role },
      { unreadOnly, limit, type }
    );

    // Support both direct array and object with metadata
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.json(notifications);
  } catch (err: any) {
    console.error('[GET NOTIFICATIONS ERROR]', err);
    return res.status(500).json({ error: 'Failed to retrieve notifications.' });
  }
});

// 2. GET /api/notifications/unread-count — Fast count
router.get('/unread-count', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { unreadCount } = await getUserNotifications(
      { id: req.user!.id, role: req.user!.role },
      { unreadOnly: true, limit: 1 }
    );

    return res.json({ unreadCount });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve unread count.' });
  }
});

// 3. POST /api/notifications/:id/read or PATCH /api/notifications/:id/read — Mark single notification as read
const handleMarkRead = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updated = await markNotificationRead(id, req.user!.id);

    if (!updated) {
      return res.status(404).json({ error: 'Notification not found.' });
    }

    return res.json({ success: true, notification: updated });
  } catch (err: any) {
    console.error('[MARK READ ERROR]', err);
    return res.status(500).json({ error: 'Failed to update notification status.' });
  }
};

router.post('/:id/read', authenticate, handleMarkRead);
router.patch('/:id/read', authenticate, handleMarkRead);

// 4. POST /api/notifications/mark-all-read — Mark all notifications as read for current user
router.post('/mark-all-read', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const count = await markAllNotificationsRead({ id: req.user!.id, role: req.user!.role });
    return res.json({ success: true, message: 'All notifications marked as read.', markedCount: count });
  } catch (err: any) {
    console.error('[MARK ALL READ ERROR]', err);
    return res.status(500).json({ error: 'Failed to process mark all read.' });
  }
});

// 5. DELETE /api/notifications/:id — Delete a notification
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await deleteNotification(id, { id: req.user!.id, role: req.user!.role });

    if (!deleted) {
      return res.status(404).json({ error: 'Notification not found.' });
    }

    return res.json({ success: true, message: 'Notification removed successfully.' });
  } catch (err: any) {
    console.error('[DELETE NOTIFICATION ERROR]', err);
    return res.status(403).json({ error: err?.message || 'Failed to delete notification.' });
  }
});

// 6. POST /api/notifications/send-internal — Staff-to-staff or role-targeted internal communication
router.post('/send-internal', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { targetUserId, targetRole, title, message, priority = 'NORMAL', link } = req.body;

    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required.' });
    }

    // Security validation: Only staff can send internal notifications
    const allowedSenders = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'HEAD_TECHNICIAN', 'LEAD_TECHNICIAN', 'TECHNICIAN', 'RECEPTIONIST', 'ACCOUNTANT'];
    if (!allowedSenders.includes(req.user!.role)) {
      return res.status(403).json({ error: 'Unauthorized to send internal notifications.' });
    }

    const created = await createNotification({
      userId: targetUserId || null,
      targetRole: targetRole || null,
      title: title.trim(),
      message: message.trim(),
      type: 'INTERNAL_MESSAGE',
      senderId: req.user!.id,
      senderName: req.user!.name,
      senderRole: req.user!.role,
      priority: priority as any,
      link: link || null,
    });

    return res.status(201).json({ success: true, notification: created });
  } catch (err: any) {
    console.error('[SEND INTERNAL NOTIFICATION ERROR]', err);
    return res.status(500).json({ error: 'Failed to send internal communication.' });
  }
});

export default router;

