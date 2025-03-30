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
        discountType: 'fixed',
        isDbCoupon: false,
        offer: null,
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

  const totalQuantity = calculateTotalQuantity(cartItems);
  const totalCostBeforeDiscount = calculateTotalCostBeforeDiscount(cartItems);
  const discountAmount = calculateDiscountAmount(totalCostBeforeDiscount, couponState);
  const totalCostAfterDiscount = calculateTotalCostAfterDiscount(totalCostBeforeDiscount, discountAmount);
  const deliveryCost = 0;
  const extraCharge = selectedPaymentMode?.extraCharge || 0;
  const totalCostWithDelivery = totalCostAfterDiscount + deliveryCost + extraCharge;
  const originalTotal = totalCostBeforeDiscount + deliveryCost + extraCharge;
  const onlinePercentage = selectedPaymentMode?.configuration?.onlinePercentage;
  const codPercentage = selectedPaymentMode?.configuration?.codPercentage;
  const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

  const handleRemoveItem = (productId) => {
    dispatch(removeItem({ productId }));
  };

  const handleBack = () => {
    router.back();
  };

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
    dispatch(setCouponApplied({ couponCode, discountAmount: discount }));
  };

  // Handler to remove coupon.
  // Also sets a flag in localStorage so auto-apply won’t reapply it.
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
    dispatch(setCouponApplied({ couponCode: '', discountAmount: 0 }));
    localStorage.setItem('autoApplyDisabled', 'true');
  };

  const handlePaymentModeChange = (event) => {
    const selectedModeName = event.target.value;
    const mode = paymentModes.find((mode) => mode.name === selectedModeName);
    setSelectedPaymentMode(mode);
  };

  const topBoughtSubCategories = useMemo(() => {
    return [...new Set(cartItems.map((item) => item.productDetails.subCategory))];
  }, [cartItems]);

  const topBoughtCurrentProductId = useMemo(() => {
    return cartItems.map((item) => item.productDetails._id).join(',');
  }, [cartItems]);

  // --- Auto-apply logic ---
  useEffect(() => {
    // Check if the user has explicitly removed the coupon.
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

  const handleSnackbarClose = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  return (
    <div className={styles.container}>
      <ViewCartHeader totalQuantity={totalQuantity} onBack={handleBack} />
      {totalQuantity > 0 && <CartList cartItems={cartItems} onRemove={handleRemoveItem} />}
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
      <button onClick={() => {
            localStorage.removeItem('autoApplyDisabled');
            setSnackbar({ open: true, message: 'Auto-apply re-enabled.', severity: 'info' });
          }}>
            Re-enable Auto-Apply
          </button>
    </div>
  );
};

export default ViewCart;





 {/* Auto-Apply Animation Overlay */}
//  {autoApplyAnimation && (
//   <div className={styles.autoApplyAnimationOverlay}>
//     <motion.div
//       initial={{ scale: 0 }}
//       animate={{ scale: [0, 1.2, 1] }}
//       exit={{ scale: 0 }}
//       transition={{ duration: 2 }}
//       className={styles.autoApplyAnimation}
//     >
//       <Image src={`/images/off.jpg`} alt="Auto Applying Coupon" width="200" height="200" />
//     </motion.div>
//     {windowSize.width > 0 && (
//       <Confetti width={windowSize.width} height={windowSize.height} recycle={false} numberOfPieces={300} />
//     )}
//   </div>
// )}