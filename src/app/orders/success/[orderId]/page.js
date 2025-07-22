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

  const { order } = data;

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

      {/* Products Section */}
      <PurchasedProductSlider items={order.items} baseImageUrl={baseImageUrl} />
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
