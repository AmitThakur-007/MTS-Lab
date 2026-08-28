import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:3000';

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

async function runPermanentStaffRoleAndDeletionTests() {
  console.log('================================================================================');
  console.log('MTS LAB — PERMANENT STAFF ROLE CHANGE & STAFF ACCOUNT DELETION TEST SUITE');
  console.log('================================================================================\n');

  // 1. Authenticate as Super Admin
  const superAdminEmail = 'mtsmobilelab@gmail.com';
  const superAdminPassword = 'admin123';

  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: superAdminEmail, password: superAdminPassword })
  });

  const loginData: any = await loginRes.json();
  assert(loginRes.status === 200 && Boolean(loginData.token), 'Super Admin logs in and receives authorization token');
  const superAdminToken = loginData.token;

  // ---------------------------------------------------------------------------
  // STEP A: STAFF ROLE CHANGE PERISTENCE & DASHBOARD SYNCHRONIZATION
  // ---------------------------------------------------------------------------
  console.log('\n--- STEP A: STAFF ROLE CHANGE PERSISTENCE ---');
  const testStaffEmail = `role.test.${Date.now()}@mtslab.com`;
  const staffPassword = 'MtsLab@2026SecurePass123!';
  const staffName = 'Role Change Test Staff';

  // Create staff account with RECEPTIONIST role
  const createRes = await fetch(`${BASE_URL}/api/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${superAdminToken}`
    },
    body: JSON.stringify({
      email: testStaffEmail,
      name: staffName,
      password: staffPassword,
      role: 'RECEPTIONIST'
    })
  });

  const createdStaff: any = await createRes.json();
  assert(createRes.status === 201 || createRes.status === 200, 'POST /api/users creates test staff member');
  assert(createdStaff.role === 'RECEPTIONIST', 'Initial staff role is RECEPTIONIST');

  // 1. Change role RECEPTIONIST -> TECHNICIAN
  const changeRole1 = await fetch(`${BASE_URL}/api/users/${createdStaff.id}/role`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${superAdminToken}`
    },
    body: JSON.stringify({ role: 'TECHNICIAN' })
  });
  const roleData1: any = await changeRole1.json();
  assert(changeRole1.status === 200 && roleData1.user?.role === 'TECHNICIAN', 'PATCH /api/users/:id/role updates role to TECHNICIAN');

  // Verify directly in Prisma DB
  let dbUser = await prisma.user.findUnique({ where: { id: createdStaff.id } });
  assert(dbUser?.role === 'TECHNICIAN', 'Prisma database confirms role updated to TECHNICIAN');

  // Verify staff login payload reflects new role
  let staffLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: testStaffEmail, password: staffPassword })
  });
  let staffLoginData: any = await staffLoginRes.json();
  assert(staffLoginData.user?.role === 'TECHNICIAN', 'Staff login response user profile confirms TECHNICIAN role');

  // 2. Change role TECHNICIAN -> ADMIN
  const changeRole2 = await fetch(`${BASE_URL}/api/users/${createdStaff.id}/role`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${superAdminToken}`
    },
    body: JSON.stringify({ role: 'ADMIN' })
  });
  const roleData2: any = await changeRole2.json();
  assert(changeRole2.status === 200 && roleData2.user?.role === 'ADMIN', 'PATCH /api/users/:id/role updates role to ADMIN');

  dbUser = await prisma.user.findUnique({ where: { id: createdStaff.id } });
  assert(dbUser?.role === 'ADMIN', 'Prisma database confirms role updated to ADMIN');

  // 3. Change role ADMIN -> HEAD_TECHNICIAN
  const changeRole3 = await fetch(`${BASE_URL}/api/users/${createdStaff.id}/role`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${superAdminToken}`
    },
    body: JSON.stringify({ role: 'HEAD_TECHNICIAN' })
  });
  const roleData3: any = await changeRole3.json();
  assert(changeRole3.status === 200 && roleData3.user?.role === 'HEAD_TECHNICIAN', 'PATCH /api/users/:id/role updates role to HEAD_TECHNICIAN');

  // 4. Change role HEAD_TECHNICIAN -> MANAGER
  const changeRole4 = await fetch(`${BASE_URL}/api/users/${createdStaff.id}/role`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${superAdminToken}`
    },
    body: JSON.stringify({ role: 'MANAGER' })
  });
  const roleData4: any = await changeRole4.json();
  assert(changeRole4.status === 200 && roleData4.user?.role === 'MANAGER', 'PATCH /api/users/:id/role updates role to MANAGER');

  // ---------------------------------------------------------------------------
  // STEP B: RBAC AUTHORIZATION GUARDS & SELF-PROTECTION
  // ---------------------------------------------------------------------------
  console.log('\n--- STEP B: RBAC AUTHORIZATION GUARDS ---');
  // Get fresh token for non-SuperAdmin staff member (MANAGER role)
  const freshStaffLogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: testStaffEmail, password: staffPassword })
  });
  const freshStaffData: any = await freshStaffLogin.json();
  const techToken = freshStaffData.token;

  // Non-SuperAdmin attempts role change -> Rejected HTTP 403
  const unauthRoleRes = await fetch(`${BASE_URL}/api/users/${createdStaff.id}/role`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${techToken}`
    },
    body: JSON.stringify({ role: 'SUPER_ADMIN' })
  });
  assert(unauthRoleRes.status === 403, 'Non-SuperAdmin role change attempt rejected with HTTP 403 Forbidden');

  // SuperAdmin attempts self-downgrade -> Rejected HTTP 400
  const selfDowngradeRes = await fetch(`${BASE_URL}/api/users/${loginData.user.id}/role`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${superAdminToken}`
    },
    body: JSON.stringify({ role: 'TECHNICIAN' })
  });
  assert(selfDowngradeRes.status === 400, 'SuperAdmin self-downgrade attempt rejected with HTTP 400');

  // SuperAdmin attempts self-deletion -> Rejected HTTP 400
  const selfDeleteRes = await fetch(`${BASE_URL}/api/users/${loginData.user.id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${superAdminToken}`
    }
  });
  assert(selfDeleteRes.status === 400, 'SuperAdmin self-deletion attempt rejected with HTTP 400');

  // ---------------------------------------------------------------------------
  // STEP C: PERMANENT STAFF ACCOUNT DELETION
  // ---------------------------------------------------------------------------
  console.log('\n--- STEP C: PERMANENT STAFF ACCOUNT DELETION ---');
  const deleteStaffRes = await fetch(`${BASE_URL}/api/users/${createdStaff.id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${superAdminToken}`
    }
  });
  const deleteStaffData: any = await deleteStaffRes.json();
  assert(deleteStaffRes.status === 200, 'DELETE /api/users/:id permanently deletes staff account (HTTP 200)');

  // Verify user is completely removed from Prisma DB
  const deletedDbUser = await prisma.user.findUnique({ where: { id: createdStaff.id } });
  assert(deletedDbUser === null, 'Prisma database confirms user row is permanently deleted (null)');

  // Verify deleted user cannot log in
  const deletedStaffLogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: testStaffEmail, password: staffPassword })
  });
  assert(deletedStaffLogin.status === 401, 'Deleted staff member login attempt rejected with HTTP 401');

  // Verify deleted user no longer appears in GET /api/users staff directory
  const usersDirectoryRes = await fetch(`${BASE_URL}/api/users`, {
    headers: {
      'Authorization': `Bearer ${superAdminToken}`
    }
  });
  const usersList: any = await usersDirectoryRes.json();
  const foundInDirectory = Array.isArray(usersList) && usersList.some((u: any) => u.id === createdStaff.id || u.email === testStaffEmail);
  assert(!foundInDirectory, 'Deleted staff member does NOT appear anywhere in GET /api/users directory');

  // ---------------------------------------------------------------------------
  // STEP D: BULK PERMANENT STAFF DELETION
  // ---------------------------------------------------------------------------
  console.log('\n--- STEP D: BULK PERMANENT STAFF DELETION ---');
  // Create 2 temporary staff accounts for bulk deletion testing
  const temp1Email = `bulk1.${Date.now()}@mtslab.com`;
  const temp2Email = `bulk2.${Date.now()}@mtslab.com`;

  const c1 = await fetch(`${BASE_URL}/api/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${superAdminToken}` },
    body: JSON.stringify({ email: temp1Email, name: 'Bulk Tech 1', password: 'MtsLab@2026SecurePass123!', role: 'TECHNICIAN' })
  });
  const temp1: any = await c1.json();

  const c2 = await fetch(`${BASE_URL}/api/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${superAdminToken}` },
    body: JSON.stringify({ email: temp2Email, name: 'Bulk Tech 2', password: 'MtsLab@2026SecurePass123!', role: 'RECEPTIONIST' })
  });
  const temp2: any = await c2.json();

  const temp1Id = temp1.user?.id || temp1.id;
  const temp2Id = temp2.user?.id || temp2.id;

  assert(Boolean(temp1Id) && Boolean(temp2Id), 'Created 2 temporary staff accounts for bulk deletion test');

  const bulkRes = await fetch(`${BASE_URL}/api/admin/users/bulk-delete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${superAdminToken}`
    },
    body: JSON.stringify({ userIds: [temp1Id, temp2Id] })
  });
  const bulkData: any = await bulkRes.json();
  assert(bulkRes.status === 200 && bulkData.success === true, 'POST /api/admin/users/bulk-delete executes successfully');

  const checkTemp1 = await prisma.user.findUnique({ where: { id: temp1Id } });
  const checkTemp2 = await prisma.user.findUnique({ where: { id: temp2Id } });
  assert(checkTemp1 === null && checkTemp2 === null, 'Bulk deleted staff accounts are permanently deleted from database (null)');

  console.log('\n================================================================================');
  console.log(`ALL PERMANENT ROLE CHANGE & DELETION TESTS PASSED: ${passedTests}/${totalTests} (100%)`);
  console.log('================================================================================\n');
}

runPermanentStaffRoleAndDeletionTests()
  .catch((err) => {
    console.error('Test Suite Error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
