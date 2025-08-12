'use client';

import React, { useMemo } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import NoMarginCarousel from '@/components/showcase/carousels/NoMarginCarousel';
import styles from './styles/CarIntExt.module.css';

const ProductCard = ({ product }) => {
  if (!product) return null;

  const imageUrl = product.image 
    ? `${process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL}${product.image.startsWith('/') ? '' : '/'}${product.image}`
    : null;

  return (
    <motion.div 
      className={styles.productCard}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
      whileHover={{ y: -2 }}
    >
      {imageUrl && (
        <div className={styles.productImageWrapper}>
          <Image 
            src={imageUrl}
            alt={product.name}
            width={300}
            height={200}
            className={styles.productImage}
            style={{ height: 'auto' }}
          />
        </div>
      )}
      <div className={styles.productName}>
        {product.name}
      </div>
      <div className={styles.productPrice}>
        ₹{product.price}
      </div>
    </motion.div>
  );
};

export default function CarIntExt({ 
  type = 'interior', // 'interior' or 'exterior'
  assets = [], // Display assets array to filter from
  products = [], // Products data passed from parent
  loading = false, // Loading state passed from parent
  error = null, // Error state passed from parent
  className = ""
}) {
  // Capitalize the heading
  const heading = type.charAt(0).toUpperCase() + type.slice(1);

  // Filter carousel images from assets based on component name and type
  const carouselImages = useMemo(() => {
    // Match the actual component names from your database
    const componentName = type === 'interior' ? 'car-interiors' : 'car-exteriors';
    const filteredAssets = assets.filter(
      asset => asset.componentName === componentName && asset.componentType === 'carousel'
    );
    
    // Map to the media format expected by NoMarginCarousel
    return filteredAssets.map(asset => ({
      desktop: asset.media?.desktop,
      mobile: asset.media?.mobile,
      useSameMediaForAllDevices: asset.useSameMediaForAllDevices
    }));
  }, [assets, type]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.6,
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.4 }
    }
  };

  return (
    <motion.section 
      className={`${styles.section} ${className}`}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={containerVariants}
    >


      {/* Content Section */}
      <div className={styles.contentContainer}>
        <motion.h2 
          className={styles.heading}
          variants={itemVariants}
          style={{ marginTop: heading.toLowerCase() === 'exterior' ? '-1rem' : '' }}
        >
          {heading}
        </motion.h2>

              {/* Carousel */}
      <motion.div variants={itemVariants}>
        <NoMarginCarousel 
          images={carouselImages}
          autoplay={true}
          autoplayDelay={5000}
          showPagination={true}
        />
      </motion.div>

        {loading ? (
          <motion.div 
            className={styles.productsContainer}
            variants={itemVariants}
          >
            <div className={styles.loadingWrapper}>
              {Array(6).fill(0).map((_, index) => (
                <div key={index} className={styles.skeletonCard}>
                  <div className={styles.skeletonImage}></div>
                  <div className={styles.skeletonName}></div>
                  <div className={styles.skeletonPrice}></div>
                </div>
              ))}
            </div>
          </motion.div>
        ) : error ? (
          <motion.div 
            className={styles.errorMessage}
            variants={itemVariants}
          >
            <p>Failed to load {type} products. Please try again later.</p>
          </motion.div>
        ) : (
          <motion.div 
            className={styles.productsContainer}
            variants={itemVariants}
          >
            <div className={styles.productsWrapper}>
              {products.map((product, index) => (
                <motion.div
                  key={product._id || index}
                  variants={itemVariants}
                >
                  <ProductCard product={product} />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </motion.section>
  );
}
