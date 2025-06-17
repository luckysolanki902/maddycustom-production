'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

import ReactDOM from 'react-dom';
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
// Add this at the top with your other imports
import { signIn } from 'next-auth/react';

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
  
// Add this with your other state variables
const [isAddressLoading, setIsAddressLoading] = useState(false);

// Add this to track API requests for cancellation
const activeRequestsRef = useRef({});  const [shiprocketToken, setShiprocketToken] = useState(null);
const [activeMessages, setActiveMessages] = useState(new Set());
const snackbarTimerRef = useRef(null);
  const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
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
  const showSnackbar = useCallback((message, severity = 'success') => {
  console.log('Showing snackbar:', { message, severity });
  
  // Don't show the same message multiple times in quick succession
  if (activeMessages.has(message)) {
    console.log('Skipping duplicate message:', message);
    return;
  }
  
  // Add to active messages set
  setActiveMessages(prev => new Set(prev).add(message));
  
  // Clear any existing timer
  if (snackbarTimerRef.current) {
    clearTimeout(snackbarTimerRef.current);
  }
  
  // Close any existing snackbar first
  setSnackbarOpen(false);
  
  // Small delay before showing new message to ensure animation is smooth
  setTimeout(() => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
    
    // Set auto-close timer that also removes from active messages
    snackbarTimerRef.current = setTimeout(() => {
      setSnackbarOpen(false);
      setActiveMessages(prev => {
        const updated = new Set(prev);
        updated.delete(message);
        return updated;
      });
      snackbarTimerRef.current = null;
    }, 4000); // Longer duration
  }, 50);
}, [activeMessages]);

// Also update the handleClose function for the snackbar
const handleSnackbarClose = useCallback(() => {
  setSnackbarOpen(false);
  
  // Remove current message from active messages after a short delay
  setTimeout(() => {
    setActiveMessages(prev => {
      const updated = new Set(prev);
      updated.delete(snackbarMessage);
      return updated;
    });
  }, 300);
  
  if (snackbarTimerRef.current) {
    clearTimeout(snackbarTimerRef.current);
    snackbarTimerRef.current = null;
  }
}, [snackbarMessage]);

// Add cleanup on unmount
useEffect(() => {
  return () => {
    if (snackbarTimerRef.current) {
      clearTimeout(snackbarTimerRef.current);
    }
  };
}, []);

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

// Update the fetchShiprocketAddress function

// Add this function to fetch Shiprocket address data
const fetchShiprocketAddress = useCallback(async (silent = false) => {
  if (!silent) {
    setIsAddressLoading(true);
  }
  
  try {
    // OPTIMIZATION: Use controller for request cancellation
    if (activeRequestsRef.current.shiprocketAddress) {
      activeRequestsRef.current.shiprocketAddress.abort();
    }
    const controller = new AbortController();
    activeRequestsRef.current.shiprocketAddress = controller;
    
    // Set timeout for the request
    const timeoutId = setTimeout(() => {
      controller.abort();
      console.log('Shiprocket request timed out');
      if (!silent) {
        setIsAddressLoading(false);
      }
    }, 5000);
    
    // Call your Shiprocket address API
    const response = await fetch('/api/shiprocket/fetch-address', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cart_data: {
          items: cartItems.map(item => ({
            variant_id: item.variantId || item.id,
            quantity: item.quantity
          }))
        }
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Shiprocket API error: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.success) {
      // Parse response text if it's a string
      let shiprocketData;
      try {
        shiprocketData = typeof result.response === 'string' 
          ? JSON.parse(result.response) 
          : result.response;
      } catch (e) {
        console.error('Failed to parse Shiprocket response:', e);
        return null;
      }
      
      if (shiprocketData && shiprocketData.ok) {
        // Extract address data
        const addressData = shiprocketData.result;
        console.log('Shiprocket address found:', addressData);
        
        // Store token for future reference
        if (addressData.platform_order_id) {
          setShiprocketToken(addressData.platform_order_id);
        }
        
        // Extract phone number and check database
        if (addressData.phone) {
          const formattedPhone = formatPhoneNumber(addressData.phone);
          
          // Update the phone field if empty
          if (!getValues('phoneNumber')) {
            setValue('phoneNumber', formattedPhone);
          }
          
          // Now check if this user exists in our database
          return await checkUserByPhone(formattedPhone, addressData);
        } else if (addressData.shipping_address?.phone) {
          // Try shipping address phone
          const formattedPhone = formatPhoneNumber(addressData.shipping_address.phone);
          setValue('phoneNumber', formattedPhone);
          return await checkUserByPhone(formattedPhone, addressData);
        }
      }
    }
    return null;
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error('Error fetching Shiprocket address:', error);
      if (!silent) {
        showSnackbar('Failed to fetch address data', 'error');
      }
    }
    return null;
  } finally {
    if (!silent) {
      setIsAddressLoading(false);
    }
    delete activeRequestsRef.current.shiprocketAddress;
  }
}, [cartItems, formatPhoneNumber, setValue, getValues, showSnackbar]);
// Add this function to your component
const createUserWithAddress = useCallback(async (phone, address) => {
  try {
    const response = await fetch('/api/user/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber: phone,
        name: address.name || getValues('name') || '',
        email: address.email || getValues('email') || '',
        address: {
          addressLine1: address.addressLine1 || '',
          addressLine2: address.addressLine2 || '',
          city: address.city || '',
          state: address.state || '',
          pincode: address.pincode || '',
          country: address.country || 'India',
        },
        source: 'shiprocket-integration',
      })
    });
    
    const userData = await response.json();
    
    if (userData.userId) {
      // Update Redux with user ID
      dispatch(setUserDetails({ userId: userData.userId }));
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error creating user with address:', error);
    return false;
  }
}, [dispatch, getValues]);

