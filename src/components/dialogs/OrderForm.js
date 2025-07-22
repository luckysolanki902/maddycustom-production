'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  useMediaQuery,
  IconButton,
  Button,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import { useForm } from 'react-hook-form';
import axios from 'axios';
import { useSelector, useDispatch } from 'react-redux';
import { clearCart } from '../../store/slices/cartSlice';
import { clearUTMDetails } from '@/store/slices/utmSlice';
import Image from 'next/image';
import {
  resetOrderForm,
  setUserDetails,
  setAddressDetails,
  setUserExists,
  setPrefilledAddress,
  setLastOrderId,
  setCouponApplied,
  setManualCoupon,
  setExtraFields
} from '../../store/slices/orderFormSlice';
import { closeAllDialogs } from '@/store/slices/uiSlice';
import { makePayment } from '../../lib/payments/makePayment';
import { useRouter } from 'next/navigation';
import CustomSnackbar from '../notifications/CustomSnackbar';
import { getPaymentButtonText } from '../../lib/utils/orderFormUtils';
import { ThemeProvider } from '@mui/material';
import theme from '@/styles/theme';
import { initiateCheckout, purchase } from '@/lib/metadata/facebookPixels';
import { v4 as uuidv4 } from 'uuid';
import { motion, AnimatePresence } from 'framer-motion';
import { debounce } from 'lodash';

