import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { logAudit } from '../services/auditService';
import { broadcastServerChange } from '../services/realtimeSync';

const router = Router();

const INVENTORY_MANAGERS = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'INVENTORY_MANAGER', 'RECEPTIONIST'];
const INVENTORY_STOCK_OUT_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'INVENTORY_MANAGER', 'LEAD_TECHNICIAN', 'TECHNICIAN', 'RECEPTIONIST'];

// In-memory persistent registry for custom-created folders (even when empty of items)
interface CustomFolderEntry {
  brand: string;
  model: string | null;
  category: string | null;
  subcategory?: string | null;
  status?: string;
}

const customFoldersRegistry = new Map<string, CustomFolderEntry>();

function getFolderKey(brand: string, model?: string | null, category?: string | null): string {
  return `${(brand || '').trim().toLowerCase()}|${(model || '').trim().toLowerCase()}|${(category || '').trim().toLowerCase()}`;
}

export function getDeviceType(item: {
  subcategory?: string | null;
  name?: string | null;
  model?: string | null;
  brand?: string | null;
  category?: string | null;
  compatibility?: string | null;
}): 'Smartphone' | 'Tablet' | 'iPad' | 'Laptop' | 'TV' | 'Other' {
  if (item.subcategory) {
    const sub = item.subcategory.trim().toLowerCase();
    if (sub === 'smartphone' || sub === 'phone') return 'Smartphone';
    if (sub === 'tablet') return 'Tablet';
    if (sub === 'ipad') return 'iPad';
    if (sub === 'laptop' || sub === 'macbook' || sub === 'notebook') return 'Laptop';
    if (sub === 'tv' || sub === 'television') return 'TV';
  }

  const text = `${item.name || ''} ${item.model || ''} ${item.brand || ''} ${item.compatibility || ''}`.toLowerCase();
  if (text.includes('ipad')) return 'iPad';
  if (text.includes('macbook') || text.includes('laptop') || text.includes('thinkpad') || text.includes('zenbook') || text.includes('notebook') || text.includes('legion') || text.includes('inspiron')) return 'Laptop';
  if (text.includes('tab ') || text.includes('tablet') || text.includes('surface pro') || text.includes('pad 6') || text.includes('xiaomi pad')) return 'Tablet';
  if (text.includes(' tv') || text.includes('bravia') || text.includes('television') || text.includes('smart tv') || text.includes('qled') || text.includes('oled tv')) return 'TV';
  if (text.includes('iphone') || text.includes('galaxy') || text.includes('pixel') || text.includes('redmi') || text.includes('realme') || text.includes('xiaomi') || text.includes('oppo') || text.includes('vivo') || text.includes('oneplus') || text.includes('motorola') || text.includes('huawei') || text.includes('nokia') || text.includes('phone')) return 'Smartphone';

  return 'Other';
}

// ==========================================
// 1. DYNAMIC CATALOG METADATA (Placed before /:id)
// ==========================================

// GET /api/inventory/folders
router.get('/folders', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { status = 'ACTIVE' } = req.query;
    let query = supabaseAdmin
      .from('InventoryItem')
      .select('brand, model, category, subcategory, status')
      .not('brand', 'is', null)
      .neq('status', 'INVENTORY_FILE');

    if (status && status !== 'ALL') {
      if (status === 'ACTIVE') {
        query = query.in('status', ['ACTIVE', 'FOLDER_METADATA']);
      } else {
        query = query.eq('status', String(status));
      }
    }

    const { data: items, error } = await query;
    if (error) {
      console.warn('[INVENTORY GET FOLDERS DB WARN]', error);
    }

    const folderMap = new Map<string, CustomFolderEntry>();

    // 1. Add custom registered folders if status matches
    customFoldersRegistry.forEach((folder, key) => {
      const folderStatus = folder.status || 'ACTIVE';
      if (status === 'ALL' || (status === 'ACTIVE' && folderStatus === 'ACTIVE') || (status === 'ARCHIVED' && folderStatus === 'ARCHIVED')) {
        folderMap.set(key, folder);
      }
    });

    // 2. Add all unique folder combinations from items in database matching the status filter
    (items || []).forEach((item: any) => {
      const b = (item.brand || '').trim();
      const m = (item.model || '').trim();
      const c = (item.category || '').trim();
      if (b) {
        const key = getFolderKey(b, m, c);
        if (!folderMap.has(key)) {
          folderMap.set(key, {
            brand: b,
            model: m || null,
            category: c || null,
            subcategory: item.subcategory || null,
            status: item.status || 'ACTIVE',
          });
        }
      }
    });

    const foldersArray = Array.from(folderMap.values());
    return res.json(foldersArray);
  } catch (err: any) {
    console.error('[INVENTORY GET FOLDERS ERROR]', err);
    return res.json(Array.from(customFoldersRegistry.values()));
  }
});

