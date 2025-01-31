import CampaignLog from '@/models/CampaignLog';
import Order from '@/models/Order';
import User from '@/models/User';

/**
 * Reusable function to send or simulate sending a WhatsApp message via AiSensy
 *
 * @param {Object} options
 * @param {Object} options.user - The user object containing _id, phoneNumber, name, etc.
 * @param {String} options.campaignName - Name of the campaign (e.g., 'firstAbandonedCart').
 * @param {ObjectId} [options.orderId] - The order ID relevant to the campaign.
 * @param {String[]} [options.templateParams] - AiSensy template placeholders.
 * @param {Boolean} [options.isTesting=true] - If true, only log and return sender info without sending.
 * @returns {Object} - Contains { success: boolean, message: string, data?: Object }
 */
export async function sendWhatsAppMessage({
  user,
  campaignName,
  orderId,
  templateParams = [],
  isTesting = true,
}) {
  try {
    if (isTesting) {
      // In testing mode, return the sender's information without modifying the database or sending messages
      const order = await Order.findById(orderId).lean();
      if (!order) {
        return { success: false, message: 'Order not found.', data: null };
      }

      return {
        success: true,
        message: 'Testing mode: Sender info retrieved.',
        data: {
          phoneNumber: user.phoneNumber,
          name: user.name,
          orderDateTime: order.createdAt.toLocaleString(), // Readable format
          orderTotalAmount: order.totalAmount,
        },
      };
    }

    // Production Mode: Proceed with sending the message

    // Check CampaignLog to prevent duplicate sends
    const existingLog = await CampaignLog.findOne({
      user: user._id,
      campaignName,
      order: orderId,
    });

    if (existingLog) {
      // If a message has already been sent for this campaign and order, skip
      console.log(`Message already sent to user ${user._id} for campaign ${campaignName}. Skipping.`);
      return { success: false, message: 'Message already sent for this campaign.' };
    }

    // Create a new CampaignLog entry
    await CampaignLog.create({
      user: user._id,
      order: orderId,
      campaignName,
      source: 'aisensy',
      medium: 'whatsapp',
      phoneNumber: user.phoneNumber, // Ensure this is in the correct format
      count: 1,
      lastSentAt: new Date(),
    });

    // Real AiSensy send
    const AISENSY_API_URL = "https://backend.aisensy.com/campaign/t1/api/v2";
    const AISENSY_API_KEY = process.env.AISENSY_API_KEY;

    if (!AISENSY_API_KEY) {
      console.error("AiSensy API Key is missing!");
      return {
        success: false,
        message: "AiSensy API key is missing. Check your .env.local file."
      };
    }

    const payload = {
      apiKey: AISENSY_API_KEY,
      campaignName, // AiSensy campaign name
      destination: `91${user.phoneNumber}`, // Adjust based on your phone number format
      userName: user.name || '', // Adjust based on your template placeholders
      templateParams,
    };

    const response = await fetch(AISENSY_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.status === 401) {
      console.error("Unauthorized: Invalid API Key or permission issue.");
      return {
        success: false,
        message: "Unauthorized: Invalid AiSensy API key or permission issue.",
      };
    }

    const result = await response.json();
    if (!response.ok) {
      console.error("AiSensy API Error:", result);
      return {
        success: false,
        message: result.message || "Failed to send AiSensy WhatsApp message",
      };
    }

    console.log("WhatsApp message sent successfully via AiSensy!", result);
    return { success: true, message: "WhatsApp message sent successfully!", data: result };
  } catch (error) {
    console.error("Error in sendWhatsAppMessage:", error);
    return { success: false, message: error.message, data: null };
  }
}
