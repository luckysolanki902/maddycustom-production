// components/dialogs/ApplyCoupon.js
"use client";
import React, { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Image from 'next/image';
import styles from './styles/applycoupon.module.css';
import CouponCard from '../cards/CouponCard';
import { Typography, Skeleton } from '@mui/material';
import CustomSnackbar from '@/components/notifications/CustomSnackbar';

// Helper to compute effective discount for an offer
const calculateEffectiveDiscount = (offer, totalCost) => {
  const action = offer.actions[0];

  if (action.type === 'discount_percent') {
    let discount = (action.discountValue / 100) * totalCost;
    if (offer.discountCap && discount > offer.discountCap) {
      discount = offer.discountCap;
      return discount;
    }
    return action.discountValue;
  } else if (action.type === 'discount_fixed') {
    return action.discountValue;
  }
  return 0;
};

// Helper to check if an offer is applicable.
const isOfferApplicable = (offer, totalCost, isFirstOrder = false) => {
  let applicable = true;
  offer.conditions.forEach((condition) => {
    if (condition.type === 'cart_value') {
      switch (condition.operator) {
        case '>=':
          if (!(totalCost >= condition.value)) applicable = false;
          break;
        case '<=':
          if (!(totalCost <= condition.value)) applicable = false;
          break;
        case '>':
          if (!(totalCost > condition.value)) applicable = false;
          break;
        case '<':
          if (!(totalCost < condition.value)) applicable = false;
          break;
        case '==':
          if (!(totalCost === condition.value)) applicable = false;
          break;
        default:
          applicable = false;
      }
    } else if (condition.type === 'first_order') {
      if (isFirstOrder !== condition.value) applicable = false;
    }
    // Additional conditions can be added here.
  });
  return applicable;
};

const ApplyCoupon = ({ open, onClose, onApplyCoupon, totalCost, isFirstOrder }) => {
  const [couponCode, setCouponCode] = useState('');
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success',
  });
  const [availableCoupons, setAvailableCoupons] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchAvailableCoupons();
    }
  }, [open]);

  const fetchAvailableCoupons = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/checkout/coupons');
      const data = await res.json();
      if (res.ok) {
        // Sort offers based on effective discount (descending order)
        const sortedOffers = data.coupons.sort((a, b) => {
          const discountA = calculateEffectiveDiscount(a, totalCost);
          const discountB = calculateEffectiveDiscount(b, totalCost);
          return discountB - discountA;
        });
        setAvailableCoupons(sortedOffers);
      } else {
        setSnackbar({
          open: true,
          message: data.message || 'Failed to fetch coupons.',
          severity: 'error',
        });
      }
    } catch (error) {
      console.error('Error fetching coupons:', error.message);
      setSnackbar({
        open: true,
        message: 'An error occurred. Please try again.',
        severity: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      setSnackbar({
        open: true,
        message: 'Please enter a coupon code.',
        severity: 'error',
      });
      return;
    }
    try {

      const res = await fetch('/api/checkout/coupons/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode.trim(), totalCost, isFirstOrder }),
      });


      const data = await res.json();
 
      if (res.ok && data.valid) {
  
        onApplyCoupon(couponCode.trim(), data.discountValue, data.discountType, true, data.offer);
        onClose();
      } else {
        setSnackbar({
          open: true,
          message: data.message || 'Invalid coupon code.',
          severity: 'error',
        });
      }
    } catch (error) {
      console.error('Error applying coupon:', error.message);
      setSnackbar({
        open: true,
        message: 'An error occurred. Please try again.',
        severity: 'error',
      });
    }
  };

  const handleApplyCouponFromCard = async (code) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/checkout/coupons/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, totalCost, isFirstOrder }),
      });
      const data = await res.json();
      if (res.ok && data.valid) {
        setSnackbar({
          open: true,
          message: 'Coupon applied successfully!',
          severity: 'success',
        });
        onApplyCoupon(code, data.discountValue, data.discountType, false,data.offer);
        onClose();
      } else {
        setSnackbar({
          open: true,
          message: data.message || 'Failed to apply coupon.',
          severity: 'error',
        });
      }
    } catch (error) {
      console.error('Error applying coupon:', error.message);
      setSnackbar({
        open: true,
        message: 'An error occurred. Please try again.',
        severity: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSnackbarClose = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" fullScreen>
      <DialogContent style={{ backgroundColor: 'white', height: '100vh', padding: '0' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginTop: '1rem', marginRight: '1rem' }}>
          <Button color="inherit" onClick={onClose} sx={{ padding: '1rem' }}>
            <Image
              src={`${baseImageUrl}/assets/icons/lessthan1.png`}
              width={46}
              height={50}
              alt="Back"
              style={{ width: '1rem', height: 'auto' }}
            />
          </Button>
          <div className={styles.inputMain} style={{ flexGrow: '1', display: 'flex' }}>
            <TextField
              autoFocus
              type="text"
              placeholder="Type coupon code here"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              fullWidth
              variant="outlined"
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { border: 'none' },
                  '&:hover fieldset': { border: 'none' },
                  '&.Mui-focused fieldset': { border: 'none' },
                },
                '& input': { outline: 'none' },
              }}
            />
            <Button color="inherit" style={{ fontWeight: '600', borderRadius: '0.4rem' }} onClick={handleApplyCoupon}>
              Apply
            </Button>
          </div>
        </div>

        <section className={styles.couponCardsSection} style={{ padding: '1rem' }}>
          {isLoading ? (
            <>
              <Skeleton variant="rectangular" sx={{ width: '9rem', height: '14rem', borderRadius: '1rem' }} />
            </>
          ) : availableCoupons.length > 0 ? (
            availableCoupons.map((coupon) => {
              const applicable = isOfferApplicable(coupon, totalCost, isFirstOrder);
              const effectiveDiscount = calculateEffectiveDiscount(coupon, totalCost);
              return (
                <CouponCard
                  key={coupon._id}
                  name={coupon.couponCodes[0]}
                  discount={effectiveDiscount}
                  discountType={coupon.actions[0].type === 'discount_percent' ? 'percentage' : 'fixed'}
                  validity={new Date(coupon.validUntil).toLocaleDateString()}
                  // Pass the applicable flag and the conditionMessage to the card.
                  applicable={applicable}
                  conditionMessage={!applicable ? coupon.conditionMessage : ''}
                  onApply={() => handleApplyCouponFromCard(coupon.couponCodes[0])}
                />
              );
            })
          ) : (
            <Typography variant="body2" align="center" sx={{ marginLeft: '0.5rem' }}>
              No available coupons at the moment.
            </Typography>
          )}
        </section>
      </DialogContent>
      <CustomSnackbar
        open={snackbar.open}
        message={snackbar.message}
        severity={snackbar.severity}
        handleClose={handleSnackbarClose}
      />
    </Dialog>
  );
};

export default ApplyCoupon;
