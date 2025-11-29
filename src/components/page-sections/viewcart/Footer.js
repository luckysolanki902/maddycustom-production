// components/page-sections/viewcart/Footer.js
'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CircularProgress } from '@mui/material';
import BoltIcon from '@mui/icons-material/Bolt';
import styles from './styles/footer.module.css';

const Footer = ({ totalCost, originalTotal, onCheckout, isRevalidatingCoupons = false, discount = 0, onlinePercentage, codPercentage, showPreparingUi = false }) => {
  const handleCheckout = () => {
    onCheckout();
  };

  // Check if there's a discount to show savings
  const hasSavings = originalTotal > totalCost;

  // Determine if this is a split payment scenario
  const isSplitPayment = onlinePercentage > 0 && onlinePercentage < 100;

  // Calculate split amounts
  const onlineAmount = isSplitPayment ? Math.round((totalCost * onlinePercentage) / 100) : totalCost;
  const codAmount = isSplitPayment ? totalCost - onlineAmount : 0;

  // CTA text with amount
  const ctaText = isSplitPayment 
    ? `PAY ₹${onlineAmount.toLocaleString('en-IN')} NOW`
    : `PAY ₹${totalCost.toLocaleString('en-IN')} NOW`;

  return (
    <div className={styles.footerContainer}>
      {/* Price Info Section - Animated on payment mode change */}
      <div className={styles.priceSection}>
        {/* Total Amount - Always visible */}
        <div className={styles.totalBlock}>
          <span className={styles.totalLabel}>Total</span>
          <div className={styles.totalRow}>
            <span className={styles.totalAmount}>₹{totalCost.toLocaleString('en-IN')}</span>
            {hasSavings && (
              <span className={styles.originalAmount}>₹{originalTotal.toLocaleString('en-IN')}</span>
            )}
          </div>
        </div>

        {/* Payment Info - Animated transition */}
        <AnimatePresence mode="wait">
          {isSplitPayment ? (
            <motion.div 
              key="split"
              className={styles.paymentInfo}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <div className={styles.splitBadge}>
                <span className={styles.splitItem}>
                  <span className={styles.splitLabel}>Now</span>
                  <span className={styles.splitValue}>₹{onlineAmount.toLocaleString('en-IN')}</span>
                </span>
                <span className={styles.splitDivider}>+</span>
                <span className={styles.splitItem}>
                  <span className={styles.splitLabel}>Later</span>
                  <span className={styles.splitValue}>₹{codAmount.toLocaleString('en-IN')}</span>
                </span>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="online"
              className={styles.paymentInfo}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <span className={styles.paymentTag}>Pay Online</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Button - Unchanged as requested */}
      <motion.button
        className={`${styles.checkoutButton} ${styles.shineEffect}`}
        data-clarity-element="begin-checkout-button"
        onClick={handleCheckout}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 400, damping: 8 }}
      >
        {showPreparingUi && isRevalidatingCoupons ? (
          <div className={styles.loadingContainer}>
            <CircularProgress size={20} color="inherit" />
            <span>Preparing...</span>
          </div>
        ) : (
          <div className={styles.ctaContent}>
            <BoltIcon className={styles.ctaIcon} />
            <span>{ctaText}</span>
          </div>
        )}
      </motion.button>
    </div>
  );
};

export default Footer;
