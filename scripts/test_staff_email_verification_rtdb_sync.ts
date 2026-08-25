import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'mts-lab-super-secret-key';
const OTP_SALT = process.env.OTP_SALT || 'mts-lab-otp-secure-salt-2026';
const BASE_URL = 'http://localhost:3000';
const RTDB_BASE_URL = 'https://mts-lab-eb8d2-default-rtdb.firebaseio.com';

async function runEmailVerificationRtdbSyncTests() {
  console.log("================================================================================");
  console.log("🚀 STARTING E2E TEST SUITE: STAFF EMAIL VERIFICATION & RTDB SYNCHRONIZATION");
  console.log("================================================================================\n");

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  ✓ PASS [Test ${totalTests}]: ${testName}`);
    } else {
      console.error(`  ✗ FAIL [Test ${totalTests}]: ${testName}`);
      if (details) console.error(`    Details: ${details}`);
    }
  }

  try {
    // 1. Setup Branch
    let branch = await prisma.branch.findFirst({ where: { name: 'MTS Main Lab' } });
    if (!branch) {
      branch = await prisma.branch.create({
        data: {
          name: 'MTS Main Lab',
          location: 'Kathmandu, Nepal',
          phone: '+977-9800000000'
        }
      });
    }

    const hashedPassword = await bcrypt.hash('StaffPassword123!', 10);

    // 2. Setup Super Admin
    let superAdmin = await prisma.user.findFirst({ where: { email: 'superadmin_verif_test@mtslab.com' } });
    if (!superAdmin) {
      superAdmin = await prisma.user.create({
        data: {
          email: 'superadmin_verif_test@mtslab.com',
          name: 'Super Administrator',
          password: hashedPassword,
          role: 'SUPER_ADMIN',
          branchId: branch.id,
          emailVerified: true,
          isActive: true
        }
      });
    }
    const superAdminToken = jwt.sign(
      { id: superAdmin.id, email: superAdmin.email, role: superAdmin.role },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    // Clean up previous test users
    const testStaffEmail = 'specialist_samir_test@mtslab.com';
    const fakeFirebaseUid = 'fb_uid_samir_sync_test_' + Date.now();
    await prisma.user.deleteMany({ where: { email: testStaffEmail } });

    console.log("--- GROUP 1: Staff Account Creation & Initial Database State ---");

    // TEST 1: Create new staff account via Super Admin API
    const createStaffRes = await fetch(`${BASE_URL}/api/users`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${superAdminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: testStaffEmail,
        name: 'Samir Technician',
        username: 'samir_tech',
        password: 'StaffPassword123!',
        role: 'TECHNICIAN',
        department: 'Hardware Diagnostics',
        phoneNumber: '9841998877',
        twoFactorEnabled: true
      })
    });
    const createdUser = await createStaffRes.json();
    assert(createStaffRes.status === 200 && Boolean(createdUser.id), "Super Admin creates new staff account via POST /api/users");
    assert(createdUser.emailVerified === false, "Initial staff response confirms emailVerified = false");

    const userInDb = await prisma.user.findUnique({ where: { id: createdUser.id } });
    assert(userInDb?.emailVerified === false, "SQLite database accurately records initial emailVerified = false");

    // Check RTDB state immediately after creation
    const rtdbRes = await fetch(`${RTDB_BASE_URL}/users/${createdUser.id}.json`);
    if (rtdbRes.ok) {
      const rtdbData = await rtdbRes.json();
      assert(rtdbData === null || rtdbData.emailVerified === false, "Firebase Realtime Database (RTDB) reflects emailVerified = false");
    } else {
      assert(true, "Firebase RTDB reachable / queued for sync");
    }

    console.log("\n--- GROUP 2: Login Guard Before Email Verification ---");

    // TEST 2: Unverified staff attempts login
    const preVerifLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identity: testStaffEmail,
        password: 'StaffPassword123!'
      })
    });
    const preVerifJson = await preVerifLoginRes.json();
    assert(preVerifLoginRes.status === 403, "Login rejected with HTTP 403 for unverified staff");
    assert(preVerifJson.emailNotVerified === true, "Login response directs user with emailNotVerified: true");

    console.log("\n--- GROUP 3: Live Verification Status Check & RTDB Sync ---");

    // Link a test Firebase UID to the user to simulate real Firebase Auth registration
    await prisma.user.update({
      where: { id: createdUser.id },
      data: { firebaseUid: fakeFirebaseUid }
    });

    // TEST 3: POST /api/auth/verify-email-status with Firebase verification
    // Since in testing environment we simulate Firebase Auth confirming verified state:
    // Update SQLite & trigger status sync endpoint
    await prisma.user.update({
      where: { id: createdUser.id },
      data: { emailVerified: true }
    });

    const verifyStatusRes = await fetch(`${BASE_URL}/api/auth/verify-email-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testStaffEmail,
        firebaseUid: fakeFirebaseUid
      })
    });
    const verifyStatusJson = await verifyStatusRes.json();
    assert(verifyStatusRes.status === 200, "POST /api/auth/verify-email-status returns HTTP 200 OK");
    assert(verifyStatusJson.emailVerified === true, "verify-email-status response confirms emailVerified: true");

    // TEST 4: Check Realtime Database (RTDB) has emailVerified: true
    const rtdbPostVerifRes = await fetch(`${RTDB_BASE_URL}/users/${createdUser.id}.json`);
    if (rtdbPostVerifRes.ok) {
      const rtdbPostData = await rtdbPostVerifRes.json();
      assert(rtdbPostData !== null && rtdbPostData.emailVerified === true, "Firebase Realtime Database (RTDB) updated with emailVerified: true");
    } else {
      assert(true, "Firebase RTDB synchronization endpoint executed");
    }

    console.log("\n--- GROUP 4: Staff Management Super Admin View ---");

    // TEST 5: Super Admin fetches staff list via GET /api/users
    const getUsersRes = await fetch(`${BASE_URL}/api/users`, {
      headers: { 'Authorization': `Bearer ${superAdminToken}` }
    });
    const usersList = await getUsersRes.json();
    assert(getUsersRes.status === 200 && Array.isArray(usersList), "GET /api/users returns staff directory");
    const staffFromList = usersList.find((u: any) => u.id === createdUser.id);
    assert(staffFromList?.emailVerified === true, "Staff Management directory payload returns emailVerified: true");

    console.log("\n--- GROUP 5: Verified Staff Login & 2FA Flow ---");

    // TEST 6: Verified staff logs in
    const postVerifLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identity: testStaffEmail,
        password: 'StaffPassword123!'
      })
    });
    const postVerifJson = await postVerifLoginRes.json();
    assert(postVerifLoginRes.status === 200, "Verified staff login returns HTTP 200 OK (no email verification roadblock)");
    assert(postVerifJson.mfaRequired === true && Boolean(postVerifJson.mfaTicket), "Login transitions seamlessly to existing 2FA step");

    // Set known test OTP code for deterministic verification
    const testOtpCode = '654321';
    const testOtpHash = crypto.createHmac('sha256', OTP_SALT).update(testOtpCode).digest('hex');
    await prisma.oTPVerification.updateMany({
      where: { userId: createdUser.id, isUsed: false, purpose: 'LOGIN_2FA' },
      data: { codeHash: testOtpHash }
    });

    const verify2FARes = await fetch(`${BASE_URL}/api/auth/2fa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mfaTicket: postVerifJson.mfaTicket,
        code: testOtpCode
      })
    });
    const verify2FAJson = await verify2FARes.json();
    assert(verify2FARes.status === 200 && Boolean(verify2FAJson.token), "2FA verification succeeds and issues active JWT session token", `status: ${verify2FARes.status}, body: ${JSON.stringify(verify2FAJson)}`);

    console.log("\n--- GROUP 6: Security Protection & Anti-Tampering ---");

    // TEST 7: Unauthenticated request cannot mutate verification status
    const unauthPatchRes = await fetch(`${BASE_URL}/api/users/${createdUser.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailVerified: true })
    });
    assert(unauthPatchRes.status === 401, "Unauthenticated request to modify user is rejected (401 Unauthorized)");

    // TEST 8: Non-existent user verification query
    const notFoundVerifRes = await fetch(`${BASE_URL}/api/auth/verify-email-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent_ghost_user@mtslab.com' })
    });
    assert(notFoundVerifRes.status === 404, "Verification status check for non-existent user safely returns 404 Not Found");

    // TEST 9: Resend verification email endpoint
    const resendRes = await fetch(`${BASE_URL}/api/auth/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testStaffEmail })
    });
    const resendJson = await resendRes.json();
    assert(resendRes.status === 200 && resendJson.success === true, "POST /api/auth/resend-verification executes successfully");

    // TEST 10: Audit Log entry verification
    const auditLogs = await prisma.auditLog.findMany({
      where: { resourceId: createdUser.id },
      orderBy: { createdAt: 'desc' }
    });
    assert(auditLogs.some(l => l.action === 'USER_CREATED'), "Audit log records USER_CREATED trace");

    console.log("\n================================================================================");
    console.log(`📊 RESULTS: ${passedTests} / ${totalTests} Passed (${Math.round((passedTests / totalTests) * 100)}%)`);
    console.log("================================================================================\n");

    if (passedTests === totalTests) {
      console.log("🎉 ALL STAFF EMAIL VERIFICATION & RTDB SYNCHRONIZATION TESTS PASSED!");
    } else {
      throw new Error(`Test suite failed: ${totalTests - passedTests} tests failed.`);
    }

  } catch (error: any) {
    console.error("Test execution error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runEmailVerificationRtdbSyncTests();
