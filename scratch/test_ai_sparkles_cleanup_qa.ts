import fs from 'fs';
import path from 'path';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${msg}`);
}

async function runAISparkleCleanupQASuite() {
  console.log("====================================================");
  console.log("🚀 MTS LAB PUBLIC PAGES AI / SPARKLE CLEANUP QA");
  console.log("====================================================\n");

  const filesToCheck = [
    { name: 'Home Page', path: 'src/pages/Home.tsx' },
    { name: 'Services Page', path: 'src/pages/Services.tsx' },
    { name: 'Track Repair Page', path: 'src/pages/Tracking.tsx' },
    { name: 'Contact Page', path: 'src/pages/Contact.tsx' },
    { name: 'About Page', path: 'src/pages/About.tsx' },
    { name: 'Hero Slider Component', path: 'src/components/HeroSlider.tsx' },
    { name: 'Footer Component', path: 'src/components/Footer.tsx' },
    { name: 'Navbar Component', path: 'src/components/Navbar.tsx' }
  ];

  for (const item of filesToCheck) {
    console.log(`--- Inspecting: ${item.name} (${item.path}) ---`);
    const fullPath = path.resolve(item.path);
    assert(fs.existsSync(fullPath), `${item.name} exists`);
    const content = fs.readFileSync(fullPath, 'utf-8');

    // 1. Check for Sparkles import / component
    assert(!content.includes('Sparkles'), `No 'Sparkles' icon in ${item.name}`);

    // 2. Check for AI decorative labels
    assert(!content.includes('AI Powered'), `No 'AI Powered' in ${item.name}`);
    assert(!content.includes('AI Assistant'), `No 'AI Assistant' in ${item.name}`);
    assert(!content.includes('AI Smart'), `No 'AI Smart' in ${item.name}`);
    assert(!content.includes('Smart AI'), `No 'Smart AI' in ${item.name}`);
    assert(!content.includes('AI Repair'), `No 'AI Repair' in ${item.name}`);
    assert(!content.includes('Ask AI'), `No 'Ask AI' button in ${item.name}`);
    assert(!content.includes('✨'), `No sparkle emoji in ${item.name}`);

    // 3. Special check for Track Repair: no sample hints
    if (item.name === 'Track Repair Page') {
      assert(!content.includes('MTS-2026-0001'), "No 'MTS-2026-0001' in Track Repair");
      assert(!content.includes('98XXXXXXXX'), "No '98XXXXXXXX' in Track Repair");
      assert(content.includes('placeholder="Repair Job Number"'), "Neutral Repair Job Number placeholder present");
      assert(content.includes('placeholder="Registered Phone Number"'), "Neutral Registered Phone Number placeholder present");
    }
  }

  console.log("\n====================================================");
  console.log("🎉 ALL 5 PUBLIC PAGES VERIFIED CLEAN (100% PASS)");
  console.log("====================================================");
}

runAISparkleCleanupQASuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
