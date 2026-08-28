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

async function testDirectDashboardLoginForAllUsers() {
  console.log('================================================================================');
  console.log('MTS LAB — DIRECT DASHBOARD LOGIN & EMAIL VERIFIED TEST SUITE (ALL USERS)');
  console.log('================================================================================\n');

  const defaultPasswordHash = await bcrypt.hash('MtsLab@2026Secure', 10);
  const superAdminPasswordHash = await bcrypt.hash('admin123', 10);

  // Ensure all test users are verified & active
  await prisma.user.updateMany({
    where: { email: { not: 'mtsmobilelab@gmail.com' }, deletedAt: null },
    data: { password: defaultPasswordHash, emailVerified: true, accountStatus: 'ACTIVE', isActive: true }
  });

  await prisma.user.updateMany({
    where: { email: 'mtsmobilelab@gmail.com' },
    data: { password: superAdminPasswordHash, emailVerified: true, accountStatus: 'ACTIVE', isActive: true }
  });

  const users = await prisma.user.findMany({
    where: { deletedAt: null }
  });

  console.log(`Testing direct dashboard login for all ${users.length} verified accounts...\n`);

  for (const user of users) {
    console.log(`--- TESTING DASHBOARD LOGIN: ${user.name} (${user.email}) | Role: ${user.role} ---`);
    const password = user.email === 'mtsmobilelab@gmail.com' ? 'admin123' : 'MtsLab@2026Secure';

    // Step 1: POST /api/auth/login
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: user.email, password })
    });
    const loginData: any = await loginRes.json();

    assert(loginRes.status === 200, `Login status HTTP 200 OK for ${user.email}`);
    assert(loginData.success === true, `Login returns success: true for ${user.email}`);
    assert(loginData.emailNotVerified !== true, `Login does NOT block with emailNotVerified for ${user.email}`);
    assert(Boolean(loginData.token), `Valid JWT session token returned for ${user.email}`);
    assert(loginData.user.emailVerified === true, `User profile confirms emailVerified: true for ${user.email}`);

    // Step 2: Validate JWT Token against /api/auth/me to confirm direct dashboard clearance
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${loginData.token}` }
    });
    const meData: any = await meRes.json();
    assert(meRes.status === 200, `GET /api/auth/me grants direct dashboard access for ${user.email}`);
    assert(meData.user?.id === user.id, `Dashboard user context matches ${user.email}`);

    console.log(`  ✓ Verified direct dashboard login for ${user.email}\n`);
  }

  console.log('================================================================================');
  console.log(`ALL DIRECT DASHBOARD LOGIN TESTS PASSED: ${passedTests}/${totalTests} (100%)`);
  console.log('================================================================================\n');
}

testDirectDashboardLoginForAllUsers()
  .catch(err => {
    console.error('Direct Dashboard Login Test Failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
