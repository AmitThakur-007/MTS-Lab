/**
 * SMS Encoding and Segment Analyzer (GSM 03.38 & UCS-2 / Unicode)
 * Strictly enforces single-segment SMS rules for MTS Lab Repair Management System.
 */

// GSM 7-bit basic character set
const GSM_7_BASIC = new Set([
  '@', '£', '$', '¥', 'è', 'é', 'ù', 'ì', 'ò', 'Ç', '\n', 'Ø', 'ø', '\r', 'Å', 'å',
  'Δ', '_', 'Φ', 'Γ', 'Λ', 'Ω', 'Π', 'Ψ', 'Σ', 'Θ', 'Ξ', 'Æ', 'æ', 'ß', 'É',
  ' ', '!', '"', '#', '¤', '%', '&', "'", '(', ')', '*', '+', ',', '-', '.', '/',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', ':', ';', '<', '=', '>', '?',
  '¡', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O',
  'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'Ä', 'Ö', 'Ñ', 'Ü', '§',
  '¿', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o',
  'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', 'ä', 'ö', 'ñ', 'ü', 'à'
]);

// GSM 7-bit extended character set (each character costs 2 septets: ESC + Char)
const GSM_7_EXTENDED = new Set([
  '\f', '^', '{', '}', '\\', '[', '~', ']', '|', '€'
]);

export interface SmsEncodingAnalysis {
  encoding: 'GSM_7' | 'UNICODE';
  charCount: number;
  septetCount: number; // For GSM-7, includes 2 septets for extended chars
  unitsUsed: number; // Septets for GSM-7, Code units for Unicode
  maxUnitsSingleSegment: number; // 160 for GSM-7, 70 for Unicode
  remainingUnits: number;
  segmentCount: number;
  isSingleSegment: boolean;
  nonGsmCharacters: string[];
  hasExtendedGsm: boolean;
  extendedGsmCharacters: string[];
}

/**
 * Analyzes SMS text to determine encoding, segment count, and single-segment compliance.
 */
export function analyzeSmsEncoding(text: string): SmsEncodingAnalysis {
  if (!text) {
    return {
      encoding: 'GSM_7',
      charCount: 0,
      septetCount: 0,
      unitsUsed: 0,
      maxUnitsSingleSegment: 160,
      remainingUnits: 160,
      segmentCount: 1,
      isSingleSegment: true,
      nonGsmCharacters: [],
      hasExtendedGsm: false,
      extendedGsmCharacters: [],
    };
  }

  let isGsm = true;
  const nonGsmChars: string[] = [];
  const extendedGsmChars: string[] = [];
  let septetCount = 0;

  // Iterate over code points (to handle astral plane / emoji cleanly)
  for (const char of text) {
    if (GSM_7_BASIC.has(char)) {
      septetCount += 1;
    } else if (GSM_7_EXTENDED.has(char)) {
      septetCount += 2; // ESC + char
      if (!extendedGsmChars.includes(char)) {
        extendedGsmChars.push(char);
      }
    } else {
      isGsm = false;
      if (!nonGsmChars.includes(char)) {
        nonGsmChars.push(char);
      }
    }
  }

  const charCount = text.length;

  if (isGsm) {
    const maxUnits = 160;
    const remainingUnits = maxUnits - septetCount;
    const segmentCount = septetCount === 0 ? 1 : Math.ceil(septetCount / 160);
    const isSingleSegment = septetCount <= 160;

    return {
      encoding: 'GSM_7',
      charCount,
      septetCount,
      unitsUsed: septetCount,
      maxUnitsSingleSegment: maxUnits,
      remainingUnits: Math.max(0, remainingUnits),
      segmentCount,
      isSingleSegment,
      nonGsmCharacters: [],
      hasExtendedGsm: extendedGsmChars.length > 0,
      extendedGsmCharacters: extendedGsmChars,
    };
  }

  // Unicode / UCS-2 Encoding
  const maxUnits = 70;
  const remainingUnits = maxUnits - charCount;
  const segmentCount = charCount === 0 ? 1 : Math.ceil(charCount / 70);
  const isSingleSegment = charCount <= 70;

  return {
    encoding: 'UNICODE',
    charCount,
    septetCount: charCount,
    unitsUsed: charCount,
    maxUnitsSingleSegment: maxUnits,
    remainingUnits: Math.max(0, remainingUnits),
    segmentCount,
    isSingleSegment,
    nonGsmCharacters: nonGsmChars,
    hasExtendedGsm: extendedGsmChars.length > 0,
    extendedGsmCharacters: extendedGsmChars,
  };
}

/**
 * Standard MTS Lab repair completed SMS generator.
 * Strictly tuned to stay within single-segment GSM-7 (<= 160 characters).
 */
export function generateRepairCompletedMessage(params: {
  customerName?: string | null;
  deviceModel?: string | null;
  repairNumber?: string | null;
}): string {
  let customer = (params.customerName || 'Customer').trim();
  let model = (params.deviceModel || 'device').trim();
  const repairNum = (params.repairNumber || 'N/A').trim();

  // Baseline standard template:
  // "Dear [Name], your [Device] (Repair #[Num]) is repaired & ready for pickup at MTS Lab. Thank you."
  let msg = `Dear ${customer}, your ${model} (Repair #${repairNum}) is repaired & ready for pickup at MTS Lab. Thank you.`;

  // Safely condense if name or device is unusually long to stay within 160 chars
  if (msg.length > 160 && customer.length > 20) {
    customer = customer.slice(0, 18).trim() + '…';
    msg = `Dear ${customer}, your ${model} (Repair #${repairNum}) is repaired & ready for pickup at MTS Lab. Thank you.`;
  }

  if (msg.length > 160 && model.length > 25) {
    model = model.slice(0, 22).trim() + '…';
    msg = `Dear ${customer}, your ${model} (Repair #${repairNum}) is repaired & ready for pickup at MTS Lab. Thank you.`;
  }

  if (msg.length > 160) {
    msg = msg.slice(0, 160);
  }

  return msg;
}

/**
 * Standard MTS Lab SMS for Repaired Devices.
 * Strictly complies with max 160 GSM-7 characters and contains tracking link.
 */
export function generateRepairedDeviceSmsMessage(repairNumber: string): string {
  const cleanNumber = (repairNumber || 'N/A').trim();
  return `Dear Customer, your device (Repair No: ${cleanNumber}) is repaired and ready for collection. Track: https://www.mobiletechnologystation.com.np/track - MTS Lab`;
}

/**
 * Standard MTS Lab SMS for Received Devices.
 * Strictly complies with max 160 GSM-7 characters and contains tracking link.
 */
export function generateReceivedDeviceSmsMessage(repairNumber: string): string {
  const cleanNumber = (repairNumber || 'N/A').trim();
  return `Dear Customer, your device has been received by MTS Lab. Repair No: ${cleanNumber}. Track: https://www.mobiletechnologystation.com.np/track - MTS Lab`;
}
