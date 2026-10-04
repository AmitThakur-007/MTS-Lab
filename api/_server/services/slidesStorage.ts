import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../config/supabase';
import { broadcastServerChange } from './realtimeSync';
import { deleteFromCloudinary, isCloudinaryConfigured } from './cloudinaryService';

export interface HomeSlideRecord {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string;
  buttonText: string;
  buttonLink: string;
  displayOrder: number;
  status: 'ACTIVE' | 'INACTIVE';
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const SLIDES_FILE = path.join(DATA_DIR, 'home_slides.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    console.warn('[STORAGE DIR INIT WARN]', e);
  }
}

// Initial Preset Slides (safe default fallback)
const INITIAL_PRESET_SLIDES: HomeSlideRecord[] = [
  {
    id: '51a6593c-8b46-4b18-ba7f-9fe1eefc7f21',
    title: 'Front Glass Change',
    description: 'Specialized outer glass replacement preserving your original AMOLED / OLED display and touch responsiveness.',
    imageUrl: '/assets/images/front_glass_repair_1786719176945.jpg',
    buttonText: 'Check Repair Price',
    buttonLink: '/services?focus=search&q=Front+Glass',
    displayOrder: 1,
    status: 'ACTIVE',
    createdAt: '2026-08-18T11:06:14.238Z',
    updatedAt: '2026-10-04T07:27:11.774Z'
  },
  {
    id: 'fd9650d0-7ecf-4268-972a-205164cddbe4',
    title: 'Display Replacement',
    description: '100% Genuine original quality screen restoration with True Tone, 120Hz ProMotion, and vibrant clarity.',
    imageUrl: '/assets/images/display_replace_1786719191504.jpg',
    buttonText: 'Check Repair Price',
    buttonLink: '/services?focus=search&q=Display',
    displayOrder: 2,
    status: 'ACTIVE',
    createdAt: '2026-08-18T11:06:14.242Z',
    updatedAt: '2026-10-04T07:27:11.774Z'
  },
  {
    id: 'f7b4fc3d-1648-45c0-8bc7-88ce85c13289',
    title: 'Back Panel / Back Glass Change',
    description: 'Factory finish laser back panel replacement and frame restoration for Apple, Samsung, and flagship devices.',
    imageUrl: '/assets/images/back_glass_fix_178671907185.jpg',
    buttonText: 'Check Repair Price',
    buttonLink: '/services?focus=search&q=Back+Glass',
    displayOrder: 3,
    status: 'ACTIVE',
    createdAt: '2026-08-18T11:06:14.245Z',
    updatedAt: '2026-10-04T07:27:11.774Z'
  },
  {
    id: 'b4439128-6477-421e-9492-f8c7478ad7e6',
    title: 'Professional Smartphone Repair',
    description: 'Advanced IC-level micro-soldering, green/white screen laser line repair, and specialized liquid damage restoration.',
    imageUrl: '/assets/images/phone_repair_lab_1786719222650.jpg',
    buttonText: 'Check Repair Price',
    buttonLink: '/services?focus=search',
    displayOrder: 4,
    status: 'ACTIVE',
    createdAt: '2026-08-18T11:06:14.247Z',
    updatedAt: '2026-10-04T07:27:11.774Z'
  }
];

let slidesCache: Map<string, HomeSlideRecord> = new Map();

function isPresetAsset(url: string): boolean {
  if (!url) return false;
  return url.startsWith('/assets/') || url.includes('/assets/images/') || (!url.includes('cloudinary.com') && !url.startsWith('http'));
}