// POST /api/inventory/folders - Create/register new brand, model or category branch
router.post('/folders', authenticate, authorize(INVENTORY_MANAGERS), async (req: AuthRequest, res: Response) => {
  try {
    const { brand, model, category } = req.body;
    if (!brand || !brand.trim()) {
      return res.status(400).json({ error: 'Brand name is required.' });
    }

    const trimmedBrand = brand.trim();
    const trimmedModel = model && typeof model === 'string' && model.trim() ? model.trim() : null;
    const trimmedCategory = category && typeof category === 'string' && category.trim() ? category.trim() : null;

    const key = getFolderKey(trimmedBrand, trimmedModel, trimmedCategory);
    const entry: CustomFolderEntry = {
      brand: trimmedBrand,
      model: trimmedModel,
      category: trimmedCategory,
    };

    customFoldersRegistry.set(key, entry);

    // Persist folder in database so it survives server restarts
    try {
      let checkQuery = supabaseAdmin
        .from('InventoryItem')
        .select('id')
        .eq('brand', trimmedBrand);
      if (trimmedModel) {
        checkQuery = checkQuery.eq('model', trimmedModel);
      }
      if (trimmedCategory) {
        checkQuery = checkQuery.eq('category', trimmedCategory);
      }
      const { data: existing } = await checkQuery.limit(1);

      if (!existing || existing.length === 0) {
        await supabaseAdmin.from('InventoryItem').insert([
          {
            id: uuidv4(),
            name: '.folder_metadata',
            brand: trimmedBrand,
            model: trimmedModel,
            category: trimmedCategory,
            status: 'FOLDER_METADATA',
            currentStock: 0,
            minStockLevel: 0,
            unit: 'Piece',
            createdById: req.user!.id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ]);
      }
    } catch (dbErr) {
      console.warn('[INVENTORY DB FOLDER PERSIST WARN]', dbErr);
    }

    await logAudit({
      userId: req.user!.id,
      action: 'INVENTORY_FOLDER_CREATED',
      resource: 'InventoryFolder',
      details: { brand: trimmedBrand, model: trimmedModel, category: trimmedCategory },
    });

    await broadcastServerChange('InventoryFolder', 'CREATE', `${trimmedBrand}-${trimmedModel || ''}-${trimmedCategory || ''}`, entry);

    return res.status(201).json({
      success: true,
      folder: entry,
      brand: trimmedBrand,
      model: trimmedModel,
      category: trimmedCategory,
    });
  } catch (err: any) {
    console.error('[INVENTORY POST FOLDERS ERROR]', err);
    return res.status(500).json({ error: 'Failed to create folder branch.' });
  }
});

// POST /api/inventory/rename-folder - Rename brand, model, or category folder
router.post('/rename-folder', authenticate, authorize(INVENTORY_MANAGERS), async (req: AuthRequest, res: Response) => {
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
      return res.status(500).json({ error: 'Failed to rename folder in database.' });
    }

    // Update in-memory registry
    const registryEntries = Array.from(customFoldersRegistry.entries());
    registryEntries.forEach(([k, entry]) => {
      let matched = false;
      const updatedEntry = { ...entry };
      if (level === 'brand' && entry.brand.toLowerCase() === oldName.toLowerCase()) {
        updatedEntry.brand = trimmedNew;
        matched = true;
      } else if (level === 'model' && entry.model && entry.model.toLowerCase() === oldName.toLowerCase()) {
        if (!parentBrand || entry.brand.toLowerCase() === parentBrand.toLowerCase()) {
          updatedEntry.model = trimmedNew;
          matched = true;
        }
      } else if (level === 'category' && entry.category && entry.category.toLowerCase() === oldName.toLowerCase()) {
        if ((!parentBrand || entry.brand.toLowerCase() === parentBrand.toLowerCase()) &&
            (!parentModel || (entry.model && entry.model.toLowerCase() === parentModel.toLowerCase()))) {
          updatedEntry.category = trimmedNew;
          matched = true;
        }
      }

      if (matched) {
        customFoldersRegistry.delete(k);
        const newKey = getFolderKey(updatedEntry.brand, updatedEntry.model, updatedEntry.category);
        customFoldersRegistry.set(newKey, updatedEntry);
      }
    });

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
    console.error('[INVENTORY RENAME EXCEPTION]', err);
    return res.status(500).json({ error: 'Failed to rename folder.' });
  }
});

