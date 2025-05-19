/**
 * Helper functions for the checkout process
 */

/**
 * Validate user input for personal details form
 * @param {Object} data - Form data
 * @returns {Object} - Validation result
 */
export const validateUserDetails = (data) => {
  const errors = {};
  
  // Name validation
  if (!data.name) {
    errors.name = "Name is required";
  } else if (data.name.length < 3) {
    errors.name = "Name must be at least 3 characters";
  }
  
  // Phone validation
  if (!data.phoneNumber) {
    errors.phoneNumber = "Phone number is required";
  } else {
    // Extract only digits
    const digitsOnly = data.phoneNumber.replace(/\D/g, '');
    
    // Check if it's a 10 digit number after formatting
    if (digitsOnly.length !== 10) {
      errors.phoneNumber = "Please enter a valid 10-digit mobile number";
    }
  }
  
  // Email validation (optional field)
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.email = "Please enter a valid email address";
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

/**
 * Validate address details form
 * @param {Object} data - Form data
 * @returns {Object} - Validation result
 */
export const validateAddressDetails = (data) => {
  const errors = {};
  
  // Required fields validation
  const requiredFields = ['addressLine1', 'city', 'state', 'pincode'];
  requiredFields.forEach(field => {
    if (!data[field]) {
      errors[field] = `${field.charAt(0).toUpperCase() + field.slice(1)} is required`;
    }
  });
  
  // Pincode validation
  if (data.pincode && !/^\d{6}$/.test(data.pincode)) {
    errors.pincode = "Please enter a valid 6-digit pincode";
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

/**
 * Format phone number to standard 10-digit format
 * @param {string} phone - Input phone number
 * @returns {string} - Formatted phone number
 */
export const formatPhoneNumber = (phone) => {
  if (!phone) return '';
  
  // Keep only digits
  let digitsOnly = phone.replace(/\D/g, '');
  
  // Handle common Indian prefixes
  if (digitsOnly.length > 10) {
    // Remove leading 0
    if (digitsOnly.startsWith('0')) {
      digitsOnly = digitsOnly.substring(1);
    }
    
    // Remove country code +91 or 91
    if (digitsOnly.startsWith('91') && digitsOnly.length > 10) {
      digitsOnly = digitsOnly.substring(2);
    }
  }
  
  // Return the last 10 digits if longer
  if (digitsOnly.length > 10) {
    digitsOnly = digitsOnly.substring(digitsOnly.length - 10);
  }
  
  return digitsOnly;
};
