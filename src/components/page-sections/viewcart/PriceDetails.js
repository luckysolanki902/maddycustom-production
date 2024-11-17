// components/page-sections/viewcart/PriceDetails.js

'use client';

import React from 'react';
import CouponButton from '@/components/utils/CouponButton';
import styles from './styles/viewcart.module.css';

const PriceDetails = ({
  deliveryCost,
  couponState,
  finalDiscount,
  totalCostWithDelivery,
  onOpenCoupon,
  onRemoveCoupon,
}) => (
  <div className={`${styles.cartItem} ${styles.priceDetails}`}>
    {/* Delivery Cost */}
    <div className={styles.priceDetailRow}>
      <div className={styles.priceField}>Delivery Cost</div>
      <div className={styles.priceValue}>
        <span className={styles.rupee}>₹</span>{deliveryCost.toFixed(2)}
      </div>
    </div>

    {/* Discount */}
    {couponState.couponApplied && (
      <div className={styles.priceDetailRow}>
        <div className={styles.priceField}>Discount</div>
        <div className={styles.priceValue}>
          ₹{finalDiscount.toFixed(2)}
        </div>
      </div>
    )}

    {/* Total Cost */}
    <div className={styles.priceDetailRow}>
      <div className={styles.priceField}>Total Cost</div>
      <div className={styles.priceValue}>
        ₹{totalCostWithDelivery.toFixed(2)}
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
);

export default PriceDetails;
