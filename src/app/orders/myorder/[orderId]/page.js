import React from 'react';
import Image from 'next/image';
import ContactUs from '@/components/layouts/ContactUs';
import CopyButton from '@/components/page-sections/orderSuccess/CopyButton';
import styles from '@/styles/order.module.css';
import { fetchOrder } from '@/lib/utils/fetchutils';
import { notFound, redirect } from 'next/navigation';
import { Box, Card, Typography } from '@mui/material';
import PurchasedProductSlider from '@/components/page-sections/orderSuccess/PurchasedProductSlider';
import OrderDetails from '@/components/page-sections/orderSuccess/OrderDetails';
import CommunityCard from '@/components/page-sections/orderSuccess/CommunityCard';
import OrderSuccessTracker from '@/components/analytics/OrderSuccessTracker';
import GoogleCustomerReviews from '@/components/analytics/GoogleCustomerReviews';

const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

function toNumeric(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function toStringId(value) {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    if (typeof value.toString === 'function') {
      const str = value.toString();
      return str && str !== '[object Object]' ? str : undefined;
    }
    if (value._id) {
      return toStringId(value._id);
    }
  }
  return undefined;
}

export default async function OrderPage({ params }) {
  const { orderId } = await params;
  let data;
  try {
    data = await fetchOrder(orderId);
  } catch (error) {
    console.error(error);
    notFound();
    return null;
  }

  if (!data?.order) {
    notFound();
    return null;
  }

  const { order } = data;
  
  // Check if we need to redirect to main order
  if (data.redirectToOrderId) {
    redirect(`/orders/myorder/${data.redirectToOrderId}`);
    return null;
  }

  // Get all orders (main + linked)
  const allOrders = [order, ...(order.linkedOrderIds || [])];
  const isMultiOrder = allOrders.length > 1;

  const aggregate = allOrders.reduce(
    (acc, ord) => {
      const items = Array.isArray(ord.items) ? ord.items : [];
      acc.totalAmount += toNumeric(ord.totalAmount);
      acc.totalDiscount += toNumeric(ord.totalDiscount);
      acc.totalQuantity += items.reduce((sum, item) => sum + toNumeric(item.quantity), 0);

      const paymentDetails = ord.paymentDetails || {};
      acc.amountPaidOnline += toNumeric(paymentDetails.amountPaidOnline);
      acc.amountDueOnline += toNumeric(paymentDetails.amountDueOnline);
      acc.amountDueCod += toNumeric(paymentDetails.amountDueCod);

      items.forEach((item) => {
        acc.items.push({
          productId: toStringId(item.product),
          name: item.name,
          quantity: toNumeric(item.quantity),
          price: toNumeric(item.priceAtPurchase),
          sku: item.sku,
        });
      });

      acc.orderIds.push(toStringId(ord._id));

      return acc;
    },
    {
      totalAmount: 0,
      totalDiscount: 0,
      totalQuantity: 0,
      amountPaidOnline: 0,
      amountDueOnline: 0,
      amountDueCod: 0,
      items: [],
      orderIds: [],
    }
  );

  const cartSummary = {
    items: aggregate.totalQuantity || undefined,
    value: aggregate.totalAmount || undefined,
    currency: 'INR',
  };

  if (cartSummary.items === undefined) {
    delete cartSummary.items;
  }
  if (cartSummary.value === undefined) {
    delete cartSummary.value;
    delete cartSummary.currency;
  }

  const couponCode = Array.isArray(order.couponApplied) && order.couponApplied.length > 0
    ? order.couponApplied[0]?.couponCode
    : undefined;

  const trackingData = {
    orderId: toStringId(order._id) || orderId,
    totalValue: aggregate.totalAmount || undefined,
    currency: 'INR',
    couponCode,
    cartSummary,
    items: aggregate.items,
    paymentMode: toStringId(order.paymentDetails?.mode),
    paymentStatus: order.paymentStatus,
    amountDueOnline: aggregate.amountDueOnline || undefined,
    amountPaidOnline: aggregate.amountPaidOnline || undefined,
    amountDueCod: aggregate.amountDueCod || undefined,
    totalDiscount: aggregate.totalDiscount || undefined,
    metadata: {
      isSplitOrder: isMultiOrder,
      orderIds: aggregate.orderIds,
    },
  };

  const formatDate = (dateString) => {
    const options = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
    };
    return new Date(dateString).toLocaleString('en-US', options);
  };

  // Combine all items from all orders for display
  const allItems = allOrders.flatMap(ord => ord.items.map(item => ({
    ...item,
    _orderSource: ord._id // Track which order this item belongs to
  })));

  // Extract customer email for Google Customer Reviews
  const customerEmail = order.user?.email || null;
  // Estimate delivery date (7 days from order creation)
  const estimatedDeliveryDate = new Date(order.createdAt);
  estimatedDeliveryDate.setDate(estimatedDeliveryDate.getDate() + 7);

  return (
    <Box className={styles.main}>
      <OrderSuccessTracker trackingData={trackingData} />
      <GoogleCustomerReviews
        orderId={orderId}
        email={customerEmail}
        countryCode="IN"
        estimatedDeliveryDate={estimatedDeliveryDate}
      />
      {/* Header Section */}
      <Box className={styles.header}>
        <div style={{ backgroundColor: 'black' }}>
          <div
            style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
            className={styles.orderpngdiv}
          >
            <Image
              src={`${baseImageUrl}/assets/icons/ordersuccess.png`}
              width={410}
              height={193}
              alt="Order Success"
              className={styles.orderSuccessImage}
            />
          </div>
        </div>
      </Box>

      {/* Order ID Section */}
      <Box
        sx={{
          padding: '1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <CopyButton textToCopy={orderId} />
        {isMultiOrder && (
          <Typography variant="body2" color="primary">
            This order was split into {allOrders.length} separate shipments for better packaging and delivery
          </Typography>
        )}
      </Box>

      {/* Products Section - Show all items from all orders */}
      <PurchasedProductSlider items={allItems} baseImageUrl={baseImageUrl} />
      
      {/* Community */}
      <CommunityCard />
      
      {/* Order Details Section */}
      {isMultiOrder ? (
        <Box sx={{ marginTop: 2 }}>
          <Typography variant="h6" sx={{ padding: 2, fontWeight: 'bold' }}>
            Order Details ({allOrders.length} Shipments)
          </Typography>
          {allOrders.map((ord, index) => (
            <Card key={ord._id} sx={{ margin: 2, padding: 2 }}>
              <Typography variant="h6" gutterBottom>
                Shipment {index + 1} - {ord._id}
                {ord.isMainOrder && (
                  <Box component="span" sx={{ ml: 1, color: 'primary.main', fontSize: '0.8em' }}>
                    (Main Order)
                  </Box>
                )}
              </Typography>
              <OrderDetails order={ord} formatDate={formatDate} />
            </Card>
          ))}
          
          {/* Summary for all orders */}
          <Card sx={{ margin: 2, padding: 2, backgroundColor: '#f5f5f5' }}>
            <Typography variant="h6" gutterBottom>
              Order Summary (Total)
            </Typography>
            <Typography>
              <strong>Total Items:</strong> {allItems.length}
            </Typography>
            <Typography>
              <strong>Total Amount:</strong> ₹{allOrders.reduce((sum, ord) => sum + ord.totalAmount, 0)}
            </Typography>
            <Typography>
              <strong>Total Discount:</strong> ₹{allOrders.reduce((sum, ord) => sum + (ord.totalDiscount || 0), 0)}
            </Typography>
            <Typography>
              <strong>Order Date:</strong> {formatDate(order.createdAt)}
            </Typography>
          </Card>
        </Box>
      ) : (
        <OrderDetails order={order} formatDate={formatDate} />
      )}

      {/* Contact Us Section */}
      {/* <ContactUs /> */}
    </Box>
  );
}
