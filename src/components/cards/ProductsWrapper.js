// components/cards/ProductsWrapper.js
"use client";
import React from 'react';
import ProductCard from './ProductCard';
import HeaderCarousel from '../showcase/carousels/HeaderCarousel'; // Verify this path
import styles from './styles/productswrapper.module.css';
import { useMediaQuery } from '@mui/material';

const ProductsWrapper = ({ variant, products, category, sortBy = 'default', loading }) => {
  const isSmallDevice = useMediaQuery('(max-width: 600px)');
   
  const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

  return (
    <div className={styles.productsGrid}>
      {variant.showCase?.[0]?.available && !isSmallDevice && (
        <div
          aria-label="Product Video"
          className={styles.videoCard}
        >
          <iframe
            width="100%"
            height="100%"
            src="https://www.youtube.com/embed/MOX9WDmSkCA?autoplay=1&mute=1&loop=1&playlist=MOX9WDmSkCA&controls=0&modestbranding=1&playsinline=1&rel=0&iv_load_policy=3&disablekb=1"
            title="Product Video"
            frameBorder="0"
            allow="autoplay; encrypted-media"
            allowFullScreen
            style={{ pointerEvents: 'none' }}
          ></iframe>
          <h1>Maddy Custom</h1>
        </div>
      )}

      {category.specificCategoryCode === 'tw' && !isSmallDevice && (
          <div className={styles.HeaderCarouselMain}>
          <HeaderCarousel />
        </div>
      )}

      {products.map((product, index) => {
        return (
          <ProductCard
            key={product._id}
            product={{ ...product, variantDetails: variant, category }}
            loading={loading}
          />
        );
      })}
    </div>
  );
};

export default ProductsWrapper;
