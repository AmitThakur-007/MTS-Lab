import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'mts-lab-jwt-secret-2026-key';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS [Test ${totalTests}]: ${testName}`);
  } else {
    console.error(`  ✕ FAIL [Test ${totalTests}]: ${testName}`);
    throw new Error(`Test failed: ${testName}`);
  }
}

async function createTestSession(userId: string) {
  const refreshToken = `test-comp-refresh-${userId}-${Date.now()}`;
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
  return refreshToken;
}

async function runComprehensiveAuthTests() {
  console.log('================================================================================');
  console.log('MTS LAB — COMPREHENSIVE MULTI-ROLE AUTHENTICATION & PASSWORD RESET TEST SUITE');
  console.log('================================================================================\n');

  // Ensure Super Admin exists for direct verification
  let superAdmin = await prisma.user.findFirst({
    where: { 
      OR: [
        { role: { in: ['SUPER_ADMIN', 'SUPERADMIN'] } },
        { email: 'mtsmobilelab@gmail.com' }
      ],
      deletedAt: null 
    }
  });
  if (!superAdmin) {
    const passwordHash = await bcrypt.hash('MtsLab@2026Secure', 10);
    superAdmin = await prisma.user.create({
      data: {
        email: 'mtsmobilelab@gmail.com',
        username: 'superadmin',
        password: passwordHash,
        name: 'MTS Super Admin',
        role: 'SUPERADMIN',
        accountStatus: 'ACTIVE',
        isActive: true,
        emailVerified: true
      }
    });
  }

  await createTestSession(superAdmin.id);
  const superAdminToken = jwt.sign(
    { id: superAdmin.id, userId: superAdmin.id, email: superAdmin.email, role: superAdmin.role, name: superAdmin.name },
    JWT_SECRET,
    { expiresIn: '2h' }
  );

  const rolesToTest = [
    { roleName: 'SUPER_ADMIN', email: 'test.superadmin@mtslab.com', name: 'Test Super Admin' },
    { roleName: 'ADMIN', email: 'test.admin@mtslab.com', name: 'Test Admin' },
    { roleName: 'MANAGER', email: 'test.manager@mtslab.com', name: 'Test Manager' },
    { roleName: 'HEAD_TECHNICIAN', email: 'test.headtech@mtslab.com', name: 'Test Head Tech' },
    { roleName: 'TECHNICIAN', email: 'test.tech@mtslab.com', name: 'Test Tech' },
    { roleName: 'RECEPTIONIST', email: 'test.receptionist@mtslab.com', name: 'Test Receptionist' }
  ];

  const defaultPassword = 'MtsLab@2026Secure';
  const newTestPassword = 'MtsLab@2026NewPass!';
  const defaultPasswordHash = await bcrypt.hash(defaultPassword, 10);

  // SECTION 1: ROLE-BY-ROLE AUTHENTICATION & PASSWORD WORKFLOWS
  for (const item of rolesToTest) {
    console.log(`--- ROLE: ${item.roleName} (${item.email}) ---`);

    // Ensure test user exists & is active
    let user = await prisma.user.findFirst({
      where: { email: item.email, deletedAt: null }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: item.email,
          username: item.email.split('@')[0],
          password: defaultPasswordHash,
          name: item.name,
          role: item.roleName,
          accountStatus: 'ACTIVE',
          isActive: true,
          emailVerified: true
        }
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          password: defaultPasswordHash,
          accountStatus: 'ACTIVE',
          isActive: true,
          emailVerified: true,
          failedLoginAttempts: 0,
          lockoutUntil: null
        }
      });
    }

    // Step 1: Standard Login with Email/Password
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: user.email, password: defaultPassword })
    });
    const loginData: any = await loginRes.json();
    assert(loginRes.status === 200, `Role ${item.roleName} login succeeds with HTTP 200 OK`);
    assert(loginData.success === true, `Role ${item.roleName} login returns success: true`);
    assert(Boolean(loginData.token), `Role ${item.roleName} login issues JWT access token`);

    // Step 2: Unverified Email Check & Recovery
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: false }
    });

    const unverifiedLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: user.email, password: defaultPassword })
    });
    const unverifiedData: any = await unverifiedLoginRes.json();
    assert(unverifiedLoginRes.status === 403, `Unverified ${item.roleName} email is blocked with HTTP 403`);
    assert(unverifiedData.emailNotVerified === true, `Response specifies emailNotVerified: true for ${item.roleName}`);

    // Direct Verification by SuperAdmin
    const verifyRes = await fetch(`${BASE_URL}/api/users/${user.id}/verify-email`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${superAdminToken}` }
    });
    const verifyData: any = await verifyRes.json();
    assert(verifyRes.status === 200, `Super Admin email verification succeeds with HTTP 200 for ${item.roleName}`);
    assert(verifyData.emailVerified === true, `Verification endpoint returns emailVerified: true for ${item.roleName}`);

    // Re-verify login post-verification
    const postVerifyLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: user.email, password: defaultPassword })
    });
    assert(postVerifyLoginRes.status === 200, `Verified ${item.roleName} login succeeds post-verification`);

    // Step 3: Forgot Password Request (Check registration & link dispatch)
    const forgotRes = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email })
    });
    const forgotData: any = await forgotRes.json();
    assert(forgotRes.status === 200, `Forgot password request succeeds with HTTP 200 for ${item.roleName}`);
    assert(forgotData.registered === true, `Forgot password confirms registration for ${item.roleName}`);
    assert(forgotData.resetLinkSent === true, `Forgot password dispatches reset link for ${item.roleName}`);

    // Step 4: Password Reset Execution & Re-login
    const resetRes = await fetch(`${BASE_URL}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, newPassword: newTestPassword })
    });
    const resetData: any = await resetRes.json();
    assert(resetRes.status === 200, `Password reset succeeds with HTTP 200 for ${item.roleName}`);
    assert(resetData.success === true, `Password reset returns success: true for ${item.roleName}`);

    // Login with Old Password should fail
    const oldPassLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: user.email, password: defaultPassword })
    });
    assert(oldPassLoginRes.status === 401, `Login with old password fails with HTTP 401 for ${item.roleName}`);

    // Login with New Password should succeed
    const newPassLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: user.email, password: newTestPassword })
    });
    assert(newPassLoginRes.status === 200, `Login with newly reset password succeeds for ${item.roleName}`);

    // Reset password back to default for clean state
    await prisma.user.update({
      where: { id: user.id },
      data: { password: defaultPasswordHash }
    });
    console.log(`  ✓ Completed all auth & password flows for role: ${item.roleName}\n`);
  }

  // SECTION 2: SECURITY VERIFICATION FOR UNREGISTERED EMAILS
  console.log('--- SECURITY CHECK: UNREGISTERED EMAIL HANDLING ---');
  const fakeEmail = 'unregistered.fakeuser999@mtslab.com';
  const unregisteredForgotRes = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: fakeEmail })
  });
  const unregisteredData: any = await unregisteredForgotRes.json();

  assert(unregisteredForgotRes.status === 404, 'Forgot password for unregistered email returns HTTP 404 Not Found');
  assert(unregisteredData.registered === false, 'Response explicitly specifies registered: false for unknown email');
  assert(unregisteredData.message.includes('not registered'), 'Response provides security message preventing link dispatch to fake emails');

  const unregisteredResetRes = await fetch(`${BASE_URL}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: fakeEmail, newPassword: newTestPassword })
  });
  assert(unregisteredResetRes.status === 404, 'Reset password for unregistered email returns HTTP 404 Not Found');

  console.log('\n================================================================================');
  console.log(`ALL COMPREHENSIVE MULTI-ROLE AUTH TESTS PASSED: ${passedTests}/${totalTests} (100%)`);
  console.log('================================================================================\n');
}

runComprehensiveAuthTests()
  .catch(err => {
    console.error('Test Suite Failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
