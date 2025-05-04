'use client';
import React, { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Image from 'next/image';
import { Typography, Skeleton } from '@mui/material';

import styles from './styles/applycoupon.module.css';
import CouponCard from '../cards/CouponCard';
import CustomSnackbar from '@/components/notifications/CustomSnackbar';

/* ---------- helpers -------------------------------------------------- */
const calculateEffectiveDiscount = (offer, totalCost, cartItems = []) => {
  const act = offer.actions[0];
  if (act.type === 'discount_percent') return act.discountValue;
  if (act.type === 'discount_fixed') return act.discountValue;
  if (act.type === 'bundle') {
    // very rough estimate for sorting cards: assume full bundle present
    // (real discount is computed server‑side when user taps)
    return act.bundlePrice ? Math.round(act.bundlePrice) : 0;
  }
  return 0;
};

const isOfferApplicable = (offer, totalCost, isFirstOrder = false) => {
  return offer.conditions.every(c => {
    if (c.type === 'cart_value') {
      if (c.operator === '>=' && totalCost >= c.value) return true;
      if (c.operator === '>' && totalCost > c.value) return true;
      if (c.operator === '<' && totalCost < c.value) return true;
      if (c.operator === '<= ' && totalCost <= c.value) return true;
      if (c.operator === '==' && totalCost === c.value) return true;
      return false;
    }
    if (c.type === 'first_order') return isFirstOrder === c.value;
    return true;
  });
};
/* ===================================================================== */

const ApplyCoupon = ({
  open, onClose, onApplyCoupon, totalCost,
  isFirstOrder, cartItems            // ← NEW PROP
}) => {
  const [couponCode, setCouponCode] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(false);

  /* map cart items for server */
  const flatCart = cartItems.map(i => ({
    productId: i.productId || i.productDetails._id,
    quantity: i.quantity,
    price: i.price ?? i.productDetails.price,
    specificCategory: i.specificCategory ?? i.productDetails.specificCategory,
  }));

  useEffect(() => { if (open) fetchCoupons(); }, [open]);

  const fetchCoupons = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/checkout/coupons?cards=true');
      const data = await res.json();
      if (res.ok) {
        const sorted = data.coupons.sort((a, b) => {
          const A = calculateEffectiveDiscount(a, totalCost, cartItems);
          const B = calculateEffectiveDiscount(b, totalCost, cartItems);
          return B - A;
        });
        setCoupons(sorted);
      } else {
        setSnackbar({ open: true, message: data.message || 'Failed to fetch coupons.', severity: 'error' });
      }
    } catch {
      setSnackbar({ open: true, message: 'Error fetching coupons.', severity: 'error' });
    } finally { setLoading(false); }
  };

  /* -- apply via text box -------------------------------------------- */
  const applyViaText = async () => {
    if (!couponCode.trim()) {
      setSnackbar({ open: true, message: 'Please enter a coupon code.', severity: 'error' });
      return;
    }
    await applyCouponCode(couponCode.trim());
  };

  /* -- helper to hit apply endpoint ---------------------------------- */
  const applyCouponCode = async (code) => {
    try {
      const res = await fetch('/api/checkout/coupons/apply', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, totalCost, isFirstOrder, cartItems: flatCart, }), // ← cartItems sent
      });
      const data = await res.json();
      if (res.ok && data.valid) {
        onApplyCoupon(code, data.discountValue, data.discountType, data.offer);
        onClose();
      } else {
        setSnackbar({ open: true, message: data.message || 'Invalid coupon.', severity: 'error' });
      }
    } catch {
      setSnackbar({ open: true, message: 'Server error. Try again.', severity: 'error' });
    }
  };

  /* -- card click ---------------------------------------------------- */
  const handleCardApply = async (code) => {
    setLoading(true);
    await applyCouponCode(code);
    setLoading(false);
  };

  /* -- JSX ----------------------------------------------------------- */
  const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" fullScreen>
      <DialogContent sx={{ background: '#fff', height: '100vh', p: 0 }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', margin: '1rem 1rem 0' }}>
          <div onClick={onClose} className={styles.backButton}>
            <Image
              src={`${baseImageUrl}/assets/icons/lessthan1.png`}
              width={46} height={50} alt="Back"
              style={{ width: '1rem', height: 'auto' }}
            />
          </div>
          <div className={styles.inputMain} style={{ flexGrow: 1, display: 'flex' }}>
            <TextField
              autoFocus
              placeholder="Type coupon code here"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') applyViaText(); }}
              fullWidth variant="outlined"
              sx={{
                '& .MuiOutlinedInput-root fieldset': { border: 'none' },
                '& input': { outline: 'none' },
              }}
            />
            <Button onClick={applyViaText} color="inherit" sx={{ fontWeight: 600, borderRadius: '0.4rem' }}>
              Apply
            </Button>
          </div>
        </div>

        {/* cards */}
        <section className={styles.couponCardsSection}>
          {loading ? (
            <>
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} variant="rectangular"
                  sx={{ width: '9rem', height: '14rem', borderRadius: '1rem', mb: '1rem' }} />
              ))}
            </>
          ) : coupons.length ? (
            coupons.map(c => {
              const applicable = isOfferApplicable(c, totalCost, isFirstOrder);
              const disc = calculateEffectiveDiscount(c, totalCost, cartItems);
              return (
                <CouponCard
                  key={c._id}
                  name={c.couponCodes[0]}
                  discount={disc}
                  discountType={
                    c.actions[0].type === 'discount_percent' ? 'percentage' :
                      c.actions[0].type === 'bundle' ? 'bundle' : 'fixed'
                  }
                  validity={new Date(c.validUntil).toLocaleDateString()}
                  applicable={applicable}
                  conditionMessage={!applicable ? c.conditionMessage : ''}
                  onApply={() => handleCardApply(c.couponCodes[0])}
                />
              );
            })
          ) : (
            <Typography variant="body2" align="center" sx={{ ml: '0.5rem' }}>
              No available coupons at the moment.
            </Typography>
          )}
        </section>
      </DialogContent>

      {/* snackbar */}
      <CustomSnackbar
        open={snackbar.open}
        message={snackbar.message}
        severity={snackbar.severity}
        handleClose={() => setSnackbar(p => ({ ...p, open: false }))}
      />
    </Dialog>
  );
};

export default ApplyCoupon;
