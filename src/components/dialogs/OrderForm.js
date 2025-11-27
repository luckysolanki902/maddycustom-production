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
  Button,
  MenuItem
} from '@mui/material';
import Grid from '@mui/material/Grid';
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
  setExtraFields,
  clearOrderFormAutoOpen,
} from '../../store/slices/orderFormSlice';
import { closeAllDialogs } from '@/store/slices/uiSlice';  // Import the new action
import { makePayment } from '../../lib/payments/makePayment';
import { ensureRazorpayLoaded } from '../../lib/payments/ensureRazorpayLoaded';
import { createLogger } from '@/lib/utils/logger';
import { useRouter } from 'next/navigation';
import CustomSnackbar from '../notifications/CustomSnackbar';
import { getPaymentButtonText } from '../../lib/utils/orderFormUtils';
import { ThemeProvider } from '@mui/material';
import theme from '@/styles/theme';
import { purchase, paymentInitiated, initiateCheckout as trackInitiateCheckout } from '@/lib/metadata/facebookPixels';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber'; // Added
import MyLocationIcon from '@mui/icons-material/MyLocation';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import { debounce } from 'lodash';
import useHistoryState from '@/hooks/useHistoryState';
import reverseGeocodeClient from '@/lib/utils/reverseGeocodeClient';
import useCheckoutPrefetch from '@/hooks/useCheckoutPrefetch';
import funnelClient from '@/lib/analytics/funnelClient';
import { gaAddBillingInfo, gaAddPaymentInfo, gaPurchase } from '@/lib/metadata/googleAds';
import { buildPurchaseEventPayload } from '@/lib/analytics/purchaseEventPayload';
import { PAYMENT_PROVIDERS } from '@/lib/payments/providers';
import { captureClientTrackingData } from '@/lib/analytics/trackingCapture';

// Create logger for OrderForm component
const logger = createLogger('OrderForm');

const sanitizeFloorValue = (value) => {
  if (value === undefined || value === null) return '';
  return String(value).trim();
};

const extractFloorFromAddressLine1 = (line1) => {
  if (!line1 || typeof line1 !== 'string') return { base: line1 || '', floor: '' };
  let base = line1;
  let floor = '';
  const patterns = [
    { regex: /\b(?:floor|flr|fl)\s*[-:]?\s*(\d{1,2})(?:\s*(?:st|nd|rd|th))?\b/i, group: 1 },
    { regex: /\b(\d{1,2})(?:\s*(?:st|nd|rd|th))?\s*(?:floor|flr|fl)\b/i, group: 1 },
  ];

  for (const { regex, group } of patterns) {
    const match = base.match(regex);
    if (match) {
      floor = match[group] || '';
      base = base.replace(regex, '');
      break;
    }
  }

  base = base
    .replace(/\s{2,}/g, ' ')
    .replace(/,\s*,/g, ',')
    .replace(/(^[\s,]+|[\s,]+$)/g, '')
    .replace(/,\s*$/, '')
    .trim();

  return { base, floor };
};

