import connectToDatabase from '@/lib/middleware/connectToDb';
import { trackShiprocketOrder } from '@/lib/utils/shiprocket';
import Order from '@/models/Order';
import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const orderIdParam = searchParams.get('orderId');
  const phoneParam = searchParams.get('phone');
  const phoneDigits = phoneParam ? phoneParam.replace(/\D/g, '') : '';

  if (!orderIdParam && !phoneDigits) {
    return NextResponse.json({ message: 'Order ID or phone number is required' }, { status: 400 });
  }

  if (phoneDigits && phoneDigits.length < 10) {
    return NextResponse.json({ message: 'Phone number must have at least 10 digits' }, { status: 400 });
  }

  try {
    await connectToDatabase();

    let lookupMode = null;
    let lookupValue = null;

    // Fetch order and linked orders
    let order = null;
    if (orderIdParam) {
      order = await Order.findById(orderIdParam)
        .populate({
          path: 'linkedOrderIds',
          model: 'Order',
          select: 'deliveryStatus shiprocketOrderId createdAt items address couponApplied couponName couponDiscount'
        });
      if (order) {
        lookupMode = 'orderId';
        lookupValue = orderIdParam;
      }
    }

    if (!order && phoneDigits) {
      order = await Order.findOne({
        'address.receiverPhoneNumber': phoneDigits,
        isTestingOrder: { $ne: true }
      })
        .sort({ createdAt: -1 })
        .populate({
          path: 'linkedOrderIds',
          model: 'Order',
          select: 'deliveryStatus shiprocketOrderId createdAt items address couponApplied couponName couponDiscount'
        });
      if (order) {
        lookupMode = 'phone';
        lookupValue = phoneDigits;
      }
    }

    if (!order) {
      const notFoundMessage = orderIdParam
        ? 'Order not found. Please check your Order ID and try again.'
        : 'Order not found for that phone number. Please verify the digits and try again.';
      return NextResponse.json({ message: notFoundMessage }, { status: 404 });
    }

    const orderId = order._id?.toString();
    const lookup = lookupMode ? { mode: lookupMode, value: lookupValue } : null;

    // Helper to format address
    const formatAddress = (o) => {
      return o?.address
        ? `${o.address.addressLine1}${o.address.addressLine2 ? ', ' + o.address.addressLine2 : ''}, ${o.address.city}, ${o.address.state}, ${o.address.pincode}`
        : 'Address pending';
    };

    // Helper to build order items for UI
    const buildOrderItems = (o) => {
      const items = Array.isArray(o.items) ? o.items : [];
      return items.map((it) => {
        const prod = it.productDetails || it.product || {};
        const title = prod.title || prod.name || it.name || 'Item';
        const images = prod.images || prod.displayAssets || [];
        const firstImg = Array.isArray(images) && images.length > 0 ? images[0] : null;
        // Try to use purchase-time price fields first
        const price = it.priceAtPurchase ?? it.itemPrice ?? it.unitPrice ?? it.totalPrice ?? it.price ?? prod.price ?? 0;
        return {
          name: title,
          quantity: it.quantity || 1,
          price,
          productId: prod._id || it.productId || null,
          thumbnail: it.thumbnail
        };
      });
    };

    // Get email if available (optional)
    let userEmail = null;
    try {
      await order.populate('user');
      userEmail = order.user?.email || null;
    } catch (_) {}

    const allOrders = [order, ...(order.linkedOrderIds || [])];
    const hasShippedOrder = allOrders.some((o) => o.deliveryStatus !== 'pending');

    // If nothing shipped yet or no Shiprocket data, return only Processing/basic info (no status/steps from order schema)
    if (!hasShippedOrder) {
      return NextResponse.json(
        {
          message:
            allOrders.length > 1
              ? "Your orders are still being processed. We'll update the tracking once they ship!"
              : "Your order is still being processed. We'll update the tracking once it ships!",
          trackingData: {
            orderId,
            lookup,
            name: order.address?.receiverName || 'Customer',
            address: formatAddress(order),
            phoneNumber: order.address?.receiverPhoneNumber || null,
            email: userEmail || null,
            createdAt: order.createdAt,
            shipmentDate: 'Processing',
            expectedDelivery: 'Estimated 5-7 business days from shipping',
            isMultiOrder: allOrders.length > 1,
            orderCount: allOrders.length,
            coupon: order.couponApplied
              ? { applied: true, name: order.couponName || null, discount: order.couponDiscount || 0 }
              : { applied: false },
            items: buildOrderItems(order),
            mainTrackUrl: null,
            // No status or trackingSteps if not from Shiprocket
          },
        },
        { status: 200 }
      );
    }

    // Some shipped: collect tracking per shipped order
    const trackingResults = [];
    for (const ord of allOrders) {
      if (ord.deliveryStatus !== 'pending' && ord.shiprocketOrderId) {
        try {
          const tData = await trackShiprocketOrder(ord._id);
          if (tData && tData.length > 0) {
            trackingResults.push({ orderId: ord._id, shiprocketOrderId: ord.shiprocketOrderId, trackingData: tData[0] });
          }
        } catch (e) {
          trackingResults.push({ orderId: ord._id, shiprocketOrderId: ord.shiprocketOrderId, error: 'Unable to fetch tracking data' });
        }
      }
    }

    if (trackingResults.length > 0) {
      const mainTrackUrl = trackingResults.find((r) => r.trackingData?.tracking_data?.track_url)?.trackingData?.tracking_data?.track_url || null;
      const formattedAddress = formatAddress(order);

      // Use only Shiprocket status/steps if available, else omit
      const enhancedTrackingData = {
        orderId,
        isMultiOrder: trackingResults.length > 1,
        orderCount: allOrders.length,
        orders: trackingResults.map((result) => {
          if (result.error) {
            return {
              orderId: result.orderId,
              shiprocketOrderId: result.shiprocketOrderId,
              error: result.error
            };
          }
          const shipmentData = result.trackingData;
          const trackUrl = shipmentData?.tracking_data?.track_url;
          const currentStatus = shipmentData?.tracking_data?.shipment_track?.[0]?.current_status;
          const activities = shipmentData?.tracking_data?.shipment_track_activities || [];
          return {
            orderId: result.orderId,
            shiprocketOrderId: result.shiprocketOrderId,
            trackUrl: trackUrl,
            status: currentStatus || undefined,
            shipmentDate: shipmentData?.tracking_data?.shipment_track?.[0]?.shipped_date || undefined,
            expectedDelivery: shipmentData?.tracking_data?.shipment_track?.[0]?.expected_delivery_date || undefined,
            trackingSteps: activities.length > 0
              ? activities.map((activity) => ({
                  label: activity.activity,
                  date: activity.date,
                  time: activity.time,
                  location: activity.location,
                  completed: true,
                  description: activity.description || activity.activity,
                })).reverse()
              : undefined,
          };
        }),
        name: order.address?.receiverName || 'Customer',
        address: formattedAddress,
        phoneNumber: order.address?.receiverPhoneNumber || null,
        email: userEmail || null,
        createdAt: order.createdAt,
        coupon: order.couponApplied
          ? { applied: true, name: order.couponName || null, discount: order.couponDiscount || 0 }
          : { applied: false },
        items: buildOrderItems(order),
        mainTrackUrl,
        lookup,
      };

      return NextResponse.json(
        {
          message: trackingResults.length > 1 ? `Tracking information for your ${trackingResults.length} orders` : 'Tracking information for your order',
          trackingData: enhancedTrackingData,
        },
        { status: 200 }
      );
    }

    // Fallback: try tracking primary orderId directly
    const trackingData = await trackShiprocketOrder(orderId);
    if (trackingData && trackingData.length > 0) {
      const shipmentData = trackingData[0];
      const trackUrl = shipmentData?.tracking_data?.track_url || null;
      const currentStatus = shipmentData?.tracking_data?.shipment_track?.[0]?.current_status;
      const formattedAddress = formatAddress(order);
      const activities = shipmentData?.tracking_data?.shipment_track_activities || [];

      const enhancedTrackingData = {
        orderId,
        lookup,
        trackUrl,
        mainTrackUrl: trackUrl,
        status: currentStatus || undefined,
        shipmentDate: shipmentData?.tracking_data?.shipment_track?.[0]?.shipped_date || undefined,
        expectedDelivery: shipmentData?.tracking_data?.shipment_track?.[0]?.expected_delivery_date || undefined,
        name: order.address?.receiverName || 'Customer',
        address: formattedAddress,
        phoneNumber: order.address?.receiverPhoneNumber || null,
        email: userEmail || null,
        createdAt: order.createdAt,
        coupon: order.couponApplied
          ? { applied: true, name: order.couponName || null, discount: order.couponDiscount || 0 }
          : { applied: false },
        items: buildOrderItems(order),
        trackingSteps: activities.length > 0
          ? activities.map((activity) => ({
              label: activity.activity,
              date: activity.date,
              time: activity.time,
              location: activity.location,
              completed: true,
              description: activity.description || activity.activity,
            })).reverse()
          : undefined,
      };

      return NextResponse.json({ message: 'Tracking information found!', trackUrl, trackingData: enhancedTrackingData }, { status: 200 });
    }

    // Last resort if shiprocket has no data: only show Processing/basic info, no status/steps
    return NextResponse.json(
      {
        message: 'Your order will be shipped soon! Check back for tracking updates.',
        trackingData: {
          orderId,
          lookup,
          name: order.address?.receiverName || 'Customer',
          address: formatAddress(order),
          phoneNumber: order.address?.receiverPhoneNumber || null,
          email: userEmail || null,
          shipmentDate: 'Processing',
          expectedDelivery: 'Estimated 5-7 business days from shipping',
          createdAt: order.createdAt,
          coupon: order.couponApplied
            ? { applied: true, name: order.couponName || null, discount: order.couponDiscount || 0 }
            : { applied: false },
          items: buildOrderItems(order),
          mainTrackUrl: null,
          // No status or trackingSteps
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error tracking order:', error);
    return NextResponse.json({ message: 'Error tracking order. Please try again later.' }, { status: 502 });
  }
}

