'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  TextField,
  Autocomplete,
  Typography,
  useMediaQuery,
  CircularProgress,
  alpha,
  Button
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BlackButton from '../utils/BlackButton';
import { useForm, Controller } from 'react-hook-form';
import axios from 'axios';
import indianStates from '../../lib/constants/indianStates';
import { useSelector, useDispatch } from 'react-redux';
import { clearCart } from '../../store/slices/cartSlice';
import { clearUTMDetails } from '@/store/slices/utmSlice';
import {
  resetOrderForm,
  setUserDetails,
  setAddressDetails,
  setUserExists,
  setPrefilledAddress,
  setLastOrderId,
  setCoupon,
  removeCoupon,
  setExtraFields
} from '../../store/slices/orderFormSlice';
import { closeAllDialogs } from '@/store/slices/uiSlice';  // Import the new action
import { makePayment } from '../../lib/payments/makePayment';
import { useRouter } from 'next/navigation';
import CustomSnackbar from '../notifications/CustomSnackbar';
import { getPaymentButtonText } from '../../lib/utils/orderFormUtils';
import { ThemeProvider } from '@mui/material';
import theme from '@/styles/theme';
import { initiateCheckout, purchase } from '@/lib/metadata/facebookPixels';
import { v4 as uuidv4 } from 'uuid';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber'; // Added
import { debounce } from 'lodash';
import useHistoryState from '@/hooks/useHistoryState';
import { auth } from '@/lib/firebase/firebaseClient';
import { signInWithPhoneNumber, RecaptchaVerifier } from 'firebase/auth';

const OTP_RESEND_TIMEOUT = 30; // 30 seconds

const OrderForm = ({
  open,
  onClose,
  paymentModeConfig,
  couponCode,
  totalCost,
  couponsDetails,
  deliveryCost,
  discountAmountFinal,
  items,
  subTotal
}) => {
  const dispatch = useDispatch();
  const router = useRouter();
  const cartItems = useSelector((state) => state.cart.items);
  const orderForm = useSelector((state) => state.orderForm);
  const utmDetails = useSelector((state) => state.utm);
  const { userDetails, addressDetails, userExists, prefilledAddress } = orderForm;
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Performance optimization - serviceability cache
  const serviceabilityCache = useRef({});
  const [isPincodeValid, setIsPincodeValid] = useState(false);
  const [pincodeCheckInProgress, setPincodeCheckInProgress] = useState(false);

  // Background processing refs and state
  const pendingOperationsRef = useRef({
    userCheck: null,
    addressAdd: null,
    couponValidation: null,
  });

  // Local Tab Index State - memoize to prevent rerenders
  const [tabIndex, setTabIndex] = useState(0);
  
  // OTP verification states
  const [otpStep, setOtpStep] = useState('phone'); // 'phone' or 'otp'
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isResendingOtp, setIsResendingOtp] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const timerRef = useRef(null);
  const recaptchaVerifierRef = useRef(null);

  // Snackbar state
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');

  const [isLoading, setIsLoading] = useState(false);
  const [isPaymentProcessing, setIsPaymentProcessing] = useState(false);
  const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
const validatePhoneNumber = (value) => {
  if (!value) return 'Mobile number is required';
  
  const digitsOnly = value.replace(/\D/g, '');
  
  // Check if it's exactly 10 digits after formatting
  const formattedPhone = formatPhoneNumber(value);
  if (formattedPhone.length !== 10) {
    // If user entered something like country code
    if (digitsOnly.length > 10) {
      return 'Please enter only 10 digits without country code';
    } else if (digitsOnly.length < 10) {
      return 'Phone number must be 10 digits';
    }
  }
  
  return true;
};

  // Extract and aggregate unique extraFields from cart items - memoized
  const aggregatedExtraFields = useMemo(() => {
    const fieldsMap = new Map();
    items.forEach((item) => {
      const category = item.productDetails.category;
      if (category && category.extraFields && category.extraFields.length > 0) {
        category.extraFields.forEach((field) => {
          if (!fieldsMap.has(field.fieldName)) {
            fieldsMap.set(field.fieldName, field);
          }
        });
      }
    });
    return Array.from(fieldsMap.values());
  }, [items]);
// Add this function at the top of your component (after your existing imports)
const mapUserInBackground = (userId, phoneNumber, email) => {
  // Fire and forget - this won't block the UI
  fetch('http://tracker.wigzopush.com/rest/v1/learn/identify', {
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
    // Adding the tokens in the URL to avoid CORS issues
    signal: AbortSignal.timeout(5000) // 5-second timeout
  }).then(response => {
    console.log('User mapping completed in background');
  }).catch(error => {
    console.error('Background user mapping failed:', error);
    // Silent fail - won't impact user experience
  });
};
  // Setup react-hook-form with defaultValues as a memoized object to prevent rerenders
  const defaultValues = useMemo(() => ({
    name: userDetails.name || '',
    phoneNumber: userDetails.phoneNumber || '',
    email: userDetails.email || '',
    otp: '', // Add OTP field
    addressLine1: addressDetails.addressLine1 || '',
    addressLine2: addressDetails.addressLine2 || '',
    city: addressDetails.city || '',
    state: addressDetails.state || '',
    pincode: addressDetails.pincode || '',
    country: addressDetails.country || 'India',
    ...aggregatedExtraFields.reduce((acc, field) => {
      acc[field.fieldName] = '';
      return acc;
    }, {}),
  }), [userDetails.name, userDetails.phoneNumber, userDetails.email,
  addressDetails.addressLine1, addressDetails.addressLine2, addressDetails.city,
  addressDetails.state, addressDetails.pincode, addressDetails.country,
    aggregatedExtraFields]);

  // Initialize reCAPTCHA for Firebase Phone Auth
  useEffect(() => {
    if (open) {
      // Clear any existing verifier to avoid conflicts
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
        } catch (err) {
          console.warn('Failed to clear existing reCAPTCHA:', err);
        }
        delete window.recaptchaVerifier;
      }
  
      // Create new verifier with more robust error handling
      try {
        const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible',
          callback: (response) => {
            console.log('reCAPTCHA solved with token length:', response?.length || 0);
          },
          'expired-callback': () => {
            console.log('reCAPTCHA expired');
            // Force recreation on expiry
            if (window.recaptchaVerifier) {
              try {
                window.recaptchaVerifier.clear();
              } catch (e) {}
              delete window.recaptchaVerifier;
              recaptchaVerifierRef.current = null;
            }
          }
        });
  
        window.recaptchaVerifier = verifier;
        recaptchaVerifierRef.current = verifier;
        
        console.log('reCAPTCHA instance created');
      } catch (error) {
        console.error('Error initializing reCAPTCHA:', error);
      }
    }
    
    return () => {
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
        } catch (err) {
          console.warn('Failed to clear reCAPTCHA on unmount:', err);
        }
        delete window.recaptchaVerifier;
      }
      recaptchaVerifierRef.current = null;
    };
  }, [open]);

  // Initialize extraFields in Redux store when dialog opens
  useEffect(() => {
    if (open && aggregatedExtraFields.length > 0) {
      const initialExtraFieldValues = {};
      aggregatedExtraFields.forEach((field) => {
        initialExtraFieldValues[field.fieldName] = ''; // Initialize with empty string
      });
      dispatch(setExtraFields(initialExtraFieldValues));
    }
  }, [open, aggregatedExtraFields, dispatch]);

  const {
    control,
    handleSubmit,
    setValue,
    reset,
    getValues,
    formState: { errors },
    watch,
    trigger,
  } = useForm({
    defaultValues,
    mode: 'onChange',
    shouldUnregister: false // Prevents field unregistration which helps with focus issues
  });

  // Watch pincode for immediate validation
  const watchedPincode = watch('pincode');
  const watchedPhoneNumber = watch('phoneNumber');

  // Check if user is already logged in
  useEffect(() => {
    if (open && userExists) {
      setPhoneVerified(true);
      setOtpStep('verified');
      
      // If user exists and we have their phone number, use it
      if (userDetails.phoneNumber) {
        setValue('phoneNumber', userDetails.phoneNumber);
      }
    }
  }, [open, userExists, userDetails.phoneNumber, setValue]);

  // Timer countdown logic for OTP resend
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
  const showSnackbar = useCallback((message, severity = 'success') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  }, []);
