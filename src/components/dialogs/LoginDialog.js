'use client';

import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, Box, IconButton, Button } from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { useDispatch, useSelector } from 'react-redux';
import { setUserDetails, setUserExists, setLoginDialogShown } from '../../store/slices/orderFormSlice';
import CustomSnackbar from '../notifications/CustomSnackbar';
import { usePathname } from 'next/navigation';
import CloseIcon from '@mui/icons-material/Close';
import Image from 'next/image';
import axios from 'axios';

const LoginDialog = () => {
  const dispatch = useDispatch();
  const pathname = usePathname();

  // Access Redux state
  const userExists = useSelector((state) => state.orderForm.userExists);
  const loginDialogShown = useSelector((state) => state.orderForm.loginDialogShown);
  const { timeSpentOnWebsite, scrolledMoreThan60Percent } = useSelector((state) => state.userBehavior);
  const imageBaseUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
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
        source: 'login-popup',
      });

      if (response.data.message === 'User already exists' || response.data.message === 'User exists and name updated') {
        dispatch(setUserExists(true));
        dispatch(setUserDetails({ phoneNumber: data.phoneNumber, userId: response.data.userId }));
        showSnackbar('Welcome to MaddyCustom!.', 'success');
      } else if (response.data.message === 'User created successfully') {
        dispatch(setUserDetails({ phoneNumber: data.phoneNumber, userId: response.data.user.userId }));
        showSnackbar('Welcome to MaddyCustom!.', 'success');
      }
      reset();
      handleClose(); // Use handleClose to ensure consistent behavior
    } catch (error) {
      console.error('Error in LoginDialog:', error.message);
      const errorMessage = error.response?.data?.message || 'An error occurred.';
      showSnackbar('Could not login!', 'error');
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
        fullWidth
        maxWidth="xs"
        PaperProps={{
          sx: {
            overflow: 'unset',
            borderRadius: '1rem',
            // gray little shadow
            boxShadow: '0 0 4px 8px rgba(0, 0, 0, 0.11)',
          },
        }}
      >
        <DialogContent dividers>
          <Box sx={{ width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
            <IconButton
              aria-label="close"
              onClick={handleClose}
              sx={{
                color: (theme) => theme.palette.grey[500],
                padding: "0.5rem",
                boxShadow: "0 0 4px 2px #4de1ff24, 0 0 4px 2px #40bcff33",
                borderRadius: '0.5rem',
              }}
            >
              <CloseIcon />
            </IconButton>
          </Box>

          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              boxShadow: '0 0 8px 8px rgba(77, 225, 255, 0.11)',
              borderRadius: '50%',
              padding: '1rem',
              width: { xs: '100px', sm: '120px' },
              height: { xs: '100px', sm: '120px' },
              overflow: 'hidden',
              margin: 'auto',
              marginBottom: { xs: '1rem', sm: '2rem' }
            }}
          >
            <Image
              src={`${imageBaseUrl}/assets/logos/just-helmet.png`}
              alt="MaddyCustom"
              width={150}
              height={150}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
              }}
            />
          </Box>

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
              render={({ field }) => {
                const handleChange = (e) => {
                  const value = e.target.value;
                  // Remove all non-digit characters
                  const numericValue = value.replace(/\D/g, '');
                  // Update the form state with the numeric value
                  field.onChange(numericValue);
                };

                return (
                  <div style={{ position: 'relative' }}>
                    <input
                      {...field}
                      onChange={handleChange}
                      type="tel"
                      inputMode="numeric"
                      pattern="\d*"
                      style={{
                        borderRadius: '1.2rem',
                        boxShadow: 'inset 0 0 4px 3px rgba(56, 167, 186, 0.14)',
                        outline: "none",
                        border: errors.phoneNumber ? '2px solid red' : 'none',
                        padding: '0.8rem 1rem',
                        color: "rgb(85, 85, 85)",
                        width: '100%',
                        boxSizing: 'border-box',
                        fontFamily:"Jost",
                      }}
                      placeholder='Mobile Number'
                      aria-invalid={errors.phoneNumber ? 'true' : 'false'}
                      aria-describedby="phoneNumber-error"
                    />
                    {errors.phoneNumber && (
                      <span
                        id="phoneNumber-error"
                        style={{
                          color: 'red',
                          fontSize: '0.8rem',
                          position: 'absolute',
                          top: '100%',
                          left: '0',
                        fontFamily:"Jost",

                        }}
                      >
                        {errors.phoneNumber.message}
                      </span>
                    )}
                  </div>
                );
              }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                style={{
                  borderRadius: '1rem',
                  boxShadow: '0 2px 3px 2px rgba(56, 167, 186, 0.14)',
                  border: 'none',
                  outline: 'none',
                  padding: '0.4rem 1.5rem',
                  backgroundColor: 'white',
                  fontSize: '1rem',
                  margin: 'auto',
                  color: '#77c6cb',
                  cursor: 'pointer',
                  fontFamily:'Jost',
                }}
              >
                Login
              </Button>
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
