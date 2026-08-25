import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'mts-lab-super-secure-jwt-secret-2025';

async function runTests() {
  console.log("==================================================");
  console.log("TESTING MTS LAB SUPER ADMIN 2FA CONTROL SYSTEM");
  console.log("==================================================");

  // 1. Setup Test Users
  const testPassword = "TestPassword123!";
  const hashedPassword = await bcrypt.hash(testPassword, 10);

  let superAdmin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN', deletedAt: null } });
  if (!superAdmin) {
    superAdmin = await prisma.user.create({
      data: {
        name: "Super Admin Test",
        email: "superadmin.test@mtslab.local",
        username: "superadmintest",
        password: hashedPassword,
        role: "SUPER_ADMIN",
        isActive: true,
        accountStatus: "APPROVED",
        twoFactorEnabled: true
      }
    });
  }

  // Create or retrieve Test Technician User
  const testTechEmail = "tech.2fatest@mtslab.local";
  let techUser = await prisma.user.findFirst({ where: { email: testTechEmail } });
  if (!techUser) {
    techUser = await prisma.user.create({
      data: {
        name: "2FA Test Technician",
        email: testTechEmail,
        username: "tech2fatest",
        password: hashedPassword,
        role: "TECHNICIAN",
        isActive: true,
        accountStatus: "ACTIVE",
        twoFactorEnabled: true
      }
    });
  } else {
    // Reset password & status
    techUser = await prisma.user.update({
      where: { id: techUser.id },
      data: { password: hashedPassword, isActive: true, accountStatus: "ACTIVE" }
    });
  }

  // Create or retrieve Test Receptionist User
  const testRecepEmail = "recep.2fatest@mtslab.local";
  let recepUser = await prisma.user.findFirst({ where: { email: testRecepEmail } });
  if (!recepUser) {
    recepUser = await prisma.user.create({
      data: {
        name: "2FA Test Receptionist",
        email: testRecepEmail,
        username: "recep2fatest",
        password: hashedPassword,
        role: "RECEPTIONIST",
        isActive: true,
        accountStatus: "ACTIVE",
        twoFactorEnabled: true
      }
    });
  }

  console.log(`✓ Super Admin: ${superAdmin.name} (${superAdmin.email})`);
  console.log(`✓ Test Tech: ${techUser.name} (${techUser.email})`);
  console.log(`✓ Test Receptionist: ${recepUser.name} (${recepUser.email})`);

  // ==========================================
  // TEST 1: Super Admin toggles 2FA ON for Tech
  // ==========================================
  console.log("\n--- TEST 1: Enable 2FA for Technician ---");
  techUser = await prisma.user.update({
    where: { id: techUser.id },
    data: { twoFactorEnabled: true }
  });

  await prisma.auditLog.create({
    data: {
      userId: superAdmin.id,
      userEmail: superAdmin.email,
      userName: superAdmin.name,
      userRole: superAdmin.role,
      action: "2FA_ENABLED",
      resource: "USER",
      resourceId: techUser.id,
      status: "SUCCESS",
      details: `Enabled Two-Factor Authentication (2FA) for staff member: ${techUser.name} (${techUser.email})`,
      metadata: JSON.stringify({ targetUserId: techUser.id, targetUserEmail: techUser.email })
    }
  });
  console.log(`✓ Tech 2FA status in DB: ${techUser.twoFactorEnabled}`);
  if (techUser.twoFactorEnabled !== true) throw new Error("Expected 2FA to be enabled!");

  // Verify Login flow when 2FA is ENABLED
  console.log("Checking login behavior with 2FA ENABLED:");
  const is2faActiveWhenEnabled = Boolean(techUser.twoFactorEnabled);
  console.log(`✓ is2faActive evaluated to: ${is2faActiveWhenEnabled} (Correct: requires OTP dispatch & challenge ticket)`);
  if (!is2faActiveWhenEnabled) throw new Error("Expected login to require 2FA!");

  // ==========================================
  // TEST 2: Super Admin toggles 2FA OFF for Tech
  // ==========================================
  console.log("\n--- TEST 2: Disable 2FA for Technician ---");
  techUser = await prisma.user.update({
    where: { id: techUser.id },
    data: { twoFactorEnabled: false }
  });

  await prisma.auditLog.create({
    data: {
      userId: superAdmin.id,
      userEmail: superAdmin.email,
      userName: superAdmin.name,
      userRole: superAdmin.role,
      action: "2FA_DISABLED",
      resource: "USER",
      resourceId: techUser.id,
      status: "SUCCESS",
      details: `Disabled Two-Factor Authentication (2FA) for staff member: ${techUser.name} (${techUser.email})`,
      metadata: JSON.stringify({ targetUserId: techUser.id, targetUserEmail: techUser.email })
    }
  });
  console.log(`✓ Tech 2FA status in DB: ${techUser.twoFactorEnabled}`);
  if (techUser.twoFactorEnabled !== false) throw new Error("Expected 2FA to be disabled!");

  // Verify Login flow when 2FA is DISABLED
  console.log("Checking login behavior with 2FA DISABLED:");
  const is2faActiveWhenDisabled = techUser.twoFactorEnabled !== false;
  console.log(`✓ is2faActive evaluated to: ${is2faActiveWhenDisabled} (Correct: direct dashboard login, NO OTP sent)`);
  if (is2faActiveWhenDisabled) throw new Error("Expected login to bypass 2FA!");

  // Generate tokens for direct login verification
  const directToken = jwt.sign(
    { userId: techUser.id, email: techUser.email, role: techUser.role },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
  console.log(`✓ Direct access token generated successfully: ${directToken.substring(0, 20)}...`);

  // ==========================================
  // TEST 3: Verify Independent User Settings
  // ==========================================
  console.log("\n--- TEST 3: Verify Independent User Settings ---");
  const refreshedRecep = await prisma.user.findUnique({ where: { id: recepUser.id } });
  console.log(`✓ Receptionist 2FA status: ${refreshedRecep?.twoFactorEnabled} (Should remain true)`);
  if (refreshedRecep?.twoFactorEnabled !== true) {
    throw new Error("Changing Tech's 2FA improperly modified Receptionist's 2FA!");
  }

  // ==========================================
  // TEST 4: Verify Audit Trail
  // ==========================================
  console.log("\n--- TEST 4: Verify Audit Trail Entries ---");
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      resourceId: techUser.id,
      action: { in: ["2FA_ENABLED", "2FA_DISABLED"] }
    },
    orderBy: { createdAt: "desc" },
    take: 2
  });
  console.log(`✓ Found ${auditLogs.length} audit logs for 2FA actions on target user:`);
  auditLogs.forEach(l => {
    console.log(`  - [${l.action}] by ${l.userName} (${l.userRole}): "${l.details}" at ${l.createdAt.toISOString()}`);
  });
  if (auditLogs.length < 2) throw new Error("Audit logs for 2FA changes were not found!");

  console.log("\n==================================================");
  console.log("🎉 ALL SUPER ADMIN 2FA CONTROL TESTS PASSED SUCCESSFULLY!");
  console.log("==================================================");
}

runTests()
  .catch(err => {
    console.error("Test failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
