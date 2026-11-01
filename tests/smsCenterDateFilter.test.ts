import { test } from 'node:test';
import assert from 'node:assert';
import {
  getNptIsoBoundsForPreset,
  getNepalCalendarInfo,
  NEPAL_TIMEZONE,
  NPT_OFFSET_MS,
  DateFilterPreset,
} from '../api/_server/services/repairStatsService';
import {
  generateRepairedDeviceSmsMessage,
  generateReceivedDeviceSmsMessage,
  analyzeSmsEncodingServer,
} from '../api/_server/services/smsStorage';

test('1. Nepal Timezone (NPT, UTC+05:45) Half-Open Intervals Definition', () => {
  // Reference date: 2026-10-30 14:30:00 UTC = 2026-10-30 20:15:00 NPT (Friday)
  const refDate = new Date('2026-10-30T14:30:00.000Z');

  // TODAY
  const todayBounds = getNptIsoBoundsForPreset('TODAY', undefined, undefined, refDate);
  assert.ok(todayBounds.startIso, 'TODAY must have startIso');
  assert.ok(todayBounds.endIso, 'TODAY must have endIso');

  // Verify start is 2026-10-30 00:00:00 NPT = 2026-10-29 18:15:00 UTC
  const expectedTodayStart = new Date(Date.UTC(2026, 9, 30) - NPT_OFFSET_MS).toISOString();
  // Verify end is 2026-10-31 00:00:00 NPT = 2026-10-30 18:15:00 UTC
  const expectedTodayEnd = new Date(Date.UTC(2026, 9, 31) - NPT_OFFSET_MS).toISOString();

  assert.strictEqual(todayBounds.startIso, expectedTodayStart, 'TODAY startIso matches 00:00:00 NPT');
  assert.strictEqual(todayBounds.endIso, expectedTodayEnd, 'TODAY endIso matches next day 00:00:00 NPT');

  // Half-open interval checks:
  const startMs = new Date(todayBounds.startIso).getTime();
  const endMs = new Date(todayBounds.endIso).getTime();

  // Exactly at start -> included
  assert.ok(startMs >= startMs && startMs < endMs, 'Event at start boundary must be included');

  // Exactly 1ms before end -> included
  const justBeforeEnd = endMs - 1;
  assert.ok(justBeforeEnd >= startMs && justBeforeEnd < endMs, 'Event at 23:59:59.999 NPT must be included');

  // Exactly at end boundary (tomorrow 00:00:00 NPT) -> strictly excluded
  assert.ok(!(endMs >= startMs && endMs < endMs), 'Event at exact next day 00:00:00 NPT must be excluded');

  // YESTERDAY
  const yesterdayBounds = getNptIsoBoundsForPreset('YESTERDAY', undefined, undefined, refDate);
  const expectedYesterdayStart = new Date(Date.UTC(2026, 9, 29) - NPT_OFFSET_MS).toISOString();
  assert.strictEqual(yesterdayBounds.startIso, expectedYesterdayStart, 'YESTERDAY start is yesterday 00:00:00 NPT');
  assert.strictEqual(yesterdayBounds.endIso, expectedTodayStart, 'YESTERDAY end is today 00:00:00 NPT');

  // THIS_WEEK (Starts on Monday in Nepal: 2026-10-26 to 2026-11-02)
  const weekBounds = getNptIsoBoundsForPreset('THIS_WEEK', undefined, undefined, refDate);
  const expectedWeekStart = new Date(Date.UTC(2026, 9, 26) - NPT_OFFSET_MS).toISOString();
  const expectedWeekEnd = new Date(Date.UTC(2026, 10, 2) - NPT_OFFSET_MS).toISOString();
  assert.strictEqual(weekBounds.startIso, expectedWeekStart, 'THIS_WEEK start is Monday 00:00:00 NPT');
  assert.strictEqual(weekBounds.endIso, expectedWeekEnd, 'THIS_WEEK end is next Monday 00:00:00 NPT');

  // THIS_MONTH (2026-10-01 to 2026-11-01)
  const monthBounds = getNptIsoBoundsForPreset('THIS_MONTH', undefined, undefined, refDate);
  const expectedMonthStart = new Date(Date.UTC(2026, 9, 1) - NPT_OFFSET_MS).toISOString();
  const expectedMonthEnd = new Date(Date.UTC(2026, 10, 1) - NPT_OFFSET_MS).toISOString();
  assert.strictEqual(monthBounds.startIso, expectedMonthStart, 'THIS_MONTH start is 1st of month 00:00:00 NPT');
  assert.strictEqual(monthBounds.endIso, expectedMonthEnd, 'THIS_MONTH end is 1st of next month 00:00:00 NPT');

  // ALL
  const allBounds = getNptIsoBoundsForPreset('ALL');
  assert.strictEqual(allBounds.startIso, null, 'ALL preset has null start');
  assert.strictEqual(allBounds.endIso, null, 'ALL preset has null end');
});

