/**
 * MTS LAB — Authoritative Operating Hours & Business Schedule
 * Central source of truth for business hours across all public pages,
 * components, and SEO Schema.org specifications.
 */

export const OPERATING_HOURS = {
  title: 'Operating Hours',
  regularDays: 'Sun–Fri',
  openTime: '10:20 AM',
  closeTime: '6:30 PM',
  regularSchedule: 'Sun–Fri • 10:20 AM – 6:30 PM',
  saturdayInstruction: 'Saturday: Call Us',
  saturdayDayLabel: 'Saturday',
  saturdayActionLabel: 'Call Us',
  phone: '+977-9869276668',
  phoneTel: 'tel:+9779869276668',
  phoneRaw: '9869276668',
  timeZone: 'Asia/Kathmandu (UTC+5:45)',
  schema: {
    daysOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    opens: '10:20',
    closes: '18:30',
    openingHoursArray: ['Su-Fr 10:20-18:30'],
  },
} as const;

/**
 * Checks whether MTS Lab is currently open based on current Nepal Time (UTC+5:45).
 * - Sunday through Friday: 10:20 AM (620 mins) to 6:30 PM (1110 mins)
 * - Saturday: On-call ("Saturday: Call Us")
 */
export function getMtsLabOpenStatus(): {
  isOpen: boolean;
  isSaturday: boolean;
  statusLabel: string;
  detail: string;
} {
  try {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const nepalTime = new Date(utc + 5.75 * 3600000);
    const day = nepalTime.getDay(); // 0 = Sunday, 6 = Saturday
    const hour = nepalTime.getHours();
    const minute = nepalTime.getMinutes();
    const timeInMinutes = hour * 60 + minute;

    if (day === 6) {
      return {
        isOpen: false,
        isSaturday: true,
        statusLabel: 'Saturday: Call Us',
        detail: 'On-call intake & scheduled deliveries',
      };
    }

    // Sunday (0) to Friday (5): 10:20 AM (620) to 6:30 PM (1110)
    const isWithinHours = timeInMinutes >= 620 && timeInMinutes <= 1110;
    return {
      isOpen: isWithinHours,
      isSaturday: false,
      statusLabel: isWithinHours ? 'Open Now' : 'Closed Now',
      detail: isWithinHours
        ? `Open until ${OPERATING_HOURS.closeTime}`
        : `Opens at ${OPERATING_HOURS.openTime} (${OPERATING_HOURS.regularDays})`,
    };
  } catch {
    return {
      isOpen: true,
      isSaturday: false,
      statusLabel: 'Open',
      detail: OPERATING_HOURS.regularSchedule,
    };
  }
}
