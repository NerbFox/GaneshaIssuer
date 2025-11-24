/**
 * Date and Time Formatting Utilities
 * Provides standardized date/time formatting across the application
 */

/**
 * Format a date to a full datetime string
 * Format: MM/DD/YYYY, HH:MM:SS (24-hour format)
 * Example: 11/19/2025, 14:30:45
 */
export const formatDateTime = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
};

/**
 * Format a date to a date-only string
 * Format: MM/DD/YYYY
 * Example: 11/19/2025
 */
export const formatDate = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

/**
 * Format a date to a time-only string
 * Format: HH:MM:SS (24-hour format)
 * Example: 14:30:45
 */
export const formatTime = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
};

/**
 * Format a date to a datetime string with date and time on separate lines
 * Returns an object with date and time parts
 * Useful for multi-line display
 */
export const formatDateTimeSplit = (date: Date | string): { date: string; time: string } => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return {
    date: formatDate(dateObj),
    time: formatTime(dateObj),
  };
};

/**
 * Format a number with locale-specific thousand separators
 * Example: 1000 -> 1,000
 */
export const formatNumber = (num: number): string => {
  return num.toLocaleString();
};

/**
 * Format an expiration date, returning "Lifetime" if the date is null, empty, or '-'
 * Otherwise returns a formatted datetime string
 */
export const formatExpirationDate = (date: string | null | undefined): string => {
  if (!date || date === '-') {
    return 'Lifetime';
  }
  return formatDateTime(date);
};
