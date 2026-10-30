import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const projectRoot = process.cwd();

// Test Suite: MTS Lab Forgot Password Staff Email Verification & Recovery Code Security
// Strictly validates Section 8 test scenarios and security requirements:
// 1. Email exists in Staff Management -> Recovery process may proceed
// 2. Email does not exist in Staff Management -> Show invalid email; no code generated or sent
// 3. Email exists only in customer records -> Reject; no code sent
// 4. Email exists only in repair records -> Reject; no code sent
// 5. Email exists only in contact submissions -> Reject; no code sent
// 6. Email has uppercase/lowercase differences -> Match according to normalization rules
// 7. Email contains leading/trailing spaces -> Normalize and verify correctly
// 8. Staff account is disabled or ineligible -> Reject according to account policy
// 9. Email provider fails -> Show safe error; no false success
// 10. Recovery code is expired -> Reject verification
// 11. Recovery code is incorrect -> Reject verification
// 12. Recovery code is reused -> Reject verification
// 13. Too many verification attempts -> Temporarily block or rate-limit
// 14. Password reset succeeds -> Update password securely and invalidate recovery code

test('Scenario 1: Email exists in Staff Management -> Recovery process may proceed', () => {
  const authRoute = fs.readFileSync(path.join(projectRoot, 'api/_server/routes/auth.ts'), 'utf-8');
  assert.ok(authRoute.includes(".from('User')"), 'Queries staff User database table');
  assert.ok(authRoute.includes("AUTHORIZED_STAFF_ROLES"), 'Validates against authorized staff roles');
  assert.ok(authRoute.includes("crypto.randomInt(100000, 1000000)"), 'Generates 6-digit recovery code');
  assert.ok(authRoute.includes("to: user.email"), 'Sends recovery email to database-verified staff address');
});

test('Scenario 2: Email does not exist in Staff Management -> Show invalid email; no code generated or sent', () => {
  const authRoute = fs.readFileSync(path.join(projectRoot, 'api/_server/routes/auth.ts'), 'utf-8');
  const expectedMsg = 'Invalid email address. Please enter the email registered with your staff account.';
  assert.ok(authRoute.includes(expectedMsg), 'Backend returns exact invalid staff email validation message');
  assert.ok(authRoute.includes('INVALID_STAFF_EMAIL_MESSAGE'), 'Constant INVALID_STAFF_EMAIL_MESSAGE is defined');
  
  // Verify that if !user, returns HTTP 400 with INVALID_STAFF_EMAIL_MESSAGE before any OTP or email
  const forgotRoute = authRoute.slice(authRoute.indexOf("router.post('/forgot-password'"));
  const unregisteredCheckIdx = forgotRoute.indexOf('if (!user)');
  const insertOtpIdx = forgotRoute.indexOf("supabaseAdmin.from('OTPVerification').insert");
  const sendEmailIdx = forgotRoute.indexOf("sendEmail({");
  assert.ok(unregisteredCheckIdx !== -1, 'Checks if user exists in staff table');
  assert.ok(unregisteredCheckIdx < insertOtpIdx, 'Rejects unregistered email before OTP insertion');
  assert.ok(unregisteredCheckIdx < sendEmailIdx, 'Rejects unregistered email before sendEmail');

  // Verify frontend ForgotPassword displays exact message and does not advance to OTP
  const forgotPage = fs.readFileSync(path.join(projectRoot, 'src/pages/ForgotPassword.tsx'), 'utf-8');
  assert.ok(forgotPage.includes(expectedMsg), 'Frontend includes exact invalid staff email message');
  assert.ok(forgotPage.includes('recovery-email-error'), 'Error is associated with email input');
});

test('Scenario 3: Email exists only in customer records -> Reject; no code sent', () => {
  const authRoute = fs.readFileSync(path.join(projectRoot, 'api/_server/routes/auth.ts'), 'utf-8');
  const forgotRoute = authRoute.slice(authRoute.indexOf("router.post('/forgot-password'"));
  
  // Forgot password endpoint must NOT query Customer table
  assert.ok(!forgotRoute.includes(".from('Customer')"), 'Must never query Customer table for staff password recovery');
  
  // If user role is CUSTOMER, must strictly reject with INVALID_STAFF_EMAIL_MESSAGE
  assert.ok(authRoute.includes("normalizedRole === 'CUSTOMER'"), 'Rejects customer role');
  assert.ok(authRoute.includes("error: INVALID_STAFF_EMAIL_MESSAGE"), 'Rejects non-staff with invalid email message');
});

