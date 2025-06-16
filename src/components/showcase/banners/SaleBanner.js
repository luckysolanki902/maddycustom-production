"use client";

import { useState, useEffect } from 'react';
import { Box, Typography, Container } from '@mui/material';

const SaleBanner = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const checkIfLastFiveDays = () => {
      const today = new Date();
      const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      const currentDay = today.getDate();
      
      // Show banner if we're in the last 5 days of the month
      if (currentDay >= (lastDayOfMonth - 4)) {
        const closedDate = localStorage.getItem('saleBannerClosed');
        if (!closedDate || new Date(closedDate).toDateString() !== today.toDateString()) {
          setIsVisible(true);
        }
      }
    };
    // checkIfLastFiveDays();
  }, []);

  const closeBanner = () => {
    setIsVisible(false);
    localStorage.setItem('saleBannerClosed', new Date().toISOString());
  };

  if (!isVisible) return null;

  return (
    <Box 
      sx={{
        width: '100%',
        background: 'linear-gradient(135deg, #ff5f6d, #ffc371)',
        color: 'white',
        padding: '16px 0',
        position: 'relative',
        boxShadow: '0 3px 10px rgba(0,0,0,0.2)',
        fontFamily: 'Jost', // Use default font family from theme
      }}
    >
      <Container maxWidth="lg" sx={{ position: 'relative' }}>
        <Box sx={{ 
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          px: 4,
        }}>
          <Typography 
            variant="h5" 
            component="h2" 
            sx={{ 
              fontWeight: 700, 
              letterSpacing: '1px',
              textTransform: 'uppercase',
              textShadow: '1px 1px 2px rgba(0,0,0,0.3)',
              mb: 0.5,
              fontSize: { xs: '1.5rem', sm: '1.8rem' },
              fontFamily: 'Jost, sans-serif', // Use Jost font family
            }}
          >
            🎉End of Month Sale!🎉
          </Typography>
          <Typography 
            variant="body1" 
            sx={{ 
              fontSize: { xs: '0.95rem', sm: '1.1rem' },
              fontFamily: 'Jost, sans-serif', // Use Jost font family
            }}
          >
            Get upto 50% discounts on your favorite products!
          </Typography>
        </Box>
        
        <button 
          onClick={closeBanner}
          style={{ 
            position: 'absolute', 
            top: '4px',
            right: '16px',
            minWidth: '24px',
            height: '24px',
            padding: 0,
            background: 'transparent',
            border: 'none',
            color: 'white',
            fontSize: '20px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label="Close banner"
        >
          ×
        </button>
      </Container>
    </Box>
  );
};

export default SaleBanner;