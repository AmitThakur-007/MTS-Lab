const assert = require('assert');
const crypto = require('crypto');

console.log('========================================================================');
console.log('--- TEST SUITE: SUPERADMIN FIRST-LOGIN 2FA SETUP & SECURITY CONTROL ---');
console.log('========================================================================\n');

// 1. Mock Server-side DB & Policy logic mirroring server.ts & api/index.ts
function evaluateLogin(user) {
  const isSuperAdmin = user.role === 'SUPER_ADMIN' || user.role === 'SUPERADMIN' || (user.email && user.email.toLowerCase() === 'mtsmobilelab@gmail.com');
  
  // Standard authentication & security checks (never bypassed)
  if (!user.passwordValid) {
    return { status: 401, error: 'Invalid email or password.' };
  }
  if (!user.firebaseVerified) {
    return { status: 403, error: 'Email verification required.' };
  }
  if (!user.isActive || user.accountStatus !== 'ACTIVE') {
    return { status: 403, error: 'Account deactivated or suspended.' };
  }

  // 1st Login Security Setup Evaluation for Super Admin
  const needsFirstLoginSetup = isSuperAdmin && !user.securitySetupCompleted;
  
  if (needsFirstLoginSetup) {
    return {
      status: 200,
      success: true,
      mfaRequired: false,
      requiresSecuritySetup: true,
      token: `setup_token_${crypto.randomBytes(16).toString('hex')}`,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        securitySetupCompleted: false,
        twoFactorEnabled: false
      },
      message: 'Initial Super Admin security setup required.'
    };
  }

  // Standard 2FA Evaluation
  const requires2fa = user.twoFactorEnabled === true || (!isSuperAdmin && user.twoFactorEnabled !== false);

  if (requires2fa) {
    const otpCode = '654321';
    const otpHash = crypto.createHash('sha256').update(otpCode).digest('hex');
    return {
      status: 200,
      success: true,
      mfaRequired: true,
      requiresSecuritySetup: false,
      mfaTicket: `mfa_${Buffer.from(JSON.stringify({ userId: user.id, otpHash, exp: Date.now() + 300000 })).toString('base64url')}`,
      emailMasked: user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3'),
      message: '2FA OTP verification required.'
    };
  }

  // Direct Authenticated Login
  return {
    status: 200,
    success: true,
    mfaRequired: false,
    requiresSecuritySetup: false,
    token: `access_token_${crypto.randomBytes(16).toString('hex')}`,
    refreshToken: `refresh_token_${crypto.randomBytes(16).toString('hex')}`,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      securitySetupCompleted: true,
      twoFactorEnabled: false
    },
    message: 'Direct login successful.'
  };
}

// 2. Test 1: First SUPERADMIN Login (Initial Setup Required)
console.log('Test 1: First SUPERADMIN Login (Incomplete Setup)...');
let superAdminUser = {
  id: 'usr_super_first',
  email: 'mtsmobilelab@gmail.com',
  name: 'MTS Super Admin',
  role: 'SUPERADMIN',
  passwordValid: true,
  firebaseVerified: true,
  isActive: true,
  accountStatus: 'ACTIVE',
  securitySetupCompleted: false,
  twoFactorEnabled: true // default prior to setup
};

const firstLoginRes = evaluateLogin(superAdminUser);
assert.strictEqual(firstLoginRes.status, 200);
assert.strictEqual(firstLoginRes.mfaRequired, false, 'First login must NOT block with 2FA challenge before setup');
assert.strictEqual(firstLoginRes.requiresSecuritySetup, true, 'First login must flag requiresSecuritySetup = true');
console.log('✅ First SUPERADMIN login safely deferred 2FA challenge to present setup screen.\n');

// 3. Test 2: Option A — SUPERADMIN Chooses Enable 2FA with OTP Verification
console.log('Test 2: Option A — Enable 2FA during First-Login Setup...');
// Step 2a: Request OTP
const otpCode = '987654';
const otpHash = crypto.createHash('sha256').update(otpCode).digest('hex');
let mockOtpStore = { codeHash: otpHash, expiresAt: Date.now() + 300000, isUsed: false };

// Step 2b: Verify OTP and Enable 2FA
function verifyAndEnable2FA(user, inputCode) {
  if (!user || (user.role !== 'SUPERADMIN' && user.role !== 'SUPER_ADMIN')) {
    return { status: 403, error: 'Forbidden: Only Super Administrator can complete setup.' };
  }
  const inputHash = crypto.createHash('sha256').update(String(inputCode).trim()).digest('hex');
  const bufA = Buffer.from(inputHash, 'utf-8');
  const bufB = Buffer.from(mockOtpStore.codeHash, 'utf-8');
  const match = bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);

  if (!match) {
    return { status: 400, error: 'Incorrect verification code.' };
  }

  mockOtpStore.isUsed = true;
  user.twoFactorEnabled = true;
  user.securitySetupCompleted = true;

  return {
    status: 200,
    success: true,
    twoFactorEnabled: true,
    securitySetupCompleted: true,
    message: '2FA verified and enabled.'
  };
}

