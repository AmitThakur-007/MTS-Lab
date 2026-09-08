
/**
 * Formats a number into Nepalese Rupee (NPR) format
 * @param amount Number to format
 * @returns Formatted string (e.g., Rs. 5,000)
 */
export const formatNPR = (amount: number | string) => {
  const value = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(value)) return 'Rs. 0';
  
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'NPR',
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 0,
  }).format(value).replace('NPR', 'Rs.');
};

/**
 * Safely formats a repair cost.
 * If the cost is blank (null, undefined, empty string, or NaN), returns the provided placeholder.
 * If valid number, returns formatted string (e.g. "Rs. 2,500").
 */
export const formatRepairCost = (amount?: number | string | null, placeholder: string = '—'): string => {
  if (amount === null || amount === undefined || amount === '') return placeholder;
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num) || !isFinite(num)) return placeholder;
  
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'NPR',
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 0,
  }).format(num).replace('NPR', 'Rs.');
};

/**
 * Validates and formats a Nepalese phone number
 * @param phone Phone number string
 * @returns Formatted phone number (+977-98XXXXXXXX)
 */
export const formatNepalPhone = (phone: string) => {
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '');
  
  // If starts with 977, take the next 10 digits as the core number
  if (cleaned.startsWith('977')) {
    return cleaned.substring(3, 13);
  }
  
  // If starts with 9 and is likely a mobile number, return 10 digits
  if (cleaned.startsWith('9')) {
    return cleaned.substring(0, 10);
  }
 
  // Otherwise just return digits (limited)
  return cleaned.substring(0, 10);
};
 
 export const isValidNepalPhone = (phone: string) => {
   // Validate 10 digit Nepal mobile format (starts with 98, 97, 96)
   const regex = /^9[678]\d{8}$/;
   return regex.test(phone);
 };
