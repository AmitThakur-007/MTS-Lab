import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { DEVICE_CATEGORIES, detectDeviceCategory } from '../src/pages/technician/types.js';

test('Technician Workspace Navigation Restructuring: Type System and Device Categories', () => {
  // Must support all 6 categories + ALL
  assert.strictEqual(DEVICE_CATEGORIES.length, 7);
  const categories = DEVICE_CATEGORIES.map(c => c.key);
  assert.ok(categories.includes('ALL'));
  assert.ok(categories.includes('IPHONE'));
  assert.ok(categories.includes('SMARTPHONE'));
  assert.ok(categories.includes('IPAD'));
  assert.ok(categories.includes('TABLET'));
  assert.ok(categories.includes('LAPTOP'));
  assert.ok(categories.includes('TV'));

  // Test detection
  assert.strictEqual(detectDeviceCategory({ deviceBrand: 'Apple', deviceModel: 'iPhone 15 Pro Max' }), 'IPHONE');
  assert.strictEqual(detectDeviceCategory({ deviceBrand: 'Samsung', deviceModel: 'Galaxy S24 Ultra' }), 'SMARTPHONE');
  assert.strictEqual(detectDeviceCategory({ deviceBrand: 'Apple', deviceModel: 'iPad Pro 12.9 M2' }), 'IPAD');
  assert.strictEqual(detectDeviceCategory({ deviceBrand: 'Samsung', deviceModel: 'Galaxy Tab S9' }), 'TABLET');
  assert.strictEqual(detectDeviceCategory({ deviceBrand: 'Apple', deviceModel: 'MacBook Pro 16' }), 'LAPTOP');
  assert.strictEqual(detectDeviceCategory({ deviceBrand: 'Dell', deviceModel: 'XPS 15 Laptop' }), 'LAPTOP');
  assert.strictEqual(detectDeviceCategory({ deviceBrand: 'Sony', deviceModel: 'Bravia 4K Smart TV' }), 'TV');
});

test('Technician Overview: Standalone Dashboard with No Horizontal Sub-Navigation Tabs', () => {
  const overviewFile = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/technician/TechnicianOverview.tsx'), 'utf-8');

  // Verify that old subnav tabs are completely removed from Overview
  assert.ok(!overviewFile.includes("value=\"overview\""), 'Should not have tab value="overview"');
  assert.ok(!overviewFile.includes("value=\"bench\""), 'Should not have tab value="bench"');
  assert.ok(!overviewFile.includes("value=\"completed\""), 'Should not have tab value="completed"');
  assert.ok(!overviewFile.includes("value=\"transfers\""), 'Should not have tab value="transfers"');
  assert.ok(!overviewFile.includes("<TabsList"), 'Should not have TabsList in standalone Overview');

  // Verify 6 high-level metric cards
  assert.ok(overviewFile.includes('Total Active Repairs'), 'Should have Total Active Repairs card');
  assert.ok(overviewFile.includes('Pending Repairs'), 'Should have Pending Repairs card');
  assert.ok(overviewFile.includes('In Progress / QA'), 'Should have In Progress / QA card');
  assert.ok(overviewFile.includes('Completed Work'), 'Should have Completed Work card');
  assert.ok(overviewFile.includes('Waiting for Parts'), 'Should have Waiting for Parts card');
  assert.ok(overviewFile.includes('Pending Transfers'), 'Should have Pending Transfers card');

  // Verify urgent triage queue
  assert.ok(overviewFile.includes('Urgent Action Required'), 'Should have urgent action required queue');

  // Verify quick queue summary by category
  assert.ok(overviewFile.includes('Active Workload by Device Category'), 'Should have category breakdown');
  assert.ok(overviewFile.includes('DEVICE_CATEGORIES'), 'Should render DEVICE_CATEGORIES breakdown');

  // Verify performance analytics & attendance
  assert.ok(overviewFile.includes('Technician Performance Analytics'), 'Should have performance analytics');
  assert.ok(overviewFile.includes('Attendance Overview'), 'Should have attendance status');
});

