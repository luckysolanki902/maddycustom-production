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
// import { auth } from '@/lib/firebase/firebaseClient';
// import { signInWithPhoneNumber, RecaptchaVerifier } from 'firebase/auth';
import { signIn, useSession } from 'next-auth/react'; // Add NextAuth

const OTP_RESEND_TIMEOUT = 30; // 30 seconds timeout

const LoginDialog = () => {
  const dispatch = useDispatch();
  const pathname = usePathname();
  const { data: session, status } = useSession(); // Add this for NextAuth
const isSessionLoading = status === "loading";
  // Redux state
  const userExists = useSelector((state) => state.orderForm.userExists);
  const loginDialogShown = useSelector((state) => state.orderForm.loginDialogShown);
  const isCartDrawerOpen = useSelector((state) => state.ui.isCartDrawerOpen);
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
  const [step, setStep] = useState('phone');
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

// HMAC generation for Shiprocket API
const generateHMAC = (body) => {
  // This should be in a secure API route, not client-side!
  // For temporary testing only
  const SECRET_KEY = process.env.SHIPROCKET_SECRET_KEY;
  
  // In production, call your backend API to generate this
  return fetch('/api/shiprocket/generate-hmac', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).then(res => res.json()).then(data => data.hmac);
};

  // Initialize invisible reCAPTCHA once
  const recaptchaVerifierRef = useRef(null);
  const recaptchaInitialized = useRef(false);

  // Pre-warm Firebase for faster load
  // Add to preWarmFirebase function
  // const preWarmFirebase = () => {
  //   try {
  //     // Use the preloaded recaptcha if available
  //     if (window.preloadedRecaptcha && !recaptchaInitialized.current) {
  //       recaptchaVerifierRef.current = window.preloadedRecaptcha;
  //       recaptchaInitialized.current = true;
  //       return;
  //     }
      
  //     // Fall back to creating a new one
  //     if (!recaptchaInitialized.current) {
  //       const verifier = new RecaptchaVerifier(auth, "recaptcha-container", {
  //         size: "invisible",
  //         callback: () => {},
  //       });
        
  //       window.recaptchaVerifier = verifier;
  //       recaptchaVerifierRef.current = verifier;
  //       recaptchaInitialized.current = true;
  //     }
  //   } catch (err) {
  //     // Silent fail
  //   }
  // };
  let preloadPromise = null;

//  function preloadRecaptcha() {
//   if (!preloadPromise) {
//     preloadPromise = new Promise((resolve) => {
//       if (typeof window === 'undefined') return;
      
//       // Use requestIdleCallback to not block main thread
//       (window.requestIdleCallback || window.setTimeout)(() => {
//         const script = document.createElement('script');
//         script.src = 'https://www.google.com/recaptcha/api.js?render=explicit';
//         script.async = true;
//         script.defer = true;
        
//         script.onload = () => {
//           console.log('Recaptcha API loaded');
//           resolve(true);
//         };
        
//         document.head.appendChild(script);
//       }, { timeout: 5000 });
//     });
//   }
//   return preloadPromise;
// }
  useEffect(() => {
    if (status === "unauthenticated" && userExists) {
      // Session expired, update Redux
      dispatch(setUserExists(false));
    }
  }, [status, userExists, dispatch]);
  // useEffect(() => {
  //   // Pre-warm Firebase when component mounts
  //   preWarmFirebase();
    
  //   return () => {
  //     // Cleanup on unmount
  //     if (window.recaptchaVerifier) {
  //       try {
  //         window.recaptchaVerifier.clear();
  //       } catch (err) {}
  //       delete window.recaptchaVerifier;
  //     }
  //     recaptchaVerifierRef.current = null;
  //     recaptchaInitialized.current = false;
  //   };
  // }, []);
  // useEffect(() => {
  //   // Preload recaptcha in background
  //   preloadRecaptcha();
    
  //   // Connect to Firebase early
  //   auth._initializationPromise.catch(() => {});
  // }, []);
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

  // User mapping function for analytics
  const mapUserInBackground = (userId, phoneNumber, email) => {
    console.log("Mapping user in background:", userId, phoneNumber, email);
    fetch('http://tracker.wigzopush.com/rest/v1/learn/identify?token=966a282624127d21db2e233493a&org_token=JWF0V4pWQtjrX52Qg', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: userId,
        phone: phoneNumber,
        email: email || undefined,
        is_active: true,
        source: 'web'
      }),
      signal: AbortSignal.timeout(5000) // 5-second timeout
    }).then(response => {
      console.log("User mapped successfully:", response);
    }).catch(error => {
      // Silent fail - won't impact user experience
    });
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => clearInterval(timerRef.current);
  }, []);
  const currentName = useSelector(state => state.orderForm.userDetails.name);
  const currentPhoneNumber = useSelector(state => state.orderForm.userDetails.phoneNumber); 
  // Sync NextAuth session with Redux
  useEffect(() => {
    if (session?.user) {
      console.log("Session updated:", session.user);
      dispatch(setUserExists(true));
      dispatch(setUserDetails({ 
      phoneNumber: currentPhoneNumber || session.user.phoneNumber,
      name: currentName || session.user.name || null,
      userId: session.user.id
    }));
      dispatch(setLoginDialogShown(true));
      
      // Close dialog if it's open
      if (open) {
        handleClose();
      }
    }
  }, [session, dispatch, open]);

  // Send OTP handler
  // Optimized onSendOtp function with parallel API call
