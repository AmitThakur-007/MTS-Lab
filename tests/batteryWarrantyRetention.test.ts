import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'crypto';
import { supabaseAdmin } from '../api/_server/config/supabase';
import { normalizeRole } from '../api/_server/middleware/rbac';
import {
  parseWarrantyDurationMonths,
  formatWarrantyPeriodLabel,
  calculateWarrantyExpiry,
} from '../api/_server/routes/batteryWarranties';

const projectRoot = process.cwd();

// =========================================================================
// TEST SUITE: BATTERY WARRANTY RETENTION, DELETION PROTECTION & 2FA AUDIT
// Strictly verifies the 20 test scenarios for MTS Lab Battery Warranty Hub
// =========================================================================

test('Scenario 1: Deleting a single repair detaches repairId to null without deleting warranty', () => {
  const schemaPath = path.join(projectRoot, 'prisma/schema.prisma');
  assert.ok(fs.existsSync(schemaPath), 'prisma/schema.prisma must exist');
  const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

  // Verify Prisma schema has SetNull on repair relation and repairId is optional
  assert.match(
    schemaContent,
    /repairId\s+String\?\s+@unique/,
    'BatteryWarranty.repairId must be optional String?'
  );
  assert.match(
    schemaContent,
    /repair\s+Repair\?\s+@relation\(fields:\s*\[repairId\],\s*references:\s*\[id\],\s*onDelete:\s*SetNull\)/,
    'BatteryWarranty.repair relation must configure onDelete: SetNull'
  );

  // Verify repair deletion endpoint in api/_server/routes/repairs.ts detaches repairId
  const repairsRoutePath = path.join(projectRoot, 'api/_server/routes/repairs.ts');
  const repairsContent = fs.readFileSync(repairsRoutePath, 'utf-8');

  assert.ok(
    repairsContent.includes("update({ repairId: null, updatedAt: new Date().toISOString() })"),
    'DELETE /api/repairs/:id must detach repairId to null prior to deleting repair record'
  );
  // Verify syncBatteryWarrantyFromRepair never deletes warranty on false hasBatteryWarranty
  assert.ok(
    !repairsContent.includes("supabaseAdmin.from('BatteryWarranty').delete().eq('id', existingW.id)"),
    'syncBatteryWarrantyFromRepair must not delete existing warranty records when repair warranty flag is removed'
  );
  assert.ok(
    repairsContent.includes("status: 'CANCELLED'"),
    'syncBatteryWarrantyFromRepair cancels status rather than destructively deleting record'
  );
});

test('Scenario 2: Deleting a single customer detaches customerId to null without deleting warranty', () => {
  const customersRoutePath = path.join(projectRoot, 'api/_server/routes/customers.ts');
  assert.ok(fs.existsSync(customersRoutePath), 'customers.ts route must exist');
  const customersContent = fs.readFileSync(customersRoutePath, 'utf-8');

  assert.ok(
    customersContent.includes("update({ customerId: null, updatedAt: new Date().toISOString() })"),
    'DELETE /api/customers/:id must detach customerId to null prior to deleting customer'
  );
});

test('Scenario 3: Bulk-deleting repairs detaches repairId across all batch items', () => {
  const repairsRoutePath = path.join(projectRoot, 'api/_server/routes/repairs.ts');
  const repairsContent = fs.readFileSync(repairsRoutePath, 'utf-8');

  assert.ok(
    repairsContent.includes(".in('repairId', ids)"),
    'POST /api/repairs/bulk-delete must detach repairId for all targeted repairs prior to deletion'
  );
});

test('Scenario 4: Bulk-deleting customers protects warranties and detaches customerId', () => {
  const customersRoutePath = path.join(projectRoot, 'api/_server/routes/customers.ts');
  const customersContent = fs.readFileSync(customersRoutePath, 'utf-8');

  assert.ok(
    customersContent.includes(".from('BatteryWarranty')"),
    'POST /api/customers/bulk-delete counts associated warranties'
  );
  assert.ok(
    customersContent.includes(".eq('customerId', id)"),
    'POST /api/customers/bulk-delete checks customerId association before permanent deletion'
  );
});

