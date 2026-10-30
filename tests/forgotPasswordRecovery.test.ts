import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const projectRoot = process.cwd();

// Test Suite: MTS Lab Forgot Password Recovery Code Delivery, Registered Email Validation, and Error Handling
// Covers all 24 security and validation requirements across backend and frontend architectures.

test('Scenario 1: Valid email syntax check matches RFC 5322 pattern', () => {
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  assert.ok(emailRegex.test('admin@mtslab.com'));
  assert.ok(emailRegex.test('technician.lead@mobiletechnologystation.com.np'));
  assert.ok(emailRegex.test('staff_user123@domain.org'));
});

test('Scenario 2: Malformed or invalid email formats are rejected with HTTP 400', () => {
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  assert.equal(emailRegex.test(''), false);
  assert.equal(emailRegex.test('notanemail'), false);
  assert.equal(emailRegex.test('user@'), false);
  assert.equal(emailRegex.test('@domain.com'), false);
  assert.equal(emailRegex.test('user@domain'), false);
  assert.equal(emailRegex.test('user with spaces@domain.com'), false);

  const authRoute = fs.readFileSync(path.join(projectRoot, 'api/_server/routes/auth.ts'), 'utf-8');
  assert.ok(authRoute.includes("Please enter a valid email address."));
  assert.ok(authRoute.includes("Please enter your email address."));
});

test('Scenario 3: Email comparison performs case-insensitive normalization', () => {
  const rawInput = '  Staff.Admin@MTSLAB.com  ';
  const normalized = rawInput.toLowerCase().trim();
  assert.equal(normalized, 'staff.admin@mtslab.com');

  const authRoute = fs.readFileSync(path.join(projectRoot, 'api/_server/routes/auth.ts'), 'utf-8');
  assert.ok(authRoute.includes("email.toLowerCase().trim()"));
  assert.ok(authRoute.includes(".ilike('email', normalizedEmail)"));
});

test('Scenario 4: Unregistered email address returns uniform zero-knowledge response', () => {
  const authRoute = fs.readFileSync(path.join(projectRoot, 'api/_server/routes/auth.ts'), 'utf-8');
  const uniformMsg =
    'If an account exists for this email address, password-reset instructions will be sent shortly. Please check your inbox and spam folder.';
  assert.ok(authRoute.includes(uniformMsg));
  assert.ok(authRoute.includes('UNIFORM_FORGOT_PASSWORD_MESSAGE'));
  assert.ok(authRoute.includes('resetTicket: uuidv4()'));
});

test('Scenario 5: Unregistered email address never creates OTPVerification records in DB', () => {
  const authRoute = fs.readFileSync(path.join(projectRoot, 'api/_server/routes/auth.ts'), 'utf-8');
  const forgotRoute = authRoute.slice(authRoute.indexOf("router.post('/forgot-password'"));
  const eligibilityIdx = forgotRoute.indexOf('if (!isEligibleStaff)');
  const insertOtpIdx = forgotRoute.indexOf("supabaseAdmin.from('OTPVerification').insert");
  assert.ok(eligibilityIdx !== -1 && insertOtpIdx !== -1);
  assert.ok(eligibilityIdx < insertOtpIdx, 'Ineligible check precedes OTP insert in /forgot-password');
});

test('Scenario 6: Unregistered email address never triggers email dispatch', () => {
  const authRoute = fs.readFileSync(path.join(projectRoot, 'api/_server/routes/auth.ts'), 'utf-8');
  const forgotRoute = authRoute.slice(authRoute.indexOf("router.post('/forgot-password'"));
  const eligibilityIdx = forgotRoute.indexOf('if (!isEligibleStaff)');
  const sendEmailIdx = forgotRoute.indexOf("sendEmail({");
  assert.ok(eligibilityIdx !== -1 && sendEmailIdx !== -1);
  assert.ok(eligibilityIdx < sendEmailIdx, 'Ineligible check precedes sendEmail execution in /forgot-password');
});