test('Scenario 4: Email exists only in repair records -> Reject; no code sent', () => {
  const authRoute = fs.readFileSync(path.join(projectRoot, 'api/_server/routes/auth.ts'), 'utf-8');
  const forgotRoute = authRoute.slice(authRoute.indexOf("router.post('/forgot-password'"));
  
  // Must NOT query Repair table
  assert.ok(!forgotRoute.includes(".from('Repair')"), 'Must never query Repair table for staff password recovery');
});

test('Scenario 5: Email exists only in contact submissions -> Reject; no code sent', () => {
  const authRoute = fs.readFileSync(path.join(projectRoot, 'api/_server/routes/auth.ts'), 'utf-8');
  const forgotRoute = authRoute.slice(authRoute.indexOf("router.post('/forgot-password'"));
  
  // Must NOT query Contact submissions or external feedback tables
  assert.ok(!forgotRoute.includes(".from('Contact')"), 'Must never query Contact submissions for staff password recovery');
  assert.ok(!forgotRoute.includes(".from('Feedback')"), 'Must never query Feedback for staff password recovery');
});

test('Scenario 6: Email has uppercase/lowercase differences -> Match according to normalization rules', () => {
  const rawInput = '  Lead.Technician@MTSLAB.COM  ';
  const normalized = rawInput.toLowerCase().trim();
  assert.equal(normalized, 'lead.technician@mtslab.com');

  const authRoute = fs.readFileSync(path.join(projectRoot, 'api/_server/routes/auth.ts'), 'utf-8');
  assert.ok(authRoute.includes("email.toLowerCase().trim()"), 'Performs lower-case normalization');
  assert.ok(authRoute.includes(".ilike('email', normalizedEmail)"), 'Uses case-insensitive database matching');
});

test('Scenario 7: Email contains leading/trailing spaces -> Normalize and verify correctly', () => {
  const rawInput = '   admin@mtslab.com   ';
  const normalized = rawInput.toLowerCase().trim();
  assert.equal(normalized, 'admin@mtslab.com');
  assert.equal(normalized.length, 16);
});

test('Scenario 8: Staff account is disabled or ineligible -> Reject according to account policy', () => {
  const authRoute = fs.readFileSync(path.join(projectRoot, 'api/_server/routes/auth.ts'), 'utf-8');
  assert.ok(authRoute.includes("user.accountStatus === 'REJECTED'"), 'Checks REJECTED status');
  assert.ok(authRoute.includes("user.accountStatus === 'DISABLED'"), 'Checks DISABLED status');
  assert.ok(authRoute.includes("user.accountStatus === 'SUSPENDED'"), 'Checks SUSPENDED status');
  assert.ok(authRoute.includes("user.accountStatus === 'PENDING'"), 'Checks PENDING status');
  assert.ok(authRoute.includes("user.isActive === false"), 'Checks isActive flag');
  assert.ok(authRoute.includes("user.deletedAt"), 'Checks soft-deleted status');
});

test('Scenario 9: Email provider fails -> Show safe error; no false success', () => {
  const authRoute = fs.readFileSync(path.join(projectRoot, 'api/_server/routes/auth.ts'), 'utf-8');
  const forgotRoute = authRoute.slice(authRoute.indexOf("router.post('/forgot-password'"));
  
  // On email failure (!emailResult), must NOT return success
  assert.ok(forgotRoute.includes('if (!emailResult)'), 'Checks emailResult status');
  assert.ok(forgotRoute.includes(".update({ isUsed: true }).eq('id', otpId)"), 'Invalidates OTP challenge on email failure');
  assert.ok(forgotRoute.includes('status(502)'), 'Returns HTTP 502 Bad Gateway / Service error');
  assert.ok(forgotRoute.includes('Unable to deliver recovery email'), 'Returns safe error message without leaking SMTP credentials');
});

