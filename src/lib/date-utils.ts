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

/**
 * Formats a Date as YYYY-MM-DD in Pacific/Auckland timezone.
 * Uses Intl to avoid environment local timezone differences.
 */
export function formatNZYMD(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-NZ', {
    timeZone: 'Pacific/Auckland',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const y = parts.find(p => p.type === 'year')?.value || '1970';
  const m = parts.find(p => p.type === 'month')?.value || '01';
  const d = parts.find(p => p.type === 'day')?.value || '01';
  return `${y}-${m}-${d}`;
}

/**
 * Returns the correct NZ offset suffix (+12:00 or +13:00) for the given YYYY-MM-DD.
 * Determines DST by verifying which candidate yields 00:00 wall time in Auckland.
 */
function getAucklandOffsetSuffixForYmd(ymd: string): string {
  const fmt = (date: Date) => {
    const parts = new Intl.DateTimeFormat('en-NZ', {
      timeZone: 'Pacific/Auckland',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const y = parts.find(p => p.type === 'year')?.value || '1970';
    const m = parts.find(p => p.type === 'month')?.value || '01';
    const d = parts.find(p => p.type === 'day')?.value || '01';
    const hh = parts.find(p => p.type === 'hour')?.value || '00';
    return { ymd: `${y}-${m}-${d}`, hh };
  };
  const c12 = new Date(`${ymd}T00:00:00.000+12:00`);
  const p12 = fmt(c12);
  if (p12.ymd === ymd && p12.hh === '00') return '+12:00';
  return '+13:00';
}

/**
 * Given a YYYY-MM-DD, returns [start,end] Date objects representing
 * Auckland-local day's start and end as absolute instants.
 */
export function getNZDateRangeForYmd(ymd: string): { start: Date; end: Date } {
  const offset = getAucklandOffsetSuffixForYmd(ymd);
  const start = new Date(`${ymd}T00:00:00.000${offset}`);
  const end = new Date(`${ymd}T23:59:59.999${offset}`);
  return { start, end };
}

/**
 * Adds N days to a YYYY-MM-DD string and returns the resulting NZ date string (YYYY-MM-DD).
 * This uses Date arithmetic then formats back in NZ time to be DST-safe.
 */
export function addDaysNZ(ymd: string, days: number): string {
  // Use the start of NZ day to anchor, then add 24h*days, then format in NZ.
  const { start } = getNZDateRangeForYmd(ymd);
  const next = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
  return formatNZYMD(next);
}