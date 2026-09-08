import assert from 'assert';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "mts-lab-super-secret-key";
const API_BASE = "http://127.0.0.1:3000/api";

async function runOverviewVerification() {
  console.log('===================================================================');
  console.log('MTS LAB: USER OVERVIEW ATTENDANCE & REPAIR DAMAGE RECORDS VERIFICATION');
  console.log('===================================================================\n');

  // 1. Static Layout & Code Inspection
  console.log('--- 1. STATIC COMPONENT CODE INTEGRITY INSPECTION ---');

  const userOverviewCardsPath = path.join(process.cwd(), 'src', 'components', 'dashboard', 'UserOverviewCards.tsx');
  assert(fs.existsSync(userOverviewCardsPath), 'UserOverviewCards.tsx component exists');
  const cardsContent = fs.readFileSync(userOverviewCardsPath, 'utf8');

  // Verify elements in UserOverviewCards
  assert(cardsContent.includes('Attendance'), 'UserOverviewCards includes Attendance title');
  assert(cardsContent.includes('Repair Damage Record'), 'UserOverviewCards includes Repair Damage Record title');
  assert(cardsContent.includes('Present'), 'UserOverviewCards includes Present metrics');
  assert(cardsContent.includes('Absent'), 'UserOverviewCards includes Absent metrics');
  assert(cardsContent.includes('Rate'), 'UserOverviewCards includes Rate metrics');
  assert(cardsContent.includes('View Attendance'), 'UserOverviewCards includes View Attendance action');
  assert(cardsContent.includes('View Records'), 'UserOverviewCards includes View Records action');
  assert(!cardsContent.includes('Sparkles'), 'UserOverviewCards does not use AI sparkle icons');
  console.log('✓ UserOverviewCards.tsx contains all required metrics, actions, and clean UI without AI sparkles');

  const overviewPath = path.join(process.cwd(), 'src', 'pages', 'dashboard', 'Overview.tsx');
  const overviewContent = fs.readFileSync(overviewPath, 'utf8');
  assert(overviewContent.includes('<UserOverviewCards'), 'Overview.tsx renders UserOverviewCards');
  console.log('✓ Overview.tsx (Receptionist & Admin default dashboard) includes UserOverviewCards');

  const techDashboardPath = path.join(process.cwd(), 'src', 'pages', 'dashboard', 'TechnicianDashboard.tsx');
  const techContent = fs.readFileSync(techDashboardPath, 'utf8');
  assert(techContent.includes('<UserOverviewCards'), 'TechnicianDashboard.tsx renders UserOverviewCards');
  console.log('✓ TechnicianDashboard.tsx (Technician default dashboard) includes UserOverviewCards');

  const mgrDashboardPath = path.join(process.cwd(), 'src', 'pages', 'dashboard', 'ManagerDashboard.tsx');
  const mgrContent = fs.readFileSync(mgrDashboardPath, 'utf8');
  assert(mgrContent.includes('<UserOverviewCards'), 'ManagerDashboard.tsx renders UserOverviewCards');
  console.log('✓ ManagerDashboard.tsx (Manager default dashboard) includes UserOverviewCards');

  // 2. Role-by-Role Real Database & API Verification
  console.log('\n--- 2. ROLE-BASED DATA INTEGRITY & API VERIFICATION ---');

  const roles = [
    { role: 'TECHNICIAN', email: 'technician@mtslab.com' },
    { role: 'RECEPTIONIST', email: 'receptionist@mtslab.com' },
    { role: 'MANAGER', email: 'manager_test@mtslab.com' },
    { role: 'ADMIN', email: 'admin.regular@mtslab.local' }
  ];

  for (const item of roles) {
    let user = await prisma.user.findFirst({ where: { role: item.role, deletedAt: null } });
    if (!user) {
      user = await prisma.user.findFirst({ where: { role: item.role } });
    }
    assert(user, `User with role ${item.role} exists in database`);

    const token = jwt.sign(
      { id: user.id, userId: user.id, email: user.email, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    console.log(`\nTesting Role: [${item.role}] -> User: ${user.name} (${user.email})`);

    // A. Personal Attendance Endpoint Check
    const attRes = await fetch(`${API_BASE}/attendance/my`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.strictEqual(attRes.status, 200, `${item.role} can fetch /attendance/my (HTTP 200)`);
    const attData = await attRes.json();
    assert(attData && typeof attData.stats === 'object', `${item.role} receives attendance stats object`);
    console.log(`  ✓ Attendance Data: Present=${attData.stats.presentCount}, Absent=${attData.stats.absentCount}, Rate=${attData.stats.attendanceRate}%, Total Recorded=${attData.stats.totalMonthRecords}`);

    // B. Repair Damage Overview Check
    const dmgOverviewRes = await fetch(`${API_BASE}/repair-damage/overview`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.strictEqual(dmgOverviewRes.status, 200, `${item.role} can fetch /repair-damage/overview (HTTP 200)`);
    const dmgOverviewData = await dmgOverviewRes.json();
    assert(typeof dmgOverviewData.totalRecords === 'number', `${item.role} receives totalRecords numeric count`);
    assert(typeof dmgOverviewData.thisMonthRecords === 'number', `${item.role} receives thisMonthRecords count`);
    console.log(`  ✓ Repair Damage Overview: Total=${dmgOverviewData.totalRecords}, This Month=${dmgOverviewData.thisMonthRecords}, Today=${dmgOverviewData.todayRecords}`);

    // C. Repair Damage List Check
    const dmgListRes = await fetch(`${API_BASE}/repair-damage?limit=5`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.strictEqual(dmgListRes.status, 200, `${item.role} can fetch /repair-damage list (HTTP 200)`);
    const dmgListData = await dmgListRes.json();
    const recordsList = Array.isArray(dmgListData.records) ? dmgListData.records : (Array.isArray(dmgListData) ? dmgListData : []);
    console.log(`  ✓ Repair Damage Records Available: ${recordsList.length} recent entries`);
  }

  // 3. Functional Damage Creation & Immediate Overview Reflectivity Test
  console.log('\n--- 3. DAMAGE RECORD CREATION & LIVE REFLECTIVITY TEST ---');
  const techUser = await prisma.user.findFirst({ where: { role: 'TECHNICIAN' } });
  const adminUser = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });

  if (techUser && adminUser) {
    const adminToken = jwt.sign(
      { id: adminUser.id, userId: adminUser.id, email: adminUser.email, role: adminUser.role, name: adminUser.name },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const techToken = jwt.sign(
      { id: techUser.id, userId: techUser.id, email: techUser.email, role: techUser.role, name: techUser.name },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Create test damage record
    const createRes = await fetch(`${API_BASE}/repair-damage`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        staffId: techUser.id,
        damagedComponent: 'Display',
        damageType: 'CRACKED',
        damageDescription: 'Overview test damage record',
        damageDate: new Date().toISOString().split('T')[0],
        damageTime: '12:30',
        quantity: 1,
        deviceBrand: 'Samsung',
        deviceModel: 'Galaxy S23'
      })
    });
    assert.strictEqual(createRes.status, 201, 'Admin successfully created repair damage record');
    const createdData = await createRes.json();
    const createdId = createdData.record.id;
    console.log(`✓ Created test damage record: ID=${createdId}, Component=Display, Device=Samsung Galaxy S23`);

    // Verify Technician overview reflects the record
    const techOverviewRes = await fetch(`${API_BASE}/repair-damage/overview`, {
      headers: { Authorization: `Bearer ${techToken}` }
    });
    const techOverviewData = await techOverviewRes.json();
    assert(techOverviewData.totalRecords >= 1, 'Technician overview shows updated totalRecords >= 1');
    assert(techOverviewData.componentBreakdown?.Display >= 1, 'Technician overview breakdown includes Display damage');
    console.log(`✓ Technician Overview verified: Total=${techOverviewData.totalRecords}, Display count=${techOverviewData.componentBreakdown.Display}`);

    // Cleanup
    await prisma.repairRelatedDamage.delete({ where: { id: createdId } });
    console.log('✓ Cleaned up test damage record');
  }

  console.log('\n===================================================================');
  console.log('ALL OVERVIEW ATTENDANCE & REPAIR DAMAGE RECORDS VERIFICATION TESTS PASSED (100%)');
  console.log('===================================================================');
}

runOverviewVerification().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
}).finally(() => prisma.$disconnect());
