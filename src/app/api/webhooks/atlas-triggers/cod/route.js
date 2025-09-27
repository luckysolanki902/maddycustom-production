// app/api/webhooks/cod/verify-order/route.js

import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/middleware/connectToDb";
import mongoose from "mongoose";
import Order from "@/models/Order";
import Coupon from "@/models/Coupon";
import User from "@/models/User";
import Product from "@/models/Product";
import Option from "@/models/Option";
import { createShiprocketOrder, getDimensionsAndWeight } from "@/lib/utils/shiprocket";
import { sendWhatsAppMessage } from "@/lib/utils/aiSensySender";

// Helper: Update inventory
async function updateInventory(inventoryId, delta, session) {
  return await mongoose
    .model("Inventory")
    .updateOne({ _id: inventoryId }, { $inc: { availableQuantity: delta, reservedQuantity: -delta } }, { session });
}

export async function POST(req) {
  await connectToDatabase();
  const session = await mongoose.startSession();
  session.startTransaction();

  const logs = [];
  let orderId = null;

  try {
    const body = await req.json();
    orderId = body.orderId;

    if (!orderId) return NextResponse.json({ error: "No orderId provided." }, { status: 400 });

    // 1. Fetch main order and linked orders
    const order = await Order.findById(orderId).session(session);
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

    const linkedOrders = order.linkedOrderIds?.length
      ? await Order.find({ _id: { $in: order.linkedOrderIds } }).session(session)
      : [];

    const allOrders = [order, ...linkedOrders];

    // 2. Mark COD payment as "paidPartially" or "allPaid"
    for (const ord of allOrders) {
      	// if (!["allPaid", "paidPartially"].includes(ord.paymentStatus)) {
      	// 	ord.paymentDetails.amountPaidOnline = 0;
      	// 	ord.paymentDetails.amountDueOnline = 0;
				
      	// 	if (ord.paymentDetails.amountDueCod <= 0) ord.paymentStatus = "allPaid";
        // 		else ord.paymentStatus = "paidPartially";
				// }

      	ord.paymentStatus = "allToBePaidCod";

        await ord.save({ session });
    }

    // 3. Handle coupon usage increment (main order only)
    const mainOrder = allOrders.find(ord => ord.isMainOrder) || allOrders[0];
    if (mainOrder.couponApplied?.length > 0) {
      const [appliedCoupon] = mainOrder.couponApplied;
      if (appliedCoupon.couponCode && !appliedCoupon.incrementedCouponUsage) {
        const couponDoc = await Coupon.findOne({ code: appliedCoupon.couponCode }).session(session);
        if (couponDoc) {
          couponDoc.usageCount += 1;
          await couponDoc.save({ session });

          // Propagate incremented flag to all orders
          for (const ord of allOrders) {
            if (ord.couponApplied?.length) {
              ord.couponApplied = ord.couponApplied.map(c =>
                c.couponCode === appliedCoupon.couponCode ? { ...c.toObject(), incrementedCouponUsage: true } : c
              );
              await ord.save({ session });
            }
          }
          logs.push(`Coupon usage incremented: ${appliedCoupon.couponCode}`);
        }
      }
    }

    // 4. Deduct inventory
    for (const ord of allOrders) {
      if (!ord.inventoryDeducted && !ord.isTestingOrder) {
        for (const item of ord.items) {
          if (item.option) {
            const optionDoc = await Option.findById(item.option).session(session);
            if (optionDoc?.inventoryData) {
              await updateInventory(optionDoc.inventoryData, -item.quantity, session);
            }
          } else if (item.product) {
            const productDoc = await Product.findById(item.product).session(session);
            if (productDoc?.inventoryData) {
              await updateInventory(productDoc.inventoryData, -item.quantity, session);
            }
          }
        }
        ord.inventoryDeducted = true;
        await ord.save({ session });
      }
    }

    // 5. Create Shiprocket orders
    const updatedOrders = await Promise.all(
      allOrders.map(ord =>
        Order.findById(ord._id)
          .populate({
            path: "items.product",
            populate: { path: "specificCategoryVariant", model: "SpecificCategoryVariant" },
          })
          .session(session)
      )
    );

    for (const ord of updatedOrders) {
      if (ord.deliveryStatus === "pending" && !ord.shiprocketOrderId && !ord.isTestingOrder) {
        try {
          const { length, breadth, height, weight } = await getDimensionsAndWeight(ord.items);
          const [firstName, ...rest] = ord.address.receiverName.split(" ");
          const lastName = rest.join(" ");

          const shiprocketOrderData = {
            order_id: ord._id.toString(),
            order_date: new Date().toISOString(),
            billing_customer_name: firstName,
            billing_last_name: lastName || "",
            billing_address: `${ord.address.addressLine1} ${ord.address.addressLine2 || ""}`,
            billing_city: ord.address.city,
            billing_pincode: ord.address.pincode,
            billing_state: ord.address.state,
            billing_country: ord.address.country,
            billing_phone: ord.address.receiverPhoneNumber,
            shipping_is_billing: true,
            order_items: ord.items.map(item => ({
              name: item.name,
              sku: item.wrapFinish ? `${item.sku}-${item.wrapFinish.charAt(0).toLowerCase()}` : item.sku,
              units: item.quantity,
              selling_price: item.priceAtPurchase,
            })),
            payment_method: "COD",
            sub_total: ord.paymentDetails.amountDueCod > 0 ? ord.paymentDetails.amountDueCod : ord.totalAmount,
            length,
            breadth,
            height,
            weight,
          };

          const srResponse = await createShiprocketOrder(shiprocketOrderData);
          if (srResponse.status_code === 1 && !srResponse.packaging_box_error) {
            await Order.findByIdAndUpdate(
              ord._id,
              { shiprocketOrderId: srResponse.order_id, deliveryStatus: "orderCreated" },
              { session }
            );
            logs.push(`Shiprocket order created for ${ord._id}`);
          }
        } catch (err) {
          logs.push(`Shiprocket creation failed for ${ord._id}: ${err.message}`);
        }
      }
    }

    await session.commitTransaction();
    session.endSession();

    // 6. Send WhatsApp notification
    try {
      const mainOrderForMsg = updatedOrders.find(ord => ord.isMainOrder) || updatedOrders[0];
      if (!mainOrderForMsg.isTestingOrder) {
        const userDoc = await User.findById(mainOrderForMsg.user);
        if (userDoc) {
          await sendWhatsAppMessage({
            user: userDoc,
            prefUserName: mainOrderForMsg.address.receiverName || "",
            campaignName: "order_confirmed",
            orderId: mainOrderForMsg._id,
            templateParams: [],
            carouselCards: [],
            buttons: [],
          });
          logs.push(`WhatsApp sent to user: ${userDoc._id}`);
        }
      }
    } catch (err) {
      logs.push(`WhatsApp sending failed: ${err.message}`);
    }

    return NextResponse.json({ message: "COD processed successfully", logs }, { status: 200 });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    return NextResponse.json({ error: `Internal server error: ${err.message}`, logs }, { status: 500 });
  }
}
