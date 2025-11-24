import { sendPurchaseEvent } from '@/lib/analytics/metaCapi';
import { sendWhatsAppMessage } from '@/lib/utils/aiSensySender';
import User from '@/models/User';

export async function handlePostPaymentSuccess(orders, logs = []) {
  const timestampStr = new Date().toLocaleString('en-IN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });

  // 1. Send Meta CAPI Event (Async)
  try {
    for (const ord of orders) {
      if (['allPaid', 'paidPartially'].includes(ord.paymentStatus) && !ord.isTestingOrder) {
        // Send purchase event
        // Note: analyticsInfo is part of the order document
        await sendPurchaseEvent(ord, ord.analyticsInfo);
        logs.push(`[${timestampStr}] Meta Purchase event sent for order ${ord._id}`);
      }
    }
  } catch (metaErr) {
    console.error('Meta CAPI failed:', metaErr);
    logs.push(`[${timestampStr}] Meta CAPI failed: ${metaErr.message}`);
  }

  // 2. Send WhatsApp Notification (Async)
  try {
    // Use the main order for WhatsApp notification
    const mainOrder = orders.find(ord => ord.isMainOrder) || orders[0];
    
    if (mainOrder && !mainOrder.isTestingOrder) {
      // Handle both populated and unpopulated user field
      const userId = mainOrder.user?._id || mainOrder.user;
      const userDoc = await User.findById(userId);
      
      if (userDoc) {
        const buttons = [
          {
            type: 'button',
            sub_type: 'url',
            index: '0',
            parameters: [
              {
                type: 'text',
                text: mainOrder._id?.toString() || 'Order ID',
              },
            ],
          },
        ];
        await sendWhatsAppMessage({
          user: userDoc,
          prefUserName: mainOrder.address.receiverName || '',
          campaignName:
            new Date().getTime() < new Date('2025-04-03T00:00:00.000Z').getTime()
              ? 'delay_eid'
              : 'order_confirmed',
          orderId: mainOrder._id,
          templateParams: [],
          carouselCards: [],
          buttons,
        });
        logs.push(`[${timestampStr}] WhatsApp message sent to user: ${userDoc._id}`);
      } else {
        logs.push(`[${timestampStr}] No matching user found for orderId: ${mainOrder._id}`);
      }
    } else {
      if (mainOrder) {
          logs.push(`[${timestampStr}] Skipping WhatsApp message (isTestingOrder = true).`);
      } else {
          logs.push(`[${timestampStr}] No main order found for WhatsApp message.`);
      }
    }
  } catch (msgErr) {
    const mainOrder = orders.find(ord => ord.isMainOrder) || orders[0];
    console.error(`WhatsApp message failed for order ${mainOrder?._id}:`, msgErr);
    logs.push(`[${timestampStr}] WhatsApp message sending failed (error logged).`);
  }
}
