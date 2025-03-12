"use client";
import React from 'react';
import ProductCard from './ProductCard';
import HeaderCarousel from '../showcase/carousels/HeaderCarousel';
import styles from './styles/productswrapper.module.css';
import { useMediaQuery } from '@mui/material';

const ProductsWrapper = ({ variant, products, category, isLoading, showLayout2 }) => {
  const isSmallDevice = useMediaQuery('(max-width: 600px)');
  const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

  return (
    <div className={showLayout2 ? styles.productsGrid2 : styles.productsGrid}>
      {/* Video on large devices */}
      {variant?.showCase?.[0]?.available && !isSmallDevice && (
        <div aria-label="Product Video" className={styles.videoCard}>
          <iframe
            width="100%"
            height="100%"
            src="https://www.youtube.com/embed/MOX9WDmSkCA?autoplay=1&mute=1&loop=1&playlist=MOX9WDmSkCA&controls=0&modestbranding=1&playsinline=1&rel=0&iv_load_policy=3&disablekb=1"
            title="Product Video"
            frameBorder="0"
            allow="autoplay; encrypted-media"
            allowFullScreen
            style={{ pointerEvents: 'none' }}
          />
          <h1>Maddy Custom</h1>
        </div>
      )}

      {category?.specificCategoryCode === 'tw' && !isSmallDevice && (
        <div className={styles.HeaderCarouselMain}>
          <HeaderCarousel />
        </div>
      )}

      {products.map((product) => {
        const updatedProduct = {
          ...product,
          variantDetails: variant,
          category,
          options: product.options || [],
        };

        return (
          <ProductCard
            key={product._id}
            product={updatedProduct}
            isLoading={isLoading}
            showLayout2={showLayout2}
          />
        );
      })}
    </div>
  );
};

export default ProductsWrapper;
