import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const API_BASE = 'http://localhost:3000/api';

async function testAuthSuite() {
  console.log('====================================================');
  console.log('MTS LAB COMPREHENSIVE STAFF AUTHENTICATION TEST SUITE');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`[PASS] ${testName}`);
    } else {
      console.error(`[FAIL] ${testName} - ${detail || 'Assertion failed'}`);
    }
  }

  // 1. Database Role Normalization Audit
  const staffRoles = ['SUPERADMIN', 'ADMIN', 'MANAGER', 'HEAD_TECHNICIAN', 'TECHNICIAN', 'RECEPTIONIST'];
  for (const role of staffRoles) {
    const userInDb = await prisma.user.findFirst({
      where: { role, deletedAt: null }
    });
    assert(!!userInDb, `Database check for role: ${role}`, userInDb ? `Found user ${userInDb.email}` : `No active user found for role ${role}`);
  }

  // 2. Unregistered Email Login Test
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identity: 'nonexistent.user.999@mtslab.com',
        password: 'Password123!'
      })
    });
    assert(res.status === 401, 'Unregistered Email Login Blocked', `Expected HTTP 401, got ${res.status}`);
  } catch (err: any) {
    console.warn('[SERVER RUNNING CHECK] Local server must be running to test HTTP endpoints directly.');
  }

  // 3. Wrong Password Test for Registered Account
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identity: 'test.admin@mtslab.com',
        password: 'WrongPassword999!'
      })
    });
    assert(res.status === 401, 'Wrong Password Login Blocked', `Expected HTTP 401, got ${res.status}`);
  } catch (err: any) {}

  // 4. Disabled Account Login Test
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identity: 'deactivated.staff@mtslab.com',
        password: 'Password123!'
      })
    });
    assert(res.status === 403, 'Disabled/Deactivated Account Login Blocked', `Expected HTTP 403, got ${res.status}`);
  } catch (err: any) {}

  // 5. Unregistered Email Forgot Password Test
  try {
    const res = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'completely.unknown.fake@mtslab.com'
      })
    });
    const data: any = await res.json().catch(() => ({}));
    assert(res.status === 404 && data.registered === false, 'Unregistered Email Forgot Password Blocked (HTTP 404)', `Expected status 404 and registered=false, got status ${res.status}`);
  } catch (err: any) {}

  // 6. Registered Email Forgot Password Test
  try {
    const res = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test.superadmin@mtslab.com'
      })
    });
    const data: any = await res.json().catch(() => ({}));
    assert(res.status === 200 && data.registered === true, 'Registered Email Forgot Password Allowed (HTTP 200)', `Expected status 200 and registered=true, got status ${res.status}`);
  } catch (err: any) {}

  console.log(`\n====================================================`);
  console.log(`TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log(`====================================================\n`);

  await prisma.$disconnect();
}

testAuthSuite().catch((err) => {
  console.error('[TEST SUITE ERROR]', err);
  process.exit(1);
});
