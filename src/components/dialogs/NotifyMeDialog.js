"use client";
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
  IconButton,
} from '@mui/material';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import CloseIcon from '@mui/icons-material/Close';
import { keyframes } from '@mui/system';

// Animations matching SubscribeDialog
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

export default function NotifyMeDialog({ 
  open, 
  onClose, 
  product, 
  selectedOption = null,
  onSuccess 
}) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async () => {
    // Validate phone number
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Get thumbnail image - prioritize option image, fallback to product image
      const getThumbnail = () => {
        const baseUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
        
        if (selectedOption?.images?.length > 0) {
          return `${baseUrl}/${selectedOption.images[0]}`;
        } else if (product.images?.length > 0) {
          return `${baseUrl}/${product.images[0]}`;
        }
        
        // Fallback to default helmet logo
        return `${baseUrl}/assets/logos/just-helmet.png`;
      };

      const requestBody = {
        phoneNumber: cleanPhone,
        templateName: 'restocked',
        notificationType: 'restocking',
        name: `restock_${product._id}_${selectedOption?._id || 'base'}_${cleanPhone}`,
        productId: product._id,
        optionId: selectedOption?._id,
        channels: ['whatsapp'], // WhatsApp only for restocking
        variables: {
          productTitle: product.title || product.name,
          productUrl: `${window.location.origin}${product.pageSlug}`,
          cloudfrontUrl: process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL,
          thumbnail: getThumbnail(),
          optionDetails: selectedOption?.optionDetails ? 
            Object.entries(selectedOption.optionDetails).map(([k, v]) => `${k}: ${v}`).join(', ') : 
            '',
        },
        whatsappParams: {
          templateParams: [product.title || product.name],
          buttons: [
            {
              type: "url",
              sub_type: "url",
              index: "0",
              parameters: [
                {
                  type: "text",
                  text: `${product.pageSlug}`
                }
              ]
            }
          ]
        },
        info: [
          { key: 'productTitle', value: product.title || product.name },
          { key: 'productSlug', value: product.pageSlug },
          { key: 'thumbnail', value: getThumbnail() },
          { key: 'inventoryId', value: selectedOption?.inventoryData?._id || product.inventoryData?._id },
          { key: 'source', value: 'notify_dialog' },
          ...(selectedOption ? [
            { key: 'optionSku', value: selectedOption.sku },
            { key: 'optionDetails', value: JSON.stringify(selectedOption.optionDetails) }
          ] : [])
        ],
      };

      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create notification');
      }

      setSuccess('Great! We\'ll notify you when this item is back in stock.');
      
      // Store phone number in localStorage for future checks
      localStorage.setItem('userPhoneNumber', cleanPhone);
      
      // Call success callback if provided
      if (onSuccess) {
        onSuccess(data.notification);
      }

      // Close dialog after 2 seconds
      setTimeout(() => {
        onClose();
        setSuccess('');
        setPhoneNumber('');
      }, 2000);

    } catch (err) {
      console.error('NotifyMeDialog: Error occurred:', err.message);
      
      // Improve error messages for better user experience
      let userFriendlyMessage = 'Something went wrong. Please try again.';
      
      if (err.message.includes('You\'re already set to be notified') || 
          err.message.includes('already exists') ||
          err.message.includes('duplicate') ||
          err.message.includes('already opted') ||
          err.message.includes('notification is already pending') ||
          err.message.includes('similar notification')) {
        userFriendlyMessage = 'You\'re already set to be notified for this item! We\'ll let you know as soon as it\'s back in stock.';
      } else if (err.message.includes('template not found')) {
        userFriendlyMessage = 'Notification service is temporarily unavailable. Please try again later.';
      } else if (err.message.includes('Invalid phone number')) {
        userFriendlyMessage = 'Please enter a valid 10-digit mobile number.';
      } else if (err.message.includes('Phone number, template name')) {
        userFriendlyMessage = 'Please fill in all required information.';
      }
      
      setError(userFriendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setError('');
      setSuccess('');
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={(event, reason) => {
        if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
          return;
        }
        handleClose();
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
          onClick={handleClose}
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
          
          {/* Notification Icon */}
          <Box
            sx={{
              p: 2,
              borderRadius: '50%',
              backgroundColor: 'rgba(45, 45, 45, 0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <NotificationsActiveIcon 
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
              Get notified when available
            </Typography>
            
            <Typography
              variant="body1"
              sx={{
                color: 'rgba(45, 45, 45, 0.7)',
                fontSize: '0.95rem',
                fontWeight: 500,
                lineHeight: 1.5,
                fontFamily: 'Jost, sans-serif',
              }}
            >
              We&apos;ll notify you via SMS & WhatsApp when <strong>{product.title || product.name}</strong>
              {selectedOption && (
                <span>
                  {' '}({Object.entries(selectedOption.optionDetails || {}).map(([k, v]) => `${k}: ${v}`).join(', ')})
                </span>
              )} is back in stock
            </Typography>
          </Box>

          {/* Error/Success Messages */}
          {error && (
            <Alert 
              severity="error" 
              sx={{ 
                width: '100%',
                maxWidth: '280px',
                borderRadius: '12px',
                fontSize: '0.9rem'
              }}
            >
              {error}
            </Alert>
          )}

          {success && (
            <Alert 
              severity="success" 
              sx={{ 
                width: '100%',
                maxWidth: '280px',
                borderRadius: '12px',
                fontSize: '0.9rem'
              }}
            >
              {success}
            </Alert>
          )}

          {/* Form */}
          <Box 
            sx={{ 
              width: '100%',
              maxWidth: '280px',
              display: 'flex', 
              flexDirection: 'column', 
              gap: 2.5
            }}
          >
            {/* Phone Input */}
            <Box sx={{ position: 'relative', width: '100%' }}>
              <input
                type="tel"
                inputMode="numeric"
                pattern="\d*"
                maxLength="10"
                value={phoneNumber}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  if (value.length <= 10) {
                    setPhoneNumber(value);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && phoneNumber.length === 10 && !loading && !success) {
                    handleSubmit();
                  }
                }}
                style={{
                  width: '100%',
                  padding: '16px 20px',
                  borderRadius: '16px',
                  border: error 
                    ? '2px solid rgba(244, 67, 54, 0.5)' 
                    : '2px solid rgba(45, 45, 45, 0.1)',
                  background: '#ffffff',
                  outline: 'none',
                  fontSize: '1rem',
                  fontFamily: 'Jost, sans-serif',
                  fontWeight: 500,
                  color: '#2d2d2d',
                  textAlign: 'center',
                  transition: 'all 0.2s ease',
                  boxSizing: 'border-box',
                }}
                placeholder="Enter mobile number"
                disabled={loading || success}
                onFocus={(e) => {
                  e.target.style.borderColor = 'rgba(45, 45, 45, 0.3)';
                  e.target.style.transform = 'scale(1.01)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = error 
                    ? 'rgba(244, 67, 54, 0.5)' 
                    : 'rgba(45, 45, 45, 0.1)';
                  e.target.style.transform = 'scale(1)';
                }}
              />
            </Box>

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              disabled={loading || success || phoneNumber.length !== 10}
              sx={{
                borderRadius: '16px',
                padding: '16px 24px',
                fontSize: '1rem',
                fontWeight: 600,
                fontFamily: 'Jost, sans-serif',
                background: '#2d2d2d',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden',
                textTransform: 'none',
                animation: !loading && !success ? `${pulse} 3s ease-in-out infinite` : 'none',
                '&:hover': {
                  background: 'rgba(45, 45, 45, 0.9)',
                  transform: 'translateY(-1px)',
                  boxShadow: '0 12px 24px rgba(45, 45, 45, 0.2)',
                },
                '&:active': {
                  transform: 'translateY(0px)',
                },
                '&:disabled': {
                  background: 'rgba(45, 45, 45, 0.6)',
                  cursor: 'not-allowed',
                },
                transition: 'all 0.2s ease',
                boxShadow: '0 8px 16px rgba(45, 45, 45, 0.15)',
              }}
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <NotificationsActiveIcon />}
            >
              {loading ? 'Setting up...' : success ? 'Done!' : 'Notify Me'}
            </Button>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
