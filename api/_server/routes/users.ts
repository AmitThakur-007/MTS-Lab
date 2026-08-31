import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize, normalizeRole } from '../middleware/rbac';
import { broadcastServerChange } from '../services/realtimeSync';
import { logAudit } from '../services/auditService';

const router = Router();

// 1. GET /api/users & GET /api/staff
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { data: users, error } = await supabaseAdmin
      .from('User')
      .select('id, email, username, name, role, phoneNumber, department, address, profileImage, branchId, accountStatus, isActive, emailVerified, twoFactorEnabled, twoFactorType, lastLoginAt, createdAt, updatedAt')
      .is('deletedAt', null)
      .order('name', { ascending: true });

    if (error) {
      console.error('[USERS GET ERROR]', error);
      return res.status(500).json({ error: 'Failed to fetch staff directory.' });
    }

    return res.json(users || []);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch staff members.' });
  }
});

// 2. POST /api/users (Create Staff Member)
router.post('/', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const {
      name,
      email,
      password,
      role = 'RECEPTIONIST',
      phoneNumber,
      department,
      address,
      branchId,
      twoFactorEnabled = true,
    } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required to create a staff member.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedTargetRole = normalizeRole(role);

    const { data: existingUsers } = await supabaseAdmin
      .from('User')
      .select('id, email, deletedAt')
      .eq('email', normalizedEmail)
      .limit(1);

    if (existingUsers && existingUsers.length > 0) {
      const existing = existingUsers[0];
      if (!existing.deletedAt) {
        return res.status(400).json({ error: 'A staff member with this email already exists.' });
      }
    }

    const defaultPassword = password || 'MtsLab@2026';
    const passwordHash = await bcrypt.hash(defaultPassword, 10);
    let userId = uuidv4();
    let supabaseUid: string | null = null;

    try {
      const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password: defaultPassword,
        email_confirm: true,
        user_metadata: { name, role: normalizedTargetRole },
      });

      if (!authErr && authUser?.user) {
        userId = authUser.user.id;
        supabaseUid = authUser.user.id;
      }
    } catch (authCreateErr) {
      console.warn('[AUTH CREATE NOTICE]', authCreateErr);
    }

    const newStaff = {
      id: userId,
      supabaseUid: supabaseUid || userId,
      email: normalizedEmail,
      name: name.trim(),
      password: passwordHash,
      role: normalizedTargetRole,
      phoneNumber: phoneNumber ? phoneNumber.trim() : null,
      department: department ? department.trim() : null,
      address: address ? address.trim() : null,
      branchId: branchId || null,
      accountStatus: 'ACTIVE',
      isActive: true,
      emailVerified: true,
      twoFactorEnabled: Boolean(twoFactorEnabled),
      twoFactorType: 'EMAIL',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { data: insertedUser, error: insertErr } = await supabaseAdmin
      .from('User')
      .insert([newStaff])
      .select('*')
      .single();

    if (insertErr) {
      console.error('[STAFF INSERT ERROR]', insertErr);
      return res.status(500).json({ error: 'Failed to create staff member profile.' });
    }

    await logAudit({
      userId: req.user!.id,
      action: 'STAFF_CREATED',
      resource: 'User',
      resourceId: insertedUser.id,
      details: { email: insertedUser.email, role: insertedUser.role, createdBy: req.user!.name },
    });

    await broadcastServerChange('User', 'CREATE', insertedUser.id, insertedUser);

    return res.status(201).json(insertedUser);
  } catch (err: any) {
    console.error('[CREATE USER ERROR]', err);
    return res.status(500).json({ error: 'Failed to create staff account.' });
  }
});

