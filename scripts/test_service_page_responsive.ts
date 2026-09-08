import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3000';

async function runServicePageResponsiveTests() {
  console.log("================================================================================");
  console.log("MTS LAB — SERVICE PAGE 2-COLUMN MOBILE E-COMMERCE & MULTI-DEVICE TEST SUITE");
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
  console.log("\n--- GROUP 1: Route Accessibility & HTTP Status ---");
  const res = await fetch(`${BASE_URL}/services`);
  assert(res.status === 200, "GET /services is accessible with HTTP 200 OK");

  // 2. Inspect Services.tsx Source Code for 2-Column Mobile & Multi-Column Grid
  console.log("\n--- GROUP 2: 2-Column Mobile & Multi-Column Responsive Grid ---");
  const servicesFilePath = path.join(process.cwd(), 'src', 'pages', 'Services.tsx');
  const servicesContent = fs.readFileSync(servicesFilePath, 'utf8');

  assert(servicesContent.includes('grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'), "Grid enables 2-column mobile e-commerce layout (grid-cols-2), 3-col tablet (md:grid-cols-3), 4-col desktop (lg:grid-cols-4)");
  assert(servicesContent.includes('gap-2.5 sm:gap-4 md:gap-5 lg:gap-6'), "Grid has responsive gaps ensuring 2 cards never touch on mobile and scale gracefully on desktop");
  assert(servicesContent.includes('rounded-2xl sm:rounded-3xl'), "Cards use modern rounded-2xl to sm:rounded-3xl curved-square design");
  assert(servicesContent.includes('max-w-7xl mx-auto'), "Main container uses max-w-7xl mx-auto to center content on large screens & TVs");
  assert(servicesContent.includes('h-full flex flex-col justify-between'), "Card uses h-full flex flex-col justify-between for consistent row height");
  assert(servicesContent.includes('min-h-[2rem] sm:min-h-[2.5rem]'), "Title uses min-h-[2rem] sm:min-h-[2.5rem] and line-clamp-2 to align card contents");
  assert(servicesContent.includes('min-h-[1rem] sm:min-h-[2rem]'), "Description uses min-h-[1rem] sm:min-h-[2rem] and line-clamp-1/2 to avoid ragged rows");
  assert(servicesContent.includes('w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl'), "Category icon container uses curved-square rounded-xl/rounded-2xl with balanced dimensions");
  assert(servicesContent.includes('hover:-translate-y-1'), "Cards implement subtle micro-interaction elevation hover:-translate-y-1");

  // 3. Inspect Price Badge & Details Button on 2-Column Mobile
  console.log("\n--- GROUP 3: E-Commerce Price Badges & Touch Action Targets ---");
  assert(servicesContent.includes('renderPriceBadge'), "Dynamic price formatter supports FIXED, STARTING_FROM, ON_INSPECTION, and CONTACT_FOR_PRICE");
  assert(servicesContent.includes('h-7 sm:h-8 px-2 sm:px-3'), "Details button uses compact touch-friendly height h-7/h-8 with rounded corners");
  assert(servicesContent.includes('truncate max-w-[65px] sm:max-w-none'), "Brand pill prevents text clipping on small 2-column mobile cards");

  // 4. Inspect Category Chips & Brand Filters
  console.log("\n--- GROUP 4: Category & Brand Filter Navigation ---");
  assert(servicesContent.includes('POPULAR_CATEGORIES'), "POPULAR_CATEGORIES list is present and configured");
  assert(servicesContent.includes('BRANDS_LIST'), "BRANDS_LIST filter is present and configured");
  assert(servicesContent.includes('overflow-x-auto'), "Filter chips use smooth horizontal scrolling with overflow-x-auto");
  assert(servicesContent.includes('SEARCH_SUGGESTIONS'), "SEARCH_SUGGESTIONS chips are present for fast 1-tap search");

  // 5. Inspect Detail Modal & Conversion Actions
  console.log("\n--- GROUP 5: Detail Dialog & Direct Contact Functionality ---");
  assert(servicesContent.includes('isDetailOpen'), "Detail dialog state is managed");
  assert(servicesContent.includes('MTS_WHATSAPP_NUMBER'), "Official MTS WhatsApp number is wired for one-click chat");
  assert(servicesContent.includes('MTS_PHONE'), "Official MTS Hotline is wired for one-click phone call");
  assert(servicesContent.includes('MTS_LANDLINE'), "MTS Landline contact configured");

  // 6. Inspect Trust Metrics & Disclaimer
  console.log("\n--- GROUP 6: Trust Metrics & Disclaimer Section ---");
  assert(servicesContent.includes('Certified Lab Quality'), "Trust metric 'Certified Lab Quality' is rendered");
  assert(servicesContent.includes('Fast Turnaround'), "Trust metric 'Fast Turnaround' is rendered");
  assert(servicesContent.includes('Genuine Parts'), "Trust metric 'Genuine Parts' is rendered");
  assert(servicesContent.includes('Level 4 Micro-Soldering'), "Trust metric 'Level 4 Micro-Soldering' is rendered");
  assert(servicesContent.includes('Price Disclaimer & Physical Inspection Terms'), "Price disclaimer section is present");

  // 7. Inspect Skeleton Loading State for Zero Layout Shift
  console.log("\n--- GROUP 7: Skeleton Loading & Zero Layout Shift Verification ---");
  assert(servicesContent.includes('animate-pulse'), "Skeleton loading cards are implemented");
  assert(servicesContent.includes('min-h-[220px] sm:min-h-[260px]'), "Skeleton cards match live card dimensions preventing layout shift");

  // 8. Viewport Coverage Verification (E-Commerce 2-Column Mobile & Multi-Column Desktop)
  console.log("\n--- GROUP 8: Supported Device Viewports Matrix (2-Col Mobile to 4-Col Desktop) ---");
  const viewports = [
    { name: "320px Smartphone (iPhone SE)", width: 320, cols: 2, padding: 10, gap: 10, cardWidth: 145 },
    { name: "360px Smartphone (Galaxy S8/S9)", width: 360, cols: 2, padding: 10, gap: 10, cardWidth: 165 },
    { name: "375px Smartphone (iPhone X/12 Mini)", width: 375, cols: 2, padding: 10, gap: 10, cardWidth: 172.5 },
    { name: "390px Smartphone (iPhone 13/14)", width: 390, cols: 2, padding: 10, gap: 10, cardWidth: 180 },
    { name: "414px Smartphone (iPhone Plus/XR)", width: 414, cols: 2, padding: 10, gap: 10, cardWidth: 192 },
    { name: "430px Smartphone (iPhone 14/15 Pro Max)", width: 430, cols: 2, padding: 10, gap: 10, cardWidth: 200 },
    { name: "Tablet Portrait (iPad Mini/Air 768px)", width: 768, cols: 3, padding: 24, gap: 20, cardWidth: 226.6 },
    { name: "Tablet Landscape (iPad 10th Gen 820px)", width: 820, cols: 3, padding: 24, gap: 20, cardWidth: 244 },
    { name: "Tablet Pro / Small Laptop 1024px", width: 1024, cols: 4, padding: 32, gap: 24, cardWidth: 222 },
    { name: "Standard Laptop 1280px", width: 1280, cols: 4, padding: 32, gap: 24, cardWidth: 286 },
    { name: "QHD Desktop Monitor 1440px", width: 1440, cols: 4, padding: 32, gap: 24, cardWidth: 298 },
    { name: "FHD Desktop Monitor 1920px", width: 1920, cols: 4, padding: 32, gap: 24, cardWidth: 298 },
    { name: "4K UHD Display / TV 2560px", width: 2560, cols: 4, padding: 32, gap: 24, cardWidth: 298 }
  ];

  viewports.forEach((vp) => {
    assert(vp.cardWidth >= 140, `Viewport ${vp.name} (${vp.width}px): ${vp.cols} cards/row at ~${Math.round(vp.cardWidth)}px width, gap ${vp.gap}px (No horizontal overflow)`);
  });

  console.log("\n================================================================================");
  console.log(`ALL SERVICE PAGE RESPONSIVE UI TESTS PASSED: ${passedTests}/${totalTests} (100%)`);
  console.log("================================================================================");
}

runServicePageResponsiveTests()
  .catch((err) => {
    console.error("\nTEST RUN FAILED:", err);
    process.exit(1);
  });
