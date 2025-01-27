// src/components/common-utils/AddToCartButton.js
'use client';

import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSpring, animated } from 'react-spring';
import styles from './styles/addtocartbuttonwithorder.module.css';
import AddIcon from '@mui/icons-material/Add';
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined';
import RemoveIcon from '@mui/icons-material/Remove';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import {
  addItem,
  incrementQuantity,
  decrementQuantity,
  removeItem,
} from '../../store/slices/cartSlice';
import { addToCart as trackAddToCart } from '@/lib/metadata/facebookPixels';
import { useRouter } from 'next/navigation';

export default function AddToCartButton({ product, isBlackButton = false, isLarge = false }) {
  const dispatch = useDispatch();
  const router = useRouter();
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

  const handleDecrement = (e) => {
    e.stopPropagation();
    setLastAction('decrement');
    if (cartItem.quantity === 1) {
      dispatch(removeItem({ productId: product._id }));
    } else {
      dispatch(decrementQuantity({ productId: product._id }));
    }
  };

  const handleOrderNow = () => {
    if (cartItem) {
      router.push('/viewcart');
    } else {
      dispatch(addItem({ productId: product._id, productDetails: product }));
      router.push('/viewcart');
    }
  };

  // Construct the main container's className
  const mainClasses = [
    styles.container,
    isBlackButton ? styles.blackButton : '',
    isLarge ? styles.largeButton : '',
  ].join(' ').trim();

  return (
    <div className={mainClasses}>
      {/* Add to Cart Section */}
      <div className={`${styles.addToCartSection}`}>
        {cartItem ? (
          <div className={styles.quantityContainer}>
            <button onClick={handleDecrement} className={styles.decrement}>
              <RemoveIcon fontSize='small' />
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
              <AddIcon fontSize='small' />
            </button>
          </div>
        ) : (
          <div onClick={handleAdd} className={styles.addToCartButton}>
            <ShoppingCartIcon fontSize='medium' className={styles.cartIcon} />
           Add To Cart
          </div>
        )}
      </div>

      {/* Order Now Section */}
  
        <div className={`${styles.orderNowSection} ${styles.halfWidth}`}>
          <div onClick={handleOrderNow} className={styles.orderNowButton}>
            <BoltOutlinedIcon fontSize='medium' className={styles.boltIcon} />
            Order Now
          </div>
        </div>

    </div>
  );
}
