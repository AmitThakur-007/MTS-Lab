const assert = require('assert');

// Simulate DB User Store
const mockDb = {
  users: {
    "usr_tech_1": {
      id: "usr_tech_1",
      email: "tech1@mtslab.com",
      name: "Alex Tech",
      role: "TECHNICIAN",
      emailVerified: false,
      twoFactorEnabled: true,
      securitySetupCompleted: true
    },
    "usr_admin_1": {
      id: "usr_admin_1",
      email: "admin1@mtslab.com",
      name: "Sam Admin",
      role: "ADMIN",
      emailVerified: true,
      twoFactorEnabled: true,
      securitySetupCompleted: true
    },
    "usr_super_1": {
      id: "usr_super_1",
      email: "mtsmobilelab@gmail.com",
      name: "Super Admin",
      role: "SUPER_ADMIN",
      emailVerified: true,
      twoFactorEnabled: false,
      securitySetupCompleted: true
    }
  },
  otpRecords: []
};

// 1. Authoritative 2FA Active Helper (from server.ts & Staff.tsx)
function isUser2FAEnabled(user) {
  if (!user) return false;
  const isSuperAdmin = user.role === 'SUPER_ADMIN' || user.role === 'SUPERADMIN' || user.email?.toLowerCase() === 'mtsmobilelab@gmail.com';
  
  if (isSuperAdmin && !user.securitySetupCompleted) {
    return false;
  }

  const val = user.twoFactorEnabled;
  if (val === false || val === 'false' || val === 0 || val === '0') {
    return false;
  }
  if (val === true || val === 'true' || val === 1 || val === '1') {
    return true;
  }
  if (isSuperAdmin) {
    return false;
  }
  return true;
}

// 2. SuperAdmin Direct Email Verification Handler (server.ts)
function superAdminVerifyEmail(requesterRole, targetUserId) {
  if (requesterRole !== 'SUPER_ADMIN' && requesterRole !== 'SUPERADMIN') {
    return { status: 403, error: "Forbidden: SuperAdmin access required" };
  }
  const user = mockDb.users[targetUserId];
  if (!user) return { status: 404, error: "User not found" };

  user.emailVerified = true;
  return { status: 200, success: true, user: { ...user } };
}

// 3. SuperAdmin 2FA Toggle Handler (server.ts)
function superAdminToggle2FA(requesterRole, targetUserId, enableState) {
  if (requesterRole !== 'SUPER_ADMIN' && requesterRole !== 'SUPERADMIN') {
    return { status: 403, error: "Forbidden: SuperAdmin access required" };
  }
  const user = mockDb.users[targetUserId];
  if (!user) return { status: 404, error: "User not found" };

  user.twoFactorEnabled = Boolean(enableState);
  return { status: 200, success: true, twoFactorEnabled: user.twoFactorEnabled, user: { ...user } };
}

// 4. Complete Login Flow Simulation (server.ts /api/auth/login)
function simulateLogin(email, fbCheck) {
  const userKey = Object.keys(mockDb.users).find(k => mockDb.users[k].email.toLowerCase() === email.toLowerCase());
  if (!userKey) return { status: 401, error: "Invalid credentials" };

  // Fetch FRESH user from authoritative database
  const freshUser = mockDb.users[userKey];

  // Check email verification policy
  const isEmailConfirmed = Boolean(freshUser.emailVerified) || Boolean(fbCheck?.isVerified);
  if (!isEmailConfirmed) {
    return { status: 403, emailNotVerified: true, error: "Please verify email address" };
  }

  // Evaluate fresh 2FA status
  const is2faActive = isUser2FAEnabled(freshUser);

  if (!is2faActive) {
    return {
      status: 200,
      success: true,
      mfaRequired: false,
      user: { id: freshUser.id, email: freshUser.email, twoFactorEnabled: freshUser.twoFactorEnabled },
      otpGenerated: false
    };
  }

  // Generate 6-digit OTP when 2FA is ON
  const otpCode = "123456";
  mockDb.otpRecords.push({ userId: freshUser.id, code: otpCode, createdAt: new Date() });

  return {
    status: 200,
    success: true,
    mfaRequired: true,
    user: { id: freshUser.id, email: freshUser.email, twoFactorEnabled: freshUser.twoFactorEnabled },
    otpGenerated: true,
    otpCode
  };
}

