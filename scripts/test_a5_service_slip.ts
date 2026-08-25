import { 
  partitionDevicesForBills, 
  NEPALI_TERMS_AND_CONDITIONS, 
  RepairSlipItem, 
  ServiceSlipCustomer 
} from '../src/services/serviceSlipService';
import { jsPDF } from 'jspdf';

console.log('=== STARTING MTS LAB A5 LANDSCAPE BILL GENERATION VERIFICATION ===\n');

let passed = 0;
let failed = 0;

function assert(condition: boolean, title: string, extra?: any) {
  if (condition) {
    console.log(`✅ [PASS] ${title}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${title}`, extra || '');
    failed++;
  }
}

// 1. Check A5 Landscape Dimensions in jsPDF
console.log('--- 1. Testing jsPDF A5 Landscape Dimensions ---');
const pdf = new jsPDF({
  orientation: 'landscape',
  unit: 'mm',
  format: 'a5'
});
const pdfWidth = Math.round(pdf.internal.pageSize.getWidth());
const pdfHeight = Math.round(pdf.internal.pageSize.getHeight());

assert(pdfWidth === 210, `PDF width is exactly 210 mm (Actual: ${pdfWidth} mm)`);
assert(pdfHeight === 148, `PDF height is exactly 148 mm (Actual: ${pdfHeight} mm)`);
assert(pdfWidth > pdfHeight, 'PDF orientation is Landscape');

// 2. Check Exact 9 Nepali Terms & Conditions matching prompt #4
console.log('\n--- 2. Testing Exact 9 Nepali Terms & Conditions ---');
assert(NEPALI_TERMS_AND_CONDITIONS.length === 9, 'Exactly 9 Nepali Terms are present');

const expectedTerms = [
  "सेट मर्मत गर्दा अनुमानित समयभन्दा बढी समय लागेमा त्यसप्रति कम्पनी जिम्मेवार हुने छैन ।",
  "चोरी अथवा भेटिएको मोबाइल सेट मर्मतका लागि ल्याएमा ग्राहक स्वयं जिम्मेवार हुनेछ ।",
  "सिम कार्ड, सिम ट्रे, मेमोरी कार्ड, कभर जस्ता सामानहरूको जिम्मेवारी कम्पनीको हुने छैन ।",
  "एमटीएस ल्याब (MTS Lab) ले मोबाइल मर्मत गर्नु अघि, मर्मतको क्रममा वा मर्मत पछि मोबाइलमा रहेका डाटा तथा फाइलहरूको कुनै जिम्मेवारी लिने छैन।",
  "मर्मत भएको वा मर्मत हुन नसक्ने मोबाइल ७ दिनभित्र अनिवार्य रूपमा लिनुहोस् । ७ दिनपछि मोबाइलको जिम्मेवारी MTS Lab ले लिने छैन ।",
  "यो रसिद हराएको वा ल्याउन छुटेमा सामान दिने छैन ।",
  "मोबाइल अन नआएमा वा डिस्प्ले नखुलेको खण्डमा बाँकी पार्ट्स चेक नगरीएको हुनाले मोबाइल अन भएपछि अन्य पार्ट्समा समस्या आएमा ग्राहक स्वयं जिम्मेवार हुनेछ ।",
  "डिस्प्ले फेरेको मोबाइलमा ग्यारेन्टी हुँदैन ।",
  "डेड वा लोगोमा अड्किएको मोबाइल मर्मत हुन नसकेमा ग्राहकले बिना विवाद फिर्ता लैजानुपर्नेछ । यस्ता मोबाइल पहिलेको अवस्थामा फर्किने ग्यारेन्टी हुँदैन ।"
];

expectedTerms.forEach((expected, i) => {
  assert(NEPALI_TERMS_AND_CONDITIONS[i] === expected, `Nepali term #${i + 1} matches exact text`);
});

// 3. Multi-Device Partitioning Logic Tests
console.log('\n--- 3. Testing Device Partitioning & Multiple Devices Billing Logic ---');

