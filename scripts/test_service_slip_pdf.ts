import { 
  partitionDevicesForBills, 
  generateVectorSlipPdf, 
  NEPALI_TERMS_AND_CONDITIONS,
  RepairSlipItem,
  ServiceSlipCustomer 
} from '../src/services/serviceSlipService';
import fs from 'fs';
import path from 'path';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    throw new Error(msg);
  }
  console.log(`✓ ${msg}`);
}

async function runServiceSlipTests() {
  console.log("===================================================================");
  console.log("TESTING SERVICE SLIP PARTITIONING, PDF GENERATION & NEPALI TERMS");
  console.log("===================================================================");

  const testCustomer: ServiceSlipCustomer = {
    name: "Manish Sharma",
    phone: "9869276668",
    email: "manish@mtslab.com",
    address: "New Road, Kathmandu"
  };

  const createMockDevice = (num: number): RepairSlipItem => ({
    id: `dev-${num}`,
    repairNumber: `MTS-2026-000${num}`,
    deviceBrand: "Apple",
    deviceModel: `iPhone 1${num} Pro Max`,
    imeiNumber: `35489012345678${num}`,
    problemDescription: `Problem with screen and camera module on device ${num}`,
    deviceCondition: "Good",
    estimatedCost: 12000 + num * 1000,
    status: "RECEIVED"
  });

  // 1. Partitioning Tests
  console.log("\n--- [GROUP 1] MULTI-DEVICE PARTITIONING RULES ---");
  
  // 1 Device -> 1 Bill
  const bills1 = partitionDevicesForBills([createMockDevice(1)], testCustomer);
  assert(bills1.length === 1, "1.1 Single device creates 1 bill");
  assert(bills1[0].devices.length === 1, "1.2 Bill 1 contains 1 device");

  // 2 Devices -> 1 Bill (even count rule: all grouped together)
  const bills2 = partitionDevicesForBills([createMockDevice(1), createMockDevice(2)], testCustomer);
  assert(bills2.length === 1, "1.3 Two devices grouped into 1 bill");
  assert(bills2[0].devices.length === 2, "1.4 Bill contains 2 devices");

  // 3 Devices -> 2 Bills (odd count rule: 2 in Bill 1, 1 in Bill 2)
  const bills3 = partitionDevicesForBills([createMockDevice(1), createMockDevice(2), createMockDevice(3)], testCustomer);
  assert(bills3.length === 2, "1.5 Three devices partition into 2 bills");
  assert(bills3[0].devices.length === 2, "1.6 Bill 1 has 2 devices");
  assert(bills3[1].devices.length === 1, "1.7 Bill 2 has 1 device");

  // 5 Devices -> 2 Bills (odd count rule: 4 in Bill 1, 1 in Bill 2)
  const bills5 = partitionDevicesForBills([1, 2, 3, 4, 5].map(createMockDevice), testCustomer);
  assert(bills5.length === 2, "1.8 Five devices partition into 2 bills");
  assert(bills5[0].devices.length === 4, "1.9 Bill 1 has 4 devices");
  assert(bills5[1].devices.length === 1, "1.10 Bill 2 has 1 remainder device");

  // 2. Nepali Terms & Conditions Verification
  console.log("\n--- [GROUP 2] NEPALI TERMS & CONDITIONS VERIFICATION ---");
  assert(NEPALI_TERMS_AND_CONDITIONS.length === 9, "2.1 Exact 9 Nepali terms present");
  assert(NEPALI_TERMS_AND_CONDITIONS[0].includes("अनुमानित समयभन्दा"), "2.2 Term 1 (Estimate timeframe) verified");
  assert(NEPALI_TERMS_AND_CONDITIONS[3].includes("एमटीएस ल्याब (MTS Lab)"), "2.3 Term 4 (Data liability) verified");
  assert(NEPALI_TERMS_AND_CONDITIONS[4].includes("७ दिनभित्र"), "2.4 Term 5 (7 days pickup notice) verified");
  assert(NEPALI_TERMS_AND_CONDITIONS[7].includes("डिस्प्ले फेरेको"), "2.5 Term 8 (Display replacement warranty notice) verified");

  // 3. PDF Generator Verification
  console.log("\n--- [GROUP 3] VECTOR PDF GENERATOR VERIFICATION ---");
  const tempPdfPath = path.join(process.cwd(), 'scripts', 'test_output_slip.pdf');
  const pdfGenerated = generateVectorSlipPdf(bills3[0], tempPdfPath);
  assert(pdfGenerated === true, "3.1 Vector PDF generation executed successfully");

  if (fs.existsSync(tempPdfPath)) {
    const stats = fs.statSync(tempPdfPath);
    assert(stats.size > 1000, `3.2 Generated PDF file size is valid (${stats.size} bytes)`);
    fs.unlinkSync(tempPdfPath); // cleanup
  }

  console.log("\n===================================================================");
  console.log("ALL SERVICE SLIP & PDF FORMAT TESTS PASSED SUCCESSFULLY!");
  console.log("===================================================================");
}

runServiceSlipTests().catch(err => {
  console.error("Service slip test failure:", err);
  process.exit(1);
});
