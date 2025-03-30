'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { removeItem } from '@/store/slices/cartSlice';
import styles from './styles/viewcart.module.css';
import ViewCartHeader from '../page-sections/viewcart/ViewCartHeader';
import CartList from '../page-sections/viewcart/CartList';
import PriceDetails from '../page-sections/viewcart/PriceDetails';
import PaymentModes from '../page-sections/viewcart/PaymentModes';
import Footer from '../page-sections/viewcart/Footer';
import ApplyCoupon from '../dialogs/ApplyCoupon';
import CustomSnackbar from '@/components/notifications/CustomSnackbar';
import OrderForm from '../dialogs/OrderForm';
import {
  calculateTotalQuantity,
  calculateTotalCostBeforeDiscount,
  calculateDiscountAmount,
  calculateTotalCostAfterDiscount,
} from '@/lib/utils/cartCalculations';
import HappyCustomersClient from '../showcase/sliders/HappyCustomerClient';
import { setCouponApplied } from '@/store/slices/orderFormSlice';
import { TopBoughtProducts } from '../showcase/products/TopBoughtProducts';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Confetti from 'react-confetti';
import { ChevronRight } from '@mui/icons-material';

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
  });
  return applicable;
};

const ViewCart = () => {
  const dispatch = useDispatch();
  const router = useRouter();
  const cartItems = useSelector((state) => state.cart.items);
  const orderForm = useSelector((state) => state.orderForm);
  const { couponApplied } = orderForm;

  // Local coupon state
  const [couponState, setCouponState] = useState({
    couponApplied: false,
    couponName: '',
    couponDiscount: 0,
    discountType: '',
    isDbCoupon: false,
    offer: null,
  });

  // Rehydrate local coupon state from Redux on mount/update.
  useEffect(() => {
    if (couponApplied.couponCode) {
      setCouponState({
        couponApplied: true,
        couponName: couponApplied.couponCode,
        couponDiscount: couponApplied.discountAmount,
        // Defaulting to 'fixed'. Adjust if needed.
        discountType: couponApplied.discountType,
        isDbCoupon: couponApplied.isDbCoupon,
        offer: couponApplied.offer,
      });
    }
  }, [couponApplied]);

  // Other component state and hooks.
  const [isCouponDialogOpen, setIsCouponDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success',
  });
  const [paymentModes, setPaymentModes] = useState([]);
  const [selectedPaymentMode, setSelectedPaymentMode] = useState(null);
  const [isLoadingPaymentModes, setIsLoadingPaymentModes] = useState(true);
  const [isOrderFormOpen, setIsOrderFormOpen] = useState(false);
  const [autoApplyAnimation, setAutoApplyAnimation] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  const [autoAppliedCoupon, setAutoAppliedCoupon] = useState(false);

  // State for the "best coupon" not yet applicable but can be unlocked
  const [bestCoupon, setBestCoupon] = useState(null);
  const [couponShortfall, setCouponShortfall] = useState(0);

  // Assume you know whether this is the customer's first order.
  const isFirstOrder = false; // Replace with your logic if available

  // Set window dimensions (for confetti)
  useEffect(() => {
    setWindowSize({ width: window.innerWidth, height: window.innerHeight });
  }, []);

  // Fetch payment modes.
  useEffect(() => {
    const fetchPaymentModes = async () => {
      try {
        const response = await axios.get('/api/checkout/modeofpayments');
        if (response.status === 200) {
          setPaymentModes(response.data.data);
          const defaultMode =
            response.data.data.find((mode) => mode.name === 'online') ||
            response.data.data[0];
          setSelectedPaymentMode(defaultMode);
        } else {
          setSnackbar({
            open: true,
            message: 'Failed to fetch payment modes.',
            severity: 'error',
          });
        }
      } catch (error) {
        console.error('Error fetching payment modes:', error.message);
        setSnackbar({
          open: true,
          message: 'An error occurred while fetching payment modes.',
          severity: 'error',
        });
      } finally {
        setIsLoadingPaymentModes(false);
      }
    };
    fetchPaymentModes();
  }, []);

  // Calculate cart totals
  const totalQuantity = calculateTotalQuantity(cartItems);
  const totalCostBeforeDiscount = calculateTotalCostBeforeDiscount(cartItems);
  const discountAmount = calculateDiscountAmount(totalCostBeforeDiscount, couponState);
  const totalCostAfterDiscount = calculateTotalCostAfterDiscount(totalCostBeforeDiscount, discountAmount);
  const deliveryCost = 0; // For your example
  const extraCharge = selectedPaymentMode?.extraCharge || 0;
  const totalCostWithDelivery = totalCostAfterDiscount + deliveryCost + extraCharge;
  const originalTotal = totalCostBeforeDiscount + deliveryCost + extraCharge;
  const onlinePercentage = selectedPaymentMode?.configuration?.onlinePercentage;
  const codPercentage = selectedPaymentMode?.configuration?.codPercentage;

  // Handler to remove item from cart
  const handleRemoveItem = (productId) => {
    dispatch(removeItem({ productId }));
  };

  // Handler for going back
  const handleBack = () => {
    router.back();
  };

  // Checkout
  const handleCheckout = () => {
    setIsOrderFormOpen(true);
  };

  // Handler to apply coupon
  const handleApplyCoupon = (couponCode, discount, discountType, isDbCoupon, offerData = null) => {
    setCouponState({
      couponApplied: true,
      couponName: couponCode,
      couponDiscount: discount,
      discountType: discountType,
      isDbCoupon: isDbCoupon,
      offer: offerData,
    });
    setSnackbar({
      open: true,
      message: 'Coupon applied successfully!',
      severity: 'success',
    });
    dispatch(setCouponApplied({ couponCode, discountAmount: discount,discountType, isDbCoupon, offer: offerData }));
  };

  // Handler to remove coupon + disable auto-apply
  const handleRemoveCoupon = () => {
    setCouponState({
      couponApplied: false,
      couponName: '',
      couponDiscount: 0,
      discountType: '',
      isDbCoupon: false,
      offer: null,
    });
    setSnackbar({
      open: true,
      message: 'Coupon removed.',
      severity: 'warning',
    });
    dispatch(setCouponApplied({ couponCode: '', discountAmount: 0, discountType: '', isDbCoupon: false, offer: null }));
    localStorage.setItem('autoApplyDisabled', 'true');
  };

  // Payment mode change
  const handlePaymentModeChange = (event) => {
    const selectedModeName = event.target.value;
    const mode = paymentModes.find((mode) => mode.name === selectedModeName);
    setSelectedPaymentMode(mode);
  };

  // Subcategories for "TopBoughtProducts"
  const topBoughtSubCategories = useMemo(() => {
    return [...new Set(cartItems.map((item) => item.productDetails.subCategory))];
  }, [cartItems]);

  // Product IDs for "TopBoughtProducts"
  const topBoughtCurrentProductId = useMemo(() => {
    return cartItems.map((item) => item.productDetails._id).join(',');
  }, [cartItems]);

  // --- Fetch "best coupon" data if user is not yet eligible but might be close
  useEffect(() => {
    const fetchBestCoupon = async () => {
      if (totalCostBeforeDiscount <= 0) return;
      try {
        const res = await axios.get('/api/checkout/bestcoupon', {
          params: { cartValue: totalCostBeforeDiscount },
        });
        if (res.status === 200) {
          const { bestOffer, shortfall } = res.data;
          setBestCoupon(bestOffer);
          setCouponShortfall(shortfall);
        }
        console.log(bestCoupon);
        console.log(couponShortfall);
      } catch (error) {
        console.error('Error fetching best coupon:', error);
      }
    };

    fetchBestCoupon();
  }, [totalCostBeforeDiscount]);

  // --- Auto-apply logic ---
  useEffect(() => {
    const autoApplyDisabled = localStorage.getItem('autoApplyDisabled') === 'true';

    if (totalQuantity > 0 && !autoApplyDisabled) {
      const autoApplyOffer = async () => {
        try {
          const res = await fetch('/api/checkout/coupons');
          const data = await res.json();
          if (res.ok) {
            const autoOffer = data.coupons.find((offer) => {
              if (!offer.autoApply) return false;
              const cartCondition = offer.conditions.find((cond) => cond.type === 'cart_value');
              if (cartCondition && totalCostBeforeDiscount < cartCondition.value) return false;
              const firstOrderCondition = offer.conditions.find((cond) => cond.type === 'first_order');
              if (firstOrderCondition && !isFirstOrder) return false;
              return true;
            });
            if (autoOffer && !couponState.couponApplied) {
              setAutoApplyAnimation(true);
              setTimeout(() => {
                setAutoAppliedCoupon(true);
                handleApplyCoupon(
                  autoOffer.couponCodes[0],
                  autoOffer.actions[0].type === 'discount_percent'
                    ? Math.min(
                        (autoOffer.actions[0].discountValue / 100) * totalCostBeforeDiscount,
                        autoOffer.discountCap
                      )
                    : autoOffer.actions[0].discountValue,
                  autoOffer.actions[0].type === 'discount_percent' ? 'percentage' : 'fixed',
                  false,
                  autoOffer
                );
                setAutoApplyAnimation(false);
              }, 5000);
            }
          }
        } catch (error) {
          console.error('Error during auto apply:', error.message);
        }
      };

      autoApplyOffer();
    }
  }, [totalQuantity, totalCostBeforeDiscount, couponState.couponApplied, isFirstOrder, cartItems]);

  // --- Re-check applied coupon on cart update dynamically ---
  useEffect(() => {
    if (couponState.couponApplied && couponState.offer) {
      const stillApplicable = isOfferApplicable(couponState.offer, totalCostBeforeDiscount, isFirstOrder);
      if (!stillApplicable) {
        handleRemoveCoupon();
        setSnackbar({
          open: true,
          message: `The applied offer (${couponState.couponName}) is no longer valid due to cart changes.`,
          severity: 'warning',
        });
      }
    }
  }, [totalCostBeforeDiscount, couponState, isFirstOrder, cartItems]);

  useEffect(() => {
    const fetchBestCoupon = async () => {
      if (totalCostBeforeDiscount <= 0) return;
      try {
        const res = await axios.get('/api/checkout/bestcoupon', {
          params: { cartValue: totalCostBeforeDiscount },
        });
        if (res.status === 200) {
          const { bestOffer, shortfall } = res.data;
          setBestCoupon(bestOffer);
          setCouponShortfall(shortfall);
          console.log(bestOffer)
          console.log(shortfall)
        }
      } catch (error) {
        console.error('Error fetching best coupon:', error);
      }
    };

    fetchBestCoupon();
  }, [totalCostBeforeDiscount]);

  // Close snackbar
  const handleSnackbarClose = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  return (
    <div className={styles.container}>
      {/* 1) Top Banner: "You saved ₹100 on FREE shipping" */}
      {/* Show this only if you want to highlight free shipping. Otherwise, conditionally show. */}
      <div className={styles.freeShippingBanner}>
        <span>You saved ₹100 on FREE shipping</span>
      </div>

      <ViewCartHeader totalQuantity={totalQuantity} onBack={handleBack} />

     
      
       
      {totalQuantity > 0 && <CartList cartItems={cartItems} onRemove={handleRemoveItem} />}
       {/* 2) If a coupon is applied, show "You saved ₹X on {couponState.couponName}" */}
      {couponState.couponApplied && couponState.couponDiscount > 0 && (
        <div className={styles.couponSaveBanner}>
          <span>
            You saved ₹{couponState.couponDiscount} on {couponState.couponName}
          </span>
        </div>
      )}
      {/* 3) Section: "Add ₹XYZ more to unlock X% off" if bestCoupon is not yet applicable */}
      {bestCoupon && couponShortfall > 0 && (
        <div className={styles.lockedOfferContainer}>
          <Image
            src={`${process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL}/assets/icons/price-tag1.png`} // Replace with your actual discount SVG
            alt="discount"
            width={30}
            height={30}
          />
          <span className={styles.lockedOfferText}>
            Add ₹{couponShortfall} more to unlock {bestCoupon.discountPercent}% off coupon
          </span>
        </div>
      )}

      {/* If bestCoupon is already applicable (shortfall = 0) but not applied,
          you can optionally show "You can unlock 10% off now!" */}
      {bestCoupon && couponShortfall === 0 && !couponState.couponApplied && (
        <div className={styles.unlockedOfferContainer}>
          <Image
            src={`${process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL}/assets/icons/price-tag2.png`}
            alt="discount"
            width={30}
            height={30}
          />
          <span className={styles.unlockedOfferText}>
            You can now unlock {bestCoupon.discountPercent}% off coupon!
          </span>
          {/* Optionally a button to open the coupon modal */}
          <button
            className={styles.applyNowButton}
            onClick={() => setIsCouponDialogOpen(true)}
          >
            Apply Now
          </button>
        </div>
      )}
            {/* 4) "View all coupons" link that leads to the same modal as "Check coupons" */}
      {totalQuantity > 0 && (
        <div className={styles.viewAllCouponsSection}>
          <span className={styles.viewAllCouponsText}>View all coupons</span>
          <button
            className={styles.viewAllCouponsButton}
            onClick={() => setIsCouponDialogOpen(true)}
          >
           <ChevronRight/>
          </button>
        </div>
      )}

      {totalQuantity > 0 && (
        <section className={styles.cartList}>
        
          <PriceDetails
            deliveryCost={deliveryCost}
            couponState={couponState}
            discountAmount={discountAmount}
            totalCostWithDelivery={totalCostWithDelivery}
            onOpenCoupon={() => setIsCouponDialogOpen(true)}
            onRemoveCoupon={handleRemoveCoupon}
          />

          <PaymentModes
            paymentModes={paymentModes}
            isLoading={isLoadingPaymentModes}
            selectedPaymentMode={selectedPaymentMode}
            onChange={handlePaymentModeChange}
          />
        </section>
      )}



      <TopBoughtProducts subCategories={topBoughtSubCategories} currentProductId={topBoughtCurrentProductId} />
      <HappyCustomersClient headingText="Happy Customers" />

      {totalQuantity > 0 && (
        <Footer
          totalCost={totalCostWithDelivery}
          originalTotal={couponState.couponApplied ? originalTotal + 100 : originalTotal + 100}
          onCheckout={handleCheckout}
          onlinePercentage={onlinePercentage}
          codPercentage={codPercentage}
        />
      )}

      <ApplyCoupon
        open={isCouponDialogOpen}
        onClose={() => setIsCouponDialogOpen(false)}
        onApplyCoupon={handleApplyCoupon}
        totalCost={totalCostBeforeDiscount}
        isFirstOrder={isFirstOrder}
      />
      <OrderForm
        open={isOrderFormOpen}
        onClose={() => setIsOrderFormOpen(false)}
        paymentModeConfig={selectedPaymentMode}
        couponCode={couponState.couponApplied ? couponState.couponName : null}
        totalCost={totalCostWithDelivery}
        couponsDetails={couponApplied}
        deliveryCost={deliveryCost}
        discountAmountFinal={discountAmount}
        items={cartItems}
      />
      <CustomSnackbar
        open={snackbar.open}
        message={snackbar.message}
        severity={snackbar.severity}
        handleClose={handleSnackbarClose}
      />

      {/* Optionally, add a button to clear the autoApplyDisabled flag if needed */}
      <button
        onClick={() => {
          localStorage.removeItem('autoApplyDisabled');
          setSnackbar({ open: true, message: 'Auto-apply re-enabled.', severity: 'info' });
        }}
      >
        Re-enable Auto-Apply
      </button>

      {/* Auto-Apply Animation Overlay (if desired) */}
      {/* {autoApplyAnimation && (
        <div className={styles.autoApplyAnimationOverlay}>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.2, 1] }}
            exit={{ scale: 0 }}
            transition={{ duration: 2 }}
            className={styles.autoApplyAnimation}
          >
            <Image src={`/images/off.jpg`} alt="Auto Applying Coupon" width="200" height="200" />
          </motion.div>
          {windowSize.width > 0 && (
            <Confetti width={windowSize.width} height={windowSize.height} recycle={false} numberOfPieces={300} />
          )}
        </div>
      )} */}
    </div>
  );
};

export default ViewCart;
