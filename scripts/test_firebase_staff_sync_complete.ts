import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

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

async function runFirebaseStaffSyncTests() {
  console.log('================================================================================');
  console.log('MTS LAB — STAFF ACCOUNT ↔ FIREBASE AUTHENTICATION SYNCHRONIZATION TEST SUITE');
  console.log('================================================================================\n');

  // 1. Authenticate as Super Admin to get authorization JWT token
  const superAdminEmail = 'mtsmobilelab@gmail.com';
  const superAdminPassword = 'admin123';

  // Ensure SuperAdmin account is active
  let superAdminUser = await prisma.user.findFirst({
    where: { email: superAdminEmail }
  });

  if (!superAdminUser) {
    throw new Error('Super Admin user (mtsmobilelab@gmail.com) not found in database.');
  }

  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: superAdminEmail, password: superAdminPassword })
  });

  const loginData: any = await loginRes.json();
  assert(loginRes.status === 200 && Boolean(loginData.token), 'Super Admin logs in and receives authorization token');
  const superAdminToken = loginData.token;

  // Authenticate as Regular Technician for RBAC testing
  const techUser = await prisma.user.findFirst({
    where: { role: 'TECHNICIAN', deletedAt: null }
  });

  let techToken = '';
  if (techUser) {
    const techLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: techUser.email, password: 'MtsLab@2026Secure' })
    });
    const techLoginData: any = await techLoginRes.json();
    if (techLoginData.token) {
      techToken = techLoginData.token;
    }
  }

  // ---------------------------------------------------------------------------
  // STEP A: STAFF CREATION WITH AUTOMATIC FIREBASE AUTHENTICATION PROVISIONING
  // ---------------------------------------------------------------------------
  console.log('\n--- STEP A: STAFF CREATION & FIREBASE PROVISIONING ---');
  const testStaffEmail = `sync.test.${Date.now()}@mtslab.com`;
  const initialPassword = 'MtsLab@2026SecurePass123!';
  const testStaffName = 'Sync Test Engineer';

  const createRes = await fetch(`${BASE_URL}/api/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${superAdminToken}`
    },
    body: JSON.stringify({
      email: testStaffEmail,
      name: testStaffName,
      password: initialPassword,
      role: 'RECEPTIONIST',
      phoneNumber: '9800001122',
      department: 'Front Desk'
    })
  });

  const createdStaff: any = await createRes.json();

  assert(createRes.status === 201 || createRes.status === 200, `POST /api/users creates staff successfully (HTTP ${createRes.status})`);
  assert(Boolean(createdStaff.id), 'Returned staff record contains valid database ID');
  assert(createdStaff.email === testStaffEmail, 'Returned staff record email matches input');
  assert(Boolean(createdStaff.firebaseUid), `Returned staff record has linked firebaseUid (${createdStaff.firebaseUid})`);

  // Verify record directly in Prisma DB
  const dbUser = await prisma.user.findUnique({ where: { id: createdStaff.id } });
  assert(dbUser?.firebaseUid === createdStaff.firebaseUid, 'Prisma database confirms linked firebaseUid');

  // Verify created staff can log in using Firebase Auth & credentials
  const staffLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: testStaffEmail, password: initialPassword })
  });
  const staffLoginData: any = await staffLoginRes.json();
  assert(staffLoginRes.status === 200 && Boolean(staffLoginData.token), 'Newly created staff logs in successfully with initial password');

  // ---------------------------------------------------------------------------
  // STEP B: DUPLICATE EMAIL REJECTION
  // ---------------------------------------------------------------------------
  console.log('\n--- STEP B: DUPLICATE EMAIL REJECTION ---');
  const dupRes = await fetch(`${BASE_URL}/api/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${superAdminToken}`
    },
    body: JSON.stringify({
      email: testStaffEmail,
      name: 'Duplicate Staff Member',
      password: 'MtsLab@2026SecurePass123!',
      role: 'RECEPTIONIST'
    })
  });

  const dupData: any = await dupRes.json();
  assert(dupRes.status === 400, 'Duplicate email creation rejected with HTTP 400');
  assert(dupData.error?.includes('already exists'), 'Duplicate creation returns controlled error message');

  // ---------------------------------------------------------------------------
  // STEP C: STAFF EDIT & EMAIL CHANGE SYNCHRONIZATION
  // ---------------------------------------------------------------------------
  console.log('\n--- STEP C: STAFF EDIT & EMAIL CHANGE SYNCHRONIZATION ---');
  const updatedEmail = `updated.${Date.now()}@mtslab.com`;
  const updatedName = 'Sync Test Engineer Updated';

  const editRes = await fetch(`${BASE_URL}/api/users/${createdStaff.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${superAdminToken}`
    },
    body: JSON.stringify({
      name: updatedName,
      email: updatedEmail,
      phoneNumber: '9811112233'
    })
  });

  const editData: any = await editRes.json();
  assert(editRes.status === 200, 'PATCH /api/users/:id updates profile successfully');
  assert(editData.user?.email === updatedEmail, 'Prisma record reflects updated email');
  assert(editData.user?.firebaseUid === createdStaff.firebaseUid, 'Firebase UID remains linked and unchanged');

  // Verify staff can log in using new email
  const newEmailLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: updatedEmail, password: initialPassword })
  });
  const newEmailLoginData: any = await newEmailLoginRes.json();
  assert(newEmailLoginRes.status === 200 && Boolean(newEmailLoginData.token), 'Staff logs in successfully using newly updated email');

  // Verify old email is no longer valid for login
  const oldEmailLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: testStaffEmail, password: initialPassword })
  });
  assert(oldEmailLoginRes.status === 401, 'Login with old email is rejected (HTTP 401)');

  // ---------------------------------------------------------------------------
  // STEP D: PASSWORD RESET / UPDATE SYNCHRONIZATION
  // ---------------------------------------------------------------------------
  console.log('\n--- STEP D: PASSWORD RESET SYNCHRONIZATION ---');
  const newPassword = 'MtsLab@2026NewPassword99!';

  const pwdResetRes = await fetch(`${BASE_URL}/api/users/${createdStaff.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${superAdminToken}`
    },
    body: JSON.stringify({ password: newPassword })
  });

  assert(pwdResetRes.status === 200, 'PATCH /api/users/:id resets staff password successfully');

  // Verify old password is rejected
  const oldPwdRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: updatedEmail, password: initialPassword })
  });
  assert(oldPwdRes.status === 401, 'Old password is rejected after password update (HTTP 401)');

  // Verify new password is accepted
  const newPwdRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: updatedEmail, password: newPassword })
  });
  const newPwdData: any = await newPwdRes.json();
  assert(newPwdRes.status === 200 && Boolean(newPwdData.token), 'New password is accepted and returns valid session token');

  // ---------------------------------------------------------------------------
  // STEP E: ROLE CHANGE SYNCHRONIZATION
  // ---------------------------------------------------------------------------
  console.log('\n--- STEP E: ROLE CHANGE SYNCHRONIZATION ---');
  const roleRes = await fetch(`${BASE_URL}/api/users/${createdStaff.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${superAdminToken}`
    },
    body: JSON.stringify({ role: 'TECHNICIAN' })
  });
  const roleData: any = await roleRes.json();
  assert(roleRes.status === 200 && roleData.user?.role === 'TECHNICIAN', 'Role updated from RECEPTIONIST to TECHNICIAN');

  // Verify updated user payload on login reflects new role
  const roleLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: updatedEmail, password: newPassword })
  });
  const roleLoginData: any = await roleLoginRes.json();
  assert(roleLoginData.user?.role === 'TECHNICIAN', 'Login response user profile confirms updated TECHNICIAN role');

  // ---------------------------------------------------------------------------
  // STEP F: DISABLE & ENABLE SYNCHRONIZATION
  // ---------------------------------------------------------------------------
  console.log('\n--- STEP F: ACCOUNT DISABLE & ENABLE SYNCHRONIZATION ---');
  
  // Disable account
  const disableRes = await fetch(`${BASE_URL}/api/users/${createdStaff.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${superAdminToken}`
    },
    body: JSON.stringify({ isActive: false, accountStatus: 'DISABLED' })
  });
  assert(disableRes.status === 200, 'Super Admin disables staff account');

  // Verify login attempt for disabled account is rejected
  const disabledLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: updatedEmail, password: newPassword })
  });
  assert(disabledLoginRes.status === 401 || disabledLoginRes.status === 403, 'Disabled account login attempt is rejected (HTTP 401/403)');

  // Enable account
  const enableRes = await fetch(`${BASE_URL}/api/users/${createdStaff.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${superAdminToken}`
    },
    body: JSON.stringify({ isActive: true, accountStatus: 'ACTIVE' })
  });
  assert(enableRes.status === 200, 'Super Admin re-enables staff account');

  // Verify login works again after enabling
  const reenabledLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: updatedEmail, password: newPassword })
  });
  assert(reenabledLoginRes.status === 200, 'Re-enabled staff account logs in successfully (HTTP 200)');

  // ---------------------------------------------------------------------------
  // STEP G: SERVER-SIDE RBAC AUTHORIZATION GUARD
  // ---------------------------------------------------------------------------
  console.log('\n--- STEP G: SERVER-SIDE RBAC AUTHORIZATION GUARD ---');
  if (techToken) {
    const unauthCreateRes = await fetch(`${BASE_URL}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${techToken}`
      },
      body: JSON.stringify({
        email: `unauth.${Date.now()}@mtslab.com`,
        name: 'Unauth Staff',
        password: 'MtsLab@2026Pass!',
        role: 'TECHNICIAN'
      })
    });
    assert(unauthCreateRes.status === 403, 'Non-SuperAdmin staff creation attempt rejected with HTTP 403 Forbidden');
  }

  // ---------------------------------------------------------------------------
  // STEP H: STAFF DELETION & FIREBASE CLEANUP
  // ---------------------------------------------------------------------------
  console.log('\n--- STEP H: STAFF DELETION & FIREBASE CLEANUP ---');
  const deleteRes = await fetch(`${BASE_URL}/api/users/${createdStaff.id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${superAdminToken}`
    }
  });

  const deleteData: any = await deleteRes.json();
  assert(deleteRes.status === 200, 'DELETE /api/users/:id deletes staff member successfully (HTTP 200)');

  // Verify deleted user cannot log in
  const deletedLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: updatedEmail, password: newPassword })
  });
  assert(deletedLoginRes.status === 401, 'Deleted staff account login is rejected (HTTP 401)');

  console.log('\n================================================================================');
  console.log(`ALL FIREBASE STAFF SYNCHRONIZATION TESTS PASSED: ${passedTests}/${totalTests} (100%)`);
  console.log('================================================================================\n');
}

runFirebaseStaffSyncTests()
  .catch((err) => {
    console.error('Test Suite Error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
