"use client";
import React from 'react';
import {
  Dialog,
  DialogContent,
  Button,
  Typography,
  Box,
  IconButton,
} from '@mui/material';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import { keyframes } from '@mui/system';

// Animations matching NotifyMeDialog
const slideUp = keyframes`
  0% {
    transform: translateY(20px);
    opacity: 0;
  }
  100% {
    transform: translateY(0);
    opacity: 1;
  }
`;

const pulse = keyframes`
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.02);
  }
`;

export default function MinimumCartDialog({ 
  open, 
  onClose, 
  currentAmount,
  minimumAmount,
  shortfall,
  onContinueShopping
}) {
  const handleContinueShopping = () => {
    if (onContinueShopping) {
      onContinueShopping();
    }
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={(event, reason) => {
        if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
          return;
        }
        onClose();
      }}
      disableEscapeKeyDown
      fullWidth
      maxWidth="xs"
      PaperProps={{
        sx: {
          borderRadius: '24px',
          background: '#ffffff',
          boxShadow: '0 32px 64px rgba(45, 45, 45, 0.15)',
          border: '1px solid rgba(45, 45, 45, 0.08)',
          animation: `${slideUp} 0.6s ease-out`,
          overflow: 'visible',
          position: 'relative',
        },
      }}
    >
      <DialogContent sx={{ padding: 0, position: 'relative' }}>
        {/* Close Button */}
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            color: '#2d2d2d',
            opacity: 0.6,
            zIndex: 10,
            '&:hover': {
              opacity: 1,
              backgroundColor: 'rgba(45, 45, 45, 0.05)',
            },
            transition: 'all 0.2s ease',
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>

        {/* Main Content Container */}
        <Box sx={{ 
          px: 5, 
          py: 6, 
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 3
        }}>
          
          {/* Cart Icon */}
          <Box
            sx={{
              p: 2,
              borderRadius: '50%',
              backgroundColor: 'rgba(45, 45, 45, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.3s ease',
            }}
          >
            <ShoppingCartIcon 
              sx={{ 
                fontSize: '2rem', 
                color: '#2d2d2d' 
              }} 
            />
          </Box>

          {/* Title and Description */}
          <Box sx={{ maxWidth: '280px' }}>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 700,
                color: '#2d2d2d',
                mb: 1.5,
                fontSize: '1.5rem',
                fontFamily: 'Jost, sans-serif',
                lineHeight: 1.3,
              }}
            >
              Almost there! 🛒
            </Typography>
            
            <Typography
              variant="body1"
              sx={{
                color: 'rgba(45, 45, 45, 0.7)',
                fontSize: '0.95rem',
                fontWeight: 500,
                lineHeight: 1.5,
                fontFamily: 'Jost, sans-serif',
                mb: 2,
              }}
            >
              Add <strong>₹{shortfall}</strong> more to your cart to place your order.
            </Typography>

            {/* Progress Indicator */}
            <Box sx={{ width: '100%', mt: 2, mb: 1 }}>
              <Box
                sx={{
                  width: '100%',
                  height: '8px',
                  backgroundColor: 'rgba(45, 45, 45, 0.1)',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <Box
                  sx={{
                    width: `${(currentAmount / minimumAmount) * 100}%`,
                    height: '100%',
                    backgroundColor: '#4caf50',
                    borderRadius: '4px',
                    transition: 'width 0.3s ease',
                  }}
                />
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                <Typography
                  variant="caption"
                  sx={{
                    color: 'rgba(45, 45, 45, 0.6)',
                    fontSize: '0.75rem',
                    fontFamily: 'Jost, sans-serif',
                  }}
                >
                  ₹{currentAmount}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: '#4caf50',
                    fontSize: '0.75rem',
                    fontFamily: 'Jost, sans-serif',
                    fontWeight: 600,
                  }}
                >
                  ₹{minimumAmount}
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Action Button */}
          <Button
            onClick={handleContinueShopping}
            sx={{
              borderRadius: '16px',
              padding: '16px 32px',
              fontSize: '1rem',
              fontWeight: 600,
              fontFamily: 'Jost, sans-serif',
              background: 'linear-gradient(135deg, #2d2d2d, #424242)',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              position: 'relative',
              overflow: 'hidden',
              textTransform: 'none',
              minWidth: '200px',
              animation: `${pulse} 3s ease-in-out infinite`,
              '&:hover': {
                background: 'linear-gradient(135deg, #424242, #616161)',
                transform: 'translateY(-1px)',
                boxShadow: '0 12px 24px rgba(45, 45, 45, 0.3)',
              },
              '&:active': {
                transform: 'translateY(0px)',
              },
              transition: 'all 0.2s ease',
              boxShadow: '0 8px 16px rgba(45, 45, 45, 0.25)',
            }}
            startIcon={<AddIcon />}
          >
            Add More Items
          </Button>

          {/* Helpful tip */}
          <Typography
            variant="caption"
            sx={{
              color: 'rgba(45, 45, 45, 0.5)',
              fontSize: '0.8rem',
              fontFamily: 'Jost, sans-serif',
              fontStyle: 'italic',
              maxWidth: '250px',
            }}
          >
            Minimum order amount helps us provide better service and free shipping
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
}