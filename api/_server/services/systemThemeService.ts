import fs from 'fs';
import path from 'path';
import { broadcastServerChange } from './realtimeSync';
import { supabaseAdmin } from '../config/supabase';

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

function getConfigCandidatePaths(): string[] {
  const paths: string[] = [];
  try {
    paths.push(path.join(process.cwd(), 'data', 'system_theme.json'));
  } catch (_) {}
  try {
    const tmpDir = process.env.TEMP || process.env.TMPDIR || '/tmp';
    paths.push(path.join(tmpDir, 'system_theme.json'));
  } catch (_) {}
  return paths;
}

function persistToFile(config: SystemThemeConfig): void {
  const candidates = getConfigCandidatePaths();
  for (const filePath of candidates) {
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf-8');
    } catch (_) {
      // Continue to next candidate if directory is read-only (e.g., Vercel /var/task)
    }
  }
}

function readFromFile(): Partial<SystemThemeConfig> | null {
  const candidates = getConfigCandidatePaths();
  for (const filePath of candidates) {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      }
    } catch (_) {}
  }
  return null;
}

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

function normalizeThemeConfig(parsed: any): SystemThemeConfig {
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

  return {
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
}

async function fetchLatestThemeFromSupabase(): Promise<SystemThemeConfig | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('AuditLog')
      .select('details, createdAt, userName')
      .eq('resource', 'SystemTheme')
      .eq('action', 'SUPERADMIN_THEME_UPDATE')
      .order('createdAt', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data?.details) {
      const parsed = typeof data.details === 'string' ? JSON.parse(data.details) : data.details;
      if (parsed && (parsed.activeTheme || parsed.effectiveTheme)) {
        return normalizeThemeConfig({
          ...parsed,
          updatedAt: data.createdAt,
          updatedByName: data.userName || parsed.updatedByName,
        });
      }
    }
  } catch (err) {
    console.warn('[SUPABASE THEME HYDRATION WARN]', err);
  }
  return null;
}

export function getSystemThemeConfig(): SystemThemeConfig {
  if (cachedConfig) {
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

  const fileData = readFromFile();
  if (fileData) {
    cachedConfig = normalizeThemeConfig(fileData);
    return cachedConfig;
  }

  cachedConfig = { ...DEFAULT_CONFIG };
  persistToFile(cachedConfig);
  return cachedConfig;
}

export async function getSystemThemeConfigAsync(): Promise<SystemThemeConfig> {
  // If in-memory cache has non-default or active configuration, return it
  if (cachedConfig && cachedConfig.activeTheme !== 'neutral-default') {
    return getSystemThemeConfig();
  }

  // Check file candidates
  const fileData = readFromFile();
  if (fileData && fileData.activeTheme && fileData.activeTheme !== 'neutral-default') {
    cachedConfig = normalizeThemeConfig(fileData);
    return cachedConfig;
  }

  // Authoritatively hydrate from Supabase AuditLog store
  const supabaseTheme = await fetchLatestThemeFromSupabase();
  if (supabaseTheme) {
    cachedConfig = supabaseTheme;
    persistToFile(cachedConfig);
    return cachedConfig;
  }

  return getSystemThemeConfig();
}

export async function updateSystemThemeConfig(
  updates: {
    activeTheme?: GlobalThemeId;
    festivalGreeting?: string;
    customMessage?: string;
    schedule?: Partial<FestivalSchedule>;
    festivalModeEnabled?: boolean;
    activeFestival?: GlobalThemeId;
  },
  user?: { id?: string; name?: string; role?: string }
): Promise<SystemThemeConfig> {
  const current = getSystemThemeConfig();

  let activeTheme: GlobalThemeId = current.activeTheme;
  if (updates.activeTheme && VALID_THEMES.includes(updates.activeTheme)) {
    activeTheme = updates.activeTheme;
  } else if (updates.festivalModeEnabled === false) {
    activeTheme = 'neutral-default';
  } else if (updates.activeFestival && VALID_THEMES.includes(updates.activeFestival)) {
    activeTheme = updates.activeFestival;
  }

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

  persistToFile(updated);
  cachedConfig = updated;

  // Realtime broadcast to all clients via Supabase Realtime channel
  try {
    await broadcastServerChange('system_theme', 'UPDATE', 'global', updated);
  } catch (_) {}

  return updated;
}

