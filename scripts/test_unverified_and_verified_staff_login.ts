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

async function runComprehensiveLoginTests() {
  console.log('================================================================================');
  console.log('MTS LAB — UNVERIFIED & VERIFIED STAFF LOGIN TEST SUITE (ALL ROLES)');
  console.log('================================================================================\n');

  // Ensure server is reachable
  try {
    const health = await fetch(`${BASE_URL}/api/health`).catch(() => null);
    if (!health || !health.ok) {
      console.log('Server not responding at health endpoint, continuing with test execution...\n');
    }
  } catch {}

  const roles = [
    'SUPER_ADMIN',
    'ADMIN',
    'MANAGER',
    'HEAD_TECHNICIAN',
    'TECHNICIAN',
    'RECEPTIONIST'
  ];

  const defaultPasswordHash = await bcrypt.hash('MtsLab@2026Secure', 10);
  const testPassword = 'MtsLab@2026Secure';

  // Find or provision active test accounts for all 6 roles
  const testUsers: Record<string, any> = {};

  for (const role of roles) {
    let user = await prisma.user.findFirst({
      where: { role: role as any, deletedAt: null }
    });

    if (!user) {
      const email = `test.${role.toLowerCase()}@mtslab.com`;
      user = await prisma.user.upsert({
        where: { email },
        update: {
          password: defaultPasswordHash,
          isActive: true,
          accountStatus: 'ACTIVE',
          deletedAt: null
        },
        create: {
          id: `usr_test_${role.toLowerCase()}`,
          email,
          name: `Test ${role}`,
          role: role as any,
          password: defaultPasswordHash,
          isActive: true,
          accountStatus: 'ACTIVE'
        }
      });
    }

    testUsers[role] = user;
  }

  // ---------------------------------------------------------------------------
  // TEST 1: UNVERIFIED STAFF ACCOUNTS MUST LOG IN SUCCESSFULLY ACROSS ALL ROLES
  // ---------------------------------------------------------------------------
  console.log('--- TEST 1: UNVERIFIED STAFF LOGIN (emailVerified = false) ---');
  for (const role of roles) {
    const user = testUsers[role];
    const password = user.email === 'mtsmobilelab@gmail.com' ? 'admin123' : testPassword;
    const passwordHash = await bcrypt.hash(password, 10);

    // Set user to UNVERIFIED state in database
    await prisma.user.update({
      where: { id: user.id },
      data: { password: passwordHash, emailVerified: false, accountStatus: 'ACTIVE', isActive: true }
    });

    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: user.email, password })
    });

    const data: any = await res.json();

    assert(res.status === 200, `Unverified ${role} (${user.email}) receives HTTP 200 OK`);
    assert(data.success === true, `Unverified ${role} login payload returns success: true`);
    assert(data.emailNotVerified !== true, `Unverified ${role} login payload does NOT block with emailNotVerified`);
    assert(Boolean(data.token), `Unverified ${role} receives valid session JWT token`);
    assert(data.user?.role === role || data.user?.role === (role === 'SUPER_ADMIN' ? 'SUPERADMIN' : role), `Role matching for ${role}`);

    // Verify token grants direct dashboard clearance via GET /api/auth/me
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${data.token}` }
    });
    const meData: any = await meRes.json();
    assert(meRes.status === 200, `GET /api/auth/me returns HTTP 200 OK for unverified ${role}`);
    assert(meData.user?.id === user.id, `Session user ID matches for unverified ${role}`);

    console.log(`  ✓ Unverified ${role} (${user.email}) logged in successfully & accessed dashboard\n`);
  }

  // ---------------------------------------------------------------------------
  // TEST 2: VERIFIED STAFF ACCOUNTS MUST LOG IN SUCCESSFULLY ACROSS ALL ROLES
  // ---------------------------------------------------------------------------
  console.log('--- TEST 2: VERIFIED STAFF LOGIN (emailVerified = true) ---');
  for (const role of roles) {
    const user = testUsers[role];
    const password = user.email === 'mtsmobilelab@gmail.com' ? 'admin123' : testPassword;
    const passwordHash = await bcrypt.hash(password, 10);

    // Set user to VERIFIED state in database
    await prisma.user.update({
      where: { id: user.id },
      data: { password: passwordHash, emailVerified: true, accountStatus: 'ACTIVE', isActive: true }
    });

    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: user.email, password })
    });

    const data: any = await res.json();

    assert(res.status === 200, `Verified ${role} (${user.email}) receives HTTP 200 OK`);
    assert(data.success === true, `Verified ${role} login payload returns success: true`);
    assert(Boolean(data.token), `Verified ${role} receives valid session JWT token`);

    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${data.token}` }
    });
    assert(meRes.status === 200, `GET /api/auth/me returns HTTP 200 OK for verified ${role}`);

    console.log(`  ✓ Verified ${role} (${user.email}) logged in successfully & accessed dashboard\n`);
  }

  // ---------------------------------------------------------------------------
  // TEST 3: WRONG PASSWORD MUST BE REJECTED (HTTP 401)
  // ---------------------------------------------------------------------------
  console.log('--- TEST 3: INVALID PASSWORD REJECTION ---');
  const sampleUser = testUsers['TECHNICIAN'];
  const wrongPassRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: sampleUser.email, password: 'WrongPassword999!' })
  });
  const wrongPassData: any = await wrongPassRes.json();

  assert(wrongPassRes.status === 401, 'Wrong password returns HTTP 401 Unauthorized');
  assert(wrongPassData.success === false, 'Wrong password returns success: false');
  assert(!wrongPassData.token, 'Wrong password does NOT return JWT token');
  console.log('  ✓ Wrong password successfully rejected\n');

  // ---------------------------------------------------------------------------
  // TEST 4: UNKNOWN EMAIL MUST BE REJECTED (HTTP 401)
  // ---------------------------------------------------------------------------
  console.log('--- TEST 4: UNKNOWN EMAIL REJECTION ---');
  const unknownEmailRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: 'nonexistent.user.xyz99@mtslab.com', password: 'SomePassword123!' })
  });
  const unknownEmailData: any = await unknownEmailRes.json();

  assert(unknownEmailRes.status === 401, 'Unknown email returns HTTP 401 Unauthorized');
  assert(unknownEmailData.success === false, 'Unknown email returns success: false');
  assert(!unknownEmailData.token, 'Unknown email does NOT return JWT token');
  console.log('  ✓ Unknown email successfully rejected\n');

  // ---------------------------------------------------------------------------
  // TEST 5: DISABLED ACCOUNT MUST BE REJECTED
  // ---------------------------------------------------------------------------
  console.log('--- TEST 5: DISABLED ACCOUNT REJECTION ---');
  const disabledUser = testUsers['RECEPTIONIST'];
  await prisma.user.update({
    where: { id: disabledUser.id },
    data: { isActive: false, accountStatus: 'DISABLED' }
  });

  const disabledRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: disabledUser.email, password: testPassword })
  });
  const disabledData: any = await disabledRes.json();

  assert(disabledRes.status === 401 || disabledRes.status === 403, 'Disabled account rejected with HTTP 401/403');
  assert(disabledData.success === false, 'Disabled account returns success: false');
  assert(!disabledData.token, 'Disabled account does NOT receive session token');

  // Re-enable test user account
  await prisma.user.update({
    where: { id: disabledUser.id },
    data: { isActive: true, accountStatus: 'ACTIVE' }
  });
  console.log('  ✓ Disabled account successfully rejected\n');

  console.log('================================================================================');
  console.log(`ALL COMPREHENSIVE LOGIN TESTS PASSED: ${passedTests}/${totalTests} (100%)`);
  console.log('================================================================================\n');
}

runComprehensiveLoginTests()
  .catch((err) => {
    console.error('Test Suite Error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
