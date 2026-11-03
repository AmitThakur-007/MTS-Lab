import React from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';

/**
 * Metric Cards Skeleton (6-card grid for Overview)
 */
export const TechnicianMetricCardsSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4 animate-pulse">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between gap-3 shadow-sm min-h-[120px]"
        >
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-800" />
            <div className="h-5 w-16 bg-slate-200 dark:bg-slate-800 rounded-full" />
          </div>
          <div className="space-y-1.5">
            <div className="h-7 w-12 bg-slate-200 dark:bg-slate-800 rounded-md" />
            <div className="h-3 w-24 bg-slate-100 dark:bg-slate-800/60 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Single Repair Card Skeleton matching real Card layout
 */
export const TechnicianRepairCardSkeleton: React.FC = () => {
  return (
    <Card className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden flex flex-col justify-between animate-pulse">
      <CardHeader className="p-4 pb-3 border-b border-slate-100 dark:border-slate-800/80 space-y-2.5 bg-slate-50/50 dark:bg-slate-800/30">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="h-6 w-24 bg-slate-200 dark:bg-slate-800 rounded-lg" />
            <div className="h-5 w-14 bg-slate-200 dark:bg-slate-800 rounded-md" />
            <div className="h-5 w-12 bg-slate-200 dark:bg-slate-800 rounded-full" />
          </div>
          <div className="h-6 w-24 bg-slate-200 dark:bg-slate-800 rounded-full" />
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 space-y-3.5 flex-1 flex flex-col justify-between">
        <div className="space-y-2.5">
          <div className="space-y-1.5">
            <div className="h-5 w-48 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="h-3.5 w-36 bg-slate-100 dark:bg-slate-800/60 rounded" />
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-1.5">
            <div className="h-2.5 w-16 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="h-3.5 w-full bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="h-3.5 w-3/4 bg-slate-200 dark:bg-slate-800 rounded" />
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="space-y-1">
              <div className="h-2.5 w-12 bg-slate-100 dark:bg-slate-800/60 rounded" />
              <div className="h-3.5 w-20 bg-slate-200 dark:bg-slate-800 rounded" />
            </div>
            <div className="space-y-1">
              <div className="h-2.5 w-14 bg-slate-100 dark:bg-slate-800/60 rounded" />
              <div className="h-3.5 w-20 bg-slate-200 dark:bg-slate-800 rounded" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="h-9 flex-1 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          <div className="h-9 w-16 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          <div className="h-9 w-9 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * Repairs Bench Table Skeleton
 */
export const TechnicianTableSkeleton: React.FC = () => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-sm animate-pulse">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
            <tr>
              <th className="py-3 px-4"><div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded" /></th>
              <th className="py-3 px-4"><div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded" /></th>
              <th className="py-3 px-4"><div className="h-3 w-20 bg-slate-200 dark:bg-slate-700 rounded" /></th>
              <th className="py-3 px-4"><div className="h-3 w-28 bg-slate-200 dark:bg-slate-700 rounded" /></th>
              <th className="py-3 px-4"><div className="h-3 w-14 bg-slate-200 dark:bg-slate-700 rounded" /></th>
              <th className="py-3 px-4"><div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded" /></th>
              <th className="py-3 px-4"><div className="h-3 w-18 bg-slate-200 dark:bg-slate-700 rounded" /></th>
              <th className="py-3 px-4 text-right"><div className="h-3 w-16 ml-auto bg-slate-200 dark:bg-slate-700 rounded" /></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <tr key={i} className="hover:bg-slate-50/50">
                <td className="py-4 px-4"><div className="h-4 w-20 bg-slate-200 dark:bg-slate-800 rounded" /></td>
                <td className="py-4 px-4"><div className="h-4 w-28 bg-slate-200 dark:bg-slate-800 rounded" /></td>
                <td className="py-4 px-4"><div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded" /></td>
                <td className="py-4 px-4"><div className="h-4 w-36 bg-slate-200 dark:bg-slate-800 rounded" /></td>
                <td className="py-4 px-4"><div className="h-5 w-14 bg-slate-200 dark:bg-slate-800 rounded-full" /></td>
                <td className="py-4 px-4"><div className="h-5 w-20 bg-slate-200 dark:bg-slate-800 rounded-full" /></td>
                <td className="py-4 px-4"><div className="h-4 w-16 bg-slate-200 dark:bg-slate-800 rounded" /></td>
                <td className="py-4 px-4 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <div className="h-7 w-14 bg-slate-200 dark:bg-slate-800 rounded-lg" />
                    <div className="h-7 w-7 bg-slate-200 dark:bg-slate-800 rounded-lg" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/**
 * Full Technician Overview Skeleton
 */
export const TechnicianOverviewSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto px-2 sm:px-4 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white dark:bg-slate-900 p-5 sm:p-6 md:p-7 rounded-[24px] sm:rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-64 bg-slate-200 dark:bg-slate-800 rounded-lg" />
            <div className="h-6 w-24 bg-slate-200 dark:bg-slate-800 rounded-full" />
          </div>
          <div className="h-4 w-80 bg-slate-100 dark:bg-slate-800/60 rounded" />
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="h-10 w-44 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
          <div className="h-10 w-10 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
          <div className="h-10 w-32 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        </div>
      </div>

      {/* 6-Metric Cards */}
      <TechnicianMetricCardsSkeleton />

      {/* Urgent Action Queue Skeleton */}
      <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-800" />
            <div className="space-y-1">
              <div className="h-5 w-44 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-3.5 w-64 bg-slate-100 dark:bg-slate-800/60 rounded" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex justify-between items-center">
                <div className="h-5 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="h-5 w-14 bg-slate-200 dark:bg-slate-800 rounded-full" />
              </div>
              <div className="h-4 w-36 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-8 w-full bg-slate-100 dark:bg-slate-800/60 rounded-xl" />
              <div className="h-8 w-full bg-slate-200 dark:bg-slate-800 rounded-xl" />
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Grid Skeleton (Performance & Attendance) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 h-72 shadow-sm" />
        <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 h-72 shadow-sm" />
      </div>
    </div>
  );
};