// POST /api/inventory/move - Move items to new target folder/branch
router.post('/move', authenticate, authorize(INVENTORY_MANAGERS), async (req: AuthRequest, res: Response) => {
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
      updatePayload.model = targetModel && typeof targetModel === 'string' ? targetModel.trim() : null;
    }
    if (targetCategory !== undefined) {
      updatePayload.category = targetCategory && typeof targetCategory === 'string' ? targetCategory.trim() : 'Spare Parts';
    }

    const { data: updated, error } = await supabaseAdmin
      .from('InventoryItem')
      .update(updatePayload)
      .in('id', itemIds)
      .select('*');

    if (error) {
      console.error('[INVENTORY MOVE ERROR]', error);
      return res.status(500).json({ error: 'Failed to move items.' });
    }

    // Ensure target folder exists in registry
    const targetKey = getFolderKey(updatePayload.brand, updatePayload.model, updatePayload.category);
    if (!customFoldersRegistry.has(targetKey)) {
      customFoldersRegistry.set(targetKey, {
        brand: updatePayload.brand,
        model: updatePayload.model || null,
        category: updatePayload.category || null,
      });
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
    console.error('[INVENTORY MOVE EXCEPTION]', err);
    return res.status(500).json({ error: 'Failed to move inventory items.' });
  }
});

// POST /api/inventory/delete-folder - Delete or archive all items in a folder (cascading through all nested descendants)
router.post('/delete-folder', authenticate, authorize(INVENTORY_MANAGERS), async (req: AuthRequest, res: Response) => {
  try {
    const { brand, model, category, permanent = false } = req.body;
    if (!brand || !brand.trim()) {
      return res.status(400).json({ error: 'Brand is required to delete/archive a folder.' });
    }

    const trimmedBrand = brand.trim();
    const trimmedModel = model && typeof model === 'string' && model.trim() ? model.trim() : undefined;
    const trimmedCategory = category && typeof category === 'string' && category.trim() ? category.trim() : undefined;

    // Build case-insensitive query to cascade through ALL descendants
    let findQuery = supabaseAdmin
      .from('InventoryItem')
      .select('id, name, brand, model, category, status')
      .ilike('brand', trimmedBrand);

    if (trimmedModel) {
      findQuery = findQuery.ilike('model', trimmedModel);
    }
    if (trimmedCategory) {
      findQuery = findQuery.ilike('category', trimmedCategory);
    }

    const { data: itemsToDelete, error: findError } = await findQuery;
    if (findError) {
      console.error('[INVENTORY DELETE-FOLDER FIND ERROR]', findError);
      return res.status(500).json({ error: 'Failed to find items in folder.' });
    }

    const itemIds = (itemsToDelete || []).map((i: any) => i.id);

    if (itemIds.length > 0) {
      if (permanent) {
        await supabaseAdmin.from('InventoryTransaction').delete().in('itemId', itemIds);
        await supabaseAdmin.from('InventoryItem').delete().in('id', itemIds);
        for (const id of itemIds) {
          await broadcastServerChange('InventoryItem', 'DELETE', id);
        }
      } else {
        // Cascade archive safely to protect stock and repair history
        await supabaseAdmin
          .from('InventoryItem')
          .update({ status: 'ARCHIVED', updatedAt: new Date().toISOString() })
          .in('id', itemIds);
        for (const id of itemIds) {
          await broadcastServerChange('InventoryItem', 'UPDATE', id, { id, status: 'ARCHIVED' });
        }
      }
    }

    // Update in-memory registry so archived folders disappear from active folder list
    const registryEntries = Array.from(customFoldersRegistry.entries());
    registryEntries.forEach(([k, entry]) => {
      let matches = false;
      if (trimmedCategory) {
        if (entry.brand.toLowerCase() === trimmedBrand.toLowerCase() &&
            (!trimmedModel || (entry.model && entry.model.toLowerCase() === trimmedModel.toLowerCase())) &&
            (entry.category && entry.category.toLowerCase() === trimmedCategory.toLowerCase())) {
          matches = true;
        }
      } else if (trimmedModel) {
        if (entry.brand.toLowerCase() === trimmedBrand.toLowerCase() &&
            entry.model && entry.model.toLowerCase() === trimmedModel.toLowerCase()) {
          matches = true;
        }
      } else {
        if (entry.brand.toLowerCase() === trimmedBrand.toLowerCase()) {
          matches = true;
        }
      }

      if (matches) {
        if (permanent) {
          customFoldersRegistry.delete(k);
        } else {
          customFoldersRegistry.set(k, { ...entry, status: 'ARCHIVED' });
        }
      }
    });

    await logAudit({
      userId: req.user!.id,
      action: permanent ? 'INVENTORY_FOLDER_DELETED' : 'INVENTORY_FOLDER_ARCHIVED',
      resource: 'InventoryFolder',
      details: { brand: trimmedBrand, model: trimmedModel, category: trimmedCategory, permanent, affectedCount: itemIds.length },
    });

    await broadcastServerChange('InventoryFolder', permanent ? 'DELETE' : 'UPDATE', `${trimmedBrand}-${trimmedModel || ''}-${trimmedCategory || ''}`, {
      brand: trimmedBrand,
      model: trimmedModel,
      category: trimmedCategory,
      status: permanent ? 'DELETED' : 'ARCHIVED',
    });

    return res.json({ success: true, affectedCount: itemIds.length, brand: trimmedBrand, model: trimmedModel, category: trimmedCategory });
  } catch (err: any) {
    console.error('[INVENTORY DELETE FOLDER ERROR]', err);
    return res.status(500).json({ error: 'Failed to delete or archive folder.' });
  }
});