test('Technician Repairs: Dedicated Workspace with Status Tabs & 40-item Pagination', () => {
  const repairsFile = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/technician/TechnicianRepairs.tsx'), 'utf-8');

  // Verify dedicated repairs bench features
  assert.ok(repairsFile.includes('REPAIRS_PER_PAGE'), 'Should use centralized REPAIRS_PER_PAGE (40 records per page)');
  assert.ok(repairsFile.includes('ACTIVE'), 'Should have ACTIVE status tab');
  assert.ok(repairsFile.includes('IN_PROCESS'), 'Should have IN_PROCESS status tab');
  assert.ok(repairsFile.includes('WAITING_FOR_PARTS'), 'Should have WAITING_FOR_PARTS status tab');
  assert.ok(repairsFile.includes('TESTING'), 'Should have TESTING status tab');
  assert.ok(repairsFile.includes('PRIORITY'), 'Should have PRIORITY filter tab');
  assert.ok(repairsFile.includes('REPAIRED'), 'Should have REPAIRED tab');

  // Verify view toggles
  assert.ok(repairsFile.includes('viewMode'), 'Should have viewMode toggle');
  assert.ok(repairsFile.includes('LayoutGrid'), 'Should have grid icon');
  assert.ok(repairsFile.includes('TableIcon'), 'Should have list/table icon');

  // Verify repair action modals
  assert.ok(repairsFile.includes('Update Repair #'), 'Should have Update Status dialog');
  assert.ok(repairsFile.includes('Technical Remarks'), 'Should have Technical Remarks dialog');
  assert.ok(repairsFile.includes('Transfer Repair #'), 'Should have Transfer dialog');
});

test('Technician Transfers: Dedicated Workspace for Handoffs and Requests', () => {
  const transfersFile = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/technician/TechnicianTransfers.tsx'), 'utf-8');

  // Verify incoming handoffs with Accept / Decline
  assert.ok(transfersFile.includes('Incoming Requests'), 'Should have Incoming Requests section');
  assert.ok(transfersFile.includes('handleRespond'), 'Should have handleRespond for ACCEPT / REJECT');
  assert.ok(transfersFile.includes('handleCancelOutgoing'), 'Should have handleCancelOutgoing');

  // Verify transfer history & initiate transfer modal
  assert.ok(transfersFile.includes('Transfer Audit Log'), 'Should have Transfer Audit History');
  assert.ok(transfersFile.includes('Initiate New Transfer') || transfersFile.includes('Initiate Repair Transfer'), 'Should have Initiate Transfer button/modal');
  assert.ok(transfersFile.includes('handleCreateTransfer'), 'Should have handleCreateTransfer function');
});

test('Main Sidebar Navigation: Technician Destinations & Pending Transfer Badging', () => {
  const layoutFile = fs.readFileSync(path.resolve(process.cwd(), 'src/components/DashboardLayout.tsx'), 'utf-8');

  // Verify separate technician destinations
  assert.ok(layoutFile.includes("path: '/technician/overview'"), 'Should have /technician/overview route in sidebar');
  assert.ok(layoutFile.includes("path: '/technician/repairs'"), 'Should have /technician/repairs route in sidebar');
  assert.ok(layoutFile.includes("path: '/technician/transfers'"), 'Should have /technician/transfers route in sidebar');

  // Verify badge support for pending transfers
  assert.ok(layoutFile.includes('pendingTransferCount'), 'Should track pending transfer count');
  assert.ok(layoutFile.includes('/repair-transfers/my-requests'), 'Should query incoming transfer requests');

  // Verify router configuration in Dashboard.tsx
  const dashboardRouterFile = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/Dashboard.tsx'), 'utf-8');
  assert.ok(dashboardRouterFile.includes("path=\"technician/overview\""), 'Dashboard router should handle technician/overview');
  assert.ok(dashboardRouterFile.includes("path=\"technician/repairs\""), 'Dashboard router should handle technician/repairs');
  assert.ok(dashboardRouterFile.includes("path=\"technician/transfers\""), 'Dashboard router should handle technician/transfers');
});

test('Technician Header: Live Nepal Time, Dynamic Greeting & Bench Active Badge', () => {
  const headerFile = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/technician/TechnicianHeader.tsx'), 'utf-8');

  // Verify Nepal Timezone
  assert.ok(headerFile.includes("timeZone: 'Asia/Kathmandu'"), 'Should use Asia/Kathmandu timezone');
  assert.ok(headerFile.includes('NPT (UTC+05:45)'), 'Should display NPT label');

  // Verify dynamic user name greeting
  assert.ok(headerFile.includes('user?.name'), 'Should display dynamic user name');
  assert.ok(headerFile.includes('Bench Active'), 'Should display Bench Active badge');
});
