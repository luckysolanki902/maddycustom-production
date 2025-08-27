import React from 'react';
import Image from 'next/image';
import ContactUs from '@/components/layouts/ContactUs';
import CopyButton from '@/components/page-sections/orderSuccess/CopyButton';
import styles from '@/styles/order.module.css';
import { fetchOrder } from '@/lib/utils/fetchutils';
import { notFound } from 'next/navigation';
import { Box, Card, Typography } from '@mui/material';
import PurchasedProductSlider from '@/components/page-sections/orderSuccess/PurchasedProductSlider';
import OrderDetails from '@/components/page-sections/orderSuccess/OrderDetails';
import CommunityCard from '@/components/page-sections/orderSuccess/CommunityCard';

const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

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
  const { order, group } = data;

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

  // Get unique freebie descriptions from the order items
  // const uniqueFreebies = Array.from(
  //   new Set(
  //     order.items
  //       .filter((item) => item.product.freebies?.available && item.product.freebies.description)
  //       .map((item) => item.product.freebies.description)
  //   )
  // );

  return (
    <Box className={styles.main}>
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
        {/* <Typography variant="h6">{orderId}</Typography> */}
      </Box>

      {/* Products Section / Grouped Orders */}
      {group ? (
        <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 4, px: 2, pb: 4 }}>
          <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>Grouped Orders</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb:2 }}>Your purchase was split into {group.orders.length} orders for optimized processing & shipping.</Typography>
          {group.orders.map(go => (
            <Box key={go._id} sx={{ border: '1px solid #e0e0e0', borderRadius: 2, p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent:'space-between', alignItems:'center', mb:1 }}>
                <Typography variant="subtitle1" fontWeight={600}>Order ID: {go._id}</Typography>
                <Typography variant="caption" color="text.secondary">Partition: {go.partitionKey || 'n/a'} {go.isGroupPrimary && '(Primary)'}</Typography>
              </Box>
              {String(go._id) === String(order._id) ? (
                <PurchasedProductSlider items={order.items} baseImageUrl={baseImageUrl} />
              ) : (
                <Typography variant="body2" color="text.secondary">Open this order to view its items.</Typography>
              )}
              <Box sx={{ display:'flex', gap:3, mt:1, flexWrap:'wrap' }}>
                <ChipLike label={`Status: ${go.paymentStatus}`} />
                <ChipLike label={`Delivery: ${go.deliveryStatus}`} />
                <ChipLike label={`Total: ₹${go.totalAmount}`} />
                {go.amountDueCod > 0 && <ChipLike label={`COD Due: ₹${go.amountDueCod}`} />}
              </Box>
            </Box>
          ))}
          <Box sx={{ border:'1px dashed #ccc', borderRadius:2, p:2 }}>
            <Typography variant="subtitle2" fontWeight={600}>Group Totals</Typography>
            <Typography variant="body2">Total: ₹{group.aggregate.total}</Typography>
            {group.aggregate.dueCod > 0 && <Typography variant="body2">Remaining COD: ₹{group.aggregate.dueCod}</Typography>}
          </Box>
        </Box>
      ) : (
        <PurchasedProductSlider items={order.items} baseImageUrl={baseImageUrl} />
      )}
      {/* Community */}
      <CommunityCard />
      {/* Order Details Section */}
  <OrderDetails order={order} formatDate={formatDate} />

      {/* Unique Freebies Section */}
      {/* {uniqueFreebies.length > 0 && (
        <Box sx={{ marginTop: 4 }}>
          <Card sx={{ padding: 2, borderRadius: 2, boxShadow: 2 }}>
            <Typography variant="h6" gutterBottom>
              Freebies Included with Your Purchase
            </Typography>
            {uniqueFreebies.map((description, index) => (
              <Typography key={index} variant="body1" gutterBottom>
                - {description}
              </Typography>
            ))}
          </Card>
        </Box>
      )} */}

      {/* Contact Us Section */}
      {/* <ContactUs /> */}
    </Box>
  );
}

// Inline lightweight chip-like component (avoids extra import churn)
function ChipLike({ label }) {
  return (
    <span style={{
      background:'#f5f5f5',
      padding:'4px 10px',
      borderRadius: '999px',
      fontSize: '12px',
      fontWeight: 500,
      border: '1px solid #e0e0e0'
    }}>{label}</span>
  );
}
