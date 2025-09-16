// components/ViewCart.jsx
'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import axios from 'axios';

import { removeItem } from '@/store/slices/cartSlice';
import { closeCartDrawer } from '@/store/slices/uiSlice';
import {
  startShippingTimer as startPersistentShippingTimer,
  clearShippingTimer as clearPersistentShippingTimer,
} from '@/store/slices/persistentUiSlice'; // Import actions from new slice
import {
  setCouponApplied,
  setManualCoupon,
  resetAutoApplyDisabled,
} from '@/store/slices/orderFormSlice';

/* ---------------- UI + util imports (unchanged) ------------------- */
import styles from './styles/viewcart.module.css';
import ViewCartHeader from '../page-sections/viewcart/ViewCartHeader';
import CartList from '../page-sections/viewcart/CartList';
import PriceDetails from '../page-sections/viewcart/PriceDetails';
import PaymentModes from '../page-sections/viewcart/PaymentModes';
import Footer from '../page-sections/viewcart/Footer';
import ApplyCoupon from '../dialogs/ApplyCoupon';
import OrderForm from '../dialogs/OrderForm';
import MinimumCartDialog from '../dialogs/MinimumCartDialog';
import CustomSnackbar from '@/components/notifications/CustomSnackbar';
import { TopBoughtProducts } from '../showcase/products/TopBoughtProducts';
import {
  calculateTotalQuantity,
  calculateTotalCostBeforeDiscount,
  calculateDiscountAmount,
  calculateTotalCostAfterDiscount,
  calcluateTotalMrp,
} from '@/lib/utils/cartCalculations';
import DiscountOutlinedIcon from '@mui/icons-material/DiscountOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DiscountIcon from '@mui/icons-material/Discount';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import { motion, AnimatePresence } from 'framer-motion';
import SplitPayment from '../page-sections/viewcart/SplitPayment';
import EndOfMonth from '../showcase/banners/EndOfMonth';
import CouponTimerBanner from '../showcase/banners/CouponTimerBanner';

/* ---------------- helper ------------------------------------------------ */
const isOfferApplicable = (offer, totalCost, isFirstOrder = false) => {
  if (!offer || !offer.conditions) {
    return false;
  }
  
  const result = offer.conditions.every(c => {
    if (c.type === 'cart_value') {
      const v = totalCost, x = c.value;
      const conditionMet = (c.operator === '>=' && v >= x) || (c.operator === '>' && v > x)
        || (c.operator === '<' && v < x) || (c.operator === '<=' && v <= x)
        || (c.operator === '==' && v === x);
      return conditionMet;
    }
    if (c.type === 'first_order') {
      const conditionMet = isFirstOrder === c.value;
      return conditionMet;
    }
    return true;
  });
  
  return result;
};

const flattenCart = cartItems => cartItems.map(i => ({
  productId: i.productId || i.productDetails._id,
  quantity: i.quantity,
  price: i.price ?? i.productDetails.price,
  specificCategory: i.specificCategory ?? i.productDetails.specificCategory,
}));

