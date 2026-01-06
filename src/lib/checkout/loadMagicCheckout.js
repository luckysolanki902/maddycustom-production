/**
 * Dynamic script loader for Shiprocket Magic Checkout
 * Loads the Shiprocket checkout script and initializes the global HeadlessCheckout object
 */

const SHIPROCKET_SCRIPT_URL = 'https://checkout-ui.shiprocket.com/assets/js/channels/shopify.js';
const SHIPROCKET_CSS_URL = 'https://checkout-ui.shiprocket.com/assets/styles/shopify.css';
const SCRIPT_ID = 'shiprocket-magic-checkout-script';
const CSS_ID = 'shiprocket-magic-checkout-css';

let scriptLoadPromise = null;
let isScriptLoaded = false;

/**
 * Load Shiprocket Magic Checkout script and CSS dynamically
 * @returns {Promise<void>}
 */
export function loadMagicCheckout() {
  // Return existing promise if already loading
  if (scriptLoadPromise) {
    return scriptLoadPromise;
  }

  // Return resolved promise if already loaded
  if (isScriptLoaded && typeof window !== 'undefined' && window.HeadlessCheckout) {
    return Promise.resolve();
  }

  scriptLoadPromise = new Promise((resolve, reject) => {
    // Server-side: reject immediately
    if (typeof window === 'undefined') {
      reject(new Error('Cannot load script on server'));
      return;
    }

    // Check if script already exists
    const existingScript = document.getElementById(SCRIPT_ID);
    if (existingScript && window.HeadlessCheckout) {
      isScriptLoaded = true;
      resolve();
      return;
    }

    // Load CSS first
    const existingCss = document.getElementById(CSS_ID);
    if (!existingCss) {
      const link = document.createElement('link');
      link.id = CSS_ID;
      link.rel = 'stylesheet';
      link.href = SHIPROCKET_CSS_URL;
      document.head.appendChild(link);
    }

    // Create and append script
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = SHIPROCKET_SCRIPT_URL;
    script.async = true;

    script.onload = () => {
      // Verify HeadlessCheckout global is available
      if (window.HeadlessCheckout) {
        isScriptLoaded = true;
        resolve();
      } else {
        reject(new Error('HeadlessCheckout global not found after script load'));
      }
    };

    script.onerror = () => {
      scriptLoadPromise = null;
      reject(new Error('Failed to load Shiprocket checkout script'));
    };

    document.body.appendChild(script);
  });

  return scriptLoadPromise;
}

/**
 * Check if HeadlessCheckout is already loaded
 * @returns {boolean}
 */
export function isMagicCheckoutLoaded() {
  return isScriptLoaded && typeof window !== 'undefined' && typeof window.HeadlessCheckout !== 'undefined';
}

/**
 * Get HeadlessCheckout global object
 * @returns {object|null}
 */
export function getMagicCheckout() {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.HeadlessCheckout || null;
}

/**
 * Reset the loader state (useful for testing)
 */
export function resetMagicCheckoutLoader() {
  scriptLoadPromise = null;
  isScriptLoaded = false;
}
