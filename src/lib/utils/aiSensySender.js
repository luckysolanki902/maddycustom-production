// @/lib/utils/aiSensySender.js
import CampaignLog from '@/models/CampaignLog';

/**
 * Sends a WhatsApp message via AiSensy and logs the campaign result.
 *
 * Supported structures:
 * - Plain text templates with placeholders (templateParams).
 * - Carousel with `carouselCards`.
 * - Single media (image/pdf/etc.) with `media`.
 * - Buttons with `buttons`.
 *
 * @param {Object} options
 * @param {Object} options.user - The user object containing _id, name, phoneNumber, etc.
 * @param {String} [options.prefUserName] - If you want to override user name in the greeting.
 * @param {String} options.campaignName - The AiSensy campaign name (e.g. "review-campaign").
 * @param {ObjectId} [options.orderId] - The related order ID, if applicable.
 * @param {String[]} [options.templateParams] - AiSensy template placeholders.
 * @param {Array} [options.carouselCards] - AiSensy carousel card objects.
 * @param {Object} [options.media] - AiSensy media object (e.g. { url, filename }).
 * @param {Array} [options.buttons] - AiSensy buttons array.
 * @param {String} [options.countryCode='91'] - Default country code for phone number.
 *
 * @returns {Object} - { success: boolean, message: string, data?: Object }
 */
export async function sendWhatsAppMessage({
  user,
  prefUserName,
  campaignName,
  orderId,
  templateParams = [],
  carouselCards = [],
  media,
  buttons,
  countryCode = '91',
}) {
  let campaignLog;

  try {
    // Check if a successful message has already been sent for this user/order/campaign
    campaignLog = await CampaignLog.findOne({
      // user: user._id,
      campaignName,
      order: orderId,
    });

    if (campaignLog && campaignLog.successfulCount >= 1) {
      return {
        success: false,
        message: 'Message already sent successfully for this campaign.',
      };
    }

    // Initialize campaign log if it doesn't exist
    if (!campaignLog) {
      campaignLog = new CampaignLog({
        user: user._id,
        order: orderId,
        campaignName,
        source: 'aisensy',
        medium: 'whatsapp',
        phoneNumber: `${user.phoneNumber}`,
        totalCount: 0,
        successfulCount: 0,
        failedCount: 0,
      });
    }

    const AISENSY_API_URL = 'https://backend.aisensy.com/campaign/t1/api/v2';
    const AISENSY_API_KEY = process.env.AISENSY_API_KEY;

    if (!AISENSY_API_KEY) {
      console.error('AiSensy API Key is missing!');
      return {
        success: false,
        message: 'AiSensy API key is missing. Check your .env.local file.',
      };
    }

    // Prepare base payload
    const payload = {
      apiKey: AISENSY_API_KEY,
      campaignName, // e.g., "review-campaign"
      destination:
        user.phoneNumber.length === 10
          ? `${countryCode}${user.phoneNumber}`
          : user.phoneNumber,
      userName: prefUserName || user.name || '',
      templateParams,
    };

    // Attach optional fields if provided
    if (carouselCards?.length) {
      payload.carouselCards = carouselCards;
    }
    if (media) {
      payload.media = media;
    }
    if (buttons?.length) {
      payload.buttons = buttons;
    }

    // Send request to AiSensy
    const response = await fetch(AISENSY_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (response.status === 401) {
      console.error('Unauthorized: Invalid API Key or permission issue.');
      campaignLog.totalCount += 1;
      campaignLog.failedCount += 1;
      campaignLog.lastSentAt = new Date();
      await campaignLog.save();

      return {
        success: false,
        message: 'Unauthorized: Invalid AiSensy API key or permission issue.',
      };
    }

    const result = await response.json();

    if (!response.ok) {
      console.error('AiSensy API Error:', result);
      campaignLog.totalCount += 1;
      campaignLog.failedCount += 1;
      campaignLog.lastSentAt = new Date();
      await campaignLog.save();

      return {
        success: false,
        message: result.message || 'Failed to send AiSensy WhatsApp message.',
      };
    }

    // On success, update campaign log
    campaignLog.totalCount += 1;
    campaignLog.successfulCount += 1;
    campaignLog.lastSentAt = new Date();
    await campaignLog.save();

    return { success: true, message: 'WhatsApp message sent successfully!', data: result };
  } catch (error) {
    console.error('Error in sendWhatsAppMessage:', error);
    if (campaignLog) {
      campaignLog.totalCount += 1;
      campaignLog.failedCount += 1;
      campaignLog.lastSentAt = new Date();
      await campaignLog.save();
    }
    return { success: false, message: error.message, data: null };
  }
}
