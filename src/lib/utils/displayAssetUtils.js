/**
 * Utility functions for handling recurring display logic
 */

/**
 * Check if current date is within the last 5 days of the month
 * @returns {boolean}
 */
export const isLastFiveDaysOfMonth = () => {
  const now = new Date();
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysRemaining = lastDayOfMonth - now.getDate();
  return daysRemaining < 5;
};

/**
 * Check if current date is within the first week of the month
 * @returns {boolean}
 */
export const isFirstWeekOfMonth = () => {
  const now = new Date();
  return now.getDate() <= 7;
};

/**
 * Check if current day is a weekend (Saturday or Sunday)
 * @returns {boolean}
 */
export const isWeekend = () => {
  const now = new Date();
  const dayOfWeek = now.getDay();
  return dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
};

/**
 * Check if an asset should be displayed based on its recurring rule
 * @param {string} recurringRule - The recurring rule type
 * @returns {boolean}
 */
export const shouldDisplayByRecurringRule = (recurringRule) => {
  if (!recurringRule || recurringRule === 'none') {
    return true;
  }

  switch (recurringRule) {
    case 'last-5-days-of-month':
      return isLastFiveDaysOfMonth();
    case 'first-week-of-month':
      return isFirstWeekOfMonth();
    case 'weekends-only':
      return isWeekend();
    case 'custom':
      // Handle custom logic here if needed
      return true;
    default:
      return true;
  }
};

/**
 * Check if an asset should be displayed based on date range
 * @param {Date|string} displayFrom - Start date
 * @param {Date|string} displayTo - End date
 * @returns {boolean}
 */
export const shouldDisplayByDateRange = (displayFrom, displayTo) => {
  const now = new Date();
  
  if (displayFrom && now < new Date(displayFrom)) {
    return false;
  }
  
  if (displayTo && now > new Date(displayTo)) {
    return false;
  }
  
  return true;
};

/**
 * Check if an asset should be displayed overall
 * @param {Object} asset - The display asset object
 * @returns {boolean}
 */
export const shouldDisplayAsset = (asset) => {
  if (!asset.isActive) {
    return false;
  }

  const dateRangeValid = shouldDisplayByDateRange(asset.displayFrom, asset.displayTo);
  const recurringRuleValid = shouldDisplayByRecurringRule(asset.recurringRule);

  return dateRangeValid && recurringRuleValid;
};
