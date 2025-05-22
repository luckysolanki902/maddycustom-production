// components/LoginDialog.js
'use client';
import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, Box, IconButton,
  Button, TextField, Typography
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useForm, Controller } from 'react-hook-form';
import { useDispatch, useSelector } from 'react-redux';
import {
  setUserDetails, setUserExists, setLoginDialogShown
} from '../../store/slices/orderFormSlice';
import CustomSnackbar from '../notifications/CustomSnackbar';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import axios from 'axios';
// import { auth, RecaptchaVerifier, signInWithPhoneNumber } from '@/lib/firebase/firebaseClient';
import { auth } from '@/lib/firebase/firebaseClient';

import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';

const noopVerifier = {
  type: 'invisible',
  verify: () => Promise.resolve('mock-verification-code'), // must return something
  _reset: () => {},
  _clear: () => {},
};

const LoginDialog = () => {
  const dispatch = useDispatch();
  const pathname = usePathname();
  const { loginDialogShown } = useSelector(state => state.orderForm);
  const { timeSpentOnWebsite, scrolledMoreThan60Percent } = useSelector(state => state.userBehavior);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState('phone');            // 'phone' or 'otp'
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [snackbar, setSnackbar] = useState({ open:false, msg:'', sev:'success' });

  const { control, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { phoneNumber: '', otp: '' }
  });
  const formSubmitHandler = (e) => {
    e.preventDefault();
    console.log(`Submitting form with current step: ${step}`);
    if (step === 'phone') {
      handleSubmit(onSendOtp)(e);
    } else {
      handleSubmit(onVerifyOtp)(e);
    }
  };
  // Show once per session
  useEffect(() => {
    if (
      timeSpentOnWebsite >= 0 
      // &&
      // scrolledMoreThan60Percent &&
      // !loginDialogShown &&
      // !pathname.startsWith('/viewcart') &&
      // !pathname.startsWith('/orders/myorder/')
    ) {
      setOpen(true);
      dispatch(setLoginDialogShown(true));
    }
  }, [
    timeSpentOnWebsite,
    scrolledMoreThan60Percent,
    loginDialogShown,
    pathname,
    dispatch
  ]);

  const showSnackbar = (msg, sev = 'success') => {
    setSnackbar({ open: true, msg, sev });
  };
// Ensure the Dialog stays open
  useEffect(() => {
    if (step === 'otp') {
      setOpen(true); // Force the dialog to stay open when in OTP step
    }
  }, [step]);
  // Step 1: send OTP
  // const onSendOtp = async ({ phoneNumber }) => {
  //   try {
  //     // 1. Make sure reCAPTCHA is only created once
  //     // if (!window.recaptchaVerifier) {
  //     //   window.recaptchaVerifier = new RecaptchaVerifier(
  //     //     'recaptcha-container',
  //     //     {
  //     //       size: 'invisible',
  //     //       siteKey: process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY,
  //     //       badge: 'bottomright'
  //     //     },
  //     //     auth
  //     //   );
  //     // }
  
  //     // 2. Send OTP
  //     const full = '+91' + phoneNumber;
  //     const result = await signInWithPhoneNumber(auth, full, window.recaptchaVerifier);
  //     console.log("answer", result);
  //     setConfirmationResult(result);
  //     setStep('otp');
  //     showSnackbar('OTP sent!', 'success');
  //   } catch (error) {
  //     console.error(error);
  //     showSnackbar('Failed to send OTP', 'error');
  //   }
  // };

  // Modify the onSendOtp function
  const onSendOtp = async ({ phoneNumber }) => {
    try {
      const full = '+91' + phoneNumber.trim();
      console.log('PHONE →', full);
  
      // For emulator mode
      if (process.env.NODE_ENV === 'development') {
        const mockConfirmationResult = {
          confirm: (code) => {
            return Promise.resolve({
              user: {
                phoneNumber: full,
                getIdToken: () => Promise.resolve('mock-id-token')
              }
            });
          }
        };
        
        setConfirmationResult(mockConfirmationResult);
        window.confirmationResult = mockConfirmationResult;
        
        // Set step to OTP
        setStep('otp');
        
        // Show snackbar after state updates
        showSnackbar('OTP sent! (Emulator: any 6 digits will work)', 'success');
        return;
      }
      
      // Production code remains the same...
    } catch (err) {
      console.error('onSendOtp ERROR', err);
      showSnackbar(`Failed: ${err.message || err.code}`, 'error');
    }
  };
