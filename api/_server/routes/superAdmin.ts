import { Router, Response } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { broadcastServerChange } from '../services/realtimeSync';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { logAudit } from '../services/auditService';
import { getSystemThemeConfig, getSystemThemeConfigAsync, updateSystemThemeConfig } from '../services/systemThemeService';

const router = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

// 1. GET /api/admin/audit-logs
router.get('/audit-logs', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { action, resource, userId, role, status, search, page = '1', limit = '15', startDate, endDate } = req.query;
    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(Math.max(1, parseInt(limit as string, 10) || 15), 100);
    const offset = (pageNum - 1) * limitNum;

    let query = supabaseAdmin
      .from('AuditLog')
      .select('*, user:User(id, name, email, role)', { count: 'exact' });

    // Filter by specific user if provided
    if (userId && userId !== 'ALL') {
      query = query.eq('userId', String(userId));
    }

    // Filter by status (SUCCESS / FAILED)
    if (status && status !== 'ALL') {
      const stat = String(status).toUpperCase().trim();
      if (stat === 'FAILED') {
        query = query.in('status', ['FAILED', 'DENIED', 'BLOCKED', 'ERROR']);
      } else {
        query = query.eq('status', stat);
      }
    }

    // Filter by role (SUPER_ADMIN, ADMIN, MANAGER, etc.)
    if (role && role !== 'ALL') {
      const normalizedRole = String(role).toUpperCase().trim();
      if (normalizedRole === 'SUPER_ADMIN') {
        query = query.in('userRole', ['SUPER_ADMIN', 'SUPERADMIN']);
      } else if (normalizedRole === 'LEAD_TECHNICIAN') {
        query = query.in('userRole', ['LEAD_TECHNICIAN', 'HEAD_TECHNICIAN', 'LEADTECHNICIAN']);
      } else {
        query = query.eq('userRole', normalizedRole);
      }
    }

    // Filter by action with alias & family expansion
    if (action && action !== 'ALL') {
      const act = String(action).toUpperCase().trim();
      if (act === 'LOGIN_SUCCESS') {
        query = query.in('action', ['LOGIN_SUCCESS', 'LOGIN', '2FA_VERIFIED', 'OTP_VERIFICATION_SUCCESS']);
      } else if (act === 'LOGIN_FAILED') {
        query = query.in('action', ['LOGIN_FAILED', 'FAILED_LOGIN', 'LOGIN_BLOCKED_DEVICE', 'LOGIN_DISABLED_ACCOUNT']);
      } else if (act === 'OTP_REQUESTED') {
        query = query.in('action', ['OTP_REQUESTED', '2FA_CHALLENGE']);
      } else if (act === 'OTP_VERIFICATION_SUCCESS') {
        query = query.in('action', ['OTP_VERIFICATION_SUCCESS', '2FA_VERIFIED', '2FA_ENABLED', 'LOGIN_2FA_SUCCESS']);
      } else if (act === 'OTP_VERIFICATION_FAILED') {
        query = query.in('action', ['OTP_VERIFICATION_FAILED', '2FA_FAILED']);
      } else if (act === 'PASSWORD_CHANGED') {
        query = query.in('action', ['PASSWORD_CHANGED', 'PASSWORD_UPDATED']);
      } else if (act === 'PASSWORD_RESET') {
        query = query.in('action', ['PASSWORD_RESET', 'PASSWORD_RESET_COMPLETED', 'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET_OTP_VERIFIED']);
      } else if (act === 'EMAIL_CHANGED') {
        query = query.in('action', ['EMAIL_CHANGED', 'STAFF_EMAIL_VERIFIED', 'EMAIL_VERIFIED_BY_SUPER_ADMIN']);
      } else if (act === 'USER_CREATED') {
        query = query.in('action', ['USER_CREATED', 'STAFF_CREATED', 'CREATE']);
      } else if (act === 'USER_UPDATED') {
        query = query.in('action', ['USER_UPDATED', 'STAFF_UPDATED', 'UPDATE', 'STAFF_ROLE_CHANGED', 'USER_ENABLED', 'USER_DISABLED']);
      } else if (act === 'USER_DELETED') {
        query = query.in('action', ['USER_DELETED', 'STAFF_DELETED', 'DELETE', 'DELETE_REPAIR', 'REPAIRS_DELETED']);
      } else if (act === 'ROLE_CHANGED') {
        query = query.in('action', ['ROLE_CHANGED', 'STAFF_ROLE_CHANGED']);
      } else if (act === 'REPAIR_CREATED') {
        query = query.in('action', ['REPAIR_CREATED', 'BATCH_REGISTER_REPAIRS']);
      } else if (act === 'REPAIR_STATUS_CHANGED') {
        query = query.in('action', ['REPAIR_STATUS_CHANGED', 'UPDATE_STATUS', 'ASSIGN_TECHNICIAN', 'REPAIR_PRIORITY_UPDATED', 'REPAIR_TRANSFERRED']);
      } else if (act === 'LOGOUT') {
        query = query.in('action', ['LOGOUT', 'LOGOUT_ALL_DEVICES']);
      } else {
        query = query.eq('action', act);
      }
    }

    // Filter by resource with case-insensitive / table matching
    if (resource && resource !== 'ALL') {
      const resVal = String(resource).toUpperCase().trim();
      if (resVal === 'USER') {
        query = query.or('resource.eq.USER,resource.eq.User,resource.ilike.%User%');
      } else if (resVal === 'REPAIR') {
        query = query.or('resource.eq.REPAIR,resource.eq.Repair,resource.ilike.%Repair%');
      } else if (resVal === 'CUSTOMER') {
        query = query.or('resource.eq.CUSTOMER,resource.eq.Customer,resource.ilike.%Customer%');
      } else if (resVal === 'INVENTORY') {
        query = query.or('resource.ilike.%Inventory%,resource.ilike.%INVENTORY%');
      } else if (resVal === 'AUTH') {
        query = query.or('resource.eq.AUTH,resource.eq.Auth,resource.ilike.%Auth%');
      } else if (resVal === 'PAYMENT') {
        query = query.or('resource.ilike.%Payment%,resource.ilike.%PAYMENT%');
      } else {
        query = query.ilike('resource', `%${resVal}%`);
      }
    }

    // Search query across multiple fields
    if (search && String(search).trim()) {
      const s = String(search).trim().replace(/[%,]/g, '');
      if (s) {
        query = query.or(`userName.ilike.%${s}%,userEmail.ilike.%${s}%,action.ilike.%${s}%,resource.ilike.%${s}%,ipAddress.ilike.%${s}%,details.ilike.%${s}%`);
      }
    }

    if (startDate) {
      const startIso = String(startDate).includes('T') ? String(startDate) : `${String(startDate)}T00:00:00.000Z`;
      query = query.gte('createdAt', startIso);
    }
    if (endDate) {
      const endIso = String(endDate).includes('T') ? String(endDate) : `${String(endDate)}T23:59:59.999Z`;
      query = query.lte('createdAt', endIso);
    }

    const { data: logs, count, error } = await query
      .order('createdAt', { ascending: false })
      .range(offset, offset + limitNum - 1);

    if (error) {
      console.error('[AUDIT LOGS ERROR]', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch audit logs from database.' });
    }

    const enrichedLogs = (logs || []).map((l: any) => ({
      ...l,
      userName: l.userName || l.user?.name || (l.userId ? 'Staff Member' : 'System'),
      userEmail: l.userEmail || l.user?.email || null,
      userRole: l.userRole || l.user?.role || null,
    }));

    return res.json({
      success: true,
      logs: enrichedLogs,
      total: count || 0,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil((count || 0) / limitNum) || 1,
    });
  } catch (err: any) {
    console.error('[AUDIT LOGS UNEXPECTED ERROR]', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve system audit logs.' });
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

    for (const id of ids) {
      await broadcastServerChange(table, 'DELETE', id);
    }

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

// Explicit server-side allowlist for leadership targets mapping to immutable filenames
const LEADERSHIP_TARGETS: Record<string, { filename: string; roleLabel: string }> = {
  'ceo': { filename: 'sabita-thakur.jpg', roleLabel: 'CEO' },
  'sabita-thakur': { filename: 'sabita-thakur.jpg', roleLabel: 'CEO' },
  'sabita': { filename: 'sabita-thakur.jpg', roleLabel: 'CEO' },
  'founder': { filename: 'manish-sharma.jpg', roleLabel: 'Founder' },
  'manish-sharma': { filename: 'manish-sharma.jpg', roleLabel: 'Founder' },
  'manish': { filename: 'manish-sharma.jpg', roleLabel: 'Founder' },
  'technical-head': { filename: 'amit-sharma.jpg', roleLabel: 'Technical Head' },
  'technical_head': { filename: 'amit-sharma.jpg', roleLabel: 'Technical Head' },
  'technicalhead': { filename: 'amit-sharma.jpg', roleLabel: 'Technical Head' },
  'amit-sharma': { filename: 'amit-sharma.jpg', roleLabel: 'Technical Head' },
  'amit': { filename: 'amit-sharma.jpg', roleLabel: 'Technical Head' },
};

// Strict file signature (magic bytes) validation for images
function validateImageSignature(buffer: Buffer): { valid: boolean; format?: string } {
  if (!buffer || buffer.length < 12) return { valid: false };

  // Reject files containing dangerous script tags / code in initial buffer (polyglot rejection)
  const headerSample = buffer.subarray(0, Math.min(buffer.length, 4096)).toString('utf8').toLowerCase();
  if (
    headerSample.includes('<script') ||
    headerSample.includes('<?php') ||
    headerSample.includes('<html') ||
    headerSample.includes('<!doctype') ||
    headerSample.includes('<svg') ||
    headerSample.includes('javascript:') ||
    headerSample.includes('onerror=') ||
    headerSample.includes('onload=')
  ) {
    return { valid: false };
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valid: true, format: 'jpeg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { valid: true, format: 'png' };
  }

  // WebP: 'RIFF' at 0..3 and 'WEBP' at 8..11
  if (
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return { valid: true, format: 'webp' };
  }

  return { valid: false };
}

// 6. POST /api/admin/team/update-photo (Replaces leadership photo with strict RBAC and atomic write)
router.post(
  ['/team/update-photo', '/update-photo'],
  authenticate,
  authorize(['SUPER_ADMIN', 'ADMIN']),
  upload.single('file') as any,
  async (req: AuthRequest, res: Response) => {
    try {
      const rawTarget = (req.body.target || '').toString().toLowerCase().trim();
      const targetConfig = LEADERSHIP_TARGETS[rawTarget];

      // Prevent IDOR and Path Traversal: enforce strict target allowlist
      if (!targetConfig) {
        return res.status(400).json({
          error: 'Invalid leadership target. Permitted targets: CEO, Founder, Technical Head.',
        });
      }

      let fileBuffer: Buffer | null = null;
      if (req.file && req.file.buffer) {
        fileBuffer = req.file.buffer;
      } else if (req.body.base64) {
        const base64Data = req.body.base64.replace(/^data:image\/\w+;base64,/, '');
        fileBuffer = Buffer.from(base64Data, 'base64');
      }

      if (!fileBuffer || fileBuffer.length === 0) {
        return res.status(400).json({ error: 'No image file or base64 payload provided.' });
      }

      // Enforce 5MB limit
      const MAX_PHOTO_SIZE = 5 * 1024 * 1024;
      if (fileBuffer.length > MAX_PHOTO_SIZE) {
        return res.status(400).json({ error: 'File size exceeds 5MB limit for leadership photos.' });
      }

      // Enforce true binary image format validation (reject SVG, HTML, PHP, EXE, etc.)
      const signatureCheck = validateImageSignature(fileBuffer);
      if (!signatureCheck.valid) {
        return res.status(400).json({
          error: 'Invalid file format. Only authentic JPEG, PNG, and WebP images are permitted for leadership photos.',
        });
      }

      const filename = targetConfig.filename;
      const publicDir = path.join(process.cwd(), 'public', 'images', 'team');
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }

      const publicFilePath = path.join(publicDir, filename);
      const tempFilename = `.${filename}.${Date.now()}-${uuidv4().substring(0, 8)}.tmp`;
      const tempFilePath = path.join(publicDir, tempFilename);

      try {
        // Step 1: Write to temporary file first (preserves existing image if write fails)
        fs.writeFileSync(tempFilePath, fileBuffer);

        // Step 2: Verify written file integrity
        if (!fs.existsSync(tempFilePath) || fs.statSync(tempFilePath).size !== fileBuffer.length) {
          throw new Error('Verification of written temporary image failed.');
        }

        // Step 3: Atomically overwrite existing image
        fs.renameSync(tempFilePath, publicFilePath);
      } catch (writeErr: any) {
        if (fs.existsSync(tempFilePath)) {
          try { fs.unlinkSync(tempFilePath); } catch (_) {}
        }
        console.error('[LEADERSHIP PHOTO STORAGE ERROR]', writeErr?.message || writeErr);
        return res.status(500).json({ error: 'Failed to safely store the new leadership photo.' });
      }

      // Step 4: Mirror to dist directory if production build exists
      const distRoot = path.join(process.cwd(), 'dist');
      if (fs.existsSync(distRoot)) {
        try {
          const distDir = path.join(distRoot, 'images', 'team');
          if (!fs.existsSync(distDir)) {
            fs.mkdirSync(distDir, { recursive: true });
          }
          const distFilePath = path.join(distDir, filename);
          const distTemp = path.join(distDir, tempFilename);
          fs.writeFileSync(distTemp, fileBuffer);
          fs.renameSync(distTemp, distFilePath);
        } catch (_) {}
      }

      // Mirror to src/assets/team backup if present
      const assetDir = path.join(process.cwd(), 'src', 'assets', 'team');
      if (fs.existsSync(assetDir)) {
        try {
          const assetFilePath = path.join(assetDir, filename);
          fs.writeFileSync(assetFilePath, fileBuffer);
        } catch (_) {}
      }

      const timestamp = Date.now();
      const publicUrl = `/images/team/${filename}?v=${timestamp}`;

      // Step 5: Secure audit logging
      await logAudit({
        userId: req.user?.id || 'system',
        userEmail: req.user?.email || 'admin@mtslab.com',
        action: 'UPDATE_LEADERSHIP_PHOTO',
        resource: 'LeadershipTeam',
        details: {
          target: rawTarget,
          role: targetConfig.roleLabel,
          filename,
          size: fileBuffer.length,
          actorRole: req.user?.role,
          format: signatureCheck.format,
        },
      });

      // Step 6: Realtime broadcast
      await broadcastServerChange('AppSetting', 'UPDATE', `team-photo-${rawTarget}`);

      return res.json({
        success: true,
        message: `Successfully updated ${targetConfig.roleLabel} photo.`,
        url: publicUrl,
        target: rawTarget,
      });
    } catch (err: any) {
      console.error('[UPDATE LEADERSHIP PHOTO ERROR]', err?.message || err);
      return res.status(500).json({ error: 'An unexpected error occurred while updating the leadership photo.' });
    }
  }
);

// 8. GET /api/admin/system-theme
router.get('/system-theme', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (_req: AuthRequest, res: Response) => {
  try {
    const config = await getSystemThemeConfigAsync();
    return res.json(config);
  } catch (err: any) {
    try {
      const fallback = getSystemThemeConfig();
      return res.json(fallback);
    } catch (_) {
      return res.status(500).json({ error: 'Failed to retrieve system theme settings.' });
    }
  }
});

// 9. POST /api/admin/system-theme — Strictly restricted to SUPER_ADMIN
router.post('/system-theme', authenticate, authorize(['SUPER_ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { 
      activeTheme, 
      festivalGreeting, 
      customMessage, 
      schedule,
      festivalModeEnabled, 
      activeFestival 
    } = req.body;

    const allowedThemes = [
      'light',
      'dark',
      'night',
      'neutral-default',
      'dashain',
      'tihar',
      'holi',
      'nepali-new-year'
    ];

    if (activeTheme !== undefined && !allowedThemes.includes(activeTheme)) {
      return res.status(400).json({ 
        error: `Invalid theme '${activeTheme}'. Allowed themes: ${allowedThemes.join(', ')}.` 
      });
    }

    if (activeFestival !== undefined && !allowedThemes.includes(activeFestival)) {
      return res.status(400).json({ 
        error: `Invalid festival '${activeFestival}'. Allowed themes: ${allowedThemes.join(', ')}.` 
      });
    }

    // Schedule validation
    if (schedule && schedule.enabled) {
      if (schedule.themeId && !allowedThemes.includes(schedule.themeId)) {
        return res.status(400).json({ 
          error: `Invalid schedule theme '${schedule.themeId}'. Must be one of: ${allowedThemes.join(', ')}.` 
        });
      }
      if (!schedule.startDate || !schedule.endDate) {
        return res.status(400).json({ 
          error: 'Both startDate and endDate are required when festival scheduling is enabled.' 
        });
      }
      const startMs = new Date(schedule.startDate).getTime();
      const endMs = new Date(schedule.endDate).getTime();
      if (isNaN(startMs) || isNaN(endMs) || startMs >= endMs) {
        return res.status(400).json({ 
          error: 'Invalid schedule timeframe. Start date must be earlier than end date.' 
        });
      }
    }

    const updated = await updateSystemThemeConfig(
      {
        activeTheme: activeTheme || undefined,
        festivalGreeting: festivalGreeting !== undefined ? String(festivalGreeting).trim() : undefined,
        customMessage: customMessage !== undefined ? String(customMessage).trim() : undefined,
        schedule: schedule !== undefined ? schedule : undefined,
        festivalModeEnabled: typeof festivalModeEnabled === 'boolean' ? festivalModeEnabled : undefined,
        activeFestival: activeFestival || undefined,
      },
      {
        id: req.user?.id,
        name: req.user?.name,
        role: req.user?.role,
      }
    );

    // Audit log with valid foreign key constraint
    const validUserId = (req.user?.id && typeof req.user.id === 'string' && req.user.id.length === 36)
      ? req.user.id
      : null;

    await logAudit({
      userId: validUserId,
      userEmail: req.user?.email || 'superadmin@mtslab.com',
      action: 'SUPERADMIN_THEME_UPDATE',
      resource: 'SystemTheme',
      details: {
        activeTheme: updated.activeTheme,
        effectiveTheme: updated.effectiveTheme,
        festivalGreeting: updated.festivalGreeting,
        isScheduledActive: updated.isScheduledActive,
        schedule: updated.schedule,
      },
    });

    const themeNameMap: Record<string, string> = {
      light: 'Light Mode',
      dark: 'Dark Mode',
      night: 'Night Mode',
      'neutral-default': 'Neutral Default',
      dashain: 'Dashain Festival',
      tihar: 'Tihar Festival',
      holi: 'Holi Festival',
      'nepali-new-year': 'Nepali New Year'
    };

    const label = themeNameMap[updated.effectiveTheme] || updated.effectiveTheme;

    return res.json({
      success: true,
      message: `Global theme '${label}' successfully applied across all staff workspaces & public pages!`,
      themeConfig: updated,
    });
  } catch (err: any) {
    console.error('[UPDATE SYSTEM THEME ERROR]', err);
    return res.status(500).json({ error: 'Failed to update system theme settings.' });
  }
});

export default router;