const onSendOtp = async ({ phoneNumber }) => {
  try {
    setIsSendingOtp(true);
    setPhoneNumber(phoneNumber);
    
    // Track operation start time for performance metrics
    const startTime = performance.now();
    const trimmedPhone = phoneNumber.trim();
    
    // Prepare request body
    const body = {
      country_code: "91",
      phone: trimmedPhone,
      modes: ["SMS"],
      timestamp: new Date().toISOString()
    };
    
    // Get HMAC signature from your backend API
    const hmacSignature = await generateHMAC(body);
    
    // Call Shiprocket API to send OTP
    const response = await fetch('https://fastrr-api-dev.pickrr.com/api/v1/access-token/s2s-login/initiate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': '23kcAkTHg3TTbvSC',
        'X-Api-HMAC-SHA256': hmacSignature
      },
      body: JSON.stringify(body)
    });
    
    const data = await response.json();
    console.log('Shiprocket OTP initiate response:', data);
    
    if (data.success) {
      // Store token for verification
      setConfirmationResult({
        shiprocketToken: data.token,
        verify: async (otp) => {
          // This will be called by onVerifyOtp
          return verifyShiprocketOtp(data.token, otp);
        }
      });
      
      // Update UI
      setStep('otp');
      reset({ otp: '' });
      startResendTimer();
      showSnackbar('OTP sent!', 'success');
      
      // Log performance
      console.log(`OTP send completed in ${(performance.now() - startTime).toFixed(0)}ms`);
    } else {
      throw new Error(data.message || 'Failed to send OTP');
    }
      
  } catch (error) {
    console.error("OTP send error:", error);
    showSnackbar(error.message || 'Failed to send OTP', 'error');
    setStep('phone');
  } finally {
    setIsSendingOtp(false);
  }
};

  // Resend OTP handler - only allowed when timer is zero
  const onResendOtp = async () => {
  if (resendTimer === 0 && !isResendingOtp) {
    setIsResendingOtp(true);
    
    // Start timer immediately for better UX
    startResendTimer();
    showSnackbar('Sending new OTP...', 'info');
    
    try {
      const phone = phoneNumber.trim();
      
      if (!phone || phone.length !== 10) {
        showSnackbar('Phone number missing or invalid', 'error');
        return;
      }

      // Prepare request body
      const body = {
        country_code: "91",
        phone: phone,
        modes: ["SMS"],
        timestamp: new Date().toISOString()
      };
      
      // Get HMAC signature
      const hmacSignature = await generateHMAC(body);
      
      // Call Shiprocket API to resend OTP
      const response = await fetch('https://fastrr-api-dev.pickrr.com/api/v1/access-token/s2s-login/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': '23kcAkTHg3TTbvSC',
          'X-Api-HMAC-SHA256': hmacSignature
        },
        body: JSON.stringify(body)
      });
      
      const data = await response.json();
      
      if (data.success) {
        setConfirmationResult({
          shiprocketToken: data.token,
          verify: async (otp) => {
            return verifyShiprocketOtp(data.token, otp);
          }
        });
        
        showSnackbar('OTP resent!', 'success');
      } else {
        throw new Error(data.message || 'Failed to resend OTP');
      }
    } catch (error) {
      console.error("OTP resend error:", error);
      showSnackbar(error.message || 'Failed to resend OTP', 'error');
      
      // Reset timer so user can try again immediately
      setResendTimer(0);
      clearInterval(timerRef.current);
    } finally {
      setIsResendingOtp(false);
    }
  }
};

