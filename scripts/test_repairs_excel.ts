import * as XLSX from 'xlsx';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "mts-lab-super-secret-key";
const BASE_URL = "http://localhost:3000";

let testCounter = 0;
function assert(condition: boolean, testName: string) {
  testCounter++;
  if (!condition) {
    console.error(`  ✗ FAIL [Test ${testCounter}]: ${testName}`);
    throw new Error(`Assertion failed: ${testName}`);
  }
  console.log(`  ✓ PASS [Test ${testCounter}]: ${testName}`);
}

async function runRepairsExcelTests() {
  console.log("================================================================================");
  console.log("MTS LAB — REPAIRS: EXCEL IMPORT & EXPORT TEST SUITE");
  console.log("================================================================================");

  // --- GROUP 1: Provisioning Test Actors & Database Seed ---
  console.log("\n--- GROUP 1: Provisioning Test Actors & Database Seed ---");
  const superAdmin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } }) ||
    await prisma.user.create({
      data: {
        email: "superadmin_test@mtslab.com",
        name: "Super Admin Tester",
        role: "SUPER_ADMIN",
        password: "hash"
      }
    });

  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } }) ||
    await prisma.user.create({
      data: {
        email: "admin_test@mtslab.com",
        name: "Admin Tester",
        role: "ADMIN",
        password: "hash"
      }
    });

  const receptionist = await prisma.user.findFirst({ where: { role: 'RECEPTIONIST' } }) ||
    await prisma.user.create({
      data: {
        email: "receptionist_test@mtslab.com",
        name: "Receptionist Tester",
        role: "RECEPTIONIST",
        password: "hash"
      }
    });

  const technician = await prisma.user.findFirst({ where: { role: 'TECHNICIAN' } }) ||
    await prisma.user.create({
      data: {
        email: "technician_test@mtslab.com",
        name: "Technician Tester",
        role: "TECHNICIAN",
        password: "hash"
      }
    });

  const branch = await prisma.branch.findFirst() ||
    await prisma.branch.create({
      data: {
        name: "Main Branch",
        location: "Kathmandu",
        phone: "015364307"
      }
    });

  const superAdminToken = jwt.sign({ id: superAdmin.id, email: superAdmin.email, name: superAdmin.name, role: superAdmin.role }, JWT_SECRET, { expiresIn: '1h' });
  const adminToken = jwt.sign({ id: admin.id, email: admin.email, name: admin.name, role: admin.role }, JWT_SECRET, { expiresIn: '1h' });
  const receptionistToken = jwt.sign({ id: receptionist.id, email: receptionist.email, name: receptionist.name, role: receptionist.role }, JWT_SECRET, { expiresIn: '1h' });
  const technicianToken = jwt.sign({ id: technician.id, email: technician.email, name: technician.name, role: technician.role }, JWT_SECRET, { expiresIn: '1h' });

  assert(!!superAdminToken && !!adminToken && !!receptionistToken && !!technicianToken, "Generated RBAC test authentication tokens");

  // Create a seeded repair with phone with leading zero (015364307) and IMEI with leading zero (001234567890123)
  const testRepairNumber = "REP-TEST-9901";
  await prisma.repairLog.deleteMany({ where: { repair: { repairNumber: testRepairNumber } } });
  await prisma.repair.deleteMany({ where: { repairNumber: testRepairNumber } });

  let seedCustomer = await prisma.customer.findFirst({ where: { phone: "015364307" } });
  if (!seedCustomer) {
    seedCustomer = await prisma.customer.create({
      data: {
        customerId: "CUST-SEED-01",
        name: "Test Seed Customer",
        phone: "015364307",
        email: "seed@example.com",
        address: "New Road Kathmandu"
      }
    });
  }

  const seedRepair = await prisma.repair.create({
    data: {
      repairNumber: testRepairNumber,
      customerId: seedCustomer.id,
      customerName: seedCustomer.name,
      customerPhone: seedCustomer.phone,
      customerEmail: seedCustomer.email,
      customerAddress: seedCustomer.address,
      deviceBrand: "APPLE",
      deviceModel: "iPhone 14 Pro Max",
      imeiNumber: "001234567890123",
      deviceCondition: "Mint",
      problemDescription: "Original display broken and replacement required",
      accessoriesReceived: "Device Only",
      estimatedCost: 28000,
      advancePaid: 10000,
      totalPaid: 10000,
      paymentStatus: "PARTIAL",
      status: "IN_PROCESS",
      remarks: "Handle with extreme care, VIP customer",
      branchId: branch.id,
      technicianId: technician.id,
      createdById: superAdmin.id,
      createdAt: new Date("2026-08-20T10:00:00Z"),
      expectedCompletionDate: new Date("2026-08-22T18:00:00Z")
    }
  });

  assert(seedRepair.repairNumber === testRepairNumber, `Database seeded with repair ${testRepairNumber} (leading zero phone: 015364307, IMEI: 001234567890123)`);

  // =========================================================================
  // TEST 1 & 2: Export Repairs to Excel (.xlsx) & Inspect Contents
  // =========================================================================
  console.log("\n--- GROUP 2: Test 1 & 2 - Excel Export & Data Formatting Verification ---");
  const exportRes = await fetch(`${BASE_URL}/api/repairs/export`, {
    headers: { Authorization: `Bearer ${superAdminToken}` }
  });

  if (exportRes.status !== 200) {
    const text = await exportRes.text();
    console.error("Export response failed:", exportRes.status, text);
  }

  assert(exportRes.status === 200, "GET /api/repairs/export returns HTTP 200 OK with Bearer Authorization header");
  assert(
    exportRes.headers.get('content-type')?.includes('spreadsheetml.sheet') || false,
    "Export response header contains Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  assert(
    exportRes.headers.get('content-disposition')?.includes('attachment; filename="MTS_Lab_Repairs_') || false,
    "Export response header contains standard attachment Content-Disposition"
  );

  // Test query parameter token export fallback
  const queryExportRes = await fetch(`${BASE_URL}/api/repairs/export?token=${adminToken}`);
  assert(queryExportRes.status === 200, "GET /api/repairs/export?token=... succeeds with HTTP 200 OK for query token fallback");

  const arrayBuffer = await exportRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const exportedWorkbook = XLSX.read(buffer, { type: 'buffer' });

  assert(exportedWorkbook.SheetNames.includes('Repairs'), "Exported workbook contains sheet 'Repairs'");

  const exportedSheet = exportedWorkbook.Sheets['Repairs'];
  const exportedRows: any[] = XLSX.utils.sheet_to_json(exportedSheet, { defval: '', raw: false });

  assert(exportedRows.length > 0, `Exported Excel sheet contains ${exportedRows.length} repair rows`);

  // Verify column headings
  const firstRow = exportedRows[0];
  const requiredColumns = [
    'Repair Number',
    'Customer Name',
    'Customer Phone Number',
    'Customer Email',
    'Customer Address',
    'Device Brand',
    'Device Model',
    'IMEI Number',
    'Device Condition',
    'Device Problem',
    'Accessories Received',
    'Repair Status',
    'Assigned Technician',
    'Estimated Cost (NPR)',
    'Advance Paid (NPR)',
    'Total Paid (NPR)',
    'Payment Status',
    'Register Date',
    'Estimated/Service Date',
    'Repair Remarks',
    'Created By',
    'Created Date'
  ];

  requiredColumns.forEach(col => {
    assert(col in firstRow, `Export contains required column heading: '${col}'`);
  });

  // Verify leading zero preservation and formatting
  const targetRow = exportedRows.find(r => r['Repair Number'] === testRepairNumber);
  assert(!!targetRow, `Found seeded record '${testRepairNumber}' in exported Excel rows`);
  assert(targetRow['Customer Phone Number'] === '015364307', "Phone number preserved leading zero: '015364307'");
  assert(targetRow['IMEI Number'] === '001234567890123', "IMEI preserved leading zeros: '001234567890123'");
  assert(targetRow['Device Brand'] === 'APPLE', "Device Brand is APPLE");
  assert(targetRow['Repair Status'] === 'IN_PROCESS', "Repair status is IN_PROCESS");
  assert(targetRow['Register Date'] === '20/08/2026', "Register Date formatted as DD/MM/YYYY: '20/08/2026'");
  assert(targetRow['Estimated/Service Date'] === '22/08/2026', "Estimated/Service Date formatted as DD/MM/YYYY: '22/08/2026'");

  // =========================================================================
  // TEST 3: Download Clean Template
  // =========================================================================
  console.log("\n--- GROUP 3: Test 3 - Excel Template Download Verification ---");
  const templateRes = await fetch(`${BASE_URL}/api/repairs/import/template`, {
    headers: { Authorization: `Bearer ${receptionistToken}` }
  });

  assert(templateRes.status === 200, "GET /api/repairs/import/template returns HTTP 200 OK");
  const templateBuffer = Buffer.from(await templateRes.arrayBuffer());
  const templateWorkbook = XLSX.read(templateBuffer, { type: 'buffer' });
  const templateSheet = templateWorkbook.Sheets[templateWorkbook.SheetNames[0]];
  const templateRows: any[] = XLSX.utils.sheet_to_json(templateSheet, { defval: '', raw: false });

  assert(templateRows.length === 2, "Template contains 2 clean example formatted sample rows without real customer data");
  assert('Repair Number' in templateRows[0], "Template includes Repair Number column");
  assert('Customer Phone Number' in templateRows[0], "Template includes Customer Phone Number column");
  assert('Register Date' in templateRows[0], "Template includes Register Date column");

  // =========================================================================
  // TEST 4: Valid Excel Import & Relationship Linking
  // =========================================================================
  console.log("\n--- GROUP 4: Test 4 - Valid Excel Import & Relationship Linking ---");
  const importRowsValid = [
    {
      'Repair Number': 'REP-IMP-001',
      'Customer Name': 'Rohan Shrestha',
      'Customer Phone Number': '0981234567',
      'Customer Email': 'rohan.shrestha@example.com',
      'Customer Address': 'Baneshwor, Kathmandu',
      'Device Brand': 'Samsung',
      'Device Model': 'Galaxy S23',
      'IMEI Number': '009876543210987',
      'Device Condition': 'Scratched',
      'Device Problem': 'Display flickering and touch unresponsive',
      'Accessories Received': 'Device with case',
      'Repair Status': 'RECEIVED',
      'Assigned Technician': technician.name,
      'Estimated Cost (NPR)': 12000,
      'Advance Paid (NPR)': 4000,
      'Total Paid (NPR)': 4000,
      'Payment Status': 'PARTIAL',
      'Register Date': '20/08/2026',
      'Estimated/Service Date': '23/08/2026',
      'Repair Remarks': 'Customer needs backup before repair'
    },
    {
      'Repair Number': 'REP-IMP-002',
      'Customer Name': 'Pooja Karki',
      'Customer Phone Number': '9841000000',
      'Customer Email': 'pooja.karki@example.com',
      'Customer Address': 'Lalitpur',
      'Device Brand': 'Apple',
      'Device Model': 'iPhone 12',
      'IMEI Number': '351234567890123',
      'Device Condition': 'Good',
      'Device Problem': 'Battery draining fast',
      'Accessories Received': 'Device Only',
      'Repair Status': 'IN_PROCESS',
      'Assigned Technician': '',
      'Estimated Cost (NPR)': 4500,
      'Advance Paid (NPR)': 4500,
      'Total Paid (NPR)': 4500,
      'Payment Status': 'PAID',
      'Register Date': '20/08/2026',
      'Estimated/Service Date': '21/08/2026',
      'Repair Remarks': 'Battery replacement completed'
    }
  ];

  // Clean up any previous test imports
  await prisma.repairLog.deleteMany({ where: { repair: { repairNumber: { in: ['REP-IMP-001', 'REP-IMP-002'] } } } });
  await prisma.repair.deleteMany({ where: { repairNumber: { in: ['REP-IMP-001', 'REP-IMP-002'] } } });

  // 1. Preview
  const previewRes = await fetch(`${BASE_URL}/api/repairs/import/preview`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({ rows: importRowsValid })
  });

  assert(previewRes.status === 200, "POST /api/repairs/import/preview returns HTTP 200 OK");
  const previewJson: any = await previewRes.json();

  assert(previewJson.totalRows === 2, "Preview correctly identifies totalRows = 2");
  assert(previewJson.validRows === 2, "Preview correctly validates validRows = 2");
  assert(previewJson.invalidRows === 0, "Preview correctly counts invalidRows = 0");
  assert(previewJson.duplicateRows === 0, "Preview correctly counts duplicateRows = 0");

  // 2. Confirm Import
  const confirmRes = await fetch(`${BASE_URL}/api/repairs/import/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({ items: previewJson.items.filter((i: any) => i.status === 'VALID') })
  });

  assert(confirmRes.status === 201, "POST /api/repairs/import/confirm returns HTTP 201 Created");
  const confirmJson: any = await confirmRes.json();
  assert(confirmJson.importedCount === 2, "Confirm import inserted 2 new records");

  // 3. Verify in SQLite Database
  const dbRepair1 = await prisma.repair.findUnique({
    where: { repairNumber: 'REP-IMP-001' },
    include: { customer: true, technician: true }
  });
  assert(!!dbRepair1, "Imported repair 1 exists in SQLite database");
  assert(dbRepair1?.customerPhone === '0981234567', `Leading zero in phone number preserved in DB: ${dbRepair1?.customerPhone}`);
  assert(dbRepair1?.imeiNumber === '009876543210987', `Leading zero in IMEI preserved in DB: ${dbRepair1?.imeiNumber}`);
  assert(dbRepair1?.technicianId === technician.id, "Assigned technician correctly linked");
  assert(dbRepair1?.status === 'RECEIVED', "Repair status stored as RECEIVED");

  // =========================================================================
  // TEST 5: Duplicate Detection & Protection
  // =========================================================================
  console.log("\n--- GROUP 5: Test 5 - Duplicate Detection & Protection ---");
  const duplicatePreviewRes = await fetch(`${BASE_URL}/api/repairs/import/preview`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${receptionistToken}`
    },
    body: JSON.stringify({ rows: importRowsValid })
  });

  const duplicatePreviewJson: any = await duplicatePreviewRes.json();
  assert(duplicatePreviewJson.duplicateRows === 2, `Preview flags duplicateRows = 2 (${duplicatePreviewJson.duplicateRows}/2)`);
  assert(duplicatePreviewJson.validRows === 0, "Duplicate rows are flagged so validRows = 0");
  assert(duplicatePreviewJson.items[0].status === 'DUPLICATE', "Item 1 status is 'DUPLICATE'");
  assert(duplicatePreviewJson.items[0].errors[0].includes("already exists in database"), "Error message indicates repair number already exists");

  // =========================================================================
  // TEST 6: Detailed Row Validation & Error Reporting
  // =========================================================================
  console.log("\n--- GROUP 6: Test 6 - Detailed Row Validation & Error Reporting ---");
  const invalidRows = [
    {
      'Repair Number': 'REP-INV-001',
      'Customer Name': '', // Missing name
      'Customer Phone Number': '9800000000',
      'Device Brand': 'Apple',
      'Device Model': 'iPhone 11'
    },
    {
      'Repair Number': 'REP-INV-002',
      'Customer Name': 'Bad Phone Customer',
      'Customer Phone Number': '123', // Too short
      'Device Brand': 'Samsung',
      'Device Model': 'Galaxy A10'
    },
    {
      'Repair Number': 'REP-INV-003',
      'Customer Name': 'Bad Status Customer',
      'Customer Phone Number': '9841234567',
      'Device Brand': 'Xiaomi',
      'Device Model': 'Redmi Note 10',
      'Repair Status': 'UNKNOWN_STATUS_XYZ' // Invalid status
    }
  ];

  const invalidPreviewRes = await fetch(`${BASE_URL}/api/repairs/import/preview`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminToken}`
    },
    body: JSON.stringify({ rows: invalidRows })
  });

  const invalidJson: any = await invalidPreviewRes.json();
  assert(invalidJson.invalidRows === 3, `All 3 invalid rows detected (invalidRows = ${invalidJson.invalidRows})`);
  assert(invalidJson.items[0].errors.some((e: string) => e.includes("Customer Name is required")), "Row 1 reported: Customer Name is required");
  assert(invalidJson.items[1].errors.some((e: string) => e.includes("Invalid phone number")), "Row 2 reported: Invalid phone number");
  assert(invalidJson.items[2].errors.some((e: string) => e.includes("Invalid repair status")), "Row 3 reported: Invalid repair status");

  // =========================================================================
  // TEST 7: Missing Required Columns Rejection
  // =========================================================================
  console.log("\n--- GROUP 7: Test 7 - Missing Required Columns Rejection ---");
  const missingColRows = [
    { 'Something Else': 'Value 1', 'Notes': 'Value 2' }
  ];
  const missingColRes = await fetch(`${BASE_URL}/api/repairs/import/preview`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({ rows: missingColRows })
  });
  assert(missingColRes.status === 400, "POST /api/repairs/import/preview returns 400 for missing required columns");
  const missingColJson: any = await missingColRes.json();
  assert(missingColJson.error.includes("Missing required columns"), "Error explains missing required columns in sheet");

  // =========================================================================
  // TEST 8: Role-Based Access Control (RBAC)
  // =========================================================================
  console.log("\n--- GROUP 8: Test 8 - Role-Based Access Control (RBAC) ---");
  const techExportRes = await fetch(`${BASE_URL}/api/repairs/export`, {
    headers: { Authorization: `Bearer ${technicianToken}` }
  });
  assert(techExportRes.status === 403, "TECHNICIAN receives HTTP 403 Forbidden on Export");

  const techPreviewRes = await fetch(`${BASE_URL}/api/repairs/import/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${technicianToken}` },
    body: JSON.stringify({ rows: importRowsValid })
  });
  assert(techPreviewRes.status === 403, "TECHNICIAN receives HTTP 403 Forbidden on Import Preview");

  const techConfirmRes = await fetch(`${BASE_URL}/api/repairs/import/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${technicianToken}` },
    body: JSON.stringify({ items: [] })
  });
  assert(techConfirmRes.status === 403, "TECHNICIAN receives HTTP 403 Forbidden on Import Confirm");

  const unauthRes = await fetch(`${BASE_URL}/api/repairs/export`);
  assert(unauthRes.status === 401, "Unauthenticated request receives HTTP 401 Unauthorized");

  // =========================================================================
  // TEST 9: Audit Log Verification
  // =========================================================================
  console.log("\n--- GROUP 9: Test 9 - Audit Log Verification ---");
  const exportAudit = await prisma.auditLog.findFirst({
    where: { action: 'REPAIR_EXCEL_EXPORTED' },
    orderBy: { createdAt: 'desc' }
  });
  assert(!!exportAudit, "Audit Log recorded for REPAIR_EXCEL_EXPORTED");
  assert([superAdmin.email, admin.email, receptionist.email].includes(exportAudit?.userEmail || ''), "Audit log records user email correctly");

  const importAudit = await prisma.auditLog.findFirst({
    where: { action: 'REPAIR_EXCEL_IMPORTED' },
    orderBy: { createdAt: 'desc' }
  });
  assert(!!importAudit, "Audit Log recorded for REPAIR_EXCEL_IMPORTED");
  assert([superAdmin.email, admin.email, receptionist.email].includes(importAudit?.userEmail || ''), "Audit log records importer user email correctly");

  console.log("\n================================================================================");
  console.log(`ALL REPAIRS EXCEL TESTS PASSED: ${testCounter}/${testCounter} (100%)`);
  console.log("================================================================================\n");
}

runRepairsExcelTests()
  .catch((err) => {
    console.error("\nTEST RUN FAILED:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
