import { Router, Request, Response } from 'express';
import { broadcastServerChange } from '../services/realtimeSync';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/rbac';

const router = Router();

// 1. GET /api/products & GET /api/public/products
router.get('/', async (req: Request, res: Response) => {
  try {
    const { category, search } = req.query;
    let query = supabaseAdmin.from('Product').select('*');

    if (category && category !== 'ALL') {
      query = query.eq('category', String(category));
    }

    if (search) {
      const s = String(search).trim();
      query = query.or(`name.ilike.%${s}%,description.ilike.%${s}%,category.ilike.%${s}%`);
    }

    const { data: products, error } = await query.order('createdAt', { ascending: false });

    if (error) return res.status(500).json({ error: 'Failed to fetch products.' });

    return res.json(products || []);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve products.' });
  }
});

// 2. POST /api/products
router.post('/', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, price, discountPrice, stockQuantity = 0, category = 'Accessories', imageUrl, isFeatured = false, isBestSeller = false } = req.body;

    if (!name || price === undefined) {
      return res.status(400).json({ error: 'Product name and price are required.' });
    }

    const newProduct = {
      id: uuidv4(),
      name: name.trim(),
      description: description ? description.trim() : null,
      price: parseFloat(price) || 0,
      discountPrice: discountPrice ? parseFloat(discountPrice) : null,
      stockQuantity: parseInt(stockQuantity, 10) || 0,
      category: category.trim(),
      imageUrl: imageUrl || null,
      isFeatured: Boolean(isFeatured),
      isBestSeller: Boolean(isBestSeller),
      rating: 4.8,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { data: created, error } = await supabaseAdmin.from('Product').insert([newProduct]).select('*').single();
    if (error) return res.status(500).json({ error: 'Failed to save product.' });

    await broadcastServerChange('Product', 'CREATE', created.id, created);

    return res.status(201).json(created);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to create product.' });
  }
});

// 3. PUT /api/products/:id
router.put('/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body, updatedAt: new Date().toISOString() };
    delete updateData.id;

    if (updateData.price !== undefined) updateData.price = parseFloat(updateData.price) || 0;
    if (updateData.discountPrice !== undefined) updateData.discountPrice = updateData.discountPrice ? parseFloat(updateData.discountPrice) : null;
    if (updateData.stockQuantity !== undefined) updateData.stockQuantity = parseInt(updateData.stockQuantity, 10) || 0;

    const { data: updated, error } = await supabaseAdmin
      .from('Product')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: 'Failed to update product.' });

    await broadcastServerChange('Product', 'UPDATE', id, updated);

    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update product record.' });
  }
});

// 4. DELETE /api/products/:id
router.delete('/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from('Product').delete().eq('id', id);
    if (error) return res.status(500).json({ error: 'Failed to delete product.' });

    await broadcastServerChange('Product', 'DELETE', id);

    return res.json({ success: true, message: 'Product deleted.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete product.' });
  }
});

export default router;
