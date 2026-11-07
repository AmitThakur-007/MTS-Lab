import React from 'react';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  onBack?: () => void;
  className?: string;
  isRetrying?: boolean;
  compact?: boolean;
}

export function ErrorState({
  title = 'Failed to load information',
  message = 'An unexpected network or server error occurred while retrieving this data.',
  onRetry,
  onBack,
  className,
  isRetrying = false,
  compact = false,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'w-full flex flex-col items-center justify-center text-center rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20 transition-colors',
        compact ? 'p-6 sm:p-8' : 'p-10 sm:p-14',
        className
      )}
    >
      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-rose-100 dark:bg-rose-900/40 border border-rose-200 dark:border-rose-800 flex items-center justify-center text-rose-600 dark:text-rose-400 mb-4 shadow-2xs">
        <AlertTriangle className="w-6 h-6 sm:w-7 sm:h-7 stroke-[1.75]" />
      </div>

      <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight mb-1.5">
        {title}
      </h3>

      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-md mb-6 leading-relaxed">
        {message}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {onRetry && (
          <Button
            onClick={onRetry}
            disabled={isRetrying}
            className="rounded-xl px-4 py-2 text-xs sm:text-sm font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm cursor-pointer whitespace-nowrap shrink-0"
          >
            <RefreshCw className={cn('w-4 h-4 mr-1.5', isRetrying && 'animate-spin')} />
            {isRetrying ? 'Retrying...' : 'Retry Request'}
          </Button>
        )}

        {onBack && (
          <Button
            variant="outline"
            onClick={onBack}
            className="rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Go Back
          </Button>
        )}
      </div>
    </div>
  );
}
