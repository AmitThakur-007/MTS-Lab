import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface OverviewErrorStateProps {
  error: string;
  onRetry: () => void;
}

export const OverviewErrorState: React.FC<OverviewErrorStateProps> = ({ error, onRetry }) => {
  return (
    <div id="overview-error-state" className="bg-white dark:bg-gray-900 border border-rose-200 dark:border-rose-900/50 rounded-xl p-8 text-center max-w-xl mx-auto shadow-xs my-8">
      <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-4">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-1.5">
        Failed to load overview data
      </h2>
      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-5">
        {error || 'An unexpected connection or database error occurred while fetching system statistics.'}
      </p>
      <Button onClick={onRetry} variant="default" className="bg-primary hover:bg-primary/90 text-xs px-4 h-9">
        <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
        <span>Retry Sync</span>
      </Button>
    </div>
  );
};
