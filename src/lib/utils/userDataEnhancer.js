'use client';

/**
 * Enhanced user data collection for better Facebook Conversion API match quality
 * This module provides utilities to collect and enhance user data for better event matching
 */

/**
 * Collects enhanced user data from various sources
 * @returns {object} Enhanced user data object
 */
export const collectEnhancedUserData = () => {
  const userData = {};
  
  try {
    // Try to get user data from localStorage (if user is logged in)
    const storedUserData = localStorage.getItem('userData') || localStorage.getItem('user');
    if (storedUserData) {
      const parsed = JSON.parse(storedUserData);
      if (parsed.email) userData.email = parsed.email;
      if (parsed.phone || parsed.phoneNumber) userData.phoneNumber = parsed.phone || parsed.phoneNumber;
      if (parsed.id || parsed._id) userData.userId = parsed.id || parsed._id;
    }
    
    // Try to get from sessionStorage
    const sessionUserData = sessionStorage.getItem('userData') || sessionStorage.getItem('user');
    if (sessionUserData && !userData.email) {
      const parsed = JSON.parse(sessionUserData);
      if (parsed.email) userData.email = parsed.email;
      if (parsed.phone || parsed.phoneNumber) userData.phoneNumber = parsed.phone || parsed.phoneNumber;
      if (parsed.id || parsed._id) userData.userId = parsed.id || parsed._id;
    }
    
    // Try to get from URL parameters (for logged-in states)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('user_id') && !userData.userId) {
      userData.userId = urlParams.get('user_id');
    }
    
    // Generate or get session identifier for better tracking
    let sessionId = sessionStorage.getItem('fb_session_id');
    if (!sessionId) {
      sessionId = generateSessionId();
      sessionStorage.setItem('fb_session_id', sessionId);
    }
    userData.sessionId = sessionId;
    
  } catch (error) {
    console.error('Error collecting user data:', error);
  }
  
  return userData;
};

/**
 * Generates a unique session identifier
 * @returns {string} Session identifier
 */
const generateSessionId = () => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  return `session_${timestamp}_${random}`;
};

/**
 * Collects user data from form elements on the page
 * @returns {object} User data from forms
 */
export const collectFormUserData = () => {
  const userData = {};
  
  try {
    // Look for email inputs
    const emailInputs = document.querySelectorAll('input[type="email"], input[name*="email"], input[id*="email"]');
    for (const input of emailInputs) {
      if (input.value && input.value.includes('@')) {
        userData.email = input.value.trim().toLowerCase();
        break;
      }
    }
    
    // Look for phone inputs
    const phoneInputs = document.querySelectorAll('input[type="tel"], input[name*="phone"], input[id*="phone"], input[name*="mobile"]');
    for (const input of phoneInputs) {
      if (input.value && input.value.length >= 10) {
        userData.phoneNumber = input.value.trim();
        break;
      }
    }
    
    // Look for first name inputs
    const firstNameInputs = document.querySelectorAll(
      'input[name*="first"], input[id*="first"], input[name*="fname"], input[id*="fname"], ' +
      'input[name="firstName"], input[id="firstName"]'
    );
    for (const input of firstNameInputs) {
      if (input.value && input.value.length > 1) {
        userData.firstName = input.value.trim();
        break;
      }
    }
    
    // Look for last name inputs
    const lastNameInputs = document.querySelectorAll(
      'input[name*="last"], input[id*="last"], input[name*="lname"], input[id*="lname"], ' +
      'input[name="lastName"], input[id="lastName"], input[name="surname"]'
    );
    for (const input of lastNameInputs) {
      if (input.value && input.value.length > 1) {
        userData.lastName = input.value.trim();
        break;
      }
    }
    
    // Look for city inputs
    const cityInputs = document.querySelectorAll('input[name*="city"], input[id*="city"]');
    for (const input of cityInputs) {
      if (input.value && input.value.length > 1) {
        userData.city = input.value.trim();
        break;
      }
    }
    
    // Look for state inputs
    const stateInputs = document.querySelectorAll('input[name*="state"], input[id*="state"], select[name*="state"], select[id*="state"]');
    for (const input of stateInputs) {
      if (input.value && input.value.length > 1) {
        userData.state = input.value.trim();
        break;
      }
    }
    
    // Look for country inputs
    const countryInputs = document.querySelectorAll('input[name*="country"], input[id*="country"], select[name*="country"], select[id*="country"]');
    for (const input of countryInputs) {
      if (input.value && input.value.length > 1) {
        userData.country = input.value.trim();
        break;
      }
    }
    
    // Look for zip/postal code inputs
    const zipInputs = document.querySelectorAll(
      'input[name*="zip"], input[id*="zip"], input[name*="postal"], input[id*="postal"], ' +
      'input[name*="pincode"], input[id*="pincode"]'
    );
    for (const input of zipInputs) {
      if (input.value && input.value.length >= 3) {
        userData.zipCode = input.value.trim();
        break;
      }
    }
    
    // Look for date of birth inputs
    const dobInputs = document.querySelectorAll(
      'input[type="date"], input[name*="birth"], input[id*="birth"], input[name*="dob"], input[id*="dob"]'
    );
    for (const input of dobInputs) {
      if (input.value) {
        // Convert to YYYYMMDD format for Facebook
        const date = new Date(input.value);
        if (!isNaN(date.getTime())) {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          userData.dateOfBirth = `${year}${month}${day}`;
          break;
        }
      }
    }
    
    // Look for gender inputs
    const genderInputs = document.querySelectorAll(
      'input[name*="gender"]:checked, select[name*="gender"], input[name*="sex"]:checked, select[name*="sex"]'
    );
    for (const input of genderInputs) {
      if (input.value) {
        const value = input.value.toLowerCase();
        if (value.includes('male') || value === 'm') {
          userData.gender = 'm';
          break;
        } else if (value.includes('female') || value === 'f') {
          userData.gender = 'f';
          break;
        }
      }
    }
    
  } catch (error) {
    console.error('Error collecting form data:', error);
  }
  
  return userData;
};

