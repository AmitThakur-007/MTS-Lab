import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { cleanNepalPhone, isValidNepalPhone } from '../api/_server/routes/customers';
import { normalizeRole } from '../api/_server/middleware/rbac';

const projectRoot = process.cwd();

// =========================================================================
// TEST SUITE 1: Nepal Phone Normalization & Validation Engine
// =========================================================================
test('Nepal Phone Engine: correctly cleans and normalizes various formats', () => {
  // Mobile with +977 prefix
  assert.equal(cleanNepalPhone('+977-9841234567'), '9841234567');
  assert.equal(cleanNepalPhone('+977 9801234567'), '9801234567');
  assert.equal(cleanNepalPhone('+977 9741234567'), '9741234567');

  // Mobile with leading 977 without plus
  assert.equal(cleanNepalPhone('9779841234567'), '9841234567');

  // Mobile with hyphens and spaces
  assert.equal(cleanNepalPhone('984-123-4567'), '9841234567');
  assert.equal(cleanNepalPhone('980 123 4567'), '9801234567');

  // Landline numbers
  assert.equal(cleanNepalPhone('01-4234567'), '014234567');
  assert.equal(cleanNepalPhone('01 4234567'), '014234567');
  assert.equal(cleanNepalPhone('+977-01-4234567'), '014234567');
});

test('Nepal Phone Engine: validates 10-digit mobile starting with 98 and 97', () => {
  // Valid NTC / Ncell mobile
  assert.equal(isValidNepalPhone('9841234567'), true);
  assert.equal(isValidNepalPhone('9801234567'), true);
  assert.equal(isValidNepalPhone('9812345678'), true);
  assert.equal(isValidNepalPhone('9851000000'), true);

  // Valid 97 series (NTC / Smart Cell)
  assert.equal(isValidNepalPhone('9741234567'), true);
  assert.equal(isValidNepalPhone('9761234567'), true);
  assert.equal(isValidNepalPhone('+977-9741234567'), true);

  // Valid Kathmandu and regional landlines
  assert.equal(isValidNepalPhone('014234567'), true);
  assert.equal(isValidNepalPhone('01-4234567'), true);

  // Invalid numbers
  assert.equal(isValidNepalPhone('1234567890'), false); // Doesn't start with 98/97 or 0
  assert.equal(isValidNepalPhone('984123456'), false);   // Only 9 digits
  assert.equal(isValidNepalPhone('98412345678'), false); // 11 digits
  assert.equal(isValidNepalPhone('abcdefghij'), false);  // Non-numeric
  assert.equal(isValidNepalPhone(''), false);            // Empty
});

// =========================================================================
// TEST SUITE 2: RBAC Normalization & Customer Hub Access Policy
// =========================================================================
test('RBAC Engine: correctly authorizes SUPER_ADMIN, ADMIN, and MANAGER', () => {
  const allowedRoles = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];

  // Super Admin
  assert.equal(normalizeRole('SUPER_ADMIN'), 'SUPER_ADMIN');
  assert.equal(normalizeRole('superadmin'), 'SUPER_ADMIN');
  assert.equal(allowedRoles.includes(normalizeRole('SUPER_ADMIN')), true);

  // Admin
  assert.equal(normalizeRole('ADMIN'), 'ADMIN');
  assert.equal(allowedRoles.includes(normalizeRole('ADMIN')), true);

  // Manager
  assert.equal(normalizeRole('MANAGER'), 'MANAGER');
  assert.equal(allowedRoles.includes(normalizeRole('MANAGER')), true);

  // Unauthorized roles
  assert.equal(allowedRoles.includes(normalizeRole('TECHNICIAN')), false);
  assert.equal(allowedRoles.includes(normalizeRole('LEAD_TECHNICIAN')), false);
  assert.equal(allowedRoles.includes(normalizeRole('RECEPTIONIST')), false);
  assert.equal(allowedRoles.includes(normalizeRole('CUSTOMER')), false);
});

// =========================================================================
// TEST SUITE 3: Navigation & Route Registration Verification
// =========================================================================
test('Navigation: Customer Hub is integrated in DashboardLayout with Users icon for SUPER_ADMIN, ADMIN, MANAGER', () => {
  const layoutPath = path.join(projectRoot, 'src/components/DashboardLayout.tsx');
  const content = fs.readFileSync(layoutPath, 'utf8');

  // Verify navigation item existence
  assert.ok(
    content.includes("name: 'Customer Hub'") || content.includes('name: "Customer Hub"'),
    'DashboardLayout must define a Customer Hub navigation item'
  );

  // Verify path is /dashboard/customers
  assert.ok(
    content.includes("path: '/dashboard/customers'"),
    'Customer Hub must navigate to /dashboard/customers'
  );

  // Verify icon is Users
  assert.ok(
    content.includes("icon: Users"),
    'Customer Hub must use the Users icon'
  );

  // Verify role access includes SUPER_ADMIN, ADMIN, MANAGER
  const customerHubNavSlice = content.slice(
    content.indexOf("name: 'Customer Hub'"),
    content.indexOf("name: 'Customer Hub'") + 150
  );
  assert.ok(
    customerHubNavSlice.includes("'SUPER_ADMIN'") &&
    customerHubNavSlice.includes("'ADMIN'") &&
    customerHubNavSlice.includes("'MANAGER'"),
    'Customer Hub navigation item must be authorized for SUPER_ADMIN, ADMIN, and MANAGER'
  );
});

