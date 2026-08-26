import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { realtimeService } from '@/services/realtime';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export interface DashboardRefreshButtonProps {
  onRefresh?: () => Promise<any> | void;
  isRefreshing?: boolean;
  lastUpdated?: Date | null;
  showLastUpdated?: boolean;
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
  showLastUpdated = false,
  size = 'default',
  variant = 'outline',
  className,
  label = 'Refresh',
  refreshingLabel = 'Refreshing...'
}) => {
  const [internalRefreshing, setInternalRefreshing] = useState(false);
  const [internalLastUpdated, setInternalLastUpdated] = useState<Date>(new Date());

  const isRefreshing = externalIsRefreshing !== undefined ? externalIsRefreshing : internalRefreshing;
  const lastUpdated = externalLastUpdated !== undefined ? externalLastUpdated : internalLastUpdated;

  const handleRefresh = async () => {
    if (isRefreshing) return;

    if (onRefresh) {
      setInternalRefreshing(true);
      try {
        await Promise.resolve(onRefresh());
        setInternalLastUpdated(new Date());
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
      }, 500);
    }
  };

  const formattedTime = lastUpdated 
    ? format(lastUpdated, 'HH:mm:ss')
    : format(new Date(), 'HH:mm:ss');

  return (
    <div className={cn("inline-flex items-center gap-1.5 sm:gap-2 max-w-full shrink-0", className)}>
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
        title="Refresh data"
      >
        <RefreshCw 
          className={cn(
            "shrink-0 transition-transform duration-500",
            size === 'sm' ? "h-3.5 w-3.5" : "h-4 w-4 md:h-4.5 md:w-4.5",
            isRefreshing && "animate-spin text-indigo-600"
          )} 
        />
        
        <span>{isRefreshing ? refreshingLabel : label}</span>

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
