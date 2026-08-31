import { Router, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { normalizeRole } from '../middleware/rbac';

const router = Router();

const STAFF_DIRECTORY_ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'MANAGER',
  'HEAD_TECHNICIAN',
  'LEAD_TECHNICIAN',
  'TECHNICIAN',
  'RECEPTIONIST',
  'TECHNICAL_ASSISTANT',
  'INVENTORY_MANAGER',
  'ACCOUNTANT',
  'STAFF',
];

// GET /api/staff
// Uses the existing public.User table as the authoritative staff source.
// Only directory/assignment fields are returned; credentials and auth settings
// are intentionally excluded.
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const callerRole = normalizeRole(req.user?.role || '');
    if (!STAFF_DIRECTORY_ROLES.includes(callerRole)) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to access the staff directory.',
      });
    }

    const { data: users, error } = await supabaseAdmin
      .from('User')
      .select('id, name, email, role, department, phoneNumber, profileImage, branchId, accountStatus, isActive')
      .is('deletedAt', null)
      .eq('isActive', true)
      .order('name', { ascending: true });

    if (error) {
      console.error('[STAFF DIRECTORY GET ERROR]', error);
      return res.status(500).json({
        success: false,
        message: 'Unable to load staff directory.',
      });
    }

    return res.status(200).json(users || []);
  } catch (err) {
    console.error('[STAFF DIRECTORY EXCEPTION]', err);
    return res.status(500).json({
      success: false,
      message: 'Unable to load staff directory.',
    });
  }
});

export default router;