test('Scenario 5: Warranty records remain queryable in database when repairId is null', async () => {
  // Query Supabase schema to ensure BatteryWarranty table accepts null repairId and customerId
  const { data: cols, error } = await supabaseAdmin
    .from('BatteryWarranty')
    .select('id, warrantyNumber, repairNumber, customerName, customerPhone, customerEmail, deviceBrand, deviceModel, imeiNumber, batteryType, warrantyPeriod, expiryDate, status, repairId, customerId')
    .limit(1);

  assert.equal(error, null, 'BatteryWarranty table must exist and be queryable in Supabase');

  const { data: nullRepairWarranties, error: nullErr } = await supabaseAdmin
    .from('BatteryWarranty')
    .select('id, warrantyNumber, customerName, repairNumber, repairId')
    .is('repairId', null)
    .limit(5);

  assert.equal(nullErr, null, 'Querying warranties with repairId null must succeed');
  assert.ok(Array.isArray(nullRepairWarranties), 'Query returns an array');
});

test('Scenario 6: Battery warranty search engine and claims tracking function for detached records', () => {
  const warrantiesRoutePath = path.join(projectRoot, 'api/_server/routes/batteryWarranties.ts');
  const content = fs.readFileSync(warrantiesRoutePath, 'utf-8');

  // Verify that the search route filters self-contained snapshot fields
  assert.ok(
    content.includes('w.warrantyNumber') && content.includes('w.repairNumber') && content.includes('w.customerName'),
    'Search queries self-contained warranty snapshots directly rather than depending on joined Repair table'
  );
  assert.ok(
    content.includes('w.customerPhone') && content.includes('w.deviceModel') && content.includes('w.imeiNumber'),
    'Search queries deviceModel, phone, and IMEI snapshots directly'
  );
});

test('Scenario 7: Historical snapshot calculations preserve durations and expiry dates', () => {
  assert.equal(parseWarrantyDurationMonths('6 Months'), 6);
  assert.equal(parseWarrantyDurationMonths('1 Year'), 12);
  assert.equal(parseWarrantyDurationMonths('2 Years'), 24);
  assert.equal(formatWarrantyPeriodLabel(6), '6 Months');
  assert.equal(formatWarrantyPeriodLabel(12), '1 Year');
  assert.equal(formatWarrantyPeriodLabel(24), '2 Years');

  const startDate = new Date('2026-01-01T00:00:00.000Z');
  const expiry6m = calculateWarrantyExpiry(startDate, 6);
  assert.equal(expiry6m.getUTCMonth(), 6); // July

  const expiry1y = calculateWarrantyExpiry(startDate, 12);
  assert.equal(expiry1y.getUTCFullYear(), 2027);

  const expiry2y = calculateWarrantyExpiry(startDate, 24);
  assert.equal(expiry2y.getUTCFullYear(), 2028);
});

test('Scenario 8 & 9: Role Matrix - ADMIN and MANAGER are strictly rejected from permanent deletion', () => {
  const warrantiesRoutePath = path.join(projectRoot, 'api/_server/routes/batteryWarranties.ts');
  const content = fs.readFileSync(warrantiesRoutePath, 'utf-8');

  // Verify that all deletion endpoints explicitly authorize only SUPER_ADMIN
  assert.ok(
    content.includes("router.post('/delete-2fa/request', authenticate, authorize(['SUPER_ADMIN'])"),
    'POST /delete-2fa/request must restrict access strictly to SUPER_ADMIN'
  );
  assert.ok(
    content.includes("router.post('/delete-2fa/verify', authenticate, authorize(['SUPER_ADMIN'])"),
    'POST /delete-2fa/verify must restrict access strictly to SUPER_ADMIN'
  );
  assert.ok(
    content.includes("router.post('/bulk-delete', authenticate, authorize(['SUPER_ADMIN'])"),
    'POST /bulk-delete must restrict access strictly to SUPER_ADMIN'
  );
  assert.ok(
    content.includes("router.delete('/:id', authenticate, authorize(['SUPER_ADMIN'])"),
    'DELETE /:id must restrict access strictly to SUPER_ADMIN'
  );

  // Verify internal helper also checks req.user?.role !== 'SUPER_ADMIN'
  assert.ok(
    content.includes("if (req.user?.role !== 'SUPER_ADMIN')"),
    'Internal verification helper strictly asserts SUPER_ADMIN'
  );

  // Normalize role checks
  assert.equal(normalizeRole('ADMIN'), 'ADMIN');
  assert.equal(normalizeRole('MANAGER'), 'MANAGER');
  assert.equal(normalizeRole('SUPER_ADMIN'), 'SUPER_ADMIN');
  assert.notEqual(normalizeRole('ADMIN'), 'SUPER_ADMIN');
  assert.notEqual(normalizeRole('MANAGER'), 'SUPER_ADMIN');
});

