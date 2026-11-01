import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { useDashboardCache } from '../src/store/dashboardCache';
import { useAuthStore } from '../src/store/authStore';
import { useRepairCache } from '../src/store/repairCache';

test('1. Public website footer strictly excludes ThemeToggle / Dark & Light options', () => {
  const footerPath = path.resolve(process.cwd(), 'src/components/Footer.tsx');
  assert.ok(fs.existsSync(footerPath), 'src/components/Footer.tsx must exist');
  const content = fs.readFileSync(footerPath, 'utf8');

  // Verify ThemeToggle is not imported or rendered
  assert.ok(!content.includes('ThemeToggle'), 'Footer.tsx must not import or render ThemeToggle');
  assert.ok(!content.includes('Theme toggle'), 'Footer.tsx must not include theme toggles');
  assert.ok(content.includes('Terms & Conditions'), 'Footer must preserve Terms & Conditions link');
  assert.ok(content.includes('Privacy Policy'), 'Footer must preserve Privacy Policy link');
});

test('2. OverviewHeader New Repair button has high contrast in Dark Mode & proper navigation', () => {
  const headerPath = path.resolve(process.cwd(), 'src/components/dashboard/overview/OverviewHeader.tsx');
  assert.ok(fs.existsSync(headerPath), 'OverviewHeader.tsx must exist');
  const content = fs.readFileSync(headerPath, 'utf8');

  // Must not have invisible white-on-white anti-pattern (bg-primary text-white)
  assert.ok(
    !content.includes('bg-primary hover:bg-primary/90 text-white'),
    'OverviewHeader must NOT have "bg-primary text-white" which turns invisible in dark mode'
  );

  // Must have high-contrast styling in dark mode
  assert.ok(
    content.includes('dark:bg-indigo-600') || content.includes('dark:hover:bg-indigo-500'),
    'OverviewHeader New Repair button must have crisp, high-contrast dark mode styles'
  );

  // Must navigate to /dashboard/repairs/new
  assert.ok(
    content.includes("navigate('/dashboard/repairs/new')"),
    'OverviewHeader New Repair button must navigate directly to /dashboard/repairs/new'
  );
});

test('3. Attendance backend router produces complete real DB statistics and NPT time bounds', () => {
  const attendanceRoutePath = path.resolve(process.cwd(), 'api/_server/routes/attendance.ts');
  assert.ok(fs.existsSync(attendanceRoutePath), 'api/_server/routes/attendance.ts must exist');
  const content = fs.readFileSync(attendanceRoutePath, 'utf8');

  // Must provide accurate statistics payload with both summary and stats keys
  assert.ok(content.includes('summary: statsPayload'), 'Must provide summary object');
  assert.ok(content.includes('stats: statsPayload'), 'Must provide stats object for full compatibility');

  // Must include breakdown counts
  assert.ok(content.includes('lateCount'), 'Must compute lateCount');
  assert.ok(content.includes('halfDayCount'), 'Must compute halfDayCount');
  assert.ok(content.includes('absentCount'), 'Must compute absentCount');
  assert.ok(content.includes('attendanceRate'), 'Must compute attendanceRate');

  // Must include Asia/Kathmandu time in server-time
  assert.ok(content.includes('dateString: time.dateString'), 'Must return dateString');
  assert.ok(content.includes('timeString: time.timeString'), 'Must return timeString');
  assert.ok(content.includes('secondsRemaining:'), 'Must return secondsRemaining');
});

test('4. Attendance storage includes full staff roles in authorized roster calculation', () => {
  const storagePath = path.resolve(process.cwd(), 'api/_server/services/attendanceStorage.ts');
  assert.ok(fs.existsSync(storagePath), 'attendanceStorage.ts must exist');
  const content = fs.readFileSync(storagePath, 'utf8');

  assert.ok(content.includes("'SUPER_ADMIN'"), 'Must include SUPER_ADMIN');
  assert.ok(content.includes("'ADMIN'"), 'Must include ADMIN');
  assert.ok(content.includes("'MANAGER'"), 'Must include MANAGER');
  assert.ok(content.includes("'TECHNICIAN'"), 'Must include TECHNICIAN');
  assert.ok(content.includes("'RECEPTIONIST'"), 'Must include RECEPTIONIST');
  assert.ok(content.includes("'ACCOUNTANT'"), 'Must include ACCOUNTANT');
  assert.ok(content.includes("'INVENTORY_MANAGER'"), 'Must include INVENTORY_MANAGER');
});

test('5. useDashboardCache provides user-isolated SWR caching and revalidation', () => {
  useDashboardCache.getState().clearAll();

  // Test setOverview
  const mockOverview = { role: 'SUPER_ADMIN', systemSummary: { activeRepairs: 42 } };
  useDashboardCache.getState().setOverview(mockOverview, 'user-123');

  const state1 = useDashboardCache.getState();
  assert.equal(state1.overview.data?.systemSummary?.activeRepairs, 42);
  assert.equal(state1.overview.userId, 'user-123');
  assert.equal(useDashboardCache.getState().isStale('overview', 'user-123', 60000), false);

  // Stale check for different user returns true (user isolation)
  assert.equal(useDashboardCache.getState().isStale('overview', 'user-different', 60000), true);

  // Test setCustomers
  useDashboardCache.getState().setCustomers({
    list: [{ id: 'c1', name: 'Ram Sharma' }],
    total: 100,
    totalPages: 3,
  }, 'user-123');

  const state2 = useDashboardCache.getState();
  assert.equal(state2.customers.list.length, 1);
  assert.equal(state2.customers.total, 100);

  // Test clearAll
  useDashboardCache.getState().clearAll();
  const cleared = useDashboardCache.getState();
  assert.equal(cleared.overview.data, null);
  assert.equal(cleared.customers.list.length, 0);
});

test('6. AuthStore logout completely purges dashboard cache and repair cache', () => {
  useDashboardCache.getState().setOverview({ test: true }, 'user-456');
  useRepairCache.getState().setRepairs([{ id: 'rep-1' }], 'user-456');

  assert.ok(useDashboardCache.getState().overview.data !== null);
  assert.equal(useRepairCache.getState().repairs.length, 1);

  // Trigger logout
  useAuthStore.getState().logout();

  // Both stores must be cleanly purged
  assert.equal(useDashboardCache.getState().overview.data, null);
  assert.equal(useRepairCache.getState().repairs.length, 0);
  assert.equal(useAuthStore.getState().user, null);
  assert.equal(useAuthStore.getState().token, null);
});
