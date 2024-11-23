// components/cards/ProductsWrapper.js
"use client";
import React from 'react';
import ProductCard from './ProductCard';
import styles from './styles/productswrapper.module.css';
import { useMediaQuery } from '@mui/material';

const ProductsWrapper = ({ variant, products, category, sortBy = 'default', loading }) => {
  const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
  const isSmallDevice = useMediaQuery('(max-width: 600px)');

  return (
    <div className={styles.productsGrid}>
      {variant.showCase?.[0]?.available && (
        !isSmallDevice && (
          <div
            className={styles.videoCard}
            aria-description="product video"
            aria-describedby="product video"
          >
            <video autoPlay muted playsInline loop controls={false}>
              <source src={`${baseImageUrl}${variant.showCase[0].url}`} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
            <h1>Maddy Custom</h1>
          </div>
        )
      )}

      {products?.map((product) => (
        <ProductCard
          key={product._id}
          product={{ ...product, variantDetails: variant, category }}
          loading={loading}
        />
      ))}
    </div>
  );
};

export default ProductsWrapper;
