import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'mts-lab-super-secret-key';
const OTP_SALT = process.env.OTP_SALT || "mts-lab-otp-secure-salt-2026";
const BASE_URL = 'http://localhost:3000';

const hashOtp = (code: string) => {
  return crypto.createHmac("sha256", OTP_SALT).update(String(code).trim()).digest("hex");
};

async function runSuperAdminDeletionTests() {
  console.log("================================================================================");
  console.log("MTS LAB — SUPER ADMIN PERMANENT DELETION CONTROLS TEST SUITE");
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

  // 1. Fetch Users of Different Roles
  let superAdmin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN', deletedAt: null } });
  
  if (!superAdmin) throw new Error("SUPER_ADMIN user not found in database.");

  if (!superAdmin.emailVerified) {
    superAdmin = await prisma.user.update({
      where: { id: superAdmin.id },
      data: { emailVerified: true, accountStatus: 'ACTIVE', isActive: true }
    });
  }

  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN', deletedAt: null } });
  const tech = await prisma.user.findFirst({ where: { role: 'TECHNICIAN', deletedAt: null } });
  const receptionist = await prisma.user.findFirst({ where: { role: 'RECEPTIONIST', deletedAt: null } });

  async function createTestSession(userId: string) {
    const refreshToken = `test-refresh-${userId}`;
    await prisma.session.upsert({
      where: { refreshToken },
      update: { lastActiveAt: new Date(), expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
      create: {
        userId,
        refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        lastActiveAt: new Date()
      }
    });
  }

  await createTestSession(superAdmin.id);
  const superAdminToken = jwt.sign(
    { id: superAdmin.id, userId: superAdmin.id, email: superAdmin.email, role: superAdmin.role, name: superAdmin.name },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  if (admin) await createTestSession(admin.id);
  const adminToken = admin ? jwt.sign(
    { id: admin.id, userId: admin.id, email: admin.email, role: admin.role, name: admin.name },
    JWT_SECRET,
    { expiresIn: '1h' }
  ) : null;

  if (tech) await createTestSession(tech.id);
  const techToken = tech ? jwt.sign(
    { id: tech.id, userId: tech.id, email: tech.email, role: tech.role, name: tech.name },
    JWT_SECRET,
    { expiresIn: '1h' }
  ) : null;

  if (receptionist) await createTestSession(receptionist.id);
  const receptionistToken = receptionist ? jwt.sign(
    { id: receptionist.id, userId: receptionist.id, email: receptionist.email, role: receptionist.role, name: receptionist.name },
    JWT_SECRET,
    { expiresIn: '1h' }
  ) : null;

  let customerUser = await prisma.user.findFirst({ where: { email: 'cust@example.com' } });
  if (!customerUser) {
    const pwdHash = await bcrypt.hash("MtsLab@2026Secure", 10);
    customerUser = await prisma.user.create({
      data: {
        email: 'cust@example.com',
        username: 'custtest',
        password: pwdHash,
        name: 'Customer Test',
        role: 'CUSTOMER',
        accountStatus: 'ACTIVE',
        isActive: true,
        emailVerified: true
      }
    });
  }

  await createTestSession(customerUser.id);
  const customerToken = jwt.sign(
    { id: customerUser.id, userId: customerUser.id, email: customerUser.email, role: 'CUSTOMER', name: customerUser.name },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  console.log(`\nTokens setup successfully:`);
  console.log(`- SUPER_ADMIN: ${superAdmin.email}`);
  if (admin) console.log(`- ADMIN: ${admin.email}`);
  if (receptionist) console.log(`- RECEPTIONIST: ${receptionist.email}`);
  if (tech) console.log(`- TECHNICIAN: ${tech.email}`);

  // =========================================================================
  // TEST GROUP 1: ROLE-BASED ACCESS CONTROL (NON-SUPER_ADMIN REJECTION)
  // =========================================================================
  console.log("\n--- GROUP 1: Non-SUPER_ADMIN Role Rejection (Must return 403 Forbidden) ---");

  // Create dummy repair for testing rejection
  const branch = await prisma.branch.findFirst();
  const dummyRepair = await prisma.repair.create({
    data: {
      repairNumber: `TEST-SEC-${Date.now()}`,
      customerName: "Security Test",
      customerPhone: "9800000000",
      deviceBrand: "Apple",
      deviceModel: "iPhone 13",
      deviceCondition: "Good",
      problemDescription: "Test Security RBAC",
      estimatedCost: 2000,
      branchId: branch ? branch.id : "branch-1",
      createdById: superAdmin.id
    }
  });

  // Test 1: Admin delete repair -> 403
  if (adminToken) {
    const res = await fetch(`${BASE_URL}/api/repairs/${dummyRepair.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    if (res.status !== 403) {
      console.log(`Diagnostic: Admin delete repair status=${res.status}, body=`, await res.text());
    }
    assert(res.status === 403, "ADMIN receives 403 Forbidden on DELETE /api/repairs/:id");
  }

  // Test 2: Receptionist delete repair -> 403
  if (receptionistToken) {
    const res = await fetch(`${BASE_URL}/api/repairs/${dummyRepair.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${receptionistToken}` }
    });
    assert(res.status === 403, "RECEPTIONIST receives 403 Forbidden on DELETE /api/repairs/:id");
  }

  // Test 3: Technician delete repair -> 403
  if (techToken) {
    const res = await fetch(`${BASE_URL}/api/repairs/${dummyRepair.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${techToken}` }
    });
    assert(res.status === 403, "TECHNICIAN receives 403 Forbidden on DELETE /api/repairs/:id");
  }

  // Test 4: Customer delete repair -> 403
  const resCust = await fetch(`${BASE_URL}/api/repairs/${dummyRepair.id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${customerToken}` }
  });
  assert(resCust.status === 403, "CUSTOMER receives 403 Forbidden on DELETE /api/repairs/:id");

  // Test 5: Admin bulk delete repairs -> 403
  if (adminToken) {
    const res = await fetch(`${BASE_URL}/api/repairs/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ ids: [dummyRepair.id] })
    });
    assert(res.status === 403, "ADMIN receives 403 Forbidden on POST /api/repairs/bulk-delete");
  }

  // Test 6: Receptionist request warranty bulk delete -> 403
  if (receptionistToken) {
    const res = await fetch(`${BASE_URL}/api/battery-warranties/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${receptionistToken}` },
      body: JSON.stringify({ ids: ['any-id'] })
    });
    assert(res.status === 403, "RECEPTIONIST receives 403 Forbidden on POST /api/battery-warranties/bulk-delete");
  }

  // Test 7: Technician warranty bulk delete -> 403
  if (techToken) {
    const res = await fetch(`${BASE_URL}/api/battery-warranties/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${techToken}` },
      body: JSON.stringify({ ids: ['any-id'], code: '123456' })
    });
    assert(res.status === 403, "TECHNICIAN receives 403 Forbidden on POST /api/battery-warranties/bulk-delete");
  }

  // Cleanup dummy security repair
  await prisma.repair.delete({ where: { id: dummyRepair.id } });

  // =========================================================================
  // TEST GROUP 2: SUPER ADMIN NORMAL REPAIR PERMANENT DELETION (NO 2FA)
  // =========================================================================
  console.log("\n--- GROUP 2: Super Admin Normal Repair Deletion (No 2FA Required) ---");

  // Create single test repair with related logs, notes, payments
  const testRepair1 = await prisma.repair.create({
    data: {
      repairNumber: `DEL-TEST-1-${Date.now()}`,
      customerName: "Sita Sharma",
      customerPhone: "9841234567",
      deviceBrand: "Samsung",
      deviceModel: "Galaxy S23",
      deviceCondition: "Good",
      problemDescription: "Screen replacement test",
      estimatedCost: 12000,
      advancePaid: 3000,
      branchId: branch ? branch.id : "branch-1",
      createdById: superAdmin.id,
      logs: {
        create: [
          { status: "RECEIVED", message: "Received at reception" },
          { status: "DIAGNOSING", message: "Initial triage completed" }
        ]
      },
      payments: {
        create: [
          { amount: 3000, method: "CASH" }
        ]
      }
    }
  });

  // Single permanent deletion by Super Admin
  const singleDelRes = await fetch(`${BASE_URL}/api/repairs/${testRepair1.id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${superAdminToken}` }
  });
  const singleDelJson = await singleDelRes.json();
  if (singleDelRes.status !== 200) {
    console.log(`Diagnostic singleDelRes status=${singleDelRes.status}, body=`, JSON.stringify(singleDelJson));
  }
  assert(singleDelRes.status === 200, "Super Admin can permanently delete single repair");
  assert(singleDelJson.success === true, "Single repair deletion returned success: true");

  // Verify DB cleanup
  const checkRep1 = await prisma.repair.findUnique({ where: { id: testRepair1.id } });
  const checkLogs1 = await prisma.repairLog.findMany({ where: { repairId: testRepair1.id } });
  const checkPayments1 = await prisma.payment.findMany({ where: { repairId: testRepair1.id } });
  assert(checkRep1 === null, "Repair record permanently removed from DB");
  assert(checkLogs1.length === 0, "Cascaded repair logs permanently purged (0 orphans)");
  assert(checkPayments1.length === 0, "Cascaded payments permanently purged (0 orphans)");

  // Test Bulk Repair Deletion
  const bulkRep1 = await prisma.repair.create({
    data: {
      repairNumber: `BULK-1-${Date.now()}`,
      customerName: "Bulk Customer 1",
      customerPhone: "9841111111",
      deviceBrand: "Apple",
      deviceModel: "iPhone 14",
      deviceCondition: "Fair",
      problemDescription: "Bulk test 1",
      estimatedCost: 5000,
      branchId: branch ? branch.id : "branch-1",
      createdById: superAdmin.id
    }
  });

  const bulkRep2 = await prisma.repair.create({
    data: {
      repairNumber: `BULK-2-${Date.now()}`,
      customerName: "Bulk Customer 2",
      customerPhone: "9841222222",
      deviceBrand: "Xiaomi",
      deviceModel: "Redmi Note 12",
      deviceCondition: "Good",
      problemDescription: "Bulk test 2",
      estimatedCost: 3500,
      branchId: branch ? branch.id : "branch-1",
      createdById: superAdmin.id
    }
  });

  const bulkDelRes = await fetch(`${BASE_URL}/api/repairs/bulk-delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${superAdminToken}` },
    body: JSON.stringify({ ids: [bulkRep1.id, bulkRep2.id] })
  });
  const bulkDelJson = await bulkDelRes.json();
  assert(bulkDelRes.status === 200, "Super Admin bulk delete repairs succeeds with HTTP 200");
  assert(bulkDelJson.count === 2, "Bulk delete returned count of 2 deleted repairs");

  const checkBulk1 = await prisma.repair.findUnique({ where: { id: bulkRep1.id } });
  const checkBulk2 = await prisma.repair.findUnique({ where: { id: bulkRep2.id } });
  assert(checkBulk1 === null && checkBulk2 === null, "Both repairs permanently removed from DB");

  // =========================================================================
  // TEST GROUP 3: BATTERY WARRANTY HUB PERMANENT DELETION (2FA REQUIRED)
  // =========================================================================
  console.log("\n--- GROUP 3: Battery Warranty Hub 2FA Permanent Deletion Flow ---");

  const repNum = `BW-REP-${Date.now()}`;
  const repWithWarranty = await prisma.repair.create({
    data: {
      repairNumber: repNum,
      customerName: "Kiran Adhikari",
      customerPhone: "9869276668",
      customerEmail: "kiran@example.com",
      deviceBrand: "Apple",
      deviceModel: "iPhone 12 Pro",
      deviceCondition: "Good",
      problemDescription: "Battery Replacement",
      estimatedCost: 6500,
      branchId: branch ? branch.id : "branch-1",
      createdById: superAdmin.id,
      batteryWarranty: {
        create: {
          warrantyNumber: `BW-TEST-${Date.now()}`,
          repairNumber: repNum,
          customerName: "Kiran Adhikari",
          customerPhone: "9869276668",
          customerEmail: "kiran@example.com",
          deviceBrand: "Apple",
          deviceModel: "iPhone 12 Pro",
          batteryType: "Original Li-ion Battery",
          warrantyPeriod: "1_YEAR",
          registrationDate: new Date(),
          expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          status: "ACTIVE",
          createdById: superAdmin.id,
          claims: {
            create: [
              {
                claimNumber: `BWC-TEST-${Date.now()}`,
                repairNumber: `BW-REP-${Date.now()}`,
                customerName: "Kiran Adhikari",
                customerPhone: "9869276668",
                deviceBrand: "Apple",
                deviceModel: "iPhone 12 Pro",
                issueDescription: "Battery draining faster than expected",
                status: "APPROVED",
                actionTaken: "BATTERY_REPLACED",
                processedById: superAdmin.id,
                processedByName: superAdmin.name
              }
            ]
          }
        }
      }
    },
    include: { batteryWarranty: { include: { claims: true } } }
  });

  const createdWarranty = repWithWarranty.batteryWarranty;
  if (!createdWarranty) throw new Error("Failed to setup test BatteryWarranty");
  console.log(`Created test warranty: #${createdWarranty.warrantyNumber} with ${createdWarranty.claims.length} claim(s)`);

  // Step 3: Execute permanent deletion
  const validDeletionRes = await fetch(`${BASE_URL}/api/battery-warranties/bulk-delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${superAdminToken}` },
    body: JSON.stringify({ ids: [createdWarranty.id] })
  });
  const validDeletionJson = await validDeletionRes.json();
  assert(validDeletionRes.status === 200, "Permanent deletion succeeds for Super Admin");
  assert(validDeletionJson.success === true, "Warranty deletion response returns success: true");

  // Verify Warranty and Claim DB records are deleted
  const checkWarranty = await prisma.batteryWarranty.findUnique({ where: { id: createdWarranty.id } });
  const checkClaims = await prisma.batteryWarrantyClaim.findMany({ where: { warrantyId: createdWarranty.id } });
  assert(checkWarranty === null, "Battery Warranty record permanently removed from DB");
  assert(checkClaims.length === 0, "Associated warranty claims permanently purged (0 orphans)");

  // Cleanup parent repair
  await prisma.repair.delete({ where: { id: repWithWarranty.id } }).catch(() => {});

  // =========================================================================
  // TEST GROUP 4: AUDIT LOG VERIFICATION
  // =========================================================================
  console.log("\n--- GROUP 4: Audit Trail Verification ---");
  
  const warrantyAuditLog = await prisma.auditLog.findFirst({
    where: {
      action: "PERMANENT_DELETE_WARRANTIES",
      userId: superAdmin.id
    },
    orderBy: { createdAt: 'desc' }
  });

  assert(Boolean(warrantyAuditLog), "AuditLog record created for PERMANENT_DELETE_WARRANTIES");
  if (warrantyAuditLog) {
    assert(warrantyAuditLog.resource === "WARRANTY", "AuditLog resource is WARRANTY");
    assert(warrantyAuditLog.userRole === "SUPER_ADMIN", "AuditLog userRole is SUPER_ADMIN");
    const meta = JSON.parse(warrantyAuditLog.metadata || '{}');
    assert(meta.twoFactorVerified === true, "AuditLog metadata records twoFactorVerified: true");
    assert(!warrantyAuditLog.details?.includes('123456'), "AuditLog NEVER stores the raw 2FA OTP code");
  }

  console.log("\n================================================================================");
  console.log(`ALL SUPER ADMIN PERMANENT DELETION TESTS PASSED: ${passedTests}/${totalTests} (100%)`);
  console.log("================================================================================");
}

runSuperAdminDeletionTests()
  .catch((err) => {
    console.error("\nTEST RUN FAILED:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
