'use client';

/**
 * External ID Manager
 * 
 * Manages a persistent external_id (UUID) for each visitor across browser sessions.
 * This ID is critical for Meta Conversion API deduplication between browser Pixel and server CAPI.
 * 
 * Key Features:
 * 1. Generates a unique UUID on first visit
 * 2. Stores in localStorage for persistence (survives browser close/open)
 * 3. Also sets as a cookie for server-side access (365 days)
 * 4. Lazy initialization - generates only when needed
 * 5. Validation - ensures ID format is correct
 * 
 * Usage:
 * import { getExternalId, setExternalIdCookie } from '@/lib/utils/externalIdManager';
 * 
 * // Get the external ID (generates if doesn't exist)
 * const externalId = getExternalId();
 * 
 * // Explicitly set the cookie (useful for server-side tracking)
 * setExternalIdCookie();
 */

const EXTERNAL_ID_KEY = 'mc_external_id';
const EXTERNAL_ID_COOKIE = 'mc_external_id';
const COOKIE_MAX_AGE_DAYS = 365; // 1 year

/**
 * Validates if a string is a valid UUID v4 format
 * @param {string} id - The ID to validate
 * @returns {boolean} - True if valid UUID v4
 */
const isValidUUID = (id) => {
  if (!id || typeof id !== 'string') return false;
  
  // UUID v4 regex: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  // where x is any hexadecimal digit and y is one of 8, 9, A, or B
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

/**
 * Generates a new UUID v4 using browser's crypto API or fallback
 * @returns {string} - A new UUID v4
 */
const generateUUID = () => {
  // Try to use crypto.randomUUID if available (modern browsers)
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
    try {
      return window.crypto.randomUUID();
    } catch (error) {
      console.warn('crypto.randomUUID failed, using fallback:', error);
    }
  }
  
  // Fallback UUID v4 generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

/**
 * Gets the external ID from localStorage, generates if doesn't exist
 * @returns {string|null} - The external ID or null if not in browser environment
 */
export const getExternalId = () => {
  if (typeof window === 'undefined') {
    return null; // Not in browser environment
  }
  
  try {
    // Try to get from localStorage first
    let externalId = localStorage.getItem(EXTERNAL_ID_KEY);
    
    // Validate existing ID
    if (externalId && isValidUUID(externalId)) {
      return externalId;
    }
    
    // If invalid or doesn't exist, try to get from cookie
    if (!externalId || !isValidUUID(externalId)) {
      externalId = getExternalIdFromCookie();
    }
    
    // If still no valid ID, generate a new one
    if (!externalId || !isValidUUID(externalId)) {
      externalId = generateUUID();
      console.log('[External ID] Generated new external_id:', externalId);
    }
    
    // Store in localStorage for persistence
    localStorage.setItem(EXTERNAL_ID_KEY, externalId);
    
    // Also set as cookie for server-side access
    setExternalIdCookie(externalId);
    
    return externalId;
  } catch (error) {
    console.error('[External ID] Error getting external_id:', error);
    
    // Fallback: try to generate and return without storage
    try {
      return generateUUID();
    } catch (fallbackError) {
      console.error('[External ID] Fallback generation failed:', fallbackError);
      return null;
    }
  }
};

/**
 * Gets external ID from cookie
 * @returns {string|null} - The external ID from cookie or null
 */
const getExternalIdFromCookie = () => {
  if (typeof document === 'undefined') return null;
  
  try {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === EXTERNAL_ID_COOKIE && value) {
        const decoded = decodeURIComponent(value);
        if (isValidUUID(decoded)) {
          return decoded;
        }
      }
    }
  } catch (error) {
    console.error('[External ID] Error reading cookie:', error);
  }
  
  return null;
};

/**
 * Sets the external ID as a cookie for server-side access
 * @param {string} externalId - Optional external ID to set (uses getExternalId if not provided)
 */
export const setExternalIdCookie = (externalId = null) => {
  if (typeof document === 'undefined') return;
  
  try {
    const id = externalId || getExternalId();
    if (!id || !isValidUUID(id)) {
      console.warn('[External ID] Cannot set cookie with invalid ID:', id);
      return;
    }
    
    // Calculate expiration date
    const expires = new Date();
    expires.setDate(expires.getDate() + COOKIE_MAX_AGE_DAYS);
    
    // Set cookie with proper attributes
    // SameSite=Lax allows cookie to be sent on top-level navigation and same-site requests
    // Secure flag should be set in production (HTTPS)
    const isSecure = window.location.protocol === 'https:';
    const cookieString = [
      `${EXTERNAL_ID_COOKIE}=${encodeURIComponent(id)}`,
      `expires=${expires.toUTCString()}`,
      'path=/',
      'SameSite=Lax',
      isSecure ? 'Secure' : ''
    ].filter(Boolean).join('; ');
    
    document.cookie = cookieString;
    
    console.debug('[External ID] Cookie set:', EXTERNAL_ID_COOKIE, '=', id);
  } catch (error) {
    console.error('[External ID] Error setting cookie:', error);
  }
};

/**
 * Clears the external ID from both localStorage and cookie
 * Useful for testing or user privacy requests
 */
export const clearExternalId = () => {
  if (typeof window === 'undefined') return;
  
  try {
    // Clear from localStorage
    localStorage.removeItem(EXTERNAL_ID_KEY);
    
    // Clear from cookie
    if (typeof document !== 'undefined') {
      document.cookie = `${EXTERNAL_ID_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    }
    
    console.log('[External ID] Cleared external_id from storage and cookie');
  } catch (error) {
    console.error('[External ID] Error clearing external_id:', error);
  }
};

/**
 * Initializes external ID on page load
 * Call this once when your app initializes to ensure external_id is set
 */
export const initializeExternalId = () => {
  if (typeof window === 'undefined') return;
  
  try {
    const externalId = getExternalId();
    
    if (externalId) {
      console.debug('[External ID] Initialized:', externalId);
      return externalId;
    } else {
      console.warn('[External ID] Failed to initialize external_id');
      return null;
    }
  } catch (error) {
    console.error('[External ID] Error during initialization:', error);
    return null;
  }
};

// Auto-initialize on module load in browser environment
if (typeof window !== 'undefined') {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initializeExternalId();
    });
  } else {
    // DOM already loaded
    initializeExternalId();
  }
}
