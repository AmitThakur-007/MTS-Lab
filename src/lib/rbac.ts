/**
 * MTS Lab Repair Management System — Centralized RBAC System
 * Exactly 6 Active Staff Roles:
 * 1. SUPERADMIN
 * 2. ADMIN
 * 3. MANAGER
 * 4. HEAD_TECHNICIAN
 * 5. TECHNICIAN
 * 6. RECEPTIONIST
 */

export type StaffRole =
  | 'SUPERADMIN'
  | 'ADMIN'
  | 'MANAGER'
  | 'HEAD_TECHNICIAN'
  | 'TECHNICIAN'
  | 'RECEPTIONIST';

export type Permission =
  // User & Staff Management
  | 'users.view'
  | 'users.create'
  | 'users.edit'
  | 'users.delete'
  | 'users.role.change'

  // Customer Hub
  | 'customers.view'
  | 'customers.create'
  | 'customers.edit'
  | 'customers.delete'
  | 'customers.history.view'

  // Repairs & Workshop Management
  | 'repairs.view'
  | 'repairs.create'
  | 'repairs.edit'
  | 'repairs.update'
  | 'repairs.delete'
  | 'repairs.priority.update'

  // Repair Assignment & Transfer
  | 'repairs.assign.direct'
  | 'repairs.transfer.request'
  | 'repairs.transfer.accept'
  | 'repairs.transfer.reject'
  | 'repairs.transfer.cancel'
  | 'repairs.transfer.history.view'

  // Inventory & Stock
  | 'inventory.view'
  | 'inventory.create'
  | 'inventory.edit'
  | 'inventory.update'
  | 'inventory.delete'
  | 'inventory.transaction.create'

  // Courier Logistics Hub
  | 'courier.view'
  | 'courier.create'
  | 'courier.edit'
  | 'courier.update'
  | 'courier.delete'

  // Battery Warranty Hub
  | 'batteryWarranty.view'
  | 'batteryWarranty.create'
  | 'batteryWarranty.edit'
  | 'batteryWarranty.update'
  | 'batteryWarranty.delete'

  // Attendance Management
  | 'attendance.view'
  | 'attendance.create'
  | 'attendance.edit'
  | 'attendance.update'
  | 'attendance.delete'

  // Damage Records
  | 'damageRecords.view'
  | 'damageRecords.create'
  | 'damageRecords.edit'
  | 'damageRecords.update'
  | 'damageRecords.delete'

  // Services & Repair Prices
  | 'services.view'
  | 'services.create'
  | 'services.edit'
  | 'services.update'
  | 'services.delete'

  // Financial Revenue Hub
  | 'revenue.view'
  | 'revenue.create'
  | 'revenue.edit'
  | 'revenue.update'
  | 'revenue.delete'
  | 'revenue.export'

  // Notifications
  | 'notifications.view'
  | 'notifications.create'
  | 'notifications.update'
  | 'notifications.delete'

  // System & Auditing
  | 'auditLogs.view'
  | 'system.settings';

