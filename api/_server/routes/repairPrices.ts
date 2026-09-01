import { Router, Request, Response } from 'express';
import { broadcastServerChange } from '../services/realtimeSync';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/rbac';

const router = Router();

// In-memory persistent registry for custom repair price folders
interface CustomRepairFolder {
  id?: string;
  name: string;
  level: 'brand' | 'model' | 'category';
  brand: string;
  model: string | null;
  category: string | null;
}

const customRepairFoldersRegistry = new Map<string, CustomRepairFolder>();

function getFolderKey(brand: string, model?: string | null, category?: string | null): string {
  return `${(brand || '').trim().toLowerCase()}|${(model || '').trim().toLowerCase()}|${(category || '').trim().toLowerCase()}`;
}

// ==========================================
// 1. FOLDERS CATALOG (Placed before /:id)
// ==========================================

// GET /api/repair-prices/folders
router.get('/folders', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { data: prices } = await supabaseAdmin
      .from('RepairPrice')
      .select('brand, model, category')
      .not('brand', 'is', null);

    const folderMap = new Map<string, CustomRepairFolder>();

    // 1. Add all custom registered folders first
    customRepairFoldersRegistry.forEach((folder, key) => {
      folderMap.set(key, folder);
    });

    // 2. Add all unique folder combinations from items in database
    (prices || []).forEach((item: any) => {
      const b = (item.brand || '').trim();
      const m = (item.model || '').trim();
      const c = (item.category || '').trim();
      if (b) {
        const key = getFolderKey(b, m, c);
        if (!folderMap.has(key)) {
          folderMap.set(key, {
            name: c || m || b,
            level: c ? 'category' : m ? 'model' : 'brand',
            brand: b,
            model: m || null,
            category: c || null,
          });
        }
      }
    });

    const foldersArray = Array.from(folderMap.values());
    return res.json(foldersArray);
  } catch (err: any) {
    console.error('[REPAIR PRICES GET FOLDERS ERROR]', err);
    return res.json(Array.from(customRepairFoldersRegistry.values()));
  }
});

// POST /api/repair-prices/folders - Create/register new brand, model or category folder
router.post('/folders', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER']), async (req: AuthRequest, res: Response) => {
  try {
    const { name, level = 'brand', brand, model, category } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Folder name is required.' });
    }

    const trimmedName = name.trim();
    const targetBrand = (level === 'brand' ? trimmedName : brand ? brand.trim() : trimmedName);
    const targetModel = (level === 'model' ? trimmedName : model && model.trim() ? model.trim() : null);
    const targetCategory = (level === 'category' ? trimmedName : category && category.trim() ? category.trim() : null);

    const key = getFolderKey(targetBrand, targetModel, targetCategory);
    const entry: CustomRepairFolder = {
      id: uuidv4(),
      name: trimmedName,
      level: level as any,
      brand: targetBrand,
      model: targetModel,
      category: targetCategory,
    };

    customRepairFoldersRegistry.set(key, entry);

    return res.status(201).json(entry);
  } catch (err: any) {
    console.error('[CREATE REPAIR FOLDER ERROR]', err);
    return res.status(500).json({ error: 'Failed to create folder.' });
  }
});

