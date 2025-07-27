'use client';

import React from 'react';
import { Box, Typography, useMediaQuery } from '@mui/material';
import theme from '@/styles/theme';
import Image from 'next/image';

const TrustSection = ({ baseImageUrl, isCompact = false }) => {
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isVerySmallHeight = useMediaQuery('(max-height: 550px)');

  // For very small height, show only trust text
  if (isVerySmallHeight) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          py: 0,
        }}
      >
        <Typography
          sx={{
            fontFamily: 'Jost, sans-serif',
            fontWeight: 400,
            color: '#666',
            textAlign: 'center',
            fontSize: '14px',
          }}
        >
          Trusted by 50,000+ happy customers
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: isMobile ? 1 : 1.5,
        py: 0,
      }}
    >
      {/* Main Trust Text */}
      <Typography
        sx={{
          fontFamily: 'Jost, sans-serif',
          fontWeight: 400,
          color: '#666',
          textAlign: 'center',
          fontSize: '14px',
          mb: isMobile ? 0.25 : 0.5,
        }}
      >
        Trusted by 50,000+ happy customers
      </Typography>

      {/* Trust Icons */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: isMobile ? 3 : 4,
          mb: isMobile ? 1 : 1.5,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 0.5,
          }}
        >
          <Image
            src={`${baseImageUrl}/assets/icons/secure_payment.png`}
            width={isMobile ? 28 : 32}
            height={isMobile ? 28 : 32}
            alt="Secure"
            style={{ opacity: 0.7 }}
          />
          <Typography
            sx={{
              fontFamily: 'Jost, sans-serif',
              color: '#666',
              textAlign: 'center',
              fontSize: isMobile ? '11px' : '12px',
            }}
          >
            Secure
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 0.5,
          }}
        >
          <Image
            src={`${baseImageUrl}/assets/icons/fast-delivery.png`}
            width={isMobile ? 28 : 32}
            height={isMobile ? 28 : 32}
            alt="Fast"
            style={{ opacity: 0.7 }}
          />
          <Typography
            sx={{
              fontFamily: 'Jost, sans-serif',
              color: '#666',
              textAlign: 'center',
              fontSize: isMobile ? '11px' : '12px',
            }}
          >
            Fast
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 0.5,
          }}
        >
          <Image
            src={`${baseImageUrl}/assets/icons/happiness.png`}
            width={isMobile ? 28 : 32}
            height={isMobile ? 28 : 32}
            alt="100%"
            style={{ opacity: 0.7 }}
          />
          <Typography
            sx={{
              fontFamily: 'Jost, sans-serif',
              color: '#666',
              textAlign: 'center',
              fontSize: isMobile ? '11px' : '12px',
            }}
          >
            100%
          </Typography>
        </Box>
      </Box>

      {/* Payment Partners */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: isMobile ? 1 : 1.5 }}>
        <Image
          src={`${baseImageUrl}/assets/icons/razorpay_logo.svg`}
          width={isMobile ? 50 : 60}
          height={isMobile ? 15 : 18}
          alt="Razorpay"
          style={{ opacity: 0.6 }}
        />
        <Typography
          sx={{
            fontFamily: 'Jost, sans-serif',
            color: '#ddd',
            fontSize: '12px',
          }}
        >
          |
        </Typography>
        <Image
          src={`${baseImageUrl}/assets/icons/shiprocket_logo.svg`}
          width={isMobile ? 50 : 60}
          height={isMobile ? 15 : 18}
          alt="Shiprocket"
          style={{ opacity: 0.6 }}
        />
      </Box>
    </Box>
  );
};

export default TrustSection;
