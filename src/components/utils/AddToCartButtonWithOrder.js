'use client';

import React, { useEffect, useState } from 'react';
import { getStockStatus } from './getStockStatus';
import { useDispatch, useSelector } from 'react-redux';
import { useSpring, animated } from 'react-spring';
import styles from './styles/addtocartbuttonwithorder.module.css';
import AddIcon from '@mui/icons-material/Add';
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import RemoveIcon from '@mui/icons-material/Remove';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import {
  addItem,
  incrementQuantity,
  decrementQuantity,
  removeItem,
  setDefaultWrapFinish
} from '../../store/slices/cartSlice';
import { openCartDrawer, openRecommendationDrawer } from '../../store/slices/uiSlice';
import { addToCart as trackAddToCart } from '@/lib/metadata/facebookPixels';
import { gaAddToCart } from '@/lib/metadata/googleAds';
import { selectIsSubscribedToNotification } from "../../store/slices/notificationSlice";
import Link from 'next/link';
import Image from 'next/image';
import { useMediaQuery } from '@mui/material';
import NotifyMeDialog from '../dialogs/NotifyMeDialog';

export default function AddToCartButton({ product, isBlackButton = false, isLarge = false, insertionDetails: insertionDetailsProp = {} }) {
  const insertionDetails = insertionDetailsProp || {};
  const isSmallDevice = useMediaQuery('(max-width: 1000px)');
  const dispatch = useDispatch();
  const cartItems = useSelector((state) => state.cart.items);
  const cartItem = cartItems.find((item) => item.productId === product._id);
  const imageBaseUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

  // Check if user is already subscribed to notifications for this product
  const isSubscribedToNotification = useSelector(selectIsSubscribedToNotification(product, product.selectedOption));

  // State to track last action (for animation)
  const [lastAction, setLastAction] = useState(null);
  const [showNotifyDialog, setShowNotifyDialog] = useState(false);
  // Track background check and existing notification state
  const [checkingNotification, setCheckingNotification] = useState(false);
  const [hasNotification, setHasNotification] = useState(false);

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
  // Use shared utility for robust stock logic
  const { outOfStock } = getStockStatus(product);
  const inventoryData = product.inventoryData || (product.selectedOption && product.selectedOption.inventoryData) || null;
  let maxAllowed = Infinity;
  let isLimited = false;
  if (inventoryData && typeof inventoryData.availableQuantity === 'number') {
    isLimited = true;
    if (inventoryData.availableQuantity <= 0) {
      maxAllowed = 0;
    } else {
      maxAllowed = inventoryData.availableQuantity;
    }
  }
  const currentQuantity = cartItem ? cartItem.quantity : 0;
  
  useEffect(() => {
    dispatch(setDefaultWrapFinish());
  }, [dispatch]);

  // Check if user has existing notification for this product/option
  useEffect(() => {
    const checkExistingNotification = async () => {
      if (!outOfStock) return;
      
      setCheckingNotification(true);
      try {
        // Get stored phone number from localStorage if available
        const storedPhone = localStorage.getItem('userPhoneNumber');
        if (!storedPhone) {
          setCheckingNotification(false);
          return;
        }

        const response = await fetch(`/api/notifications?phoneNumber=${storedPhone}&notificationType=restocking&status=pending`, {
          method: 'GET',
        });

        if (response.ok) {
          const data = await response.json();
          
          // Check if there's a pending notification for this specific product/option combination
          const hasExistingNotification = data.notifications.some(notification => {
            const productInfo = notification.info.find(info => info.key === 'productId');
            const optionInfo = notification.info.find(info => info.key === 'optionId');
            const inventoryInfo = notification.info.find(info => info.key === 'inventoryId');
            
            // First check by inventoryId (most accurate)
            const currentInventoryId = product.selectedOption?.inventoryData?._id || product.inventoryData?._id;
            if (currentInventoryId && inventoryInfo?.value === currentInventoryId) {
              return true;
            }
            
            // Fallback to product/option matching
            const matchesProduct = productInfo?.value === product._id;
            const matchesOption = product.selectedOption 
              ? optionInfo?.value === product.selectedOption._id
              : !optionInfo || !optionInfo.value;
            
            return matchesProduct && matchesOption;
          });
          
          setHasNotification(hasExistingNotification);
        }
      } catch (error) {
        console.error('Error checking existing notifications:', error);
      } finally {
        setCheckingNotification(false);
      }
    };

    checkExistingNotification();
  }, [outOfStock, product._id, product.selectedOption, product.inventoryData?._id, product.selectedOption?.inventoryData?._id]);

  const handleAdd = async (e) => {
    e.stopPropagation();
    if (outOfStock) return;
    if (isLimited && (currentQuantity + 1) > maxAllowed) return;

    setLastAction('increment');
    dispatch(addItem({
      productId: product._id,
      productDetails: product,
      insertionDetails
    }));
    // Intentionally NOT auto-opening recommendation drawer to avoid irritation.

    // Track AddToCart event
    try {
      await trackAddToCart(product);
      try {
        gaAddToCart({
          items: [{
            productId: product._id,
            name: product.name,
            price: product.price,
            quantity: 1,
            brand: product.brand,
            category: product.category?.name || product.category,
          }],
          value: product.price,
        });
      } catch {}
    } catch (error) {
      console.error('AddToCart tracking failed:', error);
    }
  };

  const handleIncrement = async (e) => {
    e.stopPropagation();
    if (outOfStock) return;
    if (isLimited && currentQuantity >= maxAllowed) return;

    setLastAction('increment');
    dispatch(incrementQuantity({ productId: product._id }));

    // Track AddToCart event for increment
    try {
      await trackAddToCart(product);
      try {
        gaAddToCart({
          items: [{
            productId: product._id,
            name: product.name,
            price: product.price,
            quantity: 1,
            brand: product.brand,
            category: product.category?.name || product.category,
          }],
          value: product.price,
        });
      } catch {}
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
  
  const insertionDetailsForOrderNow = {
    ...insertionDetails,
    component: 'productDetails-buyNow'
  };

  const handleOrderNow = () => {
    if (outOfStock) return;
    if (!cartItem) {
      dispatch(addItem({ productId: product._id, productDetails: product, insertionDetails: insertionDetailsForOrderNow }));
    }
    dispatch(openCartDrawer());
  };

  const handleNotifyMe = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    console.log('Notify button clicked, opening dialog...');
    setShowNotifyDialog(true);
  };

  const handleNotifyDialogClose = () => {
    setShowNotifyDialog(false);
  };

  const handleNotifySuccess = () => {
    // Don't close the dialog here - let the user close it manually with the "Done" button
    // Success message is already handled within the NotifyMeDialog component
  };

  // Recommendation trigger visibility: only if in cart & has designGroupId
  const showRecoButton = !!(
    // cartItem &&
     product?.designGroupId);

  // Derived: already subscribed either via redux selector or server check
  const alreadySubscribed = isSubscribedToNotification || hasNotification;

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
      <div className={styles.subContainer}>
        {/* Mobile: Recommendation button on top-left */}
        {showRecoButton && isSmallDevice && (
          <button
            data-clarity="see-matching-picks"
            type="button"
            onClick={(e) => { e.stopPropagation(); dispatch(openRecommendationDrawer({ product })); }}
            className={styles.recoButtonMobile}
          >
            <AutoAwesomeIcon style={{ fontSize: '0.85rem', color: '#7b4bff' }} />
            <span style={{ fontWeight: 600 }}>See Matching Picks</span>
          </button>
        )}
        <div className={styles.primaryActionsRow}>
          <div className={styles.addToCartSection}>
            {outOfStock ? (
              <div className={styles.addToCartButton} style={{ opacity: 0.6, cursor: 'default', pointerEvents: 'none' }}>
                <ShoppingCartIcon fontSize="medium" className={styles.cartIcon} />
                Out of Stock
              </div>
            ) : cartItem ? (
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
              </div>
            ) : (
              <div
                onClick={handleAdd}
                className={styles.addToCartButton}
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
            {outOfStock ? (
              <div
                onClick={alreadySubscribed ? undefined : handleNotifyMe}
                className={styles.orderNowButton}
                style={alreadySubscribed ? { 
                  opacity: 0.9, 
                  cursor: 'default',
                  backgroundColor: '#4caf50'
                } : {}}
              >
                {alreadySubscribed ? (
                  <>
                    <CheckCircleIcon fontSize="medium" className={styles.boltIcon} />
                    Notify Me
                  </>
                ) : (
                  <>
                    <NotificationsActiveIcon fontSize="medium" className={styles.boltIcon} />
                    Notify Me
                  </>
                )}
              </div>
            ) : (
              <div
                onClick={handleOrderNow}
                className={styles.orderNowButton}
              >
                {cartItem ? (
                  <ShoppingCartIcon fontSize="medium" className={styles.cartIcon} />
                ) : (
                  <BoltOutlinedIcon fontSize="medium" className={styles.boltIcon} />
                )}
                {orderButtonText}
              </div>
            )}
          </div>
        </div>
        {/* Desktop: Recommendation button full width below */}
        {showRecoButton && !isSmallDevice && (
          <button
            data-clarity="see-matching-picks"
            type="button"
            onClick={(e) => { e.stopPropagation(); dispatch(openRecommendationDrawer({ product })); }}
            className={styles.recoButtonDesktop}
          >
            <AutoAwesomeIcon style={{ fontSize: '0.9rem', color: '#7b4bff' }} />
            <span style={{ fontWeight: 600 }}>See Matching Picks</span>
          </button>
        )}
      </div>
      {!isSmallDevice && (
        <div className={styles.chatwithusMain}>
          <Link href={product.category?._id === '685be144d656a52f5754e667' ? 'https://wa.me/8112673988' : '/faqs'}>
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
      
      {/* Notify Me Dialog */}
      <NotifyMeDialog
        open={showNotifyDialog}
        onClose={handleNotifyDialogClose}
        product={product}
        selectedOption={product.selectedOption}
        onSuccess={handleNotifySuccess}
      />
    </div>
  );
}