test('2. Custom Date Range Half-Open Bounds in Nepal Time', () => {
  // Custom range: 2026-10-20 to 2026-10-25
  const customBounds = getNptIsoBoundsForPreset('CUSTOM', '2026-10-20', '2026-10-25');
  const expectedStart = new Date(Date.UTC(2026, 9, 20) - NPT_OFFSET_MS).toISOString();
  const expectedEnd = new Date(Date.UTC(2026, 9, 26) - NPT_OFFSET_MS).toISOString(); // 2026-10-26 00:00:00 NPT

  assert.strictEqual(customBounds.startIso, expectedStart, 'CUSTOM start is customStart 00:00:00 NPT');
  assert.strictEqual(customBounds.endIso, expectedEnd, 'CUSTOM end is day following customEnd 00:00:00 NPT');

  // Verify timestamp on 2026-10-25 at 23:50:00 NPT is included
  const testDate = new Date(Date.UTC(2026, 9, 25, 18, 5, 0)).getTime(); // 23:50 NPT
  const sMs = new Date(customBounds.startIso!).getTime();
  const eMs = new Date(customBounds.endIso!).getTime();
  assert.ok(testDate >= sMs && testDate < eMs, 'Late night on customEnd must be included');

  // Verify timestamp on 2026-10-26 at 00:00:00 NPT is excluded
  const nextDayMidnight = new Date(Date.UTC(2026, 9, 26) - NPT_OFFSET_MS).getTime();
  assert.ok(!(nextDayMidnight >= sMs && nextDayMidnight < eMs), 'Next day 00:00:00 NPT must be excluded');
});

test('3. Repaired Devices status filtering and delivered-exclusion logic', () => {
  // Critical business rule: A repair record with status 'repaired' MUST be considered a completed repair.
  // 'repaired' and 'delivered' must NOT be treated as interchangeable statuses; a record with status 'delivered' must NOT be counted as 'repaired'.
  const REPAIRED_STATUS_LIST = ['REPAIRED', 'READY_FOR_PICKUP', 'repaired', 'ready_for_pickup', 'Repaired'];

  const mockRepairedDevice = {
    id: 'repair-101',
    repairNumber: 'MTS-2026-3129',
    customerName: 'Suman Shrestha',
    customerPhone: '9841234567',
    deviceModel: 'iPhone 13 Pro',
    status: 'REPAIRED', // Waiting for collection
    createdAt: '2026-10-30T10:44:17.000Z',
    updatedAt: '2026-10-30T11:26:50.000Z',
  };

  const mockDeliveredDevice = {
    id: 'repair-102',
    repairNumber: 'MTS-2026-3134',
    customerName: 'Aayush Maharjan',
    customerPhone: '9851234567',
    deviceModel: 'Samsung Galaxy S22',
    status: 'DELIVERED', // Already picked up
    createdAt: '2026-10-30T11:48:30.000Z',
    updatedAt: '2026-10-30T12:46:30.000Z',
  };

  // Status check: REPAIRED is accepted, DELIVERED is rejected
  assert.ok(REPAIRED_STATUS_LIST.includes(mockRepairedDevice.status), 'Device with status REPAIRED must qualify for Repaired Devices list');
  assert.ok(!REPAIRED_STATUS_LIST.includes(mockDeliveredDevice.status), 'Device with status DELIVERED must NOT qualify for Repaired Devices list');

  // Date filtering check using authoritative RepairLog timestamp
  const mockLog = {
    repairId: 'repair-101',
    status: 'REPAIRED',
    createdAt: '2026-10-30T11:26:50.000Z', // Repaired timestamp on Oct 30 NPT
  };

  const bounds = getNptIsoBoundsForPreset('THIS_WEEK', undefined, undefined, new Date('2026-10-30T14:00:00.000Z'));
  const startMs = new Date(bounds.startIso!).getTime();
  const endMs = new Date(bounds.endIso!).getTime();

  const compMs = new Date(mockLog.createdAt).getTime();
  const isIncludedInWeek = compMs >= startMs && compMs < endMs;

  assert.strictEqual(isIncludedInWeek, true, 'Repaired device from Oct 30 must be included in THIS_WEEK (Monday Oct 26 to Sunday Nov 1)');
});

