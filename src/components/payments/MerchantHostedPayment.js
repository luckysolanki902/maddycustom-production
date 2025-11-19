'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  IconButton,
  CircularProgress,
  Alert,
  Snackbar,
  Stack,
  Paper,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import { PAYMENT_PROVIDERS } from '@/lib/payments/providers';
import UpiPayment from './UpiPayment';
import CardPayment from './CardPayment';
import NetBankingPayment from './NetBankingPayment';
import WalletPayment from './WalletPayment';

const PAYMENT_METHODS = [
  {
    id: 'upi',
    title: 'UPI',
    subtitle: 'Google Pay, PhonePe, Paytm & more',
    icon: QrCode2Icon,
    color: '#018749',
    badge: 'Fastest',
  },
  {
    id: 'card',
    title: 'Card',
    subtitle: 'Credit or Debit Card',
    icon: CreditCardIcon,
    color: '#1A4AE6',
    badge: null,
  },
  {
    id: 'netbanking',
    title: 'Net Banking',
    subtitle: 'All major banks supported',
    icon: AccountBalanceIcon,
    color: '#F39C12',
    badge: null,
  },
  {
    id: 'wallet',
    title: 'Wallets',
    subtitle: 'Paytm, PhonePe & more',
    icon: AccountBalanceWalletIcon,
    color: '#8E44AD',
    badge: null,
  },
];

const MerchantHostedPayment = ({
  orderId,
  amount,
  onSuccess,
  onClose,
  orderDetails,
}) => {
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  const showSnackbar = useCallback((message, severity = 'info') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const handleBack = useCallback(() => {
    if (isProcessing) {
      showSnackbar('Please wait for the current operation to complete', 'warning');
      return;
    }
    setSelectedMethod(null);
  }, [isProcessing, showSnackbar]);

  const handleMethodSelect = useCallback((methodId) => {
    setSelectedMethod(methodId);
  }, []);

  const handlePaymentSuccess = useCallback((response) => {
    showSnackbar('Payment initiated successfully', 'success');
    if (onSuccess) {
      onSuccess(response);
    }
  }, [onSuccess, showSnackbar]);

  const handlePaymentError = useCallback((error) => {
    showSnackbar(error?.message || 'Payment failed. Please try again.', 'error');
    setIsProcessing(false);
  }, [showSnackbar]);

  const renderPaymentMethodSelector = () => (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
        Choose Payment Method
      </Typography>
      <Stack spacing={2}>
        {PAYMENT_METHODS.map((method) => {
          const IconComponent = method.icon;
          return (
            <Paper
              key={method.id}
              elevation={0}
              onClick={() => handleMethodSelect(method.id)}
              sx={{
                p: 2.5,
                cursor: 'pointer',
                border: '2px solid',
                borderColor: 'divider',
                borderRadius: 2,
                transition: 'all 0.2s ease',
                position: 'relative',
                overflow: 'hidden',
                '&:hover': {
                  borderColor: method.color,
                  bgcolor: `${method.color}08`,
                  transform: 'translateY(-2px)',
                  boxShadow: `0 4px 12px ${method.color}20`,
                },
                '&:active': {
                  transform: 'translateY(0)',
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: `${method.color}15`,
                    color: method.color,
                  }}
                >
                  <IconComponent sx={{ fontSize: 28 }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {method.title}
                    </Typography>
                    {method.badge && (
                      <Box
                        sx={{
                          px: 1,
                          py: 0.25,
                          borderRadius: 1,
                          bgcolor: method.color,
                          color: 'white',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                        }}
                      >
                        {method.badge}
                      </Box>
                    )}
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {method.subtitle}
                  </Typography>
                </Box>
              </Box>
            </Paper>
          );
        })}
      </Stack>
    </Box>
  );

  const renderPaymentInterface = () => {
    const commonProps = {
      orderId,
      amount,
      orderDetails,
      onSuccess: handlePaymentSuccess,
      onError: handlePaymentError,
      onProcessingChange: setIsProcessing,
    };

    switch (selectedMethod) {
      case 'upi':
        return <UpiPayment {...commonProps} />;
      case 'card':
        return <CardPayment {...commonProps} />;
      case 'netbanking':
        return <NetBankingPayment {...commonProps} />;
      case 'wallet':
        return <WalletPayment {...commonProps} />;
      default:
        return null;
    }
  };

  // Prevent browser back button when payment interface is open
  React.useEffect(() => {
    if (!selectedMethod) return;

    const handlePopState = (e) => {
      e.preventDefault();
      window.history.pushState(null, '', window.location.href);
      handleBack();
    };

    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [selectedMethod, handleBack]);

  return (
    <Box sx={{ position: 'relative', minHeight: 400 }}>
      {selectedMethod && (
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
            gap: 2,
          }}
        >
          <IconButton
            onClick={handleBack}
            disabled={isProcessing}
            sx={{ color: 'text.secondary' }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {PAYMENT_METHODS.find((m) => m.id === selectedMethod)?.title}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Amount: ₹{amount?.toFixed(2)}
            </Typography>
          </Box>
        </Box>
      )}

      {selectedMethod ? renderPaymentInterface() : renderPaymentMethodSelector()}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default React.memo(MerchantHostedPayment);