// Also add this function to handle address selection
const handleAddressSelection = useCallback((index) => {
  const selectedAddress = addressOptions[parseInt(index)];
  if (selectedAddress) {
    // Fill form with selected address
    fillAddressForm(selectedAddress);
    
    // Hide address selector
    setShowAddressSelector(false);
  }
}, [addressOptions, fillAddressForm]);
// Function to fill address form with given address data
const fillAddressForm = useCallback((address) => {
  if (!address) return;
  
  // Batch form updates for better performance
  const fields = [
    'addressLine1', 'addressLine2', 'city', 'state', 
    'pincode', 'country', 'name', 'email'
  ];
  
  fields.forEach(field => {
    if (address[field]) setValue(field, address[field]);
  });
  
  // Update Redux in one batch
  dispatch(setAddressDetails(address));
  
  // Pre-validate pincode in parallel if needed
  if (address.pincode && address.pincode.length === 6) {
    setTimeout(() => validatePincode(address.pincode), 0);
  }
}, [setValue, dispatch, validatePincode]);

// Function to check user by phone number
const checkUserByPhone = useCallback(async (phone, shiprocketAddressData) => {
  try {
    const controller = new AbortController();
    activeRequestsRef.current.userPhoneCheck = controller;
    
    // Set timeout
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 3000);
    
    // Check if user exists with this phone
    const response = await fetch('/api/user/check-by-phone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: phone }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const userData = await response.json();
      
      if (userData.exists) {
        // User found - update Redux
        dispatch(setUserDetails({ 
          userId: userData.userId,
          phoneNumber: phone
        }));
        
        // Check if user has multiple addresses
        if (userData.addresses && userData.addresses.length > 1) {
          // Show address selection UI
          setAddressOptions(userData.addresses);
          setShowAddressSelector(true);
          return { success: true, multipleAddresses: true };
        } 
        else if (userData.addresses && userData.addresses.length === 1) {
          // Use the single address
          const savedAddress = userData.addresses[0];
          fillAddressForm(savedAddress);
          return { success: true, usedSavedAddress: true };
        }
      } else {
        // New user - use Shiprocket address and create user in background
        if (shiprocketAddressData) {
          const address = extractAddressFromShiprocket(shiprocketAddressData);
          fillAddressForm(address);
          
          // Create user in background
          createUserWithAddress(phone, address);
          return { success: true, usedShiprocketAddress: true };
        }
      }
    }
    return { success: false };
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error('Error checking user by phone:', error);
    }
    return { success: false };
  } finally {
    delete activeRequestsRef.current.userPhoneCheck;
  }
}, [dispatch, fillAddressForm, createUserWithAddress]);