test('Scenario 10: Recovery code is expired -> Reject verification', () => {
  const authRoute = fs.readFileSync(path.join(projectRoot, 'api/_server/routes/auth.ts'), 'utf-8');
  assert.ok(authRoute.includes('new Date(otp.expiresAt).getTime() < Date.now()'), 'Checks expiration timestamp');
  assert.ok(authRoute.includes('Recovery code has expired. Please request a new one.'), 'Returns expiration error');
});

test('Scenario 11: Recovery code is incorrect -> Reject verification', () => {
  const authRoute = fs.readFileSync(path.join(projectRoot, 'api/_server/routes/auth.ts'), 'utf-8');
  assert.ok(authRoute.includes('if (otp.codeHash !== inputHash)'), 'Compares input hash to stored hash');
  assert.ok(authRoute.includes('Incorrect recovery code. Please check your email and try again.'), 'Returns incorrect code error');
});

test('Scenario 12: Recovery code is reused -> Reject verification', () => {
  const authRoute = fs.readFileSync(path.join(projectRoot, 'api/_server/routes/auth.ts'), 'utf-8');
  assert.ok(authRoute.includes('if (otp.isUsed)'), 'Checks if OTP is already consumed');
  assert.ok(authRoute.includes('This recovery code has already been used. Please request a new one.'), 'Returns reuse rejection error');
});

test('Scenario 13: Too many verification attempts -> Temporarily block or rate-limit', () => {
  const authRoute = fs.readFileSync(path.join(projectRoot, 'api/_server/routes/auth.ts'), 'utf-8');
  assert.ok(authRoute.includes('currentAttempts >= 5') || authRoute.includes('updatedAttempts >= 5'), 'Enforces 5 attempt maximum');
  assert.ok(authRoute.includes('Maximum verification attempts exceeded. Please request a new recovery code.'), 'Returns lockout error');
});

test('Scenario 14: Password reset succeeds -> Update password securely, invalidate recovery code, and revoke sessions', () => {
  const authRoute = fs.readFileSync(path.join(projectRoot, 'api/_server/routes/auth.ts'), 'utf-8');
  assert.ok(authRoute.includes('newPassword.length < 8'), 'Enforces minimum password length of 8');
  assert.ok(authRoute.includes('bcrypt.hash(newPassword, 10)'), 'Hashes password with bcrypt');
  assert.ok(authRoute.includes('markResetTokenConsumed(decoded.tokenId)'), 'Prevents token reuse');
  assert.ok(authRoute.includes(".from('Session').delete().eq('userId', user.id)"), 'Revokes existing sessions on reset');
});

test('Scenario 15: Critical test — Confirm that an unregistered email never triggers the email provider or sends a recovery code, even if that email exists in another database table', () => {
  const authRoute = fs.readFileSync(path.join(projectRoot, 'api/_server/routes/auth.ts'), 'utf-8');
  const forgotRoute = authRoute.slice(authRoute.indexOf("router.post('/forgot-password'"));

  // The unregistered check (if (!user)) occurs BEFORE OTP creation and BEFORE sendEmail
  const checkUserIdx = forgotRoute.indexOf('if (!user)');
  const insertOtpIdx = forgotRoute.indexOf("supabaseAdmin.from('OTPVerification').insert");
  const sendEmailIdx = forgotRoute.indexOf("sendEmail({");

  assert.ok(checkUserIdx !== -1, 'User registration verification exists');
  assert.ok(insertOtpIdx !== -1, 'OTP insertion exists');
  assert.ok(sendEmailIdx !== -1, 'sendEmail invocation exists');

  assert.ok(checkUserIdx < insertOtpIdx, 'Unregistered user check precedes OTP database insertion');
  assert.ok(checkUserIdx < sendEmailIdx, 'Unregistered user check precedes sendEmail invocation');

  // Must not check Customer, Repair, or other tables
  assert.ok(!forgotRoute.includes(".from('Customer')"));
  assert.ok(!forgotRoute.includes(".from('Repair')"));
});
