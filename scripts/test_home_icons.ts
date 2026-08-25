import fs from 'fs';
import path from 'path';

function runTests() {
  console.log('=== VERIFYING MTS LAB HOME PAGE "POPULAR REPAIR SERVICES" ICONS ===\n');

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

  const homeFile = path.join(process.cwd(), 'src', 'pages', 'Home.tsx');
  assert(fs.existsSync(homeFile), 'Home.tsx file exists');

  const content = fs.readFileSync(homeFile, 'utf8');

  // Verify Smartphone-Specific Icons are used in POPULAR_REPAIR_CATEGORIES
  assert(content.includes("name: 'Display'") && content.includes("icon: Smartphone"), 'Display uses Smartphone icon');
  assert(content.includes("name: 'Lining'") && content.includes("icon: ScanLine"), 'Lining uses ScanLine (laser line) icon');
  assert(content.includes("name: 'Flex Change'") && content.includes("icon: Cable"), 'Flex Change uses Cable (ribbon cable) icon');
  assert(content.includes("name: 'Green / White Screen'") && content.includes("icon: Tv"), 'Green / White Screen uses Tv/Display icon');
  assert(content.includes("name: 'Battery'") && content.includes("icon: Battery"), 'Battery uses Battery icon');
  assert(content.includes("name: 'Charging'") && content.includes("icon: Zap"), 'Charging uses Zap icon');
  assert(content.includes("name: 'Camera'") && content.includes("icon: Camera"), 'Camera uses Camera icon');
  assert(content.includes("name: 'Back Glass'") && content.includes("icon: Layers"), 'Back Glass uses Layers/Back panel icon');
  assert(content.includes("name: 'Speaker'") && content.includes("icon: Volume2"), 'Speaker uses Volume2 icon');
  assert(content.includes("name: 'Motherboard / IC'") && content.includes("icon: Cpu"), 'Motherboard / IC uses Cpu microchip icon');
  assert(content.includes("name: 'Water Damage'") && content.includes("icon: Droplets"), 'Water Damage uses Droplets icon');
  assert(content.includes("name: 'Software'") && content.includes("icon: Sparkles"), 'Software uses Sparkles icon');

  // Verify generic unrelated icons are removed
  assert(!content.includes("icon: Monitor"), 'Generic Monitor icon removed from popular categories');
  assert(!content.includes("icon: Radio"), 'Generic Radio icon removed from popular categories');
  assert(!content.includes("icon: Repeat"), 'Generic Repeat icon removed from popular categories');
  assert(!content.includes("icon: FileCode2"), 'Generic FileCode2 icon removed from popular categories');

  console.log('\n==============================================');
  console.log(`HOME PAGE ICONS TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('==============================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
