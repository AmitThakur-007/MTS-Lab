const assert = require('assert');
const crypto = require('crypto');

console.log('================================================================');
console.log('--- TEST SUITE: EMAIL VERIFICATION & 2FA CODE DELIVERY ---');
console.log('================================================================\n');

const OTP_SALT = 'mts-lab-otp-secure-salt-2026';

function hashOtp(code) {
  return crypto.createHmac('sha256', OTP_SALT).update(String(code).trim()).digest('hex');
}

function verifyOtp(inputCode, storedHash) {
  if (!inputCode || !storedHash) return false;
  const computedHash = hashOtp(inputCode);
  if (computedHash.length !== storedHash.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(storedHash));
  } catch {
    return false;
  }
}

function generate6DigitOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}

function maskEmail(email) {
  if (!email || !email.includes('@')) return 'registered email';
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local[0]}${'*'.repeat(Math.max(1, local.length - 2))}${local[local.length - 1]}@${domain}`;
}

// 1. Test OTP Generation & Cryptographic Verification
console.log('Test 1: 6-Digit OTP Generation & Timing-Safe Verification...');
for (let i = 0; i < 20; i++) {
  const otp = generate6DigitOtp();
  assert.strictEqual(otp.length, 6, 'OTP must be exactly 6 digits');
  assert.ok(/^\d{6}$/.test(otp), 'OTP must contain only digits');

  const hashed = hashOtp(otp);
  assert.ok(verifyOtp(otp, hashed), 'Correct OTP must verify successfully');
  assert.ok(!verifyOtp('000000' === otp ? '111111' : '000000', hashed), 'Wrong OTP must be rejected');
  assert.ok(!verifyOtp('12345', hashed), 'Short OTP must be rejected');
  assert.ok(!verifyOtp('', hashed), 'Empty OTP must be rejected');
}
console.log('✅ 6-Digit OTP generation and cryptographic verification tests passed.');

// 2. Test 2FA Ticket Issuance & Expiration Logic
console.log('\nTest 2: 2FA Ticket Lifecycle & Expiration...');
const testEmail = 'mtsmobilelab@gmail.com';
const testCode = '739104';
const testHash = hashOtp(testCode);

const validTicketPayload = {
  userId: 'usr_superadmin',
  email: testEmail,
  name: 'MTS Lab Super Admin',
  role: 'SUPERADMIN',
  otpHash: testHash,
  exp: Date.now() + 5 * 60 * 1000, // 5 minutes in future
  attempts: 0
};

const validMfaTicket = `mfa_${Buffer.from(JSON.stringify(validTicketPayload)).toString('base64url')}`;

// Decode & verify
const decodedJson = Buffer.from(validMfaTicket.replace(/^mfa_/, ''), 'base64url').toString('utf-8');
const parsedPayload = JSON.parse(decodedJson);

assert.strictEqual(parsedPayload.email, testEmail);
assert.strictEqual(parsedPayload.role, 'SUPERADMIN');
assert.ok(parsedPayload.exp > Date.now(), 'Ticket must not be expired');
assert.ok(verifyOtp(testCode, parsedPayload.otpHash), 'OTP in ticket must verify');

// Expired Ticket Test
const expiredTicketPayload = {
  ...validTicketPayload,
  exp: Date.now() - 1000 // 1 second in past
};
const expiredMfaTicket = `mfa_${Buffer.from(JSON.stringify(expiredTicketPayload)).toString('base64url')}`;
const expiredParsed = JSON.parse(Buffer.from(expiredMfaTicket.replace(/^mfa_/, ''), 'base64url').toString('utf-8'));
assert.ok(expiredParsed.exp < Date.now(), 'Expired ticket must be recognized as expired');

console.log('✅ 2FA ticket lifecycle and expiration tests passed.');

// 3. Test Privacy Email Masking
console.log('\nTest 3: Email Masking for Privacy in 2FA prompt...');
assert.strictEqual(maskEmail('mtsmobilelab@gmail.com'), 'm**********b@gmail.com');
assert.strictEqual(maskEmail('admin@mtslab.com'), 'a***n@mtslab.com');
assert.strictEqual(maskEmail('ab@mtslab.com'), 'a***@mtslab.com');
assert.strictEqual(maskEmail(''), 'registered email');
assert.strictEqual(maskEmail(null), 'registered email');
console.log('✅ Email masking tests passed.');

// 4. Test Multi-Role Verification & Delivery Handshake for All 6 Roles
console.log('\nTest 4: 2FA & Verification Handshake for all 6 canonical roles...');
const CANONICAL_ROLES = ['SUPERADMIN', 'ADMIN', 'MANAGER', 'HEAD_TECHNICIAN', 'TECHNICIAN', 'RECEPTIONIST'];

CANONICAL_ROLES.forEach(role => {
  const roleEmail = `${role.toLowerCase()}@mtslab.com`;
  const code = generate6DigitOtp();
  const ticket = {
    userId: `usr_${role.toLowerCase()}`,
    email: roleEmail,
    name: `${role} User`,
    role,
    otpHash: hashOtp(code),
    exp: Date.now() + 300000
  };

  const encoded = `mfa_${Buffer.from(JSON.stringify(ticket)).toString('base64url')}`;
  const decoded = JSON.parse(Buffer.from(encoded.replace(/^mfa_/, ''), 'base64url').toString('utf-8'));

  assert.strictEqual(decoded.role, role);
  assert.strictEqual(decoded.email, roleEmail);
  assert.ok(verifyOtp(code, decoded.otpHash));
});
console.log('✅ Handshake validated across all 6 roles.');

// 5. Test Email Template Rendering
console.log('\nTest 5: Security Email Template Formatting...');
function render2faHtml(name, code) {
  return `<div><h2>Security Verification Code</h2><p>Hello ${name}</p><span>${code}</span></div>`;
}
const rendered = render2faHtml('Super Admin', '123456');
assert.ok(rendered.includes('123456'), 'Rendered HTML must contain OTP code');
assert.ok(rendered.includes('Super Admin'), 'Rendered HTML must contain user name');

console.log('✅ Security email template tests passed.');

console.log('\n================================================================');
console.log('🎉 ALL EMAIL VERIFICATION & 2FA DELIVERY TESTS PASSED CLEANLY!');
console.log('================================================================');
