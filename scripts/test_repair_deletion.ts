import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const BASE_URL = 'http://localhost:3000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'mts-lab-super-secret-key';

async function runTests() {
  console.log('=== STARTING BULK & SELECTIVE REPAIR DELETION VERIFICATION ===\n');
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
    // 1. Prepare Auth Tokens for different roles
    console.log('--- 1. Generating Test Tokens for Role Authorization Checks ---');
    
    // Super Admin
    let superAdmin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN', deletedAt: null } });
    if (!superAdmin) {
      superAdmin = await prisma.user.create({
        data: {
          email: 'test_superadmin@mtslab.com',
          name: 'Test Super Admin',
          role: 'SUPER_ADMIN',
          password: 'testpassword123'
        }
      });
    }
    const superAdminToken = jwt.sign(
      { id: superAdmin.id, role: 'SUPER_ADMIN', email: superAdmin.email, name: superAdmin.name },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Admin
    let admin = await prisma.user.findFirst({ where: { role: 'ADMIN', deletedAt: null } });
    if (!admin) {
      admin = await prisma.user.create({
        data: {
          email: 'test_admin@mtslab.com',
          name: 'Test Admin',
          role: 'ADMIN',
          password: 'testpassword123'
        }
      });
    }
    const adminToken = jwt.sign(
      { id: admin.id, role: 'ADMIN', email: admin.email, name: admin.name },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Receptionist
    let receptionist = await prisma.user.findFirst({ where: { role: 'RECEPTIONIST', deletedAt: null } });
    if (!receptionist) {
      receptionist = await prisma.user.create({
        data: {
          email: 'test_receptionist@mtslab.com',
          name: 'Test Receptionist',
          role: 'RECEPTIONIST',
          password: 'testpassword123'
        }
      });
    }
    const receptionistToken = jwt.sign(
      { id: receptionist.id, role: 'RECEPTIONIST', email: receptionist.email, name: receptionist.name },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Technician
    let technician = await prisma.user.findFirst({ where: { role: 'TECHNICIAN', deletedAt: null } });
    if (!technician) {
      technician = await prisma.user.create({
        data: {
          email: 'test_technician@mtslab.com',
          name: 'Test Technician',
          role: 'TECHNICIAN',
          password: 'testpassword123'
        }
      });
    }
    const technicianToken = jwt.sign(
      { id: technician.id, role: 'TECHNICIAN', email: technician.email, name: technician.name },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Customer
    let customerUser = await prisma.user.findFirst({ where: { role: 'CUSTOMER', deletedAt: null } });
    if (!customerUser) {
      customerUser = await prisma.user.create({
        data: {
          email: 'test_customer@mtslab.com',
          name: 'Test Customer User',
          role: 'CUSTOMER',
          password: 'testpassword123'
        }
      });
    }
    const customerToken = jwt.sign(
      { id: customerUser.id, role: 'CUSTOMER', email: customerUser.email, name: customerUser.name },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    assert(Boolean(superAdminToken), 'Super Admin token generated');
    assert(Boolean(adminToken), 'Admin token generated');
    assert(Boolean(receptionistToken), 'Receptionist token generated');
    assert(Boolean(technicianToken), 'Technician token generated');
    assert(Boolean(customerToken), 'Customer token generated');

    // Create a customer for test repairs
    // Default branch
    let defaultBranch = await prisma.branch.findFirst();
    if (!defaultBranch) {
      defaultBranch = await prisma.branch.create({
        data: {
          name: "Kathmandu Central Hub",
          location: "New Road, Kathmandu",
          phone: "+977-01-4220000"
        }
      });
    }

    let testCustomer = await prisma.customer.findFirst({ where: { phone: '9800000099' } });
    if (!testCustomer) {
      testCustomer = await prisma.customer.create({
        data: {
          customerId: `CUST-${Date.now().toString().slice(-4)}`,
          name: 'Test Deletion Customer',
          phone: '9800000099',
          email: 'cust_delete_test@gmail.com',
          address: 'Kathmandu'
        }
      });
    }

    // Helper to create a complete repair with logs, notes, payments
    async function createTestRepair(prefix: string) {
      const repair = await prisma.repair.create({
        data: {
          repairNumber: `TEST-${prefix}-${Date.now().toString().slice(-4)}`,
          customerId: testCustomer!.id,
          customerName: testCustomer!.name,
          customerPhone: testCustomer!.phone,
          customerEmail: testCustomer!.email,
          deviceBrand: 'Apple',
          deviceModel: 'iPhone 15 Pro',
          problemDescription: `Test repair for deletion ${prefix}`,
          deviceCondition: 'Minor scratches, good condition',
          estimatedCost: 15000,
          status: 'RECEIVED',
          branchId: defaultBranch!.id,
          createdById: receptionist!.id
        }
      });

      // Add related entities
      await prisma.repairLog.create({
        data: {
          repairId: repair.id,
          status: 'RECEIVED',
          message: 'Initial intake log entry'
        }
      });

      await prisma.technicianNote.create({
        data: {
          repairId: repair.id,
          technicianId: technician!.id,
          note: 'Technician inspection note'
        }
      });

      await prisma.payment.create({
        data: {
          repairId: repair.id,
          amount: 5000,
          method: 'CASH'
        }
      });

      await prisma.notification.create({
        data: {
          userId: superAdmin!.id,
          repairId: repair.id,
          title: 'Test Notification',
          message: 'Repair created'
        }
      });

      return repair;
    }

    // --- 2. Security Role Checks (Blocked Roles) ---
    console.log('\n--- 2. Security Role Checks: Blocked Roles Must Receive 403 Forbidden ---');

    const repBlocked1 = await createTestRepair('BLOCKED_TECH');
    const repBlocked2 = await createTestRepair('BLOCKED_CUST');

    // Technician attempt to single delete
    const techSingleRes = await fetch(`${BASE_URL}/repairs/${repBlocked1.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${technicianToken}` }
    });
    assert(techSingleRes.status === 403, 'Technician cannot single-delete repair (HTTP 403 Forbidden)');

    // Technician attempt to bulk delete
    const techBulkRes = await fetch(`${BASE_URL}/repairs/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${technicianToken}` },
      body: JSON.stringify({ ids: [repBlocked1.id] })
    });
    assert(techBulkRes.status === 403, 'Technician cannot bulk-delete repairs (HTTP 403 Forbidden)');

    // Customer attempt to single delete
    const custSingleRes = await fetch(`${BASE_URL}/repairs/${repBlocked2.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${customerToken}` }
    });
    assert(custSingleRes.status === 403, 'Customer cannot single-delete repair (HTTP 403 Forbidden)');

    // Customer attempt to bulk delete
    const custBulkRes = await fetch(`${BASE_URL}/repairs/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${customerToken}` },
      body: JSON.stringify({ ids: [repBlocked2.id] })
    });
    assert(custBulkRes.status === 403, 'Customer cannot bulk-delete repairs (HTTP 403 Forbidden)');

    // Clean up the blocked test repairs using Super Admin
    await prisma.technicianNote.deleteMany({ where: { repairId: { in: [repBlocked1.id, repBlocked2.id] } } });
    await prisma.repairLog.deleteMany({ where: { repairId: { in: [repBlocked1.id, repBlocked2.id] } } });
    await prisma.payment.deleteMany({ where: { repairId: { in: [repBlocked1.id, repBlocked2.id] } } });
    await prisma.notification.deleteMany({ where: { repairId: { in: [repBlocked1.id, repBlocked2.id] } } });
    await prisma.repair.deleteMany({ where: { id: { in: [repBlocked1.id, repBlocked2.id] } } });

    // --- 3. Single Delete Authorization & Cascade Cleanup Verification ---
    console.log('\n--- 3. Single Delete Authorization & Cascade Cleanup Verification ---');

    // 3a. Receptionist Single Delete -> Must be 403 Forbidden
    const recepRepair = await createTestRepair('RECEP_SINGLE');
    const recepDelRes = await fetch(`${BASE_URL}/repairs/${recepRepair.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${receptionistToken}` }
    });
    assert(recepDelRes.status === 403, 'Receptionist cannot single-delete repair (HTTP 403 Forbidden)');

    // 3b. Admin Single Delete -> Must be 403 Forbidden
    const adminRepair = await createTestRepair('ADMIN_SINGLE');
    const adminDelRes = await fetch(`${BASE_URL}/repairs/${adminRepair.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(adminDelRes.status === 403, 'Admin cannot single-delete repair (HTTP 403 Forbidden)');

    // 3c. Super Admin Single Delete -> Must be 200 OK
    const superRepair = await createTestRepair('SUPER_SINGLE');
    const superDelRes = await fetch(`${BASE_URL}/repairs/${superRepair.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${superAdminToken}` }
    });
    const superDelData: any = await superDelRes.json();
    assert(superDelRes.status === 200, 'Super Admin can single-delete repair (HTTP 200)');
    assert(superDelData.success === true, 'Super Admin single-delete returns success: true');

    // Verify cascading cleanup in database for superRepair
    const checkSuperRepair = await prisma.repair.findUnique({ where: { id: superRepair.id } });
    const checkSuperLogs = await prisma.repairLog.findMany({ where: { repairId: superRepair.id } });
    const checkSuperNotes = await prisma.technicianNote.findMany({ where: { repairId: superRepair.id } });
    const checkSuperPayments = await prisma.payment.findMany({ where: { repairId: superRepair.id } });
    const checkSuperNotifications = await prisma.notification.findMany({ where: { repairId: superRepair.id } });

    assert(checkSuperRepair === null, 'Repair record deleted from database');
    assert(checkSuperLogs.length === 0, 'Cascaded repair logs deleted (0 orphaned logs)');
    assert(checkSuperNotes.length === 0, 'Cascaded technician notes deleted (0 orphaned notes)');
    assert(checkSuperPayments.length === 0, 'Cascaded payments deleted (0 orphaned payments)');
    assert(checkSuperNotifications.length === 0, 'Cascaded notifications deleted (0 orphaned notifications)');

    // Cleanup recep and admin repairs using Super Admin token
    await fetch(`${BASE_URL}/repairs/${recepRepair.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${superAdminToken}` } });
    await fetch(`${BASE_URL}/repairs/${adminRepair.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${superAdminToken}` } });

    // Verify customer still exists
    const checkCustStillExists = await prisma.customer.findUnique({ where: { id: testCustomer.id } });
    assert(Boolean(checkCustStillExists), 'Customer account remains intact after repair deletion');

    // --- 4. Bulk Delete Authorization & Atomicity Verification ---
    console.log('\n--- 4. Bulk Delete API & Transaction Cascade Verification ---');

    // Create 4 test repairs for bulk deletion
    const bulkRep1 = await createTestRepair('BULK_1');
    const bulkRep2 = await createTestRepair('BULK_2');
    const bulkRep3 = await createTestRepair('BULK_3');
    const bulkRep4 = await createTestRepair('BULK_4');

    const bulkIds = [bulkRep1.id, bulkRep2.id, bulkRep3.id, bulkRep4.id];

    // Receptionist attempts bulk delete -> 403 Forbidden
    const recepBulkRes = await fetch(`${BASE_URL}/repairs/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${receptionistToken}` },
      body: JSON.stringify({ ids: bulkIds })
    });
    assert(recepBulkRes.status === 403, 'Receptionist cannot bulk-delete repairs (HTTP 403 Forbidden)');

    // Admin attempts bulk delete -> 403 Forbidden
    const adminBulkRes = await fetch(`${BASE_URL}/repairs/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ ids: bulkIds })
    });
    assert(adminBulkRes.status === 403, 'Admin cannot bulk-delete repairs (HTTP 403 Forbidden)');

    // Super Admin executes bulk delete on 4 repairs
    const bulkDelRes = await fetch(`${BASE_URL}/repairs/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${superAdminToken}` },
      body: JSON.stringify({ ids: bulkIds })
    });
    const bulkDelData: any = await bulkDelRes.json();

    assert(bulkDelRes.status === 200, 'POST /api/repairs/bulk-delete by Super Admin returns HTTP 200');
    assert(bulkDelData.success === true, 'Bulk delete response indicates success: true');
    assert(bulkDelData.count === 4, 'Bulk delete response confirms 4 records deleted');
    assert(Array.isArray(bulkDelData.deletedIds) && bulkDelData.deletedIds.length === 4, 'Bulk delete returns deletedIds array');

    // Verify all 4 repairs and their cascades are wiped
    const remainingRepairs = await prisma.repair.findMany({ where: { id: { in: bulkIds } } });
    const remainingLogs = await prisma.repairLog.findMany({ where: { repairId: { in: bulkIds } } });
    const remainingNotes = await prisma.technicianNote.findMany({ where: { repairId: { in: bulkIds } } });
    const remainingPayments = await prisma.payment.findMany({ where: { repairId: { in: bulkIds } } });

    assert(remainingRepairs.length === 0, 'All 4 bulk-deleted repair records removed from database');
    assert(remainingLogs.length === 0, 'All cascaded repair logs cleaned for bulk-deleted records');
    assert(remainingNotes.length === 0, 'All cascaded technician notes cleaned for bulk-deleted records');
    assert(remainingPayments.length === 0, 'All cascaded payments cleaned for bulk-deleted records');

    // --- 5. Bulk Delete Edge Cases ---
    console.log('\n--- 5. Bulk Delete Validation & Edge Cases ---');

    // 5a. Empty array
    const emptyBulkRes = await fetch(`${BASE_URL}/repairs/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${superAdminToken}` },
      body: JSON.stringify({ ids: [] })
    });
    assert(emptyBulkRes.status === 400, 'Bulk delete with empty ids array returns HTTP 400 Bad Request');

    // 5b. Non-existent IDs
    const notFoundBulkRes = await fetch(`${BASE_URL}/repairs/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${superAdminToken}` },
      body: JSON.stringify({ ids: ['non_existent_id_12345', 'non_existent_id_67890'] })
    });
    assert(notFoundBulkRes.status === 404, 'Bulk delete with non-existent IDs returns HTTP 404 Not Found');

    // --- 6. Audit Logging Verification ---
    console.log('\n--- 6. Audit Logging Verification ---');
    const bulkAuditLog = await prisma.auditLog.findFirst({
      where: { action: 'REPAIRS_DELETED' },
      orderBy: { createdAt: 'desc' }
    });
    assert(Boolean(bulkAuditLog), 'Audit log entry created for REPAIRS_DELETED');
    assert(bulkAuditLog?.details.includes('Bulk deleted'), 'Audit log details specify bulk deletion details');

    const singleAuditLog = await prisma.auditLog.findFirst({
      where: { action: 'DELETE_REPAIR' },
      orderBy: { createdAt: 'desc' }
    });
    assert(Boolean(singleAuditLog), 'Audit log entry created for DELETE_REPAIR');

  } catch (err: any) {
    console.error('UNHANDLED TEST EXCEPTION:', err);
    testsFailed++;
  } finally {
    await prisma.$disconnect();
    console.log(`\n==============================================`);
    console.log(`TEST RESULTS: ${testsPassed} Passed, ${testsFailed} Failed`);
    console.log(`==============================================\n`);
    process.exit(testsFailed > 0 ? 1 : 0);
  }
}

runTests();
