/**
 * Ensures Razorpay checkout script is loaded before attempting payment
 * Waits up to 5 seconds for the script to load, checking every 100ms
 * @returns {Promise<boolean>} Resolves when Razorpay is available
 * @throws {Error} If script fails to load within timeout
 */
export const ensureRazorpayLoaded = () => {
  return new Promise((resolve, reject) => {
    // If already loaded, resolve immediately
    if (typeof window !== 'undefined' && window.Razorpay) {
      console.log('[Razorpay] Script already loaded');
      resolve(true);
      return;
    }

    // Wait for script to load (max 5 seconds)
    let attempts = 0;
    const maxAttempts = 50; // 50 * 100ms = 5 seconds

    console.log('[Razorpay] Waiting for script to load...');

    const checkInterval = setInterval(() => {
      attempts++;

      if (typeof window !== 'undefined' && window.Razorpay) {
        clearInterval(checkInterval);
        console.log(`[Razorpay] Script loaded after ${attempts * 100}ms`);
        resolve(true);
      } else if (attempts >= maxAttempts) {
        clearInterval(checkInterval);
        console.error('[Razorpay] Script failed to load within timeout');
        reject(new Error('Razorpay script failed to load. Please refresh the page and try again.'));
      }
    }, 100);
  });
};
