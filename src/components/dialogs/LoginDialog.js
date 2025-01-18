// @/components/dialogs/LoginDialog.js

'use client';

import React, { useEffect, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, TextField, Box, IconButton } from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import BlackButton from '../utils/BlackButton';
import axios from 'axios';
import { useDispatch, useSelector } from 'react-redux';
import { setUserDetails, setUserExists, setLoginDialogShown } from '../../store/slices/orderFormSlice';
import CustomSnackbar from '../notifications/CustomSnackbar';
import { usePathname } from 'next/navigation';
import CloseIcon from '@mui/icons-material/Close';
import debounce from 'lodash.debounce';

const LoginDialog = () => {
  const dispatch = useDispatch();
  const pathname = usePathname();
  
  // Access Redux state
  const userExists = useSelector((state) => state.orderForm.userExists);
  const loginDialogShown = useSelector((state) => state.orderForm.loginDialogShown);
  const { timeSpentOnWebsite, scrolledMoreThan60Percent } = useSelector((state) => state.userBehavior);
  console.log({ userExists, loginDialogShown, timeSpentOnWebsite, scrolledMoreThan60Percent });
  
  const { control, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: {
      phoneNumber: '',
    },
  });

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');

  const [open, setOpen] = useState(false);

  // Function to show snackbar
  const showSnackbar = (message, severity = 'success') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  // Handle form submission
  const onSubmit = async (data) => {
    try {
      const response = await axios.post('/api/user/create', {
        phoneNumber: data.phoneNumber,
      });
      
      if (response.data.message === 'User already exists' || response.data.message === 'User exists and name updated') {
        dispatch(setUserExists(true));
        dispatch(setUserDetails({ phoneNumber: data.phoneNumber, userId: response.data.userId }));
        showSnackbar('Mobile number already registered.', 'info');
      } else if (response.data.message === 'User created successfully') {
        dispatch(setUserDetails({ phoneNumber: data.phoneNumber, userId: response.data.user.userId }));
        showSnackbar('Mobile number registered successfully.', 'success');
      }
      reset();
      handleClose(); // Use handleClose to ensure consistent behavior
    } catch (error) {
      console.error('Error in LoginDialog:', error.message);
      const errorMessage = error.response?.data?.message || 'An error occurred.';
      showSnackbar(errorMessage, 'error');
    }
  };

  // Function to handle closing the dialog
  const handleClose = () => {
    setOpen(false);
    dispatch(setLoginDialogShown(true));
  };

  // Open the dialog if conditions are met
  useEffect(() => {
    if (
      timeSpentOnWebsite >= 30 && // Total time spent on website is at least 30 seconds
      scrolledMoreThan60Percent && 
      !loginDialogShown && 
      !userExists && 
      pathname !== '/viewcart'
    ) {
      setOpen(true);
      dispatch(setLoginDialogShown(true)); // Prevent showing again
      console.log('Opening LoginDialog.');
    }
  }, [timeSpentOnWebsite, scrolledMoreThan60Percent, loginDialogShown, userExists, pathname, dispatch]);

  // Prevent rendering on /viewcart
  if (pathname === '/viewcart') return null;

  return (
    <>
      <Dialog
        open={open}
        onClose={(event, reason) => {
          if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
            // Prevent closing the dialog
            return;
          }
          handleClose();
        }}
        disableEscapeKeyDown
      >
        <DialogTitle sx={{ m: 0, p: 2 }}>
          Subscribe to our Newsletter
          <IconButton
            aria-label="close"
            onClick={handleClose}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              color: (theme) => theme.palette.grey[500],
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ display: 'flex', flexDirection: 'column', gap: '1rem', mt: 1 }}>
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
                  {...field}
                  label="Mobile Number"
                  variant="standard"
                  fullWidth
                  error={!!errors.phoneNumber}
                  helperText={errors.phoneNumber ? errors.phoneNumber.message : ''}
                />
              )}
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
              <BlackButton buttonText="Submit" type="submit" />
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
    </>
  );
};

export default LoginDialog;