// First, move the validatePincode function definition above where it's being used
// Place this code after your state declarations but before any useEffects that use it

// Enhanced pincode validation with proactive serviceability check
const validatePincode = useCallback(
  debounce(async (pincode) => {
    if (pincode.length === 6 && /^\d{6}$/.test(pincode)) {
      setPincodeCheckInProgress(true);

      // Check cache first
      if (serviceabilityCache.current[pincode] !== undefined) {
        setPincodeCheckInProgress(false);
        setIsPincodeValid(serviceabilityCache.current[pincode]);
        return;
      }

      try {
        const response = await axios.get(
          `/api/checkout/order/shiprocket/serviceability?pickup_postcode=226005&delivery_postcode=${pincode}`
        );

        const isValid = response.data.serviceable;
        serviceabilityCache.current[pincode] = isValid;
        setIsPincodeValid(isValid);

        if (!isValid) {
          showSnackbar(`Pincode ${pincode} is not serviceable. Please try a different one.`, 'warning');
        }
      } catch (error) {
        console.error('Error checking pincode:', error);
      } finally {
        setPincodeCheckInProgress(false);
      }
    } else {
      setIsPincodeValid(false);
    }
  }, 300),
  [showSnackbar]
);

// Now your useEffect can use validatePincode without issues
  // Cleanup timer on unmount
 useEffect(() => {
  return () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  };
}, []);

