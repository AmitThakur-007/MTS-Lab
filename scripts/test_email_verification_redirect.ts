import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
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

async function runEmailVerificationTests() {
  console.log("================================================================================");
  console.log("MTS LAB — EMAIL VERIFICATION & REDIRECT TEST SUITE");
  console.log("================================================================================");

  // --- GROUP 1: Provision Test Accounts (Unverified & Verified) ---
  console.log("\n--- GROUP 1: Provisioning Test Accounts ---");
  const testPassword = "MtsSecurePassword2026!";
  const passwordHash = await bcrypt.hash(testPassword, 10);

  const unverifiedEmail = "unverified_staff@mtslab.com";
  const verifiedEmail = "verified_staff@mtslab.com";

  await prisma.user.deleteMany({
    where: { email: { in: [unverifiedEmail, verifiedEmail] } }
  });

  const unverifiedUser = await prisma.user.create({
    data: {
      email: unverifiedEmail,
      name: "Unverified Staff",
      role: "RECEPTIONIST",
      password: passwordHash,
      emailVerified: false,
      isActive: true,
      accountStatus: "ACTIVE"
    }
  });

  const verifiedUser = await prisma.user.create({
    data: {
      email: verifiedEmail,
      name: "Verified Staff",
      role: "RECEPTIONIST",
      password: passwordHash,
      emailVerified: true,
      isActive: true,
      accountStatus: "ACTIVE"
    }
  });

  assert(unverifiedUser.emailVerified === false, "Unverified test user provisioned in database");
  assert(verifiedUser.emailVerified === true, "Verified test user provisioned in database");

  // --- GROUP 2: Login Enforcement for Unverified Users ---
  console.log("\n--- GROUP 2: Email Verification Enforcement on Login ---");
  const unverifiedLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identity: unverifiedEmail,
      password: testPassword,
      device: { deviceName: "Test Desktop", deviceType: "DESKTOP", browser: "Chrome", os: "Windows" }
    })
  });

  assert(unverifiedLoginRes.status === 403, "Unverified user login attempt returns HTTP 403 Forbidden");
  const unverifiedJson: any = await unverifiedLoginRes.json();
  assert(unverifiedJson.emailNotVerified === true, "Response payload contains emailNotVerified: true");
  assert(unverifiedJson.message.toLowerCase().includes("verify your email"), "Response message directs user to verify email");

  // --- GROUP 3: Resend Verification Email Flow & URL Construction ---
  console.log("\n--- GROUP 3: Resend Verification Email & Redirect URL Generation ---");
  const resendRes = await fetch(`${BASE_URL}/api/auth/resend-verification`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Origin": "http://localhost:3000" },
    body: JSON.stringify({ email: unverifiedEmail })
  });

  assert(resendRes.status === 200, "POST /api/auth/resend-verification returns HTTP 200 OK");
  const resendJson: any = await resendRes.json();
  assert(resendJson.success === true, "Resend verification returned success: true");

  // Verify Audit Log
  const auditLog = await prisma.auditLog.findFirst({
    where: {
      userEmail: unverifiedEmail,
      action: "EMAIL_VERIFICATION_SENT"
    },
    orderBy: { createdAt: "desc" }
  });
  assert(!!auditLog, "Audit log recorded for EMAIL_VERIFICATION_SENT");

  // --- GROUP 4: Verify Status Endpoint ---
  console.log("\n--- GROUP 4: Real-Time Verify Status Endpoint ---");
  const statusRes = await fetch(`${BASE_URL}/api/auth/verify-email-status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: unverifiedEmail })
  });

  assert(statusRes.status === 200, "POST /api/auth/verify-email-status returns HTTP 200 OK");
  const statusJson: any = await statusRes.json();
  assert(statusJson.emailVerified === false, "Status check correctly returns emailVerified: false for unverified user");

  // --- GROUP 5: Verified User Login & Security Check ---
  console.log("\n--- GROUP 5: Verified User Login & Authentication Integrity ---");
  const verifiedLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identity: verifiedEmail,
      password: testPassword,
      device: { deviceName: "Test Desktop", deviceType: "DESKTOP", browser: "Chrome", os: "Windows" }
    })
  });

  assert(verifiedLoginRes.status === 200, "Verified user login returns HTTP 200 OK");
  const verifiedLoginJson: any = await verifiedLoginRes.json();
  assert(verifiedLoginJson.success !== false, "Verified login succeeds (either MFA required or token issued)");

  // --- GROUP 6: Security Verification (Query Parameter Cannot Bypass Auth) ---
  console.log("\n--- GROUP 6: Security Check - URL Parameter Cannot Bypass Authentication ---");
  const fakeAuthAttemptRes = await fetch(`${BASE_URL}/api/repairs?emailVerified=true`);
  assert(fakeAuthAttemptRes.status === 401, "URL parameter 'emailVerified=true' cannot access protected APIs (401 Unauthorized)");

  const fakeAuthAttemptTruRes = await fetch(`${BASE_URL}/api/repairs?emailVerified=tru`);
  assert(fakeAuthAttemptTruRes.status === 401, "URL parameter 'emailVerified=tru' cannot access protected APIs (401 Unauthorized)");

  console.log("\n================================================================================");
  console.log(`ALL EMAIL VERIFICATION TESTS PASSED: ${testCounter}/${testCounter} (100%)`);
  console.log("================================================================================\n");
}

runEmailVerificationTests()
  .catch((err) => {
    console.error("\nTEST RUN FAILED:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
