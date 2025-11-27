// components/page-sections/viewcart/PriceDetails.js

'use client';

import React, { useState } from 'react';
import styles from './styles/pricedetails.module.css';
import ReceiptIcon from '@mui/icons-material/Receipt';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { motion, AnimatePresence } from 'framer-motion';

const PriceDetails = ({
  subtotal,
  deliveryCost,
  couponState,
  discountAmount,
  totalCostWithDelivery,
  onOpenCoupon,
  onRemoveCoupon,
  extraCharge,
  totalMrp,
  originalTotal,
  standardDeliveryCost,
  hideCouponButton = false
}) => {
  const [showDetails, setShowDetails] = useState(false);
  
  const hasCoupon = couponState?.couponApplied;
  const hasDiscount = discountAmount > 0;
  const hasExtraCharge = extraCharge > 0;
  const isFreeDelivery = deliveryCost === 0;

  // Calculate total savings
  const mrpSavings = totalMrp > subtotal ? totalMrp - subtotal : 0;
  const deliverySavings = isFreeDelivery ? (standardDeliveryCost || 0) : 0;
  const totalSavings = mrpSavings + discountAmount + deliverySavings;
  
  const showOriginalTotal = originalTotal && originalTotal > totalCostWithDelivery;
  const displayOriginal = showOriginalTotal ? originalTotal : (totalMrp + (standardDeliveryCost || 0));

  return (
    <div className={styles.priceDetailsContainer}>
      {/* Header */}
      <div className={styles.headerSection}>
        <ReceiptIcon className={styles.headerIcon} />
        <h3 className={styles.headerTitle}>Price Details</h3>
      </div>

      {/* Item Total */}
      <div className={styles.priceRow}>
        <span className={styles.priceLabel}>Item Total</span>
        <div className={styles.priceValueContainer}>
          {totalMrp > subtotal && (
            <span className={styles.strikePrice}>₹{totalMrp.toLocaleString('en-IN')}</span>
          )}
          <span className={styles.priceValue}>₹{subtotal.toLocaleString('en-IN')}</span>
        </div>
      </div>

      {/* Delivery Fee - Always visible (important for conversion) */}
      <div className={styles.priceRow}>
        <span className={styles.priceLabel}>Delivery Fee</span>
        {isFreeDelivery ? (
          <div className={styles.priceValueContainer}>
            <span className={styles.strikePrice}>₹{standardDeliveryCost?.toLocaleString('en-IN') || '100'}</span>
            <span className={styles.freeLabel}>Free</span>
          </div>
        ) : (
          <span className={styles.priceValue}>₹{deliveryCost.toLocaleString('en-IN')}</span>
        )}
      </div>

      {/* Coupon Row */}
      {!hideCouponButton && (
        <div className={styles.couponRow}>
          <div className={styles.couponLeft}>
            <LocalOfferOutlinedIcon className={hasCoupon ? styles.couponIconGreen : styles.couponIcon} />
            <span className={hasCoupon ? styles.couponTextGreen : styles.couponText}>
              {hasCoupon ? `${couponState.couponName} applied` : 'See all available coupons'}
            </span>
          </div>
          {hasCoupon ? (
            <button className={styles.removeBtn} onClick={onRemoveCoupon}>Remove</button>
          ) : (
            <button className={styles.viewBtn} onClick={onOpenCoupon}>View</button>
          )}
        </div>
      )}

      {/* When best coupon applied - show minimal inline */}
      {hideCouponButton && hasCoupon && (
        <div className={styles.couponRow}>
          <div className={styles.couponLeft}>
            <LocalOfferOutlinedIcon className={styles.couponIconGreen} />
            <span className={styles.couponTextGreen}>{couponState.couponName} applied</span>
          </div>
          <button className={styles.removeBtn} onClick={onRemoveCoupon}>Remove</button>
        </div>
      )}

      {/* Expandable Details */}
      <AnimatePresence>
        {showDetails && (
          <motion.div
            className={styles.expandedSection}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Discount Row */}
            {hasDiscount && (
              <div className={`${styles.priceRow} ${styles.discountRow}`}>
                <span className={styles.priceLabel}>Discount {hasCoupon && `(${couponState.couponName})`}</span>
                <span className={styles.discountValue}>-₹{discountAmount.toLocaleString('en-IN')}</span>
              </div>
            )}

            {/* Extra Charge */}
            {hasExtraCharge && (
              <div className={styles.priceRow}>
                <span className={styles.priceLabel}>Convenience Fee</span>
                <span className={styles.priceValue}>₹{extraCharge.toLocaleString('en-IN')}</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Total Row */}
      <div className={styles.totalRow}>
        <span className={styles.totalLabel}>Total Amount</span>
        <div className={styles.totalValueContainer}>
          {displayOriginal > totalCostWithDelivery && (
            <span className={styles.originalTotal}>₹{displayOriginal.toLocaleString('en-IN')}</span>
          )}
          <span className={styles.totalValue}>₹{totalCostWithDelivery.toLocaleString('en-IN')}</span>
        </div>
      </div>

      {/* Savings - Inline text only */}
      {totalSavings > 0 && (
        <div className={styles.savingsRow}>
          <span className={styles.savingsText}>
            You saved ₹{totalSavings.toLocaleString('en-IN')} on this order
          </span>
        </div>
      )}

      {/* Toggle Details - only show if there's breakdown content */}
      {(hasDiscount || hasExtraCharge) && (
        <button 
          className={styles.toggleBtn}
          onClick={() => setShowDetails(!showDetails)}
        >
          {showDetails ? 'Hide details' : 'See price breakdown'}
          {showDetails ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </button>
      )}
    </div>
  );
};

export default PriceDetails;
