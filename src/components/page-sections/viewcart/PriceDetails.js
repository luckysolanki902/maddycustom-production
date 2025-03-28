// components/page-sections/viewcart/PriceDetails.js

'use client';

import React from 'react';
import CouponButton from '@/components/utils/CouponButton';
import styles from './styles/viewcart.module.css';

const PriceDetails = ({
  deliveryCost,
  couponState,
  discountAmount,
  totalCostWithDelivery,
  onOpenCoupon,
  onRemoveCoupon,
}) => {
  console.log(discountAmount)
  return(
  <div className={`${styles.cartItem} ${styles.priceDetails}`}>
    {/* Delivery Cost */}
    <div className={styles.priceDetailRow}>
      <div className={styles.priceField}>Delivery Cost</div>
      <div className={styles.priceValue}>
        <span className={`${styles.rupee}`} >₹</span>
        {/* {deliveryCost} */}
        <span style={{textDecoration:'line-through'}}>
          100
        </span>
      </div>
      <span
        style={{
          padding: '0rem 0.6rem',
          marginLeft: '0.5rem',
          borderRadius: '0.5rem',
          fontWeight: '400',
          fontFamily: 'Roboto',
          display: 'flex',
          fontSize: '0.8rem',
          backgroundColor: 'white',
          alignItems:'center',
          color:'#34C759',
          boxShadow: 'rgba(0, 0, 0, 0.12) 0px 1px 2px 1px',
        }}
        className={styles.patch}
      >
        <span>Free</span>
      </span>
    </div>

    {/* Discount */}
    {couponState.couponApplied && (
      <div className={styles.priceDetailRow}>
        <div className={styles.priceField}>Discount</div>
        <div className={styles.priceValue}>
          ₹{discountAmount}
        </div>
      </div>
    )}

    {/* Total Cost */}
    <div className={styles.priceDetailRow}>
      <div className={styles.priceField}>Total Cost</div>
      <div className={styles.priceValue}>
        ₹{totalCostWithDelivery}
      </div>
    </div>

    {/* Coupon Button */}
    <div className={styles.priceDetailRow}>
      <CouponButton
        couponState={couponState}
        openCouponDialog={onOpenCoupon}
        removeCoupon={onRemoveCoupon}
      />
    </div>
  </div>
)};

export default PriceDetails;
