import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Order from '@/models/Order';
import Product from '@/models/Product';
import { sendWhatsAppMessage } from '@/lib/utils/aiSensySender';

export async function GET(req) {
  try {
    await connectToDatabase();

    // Define Time Window: 12 hrs < order age < 14 hrs
    const now = new Date();
    const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    const fourteenHoursAgo = new Date(now.getTime() - 14 * 60 * 60 * 1000);
    const imageBaseUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
    const pipeline = [
      {
        $match: {
          createdAt: { $gte: fourteenHoursAgo, $lte: twelveHoursAgo },
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
      return NextResponse.json({ message: 'No abandoned orders in [12-14 hrs] window' });
    }

    let sentCount = 0;
    for (const order of abandonedOrders) {
      const { userId, userName, phoneNumber, orderId, firstItem } = order;

      let carouselCards = [];
      if (firstItem && firstItem.product) {
        const product = await Product.findById(firstItem.product).lean();
        if (product && product.images && product.images.length > 0) {
          carouselCards.push({
            card_index: 0,
            components: [
              {
                type: "HEADER",
                parameters: [
                  { 
                    type: "image", 
                    image: { 
                      link: product.images[0].startsWith('/') 
                        ? `${imageBaseUrl}${product.images[0]}` 
                        : `${imageBaseUrl}/${product.images[0]}` 
                    } 
                  }
                ]
              },
              {
                type: "BUTTON",
                sub_type: "URL",
                index: 0,
                parameters: [
                  { type: "text", text: "#SAMPLE-CLICK-TRACKING#" }
                ]
              }
            ]
          });
        }
      }

      const result = await sendWhatsAppMessage({
        user: { _id: userId, name: userName, phoneNumber },
        campaignName: 'abandoned-cart-second-campaign',
        orderId,
        templateParams: [userName || 'Friend'],
        carouselCards,
      });

      if (result.success) sentCount++;
    }

    return NextResponse.json({
      message: `Abandoned Cart Second Campaign executed. Messages attempted: ${abandonedOrders.length}, successfully sent: ${sentCount}`,
    });
  } catch (error) {
    console.error("Error in second-campaign cron:", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
