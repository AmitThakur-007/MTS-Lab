import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '@/services/api';
import { useRealtimeSync } from '@/services/realtime';
import { toast } from 'sonner';

export type ThemeId = 
  | 'light' 
  | 'dark' 
  | 'night' 
  | 'neutral-default' 
  | 'dashain' 
  | 'tihar' 
  | 'holi' 
  | 'nepali-new-year';

export type ThemePreference = ThemeId | 'system' | 'global';

export type FestivalType = 'dashain' | 'tihar' | 'holi' | 'nepali-new-year';

export interface FestivalSchedule {
  enabled: boolean;
  themeId: ThemeId;
  startDate: string;
  endDate: string;
}

export interface GlobalThemeConfig {
  activeTheme: ThemeId;
  effectiveTheme: ThemeId;
  festivalGreeting: string;
  customMessage?: string;
  schedule?: FestivalSchedule;
  isScheduledActive: boolean;
  // Backward compatibility fields:
  festivalModeEnabled: boolean;
  activeFestival: FestivalType;
  updatedAt: string;
  updatedBy?: string | null;
  updatedByName?: string | null;
}

// ActiveTheme for backward compatibility with existing components
export type ActiveTheme = 
  | 'light' 
  | 'dark' 
  | 'night' 
  | 'neutral-default' 
  | 'dashain' 
  | 'tihar' 
  | 'holi' 
  | 'nepali-new-year'
  | 'festival-holi' 
  | 'festival-dashain' 
  | 'festival-tihar' 
  | 'festival-nepali-new-year';

interface ThemeContextType {
  userPreference: ThemePreference;
  globalTheme: GlobalThemeConfig;
  effectiveTheme: ThemeId;
  isFestivalEnforced: boolean;
  isScheduledActive: boolean;
  previewTheme: ThemeId | null;
  setPreviewTheme: (t: ThemeId | null) => void;
  // Legacy alias for compatibility:
  previewFestival: FestivalType | null;
  setPreviewFestival: (f: FestivalType | null) => void;
  setUserPreference: (preference: ThemePreference) => void;
  applyGlobalTheme: (
    themeId: ThemeId, 
    options?: { 
      festivalGreeting?: string; 
      customMessage?: string; 
      schedule?: FestivalSchedule 
    }
  ) => Promise<boolean>;
  resetToDefault: () => Promise<boolean>;
  cancelPreview: () => void;
  setGlobalFestival: (updates: Partial<GlobalThemeConfig>) => Promise<boolean>;
  refreshGlobalTheme: () => Promise<void>;
}

