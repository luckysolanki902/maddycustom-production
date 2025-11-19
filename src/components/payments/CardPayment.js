'use client';

import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Stack,
  Grid,
  Alert,
  InputAdornment,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import LockIcon from '@mui/icons-material/Lock';
import axios from 'axios';

const CARD_TYPES = {
  VISA: /^4/,
  MASTERCARD: /^5[1-5]/,
  AMEX: /^3[47]/,
  RUPAY: /^(60|65|81|82)/,
};

const CardPayment = ({
  orderId,
  amount,
  orderDetails,
  onSuccess,
  onError,
  onProcessingChange,
}) => {
  const [cardData, setCardData] = useState({
    cardNumber: '',
    cardName: '',
    expiryMonth: '',
    expiryYear: '',
    cvv: '',
    saveCard: false,
  });
  const [errors, setErrors] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardType, setCardType] = useState(null);

  const detectCardType = (number) => {
    const cleaned = number.replace(/\s/g, '');
    for (const [type, regex] of Object.entries(CARD_TYPES)) {
      if (regex.test(cleaned)) {
        return type;
      }
    }
    return null;
  };

  const formatCardNumber = (value) => {
    const cleaned = value.replace(/\D/g, '');
    const chunks = cleaned.match(/.{1,4}/g) || [];
    return chunks.join(' ').substring(0, 19); // 16 digits + 3 spaces
  };

  const handleCardNumberChange = (e) => {
    const formatted = formatCardNumber(e.target.value);
    setCardData({ ...cardData, cardNumber: formatted });
    setCardType(detectCardType(formatted));
    
    const cleaned = formatted.replace(/\s/g, '');
    if (cleaned.length > 0 && cleaned.length < 13) {
      setErrors({ ...errors, cardNumber: 'Card number must be 13-19 digits' });
    } else if (cleaned.length >= 13 && !/^\d{13,19}$/.test(cleaned)) {
      setErrors({ ...errors, cardNumber: 'Invalid card number' });
    } else {
      const { cardNumber, ...rest } = errors;
      setErrors(rest);
    }
  };

  const handleNameChange = (e) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z\s]/g, '');
    setCardData({ ...cardData, cardName: value });
    
    if (value.trim().length < 3) {
      setErrors({ ...errors, cardName: 'Enter name as on card' });
    } else {
      const { cardName, ...rest } = errors;
      setErrors(rest);
    }
  };

  const handleExpiryMonthChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').substring(0, 2);
    const month = parseInt(value, 10);
    
    setCardData({ ...cardData, expiryMonth: value });
    
    if (value && (month < 1 || month > 12)) {
      setErrors({ ...errors, expiryMonth: 'Invalid month (01-12)' });
    } else {
      const { expiryMonth, ...rest } = errors;
      setErrors(rest);
    }
  };

  const handleExpiryYearChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').substring(0, 2);
    const currentYear = new Date().getFullYear() % 100;
    const year = parseInt(value, 10);
    
    setCardData({ ...cardData, expiryYear: value });
    
    if (value.length === 2 && year < currentYear) {
      setErrors({ ...errors, expiryYear: 'Card has expired' });
    } else {
      const { expiryYear, ...rest } = errors;
      setErrors(rest);
    }
  };

  const handleCvvChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').substring(0, cardType === 'AMEX' ? 4 : 3);
    setCardData({ ...cardData, cvv: value });
    
    const requiredLength = cardType === 'AMEX' ? 4 : 3;
    if (value.length > 0 && value.length < requiredLength) {
      setErrors({ ...errors, cvv: `CVV must be ${requiredLength} digits` });
    } else {
      const { cvv, ...rest } = errors;
      setErrors(rest);
    }
  };

  const validateForm = useCallback(() => {
    const newErrors = {};
    const cleaned = cardData.cardNumber.replace(/\s/g, '');
    
    if (cleaned.length < 13 || cleaned.length > 19) {
      newErrors.cardNumber = 'Invalid card number';
    }
    
    if (cardData.cardName.trim().length < 3) {
      newErrors.cardName = 'Enter name as on card';
    }
    
    const month = parseInt(cardData.expiryMonth, 10);
    if (!cardData.expiryMonth || month < 1 || month > 12) {
      newErrors.expiryMonth = 'Invalid month';
    }
    
    const currentYear = new Date().getFullYear() % 100;
    const year = parseInt(cardData.expiryYear, 10);
    if (!cardData.expiryYear || cardData.expiryYear.length !== 2 || year < currentYear) {
      newErrors.expiryYear = 'Invalid year';
    }
    
    const requiredCvvLength = cardType === 'AMEX' ? 4 : 3;
    if (cardData.cvv.length !== requiredCvvLength) {
      newErrors.cvv = `CVV must be ${requiredCvvLength} digits`;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [cardData, cardType]);

  const handleSubmit = useCallback(async () => {
    if (!validateForm()) {
      return;
    }

    setIsProcessing(true);
    onProcessingChange(true);

    try {
      const response = await axios.post('/api/payments/payu/seamless/card', {
        orderId,
        cardNumber: cardData.cardNumber.replace(/\s/g, ''),
        cardName: cardData.cardName,
        expiryMonth: cardData.expiryMonth,
        expiryYear: cardData.expiryYear,
        cvv: cardData.cvv,
        saveCard: cardData.saveCard,
      });

      const { redirectUrl, txnId } = response.data;
      
      if (redirectUrl) {
        // 3D Secure redirect required
        window.location.href = redirectUrl;
      } else {
        onSuccess({ txnId, status: 'success' });
      }
    } catch (error) {
      console.error('Card payment failed', error);
      onError(error.response?.data || { message: 'Payment failed. Please check card details.' });
      setIsProcessing(false);
      onProcessingChange(false);
    }
  }, [cardData, orderId, onSuccess, onError, onProcessingChange, validateForm]);

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h6" gutterBottom>
            Card Details
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Enter your card information securely
          </Typography>
        </Box>

        <Alert severity="info" icon={<LockIcon />}>
          Your card details are encrypted and secure. We never store CVV.
        </Alert>

        <TextField
          fullWidth
          label="Card Number"
          placeholder="1234 5678 9012 3456"
          value={cardData.cardNumber}
          onChange={handleCardNumberChange}
          error={!!errors.cardNumber}
          helperText={errors.cardNumber}
          disabled={isProcessing}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <CreditCardIcon color={cardType ? 'primary' : 'disabled'} />
              </InputAdornment>
            ),
            endAdornment: cardType && (
              <InputAdornment position="end">
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'primary.main' }}>
                  {cardType}
                </Typography>
              </InputAdornment>
            ),
          }}
          inputProps={{
            inputMode: 'numeric',
          }}
        />

        <TextField
          fullWidth
          label="Cardholder Name"
          placeholder="Name on Card"
          value={cardData.cardName}
          onChange={handleNameChange}
          error={!!errors.cardName}
          helperText={errors.cardName}
          disabled={isProcessing}
        />

        <Grid container spacing={2}>
          <Grid item xs={4}>
            <TextField
              fullWidth
              label="Month"
              placeholder="MM"
              value={cardData.expiryMonth}
              onChange={handleExpiryMonthChange}
              error={!!errors.expiryMonth}
              helperText={errors.expiryMonth}
              disabled={isProcessing}
              inputProps={{
                inputMode: 'numeric',
                maxLength: 2,
              }}
            />
          </Grid>
          <Grid item xs={4}>
            <TextField
              fullWidth
              label="Year"
              placeholder="YY"
              value={cardData.expiryYear}
              onChange={handleExpiryYearChange}
              error={!!errors.expiryYear}
              helperText={errors.expiryYear}
              disabled={isProcessing}
              inputProps={{
                inputMode: 'numeric',
                maxLength: 2,
              }}
            />
          </Grid>
          <Grid item xs={4}>
            <TextField
              fullWidth
              label="CVV"
              placeholder={cardType === 'AMEX' ? '1234' : '123'}
              value={cardData.cvv}
              onChange={handleCvvChange}
              error={!!errors.cvv}
              helperText={errors.cvv}
              disabled={isProcessing}
              type="password"
              inputProps={{
                inputMode: 'numeric',
                maxLength: cardType === 'AMEX' ? 4 : 3,
              }}
            />
          </Grid>
        </Grid>

        <FormControlLabel
          control={
            <Checkbox
              checked={cardData.saveCard}
              onChange={(e) => setCardData({ ...cardData, saveCard: e.target.checked })}
              disabled={isProcessing}
            />
          }
          label={
            <Typography variant="body2">
              Securely save this card for future payments
            </Typography>
          }
        />

        <Button
          fullWidth
          variant="contained"
          size="large"
          onClick={handleSubmit}
          disabled={isProcessing || Object.keys(errors).length > 0}
          startIcon={isProcessing ? <CircularProgress size={20} /> : <LockIcon />}
          sx={{
            py: 1.5,
            bgcolor: '#1A4AE6',
            '&:hover': { bgcolor: '#1538B8' },
          }}
        >
          {isProcessing ? 'Processing...' : `Pay ₹${amount?.toFixed(2)}`}
        </Button>

        <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
          Protected by 256-bit SSL encryption
        </Typography>
      </Stack>
    </Box>
  );
};

export default React.memo(CardPayment);
