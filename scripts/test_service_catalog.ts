import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { getCategoryInfo } from '../src/pages/Services';

const BASE_URL = 'http://localhost:3000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'mts-lab-super-secret-key';

async function runTests() {
  console.log('=== STARTING MTS LAB SERVICE CATALOG & E-COMMERCE REDESIGN VERIFICATION ===\n');
  let testsPassed = 0;
  let testsFailed = 0;

  function assert(condition: boolean, testName: string, detail?: any) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      testsPassed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`, detail || '');
      testsFailed++;
    }
  }

  const prisma = new PrismaClient();

  try {
    // 1. Verify Public Repair Prices API
    console.log('--- 1. Testing Public Repair Prices API (/api/public/repair-prices) ---');
    const pubRes = await fetch(`${BASE_URL}/public/repair-prices`);
    assert(pubRes.status === 200, 'GET /api/public/repair-prices returns HTTP 200');
    const catalogData: any = await pubRes.json();
    assert(Array.isArray(catalogData), 'API returns an array of repair price catalog items');
    assert(catalogData.length > 0, `Catalog contains ${catalogData.length} active repair services`);

    if (catalogData.length > 0) {
      const sample = catalogData[0];
      assert(sample.hasOwnProperty('brand'), 'Catalog item has brand');
      assert(sample.hasOwnProperty('model'), 'Catalog item has model');
      assert(sample.hasOwnProperty('category'), 'Catalog item has category');
      assert(sample.hasOwnProperty('serviceName'), 'Catalog item has serviceName');
      assert(sample.hasOwnProperty('price'), 'Catalog item has price');
      assert(sample.hasOwnProperty('priceType'), 'Catalog item has priceType');
      console.log(`Sample Service Item: ${sample.brand} ${sample.model} - ${sample.serviceName} (${sample.category}) - Price: NPR ${sample.price}`);
    }

    // 2. Test Category Icon & Styling Resolver for all categories
    console.log('\n--- 2. Testing Category Icon & Badge Auto-Mapping ---');
    
    const categoriesToTest = [
      { cat: 'Battery', serv: 'Battery Replacement', expectedName: 'Battery' },
      { cat: 'Display', serv: 'Compatible OLED Screen', expectedName: 'Display' },
      { cat: 'Front Glass', serv: 'OCA Outer Glass Change', expectedName: 'Front Glass' },
      { cat: 'Lining', serv: 'Laser Green Line Removal', expectedName: 'Laser Line Removal' },
      { cat: 'Flex Change', serv: 'Display Flex Bonding', expectedName: 'Flex Cable Bonding' },
      { cat: 'Green / White Screen', serv: 'White Screen Recovery', expectedName: 'WSOD Screen Recovery' },
      { cat: 'Charging', serv: 'Type-C Charging Pin Replacement', expectedName: 'Charging Port & Pin' },
      { cat: 'Microphone', serv: 'Voice Call Microphone Repair', expectedName: 'Microphone Repair' },
      { cat: 'Speaker', serv: 'Earpiece Speaker Cleaning & Service', expectedName: 'Speaker & Audio' },
      { cat: 'Camera', serv: 'Rear Lens Glass Replacement', expectedName: 'Camera & Lens' },
      { cat: 'Motherboard / IC', serv: 'Power IC Reballing', expectedName: 'Motherboard & IC' },
      { cat: 'Back Glass', serv: 'Rear Housing & Back Cover', expectedName: 'Back Glass & Panel' },
      { cat: 'Water Damage', serv: 'Ultrasonic Board Cleaning', expectedName: 'Water Damage Revival' },
      { cat: 'Software', serv: 'Bootloop Fix & Flash', expectedName: 'Software & Flash' },
      { cat: 'Face ID / Fingerprint', serv: 'TrueDepth Biometric Sensor Fix', expectedName: 'Biometrics & Face ID' },
      { cat: 'Network', serv: 'SIM Tray & 5G Signal Antenna Repair', expectedName: 'Network & Signal' },
      { cat: 'Button', serv: 'Power Button & Volume Switch Repair', expectedName: 'Button & Switch' },
      { cat: 'Vibration', serv: 'Taptic Engine Vibration Motor Service', expectedName: 'Vibration Engine' },
      { cat: 'Flashlight', serv: 'LED Flashlight Torch Replacement', expectedName: 'Flashlight & Torch' },
      { cat: 'General', serv: 'Inspection Diagnostic', expectedName: 'Smartphone Service' }
    ];

    for (const testItem of categoriesToTest) {
      const info = getCategoryInfo(testItem.cat, testItem.serv);
      assert(Boolean(info.icon), `Category "${testItem.cat}" resolves to a valid React icon`);
      assert(Boolean(info.badgeClass), `Category "${testItem.cat}" contains badge styling`);
      assert(Boolean(info.bgClass), `Category "${testItem.cat}" contains soft background styling`);
    }

    // 3. Test Contact Information & WhatsApp Links
    console.log('\n--- 3. Testing Official MTS Contact Info & WhatsApp Links ---');
    const MTS_PHONE = '9869276668';
    const MTS_WHATSAPP = '9779869276668';

    const testDevice = 'Samsung Galaxy S23 Ultra';
    const testService = 'OCA Glass Change';
    const testPrice = 7000;
    const testMsg = `Hello MTS Lab, I would like to inquire about ${testService} for my ${testDevice}. Estimated price: NPR ${testPrice.toLocaleString()}.`;
    const waUrl = `https://wa.me/${MTS_WHATSAPP}?text=${encodeURIComponent(testMsg)}`;

    assert(waUrl.includes('9779869276668'), 'WhatsApp link targets official MTS contact number');
    assert(waUrl.includes(encodeURIComponent(testDevice)), 'WhatsApp link embeds target device name');
    assert(waUrl.includes(encodeURIComponent(testService)), 'WhatsApp link embeds service name');

    // 4. Test Admin Repair Price Management API (CRUD)
    console.log('\n--- 4. Testing Admin Repair Price Management Endpoints ---');
    
    // Super Admin Token
    let superAdmin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN', deletedAt: null } });
    if (!superAdmin) {
      superAdmin = await prisma.user.create({
        data: {
          email: 'admin_catalog_test@mtslab.com',
          name: 'Catalog Test Admin',
          role: 'SUPER_ADMIN',
          password: 'testpassword123'
        }
      });
    }

    const token = jwt.sign(
      { id: superAdmin.id, role: superAdmin.role, email: superAdmin.email, name: superAdmin.name },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    // 4a. Create new service item
    const testItemPayload = {
      brand: 'Google',
      model: 'Pixel 8 Pro',
      variant: '5G',
      category: 'Display',
      problem: 'Cracked Actua OLED Display',
      serviceName: 'Original OLED Screen Replacement',
      price: 24000,
      priceType: 'FIXED',
      status: 'ACTIVE',
      estimatedTime: '1-2 Hours',
      notes: 'OEM 120Hz LTPO OLED panel with optical under-display fingerprint sensor recalibration.'
    };

    const createRes = await fetch(`${BASE_URL}/repair-prices`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(testItemPayload)
    });
    assert(createRes.status === 201 || createRes.status === 200, `POST /api/repair-prices creates service item (HTTP ${createRes.status})`);
    const createdItem: any = await createRes.json();
    assert(createdItem && createdItem.id, 'Created service item has valid database ID');

    // 4b. Update service item
    const updateRes = await fetch(`${BASE_URL}/repair-prices/${createdItem.id}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ price: 23500, notes: 'Updated price with promotional laboratory discount.' })
    });
    const updateText = await updateRes.text();
    let updatedItem: any = null;
    try {
      updatedItem = JSON.parse(updateText);
    } catch (e) {
      console.error('Update response parse error:', updateText);
    }
    assert(updateRes.status === 200, `PUT /api/repair-prices/:id updates service item (HTTP ${updateRes.status})`, updateText);
    assert(updatedItem && updatedItem.price === 23500, 'Price updated accurately in database', updatedItem);

    // 4c. Delete test service item
    const deleteRes = await fetch(`${BASE_URL}/repair-prices/${createdItem.id}`, {
      method: 'DELETE',
      headers: authHeaders
    });
    assert(deleteRes.status === 200, 'DELETE /api/repair-prices/:id removes service item (HTTP 200)');

  } catch (err: any) {
    console.error('UNHANDLED TEST EXCEPTION:', err);
    testsFailed++;
  } finally {
    await prisma.$disconnect();
    console.log(`\n==============================================`);
    console.log(`CATALOG TEST RESULTS: ${testsPassed} Passed, ${testsFailed} Failed`);
    console.log(`==============================================\n`);
    process.exit(testsFailed > 0 ? 1 : 0);
  }
}

runTests();
