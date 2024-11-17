// components/page-sections/viewcart/CartList.js

'use client';

import React from 'react';
import CartItem from './CartItem';
import styles from './styles/viewcart.module.css';

const CartList = ({ cartItems, onRemove }) => (
  <section className={styles.cartList}>
    {cartItems.map((item) => (
      <CartItem key={item.productId} item={item} onRemove={onRemove} />
    ))}
  </section>
);

export default CartList;
