#!/usr/bin/env node

const path = require('path');
const mongoose = require('mongoose');
const { loadEnvConfig } = require('@next/env');

const projectRoot = path.resolve(__dirname, '..', '..');
loadEnvConfig(projectRoot);

if (!process.env.MONGODB_URI) {
  console.error('Missing MONGODB_URI in environment.');
  process.exit(1);
}

require('../../src/models/User');
const Order = require('../../src/models/Order').default || require('../../src/models/Order');

async function main() {
  const orderId = process.argv[2];
  if (!orderId) {
    console.error('Usage: node scripts/debug/inspect-order.js <orderId>');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const order = await Order.findById(orderId)
      .populate('user', 'email phoneNumber name')
      .lean();
    if (!order) {
      console.error('Order not found');
      process.exit(1);
    }

    console.log(JSON.stringify({
      orderId: order._id,
      amountDueOnline: order.paymentDetails?.amountDueOnline,
      payuDetails: order.paymentDetails?.payuDetails,
      customer: {
        name: order.address?.receiverName || order.user?.name,
        email: order.user?.email || order.address?.receiverEmail,
        phone: order.address?.receiverPhoneNumber || order.user?.phoneNumber,
      },
      udf: {
        udf1: order._id?.toString(),
        udf2: order.orderGroupId || '',
        udf3: order.paymentDetails?.payuDetails?.method || '',
      },
      address: order.address,
    }, null, 2));
  } catch (err) {
    console.error('Failed to inspect order:', err);
  } finally {
    await mongoose.disconnect();
  }
}

main();
