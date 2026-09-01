import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../config/supabase';
import { broadcastServerChange } from './realtimeSync';

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

// Initial Preset Slides
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
    updatedAt: new Date().toISOString()
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
    updatedAt: new Date().toISOString()
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
    updatedAt: new Date().toISOString()
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
    updatedAt: new Date().toISOString()
  }
];

let slidesCache: Map<string, HomeSlideRecord> = new Map();
let isInitialized = false;

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
 * Initialize slides storage
 */
export async function initializeSlidesStorage(): Promise<void> {
  if (isInitialized) return;

  const localSlides = loadLocalFile();
  localSlides.forEach(s => slidesCache.set(s.id, s));

  // Sync with Supabase
  try {
    const { data: supaSlides, error } = await supabaseAdmin
      .from('HomeSlide')
      .select('*')
      .order('displayOrder', { ascending: true });

    if (!error && supaSlides && supaSlides.length > 0) {
      supaSlides.forEach((s: any) => {
        // If local had more recent update, preserve, else update
        const existing = slidesCache.get(s.id);
        if (!existing || new Date(s.updatedAt || 0) >= new Date(existing.updatedAt || 0)) {
          slidesCache.set(s.id, {
            ...s,
            status: s.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
            displayOrder: Number(s.displayOrder) || 1,
          });
        }
      });
      saveLocalFile(Array.from(slidesCache.values()));
    } else if (slidesCache.size === 0) {
      INITIAL_PRESET_SLIDES.forEach(s => slidesCache.set(s.id, s));
      saveLocalFile(INITIAL_PRESET_SLIDES);
    }
  } catch (err) {
    console.warn('[SUPABASE SLIDES SYNC WARN - USING LOCAL CACHE]', err);
  }

  isInitialized = true;
}

/**
 * Get all slides or active slides
 */
export async function getSlides(onlyActive: boolean = false): Promise<HomeSlideRecord[]> {
  await initializeSlidesStorage();

  let list = Array.from(slidesCache.values());
  if (onlyActive) {
    list = list.filter(s => s.status === 'ACTIVE');
  }

  list.sort((a, b) => a.displayOrder - b.displayOrder);
  return list;
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
    status: slideData.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    createdBy: userId || null,
    updatedBy: userId || null,
    createdAt: now,
    updatedAt: now,
  };

  slidesCache.set(id, newSlide);
  saveLocalFile(Array.from(slidesCache.values()));

  try {
    await supabaseAdmin.from('HomeSlide').upsert([newSlide]);
  } catch (err) {
    console.warn('[SUPABASE SLIDE CREATE WARN]', err);
  }

  await broadcastServerChange('HomeSlide', 'CREATE', id, newSlide);
  return newSlide;
}

/**
 * Update slide
 */
export async function updateSlide(id: string, updates: Partial<HomeSlideRecord>, userId?: string): Promise<HomeSlideRecord> {
  await initializeSlidesStorage();

  const existing = slidesCache.get(id);
  if (!existing) {
    throw new Error('Slide not found');
  }

  const now = new Date().toISOString();
  const updated: HomeSlideRecord = {
    ...existing,
    ...updates,
    id,
    updatedAt: now,
    updatedBy: userId || existing.updatedBy || null,
  };

  slidesCache.set(id, updated);
  saveLocalFile(Array.from(slidesCache.values()));

  try {
    await supabaseAdmin.from('HomeSlide').update(updated).eq('id', id);
  } catch (err) {
    console.warn('[SUPABASE SLIDE UPDATE WARN]', err);
  }

  await broadcastServerChange('HomeSlide', 'UPDATE', id, updated);
  return updated;
}

/**
 * Toggle status
 */
export async function toggleSlideStatus(id: string, userId?: string): Promise<HomeSlideRecord> {
  await initializeSlidesStorage();

  const existing = slidesCache.get(id);
  if (!existing) {
    throw new Error('Slide not found');
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

      try {
        await supabaseAdmin
          .from('HomeSlide')
          .update({ displayOrder: item.displayOrder, updatedAt: now })
          .eq('id', item.id);
      } catch (err) {
        // Continue
      }
    }
  }

  saveLocalFile(Array.from(slidesCache.values()));
  await broadcastServerChange('HomeSlide', 'UPDATE', 'reorder');
}

/**
 * Delete slide
 */
export async function deleteSlide(id: string): Promise<void> {
  await initializeSlidesStorage();

  slidesCache.delete(id);
  saveLocalFile(Array.from(slidesCache.values()));

  try {
    await supabaseAdmin.from('HomeSlide').delete().eq('id', id);
  } catch (err) {
    console.warn('[SUPABASE SLIDE DELETE WARN]', err);
  }

  await broadcastServerChange('HomeSlide', 'DELETE', id);
}
