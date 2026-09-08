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
const inMemoryPricesOverlay = new Map<string, any>();
const deletedPriceIds = new Set<string>();

function getFolderKey(brand: string, model?: string | null, category?: string | null): string {
  return `${(brand || '').trim().toLowerCase()}|${(model || '').trim().toLowerCase()}|${(category || '').trim().toLowerCase()}`;
}

// ==========================================
// Metadata & Sanitization Helpers
// ==========================================
export function parseServiceItem(item: any, isPublic: boolean = false) {
  if (!item) return item;
  let originalPrice: number | null = null;
  let rating: number | null = null;
  let ratingCount: number | null = null;
  let deviceType: string | null = null;
  let customIcon: string | null = null;
  let cleanNotes = item.notes || '';

  if (item.notes && typeof item.notes === 'string' && item.notes.includes('<!--MTS_META:')) {
    try {
      const match = item.notes.match(/<!--MTS_META:([\s\S]*?)-->/);
      if (match && match[1]) {
        const meta = JSON.parse(match[1]);
        if (meta.originalPrice !== undefined && meta.originalPrice !== null && !isNaN(Number(meta.originalPrice))) {
          originalPrice = Number(meta.originalPrice);
        }
        if (meta.rating !== undefined && meta.rating !== null && !isNaN(Number(meta.rating))) {
          rating = Number(meta.rating);
        }
        if (meta.ratingCount !== undefined && meta.ratingCount !== null && !isNaN(Number(meta.ratingCount))) {
          ratingCount = Number(meta.ratingCount);
        }
        if (meta.deviceType) deviceType = String(meta.deviceType).trim();
        if (meta.icon) customIcon = String(meta.icon).trim();
        cleanNotes = item.notes.replace(/<!--MTS_META:[\s\S]*?-->/, '').trim();
      }
    } catch (e) {
      // ignore parse error
    }
  }

  // Automatic smart deviceType detection if not explicitly set
  if (!deviceType) {
    const text = `${item.brand || ''} ${item.model || ''} ${item.serviceName || ''} ${item.category || ''}`.toLowerCase();
    if (text.includes('ipad')) {
      deviceType = 'iPad';
    } else if (text.includes('tablet') || text.includes('tab ') || text.includes('tab-')) {
      deviceType = 'Tablet';
    } else {
      deviceType = 'Smartphone';
    }
  }

  const result: any = {
    ...item,
    notes: cleanNotes || null,
    originalPrice,
    rating,
    ratingCount,
    deviceType,
    icon: customIcon || null,
  };

  if (isPublic) {
    delete result.createdBy;
    delete result.updatedBy;
  }

  return result;
}

