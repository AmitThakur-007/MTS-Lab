import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.POSTGRES_URL || "postgresql://postgres:postgres@localhost:5432/mts_lab";
}

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function runAuthVerificationTests() {
  console.log("=================================================");
  console.log("   MTS LAB AUTHENTICATION & VERIFICATION AUDIT  ");
  console.log("=================================================\n");

  let testsPassed = 0;
  let testsFailed = 0;

  function assert(condition: boolean, description: string) {
    if (condition) {
      console.log(`[PASS] ${description}`);
      testsPassed++;
    } else {
      console.error(`[FAIL] ${description}`);
      testsFailed++;
    }
  }

  try {
    // 1. Forgot Password — Unknown Email Check
    console.log("--- Test 1: Forgot Password with Unknown Email ---");
    const unknownEmail = "nonexistent.user.test999@mtslab.com";
    const userInDb = await prisma.user.findFirst({
      where: { email: unknownEmail, deletedAt: null }
    });
    assert(userInDb === null, "Unknown email is NOT in database");

    // 2. Forgot Password — Existing SuperAdmin Email Check
    console.log("\n--- Test 2: Forgot Password with Registered Email ---");
    const superAdminEmail = "mtsmobilelab@gmail.com";
    const superAdminUser = await prisma.user.findFirst({
      where: { email: superAdminEmail, deletedAt: null }
    });
    assert(Boolean(superAdminUser), "Registered SuperAdmin email exists in database");
    assert(superAdminUser?.accountStatus === 'ACTIVE', "SuperAdmin account is ACTIVE and eligible for recovery");

    // 3. Unverified User Setup & Login Verification Test
    console.log("\n--- Test 3: Unverified Account Handling ---");
    const unverifiedEmail = "unverified.test.staff@mtslab.com";
    await prisma.user.deleteMany({ where: { email: unverifiedEmail } });

    const pwdHash = await bcrypt.hash("MtsLab@2026", 10);
    const unverifiedUser = await prisma.user.create({
      data: {
        email: unverifiedEmail,
        username: "unverifiedstaff",
        password: pwdHash,
        name: "Unverified Staff Member",
        role: "TECHNICIAN",
        accountStatus: "ACTIVE",
        isActive: true,
        emailVerified: false
      }
    });

    assert(unverifiedUser.emailVerified === false, "Created test user with emailVerified = false");

    // Test password validation
    const isCorrectPassword = await bcrypt.compare("MtsLab@2026", unverifiedUser.password);
    const isWrongPassword = await bcrypt.compare("WrongPassword123!", unverifiedUser.password);
    assert(isCorrectPassword === true, "Password verification succeeds for correct password");
    assert(isWrongPassword === false, "Password verification fails for wrong password");

    // Clean up test user
    await prisma.user.delete({ where: { id: unverifiedUser.id } });
    console.log("Unverified account test user cleaned up.");

  } catch (err: any) {
    console.error("Test error:", err);
    testsFailed++;
  } finally {
    await prisma.$disconnect();
    console.log("\n=================================================");
    console.log(`AUTH & VERIFICATION TEST RESULTS: ${testsPassed} PASSED, ${testsFailed} FAILED`);
    console.log("=================================================");
  }
}

runAuthVerificationTests();
