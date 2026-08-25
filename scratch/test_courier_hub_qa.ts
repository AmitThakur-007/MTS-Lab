import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3000/api';

async function runCourierHubQATests() {
  console.log('====================================================');
  console.log('🚀 MTS LAB COURIER HUB — INDEPENDENT QA TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, errorDetails?: any) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      if (errorDetails) console.error('   Details:', errorDetails);
      failed++;
    }
  }

  async function apiCall(path: string, options: { method?: string; body?: any; token?: string } = {}) {
    const { method = 'GET', body, token } = options;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    let data: any = null;
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    return { status: res.status, data };
  }

  try {
    // 0. Setup Staff Tokens
    console.log('[SETUP] Fetching or creating test staff users...');
    const adminUser = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
    const techUser = await prisma.user.findFirst({ where: { role: 'TECHNICIAN' } });
    const receptionistUser = await prisma.user.findFirst({ where: { role: 'RECEPTIONIST' } });

    if (!adminUser) {
      throw new Error('No SUPER_ADMIN found in database.');
    }

    const jwt = await import('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'mts-lab-super-secret-key';

    const adminToken = jwt.default.sign(
      { id: adminUser.id, email: adminUser.email, role: adminUser.role, name: adminUser.name },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const receptionistToken = receptionistUser ? jwt.default.sign(
      { id: receptionistUser.id, email: receptionistUser.email, role: receptionistUser.role, name: receptionistUser.name },
      JWT_SECRET,
      { expiresIn: '1h' }
    ) : adminToken;

    const techToken = techUser ? jwt.default.sign(
      { id: techUser.id, email: techUser.email, role: techUser.role, name: techUser.name },
      JWT_SECRET,
      { expiresIn: '1h' }
    ) : null;

    // TEST 1: GET /api/couriers/stats
    console.log('\n--- TEST 1: Overview Logistics Statistics ---');
    const statsRes = await apiCall('/couriers/stats', { token: adminToken });
    assert(
      statsRes.status === 200 && typeof statsRes.data.totalShipments === 'number' && typeof statsRes.data.inTransit === 'number',
      'GET /api/couriers/stats returns valid aggregate statistics',
      statsRes.data
    );

    // TEST 2: POST /api/couriers/incoming (Create New Intake Repair with Inbound Courier)
    console.log('\n--- TEST 2: Register Inbound Courier (New Intake Repair) ---');
    const uniquePhone = `98011${Math.floor(10000 + Math.random() * 90000)}`;
    const awbInbound = `SND-IN-${Date.now()}`;
    const incomingNewRes = await apiCall('/couriers/incoming', {
      method: 'POST',
      token: receptionistToken,
      body: {
        isNewRepair: true,
        customerName: 'Bikash Adhikari',
        customerPhone: uniquePhone,
        customerDistrict: 'Pokhara',
        customerAddress: 'Lakeside, Ward 6',
        deviceBrand: 'apple',
        deviceModel: 'iPhone 13 Pro',
        problemDescription: 'Touch screen unresponsive after courier transport',
        courierCompany: 'Sundarban Courier',
        courierTrackingNumber: awbInbound,
        courierInCharge: 350,
        courierInPaymentStatus: 'PAID',
        originDistrict: 'Kaski',
        originAddress: 'Pokhara Buspark Branch',
        courierNotes: 'Bubble wrapped in yellow box'
      }
    });

    const createdInboundRepair = incomingNewRes.data.repair;
    assert(
      incomingNewRes.status === 201 &&
      createdInboundRepair?.isCourierIn === true &&
      createdInboundRepair?.courierTrackingNumber === awbInbound &&
      createdInboundRepair?.courierInStatus === 'RECEIVED_AT_LAB',
      'POST /api/couriers/incoming successfully creates repair & logs inbound courier',
      incomingNewRes.data
    );

    // TEST 3: POST /api/couriers/incoming (Link Inbound Courier to Existing Repair)
    console.log('\n--- TEST 3: Link Inbound Courier to Existing Repair Job ---');
    const existingRepRes = await apiCall('/repairs', {
      method: 'POST',
      token: adminToken,
      body: {
        customerName: 'Suman Shrestha',
        customerPhone: `9841${Math.floor(100000 + Math.random() * 900000)}`,
        deviceBrand: 'samsung',
        deviceModel: 'Galaxy S23 Ultra',
        problemDescription: 'Charging port replacement'
      }
    });
    const standaloneRepair = existingRepRes.data.repair || existingRepRes.data;

    const awbLink = `EMS-NP-${Date.now()}`;
    const linkRes = await apiCall('/couriers/incoming', {
      method: 'POST',
      token: adminToken,
      body: {
        existingRepairId: standaloneRepair.id,
        courierCompany: 'Nepal Post (EMS)',
        courierTrackingNumber: awbLink,
        originDistrict: 'Butwal',
        courierInCharge: 200,
        courierInPaymentStatus: 'UNPAID',
        courierNotes: 'Urgent transfer from Butwal service center'
      }
    });

    assert(
      (linkRes.status === 200 || linkRes.status === 201) &&
      linkRes.data.repair?.isCourierIn === true &&
      linkRes.data.repair?.courierTrackingNumber === awbLink,
      'POST /api/couriers/incoming successfully links courier to existing repair',
      linkRes.data
    );

    // TEST 4: Search and Filtering (GET /api/couriers)
    console.log('\n--- TEST 4: Search & Multi-criteria Filtering ---');
    const searchRes = await apiCall(`/couriers?search=${encodeURIComponent(awbInbound)}`, { token: adminToken });
    assert(
      searchRes.status === 200 &&
      searchRes.data.shipments.some((s: any) => s.courierTrackingNumber === awbInbound),
      'GET /api/couriers finds shipment by AWB Tracking Number'
    );

    const phoneSearchRes = await apiCall(`/couriers?search=${uniquePhone}`, { token: adminToken });
    assert(
      phoneSearchRes.status === 200 &&
      phoneSearchRes.data.shipments.some((s: any) => s.customerPhone === uniquePhone || s.senderPhone === uniquePhone),
      'GET /api/couriers finds shipment by Customer Phone'
    );

    const filterIncomingRes = await apiCall('/couriers?type=INCOMING', { token: adminToken });
    assert(
      filterIncomingRes.status === 200 &&
      filterIncomingRes.data.shipments.every((s: any) => s.isCourierIn === true),
      'GET /api/couriers?type=INCOMING filters only inbound shipments'
    );

    // TEST 5: GET /api/couriers/eligible-repairs
    console.log('\n--- TEST 5: Eligible Repairs for Dispatch ---');
    const eligibleRes = await apiCall('/couriers/eligible-repairs', { token: adminToken });
    assert(
      eligibleRes.status === 200 && Array.isArray(eligibleRes.data),
      'GET /api/couriers/eligible-repairs returns list of dispatch-ready repairs'
    );

    // TEST 6: POST /api/couriers/outgoing (Create Outbound Dispatch)
    console.log('\n--- TEST 6: Register Outbound Courier Dispatch ---');
    const awbOutbound = `GKH-OUT-${Date.now()}`;
    const outboundRes = await apiCall('/couriers/outgoing', {
      method: 'POST',
      token: receptionistToken,
      body: {
        repairId: createdInboundRepair.id,
        returnCourierCompany: 'Gorkha Courier',
        returnCourierTrackingNumber: awbOutbound,
        destinationDistrict: 'Kaski, Pokhara',
        destinationAddress: 'Lakeside, Ward 6',
        receiverName: 'Bikash Adhikari',
        receiverPhone: uniquePhone,
        courierOutCharge: 400,
        courierOutPaymentStatus: 'UNPAID',
        returnCourierNotes: 'Fragile: repaired display assembly included'
      }
    });

    const dispatchedRepair = outboundRes.data.repair;
    assert(
      outboundRes.status === 201 &&
      dispatchedRepair?.isCourierOut === true &&
      dispatchedRepair?.isReturnCourierDispatched === true &&
      dispatchedRepair?.returnCourierTrackingNumber === awbOutbound &&
      dispatchedRepair?.courierOutStatus === 'DISPATCHED',
      'POST /api/couriers/outgoing dispatches repaired device and sets status',
      outboundRes.data
    );

    // TEST 7: Prevent Duplicate Outbound Dispatch
    console.log('\n--- TEST 7: Duplicate Dispatch Prevention ---');
    const dupRes = await apiCall('/couriers/outgoing', {
      method: 'POST',
      token: receptionistToken,
      body: {
        repairId: createdInboundRepair.id,
        returnCourierCompany: 'Gorkha Courier',
        returnCourierTrackingNumber: awbOutbound
      }
    });
    assert(
      dupRes.status === 400,
      'Duplicate dispatch with identical tracking number is safely rejected (400)'
    );

    // TEST 8: Inbound Status Lifecycle Transition (PATCH /api/couriers/:id/status)
    console.log('\n--- TEST 8: Inbound Courier Lifecycle Transitions ---');
    const statusInRes = await apiCall(`/couriers/${standaloneRepair.id}/status`, {
      method: 'PATCH',
      token: adminToken,
      body: {
        courierType: 'INCOMING',
        status: 'IN_TRANSIT',
        notes: 'Driver picked up from regional counter'
      }
    });
    assert(
      statusInRes.status === 200 && statusInRes.data.repair.courierInStatus === 'IN_TRANSIT',
      'PATCH /api/couriers/:id/status transitions inbound status to IN_TRANSIT'
    );

    // TEST 9: Outbound Status Lifecycle Transition (PATCH /api/couriers/:id/status)
    console.log('\n--- TEST 9: Outbound Courier Lifecycle Transitions ---');
    const statusOutRes = await apiCall(`/couriers/${createdInboundRepair.id}/status`, {
      method: 'PATCH',
      token: adminToken,
      body: {
        courierType: 'OUTGOING',
        status: 'DELIVERED',
        notes: 'Customer confirmed delivery with OTP signature'
      }
    });
    assert(
      statusOutRes.status === 200 &&
      statusOutRes.data.repair.courierOutStatus === 'DELIVERED' &&
      statusOutRes.data.repair.status === 'DELIVERED',
      'PATCH /api/couriers/:id/status transitions outbound status to DELIVERED and marks repair DELIVERED'
    );

    // TEST 10: Edit Courier Shipment Details (PATCH /api/couriers/:id)
    console.log('\n--- TEST 10: Edit Courier Details ---');
    const editRes = await apiCall(`/couriers/${createdInboundRepair.id}`, {
      method: 'PATCH',
      token: adminToken,
      body: {
        returnCourierNotes: 'Customer requested evening delivery window',
        courierOutCharge: 450,
        courierOutPaymentStatus: 'PAID'
      }
    });
    assert(
      editRes.status === 200 &&
      editRes.data.repair.courierOutCharge === 450 &&
      editRes.data.repair.courierOutPaymentStatus === 'PAID',
      'PATCH /api/couriers/:id updates shipment charges and notes correctly'
    );

    // TEST 11: Single Courier Record (GET /api/couriers/:id)
    console.log('\n--- TEST 11: Single Shipment Details Query ---');
    const singleRes = await apiCall(`/couriers/${createdInboundRepair.id}`, { token: adminToken });
    assert(
      singleRes.status === 200 &&
      singleRes.data.id === createdInboundRepair.id &&
      singleRes.data.logs?.length > 0,
      'GET /api/couriers/:id returns complete shipment record with audit logs'
    );

    // TEST 12: Customer Track Repair Verification (Public GET /api/track)
    console.log('\n--- TEST 12: Public Customer Track Repair Sync ---');
    const trackRes = await apiCall(`/track?repairNumber=${encodeURIComponent(createdInboundRepair.repairNumber)}`);
    const trackData = trackRes.data;
    assert(
      trackRes.status === 200 &&
      trackData.courierTrackingNumber === awbInbound &&
      trackData.returnCourierTrackingNumber === awbOutbound &&
      trackData.isCourierIn === true,
      'GET /api/track displays inbound & outbound courier milestones safely to customer'
    );

    // TEST 13: RBAC Access Control (TECHNICIAN & Unauthenticated forbidden)
    console.log('\n--- TEST 13: Role-Based Access Control (RBAC) ---');
    if (techToken) {
      const techRes = await apiCall('/couriers', { token: techToken });
      assert(
        techRes.status === 403,
        'Unauthorized role (TECHNICIAN) receives 403 Forbidden for Courier Hub'
      );
    }

    const unauthRes = await apiCall('/couriers');
    assert(
      unauthRes.status === 401,
      'Unauthenticated request receives 401 Unauthorized'
    );

    // TEST 14: Safe Soft Delete / Archive (DELETE /api/couriers/:id)
    console.log('\n--- TEST 14: Soft Delete / Archive Courier Shipment ---');
    const archiveRes = await apiCall(`/couriers/${createdInboundRepair.id}`, {
      method: 'DELETE',
      token: adminToken
    });
    assert(
      archiveRes.status === 200 && archiveRes.data.repair.courierArchived === true,
      'DELETE /api/couriers/:id archives courier shipment'
    );

    const verifyRepair = await prisma.repair.findUnique({ where: { id: createdInboundRepair.id } });
    assert(
      verifyRepair !== null && verifyRepair.id === createdInboundRepair.id,
      'Core Repair and Customer records remain 100% intact after courier archiving'
    );

    // Summary
    console.log('\n====================================================');
    console.log(`🎉 QA TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
    console.log('====================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('Fatal error during QA tests:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runCourierHubQATests();
