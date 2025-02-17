// src/app/api/cron/aisensy/review-campaign/route.js
import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Order from '@/models/Order';
import User from '@/models/User';
import Product from '@/models/Product';
import { sendWhatsAppMessage } from '@/lib/utils/aiSensySender';

export async function GET(req) {
    try {
        const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL
        await connectToDatabase();

        // 10 days in milliseconds
        const TEN_DAYS_IN_MS = 10 * 24 * 60 * 60 * 1000;
        const cutoffDate = new Date(Date.now() - TEN_DAYS_IN_MS);

        // Find orders older than 10 days where deliveryStatus is empty/null
        const orders = await Order.find({
            createdAt: { $lte: cutoffDate },
            $or: [
                { deliveryStatus: 'delivered' }
            ],
        })
            .limit(50) // Limit to 10 orders per fetch
            .populate('user')           // To access user details (phoneNumber, name, etc.)
            .populate('items.product'); // So we can get product details (pageSlug, etc.)

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

            // Prepare template params (adjust to match your AiSensy template placeholders)
            // e.g., If your AiSensy template placeholders are {{1}} = userName, {{2}} = itemName
            const templateParams = [
                // userName,
                productName];

            // Always send the same static media file
            const media = {
                url: `${baseImageUrl}/assets/marketing/aisensy-whatsapp-media/customers_matters.jpg`, // Replace this with your actual file URL
                filename: 'customer-matters',            
            };

            // Prepare the button to direct user to the product’s review page
            // The template in AiSensy must have a button with sub_type "url" to handle this
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

            // Send WhatsApp message
            const result = await sendWhatsAppMessage({
                user: order.user,
                campaignName: 'review_all',
                orderId: order._id,
                templateParams,
                media,
                buttons,
            });

            if (result.success) sentCount++;
        }

        return NextResponse.json({
            message: `Review campaign completed. Orders checked: ${orders.length}, Successfully sent: ${sentCount}.`,
        });
    } catch (error) {
        console.error('Error in review-campaign route:', error);
        return NextResponse.json({ message: error.message }, { status: 500 });
    }
}
