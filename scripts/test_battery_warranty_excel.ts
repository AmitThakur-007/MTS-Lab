import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'mts-lab-super-secret-key';

// Helper to generate auth tokens
function generateToken(role: string, email: string, name: string, id: string) {
  return jwt.sign({ id, email, role, name }, JWT_SECRET, { expiresIn: '1h' });
}

async function runBatteryWarrantyExcelTests() {
  console.log("================================================================================");
  console.log("MTS LAB — BATTERY WARRANTY HUB: EXCEL IMPORT & EXPORT TEST SUITE");
  console.log("================================================================================");

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, message: string) {
    totalTests++;
    if (condition) {
      console.log(`  ✓ PASS [Test ${totalTests}]: ${message}`);
      passedTests++;
    } else {
      console.error(`  ✗ FAIL [Test ${totalTests}]: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // Provision test users for RBAC testing
  console.log("\n--- GROUP 1: Provisioning Test Actors & Database Seed ---");
  let branch = await prisma.branch.findFirst();
  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        name: 'Kathmandu Central Hub',
        location: 'New Road, Kathmandu',
        phone: '+977-01-4220000'
      }
    });
  }

  const superAdmin = await prisma.user.upsert({
    where: { email: 'test_superadmin@mtslab.com' },
    update: { role: 'SUPER_ADMIN', accountStatus: 'ACTIVE', isActive: true, branchId: branch.id },
    create: {
      email: 'test_superadmin@mtslab.com',
      username: 'test_superadmin',
      password: 'password123',
      name: 'Super Admin Tester',
      role: 'SUPER_ADMIN',
      accountStatus: 'ACTIVE',
      isActive: true,
      branchId: branch.id
    }
  });

  const admin = await prisma.user.upsert({
    where: { email: 'test_admin@mtslab.com' },
    update: { role: 'ADMIN', accountStatus: 'ACTIVE', isActive: true, branchId: branch.id },
    create: {
      email: 'test_admin@mtslab.com',
      username: 'test_admin',
      password: 'password123',
      name: 'Admin Tester',
      role: 'ADMIN',
      accountStatus: 'ACTIVE',
      isActive: true,
      branchId: branch.id
    }
  });

  const receptionist = await prisma.user.upsert({
    where: { email: 'test_receptionist@mtslab.com' },
    update: { role: 'RECEPTIONIST', accountStatus: 'ACTIVE', isActive: true, branchId: branch.id },
    create: {
      email: 'test_receptionist@mtslab.com',
      username: 'test_receptionist',
      password: 'password123',
      name: 'Receptionist Tester',
      role: 'RECEPTIONIST',
      accountStatus: 'ACTIVE',
      isActive: true,
      branchId: branch.id
    }
  });

  const technician = await prisma.user.upsert({
    where: { email: 'test_technician@mtslab.com' },
    update: { role: 'TECHNICIAN', accountStatus: 'ACTIVE', isActive: true, branchId: branch.id },
    create: {
      email: 'test_technician@mtslab.com',
      username: 'test_technician',
      password: 'password123',
      name: 'Technician Tester',
      role: 'TECHNICIAN',
      accountStatus: 'ACTIVE',
      isActive: true,
      branchId: branch.id
    }
  });

  const superAdminToken = generateToken(superAdmin.role, superAdmin.email, superAdmin.name, superAdmin.id);
  const adminToken = generateToken(admin.role, admin.email, admin.name, admin.id);
  const receptionistToken = generateToken(receptionist.role, receptionist.email, receptionist.name, receptionist.id);
  const technicianToken = generateToken(technician.role, technician.email, technician.name, technician.id);

  assert(!!superAdminToken && !!adminToken && !!receptionistToken && !!technicianToken, "Generated RBAC test authentication tokens");

  // Create a seed repair and battery warranty with leading-zero phone and IMEI
  const testCustomer = await prisma.customer.upsert({
    where: { customerId: 'CUST-EXCEL-01' },
    update: { phone: '015364307', name: 'Sabita Excel Customer' },
    create: {
      customerId: 'CUST-EXCEL-01',
      name: 'Sabita Excel Customer',
      phone: '015364307',
      email: 'sabita.customer@example.com',
      address: 'Pako, New Road'
    }
  });

  const testRepair = await prisma.repair.upsert({
    where: { repairNumber: 'EXCEL-REP-9001' },
    update: { customerId: testCustomer.id, branchId: branch.id },
    create: {
      repairNumber: 'EXCEL-REP-9001',
      customerId: testCustomer.id,
      customerName: testCustomer.name,
      customerPhone: testCustomer.phone,
      customerEmail: testCustomer.email,
      deviceBrand: 'APPLE',
      deviceModel: 'iPhone 14 Pro Max',
      imeiNumber: '001234567890123',
      deviceCondition: 'Mint',
      problemDescription: 'Battery Health Degradation',
      estimatedCost: 5500,
      advancePaid: 5500,
      totalPaid: 5500,
      paymentStatus: 'PAID',
      status: 'DELIVERED',
      createdById: superAdmin.id,
      branchId: branch.id
    }
  });

  const seedWarranty = await prisma.batteryWarranty.upsert({
    where: { repairId: testRepair.id },
    update: {
      customerPhone: '015364307',
      imeiNumber: '001234567890123',
      warrantyPeriod: '1_YEAR',
      branchId: branch.id
    },
    create: {
      warrantyNumber: 'BW-2026-9901',
      repairId: testRepair.id,
      repairNumber: testRepair.repairNumber,
      customerId: testCustomer.id,
      customerName: testCustomer.name,
      customerPhone: '015364307',
      customerEmail: testCustomer.email,
      deviceBrand: 'APPLE',
      deviceModel: 'iPhone 14 Pro Max',
      imeiNumber: '001234567890123',
      batteryType: 'Original OEM Battery Cell',
      warrantyPeriod: '1_YEAR',
      registrationDate: new Date('2026-08-20T10:00:00Z'),
      expiryDate: new Date('2027-08-20T10:00:00Z'),
      status: 'ACTIVE',
      claimCount: 0,
      createdById: superAdmin.id,
      branchId: branch.id
    }
  });

  assert(seedWarranty.warrantyNumber === 'BW-2026-9901', "Database seeded with warranty BW-2026-9901 (leading zero phone: 015364307, IMEI: 001234567890123)");

  // =========================================================================
  // TEST 1 & TEST 2: Export Warranty Data to Excel (.xlsx) & Inspect Contents
  // =========================================================================
  console.log("\n--- GROUP 2: Test 1 & 2 - Excel Export & Data Formatting Verification ---");
  const exportRes = await fetch(`${BASE_URL}/api/battery-warranties/export`, {
    headers: { Authorization: `Bearer ${superAdminToken}` }
  });

  assert(exportRes.status === 200, "GET /api/battery-warranties/export returns HTTP 200 OK with Bearer Authorization header");
  assert(
    exportRes.headers.get('content-type')?.includes('spreadsheetml.sheet') || false,
    "Export response header contains Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  assert(
    exportRes.headers.get('content-disposition')?.includes('attachment; filename="MTS_Lab_Battery_Warranties_') || false,
    "Export response header contains standard attachment Content-Disposition"
  );

  // Test query parameter token export support
  const queryExportRes = await fetch(`${BASE_URL}/api/battery-warranties/export?token=${adminToken}`);
  assert(queryExportRes.status === 200, "GET /api/battery-warranties/export?token=... succeeds with HTTP 200 OK for query token fallback");

  const arrayBuffer = await exportRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const exportedWorkbook = XLSX.read(buffer, { type: 'buffer' });

  assert(exportedWorkbook.SheetNames.includes('Battery Warranties'), "Exported workbook contains sheet 'Battery Warranties'");

  const exportedSheet = exportedWorkbook.Sheets['Battery Warranties'];
  const exportedRows: any[] = XLSX.utils.sheet_to_json(exportedSheet, { defval: '', raw: false });

  assert(exportedRows.length > 0, `Exported Excel sheet contains ${exportedRows.length} warranty rows`);

  // Verify column headings
  const firstRow = exportedRows[0];
  const requiredColumns = [
    'Warranty ID',
    'Repair Number',
    'Customer Name',
    'Customer Phone Number',
    'Customer Email',
    'Device Brand',
    'Device Model',
    'IMEI Number',
    'Battery Warranty Period',
    'Warranty Register Date',
    'Warranty Expiry Date',
    'Warranty Status',
    'Warranty Claim Status',
    'Created/Registered By',
    'Created Date'
  ];

  requiredColumns.forEach(col => {
    assert(col in firstRow, `Export contains required column heading: '${col}'`);
  });

  // Verify leading zeros preservation in exported row for seed customer
  const targetRow = exportedRows.find(r => r['Warranty ID'] === 'BW-2026-9901' || r['Repair Number'] === 'EXCEL-REP-9001');
  assert(!!targetRow, "Found seeded record in exported Excel rows");
  assert(String(targetRow['Customer Phone Number']).startsWith('015364307'), `Phone number preserved leading zero: '${targetRow['Customer Phone Number']}'`);
  assert(String(targetRow['IMEI Number']).startsWith('00123'), `IMEI preserved leading zeros: '${targetRow['IMEI Number']}'`);
  assert(targetRow['Battery Warranty Period'].includes('1 Year'), `Warranty period formatted cleanly: '${targetRow['Battery Warranty Period']}'`);
  assert(targetRow['Warranty Register Date'] === '20/08/2026', `Register Date formatted as DD/MM/YYYY: '${targetRow['Warranty Register Date']}'`);
  assert(targetRow['Warranty Expiry Date'] === '20/08/2027', `Expiry Date formatted as DD/MM/YYYY: '${targetRow['Warranty Expiry Date']}'`);

  // =========================================================================
  // TEST 3: Download Excel Import Template
  // =========================================================================
  console.log("\n--- GROUP 3: Test 3 - Excel Template Download Verification ---");
  const templateRes = await fetch(`${BASE_URL}/api/battery-warranties/import/template`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });

  assert(templateRes.status === 200, "GET /api/battery-warranties/import/template returns HTTP 200 OK");
  const templateBuffer = Buffer.from(await templateRes.arrayBuffer());
  const templateWorkbook = XLSX.read(templateBuffer, { type: 'buffer' });
  const templateSheet = templateWorkbook.Sheets[templateWorkbook.SheetNames[0]];
  const templateRows: any[] = XLSX.utils.sheet_to_json(templateSheet, { defval: '', raw: false });

  assert(templateRows.length === 2, "Template contains 2 clean example formatted sample rows without real customer data");
  assert('Repair Number' in templateRows[0], "Template includes Repair Number column");
  assert('Customer Phone Number' in templateRows[0], "Template includes Customer Phone Number column");
  assert('Warranty Register Date' in templateRows[0], "Template includes Warranty Register Date column");

  // =========================================================================
  // TEST 4: Import Valid Excel Data (Preview & Confirm)
  // =========================================================================
  console.log("\n--- GROUP 4: Test 4 - Valid Excel Import & Relationship Linking ---");
  // Clean up any previously imported test repairs
  await prisma.batteryWarranty.deleteMany({ where: { repairNumber: { in: ['IMP-REP-101', 'IMP-REP-102'] } } });
  await prisma.repair.deleteMany({ where: { repairNumber: { in: ['IMP-REP-101', 'IMP-REP-102'] } } });

  const validTestRows = [
    {
      'Repair Number': 'IMP-REP-101',
      'Customer Name': 'Amit Import Customer',
      'Customer Phone Number': '0981234567',
      'Customer Email': 'amit.import@example.com',
      'Device Brand': 'SAMSUNG',
      'Device Model': 'Galaxy S23 Ultra',
      'IMEI Number': '009876543210987',
      'Battery Type': 'OEM 5000mAh Battery',
      'Battery Warranty Period': '1 Year',
      'Warranty Register Date': '20/08/2026',
      'Warranty Expiry Date': '20/08/2027',
      'Warranty Status': 'ACTIVE',
      'Terms / Notes': '1 Year warranty imported via Excel'
    },
    {
      'Repair Number': 'IMP-REP-102',
      'Customer Name': 'Rohan Sharma',
      'Customer Phone Number': '9841000111',
      'Customer Email': 'rohan@example.com',
      'Device Brand': 'XIAOMI',
      'Device Model': 'Redmi Note 12',
      'IMEI Number': '869012345678901',
      'Battery Type': 'Original BN5E',
      'Battery Warranty Period': '6 Months',
      'Warranty Register Date': '20/08/2026',
      'Warranty Expiry Date': '',
      'Warranty Status': 'ACTIVE',
      'Terms / Notes': 'Auto-calculate expiry date'
    }
  ];

  // 1. Preview
  const previewRes = await fetch(`${BASE_URL}/api/battery-warranties/import/preview`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${receptionistToken}`
    },
    body: JSON.stringify({ rows: validTestRows })
  });

  assert(previewRes.status === 200, "POST /api/battery-warranties/import/preview returns HTTP 200 OK");
  const previewJson: any = await previewRes.json();
  assert(previewJson.totalRows === 2, "Preview correctly identifies totalRows = 2");
  assert(previewJson.validRows === 2, "Preview correctly validates validRows = 2");
  assert(previewJson.invalidRows === 0, "Preview correctly counts invalidRows = 0");
  assert(previewJson.duplicateRows === 0, "Preview correctly counts duplicateRows = 0");

  // 2. Confirm Import
  const confirmRes = await fetch(`${BASE_URL}/api/battery-warranties/import/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${receptionistToken}`
    },
    body: JSON.stringify({ items: previewJson.items })
  });

  assert(confirmRes.status === 201, "POST /api/battery-warranties/import/confirm returns HTTP 201 Created");
  const confirmJson: any = await confirmRes.json();
  assert(confirmJson.importedCount === 2, "Confirm import inserted 2 new records");

  // Verify created records in Prisma DB
  const importedWarranty1 = await prisma.batteryWarranty.findFirst({
    where: { repairNumber: 'IMP-REP-101' },
    include: { customer: true, repair: true }
  });

  assert(!!importedWarranty1, "Imported warranty 1 exists in SQLite database");
  assert(importedWarranty1?.customerPhone === '0981234567', "Leading zero in phone number preserved in DB: 0981234567");
  assert(importedWarranty1?.imeiNumber === '009876543210987', "Leading zero in IMEI preserved in DB: 009876543210987");
  assert(importedWarranty1?.warrantyPeriod === '1_YEAR', "Warranty period stored as 1_YEAR");

  // =========================================================================
  // TEST 5: Duplicate Protection (Import Same File Again)
  // =========================================================================
  console.log("\n--- GROUP 5: Test 5 - Duplicate Detection & Protection ---");
  const dupPreviewRes = await fetch(`${BASE_URL}/api/battery-warranties/import/preview`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({ rows: validTestRows })
  });

  const dupPreviewJson: any = await dupPreviewRes.json();
  assert(dupPreviewJson.duplicateRows === 2, `Preview flags duplicateRows = 2 (${dupPreviewJson.duplicateRows}/${dupPreviewJson.totalRows})`);
  assert(dupPreviewJson.validRows === 0, "Duplicate rows are flagged so validRows = 0");
  assert(dupPreviewJson.items[0].status === 'DUPLICATE', "Item 1 status is 'DUPLICATE'");
  assert(dupPreviewJson.items[0].errors.some((e: string) => e.includes('already registered')), "Error message indicates repair already has battery warranty");

  // =========================================================================
  // TEST 6: Invalid Data Detection (Missing Customer, Invalid Phone, Expiry < Reg)
  // =========================================================================
  console.log("\n--- GROUP 6: Test 6 - Detailed Row Validation & Error Reporting ---");
  const invalidRows = [
    {
      'Repair Number': 'BAD-REP-01',
      'Customer Name': '', // Missing name
      'Customer Phone Number': '9869276668',
      'Device Brand': 'Apple',
      'Device Model': 'iPhone 13'
    },
    {
      'Repair Number': 'BAD-REP-02',
      'Customer Name': 'John Doe',
      'Customer Phone Number': '123', // Too short
      'Device Brand': 'Samsung',
      'Device Model': 'S21'
    },
    {
      'Repair Number': 'BAD-REP-03',
      'Customer Name': 'Jane Doe',
      'Customer Phone Number': '9800000000',
      'Device Brand': 'Google',
      'Device Model': 'Pixel 7',
      'Warranty Register Date': '20/08/2026',
      'Warranty Expiry Date': '10/08/2026' // Expiry before register date
    }
  ];

  const invalidPreviewRes = await fetch(`${BASE_URL}/api/battery-warranties/import/preview`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminToken}`
    },
    body: JSON.stringify({ rows: invalidRows })
  });

  const invalidPreviewJson: any = await invalidPreviewRes.json();
  assert(invalidPreviewJson.invalidRows === 3, `All 3 invalid rows detected (invalidRows = ${invalidPreviewJson.invalidRows})`);
  assert(invalidPreviewJson.items[0].errors.includes("Customer Name is required."), "Row 1 reported: Customer Name is required");
  assert(invalidPreviewJson.items[1].errors.some((e: string) => e.includes('Invalid phone number')), "Row 2 reported: Invalid phone number");
  assert(invalidPreviewJson.items[2].errors.includes("Warranty Expiry Date must be after Registration Date."), "Row 3 reported: Warranty Expiry Date must be after Registration Date");

  // =========================================================================
  // TEST 7: Missing Required Columns Rejection
  // =========================================================================
  console.log("\n--- GROUP 7: Test 7 - Missing Required Columns Rejection ---");
  const badColumnsRows = [
    {
      'Random Column A': '123',
      'Random Column B': '456'
    }
  ];

  const badColRes = await fetch(`${BASE_URL}/api/battery-warranties/import/preview`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminToken}`
    },
    body: JSON.stringify({ rows: badColumnsRows })
  });

  assert(badColRes.status === 400, "POST /api/battery-warranties/import/preview returns 400 for missing required columns");
  const badColJson: any = await badColRes.json();
  assert(badColJson.error.includes("Missing required columns"), "Error explains missing required columns in sheet");

  // =========================================================================
  // TEST 8 & 9: Dates and Leading Zeros Verification
  // =========================================================================
  console.log("\n--- GROUP 8: Test 8 & 9 - Date Calculation & Leading Zero Integrity ---");
  const importedWarranty2 = await prisma.batteryWarranty.findFirst({
    where: { repairNumber: 'IMP-REP-102' }
  });

  assert(!!importedWarranty2, "Imported warranty 2 exists in DB");
  const autoExpiryMonth = new Date(importedWarranty2!.expiryDate).getMonth();
  const autoRegMonth = new Date(importedWarranty2!.registrationDate).getMonth();
  const monthDiff = (autoExpiryMonth + 12 - autoRegMonth) % 12;
  assert(monthDiff === 6, "Auto-calculated expiry date is exactly 6 months from registration date");

  // =========================================================================
  // TEST 10: RBAC Permissions Test
  // =========================================================================
  console.log("\n--- GROUP 9: Test 10 - Role-Based Access Control (RBAC) ---");
  // TECHNICIAN access attempt on Export
  const techExportRes = await fetch(`${BASE_URL}/api/battery-warranties/export`, {
    headers: { Authorization: `Bearer ${technicianToken}` }
  });
  assert(techExportRes.status === 403, "TECHNICIAN receives HTTP 403 Forbidden on Export");

  // TECHNICIAN access attempt on Import Preview
  const techPreviewRes = await fetch(`${BASE_URL}/api/battery-warranties/import/preview`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${technicianToken}`
    },
    body: JSON.stringify({ rows: validTestRows })
  });
  assert(techPreviewRes.status === 403, "TECHNICIAN receives HTTP 403 Forbidden on Import Preview");

  // TECHNICIAN access attempt on Import Confirm
  const techConfirmRes = await fetch(`${BASE_URL}/api/battery-warranties/import/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${technicianToken}`
    },
    body: JSON.stringify({ items: [] })
  });
  assert(techConfirmRes.status === 403, "TECHNICIAN receives HTTP 403 Forbidden on Import Confirm");

  // Unauthenticated request
  const anonRes = await fetch(`${BASE_URL}/api/battery-warranties/export`);
  assert(anonRes.status === 401, "Unauthenticated request receives HTTP 401 Unauthorized");

  // =========================================================================
  // TEST 11: Audit Logs Verification
  // =========================================================================
  console.log("\n--- GROUP 10: Test 11 - Audit Log Verification ---");
  const exportAudit = await prisma.auditLog.findFirst({
    where: { action: 'BATTERY_WARRANTY_EXCEL_EXPORTED' },
    orderBy: { createdAt: 'desc' }
  });
  assert(!!exportAudit, "Audit Log recorded for BATTERY_WARRANTY_EXCEL_EXPORTED");
  assert([superAdmin.email, admin.email].includes(exportAudit?.userEmail || ''), "Audit log records user email correctly");

  const importAudit = await prisma.auditLog.findFirst({
    where: { action: 'BATTERY_WARRANTY_EXCEL_IMPORTED' },
    orderBy: { createdAt: 'desc' }
  });
  assert(!!importAudit, "Audit Log recorded for BATTERY_WARRANTY_EXCEL_IMPORTED");
  assert(importAudit?.userEmail === receptionist.email, "Audit log records importer user email correctly");

  console.log("\n================================================================================");
  console.log(`ALL BATTERY WARRANTY EXCEL TESTS PASSED: ${passedTests}/${totalTests} (100%)`);
  console.log("================================================================================");
}

runBatteryWarrantyExcelTests()
  .catch((err) => {
    console.error("\nTEST RUN FAILED:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
