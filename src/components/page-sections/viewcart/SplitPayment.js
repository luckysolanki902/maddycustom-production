import React from 'react';
import styles from './styles/splitpayment.module.css';
import { motion } from 'framer-motion';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import LocalAtmIcon from '@mui/icons-material/LocalAtm';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

export default function SplitPayment({ isSplitPayment, totalAmount }) {
  let onlineAmount = 0;
  let codAmount = 0;

  if (isSplitPayment) {
    onlineAmount = Math.ceil(totalAmount * 0.3);
    codAmount = totalAmount - onlineAmount;
  } else {
    onlineAmount = totalAmount;
  }

  const onlinePercentage = Math.round((onlineAmount / totalAmount) * 100);
  const codPercentage = 100 - onlinePercentage;

  const onlineColor = '#3182CE';
  const codColor = '#38A169';

  return (
    <motion.div 
      className={styles.splitPaymentContainer}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className={styles.splitHeader}>
        <h4 className={styles.splitTitle}>Split Payment</h4>
        <p className={styles.splitSubtitle}>Your payment will be processed in two parts</p>
      </div>

      <div className={styles.paymentFlow}>
        <div className={styles.paymentStep}>
          <div 
            className={styles.paymentIconContainer} 
            style={{ backgroundColor: `${onlineColor}15` }}
          >
            <CreditCardIcon className={styles.paymentIcon} style={{ color: onlineColor }} />
          </div>
          <div className={styles.paymentStepDetails}>
            <span className={styles.paymentLabel}>Pay Online</span>
            <span className={styles.paymentAmount}>₹{onlineAmount.toFixed(0)}</span>
            <span className={styles.paymentTiming}>Now</span>
          </div>
        </div>

        <div className={styles.paymentDivider}>
          <ArrowForwardIcon className={styles.arrowIcon} />
        </div>

        <div className={styles.paymentStep}>
          <div 
            className={styles.paymentIconContainer}
            style={{ backgroundColor: `${codColor}15` }}
          >
            <LocalAtmIcon className={styles.paymentIcon} style={{ color: codColor }} />
          </div>
          <div className={styles.paymentStepDetails}>
            <span className={styles.paymentLabel}>Pay on Delivery</span>
            <span className={styles.paymentAmount}>₹{codAmount.toFixed(0)}</span>
            <span className={styles.paymentTiming}>Later</span>
          </div>
        </div>
      </div>

      <div className={styles.splitBarContainer}>
        <div className={styles.splitBarLabels}>
          <span>Online Payment ({onlinePercentage}%)</span>
          <span>Cash on Delivery ({codPercentage}%)</span>
        </div>
        <div className={styles.splitBar}>
          <div 
            className={styles.onlinePortion} 
            style={{ 
              width: `${onlinePercentage}%`, 
              backgroundColor: onlineColor
            }}
          />
          <div 
            className={styles.codPortion}
            style={{ 
              width: `${codPercentage}%`, 
              backgroundColor: codColor
            }}
          />
        </div>
      </div>

      <div className={styles.splitNote}>
        <p>Complete your order by paying ₹{onlineAmount.toFixed(0)} now, and the remaining ₹{codAmount.toFixed(0)} will be collected upon delivery.</p>
      </div>
    </motion.div>
  );
}
