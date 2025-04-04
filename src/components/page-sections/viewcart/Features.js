// components/page-sections/viewcart/PriceDetails.js

'use client';

import React from 'react';
import CouponButton from '@/components/utils/CouponButton';
import styles from './styles/viewcart.module.css';
import OrderSpecifications from '../product-id-page/OrderSpecifications';

const Features = ({ features, extraMargin }) => {
  return (
    <div className={`${styles.cartItem} ${styles.priceDetails}`} style={{ marginTop: extraMargin ? '0.8rem' : '0' }}>
      <OrderSpecifications features={features} />
    </div>
  )
};

export default Features;