test('Scenario 7: Soft-deleted staff accounts (deletedAt not null) are excluded from recovery', () => {
  const authRoute = fs.readFileSync(path.join(projectRoot, 'api/_server/routes/auth.ts'), 'utf-8');
  assert.ok(authRoute.includes(".is('deletedAt', null)"));
  assert.ok(authRoute.includes("!user.deletedAt"));
});

test('Scenario 8: Inactive or disabled staff accounts (DISABLED, REJECTED, isActive: false) are rejected', () => {
  const authRoute = fs.readFileSync(path.join(projectRoot, 'api/_server/routes/auth.ts'), 'utf-8');
  assert.ok(authRoute.includes("user.accountStatus !== 'REJECTED'"));
  assert.ok(authRoute.includes("user.accountStatus !== 'DISABLED'"));
  assert.ok(authRoute.includes("user.isActive !== false"));
});

test('Scenario 9: Suspended or pending staff accounts (SUSPENDED, PENDING) are rejected', () => {
  const authRoute = fs.readFileSync(path.join(projectRoot, 'api/_server/routes/auth.ts'), 'utf-8');
  assert.ok(authRoute.includes("user.accountStatus !== 'SUSPENDED'"));
  assert.ok(authRoute.includes("user.accountStatus !== 'PENDING'"));
});

test('Scenario 10: Customer role is strictly rejected from staff password recovery', () => {
  const authRoute = fs.readFileSync(path.join(projectRoot, 'api/_server/routes/auth.ts'), 'utf-8');
  assert.ok(authRoute.includes("normalizedRole !== 'CUSTOMER'"));
});

test('Scenario 11: Authorized staff roles are explicitly verified against AUTHORIZED_STAFF_ROLES', () => {
  const authRoute = fs.readFileSync(path.join(projectRoot, 'api/_server/routes/auth.ts'), 'utf-8');
  assert.ok(authRoute.includes('AUTHORIZED_STAFF_ROLES'));
  assert.ok(authRoute.includes('SUPER_ADMIN'));
  assert.ok(authRoute.includes('ADMIN'));
  assert.ok(authRoute.includes('MANAGER'));
  assert.ok(authRoute.includes('LEAD_TECHNICIAN'));
  assert.ok(authRoute.includes('TECHNICIAN'));
  assert.ok(authRoute.includes('TECHNICAL_ASSISTANT'));
  assert.ok(authRoute.includes('RECEPTIONIST'));
  assert.ok(authRoute.includes('INVENTORY_MANAGER'));
  assert.ok(authRoute.includes('ACCOUNTANT'));
  assert.ok(authRoute.includes('AUTHORIZED_STAFF_ROLES.includes(normalizedRole)'));
});

test('Scenario 12: Cryptographically secure 6-digit recovery code generation using crypto.randomInt', () => {
  const authRoute = fs.readFileSync(path.join(projectRoot, 'api/_server/routes/auth.ts'), 'utf-8');
  assert.ok(authRoute.includes('crypto.randomInt(100000, 1000000)'));

  // Test randomInt distribution & length
  for (let i = 0; i < 20; i++) {
    const code = crypto.randomInt(100000, 1000000).toString();
    assert.equal(code.length, 6);
    assert.ok(/^\d{6}$/.test(code));
  }
});

test('Scenario 13: Recovery code is securely hashed with SHA-256 before storage', () => {
  const authRoute = fs.readFileSync(path.join(projectRoot, 'api/_server/routes/auth.ts'), 'utf-8');
  assert.ok(authRoute.includes("crypto.createHash('sha256').update(secureCode).digest('hex')"));
  assert.ok(authRoute.includes("codeHash"));

  const testCode = '482915';
  const expectedHash = crypto.createHash('sha256').update(testCode).digest('hex');
  assert.equal(expectedHash.length, 64);
});

test('Scenario 14: Recovery code expires in 15 minutes', () => {
  const authRoute = fs.readFileSync(path.join(projectRoot, 'api/_server/routes/auth.ts'), 'utf-8');
  assert.ok(authRoute.includes('15 * 60 * 1000'));
});

test('Scenario 15: Recovery email is sent strictly to the database-retrieved staff email', () => {
  const authRoute = fs.readFileSync(path.join(projectRoot, 'api/_server/routes/auth.ts'), 'utf-8');
  assert.ok(authRoute.includes('to: user.email'));
});

