import { Router, Request, Response } from 'express';
import { broadcastServerChange } from '../services/realtimeSync';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/rbac';

const router = Router();

// 1. GET /api/public/repair-prices & GET /api/repair-prices
const handleGetPrices = async (req: Request, res: Response) => {
  try {
    const { brand, model, category, search, status } = req.query;
    let query = supabaseAdmin.from('RepairPrice').select('*');

    if (status && status !== 'ALL') {
      query = query.eq('status', String(status));
    } else if (req.path.includes('/public/')) {
      query = query.eq('status', 'ACTIVE');
    }

    if (brand && brand !== 'ALL') query = query.eq('brand', String(brand));
    if (model && model !== 'ALL') query = query.eq('model', String(model));
    if (category && category !== 'ALL') query = query.eq('category', String(category));

    if (search) {
      const s = String(search).trim();
      query = query.or(`brand.ilike.%${s}%,model.ilike.%${s}%,serviceName.ilike.%${s}%,category.ilike.%${s}%,problem.ilike.%${s}%`);
    }

    const { data: prices, error } = await query.order('brand', { ascending: true }).order('model', { ascending: true });

    if (error) {
      console.error('[REPAIR PRICES GET ERROR]', error);
      return res.status(500).json({ error: 'Failed to fetch repair prices.' });
    }

    return res.json(prices || []);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve repair pricing directory.' });
  }
};

router.get('/', handleGetPrices);

// 2. POST /api/repair-prices
router.post('/', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER']), async (req: AuthRequest, res: Response) => {
  try {
    const {
      brand,
      model,
      variant = 'Standard',
      category,
      problem,
      serviceName,
      price,
      priceType = 'FIXED',
      status = 'ACTIVE',
      notes,
      estimatedTime = '1-2 Hours',
    } = req.body;

    if (!brand || !model || !serviceName || price === undefined) {
      return res.status(400).json({ error: 'Brand, model, service name, and price are required.' });
    }

    const newPrice = {
      id: uuidv4(),
      brand: brand.trim(),
      model: model.trim(),
      variant: variant ? variant.trim() : 'Standard',
      category: category ? category.trim() : 'General',
      problem: problem ? problem.trim() : serviceName.trim(),
      serviceName: serviceName.trim(),
      price: parseFloat(price) || 0,
      priceType,
      status,
      notes: notes ? notes.trim() : null,
      estimatedTime,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { data: created, error } = await supabaseAdmin.from('RepairPrice').insert([newPrice]).select('*').single();

    if (error) {
      console.error('[PRICE INSERT ERROR]', error);
      return res.status(500).json({ error: 'Failed to add repair price service.' });
    }

    await broadcastServerChange('RepairPrice', 'CREATE', created.id, created);

    return res.status(201).json(created);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to save repair price.' });
  }
});

// 3. PUT /api/repair-prices/:id & PATCH /api/repair-prices/:id
const handleUpdatePrice = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body, updatedAt: new Date().toISOString() };
    delete updateData.id;

    if (updateData.price !== undefined) {
      updateData.price = parseFloat(updateData.price) || 0;
    }

    const { data: updated, error } = await supabaseAdmin
      .from('RepairPrice')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: 'Failed to update repair price.' });

    await broadcastServerChange('RepairPrice', 'UPDATE', id, updated);

    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update price item.' });
  }
};

router.put('/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER']), handleUpdatePrice);
router.patch('/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER']), handleUpdatePrice);

// 4. PATCH /api/repair-prices/:id/toggle-status
router.patch('/:id/toggle-status', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { data: existing } = await supabaseAdmin.from('RepairPrice').select('status').eq('id', id).single();
    if (!existing) return res.status(404).json({ error: 'Price item not found.' });

    const newStatus = existing.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const { data: updated, error } = await supabaseAdmin
      .from('RepairPrice')
      .update({ status: newStatus, updatedAt: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: 'Failed to toggle status.' });

    await broadcastServerChange('RepairPrice', 'UPDATE', id, updated);

    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to toggle status.' });
  }
});

// 5. DELETE /api/repair-prices/:id
router.delete('/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from('RepairPrice').delete().eq('id', id);

    if (error) return res.status(500).json({ error: 'Failed to delete repair price.' });

    await broadcastServerChange('RepairPrice', 'DELETE', id);

    return res.json({ success: true, message: 'Repair price deleted.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete price record.' });
  }
});

// 6. POST /api/repair-prices/bulk-delete
router.post('/bulk-delete', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: 'No IDs specified.' });

    const { error } = await supabaseAdmin.from('RepairPrice').delete().in('id', ids);
    if (error) return res.status(500).json({ error: 'Failed to bulk delete prices.' });

    for (const id of ids) {
      await broadcastServerChange('RepairPrice', 'DELETE', id);
    }

    return res.json({ success: true, message: `Deleted ${ids.length} price items.` });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to process bulk delete.' });
  }
});

export default router;
