'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useRouter } from 'next/navigation';
import axios from 'axios';

import { removeItem } from '@/store/slices/cartSlice';
import {
  setCouponApplied,
  setManualCoupon,
  resetAutoApplyDisabled,
} from '@/store/slices/orderFormSlice';

import styles            from './styles/viewcart.module.css';
import ViewCartHeader    from '../page-sections/viewcart/ViewCartHeader';
import CartList          from '../page-sections/viewcart/CartList';
import PriceDetails      from '../page-sections/viewcart/PriceDetails';
import PaymentModes      from '../page-sections/viewcart/PaymentModes';
import Footer            from '../page-sections/viewcart/Footer';
import ApplyCoupon       from '../dialogs/ApplyCoupon';
import OrderForm         from '../dialogs/OrderForm';
import CustomSnackbar    from '@/components/notifications/CustomSnackbar';
import { TopBoughtProducts } from '../showcase/products/TopBoughtProducts';

import {
  calculateTotalQuantity,
  calculateTotalCostBeforeDiscount,
  calculateDiscountAmount,
  calculateTotalCostAfterDiscount,
  calculateBundleDiscount,
} from '@/lib/utils/cartCalculations';

import DiscountOutlinedIcon from '@mui/icons-material/DiscountOutlined';
import CheckCircleIcon       from '@mui/icons-material/CheckCircle';
import DiscountIcon          from '@mui/icons-material/Discount';
import ChevronRightIcon      from '@mui/icons-material/ChevronRight';
import Confetti              from 'react-confetti';

/* ---------- helpers -------------------------------------------------- */
const isOfferApplicable = (offer, totalCost, isFirstOrder=false) =>
  offer.conditions.every(c=>{
    if(c.type==='cart_value'){
      const v=totalCost, x=c.value;
      return (c.operator==='>='&&v>=x) || (c.operator==='>'&&v>x)
          || (c.operator==='<'&&v<x) || (c.operator==='<= '&&v<=x)
          || (c.operator==='=='&&v===x);
    }
    if(c.type==='first_order') return isFirstOrder===c.value;
    return true;
  });

