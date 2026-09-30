import assert from 'assert';
import http from 'http';
import jwt from 'jsonwebtoken';
import { createApp } from '../api/_server/app';
import { config, supabaseAdmin } from '../api/_server/config/supabase';

async function testApi() {
  console.log('--- STARTING CUSTOMER SMS API TEST SUITE ---');
  const app = createApp();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  // Find an admin user in DB
  const { data: adminUsers } = await supabaseAdmin
    .from('User')
    .select('id, name, email, role')
    .in('role', ['SUPER_ADMIN', 'ADMIN', 'MANAGER'])
    .limit(1);

  const admin = adminUsers?.[0] || {
    id: 'user-admin-001',
    name: 'Amit Sharma',
    email: 'amitsharma6401790@gmail.com',
    role: 'SUPER_ADMIN',
  };

  // Create auth token for SUPER_ADMIN
  const adminToken = jwt.sign(
    {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
    },
    config.jwtSecret,
    { expiresIn: '1h' }
  );

  try {
    // 1. Test GET /api/repairs/sms-summaries
    console.log('Testing GET /api/repairs/sms-summaries...');
    const summariesRes = await fetch(`${baseUrl}/api/repairs/sms-summaries`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    assert.strictEqual(summariesRes.status, 200);
    const summariesBody = await summariesRes.json();
    assert(typeof summariesBody === 'object', 'Response must be an object');
    console.log('  ✓ GET /api/repairs/sms-summaries returned 200 OK.');

    // 2. Test GET /api/repairs
    console.log('Testing GET /api/repairs attached smsSummary...');
    const repairsRes = await fetch(`${baseUrl}/api/repairs`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    assert.strictEqual(repairsRes.status, 200);
    const repairsBody = (await repairsRes.json()) as any;
    assert(Array.isArray(repairsBody), 'Repairs response must be an array');
    assert(repairsBody.length > 0, 'Database should have repair records');

    const first = repairsBody[0];
    assert(first.smsSummary, 'Each repair in list must have smsSummary attached');
    assert(typeof first.smsSummary.count === 'number', 'smsSummary.count must be a number');
    assert(['NOT_SENT', 'INITIATED', 'SENT'].includes(first.smsSummary.status), 'smsSummary.status must be valid');
    console.log(`  ✓ GET /api/repairs verified: repair #${first.repairNumber} has status=${first.smsSummary.status}, count=${first.smsSummary.count}`);

    // Find or create a REPAIRED repair to test full workflow
    // Let's check if there is a repair with REPAIRED status or update one temporarily
    const targetRepair = repairsBody.find((r: any) => ['REPAIRED', 'READY_FOR_PICKUP'].includes(r.status)) || first;

    // Ensure status is REPAIRED for test
    await supabaseAdmin.from('Repair').update({ status: 'REPAIRED', customerPhone: '9841234567' }).eq('id', targetRepair.id);

    // 3. Test GET /api/repairs/:id/sms-status
    console.log(`Testing GET /api/repairs/${targetRepair.id}/sms-status...`);
    const statusRes = await fetch(`${baseUrl}/api/repairs/${targetRepair.id}/sms-status`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(statusRes.status, 200);
    const statusData = (await statusRes.json()) as any;
    assert.strictEqual(statusData.eligible, true);
    assert.strictEqual(statusData.phoneValidation.isValid, true);
    assert(statusData.defaultMessage.includes('completed'), 'Template must include completed');
    console.log('  ✓ GET /api/repairs/:id/sms-status returned eligible and valid phone.');

    // 4. Test POST /api/repairs/:id/send-sms (action: INITIATED)
    console.log(`Testing POST /api/repairs/${targetRepair.id}/send-sms (initiating SMS)...`);
    const sendRes1 = await fetch(`${baseUrl}/api/repairs/${targetRepair.id}/send-sms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        action: 'INITIATED',
        channel: 'GOOGLE_MESSAGES_WEB',
        notes: 'Opened Google Messages test session',
      }),
    });
    assert.strictEqual(sendRes1.status, 201);
    const sendData1 = (await sendRes1.json()) as any;
    assert.strictEqual(sendData1.success, true);
    assert.strictEqual(sendData1.record.status, 'INITIATED');
    const initiatedRecordId = sendData1.record.id;
    console.log('  ✓ Successfully initiated single SMS. Record ID:', initiatedRecordId);

    // 5. Test debounce protection against rapid double-clicks (within 2 seconds)
    console.log('Testing rapid double-click debounce protection...');
    const duplicateRes = await fetch(`${baseUrl}/api/repairs/${targetRepair.id}/send-sms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        action: 'INITIATED',
        channel: 'GOOGLE_MESSAGES_WEB',
        notes: 'Opened Google Messages test session',
      }),
    });
    assert(duplicateRes.status === 200 || duplicateRes.status === 201);
    const duplicateData = (await duplicateRes.json()) as any;
    assert.strictEqual(duplicateData.record.id, initiatedRecordId, 'Must return the same record, preventing duplicate');
    console.log('  ✓ Debounce protection verified: no duplicate record created on rapid re-click.');

    // 6. Test confirm-sms / upgrade to SENT with smsRecordId
    console.log('Testing confirm-sms (marking initiated SMS as SENT)...');
    const confirmRes = await fetch(`${baseUrl}/api/repairs/${targetRepair.id}/confirm-sms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        smsRecordId: initiatedRecordId,
        notes: 'Staff confirmed manual send in Google Messages',
      }),
    });
    assert.strictEqual(confirmRes.status, 200);
    const confirmData = (await confirmRes.json()) as any;
    assert.strictEqual(confirmData.success, true);
    assert.strictEqual(confirmData.smsSummary.status, 'SENT');
    assert.strictEqual(confirmData.smsSummary.count, 1, 'Messages sent count must be exactly 1');
    console.log('  ✓ Confirm SMS verified: exactly 1 message sent recorded.');

    // 7. Test that GET /api/repairs immediately reflects the updated SMS status and count = 1
    console.log('Testing GET /api/repairs reflects updated SMS count = 1...');
    const checkRepairsRes = await fetch(`${baseUrl}/api/repairs`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const checkRepairs = (await checkRepairsRes.json()) as any[];
    const updatedRep = checkRepairs.find((r) => r.id === targetRepair.id);
    assert(updatedRep, 'Updated repair must be found in list');
    assert.strictEqual(updatedRep.smsSummary.status, 'SENT');
    assert.strictEqual(updatedRep.smsSummary.count, 1);
    assert(updatedRep.smsSummary.lastSentAt, 'lastSentAt must be populated');
    console.log(`  ✓ GET /api/repairs verified: repair #${updatedRep.repairNumber} has SMS status=${updatedRep.smsSummary.status}, count=${updatedRep.smsSummary.count}, lastSentAt=${updatedRep.smsSummary.lastSentAt}`);

    console.log('--- ALL SMS API TESTS PASSED SUCCESSFULLY! ---');
    server.close();
    process.exit(0);
  } catch (err) {
    server.close();
    console.error('API TEST FAILED:', err);
    process.exit(1);
  }
}

testApi();
