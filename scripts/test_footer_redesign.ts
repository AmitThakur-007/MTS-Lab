import fs from 'fs';
import path from 'path';

async function runTests() {
  console.log('=== STARTING MTS LAB FOOTER REDESIGN & BRAND NAME VERIFICATION ===\n');

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

  // 1. Verify Brand Name Updates
  console.log('--- 1. Testing Brand Name Update Across Codebase ---');
  const footerPath = path.join(process.cwd(), 'src/components/Footer.tsx');
  const loginPath = path.join(process.cwd(), 'src/pages/Login.tsx');
  const serverPath = path.join(process.cwd(), 'server.ts');
  const securityPath = path.join(process.cwd(), 'SECURITY.md');

  const footerContent = fs.readFileSync(footerPath, 'utf8');
  const loginContent = fs.readFileSync(loginPath, 'utf8');
  const serverContent = fs.readFileSync(serverPath, 'utf8');
  const securityContent = fs.readFileSync(securityPath, 'utf8');

  assert(footerContent.includes('Mobile Technology Station (MTS)'), 'Footer displays "Mobile Technology Station (MTS)"');
  assert(!footerContent.includes('Mega Technology Station'), 'Footer does not contain old "Mega Technology Station"');
  assert(loginContent.includes('Mobile Technology Station (MTS)'), 'Login page displays "Mobile Technology Station (MTS)"');
  assert(!loginContent.includes('Mega Technology Station'), 'Login page does not contain old "Mega Technology Station"');
  assert(serverContent.includes('Mobile Technology Station (MTS)'), 'Server OTP email template displays "Mobile Technology Station (MTS)"');
  assert(!serverContent.includes('Mega Technology Station'), 'Server does not contain old "Mega Technology Station"');
  assert(securityContent.includes('Mobile Technology Station'), 'SECURITY.md contains "Mobile Technology Station"');

  // 2. Verify Footer Structure and Required Information
  console.log('\n--- 2. Testing Footer Legal, Tax, Business & Support Details ---');
  
  // Business Info
  assert(footerContent.includes('Mobile Technology Station (MTS)'), 'Platform Name: Mobile Technology Station (MTS)');
  assert(footerContent.includes('Smartphone Repair'), 'Business Nature: Smartphone Repair');
  assert(footerContent.includes('Pako Sadak, New Road, Kathmandu, Nepal'), 'Registered Address: Pako Sadak, New Road, Kathmandu, Nepal');
  assert(footerContent.includes('New Road'), 'Head Office / Outlets: New Road');

  // Legal & Tax
  assert(footerContent.includes('125084235'), 'PAN Number: 125084235');
  assert(footerContent.includes('Local Ward Office 22'), 'Registering Authority: Local Ward Office 22');
  assert(footerContent.includes('5650'), 'Registration Certificate No: 5650');
  assert(!footerContent.includes('N/A') && !footerContent.includes('Not Available'), 'No placeholder "N/A" or "Not Available" in legal section');

  // Customer Support
  assert(footerContent.includes('mtslabcustomerservice@gmail.com'), 'Support Email: mtslabcustomerservice@gmail.com');
  assert(footerContent.includes('mailto:mtslabcustomerservice@gmail.com'), 'Mailto link for Support Email');
  assert(footerContent.includes('+977-986927668'), 'Support Phone: +977-986927668');
  assert(footerContent.includes('tel:+977986927668'), 'Tel link for Support Phone');
  assert(footerContent.includes('10:20 AM – 6:30 PM'), 'Operating Hours: 10:20 AM – 6:30 PM');
  assert(footerContent.includes('Sun–Fri'), 'Operating Days: Sun–Fri');

  // Social Media
  assert(footerContent.includes('https://www.facebook.com/MTSmobilescreenrefurblab/'), 'Facebook URL present and correct');
  assert(footerContent.includes('https://www.instagram.com/mtsmobilescreenrefurblab/?hl=en'), 'Instagram URL present and correct');
  assert(footerContent.includes('target="_blank"'), 'Social media links configured with target="_blank"');
  assert(footerContent.includes('rel="noopener noreferrer"'), 'Social media links configured with rel="noopener noreferrer"');

  // Grievance Redressal Unit
  assert(footerContent.includes('Amit Thakur'), 'Grievance Responsible Person: Amit Thakur');
  assert(footerContent.includes('9709797526'), 'Grievance Phone: 9709797526');
  assert(footerContent.includes('tel:+9779709797526'), 'Tel link for Grievance Phone: tel:+9779709797526');

  // Policy Links & Bottom Bar
  assert(footerContent.includes('to="/terms"'), 'Terms & Conditions link points to /terms');
  assert(footerContent.includes('to="/privacy"'), 'Privacy Policy link points to /privacy');
  assert(footerContent.includes('All rights reserved'), 'Bottom bar contains "All rights reserved"');
  assert(footerContent.includes('currentYear'), 'Dynamic copyright year implemented');

  // 3. Test That Footer Component is Rendered on All Required Pages
  console.log('\n--- 3. Testing Footer Inclusions Across All Public Pages ---');
  const pagesToCheck = [
    { name: 'Home page (Home.tsx)', path: 'src/pages/Home.tsx' },
    { name: 'Shop page (Shop.tsx)', path: 'src/pages/Shop.tsx' },
    { name: 'Track repair page (Tracking.tsx)', path: 'src/pages/Tracking.tsx' },
    { name: 'About page (About.tsx)', path: 'src/pages/About.tsx' },
    { name: 'Contact page (Contact.tsx)', path: 'src/pages/Contact.tsx' },
    { name: 'Services page (Services.tsx)', path: 'src/pages/Services.tsx' },
    { name: 'Terms page (Terms.tsx)', path: 'src/pages/Terms.tsx' },
    { name: 'Privacy page (Privacy.tsx)', path: 'src/pages/Privacy.tsx' }
  ];

  for (const page of pagesToCheck) {
    const pageFilePath = path.join(process.cwd(), page.path);
    assert(fs.existsSync(pageFilePath), `File ${page.path} exists`);
    const pageContent = fs.readFileSync(pageFilePath, 'utf8');
    assert(pageContent.includes("import Footer from '@/components/Footer';"), `${page.name} imports Footer component`);
    assert(pageContent.includes('<Footer />') || pageContent.includes('<Footer/>'), `${page.name} renders <Footer />`);
  }

  // 4. Test Policy Pages Exist in App.tsx
  console.log('\n--- 4. Testing Policy Routes in App.tsx ---');
  const appPath = path.join(process.cwd(), 'src/App.tsx');
  const appContent = fs.readFileSync(appPath, 'utf8');
  assert(appContent.includes('path="/terms"'), 'App.tsx contains route path="/terms"');
  assert(appContent.includes('path="/privacy"'), 'App.tsx contains route path="/privacy"');

  // 5. Test HTTP Connectivity to all Public & Policy Routes
  console.log('\n--- 5. Testing HTTP Availability of All Public Routes ---');
  const routesToTest = [
    '/',
    '/about',
    '/services',
    '/shop',
    '/track',
    '/contact',
    '/terms',
    '/privacy',
    '/login'
  ];

  for (const r of routesToTest) {
    try {
      const res = await fetch(`http://localhost:3000${r}`);
      assert(res.status === 200, `Route http://localhost:3000${r} is accessible (HTTP 200)`);
    } catch (err: any) {
      assert(false, `Route http://localhost:3000${r} failed: ${err.message}`);
    }
  }

  console.log('\n==============================================');
  console.log(`FOOTER & BRANDING TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('==============================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
