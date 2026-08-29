import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const BASE_URL = process.env.VITE_BACKEND_URL || 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'mts-jwt-secret-key-production-change-this';

let testCounter = 0;
function assert(condition: boolean, message: string) {
  testCounter++;
  if (!condition) {
    console.error(`  ✗ FAIL [Test ${testCounter}]: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ PASS [Test ${testCounter}]: ${message}`);
}

async function runDashboardPersistenceE2ETests() {
  console.log('================================================================================');
  console.log('MTS LAB — COMPLETE DASHBOARD DATA PERSISTENCE E2E TEST SUITE');
  console.log('================================================================================\n');

  // 1. Prepare Admin & Staff Context
  console.log('--- SETUP: SuperAdmin Auth Context ---');
  let superAdmin = await prisma.user.findFirst({
    where: { role: { in: ['SUPERADMIN', 'SUPER_ADMIN'] }, deletedAt: null }
  });

  if (!superAdmin) {
    superAdmin = await prisma.user.create({
      data: {
        email: 'persistence.superadmin@mtslab.com',
        password: '$2b$10$dummyhashedpasswordfortestingpurposesonly000000000000000',
        name: 'Persistence SuperAdmin',
        role: 'SUPERADMIN',
        isActive: true,
        accountStatus: 'ACTIVE',
        emailVerified: true
      }
    });
  }

  const superAdminToken = jwt.sign(
    { userId: superAdmin.id, email: superAdmin.email, role: 'SUPERADMIN' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${superAdminToken}`
  };

  assert(!!superAdminToken, 'SuperAdmin JWT token generated');

  // Ensure default branch exists
  let branch = await prisma.branch.findFirst();
  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        name: 'MTS Central Lab Kathmandu',
        location: 'New Road, Kathmandu',
        phone: '01-5364307'
      }
    });
  }

  // --- MODULE 1: CUSTOMER HUB ---
  console.log('\n--- MODULE 1: Customer Hub Data Persistence ---');
  const uniquePhone = '980' + Math.floor(1000000 + Math.random() * 9000000);
  const custRes = await fetch(`${BASE_URL}/api/customers`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: 'Persistence Test Customer',
      phone: uniquePhone,
      email: 'customer.persistence@test.com',
      district: 'Kathmandu',
      address: 'Pako New Road, Ward 22'
    })
  });
  assert(custRes.status === 200 || custRes.status === 201, 'POST /api/customers returns HTTP 200/201');
  const custJson: any = await custRes.json();
  assert(!!custJson.id, 'Customer returned with valid database ID');

  // Database verification before & after refresh
  let dbCustomer = await prisma.customer.findUnique({ where: { id: custJson.id } });
  assert(!!dbCustomer, 'Customer verified in Prisma database');
  assert(dbCustomer?.name === 'Persistence Test Customer', 'Customer name persisted accurately');
  assert(dbCustomer?.phone === uniquePhone, 'Customer phone persisted accurately');

  // Edit Customer
  const custEditRes = await fetch(`${BASE_URL}/api/customers/${custJson.id}`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({
      name: 'Persistence Test Customer (Updated)',
      address: 'New Road Gate, Kathmandu'
    })
  });
  assert(custEditRes.status === 200, 'PATCH /api/customers/:id returns HTTP 200 OK');
  dbCustomer = await prisma.customer.findUnique({ where: { id: custJson.id } });
  assert(dbCustomer?.name === 'Persistence Test Customer (Updated)', 'Customer update persisted in database');

  // --- MODULE 2: REPAIRS ---
  console.log('\n--- MODULE 2: Repairs Data Persistence ---');
  const repairRes = await fetch(`${BASE_URL}/api/repairs`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      customerId: dbCustomer?.id,
      customerName: dbCustomer?.name,
      customerPhone: dbCustomer?.phone,
      deviceBrand: 'Apple',
      deviceModel: 'iPhone 14 Pro Max',
      problemDescription: 'Broken OLED screen & depleted battery',
      estimatedCost: 18500,
      advancePaid: 5000,
      branchId: branch.id,
      technicianId: superAdmin.id,
      status: 'RECEIVED'
    })
  });
  const repairJson: any = await repairRes.json().catch(() => ({}));
  if (!repairRes.ok) {
    console.error("  [REPAIR ERROR RESPONSE]:", repairRes.status, repairJson);
  }
  assert(repairRes.status === 200 || repairRes.status === 201, 'POST /api/repairs returns HTTP 200/201');
  assert(!!repairJson.id, 'Repair order created with valid database ID');
  assert(!!repairJson.repairNumber, 'Repair order assigned official repairNumber');

  // Verify in database
  let dbRepair = await prisma.repair.findUnique({ where: { id: repairJson.id } });
  assert(!!dbRepair, 'Repair order verified in Prisma database');
  assert(dbRepair?.status === 'RECEIVED', 'Repair order initial status is RECEIVED');
  assert(Number(dbRepair?.advancePaid) === 5000, 'Advance payment persisted in database');

  // Update Repair Status
  const repairUpdateRes = await fetch(`${BASE_URL}/api/repairs/${repairJson.id}`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({
      status: 'IN_PROCESS',
      remarks: 'Screen disassembled, waiting for adhesive curing'
    })
  });
  assert(repairUpdateRes.status === 200, 'PATCH /api/repairs/:id returns HTTP 200 OK');
  dbRepair = await prisma.repair.findUnique({ where: { id: repairJson.id } });
  assert(dbRepair?.status === 'IN_PROCESS', 'Repair status update persisted in database');

  // --- MODULE 3: INVENTORY HUB ---
  console.log('\n--- MODULE 3: Inventory Hub Data Persistence ---');
  const itemSku = 'SKU-' + Date.now();
  const invRes = await fetch(`${BASE_URL}/api/inventory`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: 'iPhone 14 Pro Max OLED Display Assembly',
      brand: 'Apple',
      model: 'iPhone 14 Pro Max',
      category: 'Screen & Glass',
      sku: itemSku,
      currentStock: 10,
      minStock: 2,
      costPrice: 12000,
      sellingPrice: 16500,
      unit: 'Piece'
    })
  });
  assert(invRes.status === 200 || invRes.status === 201, 'POST /api/inventory returns HTTP 200/201');
  const invJson: any = await invRes.json();
  assert(!!invJson.id, 'Inventory item created with valid database ID');

  let dbInv = await prisma.inventoryItem.findUnique({ where: { id: invJson.id } });
  assert(!!dbInv, 'Inventory item verified in Prisma database');
  assert(dbInv?.currentStock === 10, 'Initial stock count persisted (10)');

  // Stock In Intake
  const stockInRes = await fetch(`${BASE_URL}/api/inventory/${invJson.id}/stock-in`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      quantity: 5,
      reason: 'RESTOCK',
      notes: 'New shipment from supplier'
    })
  });
  assert(stockInRes.status === 200, 'POST /api/inventory/:id/stock-in returns HTTP 200 OK');
  dbInv = await prisma.inventoryItem.findUnique({ where: { id: invJson.id } });
  assert(dbInv?.currentStock === 15, 'Stock in transaction persisted in database (10 + 5 = 15)');

  // --- MODULE 4: COURIER HUB ---
  console.log('\n--- MODULE 4: Courier Hub Data Persistence ---');
  const courierAwb = 'AWB-' + Date.now();
  const courierRes = await fetch(`${BASE_URL}/api/couriers/incoming`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      courierTrackingNumber: courierAwb,
      courierCompany: 'Nepal Post / Sundar Courier',
      senderName: 'Pokhara Branch Service',
      senderPhone: '9856000000',
      receiverBranchId: branch.id,
      customerName: 'Pokhara Customer',
      customerPhone: '9856000000',
      deviceBrand: 'Samsung',
      deviceModel: 'Samsung S23 Ultra',
      status: 'RECEIVED'
    })
  });
  const courierJson: any = await courierRes.json().catch(() => ({}));
  if (!courierRes.ok) {
    console.error("  [COURIER ERROR RESPONSE]:", courierRes.status, courierJson);
  }
  assert(courierRes.status === 200 || courierRes.status === 201, 'POST /api/couriers/incoming returns HTTP 200/201');
  const courierRepairId = courierJson.repair?.id || courierJson.id;
  assert(!!courierRepairId, 'Courier shipment created with database ID');

  let dbCourierRepair = await prisma.repair.findUnique({ where: { id: courierRepairId } });
  assert(!!dbCourierRepair, 'Courier record verified in Prisma database');
  assert(dbCourierRepair?.courierTrackingNumber === courierAwb, 'Courier tracking number persisted in database');

  // --- MODULE 5: BATTERY WARRANTY HUB ---
  console.log('\n--- MODULE 5: Battery Warranty Hub Data Persistence ---');
  const warrantyRes = await fetch(`${BASE_URL}/api/battery-warranties`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      repairId: dbRepair?.id,
      batteryType: 'Deji High Capacity Battery',
      warrantyPeriod: '6_MONTHS',
      terms: 'Standard battery replacement warranty terms'
    })
  });
  const warrantyJson: any = await warrantyRes.json().catch(() => ({}));
  if (!warrantyRes.ok) {
    console.error("  [WARRANTY ERROR RESPONSE]:", warrantyRes.status, warrantyJson);
  }
  assert(warrantyRes.status === 200 || warrantyRes.status === 201, 'POST /api/battery-warranties returns HTTP 200/201');
  const warrantyId = warrantyJson.warranty?.id || warrantyJson.id;
  assert(!!warrantyId, 'Warranty created with database ID');

  let dbWarranty = await prisma.batteryWarranty.findUnique({ where: { id: warrantyId } });
  assert(!!dbWarranty, 'Battery warranty verified in Prisma database');
  assert(dbWarranty?.batteryType === 'Deji High Capacity Battery', 'Battery type persisted in database');

  // Claim Warranty
  const claimRes = await fetch(`${BASE_URL}/api/battery-warranties/${warrantyId}/claim`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      issueDescription: 'Battery health dropped below 80% within warranty period',
      actionTaken: 'BATTERY_REPLACED',
      notes: 'Defective BMS board, free replacement issued'
    })
  });
  const claimJson: any = await claimRes.json().catch(() => ({}));
  if (!claimRes.ok) {
    console.error("  [CLAIM ERROR RESPONSE]:", claimRes.status, claimJson);
  }
  assert(claimRes.status === 200 || claimRes.status === 201, 'POST /api/battery-warranties/:id/claim returns HTTP 200/201');
  dbWarranty = await prisma.batteryWarranty.findUnique({ where: { id: warrantyId } });
  assert(dbWarranty?.status === 'REPLACED' || dbWarranty?.status === 'CLAIMED', 'Warranty status updated to REPLACED/CLAIMED in database');

  // --- MODULE 6: ATTENDANCE ---
  console.log('\n--- MODULE 6: Attendance Data Persistence ---');
  const testAttendanceDate = '2099-01-01';
  await prisma.attendance.deleteMany({ where: { userId: superAdmin.id, date: testAttendanceDate } }).catch(() => {});

  const attendanceRes = await fetch(`${BASE_URL}/api/attendance/mark`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      userId: superAdmin.id,
      date: testAttendanceDate,
      status: 'PRESENT',
      checkInTime: new Date().toISOString(),
      branchId: branch.id
    })
  });
  const attJson: any = await attendanceRes.json().catch(() => ({}));
  if (!attendanceRes.ok) {
    console.error("  [ATTENDANCE ERROR RESPONSE]:", attendanceRes.status, attJson);
  }
  assert(attendanceRes.status === 200 || attendanceRes.status === 201, 'POST /api/attendance/mark returns HTTP 200/201');
  assert(attJson.success === true, 'Attendance mark confirms success: true');

  const dbAttendance = await prisma.attendance.findFirst({
    where: { userId: superAdmin.id, date: testAttendanceDate }
  });
  assert(!!dbAttendance, 'Attendance verified in Prisma database');
  assert(dbAttendance?.status === 'PRESENT', 'Attendance status PRESENT persisted in database');

  // --- MODULE 7: REPAIR DAMAGE RECORDS ---
  console.log('\n--- MODULE 7: Repair Damage Records Data Persistence ---');
  const todayStr = new Date().toISOString().split('T')[0];
  const damageRes = await fetch(`${BASE_URL}/api/repair-damage`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      repairId: dbRepair?.id,
      repairNumber: dbRepair?.repairNumber,
      customerName: dbCustomer?.name,
      deviceModel: 'iPhone 14 Pro Max',
      damagedComponent: 'Back Glass Cover Panel',
      damageDescription: 'Hairline crack near top camera bezel during frame separation',
      damageDate: todayStr,
      estimatedCost: 2500,
      staffId: superAdmin.id
    })
  });
  const damageJson: any = await damageRes.json().catch(() => ({}));
  if (!damageRes.ok) {
    console.error("  [DAMAGE ERROR RESPONSE]:", damageRes.status, damageJson);
  }
  assert(damageRes.status === 200 || damageRes.status === 201, 'POST /api/repair-damage returns HTTP 200/201');
  const damageId = damageJson.record?.id || damageJson.id;
  assert(!!damageId, 'Damage record created with database ID');

  const dbDamage = await prisma.repairRelatedDamage.findUnique({ where: { id: damageId } });
  assert(!!dbDamage, 'Damage record verified in Prisma database');
  assert(Number(dbDamage?.estimatedCost) === 2500, 'Damage estimated cost persisted in database');

  // --- MODULE 8: SERVICES & REPAIR PRICES ---
  console.log('\n--- MODULE 8: Services & Repair Prices Data Persistence ---');
  const priceRes = await fetch(`${BASE_URL}/api/repair-prices`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      brand: 'Google',
      model: 'Pixel 8 Pro',
      category: 'Display',
      serviceName: 'Original OLED Display Replacement',
      price: 24500,
      status: 'ACTIVE'
    })
  });
  assert(priceRes.status === 200 || priceRes.status === 201, 'POST /api/repair-prices returns HTTP 200/201');
  const priceJson: any = await priceRes.json();
  assert(!!priceJson.id, 'Repair price created with database ID');

  let dbPrice = await prisma.repairPrice.findUnique({ where: { id: priceJson.id } });
  assert(!!dbPrice, 'Repair price verified in Prisma database');
  assert(Number(dbPrice?.price) === 24500, 'Service price persisted in database (24,500 NPR)');

  // Update Price
  const priceUpdateRes = await fetch(`${BASE_URL}/api/repair-prices/${priceJson.id}`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      brand: 'Google',
      model: 'Pixel 8 Pro',
      category: 'Display',
      serviceName: 'Original OLED Display Replacement',
      price: 22000,
      status: 'ACTIVE'
    })
  });
  assert(priceUpdateRes.status === 200, 'PUT /api/repair-prices/:id returns HTTP 200 OK');
  dbPrice = await prisma.repairPrice.findUnique({ where: { id: priceJson.id } });
  assert(Number(dbPrice?.price) === 22000, 'Updated price persisted in database (22,000 NPR)');

  // --- MODULE 9: HOMEPAGE SLIDESHOW ---
  console.log('\n--- MODULE 9: Homepage Slideshow Data Persistence ---');
  const slideRes = await fetch(`${BASE_URL}/api/admin/slides`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      title: 'Precision Micro-Soldering Lab in Kathmandu',
      description: 'Expert motherboard and CPU IC repairs with warranty',
      imageUrl: '/assets/images/phone_repair_lab_1786719222650.jpg',
      buttonText: 'Check Rates',
      buttonLink: '/services',
      displayOrder: 1,
      status: 'ACTIVE'
    })
  });
  assert(slideRes.status === 200 || slideRes.status === 201, 'POST /api/admin/slides returns HTTP 200/201');
  const slideJson: any = await slideRes.json();
  assert(!!slideJson.id, 'Slide created with database ID');

  const dbSlide = await prisma.homeSlide.findUnique({ where: { id: slideJson.id } });
  assert(!!dbSlide, 'Home slide verified in Prisma database');
  assert(dbSlide?.title === 'Precision Micro-Soldering Lab in Kathmandu', 'Slide title persisted in database');

  // Clean up test records safely
  await prisma.homeSlide.delete({ where: { id: slideJson.id } }).catch(() => {});
  await prisma.repairPrice.delete({ where: { id: priceJson.id } }).catch(() => {});
  if (damageId) await prisma.repairRelatedDamage.delete({ where: { id: damageId } }).catch(() => {});
  await prisma.batteryWarranty.delete({ where: { id: warrantyId } }).catch(() => {});
  if (courierRepairId) await prisma.repair.delete({ where: { id: courierRepairId } }).catch(() => {});
  await prisma.inventoryItem.delete({ where: { id: invJson.id } }).catch(() => {});
  await prisma.repair.delete({ where: { id: repairJson.id } }).catch(() => {});
  await prisma.customer.delete({ where: { id: custJson.id } }).catch(() => {});

  console.log('\n================================================================================');
  console.log(`ALL DASHBOARD PERSISTENCE TESTS PASSED: ${testCounter}/${testCounter} (100%)`);
  console.log('================================================================================\n');
}

runDashboardPersistenceE2ETests()
  .catch((err) => {
    console.error('\nTEST SUITE FAILED:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
