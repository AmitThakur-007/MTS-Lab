import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getNptIsoBoundsForPreset } from '../api/_server/services/repairStatsService';

test('Technician Optimization: Nepal Time Range Bounds for Completed Work & Overdue', () => {
  const now = new Date('2026-11-02T12:00:00Z');
  
  const todayBounds = getNptIsoBoundsForPreset('TODAY', undefined, undefined, now);
  assert.ok(todayBounds.startIso, 'Must provide startIso for today');
  assert.ok(todayBounds.endIso, 'Must provide endIso for today');
  assert.ok(new Date(todayBounds.startIso) < new Date(todayBounds.endIso), 'startIso must be earlier than endIso');

  const yesterdayBounds = getNptIsoBoundsForPreset('YESTERDAY', undefined, undefined, now);
  assert.ok(yesterdayBounds.startIso < yesterdayBounds.endIso);
  assert.equal(yesterdayBounds.endIso, todayBounds.startIso, 'Yesterday end must match today start');

  const thisWeekBounds = getNptIsoBoundsForPreset('THIS_WEEK', undefined, undefined, now);
  assert.ok(thisWeekBounds.startIso <= todayBounds.startIso, 'This week starts on or before today');

  const thisMonthBounds = getNptIsoBoundsForPreset('THIS_MONTH', undefined, undefined, now);
  assert.ok(thisMonthBounds.startIso <= todayBounds.startIso, 'This month starts on or before today');
});

test('Technician Dashboard: File Structure & Dark Mode CSS Integrity', () => {
  const filePath = path.resolve(process.cwd(), 'src/pages/dashboard/TechnicianDashboard.tsx');
  assert.ok(fs.existsSync(filePath), 'TechnicianDashboard.tsx must exist');
  
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Verify 9 KPI stat cards presence
  assert.ok(content.includes('Total Assigned'), 'Must include Total Assigned KPI');
  assert.ok(content.includes('In-Progress'), 'Must include In-Progress KPI');
  assert.ok(content.includes('Pending'), 'Must include Pending KPI');
  assert.ok(content.includes('Priority Queue'), 'Must include Priority Queue KPI');
  assert.ok(content.includes('Overdue Repairs'), 'Must include Overdue Repairs KPI');
  assert.ok(content.includes('Completed Today'), 'Must include Completed Today KPI');
  assert.ok(content.includes('Completed This Week'), 'Must include Completed This Week KPI');
  assert.ok(content.includes('Completed This Month'), 'Must include Completed This Month KPI');
  assert.ok(content.includes('Completed Work'), 'Must include Completed Work KPI');

  // Verify attendance overview integration
  assert.ok(content.includes('/attendance/my'), 'Must call attendance API');
  assert.ok(content.includes('Attendance Overview'), 'Must have Attendance Overview section');
  assert.ok(content.includes('Attendance Hub'), 'Must link to Attendance Hub');

  // Verify completed work section & timeframe filter options
  assert.ok(content.includes('My Completed Work'), 'Must have My Completed Work section');
  assert.ok(content.includes('/repairs/technician/completed-work'), 'Must call completed work endpoint');
  assert.ok(content.includes('All Completed'), 'Must support All Completed filter');

  // Verify view toggles & pagination
  assert.ok(content.includes('viewMode'), 'Must support Grid vs Table view');
  assert.ok(content.includes('REPAIRS_PER_PAGE'), 'Must support 40-item pagination constant');

  // Verify comprehensive dark mode styling
  assert.ok(content.includes('dark:bg-slate-900'), 'Must have dark background classes');
  assert.ok(content.includes('dark:border-slate-800') || content.includes('dark:border-slate-700'), 'Must have dark border classes');
  assert.ok(content.includes('dark:text-white'), 'Must have dark text classes');
  assert.ok(content.includes('dark:text-slate-200') || content.includes('dark:text-slate-300') || content.includes('dark:text-slate-100'), 'Must have dark high-contrast text');
  assert.ok(content.includes('dark:text-slate-400'), 'Must have dark muted text');
});

test('Technician Backend Route: Completed Work Endpoint exists in repairs router', () => {
  const routerPath = path.resolve(process.cwd(), 'api/_server/routes/repairs.ts');
  const content = fs.readFileSync(routerPath, 'utf-8');

  assert.ok(
    content.includes("router.get('/technician/completed-work'"),
    'Must declare GET /technician/completed-work route'
  );
  assert.ok(
    content.includes("getNptIsoBoundsForPreset"),
    'Must use Nepal time bounds for accurate completed work intervals'
  );
});

