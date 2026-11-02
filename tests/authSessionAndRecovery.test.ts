import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

test('1. AuthStore tracks Zustand hydration and manages lastActivity timestamps', () => {
  const authStorePath = path.join(projectRoot, 'src/store/authStore.ts');
  assert.ok(fs.existsSync(authStorePath), 'authStore.ts must exist');

  const content = fs.readFileSync(authStorePath, 'utf-8');

  // Verify hasHydrated interface & state
  assert.ok(content.includes('hasHydrated: boolean;'), 'AuthState includes hasHydrated property');
  assert.ok(content.includes('setHasHydrated: (hasHydrated: boolean) => void;'), 'AuthState includes setHasHydrated action');
  assert.ok(content.includes('hasHydrated: false,'), 'Initial hasHydrated state is false');
  assert.ok(content.includes('onRehydrateStorage: () => (state) => {'), 'Configures onRehydrateStorage callback in persist middleware');
  assert.ok(content.includes('state?.setHasHydrated(true);'), 'Sets hasHydrated to true upon hydration completion');

  // Verify timestamp handling
  assert.ok(content.includes("localStorage.setItem('mts_last_activity', String(Date.now()))"), 'setAuth sets mts_last_activity timestamp');
  assert.ok(content.includes("localStorage.removeItem('mts_last_activity')"), 'logout clears mts_last_activity timestamp');
});

test('2. InactivityGuard resets stale or expired timestamps on session mount', () => {
  const inactivityGuardPath = path.join(projectRoot, 'src/components/InactivityGuard.tsx');
  assert.ok(fs.existsSync(inactivityGuardPath), 'InactivityGuard.tsx must exist');

  const content = fs.readFileSync(inactivityGuardPath, 'utf-8');

  // Must check if stored timestamp is missing or older than timeout
  assert.ok(
    content.includes('now - storedTs >= INACTIVITY_TIMEOUT_MS'),
    'InactivityGuard checks if stored timestamp is stale on mount'
  );
  assert.ok(
    content.includes('setLastActivity(now)'),
    'InactivityGuard resets timestamp to current time for active session'
  );
});

test('3. ProtectedRoute blocks premature redirection until store hydration finishes', () => {
  const appPath = path.join(projectRoot, 'src/App.tsx');
  const content = fs.readFileSync(appPath, 'utf-8');

  assert.ok(content.includes('hasHydrated'), 'ProtectedRoute reads hasHydrated from useAuthStore');
  assert.ok(
    content.includes('if (!hasHydrated)'),
    'ProtectedRoute checks !hasHydrated before checking token or user'
  );
  assert.ok(
    content.includes('Restoring secure session') || content.includes('Restoring session'),
    'Renders a clean session restoration loader while hydrating'
  );
  // Ensure token check happens AFTER hasHydrated
  const hydrationCheckIndex = content.indexOf('if (!hasHydrated)');
  const tokenCheckIndex = content.indexOf('if (!token || !user)');
  assert.ok(hydrationCheckIndex !== -1 && tokenCheckIndex !== -1, 'Both checks present');
  assert.ok(hydrationCheckIndex < tokenCheckIndex, 'Hydration check precedes token evaluation');
});

test('4. Backend /api/auth/forgot-password validates staff eligibility against Staff Management DB', () => {
  const routePath = path.join(projectRoot, 'api/_server/routes/auth.ts');
  const content = fs.readFileSync(routePath, 'utf-8');

  const expectedMessage =
    'Invalid email address. Please enter the email registered with your staff account.';

  assert.ok(
    content.includes(expectedMessage),
    'Backend returns exact invalid staff email validation message'
  );
  assert.ok(
    content.includes('AUTHORIZED_STAFF_ROLES'),
    'Backend validates user against AUTHORIZED_STAFF_ROLES'
  );
  assert.ok(
    content.includes('.is(\'deletedAt\', null)'),
    'Backend excludes soft-deleted accounts'
  );
});

test('5. Frontend ForgotPassword page enforces staff-only recovery and requires registered staff email', () => {
  const forgotPath = path.join(projectRoot, 'src/pages/ForgotPassword.tsx');
  const content = fs.readFileSync(forgotPath, 'utf-8');

  // Verify staff email requirement
  assert.ok(
    content.includes('Staff Email Address'),
    'Frontend specifies Staff Email Address requirement'
  );
  assert.ok(
    content.includes('Invalid email address. Please enter the email registered with your staff account.'),
    'Frontend includes exact staff email error message'
  );
  assert.ok(
    content.includes('recovery-email-error'),
    'Frontend provides recovery-email-error accessibility ID'
  );

  // Verify BrandLogo integration and OTP countdowns
  assert.ok(content.includes('BrandLogo'), 'ForgotPassword imports and renders BrandLogo');
  assert.ok(content.includes('formatExpiryTime'), 'Has timer formatting helper for OTP expiration');
  assert.ok(content.includes('resendCooldown'), 'Has resend cooldown timer');
});