export function serializeServiceNotes(
  notes: string | null | undefined,
  meta: {
    originalPrice?: number | null;
    rating?: number | null;
    ratingCount?: number | null;
    deviceType?: string | null;
    icon?: string | null;
  }
): string | null {
  let baseNotes = notes ? notes.replace(/<!--MTS_META:[\s\S]*?-->/, '').trim() : '';
  const metaObj: any = {};
  if (meta.originalPrice !== undefined && meta.originalPrice !== null && !isNaN(Number(meta.originalPrice)) && Number(meta.originalPrice) > 0) {
    metaObj.originalPrice = Number(meta.originalPrice);
  }
  if (meta.rating !== undefined && meta.rating !== null && !isNaN(Number(meta.rating)) && Number(meta.rating) > 0) {
    metaObj.rating = Number(meta.rating);
  }
  if (meta.ratingCount !== undefined && meta.ratingCount !== null && !isNaN(Number(meta.ratingCount)) && Number(meta.ratingCount) > 0) {
    metaObj.ratingCount = Number(meta.ratingCount);
  }
  if (meta.deviceType && meta.deviceType.trim()) {
    metaObj.deviceType = meta.deviceType.trim();
  }
  if (meta.icon && meta.icon.trim()) {
    metaObj.icon = meta.icon.trim();
  }

  if (Object.keys(metaObj).length > 0) {
    const metaTag = `<!--MTS_META:${JSON.stringify(metaObj)}-->`;
    return baseNotes ? `${baseNotes}\n${metaTag}` : metaTag;
  }
  return baseNotes || null;
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
router.post('/folders', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST']), async (req: AuthRequest, res: Response) => {
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
router.post('/rename-folder', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST']), async (req: AuthRequest, res: Response) => {
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
router.post('/delete-folder', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST']), async (req: AuthRequest, res: Response) => {
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
router.post('/move', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST']), async (req: AuthRequest, res: Response) => {
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
    const { brand, model, category, search, status, deviceType } = req.query;
    const isPublic = req.path.includes('/public/') || req.baseUrl.includes('/public');
    let query = supabaseAdmin.from('RepairPrice').select('*');

    if (status && status !== 'ALL') {
      query = query.eq('status', String(status));
    } else if (isPublic) {
      query = query.eq('status', 'ACTIVE');
    }

    if (brand && brand !== 'ALL') query = query.eq('brand', String(brand));
    if (model && model !== 'ALL') query = query.eq('model', String(model));
    if (category && category !== 'ALL') query = query.eq('category', String(category));

    if (search) {
      const s = String(search).trim();
      query = query.or(`brand.ilike.%${s}%,model.ilike.%${s}%,serviceName.ilike.%${s}%,category.ilike.%${s}%,problem.ilike.%${s}%`);
    }

    const { data: rawPrices, error } = await query.order('brand', { ascending: true }).order('model', { ascending: true });

    if (error) {
      console.error('[REPAIR PRICES GET ERROR]', error);
      return res.status(500).json({ error: 'Failed to fetch repair prices.' });
    }

    // Merge in-memory overlay
    const existingMap = new Map<string, any>();
    (rawPrices || []).forEach((p: any) => {
      if (!deletedPriceIds.has(p.id)) {
        existingMap.set(p.id, p);
      }
    });

    inMemoryPricesOverlay.forEach((val, id) => {
      if (!deletedPriceIds.has(id)) {
        existingMap.set(id, { ...(existingMap.get(id) || {}), ...val });
      }
    });

    let allMerged = Array.from(existingMap.values());
    if (brand && brand !== 'ALL') allMerged = allMerged.filter((p) => (p.brand || '').toLowerCase() === String(brand).toLowerCase());
    if (model && model !== 'ALL') allMerged = allMerged.filter((p) => (p.model || '').toLowerCase() === String(model).toLowerCase());
    if (category && category !== 'ALL') allMerged = allMerged.filter((p) => (p.category || '').toLowerCase() === String(category).toLowerCase());
    if (status && status !== 'ALL') {
      allMerged = allMerged.filter((p) => p.status === String(status));
    } else if (isPublic) {
      allMerged = allMerged.filter((p) => p.status === 'ACTIVE');
    }
    if (search) {
      const s = String(search).toLowerCase().trim();
      allMerged = allMerged.filter((p) =>
        (p.brand || '').toLowerCase().includes(s) ||
        (p.model || '').toLowerCase().includes(s) ||
        (p.serviceName || '').toLowerCase().includes(s) ||
        (p.category || '').toLowerCase().includes(s) ||
        (p.problem || '').toLowerCase().includes(s)
      );
    }

    let parsedPrices = allMerged.map((item: any) => parseServiceItem(item, isPublic));

    // Optional deviceType filtering
    if (deviceType && deviceType !== 'ALL' && deviceType !== 'all') {
      const targetDevice = String(deviceType).toLowerCase().trim();
      parsedPrices = parsedPrices.filter((item: any) => (item.deviceType || '').toLowerCase() === targetDevice);
    }

    return res.json(parsedPrices);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve repair pricing directory.' });
  }
};

router.get('/', handleGetPrices);

// 2. POST /api/repair-prices
router.post('/', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST']), async (req: AuthRequest, res: Response) => {
  try {
    const {
      brand,
      model,
      variant = 'Standard',
      category,
      problem,
      serviceName,
      description,
      price,
      originalPrice,
      rating,
      ratingCount,
      deviceType,
      icon,
      priceType = 'FIXED',
      status = 'ACTIVE',
      notes,
      estimatedTime = '1-2 Hours',
    } = req.body;

    if (!brand || !model || !serviceName || price === undefined) {
      return res.status(400).json({ error: 'Brand, model, service name, and price are required.' });
    }

    const serializedNotes = serializeServiceNotes(notes, {
      originalPrice,
      rating,
      ratingCount,
      deviceType,
      icon,
    });

    const newPrice: any = {
      id: uuidv4(),
      brand: brand.trim(),
      model: model.trim(),
      variant: variant ? variant.trim() : 'Standard',
      category: category ? category.trim() : 'General',
      problem: problem ? problem.trim() : serviceName.trim(),
      serviceName: serviceName.trim(),
      description: description ? description.trim() : null,
      price: parseFloat(price) || 0,
      priceType,
      status,
      notes: serializedNotes,
      estimatedTime: estimatedTime || '1-2 Hours',
      createdBy: req.user?.id || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    let finalItem = newPrice;
    try {
      const { data: created, error } = await supabaseAdmin.from('RepairPrice').insert([newPrice]).select('*').single();
      if (!error && created) {
        finalItem = created;
      }
    } catch (_) {}

    inMemoryPricesOverlay.set(finalItem.id, finalItem);
    deletedPriceIds.delete(finalItem.id);

    const parsedCreated = parseServiceItem(finalItem, false);
    await broadcastServerChange('RepairPrice', 'CREATE', finalItem.id, parsedCreated);

    return res.status(201).json(parsedCreated);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to save repair price.' });
  }
});

// 3. PUT /api/repair-prices/:id & PATCH /api/repair-prices/:id
const handleUpdatePrice = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const body = { ...req.body };
    delete body.id;

    // Check if metadata fields are passed
    const hasMeta = (
      body.originalPrice !== undefined ||
      body.rating !== undefined ||
      body.ratingCount !== undefined ||
      body.deviceType !== undefined ||
      body.icon !== undefined
    );

    let notesToSave = body.notes;
    if (hasMeta) {
      // If notes wasn't sent, fetch current notes
      if (notesToSave === undefined) {
        const existingMem = inMemoryPricesOverlay.get(id);
        if (existingMem?.notes) {
          notesToSave = existingMem.notes;
        } else {
          try {
            const { data: current } = await supabaseAdmin.from('RepairPrice').select('notes').eq('id', id).single();
            notesToSave = current?.notes || '';
          } catch (_) {}
        }
      }
      notesToSave = serializeServiceNotes(notesToSave, {
        originalPrice: body.originalPrice,
        rating: body.rating,
        ratingCount: body.ratingCount,
        deviceType: body.deviceType,
        icon: body.icon,
      });
      body.notes = notesToSave;
    }

    // Strip unmapped fields before sending to Supabase
    delete body.originalPrice;
    delete body.rating;
    delete body.ratingCount;
    delete body.deviceType;
    delete body.icon;

    if (body.price !== undefined) {
      body.price = parseFloat(body.price) || 0;
    }

    body.updatedAt = new Date().toISOString();
    body.updatedBy = req.user?.id || null;

    let finalItem: any = null;
    try {
      const { data: updated, error } = await supabaseAdmin
        .from('RepairPrice')
        .update(body)
        .eq('id', id)
        .select('*')
        .single();
      if (!error && updated) {
        finalItem = updated;
      }
    } catch (_) {}

    if (!finalItem) {
      const existing = inMemoryPricesOverlay.get(id) || {};
      finalItem = { ...existing, ...body, id };
    }

    inMemoryPricesOverlay.set(id, finalItem);

    const parsedUpdated = parseServiceItem(finalItem, false);
    await broadcastServerChange('RepairPrice', 'UPDATE', id, parsedUpdated);

    return res.json(parsedUpdated);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update price item.' });
  }
};

router.put('/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST']), handleUpdatePrice);
router.patch('/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST']), handleUpdatePrice);

