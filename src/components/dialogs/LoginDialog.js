'use client';
import React, { useEffect, useState, useRef } from 'react';
import {
  Dialog, DialogContent, Box, IconButton,
  Button, TextField, Typography, CircularProgress
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
import { auth } from '@/lib/firebase/firebaseClient';
import { signInWithPhoneNumber, RecaptchaVerifier } from 'firebase/auth';

const OTP_RESEND_TIMEOUT = 30; // 5 minutes in seconds

const LoginDialog = () => {
  const dispatch = useDispatch();
  const pathname = usePathname();

  // Redux state
  const userExists = useSelector((state) => state.orderForm.userExists);
  console.log('userExists:', useSelector((state) => state.orderForm.userExists));
  const loginDialogShown = useSelector((state) => state.orderForm.loginDialogShown);
  const isCartDrawerOpen = useSelector((state) => state.ui.isCartDrawerOpen);
  console.log({ userExists, loginDialogShown, fullState: useSelector(s => s) });
  const { timeSpentOnWebsite, scrolledMoreThan60Percent } = useSelector((state) => state.userBehavior);
  const imageBaseUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

  const { control, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: {
      phoneNumber: '',
      otp: '',
    },
  });
  const isUserPhoneNumberValid = useSelector((state) => state.orderForm.userDetails?.phoneNumber?.length === 10);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState('phone');            // 'phone' or 'otp'
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, msg: '', sev: 'success' });

  // OTP resend timer state and ref for interval
  const [resendTimer, setResendTimer] = useState(0);
  const timerRef = useRef(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isResendingOtp, setIsResendingOtp] = useState(false);
  
  // Snackbar helper
  const showSnackbar = (msg, sev = 'success') => {
    setSnackbar({ open: true, msg, sev });
  };

  // Initialize invisible reCAPTCHA once
  const recaptchaVerifierRef = useRef(null);

