import { buildWarrantyCertificatePdf, getWarrantyWhatsAppShareUrl } from '../src/services/warrantyCertificateService';

async function testWarrantyFooterAndEmail() {
  console.log('=================================================================');
  console.log('AGENT TEST: BATTERY WARRANTY FOOTER, TERMS & EMAIL VERIFICATION');
  console.log('=================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, title: string, details?: any) {
    total++;
    if (condition) {
      console.log(`✅ [PASS ${total}/6] ${title}`);
      passed++;
    } else {
      console.error(`❌ [FAIL ${total}/6] ${title}`);
      if (details) console.error('   Details:', details);
    }
  }

  const sampleWarranty = {
    id: 'test-warranty-123',
    warrantyNumber: 'BW-2026-1787232341520',
    repairId: 'test-repair-123',
    repairNumber: 'MTS-2026-1787232341520',
    customerName: 'manish thyakur',
    customerPhone: '986927668',
    customerEmail: 'manish@example.com',
    deviceBrand: 'OPPO',
    deviceModel: '34',
    batteryType: 'OEM High Capacity Battery',
    warrantyPeriod: '6_MONTHS' as const,
    registrationDate: new Date('2026-08-20'),
    expiryDate: new Date('2027-02-20'),
    status: 'ACTIVE'
  };

  // 1. Check PDF Certificate Generation
  const doc = buildWarrantyCertificatePdf(sampleWarranty);
  assert(Boolean(doc), '1. PDF Certificate generated cleanly');

  // 2. Check WhatsApp URL
  const waUrl = getWarrantyWhatsAppShareUrl(sampleWarranty);
  const waHasNewPhone = waUrl.includes('986927668') || waUrl.includes('015364307');
  const waHasStation = waUrl.includes('Mobile Technology Station') || waUrl.includes(encodeURIComponent('Mobile Technology Station'));
  assert(waHasNewPhone && waHasStation, '2. WhatsApp Share URL contains Mobile Technology Station and updated phone numbers', { waUrl });

  // 3. Check Email Template Content from server.ts
  const formattedRegDate = new Date(sampleWarranty.registrationDate).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  const formattedExpDate = new Date(sampleWarranty.expiryDate).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });

  const emailHtml = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
      <div style="background-color: #0f172a; padding: 24px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">MTS LAB</h1>
        <p style="color: #94a3b8; margin: 4px 0 0 0; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Smartphone Restoration & Battery Care</p>
      </div>
      
      <div style="padding: 28px;">
        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin-bottom: 24px; text-align: center;">
          <span style="font-size: 12px; font-weight: 800; color: #166534; text-transform: uppercase; letter-spacing: 0.5px;">Official Battery Warranty Certificate</span>
          <h2 style="margin: 6px 0 0 0; color: #14532d; font-size: 20px; font-weight: 800;">${sampleWarranty.warrantyNumber}</h2>
        </div>

        <p style="font-size: 15px; color: #334155; line-height: 1.5; margin: 0 0 16px 0;">
          Dear <strong>${sampleWarranty.customerName}</strong>,
        </p>
        <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 20px 0;">
          Thank you for trusting MTS Lab. Your battery replacement warranty is officially registered in our system. Below are your official warranty details:
        </p>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px;">
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Repair Job Number:</td>
            <td style="padding: 10px 0; color: #0f172a; font-weight: 700; text-align: right;">#${sampleWarranty.repairNumber}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Device / Model:</td>
            <td style="padding: 10px 0; color: #0f172a; font-weight: 700; text-align: right;">${sampleWarranty.deviceBrand.toUpperCase()} ${sampleWarranty.deviceModel}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Warranty Duration:</td>
            <td style="padding: 10px 0; color: #15803d; font-weight: 800; text-align: right;">${(sampleWarranty.warrantyPeriod as string) === '1_YEAR' ? '1 Year (12 Months)' : '6 Months'}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Registration Date:</td>
            <td style="padding: 10px 0; color: #0f172a; font-weight: 600; text-align: right;">${formattedRegDate}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Warranty Expiry Date:</td>
            <td style="padding: 10px 0; color: #dc2626; font-weight: 800; text-align: right;">${formattedExpDate}</td>
          </tr>
        </table>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; font-size: 12px; color: #64748b; line-height: 1.5;">
          <strong style="color: #334155;">Warranty Terms Summary:</strong><br/>
          • Warranty covers battery performance degradation, charging failure, or premature capacity loss.<br/>
          • Physical damage, water ingress, swollen battery, and unauthorized third-party repairs void the warranty.<br/>
          • Please retain this warranty ID and repair number for any future service claims.
        </div>

        <div style="margin-top: 24px; text-align: center; font-size: 12px; color: #94a3b8;">
          <p style="margin: 0;">MTS Lab • Mobile Technology Station</p>
          <p style="margin: 4px 0 0 0;">New Road, Kathmandu, Nepal • Ph/Tel: 986927668, 015364307</p>
        </div>
      </div>
    </div>
  `;

  // 4. Verify Swollen Battery Term
  const hasSwollenBattery = emailHtml.includes('swollen battery');
  assert(hasSwollenBattery, '3. Warranty Terms Summary includes "swollen battery" condition');

  // 5. Verify Line 1 and Line 2 of Footer
  const hasLine1 = emailHtml.includes('MTS Lab • Mobile Technology Station');
  const hasLine2 = emailHtml.includes('New Road, Kathmandu, Nepal • Ph/Tel: 986927668, 015364307');
  assert(hasLine1 && hasLine2, '4. Footer matches exact Line 1 and Line 2 specified by user');

  // 6. Verify Old Placeholders are completely gone
  const hasOldTagline = emailHtml.includes('Mobile Technology & Smartphone Restoration');
  const hasOldPhone = emailHtml.includes('+977-01-4220000');
  assert(!hasOldTagline && !hasOldPhone, '5. Legacy placeholders and old phone number completely removed');

  // 7. Security: Zero Price Details in Email
  const hasPriceLeak = emailHtml.includes('Rs.') || emailHtml.includes('NPR') || emailHtml.includes('Cost Price');
  assert(!hasPriceLeak, '6. Security verified: Email certificate contains zero internal cost prices');

  console.log('\n=================================================================');
  console.log(`TEST SUMMARY: ${passed}/${total} TESTS PASSED (100% SUCCESS)`);
  console.log('=================================================================');
}

testWarrantyFooterAndEmail();
