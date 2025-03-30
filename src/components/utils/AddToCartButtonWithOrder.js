


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
import Link from 'next/link';
import Image from 'next/image';
import { useMediaQuery } from '@mui/material';

export default function AddToCartButton({ product, isBlackButton = false, isLarge = false }) {
  const isSmallDevice = useMediaQuery('(max-width: 1000px)');
  const dispatch = useDispatch();
  const router = useRouter();
  const cartItems = useSelector((state) => state.cart.items);
  const cartItem = cartItems.find((item) => item.productId === product._id);
  const imageBaseUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

  // State to track last action (for animation)
  const [lastAction, setLastAction] = useState(null);

  // React Spring animation for quantity display
  const props = useSpring({
    scale: lastAction === 'increment' || lastAction === 'decrement' ? 0.9 : 1,
    color:
      lastAction === 'increment'
        ? '#28a745'
        : lastAction === 'decrement'
          ? '#dc3545'
          : isBlackButton ? '#fff' : '#000',
    opacity: cartItem ? 1 : 0,
    config: {
      tension: 300,
      friction: 10,
    },
    onRest: () => {
      if (lastAction) setLastAction(null);
    },
  });

  // --- INVENTORY / STOCK MANAGEMENT ---
  // Use product.inventoryData if available; otherwise, if there's a selectedOption, use its inventoryData.
  const inventoryData =
    product.inventoryData ||
    (product.selectedOption && product.selectedOption.inventoryData) ||
    null;
  let maxAllowed = Infinity;
  let isLimited = false;
  if (inventoryData) {
    
    const { availableQuantity, reorderLevel } = inventoryData;
    maxAllowed=Math.floor(availableQuantity/2);
    isLimited=true
    if (availableQuantity < reorderLevel) {
      isLimited = true;
      maxAllowed = Math.min(availableQuantity, Math.floor(0.1 * reorderLevel));
    }
  }
  const currentQuantity = cartItem ? cartItem.quantity : 0;

  const handleAdd = async (e) => {
    e.stopPropagation();
    // If in limited mode and adding one would exceed allowed, do nothing.
    if (isLimited && (currentQuantity + 1) > maxAllowed) return;

    setLastAction('increment');
    dispatch(addItem({ productId: product._id, productDetails: product }));

    // Track AddToCart event
    try {
      await trackAddToCart(product);
    } catch (error) {
      console.error('AddToCart tracking failed:', error);
    }
  };

  const handleIncrement = async (e) => {
    e.stopPropagation();
    // If in limited mode and current quantity is at max, do nothing.
    if (isLimited && currentQuantity >= maxAllowed) return;

    setLastAction('increment');
    dispatch(incrementQuantity({ productId: product._id }));

    // Track AddToCart event for increment
    try {
      await trackAddToCart(product);
    } catch (error) {
      console.error('AddToCart tracking failed:', error);
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
    if (!cartItem) {
      dispatch(addItem({ productId: product._id, productDetails: product }));
    }
    router.push('/viewcart');
  };

  // Combine classes for the main container
  const mainClasses = [
    styles.container,
    isBlackButton ? styles.blackButton : '',
    isLarge ? styles.largeButton : '',
  ].join(' ').trim();

  // Set button text conditionally
  const orderButtonText = cartItem ? 'Go to Cart' : 'Buy Now';

  return (
    <div className={mainClasses}>
      {/* Add to Cart Section */}
      <div className={styles.subContainer}>
        <div className={styles.addToCartSection}>
          {cartItem ? (
            <div className={styles.quantityContainer}>
              <button onClick={handleDecrement} className={styles.decrement}>
                <RemoveIcon fontSize="small" />
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
              <button 
                onClick={handleIncrement} 
                className={styles.increment}
                disabled={isLimited && currentQuantity >= maxAllowed}
                title={isLimited && currentQuantity >= maxAllowed ? "" : ""}
              >
                <AddIcon fontSize="small" />
              </button>
              {/* {isLimited && currentQuantity >= maxAllowed && (
                <span style={{ fontSize: '0.8rem', color: '#dc3545', marginLeft: '0.5rem' }}>
                  limited stocks
                </span>
              )} */}
            </div>
          ) : (
            <div 
              onClick={handleAdd} 
              className={styles.addToCartButton}
              // Disable if in limited mode and adding one exceeds allowed (i.e. when maxAllowed is 0)
              style={isLimited && (currentQuantity + 1) > maxAllowed ? { opacity: 0.5, pointerEvents: 'none' } : {}}
              title={isLimited && (currentQuantity + 1) > maxAllowed ? "" : ""}
            >
              <ShoppingCartIcon fontSize="medium" className={styles.cartIcon} />
              Add To Cart
            </div>
          )}
        </div>

        {/* Order Now / Go to Cart Section */}
        <div className={`${styles.orderNowSection} ${styles.halfWidth}`}>
          <div onClick={handleOrderNow} className={styles.orderNowButton}>
            {cartItem ? (
              <ShoppingCartIcon fontSize="medium" className={styles.cartIcon} />
            ) : (
              <BoltOutlinedIcon fontSize="medium" className={styles.boltIcon} />
            )}
            {orderButtonText}
          </div>
        </div>
      </div>
      {!isSmallDevice && (
        <div className={styles.chatwithusMain}>
          <Link href={'/faqs'}>
            <Image
              className={styles.chatwithus}
              src={`${imageBaseUrl}/assets/icons/chatwithus.png`}
              width={1400}
              height={400}
              alt="chat with us"
            />
          </Link>
        </div>
      )}
    </div>
  );
}
