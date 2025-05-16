// components/page-sections/viewcart/CartList.js

'use client';

import React from 'react';
import { useDispatch } from 'react-redux';
import styles from './styles/cartlist.module.css';
import { motion, AnimatePresence } from 'framer-motion';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import { updateQuantity } from '@/store/slices/cartSlice';

const CartItem = ({ item, onRemove }) => {
  const dispatch = useDispatch();
  const { productDetails, quantity } = item;
  const { name, price, mrp } = productDetails;
  
  const discount = mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;

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
      dispatch(updateQuantity({
        productId: productDetails._id,
        quantity: newQuantity
      }));
    }
  };

  return (
    <motion.div 
      className={styles.cartItem}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      layout
    >
      <div className={styles.productImage}>
        <img 
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
        <h3 className={styles.productName}>{name}</h3>
        
        <div className={styles.priceContainer}>
          <span className={styles.currentPrice}>₹{(price * quantity).toFixed(0)}</span>
          {mrp > price && (
            <span className={styles.originalPrice}>₹{(mrp * quantity).toFixed(0)}</span>
          )}
          {discount > 0 && (
            <span className={styles.discountBadge}>{discount}% OFF</span>
          )}
        </div>

        <div className={styles.actionRow}>
          <div className={styles.quantityControls}>
            <button 
              className={`${styles.quantityBtn} ${quantity <= 1 ? styles.disabled : ''}`}
              onClick={() => handleUpdateQuantity(quantity - 1)}
              disabled={quantity <= 1}
              type="button"
            >
              <RemoveIcon fontSize="small" />
            </button>
            
            <span className={styles.quantity}>{quantity}</span>
            
            <button 
              className={styles.quantityBtn}
              onClick={() => handleUpdateQuantity(quantity + 1)}
              type="button"
            >
              <AddIcon fontSize="small" />
            </button>
          </div>
          
          <button 
            className={styles.removeBtn} 
            onClick={() => onRemove(productDetails._id)}
            type="button"
          >
            <DeleteOutlineIcon fontSize="small" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default function CartList({ cartItems, onRemove }) {
  return (
    <div className={styles.cartList}>
      <AnimatePresence>
        {cartItems.map(item => (
          <CartItem 
            key={item.productDetails._id} 
            item={item} 
            onRemove={onRemove} 
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
