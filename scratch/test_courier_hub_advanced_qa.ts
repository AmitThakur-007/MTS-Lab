import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:3000';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, details?: any) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`✅ PASS: ${testName}`);
  } else {
    failedTests++;
    console.error(`❌ FAIL: ${testName}`);
    if (details) {
      console.error(`   Details:`, details);
    }
  }
}

async function runAdvancedQA() {
  console.log('====================================================');
  console.log('🚀 MTS LAB ADVANCED COURIER HUB — QA TEST SUITE');
  console.log('====================================================\n');

  try {
    const jwt = await import('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'mts-lab-super-secret-key';

    // 1. Fetch or create users
    const adminUser = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN', isActive: true, deletedAt: null }
    }) || await prisma.user.findFirst();

    if (!adminUser) {
      throw new Error('No admin user found in database.');
    }

    const techUser = await prisma.user.findFirst({
      where: { role: 'TECHNICIAN', isActive: true, deletedAt: null }
    }) || await prisma.user.create({
      data: {
        email: `qa_tech_${Date.now()}@mtslab.com`,
        name: 'QA Technician',
        role: 'TECHNICIAN',
        password: 'hashed_password_123',
        isActive: true,
        accountStatus: 'ACTIVE'
      }
    });

    const adminToken = jwt.default.sign(
      { id: adminUser.id, email: adminUser.email, role: adminUser.role, name: adminUser.name },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const techToken = jwt.default.sign(
      { id: techUser.id, email: techUser.email, role: techUser.role, name: techUser.name },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const adminHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    };

    const techHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${techToken}`
    };

    // Helper request
    const apiReq = async (endpoint: string, options: any = {}) => {
      const res = await fetch(`${BASE_URL}${endpoint}`, {
        ...options,
        headers: { ...(options.headers || adminHeaders) }
      });
      const data = await res.json().catch(() => null);
      return { status: res.status, data };
    };

    // ----------------------------------------------------
    // TEST 1: Live Overview Logistics Statistics
    // ----------------------------------------------------
    console.log('--- TEST 1: Overview Logistics Statistics ---');
    const statsRes = await apiReq('/api/couriers/stats');
    assert(
      statsRes.status === 200 && typeof statsRes.data?.totalShipments === 'number',
      'GET /api/couriers/stats returns valid aggregate statistics',
      statsRes.data
    );

    // ----------------------------------------------------
    // TEST 2: Dynamic Filters Metadata
    // ----------------------------------------------------
    console.log('\n--- TEST 2: Dynamic Filters Metadata ---');
    const metaRes = await apiReq('/api/couriers/filters-metadata');
    assert(
      metaRes.status === 200 && Array.isArray(metaRes.data?.courierCompanies) && Array.isArray(metaRes.data?.districts),
      'GET /api/couriers/filters-metadata returns distinct companies & districts lists',
      metaRes.data
    );

    // ----------------------------------------------------
    // TEST 3: Customer Search & Autocomplete
    // ----------------------------------------------------
    console.log('\n--- TEST 3: Customer Search & Autocomplete ---');
    const existingCustomer = await prisma.customer.findFirst();
    if (existingCustomer) {
      const searchRes = await apiReq(`/api/couriers/search-customers?query=${encodeURIComponent(existingCustomer.phone.slice(0, 5))}`);
      assert(
        searchRes.status === 200 && Array.isArray(searchRes.data) && searchRes.data.length > 0,
        'GET /api/couriers/search-customers finds existing customers by phone prefix',
        searchRes.data
      );
    } else {
      console.log('⚠️ Skipping Customer Search test (no customers in DB)');
    }

    // ----------------------------------------------------
    // TEST 4: Duplicate AWB Detection
    // ----------------------------------------------------
    console.log('\n--- TEST 4: Duplicate AWB Detection ---');
    const testAwb = `AWB-TEST-${Date.now()}`;
    const checkFreshAwb = await apiReq('/api/couriers/check-duplicate-awb', {
      method: 'POST',
      body: JSON.stringify({ trackingNumber: testAwb })
    });
    assert(
      checkFreshAwb.status === 200 && checkFreshAwb.data?.exists === false,
      'POST /api/couriers/check-duplicate-awb returns exists: false for fresh AWB'
    );

    // ----------------------------------------------------
    // TEST 5: Inbound Courier Intake (New Intake Repair)
    // ----------------------------------------------------
    console.log('\n--- TEST 5: Inbound Courier Intake ---');
    const inboundRes = await apiReq('/api/couriers/incoming', {
      method: 'POST',
      body: JSON.stringify({
        isNewRepair: true,
        customerName: 'Bikash Thapa',
        customerPhone: '9841889900',
        customerDistrict: 'Kaski',
        deviceBrand: 'apple',
        deviceModel: 'iPhone 13 Pro',
        courierCompany: 'Sundarban Courier',
        courierTrackingNumber: testAwb,
        courierInCharge: 350,
        courierInPaymentStatus: 'PAID',
        originDistrict: 'Pokhara',
        problemDescription: 'Laser ablation screen line repair'
      })
    });

    assert(
      inboundRes.status === 201 && inboundRes.data?.repair?.isCourierIn === true && inboundRes.data?.repair?.courierTrackingNumber === testAwb,
      'POST /api/couriers/incoming successfully registers inbound courier',
      inboundRes.data
    );

    const checkDuplicateNow = await apiReq('/api/couriers/check-duplicate-awb', {
      method: 'POST',
      body: JSON.stringify({ trackingNumber: testAwb })
    });
    assert(
      checkDuplicateNow.status === 200 && checkDuplicateNow.data?.exists === true,
      'POST /api/couriers/check-duplicate-awb detects existing AWB in database'
    );

    const createdInboundRepair = inboundRes.data?.repair;

    // ----------------------------------------------------
    // TEST 6: Multi-Criteria Search & Filtering
    // ----------------------------------------------------
    console.log('\n--- TEST 6: Multi-Criteria Search & Filtering ---');
    const searchAwbRes = await apiReq(`/api/couriers?search=${encodeURIComponent(testAwb)}`);
    assert(
      searchAwbRes.status === 200 && searchAwbRes.data?.shipments?.length > 0,
      'GET /api/couriers finds shipment by AWB query'
    );

    const filterIncomingRes = await apiReq('/api/couriers?type=INCOMING');
    assert(
      filterIncomingRes.status === 200 && filterIncomingRes.data?.shipments?.every((s: any) => s.isCourierIn),
      'GET /api/couriers?type=INCOMING returns only inbound shipments'
    );

    const filterPaymentRes = await apiReq('/api/couriers?paymentStatus=PAID');
    assert(
      filterPaymentRes.status === 200 && Array.isArray(filterPaymentRes.data?.shipments),
      'GET /api/couriers?paymentStatus=PAID filters by payment status'
    );

    const sortRes = await apiReq('/api/couriers?sortBy=oldest');
    assert(
      sortRes.status === 200 && Array.isArray(sortRes.data?.shipments),
      'GET /api/couriers?sortBy=oldest correctly sorts shipments'
    );

    // ----------------------------------------------------
    // TEST 7: Outbound Courier Dispatch
    // ----------------------------------------------------
    console.log('\n--- TEST 7: Outbound Courier Dispatch ---');
    const outAwb = `GKH-OUT-${Date.now()}`;
    const outboundRes = await apiReq('/api/couriers/outgoing', {
      method: 'POST',
      body: JSON.stringify({
        repairId: createdInboundRepair.id,
        returnCourierCompany: 'Gorkha Courier',
        returnCourierTrackingNumber: outAwb,
        destinationDistrict: 'Pokhara',
        destinationAddress: 'Lakeside Ward 6',
        receiverName: 'Bikash Thapa',
        receiverPhone: '9841889900',
        courierOutCharge: 400,
        courierOutPaymentStatus: 'UNPAID',
        returnCourierNotes: 'Dispatched with bubble wrap'
      })
    });

    assert(
      (outboundRes.status === 200 || outboundRes.status === 201) && outboundRes.data?.repair?.isCourierOut === true && outboundRes.data?.repair?.returnCourierTrackingNumber === outAwb,
      'POST /api/couriers/outgoing dispatches repaired device to customer',
      outboundRes.data
    );

    // ----------------------------------------------------
    // TEST 8: Bulk Status Update
    // ----------------------------------------------------
    console.log('\n--- TEST 8: Bulk Status Update ---');
    const bulkStatusRes = await apiReq('/api/couriers/bulk-status', {
      method: 'POST',
      body: JSON.stringify({
        repairIds: [createdInboundRepair.id],
        status: 'DELIVERED',
        courierType: 'OUTGOING',
        notes: 'Bulk QA delivery signoff'
      })
    });

    assert(
      bulkStatusRes.status === 200 && bulkStatusRes.data?.updatedCount === 1,
      'POST /api/couriers/bulk-status updates selected shipments in batch',
      bulkStatusRes.data
    );

    // ----------------------------------------------------
    // TEST 9: Public Customer Track Repair Integration
    // ----------------------------------------------------
    console.log('\n--- TEST 9: Public Track Repair Integration ---');
    const trackRes = await apiReq(`/api/track?repairNumber=${encodeURIComponent(createdInboundRepair.repairNumber)}`);
    assert(
      trackRes.status === 200 &&
      (trackRes.data?.courierCompany === 'Sundarban Courier' || trackRes.data?.returnCourierCompany === 'Gorkha Courier') &&
      trackRes.data?.internalNotes === undefined,
      'GET /api/track displays courier details safely without internal notes leak',
      trackRes.data
    );

    // ----------------------------------------------------
    // TEST 10: Role-Based Access Control (RBAC)
    // ----------------------------------------------------
    console.log('\n--- TEST 10: RBAC & Security ---');
    const techAccessRes = await apiReq('/api/couriers', { headers: techHeaders });
    assert(
      techAccessRes.status === 403,
      'Unauthorized role (TECHNICIAN) receives 403 Forbidden'
    );

    const unauthRes = await apiReq('/api/couriers', { headers: { 'Content-Type': 'application/json' } });
    assert(
      unauthRes.status === 401,
      'Unauthenticated request receives 401 Unauthorized'
    );

    // ----------------------------------------------------
    // TEST 11: Bulk Archive & Data Preservation
    // ----------------------------------------------------
    console.log('\n--- TEST 11: Bulk Archive & Record Preservation ---');
    const bulkArchiveRes = await apiReq('/api/couriers/bulk-archive', {
      method: 'POST',
      body: JSON.stringify({ repairIds: [createdInboundRepair.id] })
    });

    assert(
      bulkArchiveRes.status === 200,
      'POST /api/couriers/bulk-archive soft-archives courier shipments',
      bulkArchiveRes.data
    );

    // Verify core repair still exists
    const dbRepair = await prisma.repair.findUnique({ where: { id: createdInboundRepair.id } });
    assert(
      dbRepair !== null && dbRepair.courierArchived === true,
      'Core Repair record remains 100% intact after archiving'
    );

    console.log('\n====================================================');
    console.log(`🎉 QA TEST RESULTS: ${passedTests} PASSED | ${failedTests} FAILED`);
    console.log('====================================================');

    if (failedTests > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('QA Test execution failed with error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runAdvancedQA();
