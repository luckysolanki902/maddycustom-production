/**
 * Client IP Detection Utility
 * 
 * Detects the client's IP address as seen by their browser
 * Handles both IPv4 and IPv6
 * Caches result in sessionStorage for performance
 */

const IP_CACHE_KEY = 'meta_client_ip';
const IP_CACHE_EXPIRY_KEY = 'meta_client_ip_expiry';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

/**
 * Validates IP address format
 */
function isValidIP(ip) {
  if (!ip || typeof ip !== 'string') return false;
  
  // IPv4
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  if (ipv4Regex.test(ip)) return true;
  
  // IPv6
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$|^(?:[0-9a-fA-F]{1,4}:)*::[0-9a-fA-F]{1,4}(?::[0-9a-fA-F]{1,4})*$/;
  if (ipv6Regex.test(ip)) return true;
  
  return false;
}

/**
 * Gets IP from cache if valid
 */
function getCachedIP() {
  try {
    const cached = sessionStorage.getItem(IP_CACHE_KEY);
    const expiry = sessionStorage.getItem(IP_CACHE_EXPIRY_KEY);
    
    if (cached && expiry && Date.now() < parseInt(expiry)) {
      if (isValidIP(cached)) {
        console.log('[IP Detection] Using cached IP:', cached);
        return cached;
      }
    }
  } catch (e) {
    // SessionStorage might be disabled
  }
  
  return null;
}

/**
 * Caches IP address
 */
function cacheIP(ip) {
  try {
    sessionStorage.setItem(IP_CACHE_KEY, ip);
    sessionStorage.setItem(IP_CACHE_EXPIRY_KEY, (Date.now() + CACHE_DURATION).toString());
  } catch (e) {
    // SessionStorage might be disabled or full
  }
}

/**
 * Detects client IP address from browser
 * Uses multiple fallback services for reliability
 * 
 * Note: Most users will see IPv4 addresses because:
 * 1. Their ISP hasn't deployed IPv6 yet
 * 2. They're on a network with IPv4 NAT
 * 3. Their device prefers IPv4 (Happy Eyeballs algorithm)
 * 
 * Even api64.ipify.org (IPv6-first) will return IPv4 if:
 * - The client doesn't have IPv6 connectivity
 * - IPv6 is disabled on the device/network
 * - ISP only provides IPv4
 * 
 * This is CORRECT behavior - we detect whatever IP you're actually using.
 * 
 * @returns {Promise<string|null>} - The client's IP address or null if detection fails
 */
export async function detectClientIP() {
  // Check cache first
  const cached = getCachedIP();
  if (cached) return cached;
  
  // List of free IP detection services (in priority order)
  // Note: api64.ipify.org returns IPv6 if available, IPv4 as fallback
  // This ensures we get IPv6 when the user's network supports it
  const services = [
    {
      name: 'ipify IPv6-first',
      url: 'https://api64.ipify.org?format=json',
      parse: (text) => {
        try {
          const data = JSON.parse(text);
          return data.ip;
        } catch {
          return null;
        }
      }
    },
    {
      name: 'Cloudflare',
      url: 'https://www.cloudflare.com/cdn-cgi/trace',
      parse: (text) => {
        const match = text.match(/ip=(.+)/);
        return match ? match[1].trim() : null;
      }
    },
    {
      name: 'ipify IPv4-only',
      url: 'https://api.ipify.org?format=json',
      parse: (text) => {
        try {
          const data = JSON.parse(text);
          return data.ip;
        } catch {
          return null;
        }
      }
    }
  ];
  
  // Try each service with timeout
  for (const service of services) {
    try {
      console.log(`[IP Detection] Trying ${service.name}...`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
      
      const response = await fetch(service.url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json, text/plain, */*'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.warn(`[IP Detection] ${service.name} returned ${response.status}`);
        continue;
      }
      
      const text = await response.text();
      const ip = service.parse(text);
      
      if (ip && isValidIP(ip)) {
        console.log(`[IP Detection] Detected IP from ${service.name}:`, ip);
        cacheIP(ip);
        return ip;
      }
      
      console.warn(`[IP Detection] ${service.name} returned invalid IP:`, ip);
    } catch (error) {
      if (error.name === 'AbortError') {
        console.warn(`[IP Detection] ${service.name} timed out`);
      } else {
        console.warn(`[IP Detection] ${service.name} failed:`, error.message);
      }
    }
  }
  
  console.warn('[IP Detection] All services failed, returning null');
  return null;
}

/**
 * Gets client IP synchronously from cache
 * Use this for immediate access without async
 * 
 * @returns {string|null} - Cached IP or null
 */
export function getClientIPSync() {
  return getCachedIP();
}

/**
 * Clears IP cache
 * Useful for testing or when IP changes
 */
export function clearIPCache() {
  try {
    sessionStorage.removeItem(IP_CACHE_KEY);
    sessionStorage.removeItem(IP_CACHE_EXPIRY_KEY);
    console.log('[IP Detection] Cache cleared');
  } catch (e) {
    // Ignore errors
  }
}

/**
 * Pre-detects and caches IP on page load
 * Call this early in your app initialization
 */
export function preDetectIP() {
  if (typeof window === 'undefined') return;
  
  // Don't block - run in background
  detectClientIP().catch(err => {
    console.warn('[IP Detection] Pre-detection failed:', err);
  });
}
