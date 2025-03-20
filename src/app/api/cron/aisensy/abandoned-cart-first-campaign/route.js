// src/app/api/cron/aisensy/abandoned-cart-first/route.js
import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Order from '@/models/Order';
import Product from '@/models/Product';
import { sendWhatsAppMessage } from '@/lib/utils/aiSensySender';

export async function GET(req) {
  try {
    await connectToDatabase();

    // Define Time Window: 30 mins < order age < 60 mins
    const now = new Date();
    const thirtyMinsAgo = new Date(now.getTime() - 30 * 60 * 1000);
    const sixtyMinsAgo = new Date(now.getTime() - 60 * 60 * 10000);
    const imageBaseUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

    const pipeline = [
      {
        $match: {
          createdAt: { $gte: sixtyMinsAgo, $lte: thirtyMinsAgo },
          paymentStatus: { $in: ['pending', 'failed', 'cancelled'] },
        },
      },
      { $sort: { user: 1, createdAt: -1 } },
      {
        $group: {
          _id: '$user',
          mostRecentOrder: { $first: '$$ROOT' },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userDetails',
        },
      },
      { $unwind: '$userDetails' },
      {
        $project: {
          orderId: '$mostRecentOrder._id',
          userId: '$userDetails._id',
          userName: '$userDetails.name',
          phoneNumber: '$userDetails.phoneNumber',
          createdAt: '$mostRecentOrder.createdAt',
          totalAmount: '$mostRecentOrder.totalAmount',
          paymentStatus: '$mostRecentOrder.paymentStatus',
          firstItem: { $arrayElemAt: ['$mostRecentOrder.items', 0] },
        },
      },
      { $sort: { createdAt: 1 } },
    ];

    const abandonedOrders = await Order.aggregate(pipeline).exec();
    if (!abandonedOrders.length) {
      return NextResponse.json({ message: 'No abandoned orders in [30-60 mins] window' });
    }

    let sentCount = 0;
    for (const order of abandonedOrders) {
      const { userId, userName, phoneNumber, orderId, firstItem } = order;

      // Build media object instead of carouselCards
      let media = null;
      if (firstItem && firstItem.product) {
        const product = await Product.findById(firstItem.product).lean();
        if (product && product.images && product.images.length > 0) {
          media = {
            url: product.images[0].startsWith('/')
              ? `${imageBaseUrl}${product.images[0]}`
              : `${imageBaseUrl}/${product.images[0]}`,
            filename: 'product-image'
          };
        }
      }

      const result = await sendWhatsAppMessage({
        user: { _id: userId, name: userName, phoneNumber },
        campaignName: 'abandonedcart_rem1',
        orderId,
        // templateParams: [userName || 'Friend'],
        media,
      });

      if (result.success) sentCount++;
    }

    return NextResponse.json({
      message: `Abandoned Cart First Campaign executed. Messages attempted: ${abandonedOrders.length}, successfully sent: ${sentCount}`,
    });
  } catch (error) {
    console.error("Error in first-campaign cron:", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