const onVerifyOtp = async ({ otp }) => {
  try {
    setIsVerifyingOtp(true);
    
    // Verify with Shiprocket
    const userCred = await confirmationResult.verify(otp);
    
    if (userCred && userCred.user) {
      // Get token from Shiprocket response
      const idToken = await userCred.user.getIdToken();
      
      // Update UI optimistically 
      showSnackbar('Successfully verified!', 'success');
      
      // Sign in with NextAuth using Shiprocket token
      const authResult = await signIn("credentials", {
        redirect: false,
        idToken,
        provider: "shiprocket" // Add provider to differentiate from Firebase
      });
      
      // Update user verification status
      await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phoneNumber: phoneNumber.trim(),
          verificationStatus: 'verified'
        })
      });
      
      if (authResult?.ok) {
        // Success! Close dialog
        handleClose();
        
        // Map user in background
        setTimeout(() => {
          if (session?.user) {
            mapUserInBackground(
              session.user.id,
              session.user.phoneNumber.substring(3),
              session.user.email
            );
          }
        }, 500);
      } else {
        showSnackbar('Session creation failed', 'error');
      }
    } else {
      showSnackbar('Authentication failed', 'error');
    }
  } catch (error) {
    console.error("OTP verification error:", error);
    showSnackbar(error.message || 'Invalid OTP', 'error');
  } finally {
    setIsVerifyingOtp(false);
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
    if (
      // !loginDialogOpen &&
      // timeSpentOnWebsite >= 30 
      // && scrolledMoreThan60Percent &&
      // !loginDialogShown &&
      // !isUserPhoneNumberValid &&
      // !userExists &&
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
    isCartDrawerOpen,
    // loginDialogOpen
  ]);

  if (isCartDrawerOpen) return null;

  // Rest of your component remains largely the same
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
            {isSessionLoading && <CircularProgress size={16} />}
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
          {isSessionLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
              <CircularProgress size={16} />
              <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
                Syncing session...
              </Typography>
            </Box>
          )}
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
              disabled={
                step === 'phone' 
                  ? isSendingOtp 
                  : (isVerifyingOtp || isSessionLoading)
              }
              startIcon={
                (step === 'phone' && isSendingOtp) || 
                (step === 'otp' && (isVerifyingOtp || isSessionLoading))
                  ? <CircularProgress size={20} color="inherit" /> 
                  : null
              }
              sx={{ position: 'relative' }}
            >
              {step === 'phone' 
                ? (isSendingOtp ? 'Sending OTP...' : 'Send OTP') 
                : (isVerifyingOtp 
                    ? 'Verifying OTP...' 
                    : (isSessionLoading ? 'Logging in...' : 'Verify OTP')
                  )
              }
            </Button>
          </Box>
        </DialogContent>
      </Dialog>


      {/* Hidden div for recaptcha */}
      <div id="recaptcha-container" style={{ position: 'absolute', visibility: 'hidden' }}></div>

      <CustomSnackbar
        open={snackbar.open}
        message={snackbar.msg}
        severity={snackbar.sev}
        autoHideDuration={2000} // Auto-dismiss after 2 seconds
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
      />
    </>
  );
};

export default LoginDialog;