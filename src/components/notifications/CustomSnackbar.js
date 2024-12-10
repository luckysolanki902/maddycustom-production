// @/components/notifications/CustomSnackbar.js

'use client';

import React from 'react';
import Snackbar from '@mui/material/Snackbar';
import MuiAlert from '@mui/material/Alert';
import { styled } from '@mui/material/styles';

// Create a styled version of MuiAlert with a white background
const WhiteAlert = styled(MuiAlert)(({ theme }) => ({
  backgroundColor: 'white',
  boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.2)',
  color: 'black', // Set text color to black or any desired color
  // Override the icon color if you want to customize or remove it
  '& .MuiAlert-icon': {
    color: 'black', // Set icon color to black or any desired color
  },
}));



const CustomSnackbar = ({ open, message, severity, handleClose }) => {
  return (
    <Snackbar
      open={open}
      autoHideDuration={3000} // Increased duration for better visibility
      onClose={handleClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
    >
      <WhiteAlert
        onClose={handleClose}
        severity={severity} // You can still pass severity if you want to use different icons
        elevation={6}
        variant="filled" // Use 'filled' to maintain consistency
      >
        {message}
      </WhiteAlert>
    </Snackbar>
  );
};

export default CustomSnackbar;
