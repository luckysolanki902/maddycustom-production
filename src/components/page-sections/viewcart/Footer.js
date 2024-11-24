'use client';

import React from 'react';
import { useTransition, animated } from '@react-spring/web';
import { Typography } from '@mui/material';
import BlackButton from '@/components/utils/BlackButton';
import styles from './styles/viewcart.module.css';

const Footer = ({ totalCost, originalTotal, onCheckout, onlineAmount, codAmount }) => {
  const showSplit = codAmount > 0 && onlineAmount > 0;

  // Define transitions for the split payment section
  const transitions = useTransition(showSplit, {
    from: { opacity: 0, transform: 'translateY(-20px)' },
    enter: { opacity: 1, transform: 'translateY(0px)' },
    config: { tension: 220, friction: 20 },
  });

  return (
    <footer className={styles.footer}>
      <div       className={`
            ${styles.leftSection} 
            ${showSplit ? styles.borderRt : ''}
          `}>
        {/* Animated Split Payment Section */}
        {transitions((style, item) =>
          item ? (
            <animated.div style={style} className={styles.paymentSplitMainDiv}>
              <div className={styles.paymentSplit}>
                <Typography variant="body1" className={styles.paymentText}>
                  Online <br /> Payment <span className={styles.amount}>₹{onlineAmount}</span>
                </Typography>
              </div>
              <hr />
              <div className={styles.paymentSplit}>
                <Typography variant="body1" className={styles.paymentText}>
                  Pay on <br /> Delivery <span className={styles.amount}>₹{codAmount}</span>
                </Typography>
              </div>
            </animated.div>
          ) : null
        )}

        {/* Total Cost Section with Conditional Styling */}
        <div
          className={`
            ${styles.totalCost} 
          
          `}
        >
          <Typography variant="h6" className={styles.totalCostLabel}>
            Total Cost
          </Typography>
          <Typography variant="body1" className={styles.totalCostValue}>
            <span className={styles.rupee}>₹</span>{totalCost}
            {originalTotal && (
              <span className={styles.originalTotal}>₹{originalTotal}</span>
            )}
          </Typography>
        </div>
      </div>

      {/* Right Section: Total Cost and Checkout Button */}
      <div className={styles.rightSection}>
        <BlackButton isLoading={false} buttonText="ORDER" onClick={onCheckout} />
      </div>
    </footer>
  );
};

export default Footer;
