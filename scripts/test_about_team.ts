import fs from 'fs';
import path from 'path';

function runTests() {
  console.log('=== VERIFYING MTS LAB ABOUT PAGE "OUR TEAM" SECTION ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failed++;
    }
  }

  // 1. Check Image Files Existence
  const images = [
    'sabita-thakur.jpg',
    'manish-sharma.jpg',
    'amit-sharma.jpg'
  ];

  for (const img of images) {
    const publicPath = path.join(process.cwd(), 'public', 'images', 'team', img);
    const assetPath = path.join(process.cwd(), 'src', 'assets', 'team', img);

    assert(fs.existsSync(publicPath), `Public image exists: public/images/team/${img}`);
    assert(fs.existsSync(assetPath), `Asset image exists: src/assets/team/${img}`);
    
    if (fs.existsSync(assetPath)) {
      const stats = fs.statSync(assetPath);
      assert(stats.size > 100000, `Image file ${img} has valid content (${(stats.size / 1024).toFixed(1)} KB)`);
    }
  }

  // 2. Check About.tsx Content
  const aboutFile = path.join(process.cwd(), 'src', 'pages', 'About.tsx');
  assert(fs.existsSync(aboutFile), 'About.tsx file exists');

  const content = fs.readFileSync(aboutFile, 'utf8');

  // Verify Team Members & Roles
  assert(content.includes('Sabita Thakur'), 'Contains exact name: Sabita Thakur');
  assert(content.includes("'CEO'"), 'Contains exact position: CEO');
  assert(content.includes('Sabita Thakur - CEO of MTS Lab'), 'Contains exact alt text for Sabita Thakur');
  assert(content.includes('sabita-thakur.jpg'), 'Contains exact image import: sabita-thakur.jpg');

  assert(content.includes('Manish Sharma'), 'Contains exact name: Manish Sharma');
  assert(content.includes("'Founder'"), 'Contains exact position: Founder');
  assert(content.includes('Manish Sharma - Founder of MTS Lab'), 'Contains exact alt text for Manish Sharma');
  assert(content.includes('manish-sharma.jpg'), 'Contains exact image import: manish-sharma.jpg');

  assert(content.includes('Amit Sharma'), 'Contains exact name: Amit Sharma');
  assert(content.includes("'Technical Head'"), 'Contains exact position: Technical Head');
  assert(content.includes('Amit Sharma - Technical Head of MTS Lab'), 'Contains exact alt text for Amit Sharma');
  assert(content.includes('amit-sharma.jpg'), 'Contains exact image import: amit-sharma.jpg');

  // Verify Section Title
  assert(content.includes('Our Team'), 'Contains section header: Our Team');

  // Verify Responsive Grid
  assert(content.includes('grid-cols-1') && content.includes('md:grid-cols-3'), 'Responsive grid configured for mobile, tablet, and desktop');

  console.log('\n==============================================');
  console.log(`ABOUT PAGE TEAM TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('==============================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
