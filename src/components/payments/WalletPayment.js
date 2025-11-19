'use client';

import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Stack,
  Paper,
  Alert,
  Chip,
} from '@mui/material';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import axios from 'axios';

const WALLETS = [
  {
    code: 'PAYTM',
    name: 'Paytm',
    logo: '💰',
    description: 'Pay using Paytm wallet',
    color: '#00BAF2',
  },
  {
    code: 'PHONEPE',
    name: 'PhonePe',
    logo: '📱',
    description: 'Pay using PhonePe wallet',
    color: '#5F259F',
  },
  {
    code: 'MOBIKWIK',
    name: 'Mobikwik',
    logo: '💳',
    description: 'Pay using Mobikwik wallet',
    color: '#E32529',
  },
  {
    code: 'OLAMONEY',
    name: 'Ola Money',
    logo: '🚗',
    description: 'Pay using Ola Money wallet',
    color: '#00D77F',
  },
  {
    code: 'FREECHARGE',
    name: 'Freecharge',
    logo: '⚡',
    description: 'Pay using Freecharge wallet',
    color: '#FFC400',
  },
];

const WalletPayment = ({
  orderId,
  amount,
  orderDetails,
  onSuccess,
  onError,
  onProcessingChange,
}) => {
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleWalletSelect = (wallet) => {
    setSelectedWallet(wallet);
  };

  const handleProceed = useCallback(async () => {
    if (!selectedWallet) {
      return;
    }

    setIsProcessing(true);
    onProcessingChange(true);

    try {
      const response = await axios.post('/api/payments/payu/seamless/wallet', {
        orderId,
        walletCode: selectedWallet.code,
      });

      const { redirectUrl, txnId } = response.data;
      
      if (redirectUrl) {
        // Redirect to wallet login/payment page
        window.location.href = redirectUrl;
      } else {
        onSuccess({ txnId, status: 'success' });
      }
    } catch (error) {
      console.error('Wallet payment failed', error);
      onError(error.response?.data || { message: 'Failed to initiate wallet payment' });
      setIsProcessing(false);
      onProcessingChange(false);
    }
  }, [selectedWallet, orderId, onSuccess, onError, onProcessingChange]);

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h6" gutterBottom>
            Select Wallet
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Choose your preferred wallet to complete payment
          </Typography>
        </Box>

        <Stack spacing={2}>
          {WALLETS.map((wallet) => (
            <Paper
              key={wallet.code}
              elevation={0}
              onClick={() => handleWalletSelect(wallet)}
              sx={{
                p: 2.5,
                cursor: 'pointer',
                border: '2px solid',
                borderColor: selectedWallet?.code === wallet.code ? wallet.color : 'divider',
                borderRadius: 2,
                bgcolor: selectedWallet?.code === wallet.code ? `${wallet.color}08` : 'transparent',
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: wallet.color,
                  bgcolor: `${wallet.color}08`,
                  transform: 'translateY(-2px)',
                  boxShadow: `0 4px 12px ${wallet.color}20`,
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    width: 56,
                    height: 56,
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: `${wallet.color}15`,
                    fontSize: '2rem',
                  }}
                >
                  {wallet.logo}
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {wallet.name}
                    </Typography>
                    {selectedWallet?.code === wallet.code && (
                      <Chip
                        label="Selected"
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.7rem',
                          bgcolor: wallet.color,
                          color: 'white',
                        }}
                      />
                    )}
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {wallet.description}
                  </Typography>
                </Box>
              </Box>
            </Paper>
          ))}
        </Stack>

        {selectedWallet && (
          <Alert severity="info">
            You will be redirected to {selectedWallet.name} to complete your payment.
          </Alert>
        )}

        <Button
          fullWidth
          variant="contained"
          size="large"
          onClick={handleProceed}
          disabled={!selectedWallet || isProcessing}
          startIcon={isProcessing ? <CircularProgress size={20} /> : <AccountBalanceWalletIcon />}
          sx={{
            py: 1.5,
            bgcolor: selectedWallet?.color || '#8E44AD',
            '&:hover': {
              bgcolor: selectedWallet?.color
                ? `${selectedWallet.color}CC`
                : '#7D3C98',
            },
          }}
        >
          {isProcessing ? 'Redirecting...' : `Pay with ${selectedWallet?.name || 'Wallet'}`}
        </Button>

        <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
          Make sure you have sufficient balance in your wallet
        </Typography>
      </Stack>
    </Box>
  );
};

export default React.memo(WalletPayment);