// Helper function to extract address from Shiprocket data
const extractAddressFromShiprocket = (data) => {
  if (data.shipping_address) {
    const address = data.shipping_address;
    return {
      addressLine1: address.line1 || '',
      addressLine2: address.line2 || '',
      city: address.city || '',
      state: address.state || '',
      pincode: address.pincode || '',
      country: address.country || 'India',
      name: `${address.first_name || ''} ${address.last_name || ''}`.trim(),
      email: address.email || '',
      phoneNumber: address.phone || ''
    };
  }
  return null;
};

// Update your OTP verification flow
useEffect(() => {
  if (otpStep === 'verified') {
    try {
      setIsAddressLoading(true);
      
      // Format phone number
      const phoneToUse = formatPhoneNumber(data.phoneNumber);

      // Update Redux with user information
      dispatch(setUserDetails({
        name: data.name,
        phoneNumber: phoneToUse,
        email: data.email,
      }));
      
      // First try Shiprocket to get address by recent orders
      fetchShiprocketAddress(true)
        .then(shiprocketResult => {
          // If no address from Shiprocket, fall back to database check
          if (!shiprocketResult?.success) {
            return checkUserInDatabase(phoneToUse);
          }
        })
        .catch(err => {
          console.error('Error in address lookup flow:', err);
          return checkUserInDatabase(phoneToUse);
        })
        .finally(() => {
          // Always proceed to next step
          setTabIndex(1);
          setIsAddressLoading(false);
        });
    } catch (error) {
      console.error('Error in verification flow:', error);
      setTabIndex(1);
      setIsAddressLoading(false);
    }
  }
}, [otpStep, fetchShiprocketAddress, checkUserInDatabase, formatPhoneNumber, dispatch, setTabIndex]);
// Listen for address lookup events - add this AFTER the function definition
useEffect(() => {
  const handleAddressLookup = (event) => {
    if (event.detail && (event.detail.token || event.detail.phoneNumber)) {
      fetchShiprocketAddress(event.detail.token);
    }
  };
  
  window.addEventListener('shiprocket-address-lookup', handleAddressLookup);
  
  return () => {
    window.removeEventListener('shiprocket-address-lookup', handleAddressLookup);
  };
}, [fetchShiprocketAddress]);
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

// First, move the validatePincode function definition above where it's being used
// Place this code after your state declarations but before any useEffects that use it

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

const SnackbarPortal = ({ children }) => {
  const [portalElement, setPortalElement] = useState(null);

  useEffect(() => {
    // Create portal container on mount
    const element = document.createElement('div');
    element.setAttribute('id', 'snackbar-portal-container');
    element.style.position = 'fixed';
    element.style.zIndex = '99999'; // High z-index
    element.style.top = '0';
    element.style.left = '0';
    element.style.width = '100%';
    document.body.appendChild(element);
    setPortalElement(element);

    // Cleanup on unmount
    return () => {
      document.body.removeChild(element);
    };
  }, []);

  // Only render once portal element is available
  return portalElement ? ReactDOM.createPortal(children, portalElement) : null;
};

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
  // Modify the onSendOtp function
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
    
    // 1. Start the API call for beforeVerify in parallel - don't wait for it
    const apiPromise = fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        phoneNumber: formattedPhoneNumber.trim(),
        verificationStatus: 'beforeVerify'
      })
    });
    
    // Update Redux store with user details
    dispatch(setUserDetails({
      name,
      phoneNumber: formattedPhoneNumber,
      email: getValues('email') || '',
    }));
    
    // 2. Ensure recaptcha is ready
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
    
    // 3. Prepare phone number for Firebase
    const full = '+91' + formattedPhoneNumber;
    
    // 4. Optimistically update UI to show OTP screen immediately
    setOtpStep('otp');
    setValue('otp', '');
    startResendTimer();
    showSnackbar('Sending OTP...', 'info');
    
    // 5. Render recaptcha if not yet rendered (in background)
    if (!recaptchaVerifierRef.current.render) {
      await recaptchaVerifierRef.current.render();
    }
    
    // 6. Call Firebase to actually send the OTP
    const result = await signInWithPhoneNumber(auth, full, recaptchaVerifierRef.current);
    setConfirmationResult(result);
    
    // 7. Show success message after OTP is sent
    showSnackbar('OTP sent!', 'success');
    
    // 8. Process the API result in background
    apiPromise.then(res => res.json())
      .then(data => {
        console.log("User registered with beforeVerify status:", data);
      })
      .catch(err => {
        console.error("Background API call failed:", err);
        // No UI impact for failure
      });
    
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
    // If OTP sending fails, go back to phone input
    setOtpStep('phone');
  } finally {
    setIsSendingOtp(false);
  }
};

