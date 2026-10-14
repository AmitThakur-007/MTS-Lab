import fs from 'fs';
import path from 'path';
import { broadcastServerChange } from './realtimeSync';

export type GlobalThemeId = 
  | 'light' 
  | 'dark' 
  | 'night' 
  | 'neutral-default' 
  | 'dashain' 
  | 'tihar' 
  | 'holi' 
  | 'nepali-new-year';

export const VALID_THEMES: readonly GlobalThemeId[] = [
  'light',
  'dark',
  'night',
  'neutral-default',
  'dashain',
  'tihar',
  'holi',
  'nepali-new-year',
] as const;

export const FESTIVAL_THEMES: readonly GlobalThemeId[] = [
  'dashain',
  'tihar',
  'holi',
  'nepali-new-year',
] as const;

export interface FestivalSchedule {
  enabled: boolean;
  themeId: GlobalThemeId;
  startDate: string; // ISO string (Asia/Kathmandu)
  endDate: string;   // ISO string (Asia/Kathmandu)
}

export interface SystemThemeConfig {
  activeTheme: GlobalThemeId;
  effectiveTheme: GlobalThemeId;
  festivalGreeting: string;
  customMessage?: string;
  schedule?: FestivalSchedule;
  isScheduledActive: boolean;
  // Backward compatibility fields:
  festivalModeEnabled: boolean;
  activeFestival: 'dashain' | 'tihar' | 'holi' | 'nepali-new-year';
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

export const DEFAULT_FESTIVAL_GREETINGS: Record<string, string> = {
  dashain: 'बडा दशैंको हार्दिक मंगलमय शुभकामना | Happy Dashain - Celebrating Prosperity & Renewal',
  tihar: 'शुभ दीपावली तथा तिहारको हार्दिक शुभकामना | Happy Tihar & Deepawali - Festival of Lights',
  holi: 'होली पर्वको हार्दिक शुभकामना | Happy Holi - Festival of Vibrant Colors & Joy',
  'nepali-new-year': 'नयाँ वर्षको हार्दिक मंगलमय शुभकामना | Happy Nepali New Year - Fresh Beginnings',
};

const DEFAULT_CONFIG: SystemThemeConfig = {
  activeTheme: 'neutral-default',
  effectiveTheme: 'neutral-default',
  festivalGreeting: 'Serving with Excellence & Precision at MTS Lab Kathmandu',
  customMessage: 'Mobile Technology Station — Chip-Level Smartphone Hardware Lab',
  schedule: {
    enabled: false,
    themeId: 'dashain',
    startDate: '',
    endDate: '',
  },
  isScheduledActive: false,
  festivalModeEnabled: false,
  activeFestival: 'dashain',
  updatedAt: new Date().toISOString(),
  updatedBy: null,
  updatedByName: null,
};

let cachedConfig: SystemThemeConfig | null = null;

/**
 * Checks if a schedule interval is currently active using Asia/Kathmandu authoritative time.
 * Interval rule: Start-inclusive [start, end) End-exclusive.
 */
export function isScheduleActiveNow(schedule?: FestivalSchedule): boolean {
  if (!schedule || !schedule.enabled || !schedule.startDate || !schedule.endDate) {
    return false;
  }

  try {
    const start = new Date(schedule.startDate).getTime();
    const end = new Date(schedule.endDate).getTime();
    if (isNaN(start) || isNaN(end) || start >= end) {
      return false;
    }

    const now = Date.now();
    return now >= start && now < end;
  } catch {
    return false;
  }
}

function resolveEffectiveTheme(
  baseTheme: GlobalThemeId,
  schedule?: FestivalSchedule
): { effectiveTheme: GlobalThemeId; isScheduledActive: boolean } {
  if (isScheduleActiveNow(schedule)) {
    return { effectiveTheme: schedule!.themeId, isScheduledActive: true };
  }
  return { effectiveTheme: baseTheme, isScheduledActive: false };
}

export function getSystemThemeConfig(): SystemThemeConfig {
  if (cachedConfig) {
    // Re-evaluate schedule dynamically in case time crossed start/end boundaries
    const { effectiveTheme, isScheduledActive } = resolveEffectiveTheme(
      cachedConfig.activeTheme,
      cachedConfig.schedule
    );
    cachedConfig.effectiveTheme = effectiveTheme;
    cachedConfig.isScheduledActive = isScheduledActive;
    cachedConfig.festivalModeEnabled = FESTIVAL_THEMES.includes(effectiveTheme);
    if (FESTIVAL_THEMES.includes(effectiveTheme)) {
      cachedConfig.activeFestival = effectiveTheme as any;
    }
    return cachedConfig;
  }

  try {
    if (fs.existsSync(THEME_CONFIG_FILE)) {
      const raw = fs.readFileSync(THEME_CONFIG_FILE, 'utf-8');
      const parsed = JSON.parse(raw);

      // Validate base theme
      let activeTheme: GlobalThemeId = 'neutral-default';
      if (parsed.activeTheme && VALID_THEMES.includes(parsed.activeTheme)) {
        activeTheme = parsed.activeTheme;
      } else if (parsed.festivalModeEnabled && parsed.activeFestival && VALID_THEMES.includes(parsed.activeFestival)) {
        activeTheme = parsed.activeFestival;
      }

      const schedule: FestivalSchedule = {
        enabled: Boolean(parsed.schedule?.enabled),
        themeId: parsed.schedule?.themeId && VALID_THEMES.includes(parsed.schedule.themeId)
          ? parsed.schedule.themeId
          : 'dashain',
        startDate: parsed.schedule?.startDate ? String(parsed.schedule.startDate) : '',
        endDate: parsed.schedule?.endDate ? String(parsed.schedule.endDate) : '',
      };

      const { effectiveTheme, isScheduledActive } = resolveEffectiveTheme(activeTheme, schedule);
      const isFestival = FESTIVAL_THEMES.includes(effectiveTheme);

      cachedConfig = {
        activeTheme,
        effectiveTheme,
        festivalGreeting: parsed.festivalGreeting || (isFestival ? DEFAULT_FESTIVAL_GREETINGS[effectiveTheme] : DEFAULT_CONFIG.festivalGreeting),
        customMessage: parsed.customMessage || DEFAULT_CONFIG.customMessage,
        schedule,
        isScheduledActive,
        festivalModeEnabled: isFestival,
        activeFestival: (isFestival ? effectiveTheme : 'dashain') as any,
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
  updates: {
    activeTheme?: GlobalThemeId;
    festivalGreeting?: string;
    customMessage?: string;
    schedule?: Partial<FestivalSchedule>;
    // Legacy support:
    festivalModeEnabled?: boolean;
    activeFestival?: GlobalThemeId;
  },
  user?: { id?: string; name?: string; role?: string }
): Promise<SystemThemeConfig> {
  const current = getSystemThemeConfig();

  // Determine updated base activeTheme
  let activeTheme: GlobalThemeId = current.activeTheme;
  if (updates.activeTheme && VALID_THEMES.includes(updates.activeTheme)) {
    activeTheme = updates.activeTheme;
  } else if (updates.festivalModeEnabled === false) {
    // If explicitly disabling festival mode via legacy toggle, revert to neutral-default or light
    activeTheme = 'neutral-default';
  } else if (updates.activeFestival && VALID_THEMES.includes(updates.activeFestival)) {
    activeTheme = updates.activeFestival;
  }

  // Determine schedule
  let schedule: FestivalSchedule = { ...current.schedule! };
  if (updates.schedule) {
    schedule = {
      enabled: updates.schedule.enabled !== undefined ? Boolean(updates.schedule.enabled) : schedule.enabled,
      themeId: updates.schedule.themeId && VALID_THEMES.includes(updates.schedule.themeId)
        ? updates.schedule.themeId
        : schedule.themeId,
      startDate: updates.schedule.startDate !== undefined ? String(updates.schedule.startDate).trim() : schedule.startDate,
      endDate: updates.schedule.endDate !== undefined ? String(updates.schedule.endDate).trim() : schedule.endDate,
    };
  }

  const { effectiveTheme, isScheduledActive } = resolveEffectiveTheme(activeTheme, schedule);
  const isFestival = FESTIVAL_THEMES.includes(effectiveTheme);

  const defaultGreeting = isFestival 
    ? (DEFAULT_FESTIVAL_GREETINGS[effectiveTheme] || DEFAULT_CONFIG.festivalGreeting)
    : DEFAULT_CONFIG.festivalGreeting;

  const updated: SystemThemeConfig = {
    activeTheme,
    effectiveTheme,
    festivalGreeting: updates.festivalGreeting !== undefined 
      ? String(updates.festivalGreeting).trim() 
      : (current.festivalGreeting || defaultGreeting),
    customMessage: updates.customMessage !== undefined 
      ? String(updates.customMessage).trim() 
      : current.customMessage,
    schedule,
    isScheduledActive,
    festivalModeEnabled: isFestival,
    activeFestival: (isFestival ? effectiveTheme : 'dashain') as any,
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

