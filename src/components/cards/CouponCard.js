// components/cards/CouponCard.js

import React from 'react';
import styles from './styles/couponcard.module.css';
import { Button } from '@mui/material';

const CouponCard = ({
  discount,
  discountType,
  validity,
  name,
  onApply,
  thumbnail,
  applicable,
  conditionMessage,
}) => {
  const handleApplyClick = () => {
    onApply(name, discount, discountType);
  };

  // Use the thumbnail as the background if available.

  const backgroundStyle = thumbnail
    ? { backgroundImage: `url(${process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL}/${thumbnail})` }
    : {};  


  // Apply grayscale and reduce opacity if not applicable.
  const cardStyle = {
    ...backgroundStyle,
    filter: applicable ? 'none' : 'grayscale(100%) opacity(0.8)',
  };

  return (
    <div className={styles.card} style={cardStyle}>
      <div className={styles.overlay}></div>
      <div className={styles.content}>
        <div className={styles.header}>
          <h3 className={styles.couponName}>{name}</h3>
        </div>
        <div className={styles.discountSection}>
          <span className={styles.discountValue}>
            {discountType === 'percentage' ? `${discount}%` : `₹${discount}`}
          </span>
          <span className={styles.offText}>OFF</span>
        </div>
        <div className={styles.validity}>
          Valid till {new Date(validity).toLocaleDateString()}
        </div>
        {!applicable && conditionMessage && (
          <div className={styles.conditionMessage}>{conditionMessage}</div>
        )}
        <div className={styles.applyButton}>
          {applicable &&<Button
            variant="contained"
            color="primary"
            onClick={handleApplyClick}
            disabled={!applicable}
          >
            Apply
          </Button>}
        </div>
      </div>
    </div>
  );
};

export default CouponCard;
