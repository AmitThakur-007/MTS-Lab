import fs from 'fs';
import path from 'path';

async function runTests() {
  console.log('=== STARTING MTS LAB RECEPTION TELEPHONE CALL VERIFICATION ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: any) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`, detail || '');
      failed++;
    }
  }

  // 1. Inspect Track Repair Direct Call Feature
  console.log('--- 1. Testing Track Repair Page Direct Call Feature ---');
  const trackingPath = path.join(process.cwd(), 'src/pages/Tracking.tsx');
  assert(fs.existsSync(trackingPath), 'src/pages/Tracking.tsx exists');
  const trackingContent = fs.readFileSync(trackingPath, 'utf8');

  assert(trackingContent.includes('Need Help With Your Repair?'), 'Tracking page contains "Need Help With Your Repair?" banner');
  assert(trackingContent.includes('Call MTS Reception'), 'Tracking page contains "Call MTS Reception" heading');
  assert(trackingContent.includes('015364307'), 'Tracking page displays telephone number 015364307');
  assert(trackingContent.includes('href="tel:015364307"'), 'Tracking page button uses tel:015364307');
  assert(trackingContent.includes('id="call-mts-reception-button"'), 'Tracking page has call-mts-reception-button id');
  assert(trackingContent.includes('aria-label="Call MTS Reception at 015364307"'), 'Call button has accessible label');

  // Verify existing tracking search inputs remain intact
  assert(trackingContent.includes('id="tracking-repair-number-input"'), 'Preserved Repair Number input');
  assert(trackingContent.includes('id="tracking-phone-number-input"'), 'Preserved Phone Number input');
  assert(trackingContent.includes('id="track-repair-submit-btn"'), 'Preserved Track Status button');

  // 2. Inspect Shared Global Footer Reception Telephone
  console.log('\n--- 2. Testing Shared Global Footer Component ---');
  const footerPath = path.join(process.cwd(), 'src/components/Footer.tsx');
  assert(fs.existsSync(footerPath), 'src/components/Footer.tsx exists');
  const footerContent = fs.readFileSync(footerPath, 'utf8');

  assert(footerContent.includes('MTS Reception'), 'Footer displays "MTS Reception" label');
  assert(footerContent.includes('015364307'), 'Footer contains telephone number 015364307');
  assert(footerContent.includes('href="tel:015364307"'), 'Footer links to tel:015364307');

  // 3. Verify All Requested Pages Import & Use Shared Footer
  console.log('\n--- 3. Testing Footer Inclusions on All Requested Pages ---');
  const requestedPages = [
    { name: 'Home Page', path: 'src/pages/Home.tsx' },
    { name: 'Service Page', path: 'src/pages/Services.tsx' },
    { name: 'Track Repair Page', path: 'src/pages/Tracking.tsx' },
    { name: 'Shop Page', path: 'src/pages/Shop.tsx' },
    { name: 'Contact Page', path: 'src/pages/Contact.tsx' },
    { name: 'About Page', path: 'src/pages/About.tsx' }
  ];

  for (const page of requestedPages) {
    const pageFilePath = path.join(process.cwd(), page.path);
    assert(fs.existsSync(pageFilePath), `${page.name} (${page.path}) exists`);
    const pageContent = fs.readFileSync(pageFilePath, 'utf8');
    assert(pageContent.includes("import Footer from '@/components/Footer';"), `${page.name} imports shared Footer`);
    assert(pageContent.includes('<Footer />') || pageContent.includes('<Footer/>'), `${page.name} renders <Footer />`);
  }

  // 4. Test HTTP Connectivity to all Pages
  console.log('\n--- 4. Testing HTTP Availability of All Pages ---');
  const routesToTest = [
    '/track',
    '/',
    '/services',
    '/shop',
    '/contact',
    '/about'
  ];

  for (const r of routesToTest) {
    try {
      const res = await fetch(`http://localhost:3000${r}`);
      assert(res.status === 200, `HTTP GET http://localhost:3000${r} is active (HTTP 200)`);
    } catch (err: any) {
      assert(false, `HTTP GET http://localhost:3000${r} failed: ${err.message}`);
    }
  }

  console.log('\n==============================================');
  console.log(`RECEPTION TELEPHONE CALL TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('==============================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
