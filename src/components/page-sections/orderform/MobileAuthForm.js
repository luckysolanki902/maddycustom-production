'use client';

import React, { useState, useEffect } from 'react';
import { Box, TextField, InputAdornment, Typography, useMediaQuery, Button } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { Controller } from 'react-hook-form';
import theme from '@/styles/theme';
import PhoneIcon from '@mui/icons-material/Phone';

const MobileAuthForm = ({ 
  control, 
  errors, 
  onSubmit, 
  isSubmitting, 
  userExists, 
  showContinueButton, // New prop to determine if continue button should be shown
  showOtpForm, 
  setShowOtpForm,
  otpValue,
  setOtpValue,
  onVerifyOtp,
  isOtpVerifying,
  maskedPhone,
  resendAllowedAt,
  onResendOtp,
  isResending,
  onContinue
}) => {
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isSmallHeight = useMediaQuery('(max-height: 650px)');
  const isVerySmallHeight = useMediaQuery('(max-height: 550px)');
  const isTinyHeight = useMediaQuery('(max-height: 480px)');
  const isLargeScreen = useMediaQuery(theme.breakpoints.up('lg'));
  const [countdown, setCountdown] = useState(0);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (resendAllowedAt) {
      const interval = setInterval(() => {
        const now = new Date();
        const allowedTime = new Date(resendAllowedAt);
        const diff = Math.max(0, Math.ceil((allowedTime - now) / 1000));
        setCountdown(diff);
        
        if (diff <= 0) {
          clearInterval(interval);
        }
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [resendAllowedAt]);

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

  const formVariants = {
    phone: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.3, ease: "easeInOut" }
    },
    otp: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.3, ease: "easeInOut" }
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          px: isMobile ? 2.5 : isLargeScreen ? 4 : 3.5,
          py: isTinyHeight ? 1 : isVerySmallHeight ? 1.5 : isMobile ? 2 : isLargeScreen ? 3 : 2.5,
          overflow: 'auto',
          justifyContent: 'space-between',
        }}
      >
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{ textAlign: 'center', marginBottom: isTinyHeight ? 12 : isVerySmallHeight ? 16 : isMobile ? 20 : isLargeScreen ? 32 : 28, flexShrink: 0 }}
        >
          <Typography
            variant={isMobile ? "h5" : "h4"}
            sx={{
              fontFamily: 'Jost, sans-serif',
              fontWeight: 600,
              color: '#000',
              textAlign: 'center',
              mb: 0.5,
              fontSize: isTinyHeight ? '0.85rem' : isVerySmallHeight ? '0.95rem' : isSmallHeight ? '1rem' : isMobile ? '1.1rem' : isLargeScreen ? '2rem' : '1.8rem',
            }}
          >
            {showOtpForm ? 'Verify Your Number' : 'Enter Your Phone Number'}
          </Typography>
          
          <Typography
            variant="body2"
            sx={{
              fontFamily: 'Jost, sans-serif',
              color: '#666',
              textAlign: 'center',
              fontSize: isTinyHeight ? '0.65rem' : isVerySmallHeight ? '0.7rem' : isSmallHeight ? '0.75rem' : isMobile ? '0.75rem' : isLargeScreen ? '1rem' : '0.9rem',
              lineHeight: 1.2,
              px: isMobile ? 1 : 0,
            }}
          >
            {showOtpForm 
              ? `Enter the 6-digit code sent to ${maskedPhone}`
              : 'Get premium custom designs delivered to your doorstep'
            }
          </Typography>
        </motion.div>

        {/* Feature Highlights - Only show when not in OTP form and on desktop */}
        {!showOtpForm && !isMobile && !isVerySmallHeight && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            style={{ 
              marginBottom: isLargeScreen ? 32 : 24,
              marginTop: isLargeScreen ? 16 : 8,
              width: '100%',
              maxWidth: '420px',
              margin: `${isLargeScreen ? '16px' : '8px'} auto ${isLargeScreen ? '32px' : '24px'} auto`,
              flexShrink: 0
            }}
          >
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 2.5,
                py: 1,
                px: 2,
                px: 2,
                backgroundColor: 'rgba(45, 45, 45, 0.05)',
                borderRadius: '12px',
                border: '1px solid rgba(45, 45, 45, 0.1)',
                flexWrap: 'wrap',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    backgroundColor: '#2d2d2d',
                  }}
                />
                <Typography
                  variant="caption"
                  sx={{
                    fontFamily: 'Jost, sans-serif',
                    fontSize: '0.75rem',
                    color: '#2d2d2d',
                    fontWeight: 500,
                  }}
                >
                  Premium Quality
                </Typography>
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    backgroundColor: '#2d2d2d',
                  }}
                />
                <Typography
                  variant="caption"
                  sx={{
                    fontFamily: 'Jost, sans-serif',
                    fontSize: '0.75rem',
                    color: '#2d2d2d',
                    fontWeight: 500,
                  }}
                >
                  Custom Designs
                </Typography>
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    backgroundColor: '#2d2d2d',
                  }}
                />
                <Typography
                  variant="caption"
                  sx={{
                    fontFamily: 'Jost, sans-serif',
                    fontSize: '0.75rem',
                    color: '#2d2d2d',
                    fontWeight: 500,
                  }}
                >
                  24/7 Support
                </Typography>
              </Box>
            </Box>
          </motion.div>
        )}

        {/* Form Area */}
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: isMobile ? 'flex-start' : 'center',
          alignItems: 'center',
          flex: 1,
          maxWidth: '100%',
          width: '100%',
          minHeight: 0,
          pt: isMobile ? 1 : 0,
        }}>
          <AnimatePresence mode="wait">
            {!showOtpForm ? (
              <motion.div
                key="phone-form"
                variants={formVariants}
                initial={{ opacity: 0, x: -50 }}
                animate="phone"
                exit={{ opacity: 0, x: -50 }}
                style={{ width: '100%', maxWidth: '420px' }}
              >
                <Box
                  component="form"
                  onSubmit={onSubmit}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: isTinyHeight ? 1.5 : isVerySmallHeight ? 1.8 : isMobile ? 2 : 2.5,
                    width: '100%',
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (userExists && onContinue) {
                        onContinue();
                      } else {
                        onSubmit(e);
                      }
                    }
                  }}
                >
                  {/* Phone Input with Enhanced Design */}
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    <Box
                      sx={{
                        position: 'relative',
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          top: -2,
                          left: -2,
                          right: -2,
                          bottom: -2,
                          background: 'linear-gradient(45deg, rgba(45, 45, 45, 0.1), rgba(45, 45, 45, 0.05))',
                          borderRadius: '16px',
                          zIndex: -1,
                        }
                      }}
                    >
                      <Controller
                        name="phoneNumber"
                        control={control}
                        rules={{
                          required: 'Mobile number is required',
                          pattern: {
                            value: /^[6-9]\d{9}$/,
                            message: 'Please enter a valid 10-digit mobile number'
                          }
                        }}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            fullWidth
                            placeholder="Enter your mobile number"
                            error={!!errors.phoneNumber}
                            helperText={errors.phoneNumber?.message}
                            autoFocus
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <Box sx={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: 1,
                                    borderRight: '1px solid #e0e0e0',
                                    pr: 1.5,
                                    mr: 1
                                  }}>
                                    <PhoneIcon sx={{ color: '#2d2d2d', fontSize: 20 }} />
                                    <Typography
                                      variant="body2"
                                      sx={{
                                        fontFamily: 'Jost, sans-serif',
                                        fontWeight: 500,
                                        color: '#2d2d2d',
                                        fontSize: isTinyHeight ? '0.7rem' : isVerySmallHeight ? '0.75rem' : isSmallHeight ? '0.8rem' : '0.9rem'
                                      }}
                                    >
                                      +91
                                    </Typography>
                                  </Box>
                                </InputAdornment>
                              ),
                            }}
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                fontFamily: 'Jost, sans-serif',
                                fontSize: isTinyHeight ? '0.8rem' : isVerySmallHeight ? '0.85rem' : isSmallHeight ? '0.9rem' : '1rem',
                                height: isTinyHeight ? '40px' : isVerySmallHeight ? '42px' : isSmallHeight ? '44px' : isMobile ? '48px' : '52px',
                                borderRadius: '14px',
                                backgroundColor: '#fafbfc',
                                border: '1px solid #e8eaed',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                '&:hover': {
                                  backgroundColor: '#f8f9fa',
                                  borderColor: '#dadce0',
                                  transform: 'translateY(-1px)',
                                  boxShadow: '0 4px 12px rgba(45, 45, 45, 0.1)',
                                },
                                '&.Mui-focused': {
                                  backgroundColor: '#fff',
                                  borderColor: '#2d2d2d',
                                  boxShadow: '0 0 0 3px rgba(45, 45, 45, 0.1)',
                                  transform: 'translateY(-1px)',
                                },
                                '& .MuiOutlinedInput-notchedOutline': {
                                  border: 'none',
                                },
                              },
                              '& .MuiFormHelperText-root': {
                                fontFamily: 'Jost, sans-serif',
                                fontSize: '0.75rem',
                                marginLeft: '4px',
                                marginTop: '6px',
                              },
                            }}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                              field.onChange(value);
                            }}
                            inputProps={{
                              inputMode: 'numeric',
                              pattern: '[0-9]*',
                              maxLength: 10,
                            }}
                          />
                        )}
                      />
                    </Box>
                  </motion.div>

                  {/* Submit Button */}
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button
                      type={showContinueButton && onContinue ? "button" : "submit"}
                      onClick={showContinueButton && onContinue ? onContinue : undefined}
                      fullWidth
                      disabled={isSubmitting}
                      sx={{
                        mt: isTinyHeight ? 0.5 : isVerySmallHeight ? 0.8 : isMobile ? 1 : 1.5,
                        py: isTinyHeight ? 0.8 : isVerySmallHeight ? 0.9 : isMobile ? 1.2 : 1.5,
                        borderRadius: '12px',
                        fontSize: isMobile ? '1rem' : '1.1rem',
                        fontFamily: 'Jost, sans-serif',
                        fontWeight: 600,
                        textTransform: 'none',
                        letterSpacing: '0.5px',
                        background: 'linear-gradient(45deg, #000 30%, #333 90%)',
                        color: 'white',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                        border: 'none',
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          background: 'linear-gradient(45deg, #333 30%, #000 90%)',
                          boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
                          transform: 'translateY(-2px)',
                        },
                        '&:disabled': {
                          background: 'linear-gradient(45deg, #666 30%, #999 90%)',
                          color: 'rgba(255,255,255,0.7)',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                        },
                      }}
                    >
                      {isSubmitting ? 'Sending OTP...' : showContinueButton ? 'CONTINUE' : 'GET OTP'}
                    </Button>
                  </motion.div>
                </Box>
              </motion.div>
            ) : (
              <motion.div
                key="otp-form"
                variants={formVariants}
                initial={{ opacity: 0, x: 50 }}
                animate="otp"
                exit={{ opacity: 0, x: 50 }}
                style={{ width: '100%', maxWidth: '420px' }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: isMobile ? 2.5 : 3,
                    width: '100%',
                  }}
                >
                  {/* OTP Input with Enhanced Design */}
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    <TextField
                      fullWidth
                      placeholder="Enter 6-digit OTP"
                      value={otpValue}
                      onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && otpValue.length === 6) {
                          e.preventDefault();
                          onVerifyOtp();
                        }
                      }}
                      error={false}
                      autoFocus
                      inputProps={{
                        inputMode: 'numeric',
                        pattern: '[0-9]*',
                        maxLength: 6,
                      }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '12px',
                          fontSize: isMobile ? '1.1rem' : '1.3rem',
                          fontFamily: 'Jost, sans-serif',
                          fontWeight: 600,
                          background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                          border: '1px solid #e0e0e0',
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            borderColor: '#c0c0c0',
                          },
                          '&.Mui-focused': {
                            boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                            borderColor: '#000',
                          },
                          '& fieldset': {
                            border: 'none',
                          },
                        },
                        '& .MuiOutlinedInput-input': {
                          padding: isTinyHeight ? '8px 16px' : isVerySmallHeight ? '10px 16px' : isSmallHeight ? '12px 16px' : isMobile ? '14px 16px' : '16px 16px',
                          fontSize: isMobile ? '1.1rem' : '1.3rem',
                          fontFamily: 'Jost, sans-serif',
                          fontWeight: 600,
                          letterSpacing: '0.3em',
                          textAlign: 'center',
                          color: '#000',
                        },
                      }}
                    />
                  </motion.div>

                  {/* Verify Button */}
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button
                      fullWidth
                      disabled={isOtpVerifying || otpValue.length !== 6}
                      onClick={onVerifyOtp}
                      sx={{
                        mt: isTinyHeight ? 0.5 : isVerySmallHeight ? 0.8 : isMobile ? 1 : 1.5,
                        py: isTinyHeight ? 0.8 : isVerySmallHeight ? 0.9 : isMobile ? 1.2 : 1.5,
                        borderRadius: '12px',
                        fontSize: isMobile ? '1rem' : '1.1rem',
                        fontFamily: 'Jost, sans-serif',
                        fontWeight: 600,
                        textTransform: 'none',
                        letterSpacing: '0.5px',
                        background: 'linear-gradient(45deg, #000 30%, #333 90%)',
                        color: 'white',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                        border: 'none',
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          background: 'linear-gradient(45deg, #333 30%, #000 90%)',
                          boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
                          transform: 'translateY(-2px)',
                        },
                        '&:disabled': {
                          background: 'linear-gradient(45deg, #666 30%, #999 90%)',
                          color: 'rgba(255,255,255,0.7)',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                        },
                      }}
                    >
                      {isOtpVerifying ? 'Verifying...' : 'VERIFY & CONTINUE'}
                    </Button>
                  </motion.div>

                  {/* Resend OTP */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                  >
                    <Box sx={{ textAlign: 'center', mt: isMobile ? 0.5 : 1 }}>
                      {countdown > 0 ? (
                        <Typography
                          variant="body2"
                          sx={{
                            fontFamily: 'Jost, sans-serif',
                            color: '#666',
                            fontSize: '0.8rem',
                          }}
                        >
                          Resend OTP in {countdown}s
                        </Typography>
                      ) : (
                        <Button
                          onClick={onResendOtp}
                          disabled={isResending}
                          sx={{
                            fontSize: '0.8rem',
                            fontFamily: 'Jost, sans-serif',
                            fontWeight: 600,
                            color: '#000',
                            textTransform: 'none',
                            textDecoration: 'underline',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            '&:hover': {
                              background: 'none',
                              textDecoration: 'underline',
                              color: '#333',
                            },
                            '&:disabled': {
                              color: '#999',
                            },
                          }}
                        >
                          {isResending ? 'Resending...' : 'Resend OTP'}
                        </Button>
                      )}
                    </Box>
                  </motion.div>
                </Box>
              </motion.div>
            )}
          </AnimatePresence>
        </Box>
      </Box>
    </motion.div>
  );
};

export default MobileAuthForm;
