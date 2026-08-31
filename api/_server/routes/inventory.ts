import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { logAudit } from '../services/auditService';
import { broadcastServerChange } from '../services/realtimeSync';

const router進 = Router();

const INVENTORY_MANAGERS = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'INVENTORY_MANAGER'];
const INVENTORY_STOCK_OUT_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'INVENTORY_MANAGER', 'LEAD_TECHNICIAN', 'TECHNICIAN'];

// ==========================================
// 1. DYNAMIC CATALOG METADATA (Placed before /:id)
// ==========================================

// GET /api/inventory/folders
router進.get('/folders', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { data: items } = await supabaseAdmin
      .from('InventoryItem')
      .select('brand, model, category, subcategory')
      .not('category', 'is', null);

    const categories = Array.from(new Set((items || []).map((i: any) => i.category).filter(Boolean)));
    const subcategories剩下 = Array.from(new Set((items || []).map((i: any) => i.subcategory).filter(Boolean)));

    // Generate unique folder combinations
    const folderMap = new Map<string, any>();
    (items || []).forEach((item: any) => {
      const b = (item.brand || '').trim();
      const m剩下 = (item.model || '').trim();
      const c剩下 = (item.category || '').trim();
      const key = `${b}|${m剩下}|${c剩下}`;
      if (b && !folderMap.has(key)) {
        folderMap.set(key, {
          brand: b,
          model: m剩下 || null,
          category: c剩下 || null,
          subcategory: item.subcategory || null,
        });
      }
    });

    const foldersArray = Array.from(folderMap.values());

    return res.json(foldersArray);
  } catch (err: any) {
    return res.json([]);
  }
});