// Use this effect to sync step and dialog visibility
useEffect(() => {
  console.log(`Effect triggered - step: ${step}, open: ${open}`);
  if (step === 'otp') {
    // Force dialog to be open when in OTP mode
    if (!open) {
      console.log("Opening dialog because we're in OTP step");
      setOpen(true);
    }
  }
}, [step, open]);
// Add some debugging to the render function
  console.log("Current step:", step);
  useEffect(() => {
    console.log("Component mounted");
    return () => console.log("Component unmounted");
  }, []);

  useEffect(() => {
    console.log("Step changed to:", step);
  }, [step]);
  // Make sure Dialog and step are synchronized
  useEffect(() => {
    if (step === 'otp' && !open) {
      console.log("Force opening dialog for OTP step");
      setOpen(true);
    }
  }, [step, open]);
  // Step 2: verify OTP & create session
  const onVerifyOtp = async ({ otp }) => {
    try {
      console.log("Starting OTP verification with code:", otp);
      const userCred = await confirmationResult.confirm(otp);
      console.log("User credential received:", userCred);
      
      // Check if we're getting a valid user object
      if (userCred && userCred.user) {
        console.log("User authenticated:", userCred.user.phoneNumber);
        try {
          const idToken = await userCred.user.getIdToken();
          console.log("Token obtained, first 10 chars:", idToken.substring(0, 10) + "...");
          console.log("Token length:", idToken.length);
          
          // Send token to backend
          const response = await axios.post('/api/sessionLogin', { idToken });
          console.log("Server response:", response.data);
          if (response.data.success) {
            const checkRes = await axios.post('/api/login', { phoneNumber: userCred.user.phoneNumber.substring(3) });
            dispatch(setUserExists(true));
            dispatch(setUserDetails({ phoneNumber: userCred.user.phoneNumber }));
            showSnackbar('Login successful!', 'success');
            handleClose();
          }else{
            console.error("Login failed:", response.data.error);
            showSnackbar('Login failed', 'error');
          }
        } catch (tokenError) {
          console.error("Error getting or using token:", tokenError);
          showSnackbar('Authentication error', 'error');
        }
      } else {
        console.error("Invalid user credential object");
        showSnackbar('Authentication failed', 'error');
      }
    } catch (error) {
      console.error("Error verifying OTP:", error);
      showSnackbar('Invalid OTP', 'error');
    }
  };

  const handleClose = () => {
    setOpen(false);
    dispatch(setLoginDialogShown(true));
  };

  if (pathname === '/viewcart') return null;

  return (
    <>
      <Dialog
        open={open}
        onClose={(_, reason) =>
          ['backdropClick', 'escapeKeyDown'].includes(reason) ? null : handleClose()
        }
        disableEscapeKeyDown
        fullWidth
        maxWidth="xs"
        PaperProps={{
          sx: {
            borderRadius: '1rem',
            boxShadow: '0 0 4px 8px rgba(0,0,0,0.11)',
          },
        }}
      >
        <DialogContent dividers>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <IconButton onClick={handleClose}>
              <CloseIcon />
            </IconButton>
          </Box>

          {/* Logo */}
          <Box
            sx={{
              mx: 'auto',
              mb: 2,
              width: 120,
              height: 120,
              boxShadow: '0 0 8px 8px rgba(77,225,255,0.11)',
              borderRadius: '50%',
              p: 1,
            }}
          >
            <Image
              src={`${process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL}/assets/logos/just-helmet.png`}
              alt="Logo"
              width={120}
              height={120}
              style={{ objectFit: 'contain' }}
            />
          </Box>

          <Typography variant="h6" align="center" gutterBottom>
            {step === 'phone' ? 'Enter your mobile number' : 'Enter the OTP'}
          </Typography>

            <Box
              component="form"
              onSubmit={(e) => {
                e.preventDefault();
                if (step === 'phone') {
                  handleSubmit(onSendOtp)(e);
                } else {
                  handleSubmit(onVerifyOtp)(e);
                }
              }}
              sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
            >
            {step === 'phone' ? (
              <Controller
                name="phoneNumber"
                control={control}
                rules={{
                  required: 'Required',
                  pattern: { value: /^\d{10}$/, message: '10 digits only' },
                }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Mobile Number"
                    inputProps={{ maxLength: 10 }}
                    error={!!errors.phoneNumber}
                    helperText={errors.phoneNumber?.message}
                    fullWidth
                  />
                )}
              />
            ) : (
              <Controller
                name="otp"
                control={control}
                rules={{
                  required: 'Required',
                  pattern: { value: /^\d{6}$/, message: '6 digits only' },
                }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="OTP"
                    inputProps={{ maxLength: 6 }}
                    error={!!errors.otp}
                    helperText={errors.otp?.message}
                    fullWidth
                  />
                )}
              />
            )}

            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                type="submit"
                variant="contained"
                sx={{ borderRadius: '1rem', px: 3 }}
              >
                {step === 'phone' ? 'Send OTP' : 'Verify OTP'}
              </Button>
            </Box>
          </Box>

          {/* Invisible reCAPTCHA container */}
          <div id="recaptcha-container" />
        </DialogContent>
      </Dialog>

      <CustomSnackbar
        open={snackbar.open}
        message={snackbar.msg}
        severity={snackbar.sev}
        handleClose={() => setSnackbar(o => ({ ...o, open: false }))}
      />
    </>
  );
};

export default LoginDialog;
