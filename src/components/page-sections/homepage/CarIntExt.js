'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import NoMarginCarousel from '@/components/showcase/carousels/NoMarginCarousel';
import styles from './styles/CarIntExt.module.css';

const ProductCard = ({ product }) => {
  if (!product) return null;

  return (
    <motion.div 
      className={styles.productCard}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
      whileHover={{ y: -2 }}
    >
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
  className = ""
}) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Capitalize the heading
  const heading = type.charAt(0).toUpperCase() + type.slice(1);

  // Filter carousel images from assets based on component name and type
  const carouselImages = useMemo(() => {
    const componentName = `car-${type}-carousel`;
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

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/products/car-${type}s?limit=6`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch ${type} products`);
        }
        
        const data = await response.json();
        setProducts(data.products || []);
      } catch (err) {
        console.error(`Error fetching ${type} products:`, err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [type]);

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
      {/* Carousel */}
      <motion.div variants={itemVariants}>
        <NoMarginCarousel 
          images={carouselImages}
          autoplay={true}
          autoplayDelay={5000}
          showPagination={true}
        />
      </motion.div>

      {/* Content Section */}
      <div className={styles.contentContainer}>
        <motion.h2 
          className={styles.heading}
          variants={itemVariants}
        >
          {heading}
        </motion.h2>

        {loading ? (
          <motion.div 
            className={styles.loadingGrid}
            variants={itemVariants}
          >
            {Array(6).fill(0).map((_, index) => (
              <div key={index} className={styles.skeletonCard}>
                <div className={styles.skeletonName}></div>
                <div className={styles.skeletonPrice}></div>
              </div>
            ))}
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
            className={styles.productsGrid}
            variants={containerVariants}
          >
            {products.map((product, index) => (
              <motion.div
                key={product._id || index}
                variants={itemVariants}
              >
                <ProductCard product={product} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </motion.section>
  );
}
