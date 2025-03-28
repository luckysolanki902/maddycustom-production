'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  Tabs,
  Tab,
  Box,
  TextField,
  Autocomplete,
  IconButton,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
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
import { styled } from '@mui/material/styles';
import theme from '@/styles/theme';
import { ThemeProvider } from '@mui/material';
import { initiateCheckout, purchase } from '@/lib/metadata/facebookPixels';
import { v4 as uuidv4 } from 'uuid';
import Image from 'next/image';

const OrderForm = ({
  open,
  onClose,
  paymentModeConfig,
  couponCode,
  totalCost,
  couponsDetails,
  deliveryCost,
  discountAmountFinal,
  items
}) => {
  const dispatch = useDispatch();
  const router = useRouter();
  const cartItems = useSelector((state) => state.cart.items);
  const orderForm = useSelector((state) => state.orderForm);
  const utmDetails = useSelector((state) => state.utm);
  const { userDetails, addressDetails, userExists, prefilledAddress } = orderForm;

  // Local Tab Index State
  const [tabIndex, setTabIndex] = useState(0);

  // Snackbar state
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');

  const [isLoading, setIsLoading] = useState(false);
  const [isPaymentProcessing, setIsPaymentProcessing] = useState(false);
  const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

  // Extract and aggregate unique extraFields from cart items
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

  // Setup react-hook-form
  const {
    control,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: userDetails.name || '',
      phoneNumber: userDetails.phoneNumber || '',
      email: userDetails.email || '', // NEW: email field
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
    },
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
  }, [userDetails, addressDetails, setValue, open]);

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

  // Sync Redux store address details with form
  useEffect(() => {
    if (open) {
      setValue('addressLine1', addressDetails.addressLine1 || '');
      setValue('addressLine2', addressDetails.addressLine2 || '');
      setValue('city', addressDetails.city || '');
      setValue('state', addressDetails.state || '');
      setValue('pincode', addressDetails.pincode || '');
      setValue('country', addressDetails.country || 'India');
    }
  }, [addressDetails, setValue, open]);

  const handleTabChange = (event, newValue) => {
    setTabIndex(newValue);
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const onSubmitUserDetails = async (data) => {
    setIsLoading(true);
    try {
      // Update Redux store with user details
      dispatch(
        setUserDetails({
          name: data.name,
          phoneNumber: data.phoneNumber,
          email: data.email, // also store email in Redux
        })
      );

      // If your API routes handle email, you can send email below:
      const response = await axios.patch('/api/user/check', {
        phoneNumber: data.phoneNumber,
        name: data.name,
        email: data.email, // pass email if your API supports it
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
          email: data.email, // pass email if your API supports it
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
  };

  const onSubmitAddressDetails = async (data) => {
    if (purchaseInitiated) return; // Prevent multiple submissions
    setPurchaseInitiated(true);
    setIsLoading(true);
    setIsPaymentProcessing(true);

    try {
      // Before creating the order or processing payment, check serviceability
      let serviceability;
      // try {
      //   const response = await axios.get(
      //     `/api/checkout/order/shiprocket/serviceability?pickup_postcode=226005&delivery_postcode=${data.pincode}`
      //   );
      //   serviceability = response.data;
      //   // Adjust condition based on your API's response
      //   if (!serviceability.serviceable) {
      //     showSnackbar(
      //       `The pincode ${data.pincode} is either invalid or we don't deliver to this location!`,
      //       'warning'
      //     );
      //     return;
      //   }
      // } catch (error) {
      //   showSnackbar(
      //     error.response?.data?.error || error.message || 'Serviceability check failed',
      //     'warning'
      //   );
      //   return;
      // }

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
            ...orderForm.extraFields, // include extra fields
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
            email: orderForm.userDetails.email || '', // send email if available
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
          extraFields: orderForm.extraFields, // include extra fields
        });
        // console.log('Order created:', orderResponse.data);
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
            {
              orderId: orderId, // internal order ID
            }
          );
          const { order: razorpayOrder, msg } = paymentInitResponse.data;

          if (msg === 'success') {
            const paymentResult = await makePayment({
              customerName: orderForm.userDetails.name || '',
              customerMobile: orderForm.userDetails.phoneNumber,
              orderId, // internal order ID
              razorpayOrder,
            });

            if (paymentResult) {
              showSnackbar('Payment Successful!', 'success');
            } else {
              showSnackbar('Payment failed. Please try again.', 'error');
              throw new Error('Payment processing failed.');
            }
          } else {
            console.error('Failed to initiate payment:', msg);
            showSnackbar('Failed to initiate payment.', 'error');
            throw new Error('Payment initiation failed.');
          }
        } catch (error) {
          console.error('Error processing payment:', error.message);
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
  };

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

  return (
    <ThemeProvider theme={theme}>
      <Dialog
        open={open}
        onClose={handleClose}
        fullWidth
        disableEscapeKeyDown={isPaymentProcessing}
        PaperProps={{
          style: {
            borderRadius: '1rem',
          },
        }}
      >
        <DialogContent sx={{ padding: '2rem 2rem' }}>
          {/* Logo & optional back arrow */}
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            {tabIndex === 1 && (
              <Box
                onClick={() => setTabIndex(0)}
                sx={{ position: 'absolute', left: '2rem', cursor: 'pointer' }}
              >
                <ArrowBackIcon sx={{ fontSize: '2rem' }} />
              </Box>
            )}
            <Image
              loading="eager"
              src={`${baseImageUrl}/assets/logos/md_nothing_else.png`}
              width={70}
              height={70}
              alt="Small Logo"
              style={{ width: '70px', height: 'auto' }}
            />
          </Box>

          <Box
            component="form"
            sx={{ margin: '2rem auto', maxWidth: '400px' }}
            onSubmit={
              tabIndex === 0
                ? handleSubmit(onSubmitUserDetails)
                : handleSubmit(onSubmitAddressDetails)
            }
          >
            {tabIndex === 0 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
                    <TextField
                      variant="standard"
                      {...field}
                      label="Name"
                      fullWidth
                      margin="normal"
                      error={!!errors.name}
                      helperText={errors.name ? errors.name.message : ''}
                      disabled={isLoading || isPaymentProcessing}
                      onChange={(e) => {
                        field.onChange(e);
                        dispatch(setUserDetails({ name: e.target.value }));
                      }}
                      InputLabelProps={{
                        style: {
                          fontSize: '0.75rem',
                          color: '#9e9e9e',
                        },
                      }}
                      sx={{
                        '& .MuiInputBase-root': {
                          fontSize: '1rem',
                          fontWeight: '400',
                          color: '#575252',
                        },
                        margin: { xs: '0px 0', sm: 'normal' },
                        '& .MuiInputLabel-root': {
                          lineHeight: '2',
                        },
                      }}
                    />
                  )}
                />

                {/* NEW: Optional Email Field */}
                <Controller
                  name="email"
                  control={control}
                  rules={{
                    pattern: {
                      // Basic email validation
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: 'Enter a valid email address',
                    },
                  }}
                  render={({ field }) => (
                    <TextField
                      variant="standard"
                      {...field}
                      label="Email (Optional)"
                      fullWidth
                      margin="normal"
                      error={!!errors.email}
                      helperText={errors.email ? errors.email.message : ''}
                      disabled={isLoading || isPaymentProcessing}
                      onChange={(e) => {
                        field.onChange(e);
                        dispatch(setUserDetails({ email: e.target.value }));
                      }}
                      InputLabelProps={{
                        style: {
                          fontSize: '0.75rem',
                          color: '#9e9e9e',
                        },
                      }}
                      sx={{
                        '& .MuiInputBase-root': {
                          fontSize: '1rem',
                          fontWeight: '400',
                          color: '#575252',
                        },
                        margin: { xs: '0px 0', sm: 'normal' },
                        '& .MuiInputLabel-root': {
                          lineHeight: '2',
                        },
                      }}
                    />
                  )}
                />

                <Controller
                  name="phoneNumber"
                  control={control}
                  rules={{
                    required: 'Mobile number is required',
                    pattern: {
                      value: /^\d{10}$/,
                      message: 'Mobile number must be exactly 10 digits',
                    },
                  }}
                  render={({ field }) => (
                    <TextField
                      variant="standard"
                      {...field}
                      label="Mobile Number"
                      fullWidth
                      margin="normal"
                      error={!!errors.phoneNumber}
                      helperText={errors.phoneNumber ? errors.phoneNumber.message : ''}
                      disabled={isLoading || isPaymentProcessing}
                      onChange={(e) => {
                        field.onChange(e);
                        dispatch(setUserDetails({ phoneNumber: e.target.value }));
                      }}
                      InputLabelProps={{
                        style: {
                          fontSize: '0.75rem',
                          color: '#9e9e9e',
                        },
                      }}
                      sx={{
                        '& .MuiInputBase-root': {
                          fontSize: '1rem',
                          fontWeight: '400',
                          color: '#575252',
                        },
                        margin: { xs: '0px 0', sm: 'normal' },
                        '& .MuiInputLabel-root': {
                          lineHeight: '2',
                        },
                      }}
                    />
                  )}
                />

                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                  <BlackButton
                    extraClass="lg"
                    isLoading={isLoading}
                    buttonText="Next"
                    onClick={handleSubmit(onSubmitUserDetails)}
                    disabled={isPaymentProcessing || isLoading}
                  />
                </Box>
              </Box>
            )}

            {tabIndex === 1 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <Controller
                  name="addressLine1"
                  control={control}
                  rules={{ required: 'Address is required' }}
                  render={({ field }) => (
                    <TextField
                      variant="standard"
                      {...field}
                      label="Address Line 1"
                      fullWidth
                      margin="normal"
                      error={!!errors.addressLine1}
                      helperText={errors.addressLine1 ? errors.addressLine1.message : ''}
                      disabled={isLoading || isPaymentProcessing}
                      onChange={(e) => {
                        field.onChange(e);
                        dispatch(setAddressDetails({ addressLine1: e.target.value }));
                      }}
                      InputLabelProps={{
                        style: {
                          fontSize: '0.75rem',
                          color: '#9e9e9e',
                        },
                      }}
                      sx={{
                        '& .MuiInputBase-root': {
                          fontSize: '1rem',
                          fontWeight: '400',
                          color: '#575252',
                        },
                        margin: { xs: '0px 0', sm: 'normal' },
                        '& .MuiInputLabel-root': {
                          lineHeight: '2',
                        },
                      }}
                    />
                  )}
                />

                {/* For brevity, addressLine2 omitted or optional */}
                <Controller
                  name="city"
                  control={control}
                  rules={{ required: 'City is required' }}
                  render={({ field }) => (
                    <TextField
                      variant="standard"
                      {...field}
                      label="City"
                      fullWidth
                      margin="normal"
                      error={!!errors.city}
                      helperText={errors.city ? errors.city.message : ''}
                      disabled={isLoading || isPaymentProcessing}
                      onChange={(e) => {
                        field.onChange(e);
                        dispatch(setAddressDetails({ city: e.target.value }));
                      }}
                      InputLabelProps={{
                        style: {
                          fontSize: '0.75rem',
                          color: '#9e9e9e',
                        },
                      }}
                      sx={{
                        '& .MuiInputBase-root': {
                          fontSize: '1rem',
                          fontWeight: '400',
                          color: '#575252',
                        },
                        margin: { xs: '0px 0', sm: 'normal' },
                        '& .MuiInputLabel-root': {
                          lineHeight: '2',
                        },
                      }}
                    />
                  )}
                />

                <Controller
                  name="state"
                  control={control}
                  rules={{ required: 'State is required' }}
                  render={({ field }) => (
                    <Autocomplete
                      {...field}
                      options={indianStates}
                      getOptionLabel={(option) => option}
                      onChange={(event, newValue) => {
                        field.onChange(newValue);
                        dispatch(setAddressDetails({ state: newValue }));
                      }}
                      value={field.value || ''}
                      renderInput={(params) => (
                        <TextField
                          variant="standard"
                          {...params}
                          label="State"
                          margin="normal"
                          error={!!errors.state}
                          helperText={errors.state ? errors.state.message : ''}
                          disabled={isLoading || isPaymentProcessing}
                          InputLabelProps={{
                            style: {
                              fontSize: '0.75rem',
                              color: '#9e9e9e',
                            },
                          }}
                          sx={{
                            '& .MuiInputBase-root': {
                              fontSize: '1rem',
                              fontWeight: '400',
                              color: '#575252',
                            },
                            margin: { xs: '0px 0', sm: 'normal' },
                            '& .MuiInputLabel-root': {
                              lineHeight: '2',
                            },
                          }}
                        />
                      )}
                    />
                  )}
                />

                <Controller
                  name="pincode"
                  control={control}
                  rules={{
                    required: 'Pincode is required',
                    pattern: {
                      value: /^\d{6}$/,
                      message: 'Invalid pincode format (6 digits)',
                    },
                  }}
                  render={({ field }) => (
                    <TextField
                      variant="standard"
                      {...field}
                      label="Pincode"
                      fullWidth
                      margin="normal"
                      error={!!errors.pincode}
                      helperText={errors.pincode ? errors.pincode.message : ''}
                      disabled={isLoading || isPaymentProcessing}
                      onChange={(e) => {
                        field.onChange(e);
                        dispatch(setAddressDetails({ pincode: e.target.value }));
                      }}
                      InputLabelProps={{
                        style: {
                          fontSize: '0.75rem',
                          color: '#9e9e9e',
                        },
                      }}
                      sx={{
                        '& .MuiInputBase-root': {
                          fontSize: '1rem',
                          fontWeight: '400',
                          color: '#575252',
                        },
                        margin: { xs: '0px 0', sm: 'normal' },
                        '& .MuiInputLabel-root': {
                          lineHeight: '2',
                        },
                      }}
                    />
                  )}
                />

                <Controller
                  name="country"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      variant="standard"
                      {...field}
                      label="Country"
                      fullWidth
                      margin="normal"
                      disabled={isLoading || isPaymentProcessing}
                      value={field.value || 'India'}
                      onChange={(e) => {
                        field.onChange(e);
                        dispatch(setAddressDetails({ country: e.target.value }));
                      }}
                      InputLabelProps={{
                        style: {
                          fontSize: '0.75rem',
                          color: '#9e9e9e',
                        },
                      }}
                      sx={{
                        '& .MuiInputBase-root': {
                          fontSize: '1rem',
                          fontWeight: '400',
                          color: '#575252',
                        },
                        margin: { xs: '0px 0', sm: 'normal' },
                        '& .MuiInputLabel-root': {
                          lineHeight: '2',
                        },
                      }}
                    />
                  )}
                />

                {/* Additional ExtraFields if any */}
                {/* aggregatedExtraFields.map(...) etc. as needed */}

                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                  <BlackButton
                    isLoading={isLoading}
                    buttonText={getPaymentButtonText(paymentModeConfig)}
                    type="submit"
                    disabled={isPaymentProcessing || isLoading || purchaseInitiated}
                  />
                </Box>
              </Box>
            )}
          </Box>

          {/* Some optional icons or disclaimers */}
          <Box sx={{ mt: 4 }}>
            <Box
              sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0rem', height: '90px' }}
            >
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  width: '100px',
                  height: '100%',
                  gap: '0.3rem',
                }}
              >
                <Image
                  loading="eager"
                  style={{ opacity: '0.4', width: '35px', height: 'auto' }}
                  src={`${baseImageUrl}/assets/icons/happiness.png`}
                  width={50}
                  height={50}
                  alt="Happy Customers"
                />
                <Typography
                  variant="caption"
                  sx={{
                    color: 'black',
                    opacity: '0.5',
                    textAlign: 'center',
                    lineHeight: '0.8rem',
                    fontSize: '0.6rem',
                    marginBottom: '0.2rem',
                    fontFamily: 'Jost',
                  }}
                >
                  2000+ Happy
                  <br />
                  Customers
                </Typography>
              </Box>

              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  width: '100px',
                  height: '100%',
                  gap: '0.3rem',
                }}
              >
                <Image
                  loading="eager"
                  style={{ opacity: '0.4', width: '35px', height: 'auto' }}
                  src={`${baseImageUrl}/assets/icons/shield.png`}
                  width={50}
                  height={50}
                  alt="Shield"
                />
                <Typography
                  variant="caption"
                  sx={{
                    color: 'black',
                    opacity: '0.5',
                    textAlign: 'center',
                    lineHeight: '0.8rem',
                    fontSize: '0.6rem',
                    marginBottom: '0.2rem',
                    fontFamily: 'Jost',
                  }}
                >
                  Payment
                  <br />
                  secured by
                </Typography>
                <Image
                  loading="eager"
                  style={{ opacity: '0.6', width: '55px', height: 'auto' }}
                  src={`${baseImageUrl}/assets/icons/razorpay_logo.svg`}
                  width={150}
                  height={50}
                  alt="Razorpay Logo"
                />
              </Box>

              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  width: '100px',
                  height: '100%',
                  gap: '0.3rem',
                }}
              >
                <Image
                  loading="eager"
                  style={{ opacity: '0.4', width: '35px', height: 'auto', transform: 'scale(1.2)' }}
                  src={`${baseImageUrl}/assets/icons/fast-delivery.png`}
                  width={50}
                  height={50}
                  alt="Fast Delivery"
                />
                <Typography
                  variant="caption"
                  sx={{
                    color: 'black',
                    opacity: '0.5',
                    textAlign: 'center',
                    lineHeight: '0.8rem',
                    fontSize: '0.6rem',
                    marginBottom: '0.2rem',
                    fontFamily: 'Jost',
                  }}
                >
                  On time
                  <br />
                  shipping
                </Typography>
              </Box>
            </Box>

            <Box
              sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.3rem', marginTop: '2rem' }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: 'black',
                  opacity: '0.5',
                  textAlign: 'center',
                  lineHeight: '0.8rem',
                  fontSize: '0.7rem',
                  fontFamily: 'Jost',
                }}
              >
                Shipping via
              </Typography>
              <Image
                loading="eager"
                style={{ opacity: '0.6', width: '55px', height: 'auto' }}
                src={`${baseImageUrl}/assets/icons/shiprocket_logo.svg`}
                width={150}
                height={50}
                alt="Shiprocket Logo"
              />
            </Box>
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

export default OrderForm;
