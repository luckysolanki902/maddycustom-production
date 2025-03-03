// src/components/utils/AddToCartButton.js
'use client';

import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSpring, animated } from 'react-spring';
import styles from './styles/addtocartbutton.module.css';
import RemoveIcon from '@mui/icons-material/Remove';
import AddIcon from '@mui/icons-material/Add';
import {
  addItem,
  incrementQuantity,
  decrementQuantity,
  removeItem,
} from '../../store/slices/cartSlice';
import { addToCart as trackAddToCart } from '@/lib/metadata/facebookPixels';

export default function AddToCartButton({ product, isBlackButton = false, isLarge = false }) {
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
          : isBlackButton ? '#fff' : '#000',
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

  const handleAdd = async (e) => {
    e.stopPropagation(); // Prevent parent onClick
    setLastAction('increment');
    dispatch(addItem({ productId: product._id, productDetails: product }));

    // Track AddToCart event
    try {
      await trackAddToCart(product);
    } catch (error) {
      console.error('AddToCart tracking failed:', error);
      // Do not interfere with user experience
    }
  };

  const handleIncrement = async (e) => {
    e.stopPropagation();
    setLastAction('increment');
    dispatch(incrementQuantity({ productId: product._id }));

    // Track AddToCart event (increment)
    try {
      await trackAddToCart(product);
    } catch (error) {
      console.error('AddToCart tracking failed:', error);
      // Do not interfere with user experience
    }
  };

  const handleDecrement = async (e) => {
    e.stopPropagation();
    setLastAction('decrement');
    if (cartItem.quantity === 1) {
      dispatch(removeItem({ productId: product._id }));
    } else {
      dispatch(decrementQuantity({ productId: product._id }));
    }
  };

  // Construct the main container's className
  const mainClasses = [
    styles.main,
    isBlackButton ? styles.blackButton : '',
    isLarge ? styles.largeButton : '',
  ].join(' ').trim();

  if (cartItem) {
    return (
      <div className={mainClasses} onClick={(e) => e.stopPropagation()}>
        <button onClick={handleDecrement} className={styles.decrement}>
          <RemoveIcon fontSize='1rem'/>
        </button>
        <animated.div
          onClick={(e) => e.stopPropagation()}
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
          <AddIcon fontSize='1rem'/>
        </button>
      </div>
    );
  }

  // Construct the Add to Cart button's className
  const addToCartClasses = [
    styles.main,
    styles.addToCart,
    isBlackButton ? styles.blackButton : '',
    isLarge ? styles.largeButton : '',
  ].join(' ').trim();

  return (
    <button onClick={handleAdd} className={addToCartClasses}>
      <span>Add to cart</span>
    </button>
  );
}
