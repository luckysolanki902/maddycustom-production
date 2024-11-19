import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Order from '@/models/Order';
import { createShiprocketOrder, getDimensionsAndWeight } from '@/lib/utils/shiprocket';
import crypto from 'crypto';
import mongoose from 'mongoose';

/**
 * Configuration to disable body parsing for raw body access.
 */
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
  try {
    const requestReceivedTime = new Date();
    console.log(
      `Received a request at ${requestReceivedTime.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: true,
      })}`
    );

    // Retrieve the raw body for signature verification
    const rawBody = await request.text();
    console.log('Raw Body:', rawBody); // Log raw body

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
      console.log('Parsed Event:', event); // Log parsed event
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

    // Find the order by the internalOrderId
    const order = await Order.findById(internalOrderId)
      .populate('paymentDetails.mode')
      .populate({
        path: 'items.product',
        populate: {
          path: 'specificCategoryVariant',
          model: 'SpecificCategoryVariant',
        },
      });

    if (!order) {
      console.warn('Order not found for ID:', internalOrderId);
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    // If the order is already fully or partially paid, skip updates
    if (['allPaid', 'paidPartially'].includes(order.paymentStatus)) {
      console.info(`Order already in status '${order.paymentStatus}'.`);
      return NextResponse.json(
        { message: `Order already in status '${order.paymentStatus}'.` },
        { status: 200 }
      );
    }

    // Prevent double processing if the payment ID is already recorded
    if (order.paymentDetails.razorpayDetails.paymentId === paymentId) {
      console.info('Payment already captured. Ignoring webhook.');
      return NextResponse.json(
        { message: 'Payment already captured. Ignoring webhook.' },
        { status: 200 }
      );
    }

    // Update payment details based on the event type
    if (event.event === 'payment.captured') {
      const paymentAmount = payment.amount / 100; // Convert paise to INR
      console.log(`Processing payment.captured for Order ID: ${internalOrderId}, Payment ID: ${paymentId}, Amount: ${paymentAmount}`);

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
        { new: true }
      ).exec();

      if (!updatedOrder) {
        console.warn('Order update failed. It might have been updated concurrently.');
        return NextResponse.json({ message: 'Order already updated.' }, { status: 200 });
      }

      // Update paymentStatus based on remaining dues
      if (
        updatedOrder.paymentDetails.amountDueOnline <= 0 &&
        updatedOrder.paymentDetails.amountDueCod <= 0
      ) {
        updatedOrder.paymentStatus = 'allPaid';
      } else if (
        updatedOrder.paymentDetails.amountPaidOnline > 0 &&
        updatedOrder.paymentDetails.amountDueCod > 0
      ) {
        updatedOrder.paymentStatus = 'paidPartially';
      }

      await updatedOrder.save();
      console.log(`Order payment status updated to '${updatedOrder.paymentStatus}' for Order ID: ${internalOrderId}`);

      // Create Shiprocket Order if payment is complete or partially complete
      if (['allPaid', 'paidPartially'].includes(updatedOrder.paymentStatus)) {
        if (!updatedOrder.shiprocketOrderId && updatedOrder.deliveryStatus === 'pending') {
          console.log(`Creating Shiprocket order for Order ID: ${internalOrderId}`);

          // Populate the order with product and variant details
          await updatedOrder.populate({
            path: 'items.product',
            populate: {
              path: 'specificCategoryVariant',  // Populate specificCategoryVariant within each product
              model: 'SpecificCategoryVariant',
            },
          });

          let dimensionsAndWeight;
          try {
            // Pass populated items to the getDimensionsAndWeight function
            dimensionsAndWeight = await getDimensionsAndWeight(updatedOrder.items);
            console.log('Calculated Dimensions and Weight:', dimensionsAndWeight);
          } catch (dimError) {
            console.error('Dimension and Weight Calculation Error:', dimError);
            return NextResponse.json({ error: dimError.message }, { status: 400 });
          }

          const { length, breadth, height, weight } = dimensionsAndWeight;
          const [firstName, ...lastNameParts] = updatedOrder.address.receiverName.split(' ');
          const lastName = lastNameParts.join(' ');

          const shiprocketOrderData = {
            order_id: internalOrderId.toString(),
            order_date: new Date().toISOString(),
            billing_customer_name: firstName,
            billing_last_name: lastName || '',
            billing_address: `${updatedOrder.address.addressLine1} ${updatedOrder.address.addressLine2 || ''}`,
            billing_city: updatedOrder.address.city,
            billing_pincode: updatedOrder.address.pincode,
            billing_state: updatedOrder.address.state,
            billing_country: updatedOrder.address.country,
            billing_phone: updatedOrder.address.receiverPhoneNumber,
            shipping_is_billing: true,
            order_items: updatedOrder.items.map((item) => ({
              name: item.name,
              sku: item.sku,
              units: item.quantity,
              selling_price: item.priceAtPurchase,
            })),
            payment_method: updatedOrder.paymentDetails.amountDueCod > 0 ? 'COD' : 'Prepaid',
            sub_total: updatedOrder.items.reduce((total, item) => total + item.priceAtPurchase * item.quantity, 0),
            length: length,
            breadth: breadth,
            height: height,
            weight: weight,
          };

          console.log('Shiprocket Order Data:', JSON.stringify(shiprocketOrderData, null, 2)); // Log complete Shiprocket order data

          try {
            // Create the Shiprocket order
            const response = await createShiprocketOrder(shiprocketOrderData);
            console.log('Shiprocket API Response:', response); // Log Shiprocket API response

            // Check if Shiprocket order creation was successful
            if (response.status_code === 1 && !response.packaging_box_error) {
              await Order.findByIdAndUpdate(updatedOrder._id, {
                shiprocketOrderId: response.order_id,
                deliveryStatus: 'orderCreated',
              }).exec();
              console.log(`Shiprocket order created successfully with Order ID: ${response.order_id}`);
            } else {
              console.error('Failed to create Shiprocket order:', response);
              return NextResponse.json({ error: 'Failed to create Shiprocket order.' }, { status: 500 });
            }
          } catch (shiprocketError) {
            console.error('Error in Shiprocket order creation:', shiprocketError);
            return NextResponse.json({ error: 'Error in Shiprocket order creation.' }, { status: 500 });
          }
        } else {
          console.log('Shiprocket order already exists or delivery status is not pending.');
        }
      }

      return NextResponse.json({ message: 'Webhook processed successfully.' }, { status: 200 });
    } else if (event.event === 'payment.failed') {
      await Order.findByIdAndUpdate(internalOrderId, {
        'paymentDetails.razorpayDetails.paymentId': paymentId,
        paymentStatus: 'failed',
      }).exec();
      console.log(`Payment failed for Order ID: ${internalOrderId}`);

      return NextResponse.json({ message: 'Payment failed.' }, { status: 200 });
    } else {
      console.info(`Unsupported event type: ${event.event}`);
      return NextResponse.json({ message: 'Unsupported event type.' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in webhook processing:', error);
    return NextResponse.json({ error: 'Internal Server Error.' }, { status: 500 });
  }
}
