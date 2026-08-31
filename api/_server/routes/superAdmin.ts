import { Router, Response } from 'express';
import { broadcastServerChange } from '../services/realtimeSync';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { logAudit } from '../services/auditService';

const router = Router();

router.get('/audit-logs', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { action, resource, userId, page = '1', limit = '50', startDate, endDate } = req.query;
    const pageNum = Math.max(parseInt(page as string, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit as string, 10) || 50, 1), 100);
    const offset = (pageNum - 1) * limitNum;
    let query = supabaseAdmin.from('AuditLog').select('*', { count: 'exact' });
    if (action && action !== 'ALL') query = query.eq('action', String(action));
    if (resource && resource !== 'ALL') query = query.eq('resource', String(resource));
    if (userId && userId !== 'ALL') query = query.eq('userId', String(userId));
    if (startDate) query = query.gte('createdAt', String(startDate));
    if (endDate) query = query.lte('createdAt', String(endDate));
    const { data: logs, count, error } = await query.order('createdAt', { ascending: false }).range(offset, offset + limitNum - 1);
    if (error) return res.status(500).json({ success: false, error: 'Failed to fetch audit logs.' });
    return res.json({ success: true, logs: logs || [], total: count || 0, page: pageNum, limit: limitNum, totalPages: Math.ceil((count || 0) / limitNum) });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to retrieve system audit logs.' });
  }
});

router.get('/deletion-history', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (_req: AuthRequest, res: Response) => {
  try {
    const { data: logs, error } = await supabaseAdmin.from('AuditLog').select('*').ilike('action', '%DELETE%').order('createdAt', { ascending: false }).limit(100);
    if (error) return res.status(500).json({ success: false, error: 'Failed to fetch deletion history.' });
    return res.json({ success: true, data: logs || [] });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to retrieve deletion records.' });
  }
});

router.post('/delete-data', authenticate, authorize(['SUPER_ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { table, ids, reason } = req.body;
    if (!table || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ success: false, error: 'Table name and target ID list are required.' });
    const validTables = ['Repair', 'Customer', 'BatteryWarranty', 'InventoryItem', 'Attendance', 'RepairRelatedDamage', 'RepairPrice', 'Product', 'HomeSlide'];
    if (!validTables.includes(table)) return res.status(400).json({ success: false, error: `Deletion not permitted on table ${table}.` });
    const { error } = await supabaseAdmin.from(table).delete().in('id', ids);
    if (error) return res.status(500).json({ success: false, error: `Failed to delete from ${table}.` });
    await logAudit({ userId: req.user!.id, action: `SUPERADMIN_BULK_DELETE_${table.toUpperCase()}`, resource: table, details: { deletedCount: ids.length, ids, reason: reason || 'Administrative cleanup' } });
    for (const id of ids) await broadcastServerChange(table, 'DELETE', id);
    return res.json({ success: true, message: `Safely removed ${ids.length} records from ${table}.` });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to execute data deletion.' });
  }
});

// Mounted at /api/share, so these paths intentionally begin with /history and /applet.
router.get('/history', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (_req: AuthRequest, res: Response) => {
  try {
    const { data: shares, error } = await supabaseAdmin.from('AppletShare').select('*').order('createdAt', { ascending: false }).limit(50);
    if (error) {
      console.error('[SHARE HISTORY ERROR]', error);
      return res.status(500).json({ success: false, error: 'Failed to load share history.' });
    }
    return res.json({ success: true, data: shares || [] });
  } catch (error: any) {
    console.error('[SHARE HISTORY EXCEPTION]', error);
    return res.status(500).json({ success: false, error: 'Failed to load share history.' });
  }
});

router.post('/applet', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { title, appletName, description, permissions, expiresAt } = req.body;
    const shareId = uuidv4();
    const shareToken = uuidv4().replace(/-/g, '');
    const newShare = {
      id: shareId,
      shareToken,
      title: title || appletName || 'MTS Lab Share Link',
      description: description || null,
      permissions: permissions || ['READ'],
      expiresAt: expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      createdById: req.user!.id,
      createdAt: new Date().toISOString(),
    };
    const { error } = await supabaseAdmin.from('AppletShare').insert([newShare]);
    if (error) return res.status(500).json({ success: false, error: 'Failed to create share link.' });
    return res.status(201).json({ success: true, message: 'Share link created successfully.', shareToken, url: `/share/${shareToken}` });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to create share link.' });
  }
});

export default router;