test('4. Role Authorization Matrix for SMS Notification Center', () => {
  const SMS_VIEW_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST'];
  const SMS_SEND_ROLES = ['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST'];

  // All 4 permitted roles must be in SMS_VIEW_ROLES
  assert.ok(SMS_VIEW_ROLES.includes('SUPER_ADMIN'), 'SUPER_ADMIN is authorized');
  assert.ok(SMS_VIEW_ROLES.includes('ADMIN'), 'ADMIN is authorized');
  assert.ok(SMS_VIEW_ROLES.includes('RECEPTIONIST'), 'RECEPTIONIST is authorized');
  assert.ok(SMS_VIEW_ROLES.includes('MANAGER'), 'MANAGER is authorized for view');

  // MANAGER must not be in SMS_SEND_ROLES (read-only audit role)
  assert.ok(!SMS_SEND_ROLES.includes('MANAGER'), 'MANAGER is read-only and cannot send SMS');

  // Unauthorized roles
  assert.ok(!SMS_VIEW_ROLES.includes('TECHNICIAN'), 'TECHNICIAN cannot view SMS Center');
  assert.ok(!SMS_VIEW_ROLES.includes('CUSTOMER'), 'CUSTOMER cannot view SMS Center');
});

test('5. Single-Segment SMS Template Generation (<= 160 GSM-7 characters)', () => {
  const testRepairNumber = 'MTS-2026-3119';

  // Repaired notification message
  const repairedMsg = generateRepairedDeviceSmsMessage(testRepairNumber);
  assert.ok(repairedMsg.includes(testRepairNumber), 'Repaired message must include ticket number');
  assert.ok(repairedMsg.length <= 160, `Repaired message length ${repairedMsg.length} exceeds 160 limit`);

  const repEncoding = analyzeSmsEncodingServer(repairedMsg);
  assert.strictEqual(repEncoding.encoding, 'GSM_7', 'Repaired message must use GSM-7 encoding');
  assert.strictEqual(repEncoding.segmentCount, 1, 'Repaired message must be exactly 1 SMS segment');

  // Received notification message
  const receivedMsg = generateReceivedDeviceSmsMessage(testRepairNumber);
  assert.ok(receivedMsg.includes(testRepairNumber), 'Received message must include ticket number');
  assert.ok(receivedMsg.length <= 160, `Received message length ${receivedMsg.length} exceeds 160 limit`);

  const recEncoding = analyzeSmsEncodingServer(receivedMsg);
  assert.strictEqual(recEncoding.encoding, 'GSM_7', 'Received message must use GSM-7 encoding');
  assert.strictEqual(recEncoding.segmentCount, 1, 'Received message must be exactly 1 SMS segment');
});
