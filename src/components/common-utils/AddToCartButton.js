// @/components/common-utils/AddToCartButton.js
'use client';

import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSpring, animated } from 'react-spring';
import styles from './styles/addtocartbutton.module.css';
import {
  addItem,
  incrementQuantity,
  decrementQuantity,
  removeItem,
} from '../../store/slices/cartSlice';

export default function AddToCartButton({ product }) {
  const dispatch = useDispatch();
  const cartItems = useSelector((state) => state.cart.items);
  const cartItem = cartItems.find((item) => item.productId === product._id);

  // State to track last action
  const [lastAction, setLastAction] = useState(null); // 'increment' or 'decrement'

  // React Spring animation for quantity
  const props = useSpring({
    // Animate scale and color based on lastAction
    scale: lastAction === 'increment' || lastAction === 'decrement' ? 0.9 : 1,
    color:
      lastAction === 'increment'
        ? '#28a745' // Green
        : lastAction === 'decrement'
        ? '#dc3545' // Red
        : '#000',
    opacity: cartItem ? 1 : 0,
    config: {
      tension: 300,
      friction: 10,
    },
    onRest: () => {
      // Reset scale and color after animation
      if (lastAction) {
        setLastAction(null);
      }
    },
  });

  useEffect(() => {
    if (!cartItem) {
      // When item is removed, ensure opacity is set to 0
      // The useSpring already handles opacity based on cartItem
    }
    // No need for additional logic here
  }, [cartItem]);

  const handleAdd = (e) => {
    e.stopPropagation(); // Prevent parent onClick
    setLastAction('increment');
    dispatch(addItem({ productId: product._id, productDetails: product }));
  };

  const handleIncrement = (e) => {
    e.stopPropagation();
    setLastAction('increment');
    dispatch(incrementQuantity({ productId: product._id }));
  };

  const handleDecrement = (e) => {
    e.stopPropagation();
    setLastAction('decrement');
    if (cartItem.quantity === 1) {
      dispatch(removeItem({ productId: product._id }));
    } else {
      dispatch(decrementQuantity({ productId: product._id }));
    }
  };

  if (cartItem) {
    return (
      <div className={styles.main}>
        <button onClick={handleDecrement} className={styles.decrement}>
          -
        </button>
        <animated.div
          style={{
            transform: props.scale.to((s) => `scale(${s})`),
            color: props.color,
            opacity: props.opacity,
          }}
          className={styles.quantity}
        >
          {cartItem.quantity}
        </animated.div>
        <button onClick={handleIncrement} className={styles.increment}>
          +
        </button>
      </div>
    );
  }

  return (
    <button onClick={handleAdd} className={styles.main}>
      <span className={styles.addToCart}>Add to cart</span>
    </button>
  );
}
