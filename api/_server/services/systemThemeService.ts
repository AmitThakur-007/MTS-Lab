import fs from 'fs';
import path from 'path';
import { broadcastServerChange } from './realtimeSync';

export type FestivalType = 'holi' | 'dashain' | 'tihar';

export interface SystemThemeConfig {
  festivalModeEnabled: boolean;
  activeFestival: FestivalType;
  festivalGreeting: string;
  customMessage?: string;
  updatedAt: string;
  updatedBy?: string | null;
  updatedByName?: string | null;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const THEME_CONFIG_FILE = path.join(DATA_DIR, 'system_theme.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    console.warn('[THEME STORAGE DIR WARN]', e);
  }
}

const DEFAULT_CONFIG: SystemThemeConfig = {
  festivalModeEnabled: false,
  activeFestival: 'dashain',
  festivalGreeting: 'Celebrating the festive spirit across MTS Lab Kathmandu',
  customMessage: 'Happy Festive Season from Mobile Technology Station',
  updatedAt: new Date().toISOString(),
  updatedBy: null,
  updatedByName: null,
};

let cachedConfig: SystemThemeConfig | null = null;

export function getSystemThemeConfig(): SystemThemeConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    if (fs.existsSync(THEME_CONFIG_FILE)) {
      const raw = fs.readFileSync(THEME_CONFIG_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      cachedConfig = {
        festivalModeEnabled: Boolean(parsed.festivalModeEnabled),
        activeFestival: ['holi', 'dashain', 'tihar'].includes(parsed.activeFestival)
          ? parsed.activeFestival
          : 'dashain',
        festivalGreeting: parsed.festivalGreeting || DEFAULT_CONFIG.festivalGreeting,
        customMessage: parsed.customMessage || DEFAULT_CONFIG.customMessage,
        updatedAt: parsed.updatedAt || new Date().toISOString(),
        updatedBy: parsed.updatedBy || null,
        updatedByName: parsed.updatedByName || null,
      };
      return cachedConfig;
    }
  } catch (err) {
    console.warn('[THEME CONFIG READ ERROR]', err);
  }

  cachedConfig = { ...DEFAULT_CONFIG };
  try {
    fs.writeFileSync(THEME_CONFIG_FILE, JSON.stringify(cachedConfig, null, 2), 'utf-8');
  } catch (_) {}

  return cachedConfig;
}

export async function updateSystemThemeConfig(
  updates: Partial<SystemThemeConfig>,
  user?: { id?: string; name?: string; role?: string }
): Promise<SystemThemeConfig> {
  const current = getSystemThemeConfig();

  const activeFestival = updates.activeFestival && ['holi', 'dashain', 'tihar'].includes(updates.activeFestival)
    ? updates.activeFestival
    : current.activeFestival;

  const festivalModeEnabled = typeof updates.festivalModeEnabled === 'boolean'
    ? updates.festivalModeEnabled
    : current.festivalModeEnabled;

  const updated: SystemThemeConfig = {
    festivalModeEnabled,
    activeFestival,
    festivalGreeting: updates.festivalGreeting !== undefined ? String(updates.festivalGreeting) : current.festivalGreeting,
    customMessage: updates.customMessage !== undefined ? String(updates.customMessage) : current.customMessage,
    updatedAt: new Date().toISOString(),
    updatedBy: user?.id || null,
    updatedByName: user?.name || null,
  };

  try {
    fs.writeFileSync(THEME_CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf-8');
    cachedConfig = updated;
  } catch (err) {
    console.error('[THEME CONFIG WRITE ERROR]', err);
  }

  // Realtime broadcast to all clients via Supabase Realtime channel
  try {
    await broadcastServerChange('system_theme', 'UPDATE', 'global', updated);
  } catch (_) {}

  return updated;
}
