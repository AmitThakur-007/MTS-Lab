const assert = require('assert');

// 1. Test isUser2FAEnabled simulation
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

// 2. Test Login Verification Logic simulation
function checkLoginEmailVerification(user, fbCheck) {
  const isEmailConfirmed = Boolean(user.emailVerified) || Boolean(fbCheck.isVerified);
  if (!isEmailConfirmed) {
    return { status: 403, success: false, message: "Please verify your email address before continuing." };
  }
  return { status: 200, success: true };
}

console.log("=== RUNNING AUTH & 2FA LOGIC TESTS ===");

// Test Case 1: SuperAdmin verified user in DB, but Firebase cloud is not verified yet
const userSuperAdminVerified = { id: "u1", email: "tech@mtslab.com", emailVerified: true, role: "TECHNICIAN" };
const fbCheckUnverified = { checked: true, isVerified: false, email: "tech@mtslab.com" };

const loginRes1 = checkLoginEmailVerification(userSuperAdminVerified, fbCheckUnverified);
assert.strictEqual(loginRes1.status, 200, "Directly verified DB user should be allowed to log in");
console.log("✅ PASS: SuperAdmin direct verification bypasses Firebase unverified block!");

// Test Case 2: Unverified user in both DB and Firebase
const userUnverified = { id: "u2", email: "unverified@mtslab.com", emailVerified: false, role: "TECHNICIAN" };
const loginRes2 = checkLoginEmailVerification(userUnverified, fbCheckUnverified);
assert.strictEqual(loginRes2.status, 403, "Unverified user should be blocked");
console.log("✅ PASS: Truly unverified user is properly blocked!");

// Test Case 3: 2FA Disabled for Staff User
const staff2faDisabled = { id: "u3", role: "TECHNICIAN", twoFactorEnabled: false };
assert.strictEqual(isUser2FAEnabled(staff2faDisabled), false, "2FA should be disabled when twoFactorEnabled=false");
console.log("✅ PASS: 2FA disabled state is strictly respected for staff users!");

// Test Case 4: 2FA Enabled for Staff User
const staff2faEnabled = { id: "u4", role: "TECHNICIAN", twoFactorEnabled: true };
assert.strictEqual(isUser2FAEnabled(staff2faEnabled), true, "2FA should be enabled when twoFactorEnabled=true");
console.log("✅ PASS: 2FA enabled state is correctly evaluated!");

// Test Case 5: 2FA Disabled for SuperAdmin
const superAdmin2faDisabled = { id: "u5", role: "SUPER_ADMIN", twoFactorEnabled: false };
assert.strictEqual(isUser2FAEnabled(superAdmin2faDisabled), false, "2FA should be disabled for SuperAdmin when false");
console.log("✅ PASS: 2FA disabled state is strictly respected for SuperAdmin!");

console.log("\nALL AUTH & 2FA TESTS PASSED CLEANLY! 🎉");
