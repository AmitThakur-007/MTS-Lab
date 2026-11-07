import React from 'react';
import { Badge } from '@/components/ui/badge';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Briefcase, 
  Wrench, 
  UserCheck, 
  BarChart3, 
  Package, 
  User,
  LucideIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface RoleTierInfo {
  tierNumber: number;
  tierName: string;
  roleLabel: string;
  badgeClass: string;
  dotClass: string;
  icon: LucideIcon;
  description: string;
}

export function getRoleTierDetails(role?: string): RoleTierInfo {
  const r = (role || '').toUpperCase();
  switch (r) {
    case 'SUPER_ADMIN':
      return {
        tierNumber: 1,
        tierName: 'Tier 1 • Executive',
        roleLabel: 'Super Admin',
        badgeClass: 'bg-slate-900 text-white border-slate-700 dark:bg-slate-100 dark:text-slate-900',
        dotClass: 'bg-emerald-400',
        icon: ShieldAlert,
        description: 'Complete platform governance, database & system audit authority',
      };
    case 'ADMIN':
      return {
        tierNumber: 2,
        tierName: 'Tier 2 • Administration',
        roleLabel: 'Admin',
        badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800',
        dotClass: 'bg-indigo-500',
        icon: ShieldCheck,
        description: 'Operations management, staff oversight and communications command',
      };
    case 'MANAGER':
      return {
        tierNumber: 2,
        tierName: 'Tier 2 • Operations',
        roleLabel: 'Manager',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
        dotClass: 'bg-amber-500',
        icon: Briefcase,
        description: 'Workshop workflow, technician allocation and revenue control',
      };
    case 'HEAD_TECHNICIAN':
      return {
        tierNumber: 3,
        tierName: 'Tier 3 • Technical Lead',
        roleLabel: 'Head Technician',
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
        dotClass: 'bg-blue-500',
        icon: Wrench,
        description: 'Master bench diagnostics, quality assurance and work transfers',
      };
    case 'LEAD_TECHNICIAN':
      return {
        tierNumber: 3,
        tierName: 'Tier 3 • Senior Bench',
        roleLabel: 'Lead Technician',
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
        dotClass: 'bg-blue-500',
        icon: Wrench,
        description: 'Advanced device repairs, diagnostic bench and revenue insight',
      };
    case 'TECHNICIAN':
    case 'TECHNICAL_ASSISTANT':
      return {
        tierNumber: 4,
        tierName: 'Tier 4 • Diagnostic Bench',
        roleLabel: 'Technician',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
        dotClass: 'bg-emerald-500',
        icon: Wrench,
        description: 'Device repairs, parts consumption and status execution',
      };
    case 'RECEPTIONIST':
      return {
        tierNumber: 5,
        tierName: 'Tier 5 • Front Desk',
        roleLabel: 'Receptionist',
        badgeClass: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800',
        dotClass: 'bg-teal-500',
        icon: UserCheck,
        description: 'Customer intake, repair onboarding, SMS dispatch and dispatch tracking',
      };
    case 'ACCOUNTANT':
      return {
        tierNumber: 6,
        tierName: 'Tier 6 • Finance Specialist',
        roleLabel: 'Accountant',
        badgeClass: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800',
        dotClass: 'bg-cyan-500',
        icon: BarChart3,
        description: 'Financial ledger, payment reconciliation and revenue audit',
      };
    case 'INVENTORY_MANAGER':
      return {
        tierNumber: 6,
        tierName: 'Tier 6 • Stock Specialist',
        roleLabel: 'Inventory Manager',
        badgeClass: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800',
        dotClass: 'bg-violet-500',
        icon: Package,
        description: 'Parts inventory, catalog stock and procurement tracking',
      };
    default:
      return {
        tierNumber: 7,
        tierName: 'Staff Member',
        roleLabel: (role || 'Staff').replace(/_/g, ' '),
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
        dotClass: 'bg-slate-400',
        icon: User,
        description: 'Authenticated staff member',
      };
  }
}

export function RoleTierBadge({
  role,
  showTierNumber = true,
  className,
}: {
  role?: string;
  showTierNumber?: boolean;
  className?: string;
}) {
  const info = getRoleTierDetails(role);
  const Icon = info.icon;

  return (
    <div className={cn('inline-flex items-center gap-1.5', className)}>
      <Badge
        variant="outline"
        className={cn(
          'text-[11px] font-bold px-2 py-0.5 rounded-lg border flex items-center gap-1.5 shrink-0 select-none',
          info.badgeClass
        )}
        title={info.description}
      >
        <Icon className="w-3 h-3 shrink-0" />
        <span>{info.roleLabel}</span>
      </Badge>
      {showTierNumber && (
        <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 whitespace-nowrap">
          T{info.tierNumber}
        </span>
      )}
    </div>
  );
}