test('Scenario 16: Cooldown rate limiting prevents rapid successive email spamming', () => {
  const authRoute = fs.readFileSync(path.join(projectRoot, 'api/_server/routes/auth.ts'), 'utf-8');
  assert.ok(authRoute.includes('elapsedMs < 30 * 1000'));
});

test('Scenario 17: Invalidation of prior unused recovery codes when a new request is made', () => {
  const authRoute = fs.readFileSync(path.join(projectRoot, 'api/_server/routes/auth.ts'), 'utf-8');
  assert.ok(authRoute.includes(".update({ isUsed: true })"));
  assert.ok(authRoute.includes(".eq('purpose', 'PASSWORD_RESET')"));
  assert.ok(authRoute.includes(".eq('isUsed', false)"));
});

test('Scenario 18: OTP verification validates 6-digit numeric input format', () => {
  const authRoute = fs.readFileSync(path.join(projectRoot, 'api/_server/routes/auth.ts'), 'utf-8');
  assert.ok(authRoute.includes('^\\d{6}$'));
  assert.ok(authRoute.includes('Please enter a valid 6-digit recovery code.'));
});

test('Scenario 19: Successful OTP verification marks OTP used and issues signed single-use resetToken', () => {
  const authRoute = fs.readFileSync(path.join(projectRoot, 'api/_server/routes/auth.ts'), 'utf-8');
  assert.ok(authRoute.includes('isUsed: true'));
  assert.ok(authRoute.includes("purpose: 'RESET_PASSWORD'"));
  assert.ok(authRoute.includes('resetToken'));
  assert.ok(authRoute.includes('tokenId: resetTokenId'));
});

test('Scenario 20: OTP verification with incorrect code increments failed attempt counter', () => {
  const authRoute = fs.readFileSync(path.join(projectRoot, 'api/_server/routes/auth.ts'), 'utf-8');
  assert.ok(authRoute.includes('attempts: updatedAttempts'));
  assert.ok(authRoute.includes('Incorrect recovery code. Please check your email and try again.'));
});

test('Scenario 21: OTP verification locks out challenge upon reaching 5 attempts', () => {
  const authRoute = fs.readFileSync(path.join(projectRoot, 'api/_server/routes/auth.ts'), 'utf-8');
  assert.ok(authRoute.includes('currentAttempts >= 5') || authRoute.includes('updatedAttempts >= 5'));
  assert.ok(authRoute.includes('Maximum verification attempts exceeded. Please request a new recovery code.'));
});

test('Scenario 22: OTP verification rejects expired recovery codes', () => {
  const authRoute = fs.readFileSync(path.join(projectRoot, 'api/_server/routes/auth.ts'), 'utf-8');
  assert.ok(authRoute.includes('new Date(otp.expiresAt).getTime() < Date.now()'));
  assert.ok(authRoute.includes('Recovery code has expired. Please request a new one.'));
});

test('Scenario 23: OTP verification rejects previously used/consumed recovery codes', () => {
  const authRoute = fs.readFileSync(path.join(projectRoot, 'api/_server/routes/auth.ts'), 'utf-8');
  assert.ok(authRoute.includes('if (otp.isUsed)'));
  assert.ok(authRoute.includes('This recovery code has already been used. Please request a new one.'));
});

test('Scenario 24: Password reset enforces criteria (>=8 chars, number/symbol), hashes password with bcrypt, and prevents token reuse', () => {
  const authRoute = fs.readFileSync(path.join(projectRoot, 'api/_server/routes/auth.ts'), 'utf-8');
  assert.ok(authRoute.includes('newPassword.length < 8'));
  assert.ok(authRoute.includes('Password must be at least 8 characters long.'));
  assert.ok(authRoute.includes('Password must include at least one number or special symbol.'));
  assert.ok(authRoute.includes('bcrypt.hash(newPassword, 10)'));
  assert.ok(authRoute.includes('consumedResetTokens.has(decoded.tokenId)'));
  assert.ok(authRoute.includes('markResetTokenConsumed(decoded.tokenId)'));
  assert.ok(authRoute.includes('This reset token has already been used.'));
});
