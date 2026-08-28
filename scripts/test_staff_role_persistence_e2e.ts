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

async function runStaffRolePersistenceE2ETests() {
  console.log('================================================================================');
  console.log('MTS LAB — PERMANENT STAFF ROLE PERSISTENCE & LOGOUT/LOGIN RE-AUTH TEST SUITE');
  console.log('================================================================================\n');

  // 1. SuperAdmin Login
  const superAdminEmail = 'mtsmobilelab@gmail.com';
  const superAdminPassword = 'admin123';

  let superAdmin = await prisma.user.findFirst({
    where: { email: superAdminEmail, deletedAt: null }
  });
  if (!superAdmin) {
    const passwordHash = await bcrypt.hash(superAdminPassword, 10);
    superAdmin = await prisma.user.create({
      data: {
        email: superAdminEmail,
        username: 'superadmin',
        password: passwordHash,
        name: 'MTS Super Admin',
        role: 'SUPER_ADMIN',
        accountStatus: 'ACTIVE',
        isActive: true,
        emailVerified: true
      }
    });
  }

  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: superAdminEmail, password: superAdminPassword })
  });
  const loginData: any = await loginRes.json();
  assert(loginRes.status === 200 && Boolean(loginData.token), 'Super Admin successfully logs in');
  const superAdminToken = loginData.token;

  // 2. Create a dedicated test staff member
  const testStaffEmail = `persistence.staff.${Date.now()}@mtslab.com`;
  const testStaffPassword = 'MtsLab@2026SecureStaff123!';
  const testStaffName = 'Persistent Staff Member';

  const createRes = await fetch(`${BASE_URL}/api/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${superAdminToken}`
    },
    body: JSON.stringify({
      email: testStaffEmail,
      name: testStaffName,
      password: testStaffPassword,
      role: 'RECEPTIONIST'
    })
  });
  const createdStaff: any = await createRes.json();
  const staffUserId = createdStaff.id || createdStaff.user?.id;
  assert(Boolean(staffUserId), `Created test staff account: ${testStaffEmail} (ID: ${staffUserId})`);

  // Direct email verification so login is permitted immediately
  await prisma.user.update({
    where: { id: staffUserId },
    data: { emailVerified: true, accountStatus: 'ACTIVE', isActive: true }
  });

  // 3. Test Role Transitions & Persistence across Logout/Login cycles for ALL 6 Roles
  const rolesToTest = [
    'TECHNICIAN',
    'HEAD_TECHNICIAN',
    'MANAGER',
    'ADMIN',
    'RECEPTIONIST',
    'TECHNICIAN' // Re-test TECHNICIAN after RECEPTIONIST to guarantee no sticky reversion
  ];

  for (const targetRole of rolesToTest) {
    console.log(`\n------------------------------------------------------------`);
    console.log(`TESTING ROLE ASSIGNMENT & MULTI-LOGIN PERSISTENCE: ${targetRole}`);
    console.log(`------------------------------------------------------------`);

    // A. SuperAdmin explicitly assigns the role
    const patchRoleRes = await fetch(`${BASE_URL}/api/users/${staffUserId}/role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${superAdminToken}`
      },
      body: JSON.stringify({ role: targetRole })
    });
    const patchRoleData: any = await patchRoleRes.json();
    assert(patchRoleRes.status === 200 && patchRoleData.success === true, `SuperAdmin assigns role '${targetRole}' to staff`);

    // B. Verify database record
    const dbCheck = await prisma.user.findUnique({ where: { id: staffUserId } });
    assert(dbCheck?.role === targetRole, `SQLite Database confirms User.role is strictly '${targetRole}'`);

    // C. Staff Login #1 (Immediately after role change)
    const staffLogin1 = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: testStaffEmail, password: testStaffPassword })
    });
    const staffData1: any = await staffLogin1.json();
    assert(staffLogin1.status === 200 && Boolean(staffData1.token), `Staff login #1 succeeds`);
    assert(staffData1.user?.role === targetRole, `Staff login #1 payload returns role '${targetRole}' (NOT RECEPTIONIST)`);

    const decodedToken1: any = jwt.decode(staffData1.token);
    assert(decodedToken1?.role === targetRole, `JWT token payload strictly includes role '${targetRole}'`);

    // D. Fetch profile via /api/auth/me
    const meRes1 = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${staffData1.token}` }
    });
    const meData1: any = await meRes1.json();
    assert(meRes1.status === 200 && meData1.user?.role === targetRole, `GET /api/auth/me returns persisted role '${targetRole}'`);

    // E. Refresh session via /api/auth/refresh
    const refreshRes1 = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${staffData1.token}`,
        'x-refresh-token': staffData1.refreshToken
      },
      body: JSON.stringify({ refreshToken: staffData1.refreshToken })
    });
    const refreshData1: any = await refreshRes1.json();
    assert(refreshRes1.status === 200 && refreshData1.user?.role === targetRole, `POST /api/auth/refresh returns role '${targetRole}'`);

    // F. Logout #1
    const logoutRes1 = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${staffData1.token}`
      },
      body: JSON.stringify({ refreshToken: staffData1.refreshToken })
    });
    assert(logoutRes1.status === 200, `Staff logs out successfully`);

    // G. Staff Login #2 (After Logout)
    const staffLogin2 = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: testStaffEmail, password: testStaffPassword })
    });
    const staffData2: any = await staffLogin2.json();
    assert(staffLogin2.status === 200 && Boolean(staffData2.token), `Staff login #2 (after logout) succeeds`);
    assert(staffData2.user?.role === targetRole, `Staff login #2 payload STILL maintains role '${targetRole}'`);

    // H. Staff Login #3 (Simulate fresh browser/another device login)
    const staffLogin3 = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identity: testStaffEmail,
        password: testStaffPassword,
        device: { deviceIdentifier: `device_${Date.now()}`, deviceName: 'Mobile Safari on iPhone' }
      })
    });
    const staffData3: any = await staffLogin3.json();
    assert(staffLogin3.status === 200 && staffData3.user?.role === targetRole, `Staff login #3 from alternate device maintains role '${targetRole}'`);

    // I. Confirm database remained untouched during all logouts and logins
    const finalDbCheck = await prisma.user.findUnique({ where: { id: staffUserId } });
    assert(finalDbCheck?.role === targetRole, `Database User.role NEVER mutated during logout/login cycle and is '${targetRole}'`);
  }

  // 4. Device Access Request Role Integrity Test
  console.log(`\n------------------------------------------------------------`);
  console.log(`TESTING DEVICE ACCESS APPROVAL ROLE INTEGRITY`);
  console.log(`------------------------------------------------------------`);

  // Ensure staff is TECHNICIAN
  await fetch(`${BASE_URL}/api/users/${staffUserId}/role`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${superAdminToken}` },
    body: JSON.stringify({ role: 'TECHNICIAN' })
  });

  // Create an Access Request for this technician from a new device (without explicit role)
  const accessReq = await prisma.accessRequest.create({
    data: {
      userId: staffUserId,
      fullName: testStaffName,
      email: testStaffEmail,
      googleId: `google_test_${Date.now()}`,
      deviceIdentifier: `dev_new_test_${Date.now()}`,
      deviceName: 'Technician iPad Pro',
      requestedRole: 'RECEPTIONIST', // Default incoming request fallback
      status: 'PENDING'
    }
  });

  // SuperAdmin approves device access without passing a role payload
  const approveRes = await fetch(`${BASE_URL}/api/access-requests/${accessReq.id}/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${superAdminToken}`
    },
    body: JSON.stringify({}) // Empty body
  });
  const approveData: any = await approveRes.json();
  assert(approveRes.status === 200, `SuperAdmin approves device access request`);

  // Check user role in DB: Must STILL be TECHNICIAN (NOT overwritten with RECEPTIONIST)
  const userAfterDeviceApproval = await prisma.user.findUnique({ where: { id: staffUserId } });
  assert(userAfterDeviceApproval?.role === 'TECHNICIAN', `User role preserved as TECHNICIAN after device approval`);

  // 5. Cleanup Test Account
  console.log(`\n------------------------------------------------------------`);
  console.log(`CLEANING UP TEST STAFF ACCOUNT`);
  console.log(`------------------------------------------------------------`);
  const deleteRes = await fetch(`${BASE_URL}/api/users/${staffUserId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${superAdminToken}` }
  });
  assert(deleteRes.status === 200, `Deleted test staff account ${testStaffEmail}`);

  console.log('\n================================================================================');
  console.log(`ALL PERMANENT STAFF ROLE PERSISTENCE TESTS PASSED: ${passedTests}/${totalTests} (100%)`);
  console.log('================================================================================\n');
}

runStaffRolePersistenceE2ETests()
  .catch((err) => {
    console.error('Test Suite Error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