// Effect for early pincode validation
useEffect(() => {
  if (watchedPincode?.length === 6 && /^\d{6}$/.test(watchedPincode)) {
    // Check if we've already validated this pincode
    if (serviceabilityCache.current[watchedPincode] !== undefined) {
      setIsPincodeValid(serviceabilityCache.current[watchedPincode]);
    } else {
      validatePincode(watchedPincode);
    }
  } else if (watchedPincode?.length > 0) {
    // Reset pincode validation if it's not a 6-digit code
    setIsPincodeValid(false);
  }
}, [watchedPincode, validatePincode]);

  // Prevent multiple form submissions
  const [purchaseInitiated, setPurchaseInitiated] = useState(false);

  // Reset tabIndex when dialog opens
  useEffect(() => {
    if (open) {
      setTabIndex(0);
      setPurchaseInitiated(false);
      
      // Reset OTP state if not logged in
      if (!userExists) {
        setOtpStep('phone');
        setPhoneVerified(false);
      } else {
        setOtpStep('verified');
        setPhoneVerified(true);
      }
    }
  }, [open, userExists]);

  // Sync form values with Redux store when dialog is opened
  useEffect(() => {
    if (open) {
      setValue('name', userDetails.name || '');
      setValue('phoneNumber', userDetails.phoneNumber || '');
      setValue('email', userDetails.email || '');
      setValue('addressLine1', addressDetails.addressLine1 || '');
      setValue('addressLine2', addressDetails.addressLine2 || '');
      setValue('city', addressDetails.city || '');
      setValue('state', addressDetails.state || '');
      setValue('pincode', addressDetails.pincode || '');
      setValue('country', addressDetails.country || 'India');

      // Pre-validate pincode if it exists
      if (addressDetails.pincode && addressDetails.pincode.length === 6) {
        validatePincode(addressDetails.pincode);
      }
    }
  }, [open, setValue, userDetails.name, userDetails.phoneNumber, userDetails.email,
    addressDetails.addressLine1, addressDetails.addressLine2, addressDetails.city,
    addressDetails.state, addressDetails.pincode, addressDetails.country]);

  // Handle Prefilled Address
  useEffect(() => {
    if (userExists && prefilledAddress) {
      dispatch(setAddressDetails(prefilledAddress));
      dispatch(setUserExists(false));
      dispatch(setPrefilledAddress(null));
      setTabIndex(1);

      // Pre-validate pincode from prefilled address
      if (prefilledAddress.pincode && prefilledAddress.pincode.length === 6) {
        validatePincode(prefilledAddress.pincode);
      }
    } else if (userExists && !prefilledAddress) {
      // If there's already an address in Redux, skip to tab 1
      const reduxAddress = addressDetails;
      if (
        reduxAddress.addressLine1 ||
        reduxAddress.addressLine2 ||
        reduxAddress.city ||
        reduxAddress.state ||
        reduxAddress.pincode ||
        reduxAddress.country
      ) {
        setTabIndex(1);

        // Pre-validate pincode from redux address
        if (reduxAddress.pincode && reduxAddress.pincode.length === 6) {
          validatePincode(reduxAddress.pincode);
        }
      }
    }
  }, [userExists, prefilledAddress, dispatch, addressDetails]);

  const handleTabChange = useCallback((newValue) => {
    setTabIndex(newValue);
  }, []);

  // State for formatted phone number display - memoized
  const [formattedPhone, setFormattedPhone] = useState('');
  const [showPhoneConfirmation, setShowPhoneConfirmation] = useState(false);
  const [originalPhone, setOriginalPhone] = useState('');

  // Function to format phone number - memoized to prevent rerenders
  const formatPhoneNumber = useCallback((phone) => {
    // Keep only digits
    if (!phone) return '';
    let digitsOnly = phone.replace(/\D/g, '');

    // Handle common Indian prefixes
    if (digitsOnly.length > 10) {
      // Remove leading 0
      if (digitsOnly.startsWith('0')) {
        digitsOnly = digitsOnly.substring(1);
      }

      // Remove country code +91 or 91
      if (digitsOnly.startsWith('91') && digitsOnly.length > 10) {
        digitsOnly = digitsOnly.substring(2);
      }
    }

    // Return the last 10 digits if longer
    if (digitsOnly.length > 10) {
      digitsOnly = digitsOnly.substring(digitsOnly.length - 10);
    }

    return digitsOnly;
  }, []);

  // Handle phone formatting and confirmation - memoized to prevent rerenders
  const handlePhoneChange = useCallback((e, onChange) => {
    const inputValue = e.target.value;
    onChange(inputValue); // Update the raw input in the form

    // If already valid 10-digit number, no need for formatting
    if (/^\d{10}$/.test(inputValue)) {
      setShowPhoneConfirmation(false);
      return;
    }

    const formatted = formatPhoneNumber(inputValue);

    // Only show confirmation if input isn't valid but formatted version is
    if (formatted !== inputValue && /^\d{10}$/.test(formatted)) {
      setFormattedPhone(formatted);
      setOriginalPhone(inputValue);
      setShowPhoneConfirmation(true);
    } else {
      setShowPhoneConfirmation(false);
    }
  }, [formatPhoneNumber]);

  const acceptFormattedPhone = useCallback(() => {
    setValue('phoneNumber', formattedPhone, { shouldValidate: true });
    dispatch(setUserDetails({ phoneNumber: formattedPhone }));
    setShowPhoneConfirmation(false);
  }, [formattedPhone, setValue, dispatch]);

  // New function to fully close everything - both OrderForm and CartDrawer
  const handleFullClose = useCallback(() => {
    onClose();
    dispatch(closeAllDialogs());
  }, [onClose, dispatch]);
  
  // Pre-validate coupon in background as soon as form opens
  useEffect(() => {
    if (open && couponCode && subTotal > 0) {
      // Start coupon validation in background
      pendingOperationsRef.current.couponValidation = axios.post('/api/checkout/coupons/apply', {
        code: couponCode,
        totalCost: subTotal,
        isFirstOrder: false,
        cartItems: items,
      }).catch(error => {
        console.error('Background coupon validation failed:', error);
      });
    }
  }, [open, couponCode, subTotal, items]);

  // Send OTP handler
  const onSendOtp = async () => {
  try {
    setIsSendingOtp(true);
    
    // Validate name and phone fields
    const isValid = await trigger(['name', 'phoneNumber']); 
    if (!isValid) {
      setIsSendingOtp(false);
      return;
    }
    
    const phoneNumber = getValues('phoneNumber');
    const name = getValues('name');
    
    // Format and validate phone number
    const formattedPhoneNumber = formatPhoneNumber(phoneNumber);
    if (formattedPhoneNumber.length !== 10) {
      showSnackbar('Please enter a valid 10-digit mobile number', 'error');
      setIsSendingOtp(false);
      return;
    }
    
    // Update Redux store with user details
    dispatch(setUserDetails({
      name,
      phoneNumber: formattedPhoneNumber,
      email: getValues('email') || '',
    }));
    
    // Initialize reCAPTCHA if not already done
    if (!window.recaptchaVerifier) {
      try {
        const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible',
          callback: () => {},
          'expired-callback': () => {
            if (window.recaptchaVerifier) {
              try {
                window.recaptchaVerifier.clear();
              } catch (e) {}
              delete window.recaptchaVerifier;
              recaptchaVerifierRef.current = null;
            }
          }
        });
        
        window.recaptchaVerifier = verifier;
        recaptchaVerifierRef.current = verifier;
      } catch (error) {
        console.error('Error initializing reCAPTCHA:', error);
        showSnackbar('Verification system initialization failed. Please try again.', 'error');
        setIsSendingOtp(false);
        return;
      }
    }
    
    const full = '+91' + formattedPhoneNumber;
    const result = await signInWithPhoneNumber(auth, full, window.recaptchaVerifier);
    setConfirmationResult(result);
    setOtpStep('otp');
    setValue('otp', ''); 
    showSnackbar('OTP sent successfully!', 'success');
    startResendTimer();
  } catch (error) {
    console.error('Failed to send OTP:', error);
    // If reCAPTCHA fails, try to reinitialize it
    if (window.recaptchaVerifier) {
      try {
        window.recaptchaVerifier.clear();
      } catch (e) {}
      delete window.recaptchaVerifier;
      recaptchaVerifierRef.current = null;
    }
    showSnackbar(error.message || 'Failed to send OTP. Please try again.', 'error');
  } finally {
    setIsSendingOtp(false);
  }
};

  // Resend OTP handler
  const onResendOtp = async () => {
    if (resendTimer === 0) {
      try {
        setIsResendingOtp(true);
        const phoneNumber = getValues('phoneNumber');
        
        if (!phoneNumber || phoneNumber.length !== 10) {
          showSnackbar('Phone number missing or invalid for resend', 'error');
          setIsResendingOtp(false);
          return;
        }

        const full = '+91' + phoneNumber;
        const result = await signInWithPhoneNumber(auth, full, window.recaptchaVerifier);
        setConfirmationResult(result);
        showSnackbar('OTP resent!', 'success');
        startResendTimer();
      } catch (error) {
        console.error('Failed to resend OTP:', error);
        showSnackbar('Failed to resend OTP', 'error');
      } finally {
        setIsResendingOtp(false);
      }
    }
  };

  // Verify OTP handler
  const onVerifyOtp = async () => {
    try {
      setIsVerifyingOtp(true);
      
      // Validate OTP field
      const isValid = await trigger('otp');
      if (!isValid) {
        setIsVerifyingOtp(false);
        return;
      }
      
      const otp = getValues('otp');
      
      if (!confirmationResult) {
        showSnackbar('OTP session expired. Please request a new OTP.', 'error');
        setIsVerifyingOtp(false);
        return;
      }
      
      const userCred = await confirmationResult.confirm(otp);
      
      if (userCred && userCred.user) {
        const idToken = await userCred.user.getIdToken();
        const sessionResponse = await axios.post('/api/sessionLogin', { idToken });

        if (sessionResponse.data.success) {
          // Login the user through our API
          const phoneNumber = formatPhoneNumber(getValues('phoneNumber'));
          const loginResponse = await axios.post('/api/login', { 
            phoneNumber 
          });

          if (loginResponse.data.success) {
            dispatch(setUserExists(true));
            dispatch(setUserDetails({ 
              phoneNumber, 
              name: getValues('name'),
              userId: loginResponse.data.user.userUuid || loginResponse.data.user.userId
            }));
            
            setPhoneVerified(true);
            setOtpStep('verified');
            showSnackbar('Phone number verified!', 'success');
              !userExists && mapUserInBackground(userId, phoneNumber, getValues('email'));

            // Prefill address if it exists in user data
            if (loginResponse.data.user.addresses && loginResponse.data.user.addresses.length > 0) {
              const latestAddress = loginResponse.data.user.addresses[0];
              Object.entries(latestAddress).forEach(([key, value]) => {
                if (setValue && key !== '_id' && key !== 'receiverName' && key !== 'receiverPhoneNumber') {
                  setValue(key, value || '');
                }
              });
              dispatch(setAddressDetails(latestAddress));
              
              // Pre-validate pincode
              if (latestAddress.pincode && latestAddress.pincode.length === 6) {
                validatePincode(latestAddress.pincode);
              }
            }
          } else {
            showSnackbar('Failed to create user account', 'error');
          }
        } else {
          showSnackbar('Session login failed', 'error');
        }
      } else {
        showSnackbar('Verification failed', 'error');
      }
    } catch (error) {
      console.error('Failed to verify OTP:', error);
      showSnackbar('Invalid OTP or verification failed', 'error');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // Proceed to address step
  const proceedToAddress = () => {
    if (!phoneVerified) {
      showSnackbar('Please verify your phone number first', 'error');
      return;
    }
    
    setTabIndex(1);
  };

  // Optimistic user details submission - further optimized
// Update onSubmitUserDetails to handle the 'verified' state
const onSubmitUserDetails = useCallback(async (data) => {
  // If OTP verification is not complete, send OTP
  if (otpStep === 'phone') {
    onSendOtp();
    return;
  }
  
  // If OTP verification is in progress, verify OTP
  if (otpStep === 'otp') {
    onVerifyOtp();
    return;
  }

  // If verification is complete, proceed to address step
  if (otpStep === 'verified') {
    setTabIndex(1);
    return;
  }
}, [otpStep, onSendOtp, onVerifyOtp, setTabIndex]);

  // Optimize address submission with better parallelization
  const onSubmitAddressDetails = useCallback(async (data) => {
    if (purchaseInitiated) return; // Prevent multiple submissions
    setPurchaseInitiated(true);
    setIsLoading(true);
    setIsPaymentProcessing(true);

    const startTime = performance.now();

    try {
      const initialValidationPromises = [];

      if (!isPincodeValid && data.pincode && !serviceabilityCache.current[data.pincode]) {
        const serviceabilityPromise = axios.get(
          `/api/checkout/order/shiprocket/serviceability?pickup_postcode=226005&delivery_postcode=${data.pincode}`
        ).then(response => {
          const isValid = response.data.serviceable;
          serviceabilityCache.current[data.pincode] = isValid;
          setIsPincodeValid(isValid);
          if (!isValid) {
            throw new Error(`The pincode ${data.pincode} is either invalid or we don't deliver to this location!`);
          }
        });
        initialValidationPromises.push(serviceabilityPromise);
      }

      let couponPromise;
      if (couponCode && !pendingOperationsRef.current.couponValidation) {
        couponPromise = axios.post('/api/checkout/coupons/apply', {
          code: couponCode,
          totalCost: subTotal,
          isFirstOrder: false, 
          cartItems: items,
        }).then(response => {
          const couponValidation = response.data;
          if (!couponValidation.valid) {
            throw new Error('Your offer is no longer valid. Please update your cart.');
          }
          return couponValidation;
        });
        initialValidationPromises.push(couponPromise);
      } else if (pendingOperationsRef.current.couponValidation) {
        initialValidationPromises.push(pendingOperationsRef.current.couponValidation);
      }

      if (pendingOperationsRef.current.userCheck) {
        initialValidationPromises.push(pendingOperationsRef.current.userCheck);
      }

      const addAddressPayload = {
        phoneNumber: orderForm.userDetails.phoneNumber,
        address: {
          receiverName: orderForm.userDetails.name || '',
          receiverPhoneNumber: orderForm.userDetails.phoneNumber,
          addressLine1: data.addressLine1,
          addressLine2: data.addressLine2,
          city: data.city,
          state: data.state,
          pincode: data.pincode,
          country: data.country || 'India',
          ...orderForm.extraFields,
        },
      };

      const addressAddPromise = axios.post('/api/user/add-address', addAddressPayload)
        .then(response => {
          if (response.data.message === 'Address added successfully.' ||
            response.data.message === 'Using existing address.') {
            dispatch(setAddressDetails(response.data.latestAddress));
          }
          return response.data;
        }).catch(error => {
          console.error("Error during address addition (in parallel task):", error);
          throw new Error(error.response?.data?.message || "Failed to update address details.");
        });

      if (initialValidationPromises.length > 0) {
        await Promise.all(initialValidationPromises).catch(error => {
          throw error;
        });
      }

      // Financial data is now sent directly
      const finalOrderPayload = {
        userId: orderForm.userDetails.userId,
        phoneNumber: orderForm.userDetails.phoneNumber,
        items: cartItems.map((item) => ({
          product: item.productId,
          itemSource: item.productDetails.source || 'inhouse',
          brand: item.productDetails.brand || null,
          option: item.productDetails.selectedOption?._id || null,
          wrapFinish: item.productDetails.wrapFinish || null,
          name: `${item.productDetails.name} ${item.productDetails.category?.name?.endsWith('s')
            ? item.productDetails.category?.name.slice(0, -1)
            : item.productDetails.category?.name
            }`,
          quantity: item.quantity,
          priceAtPurchase: item.productDetails.price,
          sku: item.productDetails.selectedOption ? item.productDetails.selectedOption.sku : item.productDetails.sku,
          thumbnail: item.productDetails.thumbnail,
          insertionDetails: item.insertionDetails || {}
        })),
        paymentModeId: paymentModeConfig._id,
        address: {
          receiverName: orderForm.userDetails.name || '',
          receiverPhoneNumber: orderForm.userDetails.phoneNumber,
          addressLine1: data.addressLine1,
          addressLine2: data.addressLine2,
          city: data.city,
          state: data.state,
          pincode: data.pincode,
          country: data.country || 'India',
        },
        // Raw financial details are sent:
        totalAmount: totalCost,
        discountAmount: discountAmountFinal || 0,
        couponCode: couponsDetails?.couponCode || '',
        extraChargesPayload: { // Send as an object to be processed server-side
            mopCharges: paymentModeConfig.extraCharge || 0,
            deliveryCharges: deliveryCost || 0,
        },
        utmDetails: utmDetails.utmDetails || null,
        utmHistory: utmDetails.utmHistory || [],
        extraFields: orderForm.extraFields,
      };

      const [orderCreationResponse] = await Promise.all([
        axios.post('/api/checkout/order/create', finalOrderPayload),
        addressAddPromise
      ]);

      const {
        orderId: createdOrderId,
        razorpayOrder,
        amountDueOnline
      } = orderCreationResponse.data;

      dispatch(setLastOrderId(createdOrderId));

      if (razorpayOrder && amountDueOnline > 0) {
        initiateCheckout(
          {
            eventID: uuidv4(),
            totalValue: totalCost,
            contents: cartItems.map((item) => ({
              productId: item.productId || item._id,
              quantity: item.quantity,
              price: item.priceAtPurchase,
            })),
            contentName: cartItems.map((item) => item.productDetails.name).join(', '),
            contentCategory: cartItems.map((item) => item.productDetails.category),
            numItems: cartItems.length,
          },
          {
            email: orderForm.userDetails.email || '',
            phoneNumber: orderForm.userDetails.phoneNumber,
          }
        ).catch(error => {
          console.error('FB pixel tracking error (non-critical):', error);
        });

        const paymentResult = await makePayment({
          customerName: orderForm.userDetails.name || '',
          customerMobile: orderForm.userDetails.phoneNumber,
          orderId: createdOrderId,
          razorpayOrder,
        });

        if (paymentResult.cancelled) {
          setIsPaymentProcessing(false);
          setPurchaseInitiated(false);
          showSnackbar('Payment was cancelled.', 'warning');
          return;
        }
        showSnackbar('Payment Successful!', 'success');
      } else if (amountDueOnline === 0) {
        showSnackbar('Order placed successfully! Payment will be collected on delivery.', 'success');
      } else {
        console.warn('Unexpected payment state:', { razorpayOrder, amountDueOnline });
        showSnackbar('Order placed. Awaiting payment confirmation.', 'info');
      }

      purchase(
        {
          orderId: createdOrderId,
          totalAmount: totalCost,
          items: cartItems.map((item) => ({
            product: item.productId,
            name: `${item.productDetails.name} ${item.productDetails.category?.name?.endsWith('s')
              ? item.productDetails.category?.name.slice(0, -1)
              : item.productDetails.category?.name
              }`,
            quantity: item.quantity,
            priceAtPurchase: item.priceAtPurchase,
          })),
        },
        {
          email: orderForm.userDetails.email || '',
          phoneNumber: orderForm.userDetails.phoneNumber,
        }
      ).catch(error => {
        console.error('FB pixel purchase event error (non-critical):', error);
      });

      pendingOperationsRef.current = {
        userCheck: null,
        addressAdd: null,
        couponValidation: null,
      };

      dispatch(clearUTMDetails());
      dispatch(clearCart());
      dispatch(resetOrderForm());
      reset();

      handleFullClose();

      setTimeout(() => {
        router.push(`/orders/myorder/${createdOrderId}`);
      }, 100);

    } catch (error) {
      console.error('Error during purchase process:', error);
      const errorMessage = error.response?.data?.message || error.message || 'An error occurred. Please try again.';
      showSnackbar(errorMessage, 'error');
    } finally {
      setIsLoading(false);
      setIsPaymentProcessing(false);
      setPurchaseInitiated(false);
    }
  }, [purchaseInitiated, couponCode, subTotal, items, orderForm, dispatch, showSnackbar,
    totalCost, deliveryCost, utmDetails, cartItems, paymentModeConfig,
    discountAmountFinal, couponsDetails, isPincodeValid, reset, handleFullClose, router,
    serviceabilityCache, prefilledAddress, userDetails, addressDetails]); // Maintained dependencies

  // Handle dialog close (prevent closing during payment)
  const handleClose = useCallback(() => {
    if (isPaymentProcessing) return;

    // if on shipping tab (index 1), go back to user details (index 0)
    if (tabIndex === 1) {
      setTabIndex(0);
    } else {
      // otherwise close the dialog
      onClose();
    }
  }, [isPaymentProcessing, onClose, tabIndex]);

  // push history entry for this dialog (priority higher than drawer)
  useHistoryState(open, handleClose, 'orderForm', 10);

  // Animation variants for form transitions - UPDATED for performance
  const formVariants = useMemo(() => ({
    initial: (direction) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
      position: 'relative',
      zIndex: 1,
    }),
    animate: {
      x: 0,
      opacity: 1,
      position: 'relative',
      zIndex: 2,
      transition: {
        x: { type: "spring", stiffness: 300, damping: 30 },
        opacity: { duration: 0.4 }
      }
    },
    exit: (direction) => ({
      x: direction > 0 ? -300 : 300,
      opacity: 0,
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 0,
      transition: {
        x: { type: "spring", stiffness: 300, damping: 30 },
        opacity: { duration: 0.2 }
      }
    })
  }), []);
  
  // Similar animation variant for OTP step transitions
  const otpStepVariants = useMemo(() => ({
    initial: (direction) => ({
      y: direction > 0 ? 50 : -50,
      opacity: 0,
    }),
    animate: {
      y: 0,
      opacity: 1,
      transition: {
        y: { type: "spring", stiffness: 300, damping: 30 },
        opacity: { duration: 0.3 }
      }
    },
    exit: (direction) => ({
      y: direction > 0 ? -50 : 50,
      opacity: 0,
      transition: {
        y: { type: "spring", stiffness: 300, damping: 30 },
        opacity: { duration: 0.2 }
      }
    })
  }), []);

  // Custom styled text field component with memoization to prevent rerenders
