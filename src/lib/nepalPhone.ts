/**
 * Nepal Mobile Phone Validator and Normalizer
 * Mobile prefixes in Nepal: 98, 97, 96 (NTC, Ncell, SmartCell)
 */

export interface NepalPhoneValidationResult {
  isValid: boolean;
  raw: string;
  normalized: string; // 10 digits, e.g. "9812345678"
  international: string; // "+9779812345678"
  whatsappPhone: string; // "9779812345678"
  displayFormatted: string; // "+977 9812-345678"
  error?: string;
}

export function validateAndFormatNepalPhone(rawPhone: string | null | undefined): NepalPhoneValidationResult {
  const raw = String(rawPhone || '').trim();
  if (!raw) {
    return {
      isValid: false,
      raw: '',
      normalized: '',
      international: '',
      whatsappPhone: '',
      displayFormatted: '',
      error: 'Customer phone number is missing. Please update customer information before sending notification.',
    };
  }

  let cleaned = raw.replace(/\D/g, '');

  // Strip country code 977 if present
  if (cleaned.startsWith('977') && cleaned.length >= 12) {
    cleaned = cleaned.substring(3);
  }

  // Strip leading 0 if entered with trunk prefix (e.g. 098XXXXXXXX)
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = cleaned.substring(1);
  }

  // Must be 10 digits starting with 98, 97, or 96
  const nepalMobileRegex = /^9[678]\d{8}$/;

  if (!nepalMobileRegex.test(cleaned)) {
    return {
      isValid: false,
      raw,
      normalized: cleaned,
      international: '',
      whatsappPhone: '',
      displayFormatted: raw,
      error: 'Invalid Nepal mobile number. Must be a 10-digit number starting with 98, 97, or 96.',
    };
  }

  return {
    isValid: true,
    raw,
    normalized: cleaned,
    international: `+977${cleaned}`,
    whatsappPhone: `977${cleaned}`,
    displayFormatted: `+977 ${cleaned.slice(0, 4)}-${cleaned.slice(4)}`,
  };
}
