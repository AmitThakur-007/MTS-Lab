import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface OverviewStatCardProps {
  id?: string;
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  colorScheme?: 'blue' | 'purple' | 'amber' | 'emerald' | 'rose' | 'indigo' | 'cyan' | 'teal' | 'gray';
  badgeText?: string;
  badgeVariant?: 'default' | 'outline' | 'secondary' | 'destructive';
  onClick?: () => void;
  isLoading?: boolean;
}

export const OverviewStatCard: React.FC<OverviewStatCardProps> = ({
  id,
  title,
  value,
  subtitle,
  icon: Icon,
  colorScheme = 'blue',
  badgeText,
  badgeVariant = 'secondary',
  onClick,
  isLoading = false,
}) => {
  const getColorStyles = () => {
    switch (colorScheme) {
      case 'purple':
        return {
          iconBg: 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400',
          borderHover: 'hover:border-purple-300 dark:hover:border-purple-800',
          accent: 'text-purple-600 dark:text-purple-400',
        };
      case 'amber':
        return {
          iconBg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400',
          borderHover: 'hover:border-amber-300 dark:hover:border-amber-800',
          accent: 'text-amber-600 dark:text-amber-400',
        };
      case 'emerald':
        return {
          iconBg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400',
          borderHover: 'hover:border-emerald-300 dark:hover:border-emerald-800',
          accent: 'text-emerald-600 dark:text-emerald-400',
        };
      case 'rose':
        return {
          iconBg: 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400',
          borderHover: 'hover:border-rose-300 dark:hover:border-rose-800',
          accent: 'text-rose-600 dark:text-rose-400',
        };
      case 'indigo':
        return {
          iconBg: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400',
          borderHover: 'hover:border-indigo-300 dark:hover:border-indigo-800',
          accent: 'text-indigo-600 dark:text-indigo-400',
        };
      case 'cyan':
        return {
          iconBg: 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400',
          borderHover: 'hover:border-cyan-300 dark:hover:border-cyan-800',
          accent: 'text-cyan-600 dark:text-cyan-400',
        };
      case 'teal':
        return {
          iconBg: 'bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400',
          borderHover: 'hover:border-teal-300 dark:hover:border-teal-800',
          accent: 'text-teal-600 dark:text-teal-400',
        };
      case 'gray':
        return {
          iconBg: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
          borderHover: 'hover:border-gray-300 dark:hover:border-gray-700',
          accent: 'text-gray-600 dark:text-gray-400',
        };
      case 'blue':
      default:
        return {
          iconBg: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400',
          borderHover: 'hover:border-blue-300 dark:hover:border-blue-800',
          accent: 'text-blue-600 dark:text-blue-400',
        };
    }
  };

  const styles = getColorStyles();

  return (
    <div
      id={id}
      onClick={onClick}
      className={`relative bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-xl p-4 sm:p-5 transition-all duration-150 ${
        onClick ? `cursor-pointer hover:shadow-xs ${styles.borderHover}` : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <span className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 leading-tight">
          {title}
        </span>
        <div className={`p-2 rounded-lg shrink-0 ${styles.iconBg}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white truncate">
            {isLoading ? <div className="h-7 w-16 bg-gray-200 dark:bg-gray-800 animate-pulse rounded-md" /> : value}
          </div>
          {subtitle && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
              {subtitle}
            </p>
          )}
        </div>

        {badgeText && !isLoading && (
          <Badge variant={badgeVariant} className="text-[11px] font-medium shrink-0 px-2 py-0.5 whitespace-nowrap">
            {badgeText}
          </Badge>
        )}
      </div>
    </div>
  );
};
