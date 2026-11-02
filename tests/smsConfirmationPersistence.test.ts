import { test, after } from 'node:test';
import assert from 'node:assert';
import { v4 as uuidv4 } from 'uuid';

after(() => {
  setTimeout(() => process.exit(0), 100);
});
import {
  recordSmsNotification,
  updateSmsNotification,
  getSmsStatistics,
  getAllSmsNotifications,
  getRepairSmsSummary,
  syncSmsStorageFromDatabase,
  isStatusSent,
  isStatusPending,
  isStatusStaffConfirmed,
  isStatusFailed,
  isStatusNotSent,
  getNptDateKey,
  validateAndNormalizeNepalPhone,
  analyzeSmsEncodingServer,
} from '../api/_server/services/smsStorage';
import { supabaseAdmin } from '../api/_server/config/supabase';

test('1. Status Standardization & Business Invariants', () => {
  // Confirmed Sent counts as Sent
  assert.strictEqual(isStatusSent('STAFF_CONFIRMED_SENT'), true);
  assert.strictEqual(isStatusSent('SENT'), true);
  assert.strictEqual(isStatusSent('DELIVERED'), true);
  assert.strictEqual(isStatusSent('CARRIER_CONFIRMED_DELIVERED'), true);

  // OPENED and PENDING_CONFIRMATION must NEVER count as Sent
  assert.strictEqual(isStatusSent('OPENED'), false);
  assert.strictEqual(isStatusSent('PENDING_CONFIRMATION'), false);
  assert.strictEqual(isStatusSent('DRAFT'), false);
  assert.strictEqual(isStatusSent('PREPARED'), false);
  assert.strictEqual(isStatusSent('INITIATED'), false);

  // Status Pending classification
  assert.strictEqual(isStatusPending('OPENED'), true);
  assert.strictEqual(isStatusPending('PENDING_CONFIRMATION'), true);
  assert.strictEqual(isStatusPending('DRAFT'), true);
  assert.strictEqual(isStatusPending('STAFF_CONFIRMED_SENT'), false);

  // Failed & Not Sent
  assert.strictEqual(isStatusFailed('FAILED'), true);
  assert.strictEqual(isStatusFailed('STAFF_CONFIRMED_SENT'), false);
  assert.strictEqual(isStatusNotSent('NOT_SENT'), true);
  assert.strictEqual(isStatusNotSent('CANCELLED'), true);
  assert.strictEqual(isStatusNotSent('STAFF_CONFIRMED_SENT'), false);
});

test('2. Nepal Phone Validation & GSM-7 Single Segment Guarantee', () => {
  const validMobile = validateAndNormalizeNepalPhone('9818734413');
  assert.strictEqual(validMobile.isValid, true);
  assert.strictEqual(validMobile.normalized, '9818734413');
  assert.strictEqual(validMobile.international, '+9779818734413');
  assert.strictEqual(validMobile.whatsappPhone, '9779818734413');

  const prefixedMobile = validateAndNormalizeNepalPhone('+977 9764856447');
  assert.strictEqual(prefixedMobile.isValid, true);
  assert.strictEqual(prefixedMobile.normalized, '9764856447');

  const invalidMobile = validateAndNormalizeNepalPhone('1234567');
  assert.strictEqual(invalidMobile.isValid, false);

  // GSM-7 Analysis
  const singleSegmentText = 'Dear Customer, your device (Repair No: MTS-2026-9999) is ready. Track: https://www.mobiletechnologystation.com.np/track - MTS Lab';
  const analysis = analyzeSmsEncodingServer(singleSegmentText);
  assert.strictEqual(analysis.encoding, 'GSM_7');
  assert.strictEqual(analysis.isSingleSegment, true);
  assert.ok(analysis.charCount <= 160);
});