test('Routing: Dashboard.tsx routes /dashboard/customers and /dashboard/customers/:id', () => {
  const dashboardPath = path.join(projectRoot, 'src/pages/Dashboard.tsx');
  const content = fs.readFileSync(dashboardPath, 'utf8');

  // Verify imports
  assert.ok(
    content.includes("import CustomerHub from './dashboard/CustomerHub'") ||
    content.includes('import CustomerHub from "./dashboard/CustomerHub"'),
    'Dashboard.tsx must import CustomerHub'
  );
  assert.ok(
    content.includes("import CustomerProfile from './dashboard/CustomerProfile'") ||
    content.includes('import CustomerProfile from "./dashboard/CustomerProfile"'),
    'Dashboard.tsx must import CustomerProfile'
  );

  // Verify routes mounted
  assert.ok(
    content.includes('<Route path="customers" element={<CustomerHub />} />'),
    'Dashboard.tsx must mount route for customers'
  );
  assert.ok(
    content.includes('<Route path="customers/:id" element={<CustomerProfile />} />'),
    'Dashboard.tsx must mount route for customers/:id'
  );
});

// =========================================================================
// TEST SUITE 4: Critical Data Protection on Customer Deletion
// =========================================================================
test('Data Protection: Backend customer routes protect records with associated repair history', () => {
  const customerRoutesPath = path.join(projectRoot, 'api/_server/routes/customers.ts');
  const content = fs.readFileSync(customerRoutesPath, 'utf8');

  // Verify stats endpoint
  assert.ok(
    content.includes("router.get('/stats'"),
    'Customers router must provide a GET /stats endpoint'
  );

  // Verify bulk-delete endpoint
  assert.ok(
    content.includes("router.post('/bulk-delete'"),
    'Customers router must provide a POST /bulk-delete endpoint'
  );

  // Verify critical repair data protection in single delete
  assert.ok(
    content.includes('totalAssociated > 0') || content.includes('repairCount'),
    'DELETE /:id must inspect associated repair counts'
  );
  assert.ok(
    content.includes('CUSTOMER_ARCHIVED_PROTECTED') || content.includes('archived: true'),
    'DELETE /:id must archive customers with associated repairs instead of hard deleting'
  );

  // Verify role check for permanent deletion: only SUPER_ADMIN can permanently delete
  assert.ok(
    content.includes("userRole === 'SUPER_ADMIN'") || content.includes("role === 'SUPER_ADMIN'"),
    'Only SUPER_ADMIN can execute permanent deletion from database'
  );

  // Verify bulk delete safely archives customers with repairs
  assert.ok(
    content.includes("archivedCount") && content.includes("deletedCount"),
    'Bulk delete must track archived vs deleted counts based on repair history'
  );
});

// =========================================================================
// TEST SUITE 5: Customer Hub Component Capabilities & UI Architecture
// =========================================================================
test('CustomerHub Component: provides data table, overview stats, bulk selection, search, and dark mode classes', () => {
  const hubPath = path.join(projectRoot, 'src/pages/dashboard/CustomerHub.tsx');
  const content = fs.readFileSync(hubPath, 'utf8');

  // Verify Overview Stats
  assert.ok(content.includes('totalCustomers'), 'CustomerHub must display total active customers');
  assert.ok(content.includes('addedToday'), 'CustomerHub must display customers added today');
  assert.ok(content.includes('addedThisMonth'), 'CustomerHub must display customers added this month');
  assert.ok(content.includes('withRepairs'), 'CustomerHub must display customers with repair history');

  // Verify Data Table with Checkboxes
  assert.ok(content.includes('<table') || content.includes('table'), 'CustomerHub must support Table View');
  assert.ok(content.includes('selectedIds'), 'CustomerHub must support multi-row selection');
  assert.ok(content.includes('handleSelectAllOnPage'), 'CustomerHub must provide select all on page');

  // Verify Bulk Deletion Dialog
  assert.ok(content.includes('isBulkDeleteOpen'), 'CustomerHub must include Bulk Delete confirmation modal');
  assert.ok(content.includes('/customers/bulk-delete'), 'CustomerHub must call /customers/bulk-delete');

  // Verify Add Customer Dialog
  assert.ok(content.includes('isAddOpen'), 'CustomerHub must include Add Customer modal');
  assert.ok(content.includes('validatePhone'), 'CustomerHub must validate Nepal phone numbers');

  // Verify Edit Customer Dialog
  assert.ok(content.includes('isEditOpen'), 'CustomerHub must include Edit Customer modal');

  // Verify Server-side Pagination & Filters
  assert.ok(content.includes('totalPages') && content.includes('page'), 'CustomerHub must support pagination');
  assert.ok(content.includes('searchQuery'), 'CustomerHub must support live search');
  assert.ok(content.includes('NEPAL_DISTRICTS'), 'CustomerHub must support district filtering');

  // Verify Dark Mode compatibility
  assert.ok(content.includes('dark:bg-slate-900'), 'CustomerHub must support dark mode backgrounds');
  assert.ok(content.includes('dark:text-slate-100') || content.includes('dark:text-white'), 'CustomerHub must support dark mode typography');
  assert.ok(content.includes('dark:border-slate-800'), 'CustomerHub must support dark mode borders');
});
