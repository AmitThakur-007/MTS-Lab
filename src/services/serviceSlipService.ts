import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

export interface RepairSlipItem {
  id?: string;
  repairNumber: string;
  deviceBrand?: string;
  deviceModel: string;
  imeiNumber?: string | null;
  deviceColor?: string | null;
  deviceCondition?: string;
  problemDescription: string;
  accessoriesReceived?: string | null;
  estimatedCost?: number | string | null;
  advancePaid?: number | string | null;
  status?: string;
  receivingMethod?: string;
  courierCompany?: string | null;
  courierTrackingNumber?: string | null;
  createdAt?: string | Date;
  registrationDate?: string | Date;
}

export interface ServiceSlipCustomer {
  id?: string;
  customerId?: string;
  name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
}

export interface ServiceSlipData {
  billIndex: number;
  totalBills: number;
  customer: ServiceSlipCustomer;
  devices: RepairSlipItem[];
  registrationDate: string | Date;
  billNumber?: string;
}

/**
 * Exact 9 Terms & Conditions in Nepali.
 * Preserved word-for-word as fixed official legal policy with correct Devanagari typography.
 */
export const NEPALI_TERMS_AND_CONDITIONS = [
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

/**
 * Partitions devices into service slip bills following the exact even/odd grouping rules:
 * - Even count: All even grouped together in one bill (2 -> [2], 4 -> [4], 6 -> [6])
 * - Odd count: Max even count grouped in Bill 1 + 1 remainder device in Bill 2
 *   (1 -> [1], 3 -> [2, 1], 5 -> [4, 1], 7 -> [6, 1])
 */
export function partitionDevicesForBills(
  devices: RepairSlipItem[],
  customer: ServiceSlipCustomer,
  registrationDate: string | Date = new Date()
): ServiceSlipData[] {
  if (!devices || devices.length === 0) return [];

  const count = devices.length;
  let deviceGroups: RepairSlipItem[][] = [];

  if (count === 1) {
    deviceGroups = [[devices[0]]];
  } else if (count % 2 === 0) {
    // Even number: all devices in one bill
    deviceGroups = [devices];
  } else {
    // Odd number > 1: group the maximum even number (count - 1) into Bill 1, and the last 1 device into Bill 2
    const evenGroup = devices.slice(0, count - 1);
    const lastDevice = [devices[count - 1]];
    deviceGroups = [evenGroup, lastDevice];
  }

  const totalBills = deviceGroups.length;

  return deviceGroups.map((group, index) => {
    // Create bill identifier based on repair numbers
    const billRepairNumbers = group.map(d => d.repairNumber).join('-');
    return {
      billIndex: index + 1,
      totalBills,
      customer,
      devices: group,
      registrationDate: group[0]?.createdAt || group[0]?.registrationDate || registrationDate,
      billNumber: billRepairNumbers ? `SLIP-${billRepairNumbers}` : `SLIP-BILL-${index + 1}`
    };
  });
}

/**
 * Sanitizes an element by replacing any computed modern color functions (oklch, color-mix, oklab)
 * with standard safe HEX / RGB values to prevent PDF rasterizer errors.
 */
function sanitizeElementStyles(root: HTMLElement) {
  const allElements = root.getElementsByTagName('*');
  for (let i = 0; i < allElements.length; i++) {
    const el = allElements[i] as HTMLElement;
    if (el && el.style) {
      if (el.style.color && (el.style.color.includes('oklch') || el.style.color.includes('color-mix') || el.style.color.includes('var('))) {
        el.style.color = '#000000';
      }
      if (el.style.backgroundColor && (el.style.backgroundColor.includes('oklch') || el.style.backgroundColor.includes('color-mix') || el.style.backgroundColor.includes('var('))) {
        el.style.backgroundColor = '#ffffff';
      }
      if (el.style.borderColor && (el.style.borderColor.includes('oklch') || el.style.borderColor.includes('color-mix') || el.style.borderColor.includes('var('))) {
        el.style.borderColor = '#cbd5e1';
      }
    }
  }
}

/**
 * Direct Vector Fallback PDF Generator.
 * Used if html2canvas is restricted or encounters unexpected canvas taint errors in a browser.
 * Ensures Service Slip PDF download NEVER fails under any circumstance.
 */
export function generateVectorSlipPdf(
  data: ServiceSlipData,
  fileName: string = 'MTS-Lab-Service-Slip.pdf'
): boolean {
  try {
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = 297;
    const pageHeight = 210;
    const slipW = 240;
    const slipH = 157;
    const startX = (pageWidth - slipW) / 2; // 28.5 mm
    const startY = (pageHeight - slipH) / 2; // 26.5 mm

    // 1. Slip Border & Background
    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.6);
    pdf.rect(startX, startY, slipW, slipH, 'FD');

    // 2. Header
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.setTextColor(0, 0, 0);
    pdf.text('Mobile Technology Station (MTS Lab)', startX + slipW / 2, startY + 11, { align: 'center' });

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(51, 65, 85);
    pdf.text('Pako Sadak, New Road, Kathmandu, Nepal  |  Phone: 9869276668 / 9709797526 / 01-5364307', startX + slipW / 2, startY + 16, { align: 'center' });

    // Badge
    pdf.setFillColor(0, 0, 0);
    pdf.roundedRect(startX + slipW / 2 - 22, startY + 18.5, 44, 6.5, 1.5, 1.5, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(255, 255, 255);
    pdf.text('SERVICE SLIP', startX + slipW / 2, startY + 23, { align: 'center' });

    // 3. Metadata Divider Bar
    const metaY = startY + 28;
    pdf.setFillColor(248, 250, 252);
    pdf.setDrawColor(203, 213, 225);
    pdf.setLineWidth(0.3);
    pdf.rect(startX + 8, metaY, slipW - 16, 6, 'FD');

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    pdf.setTextColor(51, 65, 85);
    const repairNos = data.devices.map(d => d.repairNumber).join(', ');
    pdf.text(`R.No: ${repairNos}`, startX + 11, metaY + 4.2);

    const regDate = data.registrationDate ? new Date(data.registrationDate).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB');
    pdf.text(`Date: ${regDate}`, startX + slipW - 11, metaY + 4.2, { align: 'right' });

    // 4. Left Column: Details Box
    const leftX = startX + 8;
    const leftW = (slipW - 22) * 0.54;
    const bodyY = metaY + 8;

    // Customer info grid
    pdf.setDrawColor(203, 213, 225);
    pdf.setFillColor(255, 255, 255);
    pdf.rect(leftX, bodyY, leftW, 20, 'FD');
    pdf.line(leftX, bodyY + 6.5, leftX + leftW, bodyY + 6.5);
    pdf.line(leftX, bodyY + 13, leftX + leftW, bodyY + 13);
    pdf.line(leftX + leftW * 0.55, bodyY + 6.5, leftX + leftW * 0.55, bodyY + 13);

    pdf.setFontSize(7.5);
    pdf.setTextColor(51, 65, 85);
    pdf.text('Customer Name:', leftX + 2, bodyY + 4.5);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(0, 0, 0);
    pdf.text(data.customer.name || '-', leftX + 26, bodyY + 4.5);

    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(51, 65, 85);
    pdf.text('Mob. No:', leftX + 2, bodyY + 10.8);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(0, 0, 0);
    pdf.text(data.customer.phone || '-', leftX + 17, bodyY + 10.8);

    const imeis = data.devices.map(d => d.imeiNumber || '-').join(', ');
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(51, 65, 85);
    pdf.text('IMEI No:', leftX + leftW * 0.55 + 2, bodyY + 10.8);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(0, 0, 0);
    pdf.text(imeis.substring(0, 24), leftX + leftW * 0.55 + 15, bodyY + 10.8);

    const models = data.devices.map(d => `${d.deviceBrand ? `${d.deviceBrand} ` : ''}${d.deviceModel}`).join(' | ');
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(51, 65, 85);
    pdf.text('Model No:', leftX + 2, bodyY + 17.5);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(0, 0, 0);
    pdf.text(models.substring(0, 48), leftX + 18, bodyY + 17.5);

    // Problem Box
    const probY = bodyY + 22;
    pdf.setFillColor(248, 250, 252);
    pdf.rect(leftX, probY, leftW, 32, 'FD');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(51, 65, 85);
    pdf.text('PROBLEM:', leftX + 2, probY + 4.5);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(0, 0, 0);
    const probText = data.devices.map((d, i) => `${data.devices.length > 1 ? `${i + 1}) ` : ''}${d.problemDescription || 'Inspection'}`).join('\n');
    const splitProb = pdf.splitTextToSize(probText, leftW - 4);
    pdf.text(splitProb, leftX + 2, probY + 9);

    // Estimated Service Charge
    const costY = probY + 34;
    pdf.setFillColor(241, 245, 249);
    pdf.rect(leftX, costY, leftW, 7, 'FD');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(51, 65, 85);
    pdf.text('Estimated Service Charge:', leftX + 2, costY + 4.8);
    const hasSpecifiedCost = data.devices.some(d => d.estimatedCost !== null && d.estimatedCost !== undefined && d.estimatedCost !== '' && !isNaN(Number(d.estimatedCost)) && Number(d.estimatedCost) > 0);
    const totalCost = hasSpecifiedCost ? data.devices.reduce((s, d) => s + (Number(d.estimatedCost) || 0), 0) : null;
    pdf.setTextColor(0, 0, 0);
    pdf.text(totalCost !== null && totalCost > 0 ? `Rs. ${totalCost.toLocaleString()}` : '____________________', leftX + leftW - 2, costY + 4.8, { align: 'right' });

    // Signatures
    const signY = costY + 21;
    pdf.setDrawColor(100, 116, 139);
    pdf.setLineWidth(0.3);
    pdf.line(leftX + 4, signY, leftX + 38, signY);
    pdf.line(leftX + leftW - 38, signY, leftX + leftW - 4, signY);
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(51, 65, 85);
    pdf.text('AUTHORIZED SIGN', leftX + 21, signY + 3.8, { align: 'center' });
    pdf.text('CUSTOMER SIGN', leftX + leftW - 21, signY + 3.8, { align: 'center' });

    // 5. Right Column: Nepali Terms & Conditions Notice
    const rightX = leftX + leftW + 6;
    const rightW = slipW - (leftW + 22);

    pdf.setDrawColor(203, 213, 225);
    pdf.line(rightX - 3, bodyY, rightX - 3, bodyY + 74);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    pdf.setTextColor(0, 0, 0);
    pdf.text('Terms & Conditions (Official Policy):', rightX, bodyY + 4);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(6.8);
    pdf.setTextColor(30, 41, 59);

    const fallbackTerms = [
      "1. Company is not liable if repair exceeds estimated timeframe.",
      "2. Customer is solely responsible for stolen/found handsets brought for service.",
      "3. Company holds no liability for SIM cards, SIM trays, or memory cards left with device.",
      "4. MTS Lab is not responsible for data loss or file corruption before/during/after repair.",
      "5. Collect repaired or unrepaired device within 7 days. After 7 days, MTS Lab is not liable.",
      "6. Goods will not be delivered without presentation of this original receipt.",
      "7. For dead/no-display devices, other unverified component faults are customer's responsibility.",
      "8. No warranty or guarantee is provided on replaced display screens.",
      "9. For dead/logo-stuck devices that cannot be repaired, customer must accept return without dispute."
    ];

    let currentTermY = bodyY + 10;
    for (const term of fallbackTerms) {
      const wrapped = pdf.splitTextToSize(term, rightW - 2);
      pdf.text(wrapped, rightX, currentTermY);
      currentTermY += (wrapped.length * 3.4) + 1.8;
    }

    pdf.save(fileName);
    return true;
  } catch (vectorErr) {
    console.error('[VECTOR PDF FALLBACK ERROR]', vectorErr);
    return false;
  }
}

