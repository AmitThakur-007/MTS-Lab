import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'mts-lab-super-secret-key';
const BASE_URL = 'http://localhost:3000';

async function runManagerTests() {
  console.log("===============================================================");
  console.log("🚀 STARTING E2E AUTOMATED TESTS: MANAGER ROLE & OPERATIONS");
  console.log("===============================================================\n");

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`✅ [PASS] ${testName}`);
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      if (details) console.error(`   Details: ${details}`);
    }
  }

  try {
    // 1. Setup Branch
    let branch = await prisma.branch.findFirst({ where: { name: 'Manager Test Branch' } });
    if (!branch) {
      branch = await prisma.branch.create({
        data: {
          name: 'Manager Test Branch',
          location: 'Kathmandu, Nepal',
          phone: '+977-9800000000'
        }
      });
    }

    const hashedPassword = await bcrypt.hash('Password123!', 10);

    // 2. Setup Super Admin User
    let superAdmin = await prisma.user.findFirst({ where: { email: 'superadmin_mgr_test@mtslab.com' } });
    if (!superAdmin) {
      superAdmin = await prisma.user.create({
        data: {
          email: 'superadmin_mgr_test@mtslab.com',
          name: 'Super Admin Test',
          password: hashedPassword,
          role: 'SUPER_ADMIN',
          branchId: branch.id,
          emailVerified: true,
          isActive: true
        }
      });
    }
    const superAdminToken = jwt.sign({ id: superAdmin.id, email: superAdmin.email, role: superAdmin.role }, JWT_SECRET, { expiresIn: '1d' });

    // 3. Setup Manager User
    let manager = await prisma.user.findFirst({ where: { email: 'manager_test@mtslab.com' } });
    if (!manager) {
      manager = await prisma.user.create({
        data: {
          email: 'manager_test@mtslab.com',
          name: 'Repair Manager Alpha',
          password: hashedPassword,
          role: 'MANAGER',
          branchId: branch.id,
          emailVerified: true,
          isActive: true
        }
      });
    } else {
      manager = await prisma.user.update({
        where: { id: manager.id },
        data: { role: 'MANAGER', isActive: true, emailVerified: true }
      });
    }
    const managerToken = jwt.sign({ id: manager.id, email: manager.email, role: manager.role, name: manager.name }, JWT_SECRET, { expiresIn: '1d' });

    // 4. Setup Technician A
    let techA = await prisma.user.findFirst({ where: { email: 'tech_a_mgr_test@mtslab.com' } });
    if (!techA) {
      techA = await prisma.user.create({
        data: {
          email: 'tech_a_mgr_test@mtslab.com',
          name: 'Technician Alex',
          password: hashedPassword,
          role: 'TECHNICIAN',
          branchId: branch.id,
          emailVerified: true,
          isActive: true
        }
      });
    }
    const techAToken = jwt.sign({ id: techA.id, email: techA.email, role: techA.role, name: techA.name }, JWT_SECRET, { expiresIn: '1d' });

    // 5. Setup Technician B
    let techB = await prisma.user.findFirst({ where: { email: 'tech_b_mgr_test@mtslab.com' } });
    if (!techB) {
      techB = await prisma.user.create({
        data: {
          email: 'tech_b_mgr_test@mtslab.com',
          name: 'Technician Brian',
          password: hashedPassword,
          role: 'TECHNICIAN',
          branchId: branch.id,
          emailVerified: true,
          isActive: true
        }
      });
    }
    const techBToken = jwt.sign({ id: techB.id, email: techB.email, role: techB.role, name: techB.name }, JWT_SECRET, { expiresIn: '1d' });

    // 6. Setup Customer
    let customer = await prisma.customer.findFirst({ where: { phone: '9841009988' } });
    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          customerId: 'CUST-MGR-001',
          name: 'Ramesh Adhikari',
          phone: '9841009988',
          email: 'ramesh.mgr@gmail.com',
          address: 'Lalitpur'
        }
      });
    }

    // Clean up past test repairs with test prefix
    await prisma.technicianNote.deleteMany({ where: { repair: { repairNumber: { startsWith: 'MGR-TEST-' } } } });
    await prisma.repairLog.deleteMany({ where: { repair: { repairNumber: { startsWith: 'MGR-TEST-' } } } });
    await prisma.repair.deleteMany({ where: { repairNumber: { startsWith: 'MGR-TEST-' } } });

    // Seed test repairs
    const testRepair1 = await prisma.repair.create({
      data: {
        repairNumber: 'MGR-TEST-1001',
        customerName: customer.name,
        customerPhone: customer.phone,
        customerAddress: customer.address,
        customerId: customer.id,
        deviceBrand: 'Apple',
        deviceModel: 'iPhone 14 Pro Max',
        imeiNumber: '354892019283741',
        deviceCondition: 'Scratches on frame',
        problemDescription: 'Touch screen unresponsive after drop',
        estimatedCost: 18500,
        status: 'PENDING',
        priority: 'NORMAL',
        branchId: branch.id,
        createdById: manager.id
      }
    });

    const testRepair2 = await prisma.repair.create({
      data: {
        repairNumber: 'MGR-TEST-1002',
        customerName: customer.name,
        customerPhone: customer.phone,
        customerAddress: customer.address,
        customerId: customer.id,
        deviceBrand: 'Samsung',
        deviceModel: 'Galaxy S23 Ultra',
        imeiNumber: '359876543210987',
        deviceCondition: 'Mint condition',
        problemDescription: 'No power / dead motherboard',
        estimatedCost: 22000,
        status: 'IN_PROCESS',
        priority: 'HIGH',
        branchId: branch.id,
        technicianId: techA.id,
        createdById: manager.id
      }
    });

    console.log("Seeded test records successfully.\n");

    // =========================================================================
    // TEST 1: Manager Login & Profile Verification
    // =========================================================================
    assert(manager.role === 'MANAGER', "TEST 1: User created with MANAGER role");

    // =========================================================================
    // TEST 2: Manager Fetches Repairs via API
    // =========================================================================
    const getRepairsRes = await fetch(`${BASE_URL}/api/repairs`, {
      headers: { 'Authorization': `Bearer ${managerToken}` }
    });
    const repairsData = await getRepairsRes.json();
    assert(getRepairsRes.status === 200 && Array.isArray(repairsData), "TEST 2: Manager successfully retrieves repairs via /api/repairs");
    assert(repairsData.some((r: any) => r.repairNumber === 'MGR-TEST-1001'), "TEST 2B: Seeded repair visible in Manager repair list");

    // =========================================================================
    // TEST 3: Manager Search by Repair Number & Customer Name
    // =========================================================================
    const searchRes = await fetch(`${BASE_URL}/api/repairs?search=MGR-TEST-1001`, {
      headers: { 'Authorization': `Bearer ${managerToken}` }
    });
    const searchData = await searchRes.json();
    assert(searchRes.status === 200 && searchData.some((r: any) => r.repairNumber === 'MGR-TEST-1001'), "TEST 3: Manager searches repairs by Repair Number");

    // =========================================================================
    // TEST 4: Manager Status & Overview Statistics
    // =========================================================================
    const statsRes = await fetch(`${BASE_URL}/api/manager/stats`, {
      headers: { 'Authorization': `Bearer ${managerToken}` }
    });
    const statsData = await statsRes.json();
    assert(statsRes.status === 200 && typeof statsData.totalRepairs === 'number', "TEST 4: Manager retrieves operational statistics via /api/manager/stats");
    assert(statsData.unassigned >= 1, "TEST 4B: Stats accurately track unassigned tickets", `Unassigned: ${statsData.unassigned}`);

    // =========================================================================
    // TEST 5: Manager Technician Workload API
    // =========================================================================
    const workloadRes = await fetch(`${BASE_URL}/api/manager/workload`, {
      headers: { 'Authorization': `Bearer ${managerToken}` }
    });
    const workloadData = await workloadRes.json();
    assert(workloadRes.status === 200 && Array.isArray(workloadData), "TEST 5: Manager retrieves specialist workload breakdown via /api/manager/workload");
    const techAWorkload = workloadData.find((w: any) => w.technician.id === techA.id);
    assert(Boolean(techAWorkload && techAWorkload.assignedCount >= 1), "TEST 5B: Workload accurately counts assignments for Technician A");

    // =========================================================================
    // TEST 6: Manager Assigns Unassigned Repair to Technician A
    // =========================================================================
    const assignRes = await fetch(`${BASE_URL}/api/repairs/${testRepair1.id}/assign`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${managerToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ technicianId: techA.id })
    });
    const assignData = await assignRes.json();
    assert(assignRes.status === 200 && assignData.technicianId === techA.id, "TEST 6: Manager assigns unassigned repair to Technician A");

    const verifyAssigned = await prisma.repair.findUnique({ where: { id: testRepair1.id } });
    assert(verifyAssigned?.technicianId === techA.id, "TEST 6B: Database updated with Technician A assignment");

    // =========================================================================
    // TEST 7: Manager Transfers Repair from Technician A to Technician B
    // =========================================================================
    const transferRes = await fetch(`${BASE_URL}/api/repairs/${testRepair1.id}/transfer`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${managerToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        targetTechnicianId: techB.id,
        reason: "Reassigned by Manager: Specialist Brian specializes in iPhone 14 Pro Max display assemblies",
        priority: "HIGH"
      })
    });
    const transferData = await transferRes.json();
    assert(transferRes.status === 200 && transferData.success === true, "TEST 7: Manager transfers repair from Technician A to Technician B via /api/repairs/:id/transfer");

    const verifyTransferred = await prisma.repair.findUnique({ 
      where: { id: testRepair1.id },
      include: { notes: true, logs: true }
    });
    assert(verifyTransferred?.technicianId === techB.id, "TEST 7B: Repair technicianId updated to Technician B");
    assert(verifyTransferred?.priority === 'HIGH', "TEST 7C: Priority updated to HIGH during transfer");
    assert(verifyTransferred?.logs.some(l => l.message.includes('transferred')), "TEST 7D: Activity trace contains transfer audit log");

    // =========================================================================
    // TEST 8: Manager Adds Internal Communication Note
    // =========================================================================
    const noteRes = await fetch(`${BASE_URL}/api/repairs/${testRepair1.id}/notes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${managerToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        note: "Manager Instruction: Perform complete TrueTone calibration and water resistance seal test before completing.",
        isInternal: true
      })
    });
    const noteData = await noteRes.json();
    assert(noteRes.status === 201 && noteData.note.includes('TrueTone calibration'), "TEST 8: Manager records internal instruction note");

    const noteInDb = await prisma.technicianNote.findFirst({
      where: { repairId: testRepair1.id, authorRole: 'MANAGER' }
    });
    assert(Boolean(noteInDb && noteInDb.isInternal), "TEST 8B: Note saved with authorRole MANAGER and isInternal=true");

    // =========================================================================
    // TEST 9: Manager Updates Priority to URGENT
    // =========================================================================
    const priorityRes = await fetch(`${BASE_URL}/api/repairs/${testRepair1.id}/priority`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${managerToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ priority: 'URGENT' })
    });
    const priorityData = await priorityRes.json();
    assert(priorityRes.status === 200 && priorityData.repair.priority === 'URGENT', "TEST 9: Manager updates repair priority to URGENT");

    // =========================================================================
    // TEST 10: Manager Updates Operation Status
    // =========================================================================
    const statusUpdateRes = await fetch(`${BASE_URL}/api/repairs/${testRepair1.id}/status`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${managerToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status: 'IN_PROCESS',
        note: 'Manager set status to IN_PROCESS'
      })
    });
    const statusUpdateData = await statusUpdateRes.json();
    assert(statusUpdateRes.status === 200, "TEST 10: Manager updates repair status to IN_PROCESS");

    // =========================================================================
    // TEST 11: Security Isolation - Manager BLOCKED from Super Admin Operations
    // =========================================================================
    const blockedClearRes = await fetch(`${BASE_URL}/api/admin/clear-all-data`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${managerToken}` }
    });
    assert(blockedClearRes.status === 403, "TEST 11A: Manager forbidden from /api/admin/clear-all-data (403)");

    const blockedAuditRes = await fetch(`${BASE_URL}/api/admin/audit-logs`, {
      headers: { 'Authorization': `Bearer ${managerToken}` }
    });
    assert(blockedAuditRes.status === 403, "TEST 11B: Manager forbidden from /api/admin/audit-logs (403)");

    const blockedDeleteRepairRes = await fetch(`${BASE_URL}/api/repairs/${testRepair1.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${managerToken}` }
    });
    assert(blockedDeleteRepairRes.status === 403, "TEST 11C: Manager forbidden from permanent repair deletion (403)");

    const blockedAccessReqRes = await fetch(`${BASE_URL}/api/access-requests`, {
      headers: { 'Authorization': `Bearer ${managerToken}` }
    });
    assert(blockedAccessReqRes.status === 403, "TEST 11D: Manager forbidden from access requests (403)");

    // =========================================================================
    // TEST 12: Security Isolation - Unauthenticated & Invalid Tokens Blocked
    // =========================================================================
    const unauthStatsRes = await fetch(`${BASE_URL}/api/manager/stats`);
    assert(unauthStatsRes.status === 401, "TEST 12A: Unauthenticated request to /api/manager/stats rejected (401)");

    const unauthTransferRes = await fetch(`${BASE_URL}/api/repairs/${testRepair1.id}/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetTechnicianId: techB.id, reason: 'test' })
    });
    assert(unauthTransferRes.status === 401, "TEST 12B: Unauthenticated transfer request rejected (401)");

    // =========================================================================
    // TEST 13: Invalid / Manipulated Repair ID Handling
    // =========================================================================
    const invalidIdRes = await fetch(`${BASE_URL}/api/repairs/00000000-0000-0000-0000-000000000000/transfer`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${managerToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ targetTechnicianId: techB.id, reason: 'test' })
    });
    assert(invalidIdRes.status === 404, "TEST 13: Non-existent repair ID correctly returns 404 Not Found");

    // =========================================================================
    // TEST 14: Manager Repair Excel Export
    // =========================================================================
    const exportRes = await fetch(`${BASE_URL}/api/repairs/export`, {
      headers: { 'Authorization': `Bearer ${managerToken}` }
    });
    assert(exportRes.status === 200, "TEST 14: Manager authorized to export repair records to Excel");

    console.log("\n===============================================================");
    console.log(`📊 TEST RESULTS: ${passedTests} / ${totalTests} Passed (${Math.round((passedTests / totalTests) * 100)}%)`);
    console.log("===============================================================\n");

    if (passedTests === totalTests) {
      console.log("🎉 ALL MANAGER ROLE E2E TESTS PASSED PERFECTLY!");
    } else {
      throw new Error(`Some tests failed: ${totalTests - passedTests} failed.`);
    }

  } catch (error: any) {
    console.error("Test execution failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runManagerTests();
