import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const BASE_URL = 'http://localhost:3000/api';

async function runTests() {
  console.log('=== STARTING STAFF MANAGEMENT API & OPERATIONS VERIFICATION ===\n');
  let testsPassed = 0;
  let testsFailed = 0;

  function assert(condition: boolean, testName: string, detail?: any) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      testsPassed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`, detail || '');
      testsFailed++;
    }
  }

  const prisma = new PrismaClient();

  try {
    // 1. Authenticate / Login as Super Admin or simulate JWT
    console.log('--- 1. Testing Super Admin User Access ---');
    const superAdmin = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN', deletedAt: null }
    });

    assert(Boolean(superAdmin), 'Super Admin user exists in database', superAdmin?.email);

    const token = jwt.sign(
      { id: superAdmin!.id, role: superAdmin!.role, email: superAdmin!.email, name: superAdmin!.name },
      process.env.JWT_SECRET || 'mts-lab-super-secret-key',
      { expiresIn: '1h' }
    );

    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    // 2. Test GET /api/users (Super Admin)
    console.log('\n--- 2. Testing GET /api/users ---');
    const getRes = await fetch(`${BASE_URL}/users`, { headers: authHeaders });
    const users: any = await getRes.json();
    assert(getRes.status === 200, 'GET /api/users returns HTTP 200');
    assert(Array.isArray(users), 'GET /api/users returns an array of staff');
    assert(users.length > 0, `Staff directory contains ${users.length} members`);
    
    // Verify optional fields safe projection
    const firstUser = users[0];
    assert(firstUser.hasOwnProperty('accountStatus'), 'User projection includes accountStatus');
    assert(firstUser.hasOwnProperty('twoFactorEnabled'), 'User projection includes twoFactorEnabled');
    console.log(`Sample Staff Record: ${firstUser.name} (${firstUser.role}) - 2FA: ${firstUser.twoFactorEnabled}, Status: ${firstUser.accountStatus}`);

    // 3. Test POST /api/users (Add New Staff Member)
    console.log('\n--- 3. Testing POST /api/users (Create Staff) ---');
    const testUsername = `test_tech_${Date.now()}`;
    const testEmail = `tech_${Date.now()}@mtslab.com`;
    const newStaffPayload = {
      name: 'Rohan Sharma Test Tech',
      username: testUsername,
      email: testEmail,
      password: 'password123',
      role: 'TECHNICIAN',
      phoneNumber: '9841000001',
      department: 'Display & OCA Lamination',
      address: 'Kathmandu, New Road',
      isActive: true,
      twoFactorEnabled: true
    };

    const createRes = await fetch(`${BASE_URL}/users`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(newStaffPayload)
    });
    const createdUser: any = await createRes.json();
    assert(createRes.status === 200 || createRes.status === 201, 'POST /api/users creates staff successfully');
    assert(Boolean(createdUser?.id), 'Created staff member has valid ID', createdUser?.id);
    assert(createdUser?.email === testEmail, 'Created staff member email matches');

    const createdId = createdUser?.id;

    // 4. Test PATCH /api/users/:id (Edit Profile)
    console.log('\n--- 4. Testing PATCH /api/users/:id (Edit Staff Profile) ---');
    const updatePayload = {
      name: 'Rohan Sharma (Lead Specialist)',
      department: 'Advanced Board Repair',
      phoneNumber: '9841999999'
    };
    const updateRes = await fetch(`${BASE_URL}/users/${createdId}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify(updatePayload)
    });
    const updatedUser: any = await updateRes.json();
    assert(updateRes.status === 200, 'PATCH /api/users/:id returns HTTP 200');
    assert(updatedUser?.name === 'Rohan Sharma (Lead Specialist)', 'Staff name updated correctly');
    assert(updatedUser?.department === 'Advanced Board Repair', 'Staff department updated correctly');

    // 5. Test PATCH /api/users/:id/2fa (Toggle 2FA Disable)
    console.log('\n--- 5. Testing 2FA Disable ---');
    const disable2FARes = await fetch(`${BASE_URL}/users/${createdId}/2fa`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ twoFactorEnabled: false })
    });
    const disable2FAData: any = await disable2FARes.json();
    assert(disable2FARes.status === 200, 'Disable 2FA returns HTTP 200');
    assert(disable2FAData?.twoFactorEnabled === false, '2FA successfully set to false');

    // 6. Test PATCH /api/users/:id/2fa (Toggle 2FA Enable)
    console.log('\n--- 6. Testing 2FA Enable ---');
    const enable2FARes = await fetch(`${BASE_URL}/users/${createdId}/2fa`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ twoFactorEnabled: true })
    });
    const enable2FAData: any = await enable2FARes.json();
    assert(enable2FARes.status === 200, 'Enable 2FA returns HTTP 200');
    assert(enable2FAData?.twoFactorEnabled === true, '2FA successfully set to true');

    // 7. Test PATCH /api/users/:id (Change Role & Reset Password)
    console.log('\n--- 7. Testing Role Change & Password Reset ---');
    const roleRes = await fetch(`${BASE_URL}/users/${createdId}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ role: 'LEAD_TECHNICIAN', password: 'newPassword456' })
    });
    const roleData: any = await roleRes.json();
    assert(roleRes.status === 200, 'Role change & password update returns HTTP 200');
    assert(roleData?.role === 'LEAD_TECHNICIAN', 'Role updated to LEAD_TECHNICIAN');

    // 8. Test Toggle Status (Deactivate / Activate Account)
    console.log('\n--- 8. Testing Account Status Deactivation & Activation ---');
    const deactRes = await fetch(`${BASE_URL}/users/${createdId}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ isActive: false, accountStatus: 'DISABLED' })
    });
    const deactData: any = await deactRes.json();
    assert(deactRes.status === 200, 'Deactivate account returns HTTP 200');
    assert(deactData?.isActive === false && deactData?.accountStatus === 'DISABLED', 'Account deactivated');

    const actRes = await fetch(`${BASE_URL}/users/${createdId}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ isActive: true, accountStatus: 'ACTIVE' })
    });
    const actData: any = await actRes.json();
    assert(actRes.status === 200, 'Activate account returns HTTP 200');
    assert(actData?.isActive === true && actData?.accountStatus === 'ACTIVE', 'Account activated');

    // 9. Test Unauthorized Access Guard (Technician token attempting /api/users)
    console.log('\n--- 9. Testing Unauthorized Access Enforcement ---');
    const techToken = jwt.sign(
      { id: createdId, role: 'TECHNICIAN', email: testEmail, name: 'Tech User' },
      process.env.JWT_SECRET || 'mts-lab-super-secret-key',
      { expiresIn: '1h' }
    );
    const unauthorizedRes = await fetch(`${BASE_URL}/users`, {
      headers: { 'Authorization': `Bearer ${techToken}` }
    });
    assert(unauthorizedRes.status === 403, 'Unauthorized role is strictly rejected with HTTP 403 Forbidden');

    // 10. Test DELETE /api/users/:id (Delete Staff Member)
    console.log('\n--- 10. Testing DELETE /api/users/:id ---');
    const deleteRes = await fetch(`${BASE_URL}/users/${createdId}`, {
      method: 'DELETE',
      headers: authHeaders
    });
    const deleteData: any = await deleteRes.json();
    assert(deleteRes.status === 200, 'DELETE /api/users/:id returns HTTP 200');
    assert(deleteData?.message === 'Staff member deleted successfully', 'Staff member deleted successfully');

    // Verify user no longer returned in GET /api/users
    const getAfterDeleteRes = await fetch(`${BASE_URL}/users`, { headers: authHeaders });
    const usersAfterDelete: any = await getAfterDeleteRes.json();
    const foundDeleted = usersAfterDelete.find((u: any) => u.id === createdId);
    assert(!foundDeleted, 'Deleted user is excluded from staff directory listing');

    // 11. Test Public / General Staff endpoint GET /api/staff
    console.log('\n--- 11. Testing GET /api/staff (Accessible to Authenticated Staff) ---');
    const staffListRes = await fetch(`${BASE_URL}/staff`, { headers: authHeaders });
    const staffList: any = await staffListRes.json();
    assert(staffListRes.status === 200, 'GET /api/staff returns HTTP 200');
    assert(Array.isArray(staffList), 'GET /api/staff returns staff array');

    await prisma.$disconnect();

    console.log('\n========================================');
    console.log(`VERIFICATION COMPLETE: ${testsPassed} passed, ${testsFailed} failed`);
    console.log('========================================');

    if (testsFailed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal error during verification:', err);
    await prisma.$disconnect();
    process.exit(1);
  }
}

runTests();
