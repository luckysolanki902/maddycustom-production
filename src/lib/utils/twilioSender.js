// lib/utils/twilioSender.js
import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

if (!accountSid || !authToken || !messagingServiceSid) {
  console.error('Twilio credentials are missing in environment variables.');
}

const client = twilio(accountSid, authToken);

/**
 * Sends an SMS using Twilio messaging service.
 *
 * @param {Object} params
 * @param {string} params.to - The destination phone number (in E.164 format).
 * @param {string} params.body - The SMS message body.
 * @returns {Promise<Object>} The result object with either a success flag and message SID or an error.
 */
export async function sendSMS({ to, body }) {
  try {
    const message = await client.messages.create({
      body,
      messagingServiceSid,
      to,
    });
    return { success: true, sid: message.sid };
  } catch (error) {
    console.error('Error sending SMS:', error);
    return { success: false, error: error.message };
  }
}
