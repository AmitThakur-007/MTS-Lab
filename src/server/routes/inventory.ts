import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { logAudit } from '../services/auditService';

const router = Router();

// 1. GET /api/inventory
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { category, brand, status = 'ACTIVE', search, limit = '200' } = req.query;
    let query = supabaseAdmin.from('InventoryItem').select('*');

    if (status && status !== 'ALL') {
      query = query.eq('status', String(status));
    }

    if (category && category !== 'ALL') {
      query = query.eq('category', String(category));
    }

    if (brand && brand !== 'ALL') {
      query = query.eq('brand', String(brand));
    }

    if (search) {
      const s = String(search).trim();
      query = query.or(`name.ilike.%${s}%,sku.ilike.%${s}%,model.ilike.%${s}%,compatibility.ilike.%${s}%`);
    }

    const { data: items, error } = await query
      .order('name', { ascending: true })
      .limit(parseInt(limit as string, 10) || 200);

    if (error) {
      console.error('[INVENTORY GET ERROR]', error);
      return res.status(500).json({ error: 'Failed to fetch inventory items.' });
    }

    return res.json(items || []);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve inventory.' });
  }
});

// 2. GET /api/inventory/stats
router.get('/stats', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { data: items } = await supabaseAdmin.from('InventoryItem').select('currentStock, minStockLevel, purchasePrice, sellingPrice, status');

    const totalItems = items?.length || 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let totalStockQuantity = 0;
    let totalStockValue = 0;

    (items || []).forEach((item: any) => {
      const stock = item.currentStock || 0;
      const minStock = item.minStockLevel || 5;
      const price = item.purchasePrice || item.sellingPrice || 0;

      totalStockQuantity += stock;
      totalStockValue += stock * price;

      if (stock <= 0) {
        outOfStockCount++;
      } else if (stock <= minStock) {
        lowStockCount++;
      }
    });

    return res.json({
      totalItems,
      lowStockCount,
      outOfStockCount,
      totalStockQuantity,
      totalStockValue,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to calculate inventory statistics.' });
  }
});

// 3. GET /api/inventory/categories
router.get('/categories', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { data: categories } = await supabaseAdmin
      .from('InventoryCategory')
      .select('*')
      .order('displayOrder', { ascending: true });

    return res.json(categories || []);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch categories.' });
  }
});

// 4. POST /api/inventory/categories
router.post('/categories', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, icon } = req.body;
    if (!name) return res.status(400).json({ error: 'Category name is required.' });

    const newCat = {
      id: uuidv4(),
      name: name.trim(),
      description: description || null,
      icon: icon || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { data: created, error } = await supabaseAdmin.from('InventoryCategory').insert([newCat]).select('*').single();
    if (error) return res.status(500).json({ error: 'Failed to create category.' });

    return res.status(201).json(created);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to add inventory category.' });
  }
});

// 5. GET /api/inventory/transactions/history
router.get('/transactions/history', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { itemId, limit = '50' } = req.query;
    let query = supabaseAdmin.from('InventoryTransaction').select('*, item:InventoryItem(name, sku, category)');

    if (itemId) {
      query = query.eq('itemId', String(itemId));
    }

    const { data: transactions, error } = await query
      .order('createdAt', { ascending: false })
      .limit(parseInt(limit as string, 10) || 50);

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch inventory transactions.' });
    }

    return res.json(transactions || []);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve transaction logs.' });
  }
});

// 6. GET /api/inventory/:id
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { data: item, error } = await supabaseAdmin
      .from('InventoryItem')
      .select('*, transactions:InventoryTransaction(*)')
      .eq('id', id)
      .single();

    if (error || !item) {
      return res.status(404).json({ error: 'Inventory item not found.' });
    }

    return res.json(item);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve item.' });
  }
});

