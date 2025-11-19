'use client';

import React from 'react';
import { Dialog, DialogContent, IconButton, Box, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import MerchantHostedPayment from '@/components/payments/MerchantHostedPayment';

const PaymentDialog = ({ open, onClose, orderId, amount, orderDetails }) => {
  const handlePaymentSuccess = (response) => {
    // Payment initiated, close dialog
    if (response?.txnId) {
      // For redirect-based flows (3DS, Net Banking, Wallets), the redirect will happen
      // For UPI, polling is already happening in the component
      // We can close the dialog after a brief delay
      setTimeout(() => {
        onClose();
      }, 500);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={(event, reason) => {
        // Prevent closing by clicking outside or pressing ESC during payment
        if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
          return;
        }
        onClose();
      }}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: 'hidden',
        },
      }}
    >
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          bgcolor: 'background.paper',
          borderBottom: '1px solid',
          borderColor: 'divider',
          px: 2,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Complete Payment
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Secure payment powered by PayU
          </Typography>
        </Box>
        <IconButton
          onClick={onClose}
          sx={{
            color: 'text.secondary',
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          <CloseIcon />
        </IconButton>
      </Box>

      <DialogContent sx={{ p: 0 }}>
        <MerchantHostedPayment
          orderId={orderId}
          amount={amount}
          orderDetails={orderDetails}
          onSuccess={handlePaymentSuccess}
          onClose={onClose}
        />
      </DialogContent>
    </Dialog>
  );
};

export default PaymentDialog;
