// components/page-sections/viewcart/Footer.js
'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { CircularProgress } from '@mui/material';
import styles from './styles/footer.module.css';

const Footer = ({ totalCost, originalTotal, onCheckout, isRevalidatingCoupons = false, discount = 0, showPreparingUi = false }) => {
  const handleCheckout = (event) => {
    onCheckout(event);
  };

  // Check if there's a discount to show savings
  const hasSavings = originalTotal > totalCost;

  // CTA text
  const ctaText = 'Place Order';

  return (
    <div className={styles.footerContainer}>
      {/* Price Info Section */}
      <div className={styles.priceSection}>
        {/* Total Amount */}
        <div className={styles.totalBlock}>
          <span className={styles.totalLabel}>Total</span>
          <div className={styles.totalRow}>
            <span className={styles.totalAmount}>₹{totalCost.toLocaleString('en-IN')}</span>
            {hasSavings && (
              <span className={styles.originalAmount}>₹{originalTotal.toLocaleString('en-IN')}</span>
            )}
          </div>
        </div>
      </div>
      
      {/* Checkout Button */}
      <motion.button
        className={`${styles.checkoutButton} ${styles.shineEffect}`}
        data-clarity-element="begin-checkout-button"
        onClick={handleCheckout}
        disabled={isRevalidatingCoupons}
        whileHover={{ scale: isRevalidatingCoupons ? 1 : 1.02 }}
        whileTap={{ scale: isRevalidatingCoupons ? 1 : 0.98 }}
        transition={{ type: "spring", stiffness: 400, damping: 8 }}
      >
        {showPreparingUi || isRevalidatingCoupons ? (
          <div className={styles.loadingContainer}>
            <CircularProgress size={20} color="inherit" />
            <span>Preparing...</span>
          </div>
        ) : (
          <div className={styles.ctaContent}>
            <span>{ctaText}</span>
          </div>
        )}
      </motion.button>
    </div>
  );
};

export default Footer;
