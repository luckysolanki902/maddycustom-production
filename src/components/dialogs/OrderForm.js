// @/components/OrderForm.js

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Tabs,
  Tab,
  Box,
  TextField,
  Autocomplete,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
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
} from '../../store/slices/orderFormSlice';
import { makePayment } from '../../lib/payments/makePayment';
import { useRouter } from 'next/navigation';
import CustomSnackbar from '../notifications/CustomSnackbar';
import { getPaymentButtonText } from '../../lib/utils/orderFormUtils';
import { styled } from '@mui/material/styles';
import theme from '@/styles/theme';
import { ThemeProvider } from '@mui/material';
import { purchase } from '@/lib/metadata/facebookPixels';


const OrderForm = ({ open, onClose, paymentModeConfig, couponCode, totalCost }) => {
  const dispatch = useDispatch();
  const router = useRouter();
  const cartItems = useSelector((state) => state.cart.items);
  const orderForm = useSelector((state) => state.orderForm);
  const utmDetails = useSelector((state) => state.utm);
  const { userDetails, addressDetails, userExists, prefilledAddress, discountAmount } = orderForm;

  // Local Tab Index State
  const [tabIndex, setTabIndex] = useState(0);

  // Snackbar state
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');

  const [isLoading, setIsLoading] = useState(false);
  const [isPaymentProcessing, setIsPaymentProcessing] = useState(false);
  const {
    control,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: userDetails.name,
      phoneNumber: userDetails.phoneNumber,
      addressLine1: addressDetails.addressLine1,
      addressLine2: addressDetails.addressLine2,
      city: addressDetails.city,
      state: addressDetails.state,
      pincode: addressDetails.pincode,
      country: addressDetails.country || 'India',
    },
  });

  // Prevent multiple submissions by tracking if purchase has been initiated
  const [purchaseInitiated, setPurchaseInitiated] = useState(false);

  // Reset tabIndex to 0 when dialog opens
  useEffect(() => {
    if (open) {
      setTabIndex(0);
      setPurchaseInitiated(false); // Reset purchase initiation flag
    }
  }, [open]);

  // Sync form values with Redux store when dialog is opened
  useEffect(() => {
    if (open) {
      setValue('name', userDetails.name);
      setValue('phoneNumber', userDetails.phoneNumber);
      setValue('addressLine1', addressDetails.addressLine1);
      setValue('addressLine2', addressDetails.addressLine2);
      setValue('city', addressDetails.city);
      setValue('state', addressDetails.state);
      setValue('pincode', addressDetails.pincode);
      setValue('country', addressDetails.country || 'India');
    }
  }, [userDetails, addressDetails, setValue, open]);

  // Handle Prefilled Address and Show Snackbar
  useEffect(() => {
    if (userExists && prefilledAddress) {
      // Prefill address fields with the latest address
      dispatch(setAddressDetails(prefilledAddress));

      // Reset userExists and prefilledAddress to prevent snackbar from showing again
      dispatch(setUserExists(false));
      dispatch(setPrefilledAddress(null));

      // Move to Address tab after prefill
      setTabIndex(1);
    } else if (userExists && !prefilledAddress) {
      // If API doesn't provide latestAddress, check Redux store
      if (
        addressDetails.addressLine1 ||
        addressDetails.addressLine2 ||
        addressDetails.city ||
        addressDetails.state ||
        addressDetails.pincode ||
        addressDetails.country
      ) {
        setTabIndex(1); // Move to Address tab
      }
    }
  }, [userExists, prefilledAddress, dispatch, addressDetails]);

  // Synchronize form fields with addressDetails from Redux store
  useEffect(() => {
    if (open) {
      setValue('addressLine1', addressDetails.addressLine1);
      setValue('addressLine2', addressDetails.addressLine2);
      setValue('city', addressDetails.city);
      setValue('state', addressDetails.state);
      setValue('pincode', addressDetails.pincode);
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
      dispatch(setUserDetails({ name: data.name, phoneNumber: data.phoneNumber }));

      // Check if user exists using GET request with query parameter
      const response = await axios.get('/api/user/check', {
        params: { phoneNumber: data.phoneNumber },
      });

      if (response.data.exists) {
        const latestAddress = response.data.latestAddress;
        const userId = response.data.userId;

        dispatch(setUserDetails({ userId }));

        if (latestAddress) {
          dispatch(setUserExists(true));
          dispatch(setPrefilledAddress(latestAddress));
        } else {
          // If latestAddress is not available from API, check Redux store
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
        // Create new user using POST request
        const createResponse = await axios.post('/api/user/create', {
          name: data.name,
          phoneNumber: data.phoneNumber,
        });
        dispatch(setUserExists(false));
        dispatch(setPrefilledAddress(null));
        dispatch(setUserDetails({ userId: createResponse.data.userId })); // Store userId
        // Move to Address tab since user is newly created
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
    if (purchaseInitiated) {
      // Prevent multiple submissions
      return;
    }
    setPurchaseInitiated(true);
    setIsLoading(true);
    setIsPaymentProcessing(true);
    try {
      // Add/update the address using the provided API
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
        },
      });

      // Handle API response
      if (addAddressResponse.data.message === 'Address already exists.') {
        // Address already exists, proceed
      } else if (addAddressResponse.data.message === 'Address added successfully.') {
        // Update Redux store with the latest address details from API response
        dispatch(setAddressDetails(addAddressResponse.data.latestAddress));
      }

      // Proceed with order creation only if address was added or already exists
      // Create order via separate API call
      const orderResponse = await axios.post('/api/checkout/order/create', {
        userId: orderForm.userDetails.userId,
        phoneNumber: orderForm.userDetails.phoneNumber,
        items: cartItems.map((item) => ({
          product: item.productId,
          name: `${item.productDetails.name} ${item.productDetails.category?.name?.endsWith('s')
            ? item.productDetails.category?.name.slice(0, -1)
            : item.productDetails.category?.name
            }`,
          quantity: item.quantity,
          priceAtPurchase: item.productDetails.price,
          sku: item.productDetails.sku,
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
        discountAmount: discountAmount,
        extraCharges: paymentModeConfig.extraCharge
          ? [
            {
              chargesName: 'Extra Charge',
              chargesAmount: paymentModeConfig.extraCharge,
            },
          ]
          : [],
        couponCode: couponCode || null,
        utmDetails: utmDetails.utmDetails || null,
      });

      const { orderId, message, paymentDetails } = orderResponse.data;

      dispatch(setLastOrderId(orderId));

      if (paymentDetails.amountDueOnline > 0) {
        const paymentInitResponse = await axios.post(
          '/api/checkout/order/payment/create-razorpay-order',
          {
            orderId: orderId, // Internal orderId
          }
        );

        const { order: razorpayOrder, msg } = paymentInitResponse.data;

        if (msg === 'success') {
          const paymentResult = await makePayment({
            customerName: orderForm.userDetails.name || '',
            customerMobile: orderForm.userDetails.phoneNumber,
            orderId, // Internal orderId
            razorpayOrder, // Pass the entire razorpayOrder object
          });

          if (paymentResult) {
            showSnackbar('Payment Successful!', 'success');
          } else {
            showSnackbar('Payment failed. Please try again.', 'error');
          }
        } else {
          showSnackbar('Failed to initiate payment.', 'error');
        }
      }
      await purchase({
        orderId: orderId,
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
      });

      dispatch(clearUTMDetails());
      dispatch(clearCart());
      dispatch(resetOrderForm());
      reset();
      handleClose();
      router.push(`/orders/myorder/${orderId}`);
    } catch (error) {
      console.error('Error creating order or processing payment:', error.message);
      setPurchaseInitiated(false); // Reset purchase initiation flag on error
    } finally {
      setIsLoading(false);
      setIsPaymentProcessing(false);
    }
  };

  // Handle dialog close with conditions
  const handleClose = useCallback(() => {
    if (isPaymentProcessing) {
      // Prevent closing the dialog during payment processing
      return;
    }
    setTabIndex(0); // Reset to first tab
    onClose();
    // Remove the history entry added when dialog was opened
    if (window.history.state && window.history.state.modal) {
      window.history.back();
    }
  }, [isPaymentProcessing, onClose]);

  // Handle browser back button
  useEffect(() => {
    if (open) {
      // Push a new state to history when dialog is opened
      window.history.pushState({ modal: true }, '');
      const onPopState = (event) => {
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
        // maxWidth="xs"
        sx={{}}
        disableEscapeKeyDown={isPaymentProcessing} // Prevent closing with Escape key
      >
        <DialogContent>
          <Tabs
            value={tabIndex}
            onChange={handleTabChange}
            variant="fullWidth"
          >
            <Tab sx={{ fontSize: "1rem", }} label="Part 1" />
            <Tab sx={{ fontSize: "1rem" }} label="Part 2" disabled={tabIndex !== 1} />
          </Tabs>

          <Box
            component="form"
            sx={{ mt: 2 }}
            onSubmit={
              tabIndex === 0
                ? handleSubmit(onSubmitUserDetails)
                : handleSubmit(onSubmitAddressDetails)
            }
          >
            {tabIndex === 0 && (
              <Box
                sx={{
                  padding: '0rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                }}
              >
                <Controller
                  name="name"
                  control={control}
                  rules={{
                    required: 'Name is required',
                    minLength: { value: 3, message: 'Name must be at least 3 characters' },
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
                          fontSize: '0.75rem',  // Adjust the size of the label
                          color: '#9e9e9e',     // Set the label color to grey
                        },
                      }}
                      sx={{
                        '& .MuiInputBase-root': {
                          fontSize: '1rem', fontWeight: '400', color: '#575252' // You can adjust this to fit your design needs
                        },
                        margin: {
                          xs: '0px 0', // Less margin for mobile view
                          sm: 'normal', // Default margin for larger screens
                        }, '& .MuiInputLabel-root': {
                          lineHeight: '2', // Further fine-tune the label spacing
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
                          fontSize: '0.75rem',  // Adjust the size of the label
                          color: '#9e9e9e',     // Set the label color to grey
                        },
                      }}
                      sx={{
                        '& .MuiInputBase-root': {
                          fontSize: '1rem', fontWeight: '400', color: '#575252' // You can adjust this to fit your design needs
                        },
                        margin: {
                          xs: '0px 0', // Less margin for mobile view
                          sm: 'normal', // Default margin for larger screens
                        }, '& .MuiInputLabel-root': {
                          lineHeight: '2', // Further fine-tune the label spacing
                        },
                      }}
                    />
                  )}
                />
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 5 }}>
                  <BlackButton
                    isLoading={isLoading}
                    buttonText="Next"
                    onClick={handleSubmit(onSubmitUserDetails)}
                    disabled={isPaymentProcessing || isLoading}
                  />
                </Box>
              </Box>
            )}

            {tabIndex === 1 && (
              <Box
                sx={{
                  padding: '0rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}
              >
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
                          fontSize: '0.75rem',  // Adjust the size of the label
                          color: '#9e9e9e',     // Set the label color to grey
                        },
                      }}
                      sx={{
                        '& .MuiInputBase-root': {
                          fontSize: '1rem', fontWeight: '400', color: '#575252' // You can adjust this to fit your design needs
                        },
                        margin: {
                          xs: '0px 0', // Less margin for mobile view
                          sm: 'normal', // Default margin for larger screens
                        }, '& .MuiInputLabel-root': {
                          lineHeight: '2', // Further fine-tune the label spacing
                        },
                      }}
                    />
                  )}
                />
                {/* Uncomment if Address Line 2 is needed */}
                {/* <Controller
                  name="addressLine2"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      variant="standard"
                      {...field}
                      label="Address Line 2 (Optional)"
                      fullWidth
                      margin="normal"
                      disabled={isLoading || isPaymentProcessing}
                      onChange={(e) => {
                        field.onChange(e);
                        dispatch(setAddressDetails({ addressLine2: e.target.value }));
                      }}
                      InputLabelProps={{
                        style: {
                          fontSize: '0.75rem',  // Adjust the size of the label
                          color: '#9e9e9e',     // Set the label color to grey
                        },
                      }}
                      sx={{
                        '& .MuiInputBase-root': {
                          fontSize: '1rem', fontWeight: '400', color: '#575252' // You can adjust this to fit your design needs
                        },
                        margin: {
                          xs: '0px 0', // Less margin for mobile view
                          sm: 'normal', // Default margin for larger screens
                        },
                      }}
                    />
                  )}
                /> */}
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
                          fontSize: '0.75rem',  // Adjust the size of the label
                          color: '#9e9e9e',     // Set the label color to grey
                        },
                      }}
                      sx={{
                        '& .MuiInputBase-root': {
                          fontSize: '1rem', fontWeight: '400', color: '#575252' // You can adjust this to fit your design needs
                        },
                        margin: {
                          xs: '0px 0', // Less margin for mobile view
                          sm: 'normal', // Default margin for larger screens
                        }, '& .MuiInputLabel-root': {
                          lineHeight: '2', // Further fine-tune the label spacing
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
                              fontSize: '0.75rem',  // Adjust the size of the label
                              color: '#9e9e9e',     // Set the label color to grey
                            },
                          }}
                          sx={{
                            '& .MuiInputBase-root': {
                              fontSize: '1rem', fontWeight: '400', color: '#575252' // You can adjust this to fit your design needs
                            },
                            margin: {
                              xs: '0px 0', // Less margin for mobile view
                              sm: 'normal', // Default margin for larger screens
                            }, '& .MuiInputLabel-root': {
                              lineHeight: '2', // Further fine-tune the label spacing
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
                          fontSize: '0.75rem',  // Adjust the size of the label
                          color: '#9e9e9e',     // Set the label color to grey
                        },
                      }}
                      sx={{
                        '& .MuiInputBase-root': {
                          fontSize: '1rem', fontWeight: '400', color: '#575252' // You can adjust this to fit your design needs
                        },
                        margin: {
                          xs: '0px 0', // Less margin for mobile view
                          sm: 'normal', // Default margin for larger screens
                        }, '& .MuiInputLabel-root': {
                          lineHeight: '2', // Further fine-tune the label spacing
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
                          fontSize: '0.75rem',  // Adjust the size of the label
                          color: '#9e9e9e',     // Set the label color to grey
                        },
                      }}
                      sx={{
                        '& .MuiInputBase-root': {
                          fontSize: '1rem', fontWeight: '400', color: '#575252' // You can adjust this to fit your design needs
                        },
                        margin: {
                          xs: '0px 0', // Less margin for mobile view
                          sm: 'normal', // Default margin for larger screens
                        }, '& .MuiInputLabel-root': {
                          lineHeight: '2', // Further fine-tune the label spacing
                        },
                      }}
                    />
                  )}
                />
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 5 }}>
                  <BlackButton
                    isLoading={isLoading}
                    buttonText={getPaymentButtonText(paymentModeConfig)} // Use utility function
                    type="submit"
                    disabled={isPaymentProcessing || isLoading || purchaseInitiated} // Disable if purchase is initiated
                  />
                </Box>
              </Box>
            )}
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