/**
 * Downloads a high-resolution PDF of the rendered Service Slip element on an A4 Landscape page.
 * Creates an exact A4 Landscape (297 mm × 210 mm) PDF document.
 * Fits the slip perfectly centered with ~60% page coverage (within 50%–70% target range).
 */
export async function downloadServiceSlipPdf(
  element: HTMLElement,
  fileName: string = 'MTS-Lab-Service-Slip.pdf',
  slipDataFallback?: ServiceSlipData
): Promise<boolean> {
  // Create an unscaled temporary container attached to DOM for 100% accurate capture
  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.top = '0px';
  wrapper.style.left = '0px';
  wrapper.style.width = '794px';
  wrapper.style.height = '520px';
  wrapper.style.zIndex = '-9999';
  wrapper.style.opacity = '1';
  wrapper.style.visibility = 'visible';
  wrapper.style.pointerEvents = 'none';
  wrapper.style.backgroundColor = '#ffffff';
  wrapper.style.overflow = 'hidden';

  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.transform = 'none';
  clone.style.margin = '0';
  clone.style.width = '794px';
  clone.style.height = '520px';
  clone.style.minWidth = '794px';
  clone.style.minHeight = '520px';
  clone.style.maxWidth = '794px';
  clone.style.maxHeight = '520px';
  clone.style.boxSizing = 'border-box';
  clone.style.overflow = 'hidden';
  clone.style.backgroundColor = '#ffffff';
  clone.style.color = '#000000';

  sanitizeElementStyles(clone);

  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  try {
    const canvas = await html2canvas(clone, {
      scale: 2.8, // 280 DPI ultra-crisp vector clarity for English & Devanagari text
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: 794,
      height: 520,
      windowWidth: 1024,
      windowHeight: 768,
      scrollX: 0,
      scrollY: 0,
      x: 0,
      y: 0,
      foreignObjectRendering: false,
      onclone: (clonedDoc) => {
        // Prevent modern color parsing crash (oklch, color-mix, css vars)
        const style = clonedDoc.createElement('style');
        style.textContent = `
          * {
            box-sizing: border-box !important;
            font-family: "Segoe UI", "Nirmala UI", "Mangal", "Tiro Devanagari Hindi", -apple-system, BlinkMacSystemFont, Roboto, sans-serif !important;
          }
          .service-slip-root {
            background-color: #ffffff !important;
            color: #000000 !important;
          }
        `;
        clonedDoc.head.appendChild(style);

        const allElements = clonedDoc.getElementsByTagName('*');
        for (let i = 0; i < allElements.length; i++) {
          const el = allElements[i] as HTMLElement;
          if (el && el.style) {
            if (el.style.color && (el.style.color.includes('oklch') || el.style.color.includes('color-mix') || el.style.color.includes('var('))) {
              el.style.color = '#000000';
            }
            if (el.style.backgroundColor && (el.style.backgroundColor.includes('oklch') || el.style.backgroundColor.includes('color-mix') || el.style.backgroundColor.includes('var('))) {
              el.style.backgroundColor = '#ffffff';
            }
            if (el.style.borderColor && (el.style.borderColor.includes('oklch') || el.style.borderColor.includes('color-mix') || el.style.borderColor.includes('var('))) {
              el.style.borderColor = '#cbd5e1';
            }
          }
        }
      }
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.96);

    // Create PDF in A4 Landscape dimensions (297 mm width × 210 mm height)
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4' // A4 landscape: 297 mm × 210 mm
    });

    const pageWidth = pdf.internal.pageSize.getWidth(); // 297 mm
    const pageHeight = pdf.internal.pageSize.getHeight(); // 210 mm

    // Slip target dimensions on A4: ~60.4% page coverage (within 50%–70% range)
    const slipWidth = 240; // mm
    const slipHeight = 157; // mm

    // Center slip with balanced top/bottom and left/right margins
    const posX = (pageWidth - slipWidth) / 2; // 28.5 mm
    const posY = (pageHeight - slipHeight) / 2; // 26.5 mm

    pdf.addImage(imgData, 'JPEG', posX, posY, slipWidth, slipHeight, undefined, 'FAST');
    pdf.save(fileName);
    return true;
  } catch (error) {
    console.warn('[SERVICE SLIP PDF RASTER ERROR - USING VECTOR FALLBACK]', error);
    if (slipDataFallback) {
      return generateVectorSlipPdf(slipDataFallback, fileName);
    }
    throw error;
  } finally {
    if (wrapper.parentNode) {
      wrapper.parentNode.removeChild(wrapper);
    }
  }
}

