import { Router, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/rbac';

const router = Router();

// Compatibility endpoint for the dashboard badge. The full AccessRequest
// management API remains owned by securityRoutes at /api/security/access-requests.
router.use(authenticate);
router.use(authorize(['SUPER_ADMIN', 'ADMIN']));

router.get('/', async (_req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('AccessRequest')
      .select('id,fullName,email,deviceName,deviceIdentifier,requestedRole,status,createdAt,updatedAt')
      .order('createdAt', { ascending: false });

    if (error) throw error;
    return res.json(data || []);
  } catch (error) {
    console.error('[ACCESS REQUEST COMPAT ERROR]', error);
    return res.status(500).json({ success: false, message: 'Unable to load access requests.' });
  }
});

export default router;
