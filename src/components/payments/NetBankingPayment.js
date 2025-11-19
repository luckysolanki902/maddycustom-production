'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Stack,
  Paper,
  TextField,
  InputAdornment,
  Alert,
  Chip,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import axios from 'axios';

const POPULAR_BANKS = [
  { code: 'HDFC', name: 'HDFC Bank', logo: '🏦' },
  { code: 'ICIB', name: 'ICICI Bank', logo: '🏦' },
  { code: 'SBIB', name: 'State Bank of India', logo: '🏦' },
  { code: 'UTI', name: 'Axis Bank', logo: '🏦' },
  { code: 'KKBK', name: 'Kotak Mahindra Bank', logo: '🏦' },
  { code: 'YESB', name: 'Yes Bank', logo: '🏦' },
  { code: 'INDB', name: 'IndusInd Bank', logo: '🏦' },
  { code: 'IDIB', name: 'IDBI Bank', logo: '🏦' },
  { code: 'FEDERAL', name: 'Federal Bank', logo: '🏦' },
  { code: 'CITI', name: 'Citi Bank', logo: '🏦' },
];

const OTHER_BANKS = [
  { code: 'PUNB_R', name: 'Punjab National Bank' },
  { code: 'CNRB', name: 'Canara Bank' },
  { code: 'CORP', name: 'Union Bank of India' },
  { code: 'BOI', name: 'Bank of India' },
  { code: 'BOB_R', name: 'Bank of Baroda' },
  { code: 'CBI', name: 'Central Bank of India' },
  { code: 'IDBI', name: 'Indian Bank' },
  { code: 'VIJB', name: 'Vijaya Bank' },
  { code: 'ANDB', name: 'Andhra Bank' },
  { code: 'AUBL', name: 'AU Small Finance Bank' },
  { code: 'BANDHAN', name: 'Bandhan Bank' },
  { code: 'CSB', name: 'Catholic Syrian Bank' },
  { code: 'DCB', name: 'DCB Bank' },
  { code: 'DLB', name: 'Dhanlaxmi Bank' },
  { code: 'EQUITAS', name: 'Equitas Small Finance Bank' },
  { code: 'ESAF', name: 'ESAF Small Finance Bank' },
  { code: 'FINO', name: 'Fino Payments Bank' },
  { code: 'JANA', name: 'Jana Small Finance Bank' },
  { code: 'JKB', name: 'Jammu and Kashmir Bank' },
  { code: 'KVB', name: 'Karur Vysya Bank' },
  { code: 'LVB', name: 'Lakshmi Vilas Bank' },
  { code: 'NKGSB', name: 'NKGSB Co-operative Bank' },
  { code: 'RBL', name: 'RBL Bank' },
  { code: 'SARASWAT', name: 'Saraswat Bank' },
  { code: 'SIB', name: 'South Indian Bank' },
  { code: 'TJSB', name: 'TJSB Sahakari Bank' },
  { code: 'UCO', name: 'UCO Bank' },
];

const NetBankingPayment = ({
  orderId,
  amount,
  orderDetails,
  onSuccess,
  onError,
  onProcessingChange,
}) => {
  const [selectedBank, setSelectedBank] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAllBanks, setShowAllBanks] = useState(false);

  const filteredBanks = useMemo(() => {
    const query = searchQuery.toLowerCase();
    const banks = showAllBanks ? [...POPULAR_BANKS, ...OTHER_BANKS] : POPULAR_BANKS;
    
    if (!query) return banks;
    
    return banks.filter((bank) =>
      bank.name.toLowerCase().includes(query) || bank.code.toLowerCase().includes(query)
    );
  }, [searchQuery, showAllBanks]);

  const handleBankSelect = (bank) => {
    setSelectedBank(bank);
  };

  const handleProceed = useCallback(async () => {
    if (!selectedBank) {
      return;
    }

    setIsProcessing(true);
    onProcessingChange(true);

    try {
      const response = await axios.post('/api/payments/payu/seamless/netbanking', {
        orderId,
        bankCode: selectedBank.code,
      });

      const { redirectUrl, txnId } = response.data;
      
      if (redirectUrl) {
        // Redirect to bank login page
        window.location.href = redirectUrl;
      } else {
        onSuccess({ txnId, status: 'success' });
      }
    } catch (error) {
      console.error('Net banking payment failed', error);
      onError(error.response?.data || { message: 'Failed to initiate net banking payment' });
      setIsProcessing(false);
      onProcessingChange(false);
    }
  }, [selectedBank, orderId, onSuccess, onError, onProcessingChange]);

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h6" gutterBottom>
            Select Your Bank
          </Typography>
          <Typography variant="body2" color="text.secondary">
            You&apos;ll be redirected to your bank&apos;s website to complete payment
          </Typography>
        </Box>

        <TextField
          fullWidth
          placeholder="Search for your bank"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          disabled={isProcessing}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />

        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">
              {showAllBanks ? 'All Banks' : 'Popular Banks'}
            </Typography>
            {!searchQuery && (
              <Button
                size="small"
                onClick={() => setShowAllBanks(!showAllBanks)}
                disabled={isProcessing}
              >
                {showAllBanks ? 'Show Less' : `Show All (${OTHER_BANKS.length + POPULAR_BANKS.length})`}
              </Button>
            )}
          </Box>

          <Stack spacing={1.5} sx={{ maxHeight: 400, overflowY: 'auto', pr: 1 }}>
            {filteredBanks.map((bank) => (
              <Paper
                key={bank.code}
                elevation={0}
                onClick={() => handleBankSelect(bank)}
                sx={{
                  p: 2,
                  cursor: 'pointer',
                  border: '2px solid',
                  borderColor: selectedBank?.code === bank.code ? '#F39C12' : 'divider',
                  borderRadius: 2,
                  bgcolor: selectedBank?.code === bank.code ? '#F39C1208' : 'transparent',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    borderColor: '#F39C12',
                    bgcolor: '#F39C1208',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 12px #F39C1220',
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
                      bgcolor: 'grey.100',
                      fontSize: '1.5rem',
                    }}
                  >
                    {bank.logo || '🏦'}
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {bank.name}
                    </Typography>
                    {selectedBank?.code === bank.code && (
                      <Chip
                        label="Selected"
                        size="small"
                        color="warning"
                        sx={{ mt: 0.5, height: 20, fontSize: '0.7rem' }}
                      />
                    )}
                  </Box>
                </Box>
              </Paper>
            ))}

            {filteredBanks.length === 0 && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography color="text.secondary">
                  No banks found matching &quot;{searchQuery}&quot;
                </Typography>
              </Box>
            )}
          </Stack>
        </Box>

        {selectedBank && (
          <Alert severity="info">
            You will be redirected to {selectedBank.name} to complete your payment.
          </Alert>
        )}

        <Button
          fullWidth
          variant="contained"
          size="large"
          onClick={handleProceed}
          disabled={!selectedBank || isProcessing}
          startIcon={isProcessing ? <CircularProgress size={20} /> : <AccountBalanceIcon />}
          sx={{
            py: 1.5,
            bgcolor: '#F39C12',
            '&:hover': { bgcolor: '#E08C03' },
          }}
        >
          {isProcessing ? 'Redirecting...' : `Proceed to ${selectedBank?.name || 'Bank'}`}
        </Button>
      </Stack>
    </Box>
  );
};

export default React.memo(NetBankingPayment);
