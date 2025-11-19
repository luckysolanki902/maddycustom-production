'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Chip,
  Alert,
  Collapse,
  IconButton,
} from '@mui/material';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import Image from 'next/image';
import axios from 'axios';
import QRCode from 'qrcode';

const UPI_APPS = [
  { id: 'gpay', name: 'Google Pay', packageId: 'com.google.android.apps.nbu.paisa.user' },
  { id: 'phonepe', name: 'PhonePe', packageId: 'com.phonepe.app' },
  { id: 'paytm', name: 'Paytm', packageId: 'net.one97.paytm' },
  { id: 'bhim', name: 'BHIM', packageId: 'in.org.npci.upiapp' },
];

const UpiPayment = ({
  orderId,
  amount,
  orderDetails,
  onSuccess,
  onError,
  onProcessingChange,
}) => {
  const [mode, setMode] = useState('intent'); // 'intent' | 'vpa' | 'qr'
  const [vpaInput, setVpaInput] = useState('');
  const [vpaError, setVpaError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [intentUrl, setIntentUrl] = useState(null);
  const [qrCodeData, setQrCodeData] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState('pending'); // 'pending' | 'checking' | 'success' | 'failed'
  const [txnId, setTxnId] = useState(null);
  const pollingIntervalRef = useRef(null);
  const intentLaunchedRef = useRef(false);

  const validateVPA = (vpa) => {
    const vpaRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/;
    return vpaRegex.test(vpa);
  };

  const handleVpaChange = (e) => {
    const value = e.target.value.toLowerCase().trim();
    setVpaInput(value);
    if (value && !validateVPA(value)) {
      setVpaError('Enter a valid UPI ID (e.g., name@upi)');
    } else {
      setVpaError('');
    }
  };

  const generateQRCode = useCallback(async (upiUrl) => {
    try {
      const qrDataUrl = await QRCode.toDataURL(upiUrl, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });
      setQrCodeData(qrDataUrl);
    } catch (err) {
      console.error('QR code generation failed', err);
    }
  }, []);

  const startPaymentPolling = useCallback((transactionId) => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    setPaymentStatus('checking');
    let pollCount = 0;
    const maxPolls = 60; // 5 minutes with 5-second intervals

    pollingIntervalRef.current = setInterval(async () => {
      pollCount++;
      
      try {
        const response = await axios.post('/api/payments/payu/verify', {
          txnIds: [transactionId],
        });

        const txnData = response.data?.transaction_details?.[transactionId];
        if (txnData) {
          const status = (txnData.status || '').toLowerCase();
          
          if (status === 'success' || status === 'captured') {
            clearInterval(pollingIntervalRef.current);
            setPaymentStatus('success');
            onSuccess({ txnId: transactionId, status: 'success' });
          } else if (['failure', 'failed', 'cancelled'].includes(status)) {
            clearInterval(pollingIntervalRef.current);
            setPaymentStatus('failed');
            onError({ message: 'Payment was not completed. Please try again.' });
          }
        }

        if (pollCount >= maxPolls) {
          clearInterval(pollingIntervalRef.current);
          setPaymentStatus('failed');
          onError({ message: 'Payment verification timed out. Please check your order status.' });
        }
      } catch (error) {
        console.error('Payment verification failed', error);
      }
    }, 5000);
  }, [onSuccess, onError]);

  const initiateUpiIntent = useCallback(async () => {
    setIsProcessing(true);
    onProcessingChange(true);
    intentLaunchedRef.current = false;

    try {
      // Build UPI deep link directly using PayU's seamless integration
      // This will get the payment details and generate a upi://pay intent
      const response = await axios.post('/api/payments/payu/seamless/upi', {
        orderId,
        mode: 'intent', // Request intent URL (not collect request)
      });

      const { intentUrl: upiUrl, txnId: transactionId } = response.data;
      setTxnId(transactionId);

      if (upiUrl) {
        setIntentUrl(upiUrl);
        
        // Generate QR code as fallback
        await generateQRCode(upiUrl);

        // Attempt to launch UPI intent
        if (!intentLaunchedRef.current) {
          intentLaunchedRef.current = true;
          
          // Try multiple launch strategies
          const launched = await attemptIntentLaunch(upiUrl);
          
          if (launched) {
            // Start polling after a short delay to allow app switch
            setTimeout(() => {
              startPaymentPolling(transactionId);
            }, 2000);
          } else {
            // Show QR code if intent launch failed
            setMode('qr');
            startPaymentPolling(transactionId);
          }
        }
      } else {
        throw new Error('Unable to generate UPI payment link');
      }
    } catch (error) {
      console.error('UPI intent initiation failed', error);
      onError(error.response?.data || { message: 'Failed to initiate UPI payment' });
      setIsProcessing(false);
      onProcessingChange(false);
    }
  }, [orderId, onError, onProcessingChange, generateQRCode, startPaymentPolling]);

  const attemptIntentLaunch = async (upiUrl) => {
    try {
      // Strategy 1: Direct window.location (works on most Android browsers)
      if (/android/i.test(navigator.userAgent)) {
        window.location.href = upiUrl;
        return true;
      }

      // Strategy 2: Create invisible iframe (works on some browsers)
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = upiUrl;
      document.body.appendChild(iframe);
      
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);

      return true;
    } catch (error) {
      console.error('Intent launch failed', error);
      return false;
    }
  };

  const handlePayWithVPA = useCallback(async () => {
    if (!validateVPA(vpaInput)) {
      setVpaError('Please enter a valid UPI ID');
      return;
    }

    setIsProcessing(true);
    onProcessingChange(true);

    try {
      const response = await axios.post('/api/payments/payu/seamless/upi', {
        orderId,
        vpa: vpaInput,
      });

      const { txnId: transactionId } = response.data;
      setTxnId(transactionId);
      startPaymentPolling(transactionId);
    } catch (error) {
      console.error('UPI VPA payment failed', error);
      onError(error.response?.data || { message: 'Failed to process UPI payment' });
      setIsProcessing(false);
      onProcessingChange(false);
    }
  }, [vpaInput, orderId, onError, onProcessingChange, startPaymentPolling]);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      // Show success feedback
    });
  };

  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const renderIntentMode = () => (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Box sx={{ textAlign: 'center' }}>
          <Box
            sx={{
              width: 80,
              height: 80,
              margin: '0 auto',
              mb: 2,
              borderRadius: '50%',
              bgcolor: '#01874915',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <PhoneAndroidIcon sx={{ fontSize: 40, color: '#018749' }} />
          </Box>
          <Typography variant="h6" gutterBottom>
            Pay with any UPI App
          </Typography>
          <Typography variant="body2" color="text.secondary">
            We&apos;ll open your preferred UPI app for payment
          </Typography>
        </Box>

        <Stack spacing={1.5}>
          <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
            Popular UPI Apps
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
            {UPI_APPS.map((app) => (
              <Chip
                key={app.id}
                label={app.name}
                size="small"
                sx={{ fontWeight: 500 }}
              />
            ))}
          </Box>
        </Stack>

        {paymentStatus === 'checking' && (
          <Alert severity="info" icon={<CircularProgress size={20} />}>
            Waiting for payment confirmation... Please complete the payment in your UPI app.
          </Alert>
        )}

        <Button
          fullWidth
          variant="contained"
          size="large"
          onClick={initiateUpiIntent}
          disabled={isProcessing || paymentStatus === 'checking'}
          startIcon={isProcessing ? <CircularProgress size={20} /> : <PhoneAndroidIcon />}
          sx={{
            py: 1.5,
            bgcolor: '#018749',
            '&:hover': { bgcolor: '#016838' },
          }}
        >
          {isProcessing ? 'Opening UPI App...' : 'Pay with UPI'}
        </Button>

        <Button
          fullWidth
          variant="text"
          size="small"
          onClick={() => setMode('vpa')}
          disabled={isProcessing || paymentStatus === 'checking'}
        >
          Or enter UPI ID manually
        </Button>
      </Stack>
    </Box>
  );

  const renderVPAMode = () => (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h6" gutterBottom>
            Enter UPI ID
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Enter your UPI ID to complete payment
          </Typography>
        </Box>

        <TextField
          fullWidth
          label="UPI ID"
          placeholder="yourname@upi"
          value={vpaInput}
          onChange={handleVpaChange}
          error={!!vpaError}
          helperText={vpaError || 'Example: yourname@paytm, yourname@oksbi'}
          disabled={isProcessing || paymentStatus === 'checking'}
          autoFocus
          InputProps={{
            sx: { fontSize: '1.1rem' },
          }}
        />

        {paymentStatus === 'checking' && (
          <Alert severity="info" icon={<CircularProgress size={20} />}>
            Processing payment... Please approve the request in your UPI app.
          </Alert>
        )}

        <Stack spacing={2}>
          <Button
            fullWidth
            variant="contained"
            size="large"
            onClick={handlePayWithVPA}
            disabled={isProcessing || !vpaInput || !!vpaError || paymentStatus === 'checking'}
            startIcon={isProcessing ? <CircularProgress size={20} /> : null}
            sx={{
              py: 1.5,
              bgcolor: '#018749',
              '&:hover': { bgcolor: '#016838' },
            }}
          >
            {isProcessing ? 'Processing...' : `Pay ₹${amount?.toFixed(2)}`}
          </Button>

          <Button
            fullWidth
            variant="text"
            size="small"
            onClick={() => setMode('intent')}
            disabled={isProcessing || paymentStatus === 'checking'}
          >
            Back to UPI Apps
          </Button>
        </Stack>
      </Stack>
    </Box>
  );

  const renderQRMode = () => (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3} alignItems="center">
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom>
            Scan QR Code
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Open any UPI app and scan this code
          </Typography>
        </Box>

        {qrCodeData && (
          <Paper
            elevation={0}
            sx={{
              p: 2,
              border: '2px solid',
              borderColor: 'divider',
              borderRadius: 2,
              position: 'relative',
              width: 260,
              height: 260,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrCodeData} alt="UPI QR Code" style={{ display: 'block', width: '100%', height: '100%' }} />
          </Paper>
        )}

        {intentUrl && (
          <Box sx={{ textAlign: 'center', width: '100%' }}>
            <Typography variant="caption" color="text.secondary" gutterBottom display="block">
              Or copy UPI link
            </Typography>
            <Paper
              elevation={0}
              sx={{
                p: 1.5,
                bgcolor: 'grey.50',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontFamily: 'monospace',
                }}
              >
                {intentUrl}
              </Typography>
              <IconButton
                size="small"
                onClick={() => copyToClipboard(intentUrl)}
              >
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Paper>
          </Box>
        )}

        {paymentStatus === 'checking' && (
          <Alert severity="info" icon={<CircularProgress size={20} />} sx={{ width: '100%' }}>
            Waiting for payment confirmation...
          </Alert>
        )}

        <Button
          fullWidth
          variant="text"
          size="small"
          onClick={() => setMode('intent')}
          disabled={isProcessing || paymentStatus === 'checking'}
        >
          Back to UPI Apps
        </Button>
      </Stack>
    </Box>
  );

  if (mode === 'vpa') return renderVPAMode();
  if (mode === 'qr') return renderQRMode();
  return renderIntentMode();
};

export default React.memo(UpiPayment);
