'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Box, Typography, IconButton } from '@mui/material';
import { Close, Visibility } from '@mui/icons-material';

const SimilarProductsToast = ({ isVisible, onClose, onViewSimilar, embedded = false }) => {
  if (embedded) {
    // Embedded version for ProductCard
    return (
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -10 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -10 }}
            transition={{ 
              type: "spring", 
              stiffness: 400, 
              damping: 25,
              duration: 0.4 
            }}
            style={{
              overflow: 'hidden',
              marginTop: '8px'
            }}
          >
            <Box
              onClick={onViewSimilar}
              sx={{
                backgroundColor: '#2d2d2d',
                color: 'white',
                borderRadius: '8px',
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontFamily: 'Jost, sans-serif',
                '&:hover': {
                  backgroundColor: '#1a1a1a',
                  transform: 'scale(1.01)',
                }
              }}
            >
              <motion.div
                animate={{ 
                  rotate: [0, 10, -10, 0],
                  scale: [1, 1.1, 1]
                }}
                transition={{ 
                  duration: 2,
                  repeat: Infinity,
                  repeatDelay: 3
                }}
              >
                <Visibility sx={{ fontSize: 18, color: '#31C473' }} />
              </motion.div>
              
              <Box sx={{ flex: 1 }}>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    fontFamily: 'Jost, sans-serif',
                    lineHeight: 1.2
                  }}
                >
                  View Similar Products
                </Typography>
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: 'rgba(255, 255, 255, 0.8)',
                    fontSize: '0.7rem',
                    fontFamily: 'Jost, sans-serif',
                    lineHeight: 1.2
                  }}
                >
                  Discover matching designs
                </Typography>
              </Box>

              <IconButton
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                sx={{
                  color: 'rgba(255, 255, 255, 0.7)',
                  padding: '2px',
                  '&:hover': {
                    color: 'white',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)'
                  }
                }}
              >
                <Close sx={{ fontSize: 14 }} />
              </IconButton>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // Original floating version
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 100, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 100, scale: 0.9 }}
          transition={{ 
            type: "spring", 
            stiffness: 400, 
            damping: 25,
            duration: 0.4 
          }}
          style={{
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            maxWidth: '90vw',
            width: 'auto'
          }}
        >
          <Box
            onClick={onViewSimilar}
            sx={{
              backgroundColor: '#2d2d2d',
              color: 'white',
              borderRadius: '12px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
              cursor: 'pointer',
              minWidth: '280px',
              transition: 'all 0.2s ease',
              fontFamily: 'Jost, sans-serif',
              '&:hover': {
                backgroundColor: '#1a1a1a',
                transform: 'scale(1.02)',
              }
            }}
          >
            <motion.div
              animate={{ 
                rotate: [0, 10, -10, 0],
                scale: [1, 1.1, 1]
              }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                repeatDelay: 3
              }}
            >
              <Visibility sx={{ fontSize: 24, color: '#31C473' }} />
            </motion.div>
            
            <Box sx={{ flex: 1 }}>
              <Typography 
                variant="body2" 
                sx={{ 
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  fontFamily: 'Jost, sans-serif'
                }}
              >
                View Similar Products
              </Typography>
              <Typography 
                variant="caption" 
                sx={{ 
                  color: 'rgba(255, 255, 255, 0.8)',
                  fontSize: '0.75rem',
                  fontFamily: 'Jost, sans-serif'
                }}
              >
                Discover matching designs
              </Typography>
            </Box>

            <IconButton
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              sx={{
                color: 'rgba(255, 255, 255, 0.7)',
                padding: '4px',
                '&:hover': {
                  color: 'white',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)'
                }
              }}
            >
              <Close sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SimilarProductsToast;