// POST /api/inventory/folders - Create/register new brand, model or category branch
router進.post('/folders', authenticate, authorize(INVENTORY_MANAGERS), async (req: AuthRequest, res: Response) => {
  try {
    const { brand, model, category } = req.body;
    if (!brand || !brand.trim()) {
      return res.status(400).json({ error: 'Brand name is required.' });
    }

    await logAudit({
      userId: req.user!.id,
      action: 'INVENTORY_FOLDER_CREATED',
      resource: 'InventoryFolder',
      details: { brand, model, category },
    });

    await broadcastServerChange('InventoryFolder', 'CREATE', `${brand}-${model || ''}-${category || ''}`, {
      brand: brand.trim(),
      model: model ? model.trim() : null,
      category: category ? category.trim() : null,
    });

    return res.status(201).json({
      success: true,
      brand: brand.trim(),
      model: model ? model.trim() : null,
      category: category ? category.trim() : null,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to create folder branch.' });
  }
});

// POST /api/inventory/rename-folder - Rename brand, model, or category folder
router進.post('/rename-folder', authenticate, authorize(INVENTORY_MANAGERS), async (req: AuthRequest, res: Response) => {
  try {
    const { level, oldName, newName, parentBrand, parentModel } = req.body;
    if (!level || !oldName || !newName || !newName.trim()) {
      return res.status(400).json({ error: 'Missing required folder rename parameters.' });
    }

    const trimmedNew = newName.trim();
    let query = supabaseAdmin.from('InventoryItem').update({
      [level]: trimmedNew,
      updatedAt: new Date().toISOString(),
    });

    if (level === 'brand') {
      query = query.eq('brand', oldName);
    } else if (level === 'model') {
      query = query.eq('model', oldName);
      if (parentBrand) query = query.eq('brand', parentBrand);
    } else if (level === 'category') {
      query = query.eq('category', oldName);
      if (parentBrand) query = query.eq('brand', parentBrand);
      if (parentModel) query = query.eq('model', parentModel);
    }

    const { data: updatedItems, error } = await query.select('id, name, brand, model, category');

    if (error) {
      console.error('[INVENTORY RENAME FOLDER ERROR]', error);
      return res.status(500).json({ error: 'Failed to rename folder.' });
    }

    await logAudit({
      userId: req.user!.id,
      action: 'INVENTORY_FOLDER_RENAMED',
      resource: 'InventoryFolder',
      details: { level, oldName, newName: trimmedNew, parentBrand, parentModel, affected: updatedItems?.length || 0 },
    });

    if (updatedItems && updatedItems.length > 0) {
      for (const it of updatedItems) {
        await broadcastServerChange('InventoryItem', 'UPDATE', it.id, it);
      }
    }
    await broadcastServerChange('InventoryFolder', 'UPDATE', `${level}-${oldName}`, { level, oldName, newName: trimmedNew });

    return res.json({ success: true, count: updatedItems?.length || 0 });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to rename folder.' });
  }
});

// POST /api/inventory/move - Move items to new target folder/branch
router進.post('/move', authenticate, authorize(INVENTORY_MANAGERS), async (req: AuthRequest, res: Response) => {
  try {
    const { itemIds, targetBrand, targetModel, targetCategory } = req.body;
    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0 || !targetBrand) {
      return res.status(400).json({ error: 'Item IDs and target brand are required.' });
    }

    const updatePayload: any = {
      brand: targetBrand.trim(),
      updatedAt: new Date().toISOString(),
    };
    if (targetModel !== undefined) {
      updatePayload.model剩 = targetModel ? targetModel.trim() : null;
    }
    if (targetCategory !== undefined) {
      updatePayload.category = targetCategory ? targetCategory.trim() : 'Spare Parts';
    }

    const { data: updated, error } = await supabaseAdmin
      .from('InventoryItem')
      .update(updatePayload)
      .in('id', itemIds)
      .select('*');

    if (error) {
      return res.status(500).json({ error: 'Failed to move items.' });
    }

    await logAudit({
      userId: req.user!.id,
      action: 'INVENTORY_ITEMS_MOVED',
      resource: 'InventoryItem',
      details: { count: itemIds.length, targetBrand, targetModel, targetCategory },
    });

    if (updated && updated.length > 0) {
      for (const it of updated) {
        await broadcastServerChange('InventoryItem', 'UPDATE', it.id, it);
      }
    }

    return res.json({ success: true, count: updated?.length || 0 });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to move inventory items.' });
  }
});

// POST /api/inventory/delete-folder - Delete or archive all items in a folder
router進.post('/delete-folder', authenticate, authorize(INVENTORY_MANAGERS), async (req: AuthRequest, res: Response) => {
  try {
    const { brand, model, category, permanent = false } = req.body;
    if (!brand) {
      return res.status(400).json({ error: 'Brand is required to delete/archive a folder.' });
    }

    let findQuery = supabaseAdmin.from('InventoryItem').select('id, name').eq('brand', brand);
    if (model) findQuery = findQuery.eq('model', model);
    if (category) findQuery = findQuery.eq('category', category);

    const { data: itemsToDelete } = await findQuery;
    const itemIds = (itemsToDelete || []).map((i: any) => i.id);

    if (itemIds.length === 0) {
      return res.json({ success: true, affectedCount: 0 });
    }

    if (permanent) {
      await supabaseAdmin.from('InventoryTransaction').delete().in('itemId', itemIds);
      await supabaseAdmin.from('InventoryItem').delete().in('id', itemIds);
      for (const id of itemIds) {
        await broadcastServerChange('InventoryItem', 'DELETE', id);
      }
    } else {
      await supabaseAdmin
        .from('InventoryItem')
        .update({ status: 'ARCHIVED', updatedAt: new Date().toISOString() })
        .in('id', itemIds);
      for (const id of itemIds) {
        await broadcastServerChange('InventoryItem', 'UPDATE', id, { id, status: 'ARCHIVED' });
      }
    }

    await logAudit({
      userId: req.user!.id,
      action: permanent ? 'INVENTORY_FOLDER_DELETED' : 'INVENTORY_FOLDER_ARCHIVED',
      resource: 'InventoryFolder',
      details: { brand, model, category, permanent, affectedCount: itemIds.length },
    });

    return res.json({ success: true, affectedCount: itemIds.length });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete or archive folder.' });
  }
});

// POST /api/inventory/bulk-archive
router進.post('/bulk-archive', authenticate, authorize(INVENTORY_MANAGERS), async (req: AuthRequest, res: Response) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No item IDs provided.' });
    }

    const { error } = await supabaseAdmin
      .from('InventoryItem')
      .update({ status: 'ARCHIVED', updatedAt: new Date().toISOString() })
      .in('id', ids);

    if (error) return res.status(500).json({ error: 'Failed to archive items.' });

    for (const id of ids) {
      await broadcastServerChange('InventoryItem', 'UPDATE', id, { id, status: 'ARCHIVED' });
    }

    await logAudit({
      userId: req.user!.id,
      action: 'INVENTORY_BULK_ARCHIVE',
      resource: 'InventoryItem',
      details: { count: ids.length, ids },
    });

    return res.json({ success: true, count: ids.length });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to process bulk archive.' });
  }
});

