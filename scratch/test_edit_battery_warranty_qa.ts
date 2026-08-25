import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const BASE_URL = 'http://127.0.0.1:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'mts-lab-super-secret-key';
const prisma = new PrismaClient();

async function runQATests() {
  console.log('====================================================');
  console.log('  MTS LAB — BATTERY WARRANTY ON EDIT REPAIR QA SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      if (detail) console.error(`   Details: ${detail}`);
      failed++;
    }
  }

  try {
    // 1. Get or create Super Admin User and generate authentic JWT token
    let superAdmin = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN', deletedAt: null }
    });
    if (!superAdmin) {
      superAdmin = await prisma.user.findFirst();
    }

    const adminToken = jwt.sign(
      { id: superAdmin!.id, role: 'SUPER_ADMIN', email: superAdmin!.email, name: superAdmin!.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    assert(!!adminToken, 'Super Admin token generated', `User: ${superAdmin?.email}`);
    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    };

    // 2. Scenario A: Create New Repair with NO warranty
    const uniquePhoneA = '9801' + Math.floor(100000 + Math.random() * 900000);
    const createResA = await fetch(`${BASE_URL}/api/repairs`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        customerName: 'Test Customer No Warranty',
        customerPhone: uniquePhoneA,
        customerAddress: 'Kathmandu, New Road',
        deviceBrand: 'Apple',
        deviceModel: 'iPhone 13 Pro',
        imeiNumber: '358901234567890',
        deviceCondition: 'Good (Minor Wear)',
        problemDescription: 'Screen replacement only',
        estimatedCost: 12000,
        advancePaid: 2000,
        hasBatteryWarranty: false
      })
    });
    const repairA: any = await createResA.json();
    assert(createResA.status === 201 && !!repairA.id, 'Scenario A: Repair without warranty created', `ID: ${repairA.id}, Number: ${repairA.repairNumber}`);
    assert(!repairA.batteryWarranty, 'Scenario A: No warranty record returned for repair without warranty');

    // Verify in Battery Warranty list that repairA has no warranty
    const listWarrantiesResA = await fetch(`${BASE_URL}/api/battery-warranties?search=${repairA.repairNumber}`, {
      headers: authHeaders
    });
    const listWarrantiesDataA: any = await listWarrantiesResA.json();
    const listA = Array.isArray(listWarrantiesDataA) ? listWarrantiesDataA : listWarrantiesDataA.warranties || [];
    const foundWA = listA.find((w: any) => w.repairId === repairA.id || w.repairNumber === repairA.repairNumber);
    assert(!foundWA, 'Scenario A: Verified 0 warranty records in Battery Warranty Hub for Repair A');

    // 3. Scenario B: Create New Repair WITH warranty
    const uniquePhoneB = '9802' + Math.floor(100000 + Math.random() * 900000);
    const createResB = await fetch(`${BASE_URL}/api/repairs`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        customerName: 'Test Customer With Warranty',
        customerPhone: uniquePhoneB,
        customerAddress: 'Lalitpur, Pulchowk',
        deviceBrand: 'Samsung',
        deviceModel: 'Galaxy S23 Ultra',
        imeiNumber: '359901234567891',
        deviceCondition: 'Good (Minor Wear)',
        problemDescription: 'Battery replacement with 1-year coverage',
        estimatedCost: 6500,
        advancePaid: 6500,
        hasBatteryWarranty: true,
        batteryWarrantyPeriod: '1_YEAR',
        batteryType: 'Original Samsung Battery'
      })
    });
    const repairB: any = await createResB.json();
    assert(createResB.status === 201 && !!repairB.id, 'Scenario B: Repair with warranty created', `ID: ${repairB.id}`);
    assert(!!repairB.batteryWarranty && repairB.batteryWarranty.warrantyPeriod === '1_YEAR', 'Scenario B: Battery warranty record created with 1_YEAR period', `Warranty #: ${repairB.batteryWarranty?.warrantyNumber}`);

    // 4. Scenario C: Add Battery Warranty later via Edit Repair (PATCH /api/repairs/:id)
    console.log('\n--- Testing Add Warranty to Existing Repair via Edit ---');
    const editResA1 = await fetch(`${BASE_URL}/api/repairs/${repairA.id}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        hasBatteryWarranty: true,
        batteryWarrantyPeriod: '6_MONTHS',
        batteryType: 'Original Apple Battery',
        remarks: 'Customer decided to add 6-month battery warranty upon pickup'
      })
    });
    const updatedA1: any = await editResA1.json();
    assert(editResA1.status === 200, 'Scenario C: PATCH /api/repairs/:id succeeded for adding warranty');
    assert(!!updatedA1.batteryWarranty, 'Scenario C: Updated repair response includes new battery warranty');
    assert(updatedA1.batteryWarranty?.warrantyPeriod === '6_MONTHS', 'Scenario C: Warranty period is 6_MONTHS');
    assert(updatedA1.batteryWarranty?.customerName === repairA.customerName, 'Scenario C: Customer Name automatically reused from repair');
    assert(updatedA1.batteryWarranty?.customerPhone === repairA.customerPhone, 'Scenario C: Customer Phone automatically reused from repair');
    assert(updatedA1.batteryWarranty?.deviceModel === repairA.deviceModel, 'Scenario C: Device Model automatically reused from repair');
    assert(updatedA1.batteryWarranty?.status === 'ACTIVE', 'Scenario C: Warranty status is ACTIVE');

    const warrantyA1Id = updatedA1.batteryWarranty?.id;

    // 5. Scenario D: Edit Repair Again with Warranty (Prevent Duplicates & Update details)
    console.log('\n--- Testing Edit with Warranty (Duplicate Prevention) ---');
    const editResA2 = await fetch(`${BASE_URL}/api/repairs/${repairA.id}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        customerName: 'Test Customer No Warranty Updated',
        hasBatteryWarranty: true,
        batteryWarrantyPeriod: '1_YEAR',
        batteryType: 'Premium High-Capacity Battery'
      })
    });
    const updatedA2: any = await editResA2.json();
    assert(editResA2.status === 200, 'Scenario D: Second edit succeeded');
    assert(updatedA2.batteryWarranty?.id === warrantyA1Id, 'Scenario D: NO DUPLICATE - Warranty ID remained identical', `ID: ${updatedA2.batteryWarranty?.id}`);
    assert(updatedA2.batteryWarranty?.warrantyPeriod === '1_YEAR', 'Scenario D: Warranty period updated to 1_YEAR');
    assert(updatedA2.batteryWarranty?.customerName === 'Test Customer No Warranty Updated', 'Scenario D: Warranty customer name updated to match repair');

    // Verify in Battery Warranty Hub total count for Repair A is exactly 1
    const checkHubRes = await fetch(`${BASE_URL}/api/battery-warranties?search=${repairA.repairNumber}`, {
      headers: authHeaders
    });
    const checkHubData: any = await checkHubRes.json();
    const hubList = Array.isArray(checkHubData) ? checkHubData : checkHubData.warranties || [];
    const matchingHubRecords = hubList.filter((w: any) => w.repairId === repairA.id);
    assert(matchingHubRecords.length === 1, 'Scenario D: Exactly ONE warranty record exists in Hub for Repair A (No Duplication)');

    // 6. Scenario E: Switch Warranty OFF to "No Battery Warranty"
    console.log('\n--- Testing Switch Warranty OFF (Safe Cancellation / Preservation) ---');
    const editResA3 = await fetch(`${BASE_URL}/api/repairs/${repairA.id}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        hasBatteryWarranty: false
      })
    });
    const updatedA3: any = await editResA3.json();
    assert(editResA3.status === 200, 'Scenario E: PATCH to disable warranty succeeded');
    
    // Check warranty status in Hub
    const getWarrantyRes = await fetch(`${BASE_URL}/api/battery-warranties/${warrantyA1Id}`, {
      headers: authHeaders
    });
    const warrantyStatusData: any = await getWarrantyRes.json();
    const finalWarranty = warrantyStatusData.warranty || warrantyStatusData;
    assert(finalWarranty.status === 'CANCELLED', 'Scenario E: Warranty record safely marked CANCELLED (not deleted, preserving audit history)');

    // 7. Scenario F: Switch Warranty Back ON (Reactivation without duplication)
    console.log('\n--- Testing Switch Warranty Back ON (Reactivation) ---');
    const editResA4 = await fetch(`${BASE_URL}/api/repairs/${repairA.id}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        hasBatteryWarranty: true,
        batteryWarrantyPeriod: '6_MONTHS'
      })
    });
    const updatedA4: any = await editResA4.json();
    assert(editResA4.status === 200, 'Scenario F: PATCH to re-enable warranty succeeded');
    assert(updatedA4.batteryWarranty?.id === warrantyA1Id, 'Scenario F: Existing record reused on reactivation (no duplicate)');
    assert(updatedA4.batteryWarranty?.status === 'ACTIVE', 'Scenario F: Warranty status reactivated to ACTIVE');

    // 8. Scenario G: Verify GET /api/repairs/:id returns batteryWarranty
    console.log('\n--- Testing GET /api/repairs/:id include ---');
    const getRepairRes = await fetch(`${BASE_URL}/api/repairs/${repairA.id}`, {
      headers: authHeaders
    });
    const getRepairData: any = await getRepairRes.json();
    assert(!!getRepairData.batteryWarranty, 'Scenario G: GET /api/repairs/:id includes batteryWarranty object');
    assert(getRepairData.batteryWarranty?.id === warrantyA1Id, 'Scenario G: Returned batteryWarranty matches active warranty ID');

    // 9. Scenario H: Role Authorization Test
    console.log('\n--- Testing Role-based Access Control ---');
    const receptionistToken = jwt.sign(
      { id: superAdmin!.id, role: 'RECEPTIONIST', email: 'recep@mtslab.local', name: 'Receptionist' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const recepEditRes = await fetch(`${BASE_URL}/api/repairs/${repairA.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${receptionistToken}`
      },
      body: JSON.stringify({
        remarks: 'Updated by receptionist'
      })
    });
    assert(recepEditRes.status === 200, 'Scenario H: RECEPTIONIST is authorized to update repair details');

    const customerToken = jwt.sign(
      { id: superAdmin!.id, role: 'CUSTOMER', email: 'cust@mtslab.local', name: 'Customer' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const custEditRes = await fetch(`${BASE_URL}/api/repairs/${repairA.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customerToken}`
      },
      body: JSON.stringify({
        remarks: 'Unauthorized edit attempt'
      })
    });
    assert(custEditRes.status === 403, 'Scenario H: Unauthorized CUSTOMER role is blocked with 403');

    console.log('\n====================================================');
    console.log(`  QA SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

    await prisma.$disconnect();

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Fatal Error during QA tests:', err);
    await prisma.$disconnect();
    process.exit(1);
  }
}

runQATests();
