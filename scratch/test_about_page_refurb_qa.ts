import fs from 'fs';
import path from 'path';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${msg}`);
}

async function runAboutPageRefurbQASuite() {
  console.log("====================================================");
  console.log("🚀 MTS LAB ABOUT PAGE — REFURB TERMINOLOGY & CONTENT QA");
  console.log("====================================================\n");

  const aboutPath = path.resolve('src/pages/About.tsx');
  assert(fs.existsSync(aboutPath), "About.tsx exists");
  const content = fs.readFileSync(aboutPath, 'utf-8');

  // TEST 1: Strict Ban on 'Refurbishment'
  console.log("--- TEST 1: Strict Ban on 'Refurbishment' ---");
  const hasRefurbishment = /refurbishment/i.test(content);
  assert(!hasRefurbishment, "Zero occurrences of the word 'Refurbishment' in About.tsx");

  // TEST 2: Core Headline & Hero Positioning
  console.log("\n--- TEST 2: Core Headline & Hero Positioning ---");
  assert(content.includes("Nepal’s First Wholesale Mobile Screen Refurb Lab"), "Includes 'Nepal’s First Wholesale Mobile Screen Refurb Lab'");
  assert(content.includes("Mobile Screen Refurb Lab"), "Includes 'Mobile Screen Refurb Lab'");
  assert(content.includes("Dedicated Screen Refurb"), "Hero subtitle includes 'Dedicated Screen Refurb'");

  // TEST 3: Section 1 — Who We Are
  console.log("\n--- TEST 3: Section 1 — Who We Are ---");
  assert(content.includes("Who We Are"), "Section title 'Who We Are' present");
  assert(
    content.includes("MTS Lab is a reliable Kathmandu-based mobile phone repair service dedicated to providing professional and dependable solutions for smartphones and other mobile devices."),
    "Who We Are paragraph 1 matches specification"
  );
  assert(
    content.includes("MTS Lab is proud to be positioned as Nepal’s First Wholesale Mobile Screen Refurb Lab and a dedicated screen refurb laboratory, providing professional screen refurb solutions for the mobile repair industry."),
    "Who We Are paragraph 2 matches specification"
  );

  // TEST 4: Section 2 — Screen Refurb
  console.log("\n--- TEST 4: Section 2 — Screen Refurb ---");
  assert(content.includes("Screen Refurb"), "Section title 'Screen Refurb' present");
  assert(
    content.includes("We operate a specialized screen refurb laboratory offering wholesale mobile display and screen refurb services for repair businesses, retail shops, and individual device owners."),
    "Screen Refurb paragraph 1 matches specification"
  );
  assert(
    content.includes("Supported by specialized refurb equipment, controlled working environments, and modern lamination techniques, our lab restores cracked or damaged outer glass while preserving the original factory display panel and touch sensitivity."),
    "Screen Refurb paragraph 2 matches specification"
  );

  // TEST 5: Section 3 — Professional Repair Services
  console.log("\n--- TEST 5: Section 3 — Professional Repair Services ---");
  assert(content.includes("Professional Repair Services"), "Section title 'Professional Repair Services' present");
  assert(
    content.includes("We provide a wide range of mobile repair, screen refurb, and technical services, supported by experienced technicians, specialized equipment, and modern repair techniques. Our team handles various types of hardware and software problems across different mobile brands and models."),
    "Professional Repair Services paragraph 1 matches specification"
  );
  assert(
    content.includes("From battery replacements, camera modules, and charging port repairs to complex diagnostic investigations, our solutions are designed to be practical, reliable, and durable."),
    "Professional Repair Services paragraph 2 matches specification"
  );

  // TEST 6: Section 4 — Our Expertise
  console.log("\n--- TEST 6: Section 4 — Our Expertise ---");
  assert(content.includes("Our Expertise"), "Section title 'Our Expertise' present");
  assert(
    content.includes("Our technical expertise covers advanced board-level and hardware repair, precision micro-soldering, power IC troubleshooting, and component-level circuit diagnostics."),
    "Our Expertise paragraph 1 matches specification"
  );
  assert(
    content.includes("As a specialized mobile technology and screen refurb lab, MTS Lab focuses on maintaining high standards of workmanship and continuously improving our repair and refurb techniques."),
    "Our Expertise paragraph 2 matches specification"
  );

  // TEST 7: Section 5 — Our Commitment
  console.log("\n--- TEST 7: Section 5 — Our Commitment ---");
  assert(content.includes("Our Commitment"), "Section title 'Our Commitment' present");
  assert(
    content.includes("MTS Lab is committed to providing customers and industry partners with quality service, transparent communication, and professional technical support. From common mobile issues to advanced hardware, screen refurb, and board-level repairs, our goal is to provide practical, reliable, and professional repair solutions."),
    "Our Commitment paragraph 1 matches specification"
  );
  assert(
    content.includes("Bring your mobile device to MTS Lab with confidence. Our experienced technicians are dedicated to diagnosing problems carefully and providing the best possible repair and refurb service."),
    "Our Commitment paragraph 2 matches specification"
  );

  // TEST 8: Section 6 — Our Motto
  console.log("\n--- TEST 8: Section 6 — Our Motto ---");
  assert(content.includes("Our Motto"), "Section label 'Our Motto' present");
  assert(
    content.includes("“To provide you with reliable, professional, and customer-focused service.”"),
    "Our Motto text matches exact wording"
  );

  // TEST 9: Side Pillars & Contact Section
  console.log("\n--- TEST 9: Side Pillars & Contact Desk ---");
  assert(content.includes("Wholesale Screen Refurb"), "Side pillar uses 'Wholesale Screen Refurb'");
  assert(content.includes("wholesale screen refurb inquiries"), "Contact desk uses 'wholesale screen refurb inquiries'");

  // TEST 10: Clean UI / No Sparkles
  console.log("\n--- TEST 10: No Sparkles or AI Gimmicks ---");
  assert(!content.includes("Sparkles"), "No Sparkles icon in About.tsx");
  assert(!content.includes("AI Powered"), "No 'AI Powered' in About.tsx");

  console.log("\n====================================================");
  console.log("🎉 ALL 10 ABOUT PAGE QA CHECKS PASSED (100%)");
  console.log("====================================================");
}

runAboutPageRefurbQASuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