// 7. POST /api/inventory
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const {
      name,
      brand,
      model,
      sku,
      category = 'Spare Parts',
      subcategory,
      compatibility,
      unit = 'Piece',
      currentStock = 0,
      minStockLevel = 5,
      maxStockLevel,
      purchasePrice,
      sellingPrice,
      supplier,
      storageLocation,
      description,
      notes,
      imageUrl,
      status = 'ACTIVE',
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Item name is required.' });
    }

    const initialStock = parseInt(currentStock || '0', 10) || 0;
    const newItem = {
      id: uuidv4(),
      name: name.trim(),
      brand: brand ? brand.trim() : null,
      model: model ? model.trim() : null,
      sku: sku ? sku.trim() : `SKU-${Date.now().toString().slice(-6)}`,
      category: category.trim(),
      subcategory: subcategory ? subcategory.trim() : null,
      compatibility: compatibility ? compatibility.trim() : null,
      unit: unit.trim(),
      currentStock: initialStock,
      minStockLevel: parseInt(minStockLevel || '5', 10) || 5,
      maxStockLevel: maxStockLevel ? parseInt(maxStockLevel, 10) : null,
      purchasePrice: purchasePrice !== undefined && purchasePrice !== null && purchasePrice !== '' ? parseFloat(purchasePrice) : null,
      sellingPrice: sellingPrice !== undefined && sellingPrice !== null && sellingPrice !== '' ? parseFloat(sellingPrice) : null,
      supplier: supplier ? supplier.trim() : null,
      storageLocation: storageLocation ? storageLocation.trim() : null,
      description: description ? description.trim() : null,
      notes: notes ? notes.trim() : null,
      imageUrl: imageUrl || null,
      status,
      createdById: req.user!.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { data: created, error } = await supabaseAdmin.from('InventoryItem').insert([newItem]).select('*').single();

    if (error) {
      console.error('[INVENTORY CREATE ERROR]', error);
      return res.status(500).json({ error: 'Failed to create inventory item.' });
    }

    if (initialStock > 0) {
      await supabaseAdmin.from('InventoryTransaction').insert([
        {
          id: uuidv4(),
          itemId: created.id,
          type: 'STOCK_IN',
          quantity: initialStock,
          previousStock: 0,
          newStock: initialStock,
          reason: 'Initial Stock Setup',
          performedById: req.user!.id,
          performedByName: req.user!.name,
          createdAt: new Date().toISOString(),
        },
      ]);
    }

    await logAudit({
      userId: req.user!.id,
      action: 'INVENTORY_ITEM_CREATED',
      resource: 'InventoryItem',
      resourceId: created.id,
      details: { name: created.name, sku: created.sku, stock: created.currentStock },
    });

    return res.status(201).json(created);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to save inventory item.' });
  }
});

// 8. PATCH /api/inventory/:id
router.patch('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body, updatedAt: new Date().toISOString() };
    delete updateData.id;
    delete updateData.transactions;

    const { data: updated, error } = await supabaseAdmin
      .from('InventoryItem')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to update inventory item.' });
    }

    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update inventory.' });
  }
});

// 9. POST /api/inventory/:id/stock-in
router.post('/:id/stock-in', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { quantity, reason = 'Stock replenishment', notes } = req.body;
    const qty = parseInt(quantity, 10);

    if (!qty || qty <= 0) {
      return res.status(400).json({ error: 'Valid positive quantity required.' });
    }

    const { data: item } = await supabaseAdmin.from('InventoryItem').select('*').eq('id', id).single();
    if (!item) return res.status(404).json({ error: 'Item not found.' });

    const prevStock = item.currentStock || 0;
    const newStock = prevStock + qty;

    const { data: updated, error } = await supabaseAdmin
      .from('InventoryItem')
      .update({ currentStock: newStock, updatedAt: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: 'Failed to update stock.' });

    await supabaseAdmin.from('InventoryTransaction').insert([
      {
        id: uuidv4(),
        itemId: id,
        type: 'STOCK_IN',
        quantity: qty,
        previousStock: prevStock,
        newStock,
        reason,
        notes,
        performedById: req.user!.id,
        performedByName: req.user!.name,
        createdAt: new Date().toISOString(),
      },
    ]);

    return res.json({ success: true, item: updated, newStock });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to process stock intake.' });
  }
});