/* ======================================================================= */
export default function ViewCart({ isDrawer = false }) {
  const dispatch = useDispatch();

  /* ---------- redux and state (unchanged) ---------------------------- */
  const cartItems = useSelector(s => s.cart.items);
  const orderForm = useSelector(s => s.orderForm);
  const couponRedux = orderForm.couponApplied;
  // Get persisted shipping timer state
  const persistedShippingTimer = useSelector(s => s.persistentUi.shippingTimer);
  /* ---------- coupon local mirror ------------------------------------ */
  const [couponState, setCouponState] = useState({
    couponApplied: false, couponName: '', couponDiscount: 0, discountType: '', offer: null,
  });  useEffect(() => {
    if (couponRedux.couponCode) {
      setCouponState({
        couponApplied: true,
        couponName: couponRedux.couponCode,
        couponDiscount: couponRedux.discountAmount,
        discountType: couponRedux.discountType,
        offer: couponRedux.offer,
      });
    } else {
      setCouponState(p => ({ ...p, couponApplied: false }));
    }
  }, [couponRedux]);

  /* ---------- animation variants ------------------------------------ */
  const fadeIn = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.4 } }
  };

  const couponAnimation = {
    applied: {
      scale: [1, 1.05, 1],
      backgroundColor: ['#ffffff', '#e6fff0', '#ffffff'],
      transition: { duration: 0.8 }
    }
  };

  // New shipping banner animation variants
  const shippingBannerVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 20,
        duration: 0.6
      }
    },
    pulse: {
      scale: [1, 1.03, 1],
      boxShadow: [
        "0 4px 16px rgba(12, 206, 107, 0.3)",
        "0 6px 20px rgba(12, 206, 107, 0.5)",
        "0 4px 16px rgba(12, 206, 107, 0.3)"
      ],
      transition: {
        duration: 2,
        repeat: Infinity,
        repeatDelay: 3
      }
    }
  };

  /* ---------- misc ui / state ---------------------------------------- */
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [dlgCoupon, setDlgCoupon] = useState(false);
  const [paymentModes, setPaymentModes] = useState([]);
  const [selectedPM, setSelectedPM] = useState(null);
  const [loadingPM, setLoadingPM] = useState(true);
  const [dlgOrder, setDlgOrder] = useState(false);
  const [dlgMinimumCart, setDlgMinimumCart] = useState(false);

  const [lockedCoupon, setLockedCoupon] = useState(null);
  const [lockedShort, setLockedShort] = useState(0);
  const [nowCoupon, setNowCoupon] = useState(null);

  // Add state for timer countdown
  const [timeRemaining, setTimeRemaining] = useState({
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  // Format time for display - Adding the missing function
  const formatTime = (value) => {
    return value < 10 ? `0${value}` : `${value}`;
  };

  // Define default timer duration
  const DEFAULT_SHIPPING_TIMER_DURATION = (9 * 60 * 60 * 1000) + (13 * 60 * 1000); // 9 hours 13 minutes

  // Effect to initialize the timer if not already started
  useEffect(() => {
    if (!persistedShippingTimer.startTime) {
      dispatch(startPersistentShippingTimer({ startTime: Date.now(), duration: DEFAULT_SHIPPING_TIMER_DURATION }));
    }
  }, [persistedShippingTimer.startTime, dispatch, DEFAULT_SHIPPING_TIMER_DURATION]);

  // Derive expiryTime and isActive status from persisted state
  const expiryTime = persistedShippingTimer.startTime && persistedShippingTimer.duration
    ? persistedShippingTimer.startTime + persistedShippingTimer.duration
    : 0;

  const isActiveForShipping = persistedShippingTimer.startTime && persistedShippingTimer.duration
    ? Date.now() < expiryTime
    : false;

  // Timer calculation effect
  useEffect(() => {
    if (!isActiveForShipping) {
      // Ensure timer display is zeroed out if not active
      setTimeRemaining({ hours: 0, minutes: 0, seconds: 0 });
      return;
    }

    const calculateTimeRemaining = () => {
      const now = Date.now();
      const difference = expiryTime - now;

      if (difference <= 0) {
        dispatch(clearPersistentShippingTimer()); // Clear timer from persistent state
        setTimeRemaining({ hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((difference / (1000 * 60)) % 60);
      const seconds = Math.floor((difference / 1000) % 60);

      setTimeRemaining({ hours, minutes, seconds });
    };

    // Initial calculation
    calculateTimeRemaining();

    // Update every second
    const timerInterval = setInterval(calculateTimeRemaining, 1000);

    return () => clearInterval(timerInterval);
  }, [expiryTime, isActiveForShipping, dispatch]);

  const lastAutoRef = useRef({ code: '', type: '' });
  const FIVE_MIN = 5 * 60 * 1000;
  const isFirstOrder = false;  // hook into your user meta when ready
  const [revalidatingCoupons, setRevalidatingCoupons] = useState(false);

  // Minimum purchase amount configuration
  const minPurchaseAmt = 549; // Minimum order amount in INR



  /* ---------- cart totals ------------------------------------------- */
  const qty = calculateTotalQuantity(cartItems);
  const subTot = calculateTotalCostBeforeDiscount(cartItems);
  const MrpTotal = calcluateTotalMrp(cartItems);
  const disc = calculateDiscountAmount(subTot, couponState);
  const grand = calculateTotalCostAfterDiscount(subTot, disc);

  const deliveryCost = 0; // If delivery is free
  const standardDeliveryCost = 100; // Standard delivery fee that is being waived
  const extraCharge = selectedPM?.extraCharge || 0;
  const totalPay = grand + deliveryCost + extraCharge;

  // Determine if this is a split payment based on payment mode configuration, 
  const isSplitPayment = selectedPM?.name === 'split' ||
    (selectedPM?.configuration?.onlinePercentage > 0 &&
      selectedPM?.configuration?.onlinePercentage < 100);

  // Calculate split amounts if applicable
  const onlineAmount = isSplitPayment ?
    Math.round((totalPay * (selectedPM?.configuration?.onlinePercentage || 50)) / 100) : 0;
  const codAmount = isSplitPayment ? totalPay - onlineAmount : 0;
  const snack = useCallback((m, s = 'success') => setSnackbar({ open: true, message: m, severity: s }), []);
  const dispatchCoupon = p => dispatch(setCouponApplied({ ...p }));
  /* ---------- coupon apply / remove --------------------------------- */  const applyCoupon = useCallback((code, amount, type, offer, fromAuto = false) => {
    if (amount <= 0) { 
      snack('Offer conditions are not met.', 'warning'); 
      return; 
    }
    
    if (type !== 'bundle' && !isOfferApplicable(offer, subTot, isFirstOrder)) {
      snack('Offer conditions are not met.', 'warning'); 
      return;
    }
    
    setCouponState({ couponApplied: true, couponName: code, couponDiscount: amount, discountType: type, offer });
    dispatch(setCouponApplied({ couponCode: code, discountAmount: amount, discountType: type, offer }));

    if (!fromAuto) {
      dispatch(setManualCoupon({ couponCode: code }));
    }
    
    dispatch(resetAutoApplyDisabled());
    
    if (fromAuto) {
      lastAutoRef.current = { code, type };
    }
  }, [subTot, isFirstOrder, dispatch, snack]);const removeCoupon = useCallback((showMsg = true) => {
    setCouponState({ couponApplied: false, couponName: '', couponDiscount: 0, discountType: '', offer: null });
    dispatch(setCouponApplied({ couponCode: '', discountAmount: 0, discountType: '', offer: null }));
      // Reset both flags to allow auto-apply
    dispatch(resetAutoApplyDisabled());
    dispatch(setManualCoupon(null));
    

    lastAutoRef.current = { code: '', type: '' };
    

    

    manualRemovalRef.current = true;

    
    if (showMsg) snack('Coupon removed.', 'warning');
  }, [dispatch, snack]);

  // Handler for the back button in the drawer to close it
  const handleBackClick = () => {
    dispatch(closeCartDrawer());
  };

  /* ---------- payment modes fetch (unchanged) ----------------------- */
  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.get('/api/checkout/modeofpayments');
        setPaymentModes(data.data);
        setSelectedPM(data.data.find(m => m.name === 'online') || data.data[0]);
      } catch {
        snack('Failed to fetch payment modes', 'error');
      } finally { setLoadingPM(false); }
    })();
  }, [snack]);

  /* ---------- locked / now banner (updated for card offers) ----------------------- */
  useEffect(() => {
    if (!subTot) { setLockedCoupon(null); setNowCoupon(null); return; }
    (async () => {
      try {
        // Add loading state to prevent stale data display
        setRevalidatingCoupons(true);

        const params = new URLSearchParams({
          cartValue: subTot.toString(),
          showCardOnly: 'true'
        });

        // If coupon is applied, exclude it and pass current discount for comparison
        if (couponState.couponApplied) {
          if (couponState.offer?._id) {
            params.append('appliedOfferId', couponState.offer._id);
          }
          if (couponState.couponName) {
            params.append('appliedCouponCode', couponState.couponName);
          }
          // Pass current discount amount for better comparison
          params.append('currentDiscountAmount', couponState.couponDiscount.toString());
        }

        const { data } = await axios.get(`/api/checkout/bestcoupon?${params}`);
        const { bestOffer, shortfall } = data;

        if (shortfall === 0 && bestOffer) {
          setNowCoupon(bestOffer);
          setLockedCoupon(null);
          setLockedShort(0);
        } else if (shortfall > 0 && bestOffer) {
          setLockedCoupon(bestOffer);
          setLockedShort(shortfall);
          setNowCoupon(null);
        } else {
          setLockedCoupon(null);
          setNowCoupon(null);
          setLockedShort(0);
        }
      } catch (error) {
        console.error('Error fetching card offers:', error);
      } finally {
        setRevalidatingCoupons(false);
      }
    })();
  }, [subTot, cartItems, couponState.couponApplied, couponState.offer?._id, couponState.couponName, couponState.couponDiscount]);
  /* ---------- AUTO‑APPLY (fixed to work for all offer types) -------- */
  const { autoApplyDisabled, autoApplyDisabledAt, manualCoupon } = orderForm;
  const blocked = autoApplyDisabled && autoApplyDisabledAt &&
    Date.now() < new Date(autoApplyDisabledAt).getTime() + FIVE_MIN;
  // Track previous cart state to detect changes
  const prevCartRef = useRef(null);
  const cartChanged = useRef(false);
  const forceAutoApply = useRef(false);  const manualRemovalRef = useRef(false);

  useEffect(() => {
    const currentCartKey = JSON.stringify(cartItems.map(item => ({ id: item.productId, qty: item.quantity })));
    if (prevCartRef.current !== currentCartKey) {
      cartChanged.current = true;
      forceAutoApply.current = true;
      prevCartRef.current = currentCartKey;
      
      if (manualRemovalRef.current) {
        manualRemovalRef.current = false;
      }
      
      lastAutoRef.current = { code: '', type: '' };
      
      if (autoApplyDisabled) {
        dispatch(resetAutoApplyDisabled());
      }
      if (manualCoupon) {
        dispatch(setManualCoupon(null));
      }
    }
  }, [cartItems, dispatch, autoApplyDisabled, manualCoupon]);

  useEffect(() => {
    if (!qty) {
      forceAutoApply.current = false;
      return;
    }
    
    if (manualRemovalRef.current) {
      return;
    }
    
    const shouldCheckAutoApply = forceAutoApply.current || 
      cartChanged.current || 
      (!blocked && !manualCoupon && !couponState.couponApplied);
    
    if (shouldCheckAutoApply) {
      cartChanged.current = false;
      forceAutoApply.current = false;
        (async () => {
        try {
          const res = await fetch('/api/checkout/coupons/apply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              auto: true,
              totalCost: subTot,
              isFirstOrder,
              cartItems: flattenCart(cartItems),
              currentCouponCode: couponState.couponApplied ? couponState.couponName : '',
              currentDiscountAmount: couponState.couponApplied ? couponState.couponDiscount : 0,
            }),
          });
          
          const data = await res.json();
          
          if (!res.ok || !data.valid || !data.offer) {
            return;
          }

          const couponCode = data.offer.couponCodes && data.offer.couponCodes.length > 0
            ? data.offer.couponCodes[0]            : `AUTO_${data.offer._id}`;

          if (couponState.couponApplied && couponState.couponName === couponCode) {
            return;
          }

          try {
            applyCoupon(couponCode, data.discountValue, data.discountType, data.offer, true);
          } catch (applyCouponError) {
            console.error('Error in applyCoupon function:', applyCouponError);
          }
        } catch (e) {
          console.error('Auto‑apply error:', e);
        }
      })();
    }
  }, [qty, subTot, cartItems, couponState.couponApplied, couponState.couponName, couponState.couponDiscount, blocked, manualCoupon, dispatch, applyCoupon, isFirstOrder]);
  /* ---------- RE‑VALIDATE on cart changes (unchanged) --------------- */
  const revalidateCoupon = useCallback(async (silent = false) => {
    if (!couponState.couponApplied) return true;

    try {
      const res = await fetch('/api/checkout/coupons/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: couponState.couponName,
          totalCost: subTot,
          isFirstOrder,
          cartItems: flattenCart(cartItems),
        }),
      });
      const data = await res.json();      if (!res.ok || !data.valid || data.discountValue <= 0) {
        removeCoupon(!silent);
        if (!silent) snack(`Coupon ${couponState.couponName} no longer valid.`, 'warning');
        
        // Set flag to force auto-apply after coupon is invalidated
        forceAutoApply.current = true;
        return false;
      }

      if (data.discountValue !== couponState.couponDiscount) {
        setCouponState(p => ({ ...p, couponDiscount: data.discountValue }));
        dispatch(setCouponApplied({ ...couponRedux, discountAmount: data.discountValue }));
      }
      return true;
    } catch {
      if (!silent) snack('Could not verify coupon.', 'error');
      return false;
    }  }, [couponState.couponApplied, couponState.couponName, couponState.couponDiscount, 
      subTot, isFirstOrder, cartItems, removeCoupon, couponRedux, dispatch, snack]);  /* run on cart changes */  useEffect(() => { 
    const revalidate = async () => {
      if (couponState.couponApplied) {
        const isValid = await revalidateCoupon(true);
        
        if (!isValid && !manualRemovalRef.current) {
          forceAutoApply.current = true;
        }
      }
    };
    
    revalidate();
  }, [cartItems, subTot, revalidateCoupon, couponState.couponApplied, couponState.couponName]);

  /* ---------- validate before checkout (updated with min purchase check) ------------------ */
  const handleCheckout = async () => {
    // Check if total amount meets minimum purchase requirement
    if (totalPay < minPurchaseAmt) {
      setDlgMinimumCart(true);
      return;
    }

    setDlgOrder(true);
  };

  /* ---------- memo for suggestions (unchanged) ---------------------- */
  const topSub = useMemo(() => [...new Set(cartItems.map(i => i.productDetails.subCategory))], [cartItems]);
  const topIds = useMemo(() => cartItems.map(i => i.productDetails._id).join(','), [cartItems]);
  
  // Create cart design IDs for product suggestions
  const cartDesignIds = useMemo(() => {
    const designIds = cartItems
      .map(item => item.productDetails?.designGroupId)
      .filter(Boolean);
    return [...new Set(designIds)];
  }, [cartItems]);

  const originalTotal = subTot + deliveryCost + extraCharge + (deliveryCost === 0 ? 99 : 0);

  /* -------------------  JSX (UI with fixes)  ------------------------- */
  return (
    <div
      className={styles.container}
      style={{
        position: 'relative',
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundColor: '#f8f9fa'
      }}
    >
      <header className={styles.headerCont}>
        <ViewCartHeader
          totalQuantity={qty}
          onBack={isDrawer ? handleBackClick : undefined}
        />
      </header>

      {/* Moved the banner outside of scrollable content for more visibility */}
      <CouponTimerBanner />

      <div className={styles.scrollableContent}>
        {qty > 0 ? (
          <motion.div
            className={styles.mainContent}
            initial="hidden"
            animate="visible"
            variants={fadeIn}
          >
            <section className={styles.cartSection}>
              <div className={styles.sectionHeader}>
                <ShoppingBagIcon className={styles.sectionIcon} />
                <h2 className={styles.sectionTitle}>Your Cart ({qty})</h2>

              </div>



              <CartList
                cartItems={cartItems}
                onRemove={id => dispatch(removeItem({ productId: id }))}
              />
            </section>

            <section className={styles.detailsSection}>
              {/* Free Shipping Banner - Show when qty > 0 and delivery is free */}
              {qty > 0 && deliveryCost === 0 && isActiveForShipping && (
                <AnimatePresence>
                  <motion.div
                    className={styles.freeShippingBanner}
                    variants={shippingBannerVariants}
                    initial="hidden"
                    animate={["visible", "pulse"]}
                  >
                    <div className={styles.shippingIconWrapper}>
                      <LocalShippingIcon className={styles.shippingIcon} />
                    </div>
                    <motion.div
                      className={styles.shippingBannerContent}
                      initial={{ opacity: 0 }}
                      animate={{
                        opacity: 1,
                        transition: { delay: 0.2, duration: 0.4 }
                      }}
                    >
                      <span className={styles.shippingBannerHeading}>
                        FREE DELIVERY
                        <motion.div
                          className={styles.timerContainer}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{
                            opacity: 1,
                            scale: 1,
                            transition: { delay: 0.4, duration: 0.3 }
                          }}
                        >
                          <span className={styles.timerLabel}>Ends in:</span>
                          <span className={styles.timerDigits}>
                            {formatTime(timeRemaining.hours)}
                            <span className={styles.timerSeparator}>:</span>
                            {formatTime(timeRemaining.minutes)}
                            <span className={styles.timerSeparator}>:</span>
                            {formatTime(timeRemaining.seconds)}
                          </span>
                        </motion.div>
                      </span>
                      <span className={styles.shippingBannerText}>
                        You saved <strong>₹{standardDeliveryCost}</strong> on shipping
                      </span>
                    </motion.div>
                  </motion.div>
                </AnimatePresence>
              )}

              {/* Locked/Active Coupon Banners */}
              {lockedCoupon && (
                null  // remove this line
                // <motion.div
                //   className={styles.availableCouponBanner}
                //   whileHover={{ scale: 1.02 }}
                //   transition={{ type: "spring", stiffness: 400, damping: 10 }}
                // >
                //   <LocalOfferIcon className={styles.offerIcon} />                    
                //     <div className={styles.availableCouponContent}>                      

                //       <div className={styles.availableCouponContent}>
                //         <span className={styles.availableCouponHeading}>Unlock More Savings!</span>
                //     <span className={styles.availableCouponText}>

                //         You&apos;re <strong>₹{lockedShort}</strong> away from a better deal!
                //         {/* <strong>₹{lockedCoupon.discountValue}</strong> off
                //         {couponState.couponApplied && (
                //           <span className={styles.improvementText}>
                //             {' '}(₹{lockedCoupon.discountValue - couponState.couponDiscount} more savings!)
                //           </span>
                //         )} */}
                //     </span>

                //       </div>
                //     </div>
                //     <motion.button
                //       className={styles.applyNowButton}
                //       onClick={() => setDlgCoupon(true)}
                //       whileHover={{ scale: 1.05 }}
                //       whileTap={{ scale: 0.95 }}
                //     >
                //       View
                //     </motion.button>
                // </motion.div>
              )}

              {/* Applied Coupon Section with enhanced animation */}
              <AnimatePresence>
                {couponState.couponApplied && (
                  <motion.div
                    className={styles.appliedCouponBanner}
                    initial={{ opacity: 0, y: -20, scale: 0.95 }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      scale: 1,
                      transition: { duration: 0.4 }
                    }}
                    exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.3 } }}
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{
                        scale: [0, 1.2, 1],
                        transition: { duration: 0.5, delay: 0.2 }
                      }}
                      className={styles.successIconContainer}
                    >
                      <CheckCircleIcon className={styles.successIcon} />
                    </motion.div>
                    <div className={styles.appliedCouponContent}>
                      <span className={styles.appliedCouponHeading}>Discount Applied!</span>
                      <motion.span
                        className={styles.appliedCouponText}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1, transition: { delay: 0.3 } }}
                      >
                        {couponState.couponName === 'MATS150' && couponState.discountType === 'bundle'
                          ? <>Launch Deal Unlocked: <strong>₹{couponState.couponDiscount}</strong> on Your Car Floor Mats!</>
                          : <>You saved <strong>₹{couponState.couponDiscount}</strong>{' '}
                            {couponState.discountType === 'bundle'
                              ? 'on your bundle'
                              : `with ${couponState.couponName}`}</>
                        }
                      </motion.span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>


