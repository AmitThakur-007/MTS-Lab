import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'mts-lab-super-secret-key';
const OTP_SALT = process.env.OTP_SALT || 'mts-lab-otp-secure-salt-2026';

function hashOtp(otp: string): string {
  return crypto.createHmac('sha256', OTP_SALT).update(otp.trim()).digest('hex');
}

async function run2faOtpTests() {
  console.log('================================================================');
  console.log('MTS LAB 2FA EMAIL OTP VERIFICATION SYSTEM — COMPREHENSIVE E2E TESTS');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS ${totalTests}] ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL ${totalTests}] ${testName}`);
      if (details) console.error(`   Details: ${details}`);
      throw new Error(`Test failed: ${testName}`);
    }
  }

  try {
    // 1. Setup Test Users
    const passwordRaw = 'MTSPassword2026!';
    const passwordHash = await bcrypt.hash(passwordRaw, 10);

    // Super Admin
    let admin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN', deletedAt: null } });
    if (!admin) {
      admin = await prisma.user.create({
        data: {
          name: 'Super Admin Test',
          email: 'admin.2fa.test@mtslab.com',
          username: 'admin2fatest',
          password: passwordHash,
          role: 'SUPER_ADMIN',
          isActive: true,
          emailVerified: true,
          accountStatus: 'ACTIVE',
          twoFactorEnabled: true
        }
      });
    }

    const adminToken = jwt.sign(
      { id: admin.id, userId: admin.id, email: admin.email, role: admin.role, name: admin.name },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Test Staff User 1: Manager with 2FA Enabled
    const testEmail2fa = 'manager.2fa.test@mtslab.com';
    let testUser2fa = await prisma.user.findUnique({ where: { email: testEmail2fa } });
    if (testUser2fa) {
      testUser2fa = await prisma.user.update({
        where: { id: testUser2fa.id },
        data: {
          password: passwordHash,
          role: 'MANAGER',
          emailVerified: true,
          twoFactorEnabled: true,
          isActive: true,
          accountStatus: 'ACTIVE',
          failedLoginAttempts: 0,
          lockoutUntil: null
        }
      });
    } else {
      testUser2fa = await prisma.user.create({
        data: {
          name: 'Manager 2FA Tester',
          email: testEmail2fa,
          username: 'manager2fatest',
          password: passwordHash,
          role: 'MANAGER',
          emailVerified: true,
          twoFactorEnabled: true,
          isActive: true,
          accountStatus: 'ACTIVE'
        }
      });
    }

    // Test Staff User 2: Technician with 2FA Disabled
    const testEmailNo2fa = 'tech.no2fa.test@mtslab.com';
    let testUserNo2fa = await prisma.user.findUnique({ where: { email: testEmailNo2fa } });
    if (testUserNo2fa) {
      testUserNo2fa = await prisma.user.update({
        where: { id: testUserNo2fa.id },
        data: {
          password: passwordHash,
          role: 'TECHNICIAN',
          emailVerified: true,
          twoFactorEnabled: false,
          isActive: true,
          accountStatus: 'ACTIVE',
          failedLoginAttempts: 0,
          lockoutUntil: null
        }
      });
    } else {
      testUserNo2fa = await prisma.user.create({
        data: {
          name: 'Tech Direct Tester',
          email: testEmailNo2fa,
          username: 'techdirecttest',
          password: passwordHash,
          role: 'TECHNICIAN',
          emailVerified: true,
          twoFactorEnabled: false,
          isActive: true,
          accountStatus: 'ACTIVE'
        }
      });
    }

    // Clean old OTPs for test user
    await prisma.oTPVerification.deleteMany({
      where: { userId: testUser2fa.id }
    });

    console.log('--- TEST 1: Password Authenticate User with 2FA Enabled ---');
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identity: testEmail2fa,
        password: passwordRaw
      })
    });
    const loginData: any = await loginRes.json();

    assert(loginRes.status === 200, 'Login returns HTTP 200', JSON.stringify(loginData));
    assert(loginData.mfaRequired === true, 'Response specifies mfaRequired: true');
    assert(!!loginData.mfaTicket, 'Response returns short-lived mfaTicket challenge');
    assert(typeof loginData.emailMasked === 'string' && loginData.emailMasked.includes('@'), 'Response returns masked email address');
    assert(!loginData.token, 'Application accessToken is NOT issued prior to 2FA verification');

    console.log('\n--- TEST 2: Verify OTP Generation, Secure Hashing, and Expiration in Database ---');
    const createdOtpRecord = await prisma.oTPVerification.findFirst({
      where: {
        userId: testUser2fa.id,
        purpose: 'LOGIN_2FA'
      },
      orderBy: { createdAt: 'desc' }
    });

    assert(!!createdOtpRecord, 'OTP record created in database');
    assert(createdOtpRecord?.isUsed === false, 'OTP is initially unused (isUsed: false)');
    assert(createdOtpRecord?.attempts === 0, 'OTP initial attempts is 0');
    assert(createdOtpRecord?.maxAttempts === 5, 'OTP max attempts configured to 5');
    const expiryDiffMs = createdOtpRecord ? new Date(createdOtpRecord.expiresAt).getTime() - new Date(createdOtpRecord.createdAt).getTime() : 0;
    assert(expiryDiffMs >= 4 * 60 * 1000 && expiryDiffMs <= 5.5 * 60 * 1000, 'OTP expiration is set to 5 minutes');

    console.log('\n--- TEST 3: Reject Invalid 6-Digit OTP Code ---');
    const invalidVerifyRes = await fetch(`${BASE_URL}/api/auth/2fa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mfaTicket: loginData.mfaTicket,
        code: '999999'
      })
    });
    const invalidVerifyData: any = await invalidVerifyRes.json();
    assert(invalidVerifyRes.status === 400, 'Invalid OTP code returns HTTP 400');
    assert(invalidVerifyData.success === false, 'Invalid OTP returns success: false');
    assert(invalidVerifyData.message.toLowerCase().includes('invalid verification code'), 'Returns user-friendly error message');

    const updatedAfterFail = await prisma.oTPVerification.findUnique({
      where: { id: createdOtpRecord!.id }
    });
    assert(updatedAfterFail?.attempts === 1, 'Failed attempt incremented attempt counter to 1');

    console.log('\n--- TEST 4: Reject Expired OTP Code ---');
    // Temporarily backdate expiresAt
    await prisma.oTPVerification.update({
      where: { id: createdOtpRecord!.id },
      data: { expiresAt: new Date(Date.now() - 10000) }
    });

    const expiredVerifyRes = await fetch(`${BASE_URL}/api/auth/2fa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mfaTicket: loginData.mfaTicket,
        code: '123456'
      })
    });
    const expiredVerifyData: any = await expiredVerifyRes.json();
    assert(expiredVerifyRes.status === 400, 'Expired OTP returns HTTP 400');
    assert(expiredVerifyData.message.toLowerCase().includes('expired'), 'Returns expired notice message');

    console.log('\n--- TEST 5: Resend 2FA OTP Code & Enforce Cooldown Rate Limit ---');
    // Cooldown check (last OTP created < 60s ago)
    const fastResendRes = await fetch(`${BASE_URL}/api/auth/2fa/resend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mfaTicket: loginData.mfaTicket })
    });
    const fastResendData: any = await fastResendRes.json();
    assert(fastResendRes.status === 429, 'Immediate resend within 60s triggers HTTP 429 rate limit');

    // Simulate 61s elapsed
    await prisma.oTPVerification.update({
      where: { id: createdOtpRecord!.id },
      data: { createdAt: new Date(Date.now() - 65000) }
    });

    const validResendRes = await fetch(`${BASE_URL}/api/auth/2fa/resend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mfaTicket: loginData.mfaTicket })
    });
    const validResendData: any = await validResendRes.json();
    assert(validResendRes.status === 200, 'Resend after cooldown succeeds with HTTP 200');
    assert(validResendData.success === true, 'Resend returns success: true');

    // Old OTP must now be marked isUsed: true
    const oldOtpCheck = await prisma.oTPVerification.findUnique({
      where: { id: createdOtpRecord!.id }
    });
    assert(oldOtpCheck?.isUsed === true, 'Previous OTP is invalidated (isUsed: true)');

    const newResentOtpRecord = await prisma.oTPVerification.findFirst({
      where: { userId: testUser2fa.id, purpose: 'LOGIN_2FA', isUsed: false },
      orderBy: { createdAt: 'desc' }
    });
    assert(!!newResentOtpRecord, 'New active OTP record exists in database');

    console.log('\n--- TEST 6: Successful 2FA Verification with Known 6-Digit OTP ---');
    // Plant a deterministic 6-digit test OTP
    const knownTestOtp = '582914';
    await prisma.oTPVerification.update({
      where: { id: newResentOtpRecord!.id },
      data: {
        codeHash: hashOtp(knownTestOtp),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        attempts: 0,
        isUsed: false
      }
    });

    const successVerifyRes = await fetch(`${BASE_URL}/api/auth/2fa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mfaTicket: loginData.mfaTicket,
        code: knownTestOtp
      })
    });
    const successVerifyData: any = await successVerifyRes.json();
    assert(successVerifyRes.status === 200, 'Correct 6-digit OTP verification returns HTTP 200');
    assert(successVerifyData.success === true, 'Verification returns success: true');
    assert(!!successVerifyData.token, 'Access JWT token issued upon successful OTP verification');
    assert(!!successVerifyData.refreshToken, 'Refresh token issued upon successful OTP verification');
    assert(successVerifyData.user.email === testEmail2fa, 'Returned user object matches logged in staff member');
    assert(successVerifyData.user.role === 'MANAGER', 'User role correctly populated');

    // Verify OTP record is now used
    const usedCheck = await prisma.oTPVerification.findUnique({
      where: { id: newResentOtpRecord!.id }
    });
    assert(usedCheck?.isUsed === true, 'Verified OTP is immediately consumed (isUsed: true)');

    console.log('\n--- TEST 7: Single-Use OTP Protection (Replay Prevention) ---');
    const replayVerifyRes = await fetch(`${BASE_URL}/api/auth/2fa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mfaTicket: loginData.mfaTicket,
        code: knownTestOtp
      })
    });
    const replayVerifyData: any = await replayVerifyRes.json();
    assert(replayVerifyRes.status === 400, 'Replayed OTP code rejected with HTTP 400');

    console.log('\n--- TEST 8: Direct Login for Staff User with 2FA Disabled ---');
    const directLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identity: testEmailNo2fa,
        password: passwordRaw
      })
    });
    const directLoginData: any = await directLoginRes.json();
    assert(directLoginRes.status === 200, 'Direct password login returns HTTP 200');
    assert(directLoginData.mfaRequired === false, 'mfaRequired is false for user with 2FA disabled');
    assert(!!directLoginData.token, 'Direct login immediately issues application token');
    assert(directLoginData.user.email === testEmailNo2fa, 'Direct login returns correct user record');

    console.log('\n--- TEST 9: Super Admin 2FA Toggle Across Staff Roles ---');
    // Toggle 2FA ON for technician
    const toggleOnRes = await fetch(`${BASE_URL}/api/users/${testUserNo2fa.id}/2fa`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ twoFactorEnabled: true })
    });
    const toggleOnData: any = await toggleOnRes.json();
    assert(toggleOnRes.status === 200, 'Super Admin enabling 2FA returns HTTP 200');
    assert(toggleOnData.twoFactorEnabled === true, 'Database updated to twoFactorEnabled: true');

    // Technician login should now require 2FA
    const tech2faLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identity: testEmailNo2fa,
        password: passwordRaw
      })
    });
    const tech2faLoginData: any = await tech2faLoginRes.json();
    assert(tech2faLoginData.mfaRequired === true, 'Technician now prompted for 6-digit OTP after 2FA enabled');

    // Toggle 2FA back OFF for technician
    const toggleOffRes = await fetch(`${BASE_URL}/api/users/${testUserNo2fa.id}/2fa`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ twoFactorEnabled: false })
    });
    const toggleOffData: any = await toggleOffRes.json();
    assert(toggleOffRes.status === 200, 'Super Admin disabling 2FA returns HTTP 200');
    assert(toggleOffData.twoFactorEnabled === false, 'Database updated to twoFactorEnabled: false');

    console.log('\n================================================================');
    console.log(`ALL TESTS PASSED! (${passedTests}/${totalTests})`);
    console.log('================================================================\n');

  } catch (error) {
    console.error('\n❌ Test Suite Aborted due to error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run2faOtpTests();
