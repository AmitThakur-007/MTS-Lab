import assert from 'assert';
import http from 'http';
import jwt from 'jsonwebtoken';
import { createApp } from '../api/_server/app';
import { config, supabaseAdmin } from '../api/_server/config/supabase';
import {
  generateRepairCompletedSmsMessage,
  recordSmsNotification,
  updateSmsNotification,
} from '../api/_server/services/smsStorage';

async function test160CharLimit() {
  console.log('=== STARTING 160-CHARACTER MAXIMUM SMS AUDIT & TEST ===\n');

  // ----------------------------------------------------
  // Test 1: Template Length & Content Auditing
  // ----------------------------------------------------
  console.log('Test 1: Template generation with standard and extreme lengths');
  const standardMsg = generateRepairCompletedSmsMessage({
    customerName: 'Aarav Shrestha',
    deviceModel: 'iPhone 13 Pro Max',
    repairNumber: 'MTS-2026-211',
  });
  console.log(`  Standard message (${standardMsg.length} chars):\n  "${standardMsg}"`);
  assert(standardMsg.length <= 160, `Standard template must be <= 160 chars, got ${standardMsg.length}`);
  assert(standardMsg.includes('Aarav Shrestha'), 'Must include customer name');
  assert(standardMsg.includes('iPhone 13 Pro Max'), 'Must include device model');
  assert(standardMsg.includes('MTS-2026-211'), 'Must include repair number');
  assert(standardMsg.includes('ready for pickup') || standardMsg.includes('repaired'), 'Must include repair completed/ready');
  assert(standardMsg.includes('MTS Lab'), 'Must include MTS Lab');

  // Test extreme lengths
  const extremeMsg = generateRepairCompletedSmsMessage({
    customerName: 'Dr. Ram Chandra Bahadur Shrestha Junior of Lalitpur Patan',
    deviceModel: 'Samsung Galaxy S24 Ultra Titanium Gray 1TB Edition Special',
    repairNumber: 'MTS-2026-99999-EXTREME',
  });
  console.log(`  Extreme length message (${extremeMsg.length} chars):\n  "${extremeMsg}"`);
  assert(extremeMsg.length <= 160, `Extreme message must be <= 160 chars, got ${extremeMsg.length}`);
  console.log('  ✓ Template generation is strictly <= 160 characters in all cases.\n');

  // ----------------------------------------------------
  // Test 2: Storage Layer 160-char Hard Validation
  // ----------------------------------------------------
  console.log('Test 2: Storage layer rejects > 160 chars and accepts <= 160 chars');
  const valid160 = 'A'.repeat(160);
  const invalid161 = 'A'.repeat(161);

  // 160 characters should succeed
  const validRecord = await recordSmsNotification({
    repairId: 'test-160-char-repair',
    repairNumber: 'MTS-160-VALID',
    customerName: 'Tester',
    customerPhoneRaw: '9841234567',
    customerPhoneNormalized: '9841234567',
    customerPhoneInternational: '+9779841234567',
    deviceModel: 'Phone',
    messageType: 'REPAIR_COMPLETED_SMS',
    messageContent: valid160,
    status: 'INITIATED',
    channel: 'GOOGLE_MESSAGES_WEB',
    senderStaffId: 'staff-1',
    senderStaffName: 'Admin',
    senderStaffRole: 'ADMIN',
    initiatedAt: new Date().toISOString(),
  });
  assert(validRecord.id, 'Record with 160 characters must be stored successfully');
  console.log('  ✓ Record with exactly 160 chars accepted.');

  // 161 characters must be rejected
  let threwOnRecord = false;
  try {
    await recordSmsNotification({
      repairId: 'test-161-char-repair',
      repairNumber: 'MTS-161-INVALID',
      customerName: 'Tester',
      customerPhoneRaw: '9841234567',
      customerPhoneNormalized: '9841234567',
      customerPhoneInternational: '+9779841234567',
      deviceModel: 'Phone',
      messageType: 'REPAIR_COMPLETED_SMS',
      messageContent: invalid161,
      status: 'INITIATED',
      channel: 'GOOGLE_MESSAGES_WEB',
      senderStaffId: 'staff-1',
      senderStaffName: 'Admin',
      senderStaffRole: 'ADMIN',
      initiatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    threwOnRecord = true;
    assert(err.message.includes('160 characters'), 'Error must mention 160 characters');
  }
  assert(threwOnRecord, 'recordSmsNotification must throw on 161 characters');
  console.log('  ✓ Record with 161 chars rejected by storage layer.');

  // Update with 161 characters must also be rejected
  let threwOnUpdate = false;
  try {
    await updateSmsNotification(validRecord.id, {
      messageContent: invalid161,
    });
  } catch (err: any) {
    threwOnUpdate = true;
    assert(err.message.includes('160 characters'), 'Update error must mention 160 characters');
  }
  assert(threwOnUpdate, 'updateSmsNotification must throw on 161 characters');
  console.log('  ✓ Update with 161 chars rejected by storage layer.\n');

  // ----------------------------------------------------
  // Test 3: Backend API /send-sms HTTP Endpoint Validation
  // ----------------------------------------------------
  console.log('Test 3: HTTP API validation (/api/repairs/:id/send-sms)');
  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // Find an admin user in DB for auth
    const { data: adminUsers } = await supabaseAdmin
      .from('User')
      .select('id, name, email, role')
      .in('role', ['SUPER_ADMIN', 'ADMIN', 'MANAGER'])
      .limit(1);

    const admin = adminUsers?.[0] || {
      id: 'admin-160-tester',
      name: 'Amit Sharma',
      email: 'amitsharma6401790@gmail.com',
      role: 'SUPER_ADMIN',
    };

    const token = jwt.sign(
      {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    // Find or create an eligible REPAIRED repair ticket
    let testRepair: any = null;
    const { data: repairs } = await supabaseAdmin
      .from('Repair')
      .select('id, repairNumber, customerName, customerPhone, status')
      .eq('status', 'REPAIRED')
      .limit(1);

    if (repairs && repairs.length > 0) {
      testRepair = repairs[0];
    } else {
      // Create a test repair
      const newId = `test-sms-160-${Date.now()}`;
      const { data: created } = await supabaseAdmin.from('Repair').insert([
        {
          id: newId,
          repairNumber: `MTS-160-${Date.now().toString().slice(-4)}`,
          customerName: 'Test Customer 160',
          customerPhone: '9841234567',
          deviceBrand: 'Apple',
          deviceModel: 'iPhone 13',
          status: 'REPAIRED',
          problemDescription: 'Screen issue fixed',
          createdAt: new Date().toISOString(),
        }
      ]).select().single();
      testRepair = created;
    }

    assert(testRepair, 'Must have a repair ticket for API testing');

    // 3a: Send request with 161 characters -> Expect 400 Bad Request
    const resOverLimit = await fetch(`${baseUrl}/api/repairs/${testRepair.id}/send-sms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        customMessage: 'X'.repeat(161),
        channel: 'GOOGLE_MESSAGES_WEB',
        action: 'INITIATED',
      }),
    });

    assert.strictEqual(resOverLimit.status, 400, `Expected 400 for 161 chars, got ${resOverLimit.status}`);
    const overLimitJson = (await resOverLimit.json()) as any;
    console.log('  Rejected 161 chars response:', overLimitJson);
    assert(overLimitJson.error.includes('160 characters'), 'Error message must state 160-character maximum');
    console.log('  ✓ API correctly returned 400 Bad Request for message > 160 chars.');

    // 3b: Send request with valid single SMS message <= 160 characters -> Expect 200/201 Success
    const validMessage = `Dear ${testRepair.customerName}, your iPhone (Repair #${testRepair.repairNumber}) is repaired & ready for pickup at MTS Lab.`;
    assert(validMessage.length <= 160);

    const resValid = await fetch(`${baseUrl}/api/repairs/${testRepair.id}/send-sms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        customMessage: validMessage,
        channel: 'GOOGLE_MESSAGES_WEB',
        action: 'INITIATED',
      }),
    });

    assert([200, 201].includes(resValid.status), `Expected 200/201 for valid SMS, got ${resValid.status}`);
    const validJson = (await resValid.json()) as any;
    assert(validJson.record, 'Must return created SMS record');
    assert.strictEqual(validJson.record.messageContent.length, validMessage.length);
    console.log(`  ✓ API accepted valid single SMS (${validMessage.length} chars).`);

    // 3c: Accidental double-send test: immediate repeat send with same content
    const resRepeat = await fetch(`${baseUrl}/api/repairs/${testRepair.id}/send-sms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        customMessage: validMessage,
        channel: 'GOOGLE_MESSAGES_WEB',
        action: 'INITIATED',
      }),
    });

    const repeatJson = (await resRepeat.json()) as any;
    assert(repeatJson.record, 'Must return existing record');
    // IDs should match, preventing duplicate records
    assert.strictEqual(repeatJson.record.id, validJson.record.id, 'Must reuse existing record on rapid double-submit');
    console.log('  ✓ Double-click protection verified: returned existing record without creating duplicate.');

    // 3d: Confirm sent action -> upgrades record to SENT
    const resConfirm = await fetch(`${baseUrl}/api/repairs/${testRepair.id}/send-sms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        smsRecordId: validJson.record.id,
        customMessage: validMessage,
        channel: 'GOOGLE_MESSAGES_WEB',
        action: 'SENT',
      }),
    });

    const confirmJson = (await resConfirm.json()) as any;
    assert.strictEqual(confirmJson.record.status, 'SENT');
    assert(confirmJson.smsSummary.count >= 1, 'SMS summary count must increment');
    console.log(`  ✓ SMS send confirmed! Messages Sent count: ${confirmJson.smsSummary.count}.`);

  } finally {
    server.close();
  }

  console.log('\n=== ALL 160-CHARACTER MAXIMUM SINGLE SMS TESTS PASSED SUCCESSFULLY! ===');
  process.exit(0);
}

test160CharLimit().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