/**
 * Enhanced tracking function that automatically collects available user data
 * @param {string} eventName - The event name
 * @param {object} customData - Custom event data
 * @param {object} options - Additional options
 * @returns {object} Enhanced event data
 */
export const enhanceEventData = (eventName, customData = {}, options = {}) => {
  // Collect user data from various sources
  const storedUserData = collectEnhancedUserData();
  const formUserData = collectFormUserData();
  
  // Merge user data (form data takes precedence)
  const userData = { ...storedUserData, ...formUserData };
  
  // Create enhanced event data
  const enhancedData = {
    ...customData,
    ...options,
  };
  
  // Add user identifiers
  const emails = [];
  const phones = [];
  const externalIds = [];
  
  if (userData.email) {
    emails.push(userData.email);
  }
  
  if (userData.phoneNumber) {
    phones.push(userData.phoneNumber);
  }
  
  if (userData.userId) {
    externalIds.push(userData.userId);
  }
  
  if (userData.sessionId) {
    externalIds.push(userData.sessionId);
  }
  
  // Add to enhanced data
  if (emails.length > 0) enhancedData.emails = emails;
  if (phones.length > 0) enhancedData.phones = phones;
  if (externalIds.length > 0) enhancedData.external_ids = externalIds;
  
  // Add first name for better matching (hashed on server)
  if (userData.firstName) {
    enhancedData.first_name = userData.firstName;
  }
  
  return {
    userData,
    enhancedData
  };
};

/**
 * Sets up automatic form monitoring for better user data collection
 */
export const setupFormMonitoring = () => {
  // Monitor form submissions
  document.addEventListener('submit', (event) => {
    const form = event.target;
    if (form.tagName === 'FORM') {
      const formData = new FormData(form);
      const userData = {};
      
      // Extract user data from form
      for (const [key, value] of formData.entries()) {
        const keyLower = key.toLowerCase();
        
        if (keyLower.includes('email') && value.includes('@')) {
          userData.email = value.trim().toLowerCase();
        }
        if ((keyLower.includes('phone') || keyLower.includes('mobile')) && value.length >= 10) {
          userData.phoneNumber = value.trim();
        }
        if ((keyLower.includes('first') || keyLower.includes('fname')) && value.length > 1) {
          userData.firstName = value.trim();
        }
        if ((keyLower.includes('last') || keyLower.includes('lname') || keyLower.includes('surname')) && value.length > 1) {
          userData.lastName = value.trim();
        }
        if (keyLower.includes('city') && value.length > 1) {
          userData.city = value.trim();
        }
        if (keyLower.includes('state') && value.length > 1) {
          userData.state = value.trim();
        }
        if (keyLower.includes('country') && value.length > 1) {
          userData.country = value.trim();
        }
        if ((keyLower.includes('zip') || keyLower.includes('postal') || keyLower.includes('pincode')) && value.length >= 3) {
          userData.zipCode = value.trim();
        }
        if ((keyLower.includes('birth') || keyLower.includes('dob')) && value) {
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            userData.dateOfBirth = `${year}${month}${day}`;
          }
        }
        if (keyLower.includes('gender') || keyLower.includes('sex')) {
          const valueLower = value.toLowerCase();
          if (valueLower.includes('male') || valueLower === 'm') {
            userData.gender = 'm';
          } else if (valueLower.includes('female') || valueLower === 'f') {
            userData.gender = 'f';
          }
        }
      }
      
      // Store for later use
      if (Object.keys(userData).length > 0) {
        sessionStorage.setItem('formUserData', JSON.stringify(userData));
      }
    }
  });
  
  // Monitor input changes for real-time data collection
  document.addEventListener('input', (event) => {
    const input = event.target;
    if (input.tagName === 'INPUT') {
      const userData = {};
      
      if (input.type === 'email' && input.value.includes('@')) {
        userData.email = input.value.trim().toLowerCase();
        sessionStorage.setItem('currentEmail', userData.email);
      }
      
      if ((input.type === 'tel' || input.name?.toLowerCase().includes('phone')) && input.value.length >= 10) {
        userData.phoneNumber = input.value.trim();
        sessionStorage.setItem('currentPhone', userData.phoneNumber);
      }
    }
  });
};

/**
 * Initialize enhanced user data collection
 */
export const initializeUserDataCollection = () => {
  // Set up form monitoring
  if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setupFormMonitoring);
    } else {
      setupFormMonitoring();
    }
  }
};
