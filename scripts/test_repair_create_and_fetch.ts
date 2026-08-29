import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE_URL = process.env.VITE_BACKEND_URL || 'http://localhost:3000';

async function testRepairFlow() {
  console.log('================================================================================');
  console.log('MTS LAB — REPAIR CREATION AND DASHBOARD FETCH TRACE');
  console.log('================================================================================\n');

  // 1. Authenticate as SuperAdmin
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identity: 'amitsharma64017900@gmail.com',
      password: 'Ganesh@200%life',
      isClientVerified: true
    })
  });
  const loginData: any = await loginRes.json();
  const token = loginData.token;
  console.log('✓ Authenticated as SuperAdmin, token acquired.\n');

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // 2. Fetch baseline repairs
  const baselineRes = await fetch(`${BASE_URL}/api/repairs`, { headers });
  const baselineRepairs: any = await baselineRes.json();
  console.log(`Baseline Repairs count: ${baselineRepairs.length}`);

  // 3. Create a New Repair
  const testRepairPayload = {
    customerName: 'Sita Devi Sharma',
    customerPhone: '9841998877',
    customerEmail: 'sita.sharma@example.com',
    customerAddress: 'Baneshwor, Kathmandu',
    deviceBrand: 'Apple',
    deviceModel: 'iPhone 15 Pro Max',
    deviceColor: 'Natural Titanium',
    deviceCondition: 'Minor scratches on bezel',
    problemDescription: 'Display touch unresponsive after drop',
    accessoriesReceived: 'Original box, Case',
    estimatedCost: 35000,
    advancePaid: 5000,
    priority: 'HIGH',
    receivingMethod: 'WALK_IN',
    hasBatteryWarranty: true,
    batteryWarrantyPeriod: '1_YEAR',
    batteryType: 'Original Apple Battery Pack'
  };

  console.log('\nCreating repair via POST /api/repairs...');
  const createRes = await fetch(`${BASE_URL}/api/repairs`, {
    method: 'POST',
    headers,
    body: JSON.stringify(testRepairPayload)
  });

  console.log(`POST /api/repairs status: ${createRes.status} ${createRes.statusText}`);
  const createdRepair: any = await createRes.json();
  console.log('Created Repair Result:', {
    id: createdRepair.id,
    repairNumber: createdRepair.repairNumber,
    customerName: createdRepair.customerName,
    deviceModel: createdRepair.deviceModel,
    status: createdRepair.status,
    warranty: createdRepair.batteryWarranty?.warrantyNumber
  });

  // 4. Query GET /api/repairs immediately
  console.log('\nFetching GET /api/repairs immediately after creation...');
  const postCreateRes = await fetch(`${BASE_URL}/api/repairs`, { headers });
  const postCreateRepairs: any = await postCreateRes.json();
  console.log(`Post-Create Repairs count: ${postCreateRepairs.length}`);

  const found = postCreateRepairs.find((r: any) => r.id === createdRepair.id || r.repairNumber === createdRepair.repairNumber);
  if (found) {
    console.log('✓ SUCCESS: Newly created repair found in GET /api/repairs!');
    console.log('Found Repair:', {
      id: found.id,
      repairNumber: found.repairNumber,
      customerName: found.customerName,
      customerPhone: found.customerPhone,
      deviceBrand: found.deviceBrand,
      deviceModel: found.deviceModel,
      status: found.status,
      customerRelation: found.customer?.name
    });
  } else {
    console.error('✗ ERROR: Newly created repair NOT found in GET /api/repairs list!');
  }

  // 5. Query GET /api/dashboard/stats
  console.log('\nFetching GET /api/dashboard/stats...');
  const statsRes = await fetch(`${BASE_URL}/api/dashboard/stats`, { headers });
  const stats: any = await statsRes.json();
  console.log('Dashboard Stats:', stats);

  // 6. Check what happens if a Technician queries repairs
  console.log('\nTesting Technician role visibility:');
  const tech = await prisma.user.findFirst({ where: { role: 'TECHNICIAN' } });
  if (tech) {
    const techLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: tech.email, password: 'Password123!', isClientVerified: true })
    });
    const techToken = (await techLogin.json() as any).token;
    const techRepairsRes = await fetch(`${BASE_URL}/api/repairs`, {
      headers: { Authorization: `Bearer ${techToken}` }
    });
    const techRepairs: any = await techRepairsRes.json();
    console.log(`Technician (${tech.name}) repairs count: ${techRepairs.length} (Expected: only assigned repairs)`);
  }
}

testRepairFlow()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
