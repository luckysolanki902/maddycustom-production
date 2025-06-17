// @/components/notifications/CustomSnackbar.js

'use client';

import React, { useEffect } from 'react';
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

const CustomSnackbar = ({ 
  open, 
  message, 
  severity = 'info', 
  handleClose,
  autoHideDuration = 3000 // Default to 3 seconds (more readable)
}) => {
  // Ensure snackbar closes even if parent doesn't update state
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        if (handleClose) handleClose();
      }, autoHideDuration);
      
      return () => clearTimeout(timer);
    }
  }, [open, autoHideDuration, handleClose]);
  
  return (
    <Snackbar
      open={open}
      autoHideDuration={autoHideDuration}
      onClose={(event, reason) => {
        if (reason !== 'clickaway') { // Don't close when clicking outside
          handleClose();
        }
      }}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
    >
      <WhiteAlert
        onClose={handleClose}
        severity={severity}
        elevation={6}
        variant="filled"
      >
        {message}
      </WhiteAlert>
    </Snackbar>
  );
};

export default CustomSnackbar;