'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, Box, IconButton, Button, Typography } from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { useDispatch, useSelector } from 'react-redux';
import { setUserDetails, setUserExists, setLoginDialogShown } from '../../store/slices/orderFormSlice';
import { markSubscribeDialogDismissed, markSubscribeDialogSuccess } from '../../store/slices/persistentUiSlice';
import CustomSnackbar from '../notifications/CustomSnackbar';
import { usePathname } from 'next/navigation';
import CloseIcon from '@mui/icons-material/Close';
import Image from 'next/image';
import axios from 'axios';
import { keyframes } from '@mui/system';

// Minimal animations
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

const float = keyframes`
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-8px);
  }
`;

const SubscribeDialog = () => {
  const dispatch = useDispatch();
  const pathname = usePathname();

  // Access Redux state
  const userExists = useSelector((state) => state.orderForm.userExists);
  const loginDialogShown = useSelector((state) => state.orderForm.loginDialogShown);
  const isCartDrawerOpen = useSelector((state) => state.ui.isCartDrawerOpen);
  const { timeSpentOnWebsite, scrolledMoreThan60Percent } = useSelector((state) => state.userBehavior);
  const subscribeDialogFromState = useSelector((state) => state.persistentUi.subscribeDialog);
  const subscribeDialog = useMemo(() => subscribeDialogFromState || {
    lastDismissedAt: null,
    hasSuccessfullySubscribed: false,
    cooldownHours: 2,
  }, [subscribeDialogFromState]);
  const imageBaseUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
  
  const { control, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: {
      phoneNumber: '',
    },
  });
  
  const isUserPhoneNumberValid = useSelector((state) => state.orderForm.userDetails?.phoneNumber?.length === 10);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Helper function to check if dialog should be shown based on dismissal cooldown
  const shouldShowDialog = useCallback(() => {
    // Never show if user has already successfully subscribed
    if (subscribeDialog?.hasSuccessfullySubscribed) {
      return false;
    }

    // Check if dialog was dismissed recently and still in cooldown period
    if (subscribeDialog?.lastDismissedAt) {
      const cooldownPeriod = (subscribeDialog?.cooldownHours || 2) * 60 * 60 * 1000; // Convert hours to milliseconds
      const timeSinceDismissal = Date.now() - subscribeDialog.lastDismissedAt;
      
      if (timeSinceDismissal < cooldownPeriod) {
        return false; // Still in cooldown period
      }
    }

    return true;
  }, [subscribeDialog]);

  // Function to show snackbar
  const showSnackbar = (message, severity = 'success') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  // Handle form submission
  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      const response = await axios.post('/api/user/create', {
        phoneNumber: data.phoneNumber,
        source: 'subscribe-popup',
      });

      if (response.data.message === 'User already exists' || response.data.message === 'User exists and name updated') {
        dispatch(setUserExists(true));
        dispatch(setUserDetails({ phoneNumber: data.phoneNumber, userId: response.data.userId }));
        dispatch(markSubscribeDialogSuccess()); // Mark as successful subscription
        showSnackbar('🎉 You\'re all set! Get ready for exclusive deals!', 'success');
      } else if (response.data.message === 'User created successfully') {
        dispatch(setUserDetails({ phoneNumber: data.phoneNumber, userId: response.data.user.userId }));
        dispatch(markSubscribeDialogSuccess()); // Mark as successful subscription
        showSnackbar('🎉 Welcome to the VIP club! Exclusive deals coming your way!', 'success');
      }
      reset();
      setTimeout(() => handleClose(), 1500); // Auto-close after success
    } catch (error) {
      console.error('Error in SubscribeDialog:', error.message);
      showSnackbar('🚫 Oops! Something went wrong. Please try again!', 'error');
    }
    setIsSubmitting(false);
  };

  // Function to handle closing the dialog
  const handleClose = () => {
    setOpen(false);
    dispatch(setLoginDialogShown(true));
    dispatch(markSubscribeDialogDismissed()); // Mark as dismissed for cooldown tracking
  };

  // Open the dialog if conditions are met
  useEffect(() => {
    if (
      timeSpentOnWebsite >= 30 &&
      scrolledMoreThan60Percent &&
      !loginDialogShown &&
      !isUserPhoneNumberValid &&
      !userExists &&
      !isCartDrawerOpen &&
      !pathname.startsWith('/orders/myorder/') &&
      shouldShowDialog() // Check dismissal cooldown and subscription status
    ) {
      setOpen(true);
      dispatch(setLoginDialogShown(true));
    }
  }, [
    timeSpentOnWebsite, 
    scrolledMoreThan60Percent, 
    loginDialogShown, 
    userExists, 
    pathname, 
    dispatch, 
    isUserPhoneNumberValid, 
    isCartDrawerOpen,
    shouldShowDialog,
  ]);

  // Prevent rendering if cart drawer is open
  if (isCartDrawerOpen) return null;

  return (
    <>
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
          {/* Minimal Close Button */}
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
            
            {/* Helmet Logo */}
            <Box
              sx={{
                animation: `${float} 4s ease-in-out infinite`,
                position: 'relative',
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  bottom: -8,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '60px',
                  height: '2px',
                  background: 'linear-gradient(90deg, transparent, rgba(45, 45, 45, 0.1), transparent)',
                }
              }}
            >
              <Image
                src={`${imageBaseUrl}/assets/logos/just-helmet.png`}
                alt="MaddyCustom"
                width={72}
                height={72}
                style={{
                  width: '72px',
                  height: '72px',
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 8px 16px rgba(45, 45, 45, 0.1))',
                }}
              />
            </Box>

            {/* Persuasive Copy */}
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
                Get exclusive deals
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
                Join riders getting VIP access to new drops & special offers
              </Typography>
            </Box>

            {/* Form */}
            <Box 
              component="form" 
              onSubmit={handleSubmit(onSubmit)} 
              sx={{ 
                width: '100%',
                maxWidth: '280px',
                display: 'flex', 
                flexDirection: 'column', 
                gap: 2.5
              }}
            >
              {/* Phone Input */}
              <Controller
                name="phoneNumber"
                control={control}
                rules={{
                  required: 'Mobile number is required',
                  pattern: {
                    value: /^\d{10}$/,
                    message: 'Please enter a valid 10-digit mobile number',
                  },
                }}
                render={({ field }) => {
                  const handleChange = (e) => {
                    const value = e.target.value;
                    const numericValue = value.replace(/\D/g, '');
                    field.onChange(numericValue);
                  };

                  return (
                    <Box sx={{ position: 'relative', width: '100%' }}>
                      <input
                        {...field}
                        onChange={handleChange}
                        type="tel"
                        inputMode="numeric"
                        pattern="\d*"
                        maxLength="10"
                        style={{
                          width: '100%',
                          padding: '16px 20px',
                          borderRadius: '16px',
                          border: errors.phoneNumber 
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
                          '::placeholder': {
                            color: 'rgba(45, 45, 45, 0.4)',
                          }
                        }}
                        placeholder="Enter mobile number"
                        onFocus={(e) => {
                          e.target.style.borderColor = 'rgba(45, 45, 45, 0.3)';
                          e.target.style.transform = 'scale(1.01)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = errors.phoneNumber 
                            ? 'rgba(244, 67, 54, 0.5)' 
                            : 'rgba(45, 45, 45, 0.1)';
                          e.target.style.transform = 'scale(1)';
                        }}
                      />
                      {errors.phoneNumber && (
                        <Typography
                          variant="caption"
                          sx={{
                            color: 'rgba(244, 67, 54, 0.8)',
                            fontSize: '0.8rem',
                            position: 'absolute',
                            top: '100%',
                            left: '0',
                            mt: 0.5,
                            fontWeight: 500,
                          }}
                        >
                          {errors.phoneNumber.message}
                        </Typography>
                      )}
                    </Box>
                  );
                }}
              />

              {/* CTA Button */}
              <Button
                type="submit"
                disabled={isSubmitting}
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
                  animation: !isSubmitting ? `${pulse} 3s ease-in-out infinite` : 'none',
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
              >
                {isSubmitting ? 'Getting you in...' : 'Join VIP Club'}
              </Button>
            </Box>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Custom Snackbar for Notifications */}
      <CustomSnackbar
        open={snackbarOpen}
        message={snackbarMessage}
        severity={snackbarSeverity}
        handleClose={() => setSnackbarOpen(false)}
      />
    </>
  );
};

export default SubscribeDialog;
