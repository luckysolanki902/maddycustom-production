// components/page-sections/viewcart/PriceDetails.js

'use client';

import React from 'react';
import CouponButton from '@/components/utils/CouponButton';
import styles from './styles/pricedetails.module.css';
import ReceiptIcon from '@mui/icons-material/Receipt';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import { motion } from 'framer-motion';

const PriceDetails = ({
  subtotal,
  deliveryCost,
  couponState,
  discountAmount,
  totalCostWithDelivery,
  onOpenCoupon,
  onRemoveCoupon,
  extraCharge
}) => {
  const hasCoupon = couponState?.couponApplied;
  const hasDiscount = discountAmount > 0;
  const hasDelivery = deliveryCost > 0;
  const hasExtraCharge = extraCharge > 0;

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className={styles.priceDetailsContainer}>
      <div className={styles.headerSection}>
        <ReceiptIcon className={styles.headerIcon} />
        <h3 className={styles.headerTitle}>Price Details</h3>
      </div>
      
      <div className={styles.priceBreakdown}>
        <motion.div 
          className={styles.priceRow}
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <span className={styles.priceLabel}>Item Total</span>
          <span className={styles.priceValue}>₹{subtotal.toFixed(0)}</span>
        </motion.div>
        
        {hasDiscount && (
          <motion.div 
            className={`${styles.priceRow} ${styles.discountRow}`}
            variants={itemVariants}
            initial="hidden"
            animate="visible"
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <div className={styles.labelWithAction}>
              <span className={styles.priceLabel}>Discount</span>
              {hasCoupon && (
                <div className={styles.appliedCoupon}>
                  <span className={styles.couponCode}>{couponState.couponName}</span>
                  <button 
                    className={styles.removeCouponBtn}
                    onClick={onRemoveCoupon}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
            <span className={styles.discountValue}>-₹{discountAmount.toFixed(0)}</span>
          </motion.div>
        )}
        
        {!hasCoupon && (
          <motion.div 
            className={styles.applyCouponRow}
            variants={itemVariants}
            initial="hidden"
            animate="visible"
            transition={{ duration: 0.3, delay: 0.3 }}
          >
            <div className={styles.couponLeft}>
              <LocalOfferOutlinedIcon className={styles.couponIcon} />
              <span className={styles.couponText}>Apply Coupon</span>
            </div>
            <button 
              className={styles.applyCouponBtn}
              onClick={onOpenCoupon}
            >
              Apply
            </button>
          </motion.div>
        )}
        
        {hasDelivery && (
          <motion.div 
            className={styles.priceRow}
            variants={itemVariants}
            initial="hidden"
            animate="visible"
            transition={{ duration: 0.3, delay: 0.4 }}
          >
            <span className={styles.priceLabel}>Delivery Fee</span>
            <span className={styles.priceValue}>₹{deliveryCost.toFixed(0)}</span>
          </motion.div>
        )}
        
        {hasExtraCharge && (
          <motion.div 
            className={styles.priceRow}
            variants={itemVariants}
            initial="hidden"
            animate="visible"
            transition={{ duration: 0.3, delay: 0.5 }}
          >
            <span className={styles.priceLabel}>Payment Method Fee</span>
            <span className={styles.priceValue}>₹{extraCharge.toFixed(0)}</span>
          </motion.div>
        )}
      </div>
      
      <motion.div 
        className={styles.totalRow}
        variants={itemVariants}
        initial="hidden"
        animate="visible"
        transition={{ duration: 0.3, delay: 0.6 }}
      >
        <span className={styles.totalLabel}>Total Amount</span>
        <span className={styles.totalValue}>₹{totalCostWithDelivery.toFixed(0)}</span>
      </motion.div>
      
      {hasDiscount && (
        <motion.div 
          className={styles.savingRow}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.7, duration: 0.4 }}
        >
          <span className={styles.savingText}>
            You saved ₹{discountAmount.toFixed(0)} on this order
          </span>
        </motion.div>
      )}
    </div>
)};

export default PriceDetails;