// 4. PATCH /api/repair-prices/:id/toggle-status
router.patch('/:id/toggle-status', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    let existingStatus = inMemoryPricesOverlay.get(id)?.status;
    if (!existingStatus) {
      const { data: existing } = await supabaseAdmin.from('RepairPrice').select('status').eq('id', id).single();
      existingStatus = existing?.status;
    }
    if (!existingStatus) return res.status(404).json({ error: 'Price item not found.' });

    const newStatus = existingStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    let finalItem: any = null;
    try {
      const { data: updated, error } = await supabaseAdmin
        .from('RepairPrice')
        .update({ status: newStatus, updatedAt: new Date().toISOString(), updatedBy: req.user?.id || null })
        .eq('id', id)
        .select('*')
        .single();
      if (!error && updated) finalItem = updated;
    } catch (_) {}

    if (!finalItem) {
      const mem = inMemoryPricesOverlay.get(id) || {};
      finalItem = { ...mem, status: newStatus, id };
    }

    inMemoryPricesOverlay.set(id, finalItem);

    const parsedUpdated = parseServiceItem(finalItem, false);
    await broadcastServerChange('RepairPrice', 'UPDATE', id, parsedUpdated);

    return res.json(parsedUpdated);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to toggle status.' });
  }
});

// 5. DELETE /api/repair-prices/:id
router.delete('/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    inMemoryPricesOverlay.delete(id);
    deletedPriceIds.add(id);

    try {
      await supabaseAdmin.from('RepairPrice').delete().eq('id', id);
    } catch (_) {}

    await broadcastServerChange('RepairPrice', 'DELETE', id);

    return res.json({ success: true, message: 'Repair price deleted.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete price record.' });
  }
});

// 6. POST /api/repair-prices/bulk-delete
router.post('/bulk-delete', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST']), async (req: AuthRequest, res: Response) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: 'No IDs specified.' });

    ids.forEach((id: string) => {
      inMemoryPricesOverlay.delete(id);
      deletedPriceIds.add(id);
    });

    try {
      await supabaseAdmin.from('RepairPrice').delete().in('id', ids);
    } catch (_) {}

    for (const id of ids) {
      await broadcastServerChange('RepairPrice', 'DELETE', id);
    }

    return res.json({ success: true, message: `Deleted ${ids.length} price items.` });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to process bulk delete.' });
  }
});

export default router;
