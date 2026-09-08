import { createApp } from '../src/server/app';
import http from 'http';
import jwt from 'jsonwebtoken';
import { config } from '../src/server/config/supabase';

async function runRBACTests() {
  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => server.listen(3098, () => resolve()));
  console.log('✅ RBAC Test Server listening on port 3098');

  const BASE = 'http://127.0.0.1:3098';
  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✗ ${name}:`, err.message);
      failed++;
    }
  }

  // Create test tokens for each role using existing database user IDs
  const superAdminToken = jwt.sign(
    { id: '126a924b-af24-445f-a7b8-a67ba824b15c', email: 'mtsmobilelab@gmail.com', role: 'SUPER_ADMIN' },
    config.jwtSecret,
    { expiresIn: '1h' }
  );

  const technicianToken = jwt.sign(
    { id: '4b8a6081-1f1e-4140-8a76-e6e0ef1dfa45', email: 'amitthakur63017900@gmail.com', role: 'TECHNICIAN' },
    config.jwtSecret,
    { expiresIn: '1h' }
  );

  const receptionistToken = jwt.sign(
    { id: 'd4f7d754-3d1c-4edc-9b0d-a25c857f31ee', email: 'pramila123@gmail.com', role: 'RECEPTIONIST' },
    config.jwtSecret,
    { expiresIn: '1h' }
  );

  // 1. Super Admin Tests
  await test('Super Admin can access staff list', async () => {
    const res = await fetch(`${BASE}/api/users`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const json = await res.json();
    if (!Array.isArray(json)) throw new Error('Expected array');
  });

  await test('Super Admin can access audit logs', async () => {
    const res = await fetch(`${BASE}/api/admin/audit-logs`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const json = await res.json();
    if (!json.logs) throw new Error('Expected logs property');
  });

  await test('Super Admin can access repairs', async () => {
    const res = await fetch(`${BASE}/api/repairs`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const json = await res.json();
    if (!Array.isArray(json)) throw new Error('Expected array');
  });

  // 2. Technician RBAC Tests
  await test('Technician CAN access assigned repairs', async () => {
    const res = await fetch(`${BASE}/api/repairs`, {
      headers: { Authorization: `Bearer ${technicianToken}` },
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  });

  await test('Technician CANNOT access SuperAdmin audit logs (403 Forbidden)', async () => {
    const res = await fetch(`${BASE}/api/admin/audit-logs`, {
      headers: { Authorization: `Bearer ${technicianToken}` },
    });
    if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
  });

  await test('Technician CANNOT create staff member (403 Forbidden)', async () => {
    const res = await fetch(`${BASE}/api/users`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${technicianToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Unauthorized Staff', email: 'unauth@test.com' }),
    });
    if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
  });

  // 3. Receptionist RBAC Tests
  await test('Receptionist CAN access customer list', async () => {
    const res = await fetch(`${BASE}/api/customers`, {
      headers: { Authorization: `Bearer ${receptionistToken}` },
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  });

  await test('Receptionist CAN access courier hub', async () => {
    const res = await fetch(`${BASE}/api/couriers`, {
      headers: { Authorization: `Bearer ${receptionistToken}` },
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  });

  await test('Receptionist CANNOT access audit logs (403 Forbidden)', async () => {
    const res = await fetch(`${BASE}/api/admin/audit-logs`, {
      headers: { Authorization: `Bearer ${receptionistToken}` },
    });
    if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
  });

  // 4. Feature Endpoints Verification
  await test('GET /api/inventory/stats returns KPI stats', async () => {
    const res = await fetch(`${BASE}/api/inventory/stats`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const json = await res.json();
    if (json.totalItems === undefined) throw new Error('Missing totalItems');
  });

  await test('GET /api/battery-warranties returns warranty list', async () => {
    const res = await fetch(`${BASE}/api/battery-warranties`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const json = await res.json();
    if (!Array.isArray(json)) throw new Error('Expected array');
  });

  await test('GET /api/repair-damage/overview returns overview KPIs', async () => {
    const res = await fetch(`${BASE}/api/repair-damage/overview`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const json = await res.json();
    if (json.totalRecords === undefined) throw new Error('Missing totalRecords');
  });

  await test('GET /api/manager/stats returns manager KPI counts', async () => {
    const res = await fetch(`${BASE}/api/manager/stats`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const json = await res.json();
    if (json.totalRepairs === undefined) throw new Error('Missing totalRepairs');
  });

  console.log(`\n========================================`);
  console.log(`RBAC Tests Completed: ${passed} passed, ${failed} failed`);
  console.log(`========================================`);

  server.close();
  process.exit(failed > 0 ? 1 : 0);
}

runRBACTests().catch((err) => {
  console.error('RBAC test run failure:', err);
  process.exit(1);
});
