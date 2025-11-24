import mongoose from 'mongoose';
import Order from '@/models/Order';
import Coupon from '@/models/Coupon';
import Product from '@/models/Product';
import Option from '@/models/Option';
import Inventory from '@/models/Inventory';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';
import { createShiprocketOrder, getDimensionsAndWeight } from '@/lib/utils/shiprocket';

// Helper: Update inventory for a given Inventory document _id
async function updateInventory(inventoryId, delta, session) {
  const result = await mongoose.model('Inventory').updateOne(
    { _id: inventoryId },
    {
      $inc: {
        availableQuantity: delta,
        reservedQuantity: -delta,
      },
    },
    { session }
  );
  return result;
}

export async function processOrderFulfillment(orderIds, session, logs = []) {
  const timestampStr = new Date().toLocaleString('en-IN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });

  // Fetch orders with necessary population for Shiprocket
  const orders = await Promise.all(
    orderIds.map(id => 
      Order.findById(id)
        .populate({
          path: 'items.product',
          populate: {
            path: 'specificCategoryVariant',
            model: 'SpecificCategoryVariant',
          },
        })
        .populate('user')
        .session(session)
    )
  );

  if (!orders || orders.length === 0) return [];

  // 1. Handle Coupon Usage Increment (Only for Main Order)
  const mainOrder = orders.find(ord => ord.isMainOrder) || orders[0];
  if (mainOrder.couponApplied?.length > 0) {
    const [appliedCoupon] = mainOrder.couponApplied;
    if (appliedCoupon.couponCode && !appliedCoupon.incrementedCouponUsage) {
      const couponDoc = await Coupon.findOne({ code: appliedCoupon.couponCode }).session(session);
      if (couponDoc) {
        couponDoc.usageCount += 1;
        await couponDoc.save({ session });
        
        // Update coupon increment status in all orders
        for (const ord of orders) {
          if (ord.couponApplied?.length > 0) {
            await Order.findByIdAndUpdate(
              ord._id,
              {
                $set: {
                  'couponApplied.$[elem].incrementedCouponUsage': true
                }
              },
              {
                arrayFilters: [{ 'elem.couponCode': appliedCoupon.couponCode }],
                session,
                new: true
              }
            );
          }
        }
        logs.push(`[${timestampStr}] Coupon usage incremented: ${appliedCoupon.couponCode}`);
      }
    }
  }

  // 2. Deduct Inventory
  for (const ord of orders) {
    // Re-fetch to get latest status if needed, but we have the doc from start of function.
    // However, payment status might have been updated just before calling this function.
    // Since we passed `orderIds`, we fetched the *latest* state from DB (including the payment update done in previous step of webhook).
    
    if (
      (ord.paymentStatus === 'paidPartially' || ord.paymentStatus === 'allPaid') &&
      !ord.inventoryDeducted &&
      !ord.isTestingOrder
    ) {
      logs.push(`[${timestampStr}] Deducting inventory for order ${ord._id}`);
      const unitDelta = -1;

      for (const item of ord.items) {
        if (item.option) {
          logs.push(`Updating inventory for Option ${item.option} x ${item.quantity}`);
          const optionDoc = await Option.findById(item.option).session(session);
          if (optionDoc?.inventoryData) {
            await updateInventory(optionDoc.inventoryData, unitDelta * item.quantity, session);
          } else {
            logs.push(`Option ${item.option} has no inventoryData reference. Cannot update inventory.`);
          }
        } else if (item.product) {
          logs.push(`Updating inventory for Product ${item.product} x ${item.quantity}`);
          // item.product is populated, so we can access _id or use the object
          const productId = item.product._id || item.product;
          const productDoc = await Product.findById(productId).session(session);
          if (productDoc?.inventoryData) {
            await updateInventory(productDoc.inventoryData, unitDelta * item.quantity, session);
          } else {
            logs.push(`No inventoryData reference found on product ${productId}. Cannot update inventory.`);
          }
        } else {
          logs.push(`Order item does not have an option or product reference. Skipping.`);
        }
      }
      
      // Mark inventory as deducted
      await Order.findByIdAndUpdate(
        ord._id,
        { $set: { inventoryDeducted: true } },
        { session }
      );
    }
  }

  // 3. Create Shiprocket Orders
  // We need to re-fetch or update our local `orders` array because we might have updated them (inventoryDeducted).
  // But for Shiprocket, we just need the data. The `orders` array we fetched at the start has the data.
  // The only thing that changed is `inventoryDeducted` flag and `couponApplied` flag, which don't affect Shiprocket payload.
  // However, `paymentStatus` is critical. We fetched orders *after* payment status update in webhook, so it should be correct.

  for (const ord of orders) {
    if (
      ['allPaid', 'paidPartially'].includes(ord.paymentStatus) &&
      ord.deliveryStatus === 'pending' &&
      !ord.shiprocketOrderId &&
      !ord.isTestingOrder
    ) {
      logs.push(`[${timestampStr}] Attempting to create Shiprocket order for ID: ${ord._id}`);
      
      try {
        // Ensure address exists
        if (!ord.address || !ord.address.addressLine1) {
          logs.push(`[${timestampStr}] Order ${ord._id} missing address, skipping Shiprocket`);
          continue;
        }

        const dimensionsAndWeight = await getDimensionsAndWeight(ord.items);
        const { length, breadth, height, weight } = dimensionsAndWeight;
        
        const fullName = (ord.address.receiverName || '').trim();
        const nameParts = fullName.split(/\s+/).filter(part => part.length > 0);
        const firstName = nameParts[0] || 'Customer';
        const lastName = nameParts.slice(1).join(' ') || '';

        const shiprocketPayload = {
          order_id: ord._id.toString(),
          order_date: new Date().toISOString(),
          billing_customer_name: firstName,
          billing_last_name: lastName,
          billing_address: `${ord.address.addressLine1} ${ord.address.addressLine2 || ''}`,
          billing_city: ord.address.city,
          billing_pincode: ord.address.pincode,
          billing_state: ord.address.state,
          billing_country: ord.address.country,
          billing_phone: ord.address.receiverPhoneNumber,
          shipping_is_billing: true,
          order_items: ord.items.map((item) => ({
            name: item.name,
            sku: item.wrapFinish ? `${item.sku}-${item.wrapFinish.charAt(0).toLowerCase()}` : item.sku,
            units: item.quantity,
            selling_price: item.priceAtPurchase,
          })),
          payment_method: ord.paymentDetails.amountDueCod > 0 ? 'COD' : 'Prepaid',
          sub_total: ord.paymentDetails.amountDueCod > 0
            ? ord.paymentDetails.amountDueCod
            : ord.totalAmount,
          length,
          breadth,
          height,
          weight,
        };

        const shiprocketResponse = await createShiprocketOrder(shiprocketPayload);
        
        if (shiprocketResponse?.status_code === 1 && !shiprocketResponse?.packaging_box_error) {
          await Order.findByIdAndUpdate(
            ord._id,
            {
              $set: {
                shiprocketOrderId: shiprocketResponse.order_id.toString(),
                deliveryStatus: 'orderCreated',
              },
            },
            { session }
          );
          // Update local object so returned orders reflect this
          ord.shiprocketOrderId = shiprocketResponse.order_id.toString();
          ord.deliveryStatus = 'orderCreated';
          
          logs.push(`[${timestampStr}] Shiprocket order created: ${shiprocketResponse.order_id}`);
        } else {
          logs.push(`[${timestampStr}] Shiprocket response missing order_id or packaging_box_error`);
        }
      } catch (shiprocketError) {
        logs.push(`[${timestampStr}] Shiprocket creation failed: ${shiprocketError.message}`);
        console.error(`[Fulfillment] Shiprocket creation failed for order ${ord._id}`, shiprocketError);
      }
    } else {
        // Optional: log why skipped if needed, but might be too verbose
    }
  }

  // Return the fresh list of orders (re-fetched or updated in memory)
  // Since we did updates, let's return the `orders` array which we modified in memory for Shiprocket ID
  // But for `handlePostPaymentSuccess`, we need the `analyticsInfo` which is in the doc.
  // The `orders` array fetched at start has it.
  return orders;
}
