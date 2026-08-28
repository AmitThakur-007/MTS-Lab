import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:3000';

async function runBatteryWarrantyComprehensiveTests() {
  console.log('================================================================');
  console.log('🧪 MTS LAB — BATTERY WARRANTY HUB COMPREHENSIVE E2E TEST SUITE');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
    }
  }

  // 1. Authenticate as SuperAdmin
  console.log('🔑 Step 1: Authenticating Super Admin...');
  let superAdminUser = await prisma.user.findFirst({
    where: { email: 'mtsmobilelab@gmail.com' }
  });

  if (!superAdminUser) {
    superAdminUser = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' }
    });
  }

  if (!superAdminUser) {
    throw new Error('No SUPER_ADMIN user found in database.');
  }

  // Issue token via direct jwt signing
  const jwt = await import('jsonwebtoken');
  const JWT_SECRET = process.env.JWT_SECRET || 'mts-lab-repair-super-secret-key-2026';
  const superAdminToken = jwt.default.sign(
    { id: superAdminUser.id, email: superAdminUser.email, role: 'SUPER_ADMIN', name: superAdminUser.name },
    JWT_SECRET,
    { expiresIn: '1d' }
  );

  assert(!!superAdminToken, 'SuperAdmin JWT token generated successfully');

  // 2. Create a Customer and Repair with Battery Warranty
  console.log('\n📦 Step 2: Creating Repair Ticket with Battery Replacement Warranty...');
  const testPhone = '98012' + Math.floor(10000 + Math.random() * 90000);
  const repairPayload = {
    customerName: 'Sanjay Shrestha Test',
    customerPhone: testPhone,
    customerEmail: 'sanjay.shrestha.test@gmail.com',
    customerAddress: 'Kathmandu New Road',
    deviceBrand: 'Apple',
    deviceModel: 'iPhone 13 Pro',
    imeiNumber: '358912345678901',
    deviceColor: 'Sierra Blue',
    problemDescription: 'Battery draining very fast, replaced with original battery',
    deviceCondition: 'Good (Minor Wear)',
    accessoriesReceived: 'No Accessories',
    estimatedCost: 6500,
    advancePaid: 6500,
    paymentStatus: 'PAID',
    hasBatteryWarranty: true,
    batteryWarrantyPeriod: '6_MONTHS',
    batteryType: 'Original Apple 3095mAh Replacement Battery'
  };

  const createRepairRes = await fetch(`${BASE_URL}/api/repairs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${superAdminToken}`
    },
    body: JSON.stringify(repairPayload)
  });

  const createdRepair: any = await createRepairRes.json();
  assert(createRepairRes.ok && !!createdRepair?.id, 'Repair ticket created with battery warranty', createdRepair?.error);

  const repairId = createdRepair.id;
  const repairNumber = createdRepair.repairNumber;

  // 3. Verify Database Persistence of Customer, Repair, and BatteryWarranty
  console.log('\n🔍 Step 3: Verifying Database Persistence across all tables...');
  const dbRepair = await prisma.repair.findUnique({
    where: { id: repairId },
    include: { customer: true, batteryWarranty: true }
  });

  assert(!!dbRepair, 'Repair record exists in database');
  assert(!!dbRepair?.customerId, 'Customer relationship is properly linked to repair');
  assert(dbRepair?.customer?.phone === testPhone, 'Customer record exists with correct phone in database');
  assert(!!dbRepair?.batteryWarranty, 'BatteryWarranty record exists linked to repair');

  const warrantyId = dbRepair?.batteryWarranty?.id || '';
  const warrantyNumber = dbRepair?.batteryWarranty?.warrantyNumber || '';
  console.log(`   -> Created Battery Warranty: #${warrantyNumber} (ID: ${warrantyId})`);
  assert(dbRepair?.batteryWarranty?.status === 'ACTIVE', 'Battery warranty status is ACTIVE');
  assert(dbRepair?.batteryWarranty?.warrantyPeriod === '6_MONTHS', 'Battery warranty period is 6_MONTHS');

  // 4. Test Direct Edit / Update Battery Warranty (PATCH /api/battery-warranties/:id)
  console.log('\n✏️ Step 4: Testing Direct Edit/Update of Battery Warranty (PATCH /api/battery-warranties/:id)...');
  const updatedPhone = '98013' + Math.floor(10000 + Math.random() * 90000);
  const editWarrantyPayload = {
    customerName: 'Sanjay K. Shrestha (Updated)',
    customerPhone: updatedPhone,
    customerEmail: 'sanjay.updated@gmail.com',
    customerAddress: 'Lazimpat, Kathmandu',
    deviceBrand: 'Apple',
    deviceModel: 'iPhone 13 Pro (256GB)',
    imeiNumber: '358912345678999',
    batteryType: 'Premium High-Capacity 3200mAh Battery',
    warrantyPeriod: '1_YEAR',
    status: 'ACTIVE',
    terms: 'Extended 1-Year coverage terms including free capacity calibration.'
  };

  const patchWarrantyRes = await fetch(`${BASE_URL}/api/battery-warranties/${warrantyId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${superAdminToken}`
    },
    body: JSON.stringify(editWarrantyPayload)
  });

  const patchWarrantyData: any = await patchWarrantyRes.json();
  assert(patchWarrantyRes.ok && patchWarrantyData?.success, 'PATCH /api/battery-warranties/:id returned success', patchWarrantyData?.error);

  // Verify updated warranty in database
  const dbWarrantyAfterEdit = await prisma.batteryWarranty.findUnique({
    where: { id: warrantyId },
    include: { customer: true }
  });

  assert(dbWarrantyAfterEdit?.customerName === 'Sanjay K. Shrestha (Updated)', 'Customer name updated in BatteryWarranty DB');
  assert(dbWarrantyAfterEdit?.customerPhone === updatedPhone, 'Customer phone updated in BatteryWarranty DB');
  assert(dbWarrantyAfterEdit?.warrantyPeriod === '1_YEAR', 'Warranty period upgraded to 1_YEAR in DB');
  assert(dbWarrantyAfterEdit?.batteryType === 'Premium High-Capacity 3200mAh Battery', 'Battery type updated in DB');
  assert(dbWarrantyAfterEdit?.customer?.phone === updatedPhone, 'Customer table synchronized with updated phone');
  assert(dbWarrantyAfterEdit?.customer?.name === 'Sanjay K. Shrestha (Updated)', 'Customer table synchronized with updated name');

  // 5. Test Cloudinary PDF Certificate Upload & DB Storage
  console.log('\n📄 Step 5: Testing Cloudinary PDF Certificate Upload (POST /api/battery-warranties/:id/upload-certificate)...');
  const dummyPdfContent = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Title (MTS Lab Battery Certificate) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');
  
  const formData = new FormData();
  const pdfBlob = new Blob([dummyPdfContent], { type: 'application/pdf' });
  formData.append('file', pdfBlob, `warranty_${warrantyNumber}.pdf`);

  const uploadCertRes = await fetch(`${BASE_URL}/api/battery-warranties/${warrantyId}/upload-certificate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${superAdminToken}`
    },
    body: formData
  });

  const uploadCertData: any = await uploadCertRes.json();
  assert(uploadCertRes.ok && uploadCertData?.success, 'POST /api/battery-warranties/:id/upload-certificate returned success', uploadCertData?.error);
  assert(!!uploadCertData?.pdfUrl, 'PDF URL returned from certificate upload');
  assert(!!uploadCertData?.cloudinaryPublicId, 'Cloudinary public ID returned from certificate upload');

  // Verify in database
  const dbWarrantyWithPdf = await prisma.batteryWarranty.findUnique({
    where: { id: warrantyId }
  });
  assert(!!dbWarrantyWithPdf?.pdfUrl, 'pdfUrl persisted in BatteryWarranty database row');
  assert(!!dbWarrantyWithPdf?.cloudinaryPublicId, 'cloudinaryPublicId persisted in BatteryWarranty database row');

  // 6. Test Warranty Claim Processing (POST /api/battery-warranties/:id/claim)
  console.log('\n🛠️ Step 6: Testing Warranty Claim Registration (POST /api/battery-warranties/:id/claim)...');
  const claimPayload = {
    issueDescription: 'Customer reports battery health dropped below 80% after 2 months',
    actionTaken: 'BATTERY_REPLACED',
    notes: 'Replaced under warranty without additional charges'
  };

  const claimRes = await fetch(`${BASE_URL}/api/battery-warranties/${warrantyId}/claim`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${superAdminToken}`
    },
    body: JSON.stringify(claimPayload)
  });

  const claimData: any = await claimRes.json();
  assert(claimRes.ok && !!claimData?.claim, 'Warranty claim registered successfully', claimData?.error);

  const dbClaims = await prisma.batteryWarrantyClaim.findMany({
    where: { warrantyId }
  });
  assert(dbClaims.length >= 1, 'BatteryWarrantyClaim record persisted in database');
  assert(dbClaims[0].actionTaken === 'BATTERY_REPLACED', 'Claim action taken recorded correctly');

  const dbWarrantyAfterClaim = await prisma.batteryWarranty.findUnique({
    where: { id: warrantyId }
  });
  assert((dbWarrantyAfterClaim?.claimCount || 0) >= 1, 'BatteryWarranty claimCount incremented in database');

  // 7. Test Repair Edit with Warranty Toggle (PATCH /api/repairs/:id)
  console.log('\n🔄 Step 7: Testing Repair Edit with Warranty Modification (PATCH /api/repairs/:id)...');
  // Toggle warranty off
  const patchRepairRes1 = await fetch(`${BASE_URL}/api/repairs/${repairId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${superAdminToken}`
    },
    body: JSON.stringify({
      hasBatteryWarranty: false
    })
  });
  assert(patchRepairRes1.ok, 'PATCH /api/repairs/:id (disable warranty) succeeded');

  const dbWarrantyAfterDisable = await prisma.batteryWarranty.findUnique({
    where: { id: warrantyId }
  });
  assert(dbWarrantyAfterDisable?.status === 'CANCELLED', 'Warranty status marked as CANCELLED when disabled in repair edit');

  // Toggle warranty back on
  const patchRepairRes2 = await fetch(`${BASE_URL}/api/repairs/${repairId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${superAdminToken}`
    },
    body: JSON.stringify({
      hasBatteryWarranty: true,
      batteryWarrantyPeriod: '1_YEAR',
      batteryType: 'Original Apple Replacement Pack'
    })
  });
  assert(patchRepairRes2.ok, 'PATCH /api/repairs/:id (re-enable warranty) succeeded');

  const dbWarrantyAfterReenable = await prisma.batteryWarranty.findUnique({
    where: { id: warrantyId }
  });
  assert(dbWarrantyAfterReenable?.status === 'ACTIVE', 'Warranty status restored to ACTIVE when re-enabled in repair edit');

  // 8. Test RBAC Permissions across roles
  console.log('\n🛡️ Step 8: Testing RBAC Authorization for Battery Warranty Hub...');
  const roles = ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'TECHNICIAN'] as const;
  for (const role of roles) {
    const testEmail = `test.${role.toLowerCase()}.${Date.now()}@mtslab.com`;
    const userRecord = await prisma.user.create({
      data: {
        name: `Test ${role}`,
        email: testEmail,
        password: 'TestPassword123!',
        role,
        accountStatus: 'ACTIVE',
        isActive: true,
        emailVerified: true
      }
    });

    // Create session to pass 2-hour inactivity check
    await prisma.session.create({
      data: {
        userId: userRecord.id,
        refreshToken: `refresh_token_${userRecord.id}`,
        lastActiveAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }
    });

    const userRoleToken = jwt.default.sign(
      { id: userRecord.id, email: userRecord.email, role, name: userRecord.name },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    // Can they view warranties?
    const viewRes = await fetch(`${BASE_URL}/api/battery-warranties`, {
      headers: { 'Authorization': `Bearer ${userRoleToken}` }
    });
    assert(viewRes.ok, `Role ${role} can view battery warranties list`);

    // Can they edit warranty? (SUPER_ADMIN, ADMIN, MANAGER, RECEPTIONIST can edit, TECHNICIAN cannot)
    const editRes = await fetch(`${BASE_URL}/api/battery-warranties/${warrantyId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userRoleToken}`
      },
      body: JSON.stringify({ terms: `Updated by ${role}` })
    });

    if (role === 'TECHNICIAN') {
      assert(editRes.status === 403, `Role TECHNICIAN correctly blocked from editing battery warranty (HTTP 403)`);
    } else {
      assert(editRes.ok, `Role ${role} permitted to edit battery warranty (HTTP 200)`);
    }

    // Can they delete warranty? (Only SUPER_ADMIN can delete)
    const deleteRes = await fetch(`${BASE_URL}/api/battery-warranties/${warrantyId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${userRoleToken}` }
    });
    assert(deleteRes.status === 403, `Role ${role} correctly blocked from deleting battery warranty (HTTP 403)`);

    // Cleanup test user
    await prisma.session.deleteMany({ where: { userId: userRecord.id } });
    await prisma.user.delete({ where: { id: userRecord.id } }).catch(() => {});
  }

  // 9. Test SuperAdmin Permanent Deletion (DELETE /api/battery-warranties/:id)
  console.log('\n🗑️ Step 9: Testing SuperAdmin Permanent Deletion with Cloudinary asset cleanup...');
  const deleteRes = await fetch(`${BASE_URL}/api/battery-warranties/${warrantyId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${superAdminToken}` }
  });
  const deleteData: any = await deleteRes.json();
  assert(deleteRes.ok && deleteData?.success, 'DELETE /api/battery-warranties/:id permanently deleted warranty', deleteData?.error);

  const dbWarrantyAfterDelete = await prisma.batteryWarranty.findUnique({
    where: { id: warrantyId }
  });
  assert(dbWarrantyAfterDelete === null, 'BatteryWarranty row permanently removed from database');

  const dbClaimsAfterDelete = await prisma.batteryWarrantyClaim.findMany({
    where: { warrantyId }
  });
  assert(dbClaimsAfterDelete.length === 0, 'Associated claims cascaded and removed from database');

  // Clean up test repair
  await prisma.repairLog.deleteMany({ where: { repairId } });
  await prisma.repair.delete({ where: { id: repairId } }).catch(() => {});

  console.log('\n================================================================');
  console.log(`📊 FINAL RESULT: ${passedTests} / ${totalTests} TESTS PASSED (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('================================================================\n');

  if (passedTests === totalTests) {
    console.log('🎉 ALL BATTERY WARRANTY HUB VERIFICATIONS PASSED WITH 100% SUCCESS!');
  } else {
    throw new Error(`Some tests failed: ${passedTests}/${totalTests} passed.`);
  }
}

runBatteryWarrantyComprehensiveTests()
  .catch((err) => {
    console.error('Fatal Test Runner Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