useEffect(() => {
  // Only create if it doesn't already exist
  if (!window.recaptchaVerifier) {
    const verifier = new RecaptchaVerifier(auth, "recaptcha-container", {
      size: "invisible",
      callback: (response) => {
        console.log("reCAPTCHA solved:", response);
      },
      'expired-callback': () => {
        console.warn('reCAPTCHA expired');
      }
    });

    verifier.render().then((widgetId) => {
      console.log("Recaptcha rendered with widgetId:", widgetId);
    });

    window.recaptchaVerifier = verifier;
    recaptchaVerifierRef.current = verifier;
  } else {
    // Reuse the existing verifier
    recaptchaVerifierRef.current = window.recaptchaVerifier;
  }

  return () => {
    // Optional cleanup (not strictly required but safe)
    if (window.recaptchaVerifier) {
      try {
        window.recaptchaVerifier.clear();
      } catch (err) {
        console.warn('Failed to clear reCAPTCHA:', err);
      }
      delete window.recaptchaVerifier;
    }
    recaptchaVerifierRef.current = null;
  };
}, []);

  // Timer countdown logic
  const startResendTimer = () => {
    setResendTimer(OTP_RESEND_TIMEOUT);
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    async function checkLogin() {
      const res = await fetch('/api/checkSession');
      const data = await res.json();
        console.log('User is logged in:', data.isLoggedIn);

      if (data.isLoggedIn) {
        dispatch(setUserExists(true));
        dispatch(setLoginDialogShown(true));
      }
    }

    checkLogin();
  }, []);


  // Send OTP handler
  const onSendOtp = async ({ phoneNumber }) => {
    try {
      setIsSendingOtp(true);
      setPhoneNumber(phoneNumber);
      const full = '+91' + phoneNumber.trim();
      console.log('auth:', auth);
      console.log('phone number:', full);
      console.log('recaptchaVerifier:', window.recaptchaVerifier);
      if (!recaptchaVerifierRef.current) {
        showSnackbar('Recaptcha not ready', 'error');
        return;
      }

      const result = await signInWithPhoneNumber(auth, full, window.recaptchaVerifier);

      setConfirmationResult(result);
      setStep('otp');
      reset({ otp: '' }); // Clear phone number, show clean OTP input
      showSnackbar('OTP sent!', 'success');
      startResendTimer();
    } catch (error) {
      console.error('Failed to send OTP:', error);
      showSnackbar('Failed to send OTP', 'error');
    }finally {
      setIsSendingOtp(false); // Stop loading indicator
    }
  };

  // Resend OTP handler - only allowed when timer is zero
  const onResendOtp = async () => {
    if (resendTimer === 0) {
      setIsResendingOtp(true);
      // Use the phone number from form state or from userDetails Redux state
      let phone = phoneNumber.trim();
      try {
        // Try to get phone number from form value
        const formPhoneNumber = control._formValues?.phoneNumber;
        if (formPhoneNumber && formPhoneNumber.length === 10) {
          phone = formPhoneNumber;
        } else {
          // fallback to userDetails in redux (just in case)
          phone = useSelector(state => state.orderForm.userDetails?.phoneNumber?.slice(-10)) || '';
        }
      } catch {
        // fallback empty
      }

      if (!phone || phone.length !== 10) {
        showSnackbar('Phone number missing or invalid for resend', 'error');
        return;
      }

      try {
        const full = '+91' + phone.trim();
        const result = await signInWithPhoneNumber(auth, full, window.recaptchaVerifier);
        setConfirmationResult(result);
        showSnackbar('OTP resent!', 'success');
        startResendTimer();
      } catch (error) {
        console.error('Failed to resend OTP:', error);
        showSnackbar('Failed to resend OTP', 'error');
      } finally {
        setIsResendingOtp(false); // Stop loading indicator
      }
    }
  };

  // Verify OTP handler
  const onVerifyOtp = async ({ otp }) => {
    try {
      setIsVerifyingOtp(true);
      const userCred = await confirmationResult.confirm(otp);
      console.log('User credential:', userCred);
      if (userCred && userCred.user) {
        const idToken = await userCred.user.getIdToken();
        const response = await axios.post('/api/sessionLogin', { idToken });

        if (response.data.success) {
          let res = await axios.post('/api/login', { phoneNumber: userCred.user.phoneNumber.substring(3) });
          dispatch(setUserExists(true));
          dispatch(setUserDetails({ 
            phoneNumber: res.data.user.phoneNumber, 
            name: res.data.user.name || null,
            userId: res.data.user.userUuid
          }));
          dispatch(setLoginDialogShown(true)); // hide login dialog after login

          showSnackbar('Login successful!', 'success');
          handleClose();
        } else {
          showSnackbar('Login failed', 'error');
        }
      } else {
        showSnackbar('Authentication failed', 'error');
      }
    } catch (error) {
      showSnackbar('Invalid OTP', 'error');
    } finally {
      setIsVerifyingOtp(false); // Stop loading indicator
    }
  };

  const handleClose = () => {
    setOpen(false);
    setStep('phone');
    reset();
    dispatch(setLoginDialogShown(true));
    clearInterval(timerRef.current);
    setResendTimer(0);
  };

  // Show dialog on conditions
  useEffect(() => {
    console.log('Checking conditions to show login dialog', userExists, loginDialogShown, isUserPhoneNumberValid, timeSpentOnWebsite, scrolledMoreThan60Percent, isCartDrawerOpen, pathname);
    if (
      // timeSpentOnWebsite >= 0 
      // &&
      // // scrolledMoreThan60Percent &&
      // // !loginDialogShown &&
      // !isUserPhoneNumberValid &&
      // // !userExists &&
      // !isCartDrawerOpen &&
      // !pathname.startsWith('/orders/myorder/')
      1
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
    isCartDrawerOpen
  ]);

  if (isCartDrawerOpen) return null;

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
                    variant="outlined"
                    fullWidth
                    error={!!errors.phoneNumber}
                    helperText={errors.phoneNumber?.message}
                    inputProps={{ maxLength: 10, inputMode: 'numeric' }}
                  />
                )}
              />
            ) : (
              <Controller
                name="otp"
                control={control}
                rules={{
                  required: 'Required',
                  minLength: { value: 6, message: '6 digits' },
                  maxLength: { value: 6, message: '6 digits' },
                }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="OTP"
                    variant="outlined"
                    fullWidth
                    error={!!errors.otp}
                    helperText={errors.otp?.message}
                    inputProps={{ maxLength: 6, inputMode: 'numeric' }}
                  />
                )}
              />
            )}

            {step === 'otp' && (
              <Button
                variant="text"
                onClick={onResendOtp}
                disabled={resendTimer > 0}
                sx={{ alignSelf: 'center', mt: 0, textTransform: 'none' }}
                startIcon={isResendingOtp && <CircularProgress size={16} color="inherit" />}
              >
              {resendTimer > 0 
                ? `Resend OTP in ${resendTimer}s` 
                : (isResendingOtp ? 'Resending...' : 'Resend OTP')}
              </Button>
            )}

            <Button 
              variant="contained" 
              color="primary" 
              type="submit" 
              fullWidth
              disabled={step === 'phone' ? isSendingOtp : isVerifyingOtp}
              startIcon={
                (step === 'phone' && isSendingOtp) || (step === 'otp' && isVerifyingOtp) 
                  ? <CircularProgress size={20} color="inherit" /> 
                  : null
              }
              sx={{ position: 'relative' }}
            >
              {step === 'phone' 
                ? (isSendingOtp ? 'Sending OTP...' : 'Send OTP') 
                : (isVerifyingOtp ? 'Verifying OTP...' : 'Verify OTP')}
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

      <div id="recaptcha-container"></div>

      <CustomSnackbar
        open={snackbar.open}
        message={snackbar.msg}
        severity={snackbar.sev}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
      />
    </>
  );
}

export default LoginDialog;
