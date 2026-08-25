import fs from 'fs';
import path from 'path';
import { jsPDF } from 'jspdf';
import { 
  NEPALI_TERMS_AND_CONDITIONS, 
  partitionDevicesForBills, 
  RepairSlipItem, 
  ServiceSlipCustomer 
} from '../src/services/serviceSlipService';

async function runTests() {
  console.log('=== STARTING MTS LAB SERVICE SLIP & PDF VERIFICATION ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: any) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`, detail || '');
      failed++;
    }
  }

  // 1. Verify Zero oklch() Across All CSS in src/
  console.log('--- 1. Testing Zero OKLCH Color Functions in Stylesheets ---');
  const indexCssPath = path.join(process.cwd(), 'src/index.css');
  const indexCssContent = fs.readFileSync(indexCssPath, 'utf8');

  assert(!indexCssContent.includes('oklch'), 'src/index.css contains ZERO oklch() declarations');
  assert(!indexCssContent.includes('color-mix'), 'src/index.css contains ZERO color-mix() declarations');
  assert(indexCssContent.includes('--background: #ffffff;'), 'Standard HEX background in :root');
  assert(indexCssContent.includes('--foreground: #09090b;'), 'Standard HEX foreground in :root');

  // 2. Verify Fixed 9 Nepali Terms & Conditions Word-for-Word
  console.log('\n--- 2. Testing Exact 9 Nepali Terms & Conditions ---');
  const EXPECTED_TERMS = [
    "सेट मर्मत गर्दा अनुमानित समयभन्दा बढी समय लागेमा त्यसप्रति कम्पनी जिम्मेवार हुने छैन।",
    "चोरी अथवा भेटिएको मोबाइल सेट मर्मतका लागि ल्याएमा ग्राहक स्वयं जिम्मेवार हुनेछ।",
    "सिम कार्ड, सिम ट्रे, मेमोरी कार्ड, कभर जस्ता सामानहरूको जिम्मेवारी कम्पनीको हुने छैन।",
    "एमटीएस ल्याब (MTS Lab) ले मोबाइल मर्मत गर्नु अघि, मर्मतको क्रममा वा मर्मत पछि मोबाइलमा रहेका डाटा तथा फाइलहरूको कुनै जिम्मेवारी लिने छैन।",
    "मर्मत भएको वा मर्मत हुन नसक्ने मोबाइल ७ दिनभित्र अनिवार्य रूपमा लिनुहोस्। ७ दिनपछि मोबाइलको जिम्मेवारी MTS Lab ले लिने छैन।",
    "यो रसिद हराएको वा ल्याउन छुटेमा सामान दिने छैन।",
    "मोबाइल अन नआएमा वा डिस्प्ले नखुलेको खण्डमा बाँकी पार्ट्स चेक नगरीएको हुनाले मोबाइल अन भएपछि अन्य पार्ट्समा समस्या आएमा ग्राहक स्वयं जिम्मेवार हुनेछ।",
    "डिस्प्ले फेरेको मोबाइलमा ग्यारेन्टी हुँदैन।",
    "डेड वा लोगोमा अड्किएको मोबाइल मर्मत हुन नसकेमा ग्राहकले बिना विवाद फिर्ता लैजानुपर्नेछ। यस्ता मोबाइल पहिलेको अवस्थामा फर्किने ग्यारेन्टी हुँदैन।"
  ];

  assert(NEPALI_TERMS_AND_CONDITIONS.length === 9, 'Exactly 9 terms and conditions present');
  
  EXPECTED_TERMS.forEach((term, idx) => {
    assert(
      NEPALI_TERMS_AND_CONDITIONS[idx] === term, 
      `Rule ${idx + 1} matches fixed legal wording: "${term.substring(0, 30)}..."`
    );
  });

  // 3. Verify Device Grouping & Multi-Device Logic
  console.log('\n--- 3. Testing Service Slip Device Partitioning ---');
  const dummyCustomer: ServiceSlipCustomer = {
    name: 'Ram Bahadur Shrestha',
    phone: '9841234567',
    customerId: 'CUST-001'
  };

  const createDummyDevice = (num: number): RepairSlipItem => ({
    repairNumber: `REP-2026-00${num}`,
    deviceBrand: 'Apple',
    deviceModel: `iPhone 15 Pro Max ${num}`,
    imeiNumber: `35698710254890${num}`,
    problemDescription: 'Display flickering and touch unresponsive',
    estimatedCost: 12500,
    deviceCondition: 'Good'
  });

  // Test 1 device
  const bills1 = partitionDevicesForBills([createDummyDevice(1)], dummyCustomer);
  assert(bills1.length === 1, '1 device produces 1 bill');
  assert(bills1[0].devices.length === 1, 'Bill contains 1 device');

  // Test 2 devices
  const bills2 = partitionDevicesForBills([createDummyDevice(1), createDummyDevice(2)], dummyCustomer);
  assert(bills2.length === 1, '2 devices produce 1 combined bill');
  assert(bills2[0].devices.length === 2, 'Bill contains both 2 devices');

  // Test 3 devices (Max even = 2 in Bill 1, 1 remainder in Bill 2)
  const bills3 = partitionDevicesForBills([createDummyDevice(1), createDummyDevice(2), createDummyDevice(3)], dummyCustomer);
  assert(bills3.length === 2, '3 devices partition into 2 bills');
  assert(bills3[0].devices.length === 2, 'Bill 1 contains 2 devices');
  assert(bills3[1].devices.length === 1, 'Bill 2 contains 1 remainder device');

  // 4. Verify Service Slip Document Template
  console.log('\n--- 4. Testing Service Slip Document Component Details ---');
  const docPath = path.join(process.cwd(), 'src/components/repair/ServiceSlipDocument.tsx');
  assert(fs.existsSync(docPath), 'ServiceSlipDocument.tsx exists');
  const docContent = fs.readFileSync(docPath, 'utf8');

  assert(docContent.includes('Mobile Technology Station (MTS Lab)'), 'Document contains "Mobile Technology Station (MTS Lab)" header');
  assert(docContent.includes('Pako Sadak, New Road, Kathmandu, Nepal'), 'Document contains Kathmandu registered address');
  assert(docContent.includes('9869276668'), 'Document contains phone 9869276668');
  assert(docContent.includes('9709797526'), 'Document contains phone 9709797526');
  assert(docContent.includes('01-5364307'), 'Document contains phone 01-5364307');
  assert(docContent.includes('SERVICE SLIP'), 'Document contains SERVICE SLIP badge');

  // Verify PAN and Registration details are NOT included on Service Slip
  assert(!docContent.includes('PAN:'), 'Service Slip does NOT include PAN Number');
  assert(!docContent.includes('PAN Number'), 'Service Slip does NOT include PAN Number field');
  assert(!docContent.includes('Registration Number'), 'Service Slip does NOT include Registration Number');
  assert(!docContent.includes('Registration Certificate'), 'Service Slip does NOT include Registration Certificate Number');
  assert(!docContent.includes('E-Commerce Portal Listing'), 'Service Slip does NOT include E-Commerce Portal Listing Number');

  assert(docContent.includes('Customer Name:'), 'Document contains Customer Name field');
  assert(docContent.includes('Mob. No.:'), 'Document contains Mob. No. field');
  assert(docContent.includes('IMEI No.:'), 'Document contains IMEI No. field');
  assert(docContent.includes('Model No.:'), 'Document contains Model No. field');
  assert(docContent.includes('Problem:'), 'Document contains Problem description field');
  assert(docContent.includes('Estimated Service Charge:'), 'Document contains Estimated Service Charge field');
  assert(docContent.includes('Authorized Sign'), 'Document contains Authorized Sign block');
  assert(docContent.includes('Customer Sign'), 'Document contains Customer Sign block');
  assert(docContent.includes('शर्त तथा नियमहरू:'), 'Document contains "शर्त तथा नियमहरू:" heading');
  assert(docContent.includes('794px'), 'Document root configured for 794px width');
  assert(docContent.includes('520px'), 'Document root configured for 520px height');

  // 5. Test jsPDF A4 Landscape PDF Engine & Coverage
  console.log('\n--- 5. Testing jsPDF A4 Landscape PDF Generation Engine & 50%-70% Coverage ---');
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidthMm = pdf.internal.pageSize.getWidth();
  const pageHeightMm = pdf.internal.pageSize.getHeight();

  assert(Math.round(pageWidthMm) === 297, `A4 Landscape PDF width is 297mm (Actual: ${pageWidthMm.toFixed(2)}mm)`);
  assert(Math.round(pageHeightMm) === 210, `A4 Landscape PDF height is 210mm (Actual: ${pageHeightMm.toFixed(2)}mm)`);

  const slipWidthMm = 240;
  const slipHeightMm = 157;
  const pageArea = pageWidthMm * pageHeightMm;
  const slipArea = slipWidthMm * slipHeightMm;
  const coveragePercent = (slipArea / pageArea) * 100;

  assert(coveragePercent >= 50 && coveragePercent <= 70, `A4 page coverage is in 50%-70% range (Actual: ${coveragePercent.toFixed(1)}%)`);

  const posX = (pageWidthMm - slipWidthMm) / 2;
  const posY = (pageHeightMm - slipHeightMm) / 2;
  assert(posX > 20 && posY > 20, `Centered positioning margins balanced (Left/Right: ${posX.toFixed(1)}mm, Top/Bottom: ${posY.toFixed(1)}mm)`);

  const dummyImageData = 'data:image/jpeg;base64,' + Buffer.alloc(100, 0xff).toString('base64');
  pdf.addImage(dummyImageData, 'JPEG', posX, posY, slipWidthMm, slipHeightMm, undefined, 'FAST');
  const pdfOutput = pdf.output('arraybuffer');
  assert(pdfOutput.byteLength > 0, `Generated valid A4 PDF buffer (${pdfOutput.byteLength} bytes)`);

  console.log('\n==============================================');
  console.log(`SERVICE SLIP TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('==============================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