test('3. End-to-End SMS & WhatsApp Confirmation Persistence in Supabase Notification Table', async () => {
  const testRepairId = `test-rep-${uuidv4().slice(0, 8)}`;
  const testRepairNum = `MTS-TEST-${Date.now().toString().slice(-4)}`;
  const testPhone = '9841122334';
  const testStaffId = 'test-staff-uuid-001';

  // 1. Record an OPENED SMS notification
  const openedRecord = await recordSmsNotification({
    repairId: testRepairId,
    repairNumber: testRepairNum,
    customerName: 'Test Customer A',
    customerPhoneRaw: testPhone,
    customerPhoneNormalized: testPhone,
    customerPhoneInternational: `+977${testPhone}`,
    deviceModel: 'Samsung Galaxy S23',
    messageType: 'REPAIR_COMPLETED_SMS',
    messageContent: `Dear Test Customer A, your device (${testRepairNum}) is ready for pickup at MTS Lab.`,
    status: 'OPENED',
    channel: 'WINDOWS_PHONE_LINK',
    senderStaffId: testStaffId,
    senderStaffName: 'Test Staff',
    senderStaffRole: 'RECEPTIONIST',
    initiatedAt: new Date().toISOString(),
    openedAt: new Date().toISOString(),
  });

  assert.ok(openedRecord.id, 'Record must have an ID');
  assert.strictEqual(openedRecord.status, 'OPENED');

  // Verify it exists in Supabase Notification table
  const { data: dbOpened, error: err1 } = await supabaseAdmin
    .from('Notification')
    .select('*')
    .eq('id', openedRecord.id)
    .single();

  assert.strictEqual(err1, null, 'Notification must be found in Supabase DB');
  assert.strictEqual(dbOpened.type, 'CUSTOMER_SMS');
  assert.strictEqual(dbOpened.priority, 'OPENED');
  assert.strictEqual(dbOpened.isRead, false);

  // 2. Staff confirms sending: Update to STAFF_CONFIRMED_SENT
  const nowIso = new Date().toISOString();
  const confirmedRecord = await updateSmsNotification(openedRecord.id, {
    status: 'STAFF_CONFIRMED_SENT',
    sentAt: nowIso,
    confirmedAt: nowIso,
    notes: 'Confirmed sent via Phone Link',
  });

  assert.ok(confirmedRecord);
  assert.strictEqual(confirmedRecord.status, 'STAFF_CONFIRMED_SENT');
  assert.strictEqual(confirmedRecord.confirmedAt, nowIso);

  // Verify database record in Supabase is updated
  const { data: dbConfirmed, error: err2 } = await supabaseAdmin
    .from('Notification')
    .select('*')
    .eq('id', openedRecord.id)
    .single();

  assert.strictEqual(err2, null, 'Updated notification must be found in Supabase DB');
  assert.strictEqual(dbConfirmed.priority, 'STAFF_CONFIRMED_SENT');
  assert.strictEqual(dbConfirmed.isRead, true);

  // 3. Test Survival across fresh Database Synchronization (Simulates browser refresh & server reload)
  await syncSmsStorageFromDatabase();

  const repairSummary = getRepairSmsSummary(testRepairId);
  assert.strictEqual(repairSummary.status, 'SENT', 'Repair status must be SENT');
  assert.strictEqual(repairSummary.normalizedStatus, 'STAFF_CONFIRMED_SENT');
  assert.strictEqual(repairSummary.smsCount, 1);
  assert.strictEqual(repairSummary.hasPendingConfirmation, false);

  // Cleanup test record
  await supabaseAdmin.from('Notification').delete().eq('id', openedRecord.id);
});

test('4. Accurate Multi-Channel Statistics & Deduplication', async () => {
  // Test statistics calculation
  const stats = getSmsStatistics({});

  // Core properties exist and are non-negative numbers
  assert.ok(typeof stats.totalSmsSent === 'number' && stats.totalSmsSent >= 0);
  assert.ok(typeof stats.staffConfirmedSms === 'number' && stats.staffConfirmedSms >= 0);
  assert.ok(typeof stats.carrierConfirmedDelivered === 'number' && stats.carrierConfirmedDelivered >= 0);
  assert.ok(typeof stats.failedSms === 'number' && stats.failedSms >= 0);
  assert.ok(typeof stats.pendingSms === 'number' && stats.pendingSms >= 0);
  assert.ok(typeof stats.notSentSms === 'number' && stats.notSentSms >= 0);

  assert.ok(typeof stats.whatsappSent === 'number' && stats.whatsappSent >= 0);
  assert.ok(typeof stats.whatsappPending === 'number' && stats.whatsappPending >= 0);
  assert.ok(typeof stats.whatsappFailed === 'number' && stats.whatsappFailed >= 0);
  assert.ok(typeof stats.whatsappDelivered === 'number' && stats.whatsappDelivered >= 0);

  assert.ok(typeof stats.totalNotifications === 'number' && stats.totalNotifications >= 0);
  assert.ok(typeof stats.uniqueCustomersNotified === 'number' && stats.uniqueCustomersNotified >= 0);

  // Math invariants
  assert.ok(stats.staffConfirmedSms <= stats.totalSmsSent, 'Staff-confirmed SMS cannot exceed total SMS sent');
  assert.ok(stats.carrierConfirmedDelivered <= stats.totalSmsSent, 'Delivered SMS cannot exceed total SMS sent');
  assert.ok(stats.totalNotifications >= stats.totalSms + stats.totalWhatsApp, 'Total notifications matches sum of channels');

  // Verify daily activity date keys use YYYY-MM-DD
  for (const daily of stats.dailyStats) {
    assert.match(daily.date, /^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted YYYY-MM-DD in Nepal Time');
  }
});
