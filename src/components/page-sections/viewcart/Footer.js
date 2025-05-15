// components/page-sections/viewcart/Footer.js
'use client';

import React from 'react';
import { useTransition, animated } from '@react-spring/web';
import { Typography, Divider } from '@mui/material';
import styles from './styles/viewcart.module.css';
import BlackButtonWithOnClick from '@/components/utils/BlackButtonWithOnClick';
const Footer = ({ totalCost, originalTotal, onCheckout,  onlinePercentage, codPercentage, isRevalidatingCoupons }) => {
console.log('revalidating')
  const onlineAmount = Math.floor((totalCost * onlinePercentage) / 100);
  const codAmount = Math.ceil((totalCost * codPercentage) / 100);

  const showSplit = codAmount > 0 && onlineAmount > 0;

  // Define transitions for the split payment section
  const transitions = useTransition(showSplit, {
    from: { opacity: 0, transform: 'translateY(-20px)' },
    enter: { opacity: 1, transform: 'translateY(0px)' },
    config: { tension: 220, friction: 20 },
  });

  return (
    <footer className={styles.footer}>
      <div className={`${styles.leftSection} ${showSplit ? styles.borderRt : ''}  `}>

        {transitions((style, item) =>
          item ? (
            <animated.div style={style} className={styles.paymentSplitMainDiv}>
              <div className={styles.paymentSplit}>
                <Typography variant="body1" className={styles.paymentText} sx={{fontSize:'0.9rem'}}>
                  Online <br /> Payment <span className={styles.amount}>₹{onlineAmount}</span>
                </Typography>
              </div>
              <hr style={{height:'2px', width:'100%'}}/>
              <div className={styles.paymentSplit}>
                <Typography variant="body1" className={styles.paymentText} sx={{fontSize:'0.9rem'}}>
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
          <Typography variant="h6" className={styles.totalCostLabel} sx={{fontSize: { xs: '1.2rem', sm: '1.5rem' }}}>
            Total
          </Typography>
          <Typography variant="body1" className={styles.totalCostValue}>
            <span className={styles.rupee}>₹</span>{totalCost}
            {originalTotal && (
              <span className={styles.originalTotal}>₹{originalTotal}</span>
            )}
          </Typography>
        </div>
      </div>

      <Divider orientation="vertical" flexItem  />

      {/* Right Section: Total Cost and Checkout Button */}
      <div className={styles.rightSection}>
        <BlackButtonWithOnClick isLoading={false} buttonText={isRevalidatingCoupons ? 'Validating...' : 'Checkout'} onClick={onCheckout} isDisabled={isRevalidatingCoupons}  />
      </div>
    </footer>
  );
};

export default Footer;
