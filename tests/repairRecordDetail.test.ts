import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { formatDeviceName, getRepairDeviceDisplay } from '../src/lib/device.js';
import { normalizeRepairRecord } from '../api/_server/routes/repairs.js';

test('1. formatDeviceName correctly transforms device brands, models, and abbreviations', () => {
  // Apple 12 -> Apple iPhone 12
  const apple12 = formatDeviceName('apple', '12');
  assert.equal(apple12.brand, 'Apple');
  assert.equal(apple12.model, 'iPhone 12');
  assert.equal(apple12.fullName, 'Apple iPhone 12');

  // ip 15 pron max typo fix
  const ip15 = formatDeviceName('Apple', 'ip 15 pron max');
  assert.equal(ip15.brand, 'Apple');
  assert.equal(ip15.model, 'iPhone 15 Pro Max');
  assert.equal(ip15.fullName, 'Apple iPhone 15 Pro Max');

  // Samsung S23 ultra casing
  const samsung = formatDeviceName('samsung', 'S23 ultra');
  assert.equal(samsung.brand, 'Samsung');
  assert.equal(samsung.model, 'S23 Ultra');
  assert.equal(samsung.fullName, 'Samsung S23 Ultra');

  // OnePlus 1+7 Pro
  const op = formatDeviceName('oneplus', '1+7 pro');
  assert.equal(op.brand, 'OnePlus');
  assert.equal(op.model, '7 pro');
  assert.equal(op.fullName, 'OnePlus 7 pro');

  // Google Pixel 7
  const google = formatDeviceName('google', 'pixel 7');
  assert.equal(google.brand, 'Google');
  assert.equal(google.model, 'Pixel 7');
  assert.equal(google.fullName, 'Google Pixel 7');

  // Safe fallback for null/empty without displaying undefined
  const fallback = formatDeviceName(null, null);
  assert.equal(fallback.brand, 'Smartphone');
  assert.equal(fallback.model, 'Model Unspecified');
  assert.equal(fallback.fullName, 'Smartphone (Model Unspecified)');
  assert.ok(!fallback.fullName.includes('undefined') && !fallback.fullName.includes('null'));
});

test('2. getRepairDeviceDisplay safely extracts both camelCase and snake_case attributes', () => {
  // camelCase payload
  const camel = getRepairDeviceDisplay({
    deviceBrand: 'Apple',
    deviceModel: '13 Pro',
    imeiNumber: '358920192831201',
    deviceColor: 'Graphite',
    deviceCondition: 'Cracked screen',
    accessoriesReceived: 'Case and cable'
  });
  assert.equal(camel.brand, 'Apple');
  assert.equal(camel.model, 'iPhone 13 Pro');
  assert.equal(camel.imei, '358920192831201');
  assert.equal(camel.color, 'Graphite');
  assert.equal(camel.condition, 'Cracked screen');
  assert.equal(camel.accessories, 'Case and cable');

  // snake_case payload
  const snake = getRepairDeviceDisplay({
    device_brand: 'samsung',
    device_model: 'Note 20 Ultra',
    imei_sn: '359999999999999',
    device_color: 'Mystic Bronze',
    device_condition: 'No power',
    accessories_received: 'S-Pen'
  });
  assert.equal(snake.brand, 'Samsung');
  assert.equal(snake.model, 'Note 20 Ultra');
  assert.equal(snake.imei, '359999999999999');
  assert.equal(snake.color, 'Mystic Bronze');
});

test('3. Backend normalizeRepairRecord provides both camelCase and snake_case fields', () => {
  const normalized = normalizeRepairRecord({
    id: 'rep_123',
    repairNumber: 'MTS-2026-1045',
    deviceBrand: 'Apple',
    deviceModel: '12',
    imeiNumber: '351234567890123',
    customerName: 'Aarav Sharma',
    customerPhone: '9841234567',
    customerEmail: 'aarav@example.com',
    problemDescription: 'Display touch unresponsive',
    technician: { id: 'tech_1', name: 'Rabin Specialist', role: 'TECHNICIAN' },
    estimatedCost: 12500,
    advancePaid: 2500,
    totalPaid: 2500,
    paymentStatus: 'PARTIAL',
  });

  assert.equal(normalized.device_brand, 'Apple');
  assert.equal(normalized.device_model, '12');
  assert.equal(normalized.imei_sn, '351234567890123');
  assert.equal(normalized.customer_name, 'Aarav Sharma');
  assert.equal(normalized.customer_phone, '9841234567');
  assert.equal(normalized.customer_email, 'aarav@example.com');
  assert.equal(normalized.problem_description, 'Display touch unresponsive');
  assert.equal(normalized.assigned_technician?.name, 'Rabin Specialist');
  assert.equal(normalized.estimated_cost, 12500);
  assert.equal(normalized.advance_paid, 2500);
  assert.equal(normalized.total_paid, 2500);
  assert.equal(normalized.payment_status, 'PARTIAL');
});

test('4. RepairRecordDetail.tsx implements all 6 required sections with dark mode & responsive classes', () => {
  const content = fs.readFileSync(path.join(process.cwd(), 'src/components/repair/RepairRecordDetail.tsx'), 'utf8');

  // Verify the 6 organized sections exist
  assert.ok(content.includes('Device Specifications'), 'Must include Section 1: Device Specifications');
  assert.ok(content.includes('Customer Information'), 'Must include Section 2: Customer Information');
  assert.ok(content.includes('Repair Information'), 'Must include Section 3: Repair Information');
  assert.ok(content.includes('Financial Details'), 'Must include Section 4: Financial Details');
  assert.ok(content.includes('Technician Details'), 'Must include Section 5: Technician Details');
  assert.ok(content.includes('Issue Diagnostics'), 'Must include Section 6: Issue Diagnostics');

  // Verify key features:
  assert.ok(content.includes('Record Payment'), 'Must include Record Payment action');
  assert.ok(content.includes('formatNPR'), 'Must format currency using formatNPR');
  assert.ok(content.includes('getRepairDeviceDisplay'), 'Must use getRepairDeviceDisplay');
  assert.ok(content.includes('dark:bg-slate-900'), 'Must support dark mode');
  assert.ok(content.includes('grid-cols-1 md:grid-cols-2 lg:grid-cols-3'), 'Must have responsive grid');
});

test('5. RepairDetails.tsx mounts RepairRecordDetail and maintains navigate(-1) and useRepairCache', () => {
  const page = fs.readFileSync(path.join(process.cwd(), 'src/pages/dashboard/RepairDetails.tsx'), 'utf8');
  assert.ok(page.includes('RepairRecordDetail'), 'Must mount RepairRecordDetail');
  assert.ok(page.includes('navigate(-1)'), 'Must preserve history-aware navigate(-1)');
  assert.ok(page.includes('useRepairCache'), 'Must preserve useRepairCache');
});

test('6. App.tsx provides deep link routing for /repairs/:id', () => {
  const app = fs.readFileSync(path.join(process.cwd(), 'src/App.tsx'), 'utf8');
  assert.ok(app.includes('path="/repairs/:id"'), 'Must handle /repairs/:id');
  assert.ok(app.includes('DirectRepairRedirect'), 'Must redirect to dashboard repair details');
});
