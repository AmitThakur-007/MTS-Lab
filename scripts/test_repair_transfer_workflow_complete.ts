import jwt from 'jsonwebtoken';
import { createApp } from '../api/_server/app';
import { config, supabaseAdmin } from '../api/_server/config/supabase';

async function runTests() {
  console.log('====================================================');
  console.log('MTS LAB: TECHNICIAN REPAIR TRANSFER END-TO-END AUDIT');
  console.log('====================================================\n');

  // 1. Fetch real technicians and manager from database
  const { data: users, error: userErr } = await supabaseAdmin
    .from('User')
    .select('id, name, email, role, isActive, deletedAt')
    .eq('isActive', true)
    .is('deletedAt', null)
    .in('role', ['TECHNICIAN', 'LEAD_TECHNICIAN', 'MANAGER', 'SUPER_ADMIN', 'ADMIN']);

  if (userErr || !users || users.length < 2) {
    throw new Error('Need at least 2 users in DB to test transfer workflow.');
  }

  const techs = users.filter(u => ['TECHNICIAN', 'LEAD_TECHNICIAN'].includes(u.role));
  let techA = techs[0];
  let techB = techs[1];
  const manager = users.find(u => ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(u.role)) || users[0];

  if (!techB) {
    techB = users.find(u => u.id !== techA.id)!;
  }

  console.log(`✓ Tech A: ${techA.name} (${techA.id}) [Role: ${techA.role}]`);
  console.log(`✓ Tech B: ${techB.name} (${techB.id}) [Role: ${techB.role}]`);
  console.log(`✓ Manager: ${manager.name} (${manager.id}) [Role: ${manager.role}]`);

  // Generate JWT tokens
  const tokenTechA = jwt.sign(
    { id: techA.id, email: techA.email, name: techA.name, role: techA.role },
    config.jwtSecret,
    { expiresIn: '1h' }
  );

  const tokenTechB = jwt.sign(
    { id: techB.id, email: techB.email, name: techB.name, role: techB.role },
    config.jwtSecret,
    { expiresIn: '1h' }
  );

  const tokenManager = jwt.sign(
    { id: manager.id, email: manager.email, name: manager.name, role: manager.role },
    config.jwtSecret,
    { expiresIn: '1h' }
  );

  // 2. Find or assign a test repair to Tech A
  const { data: testRepairs } = await supabaseAdmin
    .from('Repair')
    .select('id, repairNumber, status, technicianId, deviceBrand, deviceModel')
    .not('status', 'in', '("DELIVERED","CANCELLED","COMPLETED","CLOSED")')
    .limit(1);

  if (!testRepairs || testRepairs.length === 0) {
    throw new Error('No active repairs found to test transfer.');
  }

  const repair = testRepairs[0];
  // Assign repair to Tech A for testing
  await supabaseAdmin
    .from('Repair')
    .update({ technicianId: techA.id, status: 'IN_PROCESS' })
    .eq('id', repair.id);

  console.log(`✓ Test Repair Ticket: #${repair.repairNumber} (${repair.id}) assigned to Tech A\n`);

  // Setup express test server / supertest simulation
  const app = createApp();
  const server = app.listen(3456);

  async function apiCall(method: string, path: string, token: string, body?: any) {
    const res = await fetch(`http://127.0.0.1:3456${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, data: json };
  }

  try {
    // TEST 1: Validation - Same technician as target
    console.log('[TEST 1] Validation: Reject transferring to self...');
    const res1 = await apiCall('POST', `/api/repairs/${repair.id}/transfer-request`, tokenTechA, {
      targetTechnicianId: techA.id,
      reason: 'Testing self transfer',
    });
    console.log(`Status: ${res1.status}, Error:`, res1.data.error);
    if (res1.status !== 400) throw new Error('Expected 400 when transferring to self');
    console.log('✓ TEST 1 PASSED\n');

    // TEST 2: Validation - Short reason
    console.log('[TEST 2] Validation: Reject short reason...');
    const res2 = await apiCall('POST', `/api/repairs/${repair.id}/transfer-request`, tokenTechA, {
      targetTechnicianId: techB.id,
      reason: 'a',
    });
    console.log(`Status: ${res2.status}, Error:`, res2.data.error);
    if (res2.status !== 400) throw new Error('Expected 400 for short reason');
    console.log('✓ TEST 2 PASSED\n');

    // TEST 3: Validation - Tech B cannot request transfer of Tech A repair
    console.log('[TEST 3] Validation: Reject unauthorized tech transfer request...');
    const res3 = await apiCall('POST', `/api/repairs/${repair.id}/transfer-request`, tokenTechB, {
      targetTechnicianId: techA.id,
      reason: 'Tech B trying to transfer Tech A job',
    });
    console.log(`Status: ${res3.status}, Error:`, res3.data.error);
    if (res3.status !== 403) throw new Error('Expected 403 when unassigned tech requests transfer');
    console.log('✓ TEST 3 PASSED\n');

    // TEST 4: Valid Transfer Request from Tech A to Tech B
    console.log('[TEST 4] Valid Transfer Request from Tech A to Tech B...');
    const res4 = await apiCall('POST', `/api/repairs/${repair.id}/transfer-request`, tokenTechA, {
      targetTechnicianId: techB.id,
      reason: 'Need specialized oscilloscope diagnostic and thermal camera.',
    });
    console.log(`Status: ${res4.status}, Success:`, res4.data.success);
    if (res4.status !== 201 || !res4.data.transferRequest) {
      throw new Error(`Failed to create transfer request: ${JSON.stringify(res4.data)}`);
    }
    const transferReq1 = res4.data.transferRequest;
    console.log(`✓ Transfer Request Created: ID=${transferReq1.id}, Status=${transferReq1.status}`);

    // Verify Repair remains with Tech A (NOT reallocated yet)
    const { data: checkRep1 } = await supabaseAdmin.from('Repair').select('technicianId').eq('id', repair.id).single();
    if (checkRep1?.technicianId !== techA.id) {
      throw new Error(`CRITICAL: Repair was immediately reassigned before receiver accepted! Expected ${techA.id}, got ${checkRep1?.technicianId}`);
    }
    console.log(`✓ Repair #${repair.repairNumber} remains safely assigned to sender (Tech A) until acceptance`);
    console.log('✓ TEST 4 PASSED\n');

    // TEST 5: Duplicate Prevention
    console.log('[TEST 5] Duplicate Transfer Request Prevention...');
    const res5 = await apiCall('POST', `/api/repairs/${repair.id}/transfer-request`, tokenTechA, {
      targetTechnicianId: techB.id,
      reason: 'Attempting duplicate request',
    });
    console.log(`Status: ${res5.status}, Error:`, res5.data.error);
    if (res5.status !== 400) throw new Error('Expected 400 when duplicate pending request is made');
    console.log('✓ TEST 5 PASSED\n');

    // TEST 6: Fetch Transfer Requests for Tech B
    console.log('[TEST 6] Fetch Transfer Requests for Tech B (GET /api/repair-transfers/my-requests)...');
    const res6 = await apiCall('GET', '/api/repair-transfers/my-requests', tokenTechB);
    console.log(`Status: ${res6.status}, Pending count: ${res6.data.pendingIncomingCount}, Incoming count: ${res6.data.incoming?.length}`);
    if (res6.status !== 200 || !res6.data.incoming || res6.data.incoming.length === 0) {
      throw new Error('Tech B did not receive incoming transfer request in my-requests');
    }
    console.log('✓ TEST 6 PASSED\n');

    // TEST 7: Decline / Reject Workflow
    console.log('[TEST 7] Decline / Reject Workflow...');
    const res7 = await apiCall('POST', `/api/repair-transfers/${transferReq1.id}/respond`, tokenTechB, {
      action: 'REJECT',
      responseNote: 'Workstation fully booked with 3 micro-soldering jobs today.',
    });
    console.log(`Status: ${res7.status}, Response:`, res7.data);
    if (res7.status !== 200) throw new Error('Failed to decline transfer request');

    // Verify Repair still assigned to Tech A
    const { data: checkRep2 } = await supabaseAdmin.from('Repair').select('technicianId').eq('id', repair.id).single();
    if (checkRep2?.technicianId !== techA.id) {
      throw new Error(`Repair was modified on reject! Expected ${techA.id}, got ${checkRep2?.technicianId}`);
    }
    console.log(`✓ Repair #${repair.repairNumber} remains assigned to Tech A after decline`);
    console.log('✓ TEST 7 PASSED\n');

    // TEST 8: Submit New Request and Accept Workflow (Atomic Reassignment)
    console.log('[TEST 8] Submit New Request and Accept Workflow...');
    const res8 = await apiCall('POST', `/api/repairs/${repair.id}/transfer-request`, tokenTechA, {
      targetTechnicianId: techB.id,
      reason: 'Transferring motherboard diagnostic case to Tech B.',
    });
    if (res8.status !== 201) throw new Error(`Failed to submit second transfer request: ${JSON.stringify(res8.data)}`);
    const transferReq2 = res8.data.transferRequest;
    console.log(`✓ Second Transfer Request Created: ID=${transferReq2.id}`);

    // Tech B Accepts
    const res9 = await apiCall('POST', `/api/repair-transfers/${transferReq2.id}/respond`, tokenTechB, {
      action: 'ACCEPT',
      responseNote: 'Accepted. Will inspect this afternoon.',
    });
    console.log(`Status: ${res9.status}, Accept Result:`, res9.data?.message);
    if (res9.status !== 200) throw new Error('Failed to accept transfer request');

    // Verify Repair is now atomically reassigned to Tech B in DB
    const { data: checkRep3 } = await supabaseAdmin.from('Repair').select('technicianId, assignedByName').eq('id', repair.id).single();
    if (checkRep3?.technicianId !== techB.id) {
      throw new Error(`CRITICAL: Repair was NOT reassigned to Tech B! Got ${checkRep3?.technicianId}`);
    }
    console.log(`✓ Repair #${repair.repairNumber} atomically reassigned to Tech B (${techB.name})!`);
    console.log('✓ TEST 8 PASSED\n');

    // TEST 9: Prevent Double Response
    console.log('[TEST 9] Prevent Double Acceptance / Response...');
    const res10 = await apiCall('POST', `/api/repair-transfers/${transferReq2.id}/respond`, tokenTechB, {
      action: 'ACCEPT',
    });
    console.log(`Status: ${res10.status}, Error:`, res10.data.error);
    if (res10.status !== 400) throw new Error('Expected 400 when attempting to respond to already accepted transfer');
    console.log('✓ TEST 9 PASSED\n');

    // TEST 10: Manager Direct Transfer
    console.log('[TEST 10] Manager Direct Transfer (POST /api/repairs/:id/transfer)...');
    const res11 = await apiCall('POST', `/api/repairs/${repair.id}/transfer`, tokenManager, {
      targetTechnicianId: techA.id,
      reason: 'Manager reassigning job back to Tech A for final assembly.',
      priority: 'HIGH',
    });
    console.log(`Status: ${res11.status}, Manager Transfer Result:`, res11.data?.message);
    if (res11.status !== 200) throw new Error('Failed manager direct transfer');

    const { data: checkRep4 } = await supabaseAdmin.from('Repair').select('technicianId, priority').eq('id', repair.id).single();
    if (checkRep4?.technicianId !== techA.id) {
      throw new Error(`Manager transfer failed to reassign repair to Tech A! Got ${checkRep4?.technicianId}`);
    }
    console.log(`✓ Repair #${repair.repairNumber} successfully reassigned by Manager to Tech A!`);
    console.log('✓ TEST 10 PASSED\n');

    console.log('====================================================');
    console.log('🎉 ALL 10 TESTS PASSED WITH 100% SUCCESS!');
    console.log('====================================================');
  } finally {
    server.close();
  }
}

runTests().catch(err => {
  console.error('❌ Transfer audit failed:', err);
  process.exit(1);
});
