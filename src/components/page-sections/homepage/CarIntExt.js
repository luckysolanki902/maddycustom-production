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
            width={500}
            height={500}
            className={styles.productImage}
            style={{ height: '200', objectFit: 'cover' }}
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

const ComingSoonCard = () => {
  return (
    <motion.div 
      className={styles.comingSoonCard}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
      whileHover={{ 
        y: -4,
        scale: 1.02,
        transition: { duration: 0.3 }
      }}
    >
      <div className={styles.comingSoonImageWrapper}>
        <motion.div 
          className={styles.comingSoonIcon}
          transition={{ 
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
        </motion.div>

      </div>
      <div className={styles.comingSoonContent}>
        <motion.div 
          className={styles.comingSoonTitle}
          animate={{ 
            backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
          }}
          transition={{ 
            duration: 3,
            repeat: Infinity,
            ease: "linear"
          }}
        >
          More Coming Soon...
        </motion.div>
        {/* <div className={styles.comingSoonSubtitle}>
          Exciting new designs in the works
        </div> */}
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
          <div className={styles.productsContainer}>
            <div className={styles.loadingWrapper}>
              {Array(6).fill(0).map((_, index) => (
                <div key={index} className={styles.skeletonCard}>
                  <div className={styles.skeletonImage}></div>
                  <div className={styles.skeletonName}></div>
                  <div className={styles.skeletonPrice}></div>
                </div>
              ))}
            </div>
          </div>
        ) : error ? (
          <motion.div 
            className={styles.errorMessage}
            variants={itemVariants}
          >
            <p>Failed to load {type} products. Please try again later.</p>
          </motion.div>
        ) : (
          <div className={styles.productsContainer}>
            <div className={styles.productsWrapper}>
              {products.map((product, index) => (
                <motion.div
                  key={product._id || index}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                >
                  <ProductCard product={product} />
                </motion.div>
              ))}
              {/* Coming Soon Card */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: (products.length) * 0.05 }}
              >
                <ComingSoonCard />
              </motion.div>
            </div>
          </div>
        )}
      </div>
    </motion.section>
  );
}
