import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface StatCardSkeletonProps {
  className?: string;
  count?: number;
}

/**
 * KPI Stat Card Skeleton
 */
export function StatCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn('bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs', className)}>
      <CardContent className="p-3.5 sm:p-4 space-y-2">
        <Skeleton className="h-3 w-24 bg-slate-200 dark:bg-slate-800" />
        <Skeleton className="h-7 w-16 bg-slate-300 dark:bg-slate-700 mt-1" />
        <div className="flex items-center gap-1.5 pt-1">
          <Skeleton className="h-3 w-3 rounded-full bg-slate-200 dark:bg-slate-800" />
          <Skeleton className="h-2.5 w-20 bg-slate-200 dark:bg-slate-800" />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * High-density 6/7 KPI Grid Skeleton matching SMS Center & Dashboard headers
 */
export function SmsKpiCardsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className={cn(
      "grid gap-3 sm:gap-4",
      count === 7 
        ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-7"
        : "grid-cols-2 md:grid-cols-3 lg:grid-cols-6"
    )}>
      {Array.from({ length: count }).map((_, i) => (
        <Card 
          key={i} 
          className={cn(
            "border shadow-xs",
            i === 0 
              ? "bg-slate-900/60 dark:bg-slate-900 border-slate-800 text-white" 
              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
          )}
        >
          <CardContent className="p-3.5 sm:p-4 space-y-2">
            <Skeleton className={cn("h-2.5 w-20", i === 0 ? "bg-slate-700" : "bg-slate-200 dark:bg-slate-800")} />
            <Skeleton className={cn("h-7 sm:h-8 w-14 my-1", i === 0 ? "bg-slate-600" : "bg-slate-300 dark:bg-slate-700")} />
            <div className="flex items-center gap-1.5 pt-0.5">
              <Skeleton className={cn("h-3 w-3 rounded-full", i === 0 ? "bg-slate-700" : "bg-slate-200 dark:bg-slate-800")} />
              <Skeleton className={cn("h-2 w-16", i === 0 ? "bg-slate-700" : "bg-slate-200 dark:bg-slate-800")} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * Generic Table Skeleton with header and configurable rows/columns
 */
export function TableSkeleton({
  rows = 5,
  columns = 5,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div className={cn('w-full border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-xs', className)}>
      <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="p-3.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
              <div className="space-y-1.5 flex-1 max-w-sm">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-2.5 w-1/2" />
              </div>
            </div>
            {Array.from({ length: columns - 1 }).map((_, colIndex) => (
              <Skeleton
                key={colIndex}
                className={cn(
                  'h-4 hidden sm:block',
                  colIndex === 0 ? 'w-24' : colIndex === 1 ? 'w-16' : 'w-20'
                )}
              />
            ))}
            <Skeleton className="h-8 w-20 rounded-lg shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Filter Bar Skeleton
 */
export function FilterBarSkeleton() {
  return (
    <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-xs">
      <div className="flex items-center gap-2 flex-wrap">
        <Skeleton className="h-4 w-12 mr-1" />
        <Skeleton className="h-7 w-16 rounded-md" />
        <Skeleton className="h-7 w-20 rounded-md" />
        <Skeleton className="h-7 w-20 rounded-md" />
        <Skeleton className="h-7 w-24 rounded-md" />
        <Skeleton className="h-7 w-16 rounded-md" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-44 rounded-lg" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
    </div>
  );
}

/**
 * Chart or Graph Card Skeleton
 */
export function ChartSkeleton({ height = 'h-64' }: { height?: string }) {
  return (
    <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-20" />
        </div>
        <div className={cn("w-full flex items-end gap-3 pt-6 pb-2", height)}>
          {[40, 65, 30, 85, 55, 90, 45, 70, 60, 80, 50, 95].map((val, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
              <Skeleton 
                className="w-full rounded-t-sm" 
                style={{ height: `${val}%` }} 
              />
              <Skeleton className="h-2 w-3 rounded-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Full page or section placeholder state
 */
export function SectionLoadingSkeleton({ title = 'Loading...' }: { title?: string }) {
  return (
    <div className="space-y-6 animate-pulse p-1">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-3.5 w-72" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
      </div>
      <SmsKpiCardsSkeleton count={6} />
      <FilterBarSkeleton />
      <TableSkeleton rows={6} columns={6} />
    </div>
  );
}

/**
 * Grid of Repair Card Skeletons
 */
export function RepairCardsGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <CardContent className="p-4 space-y-3">
            <div className="flex justify-between items-start">
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-36" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-3 w-3/5" />
            </div>
            <div className="flex items-center justify-between pt-2">
              <Skeleton className="h-6 w-20 rounded-lg" />
              <Skeleton className="h-6 w-16 rounded-lg" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * Form Input Fields Skeleton
 */
export function FormSkeleton({ fields = 6 }: { fields?: number }) {
  return (
    <div className="space-y-5 p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
      <Skeleton className="h-5 w-48 mb-2" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
        <Skeleton className="h-9 w-20 rounded-xl" />
        <Skeleton className="h-9 w-28 rounded-xl" />
      </div>
    </div>
  );
}

/**
 * Customer Profile Header & Details Skeleton
 */
export function CustomerProfileSkeleton() {
  return (
    <div className="space-y-6">
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Skeleton className="w-16 h-16 rounded-2xl" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-3.5 w-32" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-xl" />
          <Skeleton className="h-9 w-28 rounded-xl" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
      <TableSkeleton rows={5} columns={5} />
    </div>
  );
}

/**
 * Public Website Service / Catalog Cards Skeleton
 */
export function PublicServicesSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <Skeleton className="w-12 h-12 rounded-2xl" />
          <Skeleton className="h-5 w-40" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
          <div className="pt-2 flex justify-between items-center">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-4 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

