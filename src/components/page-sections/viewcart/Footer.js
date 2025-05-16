// components/page-sections/viewcart/Footer.js
'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { CircularProgress } from '@mui/material';
import styles from './styles/footer.module.css';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import LocalAtmIcon from '@mui/icons-material/LocalAtm';

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

  return (
    <div className={styles.footerContainer}>
      {isSplitPayment ? (
        <div className={styles.splitPaymentFooter}>
          <div className={styles.splitInfo}>
            <div className={styles.splitAmount}>
              <div className={styles.amountWithIcon}>
                <span className={styles.payNowLabel}>Pay now</span>
                <span className={styles.splitAmountValue}>₹{onlineAmount}</span>
              </div>
              <div className={styles.splitDivider}>+</div>
              <div className={styles.amountWithIcon}>
                <span className={styles.payLaterLabel}>Pay on delivery</span>
                <span className={styles.splitAmountValue}>₹{codAmount}</span>
              </div>
            </div>
            <div className={styles.splitVisual}>
              <div 
                className={styles.onlinePortion} 
                style={{width: `${onlinePercentage}%`}}
              >
                <span className={styles.percentLabel}>{onlinePercentage}%</span>
              </div>
              <div 
                className={styles.codPortion} 
                style={{width: `${codPercentage || (100 - onlinePercentage)}%`}}
              >
                <span className={styles.percentLabel}>{codPercentage || (100 - onlinePercentage)}%</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.priceSummary}>
          <div className={styles.priceDetails}>
            <span className={styles.totalText}>Total</span>
            <div className={styles.priceStack}>
              {hasSavings && (
                <span className={styles.originalPrice}>
                  ₹{originalTotal.toFixed(0)}
                </span>
              )}
              <span className={styles.finalPrice}>
                ₹{totalCost.toFixed(0)}
              </span>
            </div>
          </div>
          
          {hasSavings && (
            <div className={styles.savingsBadge}>
              <span>Save {savingsPercent}%</span>
            </div>
          )}
        </div>
      )}
      
      <motion.button
        className={`${styles.checkoutButton} ${styles.shineEffect}`}
        onClick={handleCheckout}
        disabled={isRevalidatingCoupons}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: "spring", stiffness: 400, damping: 8 }}
      >
        {isRevalidatingCoupons ? (
          <div className={styles.loadingContainer}>
            <CircularProgress size={24} color="inherit" />
            <span>Preparing...</span>
          </div>
        ) : (
          <span>Place Order {isSplitPayment ? `(₹${totalCost})` : ''}</span>
        )}
      </motion.button>
    </div>
  );
};

export default Footer;
