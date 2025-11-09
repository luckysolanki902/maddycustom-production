// src/app/api/cron/aisensy/review-campaign/route.js
import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Order from '@/models/Order';
import { sendWhatsAppMessage } from '@/lib/utils/aiSensySender';

const IST_TIME_ZONE = 'Asia/Kolkata';
const IST_ISO_OFFSET = '+05:30';

const padTo2Digits = (value) => value.toString().padStart(2, '0');

const getIstYearAndMonth = (date) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
  });

  const parts = formatter.formatToParts(date);

  return {
    year: Number(parts.find((part) => part.type === 'year').value),
    month: Number(parts.find((part) => part.type === 'month').value),
  };
};

const buildIstDate = (year, month, day) =>
  new Date(`${year}-${padTo2Digits(month)}-${padTo2Digits(day)}T00:00:00${IST_ISO_OFFSET}`);

export async function GET(req) {
  try {
    await connectToDatabase();
    const now = new Date();
    const { year: istYear, month: istMonth } = getIstYearAndMonth(now);

    // Determine the 15th boundaries in IST for the current and previous month
    const currentMonthBoundary = buildIstDate(istYear, istMonth, 15);
    const previousMonth = istMonth === 1 ? 12 : istMonth - 1;
    const previousMonthYear = istMonth === 1 ? istYear - 1 : istYear;
    const previousMonthBoundary = buildIstDate(previousMonthYear, previousMonth, 15);

    const orders = await Order.find({
      createdAt: { $gte: previousMonthBoundary, $lt: currentMonthBoundary },
      deliveryStatus: 'delivered',
    })
      .sort({ createdAt: -1 })
      .populate('user')
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
      const userName = order.user.name || 'Customer';
      const firstName = userName.trim().split(/\s+/)[0] || 'Customer';
      const templateParams = [firstName];

      const userObj = {
        _id: order.user._id,
        name: order.user.name,
        phoneNumber: order.user.phoneNumber,
      };

      // Call the AiSensy sender
      const result = await sendWhatsAppMessage({
        user: userObj,
        campaignName: 'feedback_api',
        orderId: order._id,
        templateParams,
        prefUserName: firstName,
      });

      if (result.success) {
        sentCount++;
      } else {
        // Log the failure reason for this order/user
        // console.error(
        //   `Failed to send message for Order ${order._id} (User: ${userObj.phoneNumber}): ${result.message}`
        // );
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
      window: {
        start: previousMonthBoundary,
        end: currentMonthBoundary,
      },
    });
  } catch (error) {
    console.error('Error in review-campaign route:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
