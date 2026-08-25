import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3000';

async function runFaviconTests() {
  console.log("================================================================================");
  console.log("MTS LAB — WEBSITE FAVICON & TAB BRANDING VERIFICATION SUITE");
  console.log("================================================================================");

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, message: string) {
    totalTests++;
    if (condition) {
      console.log(`  ✓ PASS [Test ${totalTests}]: ${message}`);
      passedTests++;
    } else {
      console.error(`  ✗ FAIL [Test ${totalTests}]: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // 1. Check HTML Headers & Links
  console.log("\n--- GROUP 1: HTML Head Favicon & Metadata Link Tags ---");
  const htmlFilePath = path.join(process.cwd(), 'index.html');
  const htmlContent = fs.readFileSync(htmlFilePath, 'utf8');

  assert(htmlContent.includes('<link rel="icon" type="image/x-icon" href="/favicon.ico" />'), "HTML links primary /favicon.ico");
  assert(htmlContent.includes('<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />'), "HTML links 32x32 PNG favicon");
  assert(htmlContent.includes('<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />'), "HTML links 16x16 PNG favicon");
  assert(htmlContent.includes('<link rel="icon" type="image/jpeg" href="/mts-logo.jpg" />'), "HTML links direct /mts-logo.jpg high-res icon");
  assert(htmlContent.includes('<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />'), "HTML links Apple Touch Icon /apple-touch-icon.png");
  assert(htmlContent.includes('<meta name="apple-mobile-web-app-title" content="MTS Lab" />'), "Apple mobile web app title is 'MTS Lab'");
  assert(htmlContent.includes('<title>MTS Lab — Smartphone Hardware & Repair</title>'), "Website title is 'MTS Lab — Smartphone Hardware & Repair'");

  // 2. Check Static Public Files Exist on Disk
  console.log("\n--- GROUP 2: Public Favicon Files on Filesystem ---");
  const publicDir = path.join(process.cwd(), 'public');
  const requiredFiles = [
    'favicon.ico',
    'favicon.png',
    'apple-touch-icon.png',
    'favicon-32x32.png',
    'favicon-16x16.png',
    'mts-logo.jpg'
  ];

  requiredFiles.forEach((filename) => {
    const filePath = path.join(publicDir, filename);
    assert(fs.existsSync(filePath), `public/${filename} exists`);
    const stats = fs.statSync(filePath);
    assert(stats.size > 1000, `public/${filename} has valid file size (${stats.size} bytes)`);
  });

  // 3. Check HTTP 200 OK Delivery Over HTTP
  console.log("\n--- GROUP 3: Live HTTP Server Delivery ---");
  for (const filename of requiredFiles) {
    const res = await fetch(`${BASE_URL}/${filename}`);
    assert(res.status === 200, `GET /${filename} returns HTTP 200 OK (Content-Length: ${res.headers.get('content-length')})`);
  }

  // 4. Verify Homepage and Other Routes Include Head Link
  console.log("\n--- GROUP 4: Route Delivery Verification ---");
  const homeRes = await fetch(`${BASE_URL}/`);
  const homeHtml = await homeRes.text();
  assert(homeHtml.includes('/favicon.ico'), "GET / serves HTML with /favicon.ico");
  assert(homeHtml.includes('/apple-touch-icon.png'), "GET / serves HTML with /apple-touch-icon.png");

  console.log("\n================================================================================");
  console.log(`ALL FAVICON & METADATA TESTS PASSED: ${passedTests}/${totalTests} (100%)`);
  console.log("================================================================================");
}

runFaviconTests()
  .catch((err) => {
    console.error("\nTEST RUN FAILED:", err);
    process.exit(1);
  });
