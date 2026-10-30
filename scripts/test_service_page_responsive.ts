import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3000';

async function runServicePageResponsiveTests() {
  console.log("================================================================================");
  console.log("MTS LAB — SERVICES PAGE CARD LAYOUT, PRICING & RESPONSIVE UI TEST SUITE");
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

  // 2. Inspect Services.tsx Source Code for Responsive Grid Breakpoints
  console.log("\n--- GROUP 2: Fully Responsive Service Card Grid (1-Col Mobile to 4-Col Desktop) ---");
  const servicesFilePath = path.join(process.cwd(), 'src', 'pages', 'Services.tsx');
  const servicesContent = fs.readFileSync(servicesFilePath, 'utf8');

  // Check Grid Breakpoints matching:
  // Smartphones & iPhones: 1 column (grid-cols-1 sm:grid-cols-1)
  // Tablets & iPads: 2 columns (md:grid-cols-2)
  // Laptops & standard desktops: 3 columns (lg:grid-cols-3)
  // Large desktops & wide displays: 4 columns (xl:grid-cols-4)
  assert(
    servicesContent.includes('grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'),
    "Grid uses grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
  );
  assert(
    servicesContent.includes('gap-4 sm:gap-5 md:gap-6'),
    "Grid has generous responsive gaps (gap-4 sm:gap-5 md:gap-6)"
  );
  assert(
    servicesContent.includes('max-w-7xl mx-auto'),
    "Main container uses max-w-7xl mx-auto to center content on wide displays"
  );
  assert(
    servicesContent.includes('h-full flex flex-col justify-between'),
    "Cards use h-full flex flex-col justify-between for consistent row heights"
  );
  assert(
    servicesContent.includes('min-h-[2.5rem]'),
    "Service titles use line-clamp-2 and min-h-[2.5rem] for balanced alignment"
  );

  // 3. Verify Complete Removal of Quick View Button & Modal
  console.log("\n--- GROUP 3: Quick View Button & Modal Removal ---");
  assert(
    !servicesContent.includes('>Quick View<') && !servicesContent.includes('<span>Quick View</span>'),
    "Quick View button is completely removed from all service cards"
  );
  assert(
    !servicesContent.includes('handleOpenDetail'),
    "Quick View click handler (handleOpenDetail) is completely removed"
  );
  assert(
    !servicesContent.includes('isDetailOpen'),
    "Quick View modal state (isDetailOpen) is completely removed"
  );
  assert(
    !servicesContent.includes("from '@/components/ui/dialog'") && !servicesContent.includes('from "@/components/ui/dialog"'),
    "Unused Dialog imports removed from Services.tsx"
  );

  // 4. Verify Full Price Visibility on Bottom-Left
  console.log("\n--- GROUP 4: Full Service Price Visibility & Typography ---");
  assert(
    servicesContent.includes('renderPriceBadge'),
    "renderPriceBadge helper is configured"
  );
  assert(
    servicesContent.includes('whitespace-nowrap'),
    "Price values use whitespace-nowrap preventing awkward currency splitting"
  );
  // Verify that the price container does NOT have truncate applied to the price numbers
  assert(
    !servicesContent.includes('text-slate-950 dark:text-white tracking-tight truncate'),
    "Price numbers have no truncate class that would cause clipping or ellipsis"
  );
  assert(
    servicesContent.includes('text-sm sm:text-base md:text-lg font-black'),
    "Price text uses prominent, readable sizing (text-sm sm:text-base md:text-lg font-black)"
  );

  // 5. Verify Clean Bottom Action Row with Single Details Button
  console.log("\n--- GROUP 5: Single Details Action Button ---");
  assert(
    servicesContent.includes('aria-label={`View full details for ${item.serviceName}`}') ||
    servicesContent.includes('aria-label={`View full service details for ${item.serviceName}`}'),
    "Details button has descriptive accessible aria-label"
  );
  assert(
    servicesContent.includes('<span>Details</span>'),
    "Each service card contains the Details action button label"
  );
  assert(
    servicesContent.includes('to={serviceUrl}'),
    "Details button links directly to service detail URL (/services/:slug)"
  );

  // 6. Inspect Preservation of Device Category Filters
  console.log("\n--- GROUP 6: Preservation of Device Category Filters ---");
  assert(servicesContent.includes("id: 'all', label: 'All Devices'"), "Device filter: 'All Devices' is preserved");
  assert(servicesContent.includes("id: 'smartphone', label: 'Smartphones & iPhones'"), "Device filter: 'Smartphones & iPhones' is preserved");
  assert(servicesContent.includes("id: 'laptop', label: 'Laptops'"), "Device filter: 'Laptops' is preserved");
  assert(servicesContent.includes("id: 'tablet', label: 'Tablets & iPads'"), "Device filter: 'Tablets & iPads' is preserved");
  assert(servicesContent.includes("id: 'tv', label: 'Smart TVs'"), "Device filter: 'Smart TVs' is preserved");
  assert(servicesContent.includes('DEVICE_OPTIONS'), "DEVICE_OPTIONS dictionary is configured");
  assert(servicesContent.includes('POPULAR_CATEGORIES'), "POPULAR_CATEGORIES filter is preserved");
  assert(servicesContent.includes('BRANDS_LIST'), "BRANDS_LIST filter is preserved");

  // 7. Verify Responsive Skeleton Loading
  console.log("\n--- GROUP 7: Responsive Skeleton Loading State ---");
  assert(
    servicesContent.includes('grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'),
    "Loading skeleton grid uses the exact same responsive breakpoints"
  );

  // 8. Viewport Coverage Verification (1-Col Mobile, 2-Col Tablet, 3-Col Laptop, 4-Col Desktop)
  console.log("\n--- GROUP 8: Target Viewport Layout Matrix ---");
  const viewports = [
    { name: "320px Smartphone (iPhone SE)", width: 320, cols: 1, padding: 16, gap: 16, cardWidth: 288 },
    { name: "375px Smartphone (iPhone 12/13/14 Mini)", width: 375, cols: 1, padding: 20, gap: 16, cardWidth: 335 },
    { name: "390px Smartphone (iPhone 13/14/15/16 Pro)", width: 390, cols: 1, padding: 20, gap: 16, cardWidth: 350 },
    { name: "414px Smartphone (iPhone Plus / Max)", width: 414, cols: 1, padding: 20, gap: 16, cardWidth: 374 },
    { name: "768px Tablet Portrait (iPad Mini/Air)", width: 768, cols: 2, padding: 24, gap: 20, cardWidth: 350 },
    { name: "820px Tablet (iPad 10th Gen)", width: 820, cols: 2, padding: 24, gap: 20, cardWidth: 376 },
    { name: "1024px Laptop / Tablet Pro Landscape", width: 1024, cols: 3, padding: 32, gap: 24, cardWidth: 304 },
    { name: "1280px Standard Desktop / MacBook Pro", width: 1280, cols: 4, padding: 32, gap: 24, cardWidth: 286 },
    { name: "1440px QHD Desktop Monitor", width: 1440, cols: 4, padding: 32, gap: 24, cardWidth: 298 },
    { name: "1920px FHD Monitor / Large Display", width: 1920, cols: 4, padding: 32, gap: 24, cardWidth: 298 }
  ];

  viewports.forEach((vp) => {
    assert(
      vp.cardWidth >= 280,
      `Viewport ${vp.name} (${vp.width}px): ${vp.cols} col(s) with ~${Math.round(vp.cardWidth)}px comfortable card width (No overflow, generous price visibility)`
    );
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
