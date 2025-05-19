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
  alpha
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

  // Snackbar state
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');

  const [isLoading, setIsLoading] = useState(false);
  const [isPaymentProcessing, setIsPaymentProcessing] = useState(false);
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
    formState: { errors },
    watch,
  } = useForm({
    defaultValues,
    mode: 'onChange',
    shouldUnregister: false // Prevents field unregistration which helps with focus issues
  });

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
  }, [watchedPincode]);

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

  const showSnackbar = useCallback((message, severity = 'success') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
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

    // Performance timing logs
    const startTime = performance.now();
    console.log('🔍 Checkout process started');

    try {
      // Create a single array for all initial validation promises
      const initialValidationPromises = [];
      
      // 1. Check if we need to validate serviceability
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
      
      // 2. Check if we need to validate coupon
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

      // 3. Check if we need to finish user check/creation (this sets/confirms userId)
      if (pendingOperationsRef.current.userCheck) {
        initialValidationPromises.push(pendingOperationsRef.current.userCheck);
      }
      
      // 4. Start address addition - initiate early.
      // This promise will be awaited later, in parallel with order creation.
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
      
      // Re-assign to a new const for clarity in Promise.all later
      const addressAddPromise = axios.post('/api/user/add-address', addAddressPayload)
        .then(response => {
          if (response.data.message === 'Address added successfully.' || 
              response.data.message === 'Using existing address.') {
            dispatch(setAddressDetails(response.data.latestAddress));
          }
          console.log(`⏱️ Address add/update completed`);
          return response.data;
        }).catch(error => {
            console.error("Error during address addition (in parallel task):", error);
            // Propagate error to be caught by main try-catch
            throw new Error(error.response?.data?.message || "Failed to update address details.");
        });
      pendingOperationsRef.current.addressAdd = addressAddPromise; // Keep ref if needed elsewhere, though direct use of addressAddPromise is clearer

      // 5. Wait for all initial critical validations to complete
      // This ensures userId is populated in Redux store via userCheck promise if it was pending.
      if (initialValidationPromises.length > 0) {
        console.log('⏱️ Waiting for initial validation promises (serviceability, coupon, user check)...');
        const validationStartTime = performance.now();
        await Promise.all(initialValidationPromises).catch(error => {
          throw error; // Re-throw to be caught by the main try-catch block
        });
        console.log(`⏱️ Initial validation promises completed in ${((performance.now() - validationStartTime) / 1000).toFixed(2)}s`);
      } else {
        console.log('⏱️ No initial validation promises needed - all data likely pre-validated or available.');
      }
      
      // 6. Prepare order payload *after* initial validations (especially userCheck) have completed.
      // This ensures orderForm.userDetails.userId is correctly populated.
      const finalOrderPayload = {
        userId: orderForm.userDetails.userId, // Now confirmed
        phoneNumber: orderForm.userDetails.phoneNumber,
        items: cartItems.map((item) => ({
          product: item.productId,
          itemSource: item.productDetails.source || 'inhouse',
          brand: item.productDetails.brand || null,
          option: item.productDetails.selectedOption?._id || null,
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
        address: { // Using form data directly for the order's address snapshot
          receiverName: orderForm.userDetails.name || '',
          receiverPhoneNumber: orderForm.userDetails.phoneNumber,
          addressLine1: data.addressLine1,
          addressLine2: data.addressLine2,
          city: data.city,
          state: data.state,
          pincode: data.pincode,
          country: data.country || 'India',
        },
        totalAmount: totalCost,
        discountAmount: discountAmountFinal || 0,
        couponCode: couponsDetails?.couponCode || '',
        extraCharges: [
          {
            chargesName: 'MOP Charges',
            chargesAmount: paymentModeConfig.extraCharge || 0,
          },
          {
            chargesName: 'Delivery Charges',
            chargesAmount: deliveryCost || 0,
          },
        ],
        utmDetails: utmDetails.utmDetails || null,
        extraFields: orderForm.extraFields,
      };

      // 7. Start creating the order and await its completion alongside address addition.
      console.log('⏱️ Starting order creation (in parallel with address addition completion)...');
      const orderCreateStartTime = performance.now();
      
      const orderCreatePromise = axios.post('/api/checkout/order/create', finalOrderPayload)
        .then(response => {
            console.log(`⏱️ Order created in ${((performance.now() - orderCreateStartTime) / 1000).toFixed(2)}s`);
            return response;
        }).catch(error => {
            console.error("Error during order creation (in parallel task):", error);
            throw new Error(error.response?.data?.message || "Failed to create order.");
        });

      // Wait for both order creation and address addition to complete.
      // Order creation is essential for the next step (payment).
      // Address addition is important for user profile data integrity.
      const [orderResponse] = await Promise.all([orderCreatePromise, addressAddPromise]);
      // Note: result of addressAddPromise is not directly used here, but its completion is awaited.
      
      console.log(`⏱️ Order creation and address addition parallel block completed in ${((performance.now() - orderCreateStartTime) / 1000).toFixed(2)}s`);
      
      const { orderId: createdOrderId, paymentDetails: createdPaymentDetails } = orderResponse.data;
      dispatch(setLastOrderId(createdOrderId));

      // 8. Start preparing payment in parallel with pixel events
      if (createdPaymentDetails.amountDueOnline > 0) {
        // Start FB pixel tracking in parallel with payment preparation
        const pixelPromise = initiateCheckout(
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
        
        // Start payment initialization in parallel
        console.log('⏱️ Starting payment initialization...');
        const paymentStartTime = performance.now();
        
        const paymentPromise = axios.post(
          '/api/checkout/order/payment/create-razorpay-order',
          { orderId: createdOrderId }
        );
        
        // Wait for payment initialization (this must complete)
        const paymentInitResponse = await paymentPromise;
        console.log(`⏱️ Payment initialized in ${((performance.now() - paymentStartTime) / 1000).toFixed(2)}s`);
        
        const { order: razorpayOrder, msg } = paymentInitResponse.data;

        if (msg !== 'success') {
          console.error('Failed to initiate payment:', msg);
          showSnackbar('Failed to initiate payment.', 'error');
          throw new Error('Payment initiation failed.');
        }

        console.log(`⏱️ TOTAL TIME BEFORE PAYMENT WINDOW: ${((performance.now() - startTime) / 1000).toFixed(2)}s`);
        console.log('🚀 Now opening payment window...');
        
        const paymentResult = await makePayment({
          customerName: orderForm.userDetails.name || '',
          customerMobile: orderForm.userDetails.phoneNumber,
          orderId: createdOrderId,
          razorpayOrder,
        });

        // User closed the Razorpay modal
        if (paymentResult.cancelled) {
          setIsPaymentProcessing(false);
          setPurchaseInitiated(false);
          return;
        }

        showSnackbar('Payment Successful!', 'success');
      }

      // 9. Clean up and navigate (non-blocking)
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

      console.log(`⏱️ COMPLETE CHECKOUT PROCESS TOOK: ${((performance.now() - startTime) / 1000).toFixed(2)}s`);
      
      // Reset all refs to clean up memory
      pendingOperationsRef.current = {
        userCheck: null,
        addressAdd: null, // Clear the promise from the ref
        couponValidation: null,
      };
      
      // Clean up and navigate
      dispatch(clearUTMDetails());
      dispatch(clearCart());
      reset();
      handleClose();
      router.push(`/orders/myorder/${createdOrderId}`);
      showSnackbar('Order placed successfully!', 'success');
    } catch (error) {
      console.error('Error during purchase process:', error);
      showSnackbar(error.message || 'An error occurred during the purchase process. Please try again.', 'error');
    } finally {
      setIsLoading(false);
      setIsPaymentProcessing(false);
      setPurchaseInitiated(false);
    }
  }, [purchaseInitiated, couponCode, subTotal, items, orderForm, dispatch, showSnackbar, 
      totalCost, deliveryCost, utmDetails.utmDetails, cartItems, paymentModeConfig, 
      discountAmountFinal, couponsDetails, isPincodeValid]);

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
  const StyledTextField = useCallback(({ field, label, error, helperText, disabled, onChange, type = "text", maxWidth, InputProps }) => (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: field.name === 'name' ? 0.1 : field.name === 'email' ? 0.2 : field.name === 'phoneNumber' ? 0.3 : 0.1 * parseInt(field.name.replace(/\D/g, '') || '0') }}
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
            height: '100%', // Ensure DialogContent takes up height for flex children
            overflow: 'hidden', 
          }}
        >
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
                // Hide scrollbar styles
                '&::-webkit-scrollbar': { display: 'none' },
                '-ms-overflow-style': 'none',
                'scrollbar-width': 'none',
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
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%', paddingTop: '0.5rem', px: { xs: 0.5, sm: 1} }}> {/* Added horizontal padding */}
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
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingTop: '0.5rem', px: { xs: 0.5, sm: 1} }}> {/* Added horizontal padding */}
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
                                    dispatch(setAddressDetails({ state: newValue }));
                                  }}
                                  disableClearable
                                  renderInput={(params) => (
                                    <TextField
                                      {...params}
                                      label="State"
                                      error={!!errors.state}
                                      helperText={errors.state ? errors.state.message : ''}
                                      variant="outlined"
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
                                  disabled={isLoading || isPaymentProcessing}
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
                                  dispatch(setAddressDetails({ pincode: e.target.value }));
                                }}
                                type="tel"
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
                pt: 1.5,
                pb: { xs: 1, sm: 1.5 },
                mt: 'auto',
                borderTop: `1px solid ${theme.palette.divider}`,
                backgroundColor: '#ffffff',
                width: '100%',
                boxShadow: '0 -2px 5px rgba(0,0,0,0.05)' // Subtle shadow for separation
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
