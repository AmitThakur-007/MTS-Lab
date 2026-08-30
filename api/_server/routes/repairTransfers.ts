import { Router, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/my-requests', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const { data: requests, error } = await supabaseAdmin
            .from('RepairTransferRequest')
            .select('*')
            .or(`senderId.eq.${req.user!.id},receiverId.eq.${req.user!.id}`)
            .order('createdAt', { ascending: false });

        if (error) {
            return res.json([]);
        }

        return res.json(requests || []);
    } catch {
        return res.json([]);
    }
});

export default router;