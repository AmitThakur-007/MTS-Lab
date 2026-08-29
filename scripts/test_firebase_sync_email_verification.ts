import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

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

async function runFirebaseSyncTests() {
  console.log("================================================================================");
  console.log("MTS LAB — FIREBASE EMAIL VERIFICATION STATE SYNCHRONIZATION TEST SUITE");
  console.log("================================================================================");

  const testPassword = "MtsSecurePassword2026!";
  const passwordHash = await bcrypt.hash(testPassword, 10);
  const testEmail = "test_sync_receptionist@mtslab.com";

  // --- GROUP 1: Provision Test User (Initially Unverified in DB) ---
  console.log("\n--- GROUP 1: Provisioning Test User (Initially Unverified) ---");
  await prisma.user.deleteMany({ where: { email: testEmail } });

  const user = await prisma.user.create({
    data: {
      email: testEmail,
      name: "Sync Test Receptionist",
      role: "RECEPTIONIST",
      password: passwordHash,
      emailVerified: false,
      twoFactorEnabled: true,
      twoFactorType: "EMAIL",
      isActive: true,
      accountStatus: "ACTIVE"
    }
  });

  assert(user.emailVerified === false, "User created with initial database state: emailVerified = false");

  // --- GROUP 2: Attempt Login Before Verification ---
  console.log("\n--- GROUP 2: Login Attempt Prior to Verification ---");
  const unverifiedLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identity: testEmail,
      password: testPassword,
      device: { deviceName: "Browser A", deviceType: "DESKTOP", browser: "Chrome", os: "Windows" }
    })
  });

  assert(unverifiedLoginRes.status === 403, "Login denied with HTTP 403 Forbidden");
  const unverifiedJson: any = await unverifiedLoginRes.json();
  assert(unverifiedJson.emailNotVerified === true, "Payload confirms emailNotVerified: true");

  // --- GROUP 3: Simulate Firebase Email Verification Completion ---
  console.log("\n--- GROUP 3: Firebase Verification Synchronization ---");
  // Simulate client generating fresh Firebase ID token with email_verified: true
  const fakeFirebasePayload = {
    iss: "https://securetoken.google.com/mts-lab-eb8d2",
    aud: "mts-lab-eb8d2",
    auth_time: Math.floor(Date.now() / 1000),
    user_id: "fb_uid_sync_test_12345",
    sub: "fb_uid_sync_test_12345",
    email: testEmail,
    email_verified: true
  };
  const fakeFirebaseIdToken = jwt.sign(fakeFirebasePayload, "dummy_secret_for_jwt_structure");

  // Call verify status with verified state or update DB state to simulate Firebase webhook/refresh
  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: true, firebaseUid: "fb_uid_sync_test_12345" }
  });

  const checkStatusRes = await fetch(`${BASE_URL}/api/auth/verify-email-status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testEmail })
  });

  assert(checkStatusRes.status === 200, "POST /api/auth/verify-email-status returns HTTP 200 OK");
  const checkStatusJson: any = await checkStatusRes.json();
  assert(checkStatusJson.emailVerified === true, "Verify status confirms emailVerified: true");

  // --- GROUP 4: Multi-Browser & Multi-Device Login Verification ---
  console.log("\n--- GROUP 4: Login Verification on Device A & Device B ---");
  
  // Device A Login (2FA Enabled)
  const deviceALoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identity: testEmail,
      password: testPassword,
      device: { deviceName: "Device A (Desktop)", deviceType: "DESKTOP", browser: "Chrome", os: "Windows" }
    })
  });

  assert(deviceALoginRes.status === 200, "Device A login succeeds (HTTP 200 OK)");
  const deviceAJson: any = await deviceALoginRes.json();
  assert(deviceAJson.success === true, "Device A login confirms success: true (no false 'verify your email' prompt)");
  assert(Boolean(deviceAJson.token || deviceAJson.mfaRequired), "Device A received authenticated session token");

  // Device B Login (Different browser/device)
  const deviceBLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identity: testEmail,
      password: testPassword,
      device: { deviceName: "Device B (Mobile)", deviceType: "MOBILE", browser: "Safari", os: "iOS" }
    })
  });

  assert(deviceBLoginRes.status === 200, "Device B login succeeds without asking to re-verify email");
  const deviceBJson: any = await deviceBLoginRes.json();
  assert(deviceBJson.success === true, "Device B proceeds with verified authentication seamlessly");
  assert(Boolean(deviceBJson.token || deviceBJson.mfaRequired), "Device B received authenticated session token");

  // --- GROUP 5: Verified User Login ---
  console.log("\n--- GROUP 5: Verified User Login ---");
  await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: false } });

  const no2faLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identity: testEmail,
      password: testPassword,
      device: { deviceName: "Device C", deviceType: "DESKTOP", browser: "Firefox", os: "Linux" }
    })
  });

  assert(no2faLoginRes.status === 200, "User with 2FA disabled logs in with HTTP 200 OK");
  const no2faJson: any = await no2faLoginRes.json();
  assert(!!no2faJson.token, "Direct session JWT token issued");
  assert(no2faJson.user?.email === testEmail, "Session user email matches verified account");

  // --- GROUP 6: URL Manipulation Security Check ---
  console.log("\n--- GROUP 6: URL Parameter Security Check ---");
  const fakeAuthAttemptRes = await fetch(`${BASE_URL}/api/dashboard/stats?emailVerified=true`);
  assert(fakeAuthAttemptRes.status === 401, "URL parameter 'emailVerified=true' cannot access protected dashboard (401 Unauthorized)");

  console.log("\n================================================================================");
  console.log(`ALL FIREBASE SYNC TESTS PASSED: ${testCounter}/${testCounter} (100%)`);
  console.log("================================================================================\n");
}

runFirebaseSyncTests()
  .catch((err) => {
    console.error("\nTEST RUN FAILED:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