// Resend OTP handler
const onResendOtp = async () => {
  if (resendTimer === 0 && !isResendingOtp) {
    setIsResendingOtp(true);
    
    // Start timer immediately for better UX
    startResendTimer();
    showSnackbar('Sending new OTP...', 'info');
    
    // Use the stored phone number
    const phoneNumber = getValues('phoneNumber');
    const formattedPhoneNumber = formatPhoneNumber(phoneNumber);
    
    try {
      if (!formattedPhoneNumber || formattedPhoneNumber.length !== 10) {
        showSnackbar('Phone number missing or invalid', 'error');
        setIsResendingOtp(false);
        return;
      }

      const full = '+91' + formattedPhoneNumber;
      
      // Create a timeout promise to handle long operations
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timed out')), 10000);
      });
      
      // Try to reset recaptcha but don't wait too long
      try {
        if (recaptchaVerifierRef.current._reset) {
          // Use Promise.race to avoid hanging on recaptcha reset
          await Promise.race([
            Promise.resolve(recaptchaVerifierRef.current._reset()),
            new Promise(resolve => setTimeout(resolve, 1000))
          ]);
        }
      } catch (resetErr) {
        console.log('Recaptcha reset timed out or failed, continuing anyway');
        // Create new recaptcha if reset fails
        if (window.recaptchaVerifier) {
          try {
            window.recaptchaVerifier.clear();
          } catch (e) {}
          delete window.recaptchaVerifier;
          recaptchaVerifierRef.current = null;
        }
        
        const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible',
          callback: () => {},
          'expired-callback': () => {}
        });
        
        window.recaptchaVerifier = verifier;
        recaptchaVerifierRef.current = verifier;
      }
      
      // Race signInWithPhoneNumber against a timeout
      const result = await Promise.race([
        signInWithPhoneNumber(auth, full, recaptchaVerifierRef.current),
        timeoutPromise
      ]);
      
      setConfirmationResult(result);
      showSnackbar('OTP resent!', 'success');
    } catch (error) {
      console.error("OTP resend error:", error);
      
      // Special handling for timeout errors
      if (error.message === 'Timed out') {
        showSnackbar('OTP sending is taking longer than expected. Please try again.', 'warning');
        // Reset timer so user can try again immediately
        setResendTimer(0);
        clearInterval(timerRef.current);
      } else {
        showSnackbar('Failed to resend OTP', 'error');
      }
    } finally {
      setIsResendingOtp(false);
    }
  }
};