// POST /api/inventory/restore-folder - Restore an archived folder branch and all its contained items
router.post('/restore-folder', authenticate, authorize(INVENTORY_MANAGERS), async (req: AuthRequest, res: Response) => {
  try {
    const { brand, model, category } = req.body;
    if (!brand || !brand.trim()) {
      return res.status(400).json({ error: 'Brand is required to restore a folder.' });
    }

    const trimmedBrand = brand.trim();
    const trimmedModel = model && typeof model === 'string' && model.trim() ? model.trim() : undefined;
    const trimmedCategory = category && typeof category === 'string' && category.trim() ? category.trim() : undefined;

    let findQuery = supabaseAdmin
      .from('InventoryItem')
      .select('id, name, brand, model, category, status')
      .ilike('brand', trimmedBrand)
      .eq('status', 'ARCHIVED');

    if (trimmedModel) {
      findQuery = findQuery.ilike('model', trimmedModel);
    }
    if (trimmedCategory) {
      findQuery = findQuery.ilike('category', trimmedCategory);
    }

    const { data: itemsToRestore, error: findError } = await findQuery;
    if (findError) {
      console.error('[INVENTORY RESTORE-FOLDER FIND ERROR]', findError);
      return res.status(500).json({ error: 'Failed to find archived items in folder.' });
    }

    const itemIds = (itemsToRestore || []).map((i: any) => i.id);

    if (itemIds.length > 0) {
      const { error: restoreErr } = await supabaseAdmin
        .from('InventoryItem')
        .update({ status: 'ACTIVE', updatedAt: new Date().toISOString() })
        .in('id', itemIds);

      if (restoreErr) {
        console.error('[INVENTORY RESTORE ITEMS ERROR]', restoreErr);
        return res.status(500).json({ error: 'Failed to restore archived items.' });
      }

      for (const id of itemIds) {
        await broadcastServerChange('InventoryItem', 'UPDATE', id, { id, status: 'ACTIVE' });
      }
    }

    // Re-activate in registry
    const registryEntries = Array.from(customFoldersRegistry.entries());
    registryEntries.forEach(([k, entry]) => {
      let matches = false;
      if (trimmedCategory) {
        if (entry.brand.toLowerCase() === trimmedBrand.toLowerCase() &&
            (!trimmedModel || (entry.model && entry.model.toLowerCase() === trimmedModel.toLowerCase())) &&
            (entry.category && entry.category.toLowerCase() === trimmedCategory.toLowerCase())) {
          matches = true;
        }
      } else if (trimmedModel) {
        if (entry.brand.toLowerCase() === trimmedBrand.toLowerCase() &&
            entry.model && entry.model.toLowerCase() === trimmedModel.toLowerCase()) {
          matches = true;
        }
      } else {
        if (entry.brand.toLowerCase() === trimmedBrand.toLowerCase()) {
          matches = true;
        }
      }

      if (matches) {
        customFoldersRegistry.set(k, { ...entry, status: 'ACTIVE' });
      }
    });

    // Ensure folder itself is registered
    const fKey = getFolderKey(trimmedBrand, trimmedModel || null, trimmedCategory || null);
    if (!customFoldersRegistry.has(fKey)) {
      customFoldersRegistry.set(fKey, {
        brand: trimmedBrand,
        model: trimmedModel || null,
        category: trimmedCategory || null,
        status: 'ACTIVE',
      });
    }

    await logAudit({
      userId: req.user!.id,
      action: 'INVENTORY_FOLDER_RESTORED',
      resource: 'InventoryFolder',
      details: { brand: trimmedBrand, model: trimmedModel, category: trimmedCategory, restoredCount: itemIds.length },
    });

    await broadcastServerChange('InventoryFolder', 'UPDATE', `${trimmedBrand}-${trimmedModel || ''}-${trimmedCategory || ''}`, {
      brand: trimmedBrand,
      model: trimmedModel,
      category: trimmedCategory,
      status: 'ACTIVE',
    });

    return res.json({
      success: true,
      restoredCount: itemIds.length,
      brand: trimmedBrand,
      model: trimmedModel,
      category: trimmedCategory,
    });
  } catch (err: any) {
    console.error('[INVENTORY RESTORE FOLDER ERROR]', err);
    return res.status(500).json({ error: 'Failed to restore folder.' });
  }
});

