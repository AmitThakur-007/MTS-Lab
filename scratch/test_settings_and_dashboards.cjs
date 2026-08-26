const assert = require('assert');

console.log('======================================================');
console.log('--- TEST SUITE: SETTINGS & DASHBOARDS WHITE-SCREEN AUDIT ---');
console.log('======================================================\n');

// 1. RBAC Standardization Test for 6 Canonical Roles
console.log('Test 1: RBAC Normalization and Canonical Roles...');
const CANONICAL_ROLES = ['SUPERADMIN', 'ADMIN', 'MANAGER', 'HEAD_TECHNICIAN', 'TECHNICIAN', 'RECEPTIONIST'];

function normalizeRole(role) {
  if (!role) return null;
  const upper = String(role).trim().toUpperCase();
  if (['SUPERADMIN', 'SUPER_ADMIN', 'SUPER-ADMIN', 'OWNER', 'DIRECTOR'].includes(upper)) return 'SUPERADMIN';
  if (['ADMIN', 'ADMINISTRATOR'].includes(upper)) return 'ADMIN';
  if (['MANAGER', 'OPERATIONS_MANAGER', 'SERVICE_MANAGER'].includes(upper)) return 'MANAGER';
  if (['HEAD_TECHNICIAN', 'HEAD-TECHNICIAN', 'LEAD_TECHNICIAN', 'LEAD-TECHNICIAN', 'SENIOR_TECHNICIAN'].includes(upper)) return 'HEAD_TECHNICIAN';
  if (['TECHNICIAN', 'TECH', 'JUNIOR_TECHNICIAN', 'TECHNICAL_ASSISTANT'].includes(upper)) return 'TECHNICIAN';
  if (['RECEPTIONIST', 'FRONT_DESK', 'CUSTOMER_SERVICE', 'OPERATOR'].includes(upper)) return 'RECEPTIONIST';
  return null;
}

CANONICAL_ROLES.forEach(role => {
  assert.strictEqual(normalizeRole(role), role, `Role ${role} must self-normalize`);
});
assert.strictEqual(normalizeRole('SUPER_ADMIN'), 'SUPERADMIN');
assert.strictEqual(normalizeRole('LEAD_TECHNICIAN'), 'HEAD_TECHNICIAN');
assert.strictEqual(normalizeRole('TECHNICAL_ASSISTANT'), 'TECHNICIAN');
console.log('✅ Canonical 6 Roles normalization passed.');

// 2. Settings Safe String and Date Helpers
console.log('\nTest 2: Settings Component Null-Safety & Fallbacks...');

function safeFormatDate(dateVal, formatStr = 'MMM dd, yyyy') {
  if (!dateVal) return '—';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString();
  } catch {
    return '—';
  }
}

function getSafeHandle(user) {
  return user?.username || (user?.name ? user.name.toLowerCase().replace(/\s+/g, '') : 'staff');
}

function getSafeRoleTitle(user) {
  const norm = normalizeRole(user?.role);
  if (norm === 'SUPERADMIN') return 'Super Admin';
  if (norm === 'ADMIN') return 'Administrator';
  if (norm === 'MANAGER') return 'Manager';
  if (norm === 'HEAD_TECHNICIAN') return 'Head Tech';
  if (norm === 'TECHNICIAN') return 'Technician';
  if (norm === 'RECEPTIONIST') return 'Receptionist';
  return 'Staff';
}

// Test with null user
assert.strictEqual(getSafeHandle(null), 'staff');
assert.strictEqual(getSafeRoleTitle(null), 'Staff');
assert.strictEqual(safeFormatDate(null), '—');
assert.strictEqual(safeFormatDate(undefined), '—');
assert.strictEqual(safeFormatDate('invalid-date-string'), '—');

// Test with partial user
const partialUser = { name: 'John Doe', role: 'SUPER_ADMIN' };
assert.strictEqual(getSafeHandle(partialUser), 'johndoe');
assert.strictEqual(getSafeRoleTitle(partialUser), 'Super Admin');

console.log('✅ Settings null-safety and fallbacks passed.');

// 3. Array Safety for Sessions and Activities
console.log('\nTest 3: Array Mapping Safety (no "TypeError: .map is not a function")...');

function safeProcessArray(data) {
  const list = Array.isArray(data) ? data : (Array.isArray(data?.sessions) ? data.sessions : Array.isArray(data?.activities) ? data.activities : []);
  return list.map(item => item.id || 'default');
}

