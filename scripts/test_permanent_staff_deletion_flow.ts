import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:3000';

const timestamp = Date.now();
const testStaffList = [
  { email: `del.admin.${timestamp}@mtslab.com`, role: 'ADMIN', name: 'Delete Admin Test' },
  { email: `del.manager.${timestamp}@mtslab.com`, role: 'MANAGER', name: 'Delete Manager Test' },
  { email: `del.headtech.${timestamp}@mtslab.com`, role: 'HEAD_TECHNICIAN', name: 'Delete HeadTech Test' },
  { email: `del.tech.${timestamp}@mtslab.com`, role: 'TECHNICIAN', name: 'Delete Tech Test' },
  { email: `del.receptionist.${timestamp}@mtslab.com`, role: 'RECEPTIONIST', name: 'Delete Receptionist Test' },
];

const superAdminEmail = 'mtsmobilelab@gmail.com';
const testPassword = 'Password123!Safe';

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passCount++;
    console.log(`  ✓ PASS [Test ${passCount}]: ${message}`);
  } else {
    failCount++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

async function runStaffDeletionTestSuite() {
  console.log('\n================================================================================');
  console.log('MTS LAB — PERMANENT STAFF DELETION E2E VERIFICATION TEST SUITE');
  console.log('================================================================================\n');

  // 1. Setup SuperAdmin credentials
  const passwordHash = await bcrypt.hash(testPassword, 10);
  let superAdmin = await prisma.user.findFirst({
    where: { email: superAdminEmail }
  });

  if (!superAdmin) {
    superAdmin = await prisma.user.create({
      data: {
        email: superAdminEmail,
        password: passwordHash,
        name: 'Super Administrator',
        role: 'SUPERADMIN',
        isActive: true,
        emailVerified: true,
        accountStatus: 'ACTIVE'
      }
    });
  } else {
    await prisma.user.update({
      where: { id: superAdmin.id },
      data: { password: passwordHash, emailVerified: true, isActive: true, role: 'SUPERADMIN' }
    });
  }

  // 2. SuperAdmin Login
  console.log('--- STEP 1: SUPERADMIN AUTHENTICATION ---');
  const saLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: superAdminEmail, password: testPassword })
  });
  const saLoginData = await saLoginRes.json();
  assert(saLoginRes.status === 200, 'SuperAdmin login returns HTTP 200');
  assert(Boolean(saLoginData.token), 'SuperAdmin receives valid JWT');
  const saToken = saLoginData.token;

  // 3. Create Disposable Staff Members across all roles
  console.log('\n--- STEP 2: CREATE DISPOSABLE TEST STAFF MEMBERS ---');
  const createdUsers: any[] = [];
  for (const staff of testStaffList) {
    const user = await prisma.user.create({
      data: {
        email: staff.email,
        password: passwordHash,
        name: staff.name,
        role: staff.role,
        isActive: true,
        emailVerified: true,
        accountStatus: 'ACTIVE'
      }
    });
    createdUsers.push(user);
    assert(Boolean(user.id), `Created disposable staff ${staff.email} with role ${staff.role}`);
  }

  // 4. Staff Login & Active Session Creation
  console.log('\n--- STEP 3: LOG IN TEST STAFF MEMBERS TO ESTABLISH SESSIONS ---');
  const staffTokens: Record<string, string> = {};
  for (const staff of createdUsers) {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: staff.email, password: testPassword })
    });
    const data = await res.json();
    assert(res.status === 200, `Login succeeded for ${staff.role} (${staff.email})`);
    assert(Boolean(data.token), `JWT issued for ${staff.role}`);
    staffTokens[staff.id] = data.token;
  }

  // 5. Test Non-SuperAdmin Deletion Attempt (RBAC 403)
  console.log('\n--- STEP 4: RBAC AUTHORIZATION CHECKS (UNAUTHORIZED ROLES BLOCKED) ---');
  const techUser = createdUsers.find(u => u.role === 'TECHNICIAN');
  const adminUser = createdUsers.find(u => u.role === 'ADMIN');
  const managerUser = createdUsers.find(u => u.role === 'MANAGER');
  const targetToDelete = createdUsers.find(u => u.role === 'RECEPTIONIST');

  const techDeleteRes = await fetch(`${BASE_URL}/api/users/${targetToDelete.id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${staffTokens[techUser.id]}` }
  });
  assert(techDeleteRes.status === 403, 'Technician attempt to DELETE staff is blocked with HTTP 403 Forbidden');

  const adminDeleteRes = await fetch(`${BASE_URL}/api/users/${targetToDelete.id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${staffTokens[adminUser.id]}` }
  });
  assert(adminDeleteRes.status === 403, 'Regular Admin attempt to DELETE staff is blocked with HTTP 403 Forbidden');

  const managerBulkDeleteRes = await fetch(`${BASE_URL}/api/admin/users/bulk-delete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${staffTokens[managerUser.id]}`
    },
    body: JSON.stringify({ userIds: [targetToDelete.id] })
  });
  assert(managerBulkDeleteRes.status === 403, 'Manager attempt to bulk-delete staff is blocked with HTTP 403 Forbidden');

  // Verify target is still intact in DB
  const stillInDb = await prisma.user.findUnique({ where: { id: targetToDelete.id } });
  assert(stillInDb !== null, 'Target user remains completely intact in database after rejected unauthorized requests');

  // 6. Test Self-Deletion Prevention
  console.log('\n--- STEP 5: PREVENT ACCIDENTAL SELF-DELETION OF SUPERADMIN ---');
  const saSelfDeleteRes = await fetch(`${BASE_URL}/api/users/${superAdmin.id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${saToken}` }
  });
  assert(saSelfDeleteRes.status === 400, 'SuperAdmin self-deletion attempt is blocked with HTTP 400 Bad Request');
  const saSelfDeleteData = await saSelfDeleteRes.json();
  assert(saSelfDeleteData.error?.includes('own account') || saSelfDeleteData.message?.includes('own account'), 'Response explains self-deletion is disallowed');

  // 7. Associate Business & Historical Records to Test Safe Reassignment
  console.log('\n--- STEP 6: CREATE ASSOCIATED BUSINESS RECORDS (REPAIRS, ATTENDANCE, SESSIONS) ---');
  const testBranch = await prisma.branch.findFirst() || await prisma.branch.create({
    data: { name: 'Main Lab Branch', location: 'Kathmandu', phone: '01-4444444' }
  });

  const testRepair = await prisma.repair.create({
    data: {
      repairNumber: `REP-DEL-TEST-${timestamp}`,
      customerName: 'Customer Test',
      customerPhone: '9800000000',
      deviceBrand: 'Apple',
      deviceModel: 'iPhone 15 Pro',
      deviceCondition: 'Cracked screen',
      problemDescription: 'Screen replacement',
      branchId: testBranch.id,
      createdById: targetToDelete.id,
      technicianId: targetToDelete.id,
      status: 'IN_PROGRESS'
    }
  });
  assert(Boolean(testRepair.id), 'Created business repair record created by and assigned to target staff');

  // 8. SuperAdmin Permanently Deletes Staff User
  console.log('\n--- STEP 7: SUPERADMIN PERMANENTLY DELETES STAFF MEMBER ---');
  const deleteRes = await fetch(`${BASE_URL}/api/users/${targetToDelete.id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${saToken}` }
  });
  const deleteData = await deleteRes.json();

  assert(deleteRes.status === 200, 'SuperAdmin DELETE request returns HTTP 200 OK');
  assert(deleteData.success === true, 'Response specifies success: true');
  assert(deleteData.deleted === true, 'Response specifies deleted: true');
  assert(deleteData.userId === targetToDelete.id, 'Response specifies target userId');
  assert(deleteData.message === 'Staff member permanently deleted successfully', 'Response message is clear and accurate');

  // 9. Database Verification
  console.log('\n--- STEP 8: DATABASE PURGE & HISTORICAL DATA SAFETY VERIFICATION ---');
  const userCheck = await prisma.user.findUnique({ where: { id: targetToDelete.id } });
  assert(userCheck === null, 'User record is completely absent from database (permanently deleted)');

  const sessionsCheck = await prisma.session.findMany({ where: { userId: targetToDelete.id } });
  assert(sessionsCheck.length === 0, 'All active sessions for deleted user are completely invalidated and removed');

  const repairAfterDelete = await prisma.repair.findUnique({ where: { id: testRepair.id } });
  assert(repairAfterDelete !== null, 'Historical repair ticket was NOT deleted (preserved)');
  assert(repairAfterDelete?.createdById !== targetToDelete.id, 'Repair createdById reassigned to SuperAdmin');
  assert(repairAfterDelete?.technicianId === null, 'Repair technicianId unlinked to null');

  // Clean up test repair
  await prisma.repair.delete({ where: { id: testRepair.id } });

  // 10. Session Invalidation & Re-login Attempt for Deleted Staff
  console.log('\n--- STEP 9: DELETED STAFF SESSION INVALIDATION & LOGIN BLOCK ---');
  const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { 'Authorization': `Bearer ${staffTokens[targetToDelete.id]}` }
  });
  assert(meRes.status === 401 || meRes.status === 404, 'Pre-existing JWT for deleted staff is rejected immediately (401/404)');

  const reloginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: targetToDelete.email, password: testPassword })
  });
  assert(reloginRes.status === 401 || reloginRes.status === 404, 'Deleted user cannot log in again');

  // 11. Test Second Deletion (Delete Twice)
  console.log('\n--- STEP 10: SECOND DELETION ATTEMPT (SAFE 404 ERROR HANDLING) ---');
  const secondDeleteRes = await fetch(`${BASE_URL}/api/users/${targetToDelete.id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${saToken}` }
  });
  const secondDeleteData = await secondDeleteRes.json();
  assert(secondDeleteRes.status === 404, 'Second deletion of already deleted user returns controlled HTTP 404 Not Found');
  assert(secondDeleteData.success === false, 'Second deletion specifies success: false');
  assert(secondDeleteData.deleted === false, 'Second deletion specifies deleted: false');

  // 12. Test Bulk Staff Deletion
  console.log('\n--- STEP 11: BULK PERMANENT DELETION TEST ---');
  const remainingStaff = createdUsers.filter(u => u.id !== targetToDelete.id);
  const remainingIds = remainingStaff.map(u => u.id);

  const bulkDeleteRes = await fetch(`${BASE_URL}/api/admin/users/bulk-delete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${saToken}`
    },
    body: JSON.stringify({ userIds: remainingIds })
  });
  const bulkDeleteData = await bulkDeleteRes.json();

  assert(bulkDeleteRes.status === 200, 'SuperAdmin bulk-delete returns HTTP 200 OK');
  assert(bulkDeleteData.success === true, 'Bulk delete specifies success: true');
  assert(bulkDeleteData.deleted === true, 'Bulk delete specifies deleted: true');
  assert(bulkDeleteData.deletedCount === remainingIds.length, `Bulk delete permanently removed ${remainingIds.length} staff records`);

  for (const staff of remainingStaff) {
    const check = await prisma.user.findUnique({ where: { id: staff.id } });
    assert(check === null, `Staff user ${staff.email} (${staff.role}) permanently removed from database`);
  }

  // 13. Test Directory Listing & Absence of Deleted Accounts
  console.log('\n--- STEP 12: STAFF DIRECTORY VERIFICATION ---');
  const listRes = await fetch(`${BASE_URL}/api/users`, {
    headers: { 'Authorization': `Bearer ${saToken}` }
  });
  const listData = await listRes.json();
  assert(listRes.status === 200, 'Staff directory returned HTTP 200');
  const returnedEmails = listData.map((u: any) => u.email.toLowerCase());
  for (const staff of testStaffList) {
    assert(!returnedEmails.includes(staff.email.toLowerCase()), `Deleted staff ${staff.email} is completely absent from staff directory`);
  }

  console.log('\n================================================================================');
  if (failCount === 0) {
    console.log(`ALL PERMANENT STAFF DELETION TESTS PASSED: ${passCount}/${passCount} (100%)`);
  } else {
    console.error(`SOME TESTS FAILED: ${failCount} failed, ${passCount} passed`);
  }
  console.log('================================================================================\n');

  await prisma.$disconnect();
  if (failCount > 0) process.exit(1);
}

runStaffDeletionTestSuite().catch((err) => {
  console.error('[TEST SUITE ERROR]', err);
  process.exit(1);
});