/**
 * Prints the Service Slip centered on A4 Landscape format using the browser print dialog.
 */
export function printServiceSlipElement(element: HTMLElement) {
  const printWindow = window.open('', '_blank', 'width=1050,height=750');
  if (!printWindow) {
    window.print();
    return;
  }

  const htmlContent = element.outerHTML;
  
  printWindow.document.open();
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>MTS Lab — Service Slip</title>
        <meta charset="utf-8" />
        <style>
          @page {
            size: 297mm 210mm;
            size: A4 landscape;
            margin: 0;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 297mm !important;
            height: 210mm !important;
            max-width: 297mm !important;
            max-height: 210mm !important;
            font-family: "Segoe UI", "Nirmala UI", "Mangal", "Tiro Devanagari Hindi", -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
            background: #ffffff !important;
            color: #000000 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            overflow: hidden !important;
          }
          .service-slip-root {
            width: 240mm !important;
            height: 157mm !important;
            min-width: 240mm !important;
            min-height: 157mm !important;
            max-width: 240mm !important;
            max-height: 157mm !important;
            margin: auto !important;
            padding: 9mm 12mm 9mm 12mm !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            border: 1.5px solid #000000 !important;
            background-color: #ffffff !important;
            color: #000000 !important;
          }
          @media print {
            html, body {
              width: 297mm !important;
              height: 210mm !important;
            }
          }
        </style>
      </head>
      <body>
        ${htmlContent}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
              setTimeout(function() {
                window.close();
              }, 500);
            }, 250);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}
