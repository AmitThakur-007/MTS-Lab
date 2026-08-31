import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { broadcastServerChange } from '../services/realtimeSync';

const router = Router();
const adminRoles = ['SUPER_ADMIN', 'ADMIN'];

router.use(authenticate);
router.use(authorize(adminRoles));

const allowedLevels = new Set(['brand', 'model', 'category', 'subcategory']);

function normalizeFolderBody(body: any) {
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const level = typeof body?.level === 'string' ? body.level.trim().toLowerCase() : '';
  const brand = typeof body?.brand === 'string' ? body.brand.trim() : '';
  const model = typeof body?.model === 'string' && body.model.trim() ? body.model.trim() : null;
  const category = typeof body?.category === 'string' && body.category.trim() ? body.category.trim() : null;
  const path = typeof body?.path === 'string' && body.path.trim() ? body.path.trim() : name;

  if (!name) return { error: 'Folder name is required.' };
  if (!allowedLevels.has(level)) return { error: 'Invalid folder level.' };
  if (!brand) return { error: 'Folder brand is required.' };

  return { value: { name, level, brand, model, category, path } };
}

router.get('/', async (_req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('RepairPriceFolder')
      .select('id,name,level,brand,model,category,path,createdAt,createdBy')
      .order('createdAt', { ascending: true });

    if (error) throw error;
    return res.json(data || []);
  } catch (error) {
    console.error('[REPAIR PRICE FOLDERS GET ERROR]', error);
    return res.status(500).json({ success: false, message: 'Unable to load repair price folders.' });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const normalized = normalizeFolderBody(req.body);
    if ('error' in normalized) return res.status(400).json({ success: false, message: normalized.error });

    const folder = {
      id: uuidv4(),
      ...normalized.value,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: req.user?.id || null,
    };

    const { data: existing } = await supabaseAdmin
      .from('RepairPriceFolder')
      .select('id')
      .eq('path', folder.path)
      .maybeSingle();

    if (existing) return res.status(409).json({ success: false, message: 'A folder with this path already exists.' });

    const { data, error } = await supabaseAdmin.from('RepairPriceFolder').insert(folder).select('id,name,level,brand,model,category,path,createdAt,createdBy').single();
    if (error) throw error;

    await broadcastServerChange('RepairPriceFolder', 'CREATE', data.id, data);
    return res.status(201).json(data);
  } catch (error) {
    console.error('[REPAIR PRICE FOLDER CREATE ERROR]', error);
    return res.status(500).json({ success: false, message: 'Unable to create repair price folder.' });
  }
});

router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const normalized = normalizeFolderBody(req.body);
    if ('error' in normalized) return res.status(400).json({ success: false, message: normalized.error });

    const update = { ...normalized.value, updatedAt: new Date().toISOString() };
    const { data, error } = await supabaseAdmin
      .from('RepairPriceFolder')
      .update(update)
      .eq('id', id)
      .select('id,name,level,brand,model,category,path,createdAt,createdBy')
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, message: 'Repair price folder not found.' });

    await broadcastServerChange('RepairPriceFolder', 'UPDATE', id, data);
    return res.json(data);
  } catch (error) {
    console.error('[REPAIR PRICE FOLDER UPDATE ERROR]', error);
    return res.status(500).json({ success: false, message: 'Unable to update repair price folder.' });
  }
});

router.put('/:id', async (req: AuthRequest, res: Response) => {
  req.method = 'PATCH';
  return router.handle(req, res, () => undefined);
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('RepairPriceFolder')
      .delete()
      .eq('id', id)
      .select('id,name,level,brand,model,category,path')
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, message: 'Repair price folder not found.' });

    await broadcastServerChange('RepairPriceFolder', 'DELETE', id, data);
    return res.json({ success: true, data });
  } catch (error) {
    console.error('[REPAIR PRICE FOLDER DELETE ERROR]', error);
    return res.status(500).json({ success: false, message: 'Unable to delete repair price folder.' });
  }
});

export default router;
