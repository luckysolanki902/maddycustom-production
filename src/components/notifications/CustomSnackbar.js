// @/components/notifications/CustomSnackbar.js

'use client';

import React from 'react';
import Snackbar from '@mui/material/Snackbar';
import MuiAlert from '@mui/material/Alert';

const CustomSnackbar = ({ open, message, severity, handleClose }) => {

  return (
    <Snackbar
      open={open}
      autoHideDuration={3000}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <MuiAlert
        onClose={handleClose}
        severity={severity}
        elevation={6}
        variant="filled"
      >
        {message}
      </MuiAlert>
    </Snackbar>
  );
};

export default CustomSnackbar;
