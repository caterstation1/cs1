/**
 * Date utilities for consistent timezone handling
 * Prevents timezone shifts when working with dates
 */

/**
 * Creates a local date from a string without timezone conversion
 * @param dateString - Date string in various formats
 * @returns Date object set to local midnight
 */
export function parseLocalDate(dateString: string): Date | null {
  if (!dateString) return null;
  
  // Handle YYYY-MM-DD format directly
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }
  
  // Try parsing other formats
  const parsed = Date.parse(dateString);
  if (!isNaN(parsed)) {
    const date = new Date(parsed);
    // Convert to local midnight to avoid timezone issues
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  }
  
  return null;
}

/**
 * Formats a date as YYYY-MM-DD in local time
 * @param date - Date object
 * @returns Formatted date string
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Creates a local date from components without timezone conversion
 * @param year - Year
 * @param month - Month (1-12)
 * @param day - Day (1-31)
 * @returns Date object set to local midnight
 */
export function createLocalDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

/**
 * Checks if two dates are the same day in local time
 * @param date1 - First date
 * @param date2 - Second date
 * @returns True if same day
 */
export function isSameLocalDay(date1: Date, date2: Date): boolean {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
}

/**
 * Gets today's date in Auckland timezone (UTC+12)
 * @returns Date object set to today's Auckland midnight
 */
export function getTodayLocal(): Date {
  // Get current time and convert to Auckland timezone
  const now = new Date();
  
  // Create a date string in Auckland timezone
  // Use toLocaleString with Auckland timezone to get the correct date
  const aucklandDateString = now.toLocaleString('en-NZ', { 
    timeZone: 'Pacific/Auckland',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  // Parse the Auckland date string (format: DD/MM/YYYY)
  const [day, month, year] = aucklandDateString.split('/').map(Number);
  
  // Create a new date object set to Auckland midnight
  return new Date(year, month - 1, day, 0, 0, 0, 0);
} 