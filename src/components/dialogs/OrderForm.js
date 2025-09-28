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
import MyLocationIcon from '@mui/icons-material/MyLocation';
import { debounce } from 'lodash';
import useHistoryState from '@/hooks/useHistoryState';

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

  // Setup react-hook-form with defaultValues as a memoized object to prevent rerenders
  const defaultValues = useMemo(() => ({
    name: userDetails.name || '',
    phoneNumber: userDetails.phoneNumber || '',
    email: userDetails.email || '',
    addressLine1: addressDetails.addressLine1 || '',
    addressLine2: addressDetails.addressLine2 || '',
    // Structured address fields
    areaLocality: '',
    floorInput: '',
    landmark: '',
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
    aggregatedExtraFields]);

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

    const showSnackbar = useCallback((message, severity = 'success') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  }, []);

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
        dispatch(setAddressDetails(prefilledAddress));
        // hydrate form values only if the corresponding fields are empty
        if (!getValues('addressLine1') && prefilledAddress.addressLine1) setValue('addressLine1', prefilledAddress.addressLine1);
        if (!getValues('areaLocality') && prefilledAddress.addressLine2) setValue('areaLocality', prefilledAddress.addressLine2);
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
    setTabIndex(newValue);
  }, []);



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

  // Normalize floor display: avoid duplicating the word 'Floor'
  const formatFloorForAddress = useCallback((value) => {
    if (value === null || value === undefined) return '';
    const t = String(value).trim();
    if (!t) return '';
    if (/^\d+$/.test(t)) return `Floor ${t}`; // pure number => prefix
    if (/\bfloor\b/i.test(t)) return t;      // already contains 'floor'
    return `Floor ${t}`;                       // other strings => prefix
  }, []);



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

  // Optimistic user details submission - further optimized
  const onSubmitUserDetails = useCallback(async (data) => {
    // Format phone number for submission if needed
    const phoneToUse = formatPhoneNumber(data.phoneNumber);

    // Client-side validation to avoid unnecessary API calls
    if (phoneToUse.length !== 10 || !/^\d{10}$/.test(phoneToUse)) {
      showSnackbar('Please enter a valid 10-digit mobile number', 'error');
      return;
    }

    // Optimistically update Redux store with user details before API call
    dispatch(
      setUserDetails({
        name: data.name,
        phoneNumber: phoneToUse,
        email: data.email,
      })
    );

    // Immediately move to the next tab for better UX
    setTabIndex(1);

    // Perform user check in background without blocking UI
    pendingOperationsRef.current.userCheck = axios.patch('/api/user/check', {
      phoneNumber: phoneToUse,
      name: data.name,
      email: data.email,
    })
      .then(response => {
        if (response.data.exists) {
          const latestAddress = response.data.latestAddress;
          dispatch(setUserDetails({ userId: response.data.userId }));

          if (latestAddress) {
            // Update form with existing address
            Object.entries(latestAddress).forEach(([key, value]) => {
              if (setValue && key !== '_id') {
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
          // Create user in background (non-blocking)
          return axios.post('/api/user/create', {
            name: data.name,
            phoneNumber: phoneToUse,
            email: data.email,
            source: 'order-form',
          })
            .then(createResponse => {
              dispatch(setUserDetails({ userId: createResponse.data.userId || createResponse.data.user?.userId }));
              return createResponse;
            });
        }
        return response;
      })
      .catch(error => {
        console.error('Error in background user check/create:', error);
      });
  }, [formatPhoneNumber, dispatch, setValue, showSnackbar, validatePincode]);

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

      // Compose address lines from structured fields, include optional Floor
      const composedAddressLine1 = [
        data.addressLine1,
        formatFloorForAddress(data.floorInput)
      ].filter(Boolean).join(', ');
      const composedAddressLine2 = [data.areaLocality, data.landmark]
        .filter(Boolean)
        .join(', ');

      // Parse floor value: numeric-if-any -> number; otherwise keep as string
      const floorRaw = (data.floorInput || '').toString().trim();
      let floorParsed = undefined;
      if (floorRaw) {
        const match = floorRaw.match(/\d+/);
        floorParsed = match ? Number(match[0]) : floorRaw; // extract first number if present
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
          geo: geo,
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
          addressLine1: composedAddressLine1,
          addressLine2: composedAddressLine2,
          city: data.city,
          state: data.state,
          pincode: data.pincode,
          country: data.country || 'India',
          geo: geo,
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
        extraFields: {
          ...orderForm.extraFields,
          geo,
          areaLocality: data.areaLocality,
          landmark: data.landmark,
          ...(floorParsed !== undefined ? { floor: floorParsed } : {}),
        },
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

      // Facebook Pixel Purchase Event - Always send FULL customer total amount
      // This represents the complete customer purchase intent, not payment splits
      if (!process.env.NEXT_PUBLIC_isTestingOrder) {
        purchase(
          {
            orderId: createdOrderId,
            totalAmount: totalCost, // Full order total from ViewCart (includes all items, discounts, charges)
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
      }

      pendingOperationsRef.current = {
        userCheck: null,
        addressAdd: null,
        couponValidation: null,
      };

      dispatch(clearUTMDetails());
      if (!process.env.NEXT_PUBLIC_isTestingOrder) dispatch(clearCart());
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
  serviceabilityCache, geo, formatFloorForAddress]); // Maintained dependencies

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

  // Custom styled text field component with memoization to prevent rerenders
  const StyledTextField = useCallback(({ field, label, error, helperText, disabled, onChange, onBlur: onBlurProp, type = "text", maxWidth, InputProps }) => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: field.name === 'name' ? 0.1 : field.name === 'email' ? 0.2 : field.name === 'phoneNumber' ? 0.3 : 0.1 * parseInt(field.name.replace(/\D/g, '') || '0') }}
    >
      <TextField
        variant="outlined"
        size="small"
        {...field}
        label={label}
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
            fontSize: '0.85rem',
          },
        }}
        InputProps={{
          style: {
            fontFamily: 'Jost, sans-serif',
            fontSize: '0.95rem',
          },
          ...InputProps
        }}
        sx={{
          marginBottom: '0.8rem',
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
  ), [isMobile]);

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
            // Force fixed positioning and dimensions to prevent keyboard shrinking
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: { xs: '90vw', sm: '500px' },
            maxWidth: '500px',
            height: { xs: '85vh', sm: 'auto' },
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
            <Box sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              mt: { xs: 0.5, sm: 1.5 }, // Much smaller margin on mobile
              position: 'relative',
              height: { xs: '20px', sm: '30px' }, // Smaller height on mobile
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
                animate={{ scale: tabIndex === 0 ? 1.1 : 0.9, x: -40 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
              >
                <Box
                  sx={{
                    width: { xs: '20px', sm: '25px' }, // Smaller on mobile
                    height: { xs: '20px', sm: '25px' },
                    borderRadius: '50%',
                    backgroundColor: '#000',
                    color: 'white',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    fontFamily: 'Jost, sans-serif',
                    fontWeight: 600,
                    fontSize: { xs: '0.7rem', sm: '0.8rem' }, // Smaller font on mobile
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
                animate={{ scale: tabIndex === 1 ? 1.1 : 0.9, x: 40 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
              >
                <Box
                  sx={{
                    width: { xs: '20px', sm: '25px' }, // Smaller on mobile
                    height: { xs: '20px', sm: '25px' },
                    borderRadius: '50%',
                    backgroundColor: tabIndex === 1 ? '#000' : '#e0e0e0',
                    color: tabIndex === 1 ? 'white' : '#999',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    fontFamily: 'Jost, sans-serif',
                    fontWeight: 600,
                    fontSize: { xs: '0.7rem', sm: '0.8rem' }, // Smaller font on mobile
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
                {tabIndex === 0 ? "Let's get to know you" : "Where should we deliver?"}
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
                    style={{ width: '100%' }} // Removed height: '100%'
                  >
                    <Box sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                      width: '100%',
                      paddingTop: '0.5rem',
                      px: { xs: 0.5, sm: 1 },
                    }}> {/* Added horizontal padding */}
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
                    style={{ width: '100%' }} // Removed height: '100%'
                  >
                    <Box sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                      paddingTop: '0.5rem',
                      px: { xs: 0.5, sm: 1 },
                    }}> {/* Added horizontal padding */}
                      {/* Current Location at top */}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                        {/* <Typography variant="subtitle2" sx={{ fontFamily: 'Jost, sans-serif', color: '#333' }}>Delivery Address</Typography> */}
                        <Button
                          size="small"
                          startIcon={<MyLocationIcon />}
                          onClick={() => {
                            if (!navigator.geolocation) return;
                            setIsLocating(true);
                            navigator.geolocation.getCurrentPosition((pos) => {
                              const lat = pos.coords.latitude;
                              const lng = pos.coords.longitude;
                              setGeo({ lat, lng });
                              fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`)
                                .then(res => res.json())
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
                                  // Use road/houseNumber/poi to help suggest fields
                                  if ((addr?.houseNumber || addr?.road) && !getValues('addressLine1')) {
                                    const part = [addr.houseNumber, addr.road].filter(Boolean).join(', ');
                                    setValue('addressLine1', part);
                                    dispatch(setAddressDetails({ addressLine1: part }));
                                  }
                                  if (addr?.poi && !getValues('landmark')) {
                                    setValue('landmark', addr.poi);
                                  }
                                  showSnackbar('Address auto-filled from your location.', 'success');
                                })
                                .catch(() => showSnackbar('Could not auto-fill address. Please enter manually.', 'warning'))
                                .finally(() => setIsLocating(false));
                            }, () => { setIsLocating(false); showSnackbar('Unable to get location. Please allow permission.', 'warning'); }, { enableHighAccuracy: true, timeout: 10000 });
                          }}
                        >
                          Use Current Location
                        </Button>
                      </Box>

                      {/* Locating state */}
                      {isLocating && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                          <Box sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            p: 1,
                            borderRadius: '8px',
                            background: 'linear-gradient(90deg, #f7f7f7, #fff)',
                            border: `1px solid ${alpha('#2d2d2d', 0.15)}`,
                            mb: 0.5
                          }}>
                            <CircularProgress size={16} sx={{ color: '#2d2d2d' }} />
                            <Typography variant="caption" sx={{ fontFamily: 'Jost, sans-serif', color: '#2d2d2d' }}>
                              Locating you and fetching your address…
                            </Typography>
                          </Box>
                        </motion.div>
                      )}
                      {/* City, State, Pincode at top for visibility after geolocation */}
                      <Grid container spacing={1.5} sx={{ width: '100%', mb: 0.5 }}>
                        <Grid item xs={12} sm={12}>
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
                                }}
                                onBlur={(e) => dispatch(setAddressDetails({ city: e.target.value }))}
                              />
                            )}
                          />
                        </Grid>
                        <Grid item xs={6} sm={6}>
                          <Controller
                            name="state"
                            control={control}
                            rules={{ required: 'State is required' }}
                            render={({ field }) => (
                              <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3, delay: 0.1 }}
                              >
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
                                            fontSize: '0.85rem',
                                            minHeight: '32px',
                                            py: 0.5
                                          }
                                        }
                                      }
                                    }
                                  }}
                                  sx={{
                                    '& .MuiInputBase-root': {
                                      height: 40,
                                    },
                                    '& .MuiOutlinedInput-root': {
                                      borderRadius: '8px',
                                      minHeight: '40px',
                                      paddingTop: 0,
                                      paddingBottom: 0,
                                    },
                                    '& .MuiAutocomplete-inputRoot': {
                                      paddingTop: '2px',
                                      paddingBottom: '2px',
                                    },
                                    '& .MuiAutocomplete-input': {
                                      fontFamily: 'Jost, sans-serif',
                                      fontSize: '0.95rem',
                                      padding: '7px 4px !important',
                                    },
                                  }}
                                  renderInput={(params) => (
                                    <TextField
                                      {...params}
                                      size="small"
                                      label="State"
                                      error={!!errors.state}
                                      helperText={errors.state ? errors.state.message : ''}
                                      variant="outlined"
                                      InputLabelProps={{
                                        style: {
                                          fontFamily: 'Jost, sans-serif',
                                          fontSize: '0.85rem',
                                        },
                                      }}
                                      InputProps={{
                                        ...params.InputProps,
                                        style: {
                                          fontFamily: 'Jost, sans-serif',
                                          fontSize: '0.95rem',
                                        },
                                      }}
                                    />
                                  )}
                                  disabled={isLoading || isPaymentProcessing}
                                />
                              </motion.div>
                            )}
                          />
                        </Grid>
                        <Grid item xs={6} sm={6}>
                          <Controller
                            name="pincode"
                            control={control}
                            rules={{
                              required: 'Pincode is required',
                              pattern: {
                                value: /^\d{6}$/,
                                message: 'Invalid pincode',
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
                        </Grid>
                      </Grid>
                      <Controller
                        name="addressLine1"
                        control={control}
                        rules={{ required: 'Address is required' }}
                        render={({ field }) => (
                          <StyledTextField
                            field={field}
                            label="Flat/House no/Building name"
                            error={errors.addressLine1}
                            helperText={errors.addressLine1 ? errors.addressLine1.message : ''}
                            disabled={isLoading || isPaymentProcessing}
                            onChange={(e) => {
                              field.onChange(e);
                            }}
                            onBlur={(e) => dispatch(setAddressDetails({ addressLine1: e.target.value }))}
                          />
                        )}
                      />

                      {/* Floor (optional) */}
                      <Controller
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
                            onChange={(e) => field.onChange(e)}
                          />
                        )}
                      />

                      {/* Area / Locality and Landmark */}
                      <Grid container spacing={1.5} sx={{ width: '100%' }}>
                        <Grid item xs={12}>
                          <Controller
                            name="areaLocality"
                            control={control}
                            rules={{ required: 'Area/Sector/Locality is required' }}
                            render={({ field }) => (
                              <StyledTextField
                                field={field}
                                label="Area/Sector/Locality"
                                error={errors.areaLocality}
                                helperText={errors.areaLocality ? errors.areaLocality.message : ''}
                                disabled={isLoading || isPaymentProcessing}
                                onChange={(e) => {
                                  field.onChange(e);
                                }}
                                onBlur={(e) => dispatch(setAddressDetails({ addressLine2: e.target.value }))}
                              />
                            )}
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <Controller
                            name="landmark"
                            control={control}
                            rules={{ required: false }}
                            render={({ field }) => (
                              <StyledTextField
                                field={field}
                                label="Nearby Landmark (optional)"
                                error={errors.landmark}
                                helperText={errors.landmark ? errors.landmark.message : ''}
                                disabled={isLoading || isPaymentProcessing}
                                onChange={(e) => field.onChange(e)}
                              />
                            )}
                          />
                        </Grid>
                        {/* Removed separate Apartment/Block field; merged into Area/Locality */}
                      </Grid>

                      {/* moved current-location button to top */}

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

                      {/* Address Preview */}
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
                        <Box sx={{
                          mt: 1,
                          p: 1.2,
                          border: `1px dashed ${theme.palette.divider}`,
                          borderRadius: '8px',
                          backgroundColor: '#fafafa'
                        }}>
                          <Typography variant="caption" sx={{ fontFamily: 'Jost, sans-serif', color: '#666', fontWeight: 600 }}>
                            Address preview
                          </Typography>
                          <Typography variant="body2" sx={{ fontFamily: 'Jost, sans-serif', mt: 0.5, color: '#2d2d2d' }}>
                            {[
                              watch('addressLine1'),
                              formatFloorForAddress(watch('floorInput')),
                              watch('areaLocality'),
                              watch('landmark'),
                              watch('city'),
                              watch('state'),
                              watch('pincode')
                            ]
                              .filter(Boolean)
                              .join(', ')}
                          </Typography>
                          <Typography variant="body2" sx={{ fontFamily: 'Jost, sans-serif', mt: 0.5, color: '#2d2d2d' }}>
                            {[
                              watch('name') || userDetails.name,
                              watch('email') || userDetails.email,
                              watch('phoneNumber') || userDetails.phoneNumber
                            ].filter(Boolean).join(' | ')}
                          </Typography>
                          <Typography variant="caption" sx={{ fontFamily: 'Jost, sans-serif', display: 'block', mt: 0.75, color: '#0f8a5a' }}>
                            Please check your address and contact details so our delivery partner can reach you without delays.
                          </Typography>
                        </Box>
                      </motion.div>
                      {/* Removed Button from here, will be in fixed footer */}
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
                      type="submit" // Changed from onClick
                      extraClass="lg"
                      isLoading={isLoading} // This isLoading is general; consider specific state if needed for UX
                      buttonText="Next"
                      disabled={isPaymentProcessing || isLoading}
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
                      buttonText={getPaymentButtonText(paymentModeConfig)}
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
                borderTop: '1px solid #f0f0f0',
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
                    display: 'none', // Hide payment logo on short screens
                  },
                }}
              >
                <Image
                  loading="eager"
                  src={`${baseImageUrl}/assets/icons/razorpay_logo.svg`}
                  width={isMobile ? 40 : 50} // Smaller on mobile
                  height={isMobile ? 12 : 15}
                  alt="Razorpay"
                  style={{ opacity: 0.7 }}
                />
                <Typography
                  variant="caption"
                  sx={{
                    fontFamily: 'Jost, sans-serif',
                    color: '#666',
                    fontSize: { xs: '0.5rem', sm: '0.6rem' }, // Smaller on mobile
                  }}
                >
                  |
                </Typography>
                <Image
                  loading="eager"
                  src={`${baseImageUrl}/assets/icons/shiprocket_logo.svg`}
                  width={isMobile ? 40 : 50} // Smaller on mobile
                  height={isMobile ? 12 : 15}
                  alt="Shiprocket"
                  style={{ opacity: 0.7 }}
                />
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