// Centralized Role Permissions Matrix
export const ROLE_PERMISSIONS: Record<StaffRole, readonly Permission[]> = {
  SUPERADMIN: [
    'users.view', 'users.create', 'users.edit', 'users.delete', 'users.role.change',
    'customers.view', 'customers.create', 'customers.edit', 'customers.delete', 'customers.history.view',
    'repairs.view', 'repairs.create', 'repairs.edit', 'repairs.update', 'repairs.delete', 'repairs.priority.update',
    'repairs.assign.direct', 'repairs.transfer.request', 'repairs.transfer.accept', 'repairs.transfer.reject', 'repairs.transfer.cancel', 'repairs.transfer.history.view',
    'inventory.view', 'inventory.create', 'inventory.edit', 'inventory.update', 'inventory.delete', 'inventory.transaction.create',
    'courier.view', 'courier.create', 'courier.edit', 'courier.update', 'courier.delete',
    'batteryWarranty.view', 'batteryWarranty.create', 'batteryWarranty.edit', 'batteryWarranty.update', 'batteryWarranty.delete',
    'attendance.view', 'attendance.create', 'attendance.edit', 'attendance.update', 'attendance.delete',
    'damageRecords.view', 'damageRecords.create', 'damageRecords.edit', 'damageRecords.update', 'damageRecords.delete',
    'services.view', 'services.create', 'services.edit', 'services.update', 'services.delete',
    'revenue.view', 'revenue.create', 'revenue.edit', 'revenue.update', 'revenue.delete', 'revenue.export',
    'notifications.view', 'notifications.create', 'notifications.update', 'notifications.delete',
    'auditLogs.view', 'system.settings'
  ],

  ADMIN: [
    'users.view', 'users.create', 'users.edit',
    'customers.view', 'customers.create', 'customers.edit', 'customers.delete', 'customers.history.view',
    'repairs.view', 'repairs.create', 'repairs.edit', 'repairs.update', 'repairs.delete', 'repairs.priority.update',
    'repairs.assign.direct', 'repairs.transfer.request', 'repairs.transfer.accept', 'repairs.transfer.reject', 'repairs.transfer.cancel', 'repairs.transfer.history.view',
    'inventory.view', 'inventory.create', 'inventory.edit', 'inventory.update', 'inventory.delete', 'inventory.transaction.create',
    'courier.view', 'courier.create', 'courier.edit', 'courier.update', 'courier.delete',
    'batteryWarranty.view', 'batteryWarranty.create', 'batteryWarranty.edit', 'batteryWarranty.update', 'batteryWarranty.delete',
    'attendance.view', 'attendance.create', 'attendance.edit', 'attendance.update', 'attendance.delete',
    'damageRecords.view', 'damageRecords.create', 'damageRecords.edit', 'damageRecords.update', 'damageRecords.delete',
    'services.view', 'services.create', 'services.edit', 'services.update', 'services.delete',
    'revenue.view', 'revenue.create', 'revenue.edit', 'revenue.update', 'revenue.export',
    'notifications.view', 'notifications.create', 'notifications.update', 'notifications.delete',
    'auditLogs.view'
  ],

  MANAGER: [
    'users.view',
    'customers.view', 'customers.create', 'customers.edit', 'customers.history.view',
    'repairs.view', 'repairs.create', 'repairs.edit', 'repairs.update', 'repairs.priority.update',
    'repairs.assign.direct', 'repairs.transfer.request', 'repairs.transfer.accept', 'repairs.transfer.reject', 'repairs.transfer.cancel', 'repairs.transfer.history.view',
    'inventory.view', 'inventory.create', 'inventory.transaction.create',
    'courier.view', 'courier.create', 'courier.edit', 'courier.update',
    'batteryWarranty.view', 'batteryWarranty.create', 'batteryWarranty.edit', 'batteryWarranty.update',
    'attendance.view', 'attendance.create', 'attendance.edit',
    'damageRecords.view', 'damageRecords.create',
    'services.view',
    'revenue.view', 'revenue.export',
    'notifications.view', 'notifications.create', 'notifications.update'
  ],

  HEAD_TECHNICIAN: [
    'customers.view', 'customers.history.view',
    'repairs.view', 'repairs.update', 'repairs.priority.update',
    'repairs.assign.direct', 'repairs.transfer.request', 'repairs.transfer.accept', 'repairs.transfer.reject', 'repairs.transfer.cancel', 'repairs.transfer.history.view',
    'inventory.view', 'inventory.transaction.create',
    'batteryWarranty.view', 'batteryWarranty.create', 'batteryWarranty.update',
    'attendance.view', 'attendance.create',
    'damageRecords.view', 'damageRecords.create',
    'services.view',
    'notifications.view', 'notifications.create', 'notifications.update'
  ],

  TECHNICIAN: [
    'customers.view',
    'repairs.view', 'repairs.update',
    'repairs.transfer.request', 'repairs.transfer.accept', 'repairs.transfer.reject', 'repairs.transfer.cancel', 'repairs.transfer.history.view',
    'inventory.view',
    'batteryWarranty.view',
    'attendance.view', 'attendance.create',
    'damageRecords.view', 'damageRecords.create',
    'services.view',
    'notifications.view'
  ],

  RECEPTIONIST: [
    'customers.view', 'customers.create', 'customers.edit', 'customers.history.view',
    'repairs.view', 'repairs.create', 'repairs.edit', 'repairs.update',
    'courier.view', 'courier.create', 'courier.edit', 'courier.update',
    'batteryWarranty.view', 'batteryWarranty.create', 'batteryWarranty.edit', 'batteryWarranty.update',
    'attendance.view', 'attendance.create',
    'services.view',
    'notifications.view', 'notifications.create'
  ]
};

