import assert from 'assert';
import {
  validateAndNormalizeNepalPhone,
  generateRepairCompletedSmsMessage,
  recordSmsNotification,
  updateSmsNotification,
  getSmsNotificationsForRepair,
  getRepairSmsSummary,
  getAllRepairSmsSummaries,
} from '../api/_server/services/smsStorage';

async function runTests() {
  console.log('--- STARTING CUSTOMER SMS SYSTEM AUDIT & TESTS ---');

  // Test 1: Phone Validation & Normalization
  console.log('Test 1: Nepal Phone Validation & Normalization');
  const valid1 = validateAndNormalizeNepalPhone('9841234567');
  assert.strictEqual(valid1.isValid, true);
  assert.strictEqual(valid1.normalized, '9841234567');
  assert.strictEqual(valid1.international, '+9779841234567');

  const valid2 = validateAndNormalizeNepalPhone('+977 9801234567');
  assert.strictEqual(valid2.isValid, true);
  assert.strictEqual(valid2.normalized, '9801234567');
  assert.strictEqual(valid2.international, '+9779801234567');

  const valid3 = validateAndNormalizeNepalPhone('09741234567'); // Leading 0
  assert.strictEqual(valid3.isValid, true);
  assert.strictEqual(valid3.normalized, '9741234567');

  const invalid1 = validateAndNormalizeNepalPhone('12345');
  assert.strictEqual(invalid1.isValid, false);

  const invalid2 = validateAndNormalizeNepalPhone('');
  assert.strictEqual(invalid2.isValid, false);
  console.log('  ✓ Phone validation checks passed.');

  // Test 2: Standard Message Template Privacy & Content
  console.log('Test 2: Standard Message Template Privacy');
  const msg = generateRepairCompletedSmsMessage({
    customerName: 'Aarav Shrestha',
    deviceModel: 'iPhone 13 Pro Max',
    repairNumber: 'MTS-2026-TEST1',
  });
  console.log('  Generated SMS:', msg);
  assert(msg.includes('Aarav Shrestha'), 'Message must contain customer name');
  assert(msg.includes('iPhone 13 Pro Max'), 'Message must contain device model');
  assert(msg.includes('MTS-2026-TEST1'), 'Message must contain repair number');
  assert(!msg.includes('technician'), 'Message must NOT contain internal technician details');
  assert(!msg.includes('password'), 'Message must NOT contain passwords');
  assert(!msg.includes('@'), 'Message must NOT contain internal emails');
  console.log('  ✓ Privacy and template checks passed.');

  // Test 3: Single SMS Life Cycle (Initiate -> Confirm)
  console.log('Test 3: Single SMS Lifecycle (One SMS per Action)');
  const testRepairId = `test-repair-${Date.now()}`;
  const testRepairNum = `MTS-SMS-${Date.now()}`;

  // Initial Summary should be NOT_SENT
  const initialSummary = getRepairSmsSummary(testRepairId);
  assert.strictEqual(initialSummary.status, 'NOT_SENT');
  assert.strictEqual(initialSummary.count, 0);
  assert.strictEqual(initialSummary.totalAttempts, 0);
  console.log('  ✓ Initial summary is NOT_SENT with count 0.');

  // Step 3a: Staff clicks "Open Google Messages" -> records INITIATED (Attempt 1)
  const initiatedRecord = await recordSmsNotification({
    repairId: testRepairId,
    repairNumber: testRepairNum,
    customerName: 'Aarav Shrestha',
    customerPhoneRaw: '9841234567',
    customerPhoneNormalized: '9841234567',
    customerPhoneInternational: '+9779841234567',
    deviceModel: 'iPhone 13 Pro Max',
    messageType: 'REPAIR_COMPLETED_SMS',
    messageContent: msg,
    status: 'INITIATED',
    channel: 'GOOGLE_MESSAGES_WEB',
    senderStaffId: 'staff-001',
    senderStaffName: 'Receptionist Sunita',
    senderStaffRole: 'RECEPTIONIST',
    initiatedAt: new Date().toISOString(),
  });

  const initiatedSummary = getRepairSmsSummary(testRepairId);
  assert.strictEqual(initiatedSummary.status, 'INITIATED');
  assert.strictEqual(initiatedSummary.count, 0); // Not confirmed sent yet
  assert.strictEqual(initiatedSummary.totalAttempts, 1);
  console.log('  ✓ Initiated summary reflects INITIATED with count 0, attempts 1.');

  // Step 3b: Staff confirms send in Google Messages -> updates existing record to SENT
  const updatedRecord = await updateSmsNotification(initiatedRecord.id, {
    status: 'SENT',
    sentAt: new Date().toISOString(),
    confirmedAt: new Date().toISOString(),
    notes: 'Staff confirmed manual send in Google Messages',
  });
  assert(updatedRecord, 'Record must be updated');
  assert.strictEqual(updatedRecord?.status, 'SENT');

  const sentSummary = getRepairSmsSummary(testRepairId);
  assert.strictEqual(sentSummary.status, 'SENT');
  assert.strictEqual(sentSummary.count, 1, 'Confirmed sent count must be exactly 1');
  assert.strictEqual(sentSummary.totalAttempts, 1, 'Total attempts must be exactly 1 (no duplicate record)');
  console.log('  ✓ Confirmed send summary reflects SENT with Messages Sent = 1.');

  // Test 4: Additional Send Later (Second manual follow-up)
  console.log('Test 4: Additional Manual Send Later');
  const secondRecord = await recordSmsNotification({
    repairId: testRepairId,
    repairNumber: testRepairNum,
    customerName: 'Aarav Shrestha',
    customerPhoneRaw: '9841234567',
    customerPhoneNormalized: '9841234567',
    customerPhoneInternational: '+9779841234567',
    deviceModel: 'iPhone 13 Pro Max',
    messageType: 'REPAIR_COMPLETED_SMS',
    messageContent: msg,
    status: 'SENT',
    channel: 'GOOGLE_MESSAGES_WEB',
    senderStaffId: 'staff-001',
    senderStaffName: 'Receptionist Sunita',
    senderStaffRole: 'RECEPTIONIST',
    initiatedAt: new Date().toISOString(),
    sentAt: new Date().toISOString(),
    confirmedAt: new Date().toISOString(),
  });

  const secondSummary = getRepairSmsSummary(testRepairId);
  assert.strictEqual(secondSummary.status, 'SENT');
  assert.strictEqual(secondSummary.count, 2, 'Confirmed sent count must now be 2');
  assert.strictEqual(secondSummary.totalAttempts, 2, 'Total attempts must now be 2');
  console.log('  ✓ Additional manual send correctly incremented count to 2.');

  // Test 5: Summary Mapping by repairNumber as well
  console.log('Test 5: Lookup by repairNumber');
  const byNumberSummary = getRepairSmsSummary(testRepairNum);
  assert.strictEqual(byNumberSummary.count, 2);
  assert.strictEqual(byNumberSummary.status, 'SENT');
  console.log('  ✓ Lookup by repairNumber returned identical summary.');

  // Test 6: getAllRepairSmsSummaries
  console.log('Test 6: Batch summaries retrieval');
  const allSummaries = getAllRepairSmsSummaries();
  assert(allSummaries[testRepairId], 'Summary map must contain test repair ID');
  assert(allSummaries[testRepairNum], 'Summary map must contain test repair number');
  assert.strictEqual(allSummaries[testRepairId].count, 2);
  console.log('  ✓ All summaries retrieval passed.');

  console.log('--- ALL SMS SYSTEM TESTS PASSED SUCCESSFULLY! ---');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
