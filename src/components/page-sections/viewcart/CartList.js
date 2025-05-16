// components/page-sections/viewcart/CartList.js

'use client';

import React from 'react';
import CartItem from './CartItem';
import styles from './styles/viewcart.module.css';
import Features from './Features';
import Image from 'next/image';

const CartList = ({ cartItems, onRemove }) => (
  <div className={styles.cartList}
  >
    <div className={styles.freeShippingBanner}>
      <div className={styles.freeShippingBannerTopBg}>
      </div>
      <div className={styles.freeShippingBannerContent}>
        {/* <Image src="/Free Shipping.png" alt="Free Shipping" width={40} height={40}></Image> */}
        <span style={{ fontSize: '1.6rem' }}>
          🥳
        </span>
        <span>You saved ₹100 on FREE shipping</span>
      </div>
    </div>

    {cartItems.map((item) => (
      <CartItem key={item.productId} item={item} onRemove={onRemove} />
    ))}

    <Features extraMargin={true} features={cartItems[0]?.productDetails.variantDetails.features} />
  </div>
);

export default CartList;
