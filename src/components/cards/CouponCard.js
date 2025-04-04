import React, { useState, useEffect } from 'react';
import { Button } from '@mui/material';
import styles from './styles/couponcard.module.css';

// Array of darker gradient backgrounds that look cool in any combination.
const darkerGradients = [
  'linear-gradient(135deg, #F02FC2, #6094EA)',
  'linear-gradient(135deg, #F5D020, #F53803)',
  'linear-gradient(135deg, #00C9FF, #92FE9D)',
  'linear-gradient(135deg, #FBAB7E, #F7CE68)',
  'linear-gradient(135deg, #EB3349, #F45C43)',
  'linear-gradient(135deg, #FFC107, #FF9900)',
  'linear-gradient(135deg, #45B3FA, #4183D7)',
  'linear-gradient(135deg, #6A6BD1, #7356B8)',
];

const CouponCard = ({
  discount,
  discountType, // 'percentage' or 'fixed'
  validity,
  name,
  onApply,
  applicable = true,
  conditionMessage,
}) => {
  // Persist the selected background color
  const [background, setBackground] = useState('');

  useEffect(() => {
    const selected = darkerGradients[Math.floor(Math.random() * darkerGradients.length)];
    setBackground(selected);
  }, []);

  const handleApplyClick = () => {
    if (onApply) {
      onApply(name, discount, discountType);
    }
  };

  return (
    <div
      className={`${styles.card} ${!applicable ? styles.notApplicable : ''}`}
      style={{ background: background }}
    >
      {/* Background overlay with big discount text */}
      <div className={styles.overlay}>
        <div className={styles.bigDiscount}>
          {discountType === 'percentage'
            ? `${discount}% OFF`
            : `₹${discount} OFF`}
        </div>
      </div>
      <div className={styles.dashedLine}></div>

      {/* Main content */}
      <div className={styles.content}>
        <div className={styles.header}>
          <h3 className={styles.couponName}>{name}</h3>
        </div>
        <div className={styles.discountSection}>
          <span className={styles.discountValue}>
            {discountType === 'percentage'
              ? `${discount}%`
              : `₹${discount}`}
          </span>
          <span className={styles.offText}>OFF</span>
        </div>
        <div className={styles.validity}>
          Valid till {new Date(validity).toLocaleDateString()}
        </div>
        {!applicable && conditionMessage && (
          <div className={styles.conditionMessage}>{conditionMessage}</div>
        )}
        {applicable && (
          <div className={styles.applyButton}>
            <Button variant="contained" onClick={handleApplyClick}>
              Apply
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CouponCard;
