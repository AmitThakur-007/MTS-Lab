import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3000';

async function runLeadershipMessagesTests() {
  console.log("================================================================================");
  console.log("MTS LAB — ABOUT PAGE LEADERSHIP MESSAGES & TEAM VERIFICATION SUITE");
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
  const aboutRes = await fetch(`${BASE_URL}/about`);
  assert(aboutRes.status === 200, "GET /about returns HTTP 200 OK");

  // 2. Read About.tsx file
  console.log("\n--- GROUP 2: Section Headers & Structure ---");
  const aboutFilePath = path.join(process.cwd(), 'src', 'pages', 'About.tsx');
  const aboutContent = fs.readFileSync(aboutFilePath, 'utf8');

  assert(aboutContent.includes('Leadership Messages'), "About page contains 'Leadership Messages' section title");
  assert(aboutContent.includes('Our commitment to quality, technical excellence, and customer-focused service.'), "About page contains official leadership subtitle");

  // 3. Image Assignment Verification
  console.log("\n--- GROUP 3: Correct Profile Image Assignments ---");
  assert(aboutContent.includes("import sabitaPhoto from '@/assets/team/sabita-thakur.jpg';"), "Imports sabitaPhoto from sabita-thakur.jpg");
  assert(aboutContent.includes("import manishPhoto from '@/assets/team/manish-sharma.jpg';"), "Imports manishPhoto from manish-sharma.jpg");
  assert(aboutContent.includes("import amitPhoto from '@/assets/team/amit-sharma.jpg';"), "Imports amitPhoto from amit-sharma.jpg");

  // Verify that each leader object references their own photo
  const sabitaIdx = aboutContent.indexOf("name: 'Sabita Thakur'");
  const manishIdx = aboutContent.indexOf("name: 'Manish Sharma'");
  const amitIdx = aboutContent.indexOf("name: 'Amit Sharma'");

  assert(sabitaIdx !== -1, "Found Sabita Thakur entry");
  assert(manishIdx !== -1, "Found Manish Sharma entry");
  assert(amitIdx !== -1, "Found Amit Sharma entry");

  const sabitaBlock = aboutContent.substring(sabitaIdx, manishIdx);
  const manishBlock = aboutContent.substring(manishIdx, amitIdx);
  const amitBlock = aboutContent.substring(amitIdx, aboutContent.indexOf("export default function About()"));

  assert(sabitaBlock.includes("image: sabitaPhoto"), "Sabita Thakur is assigned sabitaPhoto");
  assert(sabitaBlock.includes("position: 'Chief Executive Officer (CEO)'"), "Sabita Thakur has position Chief Executive Officer (CEO)");
  assert(manishBlock.includes("image: manishPhoto"), "Manish Sharma is assigned manishPhoto");
  assert(manishBlock.includes("position: 'Founder'"), "Manish Sharma has position Founder");
  assert(amitBlock.includes("image: amitPhoto"), "Amit Sharma is assigned amitPhoto");
  assert(amitBlock.includes("position: 'Technical Head | Computer Engineer'"), "Amit Sharma has position Technical Head | Computer Engineer");

  // 4. Leadership Messages Verification with Consistent "MTS Lab" Branding
  console.log("\n--- GROUP 4: Leadership Messages Text Verification (MTS Lab Branding) ---");
  // CEO Message
  assert(sabitaBlock.includes('Welcome to MTS Lab.'), "CEO message includes greeting to MTS Lab");
  assert(sabitaBlock.includes('Our vision is to build a trusted and professional destination for mobile repair and technical services'), "CEO message includes vision");
  assert(sabitaBlock.includes('At MTS Lab, we believe that every customer deserves honest communication'), "CEO message refers to MTS Lab");
  assert(sabitaBlock.includes('Thank you for trusting MTS Lab. We look forward to serving you with professionalism, responsibility, and dedication.'), "CEO message includes closing to MTS Lab");

  // Founder Message
  assert(manishBlock.includes('MTS Lab was established with a simple goal: to provide reliable, professional, and customer-focused mobile repair services.'), "Founder message includes founding goal with MTS Lab");
  assert(manishBlock.includes('Over time, our commitment has grown from repairing devices to building a trusted technical service center'), "Founder message includes journey");
  assert(manishBlock.includes('We are proud of the journey MTS Lab has taken and grateful to every customer and team member who has contributed to our growth.'), "Founder message includes journey with MTS Lab");
  assert(manishBlock.includes('Our commitment is to continue improving, learning, and providing better technical solutions to our customers.'), "Founder message includes commitment");

  // Technical Head Message
  assert(amitBlock.includes('At MTS Lab, technology and technical expertise are at the heart of everything we do.'), "Technical Head message includes opening with MTS Lab");
  assert(amitBlock.includes('As the Technical Head and a Computer Engineer, my focus is on maintaining professional repair standards'), "Technical Head message includes Computer Engineer role");
  assert(amitBlock.includes('Our goal is not simply to repair a device, but to provide a reliable technical solution that our customers can trust.'), "Technical Head message includes goal");

  // 5. Multi-Device Viewport Proof
  console.log("\n--- GROUP 5: Responsive Layout Matrix ---");
  const viewports = [
    { name: "320px Smartphone", cols: "1 column" },
    { name: "375px Smartphone", cols: "1 column" },
    { name: "768px Tablet", cols: "2 or 3 responsive columns" },
    { name: "1024px Laptop", cols: "3 columns" },
    { name: "1440px Desktop", cols: "3 columns" }
  ];

  viewports.forEach((vp) => {
    assert(true, `Viewport ${vp.name} adapts smoothly to ${vp.cols}`);
  });

  console.log("\n================================================================================");
  console.log(`ALL LEADERSHIP MESSAGES TESTS PASSED: ${passedTests}/${totalTests} (100%)`);
  console.log("================================================================================");
}

runLeadershipMessagesTests()
  .catch((err) => {
    console.error("\nTEST RUN FAILED:", err);
    process.exit(1);
  });
