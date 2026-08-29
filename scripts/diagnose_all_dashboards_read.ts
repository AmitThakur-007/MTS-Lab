import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const BASE_URL = process.env.VITE_BACKEND_URL || 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'mts-jwt-secret-key-production-change-this';

const ROLES = [
  'SUPERADMIN',
  'ADMIN',
  'MANAGER',
  'HEAD_TECHNICIAN',
  'TECHNICIAN',
  'RECEPTIONIST'
];

async function createOrGetUserForRole(role: string) {
  let user = await prisma.user.findFirst({
    where: { role: { in: [role, role.replace('_', '')] }, deletedAt: null, isActive: true }
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: `test.${role.toLowerCase()}@mtslab.com`,
        password: '$2b$10$dummyhashedpasswordfortestingpurposesonly000000000000000',
        name: `Test ${role}`,
        role: role,
        isActive: true,
        accountStatus: 'ACTIVE',
        emailVerified: true
      }
    });
  }

  // Ensure active session
  await prisma.session.create({
    data: {
      userId: user.id,
      refreshToken: `ref_${Date.now()}_${Math.random()}`,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      lastActiveAt: new Date()
    }
  }).catch(() => {});

  const token = jwt.sign(
    { id: user.id, userId: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '2h' }
  );

  return { user, token };
}

async function runDashboardReadDiagnostics() {
  console.log('================================================================================');
  console.log('MTS LAB — DASHBOARD DATA READ & RBAC DIAGNOSTIC SUITE');
  console.log('================================================================================\n');

  // Verify database record counts first
  const dbCounts = {
    users: await prisma.user.count({ where: { deletedAt: null } }),
    customers: await prisma.customer.count(),
    repairs: await prisma.repair.count(),
    inventory: await prisma.inventoryItem.count(),
    batteryWarranties: await prisma.batteryWarranty.count(),
    attendances: await prisma.attendance.count(),
    repairDamages: await prisma.repairRelatedDamage.count(),
    repairPrices: await prisma.repairPrice.count(),
    slides: await prisma.homeSlide.count(),
    branches: await prisma.branch.count()
  };

  console.log('📊 DATABASE RECORD COUNTS IN PRISMA:');
  console.table(dbCounts);
  console.log('\n');

  const ENDPOINTS = [
    { path: '/api/dashboard/stats', name: 'Dashboard Stats' },
    { path: '/api/repair-damage/overview', name: 'Damage Overview' },
    { path: '/api/repairs', name: 'Repairs List' },
    { path: '/api/customers', name: 'Customers List' },
    { path: '/api/inventory', name: 'Inventory Items' },
    { path: '/api/inventory/categories', name: 'Inventory Categories' },
    { path: '/api/couriers', name: 'Couriers List' },
    { path: '/api/battery-warranties', name: 'Battery Warranties' },
    { path: '/api/attendance', name: 'Attendance Records' },
    { path: '/api/repair-damage', name: 'Repair Damage Records' },
    { path: '/api/repair-prices', name: 'Repair Prices' },
    { path: '/api/admin/slides', name: 'Home Slides' },
    { path: '/api/staff', name: 'Staff List' },
    { path: '/api/branches', name: 'Branches' }
  ];

  for (const role of ROLES) {
    console.log(`\n--------------------------------------------------------------------------------`);
    console.log(`🔐 TESTING ROLE: ${role}`);
    console.log(`--------------------------------------------------------------------------------`);
    const { user, token } = await createOrGetUserForRole(role);

    for (const ep of ENDPOINTS) {
      try {
        const res = await fetch(`${BASE_URL}${ep.path}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          }
        });

        const data: any = await res.json().catch(() => null);
        let count = 0;
        if (Array.isArray(data)) {
          count = data.length;
        } else if (data && typeof data === 'object') {
          if (Array.isArray(data.repairs)) count = data.repairs.length;
          else if (Array.isArray(data.customers)) count = data.customers.length;
          else if (Array.isArray(data.items)) count = data.items.length;
          else if (Array.isArray(data.records)) count = data.records.length;
          else count = Object.keys(data).length;
        }

        console.log(`  [${res.status}] ${ep.name.padEnd(25)}: ${ep.path.padEnd(30)} -> Count/Keys: ${count}`);
        if (res.status >= 400 && res.status !== 403) {
          console.error(`    ⚠️ Unexpected status ${res.status}:`, data);
        }
      } catch (err: any) {
        console.error(`    ✗ Fetch failure on ${ep.path}:`, err.message);
      }
    }
  }

  console.log('\n================================================================================');
  console.log('DIAGNOSTICS COMPLETED');
  console.log('================================================================================\n');
}

runDashboardReadDiagnostics()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
