// @/lib/utils/aiSensySender.js
import CampaignLog from '@/models/CampaignLog';

/**
 * Sends a WhatsApp message via AiSensy and logs the campaign result.
 *
 * @param {Object} options
 * @param {Object} options.user - The user object containing _id, name, phoneNumber, etc.
 * @param {String} [options.prefUserName] - If you want to override user name in the greeting.
 * @param {String} options.campaignName - The AiSensy campaign name (e.g. "order_confirmed").
 * @param {ObjectId} [options.orderId] - The related order ID, if applicable.
 * @param {String[]} [options.templateParams] - AiSensy template placeholders.
 * @param {Array} [options.carouselCards] - AiSensy carousel cards in proper format.
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
  isOTPCampaign = false,
}) {
  let campaignLog;
  
  try {
    // Skip all campaign log operations for OTP campaigns
    if (!isOTPCampaign) {
      // 1. Use findOneAndUpdate with upsert to atomically create/find the campaign log
      // This prevents race conditions by ensuring only one record exists
      try {
        campaignLog = await CampaignLog.findOneAndUpdate(
          {
            user: user._id,
            order: orderId,
            campaignName,
          },
          {
            $setOnInsert: {
              user: user._id,
              order: orderId,
              campaignName,
              source: 'aisensy',
              medium: 'whatsapp',
              phoneNumber: user.phoneNumber,
              totalCount: 0,
              successfulCount: 0,
              failedCount: 0,
            }
          },
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true
          }
        );
      } catch (duplicateError) {
        // Handle duplicate key error - fetch the existing record
        if (duplicateError.code === 11000) {
          campaignLog = await CampaignLog.findOne({
            user: user._id,
            order: orderId,
            campaignName,
          });
        } else {
          throw duplicateError;
        }
      }

      // If we already have a successful send, skip to avoid duplicates
      if (campaignLog && campaignLog.successfulCount >= 1) {
        return {
          success: false,
          message: 'Message already sent successfully for this campaign.',
        };
      }
    }

    // 3. Prepare AiSensy request
    const AISENSY_API_URL = 'https://backend.aisensy.com/campaign/t1/api/v2';
    const AISENSY_API_KEY = process.env.AISENSY_API_KEY;

    if (!AISENSY_API_KEY) {
      return {
        success: false,
        message: 'AiSensy API key is missing. Check your environment config.',
      };
    }

    // Double-check for duplicates right before sending (extra safety)
    if (!isOTPCampaign && campaignLog && campaignLog.successfulCount >= 1) {
      return {
        success: false,
        message: 'Message already sent successfully for this campaign (pre-send check).',
      };
    }

    // Build the payload for AiSensy
    const payload = {
      apiKey: AISENSY_API_KEY,
      campaignName,
      destination:
        user.phoneNumber.length === 10
          ? `${countryCode}${user.phoneNumber}`
          : user.phoneNumber,
      userName: prefUserName || user.name || '',
      templateParams,
    };

    if (carouselCards && carouselCards.length > 0) {
      payload.carouselCards = carouselCards;
    }
    if (media) {
      payload.media = media;
    }
    if (buttons?.length) {
      payload.buttons = buttons;
    }

    // 4. Make the request to AiSensy
    const response = await fetch(AISENSY_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });    // If the HTTP status indicates "unauthorized", handle separately
    if (response.status === 401) {
      // Only update campaign log if not an OTP campaign
      if (!isOTPCampaign && campaignLog) {
        await CampaignLog.findByIdAndUpdate(campaignLog._id, {
          $inc: { totalCount: 1, failedCount: 1 },
          $set: { lastSentAt: new Date() }
        });
      }

      return {
        success: false,
        message: 'Unauthorized: Invalid AiSensy API key or permission issue.',
      };
    }    // 5. Parse AiSensy JSON response
    let result;
    try {
      result = await response.json();
    } catch (parseErr) {
      // Only update campaign log if not an OTP campaign
      if (!isOTPCampaign && campaignLog) {
        await CampaignLog.findByIdAndUpdate(campaignLog._id, {
          $inc: { totalCount: 1, failedCount: 1 },
          $set: { lastSentAt: new Date() }
        });
      }

      return {
        success: false,
        message: 'AiSensy response was not valid JSON.',
      };
    }    // 6. Check if AiSensy indicated success in the JSON
    //    - "AiSensy" might return "success: false" but still give a 2xx status.
    if (!response.ok || !result?.success) {
      // Only update campaign log if not an OTP campaign
      if (!isOTPCampaign && campaignLog) {
        await CampaignLog.findByIdAndUpdate(campaignLog._id, {
          $inc: { totalCount: 1, failedCount: 1 },
          $set: { lastSentAt: new Date() }
        });
      }

      return {
        success: false,
        message: result?.message || 'AiSensy responded with an error.',
        data: result,
      };
    }

    // 7. If everything looks good, mark success
    // Only update campaign log if not an OTP campaign
    if (!isOTPCampaign && campaignLog) {
      await CampaignLog.findByIdAndUpdate(campaignLog._id, {
        $inc: { totalCount: 1, successfulCount: 1 },
        $set: { lastSentAt: new Date() }
      });
    }

    return {
      success: true,
      message: 'WhatsApp message sent successfully!',
      data: result,
    };  } catch (error) {
    // Only update campaign log if not an OTP campaign
    if (!isOTPCampaign && campaignLog) {
      await CampaignLog.findByIdAndUpdate(campaignLog._id, {
        $inc: { totalCount: 1, failedCount: 1 },
        $set: { lastSentAt: new Date() }
      });
    }

    return {
      success: false,
      message: error.message || 'An error occurred while sending the WhatsApp message.',
      data: null,
    };
  }
}
