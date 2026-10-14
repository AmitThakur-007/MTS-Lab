import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '@/services/api';
import { useRealtimeSync } from '@/services/realtime';
import { toast } from 'sonner';

export type ThemePreference = 'light' | 'dark' | 'system';
export type FestivalType = 'holi' | 'dashain' | 'tihar';
export type ActiveTheme = 'light' | 'dark' | 'festival-holi' | 'festival-dashain' | 'festival-tihar';

export interface GlobalThemeConfig {
  festivalModeEnabled: boolean;
  activeFestival: FestivalType;
  festivalGreeting: string;
  customMessage?: string;
  updatedAt: string;
  updatedBy?: string | null;
  updatedByName?: string | null;
}

interface ThemeContextType {
  userPreference: ThemePreference;
  globalTheme: GlobalThemeConfig;
  effectiveTheme: ActiveTheme;
  isFestivalEnforced: boolean;
  previewFestival: FestivalType | null;
  setPreviewFestival: (f: FestivalType | null) => void;
  setUserPreference: (preference: ThemePreference) => void;
  setGlobalFestival: (updates: Partial<GlobalThemeConfig>) => Promise<boolean>;
  refreshGlobalTheme: () => Promise<void>;
}

const DEFAULT_GLOBAL_THEME: GlobalThemeConfig = {
  festivalModeEnabled: false,
  activeFestival: 'dashain',
  festivalGreeting: 'Celebrating the festive spirit across MTS Lab Kathmandu',
  customMessage: 'Happy Festive Season from Mobile Technology Station',
  updatedAt: new Date().toISOString(),
  updatedBy: null,
  updatedByName: null,
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. User's personal preference (stored locally per browser/profile)
  const [userPreference, setUserPreferenceState] = useState<ThemePreference>(() => {
    if (typeof window === 'undefined') return 'light';
    const saved = localStorage.getItem('mtslab-theme-preference');
    if (saved === 'dark' || saved === 'light' || saved === 'system') return saved;
    return 'light';
  });

  // 2. Global Festival Configuration (authoritatively fetched from server)
  const [globalTheme, setGlobalTheme] = useState<GlobalThemeConfig>(DEFAULT_GLOBAL_THEME);

  // 3. Super Admin local preview state (does not affect other users until published)
  const [previewFestival, setPreviewFestival] = useState<FestivalType | null>(null);

  // Fetch authoritative global theme config from server
  const refreshGlobalTheme = useCallback(async () => {
    try {
      const data = await api.get('/public/system-theme');
      if (data && typeof data === 'object') {
        setGlobalTheme({
          festivalModeEnabled: Boolean(data.festivalModeEnabled),
          activeFestival: ['holi', 'dashain', 'tihar'].includes(data.activeFestival) ? data.activeFestival : 'dashain',
          festivalGreeting: data.festivalGreeting || DEFAULT_GLOBAL_THEME.festivalGreeting,
          customMessage: data.customMessage || DEFAULT_GLOBAL_THEME.customMessage,
          updatedAt: data.updatedAt || new Date().toISOString(),
          updatedBy: data.updatedBy || null,
          updatedByName: data.updatedByName || null,
        });
      }
    } catch (err) {
      // Fallback silently if offline or initializing
    }
  }, []);

  useEffect(() => {
    refreshGlobalTheme();

    // Periodic safety check every 45s to ensure synchronized festival themes across staff
    const interval = setInterval(refreshGlobalTheme, 45000);
    return () => clearInterval(interval);
  }, [refreshGlobalTheme]);

  // Real-time synchronization: when Super Admin updates festival theme, all connected clients update immediately
  useRealtimeSync(['system_theme', 'systemtheme', 'appsetting'], () => {
    refreshGlobalTheme();
  });

  // Determine effective theme with strict priority:
  // 1. Preview mode (Super Admin only, local testing)
  // 2. Global Festival Mode (if enabled by Super Admin)
  // 3. User's personal Dark / Light / System preference
  const effectiveTheme: ActiveTheme = useMemo(() => {
    if (previewFestival) {
      return `festival-${previewFestival}` as ActiveTheme;
    }

    if (globalTheme.festivalModeEnabled) {
      return `festival-${globalTheme.activeFestival}` as ActiveTheme;
    }

    if (userPreference === 'system' && typeof window !== 'undefined') {
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      return systemDark ? 'dark' : 'light';
    }

    return userPreference === 'dark' ? 'dark' : 'light';
  }, [previewFestival, globalTheme, userPreference]);

  const isFestivalEnforced = globalTheme.festivalModeEnabled && !previewFestival;

  // Apply theme classes to <html> root element
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;

    // Remove all previous theme-related classes
    root.classList.remove(
      'dark',
      'theme-festival',
      'theme-festival-holi',
      'theme-festival-dashain',
      'theme-festival-tihar'
    );

    if (effectiveTheme === 'dark') {
      root.classList.add('dark');
    } else if (effectiveTheme.startsWith('festival-')) {
      root.classList.add('theme-festival', `theme-${effectiveTheme}`);
      if (effectiveTheme === 'festival-tihar') {
        // Tihar uses dark celebratory background
        root.classList.add('dark');
      }
    }
  }, [effectiveTheme]);

  // User preference setter with persistent storage
  const setUserPreference = useCallback((preference: ThemePreference) => {
    if (isFestivalEnforced) {
      toast.info('Festival Mode is globally active. Personal theme settings will resume when Festival Mode ends.');
      return;
    }
    setUserPreferenceState(preference);
    try {
      localStorage.setItem('mtslab-theme-preference', preference);
    } catch (_) {}
  }, [isFestivalEnforced]);

  // Super Admin action to publish global festival settings to the backend
  const setGlobalFestival = useCallback(async (updates: Partial<GlobalThemeConfig>): Promise<boolean> => {
    try {
      const res: any = await api.post('/admin/system-theme', updates);
      if (res && res.themeConfig) {
        setGlobalTheme(res.themeConfig);
        setPreviewFestival(null); // Clear preview upon global publish
        toast.success(res.message || 'Global festival theme updated successfully!');
        return true;
      }
      return false;
    } catch (err: any) {
      toast.error(err.message || 'Failed to update global festival settings.');
      return false;
    }
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        userPreference,
        globalTheme,
        effectiveTheme,
        isFestivalEnforced,
        previewFestival,
        setPreviewFestival,
        setUserPreference,
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
