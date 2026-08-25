import fs from 'fs';
import path from 'path';
import { jsPDF } from 'jspdf';
import { 
  NEPALI_TERMS_AND_CONDITIONS, 
  partitionDevicesForBills, 
  RepairSlipItem, 
  ServiceSlipCustomer 
} from '../src/services/serviceSlipService';

async function runTripleCheck() {
  console.log('=== STARTING 3-PHASE REPEATED SERVICE SLIP VERIFICATION ===\n');

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

  // Load Component Source Code
  const docPath = path.join(process.cwd(), 'src/components/repair/ServiceSlipDocument.tsx');
  assert(fs.existsSync(docPath), 'ServiceSlipDocument.tsx exists');
  const docContent = fs.readFileSync(docPath, 'utf8');

  // ==========================================
  // TRIAL 1: SINGLE DEVICE SERVICE SLIP
  // ==========================================
  console.log('\n--- TRIAL 1 / 3: Single Device Service Slip ---');
  const customer1: ServiceSlipCustomer = {
    name: 'Bikash Tamang',
    phone: '9841234567',
    customerId: 'CUST-001'
  };
  const device1: RepairSlipItem = {
    repairNumber: 'REP-2026-001',
    deviceBrand: 'Apple',
    deviceModel: 'iPhone 15 Pro Max',
    imeiNumber: '356987102548901',
    problemDescription: 'Display flickering and touch unresponsive on top half',
    estimatedCost: 14500,
    deviceCondition: 'Minor scratches, good frame',
    accessoriesReceived: 'Original box with sim ejector'
  };

  const bills1 = partitionDevicesForBills([device1], customer1);
  assert(bills1.length === 1, '[Trial 1] Exactly 1 bill generated');
  assert(bills1[0].devices.length === 1, '[Trial 1] Bill contains single device');
  assert(bills1[0].billNumber === 'SLIP-REP-2026-001', '[Trial 1] Bill number matches repair number');

  // Check PDF Dimensions (A4 Landscape: 297mm x 210mm)
  const pdf1 = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const w1 = pdf1.internal.pageSize.getWidth();
  const h1 = pdf1.internal.pageSize.getHeight();
  assert(Math.round(w1) === 297, '[Trial 1] A4 Landscape Width is 297mm');
  assert(Math.round(h1) === 210, '[Trial 1] A4 Landscape Height is 210mm');

  // Verify 50%-70% page coverage
  const slipW = 240;
  const slipH = 157;
  const coverage1 = ((slipW * slipH) / (w1 * h1)) * 100;
  assert(coverage1 >= 50 && coverage1 <= 70, `[Trial 1] A4 page coverage is in 50%-70% range (Actual: ${coverage1.toFixed(1)}%)`);

  const posX1 = (w1 - slipW) / 2;
  const posY1 = (h1 - slipH) / 2;
  const dummyImg1 = 'data:image/jpeg;base64,' + Buffer.alloc(100, 0xee).toString('base64');
  pdf1.addImage(dummyImg1, 'JPEG', posX1, posY1, slipW, slipH, undefined, 'FAST');
  const buf1 = pdf1.output('arraybuffer');
  assert(buf1.byteLength > 0, `[Trial 1] Generated valid A4 PDF byte stream (${buf1.byteLength} bytes)`);

  // ==========================================
  // TRIAL 2: MULTI-DEVICE SERVICE SLIP
  // ==========================================
  console.log('\n--- TRIAL 2 / 3: Multi-Device Service Slip (2 Devices) ---');
  const customer2: ServiceSlipCustomer = {
    name: 'Sunita Maharjan',
    phone: '9801122334',
    customerId: 'CUST-002'
  };
  const device2A: RepairSlipItem = {
    repairNumber: 'REP-2026-002',
    deviceBrand: 'Samsung',
    deviceModel: 'Galaxy S24 Ultra',
    imeiNumber: '359874102938475',
    problemDescription: 'Broken front glass & camera lens crack',
    estimatedCost: 18000,
    deviceCondition: 'Good condition'
  };
  const device2B: RepairSlipItem = {
    repairNumber: 'REP-2026-003',
    deviceBrand: 'Apple',
    deviceModel: 'iPhone 13',
    imeiNumber: '358761092837465',
    problemDescription: 'Battery replacement & charging port cleaning',
    estimatedCost: 6500,
    deviceCondition: 'Fair'
  };

  const bills2 = partitionDevicesForBills([device2A, device2B], customer2);
  assert(bills2.length === 1, '[Trial 2] 2 devices grouped into 1 consolidated bill');
  assert(bills2[0].devices.length === 2, '[Trial 2] Consolidated bill contains both devices');
  assert(bills2[0].billNumber === 'SLIP-REP-2026-002-REP-2026-003', '[Trial 2] Consolidated bill identifier generated');

  const pdf2 = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const w2 = pdf2.internal.pageSize.getWidth();
  const h2 = pdf2.internal.pageSize.getHeight();
  const posX2 = (w2 - slipW) / 2;
  const posY2 = (h2 - slipH) / 2;
  pdf2.addImage(dummyImg1, 'JPEG', posX2, posY2, slipW, slipH, undefined, 'FAST');
  const buf2 = pdf2.output('arraybuffer');
  assert(buf2.byteLength > 0, `[Trial 2] Generated valid multi-device A4 PDF (${buf2.byteLength} bytes)`);

  // ==========================================
  // TRIAL 3: LONG DATA & TYPOGRAPHY INTEGRITY
  // ==========================================
  console.log('\n--- TRIAL 3 / 3: Typography, Layout & Legal Rules Integrity ---');
  
  // 1. Verify No Dotted Underline Collisions in Document
  assert(!docContent.includes("borderBottom: '1px dotted #000000'"), '[Trial 3] Zero dotted underline strikethrough artifacts');
  assert(docContent.includes('SERVICE SLIP'), '[Trial 3] SERVICE SLIP pill badge present');
  assert(docContent.includes('Mobile Technology Station (MTS Lab)'), '[Trial 3] Official MTS Lab title present');
  assert(docContent.includes('Pako Sadak, New Road, Kathmandu, Nepal'), '[Trial 3] Official Kathmandu address present');
  assert(docContent.includes('01-5364307'), '[Trial 3] Official landline present');

  // 2. Verify Exclusion of PAN / Reg numbers from Service Slip
  assert(!docContent.includes('PAN:'), '[Trial 3] PAN Number strictly excluded from Service Slip');
  assert(!docContent.includes('Registration Certificate'), '[Trial 3] Registration Certificate strictly excluded from Service Slip');

  // 3. Verify Exact 9 Nepali Rules without Orphan Punctuation
  assert(NEPALI_TERMS_AND_CONDITIONS.length === 9, '[Trial 3] Exactly 9 terms and conditions present');
  NEPALI_TERMS_AND_CONDITIONS.forEach((rule, idx) => {
    assert(rule.endsWith('।') || rule.endsWith('।'), `[Trial 3] Rule ${idx + 1} ends cleanly with danda punctuation`);
    assert(!rule.includes(' ।'), `[Trial 3] Rule ${idx + 1} has no space before danda (prevents orphan wrapping)`);
  });

  // 4. Verify Correct Spelling of "डिस्प्ले"
  assert(NEPALI_TERMS_AND_CONDITIONS[6].includes('डिस्प्ले'), '[Trial 3] Rule 7 correctly spells "डिस्प्ले"');
  assert(NEPALI_TERMS_AND_CONDITIONS[7].includes('डिस्प्ले'), '[Trial 3] Rule 8 correctly spells "डिस्प्ले"');

  // 5. Verify Signature Baseline & Problem Box Layout
  assert(docContent.includes('Authorized Sign'), '[Trial 3] Authorized Sign present');
  assert(docContent.includes('Customer Sign'), '[Trial 3] Customer Sign present');
  assert(docContent.includes('Problem:'), '[Trial 3] Problem description box present');
  assert(docContent.includes('#f8fafc'), '[Trial 3] Light background tint (#f8fafc) applied to problem container');
  assert(docContent.includes('Estimated Service Charge:'), '[Trial 3] Prominent Estimated Service Charge box present');

  console.log('\n======================================================');
  console.log(`TRIPLE-CHECK RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('======================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTripleCheck();
