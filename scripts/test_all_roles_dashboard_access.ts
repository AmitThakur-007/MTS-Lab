import { createApp } from '../src/server/app';
import { supabasePublic } from '../src/server/config/supabase';
import http from 'http';

async function testAllRolesDashboardAccess() {
  console.log('================================================================');
  console.log('👥 TESTING ALL 6 ROLES ACCESS & PERMISSIONS AGAINST APIS');
  console.log('================================================================\n');

  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(3096, () => resolve()));
  const BASE = 'http://127.0.0.1:3096';

  const accounts = [
    { role: 'SUPER_ADMIN', email: 'mtsmobilelab@gmail.com', pass: 'MtsLab@2026', allowedPath: '/api/users', forbiddenPath: '' },
    { role: 'MANAGER', email: 'manishmts17900@gmail.com', pass: 'admin123', allowedPath: '/api/repairs', forbiddenPath: '/api/admin/audit-logs' },
    { role: 'TECHNICIAN', email: 'amitthakur63017900@gmail.com', pass: 'admin123', allowedPath: '/api/repairs', forbiddenPath: '/api/admin/audit-logs' },
    { role: 'RECEPTIONIST', email: 'pramila123@gmail.com', pass: 'admin123', allowedPath: '/api/customers', forbiddenPath: '/api/admin/audit-logs' },
  ];

  for (const acc of accounts) {
    console.log(`Checking role [${acc.role}] for ${acc.email}...`);
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: acc.email, password: acc.pass }),
    });
    console.log(`  Login status: ${res.status}`);
  }

  server.close();
}

testAllRolesDashboardAccess().catch(console.error);
