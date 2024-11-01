// @/components/full-page-comps/ViewCart.js
'use client';

import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useRouter } from 'next/navigation';
import {
  Checkbox,
  IconButton,
  Typography,
  Button,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddToCartButton from '../common-utils/AddToCartButton';
import {
  removeItem,
} from '../../store/slices/cartSlice';
import styles from './styles/viewcart.module.css';
import Image from 'next/image';

const ViewCart = () => {
  const dispatch = useDispatch();
  const router = useRouter();
  const cartItems = useSelector((state) => state.cart.items);

  // Calculate total number of products and unique items
  const totalQuantity = cartItems.reduce((acc, item) => acc + item.quantity, 0);
  const uniqueItems = cartItems.length;

  // Calculate total cost
  const totalCost = cartItems.reduce((acc, item) => {
    const price = item.productDetails.variantDetails?.availableBrands?.length > 0
      ? item.productDetails.variantDetails.availableBrands[0].brandBasePrice + item.productDetails.price
      : item.productDetails.price;
    return acc + price * item.quantity;
  }, 0);

  // Handle checkbox change
  const handleCheckboxChange = (e, productId) => {
    if (!e.target.checked) {
      dispatch(removeItem({ productId }));
    }
  };

  // Handle back navigation
  const handleBack = () => {
    router.back();
  };

  // Placeholder checkout function
  const handleCheckout = () => {
    // Currently does nothing
    return;
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <IconButton onClick={handleBack}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" className={styles.heading}>
          MyCart ({totalQuantity})
        </Typography>
        <Typography variant="subtitle1" className={styles.subHeading}>
          Products: {uniqueItems}
        </Typography>
      </div>

      {/* Cart Items List */}
      <div className={styles.cartList}>
        {cartItems.map((item) => (
          <div key={item.productId} className={styles.cartItem}>
            <Checkbox
              checked
              onChange={(e) => handleCheckboxChange(e, item.productId)}
              color="primary"
            />
            <Image
            width={300}
              height={300}
              src={
                item.productDetails.images && item.productDetails.images.length > 0
                  ? `${process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL}${item.productDetails.images[0]}`
                  : '/images/assets/gifs/helmetloadinggif.gif'
              }
              alt={item.productDetails.name}
              className={styles.productImage}
            />
            <Typography variant="body1" className={styles.productName}>
              {item.productDetails.name}
            </Typography>
            <AddToCartButton product={item.productDetails} />
          </div>
        ))}
      </div>

      {/* Total Cost and Checkout */}
      <div className={styles.footer}>
        <div className={styles.totalCost}>
          <Typography variant="h6">Total: ₹{totalCost.toFixed(2)}</Typography>
        </div>
        <Button
          variant="contained"
          color="primary"
          className={styles.checkoutButton}
          onClick={handleCheckout}
        >
          Checkout
        </Button>
      </div>
    </div>
  );
};

export default ViewCart;
