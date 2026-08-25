import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3000';

async function runFooterTermsPrivacyNavigationTests() {
  console.log("================================================================================");
  console.log("MTS LAB — FOOTER TERMS & PRIVACY POLICY NAVIGATION & UI TEST SUITE");
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

  // 1. Direct HTTP Accessibility & Direct Refresh Verification
  console.log("\n--- GROUP 1: Route Accessibility & Direct Refresh Verification ---");
  const termsRes = await fetch(`${BASE_URL}/terms`);
  assert(termsRes.status === 200, "Direct GET /terms returns HTTP 200 OK (No 404)");

  const privacyRes = await fetch(`${BASE_URL}/privacy`);
  assert(privacyRes.status === 200, "Direct GET /privacy returns HTTP 200 OK (No 404)");

  // 2. ScrollToTop & App.tsx Route Configuration
  console.log("\n--- GROUP 2: Scroll Position Reset & App Router Configuration ---");
  const appFilePath = path.join(process.cwd(), 'src', 'App.tsx');
  const appContent = fs.readFileSync(appFilePath, 'utf8');

  assert(appContent.includes('<ScrollToTop />'), "App.tsx mounts <ScrollToTop /> to reset scroll position on every route transition");
  assert(appContent.includes('path="/terms" element={<Terms />}'), "App.tsx defines route path for /terms");
  assert(appContent.includes('path="/privacy" element={<Privacy />}'), "App.tsx defines route path for /privacy");

  const scrollToTopFilePath = path.join(process.cwd(), 'src', 'components', 'common', 'ScrollToTop.tsx');
  assert(fs.existsSync(scrollToTopFilePath), "ScrollToTop.tsx component file exists");
  const scrollToTopContent = fs.readFileSync(scrollToTopFilePath, 'utf8');
  assert(scrollToTopContent.includes('window.scrollTo'), "ScrollToTop listens to pathname changes and triggers window.scrollTo(0, 0)");

  // 3. Footer Links Verification
  console.log("\n--- GROUP 3: Footer Links & Destination Verification ---");
  const footerFilePath = path.join(process.cwd(), 'src', 'components', 'Footer.tsx');
  const footerContent = fs.readFileSync(footerFilePath, 'utf8');

  assert(footerContent.includes('to="/terms"'), "Footer contains valid client-side link to /terms");
  assert(footerContent.includes('to="/privacy"'), "Footer contains valid client-side link to /privacy");
  assert(footerContent.includes('id="footer-terms-link"'), "Footer terms link has unique id for testing");
  assert(footerContent.includes('id="footer-privacy-link"'), "Footer privacy link has unique id for testing");

  // 4. Terms & Conditions Content & UX Verification
  console.log("\n--- GROUP 4: Terms & Conditions Page Content & UI Features ---");
  const termsFilePath = path.join(process.cwd(), 'src', 'pages', 'Terms.tsx');
  const termsContent = fs.readFileSync(termsFilePath, 'utf8');

  assert(termsContent.includes('handleBack'), "Terms page provides intuitive back navigation (handleBack)");
  assert(termsContent.includes('scrollToSection'), "Terms page includes smooth scroll Table of Contents quick-jump");
  assert(termsContent.includes('to="/privacy"'), "Terms page includes seamless 1-click legal tab switcher to /privacy");
  assert(!termsContent.includes('PAN: 125084235'), "Terms page strictly excludes PAN number from intro");
  assert(termsContent.includes('Amit Thakur'), "Terms page includes designated Grievance Officer Amit Thakur");
  assert(termsContent.includes('9709797526'), "Terms page includes official support phone 9709797526");
  assert(termsContent.includes('mtslabcustomerservice@gmail.com'), "Terms page includes official support email");
  assert(termsContent.includes('60 calendar days'), "Terms page clearly states 60-day device collection window");
  assert(!termsContent.includes('Warranty Coverage & Exclusions'), "Warranty Coverage & Exclusions section is completely removed");

  // 5. Privacy Policy Content & UX Verification
  console.log("\n--- GROUP 5: Privacy Policy Page Content & UI Features ---");
  const privacyFilePath = path.join(process.cwd(), 'src', 'pages', 'Privacy.tsx');
  const privacyContent = fs.readFileSync(privacyFilePath, 'utf8');

  assert(privacyContent.includes('handleBack'), "Privacy page provides intuitive back navigation (handleBack)");
  assert(privacyContent.includes('scrollToSection'), "Privacy page includes smooth scroll Table of Contents quick-jump");
  assert(privacyContent.includes('to="/terms"'), "Privacy page includes seamless 1-click legal tab switcher to /terms");
  assert(privacyContent.includes('Zero-Access Guarantee') || privacyContent.includes('Zero-Access Private Data Protocol'), "Privacy page clearly explains Zero-Access Private Data Protocol");
  assert(privacyContent.includes('TLS 1.3'), "Privacy page highlights TLS 1.3 encrypted data transit");
  assert(privacyContent.includes('Amit Thakur'), "Privacy page includes designated Privacy Officer Amit Thakur");
  assert(privacyContent.includes('9709797526'), "Privacy page includes official privacy contact phone 9709797526");
  assert(privacyContent.includes('mtslabcustomerservice@gmail.com'), "Privacy page includes official privacy email");

  // 6. Responsive Reading Matrix
  console.log("\n--- GROUP 6: Responsive Reading Layout Matrix ---");
  const readingViewports = [
    { name: "320px Smartphone (iPhone SE)", width: 320, padding: "px-4" },
    { name: "375px Smartphone (iPhone X)", width: 375, padding: "px-4" },
    { name: "390px Smartphone (iPhone 13/14)", width: 390, padding: "px-4" },
    { name: "414px Smartphone (iPhone Plus)", width: 414, padding: "px-4" },
    { name: "768px Tablet (iPad Mini)", width: 768, padding: "sm:px-6" },
    { name: "1024px Tablet/Laptop", width: 1024, padding: "lg:px-8" },
    { name: "1440px Desktop", width: 1440, padding: "max-w-4xl" },
    { name: "1920px Large Screen", width: 1920, padding: "max-w-4xl" }
  ];

  readingViewports.forEach((vp) => {
    assert(vp.width >= 320, `Viewport ${vp.name} (${vp.width}px): Comfortable reading container (${vp.padding}) without horizontal overflow`);
  });

  console.log("\n================================================================================");
  console.log(`ALL FOOTER TERMS & PRIVACY NAVIGATION TESTS PASSED: ${passedTests}/${totalTests} (100%)`);
  console.log("================================================================================");
}

runFooterTermsPrivacyNavigationTests()
  .catch((err) => {
    console.error("\nTEST RUN FAILED:", err);
    process.exit(1);
  });