// POST /api/repair-prices/rename-folder - Rename folder and update child records
router.post('/rename-folder', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER']), async (req: AuthRequest, res: Response) => {
  try {
    const { level, oldValue, newValue, brand, model } = req.body;
    if (!oldValue || !newValue || !newValue.trim()) {
      return res.status(400).json({ error: 'Old value and new value are required.' });
    }

    const oldClean = oldValue.trim();
    const newClean = newValue.trim();

    // Update in database records
    if (level === 'brand') {
      await supabaseAdmin.from('RepairPrice').update({ brand: newClean, updatedAt: new Date().toISOString() }).eq('brand', oldClean);
    } else if (level === 'model') {
      let query = supabaseAdmin.from('RepairPrice').update({ model: newClean, updatedAt: new Date().toISOString() }).eq('model', oldClean);
      if (brand) query = query.eq('brand', brand.trim());
      await query;
    } else if (level === 'category') {
      let query = supabaseAdmin.from('RepairPrice').update({ category: newClean, updatedAt: new Date().toISOString() }).eq('category', oldClean);
      if (brand) query = query.eq('brand', brand.trim());
      if (model) query = query.eq('model', model.trim());
      await query;
    }

    // Update custom registry
    const toUpdate: { oldKey: string; entry: CustomRepairFolder }[] = [];
    customRepairFoldersRegistry.forEach((val, k) => {
      let matched = false;
      const updated = { ...val };
      if (level === 'brand' && val.brand.toLowerCase() === oldClean.toLowerCase()) {
        updated.brand = newClean;
        if (val.level === 'brand') updated.name = newClean;
        matched = true;
      } else if (level === 'model' && val.model && val.model.toLowerCase() === oldClean.toLowerCase()) {
        if (!brand || val.brand.toLowerCase() === brand.toLowerCase()) {
          updated.model = newClean;
          if (val.level === 'model') updated.name = newClean;
          matched = true;
        }
      } else if (level === 'category' && val.category && val.category.toLowerCase() === oldClean.toLowerCase()) {
        if (!brand || val.brand.toLowerCase() === brand.toLowerCase()) {
          if (!model || (val.model && val.model.toLowerCase() === model.toLowerCase())) {
            updated.category = newClean;
            if (val.level === 'category') updated.name = newClean;
            matched = true;
          }
        }
      }
      if (matched) {
        toUpdate.push({ oldKey: k, entry: updated });
      }
    });

    toUpdate.forEach(({ oldKey, entry }) => {
      customRepairFoldersRegistry.delete(oldKey);
      customRepairFoldersRegistry.set(getFolderKey(entry.brand, entry.model, entry.category), entry);
    });

    await broadcastServerChange('RepairPrice', 'UPDATE', 'folders');

    return res.json({ success: true, message: `Folder renamed to "${newClean}".` });
  } catch (err: any) {
    console.error('[RENAME REPAIR FOLDER ERROR]', err);
    return res.status(500).json({ error: 'Failed to rename folder.' });
  }
});

// POST /api/repair-prices/delete-folder - Delete folder and nested repair prices
router.post('/delete-folder', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { brand, model, category } = req.body;
    if (!brand) {
      return res.status(400).json({ error: 'Brand is required to identify folder.' });
    }

    let query = supabaseAdmin.from('RepairPrice').delete().eq('brand', brand.trim());
    if (model) query = query.eq('model', model.trim());
    if (category) query = query.eq('category', category.trim());

    const { data: deleted, error } = await query.select('id');
    const deletedCount = (deleted && deleted.length) || 0;

    // Clean up registry
    const toDelete: string[] = [];
    customRepairFoldersRegistry.forEach((val, k) => {
      if (val.brand.toLowerCase() === brand.toLowerCase().trim()) {
        if (!model || (val.model && val.model.toLowerCase() === model.toLowerCase().trim())) {
          if (!category || (val.category && val.category.toLowerCase() === category.toLowerCase().trim())) {
            toDelete.push(k);
          }
        }
      }
    });
    toDelete.forEach((k) => customRepairFoldersRegistry.delete(k));

    await broadcastServerChange('RepairPrice', 'DELETE', 'folder');

    return res.json({ success: true, message: 'Folder deleted.', deletedCount });
  } catch (err: any) {
    console.error('[DELETE REPAIR FOLDER ERROR]', err);
    return res.status(500).json({ error: 'Failed to delete folder.' });
  }
});

// POST /api/repair-prices/move - Relocate services or folder contents
router.post('/move', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER']), async (req: AuthRequest, res: Response) => {
  try {
    const { serviceIds, source, destination } = req.body;
    if (!destination || !destination.brand) {
      return res.status(400).json({ error: 'Destination brand is required.' });
    }

    const destBrand = destination.brand.trim();
    const destModel = destination.model ? destination.model.trim() : null;
    const destCategory = destination.category ? destination.category.trim() : null;

    const updatePayload: any = {
      brand: destBrand,
      updatedAt: new Date().toISOString(),
    };
    if (destModel !== undefined) updatePayload.model = destModel;
    if (destCategory !== undefined) updatePayload.category = destCategory;

    if (serviceIds && Array.isArray(serviceIds) && serviceIds.length > 0) {
      await supabaseAdmin.from('RepairPrice').update(updatePayload).in('id', serviceIds);
    } else if (source && source.brand) {
      let query = supabaseAdmin.from('RepairPrice').update(updatePayload).eq('brand', source.brand.trim());
      if (source.model) query = query.eq('model', source.model.trim());
      if (source.category) query = query.eq('category', source.category.trim());
      await query;
    }

    await broadcastServerChange('RepairPrice', 'UPDATE', 'relocate');

    return res.json({ success: true, message: 'Services relocated successfully.' });
  } catch (err: any) {
    console.error('[MOVE REPAIR SERVICES ERROR]', err);
    return res.status(500).json({ error: 'Failed to move services.' });
  }
});

// ==========================================
// 2. GET /api/public/repair-prices & GET /api/repair-prices
// ==========================================
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
