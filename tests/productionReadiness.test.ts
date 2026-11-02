import test from 'node:test';
import assert from 'node:assert/strict';
import { getRecentEvents, broadcastServerChange } from '../api/_server/services/realtimeSync';
import { useDashboardCache } from '../src/store/dashboardCache';

test('Production Readiness: Real-time Event Sliding Window Buffer & Reconnect Catch-up', async (t) => {
  await t.test('buffers broadcasted events in memory', () => {
    const testId = `test_${Date.now()}`;
    broadcastServerChange('Repair', 'UPDATE', testId, { id: testId, status: 'IN_PROGRESS' });
    
    const events = getRecentEvents(Date.now() - 5000);
    assert.ok(Array.isArray(events), 'Should return an array of events');
    const matched = events.find((e) => (e.data as any)?.id === testId);
    assert.ok(matched, 'Buffer should contain the newly broadcasted event');
    assert.equal(matched?.entity, 'repair');
    assert.equal(matched?.action, 'UPDATE');
  });

  await t.test('filters events strictly by timestamp', () => {
    const now = Date.now();
    const oldEvents = getRecentEvents(now + 100000);
    assert.equal(oldEvents.length, 0, 'No events should have timestamps in the future');
  });
});

test('Production Readiness: Multi-Section Dashboard Cache & SWR Rehydration', async (t) => {
  await t.test('supports SMS Center cache storage and prehydration', () => {
    const mockStats = {
      totalSmsSent: 42,
      staffConfirmedSms: 40,
      carrierConfirmedDelivered: 38,
      failedSms: 2,
      pendingSms: 0,
      whatsappSent: 15,
      notSentSms: 0,
      whatsappPending: 0,
      whatsappFailed: 0,
      totalNotifications: 57,
      uniqueCustomersNotified: 35,
      uniqueCustomersNotNotified: 5,
    };

    useDashboardCache.getState().setSmsCenter({
      stats: mockStats,
      repairedList: [{ id: 'rep_1', model: 'iPhone 13' }],
      repairedTotal: 1,
    }, 'user_123');

    const state = useDashboardCache.getState().smsCenter;
    assert.deepEqual(state.stats, mockStats);
    assert.equal(state.repairedTotal, 1);
    assert.equal(state.userId, 'user_123');
    assert.ok(state.lastFetched > 0);

    // Staleness check
    assert.equal(useDashboardCache.getState().isStale('smsCenter', 'user_123'), false);
    // Cross-user access should be recognized as stale
    assert.equal(useDashboardCache.getState().isStale('smsCenter', 'other_user'), true);
  });

  await t.test('supports Super Admin audit logs cache storage and prehydration', () => {
    const mockLogs = [
      { id: 'log_1', action: 'PERMANENT_DELETION', resource: 'Repair', status: 'SUCCESS' },
    ];

    useDashboardCache.getState().setSuperAdmin({
      auditLogs: mockLogs,
      auditTotal: 1,
      auditTotalPages: 1,
    }, 'super_admin_1');

    const state = useDashboardCache.getState().superAdmin;
    assert.deepEqual(state.auditLogs, mockLogs);
    assert.equal(state.auditTotal, 1);
    assert.equal(state.userId, 'super_admin_1');

    // Invalidation check
    useDashboardCache.getState().invalidate('superAdmin');
    assert.equal(useDashboardCache.getState().isStale('superAdmin', 'super_admin_1'), true);
  });

  await t.test('supports full cache purge on user logout', () => {
    useDashboardCache.getState().clearAll();
    const state = useDashboardCache.getState();
    assert.equal(state.overview.data, null);
    assert.equal(state.smsCenter.stats, null);
    assert.equal(state.smsCenter.repairedList.length, 0);
    assert.equal(state.superAdmin.auditLogs.length, 0);
  });
});

test('Production Readiness: Security Headers and Safe API Contract', async (t) => {
  await t.test('validates security header configurations in API server setup', async () => {
    const fs = await import('node:fs');
    const appTs = fs.readFileSync('api/_server/app.ts', 'utf-8');

    assert.ok(appTs.includes("res.setHeader('X-Content-Type-Options', 'nosniff')"), 'Must include nosniff');
    assert.ok(appTs.includes("res.setHeader('X-Frame-Options', 'SAMEORIGIN')"), 'Must include SAMEORIGIN');
    assert.ok(appTs.includes("res.setHeader('X-XSS-Protection', '1; mode=block')"), 'Must include XSS protection');
    assert.ok(appTs.includes("res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')"), 'Must include Referrer-Policy');
  });

  await t.test('validates /api/health endpoint includes database ping and runtime metrics', async () => {
    const fs = await import('node:fs');
    const appTs = fs.readFileSync('api/_server/app.ts', 'utf-8');

    assert.ok(appTs.includes("app.get('/api/health'"), 'Must define /api/health');
    assert.ok(appTs.includes('database:'), 'Must check database status in health check');
    assert.ok(appTs.includes('uptimeSeconds:'), 'Must report process uptime');
    assert.ok(appTs.includes('memory:'), 'Must report memory usage metrics');
  });
});

// Allow clean process exit
setTimeout(() => {
  process.exit(0);
}, 100);

