'use client';

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import styles from './styles/ProductImageSlider.module.css';

/**
 * CustomerPhotosSlider
 * Now accepts dynamic display assets (filtered in page) instead of hard-coded list.
 * Pass in an array of asset objects where each has media.desktop / media.mobile.
 */
export default function CustomerPhotosSlider({ assets = [] }) {
  const rawBase = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL || '';
  const baseUrl = rawBase.replace(/\/$/, '');

  // Derive image URLs from assets
  const images = assets
    .map(a => a?.media?.desktop || a?.media?.mobile || null)
    .filter(Boolean)
    .map(path => {
      if (!path) return null;
      return path.startsWith('http') ? path : `${baseUrl}${path.startsWith('/') ? path : '/' + path}`;
    })
    .filter(Boolean);

  if (!images.length) return null; // nothing to show

  // Animation variants for smooth entry
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.4,
        staggerChildren: 0.08,
        delayChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { 
      opacity: 0, 
      y: 30,
      scale: 0.95
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.5,
        ease: [0.25, 0.46, 0.45, 0.94] // Custom cubic-bezier for smooth animation
      }
    }
  };

  // Creative shaky hover animation variants
  const shakeVariants = {
    hover: {
      rotate: [0, -1, 1, -1, 1, 0],
      scale: 1.03,
      transition: {
        rotate: {
          duration: 0.4,
          ease: "easeInOut"
        },
        scale: {
          duration: 0.2,
          ease: "easeOut"
        }
      }
    }
  };

  return (
    <motion.div 
      className={styles.sliderContainer}
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.1 }}
    >
  {images.map((src, idx) => (
        <motion.div 
          className={styles.imageWrapper} 
          key={idx}
          variants={itemVariants}
          whileHover={shakeVariants.hover}
        >
          <Image
            src={src}
            alt={`product-${idx}`}
            width={200}              /* this sets the height via style */
            height={200}
            className={styles.image}
            unoptimized
            priority={idx < 4}
          />
        </motion.div>
      ))}
      
      {/* Share Your Photos Card */}
      <motion.div 
        className={styles.shareCard} 
        variants={itemVariants}
        whileHover={shakeVariants.hover}
  onClick={() => window.open('mailto:contact.maddycustoms@gmail.com?subject=My MaddyCustom Photos', '_blank')}
      >
        <div className={styles.shareCardContent}>
          <div className={styles.shareText}>
            <h3>Share Your MaddyCustom!</h3>
            <p>Got awesome photos of your custom ride? Send them our way!</p>
            <div className={styles.emailInfo}>
              <span className={styles.emailText}>contact.maddycustoms@gmail.com</span>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
