/**
 * MTS LAB — TIME & RELATIVE TIMESTAMP UTILITIES
 * 
 * Safely parses any date/time representation (Date, ISO string, epoch milliseconds,
 * epoch seconds, Firestore timestamp objects) and outputs clean, human-readable
 * relative and full formatted times without crashing or leaking memory.
 */

export function parseSafeDate(dateInput: any): Date | null {
  if (!dateInput) return null;

  try {
    if (dateInput instanceof Date) {
      return isNaN(dateInput.getTime()) ? null : dateInput;
    }

    // Firestore / Firebase timestamp object with toDate() method
    if (typeof dateInput === 'object' && typeof dateInput.toDate === 'function') {
      const d = dateInput.toDate();
      return isNaN(d.getTime()) ? null : d;
    }

    // Firestore serialized object with seconds / _seconds
    if (typeof dateInput === 'object') {
      const secs = dateInput.seconds ?? dateInput._seconds;
      if (typeof secs === 'number') {
        const nanos = dateInput.nanoseconds ?? dateInput._nanoseconds ?? 0;
        const millis = (secs * 1000) + Math.round(nanos / 1000000);
        const d = new Date(millis);
        return isNaN(d.getTime()) ? null : d;
      }
    }

    // Numeric timestamp
    if (typeof dateInput === 'number') {
      // If seconds instead of milliseconds (e.g. < 10000000000)
      const millis = dateInput < 10000000000 ? dateInput * 1000 : dateInput;
      const d = new Date(millis);
      return isNaN(d.getTime()) ? null : d;
    }

    // String (ISO or standard format)
    if (typeof dateInput === 'string') {
      const trimmed = dateInput.trim();
      if (!trimmed) return null;

      // Handle pure numeric strings
      if (/^\d+$/.test(trimmed)) {
        const num = parseInt(trimmed, 10);
        const millis = num < 10000000000 ? num * 1000 : num;
        const d = new Date(millis);
        return isNaN(d.getTime()) ? null : d;
      }

      const d = new Date(trimmed);
      return isNaN(d.getTime()) ? null : d;
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Formats a timestamp into an authoritative human-readable relative time string:
 * - "Just now"
 * - "5 minutes ago"
 * - "1 hour ago" / "2 hours ago"
 * - "1 day ago" / "3 days ago"
 */
export function formatTimeAgo(dateInput: any, referenceTime: number | Date = Date.now()): string {
  const date = parseSafeDate(dateInput);
  if (!date) return 'N/A';

  const refTime = referenceTime instanceof Date ? referenceTime.getTime() : Number(referenceTime || Date.now());
  const diffMs = refTime - date.getTime();

  // Future timestamp or less than 45 seconds ago
  if (diffMs < 45 * 1000) {
    return 'Just now';
  }

  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) {
    return diffMins === 1 ? '1 minute ago' : `${diffMins} minutes ago`;
  }

  if (diffHours < 24) {
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  }

  if (diffDays === 1) {
    return '1 day ago';
  }

  if (diffDays < 30) {
    return `${diffDays} days ago`;
  }

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) {
    return diffMonths === 1 ? '1 month ago' : `${diffMonths} months ago`;
  }

  const diffYears = Math.floor(diffDays / 365);
  return diffYears === 1 ? '1 year ago' : `${diffYears} years ago`;
}

/**
 * Compact relative time string for secondary timestamps (e.g. "Just now", "5m ago", "2h ago", "1d ago")
 */
export function formatShortTimeAgo(dateInput: any, referenceTime: number | Date = Date.now()): string {
  const date = parseSafeDate(dateInput);
  if (!date) return '';

  const refTime = referenceTime instanceof Date ? referenceTime.getTime() : Number(referenceTime || Date.now());
  const diffMs = refTime - date.getTime();

  if (diffMs < 45 * 1000) {
    return 'Just now';
  }

  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) {
    return `${diffMins}m ago`;
  }

  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  if (diffDays < 30) {
    return `${diffDays}d ago`;
  }

  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

/**
 * Formats date into standard "dd MMM yyyy, hh:mm a" format
 */
export function formatFullDateTime(dateInput: any): string {
  const date = parseSafeDate(dateInput);
  if (!date) return 'N/A';

  const day = String(date.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const strHours = String(hours).padStart(2, '0');

  return `${day} ${month} ${year}, ${strHours}:${minutes} ${ampm}`;
}
