import { PrismaClient } from '@prisma/client';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'mts-lab-super-secret-jwt-key-for-development-2026';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    throw new Error(`Test Assertion Failed: ${message}`);
  }
}

async function runStaffManagementComprehensiveTests() {
  console.log('================================================================');
  console.log('🧪 MTS LAB — STAFF MANAGEMENT COMPREHENSIVE E2E TEST SUITE');
  console.log('================================================================\n');

  // 1. Authenticate Super Admin
  console.log('🔑 Step 1: Authenticating Super Admin...');
  let superAdmin = await prisma.user.findFirst({
    where: {
      email: 'mtsmobilelab@gmail.com',
      role: { in: ['SUPER_ADMIN', 'SUPERADMIN'] },
      deletedAt: null
    }
  });

  if (!superAdmin) {
    const hashedPassword = await bcrypt.hash('Admin@123456', 10);
    superAdmin = await prisma.user.create({
      data: {
        email: 'mtsmobilelab@gmail.com',
        name: 'MTS Super Admin',
        role: 'SUPER_ADMIN',
        password: hashedPassword,
        accountStatus: 'ACTIVE',
        isActive: true,
        emailVerified: true
      }
    });
  }

  // Ensure active session for superAdmin
  await prisma.session.deleteMany({ where: { userId: superAdmin.id } });
  await prisma.session.create({
    data: {
      userId: superAdmin.id,
      refreshToken: `refresh_${superAdmin.id}_${Date.now()}`,
      lastActiveAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    }
  });

  const superAdminToken = jwt.default.sign(
    { id: superAdmin.id, email: superAdmin.email, role: 'SUPER_ADMIN', name: superAdmin.name },
    JWT_SECRET,
    { expiresIn: '1d' }
  );
  assert(Boolean(superAdminToken), 'SuperAdmin JWT token generated successfully');

  // 2. Staff Creation across all 6 Roles
  console.log('\n👥 Step 2: Creating Staff Accounts Across All 6 Roles...');
  const testTimestamp = Date.now();
  const allRoles = ['SUPERADMIN', 'ADMIN', 'MANAGER', 'HEAD_TECHNICIAN', 'TECHNICIAN', 'RECEPTIONIST'] as const;
  const createdStaffIds: Record<string, string> = {};

  for (const targetRole of allRoles) {
    const testEmail = `sync.staff.${targetRole.toLowerCase()}.${testTimestamp}@mtslab.com`;
    const testPassword = 'MtsLab@2026SecurePass!';
    const testName = `Test ${targetRole.replace(/_/g, ' ')}`;

    const createRes = await fetch(`${BASE_URL}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${superAdminToken}`
      },
      body: JSON.stringify({
        name: testName,
        email: testEmail,
        password: testPassword,
        role: targetRole,
        phoneNumber: '9841000000',
        department: 'Operations',
        address: 'Kathmandu, Nepal'
      })
    });

    assert(createRes.status === 201, `POST /api/users created staff with role ${targetRole} (HTTP 201)`);
    const createData = await createRes.json();
    assert(createData.id, `Created staff response returned unique ID (${createData.id})`);
    assert(createData.email === testEmail, `Created staff response returned correct email`);

    createdStaffIds[targetRole] = createData.id;

    // Direct database verification
    const dbUser = await prisma.user.findUnique({
      where: { id: createData.id }
    });
    assert(Boolean(dbUser), `Staff record persisted in database for role ${targetRole}`);
    assert(dbUser?.role === targetRole, `Authoritative DB role matches assigned role ${targetRole}`);
    assert(dbUser?.accountStatus === 'ACTIVE', `Staff accountStatus is ACTIVE in database`);
    assert(dbUser?.isActive === true, `Staff isActive is true in database`);
    assert(Boolean(dbUser?.firebaseUid), `Staff has valid linked firebaseUid in database`);
  }

  // 3. Staff Listing & Directory Retrieval
  console.log('\n📋 Step 3: Verifying Staff Directory & List (GET /api/users)...');
  const listRes = await fetch(`${BASE_URL}/api/users`, {
    headers: { 'Authorization': `Bearer ${superAdminToken}` }
  });
  assert(listRes.ok, 'GET /api/users returned HTTP 200');
  const userList = await listRes.json();
  assert(Array.isArray(userList), 'GET /api/users returned an array of users');

  for (const targetRole of allRoles) {
    const staffId = createdStaffIds[targetRole];
    const found = userList.find((u: any) => u.id === staffId);
    assert(Boolean(found), `Created staff ${targetRole} is present in staff directory list`);
    assert(found?.role === targetRole, `Role in staff directory list matches ${targetRole}`);
  }

  // 4. Staff Profile Update
  console.log('\n✏️ Step 4: Testing Staff Profile Updates (PATCH /api/users/:id)...');
  const techId = createdStaffIds['TECHNICIAN'];
  const updateRes = await fetch(`${BASE_URL}/api/users/${techId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${superAdminToken}`
    },
    body: JSON.stringify({
      name: 'Updated Lead Tech Name',
      phoneNumber: '9841999999',
      department: 'Senior Hardware Diagnostics',
      address: 'Patan, Lalitpur'
    })
  });
  assert(updateRes.ok, 'PATCH /api/users/:id returned HTTP 200');
  const updateData = await updateRes.json();
  assert(updateData.success === true, 'Update response confirmed success: true');

  const dbTechAfterUpdate = await prisma.user.findUnique({ where: { id: techId } });
  assert(dbTechAfterUpdate?.name === 'Updated Lead Tech Name', 'Updated name persisted in database');
  assert(dbTechAfterUpdate?.phoneNumber === '9841999999', 'Updated phone persisted in database');
  assert(dbTechAfterUpdate?.department === 'Senior Hardware Diagnostics', 'Updated department persisted in database');
  assert(dbTechAfterUpdate?.address === 'Patan, Lalitpur', 'Updated address persisted in database');

  // 5. Role Modification & Session Invalidation
  console.log('\n🔄 Step 5: Testing Dedicated Role Modification (PATCH /api/users/:id/role)...');
  const roleChangeRes = await fetch(`${BASE_URL}/api/users/${techId}/role`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${superAdminToken}`
    },
    body: JSON.stringify({ role: 'HEAD_TECHNICIAN' })
  });
  assert(roleChangeRes.ok, 'PATCH /api/users/:id/role returned HTTP 200');

  const dbUserAfterRoleChange = await prisma.user.findUnique({ where: { id: techId } });
  assert(dbUserAfterRoleChange?.role === 'HEAD_TECHNICIAN', 'Role permanently updated to HEAD_TECHNICIAN in database');

  // 6. Account Status Toggling (Deactivation / Reactivation)
  console.log('\n🔒 Step 6: Testing Account Status Toggling & Inactive Account Enforcement...');
  const deactivateRes = await fetch(`${BASE_URL}/api/users/${techId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${superAdminToken}`
    },
    body: JSON.stringify({
      isActive: false,
      accountStatus: 'DISABLED'
    })
  });
  assert(deactivateRes.ok, 'Deactivating user returned HTTP 200');

  const dbDeactivatedUser = await prisma.user.findUnique({ where: { id: techId } });
  assert(dbDeactivatedUser?.isActive === false, 'isActive marked false in DB');
  assert(dbDeactivatedUser?.accountStatus === 'DISABLED', 'accountStatus marked DISABLED in DB');

  // Attempt login with deactivated user
  const loginDeactivatedRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: dbDeactivatedUser?.email,
      password: 'MtsLab@2026SecurePass!'
    })
  });
  assert(loginDeactivatedRes.status === 403, 'Login correctly blocked for deactivated account (HTTP 403)');

  // Reactivate user
  const reactivateRes = await fetch(`${BASE_URL}/api/users/${techId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${superAdminToken}`
    },
    body: JSON.stringify({
      isActive: true,
      accountStatus: 'ACTIVE'
    })
  });
  assert(reactivateRes.ok, 'Reactivating user returned HTTP 200');

  const dbReactivatedUser = await prisma.user.findUnique({ where: { id: techId } });
  assert(dbReactivatedUser?.isActive === true, 'isActive restored to true in DB');
  assert(dbReactivatedUser?.accountStatus === 'ACTIVE', 'accountStatus restored to ACTIVE in DB');

  // 7. RBAC Protection Checks for Non-SuperAdmin Roles
  console.log('\n🛡️ Step 7: Testing RBAC Protection (Unauthorized Roles Blocked)...');
  const nonAdminRoles = ['ADMIN', 'MANAGER', 'TECHNICIAN', 'RECEPTIONIST'] as const;
  for (const r of nonAdminRoles) {
    const staffId = createdStaffIds[r];
    const staffUser = await prisma.user.findUnique({ where: { id: staffId } });

    // Establish active session
    await prisma.session.create({
      data: {
        userId: staffId,
        refreshToken: `refresh_${staffId}_${Date.now()}`,
        lastActiveAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }
    });

    const staffToken = jwt.default.sign(
      { id: staffId, email: staffUser?.email, role: r, name: staffUser?.name },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    // Attempt to create a new staff account
    const unauthCreateRes = await fetch(`${BASE_URL}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${staffToken}`
      },
      body: JSON.stringify({
        name: 'Hacker Staff',
        email: `hacker.${r.toLowerCase()}@mtslab.com`,
        password: 'Password123!',
        role: 'SUPER_ADMIN'
      })
    });
    assert(unauthCreateRes.status === 403, `Role ${r} blocked from creating staff accounts (HTTP 403)`);

    // Attempt to change role
    const unauthRoleRes = await fetch(`${BASE_URL}/api/users/${techId}/role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${staffToken}`
      },
      body: JSON.stringify({ role: 'SUPER_ADMIN' })
    });
    assert(unauthRoleRes.status === 403, `Role ${r} blocked from changing staff roles (HTTP 403)`);

    // Attempt to delete staff
    const unauthDeleteRes = await fetch(`${BASE_URL}/api/users/${techId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${staffToken}` }
    });
    assert(unauthDeleteRes.status === 403, `Role ${r} blocked from deleting staff accounts (HTTP 403)`);
  }

  // 8. SuperAdmin Permanent Deletion & Historical Business Integrity
  console.log('\n🗑️ Step 8: Testing Permanent Deletion (DELETE /api/users/:id)...');
  const targetDeleteId = createdStaffIds['RECEPTIONIST'];
  const targetUser = await prisma.user.findUnique({ where: { id: targetDeleteId } });

  // Create a business repair ticket linked to this target receptionist
  const defaultBranch = await prisma.branch.findFirst();
  const testRepair = await prisma.repair.create({
    data: {
      repairNumber: `REP-SYNC-${Date.now().toString().slice(-6)}`,
      customerName: 'Sync Test Customer',
      customerPhone: '9841223344',
      deviceBrand: 'Apple',
      deviceModel: 'iPhone 15 Pro',
      deviceCondition: 'Minor scratches',
      problemDescription: 'Battery failure',
      status: 'PENDING',
      createdById: targetDeleteId,
      branchId: defaultBranch ? defaultBranch.id : null
    }
  });

  const singleDeleteRes = await fetch(`${BASE_URL}/api/users/${targetDeleteId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${superAdminToken}` }
  });
  assert(singleDeleteRes.ok, 'DELETE /api/users/:id returned HTTP 200');
  const singleDeleteData = await singleDeleteRes.json();
  assert(singleDeleteData.success === true, 'Response confirms success: true');
  assert(singleDeleteData.deleted === true, 'Response confirms deleted: true');

  // Verify DB record is gone
  const dbDeletedUser = await prisma.user.findUnique({ where: { id: targetDeleteId } });
  assert(dbDeletedUser === null, 'Target user row is completely purged from database');

  // Verify historical repair ticket was preserved and creator reassigned
  const preservedRepair = await prisma.repair.findUnique({ where: { id: testRepair.id } });
  assert(Boolean(preservedRepair), 'Historical repair ticket was NOT deleted (preserved)');
  assert(preservedRepair?.createdById === superAdmin.id, 'Historical repair createdById safely reassigned to SuperAdmin');

  // Cleanup repair
  await prisma.repair.delete({ where: { id: testRepair.id } }).catch(() => {});

  // 9. Bulk Permanent Deletion
  console.log('\n📦 Step 9: Testing Bulk Permanent Deletion (POST /api/admin/users/bulk-delete)...');
  const remainingIds = Object.values(createdStaffIds).filter(id => id !== targetDeleteId);

  const bulkDeleteRes = await fetch(`${BASE_URL}/api/admin/users/bulk-delete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${superAdminToken}`
    },
    body: JSON.stringify({ userIds: remainingIds })
  });
  assert(bulkDeleteRes.ok, 'POST /api/admin/users/bulk-delete returned HTTP 200');
  const bulkDeleteData = await bulkDeleteRes.json();
  assert(bulkDeleteData.success === true, 'Bulk delete response confirms success: true');

  for (const id of remainingIds) {
    const dbCheck = await prisma.user.findUnique({ where: { id } });
    assert(dbCheck === null, `Bulk deleted user ${id} permanently removed from database`);
  }

  // 10. Staff Directory Cleanliness
  console.log('\n✨ Step 10: Verifying Staff Directory Cleanliness After Deletions...');
  const finalListRes = await fetch(`${BASE_URL}/api/users`, {
    headers: { 'Authorization': `Bearer ${superAdminToken}` }
  });
  const finalList = await finalListRes.json();
  for (const id of Object.values(createdStaffIds)) {
    const foundInFinal = finalList.find((u: any) => u.id === id);
    assert(!foundInFinal, `Deleted staff account ${id} is completely absent from staff directory`);
  }

  console.log('\n================================================================');
  console.log(`📊 FINAL RESULT: ${passedTests} / ${totalTests} TESTS PASSED (100%)`);
  console.log('================================================================\n');
  console.log('🎉 ALL STAFF MANAGEMENT SYNCHRONIZATION VERIFICATIONS PASSED SUCCESSFULLY!');
}

runStaffManagementComprehensiveTests()
  .catch(err => {
    console.error('\nFatal Test Runner Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