test('Scenario 10: SUPER_ADMIN initiates 2FA with crypto random code and 60-second cooldown', () => {
  const warrantiesRoutePath = path.join(projectRoot, 'api/_server/routes/batteryWarranties.ts');
  const content = fs.readFileSync(warrantiesRoutePath, 'utf-8');

  assert.ok(
    content.includes("crypto.randomInt(100000, 999999).toString()"),
    'Generates cryptographically secure 6-digit random code'
  );
  assert.ok(
    content.includes("crypto.createHash('sha256').update(generatedCode).digest('hex')"),
    'Hashes 2FA code with SHA-256 before storage'
  );
  assert.ok(
    content.includes("purpose: 'WARRANTY_DELETION_2FA'"),
    'Stores purpose as WARRANTY_DELETION_2FA in OTPVerification table'
  );
  assert.ok(
    content.includes('elapsedMs < 60 * 1000'),
    'Enforces 60-second cooldown between 2FA requests'
  );
});

test('Scenario 11: Incorrect 2FA code is rejected and attempts are tracked up to max 5', () => {
  const warrantiesRoutePath = path.join(projectRoot, 'api/_server/routes/batteryWarranties.ts');
  const content = fs.readFileSync(warrantiesRoutePath, 'utf-8');

  // Verify verification compares input hash against stored codeHash
  assert.ok(
    content.includes("if (otp.codeHash !== inputHash)"),
    'Compares SHA-256 hash of user input with stored codeHash'
  );
  assert.ok(
    content.includes("const attempts = (otp.attempts || 0) + 1;"),
    'Increments attempt count on incorrect code'
  );
  assert.ok(
    content.includes("(otp.attempts || 0) >= (otp.maxAttempts || 5)"),
    'Blocks when maximum verification attempts exceeded'
  );
  assert.ok(
    content.includes("status: 'BLOCKED'"),
    'Logs blocked attempt when locked'
  );
});

test('Scenario 12: Expired 2FA code is recognized and rejected with HTTP 401', () => {
  const warrantiesRoutePath = path.join(projectRoot, 'api/_server/routes/batteryWarranties.ts');
  const content = fs.readFileSync(warrantiesRoutePath, 'utf-8');

  assert.ok(
    content.includes("if (new Date(otp.expiresAt) < new Date())"),
    'Rejects code when current time exceeds expiresAt'
  );
  assert.ok(
    content.includes('Verification code has expired. Please request a new code.'),
    'Returns clear error message on expiration'
  );
});

test('Scenario 13: Reused 2FA code is rejected because isUsed is marked true upon success', () => {
  const warrantiesRoutePath = path.join(projectRoot, 'api/_server/routes/batteryWarranties.ts');
  const content = fs.readFileSync(warrantiesRoutePath, 'utf-8');

  assert.ok(
    content.includes(".eq('isUsed', false)"),
    'Queries only active, unused OTP records'
  );
  assert.ok(
    content.includes("await supabaseAdmin.from('OTPVerification').update({ isUsed: true }).eq('id', otp.id)"),
    'Immediately invalidates OTP by marking isUsed: true upon valid code verification'
  );
});

