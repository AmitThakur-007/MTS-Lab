import React from 'react';

export const OverviewLoadingSkeleton: React.FC = () => {
  return (
    <div id="overview-loading-skeleton" className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="h-6 w-48 bg-gray-200 dark:bg-gray-800 rounded-md" />
            <div className="h-4 w-32 bg-gray-100 dark:bg-gray-800/60 rounded-md" />
          </div>
          <div className="flex gap-2">
            <div className="h-9 w-20 bg-gray-200 dark:bg-gray-800 rounded-md" />
            <div className="h-9 w-28 bg-gray-200 dark:bg-gray-800 rounded-md" />
          </div>
        </div>
      </div>

      {/* Top Stat Cards Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-xl p-5 shadow-xs">
            <div className="flex justify-between items-start mb-3">
              <div className="h-4 w-20 bg-gray-200 dark:bg-gray-800 rounded-md" />
              <div className="h-8 w-8 bg-gray-100 dark:bg-gray-800 rounded-lg" />
            </div>
            <div className="h-7 w-16 bg-gray-200 dark:bg-gray-800 rounded-md mb-2" />
            <div className="h-3 w-28 bg-gray-100 dark:bg-gray-800/60 rounded-md" />
          </div>
        ))}
      </div>

      {/* Main Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-xl p-5 h-72 shadow-xs">
          <div className="h-5 w-40 bg-gray-200 dark:bg-gray-800 rounded-md mb-4" />
          <div className="h-48 w-full bg-gray-100 dark:bg-gray-800/50 rounded-lg" />
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-xl p-5 h-72 shadow-xs">
          <div className="h-5 w-36 bg-gray-200 dark:bg-gray-800 rounded-md mb-4" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map((j) => (
              <div key={j} className="h-8 w-full bg-gray-100 dark:bg-gray-800/40 rounded-md" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
