// app/api/webhooks/razorpay/verify-payment/route.js

// Import necessary modules
import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Order from '@/models/Order';
import Coupon from '@/models/Coupon'; // Import Coupon model
import { createShiprocketOrder, getDimensionsAndWeight } from '@/lib/utils/shiprocket';
import crypto from 'crypto';
import mongoose from 'mongoose';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';
import Product from '@/models/Product';
import ModeOfPayment from '@/models/ModeOfPayment';

// Configuration to disable body parsing for raw body access.
export const config = {
  api: {
    bodyParser: false, // Disable body parsing to access raw body for signature verification
  },
};

/**
 * Handles POST requests from Razorpay webhooks to verify payments.
 * Ensures idempotency by checking paymentStatus and deliveryStatus.
 */
export async function POST(request) {
  console.info('Razorpay webhook request received');

  const session = await mongoose.startSession(); // Start a MongoDB session
  session.startTransaction(); // Start a transaction

  try {
    // Retrieve the raw body for signature verification
    const rawBody = await request.text();

    // Retrieve the webhook secret from environment variables
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('RAZORPAY_WEBHOOK_SECRET is not set.');
      return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
    }

    // Extract the signature and event ID from headers
    const signature = request.headers.get('x-razorpay-signature');
    const eventId = request.headers.get('x-razorpay-event-id');

    if (!signature) {
      console.warn('Missing signature header.');
      return NextResponse.json({ error: 'Missing signature header.' }, { status: 400 });
    }

    if (!eventId) {
      console.warn('Missing event ID header.');
      return NextResponse.json({ error: 'Missing event ID header.' }, { status: 400 });
    }

    // Compute the expected signature using HMAC SHA256
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    // Convert signatures to buffers for timing-safe comparison
    const receivedSignatureBuffer = Buffer.from(signature, 'hex');
    const expectedSignatureBuffer = Buffer.from(expectedSignature, 'hex');

    // Validate signature length to prevent timing attacks
    if (receivedSignatureBuffer.length !== expectedSignatureBuffer.length) {
      console.warn('Invalid signature length.');
      return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
    }

    // Perform timing-safe comparison of signatures
    const isValidSignature = crypto.timingSafeEqual(receivedSignatureBuffer, expectedSignatureBuffer);

    if (!isValidSignature) {
      console.warn('Invalid signature.');
      return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
    }

    // Parse the event payload
    let event;
    try {
      event = JSON.parse(rawBody);
    } catch (parseError) {
      console.error('Invalid JSON payload.', parseError);
      return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
    }

    // Connect to the database
    await connectToDatabase();

    // Handle only relevant events
    if (!['payment.captured', 'payment.failed'].includes(event.event)) {
      console.info(`Event type '${event.event}' is not handled.`);
      return NextResponse.json({ message: 'Event type not handled.' }, { status: 200 });
    }

    const payment = event.payload.payment.entity;
    const razorpayOrderId = payment.order_id;
    const paymentId = payment.id;
    const signatureDetail = payment.signature || '';

    // Extract internalOrderId from notes
    const internalOrderId = payment.notes.orderId;

    if (!internalOrderId) {
      console.warn('Missing internal order ID in payment notes.');
      return NextResponse.json({ error: 'Missing internal order ID in payment notes.' }, { status: 400 });
    }

    // Find the order by the internalOrderId with the current session
    const order = await Order.findById(internalOrderId)
      .populate('paymentDetails.mode')
      .populate({
        path: 'items.product',
        populate: {
          path: 'specificCategoryVariant',
          model: 'SpecificCategoryVariant',
        },
      })
      .session(session); // Associate with session

    if (!order) {
      console.warn(`Order not found for ID: ${internalOrderId}`);
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    // Prevent double processing if the payment ID is already recorded
    if (order.paymentDetails.razorpayDetails.paymentId === paymentId) {
      console.info('Payment already captured. Ignoring webhook.');

      // Optionally, log if Shiprocket order is already created or needs to be created
      if (order.shiprocketOrderId) {
        console.info(`Shiprocket order already exists for Order ID: ${internalOrderId}`);
      } else {
        console.warn(`Shiprocket order missing for Order ID: ${internalOrderId}`);
      }

      // Proceed to Shiprocket order creation logic if needed
    } else {
      // Handle payment events only if payment ID is new
      // If the order is already fully or partially paid, skip updates
      if (['allPaid', 'paidPartially'].includes(order.paymentStatus)) {
        console.info(`Order already in status '${order.paymentStatus}'. Skipping payment updates.`);
      } else {
        // Update payment details based on the event type
        if (event.event === 'payment.captured') {
          const paymentAmount = payment.amount / 100; // Convert paise to INR

          // Atomic update to prevent race conditions
          const updatedOrder = await Order.findOneAndUpdate(
            {
              _id: internalOrderId,
              paymentStatus: { $nin: ['allPaid', 'paidPartially'] },
            },
            {
              $set: {
                'paymentDetails.razorpayDetails.paymentId': paymentId,
                'paymentDetails.razorpayDetails.signature': signatureDetail,
              },
              $inc: {
                'paymentDetails.amountPaidOnline': paymentAmount,
                'paymentDetails.amountDueOnline': -paymentAmount,
              },
            },
            { new: true, session }
          ).exec();

          if (!updatedOrder) {
            console.warn('Order update failed. It might have been updated concurrently.');
            await session.abortTransaction(); // Abort transaction
            session.endSession();
            return NextResponse.json({ message: 'Order already updated.' }, { status: 200 });
          }

          // Update paymentStatus based on remaining dues
          if (
            updatedOrder.paymentDetails.amountDueOnline <= 0 &&
            updatedOrder.paymentDetails.amountDueCod <= 0
          ) {
            updatedOrder.paymentStatus = 'allPaid';
            console.info(`Order ID: ${internalOrderId} marked as 'allPaid'.`);
          } else if (
            updatedOrder.paymentDetails.amountPaidOnline > 0 &&
            updatedOrder.paymentDetails.amountDueCod > 0
          ) {
            updatedOrder.paymentStatus = 'paidPartially';
            console.info(`Order ID: ${internalOrderId} marked as 'paidPartially'.`);
          }

          // Increment usageCount for the applied coupon if not already done
          if (updatedOrder.couponApplied && updatedOrder.couponApplied.length > 0) {
            const appliedCoupon = updatedOrder.couponApplied[0]; // Assuming only one coupon is applied
            if (appliedCoupon.couponCode && !appliedCoupon.incrementedCouponUsage) {
              const coupon = await Coupon.findOne({ code: appliedCoupon.couponCode }).session(session).exec();
              if (coupon) {
                coupon.usageCount += 1;
                await coupon.save({ session });

                // Update the order's couponApplied to mark usage as incremented
                appliedCoupon.incrementedCouponUsage = true;
                updatedOrder.couponApplied = updatedOrder.couponApplied.map(couponEntry =>
                  couponEntry.couponCode === appliedCoupon.couponCode
                    ? { ...couponEntry.toObject(), incrementedCouponUsage: true }
                    : couponEntry
                );
                await updatedOrder.save({ session });
                console.info(`Coupon usage count incremented for code: ${appliedCoupon.couponCode}`);
              } else {
                console.warn(`Coupon not found for code: ${appliedCoupon.couponCode}`);
              }
            }
          }

          await updatedOrder.save({ session });
        } else if (event.event === 'payment.failed') {
          await Order.findByIdAndUpdate(
            internalOrderId,
            {
              'paymentDetails.razorpayDetails.paymentId': paymentId,
              paymentStatus: 'failed',
            },
            { session }
          ).exec();

          console.info(`Order ID: ${internalOrderId} marked as 'failed'.`);
          await session.commitTransaction(); // Commit transaction
          session.endSession();
          return NextResponse.json({ message: 'Payment failed.' }, { status: 200 });
        } else {
          console.info(`Unsupported event type: ${event.event}`);
          return NextResponse.json({ message: 'Unsupported event type.' }, { status: 400 });
        }
      }
    }

    // At this point, either:
    // - The payment was already recorded (and possibly in a paid state)
    // - The payment was just captured and updated
    // Now, check if Shiprocket order needs to be created

    // Re-fetch the order to get the latest state
    const latestOrder = await Order.findById(internalOrderId).session(session);

    if (!latestOrder) {
      console.warn(`Order not found on re-fetch for ID: ${internalOrderId}`);
      await session.abortTransaction();
      session.endSession();
      return NextResponse.json({ error: 'Order not found after update.' }, { status: 404 });
    }

    // Check if Shiprocket order needs to be created
    if (
      ['allPaid', 'paidPartially'].includes(latestOrder.paymentStatus) &&
      latestOrder.deliveryStatus === 'pending' &&
      !latestOrder.shiprocketOrderId
    ) {
      console.info(`Initiating Shiprocket order creation for Order ID: ${internalOrderId}`);

      // Populate the order with product and variant details
      await latestOrder.populate({
        path: 'items.product',
        populate: {
          path: 'specificCategoryVariant', // Populate specificCategoryVariant within each product
          model: 'SpecificCategoryVariant',
        },
      });

      let dimensionsAndWeight;
      try {
        // Pass populated items to the getDimensionsAndWeight function
        dimensionsAndWeight = await getDimensionsAndWeight(latestOrder.items);
      } catch (dimError) {
        console.error(
          `Dimension and Weight Calculation Error for Order ID ${internalOrderId}: ${dimError.message}`
        );
        await session.abortTransaction(); // Abort transaction
        session.endSession();
        return NextResponse.json({ error: dimError.message }, { status: 400 });
      }

      const { length, breadth, height, weight } = dimensionsAndWeight;
      const [firstName, ...lastNameParts] = latestOrder.address.receiverName.split(' ');
      const lastName = lastNameParts.join(' ');

      const shiprocketOrderData = {
        order_id: internalOrderId.toString(),
        order_date: new Date().toISOString(),
        billing_customer_name: firstName,
        billing_last_name: lastName || '',
        billing_address: `${latestOrder.address.addressLine1} ${latestOrder.address.addressLine2 || ''}`,
        billing_city: latestOrder.address.city,
        billing_pincode: latestOrder.address.pincode,
        billing_state: latestOrder.address.state,
        billing_country: latestOrder.address.country,
        billing_phone: latestOrder.address.receiverPhoneNumber,
        shipping_is_billing: true,
        order_items: latestOrder.items.map((item) => ({
          name: item.name,
          sku: item.sku,
          units: item.quantity,
          selling_price: item.priceAtPurchase,
        })),
        payment_method: latestOrder.paymentDetails.amountDueCod > 0 ? 'COD' : 'Prepaid',
        sub_total: latestOrder.paymentDetails.amountDueCod > 0 ? latestOrder.paymentDetails.amountDueCod : latestOrder.totalAmount,
        length: length,
        breadth: breadth,
        height: height,
        weight: weight,
      };

      try {
        // Create the Shiprocket order
        const response = await createShiprocketOrder(shiprocketOrderData);

        // Check if Shiprocket order creation was successful
        if (response.status_code === 1 && !response.packaging_box_error) {
          await Order.findByIdAndUpdate(
            latestOrder._id,
            {
              shiprocketOrderId: response.order_id,
              deliveryStatus: 'orderCreated',
            },
            { session }
          ).exec();

          console.info(`Shiprocket order created successfully for Order ID: ${internalOrderId}, Shiprocket Order ID: ${response.order_id}`);
        } else {
          console.error(
            `Failed to create Shiprocket order for Order ID ${internalOrderId}: ${JSON.stringify(response)}`
          );
          // Optionally, implement a retry mechanism or mark the order for manual review
          await session.abortTransaction(); // Abort transaction
          session.endSession();
          return NextResponse.json({ error: 'Failed to create Shiprocket order.' }, { status: 500 });
        }
      } catch (shiprocketError) {
        console.error(
          `Error in Shiprocket order creation for Order ID ${internalOrderId}: ${shiprocketError.message}`
        );
        // Optionally, implement a retry mechanism or mark the order for manual review
        await session.abortTransaction(); // Abort transaction
        session.endSession();
        return NextResponse.json({ error: 'Error in Shiprocket order creation.' }, { status: 500 });
      }
    } else {
      if (['allPaid', 'paidPartially'].includes(latestOrder.paymentStatus)) {
        console.info(`No Shiprocket order creation needed for Order ID: ${internalOrderId}. Current delivery status: '${latestOrder.deliveryStatus}', Shiprocket Order ID: '${latestOrder.shiprocketOrderId || 'Not Created'}'.`);
      } else {
        console.info(`Order ID: ${internalOrderId} payment status '${latestOrder.paymentStatus}' does not qualify for Shiprocket order creation.`);
      }
    }

    await session.commitTransaction(); // Commit transaction
    session.endSession();
    console.info(`Webhook processed successfully for Order ID: ${internalOrderId}`);
    return NextResponse.json({ message: 'Webhook processed successfully.' }, { status: 200 });
  } catch (error) {
    await session.abortTransaction(); // Abort transaction in case of error
    session.endSession();
    console.error('Error in webhook processing:', error);
    return NextResponse.json({ error: 'Internal Server Error.' }, { status: 500 });
  }
}
