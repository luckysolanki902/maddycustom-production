// src/app/api/cron/aisensy/review-campaign/route.js
import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Order from '@/models/Order';
import Product from '@/models/Product';
import { sendWhatsAppMessage } from '@/lib/utils/aiSensySender';

export async function GET(req) {
  try {
    await connectToDatabase();
    const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

    // Define the time window:
    // - Orders must be at least 10 days old
    // - And they should be after Feb 1, 2025 (ensure this makes sense with your test data)
    const TEN_DAYS_IN_MS = 10 * 24 * 60 * 60 * 1000;
    const cutoffDate = new Date(Date.now() - TEN_DAYS_IN_MS);
    const FEB_1_2025 = new Date('2025-02-01T00:00:00Z');

    // Find orders that were created between Feb 1, 2025 and 10 days ago and have been delivered
    const orders = await Order.find({
      createdAt: { $gte: FEB_1_2025, $lte: cutoffDate },
      deliveryStatus: 'delivered',
    })
      .limit(50)
      .populate('user')
      .populate('items.product')
      .exec();

    if (!orders.length) {
      return NextResponse.json({ message: 'No orders found for review campaign.' });
    }

    let sentCount = 0;
    let details = [];

    for (const order of orders) {
      // Skip orders if missing user/phone or if items are absent
      if (!order.user || !order.user.phoneNumber) {
        details.push({
          orderId: order._id,
          status: 'skipped',
          reason: 'Missing user or phone number',
        });
        continue;
      }
      if (!order.items?.length) {
        details.push({
          orderId: order._id,
          status: 'skipped',
          reason: 'No items in order',
        });
        continue;
      }

      const firstItem = order.items[0];
      if (!firstItem?.product) {
        details.push({
          orderId: order._id,
          status: 'skipped',
          reason: 'First item does not contain product details',
        });
        continue;
      }

      // Extract necessary details
      const userName = order.user.name || 'Customer';
      const product = firstItem.product;
      const productName = product.name || 'your product';
      const pageSlug = product.pageSlug || '';

      const templateParams = [productName];

      // Example media attachment (adjust URL and filename as needed)
      const media = {
        url: `${baseImageUrl}/assets/marketing/aisensy-whatsapp-media/customers_matters.jpg`,
        filename: 'customer-matters',
      };

      // Example button directing user to the reviews section on the product page
      const buttons = [
        {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [
            {
              type: 'text',
              text: `${pageSlug.startsWith('/') ? '' : '/'}${pageSlug}#reviews`,
            },
          ],
        },
      ];

      // Build a simplified user object to pass along
      const userObj = {
        _id: order.user._id,
        name: order.user.name,
        phoneNumber: order.user.phoneNumber,
      };

      // Call the AiSensy sender
      const result = await sendWhatsAppMessage({
        user: userObj,
        campaignName: 'review_all',
        orderId: order._id,
        templateParams,
        prefUserName: userObj.name,
        media,
        buttons,
      });

      if (result.success) {
        sentCount++;
      } else {
        // Log the failure reason for this order/user
        console.error(
          `Failed to send message for Order ${order._id} (User: ${userObj.phoneNumber}): ${result.message}`
        );
      }

      // Add detailed info for this order, including failure reason if present
      details.push({
        orderId: order._id,
        user: userObj,
        status: result.success ? 'sent' : 'failed',
        failureReason: result.success ? null : result.message,
        result,
      });
    }

    return NextResponse.json({
      message: `Review campaign completed. Orders checked: ${orders.length}, Successfully sent: ${sentCount}.`,
      details,
    });
  } catch (error) {
    console.error('Error in review-campaign route:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