// 3. PATCH /api/users/:id (Update Staff Profile or Role)
router.patch('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      role,
      phoneNumber,
      department,
      address,
      branchId,
      accountStatus,
      isActive,
      password,
      twoFactorEnabled,
      emailVerified,
    } = req.body;

    const callerRole = normalizeRole(req.user!.role);
    const isSelf = req.user!.id === id;
    const isSuperAdminOrAdmin = callerRole === 'SUPER_ADMIN' || callerRole === 'ADMIN';

    if (!isSelf && !isSuperAdminOrAdmin) {
      return res.status(403).json({ error: 'You are not authorized to modify this user account.' });
    }

    const updatePayload: any = {
      updatedAt: new Date().toISOString(),
    };

    if (name !== undefined) updatePayload.name = name.trim();
    if (phoneNumber !== undefined) updatePayload.phoneNumber = phoneNumber ? phoneNumber.trim() : null;
    if (department !== undefined) updatePayload.department = department ? department.trim() : null;
    if (address !== undefined) updatePayload.address = address ? address.trim() : null;
    if (branchId !== undefined) updatePayload.branchId = branchId || null;

    if (isSuperAdminOrAdmin) {
      if (role !== undefined) updatePayload.role = normalizeRole(role);
      if (accountStatus !== undefined) updatePayload.accountStatus = accountStatus;
      if (isActive !== undefined) updatePayload.isActive = Boolean(isActive);
      if (twoFactorEnabled !== undefined) updatePayload.twoFactorEnabled = Boolean(twoFactorEnabled);
      if (emailVerified !== undefined) updatePayload.emailVerified = Boolean(emailVerified);
    }

    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      updatePayload.password = passwordHash;

      try {
        await supabaseAdmin.auth.admin.updateUserById(id, { password });
      } catch (_) {}
    }

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('User')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (updateErr) {
      console.error('[USER UPDATE ERROR]', updateErr);
      return res.status(500).json({ error: 'Failed to update user profile.' });
    }

    await logAudit({
      userId: req.user!.id,
      action: 'STAFF_UPDATED',
      resource: 'User',
      resourceId: id,
      details: updatePayload,
    });

    await broadcastServerChange('User', 'UPDATE', id, updated);

    return res.json(updated);
  } catch (err: any) {
    console.error('[USER UPDATE ERROR]', err);
    return res.status(500).json({ error: 'Failed to update staff record.' });
  }
});

// 4. PATCH /api/users/:id/2fa & POST /api/users/:id/2fa
// Security/account controls must be restricted server-side.
const handle2FAToggle = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { enabled, twoFactorEnabled } = req.body;
    const isEnabled = enabled !== undefined ? Boolean(enabled) : Boolean(twoFactorEnabled);

    const { data: updated, error } = await supabaseAdmin
      .from('User')
      .update({
        twoFactorEnabled: isEnabled,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to update 2FA configuration.' });
    }

    await logAudit({
      userId: req.user!.id,
      action: 'SECURITY_SETTING_CHANGED',
      resource: 'User',
      resourceId: id,
      details: { setting: 'twoFactorEnabled', enabled: isEnabled },
    });

    await broadcastServerChange('User', 'UPDATE', id, updated);

    return res.json({ success: true, message: `2FA ${isEnabled ? 'enabled' : 'disabled'} successfully.`, user: updated });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to toggle 2FA.' });
  }
};

router.patch('/:id/2fa', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), handle2FAToggle);
router.post('/:id/2fa', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), handle2FAToggle);
router.patch('/:id/toggle-2fa', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), handle2FAToggle);
router.post('/:id/toggle-2fa', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), handle2FAToggle);

// 5. POST /api/users/:id/verify-email
const handleDirectVerifyEmail = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { data: updated, error } = await supabaseAdmin
      .from('User')
      .update({
        emailVerified: true,
        accountStatus: 'ACTIVE',
        updatedAt: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to verify staff email.' });
    }

    await broadcastServerChange('User', 'UPDATE', id, updated);

    return res.json({ success: true, message: 'Email directly verified successfully.', user: updated });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to verify email.' });
  }
};

router.post('/:id/verify-email', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), handleDirectVerifyEmail);
router.patch('/:id/verify-email', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), handleDirectVerifyEmail);
router.post('/:id/direct-verify-email', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), handleDirectVerifyEmail);
router.patch('/:id/direct-verify-email', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), handleDirectVerifyEmail);

// 6. DELETE /api/users/:id (Soft-Delete Staff Account)
router.delete('/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (req.user!.id === id) {
      return res.status(400).json({ error: 'You cannot delete your own account.' });
    }

    const { data: user } = await supabaseAdmin.from('User').select('role, email').eq('id', id).single();
    if (user && normalizeRole(user.role) === 'SUPER_ADMIN' && normalizeRole(req.user!.role) !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Only a Super Admin can delete another Super Admin.' });
    }

    const { error } = await supabaseAdmin
      .from('User')
      .update({
        deletedAt: new Date().toISOString(),
        isActive: false,
        accountStatus: 'DISABLED',
      })
      .eq('id', id);

    if (error) {
      return res.status(500).json({ error: 'Failed to remove staff member.' });
    }

    await logAudit({
      userId: req.user!.id,
      action: 'STAFF_DELETED',
      resource: 'User',
      resourceId: id,
      details: { deletedEmail: user?.email },
    });

    await broadcastServerChange('User', 'DELETE', id);

    return res.json({ success: true, message: 'Staff member account safely deactivated.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete staff member.' });
  }
});

export default router;
