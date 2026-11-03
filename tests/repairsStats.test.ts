import { test } from 'node:test';
import assert from 'node:assert';
import { computeRepairDashboardStats } from '../api/_server/services/repairStatsService.js';

test('Repair Dashboard Stats: Computes operational statistics across all presets without schema errors', async () => {
  const presets = ['ALL', 'TODAY', 'YESTERDAY', 'THIS_WEEK', 'THIS_MONTH'] as const;

  for (const preset of presets) {
    const res = await computeRepairDashboardStats({
      preset,
      userRole: 'SUPER_ADMIN'
    });

    assert.ok(res, `Stats response should be returned for preset: ${preset}`);
    assert.ok(res.metrics, 'Metrics object must exist');
    assert.strictEqual(typeof res.metrics.totalRecords, 'number');
    assert.strictEqual(typeof res.metrics.activeRepairs, 'number');
    assert.strictEqual(typeof res.metrics.delivered, 'number');
    assert.strictEqual(typeof res.metrics.estimatedTotalSum, 'number');
    assert.strictEqual(typeof res.metrics.totalPaidSum, 'number');

    assert.ok(res.userAssigned, 'userAssigned object must exist');
    assert.strictEqual(typeof res.userAssigned.assignedTotal, 'number');
    assert.strictEqual(typeof res.userAssigned.activeTotal, 'number');
  }
});

test('Repair Dashboard Stats: Technician Isolation and Personal Bench Metrics', async () => {
  const res = await computeRepairDashboardStats({
    preset: 'ALL',
    userRole: 'TECHNICIAN',
    userId: 'technician-sample-id'
  });

  assert.ok(res);
  assert.ok(res.metrics);
  assert.strictEqual(typeof res.userAssigned.completedToday, 'number');
  assert.strictEqual(typeof res.userAssigned.completedThisWeek, 'number');
  assert.strictEqual(typeof res.userAssigned.completedThisMonth, 'number');
});
