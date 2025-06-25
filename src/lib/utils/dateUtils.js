/**
 * Checks if the current date is within the last 5 days of the month
 * @returns {boolean} True if current date is in the last 5 days of the month
 */
export function isLastFiveDaysOfMonth() {
  const today = new Date();
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const currentDay = today.getDate();
  return currentDay >= (lastDayOfMonth - 4);
}

/**
 * Calculates the end of the current month
 * @returns {Date} Date object representing the end of the current month
 */
export function getEndOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
}
