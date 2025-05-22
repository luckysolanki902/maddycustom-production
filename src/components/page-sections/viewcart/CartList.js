// components/page-sections/viewcart/CartList.js

'use client';

import React from 'react';
import { useDispatch } from 'react-redux';
import styles from './styles/cartlist.module.css';
import { motion, AnimatePresence } from 'framer-motion';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import VerifiedIcon from '@mui/icons-material/Verified';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import PaymentIcon from '@mui/icons-material/Payment';
import { updateQuantity } from '@/store/slices/cartSlice';
import Image from 'next/image';

const CartItem = ({ item, onRemove }) => {
  const dispatch = useDispatch();
  const { productDetails, quantity } = item;
  const { name, price, MRP } = productDetails;
  
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
          </div>
          
          <button 
            className={styles.removeBtn} 
            onClick={() => onRemove(productDetails._id)}
            type="button"
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
              className={`${styles.quantityBtn} ${quantity <= 1 ? styles.disabled : ''}`}
              onClick={() => handleUpdateQuantity(quantity - 1)}
              disabled={quantity <= 1}
              type="button"
            >
              <RemoveIcon style={{ fontSize: '16px' }} />
            </button>
            
            <span className={styles.quantity}>{quantity}</span>
            
            <button 
              className={styles.quantityBtn}
              onClick={() => handleUpdateQuantity(quantity + 1)}
              type="button"
            >
              <AddIcon style={{ fontSize: '16px' }} />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const ProductSpecifications = () => {
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
      
      {/* Add the specifications section */}
      {cartItems.length > 0 && <ProductSpecifications />}
    </div>
  );
}
