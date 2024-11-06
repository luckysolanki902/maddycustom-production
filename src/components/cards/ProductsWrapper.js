// components/ProductsWrapper.js
"use client";
import React, { useEffect, useState } from 'react';
import ProductCard from './ProductCard';
import styles from './styles/productswrapper.module.css';
import { filterProductsByTag, sortProducts } from '@/lib/utils/productsPageFunctions';

const ProductsWrapper = ({ variant, products, category, tagFilter, sortBy }) => {
  const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set loading to true whenever tagFilter or sortBy changes
    setLoading(true);

    const timeoutId = setTimeout(() => {
      setLoading(false);
    }, 400);

    return () => clearTimeout(timeoutId);
  }, [tagFilter, sortBy]);

  // Filter products based on the selected tag
  const filteredProducts = filterProductsByTag(products, tagFilter);

  // Sort products based on sortBy
  const sortedProducts = sortProducts(filteredProducts, sortBy);

  return (
    <div className={styles.productsGrid}>
      {variant.showCase?.[0]?.available && (
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
      )}

      {sortedProducts.map((product) => (
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
