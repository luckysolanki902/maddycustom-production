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
  hideVideo = false,
  productRefs,
  selectedProductId,
}) => {
  const isSmallDevice = useMediaQuery('(max-width: 600px)');
  const offerTaglineText =
    category?.specificCategoryCode === 'tw' ? ' Buy 2 for ₹599' : '';

  return (
    <div className={showLayout2 ? styles.productsGrid2 : styles.productsGrid}>
      {/* Video card - only shown for non-mobile when not hidden and variant has showcase */}
      {variant?.showCase?.[0]?.available && !hideVideo && !isSmallDevice && (
        <div
          className={styles.videoCard}
          aria-label="Product Video"
          style={{ backgroundColor: 'white' }}
        >
          <iframe
            width="100%"
            height="100%"
            src="https://www.youtube.com/embed/MOX9WDmSkCA?autoplay=1&mute=1&loop=1&playlist=MOX9WDmSkCA&controls=0&modestbranding=1&playsinline=1&rel=0&iv_load_policy=3&disablekb=1"
            title="Product Video"
            frameBorder="0"
            allow="autoplay; encrypted-media"
            allowFullScreen
            style={{ pointerEvents: 'none', backgroundColor: 'white' }}
          />
          <h1>Maddy Custom</h1>
        </div>
      )}

      {/* Header carousel for tank wraps category */}
      {category?.specificCategoryCode === 'tw' && !isSmallDevice && !hideVideo && (
        <div className={styles.HeaderCarouselMain}>
          <HeaderCarousel />
        </div>
      )}

      {/* Product cards */}
      {products.map((p) => (
        <ProductCard
          productRefs={productRefs}
          selectedProductId={selectedProductId}
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
          pageType={'products-list'}
        />
      ))}
    </div>
  );
};

export default ProductsWrapper;
