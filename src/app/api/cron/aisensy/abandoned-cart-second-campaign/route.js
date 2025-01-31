import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Order from '@/models/Order';
import User from '@/models/User';
import { sendWhatsAppMessage } from '@/lib/utils/aiSensySender';

/**
 * GET /api/cron/abandoned-cart-second-campaign?testing=true
 */
export async function GET(req) {
  try {
    await connectToDatabase();

    const isTesting = true;

    if (isTesting) {
      // Testing Mode: Collect sender information without sending
      // Define Time Window: 12 hours < order age < 14 hours
      const now = new Date();
      const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);
      const fourteenHoursAgo = new Date(now.getTime() - 14 * 60 * 60 * 1000);

      const pipeline = [
        // Stage 1: Filter orders within the time window and with specific payment statuses
        {
          $match: {
            createdAt: { $gte: fourteenHoursAgo, $lte: twelveHoursAgo },
            paymentStatus: { $in: ['pending', 'failed', 'cancelled'] },
          },
        },
        // Stage 2: Sort orders by user and createdAt descending
        {
          $sort: { user: 1, createdAt: -1 },
        },
        // Stage 3: Group by user and select the most recent order
        {
          $group: {
            _id: '$user',
            mostRecentOrder: { $first: '$$ROOT' },
          },
        },
        // Stage 4: Lookup user details
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'userDetails',
          },
        },
        { $unwind: '$userDetails' },
        // Stage 5: Project necessary fields
        {
          $project: {
            orderId: '$mostRecentOrder._id',
            userId: '$userDetails._id',
            userName: '$userDetails.name',
            phoneNumber: '$userDetails.phoneNumber',
            createdAt: '$mostRecentOrder.createdAt',
            totalAmount: '$mostRecentOrder.totalAmount',
            paymentStatus: '$mostRecentOrder.paymentStatus',
          },
        },
        // Stage 6: Sort by createdAt ascending (oldest first)
        {
          $sort: { createdAt: 1 },
        },
      ];

      const abandonedOrders = await Order.aggregate(pipeline).exec();

      if (!abandonedOrders.length) {
        return NextResponse.json({ message: 'No abandoned orders in [12-14 hrs] window', senders: [] });
      }

      // Prepare the senders list
      const senders = abandonedOrders.map(order => ({
        phoneNumber: order.phoneNumber,
        name: order.userName,
        orderDateTime: order.createdAt.toLocaleString(),
        orderTotalAmount: order.totalAmount,
      }));

      // Return the sorted senders array
      return NextResponse.json({
        message: 'Testing mode: Retrieved senders list.',
        senders,
      });
    }

    // Production Mode: Proceed with sending messages
    // Define Time Window: 12 hours < order age < 14 hours
    const now = new Date();
    const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    const fourteenHoursAgo = new Date(now.getTime() - 14 * 60 * 60 * 1000);

    const pipeline = [
      // Stage 1: Filter orders within the time window and with specific payment statuses
      {
        $match: {
          createdAt: { $gte: fourteenHoursAgo, $lte: twelveHoursAgo },
          paymentStatus: { $in: ['pending', 'failed', 'cancelled'] },
        },
      },
      // Stage 2: Sort orders by user and createdAt descending
      {
        $sort: { user: 1, createdAt: -1 },
      },
      // Stage 3: Group by user and select the most recent order
      {
        $group: {
          _id: '$user',
          mostRecentOrder: { $first: '$$ROOT' },
        },
      },
      // Stage 4: Lookup user details
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userDetails',
        },
      },
      { $unwind: '$userDetails' },
      // Stage 5: Project necessary fields
      {
        $project: {
          orderId: '$mostRecentOrder._id',
          userId: '$userDetails._id',
          userName: '$userDetails.name',
          phoneNumber: '$userDetails.phoneNumber',
          createdAt: '$mostRecentOrder.createdAt',
          totalAmount: '$mostRecentOrder.totalAmount',
          paymentStatus: '$mostRecentOrder.paymentStatus',
        },
      },
    ];

    const abandonedOrders = await Order.aggregate(pipeline).exec();

    if (!abandonedOrders.length) {
      return NextResponse.json({ message: 'No abandoned orders in [12-14 hrs] window' });
    }

    // Loop through each abandoned order and send the message
    let sentCount = 0;
    for (const order of abandonedOrders) {
      const { userId, userName, phoneNumber, orderId } = order;

      // Reusable function with isTesting = false
      const result = await sendWhatsAppMessage({
        user: {
          _id: userId,
          name: userName,
          phoneNumber: phoneNumber,
        },
        campaignName: 'abandoned_cart_second_campaign',
        orderId: orderId,
        templateParams: [userName || 'Friend'], // Adjust based on your template placeholders
        isTesting: false, // Set to true for testing
      });

      if (result.success) sentCount++;
    }

    return NextResponse.json({
      message: `Abandoned Cart Second Campaign executed. Messages attempted: ${abandonedOrders.length}, successfully sent: ${sentCount}`,
    });
  } catch (error) {
    console.error('Error in second-campaign cron:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
