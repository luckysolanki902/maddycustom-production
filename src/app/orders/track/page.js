'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import styles from './track.module.css';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Sidebar from '@/components/layouts/Sidebar';
import { createMetadata } from '@/lib/metadata/create-metadata';

export async function generateMetadata() {
  return createMetadata({
    canonical: 'https://maddycustom.com/orders/track',
  });
}

const Track = () => {
  const [orderId, setOrderId] = useState('');

  const handleTrackOrder = async () => {
    if (!orderId) {
      alert('Order ID is required');
      return;
    }

    try {
      const response = await fetch(`/api/order/track?orderId=${orderId}`);
      
      if (response.redirected) {
        window.location.href = response.url; // Redirect to tracking URL
      } else {
        const data = await response.json();
        alert(data.message); // Show error message if not redirected
      }
    } catch (error) {
      console.error('Error tracking order:', error);
      alert('Error tracking order');
    }
  };

  const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

  return (
    <>
      <Sidebar />
      <div className={styles.main}>
        <div className={styles.max}>
          {/* Logo */}
          <Image 
            src={`${baseImageUrl}/assets/logos/md_logo_with_subtitle.png`} 
            width={800} 
            height={800} 
            className={styles.mdLogo} 
            alt='MD Wraps' 
          />

          <div className={styles.container}>
            <h1>Order Tracking</h1>
            <TextField
              label="Order ID"
              variant="standard"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              className={styles.textField}
              fullWidth
              style={{ marginBottom: '4rem' }}
            />
            <Button 
              variant="contained" 
              style={{ backgroundColor: 'black', color: 'white' }} 
              onClick={handleTrackOrder}
              className={styles.trackButton}
            >
              Track
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Track;
