import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  validateNepalPhone, 
  validateEmail, 
  validatePrice, 
  validateDateRange, 
  validateImeiOrSerial,
  formatNepalPhone 
} from '../src/lib/validation.js';
import { getKathmanduDateRange } from '../src/components/common/AdvancedFilterBar.js';
import { getRoleTierDetails } from '../src/components/common/RoleTierBadge.js';

test('Enterprise Optimization: Smart Form Validation', async (t) => {
  await t.test('1. Validates standard Nepal 10-digit mobile numbers', () => {
    // 98XXXXXXXX (NTC / Ncell)
    assert.equal(validateNepalPhone('9841234567').isValid, true);
    assert.equal(validateNepalPhone('9801234567').isValid, true);
    // 97XXXXXXXX (NTC / Smart)
    assert.equal(validateNepalPhone('9741234567').isValid, true);
    // With +977 prefix
    assert.equal(validateNepalPhone('+977-9841234567').isValid, true);
    assert.equal(validateNepalPhone('+9779801234567').isValid, true);
    assert.equal(validateNepalPhone('977-9841234567').isValid, true);
  });

  await t.test('2. Validates Nepal landline numbers', () => {
    assert.equal(validateNepalPhone('014234567').isValid, true);
    assert.equal(validateNepalPhone('01-4234567').isValid, true);
  });

  await t.test('3. Rejects invalid phone numbers', () => {
    assert.equal(validateNepalPhone('12345').isValid, false);
    assert.equal(validateNepalPhone('abcdefghij').isValid, false);
    assert.equal(validateNepalPhone('8841234567').isValid, false);
    assert.equal(validateNepalPhone('').isValid, false);
  });

  await t.test('4. Formats Nepal mobile phone into readable pattern', () => {
    assert.equal(formatNepalPhone('9841234567'), '9841-234-567');
  });

  await t.test('5. Validates email formats correctly', () => {
    assert.equal(validateEmail('info@mtslab.com').isValid, true);
    assert.equal(validateEmail('customer.service@gmail.com').isValid, true);
    assert.equal(validateEmail('invalid-email').isValid, false);
    assert.equal(validateEmail('').isValid, false);
    assert.equal(validateEmail('', false).isValid, true); // not required
  });

  await t.test('6. Validates prices strictly', () => {
    assert.equal(validatePrice(1500).isValid, true);
    assert.equal(validatePrice('2500.50').isValid, true);
    assert.equal(validatePrice(-10).isValid, false);
    assert.equal(validatePrice('invalid').isValid, false);
  });

  await t.test('7. Validates IMEI and serial numbers', () => {
    assert.equal(validateImeiOrSerial('123456789012345').isValid, true); // 15-digit IMEI
    assert.equal(validateImeiOrSerial('SN-A1B2C3D4E5').isValid, true);
    assert.equal(validateImeiOrSerial('12').isValid, false);
  });

  await t.test('8. Validates Date Ranges', () => {
    assert.equal(validateDateRange('2026-01-01', '2026-01-10').isValid, true);
    assert.equal(validateDateRange('2026-02-01', '2026-01-01').isValid, false);
  });
});

test('Enterprise Optimization: Advanced Data Filtering in Asia/Kathmandu Timezone', async (t) => {
  await t.test('calculates correct TODAY date range in Kathmandu (+05:45)', () => {
    const range = getKathmanduDateRange('TODAY');
    assert.ok(range.startDate);
    assert.equal(range.startDate, range.endDate);
    assert.match(range.startDate, /^\d{4}-\d{2}-\d{2}$/);
  });

  await t.test('calculates correct THIS_MONTH range starting on day 01', () => {
    const range = getKathmanduDateRange('THIS_MONTH');
    assert.ok(range.startDate.endsWith('-01'), 'Month range should start on the 1st');
    assert.ok(range.endDate >= range.startDate);
  });

  await t.test('calculates empty range for ALL time', () => {
    const range = getKathmanduDateRange('ALL');
    assert.equal(range.startDate, '');
    assert.equal(range.endDate, '');
  });
});

test('Enterprise Optimization: Role-Based Access Tiers', async (t) => {
  await t.test('maps all user roles to authoritative tiers', () => {
    const superAdmin = getRoleTierDetails('SUPER_ADMIN');
    assert.equal(superAdmin.tierNumber, 1);
    assert.equal(superAdmin.roleLabel, 'Super Admin');

    const admin = getRoleTierDetails('ADMIN');
    assert.equal(admin.tierNumber, 2);

    const manager = getRoleTierDetails('MANAGER');
    assert.equal(manager.tierNumber, 2);

    const headTech = getRoleTierDetails('HEAD_TECHNICIAN');
    assert.equal(headTech.tierNumber, 3);

    const tech = getRoleTierDetails('TECHNICIAN');
    assert.equal(tech.tierNumber, 4);

    const receptionist = getRoleTierDetails('RECEPTIONIST');
    assert.equal(receptionist.tierNumber, 5);

    const accountant = getRoleTierDetails('ACCOUNTANT');
    assert.equal(accountant.tierNumber, 6);

    const inventoryManager = getRoleTierDetails('INVENTORY_MANAGER');
    assert.equal(inventoryManager.tierNumber, 6);
  });
});