test('6. ResetPassword page validates token and enforces security policies', () => {
  const resetPath = path.join(projectRoot, 'src/pages/ResetPassword.tsx');
  const content = fs.readFileSync(resetPath, 'utf-8');

  assert.ok(content.includes('BrandLogo'), 'ResetPassword imports and renders BrandLogo');
  assert.ok(content.includes('resetToken = location.state?.resetToken'), 'Extracts resetToken from route location state');
  assert.ok(content.includes('newPassword.length >= 8'), 'Enforces 8-character minimum password length');
  assert.ok(content.includes('newPassword !== confirmPassword'), 'Validates password confirmation match');
  assert.ok(content.includes('/auth/reset-password'), 'Calls reset password API endpoint');
});

test('7. Multi-role dashboard access preservation in ProtectedRoute', () => {
  const appPath = path.join(projectRoot, 'src/App.tsx');
  const content = fs.readFileSync(appPath, 'utf-8');

  // Customer role is routed to /track
  assert.ok(
    content.includes("if (user.role === 'CUSTOMER')"),
    'Customer role is redirected to public tracking'
  );
  assert.ok(
    content.includes('<Navigate to="/track" replace />'),
    'Redirects customers cleanly to /track'
  );

  // Other staff roles (SUPER_ADMIN, ADMIN, MANAGER, LEAD_TECHNICIAN, TECHNICIAN, TECHNICAL_ASSISTANT, RECEPTIONIST, INVENTORY_MANAGER, ACCOUNTANT)
  // are retained and not unexpectedly logged out
  assert.ok(content.includes('roles && !roles.includes(user.role)'), 'Role validation separates authorization from authentication');
});

test('8. Login and ForgotPassword use generic placeholders without staff-specific emails', () => {
  const loginPath = path.join(projectRoot, 'src/pages/Login.tsx');
  const forgotPath = path.join(projectRoot, 'src/pages/ForgotPassword.tsx');

  const loginContent = fs.readFileSync(loginPath, 'utf-8');
  const forgotContent = fs.readFileSync(forgotPath, 'utf-8');

  // Verify generic placeholders
  assert.ok(
    loginContent.includes('placeholder="Enter your email or username"'),
    'Login email/username field has generic placeholder'
  );
  assert.ok(
    forgotContent.includes('placeholder="Enter your email address"'),
    'ForgotPassword email field has generic placeholder'
  );

  // Verify complete elimination of hardcoded/staff-specific placeholders
  assert.ok(!loginContent.includes('technician@mtslab.com'), 'Login does not contain technician@mtslab.com');
  assert.ok(!loginContent.includes('staff@mtslab.com'), 'Login does not contain staff@mtslab.com');
  assert.ok(!forgotContent.includes('technician@mtslab.com'), 'ForgotPassword does not contain technician@mtslab.com');
  assert.ok(!forgotContent.includes('staff@mtslab.com'), 'ForgotPassword does not contain staff@mtslab.com');
});

test('9. Authentication cards integrate with global Theme Controller and eliminate hardcoded dark overlays', () => {
  const loginPath = path.join(projectRoot, 'src/pages/Login.tsx');
  const forgotPath = path.join(projectRoot, 'src/pages/ForgotPassword.tsx');

  const loginContent = fs.readFileSync(loginPath, 'utf-8');
  const forgotContent = fs.readFileSync(forgotPath, 'utf-8');

  // Verify useAppTheme integration
  assert.ok(loginContent.includes('useAppTheme'), 'Login imports useAppTheme');
  assert.ok(forgotContent.includes('useAppTheme'), 'ForgotPassword imports useAppTheme');

  // Verify semantic theme tokens on main page and cards
  assert.ok(loginContent.includes('bg-background'), 'Login uses bg-background');
  assert.ok(loginContent.includes('text-foreground'), 'Login uses text-foreground');
  assert.ok(loginContent.includes('bg-card'), 'Login card uses bg-card');
  assert.ok(loginContent.includes('text-card-foreground'), 'Login card uses text-card-foreground');
  assert.ok(loginContent.includes('border-border'), 'Login uses border-border');

  assert.ok(forgotContent.includes('bg-background'), 'ForgotPassword uses bg-background');
  assert.ok(forgotContent.includes('text-foreground'), 'ForgotPassword uses text-foreground');
  assert.ok(forgotContent.includes('bg-card'), 'ForgotPassword card uses bg-card');
  assert.ok(forgotContent.includes('text-card-foreground'), 'ForgotPassword card uses text-card-foreground');
  assert.ok(forgotContent.includes('border-border'), 'ForgotPassword uses border-border');

  // Verify transparent/seamless card footers without dark overlay bands
  assert.ok(
    loginContent.includes('CardFooter className="px-6 sm:px-8 pb-8 pt-3 flex flex-col gap-3 bg-transparent"'),
    'Login CardFooter has bg-transparent with no horizontal color band'
  );
  assert.ok(
    forgotContent.includes('CardFooter className="px-6 sm:px-8 pb-8 pt-3 flex flex-col gap-3 bg-transparent"'),
    'ForgotPassword CardFooter has bg-transparent with no horizontal color band'
  );
});

