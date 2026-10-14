import React, { useState, useEffect, useMemo } from 'react';
import { 
  Palette, 
  Sun, 
  Moon, 
  Eye, 
  RotateCcw, 
  Save, 
  X, 
  Calendar, 
  Clock, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  Sparkles,
  Info,
  CalendarCheck2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppTheme, ThemeId, FestivalSchedule } from '@/context/ThemeContext';
import { useAuthStore } from '@/store/authStore';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { 
  JamaraArtwork, 
  DiyoArtwork, 
  GulalArtwork, 
  NewYearArtwork, 
  FestivalDecorations 
} from '@/components/theme/FestivalDecorations';

interface ThemeDefinition {
  id: ThemeId;
  name: string;
  category: 'standard' | 'festival';
  description: string;
  visualSummary: string;
  badge: string;
  colorPreview: {
    bg: string;
    card: string;
    text: string;
    accent: string;
    border: string;
  };
  artwork?: React.ReactNode;
}

const THEME_CATALOG: ThemeDefinition[] = [
  {
    id: 'neutral-default',
    name: 'Neutral Default',
    category: 'standard',
    description: 'Clean slate neutral surface with high contrast typography and zero seasonal decorations. Standard corporate workbench.',
    visualSummary: 'Pure Slate & Crisp White Surfaces',
    badge: 'Standard Baseline',
    colorPreview: {
      bg: '#f8fafc',
      card: '#ffffff',
      text: '#0f172a',
      accent: '#0f172a',
      border: '#e2e8f0',
    },
  },
  {
    id: 'light',
    name: 'Light Mode',
    category: 'standard',
    description: 'Bright surfaces with crisp neutral gray borders, high contrast dark text, and subtle shadows for daytime workstation use.',
    visualSummary: 'High-Luminance Crisp Light',
    badge: 'Daytime Workstation',
    colorPreview: {
      bg: '#ffffff',
      card: '#ffffff',
      text: '#09090b',
      accent: '#18181b',
      border: '#e4e4e7',
    },
  },
  {
    id: 'dark',
    name: 'Dark Mode',
    category: 'standard',
    description: 'Refined dark slate gray surfaces with soft white text and subdued borders to reduce eye strain in low-light environments.',
    visualSummary: 'Balanced Low-Glare Dark Slate',
    badge: 'Standard Dark',
    colorPreview: {
      bg: '#09090b',
      card: '#18181b',
      text: '#fafafa',
      accent: '#6366f1',
      border: 'rgba(255,255,255,0.1)',
    },
  },
  {
    id: 'night',
    name: 'Night Mode',
    category: 'standard',
    description: 'Deep pitch-black / OLED surfaces with soft sky-blue indicators, ultra-low glare, and minimal luminance for dim repair labs.',
    visualSummary: 'Deep Midnight OLED Black',
    badge: 'Ultra Low Glare',
    colorPreview: {
      bg: '#05070c',
      card: '#0b0f19',
      text: '#f8fafc',
      accent: '#38bdf8',
      border: 'rgba(255,255,255,0.08)',
    },
  },
  {
    id: 'dashain',
    name: 'Dashain Festival',
    category: 'festival',
    description: 'Traditional Nepalese Dashain theme with sacred green Jamara sprouts, warm cream surfaces, and restrained gold accents.',
    visualSummary: 'Sacred Jamara Green & Crimson',
    badge: 'National Festival',
    colorPreview: {
      bg: '#fcf9f4',
      card: '#ffffff',
      text: '#1c1917',
      accent: '#991b1b',
      border: '#ebd9c3',
    },
    artwork: <JamaraArtwork className="w-12 h-12" />,
  },
  {
    id: 'tihar',
    name: 'Tihar Festival',
    category: 'festival',
    description: 'Traditional Tihar festival theme featuring hand-crafted clay diyos with luminous golden flames and sayapatri marigold petals.',
    visualSummary: 'Clay Oil Lamps & Deepawali Gold',
    badge: 'Festival of Lights',
    colorPreview: {
      bg: '#0b0f17',
      card: '#131b26',
      text: '#f8fafc',
      accent: '#f59e0b',
      border: '#334155',
    },
    artwork: <DiyoArtwork className="w-12 h-12" />,
  },
  {
    id: 'holi',
    name: 'Holi Festival',
    category: 'festival',
    description: 'Joyful Nepalese festival of colors featuring authentic organic gulal powder bursts in magenta, yellow, cyan, and emerald green.',
    visualSummary: 'Vibrant Organic Gulal Powders',
    badge: 'Festival of Colors',
    colorPreview: {
      bg: '#fdfafb',
      card: '#ffffff',
      text: '#1c1917',
      accent: '#be185d',
      border: '#f2e1ea',
    },
    artwork: <GulalArtwork className="w-12 h-12" />,
  },
  {
    id: 'nepali-new-year',
    name: 'Nepali New Year',
    category: 'festival',
    description: 'Auspicious Nawa Barsha theme with sacred Toran garland arches, fresh spring emerald green, and gold prosperity accents.',
    visualSummary: 'Auspicious Toran & Emerald Green',
    badge: 'Nawa Barsha',
    colorPreview: {
      bg: '#fcfbf7',
      card: '#ffffff',
      text: '#1c1917',
      accent: '#047857',
      border: '#e2e8df',
    },
    artwork: <NewYearArtwork className="w-12 h-12" />,
  },
];