const mockCustomer: ServiceSlipCustomer = {
  id: 'cust-1',
  name: 'Bikash Shrestha',
  phone: '9841234567',
  email: 'bikash@example.com'
};

const createMockDevice = (num: number): RepairSlipItem => ({
  id: `rep-${num}`,
  repairNumber: `REP-2026-000${num}`,
  deviceBrand: 'Apple',
  deviceModel: `iPhone 1${num} Pro`,
  imeiNumber: `35678901234567${num}`,
  problemDescription: `Screen and battery replacement for unit ${num}`,
  estimatedCost: 4500 + num * 500
});

// Test 1 Device
const oneDevice = [createMockDevice(1)];
const billsFor1 = partitionDevicesForBills(oneDevice, mockCustomer);
assert(billsFor1.length === 1, '1 device produces exactly 1 bill');
assert(billsFor1[0].devices.length === 1, 'Bill 1 contains 1 device');
assert(billsFor1[0].billIndex === 1 && billsFor1[0].totalBills === 1, 'Bill index and total are 1/1');

// Test 2 Devices (Even -> Combined into 1 Bill)
const twoDevices = [createMockDevice(1), createMockDevice(2)];
const billsFor2 = partitionDevicesForBills(twoDevices, mockCustomer);
assert(billsFor2.length === 1, '2 devices produce exactly 1 combined bill');
assert(billsFor2[0].devices.length === 2, 'Combined bill contains both 2 devices');
assert(billsFor2[0].devices[0].repairNumber === 'REP-2026-0001', 'First device is present');
assert(billsFor2[0].devices[1].repairNumber === 'REP-2026-0002', 'Second device is present');

// Test 3 Devices (Odd -> Bill 1: 2 devices, Bill 2: 1 device)
const threeDevices = [createMockDevice(1), createMockDevice(2), createMockDevice(3)];
const billsFor3 = partitionDevicesForBills(threeDevices, mockCustomer);
assert(billsFor3.length === 2, '3 devices produce exactly 2 bills');
assert(billsFor3[0].devices.length === 2, 'Bill 1 has max even grouping (2 devices)');
assert(billsFor3[1].devices.length === 1, 'Bill 2 has remainder (1 device)');
assert(billsFor3[0].billIndex === 1 && billsFor3[0].totalBills === 2, 'Bill 1 marked as Bill 1 of 2');
assert(billsFor3[1].billIndex === 2 && billsFor3[1].totalBills === 2, 'Bill 2 marked as Bill 2 of 2');

// Verify all devices accounted for with no duplication
const all3RepairNumbers = billsFor3.flatMap(b => b.devices.map(d => d.repairNumber));
assert(all3RepairNumbers.length === 3, 'Total 3 devices partitioned with zero duplicates');
assert(all3RepairNumbers.includes('REP-2026-0001') && all3RepairNumbers.includes('REP-2026-0002') && all3RepairNumbers.includes('REP-2026-0003'), 'Every device accounted for');

// Test 4 Devices (Even -> Combined into 1 Bill)
const fourDevices = [createMockDevice(1), createMockDevice(2), createMockDevice(3), createMockDevice(4)];
const billsFor4 = partitionDevicesForBills(fourDevices, mockCustomer);
assert(billsFor4.length === 1, '4 devices produce exactly 1 combined bill');
assert(billsFor4[0].devices.length === 4, 'Combined bill contains all 4 devices');

// Test 5 Devices (Odd -> Bill 1: 4 devices, Bill 2: 1 device)
const fiveDevices = [createMockDevice(1), createMockDevice(2), createMockDevice(3), createMockDevice(4), createMockDevice(5)];
const billsFor5 = partitionDevicesForBills(fiveDevices, mockCustomer);
assert(billsFor5.length === 2, '5 devices produce exactly 2 bills');
assert(billsFor5[0].devices.length === 4, 'Bill 1 has 4 devices');
assert(billsFor5[1].devices.length === 1, 'Bill 2 has 1 device');

console.log('\n========================================');
console.log(`A5 VERIFICATION RESULT: ${passed} passed, ${failed} failed`);
console.log('========================================');

if (failed > 0) {
  process.exit(1);
}