/**
 * Safely normalizes and maps any role string to one of the 6 canonical staff roles.
 * Returns null if the role is invalid or obsolete.
 */
export function normalizeRole(role: string | undefined | null): StaffRole | null {
  if (!role || typeof role !== 'string') return null;

  const clean = role.trim().toUpperCase().replace(/[\s-]+/g, '_');

  switch (clean) {
    case 'SUPERADMIN':
    case 'SUPER_ADMIN':
    case 'OWNER':
    case 'DIRECTOR':
      return 'SUPERADMIN';

    case 'ADMIN':
      return 'ADMIN';

    case 'MANAGER':
      return 'MANAGER';

    case 'HEAD_TECHNICIAN':
    case 'HEADTECHNICIAN':
    case 'LEAD_TECHNICIAN':
    case 'LEADTECHNICIAN':
    case 'CHIEF_TECHNICIAN':
      return 'HEAD_TECHNICIAN';

    case 'TECHNICIAN':
    case 'TECH':
    case 'TECHNICAL_ASSISTANT':
    case 'STAFF':
    case 'EMPLOYEE':
      return 'TECHNICIAN';

    case 'RECEPTIONIST':
    case 'FRONT_DESK':
    case 'COUNTER':
      return 'RECEPTIONIST';

    default:
      return null;
  }
}

/**
 * Check if a role has an explicit permission.
 */
export function hasPermission(role: string | undefined | null, permission: Permission): boolean {
  const norm = normalizeRole(role);
  if (!norm) return false;
  return ROLE_PERMISSIONS[norm]?.includes(permission) ?? false;
}

/**
 * Checks if a user role has authority to directly assign repairs to technicians.
 * (SUPERADMIN, ADMIN, MANAGER, HEAD_TECHNICIAN)
 */
export function canAssignDirectly(role: string | undefined | null): boolean {
  return hasPermission(role, 'repairs.assign.direct');
}

/**
 * Checks if a user role can request a repair transfer.
 * (TECHNICIAN, HEAD_TECHNICIAN, MANAGER, ADMIN, SUPERADMIN)
 */
export function canRequestTransfer(role: string | undefined | null): boolean {
  return hasPermission(role, 'repairs.transfer.request');
}

/**
 * Checks if a user role has access to Revenue Hub.
 * (SUPERADMIN, ADMIN, MANAGER)
 */
export function canViewRevenue(role: string | undefined | null): boolean {
  return hasPermission(role, 'revenue.view');
}

/**
 * Get human-readable role display name.
 */
export function getRoleDisplayName(role: string | undefined | null): string {
  const norm = normalizeRole(role);
  switch (norm) {
    case 'SUPERADMIN':
      return 'Super Admin';
    case 'ADMIN':
      return 'Administrator';
    case 'MANAGER':
      return 'Operations Manager';
    case 'HEAD_TECHNICIAN':
      return 'Head Technician';
    case 'TECHNICIAN':
      return 'Lab Technician';
    case 'RECEPTIONIST':
      return 'Front Desk / Reception';
    default:
      return 'Unauthorized Staff';
  }
}

/**
 * Get styling badge for role.
 */
export function getRoleBadgeStyle(role: string | undefined | null): { bg: string; text: string; border: string } {
  const norm = normalizeRole(role);
  switch (norm) {
    case 'SUPERADMIN':
      return { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' };
    case 'ADMIN':
      return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' };
    case 'MANAGER':
      return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
    case 'HEAD_TECHNICIAN':
      return { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' };
    case 'TECHNICIAN':
      return { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' };
    case 'RECEPTIONIST':
      return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
    default:
      return { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' };
  }
}
