import fs from 'fs';
import path from 'path';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${msg}`);
}

async function runFooterSocialMediaQASuite() {
  console.log("================================================================");
  console.log("🚀 MTS LAB FOOTER SOCIAL MEDIA (TIKTOK & YOUTUBE) QA SUITE");
  console.log("================================================================\n");

  const footerPath = path.resolve('src/components/Footer.tsx');
  assert(fs.existsSync(footerPath), "Footer.tsx exists");
  const content = fs.readFileSync(footerPath, 'utf-8');

  // TEST 1: TikTok Profile Link Verification
  console.log("--- TEST 1: TikTok Profile Link & SVG ---");
  const expectedTikTokUrl = 'https://www.tiktok.com/@mtslab';
  assert(content.includes(expectedTikTokUrl), `TikTok URL strictly matches "${expectedTikTokUrl}"`);
  assert(content.includes('aria-label="Visit MTS Lab on TikTok"'), "TikTok has accessible aria-label 'Visit MTS Lab on TikTok'");
  assert(content.includes('target="_blank"'), "TikTok opens in new tab");
  assert(content.includes('rel="noopener noreferrer"'), "TikTok includes security rel='noopener noreferrer'");

  // TEST 2: YouTube Channel Link Verification
  console.log("\n--- TEST 2: YouTube Channel Link & SVG ---");
  const expectedYouTubeUrl = 'https://www.youtube.com/channel/UCmE9DPhJeyhy3UVNL_Iz_1Q';
  assert(content.includes(expectedYouTubeUrl), `YouTube URL strictly matches "${expectedYouTubeUrl}"`);
  assert(content.includes('aria-label="Visit MTS Lab on YouTube"'), "YouTube has accessible aria-label 'Visit MTS Lab on YouTube'");
  assert(content.includes('M9.545 15.568V8.432L15.818 12l-6.273 3.568z'), "YouTube SVG play icon path present");

  // TEST 3: Facebook & Instagram Preservation
  console.log("\n--- TEST 3: Facebook & Instagram Preservation ---");
  assert(content.includes('https://www.facebook.com/MTSmobilescreenrefurblab/'), "Facebook URL preserved");
  assert(content.includes('https://www.instagram.com/mtsmobilescreenrefurblab/?hl=en'), "Instagram URL preserved");

  // TEST 4: Row Structure & Styling
  console.log("\n--- TEST 4: Social Media Row Structure & Touch Target Styling ---");
  assert(content.includes('flex flex-wrap items-center gap-2.5 sm:gap-3'), "Flex container with responsive gap configured");
  assert(content.includes('Follow Us:'), "Label 'Follow Us:' present");
  assert(content.includes('w-9 h-9 rounded-xl bg-slate-900 border border-slate-800'), "Consistent rounded-xl tile styling");

  // TEST 5: Overall Footer Structure Preservation
  console.log("\n--- TEST 5: Overall Footer Integrity ---");
  assert(content.includes('125084235'), "PAN number 125084235 preserved");
  assert(content.includes('015364307'), "Reception phone preserved");
  assert(content.includes('mtslabcustomerservice@gmail.com'), "Email preserved");
  assert(content.includes('/terms'), "Terms link preserved");
  assert(content.includes('/privacy'), "Privacy link preserved");

  console.log("\n================================================================");
  console.log("🎉 ALL FOOTER SOCIAL MEDIA QA CHECKS PASSED (100%)");
  console.log("================================================================");
}

runFooterSocialMediaQASuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