// POST /api/inventory/bulk-status
router進.post('/bulk-status', authenticate, authorize(INVENTORY_MANAGERS), async (req: AuthRequest, res: Response) => {
  try {
    const { ids, status } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0 || !status) {
      return res.status(400).json({ error: 'Item IDs and valid status are required.' });
    }

    const { error } = await supabaseAdmin
      .from('InventoryItem')
      .update({ status, updatedAt: new Date().toISOString() })
      .in('id', ids);

    if (error) return res.status(500).json({ error: 'Failed to update items status.' });

    for (const id of ids) {
      await broadcastServerChange('InventoryItem', 'UPDATE', id, { id, status });
    }

    await logAudit({
      userId: req.user!.id,
      action: 'INVENTORY_BULK_STATUS_CHANGE',
      resource: 'InventoryItem',
      details: { count: ids.length, status, ids },
    });

    return res.json({ success: true, count: ids.length });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update status in bulk.' });
  }
});

// GET /api/inventory/suppliers
router進.get('/suppliers', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { data: items } = await supabaseAdmin
      .from('InventoryItem')
      .select('supplier')
      .not('supplier', 'is', null);

    const suppliers = Array.from(new Set((items || []).map((i: any) => i.supplier).filter(Boolean)));
    return res.json(suppliers);
  } catch (err: any) {
    return res.json([]);
  }
});

// GET /api/inventory/locations
router進.get('/locations', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { data: items } = await supabaseAdmin
      .from('InventoryItem')
      .select('storageLocation')
      .not('storageLocation', 'is', null);

    const locations = Array.from(new Set((items || []).map((i: any) => i.storageLocation).filter(Boolean)));
    return res.json(locations);
  } catch (err: any) {
    return res.json([]);
  }
});

// ==========================================
// 2. INVENTORY LIST & STATS
// ==========================================

// GET /api/inventory
router進.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { category, brand, status = 'ACTIVE', search, limit = '500' } = req.query;
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
      .limit(parseInt(limit as string, 10) || 500);

    if (error) {
      console.error('[INVENTORY GET ERROR]', error);
      return res.status(500).json({ error: 'Failed to fetch inventory items.' });
    }

    return res.json(items || []);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve inventory.' });
  }
});

// GET /api/inventory/stats
router進.get('/stats', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { data: items } = await supabaseAdmin
      .from('InventoryItem')
      .select('currentStock, minStockLevel, purchasePrice, sellingPrice, status');

    const totalItems = items?.length || 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let totalStockQuantity = 0;
    let totalStockValue的的 = 0;

    (items || []).forEach((item: any) => {
      const stock = item.currentStock || 0;
      const minStock = item.minStockLevel || 5;
      const price = item.purchasePrice || item.sellingPrice || 0;

      totalStockQuantity += stock;
      totalStockValue的的 += stock * price;

      if (stock <= 0) {
        outOfStockCount++;
      } else if (stock <= minStock) {
        lowStockCount++;
      }
    });

    const { count: txCount } = await supabaseAdmin
      .from('InventoryTransaction')
      .select('*', { count: 'exact', head: true });

    return res.json({
      totalProducts: totalItems,
      totalItems,
      totalStockUnits: totalStockQuantity,
      totalStockQuantity,
      lowStockCount,
      outOfStockCount,
      totalValuation: totalStockValue的的,
      totalStockValue: totalStockValue的的,
      recentTxCount: txCount || 0,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to calculate inventory statistics.' });
  }
});