// Replace the existing onVerifyOtp function with this one

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
    const phoneNumber = formatPhoneNumber(getValues('phoneNumber'));
    const name = getValues('name');
    const email = getValues('email');
    
    if (!confirmationResult) {
      showSnackbar('OTP session expired. Please request a new OTP.', 'error');
      setIsVerifyingOtp(false);
      return;
    }
    
    // STEP 1: Show optimistic UI update immediately
    showSnackbar('Verifying...', 'info');
    
    // STEP 2: Start verification in the background
    const userCredPromise = confirmationResult.confirm(otp);
    
    // STEP 3: Optimistically update UI state
    setPhoneVerified(true);
    setOtpStep('verified');
    
    // STEP 4: Update Redux store
    dispatch(setUserExists(true));
    dispatch(setUserDetails({
      phoneNumber,
      name,
      email
    }));
    
    // STEP 5: Complete Firebase verification
    const userCred = await userCredPromise;
    
    if (!userCred || !userCred.user) {
      // Roll back optimistic updates on failure
      setPhoneVerified(false);
      setOtpStep('otp');
      showSnackbar('Verification failed. Please try again.', 'error');
      return;
    }
    
    // STEP 6: Get Firebase token
    const idToken = await userCred.user.getIdToken();
    showSnackbar('Phone verified!', 'success');
    
    // STEP 7: Check if user exists in our database with this phone number
    try {
      // First check if user exists with address
      const userCheckResponse = await fetch('/api/user/find-address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber })
      });
      
      const userData = await userCheckResponse.json();
      
      if (userData.success && userData.exists) {
        // User exists in our database
        dispatch(setUserDetails({
          phoneNumber,
          name: userData.name || name,
          email: userData.email || email,
          userId: userData.userId
        }));
        
        // STEP 8A: If user has address, use that
        if (userData.hasAddress && userData.latestAddress) {
          const address = userData.latestAddress;
          
          // Fill form with address from database
          setValue('addressLine1', address.addressLine1 || '');
          setValue('addressLine2', address.addressLine2 || '');
          setValue('city', address.city || '');
          setValue('state', address.state || '');
          setValue('pincode', address.pincode || '');
          setValue('country', address.country || 'India');
          
          // Update Redux
          dispatch(setAddressDetails({
            addressLine1: address.addressLine1 || '',
            addressLine2: address.addressLine2 || '',
            city: address.city || '',
            state: address.state || '',
            pincode: address.pincode || '',
            country: address.country || 'India'
          }));
          
          // Validate pincode
          if (address.pincode && address.pincode.length === 6) {
            validatePincode(address.pincode);
          }
          
          showSnackbar('Address loaded from your account', 'success');
        } 
        // STEP 8B: If user exists but no address, try Shiprocket
        else {
          // Try Shiprocket address autofill
          await fetchShiprocketAddress();
        }
      } else {
        // STEP 8C: User doesn't exist in our database
        // Create user in background
        const createUserResponse = await fetch('/api/user/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phoneNumber,
            name,
            email,
            idToken,
            verificationStatus: 'verified'
          })
        });
        
        const newUser = await createUserResponse.json();
        
        if (newUser.success) {
          dispatch(setUserDetails({
            userId: newUser.userId,
            phoneNumber,
            name,
            email
          }));
        }
        
        // Try Shiprocket address autofill
        await fetchShiprocketAddress();
      }
    } catch (error) {
      console.error('User/address check error:', error);
      // If user/address check fails, still continue
      // Try Shiprocket as last resort
      await fetchShiprocketAddress();
    }
    
    // STEP 9: Complete NextAuth and Session processes in background
    Promise.allSettled([
      // NextAuth sign in
      signIn("credentials", {
        redirect: false,
        idToken
      }),
      
      // Session login
      fetch('/api/sessionLogin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
      }).then(res => res.json())
    ]).then(results => {
      const authResult = results[0];
      if (authResult.status !== 'fulfilled' || !authResult.value?.ok) {
        console.warn('Session creation had issues - continuing anyway');
      }
    });
    
  } catch (error) {
    console.error('Failed to verify OTP:', error);
    showSnackbar('Verification failed', 'error');
    setPhoneVerified(false);
    setOtpStep('otp');
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

  // If verification is complete, proceed with original flow
  if (otpStep === 'verified') {
    try {
      setIsAddressLoading(true);
      
      // Format phone number
      const phoneToUse = formatPhoneNumber(data.phoneNumber);

      // OPTIMIZATION 1: Update Redux immediately for better UX
      dispatch(setUserDetails({
        name: data.name,
        phoneNumber: phoneToUse,
        email: data.email,
      }));
      
      // OPTIMIZATION 2: Use a controller for request cancellation
      if (activeRequestsRef.current.userCheck) {
        activeRequestsRef.current.userCheck.abort();
      }
      const controller = new AbortController();
      activeRequestsRef.current.userCheck = controller;
      
      // OPTIMIZATION 3: Set a timeout for the request
      const timeoutId = setTimeout(() => {
        controller.abort();
        console.log('Request timed out - proceeding anyway');
        setTabIndex(1);
        setIsAddressLoading(false);
      }, 3000); // 3 second timeout

      // OPTIMIZATION 4: Use fetch with AbortController instead of axios for better control
      const response = await fetch('/api/user/check', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          // OPTIMIZATION 5: Add cache control headers
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify({
          // OPTIMIZATION 6: Minimal payload
          phoneNumber: phoneToUse,
          name: data.name,
          email: data.email,
          requestAddressOnly: true // Tell backend we only need address data
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const userData = await response.json();
        console.log('User data received:', userData);
        if (userData.exists) {
          // Update Redux with user ID
          dispatch(setUserDetails({ userId: userData.userId }));
          
          // OPTIMIZATION 7: Only process address if it exists
          if (userData.latestAddress && Object.keys(userData.latestAddress).length > 0) {
            // Create a single optimized address object
            const addressToUse = {
              addressLine1: userData.latestAddress.addressLine1 || '',
              addressLine2: userData.latestAddress.addressLine2 || '',
              city: userData.latestAddress.city || '',
              state: userData.latestAddress.state || '',
              pincode: userData.latestAddress.pincode || '',
              country: userData.latestAddress.country || 'India',
            };
            
            // Single Redux update instead of multiple
            dispatch(setAddressDetails(addressToUse));
            
            // Batch form updates
            Object.entries(addressToUse).forEach(([key, value]) => {
              setValue(key, value);
            });
            
            // OPTIMIZATION 8: Pre-validate pincode in parallel if needed
            if (addressToUse.pincode && addressToUse.pincode.length === 6) {
              setTimeout(() => validatePincode(addressToUse.pincode), 0);
            }
          } else {
            // OPTIMIZATION 9: Fetch Shiprocket address in background
            setTimeout(() => fetchShiprocketAddress(true), 0);
          }
        } else {
          // OPTIMIZATION 10: Create user silently in background
          fetch('/api/user/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phoneNumber: phoneToUse,
              name: data.name,
              email: data.email,
              source: 'order-form'
            })
          })
          .then(res => res.json())
          .then(newUser => {
            if (newUser.userId) {
              dispatch(setUserDetails({ userId: newUser.userId }));
            }
          })
          .catch(err => console.error('Background user creation failed', err));
          
          // Try Shiprocket for address
          setTimeout(() => fetchShiprocketAddress(true), 0);
        }
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error in user check:', error);
      }
    } finally {
      // OPTIMIZATION 11: Always move to next step even if there are errors
      setTabIndex(1);
      setIsAddressLoading(false);
      delete activeRequestsRef.current.userCheck;
    }
  }
}, [otpStep, onSendOtp, onVerifyOtp, formatPhoneNumber, dispatch, setValue, validatePincode, setTabIndex, fetchShiprocketAddress]);
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
      console.log("receiverName", orderForm.userDetails.name);
      const addAddressPayload = {
        phoneNumber: orderForm.userDetails.phoneNumber,
        address: {
          receiverName: orderForm.userDetails.name || '',
          receiverPhoneNumber: orderForm.userDetails.phoneNumber.replace(/\D/g, '').slice(-10), // Ensure last 10 digits
          addressLine1: data.addressLine1,
          addressLine2: data.addressLine2,
          city: data.city,
          state: data.state,
          pincode: data.pincode,
          country: data.country || 'India',
          ...orderForm.extraFields,
        },
      };

      console.log('Submitting address details:', addAddressPayload);
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

