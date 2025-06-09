// src/app/api/cron/aisensy/abandoned-cart-first-campaign/route.js
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
    const sixtyMinsAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const imageBaseUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
    const commonImage = imageBaseUrl + '/assets/marketing/aisensy-whatsapp-media/abandoned-cart-free-delivery1.png';
    const useCommonImage = false;
    
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
      return NextResponse.json({ message: 'No abandoned orders in [30-60 mins] window after correcting time calculation' });
    }

    let sentCount = 0;
    for (const order of abandonedOrders) {
      const { userId, userName, phoneNumber, orderId, firstItem } = order;

      // Build carousel cards based on the official AiSensy format
      let carouselCards = [];
      
      if (useCommonImage) {
        // Use common image for all users
        carouselCards = [{
          card_index: 0,
          components: [
            {
              type: "HEADER",
              parameters: [
                {
                  type: "image",
                  image: {
                    link: commonImage
                  }
                }
              ]
            },
            {
              type: "BUTTON",
              sub_type: "URL",
              index: 0,
              parameters: [
                {
                  type: "text",
                  text: `https://maddycustom.in/product/${firstItem?.product || ''}`
                }
              ]
            }
          ]
        }];
      } else if (firstItem && firstItem.product) {
        const product = await Product.findById(firstItem.product).lean();
        if (product && product.images && product.images.length > 0) {
          // Get product images - max 5
          const imagesToUse = [...product.images].slice(0, 5);
          
          // If there's a thumbnail, prioritize it
          if (firstItem.thumbnail) {
            const thumbnailUrl = firstItem.thumbnail.startsWith('/')
              ? `${imageBaseUrl}${firstItem.thumbnail}`
              : `${imageBaseUrl}/${firstItem.thumbnail}`;
              
            imagesToUse[0] = firstItem.thumbnail;
          }
          
          // Create carousel cards in proper format (max 5)
          carouselCards = imagesToUse.map((image, index) => {
            const imageUrl = image.startsWith('/')
              ? `${imageBaseUrl}${image}`
              : `${imageBaseUrl}/${image}`;
            
            return {
              card_index: index,
              components: [
                {
                  type: "HEADER",
                  parameters: [
                    {
                      type: "image",
                      image: {
                        link: imageUrl
                      }
                    }
                  ]
                },
                {
                  type: "BUTTON",
                  sub_type: "URL",
                  index: 0,
                  parameters: [
                    {
                      type: "text",
                      text: `https://maddycustom.in/product/${product._id}`
                    }
                  ]
                }
              ]
            };
          });
        }
      }

      const payload = {
        user: { _id: userId, name: userName, phoneNumber },
        campaignName: 'ac_1',
        orderId,
        templateParams: [userName.split(' ')[0] || 'Friend'],
        carouselCards,
      };

      const result = await sendWhatsAppMessage(payload);

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