const mapAddressForStore = (incomingAddress) => {
  if (!incomingAddress || typeof incomingAddress !== 'object') return {};

  const cloned = { ...incomingAddress };
  const structured = cloned.structured || {};
  const { base, floor: extractedFloor } = extractFloorFromAddressLine1(cloned.addressLine1 || '');
  const candidateFloor = cloned.floor ?? structured.floor ?? extractedFloor;
  const normalizedFloor = sanitizeFloorValue(candidateFloor);

  const result = {
    ...cloned,
    addressLine1: base || '',
    addressLine2: cloned.addressLine2 || '',
    city: cloned.city || '',
    state: cloned.state || '',
    pincode: cloned.pincode || '',
    country: cloned.country || 'India',
    floor: normalizedFloor,
  };

  if (cloned.structured || normalizedFloor) {
    result.structured = {
      ...structured,
      floor: normalizedFloor || structured.floor,
    };
  }

  return result;
};

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
  const { startPrefetch, status: prefetchStatus } = useCheckoutPrefetch();
  const paymentModeName = paymentModeConfig?.name || undefined;

  const normalizedCouponCode = useMemo(() => {
    if (typeof couponCode !== 'string') return undefined;
    const trimmed = couponCode.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }, [couponCode]);

  const computeCartSnapshot = useCallback(() => {
    const itemsTotal = cartItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    const snapshot = {};
    if (itemsTotal > 0) {
      snapshot.items = itemsTotal;
    }
    const numericTotal = Number(totalCost);
    if (Number.isFinite(numericTotal)) {
      snapshot.value = numericTotal;
      snapshot.currency = 'INR';
    }
    return snapshot;
  }, [cartItems, totalCost]);

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
  const formOpenTrackedRef = useRef(false);
  const addressTabTrackedRef = useRef(false);

  // Simple mobile focus detection
  const [isInputFocused, setIsInputFocused] = useState(false);

  // Snackbar state
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');

  const [isLoading, setIsLoading] = useState(false);
  const [isPaymentProcessing, setIsPaymentProcessing] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
  const clientPaymentProvider = (
    process.env.NEXT_PUBLIC_PAYMENT_GATEWAY_PROVIDER ||
    process.env.NEXT_PUBLIC_PAYMENT_GATEWAY ||
    'razorpay'
  ).toLowerCase();
  const isPayuProvider = clientPaymentProvider === PAYMENT_PROVIDERS.PAYU;
  const autoOpenRequest = orderForm.autoOpenRequest;
  const lastOrderId = orderForm.lastOrderId;
  const customerName = orderForm.userDetails?.name || '';
  const customerPhone = orderForm.userDetails?.phoneNumber || '';
  const accentColor = '#2d2d2d';

  // Payment method selection
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null); // 'upi' or 'other'
  const [upiPaymentState, setUpiPaymentState] = useState('idle'); // 'idle' | 'processing' | 'waiting' | 'success' | 'failed'
  const [upiIntentUrl, setUpiIntentUrl] = useState(null);
  const [currentTxnId, setCurrentTxnId] = useState(null);
  const pollingIntervalRef = useRef(null);
  const paymentGuardActive = isPaymentProcessing || upiPaymentState === 'waiting' || upiPaymentState === 'processing';
  const upiSelected = selectedPaymentMethod === 'upi';
  const otherSelected = selectedPaymentMethod === 'other';
  
  // Show payment tab after address
  const requiresPayuPaymentTab = true;
  const totalTabs = 3; // User details + Address + Payment

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

  const formatCurrency = useCallback((value) => {
    const numeric = Number(value) || 0;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(numeric);
  }, []);

  const payuOnlineAmount = useMemo(() => {
    const pct = Number(paymentModeConfig?.configuration?.onlinePercentage);
    const base = Number(totalCost) || 0;
    if (Number.isFinite(pct) && pct > 0 && pct <= 100) {
      return Math.round(base * (pct / 100));
    }
    return base;
  }, [paymentModeConfig?.configuration?.onlinePercentage, totalCost]);

  const stepTitles = useMemo(() => {
    if (!requiresPayuPaymentTab) {
      return ["Let's get to know you", 'Where should we deliver?'];
    }
    return [
      "Let's get to know you",
      'Where should we deliver?',
      'Choose how you want to pay',
    ];
  }, [requiresPayuPaymentTab]);

  const payuCtaLabel = useMemo(() => {
    if (!requiresPayuPaymentTab) {
      return getPaymentButtonText(paymentModeConfig);
    }
    return 'Pay securely and continue';
  }, [requiresPayuPaymentTab, paymentModeConfig]);

  // Cleanup polling on unmount or dialog close
  useEffect(() => {
    if (!open) {
      // Dialog is closing - cleanup any pending payment
      if (pollingIntervalRef.current) {
        console.log('🔴 Dialog closing - cleaning up payment polling');
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      // Reset payment states when dialog closes
      setUpiPaymentState('idle');
      setIsPaymentProcessing(false);
      setSelectedPaymentMethod(null);
    }
    
    return () => {
      if (pollingIntervalRef.current) {
        console.log('🔴 Component unmounting - cleaning up payment polling');
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [open]);

  // Snackbar helper - MUST be defined before handleCancelPayment
  const showSnackbar = useCallback((message, severity = 'success') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  }, []);

  // Cancel UPI payment handler
  const handleCancelPayment = useCallback(() => {
    console.log('🔴 User cancelled payment');
    
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    
    setUpiPaymentState('idle');
    setIsPaymentProcessing(false);
    setSelectedPaymentMethod(null);
    setCurrentTxnId(null);
    setUpiIntentUrl(null);
    
    showSnackbar('Payment cancelled. You can try again when ready.', 'info');
  }, [showSnackbar]);

  // Setup react-hook-form with defaultValues as a memoized object to prevent rerenders
  const dvStructArea = orderForm?.prefilledAddress?.structured?.areaLocality || '';
  const dvStructLandmark = orderForm?.prefilledAddress?.structured?.landmark || '';
  const dvStructFloor = orderForm?.prefilledAddress?.structured?.floor;

  const defaultValues = useMemo(() => ({
    name: userDetails.name || '',
    phoneNumber: userDetails.phoneNumber || '',
    email: userDetails.email || '',
    addressLine1: addressDetails.addressLine1 || '',
    addressLine2: addressDetails.addressLine2 || '',
    // Structured address fields
    areaLocality: dvStructArea,
    floorInput: (dvStructFloor !== undefined ? String(dvStructFloor) : ''),
    landmark: dvStructLandmark,
    // directions removed; addressType removed per request
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
    aggregatedExtraFields, dvStructArea, dvStructLandmark, dvStructFloor]);

  // Geolocation capture
  const [geo, setGeo] = useState({ lat: null, lng: null });
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

  // Ensure checkout prefetch is running as soon as the form opens (defensive, in case cart screen didn't trigger it)
  useEffect(() => {
    if (open && cartItems?.length > 0) {
      const code = couponCode || orderForm?.couponApplied?.couponCode || '';
      startPrefetch({ coupon: code });
    }
  }, [open, cartItems, couponCode, orderForm?.couponApplied?.couponCode, startPrefetch]);

  const {
    control,
    handleSubmit,
    setValue,
    reset,
    getValues,
    formState: { errors },
    watch,
  } = useForm({
    defaultValues,
    mode: 'onChange',
    shouldUnregister: false // Prevents field unregistration which helps with focus issues
  });

  useEffect(() => {
    if (!open) {
      formOpenTrackedRef.current = false;
      addressTabTrackedRef.current = false;
      return;
    }

    if (!formOpenTrackedRef.current) {
      formOpenTrackedRef.current = true;
      const cartSnapshot = computeCartSnapshot();
      const { sessionId } = funnelClient.getIdentifiers();
      const sessionToken = sessionId || 'unknown-session';
      const path = typeof window !== 'undefined' ? window.location.pathname : 'order-form';
      const dedupeKey = `open_order_form:${sessionToken}:${path}`;

      try {
        funnelClient.track('open_order_form', {
          dedupeKey,
          cart: cartSnapshot,
          metadata: {
            source: 'order_form_dialog',
            entry: 'checkout_flow',
            paymentMode: paymentModeName,
            hasPrefilledContact: Boolean(userDetails?.phoneNumber),
          },
        });
      } catch (err) {
        console.warn('Funnel open_order_form track failed:', err);
      }
    }
  }, [open, computeCartSnapshot, paymentModeName, userDetails]);

  // Enhanced pincode validation with proactive serviceability check
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Watch pincode for immediate validation
  const watchedPincode = watch('pincode');

  // Effect for early pincode validation
  useEffect(() => {
    if (watchedPincode?.length === 6 && /^\d{6}$/.test(watchedPincode)) {
      // Check if we've already validated this pincode
      if (serviceabilityCache.current[watchedPincode] !== undefined) {
        setIsPincodeValid(serviceabilityCache.current[watchedPincode]);
      } else {
        validatePincode(watchedPincode);
      }
    }
  }, [watchedPincode, validatePincode]);

  // Prevent multiple form submissions
  const [purchaseInitiated, setPurchaseInitiated] = useState(false);

  // Reset tabIndex when dialog opens
  useEffect(() => {
    if (open) {
      setTabIndex(0);
      setPurchaseInitiated(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    if (tabIndex === 0) {
      addressTabTrackedRef.current = false;
      return;
    }

    if (tabIndex === 1 && !addressTabTrackedRef.current) {
      addressTabTrackedRef.current = true;
      const cartSnapshot = computeCartSnapshot();
      const { sessionId } = funnelClient.getIdentifiers();
      const sessionToken = sessionId || 'unknown-session';
      const path = typeof window !== 'undefined' ? window.location.pathname : 'order-form';
      const dedupeKey = `address_tab_open:${sessionToken}:${path}`;

      try {
        funnelClient.track('address_tab_open', {
          dedupeKey,
          cart: cartSnapshot,
          metadata: {
            form: 'order_form',
            transition: 'contact_to_address',
            prefilledAddress: Boolean(prefilledAddress || addressDetails?.addressLine1 || addressDetails?.city),
          },
        });
      } catch (err) {
        console.warn('Funnel address_tab_open track failed:', err);
      }
    }
  }, [tabIndex, open, computeCartSnapshot, prefilledAddress, addressDetails]);

  useEffect(() => {
    if (!open || !requiresPayuPaymentTab) return;
    if (tabIndex !== 2) return;

    try {
      const cartSnapshot = computeCartSnapshot();
      funnelClient.track('payu_payment_options_viewed', {
        cart: cartSnapshot,
        metadata: {
          paymentMode: paymentModeName,
        },
      });
    } catch (err) {
      console.warn('PayU payment tab analytics failed:', err);
    }
  }, [open, requiresPayuPaymentTab, tabIndex, computeCartSnapshot, paymentModeName]);

  // Sync form values with Redux store when dialog is opened
  useEffect(() => {
    if (open) {
      setValue('name', userDetails.name || '');
      setValue('phoneNumber', userDetails.phoneNumber || '');
      setValue('email', userDetails.email || '');
      setValue('addressLine1', addressDetails.addressLine1 || '');
      // Do not reset areaLocality/floor/landmark here to avoid wiping user input mid-typing
      // If areaLocality is empty but we have addressLine2 from redux, initialize it once
      if (!getValues('areaLocality') && addressDetails.addressLine2) {
        setValue('areaLocality', addressDetails.addressLine2);
      }
      setValue('city', addressDetails.city || '');
      setValue('state', addressDetails.state || '');
      setValue('pincode', addressDetails.pincode || '');
      setValue('country', addressDetails.country || 'India');

      // Pre-validate pincode if it exists
      if (addressDetails.pincode && addressDetails.pincode.length === 6) {
        validatePincode(addressDetails.pincode);
      }
    }
  }, [open, userDetails.name, userDetails.phoneNumber, userDetails.email,
    addressDetails.addressLine1, addressDetails.addressLine2, addressDetails.city,
    addressDetails.state, addressDetails.pincode, addressDetails.country, validatePincode, setValue, getValues]);

  // Handle Prefilled Address (guard against overwriting existing redux address)
  useEffect(() => {
    if (userExists && prefilledAddress) {
      const reduxAddress = addressDetails;
      const isReduxAddressEmpty = !(
        reduxAddress.addressLine1 ||
        reduxAddress.addressLine2 ||
        reduxAddress.city ||
        reduxAddress.state ||
        reduxAddress.pincode ||
        reduxAddress.country
      );

      if (isReduxAddressEmpty) {
        dispatch(setAddressDetails(mapAddressForStore(prefilledAddress)));

        // Using shared extractFloorFromAddressLine1 helper
        // hydrate form values only if the corresponding fields are empty
        if (!getValues('addressLine1') && prefilledAddress.addressLine1) {
          const { base, floor } = extractFloorFromAddressLine1(prefilledAddress.addressLine1);
          setValue('addressLine1', base);
          const struct = prefilledAddress.structured || {};
          if (!getValues('floorInput') && struct.floor === undefined && floor) {
            setValue('floorInput', String(floor));
          }
        }
        // Prefer structured.areaLocality if present, fallback to addressLine2
        const struct = prefilledAddress.structured || {};
        if (!getValues('areaLocality') && (struct.areaLocality || prefilledAddress.addressLine2)) setValue('areaLocality', struct.areaLocality || prefilledAddress.addressLine2);
        if (!getValues('landmark') && struct.landmark) setValue('landmark', struct.landmark);
        if (!getValues('floorInput') && (struct.floor !== undefined)) setValue('floorInput', String(struct.floor));
        if (!getValues('city') && prefilledAddress.city) setValue('city', prefilledAddress.city);
        if (!getValues('state') && prefilledAddress.state) setValue('state', prefilledAddress.state);
        if (!getValues('pincode') && prefilledAddress.pincode) setValue('pincode', prefilledAddress.pincode);
      }
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
  }, [userExists, prefilledAddress, dispatch, addressDetails, validatePincode, setValue, getValues]);

  // Prevent dialog shrinking on mobile keyboard
  useEffect(() => {
    if (!isMobile || !open) return;

    // Force dialog to use visual viewport instead of layout viewport
    const handleViewportChange = () => {
      if (window.visualViewport) {
        const viewport = window.visualViewport;
        const dialogElement = document.querySelector('.MuiDialog-paper');
        if (dialogElement) {
          // Keep dialog at original size regardless of keyboard
          dialogElement.style.position = 'fixed';
          dialogElement.style.top = '50%';
          dialogElement.style.left = '50%';
          dialogElement.style.transform = 'translate(-50%, -50%)';
          dialogElement.style.zIndex = '1300';
          dialogElement.style.width = '90vw';
          dialogElement.style.maxWidth = '500px';
          dialogElement.style.height = '85vh';
          dialogElement.style.maxHeight = '600px';
        }
      }
    };

    // Use visual viewport API if available
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
    }

    // Initial setup
    handleViewportChange();

    // Prevent body scrolling and resizing
    const originalOverflow = document.body.style.overflow;
    const originalPosition = document.body.style.position;
    const originalHeight = document.body.style.height;

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.height = '100vh';
    document.body.style.width = '100vw';

    return () => {
      // Cleanup
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportChange);
      }

      // Restore body styles
      document.body.style.overflow = originalOverflow;
      document.body.style.position = originalPosition;
      document.body.style.height = originalHeight;
      document.body.style.width = '';
    };
  }, [isMobile, open]);



  // Simple focus-based mobile optimization
  useEffect(() => {
    if (!isMobile || !isInputFocused) return;

    // Simple scroll behavior when input is focused on mobile
    const timeoutId = setTimeout(() => {
      const activeElement = document.activeElement;
      if (activeElement && activeElement.tagName === 'INPUT') {
        activeElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });
      }
    }, 300); // Allow time for keyboard to appear

    return () => clearTimeout(timeoutId);
  }, [isMobile, isInputFocused]);

  const handleTabChange = useCallback((newValue) => {
    if (paymentGuardActive) return;
    if (newValue < 0 || newValue >= totalTabs) return;
    setTabIndex(newValue);
  }, [paymentGuardActive, totalTabs]);



  // State for formatted phone number display - memoized
  const [formattedPhone, setFormattedPhone] = useState('');
  const [showPhoneConfirmation, setShowPhoneConfirmation] = useState(false);
  const [originalPhone, setOriginalPhone] = useState('');

  // Function to format phone number - memoized to prevent rerenders
  const formatPhoneNumber = useCallback((phone) => {
    // Keep only digits
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

  const handlePaymentStatusChange = useCallback((status, detail = {}) => {
    logger.debug('Razorpay status update', { status, detail });
    try {
      funnelClient.track('razorpay_modal_status', {
        status,
        orderId: detail?.orderId,
        hasUserActivation: detail?.hasUserActivation,
        visibilityState: detail?.visibilityState,
        paymentStatus: detail?.paymentStatus,
        recovered: detail?.recovered,
        gracePeriodMs: detail?.gracePeriodMs,
      });
    } catch (analyticsErr) {
      logger.debug('Failed to track razorpay status', { error: analyticsErr?.message, status });
    }
  }, []);

  const handleProceedToPayuOptions = useCallback(() => {
    if (!isPincodeValid) {
      showSnackbar('Please confirm a serviceable pincode before choosing payment.', 'warning');
      return;
    }
    if (pincodeCheckInProgress) {
      showSnackbar('Hold on, we are validating your pincode.', 'info');
      return;
    }
    setTabIndex(2);
  }, [isPincodeValid, pincodeCheckInProgress, showSnackbar]);



  // Normalize floor display: avoid duplicating the word 'Floor'
  const formatFloorForAddress = useCallback((value) => {
    if (value === null || value === undefined) return '';
    const t = String(value).trim();
    if (!t) return '';
    if (/^\d+$/.test(t)) return `Floor ${t}`; // pure number => prefix
    if (/\bfloor\b/i.test(t)) return t;      // already contains 'floor'
    return `Floor ${t}`;                       // other strings => prefix
  }, []);

  // UI-only capitalization for display (does not mutate stored values)
  const toTitleCase = useCallback((str) => {
    if (!str || typeof str !== 'string') return str || '';
    return str
      .toLowerCase()
      .replace(/\b([a-z])(\w*)/g, (m, p1, p2) => p1.toUpperCase() + p2);
  }, []);
  const caps = useMemo(() => ({
    line: (s) => toTitleCase(s),
    city: (s) => toTitleCase(s),
    state: (s) => toTitleCase(s),
    area: (s) => toTitleCase(s),
    landmark: (s) => toTitleCase(s),
  }), [toTitleCase]);

  // New function to fully close everything - both OrderForm and CartDrawer
  const handleFullClose = useCallback(() => {
    onClose();
    dispatch(closeAllDialogs());
  }, [dispatch, onClose]);

  // Pre-validate coupon in background as soon as form opens (skip if same signature validated recently)
  const lastCouponValidateKeyRef = useRef('');
  useEffect(() => {
    if (open && couponCode && subTotal > 0) {
      const key = `${couponCode}|${subTotal}|${items.map(i=>`${i.productId}:${i.quantity}`).join(',')}`;
      if (lastCouponValidateKeyRef.current === key) return;
      lastCouponValidateKeyRef.current = key;
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

  // Optimistic user details submission - further optimized
  const onSubmitUserDetails = useCallback(async (data) => {
    const phoneToUse = formatPhoneNumber(data.phoneNumber);

    if (phoneToUse.length !== 10 || !/^\d{10}$/.test(phoneToUse)) {
      showSnackbar('Please enter a valid 10-digit mobile number', 'error');
      return;
    }

    dispatch(
      setUserDetails({
        name: data.name,
        phoneNumber: phoneToUse,
        email: data.email,
      })
    );

    setTabIndex(1);

    const { visitorId: funnelVisitorId, sessionId: funnelSessionId } = funnelClient.getIdentifiers();
    funnelClient.identifyUser({
      name: data.name,
      phoneNumber: phoneToUse,
      email: data.email,
    });

    const cartSnapshot = computeCartSnapshot();

    try {
      funnelClient.track('contact_info', {
        cart: cartSnapshot,
        metadata: {
          form: 'order_form_contact',
          hasEmail: Boolean(data.email),
          transition: 'contact_submit',
        },
      });
    } catch (err) {
      console.warn('Funnel contact_info track failed:', err);
    }

    try {
      const contents = cartItems.map((item) => ({
        productId: item.productId || item._id,
        quantity: item.quantity,
        price: item.price ?? item.productDetails.price,
        brand: item.productDetails?.brand,
        category: item.productDetails?.category?.name || item.productDetails?.category,
        name: item.productDetails?.name,
      }));
      
      // Fire Meta InitiateCheckout event with email/phone for better matching
      try {
        const { v4: uuidv4 } = await import('uuid');
        const numItems = contents.reduce((sum, item) => sum + (item.quantity || 0), 0);
        const contentName = contents.map(c => c.name).filter(Boolean).join(', ');
        
        await trackInitiateCheckout({
          eventID: uuidv4(),
          totalValue: totalCost,
          contents,
          contentName,
          contentCategory: 'checkout',
          numItems,
        }, {
          email: data.email,
          phoneNumber: phoneToUse,
          firstName: data.name,
        });
      } catch (metaErr) {
        console.warn('Meta InitiateCheckout tracking failed (non-critical):', metaErr);
      }
      
      try {
        gaAddBillingInfo({ value: totalCost, items: contents, coupon: typeof couponCode === 'string' && couponCode ? couponCode : undefined });
      } catch (gaErr) {
        if (process.env.NODE_ENV !== 'production') {
          console.debug('gaAddBillingInfo failed', gaErr);
        }
      }
    } catch (err) {
      console.warn('Contact info analytics failed (non-critical):', err);
    }

    pendingOperationsRef.current.userCheck = axios.patch('/api/user/check', {
      phoneNumber: phoneToUse,
      name: data.name,
      email: data.email,
      funnelVisitorId,
      funnelSessionId,
    })
      .then(response => {
        if (response.data.exists) {
          const latestAddress = response.data.latestAddress;
          dispatch(setUserDetails({ userId: response.data.userId }));
          funnelClient.identifyUser({
            userId: response.data.userId,
            phoneNumber: phoneToUse,
            email: data.email,
            name: data.name,
          });

          if (latestAddress) {
            const struct = latestAddress.structured || {};
            const { base: line1Base, floor: floorFromLine1 } = extractFloorFromAddressLine1(latestAddress.addressLine1 || '');
            const mapped = {
              addressLine1: line1Base || '',
              addressLine2: latestAddress.addressLine2 || '',
              city: latestAddress.city || '',
              state: latestAddress.state || '',
              pincode: latestAddress.pincode || '',
              areaLocality: struct.areaLocality || latestAddress.addressLine2 || '',
              landmark: struct.landmark || '',
              floorInput: struct.floor !== undefined ? String(struct.floor) : (floorFromLine1 ? String(floorFromLine1) : ''),
            };

            Object.entries(mapped).forEach(([key, value]) => setValue(key, value || ''));
            dispatch(setAddressDetails(mapAddressForStore(latestAddress)));

            if (latestAddress.pincode && latestAddress.pincode.length === 6) {
              validatePincode(latestAddress.pincode);
            }
          }
        } else {
          return axios.post('/api/user/create', {
            name: data.name,
            phoneNumber: phoneToUse,
            email: data.email,
            source: 'order-form',
            funnelVisitorId,
            funnelSessionId,
          })
            .then(createResponse => {
              const createdUserId = createResponse.data.userId || createResponse.data.user?.userId;
              dispatch(setUserDetails({ userId: createdUserId }));
              funnelClient.identifyUser({
                userId: createdUserId,
                phoneNumber: phoneToUse,
                email: data.email,
                name: data.name,
              });
              return createResponse;
            });
        }
        return response;
      })
      .catch(error => {
        console.error('Error in background user check/create:', error);
      });
  }, [formatPhoneNumber, dispatch, setValue, showSnackbar, validatePincode, computeCartSnapshot, cartItems, totalCost, couponCode]);

  // Optimize address submission with better parallelization
  const onSubmitAddressDetails = useCallback(async (data) => {
    console.log('🔵 onSubmitAddressDetails called with data:', data);
    console.log('🔵 Current orderForm state:', orderForm);
    console.log('🔵 Cart items:', cartItems);
    console.log('🔵 Payment mode config:', paymentModeConfig);
    
    if (purchaseInitiated) {
      console.log('⚠️ Purchase already initiated, returning');
      return;
    }
    if (!paymentModeConfig?._id) {
      console.log('❌ Payment mode config missing');
      showSnackbar('Payment option is still loading. Please pick one to continue.', 'warning');
      return;
    }

    console.log('✅ Starting order creation process...');
    setPurchaseInitiated(true);
    setIsLoading(true);
    setIsPaymentProcessing(true);
    const cartSnapshot = computeCartSnapshot();
    const numericTotal = Number(totalCost);
    const orderValue = Number.isFinite(numericTotal) ? numericTotal : undefined;
    const totalForPurchase = Number.isFinite(numericTotal) ? numericTotal : 0;
    const analyticsItems = cartItems.map((item) => ({
      productId: item.productId || item._id,
      name: item.productDetails?.name,
      quantity: item.quantity,
      price: item.priceAtPurchase || item.productDetails?.price,
      sku: item.productDetails?.selectedOption?.sku || item.productDetails?.sku,
    }));
    const addressCompleteness = {
      hasLine1: Boolean(data.addressLine1),
      hasCity: Boolean(data.city),
      hasState: Boolean(data.state),
      hasPincode: Boolean(data.pincode),
    };

    try {
      try {
        funnelClient.track('initiate_checkout', {
          cart: cartSnapshot,
          order: {
            value: orderValue,
            currency: orderValue !== undefined ? 'INR' : undefined,
            coupon: normalizedCouponCode,
          },
          metadata: {
            form: 'order_form_address',
            paymentMode: paymentModeName,
            couponApplied: Boolean(normalizedCouponCode),
            addressCompleteness,
            geoCaptured: Boolean(geo?.lat && geo?.lng),
          },
        });
      } catch (err) {
        console.warn('Funnel initiate_checkout track failed:', err);
      }

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

      // Skip coupon validation while form is open

      if (pendingOperationsRef.current.userCheck) {
        initialValidationPromises.push(pendingOperationsRef.current.userCheck);
      }

      const composedAddressLine1 = [
        data.addressLine1,
        formatFloorForAddress(data.floorInput)
      ].filter(Boolean).join(', ');
      const composedAddressLine2 = [data.areaLocality, data.landmark]
        .filter(Boolean)
        .join(', ');

      const floorRaw = (data.floorInput || '').toString().trim();
      let floorParsed = undefined;
      if (floorRaw) {
        const match = floorRaw.match(/\d+/);
        floorParsed = match ? Number(match[0]) : floorRaw;
      }

      const addAddressPayload = {
        phoneNumber: orderForm.userDetails.phoneNumber,
        address: {
          receiverName: orderForm.userDetails.name || '',
          receiverPhoneNumber: orderForm.userDetails.phoneNumber,
          addressLine1: composedAddressLine1,
          addressLine2: composedAddressLine2,
          city: data.city,
          state: data.state,
          pincode: data.pincode,
          country: data.country || 'India',
          areaLocality: data.areaLocality,
          landmark: data.landmark,
          floor: (typeof floorParsed !== 'undefined') ? floorParsed : undefined,
          geo: geo,
          ...orderForm.extraFields,
        },
      };

      const addressAddPromise = axios.post('/api/user/add-address', addAddressPayload)
        .then(response => {
          if (response.data.message === 'Address added successfully.' ||
            response.data.message === 'Using existing address.') {
            dispatch(setAddressDetails(mapAddressForStore(response.data.latestAddress)));
          }
          return response.data;
        }).catch(error => {
          console.error('Error during address addition (in parallel task):', error);
          throw new Error(error.response?.data?.message || 'Failed to update address details.');
        });

      if (initialValidationPromises.length > 0) {
        await Promise.all(initialValidationPromises).catch(error => {
          throw error;
        });
      }

      // Capture fresh client-side tracking data for analytics
      let trackingMetadata = null;
      try {
        trackingMetadata = await captureClientTrackingData();
      } catch (trackingError) {
        // Continue with order creation even if tracking fails
        console.warn('[OrderForm] Tracking capture failed:', trackingError.message);
      }

      // Note: payuSession is not sent for merchant-hosted checkout (merchant selects method in PaymentDialog)
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
          addressLine1: composedAddressLine1,
          addressLine2: composedAddressLine2,
          city: data.city,
          state: data.state,
          pincode: data.pincode,
          country: data.country || 'India',
          geo: geo,
        },
        totalAmount: totalCost,
        discountAmount: discountAmountFinal || 0,
        couponCode: couponsDetails?.couponCode || '',
        extraChargesPayload: {
          mopCharges: paymentModeConfig.extraCharge || 0,
          deliveryCharges: deliveryCost || 0,
        },
        utmDetails: utmDetails.utmDetails || null,
        utmHistory: utmDetails.utmHistory || [],
        extraFields: {
          ...orderForm.extraFields,
          geo,
          areaLocality: data.areaLocality,
          landmark: data.landmark,
          ...(floorParsed !== undefined ? { floor: floorParsed } : {}),
        },
        analyticsInfo: trackingMetadata, // Fresh client-side tracking data captured above
      };

      console.log('🔄 Sending order creation request with payload:', finalOrderPayload);
      
      const [orderCreationResponse] = await Promise.all([
        axios.post('/api/checkout/order/create', finalOrderPayload),
        addressAddPromise
      ]);

      console.log('✅ Order creation response received:', orderCreationResponse.data);

      const {
        orderId: createdOrderId,
        razorpayOrder,
        payuSession,
        paymentProvider: serverPaymentProvider,
        amountDueOnline
      } = orderCreationResponse.data;

      if (!createdOrderId) {
        console.log('❌ No order ID in response!');
        throw new Error('Order creation failed - no order ID received');
      }

      console.log('✅ Order created successfully with ID:', createdOrderId);
      console.log('📝 Razorpay order from response:', razorpayOrder);
      console.log('📝 Dispatching setLastOrderId to Redux...');
      dispatch(setLastOrderId(createdOrderId));
      
      // Also store the razorpayOrder details in a ref for later use
      if (razorpayOrder) {
        console.log('💾 Storing Razorpay order for later use');
        window.sessionStorage.setItem(`razorpay_order_${createdOrderId}`, JSON.stringify({
          id: razorpayOrder.id,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency || 'INR',
        }));
      }
      
      console.log('✅ Moving to payment tab (index 2)');
      // Just move to payment tab - user will choose payment method there
      setIsLoading(false);
      setPurchaseInitiated(false);
      setTabIndex(2); // Move to payment tab

    } catch (error) {
      console.log('❌ ERROR during order creation:', error);
      console.log('❌ Error response:', error.response?.data);
      console.log('❌ Error message:', error.message);
      console.log('❌ Full error object:', error);
      const errorMessage = error.response?.data?.message || error.message || 'An error occurred. Please try again.';
      showSnackbar(errorMessage, 'error');
      // Don't move to payment tab if order creation failed
    } finally {
      console.log('🔵 Order creation process completed (finally block)');
      setIsLoading(false);
      setIsPaymentProcessing(false);
      setPurchaseInitiated(false);
    }
  }, [purchaseInitiated, computeCartSnapshot, cartItems, totalCost, normalizedCouponCode, paymentModeName,
    dispatch, showSnackbar, isPincodeValid, serviceabilityCache, orderForm,
    formatFloorForAddress, geo, paymentModeConfig, discountAmountFinal, couponsDetails, deliveryCost,
  utmDetails]);

  const fetchOrCreateRazorpayOrder = useCallback(async () => {
    if (!lastOrderId) {
      throw new Error('Order not created yet. Please go back and complete shipping details.');
    }

    console.log('🔍 Ensuring Razorpay order details for:', lastOrderId);
    const orderResponse = await axios.get(`/api/order/${lastOrderId}`);
    const order = orderResponse.data.order || orderResponse.data || {};
    const amountDueOnline = order.paymentDetails?.amountDueOnline ?? order.totalAmount ?? 0;
    const normalizedAmount = Number(amountDueOnline) || 0;
    const amountPaise = Math.max(1, Math.floor(normalizedAmount * 100));
    const razorpayDetails = order.paymentDetails?.razorpayDetails;
    let razorpayOrderToUse = razorpayDetails?.orderId
      ? {
          id: razorpayDetails.orderId,
          amount: amountPaise,
          currency: 'INR',
        }
      : null;

    const sessionKey = `razorpay_order_${lastOrderId}`;

    if (!razorpayOrderToUse && typeof window !== 'undefined') {
      const cachedOrder = window.sessionStorage.getItem(sessionKey);
      if (cachedOrder) {
        razorpayOrderToUse = JSON.parse(cachedOrder);
      }
    }

    if (!razorpayOrderToUse) {
      console.log('🔄 Creating Razorpay order via API...');
      const createResponse = await axios.post('/api/payments/razorpay/create-order', {
        orderId: lastOrderId,
      });
      razorpayOrderToUse = {
        id: createResponse.data.razorpayOrderId,
        amount: Math.floor(createResponse.data.amount * 100),
        currency: 'INR',
      };

      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(sessionKey, JSON.stringify(razorpayOrderToUse));
      }
    }

    if (!razorpayOrderToUse) {
      throw new Error('Payment details not found. Please try again or contact support.');
    }

    return razorpayOrderToUse;
  }, [lastOrderId]);

  const initiateRazorpayPayment = useCallback(async ({ hideUpi = false, upiOnly = false, paymentContext = 'other' } = {}) => {
    console.log('🟣 initiateRazorpayPayment called', { hideUpi, upiOnly, paymentContext, lastOrderId });

    if (!lastOrderId) {
      showSnackbar('Order not created yet. Please go back and complete shipping details.', 'error');
      setTabIndex(1);
      return;
    }

    if (upiOnly) {
      setSelectedPaymentMethod('upi');
      setUpiPaymentState('processing');
    } else {
      setSelectedPaymentMethod('other');
    }

    setIsPaymentProcessing(true);

    try {
      const razorpayOrderToUse = await fetchOrCreateRazorpayOrder();
      await ensureRazorpayLoaded();
      console.log('✅ Razorpay SDK loaded, opening payment modal...');

      const paymentResult = await makePayment({
        customerName,
        customerMobile: customerPhone,
        orderId: lastOrderId,
        razorpayOrder: razorpayOrderToUse,
        onStatusChange: handlePaymentStatusChange,
        hideUpi,
        upiOnly,
      });

      if (paymentResult.cancelled) {
        setIsPaymentProcessing(false);
        if (upiOnly) {
          setUpiPaymentState('idle');
        }
        if (paymentResult.pendingVerification) {
          showSnackbar('Waiting for payment confirmation. You can retry if needed.', 'info');
        } else {
          showSnackbar('Payment was cancelled.', 'warning');
        }
        return;
      }

      showSnackbar('Payment Successful!', 'success');

      if (!process.env.NEXT_PUBLIC_isTestingOrder) dispatch(clearCart());
      dispatch(resetOrderForm());
      reset();
      handleFullClose();
      
      setTimeout(() => {
        router.push(`/orders/myorder/${lastOrderId}`);
      }, 500);
    } catch (error) {
      console.error('Razorpay payment failed:', error);
      setIsPaymentProcessing(false);
      if (upiOnly) {
        setUpiPaymentState('failed');
      }
      showSnackbar(error.message || 'Payment failed. Please try again.', 'error');
    }
  }, [lastOrderId, customerName, customerPhone, fetchOrCreateRazorpayOrder, handlePaymentStatusChange, dispatch, reset, handleFullClose, router, showSnackbar]);

  // NEW: Handle UPI payment with PayU S2S on mobile, Razorpay UPI elsewhere
  const handlePayWithUPI = useCallback(async () => {
    console.log('🟢 handlePayWithUPI called');
    console.log('🟢 Current orderForm.lastOrderId:', lastOrderId);
    
    if (!lastOrderId) {
      console.log('❌ No lastOrderId found! Sending back to address tab');
      showSnackbar('Order not created yet. Please go back and complete shipping details.', 'error');
      setTabIndex(1); // Go back to address tab
      return;
    }

    // Detect iOS devices (iPhone, iPad, iPod)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    // Use Razorpay UPI collect for desktop or iOS devices
    if (!isMobile || isIOS) {
      await initiateRazorpayPayment({ upiOnly: true, paymentContext: isIOS ? 'upi-ios' : 'upi-desktop' });
      return;
    }

    // Prevent multiple simultaneous payment attempts
    if (isPaymentProcessing || upiPaymentState === 'processing' || upiPaymentState === 'waiting') {
      console.log('⚠️ Payment already in progress');
      showSnackbar('Payment already in progress', 'warning');
      return;
    }

    console.log('✅ Order ID exists, proceeding with UPI payment');

    // Track payment_initiated funnel event
    try {
      funnelClient.track('payment_initiated', {
        dedupeKey: `payment_initiated:${lastOrderId}:upi`,
        cart: computeCartSnapshot(),
        order: {
          orderId: lastOrderId,
          value: totalCost,
          currency: 'INR',
          coupon: normalizedCouponCode,
        },
        metadata: {
          paymentMethod: 'upi',
          paymentProvider: isMobile ? 'payu' : 'razorpay',
          amountDueOnline: payuOnlineAmount,
        },
      });
    } catch (err) {
      console.warn('Funnel payment_initiated track failed:', err);
    }

    // Track Meta paymentInitiated event
    try {
      const contents = cartItems.map((item) => ({
        productId: item.productId || item._id,
        quantity: item.quantity,
        price: item.priceAtPurchase || item.productDetails?.price,
        brand: item.productDetails?.brand,
        category: item.productDetails?.category?.name || item.productDetails?.category,
        name: item.productDetails?.name,
      }));
      const isSplitPayment = !!(paymentModeConfig?.configuration?.onlinePercentage > 0 && paymentModeConfig?.configuration?.onlinePercentage < 100);
      paymentInitiated({
        value: totalCost,
        amount_due_online: payuOnlineAmount,
        payment_mode: paymentModeName,
        payment_mode_id: paymentModeConfig?._id,
        is_split_payment: isSplitPayment,
        contents,
        numItems: contents.length,
        contentName: contents.map((c) => c.name).filter(Boolean).join(', '),
        orderId: lastOrderId,
      }, {
        email: orderForm.userDetails?.email || '',
        phoneNumber: orderForm.userDetails?.phoneNumber,
      });
    } catch (err) {
      console.warn('Payment initiated analytics failed (non-critical):', err);
    }

    // Track Google Analytics add_payment_info event
    try {
      const gaContents = cartItems.map((item) => ({
        productId: item.productId || item._id,
        quantity: item.quantity,
        price: item.priceAtPurchase || item.productDetails?.price,
        brand: item.productDetails?.brand,
        category: item.productDetails?.category?.name || item.productDetails?.category,
        name: item.productDetails?.name,
      }));
      gaAddPaymentInfo({
        value: payuOnlineAmount || totalCost,
        items: gaContents,
        payment_type: 'upi',
        coupon: normalizedCouponCode || undefined,
      });
    } catch (gaErr) {
      if (process.env.NODE_ENV !== 'production') {
        console.debug('gaAddPaymentInfo failed', gaErr);
      }
    }

    setSelectedPaymentMethod('upi');
    setUpiPaymentState('processing');
    setIsPaymentProcessing(true);

    try {
      console.log('🔄 Calling PayU seamless UPI API...');
      // Call PayU seamless UPI API for intent
      const response = await axios.post('/api/payments/payu/seamless/upi', {
        orderId: lastOrderId,
        mode: 'intent',
      });
      console.log('✅ PayU UPI response:', response.data);

      const { intentUrl, txnId } = response.data;
      
      if (!intentUrl || !txnId) {
        throw new Error('Invalid response from payment gateway');
      }
      
      setCurrentTxnId(txnId);
      setUpiIntentUrl(intentUrl);

      if (intentUrl) {
        // Launch UPI intent
        setUpiPaymentState('waiting');
        console.log('🔄 Launching UPI intent:', intentUrl);
        
        // Try to open UPI app
        try {
          if (/android/i.test(navigator.userAgent)) {
            window.location.href = intentUrl;
          } else {
            // Fallback for non-Android
            const anchor = document.createElement('a');
            anchor.href = intentUrl;
            anchor.style.display = 'none';
            document.body.appendChild(anchor);
            anchor.click();
            setTimeout(() => anchor.remove(), 100);
          }
          console.log('✅ UPI intent launched');
        } catch (launchError) {
          console.error('❌ Failed to launch UPI intent:', launchError);
          throw new Error('Failed to open UPI app. Please try again.');
        }

        // Start polling for payment status
        let pollCount = 0;
        const maxPolls = 60; // 5 minutes
        const pollInterval = 5000; // 5 seconds

        console.log('🔄 Starting payment verification polling...');
        pollingIntervalRef.current = setInterval(async () => {
          pollCount++;
          console.log(`🔄 Poll attempt ${pollCount}/${maxPolls}`);

          try {
            const verifyRes = await axios.post('/api/payments/payu/verify', {
              txnIds: [txnId],
            });

            const txnData = verifyRes.data?.transaction_details?.[txnId];
            console.log('📊 Transaction data:', txnData);
            
            if (txnData) {
              const status = (txnData.status || '').toLowerCase();
              console.log('💳 Payment status:', status);

              if (status === 'success') {
                console.log('✅ Payment successful!');
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
                setUpiPaymentState('success');
                showSnackbar('Payment Successful! Redirecting...', 'success');
                
                // Clear cart and redirect
                if (!process.env.NEXT_PUBLIC_isTestingOrder) dispatch(clearCart());
                dispatch(resetOrderForm());
                reset();
                handleFullClose();
                
                setTimeout(() => {
                  router.push(`/orders/myorder/${lastOrderId}`);
                }, 500);
              } else if (status === 'failed' || status === 'failure') {
                console.log('❌ Payment failed');
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
                setUpiPaymentState('failed');
                setIsPaymentProcessing(false);
                showSnackbar('Payment failed. Please try again.', 'error');
              }
            }

            // Timeout after max polls
            if (pollCount >= maxPolls) {
              console.log('⏱️ Polling timeout reached');
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
              setUpiPaymentState('failed');
              setIsPaymentProcessing(false);
              showSnackbar('Payment verification timeout. Please check your order status or try again.', 'warning');
            }
          } catch (pollError) {
            console.error('❌ Payment polling error:', pollError);
            // Don't stop polling on single error, might be network issue
            if (pollCount >= 3) {
              // After 3 failed polls, show warning but continue
              console.warn('⚠️ Multiple polling failures detected');
            }
          }
        }, pollInterval);

      } else {
        throw new Error('Failed to generate UPI intent link');
      }
    } catch (error) {
      console.error('UPI payment failed:', error);
      setUpiPaymentState('failed');
      setIsPaymentProcessing(false);
      showSnackbar(error.response?.data?.error || 'Failed to initiate UPI payment', 'error');
    }
  }, [lastOrderId, showSnackbar, dispatch, reset, handleFullClose, router, isMobile, initiateRazorpayPayment, isPaymentProcessing, upiPaymentState, computeCartSnapshot, totalCost, normalizedCouponCode, payuOnlineAmount, cartItems, paymentModeName, orderForm.userDetails, paymentModeConfig]);

  // NEW: Handle other payment methods (Razorpay)
  const handlePayWithOther = useCallback(() => {
    // Track payment_initiated funnel event
    try {
      funnelClient.track('payment_initiated', {
        dedupeKey: `payment_initiated:${lastOrderId}:other`,
        cart: computeCartSnapshot(),
        order: {
          orderId: lastOrderId,
          value: totalCost,
          currency: 'INR',
          coupon: normalizedCouponCode,
        },
        metadata: {
          paymentMethod: 'card_netbanking_wallet',
          paymentProvider: 'razorpay',
          amountDueOnline: payuOnlineAmount,
        },
      });
    } catch (err) {
      console.warn('Funnel payment_initiated track failed:', err);
    }

    // Track Meta paymentInitiated event
    try {
      const contents = cartItems.map((item) => ({
        productId: item.productId || item._id,
        quantity: item.quantity,
        price: item.priceAtPurchase || item.productDetails?.price,
        brand: item.productDetails?.brand,
        category: item.productDetails?.category?.name || item.productDetails?.category,
        name: item.productDetails?.name,
      }));
      const isSplitPayment = !!(paymentModeConfig?.configuration?.onlinePercentage > 0 && paymentModeConfig?.configuration?.onlinePercentage < 100);
      paymentInitiated({
        value: totalCost,
        amount_due_online: payuOnlineAmount,
        payment_mode: paymentModeName,
        payment_mode_id: paymentModeConfig?._id,
        is_split_payment: isSplitPayment,
        contents,
        numItems: contents.length,
        contentName: contents.map((c) => c.name).filter(Boolean).join(', '),
        orderId: lastOrderId,
      }, {
        email: orderForm.userDetails?.email || '',
        phoneNumber: orderForm.userDetails?.phoneNumber,
      });
    } catch (err) {
      console.warn('Payment initiated analytics failed (non-critical):', err);
    }

    // Track Google Analytics add_payment_info event
    try {
      const gaContents = cartItems.map((item) => ({
        productId: item.productId || item._id,
        quantity: item.quantity,
        price: item.priceAtPurchase || item.productDetails?.price,
        brand: item.productDetails?.brand,
        category: item.productDetails?.category?.name || item.productDetails?.category,
        name: item.productDetails?.name,
      }));
      gaAddPaymentInfo({
        value: payuOnlineAmount || totalCost,
        items: gaContents,
        payment_type: paymentModeName || 'card_netbanking_wallet',
        coupon: normalizedCouponCode || undefined,
      });
    } catch (gaErr) {
      if (process.env.NODE_ENV !== 'production') {
        console.debug('gaAddPaymentInfo failed', gaErr);
      }
    }

    initiateRazorpayPayment({ hideUpi: true, paymentContext: 'other' });
  }, [initiateRazorpayPayment, lastOrderId, computeCartSnapshot, totalCost, normalizedCouponCode, payuOnlineAmount, cartItems, paymentModeName, orderForm.userDetails, paymentModeConfig]);

  const currentSubmitHandler = useMemo(() => {
    if (tabIndex === 0) return onSubmitUserDetails;
    if (tabIndex === 1) return onSubmitAddressDetails; // Create order and move to payment tab
    return null; // No submit on payment tab - use buttons
  }, [tabIndex, onSubmitUserDetails, onSubmitAddressDetails]);

  // Handle dialog close (prevent closing during payment)
  const handleClose = useCallback(() => {
    if (paymentGuardActive) {
      showSnackbar('Please wait for payment to complete or cancel it first', 'warning');
      return;
    }

    // if on shipping tab (index 1), go back to user details (index 0)
    if (tabIndex === 1) {
      setTabIndex(0);
    } else {
      // otherwise close the dialog
      onClose();
    }
  }, [paymentGuardActive, onClose, tabIndex, showSnackbar]);



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

  // Custom styled text field component with memoization to prevent rerenders
  const StyledTextField = useCallback(({ field, label, error, helperText, disabled, onChange, onBlur: onBlurProp, type = "text", maxWidth, InputProps, placeholder }) => (
    <TextField
      variant="outlined"
      size="small"
      {...field}
      label={label}
      placeholder={placeholder}
      fullWidth
      type={type}
      error={!!error}
      helperText={helperText}
      disabled={disabled}
      onChange={onChange}
      onFocus={() => isMobile && setIsInputFocused(true)}
      onBlur={(e) => {
        if (onBlurProp) onBlurProp(e);
        if (isMobile) setIsInputFocused(false);
      }}
      InputLabelProps={{
        style: {
          fontFamily: 'Jost, sans-serif',
          fontSize: '0.72rem',
        },
      }}
      InputProps={{
        ...InputProps,
        style: {
          fontFamily: 'Jost, sans-serif',
          fontSize: '0.78rem',
          height: '34px',
          ...(InputProps?.style || {})
        }
      }}
      sx={{
        maxWidth: maxWidth,
        '& .MuiOutlinedInput-root': {
          borderRadius: '8px',
          '&:hover': {
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: '#aaa',
            }
          },
          '&.Mui-focused': {
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: '#2d2d2d',
              borderWidth: '1.5px',
            }
          }
        },
        '& .MuiInputLabel-shrink': {
          transform: 'translate(14px, -9px) scale(0.75)',
        },
        '& .MuiFormHelperText-root': {
          fontSize: '0.65rem',
          marginTop: '2px',
        }
      }}
    />
  ), [isMobile]);


  return (
    <ThemeProvider theme={theme}>
      <Dialog
        open={open}
        onClose={(event) => {
          event?.preventDefault?.();
          handleClose();
        }}
        maxWidth="sm"
        fullWidth
        disableEscapeKeyDown={paymentGuardActive}
        BackdropProps={{
          sx: {
            backgroundColor: 'rgba(0,0,0,0.65)',
            cursor: paymentGuardActive ? 'not-allowed' : 'pointer',
          },
          onClick: paymentGuardActive
            ? (event) => {
                event.stopPropagation();
              }
            : undefined,
        }}
        PaperProps={{
          sx: {
            borderRadius: '1.5rem',
            overflow: 'hidden',
            // Force fixed positioning and dimensions to prevent keyboard shrinking
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: { xs: '90vw', sm: '500px' },
            maxWidth: '500px',
            height: '85vh',
            maxHeight: '90vh',
            margin: 0,
            // Ensure minimum height on mobile to prevent shrinking
            minHeight: isMobile ? '500px' : 'auto',
            // Responsive height for very short screens
            '@media (max-height: 550px)': {
              height: '90vh',
              minHeight: '90vh',
            },
          },
        }}
      >
        <DialogContent
          sx={{
            padding: { xs: '0.8rem', md: '1.5rem' }, // Reduced padding on mobile
            paddingTop: { xs: '0.4rem', md: '1.2rem' }, // Reduced top padding on mobile
            background: 'linear-gradient(to bottom, #f9f9f9, #ffffff)',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflow: 'hidden',
            // Remove minHeight to prevent footer from growing
            // minHeight: isMobile ? '420px' : 'auto',
            ...(isMobile && {
              height: '100%',
              maxHeight: 'none',
            }),
          }}
        >
          {/* Logo and Stepper */}
          <Box sx={{
            position: 'relative',
            mb: { xs: 0, sm: 0.5 }, // No margin on mobile
            flexShrink: 0,
          }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, type: 'spring', stiffness: 200 }}
            >
              <Image
                loading="eager"
                src={`${baseImageUrl}/assets/logos/md_nothing_else.png`}
                width={isMobile ? 35 : 60} // Even smaller on mobile
                height={isMobile ? 35 : 60}
                alt="Logo"
                style={{
                  width: isMobile ? '35px' : '60px',
                  height: 'auto',
                  margin: '0 auto',
                  display: 'block',
                }}
              />
            </motion.div>

            {/* Custom Stepper */}
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                mt: { xs: 0.5, sm: 1.5 },
                position: 'relative',
                minHeight: { xs: '20px', sm: '30px' },
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: { xs: 1, sm: 1.5 },
                }}
              >
                {stepTitles.map((_, index) => {
                  const isActive = tabIndex === index;
                  const isCompleted = tabIndex > index;
                  return (
                    <React.Fragment key={`step-${index}`}>
                      {index > 0 && (
                        <Box
                          sx={{
                            width: { xs: '28px', sm: '40px' },
                            height: '2px',
                            backgroundColor: tabIndex >= index ? '#000' : '#e0e0e0',
                            transition: 'background-color 0.3s',
                          }}
                        />
                      )}
                      <motion.div
                        animate={{ scale: isActive ? 1.1 : 0.95 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                      >
                        <Box
                          sx={{
                            width: { xs: '20px', sm: '24px' },
                            height: { xs: '20px', sm: '24px' },
                            borderRadius: '50%',
                            backgroundColor: isActive ? '#000' : (isCompleted ? '#555' : '#e0e0e0'),
                            color: isActive || isCompleted ? 'white' : '#999',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            fontFamily: 'Jost, sans-serif',
                            fontWeight: 600,
                            fontSize: { xs: '0.7rem', sm: '0.8rem' },
                            boxShadow: isActive ? '0 0 0 4px rgba(0,0,0,0.1)' : 'none',
                            cursor: isCompleted && !paymentGuardActive ? 'pointer' : 'default'
                          }}
                          onClick={() => {
                            if (isCompleted && !paymentGuardActive) handleTabChange(index);
                          }}
                        >
                          {index + 1}
                        </Box>
                      </motion.div>
                    </React.Fragment>
                  );
                })}
              </Box>
            </Box>

            {/* Title - Hidden on small/short mobile screens */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              sx={{
                display: {
                  xs: 'none', // Hide on extra small screens
                  sm: 'block', // Show on small screens and up
                  '@media (max-height: 600px)': {
                    display: 'none', // Hide on short viewports regardless of width
                  },
                },
              }}
            >
              <Typography
                variant="h6"
                align="center"
                sx={{
                  mt: 0.5,
                  mb: 1,
                  fontFamily: 'Jost, sans-serif',
                  fontWeight: 500,
                  fontSize: '1rem',
                  color: '#333',
                }}
              >
                {stepTitles[tabIndex] || stepTitles[stepTitles.length - 1]}
              </Typography>
            </motion.div>

            {tabIndex > 0 && (
              <Box
                onClick={() => {
                  if (!paymentGuardActive) handleTabChange(tabIndex - 1);
                }}
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
            onSubmit={handleSubmit(currentSubmitHandler)}
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
                '&::-webkit-scrollbar': { display: 'none' },
                msOverflowStyle: 'none',
                scrollbarWidth: 'none',
                pb: '2rem',
                // Use flexible height instead of fixed height to fill available space
                ...(isMobile && {
                  flex: 1, // Take up remaining space
                  minHeight: '200px', // Minimum to ensure usability
                  // Remove fixed height constraints
                }),
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
                    style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}
                  >
                    <Box sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '20px',
                      width: '100%',
                      flex: 1,
                      justifyContent: 'center',
                      px: { xs: 0.5, sm: 1 },
                      pb: 4,
                    }}>
                      {/* Friendly greeting */}
                      {/* <Box sx={{ textAlign: 'center', mb: 1 }}>
                        <Typography sx={{ 
                          fontSize: '2rem', 
                          mb: 0.5,
                          lineHeight: 1
                        }}>
                          👋
                        </Typography>
                        <Typography sx={{ 
                          fontFamily: 'Jost, sans-serif',
                          fontSize: '0.8rem',
                          color: '#666',
                          fontWeight: 400
                        }}>
                          Just a few details
                        </Typography>
                      </Box> */}

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
                              disabled={isLoading || isPaymentProcessing}
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

                      {/* Removed Button from here, will be in fixed footer */}
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
                    <Box sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '20px',
                      paddingTop: '0.25rem',
                      px: { xs: 0.5, sm: 1 },
                    }}>
                      {/* Quick Fill - Current Location button */}
                      <Box 
                        sx={{ 
                          display: 'flex', 
                          justifyContent: 'center',
                          mb: '8px'
                        }}
                      >
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={isLocating ? <CircularProgress size={14} sx={{ color: '#555' }} /> : <MyLocationIcon sx={{ fontSize: '1rem' }} />}
                          disabled={isLocating}
                          onClick={() => {
                            if (!navigator.geolocation) return;
                            setIsLocating(true);
                            navigator.geolocation.getCurrentPosition((pos) => {
                              const lat = pos.coords.latitude;
                              const lng = pos.coords.longitude;
                              setGeo({ lat, lng });
                              reverseGeocodeClient(lat, lng)
                                .then(addr => {
                                  if (addr?.pincode) {
                                    setValue('pincode', addr.pincode);
                                    dispatch(setAddressDetails({ pincode: addr.pincode }));
                                  }
                                  if (addr?.city) {
                                    setValue('city', addr.city);
                                    dispatch(setAddressDetails({ city: addr.city }));
                                  }
                                  if (addr?.state) {
                                    setValue('state', addr.state);
                                    dispatch(setAddressDetails({ state: addr.state }));
                                  }
                                  if (addr?.areaLocality && !getValues('areaLocality')) {
                                    setValue('areaLocality', addr.areaLocality);
                                    dispatch(setAddressDetails({ addressLine2: addr.areaLocality }));
                                  }
                                  if ((addr?.houseNumber || addr?.road) && !getValues('addressLine1')) {
                                    const part = [addr.houseNumber, addr.road].filter(Boolean).join(', ');
                                    setValue('addressLine1', part);
                                    dispatch(setAddressDetails({ addressLine1: part }));
                                  }
                                  if (addr?.poi && !getValues('landmark')) {
                                    setValue('landmark', addr.poi);
                                  }
                                  showSnackbar('Address auto-filled!', 'success');
                                })
                                .catch(() => showSnackbar('Could not auto-fill. Please enter manually.', 'warning'))
                                .finally(() => setIsLocating(false));
                            }, () => { setIsLocating(false); showSnackbar('Location permission needed.', 'warning'); }, { enableHighAccuracy: true, timeout: 10000 });
                          }}
                          sx={{
                            borderColor: '#ddd',
                            color: '#444',
                            textTransform: 'none',
                            fontFamily: 'Jost, sans-serif',
                            fontWeight: 500,
                            fontSize: '0.8rem',
                            borderRadius: '20px',
                            px: 2,
                            py: 0.6,
                            '&:hover': {
                              borderColor: '#bbb',
                              backgroundColor: '#fafafa'
                            }
                          }}
                        >
                          {isLocating ? 'Locating...' : 'Use Current Location'}
                        </Button>
                      </Box>

                      {/* Pincode and City in same row */}
                      <Box sx={{ display: 'flex', gap: '10px', width: '100%' }}>
                        <Box sx={{ flex: '0 0 40%' }}>
                          <Controller
                            name="pincode"
                            control={control}
                            rules={{
                              required: 'Required',
                              pattern: {
                                value: /^\d{6}$/,
                                message: '6 digits',
                              },
                            }}
                            render={({ field }) => (
                              <StyledTextField
                                field={field}
                                label="Pincode"
                                error={errors.pincode}
                                disabled={isLoading || isPaymentProcessing}
                                onChange={(e) => {
                                  field.onChange(e);
                                }}
                                onBlur={(e) => dispatch(setAddressDetails({ pincode: e.target.value }))}
                                type="tel"
                                maxWidth="100%"
                              />
                            )}
                          />
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Controller
                            name="city"
                            control={control}
                            rules={{ required: 'City required' }}
                            render={({ field }) => (
                              <StyledTextField
                                field={field}
                                label="City"
                                error={errors.city}
                                helperText={errors.city ? errors.city.message : ''}
                                disabled={isLoading || isPaymentProcessing}
                                onChange={(e) => {
                                  field.onChange(e);
                                }}
                                onBlur={(e) => dispatch(setAddressDetails({ city: e.target.value }))}
                                InputProps={{ style: { textTransform: 'capitalize' } }}
                              />
                            )}
                          />
                        </Box>
                      </Box>

                      {/* State selector */}
                      <Controller
                        name="state"
                        control={control}
                        rules={{ required: 'State is required' }}
                        render={({ field }) => (
                          <Autocomplete
                            options={indianStates}
                            getOptionLabel={(option) => option}
                            value={field.value || ''}
                            onChange={(event, newValue) => {
                              field.onChange(newValue);
                              dispatch(setAddressDetails({ state: newValue }));
                            }}
                            disableClearable
                            slotProps={{
                              paper: {
                                sx: {
                                  '& .MuiAutocomplete-listbox': {
                                    p: 0,
                                    '& .MuiAutocomplete-option': {
                                      fontSize: '0.75rem',
                                      minHeight: '26px',
                                      py: 0.25
                                    }
                                  }
                                }
                              }
                            }}
                            sx={{
                              '& .MuiInputBase-root': {
                                height: 34,
                              },
                              '& .MuiOutlinedInput-root': {
                                borderRadius: '8px',
                                minHeight: '34px',
                                paddingTop: 0,
                                paddingBottom: 0,
                              },
                              '& .MuiAutocomplete-inputRoot': {
                                paddingTop: '2px',
                                paddingBottom: '2px',
                              },
                              '& .MuiAutocomplete-input': {
                                fontFamily: 'Jost, sans-serif',
                                fontSize: '0.78rem',
                                padding: '4px 4px !important',
                              },
                            }}
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                size="small"
                                label="State"
                                error={!!errors.state}
                                variant="outlined"
                                InputLabelProps={{
                                  style: {
                                    fontFamily: 'Jost, sans-serif',
                                    fontSize: '0.72rem',
                                  },
                                }}
                                InputProps={{
                                  ...params.InputProps,
                                  style: {
                                    fontFamily: 'Jost, sans-serif',
                                    fontSize: '0.78rem',
                                    textTransform: 'capitalize'
                                  },
                                }}
                                sx={{
                                  '& .MuiFormHelperText-root': {
                                    fontSize: '0.65rem',
                                    marginTop: '2px',
                                  }
                                }}
                              />
                            )}
                            disabled={isLoading || isPaymentProcessing}
                          />
                        )}
                      />

                      {/* House/Flat Details */}
                      <Controller
                        name="addressLine1"
                        control={control}
                        rules={{ required: 'Address is required' }}
                        render={({ field }) => (
                          <StyledTextField
                            field={field}
                            label="Flat / House no. / Building"
                            error={errors.addressLine1}
                            helperText={errors.addressLine1 ? errors.addressLine1.message : ''}
                            disabled={isLoading || isPaymentProcessing}
                            onChange={(e) => {
                              field.onChange(e);
                            }}
                            onBlur={(e) => {
                              const base = e.target.value;
                              const floor = getValues('floorInput');
                              const composed = [base, formatFloorForAddress(floor)].filter(Boolean).join(', ');
                              dispatch(setAddressDetails({ addressLine1: composed }));
                            }}
                            InputProps={{ style: { textTransform: 'capitalize' } }}
                          />
                        )}
                      />

                      {/* Floor (optional) - not required for now */}
                      {/* <Controller
                        name="floorInput"
                        control={control}
                        rules={{ required: false }}
                        render={({ field }) => (
                          <StyledTextField
                            field={field}
                            label="Floor (optional)"
                            error={errors.floorInput}
                            helperText={errors.floorInput ? errors.floorInput.message : ''}
                            disabled={isLoading || isPaymentProcessing}
                            onChange={(e) => {
                              field.onChange(e);
                              const base = getValues('addressLine1');
                              const floor = e.target.value;
                              const composed = [base, formatFloorForAddress(floor)].filter(Boolean).join(', ');
                              // Keep legacy redux addressLine1 composed for compatibility
                              dispatch(setAddressDetails({ addressLine1: composed }));
                            }}
                          />
                        )}
                      /> */}

                      {/* Area / Locality - full width */}
                      <Controller
                        name="areaLocality"
                        control={control}
                        rules={{ required: 'Area required' }}
                        render={({ field }) => (
                          <StyledTextField
                            field={field}
                            label="Area / Locality"
                            error={errors.areaLocality}
                            helperText={errors.areaLocality ? errors.areaLocality.message : ''}
                            disabled={isLoading || isPaymentProcessing}
                            onChange={(e) => {
                              field.onChange(e);
                            }}
                            onBlur={(e) => dispatch(setAddressDetails({ addressLine2: e.target.value }))}
                            InputProps={{ style: { textTransform: 'capitalize' } }}
                          />
                        )}
                      />

                      {/* Landmark - full width, optional */}
                      <Controller
                        name="landmark"
                        control={control}
                        rules={{ required: false }}
                        render={({ field }) => (
                          <StyledTextField
                            field={field}
                            label="Landmark (optional)"
                            error={errors.landmark}
                            disabled={isLoading || isPaymentProcessing}
                            onChange={(e) => field.onChange(e)}
                            InputProps={{ style: { textTransform: 'capitalize' } }}
                          />
                        )}
                      />

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
                              p: '10px 12px',
                              backgroundColor: '#FEF0F0',
                              border: '1px solid #FFCDD2',
                              borderRadius: '8px',
                            }}
                          >
                            <WarningAmberIcon sx={{ color: '#C62828', fontSize: '1rem' }} />
                            <Typography
                              variant="caption"
                              sx={{
                                fontFamily: 'Jost, sans-serif',
                                color: '#C62828',
                                fontSize: '0.78rem',
                                fontWeight: 500
                              }}
                            >
                              We don&apos;t deliver to this pincode yet
                            </Typography>
                          </Box>
                        </motion.div>
                      )}

                      {/* Compact Address Preview */}
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, delay: 0.1 }}>
                        <Box sx={{
                          mt: 0.5,
                          p: 1,
                          border: '1px solid #eee',
                          borderRadius: '8px',
                          backgroundColor: '#fafafa'
                        }}>
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75 }}>
                            <LocationOnOutlinedIcon sx={{ fontSize: 15, color: '#888', mt: '1px', flexShrink: 0 }} />
                            <Typography
                              variant="body2"
                              sx={{
                                fontFamily: 'Jost, sans-serif',
                                color: '#444',
                                lineHeight: 1.35,
                                fontSize: '0.82rem'
                              }}
                            >
                              {[
                                caps.line(watch('addressLine1')),
                                formatFloorForAddress(watch('floorInput')),
                                caps.area(watch('areaLocality')),
                                caps.landmark(watch('landmark')),
                                caps.city(watch('city')),
                                caps.state(watch('state')),
                                watch('pincode')
                              ].filter(Boolean).join(', ') || 'Your delivery address will appear here'}
                            </Typography>
                          </Box>

                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5, pl: '22px' }}>
                            <Typography
                              variant="caption"
                              sx={{ fontFamily: 'Jost, sans-serif', color: '#777', fontSize: '0.78rem' }}
                            >
                              {[
                                watch('name') || userDetails.name,
                                watch('phoneNumber') || userDetails.phoneNumber
                              ].filter(Boolean).join(' • ')}
                            </Typography>
                          </Box>
                        </Box>
                      </motion.div>
                      {/* Removed Button from here, will be in fixed footer */}
                    </Box>
                  </motion.div>
                )}

                {tabIndex === 2 && (
                  <motion.div
                    key="payment"
                    custom={2}
                    variants={formVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    style={{ width: '100%' }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                        paddingTop: 1,
                        px: { xs: 1.25, sm: 2 },
                        pb: 1.5,
                      }}
                    >
                      {/* UPI Payment Waiting Status */}
                      {upiPaymentState === 'waiting' && (
                        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
                          <Box
                            sx={{
                              p: 2,
                              borderRadius: '18px',
                              bgcolor: '#FFF4E5',
                              border: `1px solid ${alpha('#F57C00', 0.35)}`,
                              display: 'flex',
                              flexDirection: { xs: 'column', sm: 'row' },
                              gap: 1.5,
                              alignItems: { sm: 'center' },
                              justifyContent: 'space-between',
                            }}
                          >
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                              <CircularProgress size={20} sx={{ color: '#F57C00' }} />
                              <Typography
                                variant="subtitle2"
                                sx={{ fontFamily: 'Jost, sans-serif', color: '#D35400', fontWeight: 600 }}
                              >
                                Waiting for payment confirmation…
                              </Typography>
                            </Box>
                          
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={handleCancelPayment}
                              sx={{
                                borderColor: '#F57C00',
                                color: '#D35400',
                                textTransform: 'none',
                                fontWeight: 600,
                                px: 2.5,
                                borderRadius: '999px',
                                '&:hover': {
                                  borderColor: '#D35400',
                                  bgcolor: 'rgba(243, 131, 33, 0.08)',
                                },
                              }}
                            >
                              Cancel
                            </Button>
                          </Box>
                        </motion.div>
                      )}

                      {/* Payment Failed Status */}
                      {upiPaymentState === 'failed' && (
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                          <Box
                            sx={{
                              p: 2,
                              borderRadius: '18px',
                              bgcolor: '#FEF0F0',
                              border: `1px solid ${alpha('#C62828', 0.35)}`,
                            }}
                          >
                            <Typography
                              variant="body2"
                              sx={{ color: '#B71C1C', fontFamily: 'Jost, sans-serif', fontWeight: 500 }}
                            >
                              Payment failed or timed out. Please try again when you&apos;re ready.
                            </Typography>
                          </Box>
                        </motion.div>
                      )}

                      {/* Amount Display */}
                      <Box
                        sx={{
                          textAlign: 'center',
                          py: 2,
                          px: 2,
                          borderRadius: '22px',
                          background: 'linear-gradient(135deg, #ffffff 0%, #f5f5f5 60%)',
                          border: `1px solid ${alpha('#000', 0.06)}`,
                          boxShadow: '0 18px 45px rgba(0,0,0,0.08)',
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{
                            fontFamily: 'Jost, sans-serif',
                            color: '#777',
                            letterSpacing: '0.12em',
                            textTransform: 'uppercase',
                          }}
                        >
                          Amount Payable {payuOnlineAmount < totalCost ? '(Online)' : ''}
                        </Typography>
                        <Typography
                          variant="h3"
                          sx={{
                            fontWeight: 700,
                            fontFamily: 'Jost, sans-serif',
                            color: accentColor,
                            mt: 0.5,
                          }}
                        >
                          {formatCurrency(payuOnlineAmount)}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ fontFamily: 'Jost, sans-serif', color: '#8d8d8d', mt: 0.5 }}
                        >
                          {payuOnlineAmount < totalCost ? `₹${totalCost - payuOnlineAmount} due at delivery` : 'Includes shipping, taxes & discounts'}
                        </Typography>
                      </Box>

                      {/* Payment Buttons */}
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        {/* UPI Button - Primary/Recommended */}
                        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                          <Box sx={{ position: 'relative' }}>
                            {/* "Fastest" Badge */}
                            <Box
                              sx={{
                                position: 'absolute',
                                top: -10,
                                right: 16,
                                bgcolor: '#4CAF50',
                                color: '#fff',
                                px: 1.2,
                                py: 0.3,
                                borderRadius: '8px',
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                fontFamily: 'Jost, sans-serif',
                                letterSpacing: '0.04em',
                                textTransform: 'uppercase',
                                boxShadow: '0 2px 8px rgba(76, 175, 80, 0.4)',
                                zIndex: 1,
                              }}
                            >
                              ⚡ Fastest
                            </Box>
                            <Button
                              variant="contained"
                              onClick={handlePayWithUPI}
                              disabled={isPaymentProcessing || upiPaymentState === 'waiting'}
                              sx={{
                                width: '100%',
                                borderRadius: '20px',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                textTransform: 'none',
                                px: 2.2,
                                py: 2,
                                bgcolor: upiSelected ? accentColor : '#fff',
                                color: upiSelected ? '#fff' : accentColor,
                                border: `2px solid ${accentColor}`,
                                boxShadow: upiSelected 
                                  ? '0 6px 20px rgba(0,0,0,0.15)' 
                                  : '0 4px 15px rgba(0,0,0,0.08)',
                                '&:hover': {
                                  bgcolor: upiSelected ? accentColor : alpha(accentColor, 0.06),
                                  boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
                                },
                                '&:disabled': {
                                  borderColor: alpha('#aaa', 0.5),
                                  color: '#b3b3b3',
                                  bgcolor: '#f7f7f7',
                                },
                              }}
                            >
                              <Box sx={{ display: 'flex', gap: 1.2, alignItems: 'center' }}>
                                <Box
                                  sx={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: '14px',
                                    bgcolor: upiSelected ? 'rgba(255,255,255,0.2)' : alpha(accentColor, 0.08),
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    overflow: 'hidden',
                                  }}
                                >
                                  <Box sx={{ position: 'relative', width: 48, height: 24 }}>
                                    <Image
                                      src="/images/payments/upi_logo.png"
                                      alt="UPI"
                                      fill
                                      sizes="48px"
                                      style={{ objectFit: 'contain' }}
                                    />
                                  </Box>
                                </Box>
                                <Box sx={{ textAlign: 'left' }}>
                                  <Typography
                                    variant="subtitle1"
                                    sx={{ fontFamily: 'Jost, sans-serif', fontWeight: 600, fontSize: '1rem' }}
                                  >
                                    {upiPaymentState === 'processing'
                                      ? 'Opening your UPI app…'
                                      : upiPaymentState === 'waiting'
                                        ? 'Waiting for approval…'
                                        : 'Pay instantly with UPI'}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    sx={{ 
                                      fontFamily: 'Jost, sans-serif', 
                                      color: upiSelected ? 'rgba(255,255,255,0.8)' : '#888',
                                      fontSize: '0.72rem',
                                    }}
                                  >
                                    GPay, PhonePe, Paytm & more
                                  </Typography>
                                </Box>
                              </Box>
                              <KeyboardArrowRightIcon sx={{ color: upiSelected ? '#fff' : accentColor }} />
                            </Button>
                          </Box>
                        </motion.div>

                        {/* Other Payment Methods - Secondary */}
                        <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                          <Button
                            variant="outlined"
                            onClick={handlePayWithOther}
                            disabled={isPaymentProcessing || upiPaymentState === 'waiting'}
                            sx={{
                              width: '100%',
                              borderRadius: '20px',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              textTransform: 'none',
                              px: 2.2,
                              py: 1.5,
                              borderWidth: 1.5,
                              borderColor: otherSelected ? alpha(accentColor, 0.6) : alpha('#999', 0.25),
                              bgcolor: otherSelected ? alpha(accentColor, 0.05) : '#fafafa',
                              color: otherSelected ? accentColor : '#666',
                              boxShadow: 'none',
                              '&:hover': {
                                borderColor: alpha(accentColor, 0.4),
                                bgcolor: alpha(accentColor, 0.04),
                              },
                              '&:disabled': {
                                borderColor: alpha('#aaa', 0.3),
                                color: '#b3b3b3',
                                bgcolor: '#f7f7f7',
                              },
                            }}
                          >
                            <Box sx={{ display: 'flex', gap: 1.2, alignItems: 'center' }}>
                              <Box
                                sx={{
                                  width: 38,
                                  height: 38,
                                  borderRadius: '12px',
                                  bgcolor: otherSelected ? alpha(accentColor, 0.08) : alpha('#999', 0.08),
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <CreditCardIcon sx={{ fontSize: 18, color: otherSelected ? accentColor : '#888' }} />
                              </Box>
                              <Box sx={{ textAlign: 'left' }}>
                                <Typography
                                  variant="subtitle1"
                                  sx={{ fontFamily: 'Jost, sans-serif', fontWeight: 500, fontSize: '0.9rem' }}
                                >
                                  Card, Wallet & More
                                </Typography>
                              </Box>
                            </Box>
                            <KeyboardArrowRightIcon sx={{ color: otherSelected ? accentColor : '#aaa', fontSize: 20 }} />
                          </Button>
                        </motion.div>
                      </Box>

                   
                    </Box>
                  </motion.div>
                )}
              </AnimatePresence>
            </Box> {/* End Scrollable Fields Area */}

            {/* Fixed Button Area */}
            <Box
              sx={{
                flexShrink: 0,
                pt: { xs: 0.8, sm: 1.5 }, // Reduced padding on mobile
                pb: { xs: 0.8, sm: 1.5 }, // Reduced padding on mobile
                // Removed mt: 'auto' to prevent footer from being pushed down
                borderTop: `1px solid ${theme.palette.divider}`,
                backgroundColor: '#ffffff',
                width: '100%',
                boxShadow: '0 -2px 5px rgba(0,0,0,0.05)',
                // Ensure button area is always visible on mobile
                ...(isMobile && {
                  pb: 0.8,
                  position: 'relative',
                  zIndex: 1,
                }),
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                {tabIndex === 0 && (
                  <motion.div
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <BlackButton
                      type="submit"
                      extraClass="lg"
                      isLoading={isLoading}
                      buttonText="Next"
                      disabled={
                        isPaymentProcessing ||
                        isLoading ||
                        !(prefetchStatus === 'ready' || prefetchStatus === 'partial')
                      }
                      sx={{
                        borderRadius: '50px',
                        px: 3,
                        py: 0.5,
                        boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
                        fontFamily: 'Jost, sans-serif',
                        fontSize: '0.9rem'
                      }}
                    />
                  </motion.div>
                )}
                {tabIndex === 1 && (
                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                    <BlackButton
                      extraClass="lg"
                      isLoading={isLoading}
                      buttonText="Continue to Payment"
                      type="submit"
                      disabled={
                        isPaymentProcessing ||
                        isLoading ||
                        purchaseInitiated ||
                        pincodeCheckInProgress ||  // disable while checking
                        !isPincodeValid             // disable until valid
                      }
                      sx={{
                        borderRadius: '50px',
                        px: 3,
                        py: 0.5,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                        fontFamily: 'Jost, sans-serif',
                        fontSize: '0.9rem'
                      }}
                    />
                  </motion.div>
                )}
              </Box>
            </Box> {/* End Fixed Button Area */}
          </Box> {/* End Form Wrapper */}

          {/* Trust indicators - Compact on mobile, hidden on very small/short screens */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            sx={{
              display: {
                xs: 'block',
                '@media (max-width: 360px)': {
                  display: 'none', // Hide on very small screens
                },
                '@media (max-height: 550px)': {
                  display: 'none', // Hide on very short viewports
               
                },
              },
            }}
          >
            <Box
              sx={{
                mt: { xs: 0.25, sm: 1 }, // Much smaller margin on mobile
                pt: { xs: 0.25, sm: 1 }, // Much smaller padding on mobile
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: { xs: 0.25, sm: 1 }, // Much smaller gap on mobile
                flexShrink: 0,
              }}
            >
              <Typography
                variant="subtitle2"
                sx={{
                  fontFamily: 'Jost, sans-serif',
                  color: '#666',
                  fontSize: { xs: '0.65rem', sm: '0.8rem' }, // Smaller on mobile
                  textAlign: 'center',
                  display: {
                    '@media (max-height: 600px)': {
                      display: 'none', // Hide text on short screens
                    },
                  },
                }}
              >
                Trusted by 50,000+ happy customers
              </Typography>

              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: { xs: 0.5, sm: 2 }, // Much smaller gap on mobile
                  width: '100%',
                }}
              >
                <motion.div whileHover={{ y: -3 }} transition={{ type: "spring", stiffness: 400 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: { xs: 0.25, sm: 0.5 }, // Smaller gap on mobile
                    }}
                  >
                    <Image
                      loading="eager"
                      src={`${baseImageUrl}/assets/icons/shield.png`}
                      width={isMobile ? 14 : 24} // Even smaller icons on mobile
                      height={isMobile ? 14 : 24}
                      alt="Secure Payment"
                      style={{ opacity: 0.7 }}
                    />
                    <Typography
                      variant="caption"
                      sx={{
                        fontFamily: 'Jost, sans-serif',
                        color: '#666',
                        textAlign: 'center',
                        fontSize: { xs: '0.5rem', sm: '0.6rem' }, // Smaller text on mobile
                        display: {
                          '@media (max-height: 600px)': {
                            display: 'none', // Hide text on short screens
                          },
                        },
                      }}
                    >
                      Secure
                    </Typography>
                  </Box>
                </motion.div>

                <motion.div whileHover={{ y: -3 }} transition={{ type: "spring", stiffness: 400 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: { xs: 0.25, sm: 0.5 }, // Smaller gap on mobile
                    }}
                  >
                    <Image
                      loading="eager"
                      src={`${baseImageUrl}/assets/icons/fast-delivery.png`}
                      width={isMobile ? 14 : 24} // Even smaller icons on mobile
                      height={isMobile ? 14 : 24}
                      alt="Fast Shipping"
                      style={{ opacity: 0.7 }}
                    />
                    <Typography
                      variant="caption"
                      sx={{
                        fontFamily: 'Jost, sans-serif',
                        color: '#666',
                        textAlign: 'center',
                        fontSize: { xs: '0.5rem', sm: '0.6rem' }, // Smaller text on mobile
                        display: {
                          '@media (max-height: 600px)': {
                            display: 'none', // Hide text on short screens
                          },
                        },
                      }}
                    >
                      Fast
                    </Typography>
                  </Box>
                </motion.div>

                <motion.div whileHover={{ y: -3 }} transition={{ type: "spring", stiffness: 400 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: { xs: 0.25, sm: 0.5 }, // Smaller gap on mobile
                    }}
                  >
                    <Image
                      loading="eager"
                      src={`${baseImageUrl}/assets/icons/happiness.png`}
                      width={isMobile ? 14 : 24} // Even smaller icons on mobile
                      height={isMobile ? 14 : 24}
                      alt="Customer Satisfaction"
                      style={{ opacity: 0.7 }}
                    />
                    <Typography
                      variant="caption"
                      sx={{
                        fontFamily: 'Jost, sans-serif',
                        color: '#666',
                        textAlign: 'center',
                        fontSize: { xs: '0.5rem', sm: '0.6rem' }, // Smaller text on mobile
                        display: {
                          '@media (max-height: 600px)': {
                            display: 'none', // Hide text on short screens
                          },
                        },
                      }}
                    >
                      100%
                    </Typography>
                  </Box>
                </motion.div>
              </Box>

              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  '@media (max-height: 600px)': {
                    display: 'none',
                  },
                }}
              >
                {isPayuProvider ? (
                  <Typography
                    variant="caption"
                    sx={{
                      fontFamily: 'Jost, sans-serif',
                      color: '#666',
                      fontSize: { xs: '0.55rem', sm: '0.65rem' },
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}
                  >
                    Payments secured by PayU & RazorPay
                  </Typography>
                ) : (
                  <>
                    <Image
                      loading="eager"
                      src={`${baseImageUrl}/assets/icons/razorpay_logo.svg`}
                      width={isMobile ? 40 : 50}
                      height={isMobile ? 12 : 15}
                      alt="Razorpay"
                      style={{ opacity: 0.7 }}
                    />
                    <Typography
                      variant="caption"
                      sx={{
                        fontFamily: 'Jost, sans-serif',
                        color: '#666',
                        fontSize: { xs: '0.5rem', sm: '0.6rem' },
                      }}
                    >
                      |
                    </Typography>
                    <Image
                      loading="eager"
                      src={`${baseImageUrl}/assets/icons/shiprocket_logo.svg`}
                      width={isMobile ? 40 : 50}
                      height={isMobile ? 12 : 15}
                      alt="Shiprocket"
                      style={{ opacity: 0.7 }}
                    />
                  </>
                )}
              </Box>
            </Box>
          </motion.div>
        </DialogContent>
      </Dialog>

      {/* Custom Snackbar for Notifications */}
      <CustomSnackbar
        open={snackbarOpen}
        message={snackbarMessage}
        severity={snackbarSeverity}
        handleClose={() => setSnackbarOpen(false)}
      />
    </ThemeProvider>
  );
};

export default React.memo(OrderForm); // Prevent unnecessary rerenders