const DEFAULT_GLOBAL_THEME: GlobalThemeConfig = {
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

export const MTSLAB_GLOBAL_THEME_STORAGE_KEY = 'mtslab-global-theme';
export const MTSLAB_THEME_PREFERENCE_STORAGE_KEY = 'mtslab-theme-preference';

export const VALID_THEME_IDS: readonly ThemeId[] = [
  'light',
  'dark',
  'night',
  'neutral-default',
  'dashain',
  'tihar',
  'holi',
  'nepali-new-year',
] as const;

export const FESTIVAL_THEME_IDS: readonly ThemeId[] = [
  'dashain',
  'tihar',
  'holi',
  'nepali-new-year',
] as const;

function getCachedGlobalTheme(): GlobalThemeConfig {
  if (typeof window === 'undefined') return DEFAULT_GLOBAL_THEME;
  try {
    const raw = localStorage.getItem(MTSLAB_GLOBAL_THEME_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const activeTheme: ThemeId = parsed.activeTheme && VALID_THEME_IDS.includes(parsed.activeTheme)
          ? parsed.activeTheme
          : 'neutral-default';
        const effectiveTheme: ThemeId = parsed.effectiveTheme && VALID_THEME_IDS.includes(parsed.effectiveTheme)
          ? parsed.effectiveTheme
          : activeTheme;
        const isFestival = FESTIVAL_THEME_IDS.includes(effectiveTheme);

        return {
          activeTheme,
          effectiveTheme,
          festivalGreeting: parsed.festivalGreeting || DEFAULT_GLOBAL_THEME.festivalGreeting,
          customMessage: parsed.customMessage || DEFAULT_GLOBAL_THEME.customMessage,
          schedule: parsed.schedule || DEFAULT_GLOBAL_THEME.schedule,
          isScheduledActive: Boolean(parsed.isScheduledActive),
          festivalModeEnabled: isFestival,
          activeFestival: (isFestival ? effectiveTheme : 'dashain') as FestivalType,
          updatedAt: parsed.updatedAt || new Date().toISOString(),
          updatedBy: parsed.updatedBy || null,
          updatedByName: parsed.updatedByName || null,
        };
      }
    }
  } catch (e) {
    console.warn('[THEME HYDRATION PARSE WARN]', e);
  }
  return DEFAULT_GLOBAL_THEME;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. User's personal preference (stored locally per browser/profile)
  const [userPreference, setUserPreferenceState] = useState<ThemePreference>(() => {
    if (typeof window === 'undefined') return 'global';
    try {
      const saved = localStorage.getItem(MTSLAB_THEME_PREFERENCE_STORAGE_KEY) as ThemePreference;
      if (saved && [
        'light', 'dark', 'night', 'neutral-default', 'dashain', 'tihar', 'holi', 'nepali-new-year', 'system', 'global'
      ].includes(saved)) {
        return saved;
      }
    } catch (_) {}
    return 'global';
  });

  // Real-time Operating System Color-Scheme Tracking for System Preference
  const [systemIsDark, setSystemIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = (e: MediaQueryListEvent) => {
      setSystemIsDark(e.matches);
    };
    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, []);

  // 2. Authoritative Global Theme Configuration from server, pre-hydrated synchronously from localStorage cache to prevent flash of light mode
  const [globalTheme, setGlobalTheme] = useState<GlobalThemeConfig>(() => getCachedGlobalTheme());

  // 3. Super Admin local preview state (does NOT persist or change other sessions until published)
  const [previewTheme, setPreviewTheme] = useState<ThemeId | null>(null);

  // Fetch authoritative global theme config from server
  const refreshGlobalTheme = useCallback(async () => {
    try {
      const data = await api.get('/public/system-theme');
      if (data && typeof data === 'object') {
        const activeTheme: ThemeId = (data.activeTheme && VALID_THEME_IDS.includes(data.activeTheme))
          ? data.activeTheme
          : ((data.festivalModeEnabled && data.activeFestival && VALID_THEME_IDS.includes(data.activeFestival)) ? data.activeFestival : 'neutral-default');
        const effectiveTheme: ThemeId = (data.effectiveTheme && VALID_THEME_IDS.includes(data.effectiveTheme))
          ? data.effectiveTheme
          : activeTheme;
        const isFestival = FESTIVAL_THEME_IDS.includes(effectiveTheme);

        const newConfig: GlobalThemeConfig = {
          activeTheme,
          effectiveTheme,
          festivalGreeting: data.festivalGreeting || DEFAULT_GLOBAL_THEME.festivalGreeting,
          customMessage: data.customMessage || DEFAULT_GLOBAL_THEME.customMessage,
          schedule: data.schedule || DEFAULT_GLOBAL_THEME.schedule,
          isScheduledActive: Boolean(data.isScheduledActive),
          festivalModeEnabled: isFestival,
          activeFestival: (isFestival ? effectiveTheme : 'dashain') as FestivalType,
          updatedAt: data.updatedAt || new Date().toISOString(),
          updatedBy: data.updatedBy || null,
          updatedByName: data.updatedByName || null,
        };

        setGlobalTheme(newConfig);
        try {
          localStorage.setItem(MTSLAB_GLOBAL_THEME_STORAGE_KEY, JSON.stringify(newConfig));
        } catch (_) {}
      }
    } catch (err) {
      // Fallback silently if offline or server restarting; preserve local festival cache without reverting to light mode
      console.warn('[THEME HYDRATION NOTICE] Server unreachable; maintaining persisted local theme:', err);
    }
  }, []);

  useEffect(() => {
    refreshGlobalTheme();

    // Periodic safety check every 45s to ensure synchronized themes across staff workstations
    const interval = setInterval(refreshGlobalTheme, 45000);
    return () => clearInterval(interval);
  }, [refreshGlobalTheme]);

  // Real-time synchronization: when Super Admin updates theme, all connected clients update immediately
  useRealtimeSync(['system_theme', 'systemtheme', 'appsetting'], () => {
    refreshGlobalTheme();
  });

  // Determine effective theme with strict priority:
  // 1. Preview mode (Super Admin only, local testing in current tab)
  // 2. User's personal preference if explicitly opted-in (and not festival enforced)
  // 3. Super Admin Authoritative Global Theme (if festival theme is active or default)
  const isFestivalEnforced = globalTheme.festivalModeEnabled || FESTIVAL_THEME_IDS.includes(globalTheme.effectiveTheme);
  const isScheduledActive = globalTheme.isScheduledActive;

  const effectiveTheme: ThemeId = useMemo(() => {
    // 1. Super Admin local preview overrides everything in current tab
    if (previewTheme) {
      return previewTheme;
    }

    // 2. If user selected a personal override AND festival is not actively enforced
    if (userPreference !== 'global' && !isFestivalEnforced) {
      if (userPreference === 'system') {
        return systemIsDark ? 'dark' : 'light';
      }
      if (['light', 'dark', 'night', 'neutral-default'].includes(userPreference)) {
        return userPreference as ThemeId;
      }
    }

    // 3. Default: authoritatively follow global theme configured by Super Admin
    return globalTheme.effectiveTheme || globalTheme.activeTheme || 'neutral-default';
  }, [previewTheme, globalTheme, userPreference, isFestivalEnforced, systemIsDark]);

  // Apply theme classes to <html> root element
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;

    // Remove all previous theme classes
    root.classList.remove(
      'dark',
      'theme-light',
      'theme-night',
      'theme-neutral-default',
      'theme-festival',
      'theme-festival-dashain',
      'theme-festival-tihar',
      'theme-festival-holi',
      'theme-festival-nepali-new-year'
    );

    switch (effectiveTheme) {
      case 'light':
        root.classList.add('theme-light');
        break;
      case 'dark':
        root.classList.add('dark');
        break;
      case 'night':
        root.classList.add('dark', 'theme-night');
        break;
      case 'neutral-default':
        root.classList.add('theme-neutral-default');
        break;
      case 'dashain':
        root.classList.add('theme-festival', 'theme-festival-dashain');
        break;
      case 'tihar':
        // Tihar is a night-sky festival with glowing golden lamps
        root.classList.add('dark', 'theme-festival', 'theme-festival-tihar');
        break;
      case 'holi':
        root.classList.add('theme-festival', 'theme-festival-holi');
        break;
      case 'nepali-new-year':
        root.classList.add('theme-festival', 'theme-festival-nepali-new-year');
        break;
      default:
        root.classList.add('theme-neutral-default');
        break;
    }
  }, [effectiveTheme]);

  // User preference setter with persistent storage
  const setUserPreference = useCallback((preference: ThemePreference) => {
    if (isFestivalEnforced && preference !== 'global') {
      toast.info('Festival Mode is currently active globally. Personal overrides resume when the festival period concludes.');
      return;
    }
    setUserPreferenceState(preference);
    try {
      localStorage.setItem(MTSLAB_THEME_PREFERENCE_STORAGE_KEY, preference);
    } catch (_) {}
  }, [isFestivalEnforced]);

  // Super Admin action to apply and publish global theme configuration
  const applyGlobalTheme = useCallback(async (
    themeId: ThemeId,
    options?: {
      festivalGreeting?: string;
      customMessage?: string;
      schedule?: FestivalSchedule;
    }
  ): Promise<boolean> => {
    if (!VALID_THEME_IDS.includes(themeId)) {
      toast.error(`Invalid theme identifier '${themeId}'.`);
      return false;
    }

    const previousConfig = globalTheme;
    const isFestival = FESTIVAL_THEME_IDS.includes(themeId);
    const optimisticConfig: GlobalThemeConfig = {
      activeTheme: themeId,
      effectiveTheme: themeId,
      festivalGreeting: options?.festivalGreeting || (isFestival ? DEFAULT_GLOBAL_THEME.festivalGreeting : 'Serving with Excellence & Precision at MTS Lab Kathmandu'),
      customMessage: options?.customMessage || globalTheme.customMessage,
      schedule: options?.schedule || globalTheme.schedule,
      isScheduledActive: false,
      festivalModeEnabled: isFestival,
      activeFestival: (isFestival ? themeId : 'dashain') as FestivalType,
      updatedAt: new Date().toISOString(),
      updatedBy: globalTheme.updatedBy,
      updatedByName: globalTheme.updatedByName,
    };

    // Optimistically update UI & localStorage cache immediately
    setGlobalTheme(optimisticConfig);
    try {
      localStorage.setItem(MTSLAB_GLOBAL_THEME_STORAGE_KEY, JSON.stringify(optimisticConfig));
    } catch (_) {}

    try {
      const payload: any = {
        activeTheme: themeId,
        festivalGreeting: options?.festivalGreeting,
        customMessage: options?.customMessage,
        schedule: options?.schedule,
      };

      const res: any = await api.post('/admin/system-theme', payload);
      if (res && res.themeConfig) {
        setGlobalTheme(res.themeConfig);
        try {
          localStorage.setItem(MTSLAB_GLOBAL_THEME_STORAGE_KEY, JSON.stringify(res.themeConfig));
        } catch (_) {}
        setPreviewTheme(null); // Clear preview upon global publish
        toast.success(res.message || 'Global theme updated and broadcasted across all devices!');
        return true;
      }
      throw new Error(res?.error || 'Failed to update theme configuration.');
    } catch (err: any) {
      // Revert optimistic update on failure to prevent false sense of persistence
      console.error('[APPLY GLOBAL THEME ERROR]', err);
      setGlobalTheme(previousConfig);
      try {
        localStorage.setItem(MTSLAB_GLOBAL_THEME_STORAGE_KEY, JSON.stringify(previousConfig));
      } catch (_) {}
      toast.error(err?.message || 'Failed to apply global theme configuration.');
      return false;
    }
  }, [globalTheme]);

  // Super Admin action to reset to default neutral theme
  const resetToDefault = useCallback(async (): Promise<boolean> => {
    try {
      const res: any = await api.post('/admin/system-theme', {
        activeTheme: 'neutral-default',
        schedule: { enabled: false, themeId: 'dashain', startDate: '', endDate: '' },
      });
      if (res && res.themeConfig) {
        setGlobalTheme(res.themeConfig);
        try {
          localStorage.setItem(MTSLAB_GLOBAL_THEME_STORAGE_KEY, JSON.stringify(res.themeConfig));
        } catch (_) {}
        setPreviewTheme(null);
        toast.success('System theme successfully reset to Neutral Default!');
        return true;
      }
      return false;
    } catch (err: any) {
      toast.error(err.message || 'Failed to reset theme.');
      return false;
    }
  }, []);

  // Cancel local preview without affecting server state
  const cancelPreview = useCallback(() => {
    setPreviewTheme(null);
    toast.info('Preview discarded. Reverted to currently active global theme.');
  }, []);

  // Legacy setGlobalFestival adapter
  const setGlobalFestival = useCallback(async (updates: Partial<GlobalThemeConfig>): Promise<boolean> => {
    return applyGlobalTheme(
      updates.activeTheme || (updates.festivalModeEnabled && updates.activeFestival ? updates.activeFestival : 'neutral-default'),
      {
        festivalGreeting: updates.festivalGreeting,
        customMessage: updates.customMessage,
        schedule: updates.schedule,
      }
    );
  }, [applyGlobalTheme]);

  // Legacy previewFestival adapter
  const previewFestival = useMemo<FestivalType | null>(() => {
    if (previewTheme && ['dashain', 'tihar', 'holi', 'nepali-new-year'].includes(previewTheme)) {
      return previewTheme as FestivalType;
    }
    return null;
  }, [previewTheme]);

  const setPreviewFestival = useCallback((f: FestivalType | null) => {
    setPreviewTheme(f as ThemeId | null);
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        userPreference,
        globalTheme,
        effectiveTheme,
        isFestivalEnforced,
        isScheduledActive,
        previewTheme,
        setPreviewTheme,
        previewFestival,
        setPreviewFestival,
        setUserPreference,
        applyGlobalTheme,
        resetToDefault,
        cancelPreview,
        setGlobalFestival,
        refreshGlobalTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used within a ThemeProvider');
  }
  return context;
}

export const useTheme = useAppTheme;

