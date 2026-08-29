import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const BASE_URL = process.env.VITE_BACKEND_URL || 'http://localhost:3000';

const TEST_USERS = [
  { role: 'SUPERADMIN', email: 'test.superadmin@mtslab.com', name: 'Test Super Admin', password: 'Password123!' },
  { role: 'ADMIN', email: 'test.admin@mtslab.com', name: 'Test Admin', password: 'Password123!' },
  { role: 'MANAGER', email: 'test.manager@mtslab.com', name: 'Test Manager', password: 'Password123!' },
  { role: 'HEAD_TECHNICIAN', email: 'test.headtech@mtslab.com', name: 'Test Head Tech', password: 'Password123!' },
  { role: 'TECHNICIAN', email: 'test.tech@mtslab.com', name: 'Test Technician', password: 'Password123!' },
  { role: 'RECEPTIONIST', email: 'test.receptionist@mtslab.com', name: 'Test Receptionist', password: 'Password123!' }
];

async function seedTestUsers() {
  const hashedPassword = await bcrypt.hash('Password123!', 10);
  const defaultBranch = await prisma.branch.findFirst();

  for (const u of TEST_USERS) {
    const existing = await prisma.user.findFirst({
      where: { email: u.email }
    });

    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          password: hashedPassword,
          role: u.role,
          isActive: true,
          accountStatus: 'ACTIVE',
          emailVerified: true,
          failedLoginAttempts: 0,
          lockoutUntil: null,
          deletedAt: null
        }
      });
    } else {
      await prisma.user.create({
        data: {
          email: u.email,
          name: u.name,
          role: u.role,
          password: hashedPassword,
          isActive: true,
          accountStatus: 'ACTIVE',
          emailVerified: true,
          branchId: defaultBranch ? defaultBranch.id : null
        }
      });
    }
  }
}

async function runLoginTests() {
  console.log('================================================================================');
  console.log('MTS LAB — COMPLETE LOGIN & AUTHENTICATION TEST SUITE');
  console.log('================================================================================\n');

  await seedTestUsers();
  console.log('✓ Seeded/verified test user credentials in database.\n');

  let passed = 0;
  let failed = 0;

  function report(name: string, success: boolean, details?: any) {
    if (success) {
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${name}`, details ? details : '');
      failed++;
    }
  }

  // 1. Test Login on all 6 Staff Roles
  console.log('--- 1. Testing Login on All 6 Staff Roles ---');
  for (const u of TEST_USERS) {
    try {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identity: u.email,
          password: u.password,
          device: { deviceName: 'QA Test Agent', deviceType: 'DESKTOP' },
          isClientVerified: true
        })
      });

      const body: any = await res.json().catch(() => null);
      const isOk = res.status === 200 && body?.success && body?.token && body?.user?.role === u.role;
      report(`Login as ${u.role} (${u.email})`, isOk, { status: res.status, body });

      if (isOk) {
        // Test immediate /api/auth/me
        const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${body.token}` }
        });
        const meBody: any = await meRes.json().catch(() => null);
        report(`  -> Fetch /api/auth/me for ${u.role}`, meRes.status === 200 && meBody?.id === body.user.id);

        // Test immediate dashboard stats fetch
        const statsRes = await fetch(`${BASE_URL}/api/dashboard/stats`, {
          headers: { Authorization: `Bearer ${body.token}` }
        });
        report(`  -> Fetch /api/dashboard/stats for ${u.role}`, statsRes.status === 200);
      }
    } catch (err: any) {
      report(`Login as ${u.role}`, false, err.message);
    }
  }

  // 2. Test Invalid Credentials
  console.log('\n--- 2. Testing Invalid Credentials Handling ---');
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identity: 'test.admin@mtslab.com',
        password: 'WrongPassword999!',
        device: { deviceName: 'QA Test Agent' }
      })
    });
    const body: any = await res.json().catch(() => null);
    report('Wrong Password returns HTTP 401 (not 500)', res.status === 401 && !body?.success, { status: res.status, body });
  } catch (err: any) {
    report('Wrong Password', false, err.message);
  }

  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identity: 'nonexistent.user.12345@mtslab.com',
        password: 'Password123!',
        device: { deviceName: 'QA Test Agent' }
      })
    });
    const body: any = await res.json().catch(() => null);
    report('Non-existent email returns HTTP 401 (not 500)', res.status === 401 && !body?.success, { status: res.status, body });
  } catch (err: any) {
    report('Non-existent email', false, err.message);
  }

  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identity: '',
        password: '',
        device: { deviceName: 'QA Test Agent' }
      })
    });
    report('Empty email/password returns HTTP 400 (not 500)', res.status === 400);
  } catch (err: any) {
    report('Empty email/password', false, err.message);
  }

  // 3. Test Account Status Blocking
  console.log('\n--- 3. Testing Inactive / Pending Account Status Rejections ---');
  const disabledUser = await prisma.user.create({
    data: {
      email: `disabled.user.${Date.now()}@mtslab.com`,
      name: 'Disabled User',
      role: 'TECHNICIAN',
      password: await bcrypt.hash('Password123!', 10),
      isActive: false,
      accountStatus: 'DISABLED',
      emailVerified: true
    }
  });

  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identity: disabledUser.email,
        password: 'Password123!',
        isClientVerified: true
      })
    });
    report('Disabled account returns HTTP 403 (not 500)', res.status === 403);
  } catch (err: any) {
    report('Disabled account', false, err.message);
  } finally {
    await prisma.user.delete({ where: { id: disabledUser.id } }).catch(() => {});
  }

  console.log('\n================================================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (${passed + failed} TOTAL)`);
  console.log('================================================================================\n');
}

runLoginTests()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
