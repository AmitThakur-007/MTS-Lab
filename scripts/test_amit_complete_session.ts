const BASE_URL = process.env.VITE_BACKEND_URL || 'http://localhost:3000';

async function testAmitCompleteSession() {
  console.log('================================================================================');
  console.log('MTS LAB — FULL AUTHENTICATION & DASHBOARD SEQUENCE FOR AMIT SHARMA');
  console.log('================================================================================\n');

  console.log('1. Submitting Login Form (POST /api/auth/login)...');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identity: 'amitsharma64017900@gmail.com',
      password: 'Ganesh@200%life',
      device: {
        deviceIdentifier: 'dev_qa_verified_browser',
        deviceName: 'Chrome on Windows',
        deviceType: 'DESKTOP'
      },
      isClientVerified: true
    })
  });

  console.log(`   -> Status: ${loginRes.status} ${loginRes.statusText}`);
  const loginBody: any = await loginRes.json();
  console.log('   -> Success:', loginBody.success);
  console.log('   -> User Role:', loginBody.user?.role);
  console.log('   -> User Name:', loginBody.user?.name);
  console.log('   -> Has Token:', Boolean(loginBody.token));

  if (!loginBody.token) {
    throw new Error('Login failed to return token!');
  }

  const token = loginBody.token;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  console.log('\n2. Testing Immediate Post-Login Dashboard Requests...');

  const endpoints = [
    { name: 'User Profile Verification', url: '/api/auth/me' },
    { name: 'Dashboard Core Statistics', url: '/api/dashboard/stats' },
    { name: 'Repair Damage Overview', url: '/api/repair-damage/overview' },
    { name: 'Repairs Table', url: '/api/repairs' },
    { name: 'Customer Hub Table', url: '/api/customers' },
    { name: 'Inventory Parts Table', url: '/api/inventory' },
    { name: 'Courier Logistics Table', url: '/api/couriers' },
    { name: 'Battery Warranties', url: '/api/battery-warranties' },
    { name: 'Daily Attendance', url: '/api/attendance/today' },
    { name: 'Service & Repair Prices', url: '/api/repair-prices' },
    { name: 'Homepage Slides', url: '/api/admin/slides' },
    { name: 'Staff Management', url: '/api/staff' }
  ];

  let allSuccess = true;
  for (const ep of endpoints) {
    try {
      const res = await fetch(`${BASE_URL}${ep.url}`, { headers });
      const body: any = await res.json().catch(() => ({}));
      const count = Array.isArray(body) ? `${body.length} records` : (body?.stats || body?.user || body?.success !== undefined ? 'OK' : Object.keys(body).length + ' keys');
      if (res.status === 200) {
        console.log(`  ✓ [200 OK]  ${ep.name.padEnd(30)}: ${ep.url.padEnd(30)} -> Result: ${count}`);
      } else {
        allSuccess = false;
        console.error(`  ✗ [${res.status}] ${ep.name.padEnd(30)}: ${ep.url.padEnd(30)} -> Error:`, body);
      }
    } catch (err: any) {
      allSuccess = false;
      console.error(`  ✗ [ERR]     ${ep.name.padEnd(30)}: ${ep.url.padEnd(30)} -> ${err.message}`);
    }
  }

  console.log('\n================================================================================');
  console.log(`OVERALL STATUS: ${allSuccess ? 'ALL REQUESTS 100% SUCCESSFUL — ZERO 500 ERRORS' : 'SOME REQUESTS FAILED'}`);
  console.log('================================================================================\n');
}

testAmitCompleteSession().catch(console.error);
