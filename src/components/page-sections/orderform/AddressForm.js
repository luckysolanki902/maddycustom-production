'use client';

import React, { useRef } from 'react';
import { Box, TextField, Autocomplete, Typography, useMediaQuery } from '@mui/material';
import { motion } from 'framer-motion';
import { Controller } from 'react-hook-form';
import theme from '@/styles/theme';
import indianStates from '@/lib/constants/indianStates';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import HomeIcon from '@mui/icons-material/Home';
import PinDropIcon from '@mui/icons-material/PinDrop';

const AddressForm = ({ 
  control, 
  errors, 
  watch, 
  isPincodeValid, 
  pincodeCheckInProgress,
  validatePincode,
  onSubmit
}) => {
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isSmallHeight = useMediaQuery('(max-height: 650px)');
  const isVerySmallHeight = useMediaQuery('(max-height: 550px)');
  const isTinyHeight = useMediaQuery('(max-height: 480px)');

  // Field references for navigation
  const flatDetailsRef = useRef(null);
  const addressLine1Ref = useRef(null);
  const cityRef = useRef(null);
  const stateRef = useRef(null);
  const pincodeRef = useRef(null);
  const emailRef = useRef(null);

  // Navigation handler
  const handleFieldNavigation = (currentField, nextFieldRef) => {
    if (nextFieldRef && nextFieldRef.current) {
      // Focus next field
      const nextInput = nextFieldRef.current.querySelector('input') || nextFieldRef.current;
      if (nextInput && nextInput.focus) {
        setTimeout(() => nextInput.focus(), 100);
      }
    } else {
      // Last field - submit the form
      if (isPincodeValid) {
        onSubmit();
      }
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: {
        duration: 0.5,
        ease: "easeOut",
        staggerChildren: 0.1
      }
    }
  };

  const fieldVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.3, ease: "easeOut" }
    }
  };

  const createTextFieldSx = (hasIcon = false) => ({
    '& .MuiOutlinedInput-root': {
      fontFamily: 'Jost, sans-serif',
      fontSize: isTinyHeight ? '0.8rem' : isVerySmallHeight ? '0.85rem' : isMobile ? '0.9rem' : '1rem',
      height: isTinyHeight ? '40px' : isVerySmallHeight ? '42px' : isMobile ? '46px' : '50px',
      borderRadius: '14px',
      backgroundColor: '#fafbfc',
      border: '1px solid #e8eaed',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      ...(hasIcon && {
        paddingLeft: '8px',
      }),
      '&:hover': {
        backgroundColor: '#f8f9fa',
        borderColor: '#dadce0',
        transform: 'translateY(-1px)',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
      },
      '&.Mui-focused': {
        backgroundColor: '#fff',
        borderColor: '#2d2d2d',
        boxShadow: '0 0 0 3px rgba(45, 45, 45, 0.1)',
        transform: 'translateY(-1px)',
      },
      '& .MuiOutlinedInput-notchedOutline': {
        border: 'none',
      },
    },
    '& .MuiOutlinedInput-notchedOutline': {
      border: 'none',
    },
    '& .MuiInputLabel-root': {
      fontFamily: 'Jost, sans-serif',
      fontSize: isTinyHeight ? '0.75rem' : isVerySmallHeight ? '0.8rem' : isMobile ? '0.85rem' : '0.9rem',
      fontWeight: 500,
      color: '#5f6368',
      backgroundColor: 'transparent',
      padding: '0 4px',
      transform: `translate(14px, ${isTinyHeight ? '10px' : isVerySmallHeight ? '12px' : '16px'}) scale(1)`,
      '&.MuiInputLabel-shrink': {
        transform: 'translate(14px, -9px) scale(0.75)',
        backgroundColor: '#fff',
        padding: '0 8px',
        borderRadius: '4px',
        color: '#2d2d2d',
        fontWeight: 600,
      },
      '&.Mui-focused': {
        color: '#2d2d2d',
      },
      '&.Mui-error': {
        color: '#d32f2f',
      },
    },
    '& .MuiFormHelperText-root': {
      fontFamily: 'Jost, sans-serif',
      fontSize: '0.7rem',
      marginLeft: '4px',
      marginTop: '4px',
    },
  });

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      <Box
        component="form"
        onSubmit={onSubmit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && isPincodeValid) {
            e.preventDefault();
            onSubmit();
          }
        }}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          // margin: '0 auto',
          px: isMobile ? 2.5 : 4,
          py: isTinyHeight ? 1.5 : isVerySmallHeight ? 2 : isMobile ? 2 : 2.5,
          overflow: 'auto',
        }}
      >
        {/* Form Fields */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: isTinyHeight ? 1.2 : isVerySmallHeight ? 1.5 : isMobile ? 2.5 : 3.5,
            flex: 1,
          }}
        >
          {/* Flat/House Number & Building Name */}
          <motion.div variants={fieldVariants}>
            <Controller
              name="flatDetails"
              control={control}
              rules={{
                required: 'Flat/House number is required',
                minLength: {
                  value: 2,
                  message: 'Please enter a valid flat/house number'
                }
              }}
              render={({ field }) => (
                <TextField
                  {...field}
                  ref={flatDetailsRef}
                  fullWidth
                  label="Flat/House Number & Building Name"
                  placeholder="e.g., 123A, Speed Tower"
                  error={!!errors.flatDetails}
                  helperText={errors.flatDetails?.message}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleFieldNavigation('flatDetails', addressLine1Ref);
                    }
                  }}
                  InputProps={{
                    startAdornment: (
                      <HomeIcon sx={{ color: '#9ca3af', mr: 1.5, fontSize: 18 }} />
                    ),
                  }}
                  sx={createTextFieldSx(true)}
                />
              )}
            />
          </motion.div>

          {/* Area/Sector/Locality */}
          <motion.div variants={fieldVariants}>
            <Controller
              name="addressLine1"
              control={control}
              rules={{
                required: 'Area/Sector/Locality is required',
                minLength: {
                  value: 3,
                  message: 'Please enter a valid area/locality'
                }
              }}
              render={({ field }) => (
                <TextField
                  {...field}
                  ref={addressLine1Ref}
                  fullWidth
                  label="Area/Sector/Locality"
                  placeholder="e.g., Sector 62, Speedway Colony"
                  error={!!errors.addressLine1}
                  helperText={errors.addressLine1?.message}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleFieldNavigation('addressLine1', cityRef);
                    }
                  }}
                  InputProps={{
                    startAdornment: (
                      <LocationOnIcon sx={{ color: '#9ca3af', mr: 1.5, fontSize: 18 }} />
                    ),
                  }}
                  sx={createTextFieldSx(true)}
                />
              )}
            />
          </motion.div>

          {/* City and State Row */}
          <motion.div variants={fieldVariants}>
            <Box sx={{ display: 'flex', gap: isMobile ? 1.5 : 2 }}>
              <Controller
                name="city"
                control={control}
                rules={{
                  required: 'City is required',
                  minLength: {
                    value: 2,
                    message: 'Please enter a valid city'
                  }
                }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    ref={cityRef}
                    fullWidth
                    label="City"
                    placeholder="Mumbai"
                    error={!!errors.city}
                    helperText={errors.city?.message}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleFieldNavigation('city', stateRef);
                      }
                    }}
                    sx={createTextFieldSx()}
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
                    ref={stateRef}
                    options={indianStates}
                    getOptionLabel={(option) => option}
                    isOptionEqualToValue={(option, value) => option === value}
                    onChange={(event, newValue) => {
                      field.onChange(newValue);
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="State"
                        placeholder="Maharashtra"
                        error={!!errors.state}
                        helperText={errors.state?.message}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleFieldNavigation('state', pincodeRef);
                          }
                        }}
                        sx={createTextFieldSx()}
                      />
                    )}
                    sx={{
                      width: '100%',
                      '& .MuiAutocomplete-inputRoot': {
                        fontFamily: 'Jost, sans-serif',
                        fontSize: isTinyHeight ? '0.8rem' : isVerySmallHeight ? '0.85rem' : isMobile ? '0.9rem' : '1rem',
                        height: isTinyHeight ? '40px' : isVerySmallHeight ? '42px' : isMobile ? '46px' : '50px',
                        borderRadius: '14px',
                        backgroundColor: '#fafbfc',
                        border: '1px solid #e8eaed',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        '&:hover': {
                          backgroundColor: '#f8f9fa',
                          borderColor: '#dadce0',
                          transform: 'translateY(-1px)',
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                        },
                        '&.Mui-focused': {
                          backgroundColor: '#fff',
                          borderColor: '#2d2d2d',
                          boxShadow: '0 0 0 3px rgba(45, 45, 45, 0.1)',
                          transform: 'translateY(-1px)',
                        },
                      },
                      '& .MuiOutlinedInput-notchedOutline': {
                        border: 'none',
                      },
                      '& .MuiAutocomplete-endAdornment': {
                        right: '12px',
                      },
                    }}
                  />
                )}
              />
            </Box>
          </motion.div>

          {/* Pincode and Email Row */}
          <motion.div variants={fieldVariants}>
            <Box sx={{ display: 'flex', gap: isMobile ? 0 : 2, flexDirection: isMobile ? 'column' : 'row' }}>
              {/* Pincode */}
              <Box sx={{ flex: isMobile ? 1 : 1, mb: isMobile ? 2 : 0 }}>
                <Controller
                  name="pincode"
                  control={control}
                  rules={{
                    required: 'PIN Code is required',
                    pattern: {
                      value: /^\d{6}$/,
                      message: 'Please enter a valid 6-digit PIN code'
                    }
                  }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      ref={pincodeRef}
                      fullWidth
                      label="PIN Code"
                      placeholder="400001"
                      error={!!errors.pincode}
                      helperText={
                        errors.pincode?.message ||
                        (field.value && field.value.length === 6 && !isPincodeValid && !pincodeCheckInProgress
                          ? 'This PIN code is not serviceable'
                          : '')
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleFieldNavigation('pincode', emailRef);
                        }
                      }}
                      InputProps={{
                        startAdornment: (
                          <PinDropIcon sx={{ color: '#9ca3af', mr: 1.5, fontSize: 18 }} />
                        ),
                        endAdornment: pincodeCheckInProgress ? (
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          >
                            <Box
                              sx={{
                                width: 18,
                                height: 18,
                                border: '2px solid #e5e7eb',
                                borderTop: '2px solid #2d2d2d',
                                borderRadius: '50%',
                                mr: 1,
                              }}
                            />
                          </motion.div>
                        ) : (
                          field.value && field.value.length === 6 && isPincodeValid && (
                            <motion.div
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{ type: "spring", stiffness: 500, damping: 20 }}
                            >
                              <Box
                                sx={{
                                  width: 24,
                                  height: 24,
                                  borderRadius: '50%',
                                  backgroundColor: '#2d2d2d',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  mr: 1,
                                  boxShadow: '0 2px 8px rgba(45, 45, 45, 0.3)',
                                }}
                              >
                                <Typography sx={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>✓</Typography>
                              </Box>
                            </motion.div>
                          )
                        ),
                      }}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                        field.onChange(value);
                        if (value.length === 6 && validatePincode) {
                          validatePincode(value);
                        }
                      }}
                      inputProps={{
                        inputMode: 'numeric',
                        pattern: '[0-9]*',
                        maxLength: 6,
                      }}
                      sx={createTextFieldSx(true)}
                    />
                  )}
                />
              </Box>

              {/* Email (Optional) */}
              <Box sx={{ flex: isMobile ? 1 : 1 }}>
                <Controller
                  name="email"
                  control={control}
                  rules={{
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Please enter a valid email address'
                    }
                  }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      ref={emailRef}
                      fullWidth
                      label="Email (Optional)"
                      placeholder="racer@example.com"
                      error={!!errors.email}
                      helperText={errors.email?.message}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleFieldNavigation('email', null); // Last field, will submit
                        }
                      }}
                      sx={createTextFieldSx()}
                    />
                  )}
                />
              </Box>
            </Box>
          </motion.div>
        </Box>
      </Box>
    </motion.div>
  );
};

export default AddressForm;