const StyledTextField = useCallback(({ field, label, error, helperText, disabled, onChange, type = "text", maxWidth, InputProps }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ 
      duration: 0.3, 
      delay: field && field.name 
        ? (field.name === 'name' ? 0.1 
          : field.name === 'email' ? 0.2 
          : field.name === 'phoneNumber' ? 0.3 
          : (typeof field.name === 'string' ? 0.1 * parseInt(field.name.replace(/\D/g, '') || '0') : 0))
        : 0 
    }}
  >
    <TextField
      variant="outlined"
      {...field}
      label={label}
      fullWidth
      type={type}
      error={!!error}
      helperText={helperText}
      disabled={disabled}
      onChange={onChange}
      InputLabelProps={{
        style: {
          fontFamily: 'Jost, sans-serif',
          fontSize: '0.9rem',
        },
      }}
      InputProps={{
        style: {
          fontFamily: 'Jost, sans-serif',
          fontSize: '1rem',
        },
        ...InputProps
      }}
      sx={{
        marginBottom: '1rem',
        maxWidth: maxWidth,
        '& .MuiOutlinedInput-root': {
          borderRadius: '8px',
          transition: 'transform 0.2s, box-shadow 0.2s',
          '&:hover': {
            boxShadow: '0 4px 8px rgba(0,0,0,0.08)',
          },
          '&.Mui-focused': {
            transform: 'translateY(-2px)',
            boxShadow: '0 6px 12px rgba(0,0,0,0.1)',
          }
        },
        '& .MuiInputLabel-shrink': {
          transform: 'translate(14px, -12px) scale(0.75)',
        }
      }}
    />
  </motion.div>
), []);

  return (
    <ThemeProvider theme={theme}>
      <Dialog
        open={open}
        onClose={(event, reason) => {
          if (reason === 'backdropClick') {
            onClose();
          } else {
            handleClose();
          }
        }}
        maxWidth="sm"
        fullWidth
        disableEscapeKeyDown={isPaymentProcessing}
        PaperProps={{
          sx: {
            borderRadius: '1.5rem',
            overflow: 'hidden',
            maxHeight: '88vh',
          },
        }}
      >

<DialogContent
  sx={{
    padding: { xs: '1.2rem', md: '1.5rem' },
    paddingTop: { xs: '0.8rem', md: '1.2rem' },
    background: 'linear-gradient(to bottom, #f9f9f9, #ffffff)',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
  }}
>
  {/* Add this line */}
  <div id="recaptcha-container" style={{ position: 'absolute', visibility: 'hidden' }}></div>

          {/* Logo and Stepper - Made more compact */}
          <Box sx={{
            position: 'relative',
            mb: 0.5,
            flexShrink: 0, // Prevent shrinking
          }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, type: 'spring', stiffness: 200 }}
            >
              <Image
                loading="eager"
                src={`${baseImageUrl}/assets/logos/md_nothing_else.png`}
                width={60} // Reduced from 80
                height={60} // Reduced from 80
                alt="Logo"
                style={{
                  width: '60px', // Reduced from 80px
                  height: 'auto',
                  margin: '0 auto',
                  display: 'block',
                }}
              />
            </motion.div>

            {/* Custom Stepper - Made more compact */}
            <Box sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              mt: 1.5, // Reduced from 3
              position: 'relative',
              height: '30px' // Reduced from 40px
            }}>
              <Box sx={{
                position: 'absolute',
                left: '50%',
                width: '60px',
                height: '2px',
                backgroundColor: tabIndex === 1 ? '#000' : '#e0e0e0',
                transform: 'translateX(-30px)',
                transition: 'background-color 0.5s'
              }} />

              <motion.div
                animate={{ scale: tabIndex === 0 ? 1.1 : 0.9, x: tabIndex === 0 ? -40 : -40 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
              >
                <Box
                  sx={{
                    width: '25px', // Reduced from 30px
                    height: '25px', // Reduced from 30px
                    borderRadius: '50%',
                    backgroundColor: '#000',
                    color: 'white',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    fontFamily: 'Jost, sans-serif',
                    fontWeight: 600,
                    fontSize: '0.8rem', // Added smaller font
                    zIndex: 1,
                    boxShadow: tabIndex === 0 ? '0 0 0 4px rgba(0,0,0,0.1)' : 'none',
                    transition: 'box-shadow 0.3s',
                    cursor: 'pointer'
                  }}
                  onClick={() => tabIndex !== 0 && handleTabChange(0)}
                >
                  1
                </Box>
              </motion.div>

              <motion.div
                animate={{ scale: tabIndex === 1 ? 1.1 : 0.9, x: tabIndex === 1 ? 40 : 40 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
              >
                <Box
                  sx={{
                    width: '25px', // Reduced from 30px
                    height: '25px', // Reduced from 30px
                    borderRadius: '50%',
                    backgroundColor: tabIndex === 1 ? '#000' : '#e0e0e0',
                    color: tabIndex === 1 ? 'white' : '#999',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    fontFamily: 'Jost, sans-serif',
                    fontWeight: 600,
                    fontSize: '0.8rem', // Added smaller font
                    zIndex: 1,
                    boxShadow: tabIndex === 1 ? '0 0 0 4px rgba(0,0,0,0.1)' : 'none',
                    transition: 'box-shadow 0.3s, background-color 0.3s, color 0.3s',
                    cursor: tabIndex === 1 ? 'pointer' : 'default'
                  }}
                >
                  2
                </Box>
              </motion.div>
            </Box>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              <Typography
                variant="h6"
                align="center"
                sx={{
                  mt: 0.5, // Reduced from 1
                  mb: 1, // Reduced from 3
                  fontFamily: 'Jost, sans-serif',
                  fontWeight: 500,
                  fontSize: '1rem', // Reduced from 1.25rem (h6)
                  color: '#333'
                }}
              >
                {tabIndex === 0 ? 
                  (otpStep === 'phone' ? "Let's get to know you" : 
                   otpStep === 'otp' ? "Verify your phone number" : 
                   "Continue with your details") 
                  : "Where should we deliver?"}
              </Typography>
            </motion.div>

            {tabIndex === 1 && (
              <Box
                onClick={() => handleTabChange(0)}
                sx={{
                  position: 'absolute',
                  left: '0.5rem', // Reduced from 1rem
                  top: '0.5rem', // Reduced from 1rem
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  color: '#555',
                  transition: 'color 0.2s',
                  zIndex: 10,
                  '&:hover': {
                    color: '#000',
                  }
                }}
              >
                <motion.div whileHover={{ x: -3 }} whileTap={{ scale: 0.9 }}>
                  <ArrowBackIcon sx={{ fontSize: '1.3rem' }} /> {/* Reduced from 1.5rem */}
                </motion.div>
              </Box>
            )}
          </Box>

          {/* Form Wrapper - Handles submission and layout (scrollable fields + fixed buttons) */}
          <Box
            component="form"
            onSubmit={handleSubmit(tabIndex === 0 ? onSubmitUserDetails : onSubmitAddressDetails)}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              flexGrow: 1,
              overflow: 'hidden',
              width: '100%',
              maxWidth: '400px',
              margin: '0 auto', // Center the form content area
            }}
          >
            {/* Scrollable Fields Area */}
            <Box
              sx={{
                flexGrow: 1,
                overflowY: 'auto',
                overflowX: 'hidden',
                position: 'relative',
                width: '100%',
                // Hide scrollbar styles - fixed to use camelCase
                '&::-webkit-scrollbar': { display: 'none' },
                msOverflowStyle: 'none',  // Changed from '-ms-overflow-style'
                scrollbarWidth: 'none',   // Changed from 'scrollbar-width'
                pb: '2rem',    // extra bottom padding
              }}
            >
              <AnimatePresence mode="wait" initial={false} custom={tabIndex}>
                {tabIndex === 0 && (
                  <motion.div
                    key="personalInfo"
                    custom={0}
                    variants={formVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    style={{ width: '100%' }} // Removed height: '100%'
                  >
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%', paddingTop: '0.5rem', px: { xs: 0.5, sm: 1 } }}> {/* Added horizontal padding */}
                      {/* OTP Step Animation Container */}
                      <AnimatePresence mode="wait" initial={false} custom={otpStep === 'phone' ? 0 : otpStep === 'otp' ? 1 : 2}>
                        {/* Phone Entry Step */}
                        {otpStep === 'phone' && (
                          <motion.div
                            key="phoneEntry"
                            custom={0}
                            variants={otpStepVariants}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                            style={{ width: '100%' }}
                          >
                            {/* Name field */}
                            <Controller
                              name="name"
                              control={control}
                              rules={{
                                required: 'Name is required',
                                minLength: {
                                  value: 3,
                                  message: 'Name must be at least 3 characters',
                                },
                              }}
                              render={({ field }) => (
                                <StyledTextField
                                  field={field}
                                  label="Your Name"
                                  error={errors.name}
                                  helperText={errors.name ? errors.name.message : ''}
                                  disabled={isLoading || isPaymentProcessing}
                                  onChange={(e) => {
                                    field.onChange(e);
                                    dispatch(setUserDetails({ name: e.target.value }));
                                  }}
                                />
                              )}
                            />

                            {/* Email field */}
                            <Controller
                              name="email"
                              control={control}
                              rules={{
                                pattern: {
                                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                                  message: 'Enter a valid email address',
                                },
                              }}
                              render={({ field }) => (
                                <StyledTextField
                                  field={field}
                                  label="Email (Optional)"
                                  error={errors.email}
                                  helperText={errors.email ? errors.email.message : ''}
                                  disabled={isLoading || isPaymentProcessing}
                                  onChange={(e) => {
                                    field.onChange(e);
                                    dispatch(setUserDetails({ email: e.target.value }));
                                  }}
                                />
                              )}
                            />

                            {/* Phone number field with enhanced validation */}
                            <Controller
                              name="phoneNumber"
                              control={control}
                              rules={{
                                required: 'Mobile number is required',
                                validate: value => {
                                  // Allow raw inputs that format to valid numbers
                                  const formatted = formatPhoneNumber(value);
                                  return /^\d{10}$/.test(formatted) || 'Please enter a valid 10-digit mobile number';
                                }
                              }}
                              render={({ field }) => (
                                <Box sx={{ position: 'relative', marginBottom: showPhoneConfirmation ? '2.5rem' : '0' }}>
                                  <StyledTextField
                                    field={field}
                                    label="Mobile Number"
                                    type="tel"
                                    error={!!errors.phoneNumber}
                                    helperText={errors.phoneNumber ? errors.phoneNumber.message : ''}
                                    disabled={isLoading || isPaymentProcessing || isSendingOtp}
                                    onChange={(e) => handlePhoneChange(e, field.onChange)}
                                  />

                                  {/* Phone number format confirmation message */}
                                  <AnimatePresence>
                                    {showPhoneConfirmation && (
                                      <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{ duration: 0.2 }}
                                        style={{
                                          position: 'absolute',
                                          width: '100%',
                                          top: '100%',
                                          zIndex: 5
                                        }}
                                      >
                                        <Box sx={{
                                          mt: '8px',
                                          p: '12px',
                                          borderRadius: '12px',
                                          backgroundColor: '#e8f5e9',         // softer green
                                          boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                        }}>
                                          <Typography
                                            variant="caption"
                                            sx={{
                                              fontSize: '0.8rem',
                                              fontWeight: 500,
                                              color: '#2e7d32'           // dark green text
                                            }}
                                          >
                                            Is <strong>{formattedPhone}</strong> the correct 10-digit number?
                                          </Typography>
                                          <motion.button
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={acceptFormattedPhone}
                                            type="button"
                                            style={{
                                              backgroundColor: '#66bb6a',
                                              color: '#fff',
                                              border: 'none',
                                              borderRadius: '6px',
                                              padding: '6px 12px',
                                              fontSize: '0.75rem',
                                              cursor: 'pointer',
                                              fontWeight: 600,
                                            }}
                                          >
                                            Yes
                                          </motion.button>
                                        </Box>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </Box>
                              )}
                            />

                            
                          </motion.div>
                        )}

                        {otpStep === 'otp' && (
                          <motion.div
                            key="otpVerify"
                            custom={1}
                            variants={otpStepVariants}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                            style={{ width: '100%' }}
                          >
                            <Box sx={{ 
                              textAlign: 'center',
                              mb: 2,
                              px: 2
                            }}>
                              <Typography variant="body2" color="text.secondary">
                                We've sent a verification code to +91 {formatPhoneNumber(getValues('phoneNumber'))}
                              </Typography>
                            </Box>

                            {/* OTP Entry Field */}
<Controller
  name="otp"
  control={control}
  rules={{
    required: 'OTP is required',
    minLength: { value: 6, message: 'Enter a valid 6-digit OTP' },
    maxLength: { value: 6, message: 'Enter a valid 6-digit OTP' },
    pattern: { value: /^\d{6}$/, message: 'OTP must be 6 digits' }
  }}
  render={({ field }) => (
    <TextField
      {...field}
      variant="outlined"
      fullWidth
      label="Enter 6-digit OTP"
      type="tel"
      error={!!errors.otp}
      helperText={errors.otp ? errors.otp.message : ''}
      disabled={isVerifyingOtp}
      inputProps={{ 
        maxLength: 6,
        pattern: "[0-9]*",
        inputMode: "numeric"
      }}
      InputLabelProps={{
        style: {
          fontFamily: 'Jost, sans-serif',
          fontSize: '0.9rem',
        },
      }}
      InputProps={{
        style: {
          fontFamily: 'Jost, sans-serif',
          fontSize: '1rem',
        }
      }}
      sx={{
        marginBottom: '1rem',
        '& .MuiOutlinedInput-root': {
          borderRadius: '8px',
          transition: 'transform 0.2s, box-shadow 0.2s',
          '&:hover': {
            boxShadow: '0 4px 8px rgba(0,0,0,0.08)',
          },
          '&.Mui-focused': {
            transform: 'translateY(-2px)',
            boxShadow: '0 6px 12px rgba(0,0,0,0.1)',
          }
        }
      }}
      onChange={(e) => {
        // Only allow numeric input
        const value = e.target.value.replace(/\D/g, '');
        field.onChange(value);
      }}
    />
  )}
/>

                            {/* Resend OTP Button */}
                            <Box sx={{
                              display: 'flex',
                              justifyContent: 'center',
                              mt: 0,
                              mb: 2
                            }}>
                              <Button
                                variant="text"
                                onClick={onResendOtp}
                                disabled={resendTimer > 0 || isResendingOtp}
                                sx={{
                                  textTransform: 'none',
                                  fontFamily: 'Jost, sans-serif',
                                  fontSize: '0.9rem',
                                }}
                                startIcon={isResendingOtp && <CircularProgress size={16} color="inherit" />}
                              >
                                {resendTimer > 0 
                                  ? `Resend OTP in ${resendTimer}s` 
                                  : (isResendingOtp ? 'Resending...' : 'Resend OTP')}
                              </Button>
                            </Box>

                            {/* REMOVE THIS BLOCK - IT'S DUPLICATING THE BOTTOM BUTTON
                            <motion.div
                              whileHover={{ scale: 1.03 }}
                              whileTap={{ scale: 0.98 }}
                            >
                              <BlackButton
                                type="button"
                                extraClass="lg"
                                isLoading={isVerifyingOtp}
                                buttonText="Verify OTP"
                                onClick={onVerifyOtp}
                                disabled={isVerifyingOtp || isLoading}
                                sx={{
                                  borderRadius: '50px',
                                  px: 3,
                                  py: 0.5,
                                  boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
                                  fontFamily: 'Jost, sans-serif',
                                  fontSize: '0.9rem',
                                  width: '100%'
                                }}
                              />
                            </motion.div>
                            */}

                            {/* Back to Phone Button */}
                            <Box sx={{
                              display: 'flex', 
                              justifyContent: 'center',
                              mt: 2
                            }}>
                              <Button
                                variant="text"
                                onClick={() => setOtpStep('phone')}
                                disabled={isVerifyingOtp}
                                sx={{
                                  textTransform: 'none',
                                  fontFamily: 'Jost, sans-serif',
                                  fontSize: '0.9rem',
                                  color: 'text.secondary'
                                }}
                              >
                                Change Phone Number
                              </Button>
                            </Box>
                          </motion.div>
                        )}
                        {/* User Verified Step */}

                        {otpStep === 'verified' && (
                          <motion.div
                            key="userVerified"
                            custom={2}
                            variants={otpStepVariants}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                            style={{ width: '100%' }}
                          >
                            {/* Success Message */}
                            <Box sx={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: 1.5,
                              mb: 2
                            }}>
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                              >
                                <CheckCircleOutlineIcon
                                  sx={{ 
                                    color: 'success.main', 
                                    fontSize: '3rem',
                                    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))'
                                  }}
                                />
                              </motion.div>
                              <Typography
                                variant="subtitle1"
                                sx={{
                                  fontFamily: 'Jost, sans-serif',
                                  fontWeight: 500,
                                }}
                              >
                                Phone number verified successfully!
                              </Typography>
                            </Box>

                            {/* Editable Name Field */}
                            <Controller
                              name="name"
                              control={control}
                              rules={{
                                required: 'Name is required',
                                minLength: {
                                  value: 3,
                                  message: 'Name must be at least 3 characters',
                                },
                              }}
                              render={({ field }) => (
                                <StyledTextField
                                  field={field}
                                  label="Your Name"
                                  error={errors.name}
                                  helperText={errors.name ? errors.name.message : ''}
                                  disabled={isLoading || isPaymentProcessing}
                                  onChange={(e) => {
                                    field.onChange(e);
                                    dispatch(setUserDetails({ name: e.target.value }));
                                  }}
                                />
                              )}
                            />

                            {/* Editable Email Field */}
                            <Controller
                              name="email"
                              control={control}
                              rules={{
                                pattern: {
                                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                                  message: 'Enter a valid email address',
                                },
                              }}
                              render={({ field }) => (
                                <StyledTextField
                                  field={field}
                                  label="Email (Optional)"
                                  error={errors.email}
                                  helperText={errors.email ? errors.email.message : ''}
                                  disabled={isLoading || isPaymentProcessing}
                                  onChange={(e) => {
                                    field.onChange(e);
                                    dispatch(setUserDetails({ email: e.target.value }));
                                  }}
                                />
                              )}
                            />

                            {/* Read-only Phone Field with Verification Check */}

                        <Box sx={{ position: 'relative' }}>
                          <StyledTextField
                            field={{ 
                              value: getValues('phoneNumber') ? `+91 ${formatPhoneNumber(getValues('phoneNumber'))}` : '',
                              onChange: () => {}
                            }}
                            label="Mobile Number"
                            type="tel"
                            disabled={true}
                            InputProps={{
                              endAdornment: (
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                  <CheckCircleOutlineIcon sx={{ color: 'success.main', fontSize: '1.2rem', mr: 1 }} />
                                </Box>
                              )
                            }}
                          />
                        </Box>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </Box>
                  </motion.div>
                )}

                {tabIndex === 1 && (
                  <motion.div
                    key="addressInfo"
                    custom={1}
                    variants={formVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    style={{ width: '100%' }}
                  >
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%', paddingTop: '0.5rem', px: { xs: 0.5, sm: 1 } }}>
                      {/* Address Line 1 */}
                      <Controller
                        name="addressLine1"
                        control={control}
                        rules={{ required: 'House No./Building name is required' }}
                        render={({ field }) => (
                          <StyledTextField
                            field={field}
                            label="House No./Building name"
                            error={errors.addressLine1}
                            helperText={errors.addressLine1 ? errors.addressLine1.message : ''}
                            disabled={isLoading || isPaymentProcessing}
                          />
                        )}
                      />

                      {/* Address Line 2 */}
                      <Controller
                        name="addressLine2"
                        control={control}
                        rules={{ required: 'Street/Locality is required' }}
                        render={({ field }) => (
                          <StyledTextField
                            field={field}
                            label="Street/Locality"
                            error={errors.addressLine2}
                            helperText={errors.addressLine2 ? errors.addressLine2.message : ''}
                            disabled={isLoading || isPaymentProcessing}
                          />
                        )}
                      />

                      {/* Pincode with validation */}
                      <Controller
                        name="pincode"
                        control={control}
                        rules={{
                          required: 'Pincode is required',
                          pattern: {
                            value: /^\d{6}$/,
                            message: 'Enter a valid 6-digit pincode',
                          },
                          validate: {
                            checkServiceability: async (value) => {
                              if (!value || value.length !== 6) return true;
                              if (serviceabilityCache.current[value] === false) {
                                return 'This pincode is not serviceable';
                              }
                              return true;
                            }
                          }
                        }}
                        render={({ field }) => (
                          <Box sx={{ position: 'relative', width: '100%' }}>
                            <StyledTextField
                              field={field}
                              label="Pincode"
                              type="tel"
                              error={!!errors.pincode}
                              helperText={errors.pincode ? errors.pincode.message : ''}
                              disabled={isLoading || isPaymentProcessing}
                              InputProps={{
                                inputProps: { maxLength: 6, inputMode: 'numeric' },
                                endAdornment: (
                                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    {pincodeCheckInProgress && (
                                      <CircularProgress size={16} color="inherit" sx={{ opacity: 0.7 }} />
                                    )}
                                    {!pincodeCheckInProgress && watchedPincode?.length === 6 && (
                                      isPincodeValid ? 
                                      <CheckCircleOutlineIcon sx={{ color: 'success.main', fontSize: '1.2rem' }} /> :
                                      <WarningAmberIcon sx={{ color: 'warning.main', fontSize: '1.2rem' }} />
                                    )}
                                  </Box>
                                )
                              }}
                              onChange={(e) => {
                                // Only allow numeric input
                                const value = e.target.value.replace(/\D/g, '');
                                field.onChange(value);
                              }}
                            />
                          </Box>
                        )}
                      />

                      {/* City */}
                      <Controller
                        name="city"
                        control={control}
                        rules={{ required: 'City is required' }}
                        render={({ field }) => (
                          <StyledTextField
                            field={field}
                            label="City"
                            error={errors.city}
                            helperText={errors.city ? errors.city.message : ''}
                            disabled={isLoading || isPaymentProcessing}
                          />
                        )}
                      />

                      {/* State */}
                      <Controller
                        name="state"
                        control={control}
                        rules={{ required: 'State is required' }}
                        render={({ field }) => (
                          <Autocomplete
                            {...field}
                            options={indianStates}
                            renderInput={(params) => (
                              <StyledTextField
                                {...params}
                                field={{ ...field, ref: params.inputRef }}
                                label="State"
                                error={!!errors.state}
                                helperText={errors.state ? errors.state.message : ''}
                                disabled={isLoading || isPaymentProcessing}
                              />
                            )}
                            onChange={(_, newValue) => {
                              field.onChange(newValue || '');
                            }}
                            disabled={isLoading || isPaymentProcessing}
                          />
                        )}
                      />

                      {/* Extra Fields from categories */}
                      {aggregatedExtraFields.map((field) => (
                        <Controller
                          key={field.fieldName}
                          name={field.fieldName}
                          control={control}
                          rules={field.required ? { required: `${field.fieldLabel} is required` } : {}}
                          render={({ field: formField }) => (
                            <StyledTextField
                              field={formField}
                              label={field.fieldLabel}
                              error={errors[field.fieldName]}
                              helperText={errors[field.fieldName] ? errors[field.fieldName].message : field.helpText || ''}
                              disabled={isLoading || isPaymentProcessing}
                              onChange={(e) => {
                                formField.onChange(e);
                                dispatch(setExtraFields({ [field.fieldName]: e.target.value }));
                              }}
                            />
                          )}
                        />
                      ))}
                    </Box>
                  </motion.div>
                )}
              </AnimatePresence>
            </Box>

            {/* Bottom fixed button area */}
            <Box
              sx={{
                flexShrink: 0,
                pt: 1.5,
                pb: { xs: 1, sm: 1.5 },
                mt: 'auto',
                borderTop: `1px solid ${theme.palette.divider}`,
                backgroundColor: '#ffffff',
                width: '100%',
                boxShadow: '0 -2px 5px rgba(0,0,0,0.05)'
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
  {tabIndex === 0 && (
    <motion.div
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.98 }}
      style={{ 
        width: '100%', 
        maxWidth: '300px',
        margin: '0 auto', // Add this to center the div itself
        display: 'flex',  // Add this for better alignment
        justifyContent: 'center' // And this to center the button within the div
      }}
    >
      <BlackButton
        type="submit"
        extraClass="lg"
        isLoading={otpStep === 'phone' ? isSendingOtp : otpStep === 'otp' ? isVerifyingOtp : false}
        buttonText={
          otpStep === 'phone' 
            ? 'Send OTP' 
            : otpStep === 'otp' 
              ? 'Verify OTP' 
              : 'Continue to Address'
        }
        disabled={
          isPaymentProcessing || 
          (otpStep === 'phone' && isSendingOtp) || 
          (otpStep === 'otp' && isVerifyingOtp)
        }
        sx={{
          borderRadius: '50px',
          px: 3,
          py: 0.5,
          boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
          fontFamily: 'Jost, sans-serif',
          fontSize: '0.9rem',
          width: '100%'
        }}
      />
    </motion.div>
  )}
  
  {/* Same styling updates for tab index 1 */}
  {tabIndex === 1 && (
    <motion.div
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.98 }}
      style={{ 
        width: '100%', 
        maxWidth: '300px',
        margin: '0 auto',
        display: 'flex',
        justifyContent: 'center'
      }}
    >
      <BlackButton
        type="submit"
        extraClass="lg"
        isLoading={isLoading || isPaymentProcessing}
        buttonText={getPaymentButtonText(paymentModeConfig, totalCost)}
        disabled={isLoading || isPaymentProcessing || pincodeCheckInProgress}
        sx={{
          borderRadius: '50px',
          px: 3,
          py: 0.5,
          boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
          fontFamily: 'Jost, sans-serif',
          fontSize: '0.9rem',
          width: '100%'
        }}
      />
    </motion.div>
  )}
</Box>
            </Box>
          </Box>
        </DialogContent>
        <CustomSnackbar
          open={snackbarOpen}
          message={snackbarMessage}
          severity={snackbarSeverity}
          onClose={() => setSnackbarOpen(false)}
        />
      </Dialog>
    </ThemeProvider>
  );
};

export default OrderForm;