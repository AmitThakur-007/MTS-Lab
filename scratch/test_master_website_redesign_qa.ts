import fs from 'fs';
import path from 'path';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${msg}`);
}

async function runMasterWebsiteRedesignQASuite() {
  console.log("================================================================");
  console.log("🚀 MTS LAB MASTER WEBSITE UI/UX REDESIGN & CONSISTENCY QA");
  console.log("================================================================\n");

  const pages = [
    { id: 'home', name: 'Home Page', file: 'src/pages/Home.tsx' },
    { id: 'hero', name: 'Hero Slider Component', file: 'src/components/HeroSlider.tsx' },
    { id: 'services', name: 'Services Page', file: 'src/pages/Services.tsx' },
    { id: 'shop', name: 'Shop Page', file: 'src/pages/Shop.tsx' },
    { id: 'track', name: 'Track Repair Page', file: 'src/pages/Tracking.tsx' },
    { id: 'about', name: 'About Page', file: 'src/pages/About.tsx' },
    { id: 'contact', name: 'Contact Page', file: 'src/pages/Contact.tsx' },
    { id: 'login', name: 'Login Portal', file: 'src/pages/Login.tsx' },
    { id: 'navbar', name: 'Navbar Component', file: 'src/components/Navbar.tsx' },
    { id: 'footer', name: 'Footer Component', file: 'src/components/Footer.tsx' }
  ];

  // 1. Check existence and absence of AI sparkles/gimmicks across ALL components
  console.log("--- 1. GLOBAL AUDIT: AI Gimmick & Sparkles Ban Across All Pages ---");
  for (const p of pages) {
    const filePath = path.resolve(p.file);
    assert(fs.existsSync(filePath), `${p.name} exists`);
    const content = fs.readFileSync(filePath, 'utf-8');

    assert(!content.includes('Sparkles'), `${p.name}: No 'Sparkles' icon import or usage`);
    assert(!content.includes('AI Powered'), `${p.name}: No 'AI Powered' text`);
    assert(!content.includes('AI Assistant'), `${p.name}: No 'AI Assistant' text`);
    assert(!content.includes('Ask AI'), `${p.name}: No 'Ask AI' buttons`);
    assert(!content.includes('✨'), `${p.name}: No sparkle emoji`);
  }

  // 2. Page-Specific Integrity Checks
  console.log("\n--- 2. PAGE INTEGRITY CHECKS ---");

  // A. Home Page
  const homeContent = fs.readFileSync(path.resolve('src/pages/Home.tsx'), 'utf-8');
  assert(homeContent.includes('POPULAR_REPAIR_CATEGORIES'), "Home: Popular repair categories present");
  assert(homeContent.includes('VALUE_PILLARS') || homeContent.includes('Micro-Soldering'), "Home: Quality pillars present");

  // B. Services Page
  const servicesContent = fs.readFileSync(path.resolve('src/pages/Services.tsx'), 'utf-8');
  assert(servicesContent.includes('POPULAR_CATEGORIES'), "Services: Popular categories present");
  assert(servicesContent.includes('BRANDS_LIST'), "Services: Brand list filter present");

  // C. Shop Page
  const shopContent = fs.readFileSync(path.resolve('src/pages/Shop.tsx'), 'utf-8');
  assert(shopContent.includes('Reserve on WhatsApp'), "Shop: Reserve on WhatsApp action integrated");
  assert(shopContent.includes('9869276668'), "Shop: Official MTS phone/WhatsApp linked");

  // D. Track Repair Page
  const trackContent = fs.readFileSync(path.resolve('src/pages/Tracking.tsx'), 'utf-8');
  assert(trackContent.includes('pt-28') || trackContent.includes('pt-32'), "Track: Dedicated top padding for navbar clearance");
  assert(!trackContent.includes('MTS-2026-0001'), "Track: Zero fake sample repair numbers");
  assert(!trackContent.includes('98XXXXXXXX'), "Track: Zero fake sample phone numbers");
  assert(trackContent.includes('placeholder="Repair Job Number"'), "Track: Neutral repair job number placeholder");

  // E. About Page
  const aboutContent = fs.readFileSync(path.resolve('src/pages/About.tsx'), 'utf-8');
  assert(!/refurbishment/i.test(aboutContent), "About: Zero occurrences of 'Refurbishment'");
  assert(aboutContent.includes("Nepal’s First Wholesale Mobile Screen Refurb Lab"), "About: Wholesale Screen Refurb Lab positioning");
  assert(aboutContent.includes("Mobile Screen Refurb Lab"), "About: Mobile Screen Refurb Lab headline");
  assert(aboutContent.includes("Who We Are"), "About: Section 'Who We Are' present");
  assert(aboutContent.includes("Screen Refurb"), "About: Section 'Screen Refurb' present");
  assert(aboutContent.includes("Professional Repair Services"), "About: Section 'Professional Repair Services' present");
  assert(aboutContent.includes("Our Expertise"), "About: Section 'Our Expertise' present");
  assert(aboutContent.includes("Our Commitment"), "About: Section 'Our Commitment' present");
  assert(aboutContent.includes("Our Motto"), "About: Section 'Our Motto' present");

  // F. Contact Page
  const contactContent = fs.readFileSync(path.resolve('src/pages/Contact.tsx'), 'utf-8');
  assert(contactContent.includes('9869276668'), "Contact: Official mobile phone present");
  assert(contactContent.includes('015364307'), "Contact: Official landline phone present");
  assert(contactContent.includes('mtslabcustomerservice@gmail.com'), "Contact: Official support email present");

  // G. Login Portal
  const loginContent = fs.readFileSync(path.resolve('src/pages/Login.tsx'), 'utf-8');
  assert(loginContent.includes('Work Email'), "Login: Clean Work Email label");
  assert(loginContent.includes('Password'), "Login: Clean Password label");
  assert(!loginContent.includes('staff@mtslab.com'), "Login: Zero sample email hints in placeholders");

  // H. Navbar & Footer
  const navContent = fs.readFileSync(path.resolve('src/components/Navbar.tsx'), 'utf-8');
  assert(navContent.includes('/track'), "Navbar: Track Repair link present");
  assert(navContent.includes('/services'), "Navbar: Services link present");
  assert(navContent.includes('/shop'), "Navbar: Shop link present");
  assert(navContent.includes('/about'), "Navbar: About link present");
  assert(navContent.includes('/contact'), "Navbar: Contact link present");

  const footerContent = fs.readFileSync(path.resolve('src/components/Footer.tsx'), 'utf-8');
  assert(footerContent.includes('125084235'), "Footer: PAN number 125084235 present");
  assert(footerContent.includes('/terms'), "Footer: Terms link present");
  assert(footerContent.includes('/privacy'), "Footer: Privacy link present");

  console.log("\n================================================================");
  console.log("🎉 ALL MASTER WEBSITE UI/UX REDESIGN CHECKS PASSED (100%)");
  console.log("================================================================");
}

runMasterWebsiteRedesignQASuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