// In your StyledTextField component, modify it to properly handle input changes:

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
      onChange={onChange || field.onChange} // Use provided onChange or default to field.onChange
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
    <>
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
                   "Let's get to know you") 
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
                              </motion.div>
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
                    key="shippingInfo"
                    custom={1}
                    variants={formVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    style={{ width: '100%' }}
                  >
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%', paddingTop: '0.5rem', px: { xs: 0.5, sm: 1 } }}>

                      {showAddressSelector && addressOptions.length > 0 && (
        <Paper className={styles.addressSelectorContainer} elevation={2} sx={{ mb: 2, p: 2, borderRadius: '12px' }}>
          <Typography variant="h6" sx={{ mb: 1.5, fontSize: '1rem', fontWeight: 500 }}>Select a saved address</Typography>
          <RadioGroup onChange={(e) => handleAddressSelection(e.target.value)}>
            {addressOptions.map((address, index) => (
              <FormControlLabel
                key={index}
                value={index.toString()}
                control={<Radio />}
                label={
                  <div className={styles.addressOption}>
                    <Typography variant="body1">
                      {address.addressLine1}
                      {address.addressLine2 && `, ${address.addressLine2}`}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {address.city}, {address.state} - {address.pincode}
                    </Typography>
                  </div>
                }
              />
            ))}
          </RadioGroup>
          <Button 
            variant="outlined"
            color="primary"
            onClick={() => setShowAddressSelector(false)}
            sx={{ mt: 1.5, textTransform: 'none' }}
            size="small"
          >
            Use New Address
          </Button>
        </Paper>
      )}
                      {/* Address (combines House No. and Street) */}
<Controller
  name="addressLine1"
  control={control}
  rules={{ required: 'Address is required' }}
  render={({ field }) => (
    <StyledTextField
      field={field}
      label="Address"
      error={errors.addressLine1}
      helperText={errors.addressLine1 ? errors.addressLine1.message : ''}
      disabled={isLoading || isPaymentProcessing}
      onChange={(e) => {
        field.onChange(e);
        dispatch(setAddressDetails({ addressLine1: e.target.value }));
      }}
    />
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
      onChange={(e) => {
        field.onChange(e);
        dispatch(setAddressDetails({ city: e.target.value }));
      }}
    />
  )}
/>

{/* State and Pincode in one row */}
<Box sx={{ display: 'flex', gap: 2, width: '100%' }}>
  <Box sx={{ flex: 2 }}>
    <Controller
      name="state"
      control={control}
      rules={{ required: 'State is required' }}
      render={({ field }) => (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <Autocomplete
            options={indianStates}
            getOptionLabel={(option) => option}
            value={field.value || ''}
            onChange={(event, newValue) => {
              field.onChange(newValue);
              dispatch(setAddressDetails({
                ...addressDetails, // Keep all existing address details
                state: newValue // Update only the state field
              }));
            }}
            disableClearable
            renderInput={(params) => (
              <TextField
                {...params}
                label="State"
                error={!!errors.state}
                helperText={errors.state ? errors.state.message : ''}
                variant="outlined"
                disabled={isLoading || isPaymentProcessing}
                sx={{
                  marginBottom: '1rem',
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '8px',
                    fontFamily: 'Jost, sans-serif',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      boxShadow: '0 4px 8px rgba(0,0,0,0.08)',
                    },
                    '&.Mui-focused': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 6px 12px rgba(0,0,0,0.1)',
                    }
                  },
                }}
                InputLabelProps={{
                  style: {
                    fontFamily: 'Jost, sans-serif',
                    fontSize: '0.9rem',
                  },
                }}
                InputProps={{
                  ...params.InputProps,
                  style: {
                    fontFamily: 'Jost, sans-serif',
                    fontSize: '1rem',
                  },
                }}
              />
            )}
          />
        </motion.div>
      )}
    />
  </Box>
  <Box sx={{ flex: 1 }}>
    <Controller
      name="pincode"
      control={control}
      rules={{
        required: 'Pincode is required',
        pattern: {
          value: /^\d{6}$/,
          message: 'Enter a valid 6-digit pincode',
        }
      }}
      render={({ field }) => (
        <StyledTextField
          field={field}
          label="Pincode"
          error={errors.pincode}
          helperText={errors.pincode ? errors.pincode.message : ''}
          disabled={isLoading || isPaymentProcessing}
          type="tel"
          onChange={(e) => {
            const value = e.target.value.replace(/\D/g, '');
            field.onChange(value);
            dispatch(setAddressDetails({ ...addressDetails, pincode: value }));
          }}
          maxWidth="100%"
        />
      )}
    />
  </Box>