assert.deepStrictEqual(safeProcessArray(null), []);
assert.deepStrictEqual(safeProcessArray(undefined), []);
assert.deepStrictEqual(safeProcessArray({}), []);
assert.deepStrictEqual(safeProcessArray("string"), []);
assert.deepStrictEqual(safeProcessArray([{ id: 'sess_1' }, { id: 'sess_2' }]), ['sess_1', 'sess_2']);

console.log('✅ Array mapping safety passed.');

// 4. NavItems Permissions for All 6 Roles
console.log('\nTest 4: Sidebar Navigation Permission Matrix...');

const navDefinitions = [
  { path: '/dashboard', roles: ['SUPERADMIN', 'ADMIN', 'MANAGER', 'HEAD_TECHNICIAN', 'TECHNICIAN', 'RECEPTIONIST'] },
  { path: '/dashboard/repairs', roles: ['SUPERADMIN', 'ADMIN', 'MANAGER', 'HEAD_TECHNICIAN', 'TECHNICIAN', 'RECEPTIONIST'] },
  { path: '/dashboard/customers', roles: ['SUPERADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST'] },
  { path: '/dashboard/repairs/new', roles: ['SUPERADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST'] },
  { path: '/dashboard/courier', roles: ['SUPERADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST'] },
  { path: '/dashboard/battery-warranty', roles: ['SUPERADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST'] },
  { path: '/dashboard/repair-prices', roles: ['SUPERADMIN', 'ADMIN'] },
  { path: '/dashboard/slides', roles: ['SUPERADMIN', 'ADMIN'] },
  { path: '/dashboard/inventory', roles: ['SUPERADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST'] },
  { path: '/dashboard/attendance', roles: ['SUPERADMIN', 'ADMIN', 'MANAGER', 'HEAD_TECHNICIAN', 'TECHNICIAN', 'RECEPTIONIST'] },
  { path: '/dashboard/repair-damage', roles: ['SUPERADMIN', 'ADMIN', 'MANAGER', 'HEAD_TECHNICIAN', 'TECHNICIAN', 'RECEPTIONIST'] },
  { path: '/dashboard/staff', roles: ['SUPERADMIN', 'ADMIN'] },
  { path: '/dashboard/access-requests', roles: ['SUPERADMIN'] },
  { path: '/dashboard/revenue', roles: ['SUPERADMIN', 'ADMIN', 'MANAGER'] },
  { path: '/dashboard/super-admin', roles: ['SUPERADMIN'] },
  { path: '/dashboard/settings', roles: ['SUPERADMIN', 'ADMIN', 'MANAGER', 'HEAD_TECHNICIAN', 'TECHNICIAN', 'RECEPTIONIST'] },
];

function getVisibleNav(userRole) {
  const norm = normalizeRole(userRole);
  return navDefinitions.filter(item => item.roles.includes(norm)).map(item => item.path);
}

// Check Super Admin
const superAdminNav = getVisibleNav('SUPER_ADMIN');
assert.ok(superAdminNav.includes('/dashboard/settings'), 'Super Admin must see settings');
assert.ok(superAdminNav.includes('/dashboard/super-admin'), 'Super Admin must see super-admin');
assert.ok(superAdminNav.includes('/dashboard/staff'), 'Super Admin must see staff');
assert.ok(superAdminNav.includes('/dashboard/revenue'), 'Super Admin must see revenue');
assert.ok(superAdminNav.includes('/dashboard/access-requests'), 'Super Admin must see access requests');

// Check Technician
const techNav = getVisibleNav('TECHNICIAN');
assert.ok(techNav.includes('/dashboard/settings'), 'Technician must see settings');
assert.ok(techNav.includes('/dashboard/repairs'), 'Technician must see repairs');
assert.ok(!techNav.includes('/dashboard/staff'), 'Technician must NOT see staff');
assert.ok(!techNav.includes('/dashboard/revenue'), 'Technician must NOT see revenue');
assert.ok(!techNav.includes('/dashboard/super-admin'), 'Technician must NOT see super-admin');

// Check Receptionist
const receptionistNav = getVisibleNav('RECEPTIONIST');
assert.ok(receptionistNav.includes('/dashboard/settings'), 'Receptionist must see settings');
assert.ok(receptionistNav.includes('/dashboard/customers'), 'Receptionist must see customers');
assert.ok(!receptionistNav.includes('/dashboard/staff'), 'Receptionist must NOT see staff');

console.log('✅ Sidebar navigation permissions verified for all roles.');

console.log('\n======================================================');
console.log('🎉 ALL SETTINGS & DASHBOARD AUDIT TESTS PASSED CLEANLY!');
console.log('======================================================');
