import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'mts-lab-super-secret-key';
const BASE_URL = 'http://localhost:3000';

async function testLiveApi() {
  console.log("==================================================");
  console.log("TESTING LIVE HTTP API FOR 2FA ENABLE / DISABLE");
  console.log("==================================================");

  // 1. Setup Admin & Test User
  const hashedPassword = await bcrypt.hash("Password123!", 10);
  
  let admin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN', deletedAt: null } });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        name: "Super Admin",
        email: "admin@mtslab.com",
        username: "admin",
        password: hashedPassword,
        role: "SUPER_ADMIN",
        isActive: true,
        accountStatus: "ACTIVE",
        twoFactorEnabled: true
      }
    });
  }

  let tech = await prisma.user.findFirst({ where: { role: 'TECHNICIAN', deletedAt: null } });
  if (!tech) {
    tech = await prisma.user.create({
      data: {
        name: "Test Tech",
        email: "tech.test@mtslab.local",
        username: "techtest",
        password: hashedPassword,
        role: "TECHNICIAN",
        isActive: true,
        accountStatus: "ACTIVE",
        emailVerified: true,
        twoFactorEnabled: true
      }
    });
  } else {
    tech = await prisma.user.update({
      where: { id: tech.id },
      data: { password: hashedPassword, emailVerified: true, isActive: true, accountStatus: "ACTIVE" }
    });
  }

  // Create JWT tokens
  const adminToken = jwt.sign(
    { id: admin.id, userId: admin.id, email: admin.email, role: admin.role, name: admin.name },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  const techToken = jwt.sign(
    { id: tech.id, userId: tech.id, email: tech.email, role: tech.role, name: tech.name },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  console.log(`✓ Admin Token Generated for: ${admin.email}`);
  console.log(`✓ Tech Token Generated for: ${tech.email}`);
  console.log(`✓ Target User ID for test: ${tech.id}`);

  // Test 1: SUPER_ADMIN turns OFF 2FA using PATCH /api/users/:id/2fa with { enabled: false }
  console.log("\n--- TEST 1: PATCH /api/users/:id/2fa with { enabled: false } ---");
  const res1 = await fetch(`${BASE_URL}/api/users/${tech.id}/2fa`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ enabled: false })
  });
  const data1 = await res1.json();
  console.log(`HTTP Status: ${res1.status}`, data1);
  if (res1.status !== 200 || data1.twoFactorEnabled !== false) {
    throw new Error(`Test 1 Failed! Expected 200 and twoFactorEnabled: false, got ${res1.status}`);
  }
  console.log("✓ PASS: 2FA disabled successfully via { enabled: false }");

  // Test 2: SUPER_ADMIN turns ON 2FA using PATCH /api/users/:id/2fa with { twoFactorEnabled: true }
  console.log("\n--- TEST 2: PATCH /api/users/:id/2fa with { twoFactorEnabled: true } ---");
  const res2 = await fetch(`${BASE_URL}/api/users/${tech.id}/2fa`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ twoFactorEnabled: true })
  });
  const data2 = await res2.json();
  console.log(`HTTP Status: ${res2.status}`, data2);
  if (res2.status !== 200 || data2.twoFactorEnabled !== true) {
    throw new Error(`Test 2 Failed! Expected 200 and twoFactorEnabled: true, got ${res2.status}`);
  }
  console.log("✓ PASS: 2FA enabled successfully via { twoFactorEnabled: true }");

  // Test 3: SUPER_ADMIN turns OFF 2FA using POST /api/users/:id/2fa
  console.log("\n--- TEST 3: POST /api/users/:id/2fa with { twoFactorEnabled: false } ---");
  const res3 = await fetch(`${BASE_URL}/api/users/${tech.id}/2fa`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ twoFactorEnabled: false })
  });
  const data3 = await res3.json();
  console.log(`HTTP Status: ${res3.status}`, data3);
  if (res3.status !== 200 || data3.twoFactorEnabled !== false) {
    throw new Error(`Test 3 Failed! Expected 200 and twoFactorEnabled: false, got ${res3.status}`);
  }
  console.log("✓ PASS: 2FA disabled successfully via POST alias");

  // Test 4: Unauthorized User (Technician attempting to change 2FA) -> 403
  console.log("\n--- TEST 4: Unauthorized Access (Technician role) ---");
  const res4 = await fetch(`${BASE_URL}/api/users/${admin.id}/2fa`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${techToken}`
    },
    body: JSON.stringify({ enabled: false })
  });
  const data4 = await res4.json();
  console.log(`HTTP Status: ${res4.status}`, data4);
  if (res4.status !== 403) {
    throw new Error(`Test 4 Failed! Expected 403 Forbidden, got ${res4.status}`);
  }
  console.log("✓ PASS: Properly rejected unauthorized request with 403");

  // Test 5: Invalid User ID -> 404
  console.log("\n--- TEST 5: Invalid User ID ---");
  const res5 = await fetch(`${BASE_URL}/api/users/non-existent-uuid-12345/2fa`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ enabled: false })
  });
  const data5 = await res5.json();
  console.log(`HTTP Status: ${res5.status}`, data5);
  if (res5.status !== 404) {
    throw new Error(`Test 5 Failed! Expected 404 Not Found, got ${res5.status}`);
  }
  console.log("✓ PASS: Properly returned 404 for non-existent user");

  // Test 6: Invalid Payload -> 400
  console.log("\n--- TEST 6: Invalid Payload ---");
  const res6 = await fetch(`${BASE_URL}/api/users/${tech.id}/2fa`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ enabled: "not-a-boolean" })
  });
  const data6 = await res6.json();
  console.log(`HTTP Status: ${res6.status}`, data6);
  if (res6.status !== 400) {
    throw new Error(`Test 6 Failed! Expected 400 Bad Request, got ${res6.status}`);
  }
  console.log("✓ PASS: Properly returned 400 for invalid payload");

  // Test 7: Direct login verification when 2FA is OFF
  console.log("\n--- TEST 7: Direct Login Verification (2FA OFF) ---");
  // Ensure 2FA is OFF
  await fetch(`${BASE_URL}/api/users/${tech.id}/2fa`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ enabled: false })
  });

  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: tech.email,
      password: "Password123!"
    })
  });
  const loginData = await loginRes.json();
  console.log(`Login response status: ${loginRes.status}`, {
    success: loginData.success,
    mfaRequired: loginData.mfaRequired,
    hasToken: Boolean(loginData.token)
  });
  if (!loginData.success || loginData.mfaRequired !== false || !loginData.token) {
    throw new Error("Test 7 Failed! Expected direct login without MFA!");
  }
  console.log("✓ PASS: Direct login succeeded without OTP when 2FA is disabled");

  console.log("\n==================================================");
  console.log("🎉 ALL LIVE HTTP API 2FA ENDPOINT TESTS PASSED!");
  console.log("==================================================");
}

testLiveApi()
  .catch(err => {
    console.error("Test failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