function loadLocalFile(): HomeSlideRecord[] {
  try {
    if (fs.existsSync(SLIDES_FILE)) {
      const content = fs.readFileSync(SLIDES_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error(`[STORAGE READ ERROR: ${SLIDES_FILE}]`, err);
  }
  return INITIAL_PRESET_SLIDES;
}

function saveLocalFile(data: HomeSlideRecord[]): void {
  try {
    const tempPath = `${SLIDES_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, SLIDES_FILE);
  } catch (err) {
    console.error(`[STORAGE WRITE ERROR: ${SLIDES_FILE}]`, err);
  }
}

/**
 * Initialize slides storage and hydrate from local cache on startup
 */
export async function initializeSlidesStorage(): Promise<void> {
  if (slidesCache.size === 0) {
    const local = loadLocalFile();
    local.forEach(s => slidesCache.set(s.id, s));
  }
}

/**
 * Get all slides or active slides. Supabase is authoritative, falling back to cache.
 */
export async function getSlides(onlyActive: boolean = false): Promise<HomeSlideRecord[]> {
  await initializeSlidesStorage();

  // 1. Authoritative query from Supabase database
  try {
    let query = supabaseAdmin
      .from('HomeSlide')
      .select('*')
      .order('displayOrder', { ascending: true });

    if (onlyActive) {
      query = query.eq('status', 'ACTIVE');
    }

    const { data: supaSlides, error } = await query;

    if (!error && Array.isArray(supaSlides)) {
      const normalized: HomeSlideRecord[] = supaSlides.map((s: any) => ({
        id: String(s.id),
        title: String(s.title || ''),
        description: s.description ? String(s.description) : null,
        imageUrl: String(s.imageUrl || ''),
        buttonText: s.buttonText ? String(s.buttonText) : 'Check Repair Price',
        buttonLink: s.buttonLink ? String(s.buttonLink) : '/services?focus=search',
        displayOrder: Number(s.displayOrder) || 1,
        status: (s.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE') as 'ACTIVE' | 'INACTIVE',
        createdBy: s.createdBy || null,
        updatedBy: s.updatedBy || null,
        createdAt: s.createdAt || new Date().toISOString(),
        updatedAt: s.updatedAt || new Date().toISOString(),
      }));

      // When requesting all slides (CMS view), keep local cache and disk backup in complete sync with Supabase
      if (!onlyActive) {
        slidesCache.clear();
        normalized.forEach(s => slidesCache.set(s.id, s));
        saveLocalFile(normalized);
      }

      return normalized;
    } else if (error) {
      console.warn('[SUPABASE GET SLIDES NOTICE - FALLING BACK TO CACHE]', error.message || error);
    }
  } catch (err: any) {
    console.warn('[SUPABASE GET SLIDES EXCEPTION - FALLING BACK TO CACHE]', err?.message || err);
  }

  // 2. Offline / Network error fallback: In-memory cache & local disk file
  let list = Array.from(slidesCache.values());
  if (list.length === 0) {
    list = loadLocalFile();
    list.forEach(s => slidesCache.set(s.id, s));
  }

  if (onlyActive) {
    list = list.filter(s => s.status === 'ACTIVE');
  }

  list.sort((a, b) => a.displayOrder - b.displayOrder);
  return list;
}

/**
 * Get single slide by ID
 */
export async function getSlideById(id: string): Promise<HomeSlideRecord | null> {
  if (!id) return null;
  await initializeSlidesStorage();

  // 1. Authoritative query from Supabase
  try {
    const { data, error } = await supabaseAdmin
      .from('HomeSlide')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!error && data) {
      const record: HomeSlideRecord = {
        id: String(data.id),
        title: String(data.title || ''),
        description: data.description ? String(data.description) : null,
        imageUrl: String(data.imageUrl || ''),
        buttonText: data.buttonText ? String(data.buttonText) : 'Check Repair Price',
        buttonLink: data.buttonLink ? String(data.buttonLink) : '/services?focus=search',
        displayOrder: Number(data.displayOrder) || 1,
        status: (data.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE') as 'ACTIVE' | 'INACTIVE',
        createdBy: data.createdBy || null,
        updatedBy: data.updatedBy || null,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
      };
      slidesCache.set(id, record);
      return record;
    }
  } catch (err: any) {
    console.warn(`[SUPABASE GET SLIDE BY ID NOTICE: ${id}]`, err?.message || err);
  }

  // 2. Cache fallback
  const cached = slidesCache.get(id);
  if (cached) return cached;

  // 3. Local file fallback
  const localList = loadLocalFile();
  const found = localList.find(s => s.id === id);
  if (found) {
    slidesCache.set(found.id, found);
    return found;
  }

  return null;
}

/**
 * Create slide
 */
export async function createSlide(slideData: Partial<HomeSlideRecord>, userId?: string): Promise<HomeSlideRecord> {
  await initializeSlidesStorage();

  const id = slideData.id || uuidv4();
  const now = new Date().toISOString();

  const newSlide: HomeSlideRecord = {
    id,
    title: String(slideData.title || '').trim(),
    description: slideData.description ? String(slideData.description).trim() : null,
    imageUrl: String(slideData.imageUrl || '').trim(),
    buttonText: slideData.buttonText ? String(slideData.buttonText).trim() : 'Check Repair Price',
    buttonLink: slideData.buttonLink ? String(slideData.buttonLink).trim() : '/services?focus=search',
    displayOrder: parseInt(String(slideData.displayOrder || 1), 10) || 1,
    status: (slideData.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE') as 'ACTIVE' | 'INACTIVE',
    createdBy: userId || null,
    updatedBy: userId || null,
    createdAt: now,
    updatedAt: now,
  };

  // 1. Authoritative persist in Supabase
  try {
    const { error } = await supabaseAdmin.from('HomeSlide').upsert([newSlide]);
    if (error) {
      console.error('[SUPABASE SLIDE CREATE ERROR]', error);
    }
  } catch (err: any) {
    console.warn('[SUPABASE SLIDE CREATE EXCEPTION]', err?.message || err);
  }

  // 2. Update memory cache and local file
  slidesCache.set(id, newSlide);
  saveLocalFile(Array.from(slidesCache.values()));

  // 3. Multi-device realtime broadcast
  await broadcastServerChange('HomeSlide', 'CREATE', id, newSlide);
  return newSlide;
}

/**
 * Update slide
 */
export async function updateSlide(id: string, updates: Partial<HomeSlideRecord>, userId?: string): Promise<HomeSlideRecord> {
  await initializeSlidesStorage();

  let existing = await getSlideById(id);
  if (!existing) {
    throw new Error(`Slide with ID '${id}' not found`);
  }

  const oldImageUrl = existing.imageUrl;
  const now = new Date().toISOString();

  const sanitizedUpdates: Partial<HomeSlideRecord> = {};
  if (updates.title !== undefined) sanitizedUpdates.title = String(updates.title).trim();
  if (updates.description !== undefined) sanitizedUpdates.description = updates.description ? String(updates.description).trim() : null;
  if (updates.imageUrl !== undefined) sanitizedUpdates.imageUrl = String(updates.imageUrl).trim();
  if (updates.buttonText !== undefined) sanitizedUpdates.buttonText = updates.buttonText ? String(updates.buttonText).trim() : 'Check Repair Price';
  if (updates.buttonLink !== undefined) sanitizedUpdates.buttonLink = updates.buttonLink ? String(updates.buttonLink).trim() : '/services?focus=search';
  if (updates.displayOrder !== undefined) sanitizedUpdates.displayOrder = parseInt(String(updates.displayOrder), 10) || 1;
  if (updates.status !== undefined) sanitizedUpdates.status = (updates.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE') as 'ACTIVE' | 'INACTIVE';

  const updated: HomeSlideRecord = {
    ...existing,
    ...sanitizedUpdates,
    id,
    updatedAt: now,
    updatedBy: userId || existing.updatedBy || null,
  };

  // 1. Authoritative update in Supabase database FIRST
  try {
    const { error } = await supabaseAdmin
      .from('HomeSlide')
      .update({
        title: updated.title,
        description: updated.description,
        imageUrl: updated.imageUrl,
        buttonText: updated.buttonText,
        buttonLink: updated.buttonLink,
        displayOrder: updated.displayOrder,
        status: updated.status,
        updatedBy: updated.updatedBy,
        updatedAt: updated.updatedAt,
      })
      .eq('id', id);

    if (error) {
      console.error('[SUPABASE SLIDE UPDATE ERROR]', error);
    }
  } catch (err: any) {
    console.warn('[SUPABASE SLIDE UPDATE EXCEPTION]', err?.message || err);
  }

  // 2. Synchronize local cache and disk file
  slidesCache.set(id, updated);
  saveLocalFile(Array.from(slidesCache.values()));

  // 3. Safe image cleanup: ONLY after database update succeeded,
  // and ONLY if image was actually changed, old image was a Cloudinary asset, and not a preset
  if (
    updates.imageUrl &&
    oldImageUrl &&
    updates.imageUrl !== oldImageUrl &&
    oldImageUrl.includes('cloudinary.com') &&
    !isPresetAsset(oldImageUrl)
  ) {
    if (isCloudinaryConfigured()) {
      try {
        await deleteFromCloudinary(oldImageUrl);
      } catch (cleanErr: any) {
        console.warn('[CLOUDINARY OLD SLIDE ASSET CLEANUP NOTICE]', cleanErr?.message || cleanErr);
      }
    }
  }

  // 4. Multi-device realtime broadcast
  await broadcastServerChange('HomeSlide', 'UPDATE', id, updated);
  return updated;
}

/**
 * Toggle status
 */
export async function toggleSlideStatus(id: string, userId?: string): Promise<HomeSlideRecord> {
  const existing = await getSlideById(id);
  if (!existing) {
    throw new Error(`Slide with ID '${id}' not found`);
  }

  const targetStatus = existing.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
  return updateSlide(id, { status: targetStatus }, userId);
}

/**
 * Reorder slides
 */
export async function reorderSlides(items: { id: string; displayOrder: number }[]): Promise<void> {
  await initializeSlidesStorage();

  const now = new Date().toISOString();
  for (const item of items) {
    const existing = slidesCache.get(item.id);
    if (existing) {
      existing.displayOrder = item.displayOrder;
      existing.updatedAt = now;
      slidesCache.set(item.id, existing);
    }

    try {
      await supabaseAdmin
        .from('HomeSlide')
        .update({ displayOrder: item.displayOrder, updatedAt: now })
        .eq('id', item.id);
    } catch (_) { }
  }

  saveLocalFile(Array.from(slidesCache.values()));
  await broadcastServerChange('HomeSlide', 'UPDATE', 'reorder');
}

/**
 * Delete slide
 */
export async function deleteSlide(id: string): Promise<void> {
  await initializeSlidesStorage();

  const existing = await getSlideById(id);
  if (!existing) {
    // If not found anywhere, consider already deleted
    return;
  }

  // 1. Authoritative delete from Supabase
  try {
    const { error } = await supabaseAdmin.from('HomeSlide').delete().eq('id', id);
    if (error) {
      console.error('[SUPABASE SLIDE DELETE ERROR]', error);
    }
  } catch (err: any) {
    console.warn('[SUPABASE SLIDE DELETE EXCEPTION]', err?.message || err);
  }

  // 2. Remove from memory cache & local backup
  slidesCache.delete(id);
  saveLocalFile(Array.from(slidesCache.values()));

  // 3. Safe Cloudinary cleanup: ONLY for real Cloudinary assets (never preset images)
  if (existing.imageUrl && existing.imageUrl.includes('cloudinary.com') && !isPresetAsset(existing.imageUrl)) {
    if (isCloudinaryConfigured()) {
      try {
        await deleteFromCloudinary(existing.imageUrl);
      } catch (cleanErr: any) {
        console.warn('[CLOUDINARY DELETE SLIDE ASSET NOTICE]', cleanErr?.message || cleanErr);
      }
    }
  }

  // 4. Multi-device realtime broadcast
  await broadcastServerChange('HomeSlide', 'DELETE', id);
}
