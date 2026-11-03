import React from 'react';
import {
  Flame,
  Zap,
  Clock,
  ShieldCheck,
  Smartphone,
  Tablet,
  Laptop,
  Tv,
  HelpCircle,
  LucideIcon
} from 'lucide-react';

export type DeviceCategory = 'ALL' | 'IPHONE' | 'SMARTPHONE' | 'IPAD' | 'TABLET' | 'LAPTOP' | 'TV';

export interface DeviceCategoryOption {
  key: DeviceCategory;
  label: string;
  icon: LucideIcon;
  badgeClass: string;
}

export const DEVICE_CATEGORIES: DeviceCategoryOption[] = [
  { key: 'ALL', label: 'All Devices', icon: HelpCircle, badgeClass: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200' },
  { key: 'IPHONE', label: 'iPhones', icon: Smartphone, badgeClass: 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300' },
  { key: 'SMARTPHONE', label: 'Smartphones', icon: Smartphone, badgeClass: 'bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300' },
  { key: 'IPAD', label: 'iPads', icon: Tablet, badgeClass: 'bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300' },
  { key: 'TABLET', label: 'Tablets', icon: Tablet, badgeClass: 'bg-violet-100 dark:bg-violet-950/80 text-violet-800 dark:text-violet-300' },
  { key: 'LAPTOP', label: 'Laptops', icon: Laptop, badgeClass: 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300' },
  { key: 'TV', label: 'Smart TVs', icon: Tv, badgeClass: 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300' },
];

/**
 * Detects device category from brand, model, and category fields
 */
export function detectDeviceCategory(repair: {
  deviceBrand?: string;
  deviceModel?: string;
  deviceType?: string;
  category?: string;
}): 'IPHONE' | 'SMARTPHONE' | 'IPAD' | 'TABLET' | 'LAPTOP' | 'TV' {
  const brand = (repair.deviceBrand || '').toLowerCase();
  const model = (repair.deviceModel || '').toLowerCase();
  const type = (repair.deviceType || repair.category || '').toLowerCase();

  // TV Check
  if (
    type.includes('tv') ||
    model.includes('tv') ||
    model.includes('television') ||
    model.includes('bravia') ||
    model.includes('oled') ||
    model.includes('qled') ||
    model.includes('smart tv') ||
    model.includes('led')
  ) {
    return 'TV';
  }

  // Laptop Check
  if (
    type.includes('laptop') ||
    model.includes('macbook') ||
    model.includes('laptop') ||
    model.includes('thinkpad') ||
    model.includes('notebook') ||
    model.includes('zenbook') ||
    model.includes('pavilion') ||
    model.includes('ideapad') ||
    model.includes('dell xps')
  ) {
    return 'LAPTOP';
  }

  // iPad Check
  if (model.includes('ipad') || type.includes('ipad')) {
    return 'IPAD';
  }

  // Tablet Check
  if (
    type.includes('tablet') ||
    model.includes('tab') ||
    model.includes('galaxy tab') ||
    model.includes('pad')
  ) {
    return 'TABLET';
  }

  // iPhone Check
  if (brand.includes('apple') || model.includes('iphone')) {
    return 'IPHONE';
  }

  // Default Smartphone
  return 'SMARTPHONE';
}

export function getPriorityMeta(repair: any) {
  const priority = (repair.priority || '').toUpperCase();
  const isUrgentFlag = repair.isUrgent === true;

  if (priority === 'URGENT' || isUrgentFlag) {
    return {
      tier: 'URGENT' as const,
      label: 'Urgent',
      badgeClass: 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-200 border border-rose-400 dark:border-rose-700 font-extrabold shadow-xs',
      cardBorder: 'border-rose-300 dark:border-rose-800 ring-2 ring-rose-400/30 dark:ring-rose-400/40 shadow-sm',
      headerBg: 'bg-rose-50/80 dark:bg-rose-950/40',
      icon: Flame,
      iconColor: 'text-rose-600 dark:text-rose-400',
      tagColor: 'text-rose-800 dark:text-rose-300',
      indicatorText: '🔴 Urgent'
    };
  }

  switch (priority) {
    case 'HIGH':
      return {
        tier: 'HIGH' as const,
        label: 'High',
        badgeClass: 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border border-amber-400 dark:border-amber-700 font-bold shadow-xs',
        cardBorder: 'border-amber-300 dark:border-amber-800 ring-1 ring-amber-400/20 dark:ring-amber-400/30 shadow-sm',
        headerBg: 'bg-amber-50/60 dark:bg-amber-950/30',
        icon: Zap,
        iconColor: 'text-amber-600 dark:text-amber-400',
        tagColor: 'text-amber-800 dark:text-amber-300',
        indicatorText: '🟠 High'
      };
    case 'MEDIUM':
      return {
        tier: 'MEDIUM' as const,
        label: 'Medium',
        badgeClass: 'bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-200 border border-sky-300 dark:border-sky-700 font-semibold shadow-xs',
        cardBorder: 'border-sky-200 dark:border-sky-800 shadow-xs',
        headerBg: 'bg-sky-50/40 dark:bg-sky-950/20',
        icon: Clock,
        iconColor: 'text-sky-600 dark:text-sky-400',
        tagColor: 'text-sky-700 dark:text-sky-300',
        indicatorText: '🟡 Medium'
      };
    default:
      return {
        tier: 'NORMAL' as const,
        label: 'Normal',
        badgeClass: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 font-medium',
        cardBorder: 'border-slate-200/90 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700',
        headerBg: 'bg-transparent',
        icon: ShieldCheck,
        iconColor: 'text-slate-500 dark:text-slate-400',
        tagColor: 'text-slate-600 dark:text-slate-400',
        indicatorText: '⚪ Normal'
      };
  }
}

export const STATUS_STYLES: Record<string, { label: string; badge: string }> = {
  PENDING: { label: 'Pending Intake', badge: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700' },
  DIAGNOSING: { label: 'Diagnosing', badge: 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800' },
  IN_PROCESS: { label: 'In Progress', badge: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800' },
  IN_PROGRESS: { label: 'In Progress', badge: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800' },
  WAITING_FOR_PARTS: { label: 'Waiting for Parts', badge: 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
  TESTING: { label: 'Testing / QA', badge: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800' },
  REPAIRED: { label: 'Repaired', badge: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' },
  REPROBLEM_FIXED: { label: 'Re-problem Fixed', badge: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' },
  CANNOT_REPAIR: { label: 'Cannot Repair', badge: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800' },
  READY_FOR_PICKUP: { label: 'Ready for Pickup', badge: 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800' },
  DELIVERED: { label: 'Delivered', badge: 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800' },
  CANCELLED: { label: 'Cancelled', badge: 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-300' }
};

export const TECHNICIAN_ALLOWED_STATUSES = [
  { value: 'PENDING', label: 'Pending Intake', desc: 'Device in intake queue awaiting initial technical inspection' },
  { value: 'DIAGNOSING', label: 'Diagnosing', desc: 'Currently performing hardware multimeter & software diagnostic tests' },
  { value: 'IN_PROCESS', label: 'In Progress (Bench Active)', desc: 'Active hardware repair, screen replacement, or logic board work' },
  { value: 'WAITING_FOR_PARTS', label: 'Waiting for Parts', desc: 'Paused pending arrival of specialized replacement component' },
  { value: 'TESTING', label: 'Testing / Quality Assurance', desc: 'Repair completed, running functional and stress tests' },
  { value: 'REPAIRED', label: 'Repaired (Bench Complete)', desc: 'Successfully repaired, ready for front desk pickup QA' },
  { value: 'REPROBLEM_FIXED', label: 'Re-problem Fixed', desc: 'Warranty re-service successfully resolved and tested' },
  { value: 'CANNOT_REPAIR', label: 'Cannot Repair (BER)', desc: 'Beyond economic or physical repair (e.g. unfixable SoC/board fracture)' }
];
