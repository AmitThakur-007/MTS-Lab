import React from 'react';
import { cn } from '@/lib/utils';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  shimmer?: boolean;
}

export function Skeleton({ className, shimmer = true, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        'rounded-md bg-slate-200/80 dark:bg-slate-800/80 transition-colors',
        shimmer ? 'animate-pulse' : '',
        className
      )}
      {...props}
    />
  );
}

export default Skeleton;