// POST /api/inventory/bulk-restore - Bulk restore archived items to ACTIVE
router.post('/bulk-restore', authenticate, authorize(INVENTORY_MANAGERS), async (req: AuthRequest, res: Response) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No item IDs provided.' });
    }

    const { error } = await supabaseAdmin
      .from('InventoryItem')
      .update({ status: 'ACTIVE', updatedAt: new Date().toISOString() })
      .in('id', ids);

    if (error) return res.status(500).json({ error: 'Failed to restore items.' });

    for (const id of ids) {
      await broadcastServerChange('InventoryItem', 'UPDATE', id, { id, status: 'ACTIVE' });
    }

    await logAudit({
      userId: req.user!.id,
      action: 'INVENTORY_BULK_RESTORE',
      resource: 'InventoryItem',
      details: { count: ids.length, ids },
    });

    return res.json({ success: true, count: ids.length });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to process bulk restore.' });
  }
});

// POST /api/inventory/bulk-archive
router.post('/bulk-archive', authenticate, authorize(INVENTORY_MANAGERS), async (req: AuthRequest, res: Response) => {
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
router.post('/bulk-status', authenticate, authorize(INVENTORY_MANAGERS), async (req: AuthRequest, res: Response) => {
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
router.get('/suppliers', authenticate, async (req: AuthRequest, res: Response) => {
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
router.get('/locations', authenticate, async (req: AuthRequest, res: Response) => {
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
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { category, brand, status = 'ACTIVE', search, deviceType, limit = '1000' } = req.query;
    let query = supabaseAdmin
      .from('InventoryItem')
      .select('*')
      .neq('status', 'FOLDER_METADATA')
      .neq('status', 'INVENTORY_FILE');

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
      .limit(parseInt(limit as string, 10) || 1000);

    if (error) {
      console.error('[INVENTORY GET ERROR]', error);
      return res.status(500).json({ error: 'Failed to fetch inventory items.' });
    }

    let filteredItems = items || [];

    // Filter by Device Type if specified
    if (deviceType && deviceType !== 'ALL') {
      filteredItems = filteredItems.filter((item: any) => getDeviceType(item) === String(deviceType));
    }

    return res.json(filteredItems);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve inventory.' });
  }
});

// GET /api/inventory/stats - Real Inventory Valuation & Dynamic Metrics
router.get('/stats', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    // 1. Fetch active inventory parts (excluding metadata/file records)
    const { data: activeItems, error: activeErr } = await supabaseAdmin
      .from('InventoryItem')
      .select('id, name, brand, model, category, subcategory, compatibility, currentStock, minStockLevel, purchasePrice, sellingPrice, status')
      .eq('status', 'ACTIVE');

    if (activeErr) {
      console.error('[INVENTORY ACTIVE STATS DB ERROR]', activeErr);
    }

    // 2. Fetch archived inventory items separately to keep active valuation clean
    const { data: archivedItems, error: archErr } = await supabaseAdmin
      .from('InventoryItem')
      .select('id, currentStock, minStockLevel, purchasePrice, sellingPrice, status')
      .eq('status', 'ARCHIVED');

    if (archErr) {
      console.error('[INVENTORY ARCHIVED STATS DB ERROR]', archErr);
    }

    const safeActive = activeItems || [];
    const totalActiveProducts = safeActive.length;
    let totalStockUnits = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let totalPurchaseValuation = 0; // Purchase Cost = Σ(currentStock * unitCost)
    let totalSellingValuation = 0;  // Retail Value = Σ(currentStock * sellingPrice)
    let potentialProfit = 0;

    const deviceCounts: Record<string, number> = {
      Smartphone: 0,
      Tablet: 0,
      iPad: 0,
      Laptop: 0,
      TV: 0,
      Other: 0,
    };

    safeActive.forEach((item: any) => {
      const stock = typeof item.currentStock === 'number' ? item.currentStock : (parseInt(item.currentStock, 10) || 0);
      const minStock = typeof item.minStockLevel === 'number' ? item.minStockLevel : (parseInt(item.minStockLevel, 10) || 5);
      const pCost = typeof item.purchasePrice === 'number' ? item.purchasePrice : (parseFloat(item.purchasePrice) || 0);
      const sPrice = typeof item.sellingPrice === 'number' ? item.sellingPrice : (parseFloat(item.sellingPrice) || 0);

      totalStockUnits += stock;

      // Real Inventory Valuation = Σ(Current Stock Quantity × Unit Cost)
      if (stock > 0 && pCost > 0) {
        totalPurchaseValuation += stock * pCost;
      }
      if (stock > 0 && sPrice > 0) {
        totalSellingValuation += stock * sPrice;
      }
      if (stock > 0 && sPrice > 0 && pCost > 0) {
        potentialProfit += stock * (sPrice - pCost);
      }

      if (stock <= 0) {
        outOfStockCount++;
      } else if (stock <= minStock) {
        lowStockCount++;
      }

      const devType = getDeviceType(item);
      deviceCounts[devType] = (deviceCounts[devType] || 0) + 1;
    });

    const profitMargin = totalPurchaseValuation > 0
      ? ((totalSellingValuation - totalPurchaseValuation) / totalPurchaseValuation) * 100
      : 0;

    // Calculate isolated metrics for archived inventory
    const safeArchived = archivedItems || [];
    const archivedProductsCount = safeArchived.length;
    let archivedStockUnits = 0;
    let archivedValuation = 0;
    safeArchived.forEach((item: any) => {
      const stock = typeof item.currentStock === 'number' ? item.currentStock : (parseInt(item.currentStock, 10) || 0);
      const pCost = typeof item.purchasePrice === 'number' ? item.purchasePrice : (parseFloat(item.purchasePrice) || 0);
      archivedStockUnits += stock;
      if (stock > 0 && pCost > 0) {
        archivedValuation += stock * pCost;
      }
    });

    const { count: txCount } = await supabaseAdmin
      .from('InventoryTransaction')
      .select('*', { count: 'exact', head: true });

    return res.json({
      // Active stock metrics
      totalProducts: totalActiveProducts,
      totalItems: totalActiveProducts,
      totalStockUnits,
      totalStockQuantity: totalStockUnits,
      lowStockCount,
      outOfStockCount,
      totalValuation: Math.round(totalPurchaseValuation * 100) / 100, // strictly unit purchase cost
      totalStockValue: Math.round(totalPurchaseValuation * 100) / 100,
      totalSellingValuation: Math.round(totalSellingValuation * 100) / 100,
      potentialProfit: Math.round(potentialProfit * 100) / 100,
      profitMargin: Math.round(profitMargin * 10) / 10,
      deviceCounts,

      // Archived stock metrics (kept isolated)
      archivedProductsCount,
      archivedStockUnits,
      archivedValuation: Math.round(archivedValuation * 100) / 100,

      recentTxCount: txCount || 0,
    });
  } catch (err: any) {
    console.error('[INVENTORY STATS ERROR]', err);
    return res.status(500).json({ error: 'Failed to calculate inventory statistics.' });
  }
});

// GET /api/inventory/categories
router.get('/categories', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { data: categories } = await supabaseAdmin
      .from('InventoryCategory')
      .select('*');

    return res.json(categories || []);
  } catch (err: any) {
    return res.json([]);
  }
});

// POST /api/inventory/categories
router.post('/categories', authenticate, authorize(INVENTORY_MANAGERS), async (req: AuthRequest, res: Response) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Category name is required.' });

    const newCat = {
      id: uuidv4(),
      name: name.trim(),
      description: description || null,
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
router.get('/transactions/history', authenticate, async (req: AuthRequest, res: Response) => {
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
router.post('/bulk-delete', authenticate, authorize(INVENTORY_MANAGERS), async (req: AuthRequest, res: Response) => {
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
// 2.5 INVENTORY FILES & SPEC SHEETS API
// ==========================================

// GET /api/inventory/files - Get files for folder or item
router.get('/files', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { brand, model, category, itemId } = req.query;
    let query = supabaseAdmin
      .from('InventoryItem')
      .select('*')
      .eq('status', 'INVENTORY_FILE');

    if (itemId) {
      query = query.eq('compatibility', String(itemId));
    } else {
      if (brand) query = query.eq('brand', String(brand));
      if (model) query = query.eq('model', String(model));
      if (category) query = query.eq('category', String(category));
    }

    const { data: files, error } = await query.order('createdAt', { ascending: false });
    if (error) {
      console.error('[INVENTORY GET FILES ERROR]', error);
      return res.status(500).json({ error: 'Failed to retrieve inventory files.' });
    }

    const parsedFiles = (files || []).map((f: any) => {
      let meta: any = {};
      try {
        if (f.notes) meta = JSON.parse(f.notes);
      } catch (_) { }
      return {
        id: f.id,
        name: f.name,
        brand: f.brand,
        model: f.model,
        category: f.category,
        itemId: f.compatibility || null,
        url: f.imageUrl,
        description: f.description || '',
        fileType: meta.fileType || (f.imageUrl?.endsWith('.pdf') ? 'pdf' : 'image'),
        fileSize: meta.fileSize || 0,
        uploadedBy: meta.uploadedByName || 'Staff',
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
      };
    });

    return res.json(parsedFiles);
  } catch (err: any) {
    console.error('[INVENTORY GET FILES EXCEPTION]', err);
    return res.status(500).json({ error: 'Failed to retrieve files.' });
  }
});

// POST /api/inventory/files - Add inventory file / spec sheet
router.post('/files', authenticate, authorize(INVENTORY_MANAGERS), async (req: AuthRequest, res: Response) => {
  try {
    const { name, url, fileType, fileSize, brand, model, category, itemId, description } = req.body;
    if (!name || !url) {
      return res.status(400).json({ error: 'File name and file URL are required.' });
    }

    const fileId = uuidv4();
    const meta = {
      fileType: fileType || (url.endsWith('.pdf') ? 'pdf' : 'image'),
      fileSize: fileSize || 0,
      uploadedById: req.user!.id,
      uploadedByName: req.user!.name,
    };

    const newFileRecord = {
      id: fileId,
      name: name.trim(),
      brand: brand ? String(brand).trim() : null,
      model: model ? String(model).trim() : null,
      category: category ? String(category).trim() : 'Technical Documentation',
      sku: `FILE-${Date.now().toString().slice(-6)}`,
      compatibility: itemId ? String(itemId) : null,
      imageUrl: url.trim(),
      description: description ? String(description).trim() : null,
      notes: JSON.stringify(meta),
      status: 'INVENTORY_FILE',
      currentStock: 0,
      minStockLevel: 0,
      unit: 'Piece',
      createdById: req.user!.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { data: created, error } = await supabaseAdmin
      .from('InventoryItem')
      .insert([newFileRecord])
      .select('*')
      .single();

    if (error) {
      console.error('[INVENTORY CREATE FILE ERROR]', error);
      return res.status(500).json({ error: 'Failed to record inventory file.' });
    }

    await logAudit({
      userId: req.user!.id,
      action: 'INVENTORY_FILE_UPLOADED',
      resource: 'InventoryFile',
      resourceId: fileId,
      details: { name, brand, model, category, itemId, url },
    });

    await broadcastServerChange('InventoryFile', 'CREATE', fileId, newFileRecord);

    return res.status(201).json({
      success: true,
      file: {
        id: created.id,
        name: created.name,
        brand: created.brand,
        model: created.model,
        category: created.category,
        itemId: created.compatibility || null,
        url: created.imageUrl,
        description: created.description,
        fileType: meta.fileType,
        fileSize: meta.fileSize,
        uploadedBy: meta.uploadedByName,
        createdAt: created.createdAt,
      },
    });
  } catch (err: any) {
    console.error('[INVENTORY POST FILE EXCEPTION]', err);
    return res.status(500).json({ error: 'Failed to upload inventory file.' });
  }
});

// PATCH /api/inventory/files/:id - Edit file details
router.patch('/files/:id', authenticate, authorize(INVENTORY_MANAGERS), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const updates: any = { updatedAt: new Date().toISOString() };
    if (name) updates.name = String(name).trim();
    if (description !== undefined) updates.description = description ? String(description).trim() : null;

    const { data: updated, error } = await supabaseAdmin
      .from('InventoryItem')
      .update(updates)
      .eq('id', id)
      .eq('status', 'INVENTORY_FILE')
      .select('*')
      .single();

    if (error || !updated) {
      return res.status(404).json({ error: 'File not found or failed to update.' });
    }

    await logAudit({
      userId: req.user!.id,
      action: 'INVENTORY_FILE_UPDATED',
      resource: 'InventoryFile',
      resourceId: id,
      details: { name: updated.name, description: updated.description },
    });

    await broadcastServerChange('InventoryFile', 'UPDATE', id, updated);

    return res.json({ success: true, file: updated });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update file details.' });
  }
});

// DELETE /api/inventory/files/:id - Delete file
router.delete('/files/:id', authenticate, authorize(INVENTORY_MANAGERS), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin
      .from('InventoryItem')
      .delete()
      .eq('id', id)
      .eq('status', 'INVENTORY_FILE');

    if (error) {
      return res.status(500).json({ error: 'Failed to delete inventory file.' });
    }

    await logAudit({
      userId: req.user!.id,
      action: 'INVENTORY_FILE_DELETED',
      resource: 'InventoryFile',
      resourceId: id,
    });

    await broadcastServerChange('InventoryFile', 'DELETE', id);

    return res.json({ success: true, message: 'File successfully deleted.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete file.' });
  }
});

// POST /api/inventory/files/:id/move - Move file to another folder
router.post('/files/:id/move', authenticate, authorize(INVENTORY_MANAGERS), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { targetBrand, targetModel, targetCategory } = req.body;
    if (!targetBrand) {
      return res.status(400).json({ error: 'Target brand is required.' });
    }

    const { data: updated, error } = await supabaseAdmin
      .from('InventoryItem')
      .update({
        brand: String(targetBrand).trim(),
        model: targetModel ? String(targetModel).trim() : null,
        category: targetCategory ? String(targetCategory).trim() : 'Technical Documentation',
        updatedAt: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('status', 'INVENTORY_FILE')
      .select('*')
      .single();

    if (error || !updated) {
      return res.status(404).json({ error: 'File not found or failed to move.' });
    }

    await logAudit({
      userId: req.user!.id,
      action: 'INVENTORY_FILE_MOVED',
      resource: 'InventoryFile',
      resourceId: id,
      details: { targetBrand, targetModel, targetCategory },
    });

    await broadcastServerChange('InventoryFile', 'UPDATE', id, updated);

    return res.json({ success: true, file: updated });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to move file.' });
  }
});

// ==========================================
// 3. SINGLE ITEM CRUD & STOCK ADJUSTMENTS
// ==========================================

// GET /api/inventory/:id
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

// POST /api/inventory - Add item
router.post('/', authenticate, authorize(INVENTORY_MANAGERS), async (req: AuthRequest, res: Response) => {
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

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Item name is required.' });
    }

    const initialStock = parseInt(currentStock || '0', 10) || 0;
    const newItem = {
      id: uuidv4(),
      name: name.trim(),
      brand: brand ? brand.trim() : null,
      model: model ? model.trim() : null,
      sku: sku && sku.trim() ? sku.trim() : `SKU-${Date.now().toString().slice(-6)}`,
      category: (category || 'Spare Parts').trim(),
      subcategory: subcategory ? subcategory.trim() : null,
      compatibility: compatibility ? compatibility.trim() : null,
      unit: (unit || 'Piece').trim(),
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
      status: status || 'ACTIVE',
      createdById: req.user!.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { data: created, error } = await supabaseAdmin.from('InventoryItem').insert([newItem]).select('*').single();

    if (error) {
      console.error('[INVENTORY CREATE ERROR]', error);
      return res.status(500).json({ error: 'Failed to create inventory item.' });
    }

    // Register folder in registry if brand/model/category exist
    if (newItem.brand) {
      const fKey = getFolderKey(newItem.brand, newItem.model, newItem.category);
      customFoldersRegistry.set(fKey, {
        brand: newItem.brand,
        model: newItem.model,
        category: newItem.category,
      });
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
router.patch('/:id', authenticate, authorize(INVENTORY_MANAGERS), async (req: AuthRequest, res: Response) => {
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
      updateData.sellingPrice = parseFloat(updateData.sellingPrice);
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
router.post('/:id/restore', authenticate, authorize(INVENTORY_MANAGERS), async (req: AuthRequest, res: Response) => {
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

    if (updated.brand) {
      const fKey = getFolderKey(updated.brand, updated.model, updated.category);
      if (customFoldersRegistry.has(fKey)) {
        const existing = customFoldersRegistry.get(fKey)!;
        customFoldersRegistry.set(fKey, { ...existing, status: 'ACTIVE' });
      }
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
router.post('/:id/stock-in', authenticate, authorize(INVENTORY_MANAGERS), async (req: AuthRequest, res: Response) => {
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
router.post('/:id/stock-out', authenticate, authorize(INVENTORY_STOCK_OUT_ROLES), async (req: AuthRequest, res: Response) => {
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
    if (prevStock < qty) {
      return res.status(400).json({ error: `Insufficient stock. Current stock is only ${prevStock}.` });
    }

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
          reason,
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
router.post('/:id/adjust-stock', authenticate, authorize(INVENTORY_MANAGERS), async (req: AuthRequest, res: Response) => {
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

    try {
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
    } catch (txErr) {
      console.warn('[ADJUST TX WARN]', txErr);
    }

    await logAudit({
      userId: req.user!.id,
      action: 'INVENTORY_STOCK_ADJUSTMENT',
      resource: 'InventoryItem',
      resourceId: id,
      details: { previousStock: prevStock, newStock, diff, reason },
    });

    await broadcastServerChange('InventoryItem', 'UPDATE', id, updated);

    return res.json({ success: true, item: updated, newStock });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to adjust stock quantity.' });
  }
});

// DELETE /api/inventory/:id - Delete item (or archive)
router.delete('/:id', authenticate, authorize(INVENTORY_MANAGERS), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { permanent = false } = req.query;

    if (String(permanent) === 'true') {
      await supabaseAdmin.from('InventoryTransaction').delete().eq('itemId', id);
      const { error } = await supabaseAdmin.from('InventoryItem').delete().eq('id', id);

      if (error) return res.status(500).json({ error: 'Failed to delete inventory item.' });

      await logAudit({
        userId: req.user!.id,
        action: 'INVENTORY_ITEM_DELETED_PERMANENT',
        resource: 'InventoryItem',
        resourceId: id,
      });

      await broadcastServerChange('InventoryItem', 'DELETE', id);
      return res.json({ success: true, message: 'Item permanently deleted.' });
    } else {
      const { error } = await supabaseAdmin
        .from('InventoryItem')
        .update({ status: 'ARCHIVED', updatedAt: new Date().toISOString() })
        .eq('id', id);

      if (error) return res.status(500).json({ error: 'Failed to archive inventory item.' });

      await logAudit({
        userId: req.user!.id,
        action: 'INVENTORY_ITEM_ARCHIVED',
        resource: 'InventoryItem',
        resourceId: id,
      });

      await broadcastServerChange('InventoryItem', 'UPDATE', id, { id, status: 'ARCHIVED' });
      return res.json({ success: true, message: 'Item archived successfully.' });
    }
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete or archive item.' });
  }
});

export default router;
