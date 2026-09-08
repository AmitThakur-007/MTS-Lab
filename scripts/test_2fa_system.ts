import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'mts-lab-super-secret-key';
const BASE_URL = 'http://localhost:3000';

async function run2FASuite() {
  console.log("================================================================================");
  console.log("MTS LAB — 2FA ENABLE / DISABLE AUTOMATED TEST SUITE FOR ALL USER ROLES");
  console.log("================================================================================");

  const testPassword = "Password123!";
  const hashedPassword = await bcrypt.hash(testPassword, 10);

  // 1. Ensure test users exist for all roles
  const testRoles = [
    { role: 'SUPER_ADMIN', email: 'superadmin.2fa.test@mtslab.local', name: 'Super Admin Tester', username: 'sa_2fa_test' },
    { role: 'ADMIN', email: 'admin.2fa.test@mtslab.local', name: 'Admin Tester', username: 'adm_2fa_test' },
    { role: 'RECEPTIONIST', email: 'receptionist.2fa.test@mtslab.local', name: 'Receptionist Tester', username: 'rec_2fa_test' },
    { role: 'LEAD_TECHNICIAN', email: 'leadtech.2fa.test@mtslab.local', name: 'Lead Tech Tester', username: 'lt_2fa_test' },
    { role: 'TECHNICIAN', email: 'tech.2fa.test@mtslab.local', name: 'Technician Tester', username: 'tech_2fa_test' },
    { role: 'TECHNICAL_ASSISTANT', email: 'assistant.2fa.test@mtslab.local', name: 'Tech Assistant Tester', username: 'ta_2fa_test' },
  ];

  const userMap: Record<string, any> = {};

  for (const u of testRoles) {
    let existing = await prisma.user.findFirst({ where: { email: u.email } });
    if (!existing) {
      existing = await prisma.user.create({
        data: {
          name: u.name,
          email: u.email,
          username: u.username,
          password: hashedPassword,
          role: u.role,
          isActive: true,
          emailVerified: true,
          accountStatus: 'ACTIVE',
          twoFactorEnabled: true,
          twoFactorType: 'EMAIL'
        }
      });
    } else {
      existing = await prisma.user.update({
        where: { id: existing.id },
        data: {
          password: hashedPassword,
          isActive: true,
          emailVerified: true,
          accountStatus: 'ACTIVE',
          twoFactorEnabled: true,
          twoFactorType: 'EMAIL'
        }
      });
    }
    userMap[u.role] = existing;
  }

  const superAdmin = userMap['SUPER_ADMIN'];
  const superAdminToken = jwt.sign(
    { id: superAdmin.id, userId: superAdmin.id, email: superAdmin.email, role: superAdmin.role, name: superAdmin.name },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const receptionist = userMap['RECEPTIONIST'];
  const receptionistToken = jwt.sign(
    { id: receptionist.id, userId: receptionist.id, email: receptionist.email, role: receptionist.role, name: receptionist.name },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  console.log(`✓ Setup ${testRoles.length} test accounts across all system roles.`);

  // -------------------------------------------------------------------------
  // TEST SUITE 1: SUPER ADMIN DISABLES 2FA FOR RECEPTIONIST
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 1: Super Admin disables 2FA for RECEPTIONIST ---");
  const disableRecRes = await fetch(`${BASE_URL}/api/users/${receptionist.id}/2fa`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${superAdminToken}`
    },
    body: JSON.stringify({ twoFactorEnabled: false })
  });

  const disableRecData = await disableRecRes.json();
  console.log(`Toggle response: status=${disableRecRes.status}`, disableRecData);
  if (disableRecRes.status !== 200 || disableRecData.twoFactorEnabled !== false) {
    throw new Error(`Test 1 Failed! Expected status 200 and twoFactorEnabled: false, got ${disableRecRes.status}`);
  }

  // Verify DB state
  const dbRec1 = await prisma.user.findUnique({ where: { id: receptionist.id } });
  if (!dbRec1 || dbRec1.twoFactorEnabled !== false) {
    throw new Error(`Test 1 DB Check Failed! DB twoFactorEnabled is ${dbRec1?.twoFactorEnabled}`);
  }
  console.log("✓ PASS: 2FA disabled in DB for Receptionist.");

  // -------------------------------------------------------------------------
  // TEST SUITE 2: RECEPTIONIST LOGS IN WITH 2FA DISABLED (DIRECT LOGIN, NO OTP)
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 2: Receptionist Login with 2FA DISABLED (Must NOT ask for OTP) ---");
  const recLogin1Res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identity: receptionist.email,
      password: testPassword,
      device: { deviceIdentifier: 'test_dev_rec_1', browser: 'Chrome', os: 'Windows' }
    })
  });

  const recLogin1Data = await recLogin1Res.json();
  console.log(`Login response: status=${recLogin1Res.status}`, {
    success: recLogin1Data.success,
    mfaRequired: recLogin1Data.mfaRequired,
    hasToken: Boolean(recLogin1Data.token),
    user: recLogin1Data.user?.email
  });

  if (!recLogin1Data.success || recLogin1Data.mfaRequired !== false || !recLogin1Data.token) {
    throw new Error("Test 2 Failed! Receptionist was prompted for 2FA or did not receive token on 2FA disabled login!");
  }
  console.log("✓ PASS: Receptionist logged in directly with password only. No OTP code was requested!");

  // -------------------------------------------------------------------------
  // TEST SUITE 3: SUPER ADMIN ENABLES 2FA FOR RECEPTIONIST
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 3: Super Admin enables 2FA for RECEPTIONIST ---");
  const enableRecRes = await fetch(`${BASE_URL}/api/users/${receptionist.id}/2fa`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${superAdminToken}`
    },
    body: JSON.stringify({ twoFactorEnabled: true })
  });

  const enableRecData = await enableRecRes.json();
  console.log(`Toggle response: status=${enableRecRes.status}`, enableRecData);
  if (enableRecRes.status !== 200 || enableRecData.twoFactorEnabled !== true) {
    throw new Error(`Test 3 Failed! Expected status 200 and twoFactorEnabled: true, got ${enableRecRes.status}`);
  }

  // Verify DB state
  const dbRec2 = await prisma.user.findUnique({ where: { id: receptionist.id } });
  if (!dbRec2 || dbRec2.twoFactorEnabled !== true) {
    throw new Error(`Test 3 DB Check Failed! DB twoFactorEnabled is ${dbRec2?.twoFactorEnabled}`);
  }
  console.log("✓ PASS: 2FA enabled in DB for Receptionist.");

  // -------------------------------------------------------------------------
  // TEST SUITE 4: RECEPTIONIST LOGS IN WITH 2FA ENABLED (MUST REQUEST OTP)
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 4: Receptionist Login with 2FA ENABLED (Must request OTP) ---");
  const recLogin2Res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identity: receptionist.email,
      password: testPassword,
      device: { deviceIdentifier: 'test_dev_rec_1', browser: 'Chrome', os: 'Windows' }
    })
  });

  const recLogin2Data = await recLogin2Res.json();
  console.log(`Login response: status=${recLogin2Res.status}`, {
    success: recLogin2Data.success,
    mfaRequired: recLogin2Data.mfaRequired,
    hasTicket: Boolean(recLogin2Data.mfaTicket),
    emailMasked: recLogin2Data.emailMasked
  });

  if (!recLogin2Data.success || recLogin2Data.mfaRequired !== true || !recLogin2Data.mfaTicket) {
    throw new Error("Test 4 Failed! Receptionist was NOT prompted for 2FA verification code when 2FA is ON!");
  }
  console.log("✓ PASS: Receptionist correctly challenged with 2FA OTP verification on login!");

  // -------------------------------------------------------------------------
  // TEST SUITE 5: TEST 2FA TOGGLE & LOGIN FOR ALL OTHER ROLES
  // -------------------------------------------------------------------------
  const rolesToTest = ['ADMIN', 'LEAD_TECHNICIAN', 'TECHNICIAN', 'TECHNICAL_ASSISTANT'];

  for (const role of rolesToTest) {
    const user = userMap[role];
    console.log(`\n--- TEST 5 [${role}]: Testing 2FA OFF -> Login -> 2FA ON -> Login ---`);

    // Turn OFF
    const offRes = await fetch(`${BASE_URL}/api/users/${user.id}/2fa`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${superAdminToken}`
      },
      body: JSON.stringify({ twoFactorEnabled: false })
    });
    if (offRes.status !== 200) {
      throw new Error(`Failed to turn OFF 2FA for role ${role}`);
    }

    // Login (Must be direct)
    const logOffRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identity: user.email,
        password: testPassword,
        device: { deviceIdentifier: `dev_${role}` }
      })
    });
    const logOffData = await logOffRes.json();
    if (!logOffData.success || logOffData.mfaRequired !== false || !logOffData.token) {
      throw new Error(`Direct login failed for role ${role} when 2FA is OFF!`);
    }
    console.log(`✓ PASS: ${role} direct login succeeded without OTP when 2FA is OFF.`);

    // Turn ON
    const onRes = await fetch(`${BASE_URL}/api/users/${user.id}/2fa`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${superAdminToken}`
      },
      body: JSON.stringify({ twoFactorEnabled: true })
    });
    if (onRes.status !== 200) {
      throw new Error(`Failed to turn ON 2FA for role ${role}`);
    }

    // Login (Must require OTP)
    const logOnRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identity: user.email,
        password: testPassword,
        device: { deviceIdentifier: `dev_${role}` }
      })
    });
    const logOnData = await logOnRes.json();
    if (!logOnData.success || logOnData.mfaRequired !== true || !logOnData.mfaTicket) {
      throw new Error(`2FA OTP challenge failed for role ${role} when 2FA is ON!`);
    }
    console.log(`✓ PASS: ${role} OTP challenge succeeded when 2FA is ON.`);
  }

  // -------------------------------------------------------------------------
  // TEST SUITE 6: UNAUTHORIZED ROLE ACCESS PROTECTION (403 FORBIDDEN)
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 6: Security Protection (Non-SuperAdmin attempting to toggle 2FA) ---");
  const unauthRes = await fetch(`${BASE_URL}/api/users/${userMap['TECHNICIAN'].id}/2fa`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${receptionistToken}`
    },
    body: JSON.stringify({ twoFactorEnabled: false })
  });

  console.log(`Unauthorized attempt status: ${unauthRes.status}`);
  if (unauthRes.status !== 403) {
    throw new Error(`Test 6 Failed! Expected 403 Forbidden for non-superadmin, got ${unauthRes.status}`);
  }
  console.log("✓ PASS: Non-superadmin correctly blocked with 403 Forbidden.");

  // -------------------------------------------------------------------------
  // TEST SUITE 7: SUPER ADMIN 2FA SETTING PROTECTION
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 7: Super Admin Self vs Other Admin 2FA Protection ---");
  // Super admin can change their own 2FA
  const saSelfRes = await fetch(`${BASE_URL}/api/users/${superAdmin.id}/2fa`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${superAdminToken}`
    },
    body: JSON.stringify({ twoFactorEnabled: true })
  });
  if (saSelfRes.status !== 200) {
    throw new Error(`Test 7 Failed! Super Admin should be able to update their own 2FA setting`);
  }
  console.log("✓ PASS: Super Admin self 2FA update verified.");

  // -------------------------------------------------------------------------
  // TEST SUITE 8: GET /api/auth/me INCLUDES twoFactorEnabled
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 8: GET /api/auth/me includes twoFactorEnabled ---");
  const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { 'Authorization': `Bearer ${superAdminToken}` }
  });
  const meData = await meRes.json();
  if (meRes.status !== 200 || typeof meData.user?.twoFactorEnabled !== 'boolean') {
    throw new Error(`Test 8 Failed! /api/auth/me did not return boolean twoFactorEnabled: ${JSON.stringify(meData)}`);
  }
  console.log(`✓ PASS: /api/auth/me correctly returned twoFactorEnabled: ${meData.user.twoFactorEnabled}`);

  console.log("\n================================================================================");
  console.log("🎉 ALL 2FA ENABLE / DISABLE TESTS PASSED PERFECTLY FOR ALL ROLES!");
  console.log("================================================================================");
}

run2FASuite()
  .catch(err => {
    console.error("\n❌ TEST SUITE FAILURE:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
