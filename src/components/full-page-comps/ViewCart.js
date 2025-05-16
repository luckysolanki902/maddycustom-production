// components/ViewCart.jsx
'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import axios from 'axios';

import { removeItem } from '@/store/slices/cartSlice';
import { closeCartDrawer } from '@/store/slices/uiSlice';
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
import CustomSnackbar from '@/components/notifications/CustomSnackbar';
import { TopBoughtProducts } from '../showcase/products/TopBoughtProducts';
import {
  calculateTotalQuantity,
  calculateTotalCostBeforeDiscount,
  calculateDiscountAmount,
  calculateTotalCostAfterDiscount,
} from '@/lib/utils/cartCalculations';
import DiscountOutlinedIcon from '@mui/icons-material/DiscountOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DiscountIcon from '@mui/icons-material/Discount';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

/* ---------------- helper ------------------------------------------------ */
const isOfferApplicable = (offer, totalCost, isFirstOrder = false) =>
  offer.conditions.every(c => {
    if (c.type === 'cart_value') {
      const v = totalCost, x = c.value;
      return (c.operator === '>=' && v >= x) || (c.operator === '>' && v > x)
        || (c.operator === '<' && v < x) || (c.operator === '<=' && v <= x)
        || (c.operator === '==' && v === x);
    }
    if (c.type === 'first_order') return isFirstOrder === c.value;
    return true;
  });

const flattenCart = cartItems => cartItems.map(i => ({
  productId: i.productId || i.productDetails._id,
  quantity: i.quantity,
  price: i.price ?? i.productDetails.price,
  specificCategory: i.specificCategory ?? i.productDetails.specificCategory,
}));

