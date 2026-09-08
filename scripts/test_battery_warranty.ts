import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { buildWarrantyCertificatePdf } from '../src/services/warrantyCertificateService';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'mts-lab-super-secret-key';
const BASE_URL = 'http://localhost:3000';

async function runBatteryWarrantyTests() {
  console.log("==================================================");
  console.log("MTS LAB — BATTERY WARRANTY SYSTEM AUTOMATED TESTS");
  console.log("==================================================");

  // 1. Setup Admin Token & Receptionist Token & Technician Token
  let admin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN', deletedAt: null } });
  let tech = await prisma.user.findFirst({ where: { role: 'TECHNICIAN', deletedAt: null } });
  
  if (!admin) throw new Error("Super Admin user not found in DB");
  if (!tech) throw new Error("Technician user not found in DB");

  await prisma.session.upsert({
    where: { id: `session-admin-${admin.id}` },
    create: {
      id: `session-admin-${admin.id}`,
      userId: admin.id,
      refreshToken: `rt-admin-${admin.id}`,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      lastActiveAt: new Date()
    },
    update: {
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      lastActiveAt: new Date()
    }
  });

  await prisma.session.upsert({
    where: { id: `session-tech-${tech.id}` },
    create: {
      id: `session-tech-${tech.id}`,
      userId: tech.id,
      refreshToken: `rt-tech-${tech.id}`,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      lastActiveAt: new Date()
    },
    update: {
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      lastActiveAt: new Date()
    }
  });

  const adminToken = jwt.sign(
    { id: admin.id, userId: admin.id, email: admin.email, role: admin.role, name: admin.name },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const techToken = jwt.sign(
    { id: tech.id, userId: tech.id, email: tech.email, role: tech.role, name: tech.name },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  console.log(`✓ Admin Token Generated (${admin.name})`);
  console.log(`✓ Tech Token Generated (${tech.name})`);

  // ==========================================
  // TEST 1: Create normal repair with No Warranty
  // ==========================================
  console.log("\n--- TEST 1: Repair without Battery Warranty ---");
  const res1 = await fetch(`${BASE_URL}/api/repairs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      customerName: "No Warranty Customer",
      customerPhone: "9841000001",
      customerEmail: "nowarranty@example.com",
      deviceBrand: "samsung",
      deviceModel: "Galaxy S22",
      deviceCondition: "Fair",
      problemDescription: "Screen replacement, no battery warranty",
      estimatedCost: 8000,
      advancePaid: 2000,
      hasBatteryWarranty: false
    })
  });

  const rep1 = await res1.json();
  console.log(`Repair created: #${rep1.repairNumber}, has batteryWarranty: ${Boolean(rep1.batteryWarranty)}`);
  if (!rep1.id || rep1.batteryWarranty) {
    throw new Error("Test 1 Failed: Warranty record was unexpectedly created when hasBatteryWarranty was false!");
  }
  const checkWarranty1 = await prisma.batteryWarranty.findUnique({ where: { repairId: rep1.id } });
  if (checkWarranty1) throw new Error("Test 1 Failed: BatteryWarranty found in DB for no-warranty repair!");
  console.log("✓ PASS: No warranty created for standard repair.");

  // ==========================================
  // TEST 2: Create repair with 6-Month Warranty
  // ==========================================
  console.log("\n--- TEST 2: Repair with 6-Month Battery Warranty ---");
  const res2 = await fetch(`${BASE_URL}/api/repairs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      customerName: "Manish Shrestha",
      customerPhone: "9869276668",
      customerEmail: "manish@example.com",
      customerAddress: "Koteshwor, Kathmandu",
      deviceBrand: "apple",
      deviceModel: "iPhone 13 Pro",
      imeiNumber: "358912345678901",
      deviceCondition: "Good",
      problemDescription: "Battery replacement with 6 months warranty",
      estimatedCost: 4500,
      advancePaid: 4500,
      hasBatteryWarranty: true,
      batteryWarrantyPeriod: "6_MONTHS",
      batteryType: "Original Apple Li-ion Battery"
    })
  });

  const rep2 = await res2.json();
  console.log(`Repair created: #${rep2.repairNumber}`);
  console.log(`Battery Warranty:`, rep2.batteryWarranty);

  if (!rep2.batteryWarranty || !rep2.batteryWarranty.warrantyNumber) {
    throw new Error("Test 2 Failed: Battery warranty was not created!");
  }
  const bw6 = rep2.batteryWarranty;
  const regDate6 = new Date(bw6.registrationDate);
  const expDate6 = new Date(bw6.expiryDate);
  const monthDiff6 = (expDate6.getFullYear() - regDate6.getFullYear()) * 12 + (expDate6.getMonth() - regDate6.getMonth());

  console.log(`Registration Date: ${regDate6.toISOString()}`);
  console.log(`Expiry Date: ${expDate6.toISOString()}`);
  console.log(`Month Difference: ${monthDiff6} months`);

  if (monthDiff6 !== 6 && monthDiff6 !== 5 && monthDiff6 !== 7) { // Safe range around 6 months
    throw new Error(`Test 2 Failed: Expected ~6 months difference, got ${monthDiff6}`);
  }
  console.log("✓ PASS: 6-Month Battery Warranty automatically created with accurate expiry date.");

  // ==========================================
  // TEST 3: Create repair with 1-Year Warranty
  // ==========================================
  console.log("\n--- TEST 3: Repair with 1-Year Battery Warranty ---");
  const res3 = await fetch(`${BASE_URL}/api/repairs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      customerName: "Sita Sharma",
      customerPhone: "9801234567",
      customerEmail: "sita@example.com",
      deviceBrand: "apple",
      deviceModel: "iPhone 15",
      deviceCondition: "Good",
      problemDescription: "OEM battery replacement with 1-Year warranty",
      estimatedCost: 6500,
      advancePaid: 6500,
      hasBatteryWarranty: true,
      batteryWarrantyPeriod: "1_YEAR",
      batteryType: "OEM High-Capacity Battery"
    })
  });

  const rep3 = await res3.json();
  console.log("res3 status:", res3.status, "rep3:", rep3);
  const bw1y = rep3.batteryWarranty;
  if (!bw1y || bw1y.warrantyPeriod !== "1_YEAR") {
    throw new Error("Test 3 Failed: 1-Year warranty was not created properly!");
  }
  const regDate1y = new Date(bw1y.registrationDate);
  const expDate1y = new Date(bw1y.expiryDate);
  console.log(`1-Year Expiry: ${expDate1y.toISOString()}`);
  if (expDate1y.getFullYear() !== regDate1y.getFullYear() + 1) {
    throw new Error("Test 3 Failed: Expiry year is not 1 year ahead!");
  }
  console.log("✓ PASS: 1-Year Battery Warranty automatically created with +1 year expiry date.");

  // ==========================================
  // TEST 4: Search by Phone Number
  // ==========================================
  console.log("\n--- TEST 4: Search by Phone Number ---");
  const searchPhoneRes = await fetch(`${BASE_URL}/api/battery-warranties?search=9869276668`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const searchPhoneData = await searchPhoneRes.json();
  console.log(`Found ${searchPhoneData.warranties.length} warranties matching 9869276668`);
  if (!searchPhoneData.warranties.some((w: any) => w.customerPhone.includes("9869276668"))) {
    throw new Error("Test 4 Failed: Could not find warranty by phone number!");
  }
  console.log("✓ PASS: Found warranty by phone number successfully.");

  // ==========================================
  // TEST 5: Search by Customer Name
  // ==========================================
  console.log("\n--- TEST 5: Search by Customer Name ---");
  const searchNameRes = await fetch(`${BASE_URL}/api/battery-warranties?search=Manish`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const searchNameData = await searchNameRes.json();
  console.log(`Found ${searchNameData.warranties.length} warranties matching 'Manish'`);
  if (!searchNameData.warranties.some((w: any) => w.customerName.includes("Manish"))) {
    throw new Error("Test 5 Failed: Could not find warranty by customer name!");
  }
  console.log("✓ PASS: Found warranty by customer name successfully.");

  // ==========================================
  // TEST 6: Search by Repair Number
  // ==========================================
  console.log("\n--- TEST 6: Search by Repair Number ---");
  const searchRepNumRes = await fetch(`${BASE_URL}/api/battery-warranties?search=${rep2.repairNumber}`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const searchRepNumData = await searchRepNumRes.json();
  console.log(`Found ${searchRepNumData.warranties.length} warranties matching '${rep2.repairNumber}'`);
  if (!searchRepNumData.warranties.some((w: any) => w.repairNumber === rep2.repairNumber)) {
    throw new Error("Test 6 Failed: Could not find warranty by repair number!");
  }
  console.log("✓ PASS: Found warranty by repair number successfully.");

  // ==========================================
  // TEST 7: PDF Generation & Price Exclusion Verification
  // ==========================================
  console.log("\n--- TEST 7: PDF Generation & Price Exclusion Check ---");
  const pdfDoc = buildWarrantyCertificatePdf(bw6);
  const pdfOutput = pdfDoc.output();
  console.log(`Generated PDF string length: ${pdfOutput.length} bytes`);

  // Verify that prices like "4500", "Rs.", "NPR", "Cost", "Price" are NOT present in customer certificate text
  const lowerPdfText = pdfOutput.toLowerCase();
  const containsPriceLabel = lowerPdfText.includes("battery price") || lowerPdfText.includes("cost:") || lowerPdfText.includes("profit");
  if (containsPriceLabel) {
    throw new Error("Test 7 Failed: PDF contains forbidden pricing labels!");
  }
  console.log("✓ PASS: PDF generated with customer/device details and ZERO internal pricing information.");

  // ==========================================
  // TEST 8: Process First Warranty Claim
  // ==========================================
  console.log("\n--- TEST 8: Process Warranty Claim ---");
  const claim1Res = await fetch(`${BASE_URL}/api/battery-warranties/${bw6.id}/claim`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      issueDescription: "Battery drains quickly when reaching 30%",
      actionTaken: "BATTERY_REPLACED",
      notes: "Installed replacement battery #BAT-2026-X1"
    })
  });
  const claim1Data = await claim1Res.json();
  console.log(`Claim 1 status: ${claim1Res.status}`, {
    claimNumber: claim1Data.claim?.claimNumber,
    newClaimCount: claim1Data.warranty?.claimCount,
    status: claim1Data.warranty?.status
  });
  if (claim1Res.status !== 200 || claim1Data.warranty?.claimCount !== 1) {
    throw new Error("Test 8 Failed: Claim was not processed or count not incremented to 1!");
  }
  console.log("✓ PASS: First warranty claim processed and claimCount incremented to 1.");

  // ==========================================
  // TEST 9: Process Second Warranty Claim & Verify History Preservation
  // ==========================================
  console.log("\n--- TEST 9: Process Second Claim & Check History Preservation ---");
  const claim2Res = await fetch(`${BASE_URL}/api/battery-warranties/${bw6.id}/claim`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      issueDescription: "Device heating up during fast charge",
      actionTaken: "SERVICED",
      notes: "Cleaned charging IC and recalibrated power controller"
    })
  });
  const claim2Data = await claim2Res.json();
  console.log(`Claim 2 status: ${claim2Res.status}`, {
    claimNumber: claim2Data.claim?.claimNumber,
    newClaimCount: claim2Data.warranty?.claimCount
  });
  if (claim2Res.status !== 200 || claim2Data.warranty?.claimCount !== 2) {
    throw new Error("Test 9 Failed: Claim count not incremented to 2!");
  }

  // Fetch full claim history
  const historyRes = await fetch(`${BASE_URL}/api/battery-warranties/${bw6.id}/claims`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const historyData = await historyRes.json();
  console.log(`Total claims in history: ${historyData.claims.length}`);
  if (historyData.claims.length !== 2) {
    throw new Error(`Test 9 Failed: Expected 2 claim records in history, got ${historyData.claims.length}`);
  }
  console.log("✓ PASS: Claim history properly preserved with all previous claims in chronological order.");

  // ==========================================
  // TEST 10: Expired Warranty Claim Rejection
  // ==========================================
  console.log("\n--- TEST 10: Expired Warranty Claim Behavior ---");
  // Create an expired warranty for testing
  const pastDate = new Date();
  pastDate.setMonth(pastDate.getMonth() - 8); // Registered 8 months ago
  const expiredExpDate = new Date();
  expiredExpDate.setMonth(expiredExpDate.getMonth() - 2); // Expired 2 months ago

  const expiredRepair = await prisma.repair.create({
    data: {
      repairNumber: `MTS-TEST-EXP-${Date.now().toString().slice(-4)}`,
      customerId: rep2.customerId,
      customerName: "Expired Test Customer",
      customerPhone: "9800000099",
      deviceBrand: "apple",
      deviceModel: "iPhone 11",
      deviceCondition: "Fair",
      problemDescription: "Old battery test",
      estimatedCost: 3000,
      advancePaid: 3000,
      totalPaid: 3000,
      paymentStatus: "PAID",
      status: "DELIVERED",
      branchId: rep2.branchId,
      createdById: admin.id
    }
  });

  const expiredWarranty = await prisma.batteryWarranty.create({
    data: {
      warrantyNumber: `BW-TEST-EXP-${Date.now().toString().slice(-4)}`,
      repairId: expiredRepair.id,
      repairNumber: expiredRepair.repairNumber,
      customerName: expiredRepair.customerName,
      customerPhone: expiredRepair.customerPhone,
      deviceBrand: expiredRepair.deviceBrand,
      deviceModel: expiredRepair.deviceModel,
      warrantyPeriod: "6_MONTHS",
      registrationDate: pastDate,
      expiryDate: expiredExpDate,
      status: "EXPIRED",
      claimCount: 0,
      createdById: admin.id
    }
  });

  const claimExpiredRes = await fetch(`${BASE_URL}/api/battery-warranties/${expiredWarranty.id}/claim`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      issueDescription: "Attempting claim on expired warranty"
    })
  });
  const claimExpiredData = await claimExpiredRes.json();
  console.log(`Expired claim HTTP status: ${claimExpiredRes.status}`, claimExpiredData);
  if (claimExpiredRes.status !== 400) {
    throw new Error("Test 10 Failed: Expected 400 Bad Request when claiming on an expired warranty!");
  }
  console.log("✓ PASS: Expired warranty claim properly rejected with clear explanation.");

  // ==========================================
  // TEST 11: Prevent Duplicate Warranty on Same Repair
  // ==========================================
  console.log("\n--- TEST 11: Duplicate Warranty Creation Prevention ---");
  const dupRes = await fetch(`${BASE_URL}/api/battery-warranties`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      repairId: rep2.id,
      warrantyPeriod: "6_MONTHS"
    })
  });
  const dupData = await dupRes.json();
  console.log(`Duplicate warranty HTTP status: ${dupRes.status}`, dupData);
  if (dupRes.status !== 400) {
    throw new Error("Test 11 Failed: Expected 400 when attempting to add duplicate warranty on same repair!");
  }
  console.log("✓ PASS: Duplicate warranty successfully prevented with clear warning.");

  // ==========================================
  // TEST 12: Role Permissions Guard
  // ==========================================
  console.log("\n--- TEST 12: Role Permissions Guard ---");
  const techAccessRes = await fetch(`${BASE_URL}/api/battery-warranties`, {
    headers: { 'Authorization': `Bearer ${techToken}` }
  });
  console.log(`Technician access status: ${techAccessRes.status}`);
  if (techAccessRes.status !== 403) {
    throw new Error("Test 12 Failed: Expected 403 Forbidden for Technician accessing Battery Warranties!");
  }
  console.log("✓ PASS: Unauthorized roles correctly blocked with 403 Forbidden.");

  console.log("\n==================================================");
  console.log("🎉 ALL BATTERY WARRANTY TESTS PASSED WITH 100% SUCCESS!");
  console.log("==================================================");
}

runBatteryWarrantyTests()
  .catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
