'use client';

import React from 'react';
import { Box, Typography, useMediaQuery } from '@mui/material';
import { motion } from 'framer-motion';
import theme from '@/styles/theme';
import Image from 'next/image';

const TrustSection = ({ baseImageUrl, isCompact = false }) => {
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isSmallHeight = useMediaQuery('(max-height: 650px)');
  const isVerySmallHeight = useMediaQuery('(max-height: 550px)');

  if (isVerySmallHeight) {
    return null; // Hide trust section for very small height viewports
  }

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: {
        duration: 0.6,
        ease: "easeOut",
        staggerChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.4, ease: "easeOut" }
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: isCompact ? 0.8 : 1.5,
          py: isCompact ? (isMobile ? 1 : 1.2) : (isMobile ? 2 : 2.5),
          px: isMobile ? 1.5 : 2.5,
          background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
          borderRadius: '12px',
          border: '1px solid #e0e0e0',
          mt: isCompact ? 0.5 : 1.5,
        }}
      >
        {/* Main Trust Text */}
        <motion.div variants={itemVariants}>
          <Typography
            variant="h6"
            sx={{
              fontFamily: 'Orbitron, monospace',
              fontWeight: 600,
              color: '#000',
              textAlign: 'center',
              fontSize: isCompact ? (isMobile ? '0.8rem' : '0.9rem') : (isMobile ? '0.95rem' : '1.05rem'),
              mb: isCompact ? 0.3 : 0.8,
            }}
          >
            Trusted by 50,000+ Racing Enthusiasts
          </Typography>
        </motion.div>

        {/* Trust Icons */}
        <motion.div variants={itemVariants}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: isCompact ? (isMobile ? 1.5 : 2) : (isMobile ? 2.5 : 3),
              flexWrap: 'wrap',
            }}
          >
            <motion.div 
              whileHover={{ y: -3 }} 
              transition={{ type: "spring", stiffness: 400 }}
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
                  loading="eager"
                  src={`${baseImageUrl}/assets/icons/secure_payment.png`}
                  width={isCompact ? 24 : 28}
                  height={isCompact ? 24 : 28}
                  alt="Secure Payment"
                  style={{ opacity: 0.7 }}
                />
                <Typography
                  variant="caption"
                  sx={{
                    fontFamily: 'Jost, sans-serif',
                    color: '#666',
                    textAlign: 'center',
                    fontSize: isCompact ? '0.65rem' : '0.7rem',
                  }}
                >
                  Secure Payment
                </Typography>
              </Box>
            </motion.div>

            <motion.div 
              whileHover={{ y: -3 }} 
              transition={{ type: "spring", stiffness: 400 }}
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
                  loading="eager"
                  src={`${baseImageUrl}/assets/icons/fast-delivery.png`}
                  width={isCompact ? 24 : 28}
                  height={isCompact ? 24 : 28}
                  alt="Fast Delivery"
                  style={{ opacity: 0.7 }}
                />
                <Typography
                  variant="caption"
                  sx={{
                    fontFamily: 'Jost, sans-serif',
                    color: '#666',
                    textAlign: 'center',
                    fontSize: isCompact ? '0.65rem' : '0.7rem',
                  }}
                >
                  Fast Delivery
                </Typography>
              </Box>
            </motion.div>

            <motion.div 
              whileHover={{ y: -3 }} 
              transition={{ type: "spring", stiffness: 400 }}
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
                  loading="eager"
                  src={`${baseImageUrl}/assets/icons/happiness.png`}
                  width={isCompact ? 24 : 28}
                  height={isCompact ? 24 : 28}
                  alt="Customer Satisfaction"
                  style={{ opacity: 0.7 }}
                />
                <Typography
                  variant="caption"
                  sx={{
                    fontFamily: 'Jost, sans-serif',
                    color: '#666',
                    textAlign: 'center',
                    fontSize: isCompact ? '0.65rem' : '0.7rem',
                  }}
                >
                  100% Satisfaction
                </Typography>
              </Box>
            </motion.div>
          </Box>
        </motion.div>

        {/* Payment Partners */}
        <motion.div variants={itemVariants}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Image
              loading="eager"
              src={`${baseImageUrl}/assets/icons/razorpay_logo.svg`}
              width={isCompact ? 40 : 50}
              height={isCompact ? 12 : 15}
              alt="Razorpay"
              style={{ opacity: 0.7 }}
            />
            <Typography
              variant="caption"
              sx={{
                fontFamily: 'Jost, sans-serif',
                color: '#666',
                fontSize: isCompact ? '0.65rem' : '0.7rem',
              }}
            >
              |
            </Typography>
            <Image
              loading="eager"
              src={`${baseImageUrl}/assets/icons/shiprocket_logo.svg`}
              width={isCompact ? 40 : 50}
              height={isCompact ? 12 : 15}
              alt="Shiprocket"
              style={{ opacity: 0.7 }}
            />
          </Box>
        </motion.div>
      </Box>
    </motion.div>
  );
};

export default TrustSection;
