import React, { useState, useRef, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRealtimeSync, realtimeService } from '@/services/realtime';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export interface DashboardRefreshButtonProps {
  onRefresh?: () => Promise<any> | void;
  isRefreshing?: boolean;
  lastUpdated?: Date | null;
  showLastUpdated?: boolean;
  showLiveBadge?: boolean;
  size?: 'sm' | 'default' | 'lg' | 'xs' | 'icon' | 'icon-xs' | 'icon-sm' | 'icon-lg';
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link';
  className?: string;
  label?: string;
  refreshingLabel?: string;
}

export const DashboardRefreshButton: React.FC<DashboardRefreshButtonProps> = ({
  onRefresh,
  isRefreshing: externalIsRefreshing,
  lastUpdated: externalLastUpdated,
  showLastUpdated = true,
  showLiveBadge = true,
  size = 'default',
  variant = 'outline',
  className,
  label = 'Refresh Data',
  refreshingLabel = 'Syncing...'
}) => {
  const [internalRefreshing, setInternalRefreshing] = useState(false);
  const [internalLastUpdated, setInternalLastUpdated] = useState<Date>(new Date());
  const [justSynced, setJustSynced] = useState(false);
  const syncTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isRefreshing = externalIsRefreshing !== undefined ? externalIsRefreshing : internalRefreshing;
  const lastUpdated = externalLastUpdated !== undefined ? externalLastUpdated : internalLastUpdated;

  // Real-time synchronization connection state (silent background updates - no UI flickering!)
  const { connectionStatus } = useRealtimeSync(['*'], () => {
    setInternalLastUpdated(new Date());
    // NOTE: Background realtime stream updates do NOT trigger justSynced.
    // justSynced is reserved strictly for user-initiated manual refreshes.
  });

  useEffect(() => {
    return () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }
    };
  }, []);

  const triggerSyncedState = () => {
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
    }
    setJustSynced(true);
    syncTimerRef.current = setTimeout(() => {
      setJustSynced(false);
      syncTimerRef.current = null;
    }, 1800);
  };

  const handleRefresh = async () => {
    if (isRefreshing) return;

    if (onRefresh) {
      setInternalRefreshing(true);
      try {
        await Promise.resolve(onRefresh());
        setInternalLastUpdated(new Date());
        triggerSyncedState();
      } catch (err) {
        console.error('[MANUAL REFRESH ERROR]', err);
      } finally {
        setInternalRefreshing(false);
      }
    } else {
      setInternalRefreshing(true);
      realtimeService.connect();
      window.dispatchEvent(new CustomEvent('mts-realtime-update', { 
        detail: { entity: 'sync', action: 'SYNC', timestamp: Date.now() } 
      }));
      setTimeout(() => {
        setInternalRefreshing(false);
        setInternalLastUpdated(new Date());
        triggerSyncedState();
      }, 500);
    }
  };

  const formattedTime = lastUpdated 
    ? format(lastUpdated, 'HH:mm:ss')
    : format(new Date(), 'HH:mm:ss');

  return (
    <div className={cn("inline-flex items-center gap-1.5 sm:gap-2 max-w-full shrink-0", className)}>
      {/* Live Synchronization Status Indicator */}
      {showLiveBadge && (
        <div 
          className={cn(
            "hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-bold transition-all duration-300 shadow-xs select-none shrink-0",
            isRefreshing
              ? "bg-indigo-50 text-indigo-700 border-indigo-200"
              : justSynced
              ? "bg-emerald-100/90 text-emerald-800 border-emerald-300 ring-2 ring-emerald-400/30"
              : connectionStatus === 'connected' 
              ? "bg-emerald-50/80 text-emerald-700 border-emerald-200/80"
              : connectionStatus === 'connecting'
              ? "bg-amber-50 text-amber-700 border-amber-200"
              : "bg-slate-50 text-slate-500 border-slate-200"
          )}
          title={
            isRefreshing
              ? "Syncing latest data from database..."
              : justSynced
              ? "Data successfully synchronized"
              : connectionStatus === 'connected' 
              ? "Connected to MTS Central Real-time Database Hub" 
              : connectionStatus === 'connecting' 
              ? "Reconnecting to Central Database..." 
              : "Live stream idle (Click to refresh)"
          }
        >
          <span 
            className={cn(
              "w-2 h-2 rounded-full transition-colors duration-300 shrink-0",
              isRefreshing
                ? "bg-indigo-500 animate-pulse"
                : justSynced
                ? "bg-emerald-600"
                : connectionStatus === 'connected' 
                ? "bg-emerald-500" 
                : connectionStatus === 'connecting' 
                ? "bg-amber-500 animate-pulse" 
                : "bg-slate-400"
            )} 
          />
          <span className="tracking-tight">
            {isRefreshing
              ? 'Syncing…'
              : justSynced 
              ? 'Data Synced' 
              : connectionStatus === 'connected' 
              ? 'Live Sync' 
              : connectionStatus === 'connecting' 
              ? 'Connecting...' 
              : 'Offline'}
          </span>
        </div>
      )}

      {/* Modern Interactive Refresh Button */}
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={isRefreshing}
        onClick={handleRefresh}
        className={cn(
          "rounded-2xl font-bold tracking-tight transition-all active:scale-95 shadow-xs flex items-center gap-1.5 sm:gap-2 select-none shrink-0",
          size === 'sm' ? "h-9 sm:h-10 px-3 text-xs" : size === 'lg' ? "h-12 sm:h-14 px-5 sm:px-6 text-sm sm:text-base" : "h-10 sm:h-11 md:h-12 px-3.5 sm:px-4 md:px-5 text-xs md:text-sm",
          variant === 'outline' && "bg-white hover:bg-slate-50 border-slate-200 text-slate-800 hover:text-slate-900 shadow-xs",
          isRefreshing && "opacity-80 cursor-not-allowed"
        )}
        title="Fetch latest database state across all users and branches"
      >
        <RefreshCw 
          className={cn(
            "shrink-0 transition-transform duration-500",
            size === 'sm' ? "h-3.5 w-3.5" : "h-4 w-4 md:h-4.5 md:w-4.5",
            isRefreshing && "animate-spin text-indigo-600",
            justSynced && !isRefreshing && "text-emerald-600"
          )} 
        />
        
        <span>{isRefreshing ? refreshingLabel : label}</span>

        {/* Small Timestamp Badge - Only visible on desktop/xl screens to prevent tablet/mobile overflow */}
        {showLastUpdated && lastUpdated && (
          <span className="hidden xl:inline-block text-[10px] font-medium text-slate-400 border-l border-slate-200 pl-2 ml-0.5 tracking-tight">
            {formattedTime}
          </span>
        )}
      </Button>
    </div>
  );
};

export default DashboardRefreshButton;