{/* _______________________________________________________NOT REQUIRED FOR NOW______________________________________________ */}
              {/* We don't need this section for now  */}
              {/* Available Coupon Banner - Enhanced with next best logic */}
              {/* {!couponState.couponApplied && nowCoupon && (
                <motion.div
                  className={styles.availableCouponBanner}
                  whileHover={{ scale: 1.02 }}
                >
                  <LocalOfferIcon className={styles.offerIcon} />
                  <div className={styles.availableCouponContent}>
                    <span className={styles.availableCouponHeading}>Special Offer Available!</span>
                    <span className={styles.availableCouponText}>
                      Get {nowCoupon.discountType === 'percentage'
                        ? `${nowCoupon.actions[0].discountValue}%`
                        : `₹${nowCoupon.discountValue}`}{' '}
                      off on your order
                    </span>
                  </div>
                  <motion.button
                    className={styles.applyNowButton}
                    onClick={() => setDlgCoupon(true)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Apply
                  </motion.button>
                </motion.div>

              )} */}

              {/* We don't need this section for now  */}
              {/* Next Available Coupon Banner - When coupon is already applied */}
              {/* {couponState.couponApplied && nowCoupon && (
                <motion.div
                  className={styles.availableCouponBanner}
                  whileHover={{ scale: 1.02 }}
                >
                  <LocalOfferIcon className={styles.offerIcon} />
                  <div className={styles.availableCouponContent}>
                    <span className={styles.availableCouponHeading}>Better Offer Available!</span>
                    <span className={styles.availableCouponText}>
                      You can now unlock a better deal!
                      {nowCoupon.discountValue > couponState.couponDiscount && (
                        <span className={styles.savingsHighlight}>
                          {' '}(Save ₹{nowCoupon.discountValue - couponState.couponDiscount} more!)
                        </span>
                      )}
                    </span>
                  </div>
                  <motion.button
                    className={styles.applyNowButton}
                    onClick={() => setDlgCoupon(true)}
                    whileHover={{ scale: 1 }} // Removed scale transform effect
                    whileTap={{ scale: 1 }} // Removed scale transform effect
                  >
                    Switch
                  </motion.button>
                </motion.div>
              )} */}
{/* __________________________________________________________________________________________________________________________*/}


              {/* Price Details */}
              <PriceDetails
                deliveryCost={deliveryCost}
                standardDeliveryCost={standardDeliveryCost}
                couponState={couponState}
                discountAmount={disc}
                subtotal={subTot}
                totalCostWithDelivery={totalPay}
                onOpenCoupon={() => setDlgCoupon(true)}
                onRemoveCoupon={removeCoupon}
                extraCharge={extraCharge}
                totalMrp={MrpTotal}
                originalTotal={originalTotal}

              />



              {/* Payment Modes */}
              <PaymentModes
                paymentModes={paymentModes}
                isLoading={loadingPM}
                selectedPaymentMode={selectedPM}
                onChange={e => setSelectedPM(paymentModes.find(m => m.name === e.target.value))}
              />
            </section>

            {/* Recommended Products */}
            <section className={styles.recommendedSection}>
              <h2 className={styles.recommendedTitle}>You might also like</h2>
              <TopBoughtProducts
                subCategories={topSub}
                currentProductId={topIds}
                pageType="viewcart"
                hideHeading={true}
              />
            </section>
          </motion.div>
        ) : (
          <motion.div
            className={styles.emptyCartContainer}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className={styles.emptyCartContent}>
              <div className={styles.emptyCartIcon}>
                <ShoppingBagIcon style={{ fontSize: 80, color: '#d1d1d1' }} />
              </div>
              <h2 className={styles.emptyCartTitle}>Your cart is empty</h2>
              <p className={styles.emptyCartSubtitle}>Add items to begin shopping</p>
              <motion.button
                className={styles.continueShopping}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => dispatch(closeCartDrawer())}
              >
                Continue Shopping
              </motion.button>
            </div>
            <div className={styles.recommendedForYou}>
              <h3 className={styles.recommendedTitle}>Recommended For You</h3>
              <TopBoughtProducts
                hideHeading={true}
                pageType="viewcart" />
            </div>
          </motion.div>
        )}
      </div>

      {qty > 0 && (
        <motion.div
          className={styles.checkoutFooter}
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <Footer
            totalCost={totalPay}
            originalTotal={originalTotal}
            onCheckout={handleCheckout}
            onlinePercentage={selectedPM?.configuration?.onlinePercentage || 0}
            codPercentage={selectedPM?.configuration?.codPercentage || 0}
            isRevalidatingCoupons={revalidatingCoupons}
            discount={disc}
          />
        </motion.div>)
      }

      <ApplyCoupon
        open={dlgCoupon}
        onClose={() => setDlgCoupon(false)}
        onApplyCoupon={applyCoupon}
        totalCost={subTot}
        isFirstOrder={isFirstOrder}
        cartItems={cartItems}
        appliedCoupon={couponState.couponName}
      />
      <OrderForm
        open={dlgOrder}
        onClose={() => setDlgOrder(false)}
        paymentModeConfig={selectedPM}
        couponCode={couponState.couponApplied ? couponState.couponName : null}
        totalCost={totalPay}
        couponsDetails={couponRedux}
        deliveryCost={deliveryCost}
        discountAmountFinal={disc}
        items={cartItems}
        subTotal={subTot}
      />

      <MinimumCartDialog
        open={dlgMinimumCart}
        onClose={() => setDlgMinimumCart(false)}
        currentAmount={totalPay}
        minimumAmount={minPurchaseAmt}
        shortfall={minPurchaseAmt - totalPay}
        onContinueShopping={() => {
          if (isDrawer) {
            dispatch(closeCartDrawer());
          }
        }}
      />

      <CustomSnackbar
        open={snackbar.open}
        message={snackbar.message}
        severity={snackbar.severity}
        handleClose={() => setSnackbar(p => ({ ...p, open: false }))}
      />
    </div>
  );
}