export default function ThemeController() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const {
    globalTheme,
    effectiveTheme,
    previewTheme,
    setPreviewTheme,
    applyGlobalTheme,
    resetToDefault,
    cancelPreview,
    refreshGlobalTheme,
  } = useAppTheme();

  // Strict Super Admin Access Guard
  useEffect(() => {
    if (user && user.role !== 'SUPER_ADMIN') {
      toast.error('Access Denied. Theme Controller is strictly reserved for the authenticated Super Admin.');
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  // Selected theme in the controller UI (either previewing or currently active)
  const [selectedThemeId, setSelectedThemeId] = useState<ThemeId>(() => {
    return previewTheme || globalTheme.activeTheme || 'neutral-default';
  });

  const [customGreeting, setCustomGreeting] = useState<string>(globalTheme.festivalGreeting || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Festival schedule form state
  const [scheduleEnabled, setScheduleEnabled] = useState<boolean>(Boolean(globalTheme.schedule?.enabled));
  const [scheduleThemeId, setScheduleThemeId] = useState<ThemeId>(globalTheme.schedule?.themeId || 'dashain');
  const [scheduleStart, setScheduleStart] = useState<string>(globalTheme.schedule?.startDate || '');
  const [scheduleEnd, setScheduleEnd] = useState<string>(globalTheme.schedule?.endDate || '');

  // Keep state synchronized with authoritative globalTheme updates from server
  useEffect(() => {
    if (!previewTheme) {
      setSelectedThemeId(globalTheme.activeTheme || 'neutral-default');
      setCustomGreeting(globalTheme.festivalGreeting || '');
      setScheduleEnabled(Boolean(globalTheme.schedule?.enabled));
      setScheduleThemeId(globalTheme.schedule?.themeId || 'dashain');
      setScheduleStart(globalTheme.schedule?.startDate || '');
      setScheduleEnd(globalTheme.schedule?.endDate || '');
    }
  }, [globalTheme, previewTheme]);

  const hasUnsavedChanges = useMemo(() => {
    if (previewTheme !== null && previewTheme !== globalTheme.activeTheme) return true;
    if (selectedThemeId !== globalTheme.activeTheme) return true;
    if (customGreeting !== (globalTheme.festivalGreeting || '')) return true;
    if (scheduleEnabled !== Boolean(globalTheme.schedule?.enabled)) return true;
    if (scheduleEnabled) {
      if (scheduleThemeId !== (globalTheme.schedule?.themeId || 'dashain')) return true;
      if (scheduleStart !== (globalTheme.schedule?.startDate || '')) return true;
      if (scheduleEnd !== (globalTheme.schedule?.endDate || '')) return true;
    }
    return false;
  }, [selectedThemeId, customGreeting, scheduleEnabled, scheduleThemeId, scheduleStart, scheduleEnd, globalTheme, previewTheme]);

  // Handle local preview
  const handlePreview = (themeId: ThemeId) => {
    setSelectedThemeId(themeId);
    setPreviewTheme(themeId);
    toast.info(`Local Preview Active: ${THEME_CATALOG.find(t => t.id === themeId)?.name}. Not saved to other sessions yet.`);
  };

  // Discard preview and changes
  const handleCancel = () => {
    cancelPreview();
    setSelectedThemeId(globalTheme.activeTheme || 'neutral-default');
    setCustomGreeting(globalTheme.festivalGreeting || '');
    setScheduleEnabled(Boolean(globalTheme.schedule?.enabled));
    setScheduleThemeId(globalTheme.schedule?.themeId || 'dashain');
    setScheduleStart(globalTheme.schedule?.startDate || '');
    setScheduleEnd(globalTheme.schedule?.endDate || '');
  };

  // Apply Theme globally to database and broadcast to all staff
  const handleApply = async () => {
    if (isSaving) return;

    if (scheduleEnabled) {
      if (!scheduleStart || !scheduleEnd) {
        toast.error('Both Schedule Start and End dates are required when Festival Scheduling is enabled.');
        return;
      }
      const s = new Date(scheduleStart).getTime();
      const e = new Date(scheduleEnd).getTime();
      if (isNaN(s) || isNaN(e) || s >= e) {
        toast.error('Schedule Start date must be earlier than End date.');
        return;
      }
    }

    setIsSaving(true);
    try {
      const schedulePayload: FestivalSchedule = {
        enabled: scheduleEnabled,
        themeId: scheduleThemeId,
        startDate: scheduleStart,
        endDate: scheduleEnd,
      };

      const success = await applyGlobalTheme(selectedThemeId, {
        festivalGreeting: customGreeting.trim(),
        schedule: schedulePayload,
      });

      if (success) {
        setPreviewTheme(null);
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to default
  const handleReset = async () => {
    if (confirm('Reset system theme to Neutral Default across all staff workspaces?')) {
      setIsSaving(true);
      try {
        await resetToDefault();
        setSelectedThemeId('neutral-default');
        setScheduleEnabled(false);
      } finally {
        setIsSaving(false);
      }
    }
  };

  // Refresh server config
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshGlobalTheme();
      toast.success('Configuration refreshed from authoritative backend.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const activeThemeMeta = THEME_CATALOG.find(t => t.id === globalTheme.activeTheme) || THEME_CATALOG[0];
  const selectedThemeMeta = THEME_CATALOG.find(t => t.id === selectedThemeId) || activeThemeMeta;

  return (
    <div className="space-y-6 sm:space-y-8 select-none max-w-7xl mx-auto pb-12">
      
      {/* Header with Title and Global Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/20 shrink-0">
            <Palette className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                Global Theme Controller
              </h1>
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-300 text-[10px] font-black uppercase tracking-wider">
                <ShieldCheck className="w-3 h-3 mr-1" />
                Super Admin Exclusive
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Authoritatively manage global appearance, authentic festival motifs, and multi-device styling across all user roles.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="text-xs font-bold rounded-xl cursor-pointer"
            title="Reload configuration from server"
          >
            <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", isRefreshing && "animate-spin")} />
            Refresh
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={isSaving}
            className="text-xs font-bold rounded-xl text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-rose-200 cursor-pointer"
            title="Reset system to Neutral Default"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            Reset to Default
          </Button>

          {previewTheme && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              className="text-xs font-bold rounded-xl text-slate-600 dark:text-slate-300 cursor-pointer"
            >
              <X className="w-3.5 h-3.5 mr-1.5" />
              Discard Preview
            </Button>
          )}

          <Button
            size="sm"
            onClick={handleApply}
            disabled={isSaving || !hasUnsavedChanges}
            className={cn(
              "text-xs font-extrabold rounded-xl text-white shadow-md cursor-pointer transition-all",
              hasUnsavedChanges
                ? "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/30 animate-pulse"
                : "bg-slate-800 hover:bg-slate-900 opacity-60"
            )}
          >
            <Save className="w-3.5 h-3.5 mr-1.5" />
            {isSaving ? 'Publishing Globally...' : 'Apply Theme Globally'}
          </Button>
        </div>
      </div>

      {/* Local Preview Notification Alert (if preview is active) */}
      {previewTheme && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <Eye className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <div>
              <p className="text-xs sm:text-sm font-extrabold">
                Local Preview Active: <span className="uppercase">{THEME_CATALOG.find(t => t.id === previewTheme)?.name}</span>
              </p>
              <p className="text-[11px] text-indigo-700 dark:text-indigo-300 font-medium mt-0.5">
                This appearance is only visible in your current session. Click &quot;Apply Theme Globally&quot; to push this theme to all staff devices.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              className="text-xs font-bold rounded-xl h-8 cursor-pointer border-indigo-300 dark:border-indigo-700"
            >
              Cancel Preview
            </Button>
            <Button
              size="sm"
              onClick={handleApply}
              disabled={isSaving}
              className="text-xs font-bold rounded-xl h-8 bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
            >
              Publish Now
            </Button>
          </div>
        </div>
      )}

      {/* Active Global Status Card */}
      <Card className="rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
        <CardContent className="p-4 sm:p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-slate-800">
            
            {/* Active Theme Summary */}
            <div className="pr-0 md:pr-4">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-1">
                Currently Active Global Theme
              </span>
              <div className="flex items-center gap-2.5 mt-1">
                <div 
                  className="w-5 h-5 rounded-full border border-black/10 shrink-0 shadow-xs"
                  style={{ backgroundColor: activeThemeMeta.colorPreview.accent }}
                />
                <span className="text-base font-black text-slate-900 dark:text-white">
                  {activeThemeMeta.name}
                </span>
                <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-300 text-[10px] font-bold">
                  Live
                </Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                {activeThemeMeta.visualSummary}
              </p>
            </div>

            {/* Schedule Status */}
            <div className="pt-3 md:pt-0 px-0 md:px-4">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-1">
                Asia/Kathmandu Festival Scheduler
              </span>
              <div className="flex items-center gap-2 mt-1">
                <Calendar className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {globalTheme.isScheduledActive ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-extrabold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Active Schedule Enforced
                    </span>
                  ) : globalTheme.schedule?.enabled ? (
                    <span className="text-amber-600 dark:text-amber-400 font-bold">
                      Configured (Awaiting Start Date)
                    </span>
                  ) : (
                    <span className="text-slate-400 font-medium">No Schedule Active</span>
                  )}
                </span>
              </div>
              {globalTheme.schedule?.enabled && globalTheme.schedule.startDate && (
                <p className="text-[11px] text-slate-500 font-mono mt-1 truncate">
                  Window: {globalTheme.schedule.startDate} → {globalTheme.schedule.endDate}
                </p>
              )}
            </div>

            {/* Last Authoritative Update Info */}
            <div className="pt-3 md:pt-0 pl-0 md:pl-4">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-1">
                Configuration Governance
              </span>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">
                Author: {globalTheme.updatedByName || 'Super Admin'}
              </p>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                Updated: {globalTheme.updatedAt ? new Date(globalTheme.updatedAt).toLocaleString() : 'System Default'}
              </p>
            </div>

          </div>
        </CardContent>
      </Card>

      {/* 8 Themes Selection Catalog */}
      <div className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <span>Select System Theme</span>
            <span className="text-xs font-bold text-slate-400">({THEME_CATALOG.length} Available Themes)</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            Click any card to preview. Standard themes provide low-glare, professional styling. Festival themes incorporate culturally authentic decorations with zero AI slop.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {THEME_CATALOG.map((theme) => {
            const isCurrentlyActive = globalTheme.activeTheme === theme.id;
            const isPreviewingThis = previewTheme === theme.id;
            const isSelected = selectedThemeId === theme.id;

            return (
              <div
                key={theme.id}
                onClick={() => handlePreview(theme.id)}
                className={cn(
                  "relative rounded-2xl p-4 sm:p-5 border transition-all cursor-pointer flex flex-col justify-between group",
                  isSelected
                    ? "ring-2 ring-indigo-600 border-indigo-600 bg-indigo-50/20 dark:bg-indigo-950/20 shadow-md"
                    : "border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-xs",
                  isCurrentlyActive && "border-emerald-500/80 dark:border-emerald-500/80"
                )}
              >
                {/* Top: Category Badge + Status Badges */}
                <div>
                  <div className="flex items-center justify-between gap-1.5 mb-3">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] font-bold uppercase tracking-wider py-0 px-2 rounded-md",
                        theme.category === 'festival'
                          ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200"
                      )}
                    >
                      {theme.badge}
                    </Badge>

                    <div className="flex items-center gap-1">
                      {isCurrentlyActive && (
                        <span className="flex items-center gap-1 text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 px-1.5 py-0.5 rounded-md">
                          <CheckCircle2 className="w-3 h-3" />
                          Live
                        </span>
                      )}
                      {isPreviewingThis && (
                        <span className="flex items-center gap-1 text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-300 px-1.5 py-0.5 rounded-md">
                          <Eye className="w-3 h-3" />
                          Preview
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Artwork / Icon and Theme Name */}
                  <div className="flex items-start gap-3 my-2">
                    {theme.artwork ? (
                      <div className="shrink-0">{theme.artwork}</div>
                    ) : (
                      <div 
                        className="w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 shadow-inner"
                        style={{ backgroundColor: theme.colorPreview.bg, borderColor: theme.colorPreview.border }}
                      >
                        {theme.id === 'light' ? (
                          <Sun className="w-6 h-6 text-amber-500" />
                        ) : theme.id === 'night' ? (
                          <Moon className="w-6 h-6 text-sky-400" />
                        ) : theme.id === 'dark' ? (
                          <Moon className="w-6 h-6 text-indigo-400" />
                        ) : (
                          <Palette className="w-6 h-6 text-slate-700" />
                        )}
                      </div>
                    )}

                    <div className="min-w-0">
                      <h3 className="text-sm font-black text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {theme.name}
                      </h3>
                      <p className="text-[11px] text-slate-400 font-medium">
                        {theme.visualSummary}
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 font-medium mt-2 line-clamp-3 leading-relaxed">
                    {theme.description}
                  </p>
                </div>

                {/* Bottom: Color Palette Swatches & Click To Preview */}
                <div className="pt-4 mt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                  {/* Swatches */}
                  <div className="flex items-center gap-1.5" title="Palette swatches">
                    <span 
                      className="w-4 h-4 rounded-full border border-black/10 shadow-2xs" 
                      style={{ backgroundColor: theme.colorPreview.bg }} 
                      title="Background" 
                    />
                    <span 
                      className="w-4 h-4 rounded-full border border-black/10 shadow-2xs" 
                      style={{ backgroundColor: theme.colorPreview.card }} 
                      title="Card surface" 
                    />
                    <span 
                      className="w-4 h-4 rounded-full border border-black/10 shadow-2xs" 
                      style={{ backgroundColor: theme.colorPreview.accent }} 
                      title="Accent" 
                    />
                    <span 
                      className="w-4 h-4 rounded-full border border-black/10 shadow-2xs" 
                      style={{ backgroundColor: theme.colorPreview.text }} 
                      title="Typography" 
                    />
                  </div>

                  <span className="text-[11px] font-extrabold text-indigo-600 dark:text-indigo-400 group-hover:underline flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    Preview
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Theme Live Preview Sandbox */}
      <Card className="rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
        <CardHeader className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-black flex items-center gap-2">
                <Palette className="w-4 h-4 text-indigo-600" />
                Theme Preview Sandbox: {selectedThemeMeta.name}
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Displays real dashboard styling, authentic Nepalese artwork, and interface components as they appear when applied.
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={handleApply}
              disabled={isSaving}
              className="text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl cursor-pointer"
            >
              <Save className="w-3.5 h-3.5 mr-1" />
              Apply {selectedThemeMeta.name}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 space-y-4">
          {/* Festival Decoration Banner if festival theme selected */}
          {['dashain', 'tihar', 'holi', 'nepali-new-year'].includes(selectedThemeId) && (
            <FestivalDecorations 
              forcedTheme={selectedThemeId} 
              customGreeting={customGreeting}
            />
          )}

          {/* Sample Mini UI Dashboard Components rendered in the preview */}
          <div className="p-4 rounded-xl border border-slate-200/70 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/40 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-slate-400 tracking-wider">
                Sample Live Components
              </span>
              <Badge variant="outline" className="text-[10px] font-bold">
                {selectedThemeMeta.name} Active
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Repairs In Progress</span>
                <p className="text-lg font-black text-slate-900 dark:text-white mt-1">42 Units</p>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">● Active Bench Queue</span>
              </div>

              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Laser Line Restorations</span>
                <p className="text-lg font-black text-slate-900 dark:text-white mt-1">18 Displays</p>
                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">● Kathmandu Cleanroom</span>
              </div>

              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Today&apos;s Revenue</span>
                <p className="text-lg font-black text-slate-900 dark:text-white mt-1">NPR 84,500</p>
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">● Verified Payments</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Festival Greeting & Scheduling Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Festival Custom Message Editor */}
        <Card className="rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
          <CardHeader className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-sm font-black flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Festival Banner Greeting Message
            </CardTitle>
            <CardDescription className="text-xs">
              Customize the formal Nepali &amp; English greeting displayed in the dashboard header when a festival theme is active.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 space-y-3">
            <div>
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Banner Headline Text
              </Label>
              <Input
                value={customGreeting}
                onChange={(e) => setCustomGreeting(e.target.value)}
                placeholder="e.g. बडा दशैंको हार्दिक मंगलमय शुभकामना | Happy Dashain"
                className="mt-1 text-xs h-10 rounded-xl"
              />
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <Info className="w-3.5 h-3.5 shrink-0" />
              <span>Leaves default celebratory greeting if empty. Displays respectfully without covering interactive tools.</span>
            </div>
          </CardContent>
        </Card>

        {/* Optional Asia/Kathmandu Festival Scheduler */}
        <Card className="rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
          <CardHeader className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-black flex items-center gap-2">
                  <CalendarCheck2 className="w-4 h-4 text-emerald-600" />
                  Festival Theme Scheduling
                </CardTitle>
                <CardDescription className="text-xs">
                  Automate festival theme activation for specific holiday windows in <code className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">Asia/Kathmandu</code>.
                </CardDescription>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={scheduleEnabled}
                  onChange={(e) => setScheduleEnabled(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Enable</span>
              </label>
            </div>
          </CardHeader>

          <CardContent className="p-4 sm:p-5 space-y-3">
            {scheduleEnabled ? (
              <>
                <div>
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Scheduled Festival Theme
                  </Label>
                  <select
                    value={scheduleThemeId}
                    onChange={(e) => setScheduleThemeId(e.target.value as ThemeId)}
                    className="mt-1 w-full text-xs h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="dashain">Dashain Festival (Jamara)</option>
                    <option value="tihar">Tihar Festival (Clay Diyo)</option>
                    <option value="holi">Holi Festival (Gulal)</option>
                    <option value="nepali-new-year">Nepali New Year (Toran)</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Start Date (Asia/Kathmandu)
                    </Label>
                    <Input
                      type="date"
                      value={scheduleStart ? scheduleStart.split('T')[0] : ''}
                      onChange={(e) => setScheduleStart(e.target.value ? `${e.target.value}T00:00:00` : '')}
                      className="mt-1 text-xs h-9 rounded-xl font-mono"
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      End Date (Asia/Kathmandu)
                    </Label>
                    <Input
                      type="date"
                      value={scheduleEnd ? scheduleEnd.split('T')[0] : ''}
                      onChange={(e) => setScheduleEnd(e.target.value ? `${e.target.value}T23:59:59` : '')}
                      className="mt-1 text-xs h-9 rounded-xl font-mono"
                    />
                  </div>
                </div>

                <p className="text-[11px] text-slate-400">
                  During this window, the scheduled festival theme takes authoritative precedence. Once expired, the system safely reverts to the standard theme.
                </p>
              </>
            ) : (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-center text-slate-400">
                <Clock className="w-6 h-6 mx-auto mb-1 opacity-60" />
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Schedule Disabled</p>
                <p className="text-[11px] text-slate-400 mt-0.5">The manually applied theme will remain active indefinitely.</p>
              </div>
            )}
          </CardContent>
        </Card>

      </div>

    </div>
  );
}