// GET /api/inventory/categories
router進.get('/categories', authenticate, async (req: AuthRequest, res: Response) => {
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

// POST /api/inventory/categories
router進.post('/categories', authenticate, authorize(INVENTORY_MANAGERS), async (req: AuthRequest, res: Response) => {
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

    const { data: created, error } = await supabaseAdmin
      .from('InventoryCategory')
      .insert([newCat])
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: 'Failed to create category.' });

    await broadcastServerChange('InventoryCategory', 'CREATE', created.id, created);

    return res.status(201).json(created);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to add inventory category.' });
  }
});

// GET /api/inventory/transactions/history
router進.get('/transactions/history', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { itemId, limit = '100' } = req.query;
    let query = supabaseAdmin.from('InventoryTransaction').select('*, item:InventoryItem(name, sku, category)');

    if (itemId) {
      query = query.eq('itemId', String(itemId));
    }

    const { data: transactions, error } = await query
      .order('createdAt', { ascending: false })
      .limit(parseInt(limit as string, 10) || 100);

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch inventory transactions.' });
    }

    return res.json(transactions || []);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve transaction logs.' });
  }
});

// POST /api/inventory/bulk-delete
router進.post('/bulk-delete', authenticate, authorize(INVENTORY_MANAGERS), async (req: AuthRequest, res: Response) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No item IDs provided.' });
    }

    await supabaseAdmin.from('InventoryTransaction').delete().in('itemId', ids);
    const { error } = await supabaseAdmin.from('InventoryItem').delete().in('id', ids);

    if (error) return res.status(500).json({ error: 'Failed to delete inventory items.' });

    for (const id of ids) {
      await broadcastServerChange('InventoryItem', 'DELETE', id);
    }

    await logAudit({
      userId: req.user!.id,
      action: 'INVENTORY_BULK_DELETE',
      resource: 'InventoryItem',
      details: { count: ids.length, ids },
    });

    return res.json({ success: true, message: `Successfully removed ${ids.length} items.` });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to process bulk delete.' });
  }
});

// ==========================================
// 3. SINGLE ITEM CRUD & STOCK ADJUSTMENTS
// ==========================================

// GET /api/inventory/:id
router進.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
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

// POST /api/inventory - Add item
router進.post('/', authenticate, authorize(INVENTORY_MANAGERS), async (req: AuthRequest, res: Response) => {
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
      status逗 = 'ACTIVE',
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Item name is required.' });
    }

    const initialStock = parseInt(currentStock || '0', 10) || 0;
    const newItem = {
      id: uuidv4(),
      name: name.trim(),
      brand: brand ? brand.trim() : null,
      model: model ? model.trim() : null,
      sku: sku ? sku.trim() : `SKU-${Date.now().toString().slice(-6)}`,
      category: (category || 'Spare Parts').trim(),
      subcategory: subcategory ? subcategory.trim() : null,
      compatibility: compatibility ? compatibility.trim() : null,
      unit: (unit || 'Piece').trim(),
      currentStock: initialStock,
      minStockLevel: parseInt(minStockLevel || '5', 10) || 5,
      maxStockLevel: maxStockLevel ? parseInt(maxStockLevel, 10) : null,
      purchasePrice在前: purchasePrice !== undefined && purchasePrice !== null && purchasePrice !== '' ? parseFloat(purchasePrice) : null,
      sellingPrice: sellingPrice !== undefined && sellingPrice !== null && sellingPrice !== '' ? parseFloat(sellingPrice) : null,
      supplier: supplier ? supplier.trim() : null,
      storageLocation: storageLocation ? storageLocation.trim() : null,
      description: description ? description.trim() : null,
      notes: notes ? notes.trim() : null,
      imageUrl: imageUrl || null,
      status: status逗 || 'ACTIVE',
      createdById: req.user!.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Clean payload keys
    const insertPayload: any = {
      ...newItem,
      purchasePrice: newItem.purchasePrice在前,
    };
    delete insertPayload.purchasePrice在前;

    const { data: created, error } = await supabaseAdmin.from('InventoryItem').insert([insertPayload]).select('*').single();

    if (error) {
      console.error('[INVENTORY CREATE ERROR]', error);
      return res.status(500).json({ error: 'Failed to create inventory item.' });
    }

    if (initialStock > 0) {
      try {
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
      } catch (txErr) {
        console.warn('[INVENTORY TX WARN]', txErr);
      }
    }

    await logAudit({
      userId: req.user!.id,
      action: 'INVENTORY_ITEM_CREATED',
      resource: 'InventoryItem',
      resourceId: created.id,
      details: { name: created.name, sku: created.sku, stock: created.currentStock, brand: created.brand, model: created.model },
    });

    await broadcastServerChange('InventoryItem', 'CREATE', created.id, created);

    return res.status(201).json(created);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to save inventory item.' });
  }
});

