'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  TextField,
  Autocomplete,
  Typography,
  useMediaQuery,
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
  } = useForm({
    defaultValues,
    mode: 'onChange',
    shouldUnregister: false // Prevents field unregistration which helps with focus issues
  });

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

  const onSubmitUserDetails = useCallback(async (data) => {
    // Format phone number for submission if needed
    const phoneToUse = formatPhoneNumber(data.phoneNumber);
    
    setIsLoading(true);
    try {
      // Update Redux store with user details
      dispatch(
        setUserDetails({
          name: data.name,
          phoneNumber: phoneToUse,
          email: data.email,
        })
      );

      // If your API routes handle email, you can send email below:
      const response = await axios.patch('/api/user/check', {
        phoneNumber: phoneToUse, // Use the formatted phone number
        name: data.name,
        email: data.email,
      });

      if (response.data.exists) {
        const latestAddress = response.data.latestAddress;
        const userId = response.data.userId;
        dispatch(setUserDetails({ userId }));

        if (latestAddress) {
          dispatch(setUserExists(true));
          dispatch(setPrefilledAddress(latestAddress));
        } else {
          // If no address found in DB, see if Redux has one
          const reduxAddress = addressDetails;
          if (
            reduxAddress.addressLine1 ||
            reduxAddress.addressLine2 ||
            reduxAddress.city ||
            reduxAddress.state ||
            reduxAddress.pincode ||
            reduxAddress.country
          ) {
            dispatch(setUserExists(true));
            dispatch(setPrefilledAddress(reduxAddress));
          } else {
            dispatch(setUserExists(false));
            dispatch(setPrefilledAddress(null));
          }
        }
      } else {
        // Create new user
        const createResponse = await axios.post('/api/user/create', {
          name: data.name,
          phoneNumber: data.phoneNumber,
          email: data.email,
          source: 'order-form',
        });
        dispatch(setUserExists(false));
        dispatch(setPrefilledAddress(null));
        dispatch(setUserDetails({ userId: createResponse.data.userId }));
        setTabIndex(1);
      }
    } catch (error) {
      console.error('Error checking/creating user:', error.message);
      const errorMessage =
        error.response?.data?.message || 'An error occurred while processing your details.';
      showSnackbar(errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [formatPhoneNumber, dispatch, addressDetails, showSnackbar]);

  const onSubmitAddressDetails = useCallback(async (data) => {
    if (purchaseInitiated) return; // Prevent multiple submissions
    setPurchaseInitiated(true);
    setIsLoading(true);
    setIsPaymentProcessing(true);

    if (couponCode) {
      try {
        const validateRes = await axios.post('/api/checkout/coupons/apply', {
          code: couponCode,
          totalCost: subTotal,
          isFirstOrder: false,
          cartItems: items,
        });
        if (!validateRes.data.valid) {
          showSnackbar('Your offer is no longer valid. Please update your cart.', 'warning');
          return;
        }
      } catch (e) {
        console.error('Error validating coupon before order:', e);
        showSnackbar('Failed to validate coupon. Please try again.', 'error');
        return;
      }
    }

    try {
      // Before creating the order or processing payment, check serviceability
      let serviceability;
      try {
        const response = await axios.get(
          `/api/checkout/order/shiprocket/serviceability?pickup_postcode=226005&delivery_postcode=${data.pincode}`
        );
        serviceability = response.data;
        // Adjust condition based on your API's response
        if (!serviceability.serviceable) {
          showSnackbar(
            `The pincode ${data.pincode} is either invalid or we don't deliver to this location!`,
            'warning'
          );
          return;
        }
      } catch (error) {
        showSnackbar(
          error.response?.data?.error || error.message || 'Serviceability check failed',
          'warning'
        );
        return;
      }

      // 1) Add/Update Address
      try {
        const addAddressResponse = await axios.post('/api/user/add-address', {
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
        });
        if (addAddressResponse.data.message === 'Address added successfully.') {
          dispatch(setAddressDetails(addAddressResponse.data.latestAddress));
        }
      } catch (error) {
        console.error('Error adding/updating address:', error.message);
        showSnackbar('Failed to add/update address. Please try again.', 'error');
        throw error;
      }

      // 2) Initiate Checkout (for FB Pixel)
      try {
        await initiateCheckout(
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
        );
      } catch (error) {
        console.error('Error initiating checkout:', error.message);
        showSnackbar('Failed to initiate checkout. Please try again.', 'error');
        throw error;
      }

      // 3) Create Order
      let orderId = null;
      let paymentDetails = null;
      try {
        const orderResponse = await axios.post('/api/checkout/order/create', {
          userId: orderForm.userDetails.userId,
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
            insertionDetails: item.insertionDetails || {} // Add insertion details
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
        });

        const { orderId: createdOrderId, message, paymentDetails: createdPaymentDetails } =
          orderResponse.data;
        dispatch(setLastOrderId(createdOrderId));

        orderId = createdOrderId;
        paymentDetails = createdPaymentDetails;
      } catch (error) {
        console.error('Error creating order:', error.message);
        showSnackbar('Failed to create order. Please try again.', 'error');
        throw error;
      }

      // 4) Process Payment (if amountDueOnline > 0)
      if (paymentDetails.amountDueOnline > 0) {
        try {
          const paymentInitResponse = await axios.post(
            '/api/checkout/order/payment/create-razorpay-order',
            { orderId }
          );
          const { order: razorpayOrder, msg } = paymentInitResponse.data;

          if (msg !== 'success') {
            console.error('Failed to initiate payment:', msg);
            showSnackbar('Failed to initiate payment.', 'error');
            throw new Error('Payment initiation failed.');
          }

          const paymentResult = await makePayment({
            customerName: orderForm.userDetails.name || '',
            customerMobile: orderForm.userDetails.phoneNumber,
            orderId,
            razorpayOrder,
          });

          // user simply closed the Razorpay modal?
          if (paymentResult.cancelled) {
            // stop processing, do not navigate or show any snackbar
            setIsPaymentProcessing(false);
            setPurchaseInitiated(false);
            return;
          }

          // otherwise we have a real payment
          showSnackbar('Payment Successful!', 'success');
        } catch (error) {
          console.error('Error processing payment:', error.message);
          showSnackbar(error.message || 'Payment failed. Please try again.', 'error');
          throw error;
        }
      }

      // 5) Send Purchase Event to FB Pixel
      try {
        await purchase(
          {
            orderId,
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
        );
      } catch (error) {
        console.error('Error sending purchase event to FB Pixel:', error.message);
        // Even if this fails, we don't stop the flow
      }

      // 6) Final Cleanup
      dispatch(clearUTMDetails());
      dispatch(clearCart());
      reset();
      handleClose();
      router.push(`/orders/myorder/${orderId}`);
      showSnackbar('Order placed successfully!', 'success');
    } catch (error) {
      console.error('Error during purchase process:', error.message);
      showSnackbar('An error occurred during the purchase process. Please try again.', 'error');
    } finally {
      setIsLoading(false);
      setIsPaymentProcessing(false);
      setPurchaseInitiated(false);
    }
  }, [purchaseInitiated, couponCode, subTotal, items, orderForm, dispatch, showSnackbar, totalCost, deliveryCost, utmDetails.utmDetails, cartItems, paymentModeConfig, discountAmountFinal, couponsDetails]);

  // Handle dialog close (prevent closing during payment)
  const handleClose = useCallback(() => {
    if (isPaymentProcessing) {
      return;
    }
    setTabIndex(0);
    onClose();
    // Remove the history entry added when dialog was opened
    if (window.history.state && window.history.state.modal) {
      window.history.back();
    }
  }, [isPaymentProcessing, onClose]);

  // Handle browser back button
  useEffect(() => {
    if (open) {
      window.history.pushState({ modal: true }, '');
      const onPopState = () => {
        if (open) {
          handleClose();
        }
      };
      window.addEventListener('popstate', onPopState);
      return () => {
        window.removeEventListener('popstate', onPopState);
      };
    }
  }, [open, handleClose]);

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

  const fadeInUp = useMemo(() => ({
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, ease: "easeInOut" }
  }), []);

  // Custom styled text field component with memoization to prevent rerenders
  const StyledTextField = useCallback(({ field, label, error, helperText, disabled, onChange, type = "text", maxWidth }) => (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: field.name === 'name' ? 0.1 : field.name === 'email' ? 0.2 : field.name === 'phoneNumber' ? 0.3 : 0.1 * parseInt(field.name.replace(/\D/g, '')) }}
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
        onClose={handleClose}
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
            overflow: 'hidden', // Hide overflow on the DialogContent
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

          {/* Form Container - Made scrollable */}
          <Box
            component="div"
            sx={{ 
              margin: '0 auto', 
              maxWidth: '400px',
              position: 'relative',
              overflow: 'auto', // Add scroll to form area only
              flexGrow: 1, // Let this box take available space
              width: '100%',
              '&::-webkit-scrollbar': {
                width: '5px',
              },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: '#e0e0e0',
                borderRadius: '5px',
              },
            }}
          >
            <Box
              component="form"
              onSubmit={
                tabIndex === 0
                  ? handleSubmit(onSubmitUserDetails)
                  : handleSubmit(onSubmitAddressDetails)
              }
              sx={{ 
                position: 'relative',
                width: '100%', 
                height: '100%',
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
                    style={{ width: '100%', height: '100%' }}
                  >
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%', paddingTop: '0.5rem' }}>
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
                                    zIndex: 5 // Added to ensure it appears on top
                                  }}
                                >
                                  <Box sx={{
                                    mt: '5px',
                                    p: '8px 12px',
                                    borderRadius: '8px',
                                    backgroundColor: '#f1f9f5',
                                    border: '1px solid #b2ffc6',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                  }}>
                                    <Typography variant="caption" sx={{ fontSize: '0.75rem', color: '#333', fontFamily: 'Jost, sans-serif', fontWeight: 500 }}>
                                      Is <strong>{formattedPhone}</strong> the correct 10-digit number?
                                    </Typography>
                                    <motion.button
                                      whileHover={{ scale: 1.05 }}
                                      whileTap={{ scale: 0.95 }}
                                      onClick={acceptFormattedPhone}
                                      type="button"
                                      style={{
                                        backgroundColor: '#b2ffc6',
                                        color: '#333',
                                        border: 'none',
                                        borderRadius: '4px',
                                        padding: '3px 8px',
                                        fontSize: '0.7rem',
                                        cursor: 'pointer',
                                        fontFamily: 'Jost, sans-serif',
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

                      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1.5 }}>
                        <motion.div
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <BlackButton
                            extraClass="lg"
                            isLoading={isLoading}
                            buttonText="Next"
                            onClick={handleSubmit(onSubmitUserDetails)}
                            disabled={isPaymentProcessing || isLoading}
                            sx={{ 
                              borderRadius: '50px', 
                              px: 3,
                              py: 0.5, // Added to make button smaller
                              boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
                              fontFamily: 'Jost, sans-serif',
                              fontSize: '0.9rem' // Reduced from default
                            }}
                          />
                        </motion.div>
                      </Box>
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
                    style={{ width: '100%', height: '100%' }}
                  >
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingTop: '0.5rem' }}>
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
                                helperText={errors.pincode ? errors.pincode.message : ''}
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

                      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1.5 }}>
                        <motion.div
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <BlackButton
                            extraClass="lg"
                            isLoading={isLoading}
                            buttonText={getPaymentButtonText(paymentModeConfig)}
                            type="submit"
                            disabled={isPaymentProcessing || isLoading || purchaseInitiated}
                            sx={{ 
                              borderRadius: '50px', 
                              px: 3,
                              py: 0.5, // Added to make button smaller
                              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                              fontFamily: 'Jost, sans-serif',
                              fontSize: '0.9rem' // Reduced from 1.1rem
                            }}
                          />
                        </motion.div>
                      </Box>
                    </Box>
                  </motion.div>
                )}
              </AnimatePresence>
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
