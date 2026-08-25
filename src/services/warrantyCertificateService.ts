import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

export interface BatteryWarrantyData {
  id: string;
  warrantyNumber: string;
  repairId: string;
  repairNumber: string;
  customerId?: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  customerAddress?: string | null;
  deviceBrand: string;
  deviceModel: string;
  imeiNumber?: string | null;
  batteryType?: string | null;
  warrantyPeriod: string; // '6_MONTHS' | '1_YEAR'
  registrationDate: string | Date;
  expiryDate: string | Date;
  status: string;
  claimCount?: number;
  lastClaimDate?: string | Date | null;
  terms?: string | null;
}

/**
 * Builds the jsPDF document for the MTS Lab Battery Warranty Certificate
 * Strict Rule: Excludes any pricing, fees, or internal costs.
 */
export function buildWarrantyCertificatePdf(warranty: BatteryWarrantyData): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const regDateFormatted = format(new Date(warranty.registrationDate), 'dd MMMM yyyy');
  const expDateFormatted = format(new Date(warranty.expiryDate), 'dd MMMM yyyy');
  const periodLabel = warranty.warrantyPeriod === '1_YEAR' ? '1 Year (12 Months)' : '6 Months';

  // 1. Top Decorative Accent Bar
  doc.setFillColor(16, 185, 129); // Emerald 500
  doc.rect(0, 0, pageWidth, 4, 'F');

  // 2. Premium Header Background
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 4, pageWidth, 48, 'F');

  // 3. Company Branding
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.text('MTS LAB', 20, 22);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184); // Slate 400
  doc.text('MTS Lab • Mobile Technology Station', 20, 29);
  doc.text('New Road, Kathmandu, Nepal  •  Ph/Tel: 986927668, 015364307', 20, 35);

  // 4. Header Right - Certificate Title & ID
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(52, 211, 153); // Emerald 400
  doc.text('BATTERY WARRANTY CERTIFICATE', pageWidth - 20, 22, { align: 'right' });

  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(warranty.warrantyNumber, pageWidth - 20, 30, { align: 'right' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225); // Slate 300
  doc.text(`Linked Job: #${warranty.repairNumber}`, pageWidth - 20, 36, { align: 'right' });

  // 5. Highlight Banner / Verification Ribbon
  doc.setFillColor(240, 253, 244); // Emerald 50
  doc.setDrawColor(187, 247, 208); // Emerald 200
  doc.roundedRect(20, 58, pageWidth - 40, 22, 3, 3, 'FD');

  doc.setTextColor(21, 128, 61); // Emerald 700
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('OFFICIAL WARRANTY COVERAGE ACTIVATED', 26, 66);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(`Coverage Period: ${periodLabel}  |  Valid until: ${expDateFormatted}`, 26, 73);

  // Status Badge on Right of Ribbon
  doc.setFillColor(16, 185, 129); // Emerald 500
  doc.roundedRect(pageWidth - 55, 63, 30, 11, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('ACTIVE', pageWidth - 40, 70, { align: 'center' });

  // 6. Section 1: Customer & Device Details (Table)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('1. CUSTOMER & DEVICE INFORMATION', 20, 90);

  const customerDeviceRows = [
    [
      { content: 'Customer Name:', styles: { fontStyle: 'bold', textColor: [100, 116, 139] } },
      { content: warranty.customerName, styles: { fontStyle: 'bold', textColor: [15, 23, 42] } },
      { content: 'Device Manufacturer:', styles: { fontStyle: 'bold', textColor: [100, 116, 139] } },
      { content: warranty.deviceBrand.toUpperCase(), styles: { fontStyle: 'bold', textColor: [15, 23, 42] } }
    ],
    [
      { content: 'Mobile Phone:', styles: { fontStyle: 'bold', textColor: [100, 116, 139] } },
      { content: warranty.customerPhone, styles: { textColor: [15, 23, 42] } },
      { content: 'Model Name / Number:', styles: { fontStyle: 'bold', textColor: [100, 116, 139] } },
      { content: warranty.deviceModel, styles: { fontStyle: 'bold', textColor: [15, 23, 42] } }
    ],
    [
      { content: 'Customer Email:', styles: { fontStyle: 'bold', textColor: [100, 116, 139] } },
      { content: warranty.customerEmail || 'Not Recorded', styles: { textColor: [71, 85, 105] } },
      { content: 'IMEI / Serial No:', styles: { fontStyle: 'bold', textColor: [100, 116, 139] } },
      { content: warranty.imeiNumber || 'N/A', styles: { fontStyle: 'normal', textColor: [71, 85, 105] } }
    ]
  ];

  autoTable(doc, {
    startY: 94,
    body: customerDeviceRows as any,
    theme: 'plain',
    styles: {
      fontSize: 8.5,
      cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
      overflow: 'linebreak'
    },
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 50 },
      2: { cellWidth: 38 },
      3: { cellWidth: 47 }
    },
    margin: { left: 20, right: 20 }
  });

  // 7. Section 2: Warranty Coverage Details (Table)
  const currentY = ((doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : 120) + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('2. WARRANTY REGISTRATION SPECIFICATIONS', 20, currentY);

  const warrantySpecRows = [
    [
      { content: 'Warranty Certificate ID:', styles: { fontStyle: 'bold', textColor: [100, 116, 139] } },
      { content: warranty.warrantyNumber, styles: { fontStyle: 'bold', textColor: [15, 23, 42] } },
      { content: 'Registration Date:', styles: { fontStyle: 'bold', textColor: [100, 116, 139] } },
      { content: regDateFormatted, styles: { fontStyle: 'bold', textColor: [15, 23, 42] } }
    ],
    [
      { content: 'Battery Specification:', styles: { fontStyle: 'bold', textColor: [100, 116, 139] } },
      { content: warranty.batteryType || 'Original Replacement Battery', styles: { textColor: [15, 23, 42] } },
      { content: 'Warranty Expiry Date:', styles: { fontStyle: 'bold', textColor: [100, 116, 139] } },
      { content: expDateFormatted, styles: { fontStyle: 'bold', textColor: [220, 38, 38] } } // Red bold expiry
    ],
    [
      { content: 'Coverage Duration:', styles: { fontStyle: 'bold', textColor: [100, 116, 139] } },
      { content: periodLabel, styles: { fontStyle: 'bold', textColor: [21, 128, 61] } },
      { content: 'Claims Recorded:', styles: { fontStyle: 'bold', textColor: [100, 116, 139] } },
      { content: `${warranty.claimCount || 0} Claim(s)`, styles: { fontStyle: 'bold', textColor: [15, 23, 42] } }
    ]
  ];

  autoTable(doc, {
    startY: currentY + 4,
    body: warrantySpecRows as any,
    theme: 'plain',
    styles: {
      fontSize: 8.5,
      cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
      overflow: 'linebreak'
    },
    columnStyles: {
      0: { cellWidth: 38 },
      1: { cellWidth: 47 },
      2: { cellWidth: 38 },
      3: { cellWidth: 47 }
    },
    margin: { left: 20, right: 20 }
  });

  // 8. Section 3: Official Terms & Coverage Policy
  const termsY = ((doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : currentY + 40) + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('3. WARRANTY TERMS & CONDITIONS', 20, termsY);

  const termsText = [
    '1. Coverage Scope: This warranty covers battery performance degradation, charging failure, or premature capacity loss.',
    '2. Exclusions: Physical damage, water ingress, swollen battery, and unauthorized third-party repairs void the warranty.',
    '3. Service Claims: Please retain this warranty ID and repair number for any future service claims at MTS Lab.',
    '4. Verification: All claims undergo battery health and diagnostic testing by MTS Lab certified technicians before repair or battery replacement is approved.',
    '5. Validity: This warranty is valid strictly from the registration date until the stated expiry date. Pricing information is excluded from customer certificates.'
  ];

  doc.setFillColor(248, 250, 252); // Slate 50
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.roundedRect(20, termsY + 4, pageWidth - 40, 52, 2, 2, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(71, 85, 105); // Slate 600

  let currentLineY = termsY + 11;
  termsText.forEach((line) => {
    const splitLines = doc.splitTextToSize(line, pageWidth - 48);
    doc.text(splitLines, 25, currentLineY);
    currentLineY += (splitLines.length * 4.2) + 1.2;
  });

  // 9. Signatures & Verification Stamp Block
  const footerBlockY = pageHeight - 48;
  doc.setDrawColor(226, 232, 240);
  doc.line(20, footerBlockY, pageWidth - 20, footerBlockY);

  // Left: Customer Acknowledgement
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('CUSTOMER SIGNATURE', 30, footerBlockY + 22);
  doc.setDrawColor(148, 163, 184);
  doc.line(25, footerBlockY + 18, 75, footerBlockY + 18);

  // Right: MTS Authorized Lab Stamp & Seal
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('MTS LAB AUTHORIZED VERIFICATION', pageWidth - 75, footerBlockY + 22);
  doc.setDrawColor(15, 23, 42);
  doc.line(pageWidth - 85, footerBlockY + 18, pageWidth - 25, footerBlockY + 18);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Certified Smartphone Diagnostics & Restoration Hub', pageWidth - 80, footerBlockY + 26);

  // 10. Bottom Footer Note
  doc.setFillColor(15, 23, 42);
  doc.rect(0, pageHeight - 8, pageWidth, 8, 'F');
  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(`Official MTS Lab Warranty Certificate • Generated on ${format(new Date(), 'dd MMM yyyy, HH:mm')} • Document ID: ${warranty.warrantyNumber}`, pageWidth / 2, pageHeight - 3, { align: 'center' });

  return doc;
}

/**
 * Triggers instant download of the PDF certificate in browser
 */
export function downloadWarrantyCertificatePdf(warranty: BatteryWarrantyData): void {
  const doc = buildWarrantyCertificatePdf(warranty);
  const cleanName = (warranty.customerName || 'Customer').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `MTS_Warranty_Certificate_${warranty.warrantyNumber}_${cleanName}.pdf`;
  doc.save(filename);
}

/**
 * Returns a Blob for preview or email attachment
 */
export function getWarrantyCertificateBlob(warranty: BatteryWarrantyData): Blob {
  const doc = buildWarrantyCertificatePdf(warranty);
  return doc.output('blob');
}

/**
 * Returns a Data URL for in-app iframe/embed preview
 */
export function getWarrantyCertificateDataUrl(warranty: BatteryWarrantyData): string {
  const doc = buildWarrantyCertificatePdf(warranty);
  return doc.output('datauristring');
}

/**
 * Generates a formatted WhatsApp Web share URL
 */
export function getWarrantyWhatsAppShareUrl(warranty: BatteryWarrantyData): string {
  const digits = (warranty.customerPhone || '').replace(/\D/g, '');
  let waPhone = digits;
  if (digits.length === 10) {
    waPhone = `977${digits}`;
  } else if (digits.startsWith('977') && digits.length === 13) {
    waPhone = digits;
  } else if (digits.length > 0 && !digits.startsWith('977')) {
    waPhone = `977${digits}`;
  }

  const expFormatted = format(new Date(warranty.expiryDate), 'dd MMMM yyyy');
  const period = warranty.warrantyPeriod === '1_YEAR' ? '1 Year' : '6 Months';

  const message = `*MTS LAB — OFFICIAL BATTERY WARRANTY CERTIFICATE* 🛡️%0A%0A` +
    `Hello *${encodeURIComponent(warranty.customerName)}*,%0A%0A` +
    `Your battery replacement warranty has been successfully registered at *MTS Lab*.%0A%0A` +
    `📋 *Warranty ID:* ${encodeURIComponent(warranty.warrantyNumber)}%0A` +
    `🔧 *Job Number:* #${encodeURIComponent(warranty.repairNumber)}%0A` +
    `📱 *Device:* ${encodeURIComponent(warranty.deviceBrand.toUpperCase())} ${encodeURIComponent(warranty.deviceModel)}%0A` +
    `⏳ *Warranty Plan:* ${encodeURIComponent(period)}%0A` +
    `📅 *Valid Until:* ${encodeURIComponent(expFormatted)}%0A%0A` +
    `✅ *Status:* ACTIVE%0A%0A` +
    `_Thank you for choosing MTS Lab for your smartphone restoration!_%0A` +
    `MTS Lab • Mobile Technology Station%0A` +
    `📍 New Road, Kathmandu, Nepal • 📞 Ph/Tel: 986927668, 015364307`;

  return `https://wa.me/${waPhone}?text=${message}`;
}