// Page section components
import MobileAuthForm from '@/components/page-sections/orderform/MobileAuthForm';
import AddressForm from '@/components/page-sections/orderform/AddressForm';
import TrustSection from '@/components/page-sections/orderform/TrustSection';

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
  const isSmallHeight = useMediaQuery('(max-height: 650px)');
  const isVerySmallHeight = useMediaQuery('(max-height: 550px)');
  const isTinyHeight = useMediaQuery('(max-height: 480px)');

  // State declarations - moved to top to fix initialization error
  const [isPaymentProcessing, setIsPaymentProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [purchaseInitiated, setPurchaseInitiated] = useState(false);

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

  // Local form state
  const [tabIndex, setTabIndex] = useState(0);
  const [showOtpForm, setShowOtpForm] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [isOtpVerifying, setIsOtpVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [maskedPhone, setMaskedPhone] = useState('');
  const [resendAllowedAt, setResendAllowedAt] = useState(null);
  const [userId, setUserId] = useState(null);
  const [shiprocketToken, setShiprocketToken] = useState(null);
  const [shouldSwitchToAddress, setShouldSwitchToAddress] = useState(false);

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
  const { control, handleSubmit, setValue, watch, getValues, reset, formState: { errors } } = useForm({
    mode: 'onChange',
    defaultValues: useMemo(() => ({
      phoneNumber: userDetails?.phoneNumber || '',
      email: userDetails?.email || '',
      flatDetails: '', // New field for flat/house number
      addressLine1: addressDetails?.addressLine1 || '',
      addressLine2: addressDetails?.addressLine2 || '',
      city: addressDetails?.city || '',
      state: addressDetails?.state || '',
      pincode: addressDetails?.pincode || '',
      country: addressDetails?.country || 'India',
      // Add any extraFields from cart items
      ...aggregatedExtraFields.reduce((acc, field) => {
        acc[field.fieldName] = '';
        return acc;
      }, {}),
    }), [userDetails, addressDetails, aggregatedExtraFields]),
  });
  
  // Handle switching to address tab after OTP verification
  useEffect(() => {
    console.log('🔄 UseEffect triggered, shouldSwitchToAddress:', shouldSwitchToAddress);
    if (shouldSwitchToAddress) {
      console.log('🔄 Switching to address tab via useEffect');
      // Use setTimeout to ensure state updates properly
      setTimeout(() => {
        console.log('📋 Actually switching to tab 1');
        setTabIndex(1);
        setShouldSwitchToAddress(false);
        console.log('✅ Tab switching completed');
      }, 100); // Increased delay to 100ms
    }
  }, [shouldSwitchToAddress]);
  
  // Snackbar state
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');

  // Watch phone number to determine if it matches existing user
  const watchedPhoneNumber = watch('phoneNumber');
  const isPhoneNumberSameAsUser = useMemo(() => {
    return userExists && userDetails?.phoneNumber && watchedPhoneNumber === userDetails.phoneNumber;
  }, [userExists, userDetails?.phoneNumber, watchedPhoneNumber]);

  // Determine if we should show CONTINUE button (user exists and phone matches) or GET OTP
  const shouldShowContinueButton = isPhoneNumberSameAsUser;

  // Reset OTP form when phone number changes
  useEffect(() => {
    if (watchedPhoneNumber && watchedPhoneNumber !== userDetails?.phoneNumber) {
      setShowOtpForm(false);
      setOtpValue('');
      setMaskedPhone('');
      // Reset to mobile auth tab when phone number changes
      setTabIndex(0);
      // Clear userExists state for new phone number
      dispatch(setUserExists(false));
    }
  }, [watchedPhoneNumber, userDetails?.phoneNumber, dispatch]);
  
  // Define showSnackbar first since it's used in validatePincode
  const showSnackbar = useCallback((message, severity = 'success') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  }, []);
  
  // Enhanced pincode validation with proactive serviceability check
  const validatePincode = useCallback((pincode) => {
    const debouncedCheck = debounce(async (pincodeToCheck) => {
      if (pincodeToCheck.length === 6 && /^\d{6}$/.test(pincodeToCheck)) {
        setPincodeCheckInProgress(true);

        // Check cache first
        if (serviceabilityCache.current[pincodeToCheck] !== undefined) {
          setPincodeCheckInProgress(false);
          setIsPincodeValid(serviceabilityCache.current[pincodeToCheck]);
          return;
        }

        try {
          const response = await axios.get(
            `/api/checkout/order/shiprocket/serviceability?pickup_postcode=226005&delivery_postcode=${pincodeToCheck}`
          );

          const isValid = response.data.serviceable;
          serviceabilityCache.current[pincodeToCheck] = isValid;
          setIsPincodeValid(isValid);

          if (!isValid) {
            showSnackbar(`PIN code ${pincodeToCheck} is not serviceable. Please try a different one.`, 'warning');
          }
        } catch (error) {
          // Error handling silently
        } finally {
          setPincodeCheckInProgress(false);
        }
      } else {
        setIsPincodeValid(false);
      }
    }, 300);

    debouncedCheck(pincode);
  }, [showSnackbar]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      console.log('🔄 Dialog opening, checking authentication state...');
      console.log('👤 userExists:', userExists);
      console.log('👤 userDetails:', userDetails);
      
      // Check if user is already authenticated
      if (userExists && userDetails?.phoneNumber && userDetails?.userId) {
        console.log('✅ User already authenticated, going directly to address form');
        // User is already logged in, go directly to address form
        setTabIndex(1);
        setShowOtpForm(false);
        setOtpValue('');
        setIsOtpVerifying(false);
        setIsResending(false);
        setMaskedPhone('');
        setResendAllowedAt(null);
        setUserId(userDetails.userId);
        setShiprocketToken(null);
        setIsSubmitting(false);
        
        console.log('✅ User already authenticated, skipping OTP verification');
        console.log('👤 Existing user:', userDetails);
      } else {
        // User not authenticated, start with phone verification
        setTabIndex(0);
        setShowOtpForm(false);
        setOtpValue('');
        setIsOtpVerifying(false);
        setIsResending(false);
        setMaskedPhone('');
        setResendAllowedAt(null);
        setUserId(null);
        setShiprocketToken(null);
        setIsSubmitting(false);
        
        console.log('🔐 User not authenticated, starting OTP verification');
      }
      
      // Reset form values
      setValue('phoneNumber', userDetails?.phoneNumber || '');
      setValue('email', userDetails?.email || '');
      setValue('flatDetails', addressDetails?.flatDetails || '');
      setValue('addressLine1', addressDetails?.addressLine1 || '');
      setValue('addressLine2', addressDetails?.addressLine2 || '');
      setValue('city', addressDetails?.city || '');
      setValue('state', addressDetails?.state || '');
      setValue('pincode', addressDetails?.pincode || '');
      setValue('country', addressDetails?.country || 'India');
      
      // Pre-validate pincode if it exists
      if (addressDetails?.pincode && addressDetails.pincode.length === 6) {
        validatePincode(addressDetails.pincode);
      }
    }
  }, [open, setValue, userDetails, addressDetails, validatePincode, userExists]);

  // Handle mobile number submission (send OTP or skip to address if authenticated)
  const handlePhoneSubmit = handleSubmit(async (data) => {
    if (isSubmitting) return;
    
    // If user is already authenticated, skip OTP and go to address form
    if (userExists && userDetails?.phoneNumber && userDetails?.userId) {
      console.log('✅ User already authenticated, going directly to address form');
      setTabIndex(1);
      return;
    }
    
    setIsSubmitting(true);
    try {
      const response = await axios.post('/api/auth/send-otp', {
        phoneNumber: data.phoneNumber,
        authMethod: 'sms',
        useShiprocket: false, // Client-side controlled
        shipRocketUserConsent: false
      });

      if (response.data.message === 'OTP sent successfully' || response.data.message === 'OTP sent successfully via Shiprocket') {
        setShowOtpForm(true);
        setMaskedPhone(response.data.maskedPhone);
        setResendAllowedAt(response.data.resendAllowedAt);
        setUserId(response.data.userId);
        setShiprocketToken(response.data.shiprocketToken || null);
        showSnackbar('OTP sent successfully!', 'success');
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Failed to send OTP. Please try again.';
      showSnackbar(errorMessage, 'error');
    } finally {
      setIsSubmitting(false);
    }
  });

  // Handle OTP verification
  const handleOtpVerification = useCallback(async () => {
    if (isOtpVerifying || otpValue.length !== 6) return;
    
    setIsOtpVerifying(true);
    try {
      console.log('🔄 Starting OTP verification...');
      const response = await axios.post('/api/auth/verify-otp', {
        phoneNumber: getValues('phoneNumber'),
        otp: otpValue,
        shiprocketToken: shiprocketToken
      });

      console.log('📡 OTP verification response:', response.data);

      if (response.data.message === 'Authentication successful' || response.data.message === 'OTP verified successfully') {
        const userData = response.data.user;
        
        console.log('✅ OTP verification successful, updating UI state');
        console.log('👤 User data:', userData);
        
        // Clear OTP value and disable further attempts
        setOtpValue('');
        setShowOtpForm(false);
        
        // Update Redux store
        dispatch(setUserDetails({
          name: userData.name || '',
          phoneNumber: userData.phoneNumber,
          email: userData.email || '',
          userId: userData.id || userData._id,
        }));
        
        dispatch(setUserExists(true));
        
        // Update form values
        // Update form values
        setValue('phoneNumber', userData.phoneNumber);
        setValue('email', userData.email || '');
        
        // If user has a primary address, prefill it
        if (userData.addresses && userData.addresses.length > 0) {
          const primaryAddress = userData.addresses.find(addr => addr.isPrimary) || userData.addresses[0];
          
          // Parse the addressLine1 to extract flatDetails if it's combined
          let flatDetails = '';
          let areaLocality = primaryAddress.addressLine1;
          
          // If addressLine1 seems to contain flat details, try to separate them
          if (primaryAddress.addressLine1) {
            // Look for patterns like "123A, Area" or "Flat 123, Area"
            const addressParts = primaryAddress.addressLine1.split(',');
            if (addressParts.length >= 2) {
              const firstPart = addressParts[0].trim();
              // Check if first part looks like flat/house number
              if (/^(\d+[A-Z]?|Flat\s+\d+|House\s+\d+|Plot\s+\d+)/i.test(firstPart)) {
                flatDetails = firstPart;
                areaLocality = addressParts.slice(1).join(',').trim();
              }
            }
          }
          
          dispatch(setPrefilledAddress({
            receiverPhoneNumber: primaryAddress.receiverPhoneNumber,
            flatDetails: flatDetails,
            addressLine1: areaLocality,
            addressLine2: primaryAddress.addressLine2 || '',
            city: primaryAddress.city,
            state: primaryAddress.state,
            pincode: primaryAddress.pincode,
            country: primaryAddress.country || 'India',
          }));
          
          // Set form values
          setValue('flatDetails', flatDetails);
          setValue('addressLine1', areaLocality);
          setValue('addressLine2', primaryAddress.addressLine2 || '');
          setValue('city', primaryAddress.city);
          setValue('state', primaryAddress.state);
          setValue('pincode', primaryAddress.pincode);
          // Validate pincode
          validatePincode(primaryAddress.pincode);
        }
        
        // Move to address tab
        console.log('🔄 Setting flag to switch to address tab');
        console.log('🎯 Current shouldSwitchToAddress before:', shouldSwitchToAddress);
        setShouldSwitchToAddress(true);
        console.log('📋 Tab switching flag set to true');
        
        // Also directly set tab index as backup
        setTimeout(() => {
          console.log('⏰ Direct tab switch timeout triggered');
          setTabIndex(1);
        }, 200);
        
        console.log('🔄 OTP verification successful, user data:', userData);
        showSnackbar('Successfully verified!', 'success');
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Invalid OTP. Please try again.';
      showSnackbar(errorMessage, 'error');
    } finally {
      setIsOtpVerifying(false);
    }
  }, [isOtpVerifying, otpValue, getValues, shiprocketToken, dispatch, setValue, validatePincode, showSnackbar, shouldSwitchToAddress]);

  // Handle resend OTP
  const handleResendOtp = useCallback(async () => {
    if (isResending) return;
    
    setIsResending(true);
    try {
      const response = await axios.post('/api/auth/send-otp', {
        phoneNumber: getValues('phoneNumber'),
        authMethod: 'sms',
        useShiprocket: false,
        shipRocketUserConsent: false
      });

      if (response.data.message === 'OTP sent successfully' || response.data.message === 'OTP sent successfully via Shiprocket') {
        setResendAllowedAt(response.data.resendAllowedAt);
        setShiprocketToken(response.data.shiprocketToken || null);
        showSnackbar('OTP sent successfully!', 'success');
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Failed to resend OTP. Please try again.';
      showSnackbar(errorMessage, 'error');
    } finally {
      setIsResending(false);
    }
  }, [isResending, getValues, showSnackbar]);

  // Handle tab change
  const handleTabChange = useCallback((newValue) => {
    setTabIndex(newValue);
  }, []);

  // Handle dialog close functions
  const handleClose = useCallback(() => {
    if (isPaymentProcessing) return;

    if (tabIndex === 1) {
      setTabIndex(0);
    } else {
      onClose();
    }
  }, [isPaymentProcessing, tabIndex, onClose]);

  // Handle back button
  const handleBackButton = useCallback(() => {
    if (isPaymentProcessing) return;
    
    if (tabIndex === 1) {
      // From address tab, go back to authentication tab
      setTabIndex(0);
      // Reset OTP form state so user sees phone input again
      setShowOtpForm(false);
      setOtpValue('');
      // If user exists, we need to show them the auth tab, not the address tab
      // This is handled by the rendering logic below
    } else {
      // From authentication tab, close the dialog
      handleClose();
    }
  }, [tabIndex, isPaymentProcessing, handleClose]);

  const handleFullClose = useCallback(() => {
    if (isPaymentProcessing) return;
    
    setTabIndex(0);
    setShowOtpForm(false);
    setOtpValue('');
    onClose();
    dispatch(closeAllDialogs());
  }, [isPaymentProcessing, onClose, dispatch]);

  // Handle final purchase
  const handlePurchase = useCallback(async (data) => {
    if (purchaseInitiated || isPaymentProcessing || !isPincodeValid) return;

    setPurchaseInitiated(true);
    setIsPaymentProcessing(true);

    try {
      const initialValidationPromises = [];

      // If we have a coupon code, validate it
      if (couponCode && !couponsDetails?.isValid) {
        const couponValidationPromise = axios.post('/api/checkout/validate-coupon', {
          couponCode,
          subTotal,
          items: cartItems,
        }).then(response => {
          if (response.data.isValid) {
            dispatch(setCouponApplied(response.data));
          }
          return response.data;
        }).catch(error => {
          dispatch(setManualCoupon(null));
          throw new Error(error.response?.data?.message || "Invalid coupon code.");
        });

        pendingOperationsRef.current.couponValidation = couponValidationPromise;
        initialValidationPromises.push(couponValidationPromise);
      }

      // Prepare address line 1 by combining flat details and address line 1
      const fullAddressLine1 = `${data.flatDetails?.trim() || ''} ${data.addressLine1?.trim() || ''}`.trim();

      const addAddressPayload = {
        phoneNumber: getValues('phoneNumber'),
        address: {
          receiverName: userDetails?.name || 'User',
          receiverPhoneNumber: getValues('phoneNumber'),
          addressLine1: fullAddressLine1,
          addressLine2: data.addressLine2?.trim() || '',
          city: data.city?.trim() || '',
          state: data.state?.trim() || '',
          pincode: data.pincode?.trim() || '',
          country: data.country || 'India',
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
          throw new Error(error.response?.data?.message || "Failed to update address details.");
        });

      if (initialValidationPromises.length > 0) {
        await Promise.all(initialValidationPromises);
      }

      // Prepare final order payload
      const finalOrderPayload = {
        userId: userId,
        phoneNumber: getValues('phoneNumber'),
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
          receiverName: userDetails?.name || 'User',
          receiverPhoneNumber: getValues('phoneNumber'),
          addressLine1: fullAddressLine1,
          addressLine2: data.addressLine2?.trim() || '',
          city: data.city?.trim() || '',
          state: data.state?.trim() || '',
          pincode: data.pincode?.trim() || '',
          country: data.country || 'India',
        },
        totalAmount: totalCost,
        mopCharges: paymentModeConfig.extraCharge || 0,
        deliveryCharges: deliveryCost || 0,
        utmDetails: utmDetails.utmDetails || null,
        utmHistory: utmDetails.utmHistory || [],
        extraFields: {},
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
        const paymentResult = await makePayment({
          customerName: getValues('phoneNumber'),
          customerMobile: getValues('phoneNumber'),
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
      }

      // Clear states
      dispatch(clearUTMDetails());
      dispatch(clearCart());
      dispatch(resetOrderForm());
      reset();

      handleFullClose();

      setTimeout(() => {
        router.push(`/orders/myorder/${createdOrderId}`);
      }, 100);

    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'An error occurred. Please try again.';
      showSnackbar(errorMessage, 'error');
    } finally {
      setIsLoading(false);
      setIsPaymentProcessing(false);
      setPurchaseInitiated(false);
    }
  }, [
    purchaseInitiated, 
    isPaymentProcessing, 
    isPincodeValid, 
    couponCode, 
    couponsDetails, 
    subTotal, 
    cartItems,
    getValues,
    userId,
    userDetails,
    paymentModeConfig,
    totalCost,
    deliveryCost,
    utmDetails,
    dispatch,
    showSnackbar,
    reset,
    router,
    handleFullClose
  ]);

  // Add keyboard listener for enter key
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Enter' && !isPaymentProcessing) {
        event.preventDefault();
        if (tabIndex === 1 && isPincodeValid) {
          handleSubmit(handlePurchase)();
        }
      }
    };

    if (open) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, tabIndex, isPincodeValid, isPaymentProcessing, handleSubmit, handlePurchase]);

  return (
    <ThemeProvider theme={theme}>
      <Dialog
        open={open}
        onClose={(event, reason) => {
          if (reason === 'backdropClick') {
            handleClose();
          } else {
            handleClose();
          }
        }}
        maxWidth="sm"
        fullWidth
        disableEscapeKeyDown={isPaymentProcessing}
        PaperProps={{
          sx: {
            borderRadius: isMobile ? '0' : '24px',
            overflow: 'hidden',
            height: isMobile ? '100vh' : 'auto',
            maxHeight: isMobile ? '100vh' : isSmallHeight ? '95vh' : '90vh',
            margin: isMobile ? 0 : 2,
            background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        <DialogContent
          sx={{
            padding: 0,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
            flex: 1,
          }}
        >
          {/* Header */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              p: isMobile ? '12px 16px' : '16px 24px',
              borderBottom: '1px solid #e0e0e0',
              background: 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(10px)',
              position: 'relative',
              zIndex: 10,
              minHeight: isMobile ? '56px' : '64px',
              flexShrink: 0,
            }}
          >
            {/* Back Button */}
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <IconButton
                onClick={handleBackButton}
                disabled={isPaymentProcessing}
                sx={{
                  color: '#000',
                  backgroundColor: 'rgba(0, 0, 0, 0.05)',
                  '&:hover': {
                    backgroundColor: 'rgba(0, 0, 0, 0.1)',
                  },
                }}
              >
                <ArrowBackIcon />
              </IconButton>
            </motion.div>

            {/* Progress Indicator */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: (tabIndex === 0 && !userExists) ? '#000' : '#e0e0e0',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                }}
                onClick={() => !userExists && setTabIndex(0)}
              />
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: (tabIndex === 1 || (tabIndex === 0 && userExists)) ? '#000' : '#e0e0e0',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                }}
                onClick={() => setTabIndex(1)}
              />
            </Box>

            {/* Logo (hidden on small height) */}
            {!isSmallHeight && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <Image
                  src={`${baseImageUrl}/assets/logos/md_nothing_else.png`}
                  alt="MaddyCustom Logo"
                  width={isMobile ? 32 : 40}
                  height={isMobile ? 32 : 40}
                  style={{
                    opacity: 0.8,
                    filter: 'brightness(0.7)',
                  }}
                />
              </motion.div>
            )}

            {/* Close Button */}
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <IconButton
                onClick={handleFullClose}
                disabled={isPaymentProcessing}
                sx={{
                  color: '#666',
                  backgroundColor: 'rgba(0, 0, 0, 0.05)',
                  '&:hover': {
                    backgroundColor: 'rgba(0, 0, 0, 0.1)',
                  },
                }}
              >
                <CloseIcon />
              </IconButton>
            </motion.div>
          </Box>

          {/* Main Content */}
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
              minHeight: 0, // Important for flex children to shrink
            }}
          >
            <AnimatePresence mode="wait">
              {tabIndex === 0 && (
                <motion.div
                  key="mobile-auth"
                  initial={{ opacity: 0, x: -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  style={{ 
                    flex: 1, 
                    display: 'flex', 
                    flexDirection: 'column',
                    minHeight: 0,
                    overflow: 'hidden'
                  }}
                >
                  {console.log('🔄 Rendering MobileAuthForm tab (index 0)', { 
                    userExists, 
                    shouldShowContinueButton, 
                    watchedPhoneNumber,
                    userDetailsPhone: userDetails?.phoneNumber,
                    isPhoneNumberSameAsUser
                  })}
                  <MobileAuthForm
                    control={control}
                    errors={errors}
                    onSubmit={handlePhoneSubmit}
                    isSubmitting={isSubmitting}
                    userExists={userExists} // Pass actual userExists state
                    showContinueButton={shouldShowContinueButton} // Add separate prop for continue button
                    showOtpForm={showOtpForm}
                    setShowOtpForm={setShowOtpForm}
                    otpValue={otpValue}
                    setOtpValue={setOtpValue}
                    onVerifyOtp={handleOtpVerification}
                    isOtpVerifying={isOtpVerifying}
                    maskedPhone={maskedPhone}
                    resendAllowedAt={resendAllowedAt}
                    onResendOtp={handleResendOtp}
                    isResending={isResending}
                    // When user exists and phone matches, show continue button
                    onContinue={shouldShowContinueButton ? () => setTabIndex(1) : undefined}
                  />
                </motion.div>
              )}

              {tabIndex === 1 && (
                <motion.div
                  key="address-form"
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 50 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  style={{ 
                    flex: 1, 
                    display: 'flex', 
                    flexDirection: 'column',
                    minHeight: 0,
                    overflow: 'auto'
                  }}
                >
                  {console.log('🔄 Rendering AddressForm tab (index 1 or authenticated user)')}
                  <AddressForm
                    control={control}
                    errors={errors}
                    watch={watch}
                    isPincodeValid={isPincodeValid}
                    pincodeCheckInProgress={pincodeCheckInProgress}
                    validatePincode={validatePincode}
                    onSubmit={handleSubmit(handlePurchase)}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </Box>

          {/* Footer */}
          <Box
            sx={{
              p: isMobile ? '12px 16px 16px' : '16px 24px 20px',
              borderTop: '1px solid #e0e0e0',
              background: 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(10px)',
              flexShrink: 0,
            }}
          >
            {/* Purchase Button for Address Tab Only */}
            {tabIndex === 1 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Button
                  onClick={handleSubmit(handlePurchase)}
                  disabled={isPaymentProcessing || !isPincodeValid}
                  variant="contained"
                  fullWidth
                  sx={{
                    height: isMobile ? (isTinyHeight ? '40px' : isVerySmallHeight ? '42px' : '46px') : '50px',
                    fontSize: isMobile ? (isTinyHeight ? '0.8rem' : isVerySmallHeight ? '0.85rem' : '0.95rem') : '1.05rem',
                    fontWeight: 600,
                    fontFamily: 'Orbitron, monospace',
                    borderRadius: '12px',
                    background: 'linear-gradient(45deg, #000 30%, #333 90%)',
                    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
                    transition: 'all 0.3s ease',
                    color: 'white',
                    border: 'none',
                    mb: 1,
                    '&:hover': {
                      background: 'linear-gradient(45deg, #333 30%, #000 90%)',
                      boxShadow: '0 6px 20px rgba(0, 0, 0, 0.3)',
                      transform: 'translateY(-2px)',
                    },
                    '&:disabled': {
                      background: '#ccc',
                      boxShadow: 'none',
                      transform: 'none',
                      color: 'white',
                    },
                  }}
                >
                  {isPaymentProcessing ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      >
                        <Box
                          sx={{
                            width: 16,
                            height: 16,
                            border: '2px solid #fff',
                            borderTop: '2px solid transparent',
                            borderRadius: '50%',
                          }}
                        />
                      </motion.div>
                      Processing...
                    </Box>
                  ) : (
                    `${getPaymentButtonText(paymentModeConfig)} ₹${totalCost.toLocaleString('en-IN')}`
                  )}
                </Button>
              </motion.div>
            )}

            {/* Trust Section */}
            <TrustSection baseImageUrl={baseImageUrl} isCompact={tabIndex === 1} />
          </Box>
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
