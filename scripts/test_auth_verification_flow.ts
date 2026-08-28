import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.POSTGRES_URL || "postgresql://postgres:postgres@localhost:5432/mts_lab";
}

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const BASE_URL = "http://localhost:3000";

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

    const forgotRes = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: unknownEmail })
    });
    assert(forgotRes.status === 404, "Forgot password endpoint returns HTTP 404 for unregistered email");
    const forgotJson: any = await forgotRes.json().catch(() => ({}));
    assert(forgotJson.success === false, "Forgot password response indicates failure for unregistered email");

    // 2. Forgot Password — Existing Registered Email Check
    console.log("\n--- Test 2: Forgot Password with Registered Email ---");
    const registeredEmail = "mtsmobilelab@gmail.com";
    const registeredUser = await prisma.user.findFirst({
      where: { email: registeredEmail, deletedAt: null }
    });
    assert(Boolean(registeredUser), "Registered email exists in database");

    if (registeredUser) {
      const validForgotRes = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: registeredEmail })
      });
      assert(validForgotRes.status === 200, "Forgot password returns HTTP 200 for registered email");
      const validForgotJson: any = await validForgotRes.json().catch(() => ({}));
      assert(validForgotJson.success === true, "Forgot password returns success for registered email");
    }

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

    // Attempt login with unverified user credentials
    const unverifiedLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identity: unverifiedEmail,
        password: "MtsLab@2026",
        device: { deviceName: "Test Device", deviceType: "DESKTOP", browser: "Chrome", os: "Windows" }
      })
    });

    assert(unverifiedLoginRes.status === 403, "Login for unverified account is denied with HTTP 403");
    const unverifiedLoginJson: any = await unverifiedLoginRes.json().catch(() => ({}));
    assert(unverifiedLoginJson.emailNotVerified === true, "Response payload confirms emailNotVerified = true");

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