// 10. POST /api/inventory/:id/stock-out
router.post('/:id/stock-out', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { quantity, reason = 'Used for Repair', repairNumber, notes } = req.body;
    const qty = parseInt(quantity, 10);

    if (!qty || qty <= 0) {
      return res.status(400).json({ error: 'Valid positive quantity required.' });
    }

    const { data: item } = await supabaseAdmin.from('InventoryItem').select('*').eq('id', id).single();
    if (!item) return res.status(404).json({ error: 'Item not found.' });

    const prevStock = item.currentStock || 0;
    const newStock = Math.max(0, prevStock - qty);

    const { data: updated, error } = await supabaseAdmin
      .from('InventoryItem')
      .update({ currentStock: newStock, updatedAt: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: 'Failed to deduct stock.' });

    await supabaseAdmin.from('InventoryTransaction').insert([
      {
        id: uuidv4(),
        itemId: id,
        type: 'STOCK_OUT',
        quantity: qty,
        previousStock: prevStock,
        newStock,
        reason,
        repairNumber: repairNumber || null,
        notes,
        performedById: req.user!.id,
        performedByName: req.user!.name,
        createdAt: new Date().toISOString(),
      },
    ]);

    return res.json({ success: true, item: updated, newStock });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to deduct inventory.' });
  }
});

// 11. POST /api/inventory/:id/adjust-stock
router.post('/:id/adjust-stock', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { newStock: targetStock, reason = 'Audit Correction', notes } = req.body;
    const newStock = parseInt(targetStock, 10);

    if (isNaN(newStock) || newStock < 0) {
      return res.status(400).json({ error: 'Valid non-negative stock count required.' });
    }

    const { data: item } = await supabaseAdmin.from('InventoryItem').select('*').eq('id', id).single();
    if (!item) return res.status(404).json({ error: 'Item not found.' });

    const prevStock = item.currentStock || 0;
    const diff = newStock - prevStock;

    const { data: updated, error } = await supabaseAdmin
      .from('InventoryItem')
      .update({ currentStock: newStock, updatedAt: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: 'Failed to adjust stock.' });

    await supabaseAdmin.from('InventoryTransaction').insert([
      {
        id: uuidv4(),
        itemId: id,
        type: 'STOCK_ADJUSTMENT',
        quantity: Math.abs(diff),
        previousStock: prevStock,
        newStock,
        reason,
        notes,
        performedById: req.user!.id,
        performedByName: req.user!.name,
        createdAt: new Date().toISOString(),
      },
    ]);

    return res.json({ success: true, item: updated, newStock });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to adjust stock quantity.' });
  }
});

// 12. DELETE /api/inventory/:id
router.delete('/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await supabaseAdmin.from('InventoryTransaction').delete().eq('itemId', id);
    const { error } = await supabaseAdmin.from('InventoryItem').delete().eq('id', id);

    if (error) return res.status(500).json({ error: 'Failed to delete inventory item.' });

    return res.json({ success: true, message: 'Item deleted successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete item.' });
  }
});

// 13. POST /api/inventory/bulk-delete
router.post('/bulk-delete', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No item IDs provided.' });
    }

    await supabaseAdmin.from('InventoryTransaction').delete().in('itemId', ids);
    const { error } = await supabaseAdmin.from('InventoryItem').delete().in('id', ids);

    if (error) return res.status(500).json({ error: 'Failed to delete inventory items.' });

    return res.json({ success: true, message: `Successfully removed ${ids.length} items.` });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to process bulk delete.' });
  }
});

// 14. GET /api/inventory/suppliers
router.get('/suppliers', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { data: items } = await supabaseAdmin.from('InventoryItem').select('supplier').not('supplier', 'is', null);
    const suppliers = Array.from(new Set((items || []).map((i: any) => i.supplier).filter(Boolean)));
    return res.json(suppliers);
  } catch (err: any) {
    return res.json([]);
  }
});

// 15. GET /api/inventory/locations
router.get('/locations', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { data: items } = await supabaseAdmin.from('InventoryItem').select('storageLocation').not('storageLocation', 'is', null);
    const locations = Array.from(new Set((items || []).map((i: any) => i.storageLocation).filter(Boolean)));
    return res.json(locations);
  } catch (err: any) {
    return res.json([]);
  }
});

export default router;