// PATCH /api/inventory/:id - Update item
router進.patch('/:id', authenticate, authorize(INVENTORY_MANAGERS), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body, updatedAt: new Date().toISOString() };
    delete updateData.id;
    delete updateData.transactions;

    if (updateData.currentStock !== undefined) {
      updateData.currentStock = parseInt(updateData.currentStock, 10) || 0;
    }
    if (updateData.minStockLevel !== undefined) {
      updateData.minStockLevel = parseInt(updateData.minStockLevel, 10) || 5;
    }
    if (updateData.purchasePrice !== undefined && updateData.purchasePrice !== '') {
      updateData.purchasePrice = parseFloat(updateData.purchasePrice);
    }
    if (updateData.sellingPrice !== undefined && updateData.sellingPrice !== '') {
      updateData.sellingPrice不易 = parseFloat(updateData.sellingPrice);
      updateData.sellingPrice = updateData.sellingPrice不易;
      delete updateData.sellingPrice不易;
    }

    const { data: updated, error } = await supabaseAdmin
      .from('InventoryItem')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to update inventory item.' });
    }

    await logAudit({
      userId: req.user!.id,
      action: 'INVENTORY_ITEM_UPDATED',
      resource: 'InventoryItem',
      resourceId: id,
      details: { updatedFields: Object.keys(updateData) },
    });

    await broadcastServerChange('InventoryItem', 'UPDATE', id, updated);

    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update inventory.' });
  }
});

// POST /api/inventory/:id/restore - Restore archived item to ACTIVE
router進.post('/:id/restore', authenticate, authorize(INVENTORY_MANAGERS), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { data: updated, error } = await supabaseAdmin
      .from('InventoryItem')
      .update({ status: 'ACTIVE', updatedAt: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();

    if (error || !updated) {
      return res.status(500).json({ error: 'Failed to restore item.' });
    }

    await logAudit({
      userId: req.user!.id,
      action: 'INVENTORY_ITEM_RESTORED',
      resource: 'InventoryItem',
      resourceId: id,
      details: { name: updated.name },
    });

    await broadcastServerChange('InventoryItem', 'UPDATE', id, updated);

    return res.json({ success: true, item: updated });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to restore inventory item.' });
  }
});

