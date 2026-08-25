import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'mts-lab-super-secret-key';
const RTDB_BASE_URL = 'https://mts-lab-eb8d2-default-rtdb.firebaseio.com';

async function runSuperAdminDirectEmailVerificationTests() {
  console.log('================================================================================');
  console.log('MTS LAB — SUPER ADMIN DIRECT EMAIL VERIFICATION FEATURE TEST SUITE');
  console.log('================================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS ${totalTests}]: ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL ${totalTests}]: ${testName}`);
      if (details) console.error(`   Details: ${details}`);
      throw new Error(`Test failed: ${testName}`);
    }
  }

  try {
    const defaultPassword = 'MTSPassword2026!';
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    // 1. Setup Super Admin
    let superAdmin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN', deletedAt: null } });
    if (!superAdmin) {
      superAdmin = await prisma.user.create({
        data: {
          name: 'Super Admin Official',
          email: 'superadmin.directverify@mtslab.com',
          username: 'superadmindirect',
          password: passwordHash,
          role: 'SUPER_ADMIN',
          isActive: true,
          emailVerified: true,
          accountStatus: 'ACTIVE',
          twoFactorEnabled: false
        }
      });
    }

    const superAdminToken = jwt.sign(
      { id: superAdmin.id, userId: superAdmin.id, email: superAdmin.email, role: superAdmin.role, name: superAdmin.name },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    // 2. Setup Non-SuperAdmin Users (Admin, Manager, Receptionist, Technician, etc.)
    let normalAdmin = await prisma.user.findUnique({ where: { email: 'admin.regular@mtslab.local' } });
    if (!normalAdmin) {
      normalAdmin = await prisma.user.create({
        data: {
          name: 'Regular Admin',
          email: 'admin.regular@mtslab.local',
          username: 'adminregular',
          password: passwordHash,
          role: 'ADMIN',
          isActive: true,
          emailVerified: true,
          accountStatus: 'ACTIVE',
          twoFactorEnabled: false
        }
      });
    }

    const normalAdminToken = jwt.sign(
      { id: normalAdmin.id, userId: normalAdmin.id, email: normalAdmin.email, role: normalAdmin.role, name: normalAdmin.name },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    let receptionist = await prisma.user.findUnique({ where: { email: 'reception.staff@mtslab.local' } });
    if (!receptionist) {
      receptionist = await prisma.user.create({
        data: {
          name: 'Front Desk Receptionist',
          email: 'reception.staff@mtslab.local',
          username: 'receptionstaff',
          password: passwordHash,
          role: 'RECEPTIONIST',
          isActive: true,
          emailVerified: true,
          accountStatus: 'ACTIVE',
          twoFactorEnabled: false
        }
      });
    }

    const receptionistToken = jwt.sign(
      { id: receptionist.id, userId: receptionist.id, email: receptionist.email, role: receptionist.role, name: receptionist.name },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    let technician = await prisma.user.findUnique({ where: { email: 'tech.staff@mtslab.local' } });
    if (!technician) {
      technician = await prisma.user.create({
        data: {
          name: 'Hardware Tech Staff',
          email: 'tech.staff@mtslab.local',
          username: 'techstaff',
          password: passwordHash,
          role: 'TECHNICIAN',
          isActive: true,
          emailVerified: true,
          accountStatus: 'ACTIVE',
          twoFactorEnabled: false
        }
      });
    }

    const technicianToken = jwt.sign(
      { id: technician.id, userId: technician.id, email: technician.email, role: technician.role, name: technician.name },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    // 3. Setup Unverified Target Staff Users across multiple roles
    const rolesToTest = [
      { role: 'MANAGER', email: 'unverified.manager@mtslab.local', name: 'Unverified Manager' },
      { role: 'RECEPTIONIST', email: 'unverified.receptionist@mtslab.local', name: 'Unverified Receptionist' },
      { role: 'LEAD_TECHNICIAN', email: 'unverified.leadtech@mtslab.local', name: 'Unverified Lead Tech' },
      { role: 'TECHNICIAN', email: 'unverified.tech@mtslab.local', name: 'Unverified Technician' },
      { role: 'TECHNICAL_ASSISTANT', email: 'unverified.assistant@mtslab.local', name: 'Unverified Assistant' },
      { role: 'ADMIN', email: 'unverified.admin@mtslab.local', name: 'Unverified Admin' },
    ];

    const targetUsers: any[] = [];
    for (const r of rolesToTest) {
      let u = await prisma.user.findUnique({ where: { email: r.email } });
      if (u) {
        u = await prisma.user.update({
          where: { id: u.id },
          data: {
            name: r.name,
            password: passwordHash,
            role: r.role,
            emailVerified: false,
            twoFactorEnabled: true,
            isActive: true,
            accountStatus: 'ACTIVE'
          }
        });
      } else {
        u = await prisma.user.create({
          data: {
            name: r.name,
            email: r.email,
            username: r.email.split('@')[0],
            password: passwordHash,
            role: r.role,
            emailVerified: false,
            twoFactorEnabled: true,
            isActive: true,
            accountStatus: 'ACTIVE'
          }
        });
      }
      targetUsers.push(u);
    }

    console.log('--- GROUP 1: Unverified User State & Login Restriction Check ---');
    const primaryTarget = targetUsers[0]; // Manager

    // Attempt login as unverified user
    const unverifiedLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identity: primaryTarget.email,
        password: defaultPassword
      })
    });
    const unverifiedLoginData: any = await unverifiedLoginRes.json();
    assert(unverifiedLoginRes.status === 403, 'Unverified staff member login is blocked with HTTP 403');
    assert(unverifiedLoginData.emailNotVerified === true, 'Response specifies emailNotVerified: true');

    console.log('\n--- GROUP 2: Security & RBAC Enforcement (Rejection of Non-SuperAdmin Calls) ---');
    // Normal Admin attempts to verify
    const adminAttemptRes = await fetch(`${BASE_URL}/api/users/${primaryTarget.id}/verify-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${normalAdminToken}`
      }
    });
    assert(adminAttemptRes.status === 403, 'Regular ADMIN calling verify-email is rejected with HTTP 403 Forbidden');

    // Receptionist attempts to verify
    const receptionAttemptRes = await fetch(`${BASE_URL}/api/users/${primaryTarget.id}/verify-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${receptionistToken}`
      }
    });
    assert(receptionAttemptRes.status === 403, 'RECEPTIONIST calling verify-email is rejected with HTTP 403 Forbidden');

    // Technician attempts to verify
    const techAttemptRes = await fetch(`${BASE_URL}/api/users/${primaryTarget.id}/verify-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${technicianToken}`
      }
    });
    assert(techAttemptRes.status === 403, 'TECHNICIAN calling verify-email is rejected with HTTP 403 Forbidden');

    // Unauthenticated request
    const unauthAttemptRes = await fetch(`${BASE_URL}/api/users/${primaryTarget.id}/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    assert(unauthAttemptRes.status === 401, 'Unauthenticated request is rejected with HTTP 401 Unauthorized');

    // Invalid target user ID
    const invalidIdRes = await fetch(`${BASE_URL}/api/users/non-existent-user-id-99999/verify-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${superAdminToken}`
      }
    });
    assert(invalidIdRes.status === 404, 'Non-existent user ID returns HTTP 404 Not Found');

    console.log('\n--- GROUP 3: Super Admin Direct Email Verification Execution ---');
    const directVerifyRes = await fetch(`${BASE_URL}/api/users/${primaryTarget.id}/verify-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${superAdminToken}`
      }
    });
    const directVerifyData: any = await directVerifyRes.json();
    assert(directVerifyRes.status === 200, 'Super Admin direct verify returns HTTP 200 OK');
    assert(directVerifyData.success === true, 'Response indicates success: true');
    assert(directVerifyData.emailVerified === true, 'Response indicates emailVerified: true');
    assert(directVerifyData.message.includes('successfully'), 'Response contains user-friendly success message');

    console.log('\n--- GROUP 4: Database & Realtime State Consistency Verification ---');
    // Check SQLite / Prisma
    const updatedDbUser = await prisma.user.findUnique({ where: { id: primaryTarget.id } });
    assert(updatedDbUser?.emailVerified === true, 'Prisma/SQLite database updated to emailVerified: true');

    // Check Firebase RTDB
    try {
      const rtdbRes = await fetch(`${RTDB_BASE_URL}/users/${primaryTarget.id}.json`);
      if (rtdbRes.ok) {
        const rtdbUser: any = await rtdbRes.json();
        if (rtdbUser) {
          assert(rtdbUser.emailVerified === true, 'Firebase Realtime Database synchronized with emailVerified: true');
        }
      }
    } catch (rtdbErr) {
      console.log('  (RTDB network fetch skipped or offline; server sync triggered)');
    }

    // Check GET /api/users listing
    const usersListRes = await fetch(`${BASE_URL}/api/users`, {
      headers: { 'Authorization': `Bearer ${superAdminToken}` }
    });
    const usersListData: any = await usersListRes.json();
    const fetchedTarget = (Array.isArray(usersListData) ? usersListData : usersListData.users || []).find((u: any) => u.id === primaryTarget.id);
    assert(fetchedTarget?.emailVerified === true, 'GET /api/users reflects emailVerified: true');

    console.log('\n--- GROUP 5: Direct Verification Across All Staff Roles ---');
    for (let i = 1; i < targetUsers.length; i++) {
      const target = targetUsers[i];
      const res = await fetch(`${BASE_URL}/api/users/${target.id}/verify-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${superAdminToken}`
        }
      });
      const data: any = await res.json();
      assert(res.status === 200 && data.success === true && data.emailVerified === true, `Direct verified staff member with role: ${target.role} (${target.email})`);
      
      const dbCheck = await prisma.user.findUnique({ where: { id: target.id } });
      assert(dbCheck?.emailVerified === true, `Database updated for role: ${target.role}`);
    }

    console.log('\n--- GROUP 6: Safe Handling of Already Verified User ---');
    const alreadyVerifiedRes = await fetch(`${BASE_URL}/api/users/${primaryTarget.id}/verify-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${superAdminToken}`
      }
    });
    const alreadyVerifiedData: any = await alreadyVerifiedRes.json();
    assert(alreadyVerifiedRes.status === 200, 'Re-verifying returns HTTP 200');
    assert(alreadyVerifiedData.alreadyVerified === true || alreadyVerifiedData.emailVerified === true, 'Re-verifying returns safe verified notice');

    console.log('\n--- GROUP 7: Post-Verification Login Flow & 2FA Independence ---');
    // Staff member is now verified, but has 2FA enabled
    const verifiedLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identity: primaryTarget.email,
        password: defaultPassword
      })
    });
    const verifiedLoginData: any = await verifiedLoginRes.json();
    assert(verifiedLoginRes.status === 200, 'Verified staff member login succeeds with HTTP 200');
    assert(verifiedLoginData.emailNotVerified !== true, 'System does NOT request email verification');
    assert(verifiedLoginData.mfaRequired === true, '2FA OTP is still required because user has 2FA enabled (2FA not bypassed)');
    assert(!!verifiedLoginData.mfaTicket, 'MFA Ticket challenge is returned for 2FA step');

    console.log('\n--- GROUP 8: Audit Log Record Verification ---');
    const auditLog = await prisma.auditLog.findFirst({
      where: {
        action: 'EMAIL_VERIFIED_BY_SUPER_ADMIN',
        resourceId: primaryTarget.id
      },
      orderBy: { createdAt: 'desc' }
    });
    assert(!!auditLog, 'Audit log entry created for EMAIL_VERIFIED_BY_SUPER_ADMIN');
    assert(auditLog?.userId === superAdmin.id, 'Audit log recorded Super Admin user ID');
    assert(auditLog?.status === 'SUCCESS', 'Audit log recorded status SUCCESS');
    assert(auditLog?.details?.includes(primaryTarget.email), 'Audit log details include target user email');

    console.log('\n================================================================================');
    console.log(`ALL TESTS PASSED SUCCESSFULLY! (${passedTests}/${totalTests})`);
    console.log('================================================================================\n');

  } catch (error) {
    console.error('\n❌ Test Suite Aborted due to error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runSuperAdminDirectEmailVerificationTests();
