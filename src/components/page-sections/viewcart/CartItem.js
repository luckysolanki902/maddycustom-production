// components/page-sections/viewcart/CartItem.js

'use client';

import React from 'react';
import { Checkbox } from '@mui/material';
import Image from 'next/image';
import AddToCartButton from '@/components/utils/AddToCartButton';
import styles from './styles/viewcart.module.css';
import { useRouter } from 'next/navigation';

const CartItem = ({ item, onRemove }) => {
  const router = useRouter();
  const handleCheckboxChange = (e) => {
    if (!e.target.checked) {
      onRemove(item.productId);
    }
  };

  return (
    <div
      style={{ cursor: 'pointer' }}
      onClick={() => router.push(`shop/${item.productDetails.pageSlug}`)}
      key={item.productId}
      className={styles.cartItem}
    >
      <Checkbox
        onClick={(e) => e.stopPropagation()}
        checked={true}
        onChange={handleCheckboxChange}
        sx={{
          color: 'black',
          '&.Mui-checked': { color: 'black' },
        }}
      />

      <Image
        width={538}
        height={341.5}
        src={
          item.productDetails.images && item.productDetails.images.length > 0
            ? `${process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL}${item.productDetails.images[0]}`
            : '/images/assets/gifs/helmetloadinggiflandscape2.gif'
        }
        alt={item.productDetails.name}
        className={styles.productImage}
      />

      <div className={styles.productDetails}>
        <div className={styles.categoryName}>
          {item.productDetails.category?.name.length < 20 ?
            item.productDetails.category?.name?.endsWith('s')
              ? item.productDetails.category.name.slice(0, -1)
              : item.productDetails.category.name :
            (item.productDetails.category.name.slice(0, 20) + '...' )}

        </div>
        <div className={styles.productName}>
          {item.productDetails.name.length < 20 ? item.productDetails.name : (item.productDetails.name.slice(0, 20) + '...')}
        </div>
        <div className={styles.productPrice}>
          ₹{(item.productDetails.price * item.quantity).toFixed(0)}/-
        </div>
      </div>
      <AddToCartButton product={item.productDetails} />
    </div>
  );
};

export default CartItem;