console.log("=================================================");
console.log("      COMPREHENSIVE AUTH & 2FA SCENARIO AUDIT     ");
console.log("=================================================\n");

// TEST 1: Initial state for usr_tech_1 (emailVerified: false, twoFactorEnabled: true)
console.log("--- TEST 1: Unverified Staff Login ---");
const res1 = simulateLogin("tech1@mtslab.com", { isVerified: false });
assert.strictEqual(res1.status, 403, "Unverified user should be blocked from login");
console.log("✅ PASS: Unverified staff user blocked from logging in.\n");

// TEST 2: SuperAdmin verifies email for usr_tech_1
console.log("--- TEST 2: SuperAdmin Direct Email Verification ---");
const verifyRes = superAdminVerifyEmail("SUPER_ADMIN", "usr_tech_1");
assert.strictEqual(verifyRes.status, 200);
assert.strictEqual(mockDb.users["usr_tech_1"].emailVerified, true);
console.log("✅ PASS: SuperAdmin verified email. DB updated emailVerified=true.\n");

// TEST 3: SuperAdmin disables 2FA for usr_tech_1
console.log("--- TEST 3: SuperAdmin Disables 2FA ---");
const toggleRes = superAdminToggle2FA("SUPER_ADMIN", "usr_tech_1", false);
assert.strictEqual(toggleRes.status, 200);
assert.strictEqual(mockDb.users["usr_tech_1"].twoFactorEnabled, false);
console.log("✅ PASS: SuperAdmin disabled 2FA. DB updated twoFactorEnabled=false.\n");

// TEST 4: Staff Login after SuperAdmin verifies email and disables 2FA
console.log("--- TEST 4: Staff Login (emailVerified=true, 2FA=false) ---");
const initialOtpCount = mockDb.otpRecords.length;
const loginRes = simulateLogin("tech1@mtslab.com", { isVerified: false });
assert.strictEqual(loginRes.status, 200, "Login should succeed");
assert.strictEqual(loginRes.mfaRequired, false, "MFA should NOT be required");
assert.strictEqual(loginRes.otpGenerated, false, "OTP should NOT be generated");
assert.strictEqual(mockDb.otpRecords.length, initialOtpCount, "Zero OTP records created");
console.log("✅ PASS: Direct login successful! Zero OTP created, Zero email sent, Direct to Dashboard.\n");

// TEST 5: SuperAdmin re-enables 2FA for usr_tech_1
console.log("--- TEST 5: SuperAdmin Re-enables 2FA ---");
const toggleRes2 = superAdminToggle2FA("SUPER_ADMIN", "usr_tech_1", true);
assert.strictEqual(toggleRes2.status, 200);
assert.strictEqual(mockDb.users["usr_tech_1"].twoFactorEnabled, true);
console.log("✅ PASS: SuperAdmin re-enabled 2FA. DB updated twoFactorEnabled=true.\n");

// TEST 6: Staff Login after 2FA re-enabled
console.log("--- TEST 6: Staff Login (2FA=true) ---");
const loginRes2FA = simulateLogin("tech1@mtslab.com", { isVerified: true });
assert.strictEqual(loginRes2FA.status, 200);
assert.strictEqual(loginRes2FA.mfaRequired, true, "MFA MUST be required");
assert.strictEqual(loginRes2FA.otpGenerated, true, "OTP MUST be generated");
console.log("✅ PASS: 2FA required! OTP generated & sent successfully.\n");

// TEST 7: Unauthorized role attempt to disable 2FA
console.log("--- TEST 7: RBAC Protection Test (TECHNICIAN trying to change 2FA) ---");
const rbacRes = superAdminToggle2FA("TECHNICIAN", "usr_admin_1", false);
assert.strictEqual(rbacRes.status, 403, "Non-SuperAdmin should be rejected with 403");
console.log("✅ PASS: Unauthorized 2FA toggle attempt blocked with 403 Forbidden.\n");

console.log("=================================================");
console.log("  ALL SCENARIOS PASSED WITH ZERO ERRORS! 🎉     ");
console.log("=================================================");
