import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const API_BASE = 'http://localhost:3000/api';

async function main() {
  console.log("================================================================================");
  console.log("MTS LAB — COMPLETE DASHBOARD AUDIT, RBAC & SYSTEM WIPE TEST SUITE");
  console.log("================================================================================");

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, description: string) {
    total++;
    if (condition) {
      console.log(`  ✓ PASS [Test ${total}]: ${description}`);
      passed++;
    } else {
      console.error(`  ✕ FAIL [Test ${total}]: ${description}`);
      throw new Error(`Test failed: ${description}`);
    }
  }

  try {
    // Step 1: Ensure test accounts exist in database for all 6 roles
    const hashedPassword = await bcrypt.hash('MtsLab@2026Secure', 10);
    const testPass = 'MtsLab@2026Secure';

    const rolesData = [
      { email: 'mtsmobilelab@gmail.com', name: 'Primary Super Admin', role: 'SUPER_ADMIN' },
      { email: 'audit.admin@mtslab.com', name: 'Audit Admin', role: 'ADMIN' },
      { email: 'audit.manager@mtslab.com', name: 'Audit Manager', role: 'MANAGER' },
      { email: 'audit.headtech@mtslab.com', name: 'Audit Head Tech', role: 'HEAD_TECHNICIAN' },
      { email: 'audit.tech@mtslab.com', name: 'Audit Tech', role: 'TECHNICIAN' },
      { email: 'audit.receptionist@mtslab.com', name: 'Audit Receptionist', role: 'RECEPTIONIST' }
    ];

    const userTokens: Record<string, string> = {};

    for (const r of rolesData) {
      await prisma.user.upsert({
        where: { email: r.email },
        create: {
          name: r.name,
          email: r.email,
          password: hashedPassword,
          role: r.role,
          emailVerified: true,
          accountStatus: 'ACTIVE',
          isActive: true
        },
        update: {
          password: hashedPassword,
          role: r.role,
          emailVerified: true,
          accountStatus: 'ACTIVE',
          isActive: true
        }
      });

      // Login to obtain JWT session token
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: r.email, password: testPass })
      });
      const data: any = await res.json();
      assert(res.status === 200 && Boolean(data.token), `Role ${r.role} (${r.email}) logged in successfully`);
      userTokens[r.role] = data.token;
    }

    const superAdminToken = userTokens['SUPER_ADMIN'];
    const adminToken = userTokens['ADMIN'];
    const managerToken = userTokens['MANAGER'];
    const headTechToken = userTokens['HEAD_TECHNICIAN'];
    const techToken = userTokens['TECHNICIAN'];
    const receptionistToken = userTokens['RECEPTIONIST'];

    console.log("\n--- STEP 2: MODULE ENDPOINT ACCESS AUDIT (ALL ROLES) ---");

    // Repairs access
    const repRes = await fetch(`${API_BASE}/repairs`, {
      headers: { 'Authorization': `Bearer ${receptionistToken}` }
    });
    assert(repRes.status === 200, `RECEPTIONIST can read repairs list (HTTP 200)`);

    // Customer Hub access
    const custRes = await fetch(`${API_BASE}/customers`, {
      headers: { 'Authorization': `Bearer ${receptionistToken}` }
    });
    assert(custRes.status === 200, `RECEPTIONIST can read customer hub (HTTP 200)`);

    // Courier Hub access
    const courRes = await fetch(`${API_BASE}/couriers`, {
      headers: { 'Authorization': `Bearer ${receptionistToken}` }
    });
    assert(courRes.status === 200, `RECEPTIONIST can read courier hub (HTTP 200)`);

    // Battery Warranty Hub access
    const batRes = await fetch(`${API_BASE}/battery-warranties`, {
      headers: { 'Authorization': `Bearer ${receptionistToken}` }
    });
    assert(batRes.status === 200, `RECEPTIONIST can read battery warranties (HTTP 200)`);

    // Attendance access
    const attRes = await fetch(`${API_BASE}/attendance/history`, {
      headers: { 'Authorization': `Bearer ${techToken}` }
    });
    assert(attRes.status === 200, `TECHNICIAN can read attendance records (HTTP 200)`);

    // Damage records access
    const damRes = await fetch(`${API_BASE}/repair-damage`, {
      headers: { 'Authorization': `Bearer ${techToken}` }
    });
    assert(damRes.status === 200, `TECHNICIAN can read repair-related damage (HTTP 200)`);

    // Services & Repair Prices access
    const svcRes = await fetch(`${API_BASE}/repair-prices`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(svcRes.status === 200, `ADMIN can read services & repair prices (HTTP 200)`);

    // Revenue Hub access (Revenue Hub loads repairs to compute billing summary)
    const revRes = await fetch(`${API_BASE}/repairs`, {
      headers: { 'Authorization': `Bearer ${managerToken}` }
    });
    assert(revRes.status === 200, `MANAGER can read revenue hub via repairs data (HTTP 200)`);

    // Staff Management access
    const staffRes = await fetch(`${API_BASE}/users`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(staffRes.status === 200, `ADMIN can read staff management (HTTP 200)`);

    // Inventory access
    const invRes = await fetch(`${API_BASE}/inventory`, {
      headers: { 'Authorization': `Bearer ${receptionistToken}` }
    });
    assert(invRes.status === 200, `RECEPTIONIST can read inventory (HTTP 200)`);

    // Slideshow CMS access
    const slideRes = await fetch(`${API_BASE}/admin/slides`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(slideRes.status === 200, `ADMIN can read slideshow CMS (HTTP 200)`);

    // Access Requests access
    const accRes = await fetch(`${API_BASE}/access-requests`, {
      headers: { 'Authorization': `Bearer ${superAdminToken}` }
    });
    assert(accRes.status === 200, `SUPER_ADMIN can read access requests (HTTP 200)`);

    console.log("\n--- STEP 3: SERVER-SIDE RBAC SECURITY AUTHORIZATION GUARDS ---");

    // RECEPTIONIST calling Staff Management API -> HTTP 403 Forbidden
    const unauthStaffRes = await fetch(`${API_BASE}/users`, {
      headers: { 'Authorization': `Bearer ${receptionistToken}` }
    });
    assert(unauthStaffRes.status === 403, `RECEPTIONIST attempt to read staff management is blocked (HTTP 403)`);

    // TECHNICIAN calling Slideshow CMS API -> HTTP 403 Forbidden
    const unauthRevRes = await fetch(`${API_BASE}/admin/slides`, {
      headers: { 'Authorization': `Bearer ${techToken}` }
    });
    assert(unauthRevRes.status === 403, `TECHNICIAN attempt to access admin slideshow CMS is blocked (HTTP 403)`);

    // ADMIN calling Access Requests API -> HTTP 403 Forbidden
    const unauthAccRes = await fetch(`${API_BASE}/access-requests`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(unauthAccRes.status === 403, `ADMIN attempt to read super-admin access requests is blocked (HTTP 403)`);

    // RECEPTIONIST calling System Wipe API -> HTTP 403 Forbidden
    const unauthWipeRes = await fetch(`${API_BASE}/admin/system-wipe`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${receptionistToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password: testPass, categories: ['REPAIRS'] })
    });
    assert(unauthWipeRes.status === 403, `RECEPTIONIST attempt to execute system wipe is blocked (HTTP 403)`);

    console.log("\n--- STEP 4: SELECTION-BASED SYSTEM WIPE TEST ---");

    // Create test customer
    const uid = Date.now();
    const testCust = await prisma.customer.create({
      data: {
        customerId: `CUST-WIPE-${uid}`,
        name: 'Wipe Test Customer',
        phone: '9800000999',
        email: `wipetest_${uid}@customer.com`,
        address: 'Kathmandu, Nepal'
      }
    });

    // Find superadmin user and branch for createdBy & branch
    const saUser = await prisma.user.findFirst({ where: { email: 'mtsmobilelab@gmail.com' } });
    let branch = await prisma.branch.findFirst();
    if (!branch) {
      branch = await prisma.branch.create({
        data: { name: 'Main Branch', location: 'Kathmandu', phone: '9800000000' }
      });
    }

    // Create test repair
    const testRepair = await prisma.repair.create({
      data: {
        repairNumber: `WIPE-${uid}`,
        customerName: 'Wipe Test Customer',
        customerPhone: '9800000999',
        deviceBrand: 'Apple',
        deviceModel: 'iPhone 15 Pro',
        deviceCondition: 'Used - Scratches',
        problemDescription: 'Screen Replacement',
        estimatedCost: 15000,
        status: 'PENDING',
        customer: { connect: { id: testCust.id } },
        createdBy: { connect: { id: saUser.id } },
        branch: { connect: { id: branch.id } }
      }
    });

    // Create test battery warranty
    const testWarranty = await prisma.batteryWarranty.create({
      data: {
        warrantyNumber: `WARR-${uid}`,
        repairNumber: `WIPE-${uid}`,
        customerName: 'Wipe Test Customer',
        customerPhone: '9800000999',
        deviceBrand: 'Apple',
        deviceModel: 'iPhone 15 Pro',
        warrantyPeriod: '6 Months',
        registrationDate: new Date(),
        expiryDate: new Date(Date.now() + 180 * 86400000),
        status: 'ACTIVE',
        repair: { connect: { id: testRepair.id } },
        createdBy: { connect: { id: saUser.id } }
      }
    });

    // 4.1 Wipe ONLY REPAIRS category
    const wipeRepairsRes = await fetch(`${API_BASE}/admin/system-wipe`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${superAdminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        password: testPass,
        categories: ['REPAIRS']
      })
    });
    const wipeRepairsData: any = await wipeRepairsRes.json();
    if (!wipeRepairsData.success) console.log("WIPE REPAIRS RESPONSE ERROR:", wipeRepairsRes.status, wipeRepairsData);
    assert(wipeRepairsRes.status === 200 && Boolean(wipeRepairsData.success), `Selection-based system wipe executed for REPAIRS category`);

    // Confirm repair is deleted
    const dbRepair = await prisma.repair.findUnique({ where: { id: testRepair.id } });
    assert(dbRepair === null, `Test repair record wiped cleanly from database`);

    // Confirm customer REMAINED INTACT (selection-based category isolation protection!)
    const dbCustIntact = await prisma.customer.findUnique({ where: { id: testCust.id } });
    assert(dbCustIntact !== null, `Customer record remained intact when only REPAIRS was selected`);

    // 4.2 Wipe CUSTOMERS category
    const wipeOtherRes = await fetch(`${API_BASE}/admin/delete-data`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${superAdminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        password: testPass,
        categories: ['CUSTOMERS']
      })
    });
    const wipeOtherData: any = await wipeOtherRes.json();
    assert(wipeOtherRes.status === 200 && Boolean(wipeOtherData.success), `Selection-based system wipe executed for CUSTOMERS category`);

    const dbCustDel = await prisma.customer.findUnique({ where: { id: testCust.id } });
    assert(dbCustDel === null, `Customer record wiped cleanly from database when CUSTOMERS category selected`);

    // Check Audit Log
    const lastAudit = await prisma.auditLog.findFirst({
      where: { action: 'CLEAR_DATA' },
      orderBy: { createdAt: 'desc' }
    });
    assert(lastAudit !== null && lastAudit.userId !== null, `System wipe logged in audit table with action CLEAR_DATA`);

    console.log("================================================================================");
    console.log(`ALL DASHBOARD AUDIT, RBAC & SYSTEM WIPE TESTS PASSED: ${passed}/${total} (100%)`);
    console.log("================================================================================");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error("Test Suite Execution Failed:", err);
  process.exit(1);
});
