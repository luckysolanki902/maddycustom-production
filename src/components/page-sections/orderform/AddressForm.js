'use client';

import React from 'react';
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
  validatePincode 
}) => {
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isSmallHeight = useMediaQuery('(max-height: 650px)');

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
      fontSize: isMobile ? '0.9rem' : '1rem',
      height: isMobile ? '52px' : '56px',
      borderRadius: '16px',
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
      fontSize: isMobile ? '0.85rem' : '0.9rem',
      fontWeight: 500,
      color: '#5f6368',
      backgroundColor: 'transparent',
      padding: '0 4px',
      transform: 'translate(14px, 16px) scale(1)',
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
      fontSize: '0.75rem',
      marginLeft: '4px',
      marginTop: '6px',
    },
  });

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      style={{ width: '100%', height: '100%' }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          maxWidth: '600px',
          margin: '0 auto',
          px: isMobile ? 3 : 4,
          py: isMobile ? 2 : 3,
          minHeight: 'auto', // Remove fixed height constraint
        }}
      >
        {/* Header */}
        <motion.div
          variants={fieldVariants}
          style={{ marginBottom: isMobile ? '24px' : '32px' }}
        >
          <Typography
            variant={isMobile ? "h5" : "h4"}
            sx={{
              fontFamily: 'Orbitron, monospace',
              fontWeight: 700,
              color: '#1a202c',
              textAlign: 'center',
              mb: 1,
              fontSize: isMobile ? '1.5rem' : '1.75rem',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.5px',
            }}
          >
            Delivery Address
          </Typography>
          
          <Typography
            variant="body2"
            sx={{
              fontFamily: 'Jost, sans-serif',
              color: '#718096',
              textAlign: 'center',
              fontSize: isMobile ? '0.875rem' : '1rem',
              lineHeight: 1.5,
              maxWidth: '400px',
              margin: '0 auto',
            }}
          >
            Where should we deliver your custom ride?
          </Typography>
        </motion.div>

        {/* Form Fields */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: isMobile ? 2.5 : 3,
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
                  fullWidth
                  label="Flat/House Number & Building Name"
                  placeholder="e.g., 123A, Speed Tower"
                  error={!!errors.flatDetails}
                  helperText={errors.flatDetails?.message}
                  InputProps={{
                    startAdornment: (
                      <HomeIcon sx={{ color: '#9ca3af', mr: 1.5, fontSize: 20 }} />
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
                  fullWidth
                  label="Area/Sector/Locality"
                  placeholder="e.g., Sector 62, Speedway Colony"
                  error={!!errors.addressLine1}
                  helperText={errors.addressLine1?.message}
                  InputProps={{
                    startAdornment: (
                      <LocationOnIcon sx={{ color: '#9ca3af', mr: 1.5, fontSize: 20 }} />
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
                    fullWidth
                    label="City"
                    placeholder="Mumbai"
                    error={!!errors.city}
                    helperText={errors.city?.message}
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
                        sx={createTextFieldSx()}
                      />
                    )}
                    sx={{
                      width: '100%',
                      '& .MuiAutocomplete-inputRoot': {
                        fontFamily: 'Jost, sans-serif',
                        fontSize: isMobile ? '0.9rem' : '1rem',
                        height: isMobile ? '52px' : '56px',
                        borderRadius: '16px',
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

          {/* Pincode */}
          <motion.div variants={fieldVariants}>
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
                  InputProps={{
                    startAdornment: (
                      <PinDropIcon sx={{ color: '#9ca3af', mr: 1.5, fontSize: 20 }} />
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
          </motion.div>

          {/* Email (Optional) */}
          <motion.div variants={fieldVariants}>
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
                  fullWidth
                  label="Email (Optional)"
                  placeholder="racer@example.com"
                  error={!!errors.email}
                  helperText={errors.email?.message}
                  sx={createTextFieldSx()}
                />
              )}
            />
          </motion.div>
        </Box>
      </Box>
    </motion.div>
  );
};

export default AddressForm;
