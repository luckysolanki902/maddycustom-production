// src/app/api/cron/aisensy/review-campaign/route.js
import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Order from '@/models/Order';
import User from '@/models/User';
import Product from '@/models/Product';
import { sendWhatsAppMessage } from '@/lib/utils/aiSensySender';

export async function GET(req) {
    try {
        const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
        await connectToDatabase();

        // 10 days in milliseconds
        const TEN_DAYS_IN_MS = 10 * 24 * 60 * 60 * 1000;
        const cutoffDate = new Date(Date.now() - TEN_DAYS_IN_MS);

        // We also want to ensure orders are never before 1 Feb 2025
        const FEB_1_2025 = new Date('2025-02-01T00:00:00Z');

        // Find orders that:
        // - Have createdAt between FEB_1_2025 and cutoffDate (i.e. older than 10 days, but no earlier than Feb 1 2025)
        // - Have deliveryStatus 'delivered'
        const orders = await Order.find({
            createdAt: {
                $gte: FEB_1_2025,   // No earlier than Feb 1 2025
                $lte: cutoffDate,   // At least 10 days old
            },
            deliveryStatus: 'delivered',
        })
        .limit(50) // Limit to 50 orders per fetch (or 10, if you want)
        .populate('user')           // Access user details
        .populate('items.product'); // Access product details

        if (!orders.length) {
            return NextResponse.json({ message: 'No orders found for review campaign.' });
        }

        let sentCount = 0;

        for (const order of orders) {
            if (!order.user || !order.user.phoneNumber) continue; // Skip if user or phone not available
            if (!order.items?.length) continue;                  // Skip if no items

            const firstItem = order.items[0];
            if (!firstItem?.product) continue;

            // Access user & product details
            const userName = order.user.name || 'Customer';
            const product = firstItem.product;
            const productName = product.name || 'your product';
            const pageSlug = product.pageSlug || '';

            // Prepare your AiSensy template parameters
            const templateParams = [
                // userName,  // Add or remove as needed
                productName
            ];

            // Example media attachment
            const media = {
                url: `${baseImageUrl}/assets/marketing/aisensy-whatsapp-media/customers_matters.jpg`,
                filename: 'customer-matters',
            };

            // Example button to direct user to a "reviews" anchor on your site
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

            // Call your AiSensy utility
            const result = await sendWhatsAppMessage({
                user: order.user,
                campaignName: 'review_all',
                orderId: order._id,
                templateParams,
                media,
                buttons,
            });

            if (result.success) {
                sentCount++;
            }
        }

        return NextResponse.json({
            message: `Review campaign completed. Orders checked: ${orders.length}, Successfully sent: ${sentCount}.`,
        });
    } catch (error) {
        console.error('Error in review-campaign route:', error);
        return NextResponse.json({ message: error.message }, { status: 500 });
    }
}
