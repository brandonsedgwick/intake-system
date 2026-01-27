import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;

  return formatDate(date);
}

export function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let addedDays = 0;

  while (addedDays < days) {
    result.setDate(result.getDate() + 1);
    // Skip weekends (0 = Sunday, 6 = Saturday)
    if (result.getDay() !== 0 && result.getDay() !== 6) {
      addedDays++;
    }
  }

  return result;
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "...";
}

// Day name to JavaScript day index (0 = Sunday, 1 = Monday, etc.)
const DAY_NAME_TO_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

/**
 * Convert day name to day index (0 = Sunday, 1 = Monday, etc.)
 */
export function dayNameToIndex(dayName: string): number {
  const index = DAY_NAME_TO_INDEX[dayName.toLowerCase()];
  if (index === undefined) {
    throw new Error(`Invalid day name: ${dayName}`);
  }
  return index;
}

/**
 * Format date as ISO string (YYYY-MM-DD)
 */
export function formatDateISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculate the earliest possible start date for an appointment on a specific day.
 *
 * Logic:
 * 1. Add leadDays to fromDate to get the earliest possible date
 * 2. Find the next occurrence of the target appointment day on or after that date
 *
 * Example: If today is Monday Jan 26 and leadDays is 3:
 * - Earliest date = Thursday Jan 29
 * - For Wednesday appointments: Thursday > Wednesday, so next Wednesday is Feb 4
 * - For Friday appointments: Thursday < Friday, so this Friday Jan 31 works
 *
 * @param appointmentDay - Day name ("Monday", "Tuesday", etc.)
 * @param leadDays - Number of days to add for lead time (default 3)
 * @param fromDate - Date to calculate from (default: today)
 * @param additionalWeeks - Extra weeks to add beyond the calculated minimum (default 0)
 * @returns ISO date string (YYYY-MM-DD) of the earliest start date
 */
export function calculateEarliestStartDate(
  appointmentDay: string,
  leadDays: number = 3,
  fromDate: Date = new Date(),
  additionalWeeks: number = 0
): string {
  // Get target day index
  const targetDayIndex = dayNameToIndex(appointmentDay);

  // Calculate earliest possible date after lead time
  const earliestDate = new Date(fromDate);
  earliestDate.setDate(earliestDate.getDate() + leadDays);

  // Get day of week for earliest date
  const earliestDayIndex = earliestDate.getDay();

  // Calculate days until target day
  let daysUntilTarget = targetDayIndex - earliestDayIndex;

  // If target day is before or same as earliest day, go to next week
  if (daysUntilTarget <= 0) {
    daysUntilTarget += 7;
  }

  // Calculate the target date
  const targetDate = new Date(earliestDate);
  targetDate.setDate(targetDate.getDate() + daysUntilTarget);

  // Add additional weeks if requested
  if (additionalWeeks > 0) {
    targetDate.setDate(targetDate.getDate() + (additionalWeeks * 7));
  }

  return formatDateISO(targetDate);
}

/**
 * Format a date string for display (e.g., "Feb 4, 2026")
 */
export function formatDateForDisplay(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00'); // Add time to avoid timezone issues
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
