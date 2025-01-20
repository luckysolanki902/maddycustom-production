// components/page-sections/viewcart/PriceDetails.js

'use client';

import React from 'react';
import CouponButton from '@/components/utils/CouponButton';
import styles from './styles/viewcart.module.css';
import OrderSpecifications from '../product-id-page/OrderSpecifications';

const Features = ({ features}) => { 
  console.log({features})
 return (
  <div className={`${styles.cartItem} ${styles.priceDetails}`}>
    <OrderSpecifications features={features} />
  </div>
)};

export default Features;
