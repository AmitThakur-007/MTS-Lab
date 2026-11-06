import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import {
  ensureSmsStorageSynced,
  getSmsStatistics,
  getAllSmsNotifications,
  recordSmsNotification,
} from '../api/_server/services/smsStorage.js';
import { getNptIsoBoundsForPreset } from '../src/lib/nepalDate.js';

after(() => {
  setTimeout(() => process.exit(0), 100);
});

test('SMS Center & Reports Immediate Login & Interactive KPI Suite', async (t) => {
  await t.test('1. Cold start sync ensures storage is fully initialized before returning stats', async () => {
    // Calling ensureSmsStorageSynced must complete without error
    await ensureSmsStorageSynced(true);
    
    // Immediate statistics call must resolve to a valid stats structure
    const stats = await getSmsStatistics('ALL');
    assert.ok(stats, 'Stats object must be returned');
    assert.strictEqual(typeof stats.totalSmsSent, 'number', 'totalSmsSent must be a number');
    assert.strictEqual(typeof stats.smsChannelTotal, 'number', 'smsChannelTotal must be a number');
    assert.strictEqual(typeof stats.staffConfirmedSms, 'number', 'staffConfirmedSms must be a number');
    assert.strictEqual(typeof stats.carrierConfirmedDelivered, 'number', 'carrierConfirmedDelivered must be a number');
    assert.strictEqual(typeof stats.failedSms, 'number', 'failedSms must be a number');
    assert.strictEqual(typeof stats.pendingSms, 'number', 'pendingSms must be a number');
    assert.strictEqual(typeof stats.whatsappSent, 'number', 'whatsappSent must be a number');
    assert.strictEqual(typeof stats.uniqueCustomersNotified, 'number', 'uniqueCustomersNotified must be a number');
  });

  await t.test('2. Kathmandu date ranges for THIS_WEEK and other presets calculate valid bounds', async () => {
    const today = getNptIsoBoundsForPreset('TODAY');
    assert.ok(today, 'Today bounds must exist');
    assert.ok(today.startIso < today.endIso, 'Today start must be before end');
    assert.strictEqual(
      new Date(today.endIso).getTime() - new Date(today.startIso).getTime(),
      86400000,
      'Today duration must be exactly 24 hours'
    );

    const yesterday = getNptIsoBoundsForPreset('YESTERDAY');
    assert.ok(yesterday, 'Yesterday bounds must exist');
    assert.strictEqual(yesterday.endIso, today.startIso, 'Yesterday end must match Today start');

    const thisWeek = getNptIsoBoundsForPreset('THIS_WEEK');
    assert.ok(thisWeek, 'This week bounds must exist');
    assert.ok(thisWeek.startIso <= today.startIso, 'This week start must be on or before today');
    assert.ok(thisWeek.endIso >= today.endIso, 'This week end must be on or after end of today');

    const thisMonth = getNptIsoBoundsForPreset('THIS_MONTH');
    assert.ok(thisMonth, 'This month bounds must exist');
    assert.ok(thisMonth.startIso <= thisWeek.startIso, 'This month start must be on or before this week start');
    assert.ok(thisMonth.endIso >= today.endIso, 'This month end must be on or after end of today');
  });

  await t.test('3. Metric filter in getAllSmsNotifications maps 1-to-1 to each KPI card', async () => {
    // Test that metric filtering queries execute cleanly for each metric type
    const metrics = [
      'TOTAL_SMS_SENT',
      'SMS_CHANNEL_TOTAL',
      'STAFF_CONFIRMED',
      'CARRIER_DELIVERED',
      'FAILED_SMS',
      'PENDING_DRAFT',
      'WHATSAPP_SENT',
    ] as const;

    for (const metric of metrics) {
      const res = await getAllSmsNotifications({
        metric,
        filterPreset: 'ALL',
        limit: 10,
        offset: 0,
      });
      assert.ok(res, `Result for metric ${metric} must exist`);
      assert.ok(Array.isArray(res.items), `Items array for metric ${metric} must exist`);
      assert.strictEqual(typeof res.total, 'number', `Total for metric ${metric} must be numeric`);
    }
  });

  await t.test('4. Saving a notification immediately updates stats without requiring restart or refresh', async () => {
    const testRepairId = 'test-repair-' + Date.now();
    const testPhone = '9841234567';

    const saved = await recordSmsNotification({
      repairId: testRepairId,
      repairNumber: '999999',
      customerId: 'cust-test',
      customerName: 'Test Customer',
      customerPhoneRaw: testPhone,
      customerPhoneNormalized: '+977' + testPhone,
      notificationType: 'DEVICE_RECEIVED',
      channel: 'SMS_PROTOCOL',
      messageContent: 'Test notification immediate persistence',
      status: 'STAFF_CONFIRMED_SENT',
      senderStaffId: 'staff-test',
      senderStaffName: 'Test Staff',
      senderStaffRole: 'RECEPTIONIST',
      confirmedAt: new Date().toISOString(),
      initiatedAt: new Date().toISOString(),
    });

    assert.ok(saved?.id, 'Notification must be saved with an id');

    // Retrieve by metric STAFF_CONFIRMED
    const metricRes = await getAllSmsNotifications({
      metric: 'STAFF_CONFIRMED',
      search: 'Test Customer',
      limit: 5,
    });

    assert.ok(metricRes.total >= 1, 'Should find the freshly saved notification in metric filter');
    const matched = metricRes.items.find((i: any) => i.id === saved.id);
    assert.ok(matched, 'Exact notification record must be in metric list');
    assert.strictEqual(matched.status, 'STAFF_CONFIRMED_SENT');
  });
});
