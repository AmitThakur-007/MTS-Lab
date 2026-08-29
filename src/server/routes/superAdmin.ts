import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { logAudit } from '../services/auditService';

const router = Router();

// 1. GET /api/admin/audit-logs
router.get('/audit-logs', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { action, resource, userId, page = '1', limit = '50', startDate, endDate } = req.query;
    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 50;
    const offset = (pageNum - 1) * limitNum;

    let query = supabaseAdmin.from('AuditLog').select('*', { count: 'exact' });

    if (action && action !== 'ALL') query = query.eq('action', String(action));
    if (resource && resource !== 'ALL') query = query.eq('resource', String(resource));
    if (userId && userId !== 'ALL') query = query.eq('userId', String(userId));
    if (startDate) query = query.gte('createdAt', String(startDate));
    if (endDate) query = query.lte('createdAt', String(endDate));

    const { data: logs, count, error } = await query
      .order('createdAt', { ascending: false })
      .range(offset, offset + limitNum - 1);

    if (error) {
      console.error('[AUDIT LOGS ERROR]', error);
      return res.status(500).json({ error: 'Failed to fetch audit logs.' });
    }

    return res.json({
      logs: logs || [],
      total: count || 0,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil((count || 0) / limitNum),
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve system audit logs.' });
  }
});

// 2. GET /api/admin/deletion-history
router.get('/deletion-history', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { data: logs, error } = await supabaseAdmin
      .from('AuditLog')
      .select('*')
      .ilike('action', '%DELETE%')
      .order('createdAt', { ascending: false })
      .limit(100);

    if (error) return res.status(500).json({ error: 'Failed to fetch deletion history.' });

    return res.json(logs || []);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve deletion records.' });
  }
});

// 3. POST /api/admin/delete-data
router.post('/delete-data', authenticate, authorize(['SUPER_ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { table, ids, reason } = req.body;
    if (!table || !ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Table name and target ID list are required.' });
    }

    const validTables = ['Repair', 'Customer', 'BatteryWarranty', 'InventoryItem', 'Attendance', 'RepairRelatedDamage', 'RepairPrice', 'Product', 'HomeSlide'];
    if (!validTables.includes(table)) {
      return res.status(400).json({ error: `Deletion not permitted on table ${table}.` });
    }

    const { error } = await supabaseAdmin.from(table).delete().in('id', ids);
    if (error) return res.status(500).json({ error: `Failed to delete from ${table}: ${error.message}` });

    await logAudit({
      userId: req.user!.id,
      action: `SUPERADMIN_BULK_DELETE_${table.toUpperCase()}`,
      resource: table,
      details: { deletedCount: ids.length, ids, reason: reason || 'Administrative cleanup' },
    });

    return res.json({ success: true, message: `Safely removed ${ids.length} records from ${table}.` });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to execute data deletion.' });
  }
});

// 4. GET /api/share/history
router.get('/share/history', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { data: shares } = await supabaseAdmin.from('AppletShare').select('*').order('createdAt', { ascending: false }).limit(50);
    return res.json(shares || []);
  } catch (err: any) {
    return res.json([]);
  }
});

// 5. POST /api/share/applet & POST /api/share
router.post('/share/applet', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, permissions, expiresAt } = req.body;
    const shareId = uuidv4();
    const shareToken = uuidv4().replace(/-/g, '');

    const newShare = {
      id: shareId,
      shareToken,
      title: title || 'MTS Lab Share Link',
      description: description || null,
      permissions: permissions || ['READ'],
      expiresAt: expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      createdById: req.user!.id,
      createdAt: new Date().toISOString(),
    };

    await supabaseAdmin.from('AppletShare').insert([newShare]);
    return res.status(201).json({ success: true, shareToken, url: `/share/${shareToken}` });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to create share link.' });
  }
});

export default router;