/* ===================================================================== */
const ViewCart = () => {
  const dispatch = useDispatch();
  const router   = useRouter();

  /* ---------- Redux -------------------------------------------------- */
  const cartItems   = useSelector(s=>s.cart.items);
  const orderForm   = useSelector(s=>s.orderForm);
  const couponRedux = orderForm.couponApplied;

  /* ---------- Local coupon mirror ----------------------------------- */
  const [couponState,setCouponState]=useState({
    couponApplied:false,couponName:'',couponDiscount:0,
    discountType:'',isDbCoupon:false,offer:null,
  });
  useEffect(()=>{
    if(couponRedux.couponCode){
      setCouponState({
        couponApplied:true,
        couponName   :couponRedux.couponCode,
        couponDiscount:couponRedux.discountAmount,
        discountType :couponRedux.discountType,
        isDbCoupon   :couponRedux.isDbCoupon,
        offer        :couponRedux.offer,
      });
    } else {
      setCouponState(p=>({...p,couponApplied:false}));
    }
  },[couponRedux]);

  /* ---------- Misc local state -------------------------------------- */
  const [snackbar,setSnackbar]             = useState({open:false,message:'',severity:'success'});
  const [isCouponDialogOpen,setShowCoupon] = useState(false);
  const [paymentModes,setPaymentModes]     = useState([]);
  const [selectedPaymentMode,setSelectedPM]= useState(null);
  const [loadingPM,setLoadingPM]           = useState(true);
  const [isOrderFormOpen,setDialog]        = useState(false);

  const [lockedCoupon,setLockedCoupon]     = useState(null);
  const [lockedShort,setLockedShort]       = useState(0);
  const [nowCoupon,setNowCoupon]           = useState(null);

  const [confettiRun,setConfettiRun]       = useState(false);
  const [viewport,setViewport]             = useState({w:0,h:0});

  const lastAutoRef = useRef({code:'',type:''});
  const FIVE_MIN    = 5*60*1000;
  const isFirstOrder=false; // TODO

  /* ---------- get window size for confetti -------------------------- */
  useEffect(()=>{
    if(typeof window!=='undefined'){
      setViewport({w:window.innerWidth,h:window.innerHeight});
    }
  },[]);

  /* ---------- cart totals  ------------------------------------------- */
  const qty    = calculateTotalQuantity(cartItems);
  const subTot = calculateTotalCostBeforeDiscount(cartItems);
  const disc   = calculateDiscountAmount(subTot,couponState);
  const grand  = calculateTotalCostAfterDiscount(subTot,disc);

  const deliveryCost=0;
  const extraCharge =selectedPaymentMode?.extraCharge||0;
  const totalPay    = grand+deliveryCost+extraCharge;

  /* ---------- small helpers ----------------------------------------- */
  const snack        = (m,s='success')=>setSnackbar({open:true,message:m,severity:s});
  const dispatchCoupon=(p)=>dispatch(setCouponApplied({...p}));

  /* ---------- APPLY / REMOVE coupon with zero-guard --------------- */
  const applyCoupon = (code, amount, type, isDb, offer, fromAuto=false) => {
    // **GUARD**: never apply if discount is zero or negative
    if (amount <= 0) {
      snack('Offer conditions are not met.', 'warning');
      return;
    }
    // also double-check for normal offers
    if (type !== 'bundle' && !isOfferApplicable(offer, subTot, isFirstOrder)) {
      snack('Offer conditions are not met.', 'warning');
      return;
    }

    // proceed with actual application...
    setCouponState({
      couponApplied:true,
      couponName   :code,
      couponDiscount:amount,
      discountType :type,
      isDbCoupon   :isDb,
      offer        :offer,
    });
    dispatchCoupon({
      couponCode   :code,
      discountAmount:amount,
      discountType :type,
      isDbCoupon   :isDb,
      offer        :offer,
    });

    if (!fromAuto) dispatch(setManualCoupon({couponCode:code}));
    dispatch(resetAutoApplyDisabled());

    if (fromAuto) lastAutoRef.current={code,type};

    setConfettiRun(true);
    setTimeout(()=>setConfettiRun(false),3500);
    snack('Coupon applied successfully!');
  };

  const removeCoupon = () => {
    setCouponState({
      couponApplied:false,couponName:'',couponDiscount:0,
      discountType:'',isDbCoupon:false,offer:null,
    });
    dispatchCoupon({
      couponCode   :'',
      discountAmount:0,
      discountType :'',
      isDbCoupon   :false,
      offer        :null,
    });
    dispatch(setManualCoupon(null));
    snack('Coupon removed.', 'warning');
  };

  /* ---------- fetch payment modes (unchanged) ----------------------- */
  useEffect(()=>{
    (async()=>{
      try{
        const {data}=await axios.get('/api/checkout/modeofpayments');
        setPaymentModes(data.data);
        setSelectedPM(data.data.find(m=>m.name==='online')||data.data[0]);
      } catch {
        snack('Failed to fetch payment modes', 'error');
      } finally {
        setLoadingPM(false);
      }
    })();
  },[]);

  /* ---------- best / now-applicable coupon banners ------------------ */
  useEffect(()=>{
    if (subTot <= 0) return;
    (async()=>{
      try{
        const {data} = await axios.get('/api/checkout/bestcoupon',{params:{cartValue:subTot}});
        const {bestOffer, shortfall} = data;
        if (shortfall === 0) {
          setNowCoupon(bestOffer);
          setLockedCoupon(null);
        } else {
          setLockedCoupon(bestOffer);
          setLockedShort(shortfall);
          setNowCoupon(null);
        }
      } catch {}
    })();
  }, [subTot]);

  /* ---------- unified auto-apply logic (bundle + normal) ---------- */
  const { autoApplyDisabled, autoApplyDisabledAt, manualCoupon } = orderForm;
  const blocked = autoApplyDisabled &&
                  autoApplyDisabledAt &&
                  Date.now() < new Date(autoApplyDisabledAt).getTime() + FIVE_MIN;

  useEffect(()=>{
    if (blocked || manualCoupon || couponState.couponApplied || !qty) return;
    (async()=>{
      try{
        const res = await fetch('/api/checkout/coupons');
        const {coupons=[]} = await res.json();
        if (!res.ok || !coupons.length) return;

        let best=null, bestDisc=0;
        for (const o of coupons) {
          if (!o.autoApply) continue;
          // generic condition check
          const cv = o.conditions.find(c=>c.type==='cart_value');
          if (cv && subTot < cv.value) continue;
          const fo = o.conditions.find(c=>c.type==='first_order');
          if (fo && !isFirstOrder) continue;

          const act = o.actions[0];
          let eff=0;
          if (act.type==='bundle') {
            eff = calculateBundleDiscount(cartItems,o);
          } else if (act.type==='discount_percent') {
            eff = Math.min((act.discountValue/100)*subTot, o.discountCap||Infinity);
          } else {
            eff = act.discountValue;
          }
          if (eff > bestDisc) { bestDisc = eff; best = o; }
        }
        if (!best || bestDisc <= 0) return;
        if (lastAutoRef.current.code === best.couponCodes[0]) return;

        const act = best.actions[0];
        const typ = act.type==='bundle'
          ? 'bundle'
          : act.type==='discount_percent'
            ? 'percentage'
            : 'fixed';
        const amt = act.type==='bundle' ? bestDisc : act.discountValue;
        applyCoupon(best.couponCodes[0], amt, typ, false, best, true);
      }catch{}
    })();
  }, [qty, subTot, cartItems, couponState.couponApplied, blocked, manualCoupon]);

  /* ---------- re-validate bundle on cart change -------------------- */
  useEffect(()=>{
    if (!couponState.couponApplied || couponState.discountType !== 'bundle') return;
    const newDisc = calculateBundleDiscount(cartItems, couponState.offer);
    if (newDisc <= 0) {
      removeCoupon();
      snack('Bundle offer is no longer valid after cart change.', 'warning');
    } else if (newDisc !== couponState.couponDiscount) {
      // update the discount value
      setCouponState(p=>({...p,couponDiscount:newDisc}));
      dispatchCoupon({...couponRedux,discountAmount:newDisc});
    }
  }, [cartItems]); // eslint-disable-line

  /* ---------- re-validate normal on cart change -------------------- */
  useEffect(()=>{
    if (couponState.discountType === 'bundle' || manualCoupon) return;
    if (couponState.couponApplied && couponState.offer) {
      if (!isOfferApplicable(couponState.offer, subTot, isFirstOrder)) {
        removeCoupon();
        snack(`Coupon ${couponState.couponName} no longer valid.`, 'warning');
      }
    }
  }, [subTot, cartItems, couponState, manualCoupon]);

  /* ---------- validate before checkout ------------------------------ */
  const validateBeforeCheckout = () => {
    if (!couponState.couponApplied) return true;

    if (couponState.discountType === 'bundle') {
      const newDisc = calculateBundleDiscount(cartItems, couponState.offer);
      if (newDisc <= 0) {
        removeCoupon();
        snack('Bundle offer is no longer valid. Please update your cart.', 'warning');
        return false;
      }
      // update discount if changed
      if (newDisc !== couponState.couponDiscount) {
        setCouponState(p=>({...p,couponDiscount:newDisc}));
        dispatchCoupon({...couponRedux,discountAmount:newDisc});
      }
      return true;
    }

    if (!isOfferApplicable(couponState.offer, subTot, isFirstOrder)) {
      removeCoupon();
      snack('Coupon no longer valid. Please update your cart.', 'warning');
      return false;
    }
    return true;
  };

  /* ---------- suggestions memos ------------------------------------- */
  const topSub = useMemo(()=>[...new Set(cartItems.map(i=>i.productDetails.subCategory))],[cartItems]);
  const topIds = useMemo(()=>cartItems.map(i=>i.productDetails._id).join(','),[cartItems]);

  /* ---------- render ----------------------------------------------- */
  return (
    <>
      {/* {confettiRun && (
        <Confetti
          width={viewport.w}
          height={viewport.h}
          numberOfPieces={300}
          friction={0.7}
          gravity={1.7}
          wind={0.01}
          recycle
        />
      )} */}
      <div className={styles.container} style={{position:'relative'}}>
        {/* header */}
        <header className={styles.headerCont0}>
          <ViewCartHeader totalQuantity={qty} onBack={()=>router.back()}/>
        </header>

        {/* main */}
        {qty>0 && (
          <div className={styles.maincomp}>
            <div className={styles.blueCont}>
              <CartList
                cartItems={cartItems}
                onRemove={id=>dispatch(removeItem({productId:id}))}
              />
            </div>

            <div className={styles.blueCont2}>
              {/* locked banner */}
              {lockedCoupon && (
                <div className={styles.lockedOfferContainer}>
                  <span className={styles.lockedOfferText}>
                    Add ₹{lockedShort} more to unlock{' '}
                    {lockedCoupon.discountType==='percentage'
                      ? `${lockedCoupon.discountValue}%`
                      : lockedCoupon.discountValue}{' '}
                    off coupon
                  </span>
                  <DiscountOutlinedIcon sx={{color:'#4dff68',fontSize:40}}/>
                </div>
              )}

              {/* coupons section */}
              <div className={styles.currentAndAllCoupons}>
                {couponState.couponApplied && (
                  <div className={styles.couponSaveBanner}>
                    <CheckCircleIcon sx={{color:'#1bde6a',fontSize:27}}/>
                    <span>
                      <strong>You saved</strong> ₹{couponState.couponDiscount}{' '}
                      {couponState.discountType==='bundle'
                        ? 'on the bundle'
                        : `on ${couponState.couponName}`}
                    </span>
                  </div>
                )}

                {!couponState.couponApplied && nowCoupon && (
                  <>
                    <div className={styles.couponSaveBanner}>
                      <CheckCircleIcon sx={{color:'#1bde6a',fontSize:27}}/>
                      <span>
                        You can now unlock{' '}
                        {nowCoupon.discountType==='percentage'
                          ? `${nowCoupon.discountValue}%`
                          : nowCoupon.discountValue}{' '}
                        off coupon!
                      </span>
                      <button
                        className={styles.applyNowButton}
                        onClick={()=>setShowCoupon(true)}
                      >
                        Apply Now
                      </button>
                    </div>
                    <div style={{borderBottom:'1px dashed #cee2ff',margin:'0 1rem'}}/>
                  </>
                )}

                <div
                  onClick={()=>setShowCoupon(true)}
                  className={styles.viewAllCouponsSection}
                >
                  <button className={styles.viewAllCouponsButton}>
                    <DiscountIcon sx={{color:'white',fontSize:15}}/>
                  </button>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flex:1}}>
                    <span className={styles.viewAllCouponsText}>View all coupons</span>
                    <ChevronRightIcon sx={{color:'#616161',fontSize:22}}/>
                  </div>
                </div>
              </div>

              {/* price & payment */}
              <PriceDetails
                deliveryCost={deliveryCost}
                couponState={couponState}
                discountAmount={disc}
                totalCostWithDelivery={totalPay}
                onOpenCoupon={()=>setShowCoupon(true)}
                onRemoveCoupon={removeCoupon}
              />
              <PaymentModes
                paymentModes={paymentModes}
                isLoading={loadingPM}
                selectedPaymentMode={selectedPaymentMode}
                onChange={e=>setSelectedPM(paymentModes.find(m=>m.name===e.target.value))}
              />
            </div>
          </div>
        )}

        {/* suggestions */}
        <div style={{margin:'0 .4rem',borderRadius:'.6rem',background:'#fff',marginTop:qty<=0?0:'-.5rem'}}>
          <TopBoughtProducts subCategories={topSub} currentProductId={topIds}/>
        </div>

        {/* footer */}
        {qty>0 && (
          <Footer
            totalCost={totalPay}
            originalTotal={subTot+deliveryCost+extraCharge}
            onCheckout={()=>{
              if (validateBeforeCheckout()) {
                setDialog(true);
              }
            }}
            onlinePercentage={selectedPaymentMode?.configuration?.onlinePercentage}
            codPercentage={selectedPaymentMode?.configuration?.codPercentage}
          />
        )}

        {/* dialogs */}
        <ApplyCoupon
          open={isCouponDialogOpen}
          onClose={()=>setShowCoupon(false)}
          onApplyCoupon={applyCoupon}
          totalCost={subTot}
          isFirstOrder={isFirstOrder}
          cartItems={cartItems}
        />
        <OrderForm
          open={isOrderFormOpen}
          onClose={()=>setDialog(false)}
          paymentModeConfig={selectedPaymentMode}
          couponCode={couponState.couponApplied?couponState.couponName:null}
          totalCost={totalPay}
          couponsDetails={couponRedux}
          deliveryCost={deliveryCost}
          discountAmountFinal={disc}
          items={cartItems}
        />

        {/* snackbar */}
        <CustomSnackbar
          open={snackbar.open}
          message={snackbar.message}
          severity={snackbar.severity}
          handleClose={()=>setSnackbar(p=>({...p,open:false}))}
        />
      </div>
    </>
  );
};

export default ViewCart;