/**
 * Full Technician Repairs Bench Skeleton
 */
export const TechnicianRepairsSkeleton: React.FC<{ viewMode?: 'CARDS' | 'TABLE' }> = ({ viewMode = 'CARDS' }) => {
  return (
    <div className="space-y-6 pb-24 max-w-7xl mx-auto px-2 sm:px-4 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white dark:bg-slate-900 p-5 sm:p-6 md:p-7 rounded-[24px] sm:rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-60 bg-slate-200 dark:bg-slate-800 rounded-lg" />
            <div className="h-6 w-24 bg-slate-200 dark:bg-slate-800 rounded-full" />
          </div>
          <div className="h-4 w-80 bg-slate-100 dark:bg-slate-800/60 rounded" />
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="h-10 w-44 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
          <div className="h-10 w-10 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
        </div>
      </div>

      {/* Date Filter Bar Skeleton */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="h-5 w-48 bg-slate-200 dark:bg-slate-800 rounded" />
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-8 w-20 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          ))}
        </div>
      </div>

      {/* Status Tabs Navigation Skeleton */}
      <div className="bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-2 overflow-x-auto no-scrollbar">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="h-8 w-28 bg-slate-200 dark:bg-slate-800 rounded-xl shrink-0" />
        ))}
      </div>

      {/* Toolbar Skeleton */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          <div className="h-10 flex-1 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
          <div className="flex gap-2">
            <div className="h-10 w-32 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
            <div className="h-10 w-32 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
            <div className="h-10 w-20 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          </div>
        </div>
      </div>

      {/* Grid or Table Skeleton */}
      {viewMode === 'CARDS' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <TechnicianRepairCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <TechnicianTableSkeleton />
      )}
    </div>
  );
};

/**
 * Full Technician Transfers Skeleton
 */
export const TechnicianTransfersSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 pb-24 max-w-7xl mx-auto px-2 sm:px-4 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white dark:bg-slate-900 p-5 sm:p-6 md:p-7 rounded-[24px] sm:rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-56 bg-slate-200 dark:bg-slate-800 rounded-lg" />
            <div className="h-6 w-28 bg-slate-200 dark:bg-slate-800 rounded-full" />
          </div>
          <div className="h-4 w-80 bg-slate-100 dark:bg-slate-800/60 rounded" />
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="h-10 w-44 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
          <div className="h-10 w-36 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        </div>
      </div>

      {/* 4 Transfer Stats Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3 min-h-[110px]">
            <div className="flex justify-between items-center">
              <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-800" />
              <div className="h-5 w-16 bg-slate-200 dark:bg-slate-800 rounded-full" />
            </div>
            <div className="space-y-1">
              <div className="h-6 w-10 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-3 w-24 bg-slate-100 dark:bg-slate-800/60 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Tabs and Search Toolbar Skeleton */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            <div className="h-9 w-36 bg-slate-200 dark:bg-slate-800 rounded-xl" />
            <div className="h-9 w-36 bg-slate-200 dark:bg-slate-800 rounded-xl" />
            <div className="h-9 w-36 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          </div>
          <div className="h-9 w-48 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        </div>
      </div>

      {/* 3 Transfer Cards Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3.5">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="h-5 w-24 bg-slate-200 dark:bg-slate-800 rounded-lg" />
              <div className="h-5 w-16 bg-slate-200 dark:bg-slate-800 rounded-full" />
            </div>
            <div className="space-y-2">
              <div className="h-3.5 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-12 w-full bg-slate-100 dark:bg-slate-800/60 rounded-xl" />
              <div className="h-3 w-28 bg-slate-100 dark:bg-slate-800/60 rounded" />
            </div>
            <div className="h-9 w-full bg-slate-200 dark:bg-slate-800 rounded-xl pt-2" />
          </Card>
        ))}
      </div>
    </div>
  );
};
