// components/page-sections/viewcart/Footer.js
'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { CircularProgress } from '@mui/material';
import styles from './styles/footer.module.css';

const Footer = ({ totalCost, originalTotal, onCheckout, isRevalidatingCoupons = false, discount = 0, onlinePercentage, codPercentage }) => {
  const handleCheckout = () => {
    if (isRevalidatingCoupons) return;
    onCheckout();
  };

  // Check if there's a discount to show savings
  const hasSavings = originalTotal > totalCost;
  
  // Calculate percentage savings
  const savingsPercent = hasSavings ? Math.round(((originalTotal - totalCost) / originalTotal) * 100) : 0;

  // Determine if this is a split payment scenario
  const isSplitPayment = onlinePercentage > 0 && onlinePercentage < 100;

  // Calculate split amounts
  const onlineAmount = isSplitPayment ? Math.round((totalCost * onlinePercentage) / 100) : totalCost;
  const codAmount = isSplitPayment ? totalCost - onlineAmount : 0;

  // Determine primary payment mode label for non-split payments
  const paymentModeLabel = (() => {
    if (typeof onlinePercentage === 'number') {
      if (onlinePercentage >= 100) return 'Pay Online';
      if (onlinePercentage <= 0) return 'Cash On Delivery';
    }
    if (typeof codPercentage === 'number') {
      if (codPercentage >= 100) return 'Cash On Delivery';
      if (codPercentage <= 0) return 'Pay Online';
    }
    // Default to COD if unclear
    return 'Cash On Delivery';
  })();

  return (
    <div className={styles.footerContainer}>
      <div className={styles.priceContainer}>
        {isSplitPayment ? (
          <div className={styles.splitWrapper}>
            <div className={styles.totalAmount}>
              <span className={styles.totalText}>Total</span>
              <div className={styles.priceStack}>
                <span className={styles.finalPrice}>₹{totalCost.toFixed(0)}</span>
                {hasSavings && (
                  <span className={styles.originalPrice}>₹{originalTotal.toFixed(0)}</span>
                )}
              </div>
            </div>
            
            <div className={styles.paymentSplitContainer}>
              <div className={styles.paymentOption}>
                <div>
                  <span className={styles.paymentLabel}>Pay Online</span>
                  <span className={styles.paymentAmount}>₹{onlineAmount}</span>
                </div>
              </div>
              
              <div className={styles.divider}>+</div>
              
              <div className={styles.paymentOption}>
                <div>
                  <span className={styles.paymentLabel}>Pay on Delivery</span>
                  <span className={styles.paymentAmount}>₹{codAmount}</span>
                </div>
              </div>
            </div>
            
            {/* {hasSavings && (
              <div className={styles.savingsBadge}>
                <span>Save {savingsPercent}%</span>
              </div>
            )} */}
          </div>
        ) : (
          <div className={styles.priceSummary}>
            <div className={styles.priceDetails}>
              <span className={styles.totalText}>Total Amount</span>
              <div className={styles.priceStack}>
                <span className={styles.finalPrice}>
                  ₹{totalCost.toFixed(0)}
                </span>
                <span className={styles.originalPrice}>
                  ₹{originalTotal > totalCost ? originalTotal.toFixed(0) : (totalCost * 1.2).toFixed(0)}
                </span>
              </div>
            </div>

            {/* Payment mode tag (same styling as split payment, no amount) */}
            <div className={styles.paymentSplitContainer} style={{ marginLeft: 12 }}>
              <div className={styles.paymentOption}>
                <div>
                  <span className={styles.paymentLabel}>{paymentModeLabel}</span>
                </div>
              </div>
            </div>
            
            {/* {hasSavings && (
              <div className={styles.savingsBadge}>
                <span>Save {savingsPercent}%</span>
              </div>
            )} */}
          </div>
        )}
      </div>
      
      <motion.button
        className={`${styles.checkoutButton} ${styles.shineEffect}`}
        onClick={handleCheckout}
        disabled={isRevalidatingCoupons}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 400, damping: 8 }}
      >
        {isRevalidatingCoupons ? (
          <div className={styles.loadingContainer}>
            <CircularProgress size={20} color="inherit" />
            <span>Preparing...</span>
          </div>
        ) : (
          <span>Place Order</span>
        )}
      </motion.button>
    </div>
  );
};

export default Footer;
