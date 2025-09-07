// @/lib/utils/msg91Sender.js

/**
 * Sends SMS via MSG91 API
 *
 * @param {Object} options
 * @param {String} options.phoneNumber - The recipient's phone number (with country code)
 * @param {String} options.message - The SMS message content
 * @param {String} [options.templateId] - MSG91 template ID (if using template)
 * @param {String} [options.dltTemplateId] - DLT template ID for compliance
 * @param {String} [options.countryCode='91'] - Default country code
 * @param {Object} [options.variables] - Variables for template replacement
 *
 * @returns {Object} - { success: boolean, message: string, data?: Object }
 */
export async function sendSMS({
  phoneNumber,
  message,
  templateId,
  dltTemplateId,
  countryCode = '91',
  variables = {},
}) {
  try {
    const MSG91_API_KEY = process.env.MSG91_API_KEY;
    const MSG91_SENDER_ID = process.env.MSG91_SENDER_ID || 'MADCUS';

    if (!MSG91_API_KEY) {
      return {
        success: false,
        message: 'MSG91 API key is missing. Check your environment config.',
      };
    }

    // Ensure phone number has country code
    const formattedPhoneNumber = phoneNumber.length === 10 
      ? `${countryCode}${phoneNumber}` 
      : phoneNumber;

    let payload;
    let apiUrl;

    if (templateId) {
      // Use template-based SMS
      apiUrl = 'https://control.msg91.com/api/v5/flow/';
      
      payload = {
        template_id: templateId,
        recipients: [
          {
            mobiles: formattedPhoneNumber,
            ...variables // Spread variables for template replacement
          }
        ]
      };

      if (dltTemplateId) {
        payload.template_id = dltTemplateId;
      }
    } else {
      // Use simple text SMS
      apiUrl = 'https://control.msg91.com/api/v5/sms/';
      
      payload = {
        sender: MSG91_SENDER_ID,
        route: '4', // Transactional route
        country: countryCode,
        sms: [
          {
            message: message,
            to: [formattedPhoneNumber]
          }
        ]
      };
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'authkey': MSG91_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    // Parse response
    let result;
    try {
      result = await response.json();
    } catch (parseErr) {
      return {
        success: false,
        message: 'MSG91 response was not valid JSON.',
        data: { response: await response.text() }
      };
    }

    // Check for success
    if (!response.ok) {
      return {
        success: false,
        message: result?.message || `MSG91 API error: ${response.status}`,
        data: result,
      };
    }

    // MSG91 success response check
    if (result.type === 'error' || result.error) {
      return {
        success: false,
        message: result.message || 'MSG91 responded with an error.',
        data: result,
      };
    }

    return {
      success: true,
      message: 'SMS sent successfully!',
      data: result,
    };

  } catch (error) {
    return {
      success: false,
      message: error.message || 'An error occurred while sending SMS.',
      data: null,
    };
  }
}

/**
 * Send OTP via MSG91
 *
 * @param {Object} options
 * @param {String} options.phoneNumber - The recipient's phone number
 * @param {String} [options.otpLength=4] - Length of OTP (4-9 digits)
 * @param {String} [options.countryCode='91'] - Country code
 *
 * @returns {Object} - { success: boolean, message: string, data?: Object }
 */
export async function sendOTP({
  phoneNumber,
  otpLength = 4,
  countryCode = '91'
}) {
  try {
    const MSG91_API_KEY = process.env.MSG91_API_KEY;

    if (!MSG91_API_KEY) {
      return {
        success: false,
        message: 'MSG91 API key is missing.',
      };
    }

    const formattedPhoneNumber = phoneNumber.length === 10 
      ? `${countryCode}${phoneNumber}` 
      : phoneNumber;

    const response = await fetch('https://control.msg91.com/api/v5/otp', {
      method: 'POST',
      headers: {
        'authkey': MSG91_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        template_id: process.env.MSG91_OTP_TEMPLATE_ID,
        mobile: formattedPhoneNumber,
        otp_length: otpLength,
      }),
    });

    const result = await response.json();

    if (!response.ok || result.type === 'error') {
      return {
        success: false,
        message: result.message || 'Failed to send OTP.',
        data: result,
      };
    }

    return {
      success: true,
      message: 'OTP sent successfully!',
      data: result,
    };

  } catch (error) {
    return {
      success: false,
      message: error.message || 'An error occurred while sending OTP.',
      data: null,
    };
  }
}

/**
 * Verify OTP via MSG91
 *
 * @param {Object} options
 * @param {String} options.phoneNumber - The phone number
 * @param {String} options.otp - The OTP to verify
 * @param {String} [options.countryCode='91'] - Country code
 *
 * @returns {Object} - { success: boolean, message: string, data?: Object }
 */
export async function verifyOTP({
  phoneNumber,
  otp,
  countryCode = '91'
}) {
  try {
    const MSG91_API_KEY = process.env.MSG91_API_KEY;

    if (!MSG91_API_KEY) {
      return {
        success: false,
        message: 'MSG91 API key is missing.',
      };
    }

    const formattedPhoneNumber = phoneNumber.length === 10 
      ? `${countryCode}${phoneNumber}` 
      : phoneNumber;

    const response = await fetch('https://control.msg91.com/api/v5/otp/verify', {
      method: 'POST',
      headers: {
        'authkey': MSG91_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mobile: formattedPhoneNumber,
        otp: otp,
      }),
    });

    const result = await response.json();

    if (!response.ok || result.type === 'error') {
      return {
        success: false,
        message: result.message || 'OTP verification failed.',
        data: result,
      };
    }

    return {
      success: true,
      message: 'OTP verified successfully!',
      data: result,
    };

  } catch (error) {
    return {
      success: false,
      message: error.message || 'An error occurred while verifying OTP.',
      data: null,
    };
  }
}
