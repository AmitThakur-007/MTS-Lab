/**
 * Smart Form Validation utilities for MTS LAB
 * Tailored for Nepali telecommunications and smartphone repair workflows.
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates Nepali mobile and landline numbers:
 * - Mobile: 10 digits starting with 98 or 97 (NTC, Ncell, SmartCell)
 * - Supported prefixes: +977-, +977, 977-, or bare 10-digit 98XXXXXXXX / 97XXXXXXXX
 * - Landline: 8-9 digits e.g., 01-XXXXXXX, 014XXXXXX
 */
export function validateNepalPhone(phone: string): ValidationResult {
  if (!phone || typeof phone !== 'string') {
    return { isValid: false, error: 'Phone number is required.' };
  }

  const clean = phone.trim().replace(/[\s-]/g, '');

  if (!clean) {
    return { isValid: false, error: 'Phone number cannot be empty.' };
  }

  // Handle +977 or 977 prefix
  let normalized = clean;
  if (normalized.startsWith('+977')) {
    normalized = normalized.slice(4);
  } else if (normalized.startsWith('977') && normalized.length > 10) {
    normalized = normalized.slice(3);
  }

  // Nepali Mobile: 10 digits starting with 98, 97, 96, 99
  const mobileRegex = /^(98|97|96)\d{8}$/;
  if (mobileRegex.test(normalized)) {
    return { isValid: true };
  }

  // Nepali Landline: 8 or 9 digits, typically starting with 01 (Kathmandu valley) or regional area codes
  const landlineRegex = /^0\d{7,8}$/;
  if (landlineRegex.test(normalized)) {
    return { isValid: true };
  }

  return {
    isValid: false,
    error: 'Enter a valid Nepali phone number (e.g., 9841234567 or +977-9801234567).',
  };
}

/**
 * Formats a raw phone string into standard readable format:
 * e.g., 9841234567 -> 9841-234-567
 */
export function formatNepalPhone(phone: string): string {
  if (!phone) return '';
  const clean = phone.trim().replace(/[^\d+]/g, '');
  if (clean.length === 10 && clean.startsWith('9')) {
    return `${clean.slice(0, 4)}-${clean.slice(4, 7)}-${clean.slice(7)}`;
  }
  return clean;
}

/**
 * Standard RFC-compliant Email Validation
 */
export function validateEmail(email: string, required: boolean = true): ValidationResult {
  if (!email || !email.trim()) {
    if (!required) return { isValid: true };
    return { isValid: false, error: 'Email address is required.' };
  }

  const trimmed = email.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return { isValid: false, error: 'Please enter a valid email address.' };
  }

  return { isValid: true };
}

/**
 * Validates Price / Currency values (positive numeric amount)
 */
export function validatePrice(price: number | string, fieldName = 'Price'): ValidationResult {
  if (price === '' || price === null || price === undefined) {
    return { isValid: false, error: `${fieldName} is required.` };
  }

  const num = typeof price === 'number' ? price : parseFloat(price);
  if (isNaN(num)) {
    return { isValid: false, error: `${fieldName} must be a valid number.` };
  }

  if (num < 0) {
    return { isValid: false, error: `${fieldName} cannot be negative.` };
  }

  if (num > 10000000) {
    return { isValid: false, error: `${fieldName} exceeds maximum allowable threshold.` };
  }

  return { isValid: true };
}

/**
 * Validates Device IMEI (15 digits) or Serial Number
 */
export function validateImeiOrSerial(value: string, required: boolean = false): ValidationResult {
  if (!value || !value.trim()) {
    if (!required) return { isValid: true };
    return { isValid: false, error: 'IMEI or Serial Number is required.' };
  }

  const clean = value.trim();
  if (clean.length < 4) {
    return { isValid: false, error: 'Identifier must be at least 4 characters long.' };
  }

  // If numeric 15-digits, check IMEI format
  if (/^\d{15}$/.test(clean)) {
    return { isValid: true };
  }

  // Alphanumeric serial format
  if (/^[A-Za-z0-9_-]{4,30}$/.test(clean)) {
    return { isValid: true };
  }

  return { isValid: false, error: 'Enter a valid 15-digit IMEI or alphanumeric serial number.' };
}

/**
 * Validates Date Range (Start Date must be before or equal to End Date)
 */
export function validateDateRange(startDate?: Date | string | null, endDate?: Date | string | null): ValidationResult {
  if (!startDate || !endDate) {
    return { isValid: true };
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { isValid: false, error: 'Invalid date format selected.' };
  }

  if (start > end) {
    return { isValid: false, error: 'Start date cannot be after end date.' };
  }

  return { isValid: true };
}

/**
 * Required field validator helper
 */
export function validateRequired(value: any, fieldName: string): ValidationResult {
  if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) {
    return { isValid: false, error: `${fieldName} is required.` };
  }
  return { isValid: true };
}
