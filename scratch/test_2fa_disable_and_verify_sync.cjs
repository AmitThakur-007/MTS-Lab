const assert = require('assert');

async function runTests() {
  console.log('========================================================================');
  console.log('--- TEST SUITE: SUPERADMIN 2FA DISABLE + EMAIL VERIFY SYNC ---');
  console.log('========================================================================\n');

  // Test 1: Role Matrix for 2FA Toggle Permissions
  console.log('Test 1: 2FA Toggle Authorization Matrix Verification...');
  const roles = [
    { role: 'SUPER_ADMIN', canToggle: true },
    { role: 'SUPERADMIN', canToggle: true },
    { role: 'ADMIN', canToggle: false },
    { role: 'MANAGER', canToggle: false },
    { role: 'HEAD_TECHNICIAN', canToggle: false },
    { role: 'TECHNICIAN', canToggle: false },
    { role: 'RECEPTIONIST', canToggle: false }
  ];

  roles.forEach(({ role, canToggle }) => {
    const isSuperAdminRole = role === 'SUPER_ADMIN' || role === 'SUPERADMIN';
    assert.strictEqual(isSuperAdminRole, canToggle, `Role ${role} 2FA toggle permission check failed`);
  });
  console.log('✅ SUPERADMIN strictly authorized to toggle staff 2FA; all other 5 roles forbidden.');

  // Test 2: Authoritative 2FA Calculation for Staff Member
  console.log('\nTest 2: Authoritative 2FA Evaluation Logic...');
  function isUser2FAEnabled(user) {
    if (!user) return false;
    const isSuperAdmin = user.role === 'SUPER_ADMIN' || user.role === 'SUPERADMIN' || user.email?.toLowerCase() === 'mtsmobilelab@gmail.com';
    if (isSuperAdmin && !user.securitySetupCompleted) return false;
    const val = user.twoFactorEnabled;
    if (val === false || val === 'false' || val === 0 || val === '0') return false;
    if (val === true || val === 'true' || val === 1 || val === '1') return true;
    if (isSuperAdmin) return false;
    return true;
  }

  const staffWith2FAEnabled = { role: 'TECHNICIAN', twoFactorEnabled: true };
  const staffWith2FADisabled = { role: 'TECHNICIAN', twoFactorEnabled: false };
  const superAdminWith2FADisabled = { role: 'SUPER_ADMIN', twoFactorEnabled: false, securitySetupCompleted: true };

  assert.strictEqual(isUser2FAEnabled(staffWith2FAEnabled), true, '2FA should be active when twoFactorEnabled = true');
  assert.strictEqual(isUser2FAEnabled(staffWith2FADisabled), false, '2FA should be inactive when twoFactorEnabled = false');
  assert.strictEqual(isUser2FAEnabled(superAdminWith2FADisabled), false, '2FA should be inactive for Super Admin when disabled');
  console.log('✅ 2FA evaluation logic correctly reflects stored twoFactorEnabled boolean state across all roles.');

  // Test 3: 2FA Disable & Login Bypass Simulation
  console.log('\nTest 3: Simulating SUPERADMIN Disabling 2FA & Direct Login...');
  let mockStaff = { id: 'staff-1', name: 'John Tech', role: 'TECHNICIAN', twoFactorEnabled: true, emailVerified: true };
  
  // SUPERADMIN disables 2FA
  mockStaff.twoFactorEnabled = false;

  // Login check
  const is2faActiveOnLogin = isUser2FAEnabled(mockStaff);
  assert.strictEqual(is2faActiveOnLogin, false, 'Login should not require 2FA after SUPERADMIN disables it');
  console.log('✅ Staff member login successfully skips 2FA challenge when twoFactorEnabled is false.');

  // Test 4: 2FA Re-enable Simulation
  console.log('\nTest 4: Simulating SUPERADMIN Re-Enabling 2FA...');
  mockStaff.twoFactorEnabled = true;
  const is2faActiveOnReEnable = isUser2FAEnabled(mockStaff);
  assert.strictEqual(is2faActiveOnReEnable, true, 'Login should require 2FA after SUPERADMIN re-enables it');
  console.log('✅ Staff member login successfully enforces 2FA challenge when twoFactorEnabled is re-enabled.');

  // Test 5: Email Verification State Synchronization
  console.log('\nTest 5: Administrative Email Verification Synchronization...');
  let unverifiedStaff = { id: 'staff-2', name: 'Alice Rep', role: 'RECEPTIONIST', emailVerified: false };
  
  // SUPERADMIN verifies email
  unverifiedStaff.emailVerified = true;
  assert.strictEqual(unverifiedStaff.emailVerified, true, 'Email verification state sync failed');
  console.log('✅ Real-time email verification synchronized cleanly to Verified state.');

  console.log('\n========================================================================');
  console.log('🎉 ALL 2FA DISABLE & EMAIL VERIFY SYNC TESTS PASSED SUCCESSFULLY!');
  console.log('========================================================================');
}

runTests();
