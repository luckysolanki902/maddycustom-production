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
  calculateBundleDiscount,
} from '@/lib/utils/cartCalculations';
import { setCouponApplied } from '@/store/slices/orderFormSlice';
import { TopBoughtProducts } from '../showcase/products/TopBoughtProducts';
import Image from 'next/image';
import Confetti from 'react-confetti';
import DiscountOutlinedIcon from '@mui/icons-material/DiscountOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DiscountIcon from '@mui/icons-material/Discount';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

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

  // Rehydrate local coupon state from Redux
  useEffect(() => {
    if (couponApplied.couponCode) {
      setCouponState({
        couponApplied: true,
        couponName: couponApplied.couponCode,
        couponDiscount: couponApplied.discountAmount,
        discountType: couponApplied.discountType,
        isDbCoupon: couponApplied.isDbCoupon,
        offer: couponApplied.offer,
      });
    }
  }, [couponApplied]);

  // Component state
  const [isCouponDialogOpen, setIsCouponDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [paymentModes, setPaymentModes] = useState([]);
  const [selectedPaymentMode, setSelectedPaymentMode] = useState(null);
  const [isLoadingPaymentModes, setIsLoadingPaymentModes] = useState(true);
  const [isOrderFormOpen, setIsOrderFormOpen] = useState(false);
  const [autoApplyAnimation, setAutoApplyAnimation] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  const [autoAppliedCoupon, setAutoAppliedCoupon] = useState(false);

  // Unified coupon data
  const [bestCoupon, setBestCoupon] = useState(null);
  const [couponShortfall, setCouponShortfall] = useState(0);
  const [appliableCoupon, setAppliableCoupon] = useState(null);
  const [appliableCouponShortfall, setAppliableCouponShortfall] = useState(0);

  const isFirstOrder = false; // replace with real logic

  // Window size for confetti
  useEffect(() => {
    setWindowSize({ width: window.innerWidth, height: window.innerHeight });
  }, []);

  // Fetch payment modes
  useEffect(() => {
    (async () => {
      try {
        const { data, status } = await axios.get('/api/checkout/modeofpayments');
        if (status === 200) {
          setPaymentModes(data.data);
          setSelectedPaymentMode(
            data.data.find((m) => m.name === 'online') || data.data[0]
          );
        } else {
          setSnackbar({ open: true, message: 'Failed to fetch payment modes.', severity: 'error' });
        }
      } catch (err) {
        console.error(err);
        setSnackbar({ open: true, message: 'Error fetching payment modes.', severity: 'error' });
      } finally {
        setIsLoadingPaymentModes(false);
      }
    })();
  }, []);

  // Cart totals
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

  // Handlers
  const handleRemoveItem = (id) => dispatch(removeItem({ productId: id }));
  const handleBack = () => router.back();
  const handleCheckout = () => setIsOrderFormOpen(true);

  const handleApplyCoupon = (code, discount, type, isDb, offerData = null) => {
    setCouponState({ couponApplied: true, couponName: code, couponDiscount: discount, discountType: type, isDbCoupon: isDb, offer: offerData });
    setSnackbar({ open: true, message: 'Coupon applied successfully!', severity: 'success' });
    dispatch(setCouponApplied({ couponCode: code, discountAmount: discount, discountType: type, isDbCoupon: isDb, offer: offerData }));
  };

  const handleRemoveCoupon = () => {
    setCouponState({ couponApplied: false, couponName: '', couponDiscount: 0, discountType: '', isDbCoupon: false, offer: null });
    setSnackbar({ open: true, message: 'Coupon removed.', severity: 'warning' });
    dispatch(setCouponApplied({ couponCode: '', discountAmount: 0, discountType: '', isDbCoupon: false, offer: null }));
    localStorage.setItem('autoApplyDisabled', 'true');
    localStorage.setItem('autoApplyDisabledAt', new Date().toISOString());
  };

  const handlePaymentModeChange = (e) => {
    const mode = paymentModes.find((m) => m.name === e.target.value);
    setSelectedPaymentMode(mode);
  };

  // TopBoughtProducts props
  const topBoughtSubCategories = useMemo(
    () => [...new Set(cartItems.map((i) => i.productDetails.subCategory))],
    [cartItems]
  );
  const topBoughtCurrentProductId = useMemo(
    () => cartItems.map((i) => i.productDetails._id).join(','),
    [cartItems]
  );

  // --- Unified fetch for both “locked” and “applicable” coupon ---
  useEffect(() => {
    const fetchCouponInfo = async () => {
      if (totalCostBeforeDiscount <= 0) return;
      try {
        const { data, status } = await axios.get('/api/checkout/bestcoupon', {
          params: { cartValue: totalCostBeforeDiscount },
        });
        if (status === 200) {
          const { bestOffer, shortfall } = data;

          if (shortfall === 0) {
            setAppliableCoupon(bestOffer);
            setAppliableCouponShortfall(0);
            setBestCoupon(null);
            setCouponShortfall(0);
          } else {
            setBestCoupon(bestOffer);
            setCouponShortfall(shortfall);
            setAppliableCoupon(null);
            setAppliableCouponShortfall(shortfall);
          }
        }
      } catch (err) {
        console.error('Error fetching coupon info:', err);
      }
    };
    fetchCouponInfo();
  }, [totalCostBeforeDiscount]);

  // Auto-apply logic (unchanged)…
  useEffect(() => {
    const autoApplyDisabledAt = localStorage.getItem('autoApplyDisabledAt');
    const autoApplyDisabled =
      localStorage.getItem('autoApplyDisabled') === 'true' &&
      autoApplyDisabledAt &&
      new Date(autoApplyDisabledAt).getTime() + 5 * 60 * 1000 > Date.now();

    if (totalQuantity > 0 && !autoApplyDisabled) {
      (async () => {
        try {
          const res = await fetch('/api/checkout/coupons');
          const data = await res.json();
          if (res.ok && data.coupons?.length) {
            const applicable = data.coupons.filter((offer) => {
              if (!offer.autoApply) return false;
              const cv = offer.conditions.find((c) => c.type === 'cart_value');
              if (cv && totalCostBeforeDiscount < cv.value) return false;
              const fo = offer.conditions.find((c) => c.type === 'first_order');
              if (fo && !isFirstOrder) return false;
              return true;
            });
            if (applicable.length && !couponState.couponApplied) {
              const offersWithDiscount = applicable.map((offer) => {
                let effective = 0;
                const action = offer.actions[0];
                if (action.type === 'discount_percent') {
                  effective = Math.min((action.discountValue / 100) * totalCostBeforeDiscount, offer.discountCap || Infinity);
                } else {
                  effective = action.discountValue;
                }
                return { ...offer, effectiveDiscount: effective };
              });
              const best = offersWithDiscount.reduce((p, c) => (c.effectiveDiscount > p.effectiveDiscount ? c : p), offersWithDiscount[0]);
              setAutoApplyAnimation(true);
              setTimeout(() => {
                setAutoAppliedCoupon(true);
                handleApplyCoupon(
                  best.couponCodes[0],
                  best.actions[0].discountValue,
                  best.actions[0].type === 'discount_percent' ? 'percentage' : 'fixed',
                  false,
                  best
                );
                setAutoApplyAnimation(false);
              }, 1000);
            }
          }
        } catch (e) {
          console.error(e);
        }
      })();
    }
  }, [totalQuantity, totalCostBeforeDiscount, couponState.couponApplied, isFirstOrder, cartItems]);

  // --- Bundle Offer Auto-Apply Logic ---
  useEffect(() => {
    const checkAndApplyBundle = async () => {
      try {
        const res = await fetch('/api/checkout/coupons');
        const data = await res.json();
        if (res.ok && data.coupons?.length) {
          const bundleOffers = data.coupons.filter(
            (offer) => offer.autoApply && offer.actions[0]?.type === 'bundle'
          );
          let bestBundle = null;
          let bestDiscount = 0;
          for (const offer of bundleOffers) {
            const discount = calculateBundleDiscount(cartItems, offer);
            if (discount > bestDiscount) {
              bestDiscount = discount;
              bestBundle = offer;
            }
          }
          // If bundle is valid and discount > 0, apply it. If not valid, remove it.
          if (bestBundle && bestDiscount > 0) {
            if (
              !couponState.couponApplied ||
              couponState.discountType !== 'bundle' ||
              couponState.couponName !== bestBundle.couponCodes[0] ||
              couponState.couponDiscount !== bestDiscount
            ) {
              setAutoAppliedCoupon(true);
              handleApplyCoupon(
                bestBundle.couponCodes[0] || 'BUNDLE',
                bestDiscount,
                'bundle',
                false,
                bestBundle
              );
            }
          } else if (couponState.couponApplied && couponState.discountType === 'bundle') {
            handleRemoveCoupon();
          }
        } else if (couponState.couponApplied && couponState.discountType === 'bundle') {
          handleRemoveCoupon();
        }
      } catch (e) {
        // ignore
      }
    };
    checkAndApplyBundle();
    // Always re-run on cartItems, couponState, and discount
  }, [cartItems, couponState.couponDiscount, couponState.couponApplied]);

  // --- Robust coupon removal for all types ---
  useEffect(() => {
    // Remove coupon if it is no longer valid (discount is 0 or requirements not met)
    if (
      couponState.couponApplied &&
      couponState.discountType === 'bundle' &&
      (!couponState.couponDiscount || couponState.couponDiscount === 0)
    ) {
      handleRemoveCoupon();
    }
  }, [couponState.couponDiscount, couponState.couponApplied]);

  // Re-check applied coupon validity
  useEffect(() => {
    if (couponState.couponApplied && couponState.offer) {
      const stillValid = isOfferApplicable(couponState.offer, totalCostBeforeDiscount, isFirstOrder);
      if (!stillValid) {
        handleRemoveCoupon();
        setSnackbar({
          open: true,
          message: `The applied offer (${couponState.couponName}) is no longer valid due to cart changes.`,
          severity: 'warning',
        });
      }
    }
  }, [totalCostBeforeDiscount, couponState, isFirstOrder, cartItems]);

  // Close snackbar
  const handleSnackbarClose = () => setSnackbar((s) => ({ ...s, open: false }));

  return (
    <div className={styles.container} style={{ position: 'relative' }}>
      <header className={styles.headerCont0}>
        <ViewCartHeader totalQuantity={totalQuantity} onBack={handleBack} />
      </header>

      {totalQuantity > 0 && (
        <div className={styles.maincomp}>
          <div className={styles.blueCont}>
            <CartList cartItems={cartItems} onRemove={handleRemoveItem} />
          </div>
          <div className={styles.blueCont2}>
            {/* Locked-offer banner */}
            {bestCoupon && couponShortfall > 0 && (
              <div className={styles.lockedOfferContainer}>
                <span className={styles.lockedOfferText}>
                  Add ₹{couponShortfall} more to unlock{' '}
                  {bestCoupon.discountType === 'percentage'
                    ? `${bestCoupon.discountValue}%`
                    : bestCoupon.discountValue}{' '}
                  off coupon
                </span>
                <DiscountOutlinedIcon sx={{ color: '#4dff68', fontSize: 40 }} />
              </div>
            )}

            <div className={styles.currentAndAllCoupons}>
              {/* Applied-coupon banner */}
              {couponState.couponApplied && couponState.couponDiscount > 0 && couponState.discountType === 'bundle' && (
                <div className={styles.couponSaveBanner}>
                  <CheckCircleIcon sx={{ color: '#1bde6a', fontSize: 27 }} />
                  <span>
                    <strong>You saved</strong> ₹{couponState.couponDiscount} on the bundle
                  </span>
                </div>
              )}
              {couponState.couponApplied && couponState.couponDiscount > 0 && couponState.discountType !== 'bundle' && (
                <div className={styles.couponSaveBanner}>
                  <CheckCircleIcon sx={{ color: '#1bde6a', fontSize: 27 }} />
                  <span>
                    <strong>You saved</strong> ₹
                    {calculateDiscountAmount(totalCostBeforeDiscount, couponState)} on{' '}
                    {couponState.couponName}
                  </span>
                </div>
              )}

              {/* Now-applicable banner */}
              {couponState.discountType !== 'bundle' && appliableCoupon &&
                appliableCouponShortfall === 0 &&
                !couponState.couponApplied && (
                  <>
                    <div className={styles.couponSaveBanner}>
                      <CheckCircleIcon sx={{ color: '#1bde6a', fontSize: 27 }} />
                      <span>
                        You can now unlock{' '}
                        {appliableCoupon.discountType === 'percentage'
                          ? `${appliableCoupon.discountValue}%`
                          : appliableCoupon.discountValue}{' '}
                        off coupon!
                      </span>
                      <button
                        className={styles.applyNowButton}
                        onClick={() => setIsCouponDialogOpen(true)}
                      >
                        Apply Now
                      </button>
                    </div>
                    <div
                      style={{
                        borderBottom: '1px dashed #cee2ff',
                        margin: '0 1rem',
                      }}
                    />
                  </>
                )}

              {/* View all coupons link */}
              <div
                onClick={() => setIsCouponDialogOpen(true)}
                className={styles.viewAllCouponsSection}
              >
                <button className={styles.viewAllCouponsButton}>
                  <DiscountIcon sx={{ color: 'white', fontSize: 15 }} />
                </button>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flex: 1,
                  }}
                >
                  <span className={styles.viewAllCouponsText}>View all coupons</span>
                  <ChevronRightIcon sx={{ color: '#616161', fontSize: 22 }} />
                </div>
              </div>
            </div>

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
          </div>
        </div>
      )}

      <div
        style={{
          margin: '0 0.4rem',
          borderRadius: '0.6rem',
          backgroundColor: 'white',
          marginTop: totalQuantity <= 0 ? '0' : '-0.5rem',
        }}
      >
        <TopBoughtProducts
          subCategories={topBoughtSubCategories}
          currentProductId={topBoughtCurrentProductId}
        />
      </div>

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
    </div>
  );
};

export default ViewCart;