</Box>
{/* Pincode non-serviceable message */}
                      {watchedPincode?.length === 6 && !isPincodeValid && !pincodeCheckInProgress && (
                        <motion.div
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                              p: '12px',
                              backgroundColor: alpha(theme.palette.error.main, 0.1),
                              border: `1px solid ${alpha(theme.palette.error.dark, 0.2)}`,
                              borderRadius: '8px',
                              boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                              mt: 1
                            }}
                          >
                            <WarningAmberIcon sx={{ color: theme.palette.error.dark, fontSize: '1.2rem' }} />
                            <Typography
                              variant="caption"
                              sx={{
                                fontFamily: 'Jost, sans-serif',
                                color: theme.palette.error.dark,
                                fontSize: '0.8rem',
                                fontWeight: 500
                              }}
                            >
                              We don&apos;t deliver to this pincode yet.
                            </Typography>
                          </Box>
                        </motion.div>
                      )}

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
  isLoading={
    otpStep === 'phone' 
      ? isSendingOtp 
      : otpStep === 'otp' 
        ? isVerifyingOtp 
        : isAddressLoading  // New state for address loading
  }
  buttonText={
    otpStep === 'phone' 
      ? 'Send OTP' 
      : otpStep === 'otp' 
        ? 'Verify OTP' 
        : 'Next'
  }
  disabled={
    isPaymentProcessing || 
    (otpStep === 'phone' && isSendingOtp) || 
    (otpStep === 'otp' && isVerifyingOtp) ||
    (otpStep === 'verified' && isAddressLoading)
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
          {/* Trust indicators - Made more compact */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
          >
            <Box
              sx={{
                mt: 1, // Reduced from 5
                pt: 1,
                borderTop: '1px solid #f0f0f0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 1, // Reduced from 2
                flexShrink: 0, // Prevent shrinking
              }}
            >
              <Typography
                variant="subtitle2"
                sx={{
                  fontFamily: 'Jost, sans-serif',
                  color: '#666',
                  fontSize: '0.8rem', // Reduced from 0.9rem
                  textAlign: 'center',
                }}
              >
                Trusted by 50,000+ happy customers
              </Typography>

              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: { xs: 2, sm: 3 }, // Reduced from { xs: 2, sm: 4 }
                  width: '100%',
                }}
              >
                <motion.div whileHover={{ y: -3 }} transition={{ type: "spring", stiffness: 400 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 0.5, // Reduced from 1
                    }}
                  >
                    <Image
                      loading="eager"
                      src={`${baseImageUrl}/assets/icons/shield.png`}
                      width={24} // Reduced from 32
                      height={24} // Reduced from 32
                      alt="Secure Payment"
                      style={{ opacity: 0.7 }}
                    />
                    <Typography
                      variant="caption"
                      sx={{
                        fontFamily: 'Jost, sans-serif',
                        color: '#666',
                        textAlign: 'center',
                        fontSize: '0.6rem', // Reduced from 0.7rem
                      }}
                    >
                      Secure Payment
                    </Typography>
                  </Box>
                </motion.div>

                <motion.div whileHover={{ y: -3 }} transition={{ type: "spring", stiffness: 400 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 0.5, // Reduced from 1
                    }}
                  >
                    <Image
                      loading="eager"
                      src={`${baseImageUrl}/assets/icons/fast-delivery.png`}
                      width={24} // Reduced from 32
                      height={24} // Reduced from 32
                      alt="Fast Shipping"
                      style={{ opacity: 0.7 }}
                    />
                    <Typography
                      variant="caption"
                      sx={{
                        fontFamily: 'Jost, sans-serif',
                        color: '#666',
                        textAlign: 'center',
                        fontSize: '0.6rem', // Reduced from 0.7rem
                      }}
                    >
                      Fast Shipping
                    </Typography>
                  </Box>
                </motion.div>

                <motion.div whileHover={{ y: -3 }} transition={{ type: "spring", stiffness: 400 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 0.5, // Reduced from 1
                    }}
                  >
                    <Image
                      loading="eager"
                      src={`${baseImageUrl}/assets/icons/happiness.png`}
                      width={24} // Reduced from 32
                      height={24} // Reduced from 32
                      alt="Customer Satisfaction"
                      style={{ opacity: 0.7 }}
                    />
                    <Typography
                      variant="caption"
                      sx={{
                        fontFamily: 'Jost, sans-serif',
                        color: '#666',
                        textAlign: 'center',
                        fontSize: '0.6rem', // Reduced from 0.7rem
                      }}
                    >
                      100% Satisfaction
                    </Typography>
                  </Box>
                </motion.div>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Image
                  loading="eager"
                  src={`${baseImageUrl}/assets/icons/razorpay_logo.svg`}
                  width={50} // Reduced from 60
                  height={15} // Reduced from 18
                  alt="Razorpay"
                  style={{ opacity: 0.7 }}
                />
                <Typography
                  variant="caption"
                  sx={{
                    fontFamily: 'Jost, sans-serif',
                    color: '#666',
                    fontSize: '0.6rem', // Reduced from 0.7rem
                  }}
                >
                  |
                </Typography>
                <Image
                  loading="eager"
                  src={`${baseImageUrl}/assets/icons/shiprocket_logo.svg`}
                  width={50} // Reduced from 60
                  height={15} // Reduced from 18
                  alt="Shiprocket"
                  style={{ opacity: 0.7 }}
                />
              </Box>
            </Box>
          </motion.div>
            <div id="shiprocket-address-container" style={{ display: 'none', position: 'absolute' }}></div>
        </DialogContent>
      </Dialog>

    </ThemeProvider>
    <SnackbarPortal >
      {/* Render snackbar outside ThemeProvider */}
      <CustomSnackbar
        open={snackbarOpen}
        message={snackbarMessage}
        severity={snackbarSeverity}
        handleClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        autoHideDuration={2000}
        style={{ zIndex: 9999999 }} 
      />
    </SnackbarPortal>
    </>
  );
};

export default OrderForm;