/* ======================================================================= */
export default function ViewCart({ isDrawer = false }) {
  const dispatch = useDispatch();

  /* ---------- redux --------------------------------------------------- */
  const cartItems = useSelector(s => s.cart.items);
  const orderForm = useSelector(s => s.orderForm);
  const couponRedux = orderForm.couponApplied;
  
  /* ---------- coupon local mirror ------------------------------------ */
  const [couponState, setCouponState] = useState({
    couponApplied: false, couponName: '', couponDiscount: 0, discountType: '', offer: null,
  });
  useEffect(() => {
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

  /* ---------- misc ui / state ---------------------------------------- */
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [dlgCoupon, setDlgCoupon] = useState(false);
  const [paymentModes, setPaymentModes] = useState([]);
  const [selectedPM, setSelectedPM] = useState(null);
  const [loadingPM, setLoadingPM] = useState(true);
  const [dlgOrder, setDlgOrder] = useState(false);

  const [lockedCoupon, setLockedCoupon] = useState(null);
  const [lockedShort, setLockedShort] = useState(0);
  const [nowCoupon, setNowCoupon] = useState(null);


  const lastAutoRef = useRef({ code: '', type: '' });
  const FIVE_MIN = 5 * 60 * 1000;
  const isFirstOrder = false;  // hook into your user meta when ready
  const [revalidatingCoupons, setRevalidatingCoupons] = useState(false);
  

 
  /* ---------- cart totals ------------------------------------------- */
  const qty = calculateTotalQuantity(cartItems);
  const subTot = calculateTotalCostBeforeDiscount(cartItems);
  const disc = calculateDiscountAmount(subTot, couponState);
  const grand = calculateTotalCostAfterDiscount(subTot, disc);

  const deliveryCost = 0;
  const extraCharge = selectedPM?.extraCharge || 0;
  const totalPay = grand + deliveryCost + extraCharge;

  const snack = (m, s = 'success') => setSnackbar({ open: true, message: m, severity: s });
  const dispatchCoupon = p => dispatch(setCouponApplied({ ...p }));

  /* ---------- coupon apply / remove --------------------------------- */
  const applyCoupon = (code, amount, type, offer, fromAuto = false) => {
    if (amount <= 0) { snack('Offer conditions are not met.', 'warning'); return; }
    if (type !== 'bundle' && !isOfferApplicable(offer, subTot, isFirstOrder)) {
      snack('Offer conditions are not met.', 'warning'); return;
    }

    setCouponState({ couponApplied: true, couponName: code, couponDiscount: amount, discountType: type, offer });
    dispatchCoupon({ couponCode: code, discountAmount: amount, discountType: type, offer });

    if (!fromAuto) dispatch(setManualCoupon({ couponCode: code }));
    dispatch(resetAutoApplyDisabled());
    if (fromAuto) lastAutoRef.current = { code, type };

    snack('Coupon applied successfully!');
  };

  const removeCoupon = (showMsg = true) => {
    setCouponState({ couponApplied: false, couponName: '', couponDiscount: 0, discountType: '', offer: null });
    dispatchCoupon({ couponCode: '', discountAmount: 0, discountType: '', offer: null });
    dispatch(setManualCoupon(null));
    if (showMsg) snack('Coupon removed.', 'warning');
  };

  // Handler for the back button in the drawer to close it
  const handleBackClick = () => {
    dispatch(closeCartDrawer());
  };

  /* ---------- payment modes fetch ----------------------------------- */
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
  }, []);

  /* ---------- locked / now banner ----------------------------------- */
  useEffect(() => {
    if (!subTot) { setLockedCoupon(null); setNowCoupon(null); return; }
    (async () => {
      try {
        const { data } = await axios.get('/api/checkout/bestcoupon', { params: { cartValue: subTot } });
        const { bestOffer, shortfall } = data;
        if (shortfall === 0) {
          setNowCoupon(bestOffer); setLockedCoupon(null);
        } else {
          setLockedCoupon(bestOffer); setLockedShort(shortfall); setNowCoupon(null);
        }
      } catch {/* ignore */ }
    })();
  }, [subTot]);

  /* ---------- AUTO‑APPLY -------------------------------------------- */
  const { autoApplyDisabled, autoApplyDisabledAt, manualCoupon } = orderForm;
  const blocked = autoApplyDisabled && autoApplyDisabledAt &&
    Date.now() < new Date(autoApplyDisabledAt).getTime() + FIVE_MIN;

  useEffect(() => {
    if (blocked || manualCoupon || couponState.couponApplied || !qty) return;

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
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.valid) return;
        if (lastAutoRef.current.code === data.offer.couponCodes[0]) return;

        applyCoupon(data.offer.couponCodes[0], data.discountValue, data.discountType, data.offer, true);
      } catch (e) {
        console.error('auto‑apply error', e);
      }
    })();
  }, [qty, subTot, cartItems, couponState.couponApplied, blocked, manualCoupon]); // eslint-disable-line

  /* ---------- RE‑VALIDATE on cart changes --------------------------- */
  const revalidateCoupon = async (silent = false) => {
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
      const data = await res.json();

      if (!res.ok || !data.valid || data.discountValue <= 0) {
        removeCoupon(!silent);
        if (!silent) snack(`Coupon ${couponState.couponName} no longer valid.`, 'warning');
        return false;
      }

      if (data.discountValue !== couponState.couponDiscount) {
        setCouponState(p => ({ ...p, couponDiscount: data.discountValue }));
        dispatchCoupon({ ...couponRedux, discountAmount: data.discountValue });
      }
      return true;
    } catch {
      if (!silent) snack('Could not verify coupon.', 'error');
      return false;
    }
  };

  /* run on cart changes */
  useEffect(() => { revalidateCoupon(true); }, [cartItems, subTot]); // eslint-disable-line

  /* ---------- validate before checkout ------------------------------ */
  const handleCheckout = async () => {
    setRevalidatingCoupons(true);
    if (!(await revalidateCoupon())) return;
    setDlgOrder(true);
    setRevalidatingCoupons(false);
  };

  /* ---------- memo for suggestions ---------------------------------- */
  const topSub = useMemo(() => [...new Set(cartItems.map(i => i.productDetails.subCategory))], [cartItems]);
  const topIds = useMemo(() => cartItems.map(i => i.productDetails._id).join(','), [cartItems]);



  /* -------------------  JSX (UI unchanged)  ------------------------- */
  return (
    <>
      <div className={styles.container} style={{ position: 'relative' }}>
        <header className={styles.headerCont0}>
          <ViewCartHeader 
            totalQuantity={qty} 
            onBack={isDrawer ? handleBackClick : undefined} 
          />
        </header>

        {qty > 0 && (
          <div className={styles.maincomp}>
            <div className={styles.blueCont}>
              <CartList cartItems={cartItems} onRemove={id => dispatch(removeItem({ productId: id }))} />
            </div>

            <div className={styles.blueCont2}>
              {lockedCoupon && (
                <div className={styles.lockedOfferContainer}>
                  <span className={styles.lockedOfferText}>
                    Add ₹{lockedShort} more to unlock{' '}
                    {lockedCoupon.discountType === 'percentage'
                      ? `${lockedCoupon.discountValue}%`
                      : lockedCoupon.discountValue}{' '}
                    off coupon
                  </span>
                  <DiscountOutlinedIcon sx={{ color: '#4dff68', fontSize: 40 }} />
                </div>
              )}

              <div className={styles.currentAndAllCoupons}>
                {couponState.couponApplied && (
                  <div className={styles.couponSaveBanner}>
                    <CheckCircleIcon sx={{ color: '#1bde6a', fontSize: 27 }} />
                    <span>
                      <strong>You saved</strong> ₹{couponState.couponDiscount}{' '}
                      {couponState.discountType === 'bundle'
                        ? 'on the bundle'
                        : `on ${couponState.couponName}`}
                    </span>
                  </div>
                )}

                {!couponState.couponApplied && nowCoupon && (
                  <>
                    <div className={styles.couponSaveBanner}>
                      <CheckCircleIcon sx={{ color: '#1bde6a', fontSize: 27 }} />
                      <span>
                        You can now unlock{' '}
                        {nowCoupon.discountType === 'percentage'
                          ? `${nowCoupon.discountValue}%`
                          : nowCoupon.discountValue}{' '}
                        off coupon!
                      </span>
                      <button className={styles.applyNowButton} onClick={() => setDlgCoupon(true)}>
                        Apply Now
                      </button>
                    </div>
                    <div style={{ borderBottom: '1px dashed #cee2ff', margin: '0 1rem' }} />
                  </>
                )}

                <div onClick={() => setDlgCoupon(true)} className={styles.viewAllCouponsSection}>
                  <button className={styles.viewAllCouponsButton}>
                    <DiscountIcon sx={{ color: 'white', fontSize: 15 }} />
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1 }}>
                    <span className={styles.viewAllCouponsText}>View all coupons</span>
                    <ChevronRightIcon sx={{ color: '#616161', fontSize: 22 }} />
                  </div>
                </div>
              </div>

              <PriceDetails
                deliveryCost={deliveryCost}
                couponState={couponState}
                discountAmount={disc}
                totalCostWithDelivery={totalPay}
                onOpenCoupon={() => setDlgCoupon(true)}
                onRemoveCoupon={removeCoupon}
              />
              <PaymentModes
                paymentModes={paymentModes}
                isLoading={loadingPM}
                selectedPaymentMode={selectedPM}
                onChange={e => setSelectedPM(paymentModes.find(m => m.name === e.target.value))}
              />
            </div>
          </div>
        )}


        <div style={{ margin: '0 .4rem', borderRadius: '1rem', background: '#fff', paddingTop: '0.5rem' }}>
          <TopBoughtProducts subCategories={topSub} currentProductId={topIds} pageType="viewcart" />
        </div>

        {qty > 0 && (
          <Footer
            totalCost={totalPay}
            originalTotal={subTot + deliveryCost + extraCharge}
            onCheckout={handleCheckout}
            onlinePercentage={selectedPM?.configuration?.onlinePercentage}
            codPercentage={selectedPM?.configuration?.codPercentage}
            isRevalidatingCoupons={revalidatingCoupons}
          />
        )}

        <ApplyCoupon
          open={dlgCoupon}
          onClose={() => setDlgCoupon(false)}
          onApplyCoupon={applyCoupon}
          totalCost={subTot}
          isFirstOrder={isFirstOrder}
          cartItems={cartItems}
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

        <CustomSnackbar
          open={snackbar.open}
          message={snackbar.message}
          severity={snackbar.severity}
          handleClose={() => setSnackbar(p => ({ ...p, open: false }))}
        />
      </div>
    </>
  );
}
