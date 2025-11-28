// components/page-sections/viewcart/CartList.js

'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useDispatch, useSelector } from 'react-redux';
import styles from './styles/cartlist.module.css';
import { motion, AnimatePresence } from 'framer-motion';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import VerifiedIcon from '@mui/icons-material/Verified';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import PaymentIcon from '@mui/icons-material/Payment';
import { updateQuantity } from '@/store/slices/cartSlice';
import funnelClient from '@/lib/analytics/funnelClient';
// Lazy load add-ons slider to avoid impacting cart TTI
const FuelCapWrapAddOns = dynamic(() => import('../viewcart/FuelCapWrapAddOns'), { ssr: false, loading: () => null });
import Image from 'next/image';
import { useRouter } from 'next/navigation';


const CartItem = ({ item, onRemove, readonly = false, cartSnapshot }) => {
  const dispatch = useDispatch();
  const router = useRouter();
  const { productDetails, quantity } = item;
  const { name, price, MRP } = productDetails;
  const rawSlug = productDetails?.slug?.current
    || productDetails?.pageSlug
    || productDetails?.productListPageSlug
    || productDetails?.slug
    || productDetails?.handle
    || productDetails?.seo?.slug
    || null;

  const productHref = rawSlug
    ? (rawSlug.startsWith('/shop') || rawSlug.startsWith('http') ? rawSlug : `/shop/${rawSlug}`)
    : null;
  
  // Format category name for display
  const formatCategoryName = () => {
    if (!productDetails.category?.name) return '';
    
    let categoryName = productDetails.category.name;
    
    // If name is short, remove trailing 's' if it exists
    if (categoryName.length < 20) {
      return categoryName.endsWith('s') ? categoryName.slice(0, -1) : categoryName;
    }
    
    // If name is long, truncate it
    return categoryName.slice(0, 20) + '...';
  };

  // Fix image rendering logic
  const getImageUrl = () => {
    // Try to get selected option image first
    if (productDetails.selectedOption?.images?.length > 0) {
      const imgPath = productDetails.selectedOption.images[0];
      return `${process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL}${imgPath.startsWith('/') ? imgPath : '/' + imgPath}`;
    }
    
    // Then try product images
    if (productDetails.images?.length > 0) {
      const imgPath = productDetails.images[0];
      return `${process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL}${imgPath.startsWith('/') ? imgPath : '/' + imgPath}`;
    }
    
    // Default fallback
    return '/images/assets/gifs/helmetloadinggiflandscape2.gif';
  };
  
  const imageUrl = getImageUrl();

  const handleUpdateQuantity = (newQuantity) => {
    if (newQuantity >= 1) {
      // Track remove_from_cart when decrementing
      if (newQuantity < quantity) {
        try {
          funnelClient.track('remove_from_cart', {
            product: {
              id: productDetails._id,
              name: productDetails.name,
              price: productDetails.price,
              quantity: 1,
              category: productDetails.category?.name,
            },
            cart: cartSnapshot,
            metadata: {
              component: 'CartList',
              action: 'decrement',
              previousQuantity: quantity,
              newQuantity,
            },
          });
        } catch (err) {
          // Tracking failed
        }
      }
      dispatch(updateQuantity({
        productId: productDetails._id,
        quantity: newQuantity
      }));
    }
  };

  const handleRemoveItem = () => {
    // Track remove_from_cart for full item removal
    try {
      funnelClient.track('remove_from_cart', {
        product: {
          id: productDetails._id,
          name: productDetails.name,
          price: productDetails.price,
          quantity: quantity,
          category: productDetails.category?.name,
        },
        cart: cartSnapshot,
        metadata: {
          component: 'CartList',
          action: 'remove',
          removedQuantity: quantity,
        },
      });
    } catch (err) {
      // Tracking failed
    }
    if (onRemove) {
      onRemove(productDetails._id);
    }
  };

  const handleNavigate = () => {
    if (!productHref) return;
    router.push(productHref);
  };

  return (
    <motion.div 
      className={`${styles.cartItem} ${readonly ? styles.oosItem : ''}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      layout
      role={productHref ? 'button' : undefined}
      tabIndex={productHref ? 0 : undefined}
      onClick={handleNavigate}
      onKeyDown={(e) => {
        if (!productHref) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleNavigate();
        }
      }}
      style={{ cursor: productHref ? 'pointer' : 'default' }}
    >
      <div className={styles.productImage}>
        <Image
          width={300}
          height={300} 
          src={imageUrl} 
          alt={name || 'Product'} 
          className={styles.image}
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = '/images/assets/gifs/helmetloadinggiflandscape2.gif';
          }}
        />
      </div>
      
      <div className={styles.productInfo}>
        <div className={styles.infoTop}>
          <div className={styles.nameSection}>
            {productDetails.category?.name && (
              <div className={styles.categoryBadge}>
                {formatCategoryName()}
              </div>
            )}
            <h3 className={styles.productName}>{name}</h3>
            {readonly && (
              <div className={styles.oosBadge}>Out of Stock</div>
            )}
          </div>
          
          <button 
            className={styles.removeBtn} 
            onClick={(e) => {
              e.stopPropagation();
              handleRemoveItem();
            }}
            type="button"
            title={readonly ? 'Remove from cart' : 'Remove from cart'}
          >
            <DeleteOutlineIcon fontSize="small" />
          </button>
        </div>
        
        <div className={styles.infoBottom}>
          <div className={styles.priceContainer}>
            <span className={styles.currentPrice}>₹{(price * quantity).toFixed(0)}</span>
            {MRP > price && (
              <span className={styles.originalPrice}>₹{(MRP * quantity).toFixed(0)}</span>
            )}
          </div>

          <div className={styles.quantityControls}>
            <button 
              className={`${styles.quantityBtn} ${(quantity <= 1 || readonly) ? styles.disabled : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                if (!readonly) handleUpdateQuantity(quantity - 1);
              }}
              disabled={quantity <= 1 || readonly}
              type="button"
            >
              <RemoveIcon style={{ fontSize: '16px' }} />
            </button>
            
            <span className={styles.quantity}>{quantity}</span>
            
            <button 
              className={`${styles.quantityBtn} ${readonly ? styles.disabled : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                if (!readonly) handleUpdateQuantity(quantity + 1);
              }}
              type="button"
              disabled={readonly}
            >
              <AddIcon style={{ fontSize: '16px' }} />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export const ProductSpecifications = () => {
  return (
    <motion.div 
      className={styles.specContainer}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <h4 className={styles.specTitle}>Why Customers Choose Us</h4>
      <div className={styles.specItems}>
        <div className={styles.specItem}>
          <div className={styles.specIcon}>
            <VerifiedIcon fontSize="small" />
          </div>
          <h5 className={styles.specName}>Premium Quality</h5>
          <p className={styles.specDescription}>Crafted with the finest materials</p>
        </div>
        <div className={styles.specItem}>
          <div className={styles.specIcon}>
            <LocalShippingIcon fontSize="small" />
          </div>
          <h5 className={styles.specName}>Fast Delivery</h5>
          <p className={styles.specDescription}>Shipping nationwide</p>
        </div>
        <div className={styles.specItem}>
          <div className={styles.specIcon}>
            <PaymentIcon fontSize="small" />
          </div>
          <h5 className={styles.specName}>Secure Payment</h5>
          <p className={styles.specDescription}>100% safe transactions</p>
        </div>
      </div>
    </motion.div>
  );
};

export default function CartList({ cartItems, onRemove, readonly = false, sectionTitle = null, sectionNote = null, showSpecs = false }) {
  const showFuelCapAddOns = !readonly; // further conditions can be added (e.g., only if cart not empty)

  // One-time similarity snapshot for FuelCapWrapAddOns prioritization
  const [similarityContext, setSimilarityContext] = useState(null);
  const capturedRef = useRef(false);
  useEffect(() => {
    if (capturedRef.current) return; // only once until component unmounts
    if (!cartItems || !cartItems.length) return;
    const designGroupIds = [...new Set(cartItems.map(ci => ci.productDetails?.designGroupId).filter(Boolean))];
    // Tokenize product names (lowercase, alphanumeric word segments) and keep top distinct tokens
    const nameTokensSet = new Set();
    cartItems.forEach(ci => {
      const nm = (ci.productDetails?.name || '').toLowerCase();
      nm.split(/[^a-z0-9]+/).filter(Boolean).forEach(tok => {
        if (tok.length >= 3) nameTokensSet.add(tok);
      });
    });
    const nameTokens = Array.from(nameTokensSet).slice(0, 10);
    setSimilarityContext({ designGroupIds, nameTokens });
    capturedRef.current = true;
  }, [cartItems]);

  // Create cart snapshot for remove_from_cart tracking
  const cartSnapshot = useMemo(() => ({
    totalItems: cartItems?.length || 0,
    totalQuantity: cartItems?.reduce((sum, item) => sum + (item.quantity || 1), 0) || 0,
    itemIds: cartItems?.map(item => item.productDetails?._id).filter(Boolean) || []
  }), [cartItems]);

  return (
    <div className={styles.cartList}>
      {sectionTitle && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
          <h4 style={{ margin: 0, fontSize: 14, color: '#2d2d2d', fontWeight: 600 }}>{sectionTitle}</h4>
          {sectionNote && <span style={{ fontSize: 12, color: '#6b7280' }}>{sectionNote}</span>}
        </div>
      )}
      <AnimatePresence>
        {cartItems.map(item => (
          <CartItem 
            key={item.productDetails._id} 
            item={item} 
            onRemove={onRemove} 
            readonly={readonly}
            cartSnapshot={cartSnapshot}
          />
        ))}
      </AnimatePresence>

      {/* Inject Fuel Cap Wrap Add‑Ons slider at the end of the cart list for visibility */}
      {showFuelCapAddOns && (
        <div style={{ marginTop: '0.25rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f1f1' }}>
          <FuelCapWrapAddOns similarityContext={similarityContext} />
        </div>
      )}
      
      {/* Add the specifications section only when explicitly requested */}
      {showSpecs && cartItems.length > 0 && !readonly && <ProductSpecifications />}
    </div>
  );
}
