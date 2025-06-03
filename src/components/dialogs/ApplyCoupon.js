'use client';
import React, { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import { Typography, Skeleton, Box, IconButton, InputAdornment, Tabs, Tab, Badge } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import SearchIcon from '@mui/icons-material/Search';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';

import styles from './styles/applycoupon.module.css';
import CouponCard from '../cards/CouponCard';
import CustomSnackbar from '@/components/notifications/CustomSnackbar';
import useHistoryState from '@/hooks/useHistoryState';

/* ---------- helpers (unchanged) -------------------------------------------------- */
const calculateEffectiveDiscount = (offer, totalCost, cartItems = []) => {
  const act = offer.actions[0];
  if (act.type === 'discount_percent') return Math.round((act.discountValue / 100) * totalCost);
  if (act.type === 'discount_fixed') return act.discountValue;
  if (act.type === 'bundle') {
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

const getOfferShortfall = (offer, totalCost) => {
  let shortfall = 0;
  
  offer.conditions.forEach(c => {
    if (c.type === 'cart_value' && c.operator === '>=') {
      const currentShortfall = c.value - totalCost;
      if (currentShortfall > 0) {
        shortfall = Math.max(shortfall, currentShortfall);
      }
    }
  });
  
  return shortfall;
};

/* ===================================================================== */

const ApplyCoupon = ({
  open, onClose, onApplyCoupon, totalCost,
  isFirstOrder, cartItems, appliedCoupon = ''
}) => {
  const [couponCode, setCouponCode] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [bestDealId, setBestDealId] = useState(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [activeTab, setActiveTab] = useState(0); // For tabbed interface
  
  // Add history state management with higher priority than cart drawer
  useHistoryState(open, onClose, 'couponDialog', 10); // Higher priority number

  /* map cart items for server */
  const flatCart = cartItems.map(i => ({
    productId: i.productId || i.productDetails._id,
    quantity: i.quantity,
    price: i.price ?? i.productDetails.price,
    specificCategory: i.specificCategory ?? i.productDetails.specificCategory,
  }));

  useEffect(() => { 
    if (open) {
      fetchCoupons();
      setCouponCode('');
    }
  }, [open]);

  const fetchCoupons = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/checkout/coupons?cards=true');
      const data = await res.json();
      if (res.ok) {
        const processedCoupons = data.coupons.map(coupon => {
          const discount = calculateEffectiveDiscount(coupon, totalCost, cartItems);
          const applicable = isOfferApplicable(coupon, totalCost, isFirstOrder);
          const shortfall = !applicable ? getOfferShortfall(coupon, totalCost) : 0;
          const isApplied = appliedCoupon && coupon.couponCodes[0] === appliedCoupon;
          
          return {
            ...coupon,
            calculatedDiscount: 
              coupon.actions[0].type === 'discount_percent' ? 
              coupon.actions[0].discountValue : discount,
            actualDiscount: discount,
            discountType: coupon.actions[0].type,
            isApplicable: applicable || isApplied, // Consider applied coupon as applicable
            shortfall,
            isApplied
          };
        });
        
        // Sort coupons - applied first, then applicable & highest discount
        const sorted = processedCoupons.sort((a, b) => {
          // First prioritize applied coupon
          if (a.isApplied && !b.isApplied) return -1;
          if (!a.isApplied && b.isApplied) return 1;
          
          // Then prioritize applicable coupons
          if (a.isApplicable && !b.isApplicable) return -1;
          if (!a.isApplicable && b.isApplicable) return 1;
          
          // Then sort by actual discount value
          return b.actualDiscount - a.actualDiscount;
        });
        
        // Set the best deal - if there's an applied coupon, don't show a "best" deal
        if (!appliedCoupon && sorted.length > 0 && sorted[0].isApplicable) {
          setBestDealId(sorted[0]._id);
        } else {
          setBestDealId(null);
        }
        
        setCoupons(sorted);
      } else {
        setSnackbar({ open: true, message: data.message || 'Failed to fetch coupons.', severity: 'error' });
      }
    } catch {
      setSnackbar({ open: true, message: 'Error fetching coupons.', severity: 'error' });
    } finally { 
      setLoading(false); 
    }
  };

  /* -- apply via text box -------------------------------------------- */
  const applyViaText = async () => {
    if (!couponCode.trim()) {
      setSnackbar({ open: true, message: 'Please enter a coupon code.', severity: 'error' });
      return;
    }
    setIsApplyingCoupon(true);
    await applyCouponCode(couponCode.trim());
    setIsApplyingCoupon(false);
  };

  /* -- helper to hit apply endpoint ---------------------------------- */
  const applyCouponCode = async (code) => {
    try {
      const res = await fetch('/api/checkout/coupons/apply', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, totalCost, isFirstOrder, cartItems: flatCart }),
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
    setIsApplyingCoupon(true);
    await applyCouponCode(code);
    setIsApplyingCoupon(false);
  };
  
  /* -- Group coupons by applicability ------------------------------- */
  const appliedCoupons = coupons.filter(c => c.isApplied);
  const applicableCoupons = coupons.filter(c => c.isApplicable && !c.isApplied);
  const unapplicableCoupons = coupons.filter(c => !c.isApplicable);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  /* Animation variants for improved user experience */
  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.4 }
    }
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.1
      }
    }
  };

  /* -- JSX ----------------------------------------------------------- */
  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      fullWidth 
      maxWidth="md"
      PaperProps={{
        sx: { 
          borderRadius: '12px',
          overflow: 'hidden',
          maxHeight: '90vh',
          margin: '16px'
        }
      }}
      // Don't let Dialog handle its own back button, our hook will handle it
      disableEscapeKeyDown={true}
    >
      {/* Dialog Header */}
      <motion.div 
        className={styles.dialogHeader}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Typography variant="h6" className={styles.dialogTitle}>
          Apply Coupon
        </Typography>
        <IconButton 
          onClick={onClose}
          className={styles.closeButton}
          aria-label="close"
        >
          <CloseIcon />
        </IconButton>
      </motion.div>

      {/* Search bar - Fixed spacing issue */}
      <motion.div 
        className={styles.searchContainer}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <TextField
          // autoFocus
          placeholder="Enter coupon code"
          value={couponCode}
          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => { if (e.key === 'Enter' && !isApplyingCoupon && couponCode.trim()) applyViaText(); }}
          fullWidth
          variant="outlined"
          className={styles.couponInput}
          disabled={isApplyingCoupon}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon className={styles.searchIcon} />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end" sx={{ mr: 0 }}>
                <Button 
                  onClick={applyViaText} 
                  variant="contained" 
                  disableElevation
                  disabled={isApplyingCoupon || !couponCode.trim() || appliedCoupon === couponCode.trim()}
                  className={`${styles.applyButton} ${isApplyingCoupon ? styles.loading : ''}`}
                >
                  {isApplyingCoupon ? "Applying..." : "Apply"}
                </Button>
              </InputAdornment>
            )
          }}
        />
      </motion.div>

      {/* Tabs Navigation - Updated with harmonious green-teal theme */}
      <motion.div 
        className={styles.tabsContainer}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <Tabs 
          value={activeTab} 
          onChange={handleTabChange} 
          className={styles.tabs}
          TabIndicatorProps={{ 
            className: `${styles.tabIndicator} ${activeTab === 0 ? styles.availableTabIndicator : styles.lockedTabIndicator}` 
          }}
          variant="fullWidth"
        >
          <Tab 
            label={
              <motion.div 
                className={styles.tabLabel}
                animate={{ scale: activeTab === 0 ? [1, 1.05, 1] : 1 }}
                transition={{ duration: 0.3 }}
              >
                <LockOpenIcon className={styles.tabIcon} 
                  style={{ 
                    color: activeTab === 0 ? '#22c55e' : '#757575'
                  }}
                />
                <span>Available ({applicableCoupons.length})</span>
              </motion.div>
            }
            className={`${styles.tab} ${activeTab === 0 ? styles.activeTab : ''}`}
          />
          <Tab 
            label={
              <motion.div 
                className={styles.tabLabel}
                animate={{ scale: activeTab === 1 ? [1, 1.05, 1] : 1 }}
                transition={{ duration: 0.3 }}
              >
                <Badge 
                  badgeContent={unapplicableCoupons.length} 
                  color="error"
                  className={styles.lockedBadge}
                >
                  <LockIcon 
                    className={styles.tabIcon} 
                    style={{ 
                      color: activeTab === 1 ? '#14b8a6' : '#757575' /* Updated to teal color */
                    }}
                  />
                </Badge>
                <span>To Unlock</span>
              </motion.div>
            } 
            className={`${styles.tab} ${activeTab === 1 ? styles.activeTab : ''}`}
          />
        </Tabs>
      </motion.div>

      <DialogContent sx={{ 
        p: 0, 
        height: 'auto',
        overflow: 'auto'
      }}>
        <div className={styles.contentScrollable}>
          {/* Applied coupon banner */}
          <AnimatePresence>
            {appliedCoupons.length > 0 && activeTab === 0 && (
              <motion.div 
                className={`${styles.bestDealBanner} ${styles.appliedBanner}`}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4 }}
              >
                <div className={styles.bestDealIconWrap}>
                  <CheckCircleIcon className={styles.bestDealIcon} />
                </div>
                <div className={styles.bestDealContent}>
                  <Typography variant="subtitle1" className={styles.bestDealTitle}>
                    Coupon Applied
                  </Typography>
                  <Typography variant="body2" className={styles.bestDealDescription}>
                    {appliedCoupons[0].couponCodes[0]}: Saving ₹{appliedCoupons[0].actualDiscount} on your order
                  </Typography>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tab Content */}
          <Box className={styles.tabContent}>
            <AnimatePresence mode="wait">
              {activeTab === 0 && (
                <motion.div 
                  key="available-tab"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className={styles.tabPanel}
                >
                  {loading ? (
                    <motion.div 
                      className={styles.couponCardsSection}
                      variants={staggerContainer}
                      initial="hidden"
                      animate="visible"
                    >
                      {Array.from({ length: 6 }).map((_, i) => (
                        <motion.div
                          key={i}
                          variants={fadeInUp}
                        >
                          <Skeleton 
                            variant="rectangular"
                            className={styles.couponSkeleton}
                            animation="wave"
                          />
                        </motion.div>
                      ))}
                    </motion.div>
                  ) : applicableCoupons.length > 0 ? (
                    <motion.div 
                      className={styles.couponCardsSection}
                      variants={staggerContainer}
                      initial="hidden"
                      animate="visible"
                    >
                      {applicableCoupons.map((coupon) => (
                        <motion.div
                          key={coupon._id}
                          variants={fadeInUp}
                        >
                          <CouponCard
                            name={coupon.couponCodes[0]}
                            discount={coupon.calculatedDiscount}
                            discountCap={coupon.discountCap}
                            discountType={
                              coupon.actions[0].type === 'discount_percent' ? 'percentage' :
                              coupon.actions[0].type === 'bundle' ? 'bundle' : 'fixed'
                            }
                            description={coupon.description || ''}
                            validity={coupon.validUntil}
                            applicable={true}
                            onApply={() => handleCardApply(coupon.couponCodes[0])}
                            isBestDeal={coupon._id === bestDealId}
                            cartTotal={totalCost}
                            actualDiscount={coupon.actualDiscount}
                          />
                        </motion.div>
                      ))}
                      
                      {/* Persuasive button to navigate to Tab 2 - only shown when coupons are loaded */}
                      {!loading && unapplicableCoupons.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.5, duration: 0.4 }}
                          className={styles.unlockMoreButtonContainer}
                        >
                          <Button
                            variant="outlined"
                            className={styles.unlockMoreButton}
                            onClick={() => setActiveTab(1)}
                            endIcon={<LocalOfferIcon />}
                          >
                            <div className={styles.unlockMoreContent}>
                              <Typography variant="subtitle2" className={styles.unlockMoreTitle}>
                                Unlock More Offers
                              </Typography>
                 
                            </div>
                          </Button>
                        </motion.div>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div 
                      className={styles.noCouponsMessage}
                      variants={fadeInUp}
                      initial="hidden"
                      animate="visible"
                    >
                      <Typography variant="body1">
                        No applicable coupons available for your cart.
                      </Typography>
                      {unapplicableCoupons.length > 0 && (
                        <Button 
                          variant="contained" 
                          className={styles.switchTabButton}
                          onClick={() => setActiveTab(1)}
                        >
                          View offers to unlock
                        </Button>
                      )}
                    </motion.div>
                  )}
                </motion.div>
              )}

              {/* Offers to Unlock Tab */}
              {activeTab === 1 && (
                <motion.div 
                  key="locked-tab"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className={styles.tabPanel}
                >
                  {unapplicableCoupons.length > 0 ? (
                    <>
                      <motion.div 
                        className={styles.unlockMessage}
                        variants={fadeInUp}
                        initial="hidden"
                        animate="visible"
                      >
                        <LockIcon className={styles.unlockIcon} />
                        <Typography variant="body2">
                          Add more items to unlock these special offers!
                        </Typography>
                      </motion.div>

                      <motion.div 
                        className={styles.couponCardsSection}
                        variants={staggerContainer}
                        initial="hidden"
                        animate="visible"
                      >
                        {unapplicableCoupons.map((coupon) => {
                          const shortfall = coupon.shortfall;
                          let conditionMessage = "Cannot be applied to current cart";
                          
                          if (shortfall > 0) {
                            conditionMessage = `Add items worth ₹${shortfall} more to unlock`;
                          }
                          
                          return (
                            <motion.div
                              key={coupon._id}
                              variants={fadeInUp}
                            >
                              <CouponCard
                                name={coupon.couponCodes[0]}
                                discount={coupon.calculatedDiscount}
                                discountType={
                                  coupon.actions[0].type === 'discount_percent' ? 'percentage' :
                                  coupon.actions[0].type === 'bundle' ? 'bundle' : 'fixed'
                                }
                                description={coupon.description || ''}
                                validity={coupon.validUntil}
                                applicable={false}
                                conditionMessage={conditionMessage}
                                shortfall={shortfall}
                                onApply={() => {}} // No action for unavailable coupons
                                cartTotal={totalCost}
                              />
                            </motion.div>
                          );
                        })}
                      </motion.div>
                    </>
                  ) : (
                    <motion.div 
                      className={`${styles.noCouponsMessage} ${styles.noLockedCoupons}`}
                      variants={fadeInUp}
                      initial="hidden"
                      animate="visible"
                    >
                      <CheckCircleIcon className={styles.allUnlockedIcon} />
                      <Typography variant="h6" className={styles.allUnlockedTitle}>
                        All offers available!
                      </Typography>
                      <Typography variant="body2">
                        You&apos;ve unlocked all available offers.
                      </Typography>
                      <Button 
                        variant="contained" 
                        className={styles.switchTabButton}
                        onClick={() => setActiveTab(0)}
                      >
                        View available offers
                      </Button>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </Box>
          
          {/* Terms & conditions footer - simplified */}
          <motion.div 
            className={styles.termsContainer}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.4 }}
          >
            <Typography variant="caption" className={styles.termsText}>
              • Coupon codes are case-insensitive
              <br />
              • Only one coupon can be applied per order
              <br />
              • Discount is calculated on cart value before shipping
            </Typography>
          </motion.div>
        </div>
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