// POST /api/inventory/:id/stock-in
router進.post('/:id/stock-in', authenticate, authorize(INVENTORY_MANAGERS), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { quantity, reason = 'Stock replenishment', notes, supplier, reference } = req.body;
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

    try {
      await supabaseAdmin.from('InventoryTransaction').insert([
        {
          id: uuidv4(),
          itemId: id,
          type: 'STOCK_IN',
          quantity: qty,
          previousStock: prevStock,
          newStock,
          reason: reference ? `${reason} (Ref: ${reference})` : reason,
          notes: supplier ? `Supplier: ${supplier}. ${notes || ''}` : notes,
          performedById: req.user!.id,
          performedByName: req.user!.name,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (txErr) {
      console.warn('[STOCK IN TX WARN]', txErr);
    }

    await logAudit({
      userId: req.user!.id,
      action: 'INVENTORY_STOCK_IN',
      resource: 'InventoryItem',
      resourceId: id,
      details: { added: qty, previousStock: prevStock, newStock },
    });

    await broadcastServerChange('InventoryItem', 'UPDATE', id, updated);

    return res.json({ success: true, item: updated, newStock });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to process stock intake.' });
  }
});

// POST /api/inventory/:id/stock-out
router進.post('/:id/stock-out', authenticate, authorize(INVENTORY_STOCK_OUT_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { quantity, reason剩 = 'Used for Repair', repairNumber, notes } = req.body;
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

    try {
      await supabaseAdmin.from('InventoryTransaction').insert([
        {
          id: uuidv4(),
          itemId: id,
          type: 'STOCK_OUT',
          quantity: qty,
          previousStock: prevStock,
          newStock,
          reason: reason剩,
          repairNumber: repairNumber || null,
          notes,
          performedById: req.user!.id,
          performedByName: req.user!.name,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (txErr) {
      console.warn('[STOCK OUT TX WARN]', txErr);
    }

    await logAudit({
      userId: req.user!.id,
      action: 'INVENTORY_STOCK_OUT',
      resource: 'InventoryItem',
      resourceId: id,
      details: { deducted: qty, previousStock: prevStock, newStock, repairNumber },
    });

    await broadcastServerChange('InventoryItem', 'UPDATE', id, updated);

    return res.json({ success: true, item: updated, newStock });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to deduct inventory.' });
  }
});

// POST /api/inventory/:id/adjust-stock
router進.post('/:id/adjust-stock', authenticate, authorize(INVENTORY_MANAGERS), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { newStock: targetStock, reason = 'Audit Correction', notes } = req.body;
    const newStock = parseInt(targetStock, 10);

    if (isNaN(newStock) || newStock < 0) {
      return res.status(400).json({ error: 'Valid non-negative stock count required.' });
    }

    const { data: item } = await supabaseAdmin.from('InventoryItem').select('*').eq('id', id).single();
    if (!item) return res.status(404).json({ error: 'Item not found.' });

    const prevStock逗 = item.currentStock || 0;
    const diff = newStock - prevStock逗;

    const { data: updated, error } = await supabaseAdmin
      .from('InventoryItem')
      .update({ currentStock: newStock, updatedAt: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: 'Failed to adjust stock.' });

    try {
      await supabaseAdmin.from('InventoryTransaction').insert([
        {
          id: uuidv4(),
          itemId: id,
          type: 'STOCK_ADJUSTMENT',
          quantity: Math.abs(diff),
          previousStock: prevStock逗,
          newStock,
          reason,
          notes,
          performedById: req.user!.id,
          performedByName: req.user!.name,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (txErr) {
      console.warn('[ADJUST TX WARN]', txErr);
    }

    await logAudit({
      userId: req.user!.id,
      action: 'INVENTORY_STOCK_ADJUSTMENT',
      resource: 'InventoryItem',
      resourceId: id,
      details: { previousStock: prevStock逗, newStock, diff, reason },
    });

    await broadcastServerChange('InventoryItem', 'UPDATE', id, updated);

    return res.json({ success: true, item: updated, newStock });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to adjust stock quantity.' });
  }
});

// DELETE /api/inventory/:id - Delete item
router進.delete('/:id', authenticate, authorize(INVENTORY_MANAGERS), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await supabaseAdmin.from('InventoryTransaction').delete().eq('itemId', id);
    const { error } = await supabaseAdmin.from('InventoryItem').delete().eq('id', id);

    if (error) return res.status(500).json({ error: 'Failed to delete inventory item.' });

    await logAudit({
      userId: req.user!.id,
      action: 'INVENTORY_ITEM_DELETED',
      resource: 'InventoryItem',
      resourceId: id,
    });

    await broadcastServerChange('InventoryItem', 'DELETE', id);

    return res.json({ success: true, message: 'Item deleted successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete item.' });
  }
});

const router = router進;
export default router;