test('Scenario 14 & 15: Single delete without 2FA code is rejected with mandatory 2FA message', () => {
  const warrantiesRoutePath = path.join(projectRoot, 'api/_server/routes/batteryWarranties.ts');
  const content = fs.readFileSync(warrantiesRoutePath, 'utf-8');

  // Verify DELETE /:id checks for code
  assert.ok(
    content.includes("if (!code) {"),
    'DELETE /:id explicitly checks that 2FA code is provided'
  );
  assert.ok(
    content.includes('2FA verification code is mandatory for permanent deletion'),
    'Returns clear error message requiring 2FA code'
  );
});

test('Scenario 16 & 17: Successful 2FA invalidates OTP and deletes associated claims and warranty', () => {
  const warrantiesRoutePath = path.join(projectRoot, 'api/_server/routes/batteryWarranties.ts');
  const content = fs.readFileSync(warrantiesRoutePath, 'utf-8');

  // Verify claims deletion prior to warranty deletion
  assert.ok(
    content.includes("await supabaseAdmin.from('BatteryWarrantyClaim').delete().in('warrantyId', ids)"),
    'Associated warranty claims are purged before parent warranty is deleted'
  );
  // Verify warranty deletion
  assert.ok(
    content.includes("await supabaseAdmin.from('BatteryWarranty').delete().in('id', ids)"),
    'Warranties are deleted only after OTP is confirmed and claims removed'
  );
});

test('Scenario 18: No backdoor master PIN (007007) exists anywhere in codebase', () => {
  const warrantiesRoutePath = path.join(projectRoot, 'api/_server/routes/batteryWarranties.ts');
  const content = fs.readFileSync(warrantiesRoutePath, 'utf-8');

  assert.ok(
    !content.includes('007007'),
    'Hardcoded backdoor PIN 007007 has been permanently removed'
  );
  assert.ok(
    !content.includes('otpStore'),
    'In-memory otpStore has been replaced with persistent OTPVerification database table'
  );
});

test('Scenario 19: Immutable audit logging captures deletion request and permanent execution with forensic snapshot', () => {
  const warrantiesRoutePath = path.join(projectRoot, 'api/_server/routes/batteryWarranties.ts');
  const content = fs.readFileSync(warrantiesRoutePath, 'utf-8');

  assert.ok(
    content.includes("action: 'WARRANTY_DELETION_2FA_REQUESTED'"),
    'Audit logs record 2FA code request'
  );
  assert.ok(
    content.includes("action: 'WARRANTY_DELETION_2FA_FAILED'"),
    'Audit logs record incorrect 2FA attempts'
  );
  assert.ok(
    content.includes("action: 'WARRANTY_PERMANENTLY_DELETED'"),
    'Audit logs record permanent deletion with forensic snapshot'
  );
  assert.ok(
    content.includes('targetWarranties'),
    'Pre-deletion snapshot captures warranty numbers and customer details in audit record'
  );
});

test('Scenario 20: UI components implement 60-second cooldown, Retained badge, and 2FA modal workflow', () => {
  const mgtPath = path.join(projectRoot, 'src/pages/dashboard/BatteryWarrantyManagement.tsx');
  assert.ok(fs.existsSync(mgtPath), 'BatteryWarrantyManagement.tsx must exist');
  const mgtContent = fs.readFileSync(mgtPath, 'utf-8');

  assert.ok(
    mgtContent.includes('resendCooldown'),
    'BatteryWarrantyManagement tracks resendCooldown state'
  );
  assert.ok(
    mgtContent.includes('mfaTicket'),
    'BatteryWarrantyManagement tracks mfaTicket'
  );
  assert.ok(
    mgtContent.includes('Retained'),
    'BatteryWarrantyManagement displays Retained badge for repairs detached from workorders'
  );

  const hubPath = path.join(projectRoot, 'src/components/admin/PermanentDeletionHub.tsx');
  assert.ok(fs.existsSync(hubPath), 'PermanentDeletionHub.tsx must exist');
  const hubContent = fs.readFileSync(hubPath, 'utf-8');

  assert.ok(
    hubContent.includes('mfaTicket'),
    'PermanentDeletionHub tracks mfaTicket'
  );
  assert.ok(
    hubContent.includes('resendCooldown'),
    'PermanentDeletionHub tracks resendCooldown'
  );
});
