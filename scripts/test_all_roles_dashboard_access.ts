import { createServerApp } from '../server';
import { supabase } from '../server';

async function testAllRolesDashboardAccess() {
  console.log('================================================================');
  console.log('👥 TESTING ALL 6 ROLES ACCESS & PERMISSIONS AGAINST APIS');
  console.log('================================================================\n');

  const app = await createServerApp();

  const accounts = [
    { role: 'SUPER_ADMIN', email: 'admin@mtslab.com', pass: 'admin123', allowedPath: '/api/users', forbiddenPath: '' },
    { role: 'SUPER_ADMIN', email: 'amitsharma6401790@gmail.com', pass: 'Amit@200%date', allowedPath: '/api/users', forbiddenPath: '' },
    { role: 'MANAGER', email: 'manishmts17900@gmail.com', pass: 'admin123', allowedPath: '/api/repairs', forbiddenPath: '/api/users' },
    { role: 'TECHNICIAN', email: 'amitthakur63017900@gmail.com', pass: 'admin123', allowedPath: '/api/repairs', forbiddenPath: '/api/users' },
    { role: 'TECHNICIAN', email: 'manojacharya526@gmail.com', pass: 'admin123', allowedPath: '/api/repairs', forbiddenPath: '/api/users' },
    { role: 'RECEPTIONIST', email: 'omprakashthakur950rt@gmail.com', pass: 'admin123', allowedPath: '/api/customers', forbiddenPath: '/api/users' },
    { role: 'RECEPTIONIST', email: 'pramila123@gmail.com', pass: 'admin123', allowedPath: '/api/customers', forbiddenPath: '/api/users' },
  ];

  let passed = 0;
  let failed = 0;

  for (const acc of accounts) {
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
      email: acc.email,
      password: acc.pass
    });

    if (authErr || !authData.session) {
      console.error(`❌ Failed login for ${acc.role} (${acc.email}):`, authErr?.message);
      failed++;
      continue;
    }

    const token = authData.session.access_token;

    // Test Allowed Endpoint
    await new Promise<void>((resolve) => {
      const mockReq: any = {
        method: 'GET',
        url: acc.allowedPath,
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        query: {},
        body: {},
        cookies: {},
        ip: '127.0.0.1'
      };

      const mockRes: any = {
        statusCode: 200,
        headersSent: false,
        headers: {},
        setHeader(k: string, v: string) { this.headers[k] = v; return this; },
        getHeader(k: string) { return this.headers[k]; },
        status(c: number) { this.statusCode = c; return this; },
        sendStatus(c: number) { this.statusCode = c; this.end(); return this; },
        json(d: any) { this.end(JSON.stringify(d)); return this; },
        send(d: any) { this.end(d); return this; },
        end() {
          if (mockRes.statusCode >= 200 && mockRes.statusCode < 400) {
            console.log(`✅ [${acc.role}] ${acc.email} -> Allowed access to ${acc.allowedPath} (HTTP ${mockRes.statusCode})`);
            passed++;
          } else {
            console.error(`❌ [${acc.role}] ${acc.email} -> FAILED access to ${acc.allowedPath} (HTTP ${mockRes.statusCode})`);
            failed++;
          }
          resolve();
        }
      };

      app(mockReq, mockRes, () => resolve());
    });

    // Test Forbidden Endpoint (if applicable)
    if (acc.forbiddenPath) {
      await new Promise<void>((resolve) => {
        const mockReq: any = {
          method: 'GET',
          url: acc.forbiddenPath,
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          query: {},
          body: {},
          cookies: {},
          ip: '127.0.0.1'
        };

        const mockRes: any = {
          statusCode: 200,
          headersSent: false,
          headers: {},
          setHeader(k: string, v: string) { this.headers[k] = v; return this; },
          getHeader(k: string) { return this.headers[k]; },
          status(c: number) { this.statusCode = c; return this; },
          sendStatus(c: number) { this.statusCode = c; this.end(); return this; },
          json(d: any) { this.end(JSON.stringify(d)); return this; },
          send(d: any) { this.end(d); return this; },
          end() {
            if (mockRes.statusCode === 403) {
              console.log(`🛡️ [RBAC GUARD] ${acc.role} successfully blocked from ${acc.forbiddenPath} (HTTP 403 Forbidden)`);
              passed++;
            } else {
              console.error(`❌ [RBAC GUARD FAILED] ${acc.role} received HTTP ${mockRes.statusCode} on ${acc.forbiddenPath}`);
              failed++;
            }
            resolve();
          }
        };

        app(mockReq, mockRes, () => resolve());
      });
    }
  }

  console.log('\n================================================================');
  console.log(`🎯 RBAC & ROLE ACCESS TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

testAllRolesDashboardAccess();