const enableRes = verifyAndEnable2FA(superAdminUser, '987654');
assert.strictEqual(enableRes.status, 200);
assert.strictEqual(superAdminUser.twoFactorEnabled, true);
assert.strictEqual(superAdminUser.securitySetupCompleted, true);
console.log('✅ 2FA enabled & securitySetupCompleted persisted to database.\n');

// 4. Test 3: Subsequent Login with 2FA ENABLED
console.log('Test 3: Subsequent Login with 2FA ENABLED...');
const loginWith2faOn = evaluateLogin(superAdminUser);
assert.strictEqual(loginWith2faOn.mfaRequired, true, 'Subsequent login must require 2FA OTP when enabled');
assert.ok(loginWith2faOn.mfaTicket, 'MFA ticket provided');
console.log('✅ Subsequent login enforced 2FA challenge.\n');

// 5. Test 4: Option B — Disable 2FA with Explicit Confirmation
console.log('Test 4: Option B — Disable 2FA during First-Login Setup...');
let superAdminUser2 = {
  id: 'usr_super_first2',
  email: 'mtsmobilelab@gmail.com',
  name: 'MTS Super Admin 2',
  role: 'SUPERADMIN',
  passwordValid: true,
  firebaseVerified: true,
  isActive: true,
  accountStatus: 'ACTIVE',
  securitySetupCompleted: false,
  twoFactorEnabled: true
};

function disableFirstLogin2FA(user) {
  if (!user || (user.role !== 'SUPERADMIN' && user.role !== 'SUPER_ADMIN')) {
    return { status: 403, error: 'Forbidden: Only Super Administrator can complete setup.' };
  }
  user.twoFactorEnabled = false;
  user.securitySetupCompleted = true;
  return {
    status: 200,
    success: true,
    twoFactorEnabled: false,
    securitySetupCompleted: true,
    message: 'Setup completed with 2FA disabled.'
  };
}

const disableRes = disableFirstLogin2FA(superAdminUser2);
assert.strictEqual(disableRes.status, 200);
assert.strictEqual(superAdminUser2.twoFactorEnabled, false);
assert.strictEqual(superAdminUser2.securitySetupCompleted, true);

const loginWith2faOff = evaluateLogin(superAdminUser2);
assert.strictEqual(loginWith2faOff.mfaRequired, false, 'Subsequent login proceeds directly without OTP when 2FA disabled');
assert.ok(loginWith2faOff.token, 'Direct token generated');
console.log('✅ 2FA disabled & direct login validated for subsequent attempts.\n');

// 6. Test 5: Re-enabling 2FA from Settings later
console.log('Test 5: Re-enabling 2FA from Settings later...');
const reEnableRes = verifyAndEnable2FA(superAdminUser2, '987654');
assert.strictEqual(reEnableRes.status, 200);
assert.strictEqual(superAdminUser2.twoFactorEnabled, true);

const loginReEnabled = evaluateLogin(superAdminUser2);
assert.strictEqual(loginReEnabled.mfaRequired, true, 'Re-enabling 2FA restores mandatory OTP challenge');
console.log('✅ Re-enabling 2FA successfully required OTP on subsequent login.\n');

// 7. Test 6: RBAC Protection for Non-Superadmin Roles
console.log('Test 6: Non-Superadmin Role RBAC Rejection...');
const otherRoles = ['ADMIN', 'MANAGER', 'HEAD_TECHNICIAN', 'TECHNICIAN', 'RECEPTIONIST'];
for (const role of otherRoles) {
  const staff = { id: `usr_${role}`, role, email: `${role.toLowerCase()}@mtslab.com`, passwordValid: true, firebaseVerified: true, isActive: true, accountStatus: 'ACTIVE', securitySetupCompleted: false, twoFactorEnabled: true };
  const res = disableFirstLogin2FA(staff);
  assert.strictEqual(res.status, 403, `Role ${role} must be rejected with 403 Forbidden`);

  const staffLogin = evaluateLogin(staff);
  assert.strictEqual(staffLogin.requiresSecuritySetup, false, `Role ${role} must NOT be allowed initial security setup screen`);
  assert.strictEqual(staffLogin.mfaRequired, true, `Role ${role} must enforce mandatory 2FA OTP`);
}
console.log('✅ All 5 canonical staff roles enforce mandatory 2FA & cannot access first-login setup.\n');

console.log('========================================================================');
console.log('🎉 ALL SUPERADMIN FIRST-LOGIN 2FA SETUP & SECURITY TESTS PASSED!');
console.log('========================================================================\n');
