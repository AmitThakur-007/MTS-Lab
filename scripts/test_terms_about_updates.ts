import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3000';

async function runTermsAboutUpdatesTests() {
  console.log("================================================================================");
  console.log("MTS LAB — ABOUT PAGE MTS LOGO + COMPANY DESCRIPTION + TERMS VERIFICATION SUITE");
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

  // 1. Check HTTP Accessibility
  console.log("\n--- GROUP 1: Route Accessibility & Direct HTTP Response ---");
  const termsRes = await fetch(`${BASE_URL}/terms`);
  assert(termsRes.status === 200, "GET /terms returns HTTP 200 OK");

  const aboutRes = await fetch(`${BASE_URL}/about`);
  assert(aboutRes.status === 200, "GET /about returns HTTP 200 OK");

  // 2. MTS Official Logo Assets Verification
  console.log("\n--- GROUP 2: MTS Official Logo Assets Verification ---");
  const logoAssetPath = path.join(process.cwd(), 'src', 'assets', 'images', 'mts-logo.jpg');
  const logoPublicPath = path.join(process.cwd(), 'public', 'mts-logo.jpg');

  assert(fs.existsSync(logoAssetPath), "src/assets/images/mts-logo.jpg exists");
  assert(fs.existsSync(logoPublicPath), "public/mts-logo.jpg exists");

  const logoAssetStats = fs.statSync(logoAssetPath);
  assert(logoAssetStats.size > 50000, `MTS logo is high quality (${logoAssetStats.size} bytes)`);

  // 3. About Page Content & Logo Layout Verification
  console.log("\n--- GROUP 3: About Page Company Description & Logo Layout ---");
  const aboutFilePath = path.join(process.cwd(), 'src', 'pages', 'About.tsx');
  const aboutContent = fs.readFileSync(aboutFilePath, 'utf8');

  assert(aboutContent.includes('mts-logo.jpg'), "About.tsx imports official MTS logo");
  assert(aboutContent.includes('alt="MTS Lab Official Logo"'), "About.tsx uses descriptive alt text for MTS Lab logo");
  assert(aboutContent.includes('About <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-indigo-300 bg-clip-text text-transparent">MTS Lab</span>'), "About.tsx displays 'About MTS Lab' hero title");
  assert(aboutContent.includes('Professional Smartphone Repair & Technical Services'), "About.tsx displays official tagline");

  // Exact 5 Paragraphs of Company Description & Motto with MTS Lab branding
  assert(aboutContent.includes('MTS Lab is a reliable Kathmandu-based mobile phone repair service dedicated to providing professional and dependable solutions for smartphones and other mobile devices'), "About page includes first paragraph of new company description with MTS Lab branding");
  assert(aboutContent.includes('We provide a wide range of mobile repair and technical services, supported by experienced technicians and modern repair techniques'), "About page includes second paragraph of new company description");
  assert(aboutContent.includes('MTS Lab is committed to providing customers with quality service, transparent communication, and professional technical support'), "About page includes third paragraph of new company description with MTS Lab branding");
  assert(aboutContent.includes('Bring your mobile device to MTS Lab with confidence'), "About page includes fourth paragraph of new company description with MTS Lab branding");
  assert(aboutContent.includes('Our motto is simple: to provide you with reliable, professional, and customer-focused service'), "About page includes official motto");

  // Strict Exclusion of Registration / Tax Numbers in Company Description
  assert(!aboutContent.includes('PAN: 125084235'), "PAN is not present in About page company description");
  assert(!aboutContent.includes('Registration Certificate No: 5650'), "Registration Certificate number is not present in About page company description");
  assert(!aboutContent.includes('Ward Office 22'), "Ward Office 22 is not present in About page company description");

  // 4. Terms & Conditions Content Verification
  console.log("\n--- GROUP 4: Terms & Conditions Page Verification ---");
  const termsFilePath = path.join(process.cwd(), 'src', 'pages', 'Terms.tsx');
  const termsContent = fs.readFileSync(termsFilePath, 'utf8');

  // Strict Exclusion of Warranty Component
  assert(!termsContent.includes('Warranty Coverage & Exclusions'), "Warranty Coverage & Exclusions section is completely removed");
  assert(!termsContent.includes('Covered Under Warranty'), "'Covered Under Warranty' box is completely removed");
  assert(!termsContent.includes('Strict Exclusions (Void Warranty)'), "'Strict Exclusions (Void Warranty)' box is completely removed");

  // Strict Exclusion of PAN / Tax / Registration Numbers in Intro
  assert(!termsContent.includes('PAN: 125084235'), "PAN: 125084235 is strictly excluded from Terms & Conditions intro");
  assert(!termsContent.includes('Registration Certificate No: 5650'), "Registration Certificate No is strictly excluded from Terms & Conditions intro");
  assert(!termsContent.includes('Ward 22 Reg: 5650'), "Ward 22 Reg is strictly excluded from Terms & Conditions intro");
  assert(!termsContent.includes('PAN:'), "No PAN field exists in Terms & Conditions intro");

  // Inclusion of Exact New Introduction
  assert(termsContent.includes('MTS (Mobile Technology Station) is a Kathmandu-based smartphone repair and technical service center specializing in professional mobile phone repair, diagnostics, parts replacement, software services, and advanced hardware repair'), "New official company introduction is present in Section 1");
  assert(termsContent.includes('By submitting a device to MTS for inspection, diagnosis, repair, parts replacement, or technical service, you agree to the terms and conditions set forth in this agreement'), "Agreement acceptance clause is present in Section 1");

  // Renumbered Sections (1 to 5)
  assert(termsContent.includes('About Mobile Technology Station (MTS)'), "Section 1: About Mobile Technology Station (MTS)");
  assert(termsContent.includes('Inspection, Quotations & Authorization'), "Section 2: Inspection, Quotations & Authorization");
  assert(termsContent.includes('Customer Data & Zero-Access Security'), "Section 3: Customer Data & Zero-Access Security");
  assert(termsContent.includes('Device Collection & Storage Policy'), "Section 4: Device Collection & Storage Policy");
  assert(termsContent.includes('Grievance Redressal & Customer Support'), "Section 5: Grievance Redressal & Customer Support");

  // Table of Contents Match 5 Sections
  assert(termsContent.includes("'1. Overview'"), "TOC includes '1. Overview'");
  assert(termsContent.includes("'2. Quotations'"), "TOC includes '2. Quotations'");
  assert(termsContent.includes("'3. Data Security'"), "TOC includes '3. Data Security'");
  assert(termsContent.includes("'4. Device Storage'"), "TOC includes '4. Device Storage'");
  assert(termsContent.includes("'5. Support & Contact'"), "TOC includes '5. Support & Contact'");

  // 5. Brand Name Consistency
  console.log("\n--- GROUP 5: Brand Name Consistency ---");
  assert(!termsContent.includes('Mega Technology Station'), "Terms page does not use 'Mega Technology Station'");
  assert(!aboutContent.includes('Mega Technology Station'), "About page does not use 'Mega Technology Station'");
  assert(termsContent.includes('Mobile Technology Station (MTS)'), "Terms page uses 'Mobile Technology Station (MTS)'");
  assert(aboutContent.includes('MTS Lab'), "About page consistently uses 'MTS Lab'");
  assert(!aboutContent.includes('Mobile Technology Station'), "About page does not use 'Mobile Technology Station' (uses 'MTS Lab')");

  console.log("\n================================================================================");
  console.log(`ALL TERMS & ABOUT PAGE UPDATE TESTS PASSED: ${passedTests}/${totalTests} (100%)`);
  console.log("================================================================================");
}

runTermsAboutUpdatesTests()
  .catch((err) => {
    console.error("\nTEST RUN FAILED:", err);
    process.exit(1);
  });
