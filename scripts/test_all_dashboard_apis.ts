import { createServerApp } from '../server';
import { supabase } from '../server';

async function testAllDashboardApis() {
  console.log('================================================================');
  console.log('🚀 TESTING ALL MTS LAB DASHBOARD APIS AGAINST SUPABASE POSTGRESQL');
  console.log('================================================================\n');

  // 1. Get Supabase Super Admin Auth Token
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'amitsharma6401790@gmail.com',
    password: 'Amit@200%date'
  });

  if (authErr || !authData.session) {
    console.error('❌ Failed to authenticate Super Admin for API tests:', authErr?.message);
    process.exit(1);
  }

  const token = authData.session.access_token;
  console.log('✅ Super Admin Token acquired successfully.\n');

  const app = await createServerApp();

  const endpointsToTest = [
    { name: 'Staff Management (/api/users)', path: '/api/users', method: 'GET' },
    { name: 'Staff List (/api/staff)', path: '/api/staff', method: 'GET' },
    { name: 'Repairs Hub (/api/repairs)', path: '/api/repairs', method: 'GET' },
    { name: 'Customer Hub (/api/customers)', path: '/api/customers', method: 'GET' },
    { name: 'Inventory Hub (/api/inventory)', path: '/api/inventory', method: 'GET' },
    { name: 'Attendance Server Time (/api/attendance/server-time)', path: '/api/attendance/server-time', method: 'GET' },
    { name: 'Attendance Today (/api/attendance/today)', path: '/api/attendance/today', method: 'GET' },
    { name: 'Attendance History (/api/attendance/history)', path: '/api/attendance/history', method: 'GET' },
    { name: 'Repair Damage (/api/repair-damage)', path: '/api/repair-damage', method: 'GET' },
    { name: 'Battery Warranties (/api/battery-warranties)', path: '/api/battery-warranties', method: 'GET' },
    { name: 'Couriers Hub (/api/couriers)', path: '/api/couriers', method: 'GET' },
    { name: 'Services & Prices (/api/repair-prices)', path: '/api/repair-prices', method: 'GET' },
    { name: 'Notifications (/api/notifications)', path: '/api/notifications', method: 'GET' },
    { name: 'Access Requests (/api/access-requests)', path: '/api/access-requests', method: 'GET' },
    { name: 'Dashboard Stats (/api/dashboard/stats)', path: '/api/dashboard/stats', method: 'GET' },
  ];

  let passed = 0;
  let failed = 0;

  for (const ep of endpointsToTest) {
    await new Promise<void>((resolve) => {
      const mockReq: any = {
        method: ep.method,
        url: ep.path,
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json'
        },
        query: {},
        body: {},
        cookies: {},
        ip: '127.0.0.1'
      };

      let statusCode = 200;
      let responseBody: any = null;
      let finished = false;

      const mockRes: any = {
        statusCode: 200,
        headersSent: false,
        headers: {},
        setHeader(k: string, v: string) { this.headers[k] = v; return this; },
        getHeader(k: string) { return this.headers[k]; },
        status(code: number) { this.statusCode = code; statusCode = code; return this; },
        sendStatus(code: number) { this.statusCode = code; statusCode = code; this.end(); return this; },
        json(data: any) {
          responseBody = data;
          this.headersSent = true;
          this.end(JSON.stringify(data));
          return this;
        },
        send(data: any) {
          responseBody = data;
          this.headersSent = true;
          this.end(data);
          return this;
        },
        end(data?: any) {
          if (finished) return;
          finished = true;
          if (data && !responseBody) responseBody = data;
          
          if (statusCode >= 200 && statusCode < 400) {
            console.log(`✅ [HTTP ${statusCode}] ${ep.name} -> SUCCESS`);
            passed++;
          } else {
            console.error(`❌ [HTTP ${statusCode}] ${ep.name} -> FAILED:`, responseBody);
            failed++;
          }
          resolve();
        }
      };

      try {
        app(mockReq, mockRes, (err: any) => {
          if (err) {
            console.error(`❌ [ERROR] ${ep.name} -> Unhandled route error:`, err);
            failed++;
            resolve();
          }
        });
      } catch (err: any) {
        console.error(`❌ [CRASH] ${ep.name} -> Handler threw exception:`, err);
        failed++;
        resolve();
      }
    });
  }

  console.log('\n================================================================');
  console.log(`🎯 DASHBOARD API TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

testAllDashboardApis();
