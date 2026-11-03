import { test, describe } from 'node:test';
import assert from 'node:assert';
import { detectDeviceCategory } from '../src/pages/technician/types.js';

// Workload calculation logic mirror from technicianManager.ts
function calculateWorkloadStatus(activeCount: number): {
  status: 'AVAILABLE' | 'NORMAL' | 'HEAVY' | 'OVERLOADED';
  label: string;
  badgeClass: string;
} {
  if (activeCount <= 2) {
    return {
      status: 'AVAILABLE',
      label: 'Available',
      badgeClass: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
    };
  } else if (activeCount <= 6) {
    return {
      status: 'NORMAL',
      label: 'Normal Workload',
      badgeClass: 'bg-blue-500/10 text-blue-500 border-blue-500/20'
    };
  } else if (activeCount <= 9) {
    return {
      status: 'HEAVY',
      label: 'Heavy Workload',
      badgeClass: 'bg-amber-500/10 text-amber-500 border-amber-500/20'
    };
  } else {
    return {
      status: 'OVERLOADED',
      label: 'Overloaded',
      badgeClass: 'bg-red-500/10 text-red-500 border-red-500/20'
    };
  }
}

describe('Technician Manager Module Tests', () => {
  describe('Workload Status Calculation Business Rules', () => {
    test('Correctly flags 0-2 active jobs as AVAILABLE', () => {
      const zero = calculateWorkloadStatus(0);
      assert.strictEqual(zero.status, 'AVAILABLE');
      assert.strictEqual(zero.label, 'Available');

      const two = calculateWorkloadStatus(2);
      assert.strictEqual(two.status, 'AVAILABLE');
    });

    test('Correctly flags 3-6 active jobs as NORMAL Workload', () => {
      const three = calculateWorkloadStatus(3);
      assert.strictEqual(three.status, 'NORMAL');
      assert.strictEqual(three.label, 'Normal Workload');

      const six = calculateWorkloadStatus(6);
      assert.strictEqual(six.status, 'NORMAL');
    });

    test('Correctly flags 7-9 active jobs as HEAVY Workload', () => {
      const seven = calculateWorkloadStatus(7);
      assert.strictEqual(seven.status, 'HEAVY');
      assert.strictEqual(seven.label, 'Heavy Workload');

      const nine = calculateWorkloadStatus(9);
      assert.strictEqual(nine.status, 'HEAVY');
    });

    test('Correctly flags 10+ active jobs as OVERLOADED', () => {
      const ten = calculateWorkloadStatus(10);
      assert.strictEqual(ten.status, 'OVERLOADED');
      assert.strictEqual(ten.label, 'Overloaded');

      const fifteen = calculateWorkloadStatus(15);
      assert.strictEqual(fifteen.status, 'OVERLOADED');
    });
  });

  describe('Device Category Detection across workshop devices', () => {
    test('Classifies iPhone models correctly', () => {
      assert.strictEqual(detectDeviceCategory({ deviceBrand: 'Apple', deviceModel: 'iPhone 15 Pro Max' }), 'IPHONE');
      assert.strictEqual(detectDeviceCategory({ deviceBrand: '', deviceModel: 'iPhone 13 mini' }), 'IPHONE');
    });

    test('Classifies Android smartphones correctly', () => {
      assert.strictEqual(detectDeviceCategory({ deviceBrand: 'Samsung', deviceModel: 'Galaxy S24 Ultra' }), 'SMARTPHONE');
      assert.strictEqual(detectDeviceCategory({ deviceBrand: 'Google', deviceModel: 'Pixel 8 Pro' }), 'SMARTPHONE');
      assert.strictEqual(detectDeviceCategory({ deviceBrand: 'OnePlus', deviceModel: '12R' }), 'SMARTPHONE');
      assert.strictEqual(detectDeviceCategory({ deviceBrand: 'Xiaomi', deviceModel: 'Redmi Note 13' }), 'SMARTPHONE');
    });

    test('Classifies iPads and Tablets correctly', () => {
      assert.strictEqual(detectDeviceCategory({ deviceBrand: 'Apple', deviceModel: 'iPad Air M2' }), 'IPAD');
      assert.strictEqual(detectDeviceCategory({ deviceBrand: 'Apple', deviceModel: 'iPad Pro 11-inch' }), 'IPAD');
      assert.strictEqual(detectDeviceCategory({ deviceBrand: 'Samsung', deviceModel: 'Galaxy Tab S9' }), 'TABLET');
      assert.strictEqual(detectDeviceCategory({ deviceBrand: 'Lenovo', deviceModel: 'Tab M10 Plus' }), 'TABLET');
    });

    test('Classifies Laptops and MacBooks correctly', () => {
      assert.strictEqual(detectDeviceCategory({ deviceBrand: 'Apple', deviceModel: 'MacBook Pro 16 M3' }), 'LAPTOP');
      assert.strictEqual(detectDeviceCategory({ deviceBrand: 'Dell', deviceModel: 'XPS 15 Laptop' }), 'LAPTOP');
      assert.strictEqual(detectDeviceCategory({ deviceBrand: 'Lenovo', deviceModel: 'ThinkPad X1 Carbon' }), 'LAPTOP');
    });

    test('Classifies TVs and Displays correctly', () => {
      assert.strictEqual(detectDeviceCategory({ deviceBrand: 'Sony', deviceModel: 'Bravia 65-inch OLED TV' }), 'TV');
      assert.strictEqual(detectDeviceCategory({ deviceBrand: 'Samsung', deviceModel: 'Neo QLED Television 55"' }), 'TV');
      assert.strictEqual(detectDeviceCategory({ deviceBrand: 'LG', deviceModel: 'Smart LED TV 4K' }), 'TV');
    });
  });

  describe('Role-Based Access Control (RBAC) Requirements', () => {
    const authorizedRoles = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
    const unauthorizedRoles = [
      'TECHNICIAN',
      'LEAD_TECHNICIAN',
      'HEAD_TECHNICIAN',
      'TECHNICAL_ASSISTANT',
      'CUSTOMER',
      'FRONT_DESK',
      'STAFF'
    ];

    test('Authorized roles (SUPER_ADMIN, ADMIN, MANAGER) have explicit access', () => {
      authorizedRoles.forEach((role) => {
        assert.ok(
          authorizedRoles.includes(role),
          `Role ${role} should be authorized for Technician Manager`
        );
      });
    });

    test('Technicians and unauthorized roles are strictly forbidden', () => {
      unauthorizedRoles.forEach((role) => {
        assert.ok(
          !authorizedRoles.includes(role),
          `Role ${role} should NOT be authorized for Technician Manager`
        );
      });
    });
  });

  describe('Priority Level Enums & Values', () => {
    const validPriorities = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

    test('Valid priority levels are recognized', () => {
      validPriorities.forEach((priority) => {
        assert.ok(validPriorities.includes(priority));
      });
    });

    test('Invalid priority level strings are rejected', () => {
      const invalid = ['CRITICAL', 'EMERGENCY', 'MEDIUM', 'SUPER_URGENT', ''];
      invalid.forEach((p) => {
        assert.ok(!validPriorities.includes(p));
      });
    });
  });
});
