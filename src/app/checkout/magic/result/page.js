'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useDispatch } from 'react-redux';
import { clearCart } from '@/store/slices/cartSlice';
import { CircularProgress, Box, Typography, Button } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { motion } from 'framer-motion';
import funnelClient from '@/lib/analytics/funnelClient';

function MagicCheckoutResultContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const dispatch = useDispatch();
  
  const [status, setStatus] = useState('processing'); // processing | success | failed | error
  const [message, setMessage] = useState('Processing your order...');
  const [orderDetails, setOrderDetails] = useState(null);

  const handleOrderSync = useCallback(async (shiprocketOrderId, sessionId) => {
    try {
      const response = await fetch('/api/checkout/magic/order-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shiprocketOrderId, sessionId }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to sync order');
      }

      return data.session;
    } catch (err) {
      console.error('Order sync failed:', err);
      return null;
    }
  }, []);

  const trackSuccess = useCallback((session) => {
    try {
      funnelClient.track('purchase', {
        orderId: session?.shiprocketOrderId || null,
        sessionId: session?.id || null,
        revenue: session?.totals?.payable || 0,
        currency: 'INR',
        couponCode: session?.coupon?.code || null,
        paymentMode: session?.paymentMode?.name || null,
      });
    } catch (err) {
      console.error('Analytics tracking failed:', err);
    }
  }, []);

  useEffect(() => {
    const processResult = async () => {
      try {
        // Extract query params
        const oid = searchParams.get('oid'); // Shiprocket order ID
        const ost = searchParams.get('ost'); // Order status (SUCCESS/FAILED)
        const sessionId = searchParams.get('sid'); // Optional session ID

        if (!oid) {
          setStatus('error');
          setMessage('Missing order information. Please contact support.');
          return;
        }

        // Determine status from query param
        const orderStatus = (ost || '').toUpperCase();
        
        if (orderStatus === 'FAILED') {
          setStatus('failed');
          setMessage('Your order could not be completed. Please try again.');
          
          // Track failure
          try {
            funnelClient.track('checkout_failed', {
              orderId: oid,
              reason: 'payment_failed',
            });
          } catch {}
          
          return;
        }

        // Attempt to sync the order
        const session = await handleOrderSync(oid, sessionId);
        
        if (session) {
          setOrderDetails(session);
          setStatus('success');
          setMessage('Your order has been placed successfully!');
          
          // Clear cart on success
          dispatch(clearCart());
          
          // Track success
          trackSuccess(session);
          
          // Persist success state in localStorage
          try {
            localStorage.setItem('mc:lastOrderId', oid);
            localStorage.setItem('mc:lastOrderStatus', 'success');
          } catch {}
        } else {
          // Sync failed but order might be valid - show cautious success
          setStatus('success');
          setMessage('Your order has been received. You will receive confirmation shortly.');
          
          // Still clear cart (order was placed on Shiprocket)
          dispatch(clearCart());
          
          try {
            localStorage.setItem('mc:lastOrderId', oid);
            localStorage.setItem('mc:lastOrderStatus', 'pending');
          } catch {}
        }
      } catch (err) {
        console.error('Result processing error:', err);
        setStatus('error');
        setMessage('An error occurred while processing your order. Please check your email for confirmation.');
      }
    };

    processResult();
  }, [searchParams, handleOrderSync, trackSuccess, dispatch]);

  const handleContinueShopping = () => {
    router.push('/');
  };

  const handleViewOrders = () => {
    router.push('/orders');
  };

  const handleRetry = () => {
    router.push('/viewcart');
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8f9fa',
        padding: 3,
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Box
          sx={{
            maxWidth: 500,
            width: '100%',
            backgroundColor: 'white',
            borderRadius: 2,
            padding: 4,
            textAlign: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          }}
        >
          {status === 'processing' && (
            <>
              <CircularProgress size={60} sx={{ color: '#2d2d2d', mb: 3 }} />
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                Processing Order
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {message}
              </Typography>
            </>
          )}

          {status === 'success' && (
            <>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', duration: 0.6 }}
              >
                <CheckCircleIcon
                  sx={{ fontSize: 80, color: '#0cce6b', mb: 2 }}
                />
              </motion.div>
              <Typography variant="h5" sx={{ mb: 1, fontWeight: 700, color: '#2d2d2d' }}>
                Order Placed!
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                {message}
              </Typography>
              {orderDetails?.shiprocketOrderId && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Order ID: <strong>{orderDetails.shiprocketOrderId}</strong>
                </Typography>
              )}
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  onClick={handleViewOrders}
                  sx={{
                    backgroundColor: '#2d2d2d',
                    color: 'white',
                    textTransform: 'none',
                    fontWeight: 600,
                    '&:hover': {
                      backgroundColor: '#1a1a1a',
                    },
                  }}
                >
                  View Orders
                </Button>
                <Button
                  variant="outlined"
                  onClick={handleContinueShopping}
                  sx={{
                    borderColor: '#2d2d2d',
                    color: '#2d2d2d',
                    textTransform: 'none',
                    fontWeight: 600,
                    '&:hover': {
                      borderColor: '#1a1a1a',
                      backgroundColor: 'rgba(45, 45, 45, 0.04)',
                    },
                  }}
                >
                  Continue Shopping
                </Button>
              </Box>
            </>
          )}

          {(status === 'failed' || status === 'error') && (
            <>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', duration: 0.6 }}
              >
                <ErrorIcon
                  sx={{ fontSize: 80, color: '#ef4444', mb: 2 }}
                />
              </motion.div>
              <Typography variant="h5" sx={{ mb: 1, fontWeight: 700, color: '#2d2d2d' }}>
                {status === 'failed' ? 'Order Failed' : 'Something Went Wrong'}
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                {message}
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  onClick={handleRetry}
                  sx={{
                    backgroundColor: '#2d2d2d',
                    color: 'white',
                    textTransform: 'none',
                    fontWeight: 600,
                    '&:hover': {
                      backgroundColor: '#1a1a1a',
                    },
                  }}
                >
                  Try Again
                </Button>
                <Button
                  variant="outlined"
                  onClick={handleContinueShopping}
                  sx={{
                    borderColor: '#2d2d2d',
                    color: '#2d2d2d',
                    textTransform: 'none',
                    fontWeight: 600,
                    '&:hover': {
                      borderColor: '#1a1a1a',
                      backgroundColor: 'rgba(45, 45, 45, 0.04)',
                    },
                  }}
                >
                  Continue Shopping
                </Button>
              </Box>
            </>
          )}
        </Box>
      </motion.div>
    </Box>
  );
}

export default function MagicCheckoutResult() {
  return (
    <Suspense
      fallback={
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f8f9fa',
          }}
        >
          <CircularProgress size={60} sx={{ color: '#2d2d2d' }} />
        </Box>
      }
    >
      <MagicCheckoutResultContent />
    </Suspense>
  );
}
