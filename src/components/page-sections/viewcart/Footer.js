// components/page-sections/viewcart/Footer.js
'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { CircularProgress } from '@mui/material';
import styles from './styles/footer.module.css';
import { useSelector } from 'react-redux';
const Footer = ({ totalCost, originalTotal, onCheckout, isRevalidatingCoupons = false, discount = 0, onlinePercentage, codPercentage }) => {
  const [isPaymentProcessing, setIsPaymentProcessing] = React.useState(false);
  const cartItems = useSelector(s => s.cart.items);
  const handleCheckout = async () => {
    if (isRevalidatingCoupons) return;
    setIsPaymentProcessing(true);
    console.log("aa");
    onCheckout();
    try {
      console.log('Placing order with total cost:', totalCost);
      // Call your API route instead of using Node.js modules directly
      const response = await fetch('/api/shiprocket/fetch-address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cart_data: {
            items: cartItems.map(item => ({
              variant_id: item.variantId || item.id,
              quantity: item.quantity
            }))
          }
        })
      });
      
      const result = await response.json();
      console.log('Order response:', result);
      if (response.ok) {
        localStorage.setItem('lastOrderId', result.orderId);
        // showSnackbar('Order placed successfully!', 'success');
        
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        showSnackbar(result.message || 'Failed to place order', 'error');
      }
    } catch (error) {
      console.error('Error placing order:', error);
      // showSnackbar('Something went wrong. Please try again.', 'error');
    } finally {
      setIsPaymentProcessing(false);
    }
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
