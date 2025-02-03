import CampaignLog from '@/models/CampaignLog';

/**
 * Sends a WhatsApp message via AiSensy and logs the campaign result.
 *
 * @param {Object} options
 * @param {Object} options.user - The user object containing _id, name, phoneNumber, etc.
 * @param {String} options.campaignName - Campaign name (e.g., "abandoned-cart-first-campaign").
 * @param {ObjectId} options.orderId - The order ID related to the campaign (can be null for testing).
 * @param {String[]} [options.templateParams] - Template placeholders.
 * @param {Array} [options.carouselCards] - Array of carousel card objects.
 *
 * @returns {Object} - { success: boolean, message: string, data?: Object }
 */
export async function sendWhatsAppMessage({
  user,
  campaignName,
  orderId,
  templateParams = [],
  carouselCards = [],
  countryCode = '91',
}) {
  let campaignLog;
  try {
    // Check if a successful message has already been sent for this user/order/campaign
    campaignLog = await CampaignLog.findOne({
      user: user._id,
      campaignName,
      order: orderId,
    });
    if (campaignLog && campaignLog.successfulCount >= 1) {
      console.log(
        `Message already successfully sent to user ${user._id} for campaign ${campaignName}. Skipping.`
      );
      return { success: false, message: 'Message already sent successfully for this campaign.' };
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

    const AISENSY_API_URL = "https://backend.aisensy.com/campaign/t1/api/v2";
    const AISENSY_API_KEY = process.env.AISENSY_API_KEY;

    if (!AISENSY_API_KEY) {
      console.error("AiSensy API Key is missing!");
      return { success: false, message: "AiSensy API key is missing. Check your .env.local file." };
    }

    // Build the payload for AiSensy
    const payload = {
      apiKey: AISENSY_API_KEY,
      campaignName, // e.g., "abandoned-cart-first-campaign"
      destination: user.phoneNumber.length === 10 ? `${countryCode}${user.phoneNumber}` : user.phoneNumber,
      userName: user.name || '',
      templateParams,
      carouselCards,
    };

    const response = await fetch(AISENSY_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.status === 401) {
      console.error("Unauthorized: Invalid API Key or permission issue.");
      campaignLog.totalCount += 1;
      campaignLog.failedCount += 1;
      campaignLog.lastSentAt = new Date();
      await campaignLog.save();
      return { success: false, message: "Unauthorized: Invalid AiSensy API key or permission issue." };
    }

    const result = await response.json();
    if (!response.ok) {
      console.error("AiSensy API Error:", result);
      campaignLog.totalCount += 1;
      campaignLog.failedCount += 1;
      campaignLog.lastSentAt = new Date();
      await campaignLog.save();
      return { success: false, message: result.message || "Failed to send AiSensy WhatsApp message" };
    }

    console.log("WhatsApp message sent successfully via AiSensy!", result);
    campaignLog.totalCount += 1;
    campaignLog.successfulCount += 1;
    campaignLog.lastSentAt = new Date();
    await campaignLog.save();
    return { success: true, message: "WhatsApp message sent successfully!", data: result };
  } catch (error) {
    console.error("Error in sendWhatsAppMessage:", error);
    if (campaignLog) {
      campaignLog.totalCount += 1;
      campaignLog.failedCount += 1;
      campaignLog.lastSentAt = new Date();
      await campaignLog.save();
    }
    return { success: false, message: error.message, data: null };
  }
}
