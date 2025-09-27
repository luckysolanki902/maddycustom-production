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
async function updateInventory(inventoryId, delta, session, logs) {
  logs.push(`Updating inventory ${inventoryId} by delta: ${delta}`);
  return await mongoose
    .model("Inventory")
    .updateOne({ _id: inventoryId }, { $inc: { availableQuantity: delta, reservedQuantity: -delta } }, { session });
}

export async function POST(req) {
  const logs = [];
  let orderId = null;

  try {
    logs.push("Starting COD route");
    await connectToDatabase();
    const session = await mongoose.startSession();
    session.startTransaction();

    const body = await req.json();
    logs.push(`Received body: ${JSON.stringify(body)}`);
    orderId = body.orderId;

    if (!orderId) {
      logs.push("No orderId provided");
      return NextResponse.json({ error: "No orderId provided.", logs }, { status: 400 });
    }

    // 1. Fetch main order and linked orders
    const order = await Order.findById(orderId).session(session);
    if (!order) {
      logs.push(`Order ${orderId} not found`);
      return NextResponse.json({ error: "Order not found.", logs }, { status: 404 });
    }

    const linkedOrders = order.linkedOrderIds?.length
      ? await Order.find({ _id: { $in: order.linkedOrderIds } }).session(session)
      : [];

    const allOrders = [order, ...linkedOrders];
    logs.push(`Processing ${allOrders.length} orders: main + linked`);

    // 2. Update paymentStatus
    for (const ord of allOrders) {
      logs.push(`Updating paymentStatus for order ${ord._id} to "allToBePaidCod"`);
      ord.paymentStatus = "allToBePaidCod";
      await ord.save({ session });
    }

    // 3. Handle coupon usage increment (main order only)
    const mainOrder = allOrders.find(ord => ord.isMainOrder) || allOrders[0];
    if (mainOrder.couponApplied?.length > 0) {
      const [appliedCoupon] = mainOrder.couponApplied;
      logs.push(`Checking coupon for main order: ${appliedCoupon.couponCode}`);
      if (appliedCoupon.couponCode && !appliedCoupon.incrementedCouponUsage) {
        const couponDoc = await Coupon.findOne({ code: appliedCoupon.couponCode }).session(session);
        if (couponDoc) {
          logs.push(`Incrementing usage for coupon ${appliedCoupon.couponCode}`);
          couponDoc.usageCount += 1;
          await couponDoc.save({ session });

          for (const ord of allOrders) {
            if (ord.couponApplied?.length) {
              ord.couponApplied = ord.couponApplied.map(c =>
                c.couponCode === appliedCoupon.couponCode ? { ...c.toObject(), incrementedCouponUsage: true } : c
              );
              await ord.save({ session });
              logs.push(`Marked coupon as incremented for order ${ord._id}`);
            }
          }
        }
      }
    }

    // 4. Deduct inventory
    for (const ord of allOrders) {
      if (!ord.inventoryDeducted && !ord.isTestingOrder) {
        logs.push(`Deducting inventory for order ${ord._id}`);
        for (const item of ord.items) {
          if (item.option) {
            logs.push(`Processing inventory for Option ${item.option} x ${item.quantity}`);
            const optionDoc = await Option.findById(item.option).session(session);
            if (optionDoc?.inventoryData) {
              await updateInventory(optionDoc.inventoryData, -item.quantity, session, logs);
            } else {
              logs.push(`Option ${item.option} has no inventoryData`);
            }
          } else if (item.product) {
            logs.push(`Processing inventory for Product ${item.product} x ${item.quantity}`);
            const productDoc = await Product.findById(item.product).session(session);
            if (productDoc?.inventoryData) {
              await updateInventory(productDoc.inventoryData, -item.quantity, session, logs);
            } else {
              logs.push(`Product ${item.product} has no inventoryData`);
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
          .populate({ path: "items.product", populate: { path: "specificCategoryVariant", model: "SpecificCategoryVariant" } })
          .session(session)
      )
    );

    for (const ord of updatedOrders) {
      if (ord.deliveryStatus === "pending" && !ord.shiprocketOrderId && !ord.isTestingOrder) {
        logs.push(`Creating Shiprocket order for ${ord._id}`);
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
            logs.push(`Shiprocket order created successfully for ${ord._id}`);
          }
        } catch (err) {
          logs.push(`Shiprocket creation failed for ${ord._id}: ${err.message}`);
        }
      } else {
        logs.push(`Skipping Shiprocket for order ${ord._id}`);
      }
    }

    await session.commitTransaction();
    session.endSession();
    logs.push("Transaction committed successfully");

    // 6. Send WhatsApp notification
    try {
      const mainOrderForMsg = updatedOrders.find(ord => ord.isMainOrder) || updatedOrders[0];
      if (!mainOrderForMsg.isTestingOrder) {
        const userDoc = await User.findById(mainOrderForMsg.user);
        if (userDoc) {
          logs.push(`Sending WhatsApp to user ${userDoc._id}`);
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
    logs.push(`Error in COD route: ${err.message}`);
    return NextResponse.json({ error: `Internal server error: ${err.message}`, logs }, { status: 500 });
  }
}
