// @/components/auth/AuthenticationFlow.js
'use client';

import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Button, 
  Typography, 
  TextField, 
  IconButton,
  CircularProgress,
  styled,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import { motion } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { 
  sendOTP, 
  verifyOTP, 
  resetAuthError, 
  decrementOtpTimer 
} from '@/store/slices/authSlice';
import OtpInput from './OtpInput';

const AuthenticationContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  width: '100%',
  maxWidth: '480px',
  margin: '0 auto',
  padding: theme.spacing(2),
}));

const PhoneInputWrapper = styled(Box)(({ theme }) => ({
  width: '100%',
  marginTop: theme.spacing(2),
}));

const StyledIconButton = styled(IconButton)(({ theme }) => ({
  marginBottom: theme.spacing(2),
  alignSelf: 'flex-start',
}));

const ActionButton = styled(Button)(({ theme }) => ({
  width: '100%',
  marginTop: theme.spacing(3),
  padding: theme.spacing(1.5),
  fontWeight: 600,
}));

const ResendButton = styled(Button)(({ theme }) => ({
  marginTop: theme.spacing(2),
  color: theme.palette.text.secondary,
}));

const ErrorMessage = styled(Typography)(({ theme }) => ({
  color: theme.palette.error.main,
  marginTop: theme.spacing(1),
  fontWeight: 500,
  fontSize: '0.875rem',
}));

const AuthenticationFlow = ({ onSuccess, onBack, phoneNumber: initialPhoneNumber }) => {
  const dispatch = useDispatch();
    // Local state
  const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber || '');
  const [otpValue, setOtpValue] = useState('');
  // Always show OTP input - no need for the phone number entry screen
  const [showOtpInput, setShowOtpInput] = useState(true);
    // Redux state
  const {
    isLoading,
    error,
    otpDetails = { waitTime: 0 }
  } = useSelector((state) => state.auth);
    // Timer effect for resend cooldown
  useEffect(() => {
    let timerId;
    // Check if otpDetails exists and has waitTime property
    if (otpDetails && otpDetails.waitTime > 0) {
      timerId = setInterval(() => {
        dispatch(decrementOtpTimer());
      }, 1000);
    }
    
    return () => clearInterval(timerId);
  }, [dispatch, otpDetails]);
  
  // Handle phone number input
  const handlePhoneChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 10);
    setPhoneNumber(value);
  };
  
  // Handle send OTP button click
  const handleSendOtp = async () => {
    if (phoneNumber.length !== 10) return;
    
    const result = await dispatch(sendOTP({ phoneNumber }));
    
    if (result.meta.requestStatus === 'fulfilled') {
      setShowOtpInput(true);
    }
  };
  
  // Handle OTP verification
  const handleVerifyOtp = async () => {
    if (otpValue.length !== 6) return;
    
    const result = await dispatch(verifyOTP({ phoneNumber, otp: otpValue }));
    
    if (result.meta.requestStatus === 'fulfilled') {
      if (onSuccess) onSuccess(result.payload.user);
    }
  };
    // Handle back button click - always go back to the form
  const handleBack = () => {
    // Always go back to the main form
    if (onBack) {
      onBack();
    }
  };
    // Handle resend OTP
  const handleResendOtp = async () => {
    if (otpDetails?.waitTime > 0) return;
    
    await dispatch(sendOTP({ phoneNumber }));
    setOtpValue('');
  };
  
  return (
    <AuthenticationContainer>
      <StyledIconButton onClick={handleBack}>
        <ArrowBackIcon />
      </StyledIconButton>
        <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{ width: '100%' }}
      >
        {/* Only OTP verification screen - no phone input screen */}
        <>
          <Typography variant="h5" gutterBottom>
            Verify your number
          </Typography>
          
          <Typography variant="body2" color="textSecondary" paragraph>            Enter the 6-digit code sent to <strong>{phoneNumber}</strong>
          </Typography>
          
          <Typography variant="body2" color="primary" paragraph>
            For testing, you can use <strong>123456</strong> as a universal OTP code.
          </Typography>
            
            <OtpInput
              length={6}
              value={otpValue}
              onChange={setOtpValue}
              disabled={isLoading}
            />
            
            {error && (
              <ErrorMessage variant="body2">
                {error}
              </ErrorMessage>
            )}
            
            <ActionButton
              variant="contained"
              color="primary"
              onClick={handleVerifyOtp}
              disabled={otpValue.length !== 6 || isLoading}
            >
              {isLoading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                'Verify & Continue'
              )}
            </ActionButton>
              <ResendButton
              variant="text"
              onClick={handleResendOtp}
              disabled={(otpDetails?.waitTime > 0) || isLoading}
            >
              {otpDetails?.waitTime > 0
                ? `Resend OTP in ${otpDetails.waitTime}s`
                : 'Resend OTP'}
            </ResendButton>          </>
      </motion.div>
    </AuthenticationContainer>
  );
};

export default AuthenticationFlow;
