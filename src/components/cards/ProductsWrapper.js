/* ------------------------------------------------------------------ */
/* components/cards/ProductsWrapper.jsx                                */
/* ------------------------------------------------------------------ */
'use client';

import React from 'react';
import { useMediaQuery } from '@mui/material';
import ProductCard from './ProductCard';
import HeaderCarousel from '../showcase/carousels/HeaderCarousel';
import styles from './styles/productswrapper.module.css';

const ProductsWrapper = ({
  variant,
  products,
  category,
  isLoading,
  showLayout2,
  hideCartButton = false,
  hidePrice = false,
  /** new — prevent video duplication on split / later pages */
  hideVideo = false,
}) => {
  const isSmallDevice = useMediaQuery('(max-width: 600px)');
  const offerTaglineText =
    category?.specificCategoryCode === 'tw' ? ' Buy 2 for ₹599' : '';

  return (
    <div className={showLayout2 ? styles.productsGrid2 : styles.productsGrid}>
      {/* ---------------- Video (large) ---------------- */}
      {variant?.showCase?.[0]?.available &&
        !isSmallDevice &&
        !hideVideo && (
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

      {/* ---------------- Header carousel (large) ---------------- */}
      {category?.specificCategoryCode === 'tw' && !isSmallDevice && (
        <div className={styles.HeaderCarouselMain}>
          <HeaderCarousel />
        </div>
      )}

      {/* ---------------- Product cards ---------------- */}
      {products.map((p) => (
        <ProductCard
          key={p._id}
          product={{
            ...p,
            variantDetails: variant,
            category,
            options: p.options || [],
          }}
          isLoading={isLoading}
          showLayout2={showLayout2}
          hideCartButton={hideCartButton}
          hidePrice={hidePrice}
          offerTaglineText={offerTaglineText}
        />
      ))}
    </div>
  );
};

export default ProductsWrapper;
